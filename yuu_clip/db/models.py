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
  VisualActivity    - per-sample on-screen activity (frame-diff) per video
  HotWord           - creator-defined phrase that boosts clip scores (project-wide)
  SensitiveTerm     - creator-defined privacy/censor term flagged on clips (project-wide)
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
    _ensure_additive_columns(engine)
    return engine


# create_all() creates missing tables but never adds a column to a table that
# already exists, so a new column on an existing table must be ALTERed in
# explicitly for pre-existing project DBs. Only additive columns belong here: a
# nullable column (existing rows become NULL), or a NOT NULL column that carries
# a DEFAULT so SQLite backfills existing rows (e.g. kind DEFAULT 'clip').
_ADDITIVE_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ("hot_words", "context_slug", "VARCHAR"),
    ("sensitive_terms", "context_slug", "VARCHAR"),
    ("transcript_segments", "words_json", "TEXT"),
    # Clips-vs-Scenes: NOT NULL DEFAULT backfills every existing row to 'clip'
    # (unlike the nullable columns above, this one carries a non-NULL default).
    ("clip_candidates", "kind", "VARCHAR NOT NULL DEFAULT 'clip'"),
    # Video-heavy analysis Stage 0: the 4th "Visual" scoring axis. Existing rows
    # backfill to NULL and read as 0.0 until re-scored (Rescore re-derives it).
    ("clip_candidates", "score_visual", "FLOAT"),
    # Project-wide speaker identity: cross-recording Person link + unconfirmed
    # suggestion. The project_voices / voice_exemplars tables themselves are created
    # by create_all(); only these columns on the pre-existing speakers table need the
    # explicit ALTER for DBs created before this feature.
    ("speakers", "global_voice_id", "INTEGER"),
    ("speakers", "suggested_voice_id", "INTEGER"),
    ("speakers", "suggested_voice_score", "FLOAT"),
    # Character linking: an optional overlay tying a Person to a world-context
    # Character. The characters table itself is a new table (create_all makes it);
    # only this pre-existing-table column needs the explicit ALTER. Plain INTEGER,
    # not a FK, for the same reason as speakers.global_voice_id above.
    ("project_voices", "character_id", "INTEGER"),
    # Transcription pause point: marks a transcript whose every segment landed.
    # Nullable, because "unfinished" is exactly what NULL means here - see the
    # one-time backfill below for why existing rows must not read as unfinished.
    ("transcripts", "completed_at", "DATETIME"),
)

# Run ONCE, immediately after the keyed column is first added, for a column whose
# correct value for pre-existing rows is not a constant SQLite accepts as an
# ALTER TABLE ... DEFAULT. Deliberately not re-run on later startups: every row
# that predates the column was written before the marker existed and is therefore
# finished, but a NULL written *after* the migration means genuinely unfinished,
# and re-running would silently mark a truncated transcript complete.
_ONE_TIME_BACKFILLS: dict[tuple[str, str], str] = {
    ("transcripts", "completed_at"):
        "UPDATE transcripts SET completed_at = created_at WHERE completed_at IS NULL",
}


