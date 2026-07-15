"""``yuu-dev logs`` - tail the project log."""
from __future__ import annotations

import os
import time

import typer

from yuu_clip.dev._base import LOG_PATH, app, console, tail_log


@app.command()
def logs(
    follow: bool = typer.Option(False, "--follow", help="Keep streaming new lines (Ctrl+C to stop)."),
    lines: int = typer.Option(20, "--lines", help="How many trailing lines to show first."),
) -> None:
    """Show the tail of .yuu-clip/yuu-clip.log."""
    console.print(f"Tailing {LOG_PATH}")
    if not LOG_PATH.exists():
        console.print("[yellow]Log file does not exist yet - start the server first.[/yellow]")
        raise typer.Exit(0)
    for line in tail_log(lines):
        console.print(line)
    if follow:
        _follow()


def _follow() -> None:
    console.print("[cyan](following - Ctrl+C to stop)[/cyan]")
    with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as handle:
        handle.seek(0, os.SEEK_END)
        try:
            while True:
                line = handle.readline()
                if line:
                    console.print(line.rstrip("\n"))
                else:
                    time.sleep(0.5)
        except KeyboardInterrupt:
            pass
