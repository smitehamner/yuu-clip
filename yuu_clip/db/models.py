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
  HotWord           - creator-defined phrase that boosts clip scores (project-wide)
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
    LargeBinary,
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
            ("analyze_started_at", "DATETIME"),
            ("analyze_run_json",   "TEXT"),
            ("proxy_path",          "TEXT"),
            ("proxy_generated_at",  "DATETIME"),
            ("proxy_source_mtime",  "REAL"),
            ("proxy_source_size",   "INTEGER"),
        ]
        for col, typedef in _video_migrations:
            if col not in existing:
                _log.info("Migration: adding videos.%s", col)
                conn.execute(text(f"ALTER TABLE videos ADD COLUMN {col} {typedef}"))

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(transcripts)"))}
        if "clip_id" not in existing:
            _log.info("Migration: adding transcripts.clip_id")
            conn.execute(text("ALTER TABLE transcripts ADD COLUMN clip_id INTEGER REFERENCES clip_candidates(id)"))

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(transcript_segments)"))}
        if "speaker_id" not in existing:
            _log.info("Migration: adding transcript_segments.speaker_id")
            conn.execute(text(
                "ALTER TABLE transcript_segments ADD COLUMN speaker_id INTEGER REFERENCES speakers(id)"
            ))
        if "speaker_edited" not in existing:
            _log.info("Migration: adding transcript_segments.speaker_edited")
            conn.execute(text(
                "ALTER TABLE transcript_segments ADD COLUMN speaker_edited BOOLEAN NOT NULL DEFAULT 0"
            ))

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
            ("transcript_edited_at", "DATETIME"),
            ("user_tags_json",      "TEXT"),
            ("trim_edited_at",      "DATETIME"),
            ("description_edited_at", "DATETIME"),
            ("exported_title_card", "BOOLEAN"),
            ("exported_embed_subs", "BOOLEAN"),
            ("hotword_matches_json", "TEXT"),
            ("hotword_boost_json",   "TEXT"),
        ]
        for col, typedef in _clip_migrations:
            if col not in existing:
                _log.info("Migration: adding clip_candidates.%s", col)
                conn.execute(text(f"ALTER TABLE clip_candidates ADD COLUMN {col} {typedef}"))

        if "scored_at" not in existing:
            _log.info("Migration: adding clip_candidates.scored_at")
            conn.execute(text("ALTER TABLE clip_candidates ADD COLUMN scored_at DATETIME"))
            # Backfill: a video's clips_scored_at already means "every clip was
            # scored as of this timestamp" (see Video.clips_scored_at docstring),
            # so reuse it rather than leaving pre-existing clips looking unscored.
            # Clips whose video was never fully scored (including any left with
            # partial per-clip scores by a mid-batch failure) are intentionally
            # left NULL — Re-score corrects them either way.
            _log.info("Migration: backfilling clip_candidates.scored_at from parent video's clips_scored_at")
            conn.execute(text(
                "UPDATE clip_candidates SET scored_at = ("
                "  SELECT clips_scored_at FROM videos WHERE videos.id = clip_candidates.video_id"
                ") WHERE EXISTS ("
                "  SELECT 1 FROM videos"
                "  WHERE videos.id = clip_candidates.video_id AND videos.clips_scored_at IS NOT NULL"
                ")"
            ))

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

    # When the most recent analyze run began, and a JSON record of that run
    # (per-stage timings, effective settings, and CPU/GPU device) for later review.
    analyze_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    analyze_run_json: Mapped[Optional[str]] = mapped_column(Text)

    # 720p H.264 preview proxy for fast scrubbing (see analyze/proxy.py). The file
    # is shared across a recording and its segments; source_mtime/size invalidate
    # it when the source is re-recorded to the same path.
    proxy_path: Mapped[Optional[str]] = mapped_column(Text)
    proxy_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    proxy_source_mtime: Mapped[Optional[float]] = mapped_column(Float)
    proxy_source_size: Mapped[Optional[int]] = mapped_column(Integer)

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
    speakers: Mapped[List["Speaker"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )

    @property
    def duration_hms(self) -> str:
        if self.duration_ms is None:
            return "unknown"
        return _format_ms_hms(self.duration_ms)

    @property
    def effective_title(self) -> str:
        """User override if present, else the LLM-generated value, else empty."""
        return self.title_user if self.title_user is not None else (self.title or "")

    @property
    def effective_summary(self) -> str:
        return self.summary_user if self.summary_user is not None else (self.summary or "")


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

    # Raw pyannote cluster id, e.g. "SPEAKER_00". Set by whisper_runner when
    # diarization is enabled; None otherwise. NOT stable across runs — kept only
    # as provenance and as the fallback display when speaker_id is unset.
    speaker_label: Mapped[Optional[str]] = mapped_column(String)
    # Durable per-recording Speaker this segment was attributed to. Carries the
    # user-assigned name and survives re-diarization. None until diarized.
    speaker_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True
    )
    # True once a user hand-reassigns this segment's speaker, so the transcript can
    # distinguish auto-diarized lines from ones the user corrected.
    speaker_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    transcript: Mapped["Transcript"] = relationship(back_populates="segments")
    speaker: Mapped[Optional["Speaker"]] = relationship()


