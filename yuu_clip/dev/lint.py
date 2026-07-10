"""``yuu-dev lint`` - ruff wrapper (replaces lint.ps1)."""
from __future__ import annotations

import subprocess
import sys
from typing import List, Optional

import typer

from yuu_clip.dev._base import REPO_ROOT, app


@app.command(context_settings={"ignore_unknown_options": True})
def lint(
    fix: bool = typer.Option(False, "--fix", help="Apply ruff's safe autofixes."),
    ruff_args: Optional[List[str]] = typer.Argument(None, help="Extra args passed through to ruff."),
) -> None:
    """Run ruff over yuu_clip and tests; exit non-zero if it finds problems."""
    cmd = [sys.executable, "-m", "ruff", "check", "yuu_clip", "tests"]
    if fix:
        cmd.append("--fix")
    cmd.extend(ruff_args or [])
    raise typer.Exit(subprocess.run(cmd, cwd=str(REPO_ROOT)).returncode)