def _ensure_additive_columns(engine) -> None:
    with engine.begin() as conn:
        for table, column, coltype in _ADDITIVE_COLUMNS:
            columns = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if column not in columns:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
                backfill = _ONE_TIME_BACKFILLS.get((table, column))
                if backfill:
                    conn.exec_driver_sql(backfill)


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

    # pending -> probed -> labeled -> extracting -> transcribing -> segmented -> done
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

    # The Session this recording belongs to (grouping multiple OBS files from one
    # play session). Only top-level recordings carry it; a split segment belongs
    # via its parent and always leaves this NULL. See RecordingSession.
    session_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sessions.id"), nullable=True)

    # Set at download time (see url_import.py) for a recording brought in via
    # Import from URL; NULL for a recording added from a local file. Populated
    # from the metadata sidecar when the Video row is first created - see
    # pipeline/ingest.py::_apply_source_metadata.
    source_url:         Mapped[Optional[str]]      = mapped_column(Text, nullable=True)
    source_title:       Mapped[Optional[str]]      = mapped_column(Text, nullable=True)
    source_uploader:    Mapped[Optional[str]]      = mapped_column(Text, nullable=True)
    source_upload_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    source_category:    Mapped[Optional[str]]      = mapped_column(Text, nullable=True)

    title: Mapped[Optional[str]] = mapped_column(Text)
    title_user: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    summary_user: Mapped[Optional[str]] = mapped_column(Text)
    timeline_json: Mapped[Optional[str]] = mapped_column(Text)

    context_names_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON list of context IDs

    # Set whenever a caption/speaker edit touches this recording's transcript
    # (caption edit, speaker rename/reassign, name-corrections apply - same routes
    # that stamp the overlapping ClipCandidate.transcript_edited_at above). Compared
    # against the on-disk SRT sidecar's own file mtime to flag a saved SRT that no
    # longer reflects the current transcript - see routes/videos.py::_transcript_srt_stale.
    transcript_edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

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
    session: Mapped[Optional["RecordingSession"]] = relationship(
        back_populates="videos", foreign_keys="[Video.session_id]",
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


class RecordingSession(Base):
    """A group of recordings from one play session, sharing a unified timeline.

    User-facing term: "Session". Named RecordingSession in code to avoid colliding
    with SQLAlchemy's orm.Session (imported in this module). Members are top-level
    recordings (videos.session_id); a split segment belongs via its parent and is
    never a direct member. Dissolving a session nulls members' session_id - it
    never deletes recordings (the delete route does this explicitly; there is no
    cascade).
    """
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Rollup title/summary generated from member recordings, mirroring the
    # title/title_user override pattern on Video (user edit wins over generated).
    title: Mapped[Optional[str]] = mapped_column(Text)
    title_user: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    summary_user: Mapped[Optional[str]] = mapped_column(Text)
    summarized_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    summary_context_json: Mapped[Optional[str]] = mapped_column(Text)

    videos: Mapped[List["Video"]] = relationship(
        back_populates="session",
        foreign_keys="[Video.session_id]",
        order_by="Video.created_at",
    )

    @property
    def effective_title(self) -> str:
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
    # False for game_sounds by default - prevents unnecessary transcription/scoring
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
    # Set only once every segment has been persisted. Transcription commits at
    # segment batch boundaries (so a pause point can block without holding SQLite's
    # single write lock), which means a run that dies mid-track leaves a committed
    # but TRUNCATED transcript behind. NULL is how the next run recognises one and
    # discards it instead of reusing it as complete - see
    # pipeline.ingest._reusable_track_transcript, the single place that decides.
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    audio_track: Mapped["AudioTrack"] = relationship(back_populates="transcripts")
    segments: Mapped[List["TranscriptSegment"]] = relationship(
        back_populates="transcript", cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_ms",
    )

    def full_text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments)


def latest_track_transcript(track):
    """Return a track's current (newest) track-level transcript, or None if it has none.

    "Current" is the most recently created transcript. Every read of a track's live
    transcript goes through this so the same selection rule holds across the pipeline,
    caption generation, clip windowing, and the web routes. ``track.transcripts`` is
    already filtered to track-level rows (clip_id IS NULL); clip retranscriptions are
    handled separately by their callers. Duck-typed on ``.transcripts`` so tests can
    pass lightweight track stand-ins.
    """
    transcripts = track.transcripts
    if not transcripts:
        return None
    return max(transcripts, key=lambda transcript: transcript.created_at)


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(Integer, ForeignKey("transcripts.id"))

    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float)

    # Raw diarization cluster id, e.g. "SPEAKER_00". Set by whisper_runner when
    # diarization is enabled; None otherwise. NOT stable across runs - kept only
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

    # Per-word timings for word-highlight (TikTok/CapCut-style) captions: a JSON
    # list of {"text", "start_ms", "end_ms"} in the same track-absolute ms frame
    # as this segment's start_ms/end_ms, captured by whisper_runner when word
    # timestamps are enabled and re-derived by forced alignment on a text edit.
    # NULL for pre-feature transcripts, non-English edits, or a failed alignment -
    # callers fall back to a static caption line.
    words_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    transcript: Mapped["Transcript"] = relationship(back_populates="segments")
    speaker: Mapped[Optional["Speaker"]] = relationship()

    @property
    def words(self) -> list[dict]:
        return json.loads(self.words_json) if self.words_json else []

    @words.setter
    def words(self, value: Optional[list[dict]]) -> None:
        self.words_json = json.dumps(value) if value else None


