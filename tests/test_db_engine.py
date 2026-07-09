"""Tests for the SQLite engine invariants in yuu_clip.db.models.make_engine."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.pool import NullPool

from yuu_clip.db.models import make_engine


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
