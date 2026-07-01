"""Tests for forward-only column migrations in yuu_clip.db.models._migrate."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from yuu_clip.db.models import ClipCandidate, Video, _migrate, make_engine


def _column_names(engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}


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
