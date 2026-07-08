"""Tests for forward-only column migrations in yuu_clip.db.models._migrate."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from yuu_clip.db.models import ClipCandidate, Video, _migrate, make_engine


class TestEngineInvariants:
    """The SQLite single-writer defenses (CLAUDE.md) live entirely inside
    make_engine, which is the only create_engine call site. Lock them so a
    refactor can't drop NullPool or the busy_timeout that keeps the web server
    from starving the ingest subprocess of the write lock."""

    def test_engine_uses_nullpool(self, tmp_path: Path):
        assert isinstance(make_engine(tmp_path / "e.db").pool, NullPool)

    def test_busy_timeout_pragma_is_30s(self, tmp_path: Path):
        engine = make_engine(tmp_path / "e.db")
        with engine.connect() as conn:
            assert conn.exec_driver_sql("PRAGMA busy_timeout").scalar() == 30000


def _column_names(engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}


# A videos table as it existed when the UNIQUE(path)-drop migration was written:
# it carries UNIQUE (path) but predates the later source_*/proxy_*/analyze_*
# columns. On a real legacy DB the ADD-COLUMN loop adds those *before* the
# constraint-drop block runs, which is exactly what used to crash the recreation.
_LEGACY_VIDEOS_DDL = """
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
    PRIMARY KEY (id),
    UNIQUE (path)
)
"""


def _build_legacy_videos_db(db_path: Path):
    """Full current schema for the sibling tables, but a legacy videos table."""
    engine = make_engine(db_path)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE videos"))
        conn.execute(text(_LEGACY_VIDEOS_DDL))
    return engine


def _videos_ddl(engine) -> str:
    with engine.connect() as conn:
        return conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='videos'"
        )).scalar()


class TestScoredAtBackfillMigration:
    """clip_candidates.scored_at is backfilled from the parent video's
    clips_scored_at so pre-existing scored clips don't start looking unscored."""

    def test_backfills_from_scored_video_leaves_unscored_video_null(self, tmp_path: Path):
        engine = make_engine(tmp_path / "legacy.db")
        Session_ = sessionmaker(bind=engine)
        session = Session_()

        scored_video = Video(path="a", filename="a.mkv", status="done",
                              clips_scored_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        unscored_video = Video(path="b", filename="b.mkv", status="done")
        session.add_all([scored_video, unscored_video])
        session.flush()

        clip_scored = ClipCandidate(video_id=scored_video.id, start_ms=0, end_ms=1000, score_overall=0.5)
        clip_unscored = ClipCandidate(video_id=unscored_video.id, start_ms=0, end_ms=1000, score_overall=0.0)
        session.add_all([clip_scored, clip_unscored])
        session.commit()
        scored_id, unscored_id = clip_scored.id, clip_unscored.id
        session.close()

        # Simulate a pre-migration DB that predates the scored_at column.
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE clip_candidates DROP COLUMN scored_at"))
            conn.commit()
        assert "scored_at" not in _column_names(engine, "clip_candidates")

        _migrate(engine)

        assert "scored_at" in _column_names(engine, "clip_candidates")
        with engine.connect() as conn:
            rows = dict(conn.execute(text(
                "SELECT id, scored_at FROM clip_candidates"
            )).fetchall())
        assert rows[scored_id] is not None
        assert rows[unscored_id] is None

    def test_idempotent_on_second_run(self, tmp_path: Path):
        """Re-running _migrate after scored_at already exists must not touch data."""
        engine = make_engine(tmp_path / "fresh.db")
        Session_ = sessionmaker(bind=engine)
        session = Session_()
        video = Video(path="a", filename="a.mkv", status="done")
        session.add(video)
        session.flush()
        clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=1000, score_overall=0.5,
                              scored_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        session.add(clip)
        session.commit()
        clip_id = clip.id
        session.close()

        _migrate(engine)

        with engine.connect() as conn:
            scored_at = conn.execute(text(
                "SELECT scored_at FROM clip_candidates WHERE id = :id"
            ), {"id": clip_id}).scalar()
        assert scored_at is not None


class TestDropUniquePathMigration:
    """The UNIQUE(path) drop recreates the videos table. It must derive the new
    DDL from the live schema (never a hardcoded column list), so newer columns
    added by the ADD-COLUMN loop above it don't crash the INSERT ... SELECT."""

    def test_drops_unique_path_on_legacy_db_with_newer_columns(self, tmp_path: Path):
        engine = _build_legacy_videos_db(tmp_path / "legacy.db")
        created = datetime(2026, 1, 1, tzinfo=timezone.utc)
        # Distinct paths: a legacy DB that still enforces UNIQUE(path) cannot
        # contain segment rows sharing their parent's path - those become
        # possible only once the constraint is gone (asserted below).
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO videos (id, path, filename, status, created_at, title) "
                "VALUES (1, '/vids/a.mkv', 'a.mkv', 'done', :created, 'Session A')"
            ), {"created": created})
            conn.execute(text(
                "INSERT INTO videos (id, path, filename, status, created_at, title) "
                "VALUES (2, '/vids/b.mkv', 'b.mkv', 'done', :created, 'Session B')"
            ), {"created": created})

        _migrate(engine)  # must not raise despite source_*/proxy_* now present

        ddl = _videos_ddl(engine)
        assert "UNIQUE (path)" not in ddl
        assert "source_url" in _column_names(engine, "videos")
        with engine.connect() as conn:
            rows = {r[0]: r[1] for r in conn.execute(text(
                "SELECT id, title FROM videos ORDER BY id"
            ))}
        assert rows == {1: "Session A", 2: "Session B"}

        # Idempotent: the drop block is skipped on a second pass.
        ddl_before_second = _videos_ddl(engine)
        _migrate(engine)
        assert _videos_ddl(engine) == ddl_before_second
        with engine.connect() as conn:
            assert {r[0]: r[1] for r in conn.execute(text(
                "SELECT id, title FROM videos ORDER BY id"
            ))} == {1: "Session A", 2: "Session B"}

        # The reason the drop exists: two segments may now share their parent's path.
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO videos (id, path, filename, status, created_at, "
                "parent_video_id, segment_start_s, segment_end_s) "
                "VALUES (3, '/vids/a.mkv', 'a.mkv', 'done', :created, 1, 0.0, 10.0)"
            ), {"created": created})
            conn.execute(text(
                "INSERT INTO videos (id, path, filename, status, created_at, "
                "parent_video_id, segment_start_s, segment_end_s) "
                "VALUES (4, '/vids/a.mkv', 'a.mkv', 'done', :created, 1, 10.0, 20.0)"
            ), {"created": created})
        with engine.connect() as conn:
            segment_paths = [r[0] for r in conn.execute(text(
                "SELECT path FROM videos WHERE parent_video_id = 1 ORDER BY id"
            ))]
        assert segment_paths == ["/vids/a.mkv", "/vids/a.mkv"]
