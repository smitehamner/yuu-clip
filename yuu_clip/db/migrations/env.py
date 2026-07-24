"""Alembic migration environment for yuu-clip.

Wired to the app's own schema and DB-path resolution: target_metadata is the ORM's
Base.metadata (yuu_clip/db/models.py) and the connection URL comes from the Alembic
Config built by yuu_clip/db/migrate.py (never a hardcoded URL). SQLite batch mode
(render_as_batch=True) is mandatory - SQLite cannot ALTER/DROP a column in place, so
Alembic's batch create-copy-swap is what makes non-trivial migrations work here.
"""
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from yuu_clip.db.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    # migrate.py passes the URL via config.attributes; a bare `alembic` CLI run
    # falls back to the alembic.ini sqlalchemy.url.
    url = config.attributes.get("sqlalchemy_url") or config.get_main_option("sqlalchemy.url")
    if not url:
        raise RuntimeError("No database URL configured for Alembic (sqlalchemy.url).")
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_database_url(), poolclass=NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