class Speaker(Base):
    """A durable, per-recording voice identity that segments are attributed to.

    Diarization assigns raw, run-unstable cluster ids (SPEAKER_00…); this row is
    the stable thing a creator names. ``voiceprint`` (a serialized embedding
    centroid) lets a re-diarization re-attach the same Speaker so the name is not
    lost. Per-recording scope in v1; cross-recording identity is deferred.
    """
    __tablename__ = "speakers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))

    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Stable 1-based ordering for the "Speaker N" display fallback when unnamed.
    display_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Serialized voice embedding centroid, used to re-attach this Speaker across
    # re-diarizations. NULL when the diarization backend produced no embedding.
    voiceprint: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    # "manual" (created from a diarization cluster) or "inferred" (name suggested).
    source: Mapped[str] = mapped_column(String, default="manual")
    # Inferred names start unconfirmed until the creator accepts them.
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    # User-picked subtitle colour ("#RRGGBB"). NULL until the user overrides the
    # auto-assigned default — see display_color.
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    video: Mapped["Video"] = relationship(back_populates="speakers")

    @property
    def display_name(self) -> str:
        """Confirmed name if set, else the 'Speaker N' fallback.

        An unconfirmed inferred name (source='inferred', confirmed=False) is a
        suggestion the user has not accepted yet, so it must not surface in
        captions, excerpts, or exports — only the Speakers card shows it.
        """
        return self.name if (self.name and self.confirmed) else f"Speaker {self.display_index}"

    @property
    def display_color(self) -> str:
        """User-picked colour if set, else a default cycled from SPEAKER_COLOR_PALETTE.

        The fallback is keyed on display_index (not id) so it is stable and
        readable immediately, before the user has picked anything.
        """
        return self.color or SPEAKER_COLOR_PALETTE[(self.display_index - 1) % len(SPEAKER_COLOR_PALETTE)]


# Default per-speaker subtitle colours, cycled by Speaker.display_index. Chosen for
# readability on both light and dark video backgrounds.
SPEAKER_COLOR_PALETTE: list[str] = [
    "#4fc3f7",  # blue
    "#f0c060",  # yellow
    "#4caf7d",  # green
    "#f7a85a",  # orange
    "#b06af7",  # purple
    "#e05c5c",  # red
    "#7cf7d3",  # teal
    "#f77ab0",  # pink
]


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
    tags_json: Mapped[Optional[str]] = mapped_column(Text)       # JSON list — system tags (llm_error, silence_Ns, …)
    user_tags_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON list — user-defined tags

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
    exported_title_card: Mapped[Optional[bool]] = mapped_column(Boolean)
    # True when captions were muxed in as a soft subtitle stream (--embed-subs). Distinct
    # from exported_burn_subs (captions composited into the video pixels themselves) —
    # both mean the exported file's bytes depend on the transcript, for staleness purposes.
    exported_embed_subs: Mapped[Optional[bool]] = mapped_column(Boolean)

    # Hot-word matches found in this clip's transcript_excerpt, and the score boosts
    # actually applied — see HotWord and scoring/engine.py::apply_hotword_boosts.
    hotword_matches_json: Mapped[Optional[str]] = mapped_column(Text)
    hotword_boost_json:   Mapped[Optional[str]] = mapped_column(Text)

    related_clips_json: Mapped[Optional[str]] = mapped_column(Text)
    related_clips_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set when a caption segment overlapping this clip is edited. Compared against
    # the video's clips_scored_at to flag a clip whose transcript changed since it
    # was last scored (same provenance pattern as related_clips_at).
    transcript_edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set whenever start_offset/end_offset change (the trim/timing route) — compared
    # against exported_at to flag an exported file whose cut window has since moved.
    trim_edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set whenever description/description_user actually changes value — compared
    # against exported_at to flag a title-card export whose burned-in text is stale.
    description_edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set the first time ScoringEngine.score_clip actually scores this clip. Null
    # distinguishes "never scored" from the score_* fields' 0.0 default, which a
    # mid-batch scoring failure can otherwise leave indistinguishable from a
    # genuine zero score.
    scored_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

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
    def user_tags(self) -> list[str]:
        return _decode_json_list(self.user_tags_json)

    @user_tags.setter
    def user_tags(self, value: list[str]) -> None:
        self.user_tags_json = json.dumps(value)

    @property
    def hotword_matches(self) -> list[dict]:
        return json.loads(self.hotword_matches_json) if self.hotword_matches_json else []

    @hotword_matches.setter
    def hotword_matches(self, value: list[dict]) -> None:
        self.hotword_matches_json = json.dumps(value)

    @property
    def hotword_boost(self) -> dict:
        return json.loads(self.hotword_boost_json) if self.hotword_boost_json else {}

    @hotword_boost.setter
    def hotword_boost(self, value: dict) -> None:
        self.hotword_boost_json = json.dumps(value)

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

    @property
    def effective_description(self) -> str:
        """User override if present, else the LLM-generated value, else empty."""
        return self.description_user if self.description_user is not None else (self.description or "")

    @property
    def effective_description_long(self) -> str:
        return (
            self.description_long_user
            if self.description_long_user is not None
            else (self.description_long or "")
        )


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


class HotWord(Base):
    """A creator-defined phrase that boosts a clip's score when it appears in the
    transcript. Project-wide (not per-video) — see scoring/textmatch.py for the
    matcher and scoring/engine.py::apply_hotword_boosts for how boosts are applied.
    """
    __tablename__ = "hot_words"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phrase: Mapped[str] = mapped_column(String, nullable=False)
    # "exact" | "case_insensitive" | "semantic"
    match_mode: Mapped[str] = mapped_column(String, nullable=False, default="exact")
    boost: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # "overall" | "funny" | "dramatic" | "action"
    target: Mapped[str] = mapped_column(String, nullable=False, default="overall")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
