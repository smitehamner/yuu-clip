"""
SQLAlchemy 2.0 ORM models for rp-clipper.

Schema overview:
  Video          - one row per source recording file
  AudioTrack     - one row per audio stream within a video (with label + weight)
  Transcript     - one Whisper run per audio track
  TranscriptSeg  - individual Whisper segments (word-level timestamps)
  ClipCandidate  - proposed clip with timestamps, score fields, and status
  AudioEnergy    - per-second RMS energy curve per audio track (Phase 2)
  SceneBoundary  - detected scene cuts per video (Phase 2)
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)


# ---------------------------------------------------------------------------
# Base + engine factory
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


def make_engine(db_path: Path):
    """Create a SQLite engine.  Works identically on Windows and Linux."""
    # forward slashes are fine in SQLite URIs even on Windows
    url = f"sqlite:///{db_path.as_posix()}"
    engine = create_engine(url, echo=False)

    # Enable WAL mode for better concurrent read performance (Phase 3 UI)
    @event.listens_for(engine, "connect")
    def set_wal(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA journal_mode=WAL")
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    _migrate(engine)
    return engine


def _migrate(engine) -> None:
    """Apply lightweight forward-only column migrations for schema additions."""
    with engine.connect() as conn:
        raw = conn.connection
        cur = raw.cursor()
        # Phase 2: add do_score to audio_tracks if missing
        cur.execute("PRAGMA table_info(audio_tracks)")
        existing = {row[1] for row in cur.fetchall()}
        if "do_score" not in existing:
            cur.execute(
                "ALTER TABLE audio_tracks ADD COLUMN do_score BOOLEAN NOT NULL DEFAULT 1"
            )
            raw.commit()

        cur.execute("PRAGMA table_info(clip_candidates)")
        existing = {row[1] for row in cur.fetchall()}
        if "description" not in existing:
            cur.execute("ALTER TABLE clip_candidates ADD COLUMN description TEXT")
            raw.commit()

        cur.close()


def make_session(db_path: Path) -> Session:
    engine = make_engine(db_path)
    Session_ = sessionmaker(bind=engine)
    return Session_()


# ---------------------------------------------------------------------------
# Video
# ---------------------------------------------------------------------------

class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Stored as a string; use Path(video.path) when you need a Path object.
    # We store the absolute path so the project DB is portable between drives.
    path: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    fps: Mapped[Optional[float]] = mapped_column(Float)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)

    # pending → probed → labeled → extracting → transcribing → segmented → done
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    audio_tracks: Mapped[List["AudioTrack"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )
    clip_candidates: Mapped[List["ClipCandidate"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )

    @property
    def duration_hms(self) -> str:
        if not self.duration_ms:
            return "unknown"
        s = self.duration_ms // 1000
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}h {m:02d}m {sec:02d}s" if h else f"{m}m {sec:02d}s"


# ---------------------------------------------------------------------------
# AudioTrack
# ---------------------------------------------------------------------------

class AudioTrack(Base):
    __tablename__ = "audio_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))

    # Zero-based index among ALL streams in the container (not just audio streams)
    stream_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Label assigned during the labeling step
    label: Mapped[str] = mapped_column(String, default="unlabeled")
    relevance_weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Whether to run Whisper on this track (False for game_sounds by default)
    do_transcribe: Mapped[bool] = mapped_column(Boolean, default=True)
    # Whether to include this track in audio energy scoring (False for game_sounds)
    do_score: Mapped[bool] = mapped_column(Boolean, default=True)

    # Raw stream metadata from ffprobe
    codec: Mapped[Optional[str]] = mapped_column(String)
    sample_rate: Mapped[Optional[int]] = mapped_column(Integer)
    channels: Mapped[Optional[int]] = mapped_column(Integer)
    channel_layout: Mapped[Optional[str]] = mapped_column(String)
    stream_title_tag: Mapped[Optional[str]] = mapped_column(String)  # from metadata

    # Set after extraction
    extracted_path: Mapped[Optional[str]] = mapped_column(String)

    video: Mapped["Video"] = relationship(back_populates="audio_tracks")
    transcripts: Mapped[List["Transcript"]] = relationship(
        back_populates="audio_track", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Transcript + TranscriptSegment
# ---------------------------------------------------------------------------

class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audio_track_id: Mapped[int] = mapped_column(Integer, ForeignKey("audio_tracks.id"))

    model_name: Mapped[str] = mapped_column(String)
    language: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    audio_track: Mapped["AudioTrack"] = relationship(back_populates="transcripts")
    segments: Mapped[List["TranscriptSegment"]] = relationship(
        back_populates="transcript", cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_ms",
    )

    def full_text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments)


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(Integer, ForeignKey("transcripts.id"))

    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float)

    # FUTURE[diarization]: populated by speaker diarization (Phase 2+)
    # Will hold a label like "SPEAKER_00", later mapped to a character name.
    speaker_label: Mapped[Optional[str]] = mapped_column(String)

    transcript: Mapped["Transcript"] = relationship(back_populates="segments")


# ---------------------------------------------------------------------------
# ClipCandidate
# ---------------------------------------------------------------------------

class ClipCandidate(Base):
    __tablename__ = "clip_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))

    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Populated in Phase 1 via the windower (all 0.0 until Phase 2 scoring runs)
    score_overall: Mapped[float] = mapped_column(Float, default=0.0)
    # PHASE2: scored by LLM
    score_funny: Mapped[float] = mapped_column(Float, default=0.0)
    score_dramatic: Mapped[float] = mapped_column(Float, default=0.0)
    score_action: Mapped[float] = mapped_column(Float, default=0.0)

    # JSON-encoded list of strings, e.g. ["silence gap before", "energy spike"]
    reasons_json: Mapped[Optional[str]] = mapped_column(Text)
    # JSON-encoded list of tag strings, e.g. ["player_dialogue", "long_silence_after"]
    tags_json: Mapped[Optional[str]] = mapped_column(Text)

    transcript_excerpt: Mapped[Optional[str]] = mapped_column(Text)
    # One-sentence LLM-generated summary of what happens in the clip
    description: Mapped[Optional[str]] = mapped_column(Text)

    # pending → approved / rejected / trimmed
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    video: Mapped["Video"] = relationship(back_populates="clip_candidates")

    # --------------- helpers ---------------

    @property
    def reasons(self) -> list[str]:
        return json.loads(self.reasons_json) if self.reasons_json else []

    @reasons.setter
    def reasons(self, value: list[str]) -> None:
        self.reasons_json = json.dumps(value)

    @property
    def tags(self) -> list[str]:
        return json.loads(self.tags_json) if self.tags_json else []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self.tags_json = json.dumps(value)

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms

    @property
    def duration_hms(self) -> str:
        s = self.duration_ms // 1000
        m, sec = divmod(s, 60)
        return f"{m}m {sec:02d}s"

    @property
    def start_hms(self) -> str:
        s = self.start_ms // 1000
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


# ---------------------------------------------------------------------------
# Phase 2: Audio energy
# ---------------------------------------------------------------------------

class AudioEnergy(Base):
    """Per-second RMS energy for one audio track.  Populated by AudioEnergyScorer."""
    __tablename__ = "audio_energy"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audio_track_id: Mapped[int] = mapped_column(Integer, ForeignKey("audio_tracks.id"))
    second_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    rms_db: Mapped[float] = mapped_column(Float, nullable=False)

    audio_track: Mapped["AudioTrack"] = relationship()

    __table_args__ = (
        Index("ix_audio_energy_track_second", "audio_track_id", "second_offset"),
    )


# ---------------------------------------------------------------------------
# Phase 2: Scene boundaries
# ---------------------------------------------------------------------------

class SceneBoundary(Base):
    """A detected scene cut in a video.  Populated by SceneCutScorer."""
    __tablename__ = "scene_boundaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))
    timecode_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    video: Mapped["Video"] = relationship()

    __table_args__ = (
        Index("ix_scene_boundaries_video_time", "video_id", "timecode_ms"),
    )
