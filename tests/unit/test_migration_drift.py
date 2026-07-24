"""Schema-drift guard: `alembic upgrade head` must build exactly the schema that
Base.metadata.create_all() builds.

This is the enforced replacement for the retired _ADDITIVE_COLUMNS list. It fails the
moment a model changes without a matching migration - the discipline that keeps the
"a migration per schema change" promise true after the first public release. When it
fails: run `yuu-dev migrate-new "describe change"`, review the generated script, and
commit it alongside the model change.
"""
from __future__ import annotations

from pathlib import Path

from alembic import command
from sqlalchemy import create_engine, inspect

from yuu_clip.db.migrate import make_alembic_config
from yuu_clip.db.models import Base, sqlite_url


def _schema_snapshot(db_path: Path) -> dict:
    inspector = inspect(create_engine(sqlite_url(db_path)))
    snapshot: dict = {}
    for table in sorted(inspector.get_table_names()):
        if table == "alembic_version":
            continue
        snapshot[table] = {
            "columns": {
                col["name"]: (str(col["type"]), col["nullable"])
                for col in inspector.get_columns(table)
            },
            "primary_key": tuple(inspector.get_pk_constraint(table)["constrained_columns"]),
            "indexes": sorted(
                (idx["name"], tuple(idx["column_names"]), idx["unique"])
                for idx in inspector.get_indexes(table)
            ),
            "foreign_keys": sorted(
                (
                    tuple(fk["constrained_columns"]),
                    fk["referred_table"],
                    tuple(fk["referred_columns"]),
                    (fk.get("options") or {}).get("ondelete"),
                )
                for fk in inspector.get_foreign_keys(table)
            ),
        }
    return snapshot


def test_migrations_head_matches_create_all(tmp_path: Path) -> None:
    migrated_db = tmp_path / "migrated.db"
    create_all_db = tmp_path / "create_all.db"

    command.upgrade(make_alembic_config(migrated_db), "head")
    Base.metadata.create_all(create_engine(sqlite_url(create_all_db)))

    assert _schema_snapshot(migrated_db) == _schema_snapshot(create_all_db)
