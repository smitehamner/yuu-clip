"""Tests for the SQLite engine invariants in yuu_clip.db.models.make_engine."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from sqlalchemy.pool import NullPool

from yuu_clip.db.models import _ADDITIVE_COLUMNS, make_engine


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


class TestAdditiveColumns:
    """create_all never adds a column to a table that already exists, so a
    project DB created before a nullable column landed (e.g. a restored older
    backup) must have it ALTERed in on open. Every entry in _ADDITIVE_COLUMNS
    must actually be re-added - a missing registration silently breaks such a
    DB with an OperationalError on first query of the model."""

    def _drop_column(self, db_path: Path, table: str, column: str):
        conn = sqlite3.connect(db_path)
        try:
            conn.execute(f"ALTER TABLE {table} DROP COLUMN {column}")
            conn.commit()
        finally:
            conn.close()

    def _columns(self, engine, table: str) -> set[str]:
        with engine.connect() as conn:
            return {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}

    def test_words_json_re_added_on_preexisting_db(self, tmp_path: Path):
        db = tmp_path / "old.db"
        make_engine(db).dispose()
        self._drop_column(db, "transcript_segments", "words_json")

        assert "words_json" in self._columns(make_engine(db), "transcript_segments")

    def test_every_registered_column_is_re_added(self, tmp_path: Path):
        db = tmp_path / "old.db"
        make_engine(db).dispose()
        for table, column, _coltype in _ADDITIVE_COLUMNS:
            self._drop_column(db, table, column)

        engine = make_engine(db)
        for table, column, _coltype in _ADDITIVE_COLUMNS:
            assert column in self._columns(engine, table), f"{table}.{column} not re-added"

    def test_kind_column_backfills_existing_rows_to_clip(self, tmp_path: Path):
        """The clip_candidates.kind column uses NOT NULL DEFAULT 'clip', so a row
        that predates the column (an existing project's clips) backfills to 'clip'
        on next open - no data wipe. Simulated by dropping the column from a seeded
        DB and re-opening (which ALTERs it back with the default)."""
        from sqlalchemy.orm import sessionmaker

        from yuu_clip.db.models import ClipCandidate, Video

        db = tmp_path / "old.db"
        engine = make_engine(db)
        session = sessionmaker(bind=engine)()
        video = Video(path="x.mkv", filename="x.mkv")
        session.add(video)
        session.flush()
        clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=1_000, kind="scene")
        session.add(clip)
        session.commit()
        clip_id = clip.id
        session.close()
        engine.dispose()

        self._drop_column(db, "clip_candidates", "kind")

        engine2 = make_engine(db)  # re-adds kind DEFAULT 'clip', backfilling the orphaned row
        session2 = sessionmaker(bind=engine2)()
        try:
            assert session2.get(ClipCandidate, clip_id).kind == "clip"
        finally:
            session2.close()
