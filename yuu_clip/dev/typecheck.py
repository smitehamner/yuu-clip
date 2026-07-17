"""``yuu-dev typecheck`` - mypy gate that fails only on NEW type errors.

The codebase is largely untyped and we do not do a big-bang annotation pass. Instead
mypy runs with a lenient global config (`[tool.mypy]` in pyproject.toml) and its current
errors are frozen in a committed baseline (``mypy-baseline.txt``). This command runs mypy
and pipes its output through ``mypy-baseline filter``, which drops every already-known
error (matched on message text, not line number, so refactors don't churn it) and exits
non-zero only when a *new* error appears - a regression, or an error in code you just
touched. Annotate as-you-touch: clear a baseline entry when you fix the code that caused it.

Regenerate the baseline after intentionally resolving (or accepting) errors:
``yuu-dev typecheck --sync``.
"""
from __future__ import annotations

import subprocess
import sys

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console


def _run_mypy() -> str:
    """Run mypy and return its combined output. mypy exits non-zero whenever it finds
    any error (all baselined ones included), so its exit code is not the gate - the
    mypy-baseline filter is."""
    proc = subprocess.run(
        [sys.executable, "-m", "mypy"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    return proc.stdout + proc.stderr


@app.command()
def typecheck(
    sync: bool = typer.Option(
        False, "--sync",
        help="Rewrite mypy-baseline.txt from the current mypy output (freeze the "
             "current set of errors). Use after intentionally resolving or accepting "
             "errors.",
    ),
) -> None:
    """Type-check yuu_clip with mypy, failing only on errors not in the baseline."""
    output = _run_mypy()
    subcommand = "sync" if sync else "filter"
    result = subprocess.run(
        [sys.executable, "-m", "mypy_baseline", subcommand],
        cwd=str(REPO_ROOT),
        input=output,
        text=True,
    )
    if sync and result.returncode == 0:
        console.print("Rewrote mypy-baseline.txt from current mypy output.")
    raise typer.Exit(result.returncode)
