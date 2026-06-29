"""
SQLAlchemy 2.0 ORM models for yuu-clip.

Schema overview:
  Video             - one row per source recording file
  AudioTrack        - one row per audio stream within a video (with label + weight)
  Transcript        - one Whisper run per audio track
  TranscriptSegment - individual Whisper segments (word-level timestamps)
  ClipCandidate     - proposed clip with timestamps, score fields, and status
  AudioEnergy       - per-second RMS energy curve per audio track
  SceneBoundary     - detected scene cuts per video
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
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
    text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)
from sqlalchemy.pool import NullPool


class Base(DeclarativeBase):
    pass


def _format_ms_hms(ms: int) -> str:
    s = ms // 1000
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}h {m:02d}m {sec:02d}s" if h else f"{m}m {sec:02d}s"


def _decode_json_list(s) -> list:
    return json.loads(s) if s else []


def make_engine(db_path: Path):
    """Create a SQLite engine.  Works identically on Windows and Linux."""
    # forward slashes are fine in SQLite URIs even on Windows
    url = f"sqlite:///{db_path.as_posix()}"
    # NullPool: never keep connections open between requests.  With SQLite's
    # single-writer model this prevents pooled server connections from blocking
    # the ingest subprocess when it tries to INSERT.
    engine = create_engine(url, echo=False, poolclass=NullPool)

    @event.listens_for(engine, "connect")
    def set_pragmas(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA journal_mode=WAL")
        dbapi_connection.execute("PRAGMA foreign_keys=ON")
        # Wait up to 30 s when another writer holds the lock instead of failing immediately.
        # Needed when the ingest subprocess writes while the web server has open sessions.
        dbapi_connection.execute("PRAGMA busy_timeout=30000")

    Base.metadata.create_all(engine)
    _migrate(engine)
    return engine


_log = __import__("logging").getLogger(__name__)


def _migrate(engine) -> None:
    """Apply lightweight forward-only column migrations for schema additions.

    Every ALTER TABLE here must be guarded by a column-existence check so the
    migration is idempotent. Log each step at INFO so startup failures are
    diagnosable from the log file without attaching a debugger.
    """
    _log.info("Running DB migrations")
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(audio_tracks)"))}
        if "do_score" not in existing:
            _log.info("Migration: adding audio_tracks.do_score")
            conn.execute(text(
                "ALTER TABLE audio_tracks ADD COLUMN do_score BOOLEAN NOT NULL DEFAULT 1"
            ))

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(videos)"))}
        _video_migrations = [
            ("parent_video_id", "INTEGER REFERENCES videos(id)"),
            ("segment_start_s", "REAL"),
            ("segment_end_s",   "REAL"),
            ("title",           "TEXT"),
            ("summary",         "TEXT"),
            ("timeline_json",   "TEXT"),
            ("context_names_json",        "TEXT"),
            ("clips_scored_at",           "DATETIME"),
            ("clips_scored_context_json", "TEXT"),
            ("summarized_at",             "DATETIME"),
            ("summary_context_json",      "TEXT"),
            ("timeline_generated_at",     "DATETIME"),
            ("timeline_context_json",     "TEXT"),
            ("title_user",   "TEXT"),
            ("summary_user", "TEXT"),
        ]
        for col, typedef in _video_migrations:
            if col not in existing:
                _log.info("Migration: adding videos.%s", col)
                conn.execute(text(f"ALTER TABLE videos ADD COLUMN {col} {typedef}"))

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(transcripts)"))}
        if "clip_id" not in existing:
            _log.info("Migration: adding transcripts.clip_id")
            conn.execute(text("ALTER TABLE transcripts ADD COLUMN clip_id INTEGER REFERENCES clip_candidates(id)"))

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(clip_candidates)"))}
        _clip_migrations = [
            ("score_overall_user",  "REAL"),
            ("description",         "TEXT"),
            ("description_long",    "TEXT"),
            ("description_user",    "TEXT"),
            ("description_long_user", "TEXT"),
            ("start_offset",        "REAL NOT NULL DEFAULT 0.0"),
            ("end_offset",          "REAL NOT NULL DEFAULT 0.0"),
            ("exported_at",         "DATETIME"),
            ("exported_container",  "TEXT"),
            ("exported_burn_subs",  "BOOLEAN"),
            ("related_clips_json",  "TEXT"),
            ("related_clips_at",    "DATETIME"),
        ]
        for col, typedef in _clip_migrations:
            if col not in existing:
                _log.info("Migration: adding clip_candidates.%s", col)
                conn.execute(text(f"ALTER TABLE clip_candidates ADD COLUMN {col} {typedef}"))

        # Drop the UNIQUE(path) constraint — segments share their parent's path, so a
        # per-path unique index breaks re-analysis after segments exist.
        # SQLite can't DROP CONSTRAINT; recreate the table without it.
        videos_ddl = (conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='videos'"
        )).fetchone() or ("",))[0]
        if "UNIQUE (path)" in videos_ddl:
            _log.info("Migration: dropping UNIQUE(path) from videos (segments share parent path)")
            all_cols = ", ".join(row[1] for row in conn.execute(text("PRAGMA table_info(videos)")))
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            conn.execute(text(f"CREATE TABLE videos_migration_tmp AS SELECT {all_cols} FROM videos"))
            conn.execute(text("DROP TABLE videos"))
            conn.execute(text("""
                CREATE TABLE videos (
                    id INTEGER NOT NULL,
                    path VARCHAR NOT NULL,
                    filename VARCHAR NOT NULL,
                    duration_ms INTEGER,
                    fps FLOAT,
                    width INTEGER,
                    height INTEGER,
                    status VARCHAR NOT NULL,
                    created_at DATETIME NOT NULL,
                    processed_at DATETIME,
                    title TEXT,
                    summary TEXT,
                    timeline_json TEXT,
                    context_names_json TEXT,
                    clips_scored_at DATETIME,
                    clips_scored_context_json TEXT,
                    summarized_at DATETIME,
                    summary_context_json TEXT,
                    timeline_generated_at DATETIME,
                    timeline_context_json TEXT,
                    title_user TEXT,
                    summary_user TEXT,
                    parent_video_id INTEGER REFERENCES videos(id),
                    segment_start_s REAL,
                    segment_end_s REAL,
                    PRIMARY KEY (id)
                )
            """))
            conn.execute(text(f"INSERT INTO videos ({all_cols}) SELECT {all_cols} FROM videos_migration_tmp"))
            conn.execute(text("DROP TABLE videos_migration_tmp"))
            conn.execute(text("PRAGMA foreign_keys=ON"))
            _log.info("Migration: UNIQUE(path) removed from videos")

        conn.commit()
        _log.info("DB migrations complete")


def make_session(db_path: Path) -> Session:
    engine = make_engine(db_path)
    Session_ = sessionmaker(bind=engine)
    return Session_()


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Stored as a string; use Path(video.path) when you need a Path object.
    # We store the absolute path so the project DB is portable between drives.
    path: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    fps: Mapped[Optional[float]] = mapped_column(Float)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)

    # pending → probed → labeled → extracting → transcribing → segmented → done
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    parent_video_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("videos.id"), nullable=True)
    segment_start_s: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    segment_end_s: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    title: Mapped[Optional[str]] = mapped_column(Text)
    title_user: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    summary_user: Mapped[Optional[str]] = mapped_column(Text)
    timeline_json: Mapped[Optional[str]] = mapped_column(Text)

    context_names_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON list of context IDs

    # Provenance: timestamp + active context for each LLM operation, so the UI
    # can warn when results are stale after a context change.
    clips_scored_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    clips_scored_context_json: Mapped[Optional[str]] = mapped_column(Text)
    summarized_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    summary_context_json: Mapped[Optional[str]] = mapped_column(Text)
    timeline_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    timeline_context_json: Mapped[Optional[str]] = mapped_column(Text)

    segments: Mapped[List["Video"]] = relationship(
        "Video",
        foreign_keys="[Video.parent_video_id]",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    audio_tracks: Mapped[List["AudioTrack"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )
    clip_candidates: Mapped[List["ClipCandidate"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )

    @property
    def duration_hms(self) -> str:
        if self.duration_ms is None:
            return "unknown"
        return _format_ms_hms(self.duration_ms)


class AudioTrack(Base):
    __tablename__ = "audio_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))

    # Zero-based index among ALL streams in the container (not just audio streams)
    stream_index: Mapped[int] = mapped_column(Integer, nullable=False)

    label: Mapped[str] = mapped_column(String, default="unlabeled")
    relevance_weight: Mapped[float] = mapped_column(Float, default=1.0)
    # False for game_sounds by default — prevents unnecessary transcription/scoring
    do_transcribe: Mapped[bool] = mapped_column(Boolean, default=True)
    do_score: Mapped[bool] = mapped_column(Boolean, default=True)

    codec: Mapped[Optional[str]] = mapped_column(String)
    sample_rate: Mapped[Optional[int]] = mapped_column(Integer)
    channels: Mapped[Optional[int]] = mapped_column(Integer)
    channel_layout: Mapped[Optional[str]] = mapped_column(String)
    stream_title_tag: Mapped[Optional[str]] = mapped_column(String)

    extracted_path: Mapped[Optional[str]] = mapped_column(String)

    video: Mapped["Video"] = relationship(back_populates="audio_tracks")
    transcripts: Mapped[List["Transcript"]] = relationship(
        back_populates="audio_track",
        cascade="all, delete-orphan",
        primaryjoin="and_(AudioTrack.id == Transcript.audio_track_id, Transcript.clip_id == None)",
        foreign_keys="Transcript.audio_track_id",
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audio_track_id: Mapped[int] = mapped_column(Integer, ForeignKey("audio_tracks.id"))
    # NULL = track-level (full recording); set = clip-specific retranscription
    clip_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clip_candidates.id"), nullable=True)

    model_name: Mapped[str] = mapped_column(String)
    language: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

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

    # Speaker diarization label, e.g. "SPEAKER_00". Set by whisper_runner when
    # diarization is enabled; None otherwise. Not yet surfaced in the UI.
    speaker_label: Mapped[Optional[str]] = mapped_column(String)

    transcript: Mapped["Transcript"] = relationship(back_populates="segments")


class ClipCandidate(Base):
    __tablename__ = "clip_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))

    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    score_overall: Mapped[float] = mapped_column(Float, default=0.0)
    score_funny: Mapped[float] = mapped_column(Float, default=0.0)
    score_dramatic: Mapped[float] = mapped_column(Float, default=0.0)
    score_action: Mapped[float] = mapped_column(Float, default=0.0)
    score_overall_user: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    reasons_json: Mapped[Optional[str]] = mapped_column(Text)   # JSON list of strings
    tags_json: Mapped[Optional[str]] = mapped_column(Text)       # JSON list of strings

    transcript_excerpt: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    description_user: Mapped[Optional[str]] = mapped_column(Text)
    description_long: Mapped[Optional[str]] = mapped_column(Text)
    description_long_user: Mapped[Optional[str]] = mapped_column(Text)

    start_offset: Mapped[float] = mapped_column(Float, default=0.0)
    end_offset: Mapped[float] = mapped_column(Float, default=0.0)

    # pending → approved / rejected / trimmed
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    exported_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    exported_container: Mapped[Optional[str]] = mapped_column(String)
    exported_burn_subs: Mapped[Optional[bool]] = mapped_column(Boolean)

    related_clips_json: Mapped[Optional[str]] = mapped_column(Text)
    related_clips_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    video: Mapped["Video"] = relationship(back_populates="clip_candidates")
    clip_transcripts: Mapped[List["Transcript"]] = relationship(
        cascade="all, delete-orphan",
        primaryjoin="ClipCandidate.id == Transcript.clip_id",
        foreign_keys="Transcript.clip_id",
    )

    @property
    def reasons(self) -> list[str]:
        return _decode_json_list(self.reasons_json)

    @reasons.setter
    def reasons(self, value: list[str]) -> None:
        self.reasons_json = json.dumps(value)

    @property
    def tags(self) -> list[str]:
        return _decode_json_list(self.tags_json)

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self.tags_json = json.dumps(value)

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms

    @property
    def duration_hms(self) -> str:
        return _format_ms_hms(self.duration_ms)

    @property
    def start_hms(self) -> str:
        s = self.start_ms // 1000
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


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