class Speaker(Base):
    """A durable, per-recording voice identity that segments are attributed to.

    Diarization assigns raw, run-unstable cluster ids (SPEAKER_00...); this row is
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
    # Which diarization backend produced `voiceprint` (currently "speechbrain").
    # Embeddings from different backends live in incompatible spaces, so re-attach
    # only compares voiceprints sharing the active backend. NULL when no voiceprint.
    voiceprint_backend: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # "manual" (created from a diarization cluster) or "inferred" (name suggested).
    source: Mapped[str] = mapped_column(String, default="manual")
    # Inferred names start unconfirmed until the creator accepts them.
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    # User-picked subtitle colour ("#RRGGBB"). NULL until the user overrides the
    # auto-assigned default - see display_color.
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Borderline voiceprint match recorded at diarization time: this freshly-minted
    # Speaker's voice landed just below the re-attach threshold of an existing
    # Speaker, so instead of silently re-attaching or minting in silence we record
    # the near miss for the user to confirm ("Same voice") or dismiss. Both NULL
    # when there was no near-threshold candidate. See _attach_speakers.
    suggested_match_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("speakers.id"), nullable=True
    )
    suggested_match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Cross-recording project identity (Person). NULL = this Speaker is not yet part
    # of any project-level voice. suggested_voice_id/_score carry an UNCONFIRMED
    # cross-recording match recorded during analyze - parallel to suggested_match_id
    # above but for the stricter project_voice_match_threshold. Confirming a match in
    # the People view sets global_voice_id; matching never sets it automatically.
    # Plain Integer, not ForeignKey, on purpose: on a DB predating this feature the
    # additive-migration guard adds these via `ALTER TABLE ADD COLUMN ... INTEGER`
    # (SQLite can't attach a FK that way), so declaring no FK keeps a freshly
    # create_all-ed schema identical to a migrated one. Referential cleanup is done in
    # code (People-view merge/split repoints links), same as suggested_match_id.
    global_voice_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suggested_voice_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suggested_voice_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    video: Mapped["Video"] = relationship(back_populates="speakers")
    global_voice: Mapped[Optional["ProjectVoice"]] = relationship(
        "ProjectVoice",
        primaryjoin="Speaker.global_voice_id == ProjectVoice.id",
        foreign_keys="Speaker.global_voice_id",
    )

    @property
    def display_name(self) -> str:
        """Effective display name, resolved in ONE place so captions/excerpts/exports/UI agree.

        A Speaker linked to a named Person (global_voice) shows that Person's name
        everywhere - naming a Person is what "applies across recordings" means. Else
        the Speaker's own confirmed name, else the 'Speaker N' fallback. An unconfirmed
        inferred name (source='inferred', confirmed=False) is a suggestion the user has
        not accepted yet, so it must not surface in captions, excerpts, or exports -
        only the Speakers card shows it.
        """
        voice = self.global_voice
        if voice is not None and voice.name:
            return voice.name
        return self.name if (self.name and self.confirmed) else f"Speaker {self.display_index}"

    @property
    def display_color(self) -> str:
        """Caption colour, resolved in ONE place (mirrors display_name).

        A Speaker linked to a Person takes that Person's colour, so one identity has one
        colour in every recording and recolouring the Person in the People view flows to
        every member's captions. Else the Speaker's own picked colour, else a default
        cycled from SPEAKER_COLOR_PALETTE keyed on display_index (stable and readable
        before the user has picked anything).
        """
        voice = self.global_voice
        if voice is not None:
            return voice.display_color
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


class ProjectVoice(Base):
    """A project-level identity ("Person") spanning recordings - one name everywhere.

    Per-recording ``Speaker`` rows link here via ``global_voice_id`` so naming this
    Person surfaces in every linked recording's captions/excerpts/exports (see
    ``Speaker.display_name``). Identity is carried by several ``VoiceExemplar``
    voiceprints (multi-exemplar, so a voice that drifts session to session still
    matches ANY exemplar) rather than one centroid. An auto-created or auto-suggested
    voice starts ``confirmed=False`` until the user accepts it in the People view;
    matching only ever SUGGESTS - it never links a Speaker automatically.
    """
    __tablename__ = "project_voices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Stable 1-based ordering for the "Person N" display fallback when unnamed.
    display_index: Mapped[int] = mapped_column(Integer, nullable=False)
    # User-picked colour ("#RRGGBB"); NULL falls back to SPEAKER_COLOR_PALETTE.
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Optional overlay link to a world-context Character (lore + score boost fed to the
    # LLM scorer). NULL = no link, the default and primary mode - a Person's name and
    # voiceprint identity are fully usable with no Character. Plain Integer, not a FK, on
    # purpose: the additive-migration guard adds this via ALTER TABLE ADD COLUMN (SQLite
    # can't attach a FK that way), so a create_all-ed schema stays identical to a migrated
    # one. Cleanup on Character/context delete nulls this in code, same as global_voice_id.
    character_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    exemplars: Mapped[List["VoiceExemplar"]] = relationship(
        back_populates="project_voice", cascade="all, delete-orphan"
    )
    # Explicit join (character_id is a plain Integer, not a declared FK - see above).
    character: Mapped[Optional["Character"]] = relationship(
        "Character",
        primaryjoin="ProjectVoice.character_id == Character.id",
        foreign_keys="ProjectVoice.character_id",
        viewonly=True,
    )

    @property
    def display_name(self) -> str:
        return self.name if self.name else f"Person {self.display_index}"

    @property
    def display_color(self) -> str:
        return self.color or SPEAKER_COLOR_PALETTE[(self.display_index - 1) % len(SPEAKER_COLOR_PALETTE)]


class VoiceExemplar(Base):
    """One voiceprint contributed to a ProjectVoice (the multi-exemplar drift model).

    A recording's Speaker matches a Person when its voiceprint is near ANY of that
    Person's exemplars; confirming a match adds the Speaker's voiceprint as a new
    exemplar. ``voiceprint_backend`` gates comparisons: embeddings from different
    diarization backends live in incompatible spaces, so a cross-backend cosine is
    meaningless and must be skipped (same rule as Speaker.voiceprint_backend).
    """
    __tablename__ = "voice_exemplars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_voice_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("project_voices.id"), nullable=False
    )
    voiceprint: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    voiceprint_backend: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Provenance: the Speaker this exemplar was seeded from. ON DELETE SET NULL so the
    # exemplar (and the voiceprint it contributed to a Person's identity) SURVIVES the
    # deletion of its source Speaker - a whole-speaker merge or a recording deletion must
    # not be blocked by this FK, and must not cascade the exemplar away. (foreign_keys is
    # ON, so a plain FK without this clause would RESTRICT the parent delete.)
    source_speaker_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    project_voice: Mapped["ProjectVoice"] = relationship(back_populates="exemplars")


class Character(Base):
    """A structured lore entity within a world context, linkable to a Person.

    A Person (ProjectVoice) may optionally reference one Character; when it does, the
    Character's ``lore`` and ``score_boost`` are fed into the LLM scoring prompt for
    clips that Person speaks in. The link is a pure overlay - a Person is fully usable
    with no Character, and a Character never changes a Person's name or voiceprint.

    ``context_slug`` keys this to a world context in contexts.json (a plain string, not
    a FK - contexts live in JSON, same precedent as HotWord.context_slug). Structured
    Characters coexist with a context's free-text ``your_characters`` / ``other_characters``
    prose; only the structured records drive per-character scoring boosts.
    """
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    context_slug: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Per-character knowledge fed to the scorer when this character speaks in a clip.
    lore: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Priority boost on a 0.0-1.0 scale (0.0 = no boost, the default). Surfaced to the
    # LLM as an explicit numeric hint; there is no deterministic post-score multiply.
    score_boost: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class ClipCandidate(Base):
    __tablename__ = "clip_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))

    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Candidate type discriminator: 'clip' (punchy 15-90s bit, the default) or
    # 'scene' (a longer 1-5 min contextual arc). Shares this table; generation,
    # scoring, and the three destructive re-window/score paths branch on it.
    kind: Mapped[str] = mapped_column(String, nullable=False, default="clip")

    score_overall: Mapped[float] = mapped_column(Float, default=0.0)
    score_funny: Mapped[float] = mapped_column(Float, default=0.0)
    score_dramatic: Mapped[float] = mapped_column(Float, default=0.0)
    score_action: Mapped[float] = mapped_column(Float, default=0.0)
    # 4th "Visual" axis (video-heavy analysis Stage 0): pixel-derived intensity
    # (scene-cut density today; on-screen activity later). 0.0 until re-scored.
    score_visual: Mapped[float] = mapped_column(Float, default=0.0)
    score_overall_user: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Raw, unweighted laugh-density result from LaughScorer (0-1). NULL = laugh
    # was never computed for this clip (pre-existing clips, or scorer disabled).
    score_laugh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    reasons_json: Mapped[Optional[str]] = mapped_column(Text)   # JSON list of strings
    tags_json: Mapped[Optional[str]] = mapped_column(Text)       # JSON list - system tags (llm_error, silence_Ns, ...)
    user_tags_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON list - user-defined tags

    transcript_excerpt: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    description_user: Mapped[Optional[str]] = mapped_column(Text)
    description_long: Mapped[Optional[str]] = mapped_column(Text)
    description_long_user: Mapped[Optional[str]] = mapped_column(Text)

    start_offset: Mapped[float] = mapped_column(Float, default=0.0)
    end_offset: Mapped[float] = mapped_column(Float, default=0.0)

    # Horizontal position of the 9:16 crop for a vertical (Shorts) export, as a
    # 0-1 fraction: 0=left edge flush, 0.5=center, 1=right edge flush. NULL means
    # center. A property of the clip's content, reused across vertical exports.
    crop_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # pending -> approved / rejected / trimmed
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    exported_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    exported_container: Mapped[Optional[str]] = mapped_column(String)
    exported_burn_subs: Mapped[Optional[bool]] = mapped_column(Boolean)
    exported_title_card: Mapped[Optional[bool]] = mapped_column(Boolean)
    # True when captions were muxed in as a soft subtitle stream (--embed-subs). Distinct
    # from exported_burn_subs (captions composited into the video pixels themselves) -
    # both mean the exported file's bytes depend on the transcript, for staleness purposes.
    exported_embed_subs: Mapped[Optional[bool]] = mapped_column(Boolean)

    # Hot-word matches found in this clip's transcript_excerpt, and the score boosts
    # actually applied - see HotWord and scoring/engine.py::apply_hotword_boosts.
    hotword_matches_json: Mapped[Optional[str]] = mapped_column(Text)
    hotword_boost_json:   Mapped[Optional[str]] = mapped_column(Text)

    # Sensitive-content matches found in this clip's transcript_excerpt and
    # descriptions - see SensitiveTerm and scoring/engine.py::apply_sensitive_scan.
    # Warning-only: never affects score_* (contrast with hotword_boost_json above).
    sensitive_matches_json: Mapped[Optional[str]] = mapped_column(Text)

    related_clips_json: Mapped[Optional[str]] = mapped_column(Text)
    related_clips_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Short factual "what's on screen" summary from image-based analysis (plan 11):
    # frames sampled from the clip window and described by a vision model. Enriches
    # descriptions and gives the text scorer visual context. NULL = never analyzed.
    vision_summary: Mapped[Optional[str]] = mapped_column(Text)
    vision_analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set when a caption segment overlapping this clip is edited. Compared against
    # the video's clips_scored_at to flag a clip whose transcript changed since it
    # was last scored (same provenance pattern as related_clips_at).
    transcript_edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set whenever start_offset/end_offset change (the trim/timing route) - compared
    # against exported_at to flag an exported file whose cut window has since moved.
    trim_edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Set whenever description/description_user actually changes value - compared
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
    exports: Mapped[List["ClipExport"]] = relationship(
        back_populates="clip", cascade="all, delete-orphan", order_by="ClipExport.created_at",
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
    def sensitive_matches(self) -> list[dict]:
        return json.loads(self.sensitive_matches_json) if self.sensitive_matches_json else []

    @sensitive_matches.setter
    def sensitive_matches(self, value: list[dict]) -> None:
        self.sensitive_matches_json = json.dumps(value)

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


class ClipExport(Base):
    """One exported video file for a clip, one row per (clip, Export preset).

    Before Plan 07 a clip could have only a single tracked export, recorded in
    ClipCandidate.exported_at/exported_container/exported_burn_subs/etc. Those
    columns stay in place and keep being written (the sidebar export pill and
    aggregate "exported" counts still read them) - retiring them is a separate
    follow-up. This table adds the richer, per-format tracking: re-exporting
    the same preset_name replaces this row's path/settings/created_at in
    place; a different preset_name adds a new row (see export/render.py's
    _record_clip_export).
    """
    __tablename__ = "clip_exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clip_id: Mapped[int] = mapped_column(Integer, ForeignKey("clip_candidates.id"), nullable=False)

    # "default" (no preset - original quality), a built-in preset id
    # ("youtube-1080p", "discord-10mb"), or "custom:<name>" for a user preset.
    preset_name: Mapped[str] = mapped_column(String, nullable=False, default="default")
    path: Mapped[str] = mapped_column(Text, nullable=False)
    container: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Whatever produced this file: burn_subs/embed_subs/title_card, and for a
    # preset export, its resolved height/crf/target_size_mb/audio_kbps.
    settings_json: Mapped[Optional[str]] = mapped_column(Text)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer)

    clip: Mapped["ClipCandidate"] = relationship(back_populates="exports")

    __table_args__ = (
        Index("ix_clip_exports_clip_id", "clip_id"),
    )

    @property
    def settings(self) -> dict:
        return json.loads(self.settings_json) if self.settings_json else {}

    @settings.setter
    def settings(self, value: dict) -> None:
        self.settings_json = json.dumps(value)


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


class VisualActivity(Base):
    """Per-sample on-screen activity for a video (video-heavy analysis Stage 1).

    Populated by analyze/motion.py::compute_activity: one row per sampled frame
    holding the mean absolute inter-frame pixel difference (0-255 scale) at that
    timecode. Model-free, sampled at a low fps on a downscaled stream, so it stays
    cheap on long recordings. Read by scoring/visual.py::VisualActivityScorer to
    lift the Visual axis for clips that overlap silent action.
    """
    __tablename__ = "visual_activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"))
    timecode_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    intensity: Mapped[float] = mapped_column(Float, nullable=False)

    video: Mapped["Video"] = relationship()

    __table_args__ = (
        Index("ix_visual_activity_video_time", "video_id", "timecode_ms"),
    )


class HotWord(Base):
    """A creator-defined phrase that boosts a clip's score when it appears in the
    transcript. Global (NULL context_slug) or scoped to a world context - see
    scoring/textmatch.py for the matcher, scoring/engine.py::apply_hotword_boosts
    for how boosts are applied, and scoring/term_scope.py for the context filter.
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
    # NULL = global (applies to every recording). A context ID (contexts.json /
    # BUILTIN_CONTEXTS) scopes the hot-word to recordings tagged with it. No FK -
    # contexts live in a JSON file; a deleted context leaves the term orphaned/inert.
    context_slug: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class SensitiveTerm(Base):
    """A creator-defined Privacy Term or Censor Word flagged (never scored) when it
    appears in a clip's transcript or descriptions. Global (NULL context_slug) or
    scoped to a world context - see scoring/textmatch.py for the matcher,
    scoring/engine.py::apply_sensitive_scan for how the flag is applied, and
    scoring/term_scope.py for the context filter. Term text is user PII by
    definition: never log the `term` value anywhere (routes/sensitive.py logs
    counts/ids only).
    """
    __tablename__ = "sensitive_terms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    term: Mapped[str] = mapped_column(String, nullable=False)
    # "privacy" | "censor"
    category: Mapped[str] = mapped_column(String, nullable=False, default="privacy")
    # "exact" | "case_insensitive" | "fuzzy"
    match_mode: Mapped[str] = mapped_column(String, nullable=False, default="exact")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # NULL = global. A context ID scopes the term to recordings tagged with it -
    # same soft-reference semantics as HotWord.context_slug above.
    context_slug: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
