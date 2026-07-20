"""Pause/resume flag file - cross-process signal for the analyze pipeline.

The analyze subprocess is a separate process from the web server (AnalyzeJob),
so pausing is signalled via a flag file rather than in-memory state. Created and
removed by the web routes (manual Pause/Resume and thermal auto-pause), polled by
four pause points in the subprocess, coarse to fine: the CLI batch loop between
videos, the pipeline stage boundaries, the segment-batch boundary inside a long
transcription, and the per-clip scoring loop. The last two are the sustained-GPU
stages, so they are what make auto-pause effective on the common single-video run.

Every poll site must sit immediately after a commit. SQLite is single-writer here,
so blocking with a write transaction open would lock the web server out of its own
database for the whole hold - which is why transcription had to be restructured to
commit at segment batch boundaries before it could gain a pause point at all.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Callable, Optional

_PAUSE_FLAG_NAME = "analyze.pause"

PAUSE_POLL_INTERVAL_S = 3.0


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


def wait_while_paused(
    project_dir: Path,
    poll_interval_s: float = PAUSE_POLL_INTERVAL_S,
    on_pause: Optional[Callable[[], None]] = None,
) -> bool:
    """Block while the pause flag is present; return whether it actually waited.

    *on_pause* fires once when the wait begins, so each caller prints its own
    message rather than this module knowing about the console.
    """
    flag = pause_flag_path(project_dir)
    if not flag.exists():
        return False
    if on_pause is not None:
        on_pause()
    while flag.exists():
        time.sleep(poll_interval_s)
    return True
