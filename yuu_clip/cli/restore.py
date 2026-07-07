"""Restore a project from a backup archive.

Used by the Electron first-run wizard (electron/main.js runRestore) to unpack a
backup into the chosen project folder before the server spawns. Re-pointing of
moved source-media paths is deferred to the in-app Restore flow (Settings >
Backup & Restore) - this command only unpacks the state.
"""
from __future__ import annotations

from pathlib import Path

import typer

from yuu_clip.cli._base import app, console

# Distinct exit code so the wizard can offer "replace it?" instead of failing.
_EXIT_PROJECT_EXISTS = 2


@app.command()
def restore(
    archive: Path = typer.Option(..., "--archive", help="Path to the backup .zip"),
    project: Path = typer.Option(..., "--project", help="Folder to restore the project into"),
    overwrite: bool = typer.Option(
        False, "--overwrite", help="Replace an existing project in the target folder"
    ),
) -> None:
    """Unpack a backup archive into a project folder."""
    from yuu_clip.project_archive import ProjectExistsError, RestoreError, restore_into

    if not archive.is_file():
        console.print(f"[red]Backup file not found: {archive}[/red]")
        raise typer.Exit(1)
    try:
        restore_into(archive, project, overwrite=overwrite)
    except ProjectExistsError:
        console.print(
            "[red]That folder already contains a project. Re-run with --overwrite "
            "to replace it (a safety copy of the existing database is kept).[/red]"
        )
        raise typer.Exit(_EXIT_PROJECT_EXISTS)
    except RestoreError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(1)
    console.print(f"Restored project into {project}")
