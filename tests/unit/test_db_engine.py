"""Tests for the SQLite engine invariants in yuu_clip.db.models.make_engine."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
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


class TestOneTimeBackfills:
    """transcripts.completed_at cannot express its correct pre-existing-row value as a
    SQLite ALTER-TABLE DEFAULT (it is not a constant), so it carries a one-time UPDATE
    run at the moment the column is added. Getting this wrong is expensive in both
    directions: no backfill silently re-transcribes every existing recording, and a
    backfill that re-runs marks a genuinely truncated transcript complete."""

    def _drop_column(self, db_path: Path, table: str, column: str):
        conn = sqlite3.connect(db_path)
        try:
            conn.execute(f"ALTER TABLE {table} DROP COLUMN {column}")
            conn.commit()
        finally:
            conn.close()

    def _seed_transcript(self, engine, completed_at):
        from sqlalchemy.orm import sessionmaker

        from yuu_clip.db.models import AudioTrack, Transcript, Video

        session = sessionmaker(bind=engine)()
        video = Video(path="x.mkv", filename="x.mkv")
        session.add(video)
        session.flush()
        track = AudioTrack(video_id=video.id, stream_index=0, label="combined")
        session.add(track)
        session.flush()
        transcript = Transcript(
            audio_track_id=track.id, model_name="medium", completed_at=completed_at,
        )
        session.add(transcript)
        session.commit()
        transcript_id = transcript.id
        session.close()
        return transcript_id

    def _completed_at(self, engine, transcript_id):
        from sqlalchemy.orm import sessionmaker

        from yuu_clip.db.models import Transcript

        session = sessionmaker(bind=engine)()
        try:
            return session.get(Transcript, transcript_id).completed_at
        finally:
            session.close()

    def test_preexisting_transcripts_backfill_to_complete(self, tmp_path: Path):
        db = tmp_path / "old.db"
        engine = make_engine(db)
        transcript_id = self._seed_transcript(engine, datetime(2020, 1, 1, tzinfo=timezone.utc))
        engine.dispose()

        self._drop_column(db, "transcripts", "completed_at")  # a DB predating the marker

        assert self._completed_at(make_engine(db), transcript_id) is not None

    def test_backfill_does_not_re_run_on_later_opens(self, tmp_path: Path):
        """A transcript left unfinished by a crashed run must stay unfinished across
        restarts - otherwise the next analyze reuses a truncated transcript."""
        db = tmp_path / "project.db"
        engine = make_engine(db)
        transcript_id = self._seed_transcript(engine, None)
        engine.dispose()

        assert self._completed_at(make_engine(db), transcript_id) is None


class TestAdditiveColumnCompleteness:
    """`create_all` builds a fresh DB in full, so a forgotten `_ADDITIVE_COLUMNS`
    entry is invisible until a *pre-existing* user DB (older backup, upgraded
    project) is opened and the new column is missing -> OperationalError on the
    first query. `_ADDITIVE_COLUMNS` is maintained by developer memory, so this is
    the tripwire: any column added to a shipped table must be consciously
    categorized as either guarded (survives an upgrade) or fresh-DB-only.

    The two frozen snapshots below are the shipped column surface of the two
    most-churned tables. When a column is added or removed on one of them this
    test fails, forcing the decision:
      * existing user DBs must keep working across the upgrade -> add the column
        to `_ADDITIVE_COLUMNS` in `db/models.py`, then add it here;
      * fresh-DB-only is acceptable (the deferred wipe-fresh migration decision,
        docs: db_migration_deferred) -> add it here only.
    Do not blindly append to the snapshot to make the test pass - that silently
    ships an unguarded column to every existing project DB.
    """

    # Full shipped column surface (core + guarded). Guarded columns are marked so
    # the test can assert every non-core column is actually registered in the guard.
    _EXPECTED: dict[str, set[str]] = {
        "clip_candidates": {
            "id", "video_id", "start_ms", "end_ms", "kind",
            "score_overall", "score_funny", "score_dramatic", "score_action",
            "score_visual", "score_overall_user", "score_laugh",
            "reasons_json", "tags_json", "user_tags_json",
            "transcript_excerpt", "description", "description_user",
            "description_long", "description_long_user",
            "start_offset", "end_offset", "crop_x", "status", "created_at",
            "exported_at", "exported_container", "exported_burn_subs",
            "exported_title_card", "exported_embed_subs",
            "hotword_matches_json", "hotword_boost_json", "sensitive_matches_json",
            "related_clips_json", "related_clips_at",
            "vision_summary", "vision_analyzed_at",
            "transcript_edited_at", "trim_edited_at", "description_edited_at",
            "scored_at",
        },
        "transcript_segments": {
            "id", "transcript_id", "start_ms", "end_ms", "text", "confidence",
            "speaker_label", "speaker_id", "speaker_edited", "words_json",
        },
    }

    def _guarded(self, table: str) -> set[str]:
        return {col for tbl, col, _type in _ADDITIVE_COLUMNS if tbl == table}

    def test_snapshot_matches_orm(self):
        from yuu_clip.db.models import ClipCandidate, TranscriptSegment

        for model in (ClipCandidate, TranscriptSegment):
            table = model.__tablename__
            actual = set(model.__table__.columns.keys())
            assert actual == self._EXPECTED[table], (
                f"Column surface of shipped table {table!r} changed. Categorize the "
                f"added/removed column as guarded (add to _ADDITIVE_COLUMNS) or "
                f"fresh-DB-only, then update this snapshot. Added: "
                f"{sorted(actual - self._EXPECTED[table])}, removed: "
                f"{sorted(self._EXPECTED[table] - actual)}."
            )

    def test_every_non_core_column_is_guarded(self):
        # A "non-core" column is one that is NOT createable on an existing DB by
        # create_all - i.e. every column added after the table first shipped. The
        # guard list is the authoritative record of those; this asserts each one it
        # names on these tables is a real ORM column (no stale/typo'd guard entry).
        from yuu_clip.db.models import ClipCandidate, TranscriptSegment

        for model in (ClipCandidate, TranscriptSegment):
            table = model.__tablename__
            orm_columns = set(model.__table__.columns.keys())
            for guarded in self._guarded(table):
                assert guarded in orm_columns, (
                    f"_ADDITIVE_COLUMNS names {table}.{guarded}, which is not an ORM "
                    f"column - stale or misspelled guard entry."
                )
