"""Pause/resume flag file - cross-process signal for the analyze batch loop.

The analyze subprocess is a separate process from the web server (AnalyzeJob),
so pausing between videos is signalled via a flag file rather than in-memory
state. Shared by the CLI batch loop (which polls for it) and the web routes
(which create/remove it).
"""
from __future__ import annotations

from pathlib import Path

_PAUSE_FLAG_NAME = "analyze.pause"


def pause_flag_path(project_dir: Path) -> Path:
    return project_dir / ".yuu-clip" / _PAUSE_FLAG_NAME


def create_pause_flag(project_dir: Path) -> None:
    path = pause_flag_path(project_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")


def remove_pause_flag(project_dir: Path) -> None:
    pause_flag_path(project_dir).unlink(missing_ok=True)


def pause_flag_exists(project_dir: Path) -> bool:
    return pause_flag_path(project_dir).exists()
