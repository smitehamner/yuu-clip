"""``yuu-dev migrate`` / ``migrate-status`` / ``migrate-new`` - schema-migration workflow.

The app auto-migrates on startup (yuu_clip/db/migrate.py); these are the developer-side
commands for inspecting state and authoring a new revision. The change-the-schema loop:

  1. edit yuu_clip/db/models.py
  2. `yuu-dev migrate-new "add the thing"`  (autogenerate a revision from the diff)
  3. REVIEW the generated script - SQLite needs batch ops for anything but add-column,
     and autogenerate output is never blindly trusted (see ARCHITECTURE.md)
  4. commit models.py + the new revision together
  5. `yuu-dev test-unit` runs the schema-drift guard, which fails until they agree

All three default to the repo's own dev project DB; pass --project to target another.
"""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Optional

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console


def _db_path(project: Optional[Path]) -> Path:
    from yuu_clip.config import project_db_path
    return project_db_path((project or REPO_ROOT).resolve())


@app.command("migrate")
def migrate(
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project dir (default: repo dev project)."),
) -> None:
    """Bring the project DB up to the latest schema revision (backs it up first if pending)."""
    from yuu_clip.db.migrate import database_revision, make_alembic_config, run_startup_migrations, script_head

    db_path = _db_path(project)
    run_startup_migrations(db_path, SimpleNamespace(db_migrate_on_startup=True))
    console.print(f"[green]Database at head:[/green] {database_revision(db_path)} ({db_path})")
    _ = script_head(make_alembic_config(db_path))


@app.command("migrate-status")
def migrate_status(
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project dir (default: repo dev project)."),
) -> None:
    """Show the DB's current revision vs the latest, and whether a migration is pending."""
    from yuu_clip.db.migrate import database_revision, make_alembic_config, script_head

    db_path = _db_path(project)
    if not db_path.exists():
        console.print(f"[yellow]No database yet at {db_path} - it is created on first run.[/yellow]")
        raise typer.Exit(0)

    current = database_revision(db_path)
    head = script_head(make_alembic_config(db_path))
    console.print(f"DB:      {db_path}")
    console.print(f"Current: {current or '(none - never migrated)'}")
    console.print(f"Head:    {head}")
    if current == head:
        console.print("[green]Up to date.[/green]")
    else:
        console.print("[yellow]Migration pending - run 'yuu-dev migrate' (or start the server).[/yellow]")


@app.command("migrate-new")
def migrate_new(
    message: str = typer.Argument(..., help="Short description of the schema change."),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project dir (default: repo dev project)."),
) -> None:
    """Autogenerate a new revision from the models-vs-DB diff (REVIEW it before committing)."""
    from alembic import command

    from yuu_clip.db.migrate import make_alembic_config, run_startup_migrations

    db_path = _db_path(project)
    # Autogenerate diffs the live models against the DB, so the DB must be at head
    # first or the diff would re-emit already-applied changes.
    run_startup_migrations(db_path, SimpleNamespace(db_migrate_on_startup=True))
    command.revision(make_alembic_config(db_path), message=message, autogenerate=True)
    console.print(
        "[cyan]Review the generated revision under yuu_clip/db/migrations/versions/ "
        "before committing[/cyan] - check SQLite batch ops and that it matches your intent."
    )
