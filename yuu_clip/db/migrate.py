"""Startup database migration + backup (the safety-critical piece).

yuu-clip ships to non-developer users who never run a command, so the app upgrades
its own project DB on startup. Locked decisions (see docs/dev/ARCHITECTURE.md):

  * Alembic is the migration tool.
  * On startup, before the server serves or launches any writer subprocess, the DB
    is migrated to head - after copying it to a timestamped .bak when migrations are
    pending, so a failed upgrade is always recoverable.
  * Forward-only: recovery from a bad upgrade is restoring the backup, never a
    downgrade.

Only the web server migrates; the analyze subprocess never does (it opens the DB only
after the server has already brought it to head). run_startup_migrations is the single
entry point, called from ProjectContext when it binds a project (boot, project switch,
restore) and by `yuu-dev migrate`.
"""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, Inspector
from sqlalchemy.inspection import inspect
from sqlalchemy.pool import NullPool

from yuu_clip.db.models import sqlite_url
from yuu_clip.log import get_logger

_log = get_logger(__name__)

_MIGRATIONS_DIR = Path(__file__).parent / "migrations"

# A core table present in every real yuu-clip DB. Its presence distinguishes a
# populated pre-Alembic database (adopt by stamping) from a brand-new empty file
# (build the schema from the baseline migration). See run_startup_migrations.
_SENTINEL_TABLE = "videos"


class MigrationError(RuntimeError):
    """A startup migration could not complete. The pre-migration backup is intact;
    the server must not serve on a half-migrated DB. The message is safe to show the
    user (it names the backup path)."""


def make_alembic_config(db_path: Path) -> AlembicConfig:
    """Alembic Config wired to the packaged migrations and *db_path* - no alembic.ini
    needed at runtime (the packaged app has no repo root). env.py reads the URL from
    ``attributes``."""
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(_MIGRATIONS_DIR))
    cfg.attributes["sqlalchemy_url"] = sqlite_url(db_path)
    return cfg


def script_head(cfg: AlembicConfig) -> Optional[str]:
    return ScriptDirectory.from_config(cfg).get_current_head()


def script_base(cfg: AlembicConfig) -> str:
    """The revision with no down_revision - the schema create_all() produced at the
    first public release."""
    (base,) = ScriptDirectory.from_config(cfg).get_bases()
    return base


def _revisions_base_to_head(cfg: AlembicConfig) -> list[str]:
    script = ScriptDirectory.from_config(cfg)
    return [rev.revision for rev in reversed(list(script.walk_revisions()))]


def _has_person_characters_table(inspector: Inspector) -> bool:
    return "person_characters" in inspector.get_table_names()


def _has_speaker_identity_override(inspector: Inspector) -> bool:
    return "identity_override" in {c["name"] for c in inspector.get_columns("speakers")}


def _has_dismissed_duplicate_ids(inspector: Inspector) -> bool:
    return "dismissed_duplicate_ids_json" in {c["name"] for c in inspector.get_columns("clip_candidates")}


# Every migration after baseline needs an entry here: a check for schema it adds to
# a table that already existed at baseline. Without one, a DB whose real on-disk
# schema stops at an earlier revision looks (to _detect_adopted_revision) like it
# already has that migration, and gets stamped past it - silently skipping the DDL
# that would have added it. test_migration_adoption_markers enforces coverage.
_ADOPTION_MARKERS: dict[str, Callable[[Inspector], bool]] = {
    "0002_person_characters": _has_person_characters_table,
    "0003_speaker_identity_override": _has_speaker_identity_override,
    "0004_dismissed_duplicates": _has_dismissed_duplicate_ids,
}


def _detect_adopted_revision(db_path: Path, cfg: AlembicConfig) -> str:
    """The revision to stamp a DB found with no alembic_version table.

    "No alembic_version table" covers two different real shapes: a genuinely
    historical DB from before this framework existed (schema stops at whatever
    revision it stops at) and a create_all()-built DB (dev/test fixtures) that
    already matches head. Distinguishing them requires checking actual schema, not
    just assuming one or the other - see the migration 0003 incident this replaced
    (a historical DB got stamped straight to head and was missing three migrations'
    worth of columns).
    """
    engine = _engine(db_path)
    try:
        inspector = inspect(engine)
        revision = script_base(cfg)
        for rev in _revisions_base_to_head(cfg)[1:]:
            marker = _ADOPTION_MARKERS.get(rev)
            if marker is None or not marker(inspector):
                break
            revision = rev
        return revision
    finally:
        engine.dispose()


def _engine(db_path: Path) -> Engine:
    return create_engine(sqlite_url(db_path), poolclass=NullPool)


