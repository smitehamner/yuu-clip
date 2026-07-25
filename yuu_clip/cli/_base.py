"""
Shared CLI infrastructure: the Typer app, console, constants, and the helpers
used across multiple yuuclip commands.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

# console + BYTES_PER_MB live outside cli/ (shared with the pipeline/export
# engine, which must not import cli); re-exported here so commands can keep
# importing them from _base.
from yuu_clip.console import BYTES_PER_MB, console  # noqa: F401
from yuu_clip.log import configure_logging, get_logger

app = typer.Typer(
    name="yuuclip",
    help="Video session clip extraction pipeline.",
    add_completion=False,
)
log = get_logger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".ts"}


def _project_dir(given: Optional[Path]) -> Path:
    return (given or Path.cwd()).resolve()


def _get_session(project_dir: Path):
    from yuu_clip.config import project_db_path
    from yuu_clip.db.models import make_session
    return make_session(project_db_path(project_dir))


def _load_project(project: Optional[Path]):
    """Resolve project dir, open DB session, and load config. Used by every command that needs DB access."""
    from yuu_clip.config import Config
    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    session  = _get_session(proj_dir)
    config   = Config.load(proj_dir)
    return proj_dir, session, config


def _require_ffmpeg() -> None:
    """Exit with a friendly error message if ffmpeg is not found on PATH."""
    from yuu_clip.ffmpeg_tools import find_ffmpeg
    try:
        find_ffmpeg()
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)


def _resolve_videos(path: Path) -> list[Path]:
    """Accept a single video file or a directory; return a sorted list of video paths."""
    path = path.resolve()
    if path.is_dir():
        return sorted(p for p in path.iterdir() if p.suffix.lower() in VIDEO_EXTENSIONS)
    if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS:
        return [path]
    console.print(f"[red]Not a video file or directory: {path}[/red]")
    raise typer.Exit(1)
