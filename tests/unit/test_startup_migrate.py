"""Startup auto-migrate + backup (yuu_clip/db/migrate.py) - the safety-critical piece.

Covers the four startup shapes plus the failure contract:
  * a brand-new DB is built to head by the migrations;
  * a pre-Alembic DB (create_all, no alembic_version) is adopted by stamping, rows intact;
  * a genuinely-pending migration backs the DB up (deterministic .bak) then upgrades, rows intact;
  * a failing upgrade raises MigrationError and preserves the backup (never serves half-migrated);
  * db_migrate_on_startup = False opts out entirely.
"""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from yuu_clip.db import migrate
from yuu_clip.db.migrate import (
    MigrationError,
    database_revision,
    make_alembic_config,
    run_startup_migrations,
    script_head,
)
from yuu_clip.db.models import Character, Video, make_engine, sqlite_url

_FIXED_CLOCK = lambda: datetime(2026, 1, 2, 3, 4, 5)  # noqa: E731 - test clock seam
_ENABLED = SimpleNamespace(db_migrate_on_startup=True)


def _seed_pre_alembic_db(db_path: Path) -> None:
    """A DB as an old (pre-migration-framework) app left it: create_all schema, real
    rows, and NO alembic_version table."""
    engine = make_engine(db_path)
    session = sessionmaker(bind=engine)()
    session.add(Video(path="s.mkv", filename="s.mkv"))
    session.add(Character(context_slug="ctx", name="Hero"))
    session.commit()
    session.close()
    engine.dispose()


def _column_names(db_path: Path, table: str) -> set[str]:
    engine = create_engine(sqlite_url(db_path))
    try:
        return {col["name"] for col in inspect(engine).get_columns(table)}
    finally:
        engine.dispose()


def _clone_migrations_with_extra(tmp_path: Path, revision_body: str) -> Path:
    cloned = tmp_path / "migrations"
    shutil.copytree(migrate._MIGRATIONS_DIR, cloned)
    (cloned / "versions" / "0002_extra.py").write_text(revision_body, encoding="utf-8")
    return cloned


_ADD_COLUMN_REVISION = """\
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0002_extra"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table("characters") as batch_op:
        batch_op.add_column(sa.Column("test_added", sa.String(), nullable=True))

def downgrade() -> None:
    raise NotImplementedError
"""

_FAILING_REVISION = """\
from __future__ import annotations
from alembic import op

revision = "0002_extra"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("THIS IS NOT VALID SQL")

def downgrade() -> None:
    raise NotImplementedError
"""


def test_new_database_is_built_to_head(tmp_path: Path) -> None:
    db_path = tmp_path / ".yuu-clip" / "project.db"
    db_path.parent.mkdir(parents=True)

    run_startup_migrations(db_path, _ENABLED, now=_FIXED_CLOCK)

    assert database_revision(db_path) == script_head(make_alembic_config(db_path))


def test_pre_alembic_db_is_adopted_with_rows_intact(tmp_path: Path) -> None:
    db_path = tmp_path / ".yuu-clip" / "project.db"
    db_path.parent.mkdir(parents=True)
    _seed_pre_alembic_db(db_path)
    assert database_revision(db_path) is None

    run_startup_migrations(db_path, _ENABLED, now=_FIXED_CLOCK)

    assert database_revision(db_path) == script_head(make_alembic_config(db_path))
    # Adoption stamps only - no backup and no rebuild, the existing rows survive.
    engine = make_engine(db_path)
    session = sessionmaker(bind=engine)()
    assert session.query(Video).count() == 1
    assert session.query(Character).count() == 1
    session.close()
    engine.dispose()
    assert list(db_path.parent.glob("*.bak")) == []


def test_pending_migration_backs_up_then_upgrades(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / ".yuu-clip" / "project.db"
    db_path.parent.mkdir(parents=True)
    _seed_pre_alembic_db(db_path)
    run_startup_migrations(db_path, _ENABLED, now=_FIXED_CLOCK)  # adopt at 0001_baseline

    monkeypatch.setattr(migrate, "_MIGRATIONS_DIR", _clone_migrations_with_extra(tmp_path, _ADD_COLUMN_REVISION))

    run_startup_migrations(db_path, _ENABLED, now=_FIXED_CLOCK)

    assert database_revision(db_path) == "0002_extra"
    assert "test_added" in _column_names(db_path, "characters")
    backup = db_path.parent / "project.db.pre-migration-20260102-030405.bak"
    assert backup.is_file()
    # Rows survive the upgrade.
    engine = make_engine(db_path)
    session = sessionmaker(bind=engine)()
    assert session.query(Character).count() == 1
    session.close()
    engine.dispose()


def test_failed_upgrade_raises_and_keeps_backup(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / ".yuu-clip" / "project.db"
    db_path.parent.mkdir(parents=True)
    _seed_pre_alembic_db(db_path)
    run_startup_migrations(db_path, _ENABLED, now=_FIXED_CLOCK)  # adopt at 0001_baseline

    monkeypatch.setattr(migrate, "_MIGRATIONS_DIR", _clone_migrations_with_extra(tmp_path, _FAILING_REVISION))

    with pytest.raises(MigrationError) as excinfo:
        run_startup_migrations(db_path, _ENABLED, now=_FIXED_CLOCK)

    backup = db_path.parent / "project.db.pre-migration-20260102-030405.bak"
    assert backup.is_file()
    assert str(backup) in str(excinfo.value)
    # The DB was not advanced past the last-good revision.
    assert database_revision(db_path) == "0001_baseline"


def test_opt_out_skips_migration_entirely(tmp_path: Path) -> None:
    db_path = tmp_path / ".yuu-clip" / "project.db"
    db_path.parent.mkdir(parents=True)
    _seed_pre_alembic_db(db_path)

    run_startup_migrations(db_path, SimpleNamespace(db_migrate_on_startup=False), now=_FIXED_CLOCK)

    assert database_revision(db_path) is None