def database_revision(db_path: Path) -> Optional[str]:
    """The Alembic revision the DB is currently stamped at, or None if it has no
    alembic_version table (never migrated)."""
    engine = _engine(db_path)
    try:
        with engine.connect() as conn:
            return MigrationContext.configure(conn).get_current_revision()
    finally:
        engine.dispose()


def _table_names(db_path: Path) -> set[str]:
    engine = _engine(db_path)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def run_startup_migrations(
    db_path: Path,
    config: object,
    *,
    now: Optional[Callable[[], datetime]] = None,
) -> None:
    """Bring *db_path* to the latest schema revision, backing it up first when a
    migration is pending. Raises MigrationError on failure (backup preserved).

    Opt out with config.db_migrate_on_startup = False (dev), which leaves schema
    creation to make_engine's create_all as before.
    """
    if not getattr(config, "db_migrate_on_startup", True):
        return

    clock = now or datetime.now
    cfg = make_alembic_config(db_path)
    head = script_head(cfg)
    if head is None:
        return

    if not db_path.exists():
        _upgrade(cfg, head, "new database")
        return

    tables = _table_names(db_path)
    if "alembic_version" not in tables:
        if _SENTINEL_TABLE in tables:
            # A DB found with no alembic_version table. Its actual schema may stop
            # at baseline (a genuinely historical pre-framework DB) or already match
            # head (a create_all()-built dev/test fixture) - inspect it to find out
            # rather than assuming either, then fall through to apply anything after
            # the detected revision normally. See ARCHITECTURE.md "Data model".
            adopted = _detect_adopted_revision(db_path, cfg)
            _log.info("Adopting database at %s (stamping %s)", db_path, adopted)
            _stamp(db_path, adopted)
        else:
            _upgrade(cfg, head, "empty database")
            return
        if database_revision(db_path) == head:
            return
        _apply_pending(db_path, cfg, head, clock)
        return

    if database_revision(db_path) == head:
        return

    _apply_pending(db_path, cfg, head, clock)


def _apply_pending(
    db_path: Path, cfg: AlembicConfig, head: str, clock: Callable[[], datetime]
) -> None:
    current = database_revision(db_path)
    _log.info("Database migration pending (%s -> %s) for %s", current, head, db_path)
    backup = _backup_database(db_path, clock)
    try:
        command.upgrade(cfg, "head")
    except Exception as exc:  # noqa: BLE001 - any failure must stop the server, backup kept
        _log.error("Database upgrade failed; backup preserved at %s", backup, exc_info=exc)
        raise MigrationError(
            "Your library could not be upgraded to the new version. Your previous "
            f"data was left untouched and backed up to {backup}. "
            "Reinstall the previous version to keep using it, and report this. "
            f"({type(exc).__name__}: {exc})"
        ) from exc
    _log.info("Database migrated to %s (pre-migration backup at %s)", head, backup)


def _upgrade(cfg: AlembicConfig, head: str, reason: str) -> None:
    _log.info("Building schema via migrations (%s) -> %s", reason, head)
    command.upgrade(cfg, "head")


def _stamp(db_path: Path, revision: str) -> None:
    # Write the alembic_version row directly rather than via command.stamp: adoption
    # is by far the common startup path (every already-current DB and every fresh
    # create_all-ed DB), so it stays a single fast write with no Alembic env spin-up.
    engine = _engine(db_path)
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS alembic_version ("
                "version_num VARCHAR(32) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            )
            conn.execute(text("DELETE FROM alembic_version"))
            conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
                {"rev": revision},
            )
    finally:
        engine.dispose()


def _backup_database(db_path: Path, clock: Callable[[], datetime]) -> Path:
    stamp = clock().strftime("%Y%m%d-%H%M%S")
    backup = db_path.with_name(f"{db_path.name}.pre-migration-{stamp}.bak")
    _checkpoint_wal(db_path)
    _preflight_disk_space(db_path, backup)
    shutil.copy2(db_path, backup)
    return backup


def _checkpoint_wal(db_path: Path) -> None:
    # Fold any committed-but-unflushed WAL pages back into the main file so the .bak
    # copy is a complete snapshot (WAL mode does not checkpoint on the previous
    # server's last close). Nothing else is running at startup, so this is safe.
    engine = _engine(db_path)
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
    finally:
        engine.dispose()


def _preflight_disk_space(db_path: Path, backup: Path) -> None:
    needed = db_path.stat().st_size
    free = shutil.disk_usage(backup.parent).free
    if free < needed:
        raise MigrationError(
            "Not enough free disk space to back up your library before upgrading "
            f"(need about {needed} bytes free on {backup.parent}, have {free}). "
            "Free up space and restart."
        )
