"""Shared infrastructure for the ``yuu-dev`` developer CLI.

The daily dev-loop scripts (serve, test, lint, logs, status) live here as a
Typer app instead of PowerShell, so the logic is importable and unit-testable
and does not depend on PowerShell parsing quirks. This module holds the Typer
``app`` plus the repo paths and process helpers the commands share; the command
modules import ``app`` from here and register with ``@app.command``.

Output is deliberately ASCII-only (the legacy Windows console encodes stdout as
cp1252 and crashes on characters outside it). Log-tail content is not ours, so
it is read as UTF-8 with ``errors="replace"`` before printing.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import typer

# Importing the shared console reconfigures stdout/stderr to UTF-8, so printing
# log lines that contain non-cp1252 characters cannot crash the process.
from yuu_clip.console import console  # noqa: F401  (re-exported for command modules)

app = typer.Typer(
    name="yuu-dev",
    help="yuu-clip developer loop: serve, test, lint, logs, status.",
    add_completion=False,
    no_args_is_help=True,
)

# yuu_clip/dev/_base.py -> parents[2] is the repo root.
REPO_ROOT = Path(__file__).resolve().parents[2]
LOG_PATH = REPO_ROOT / ".yuu-clip" / "yuu-clip.log"
TEST_LOGS_DIR = REPO_ROOT / ".test-logs"
TEST_LOGS_DIR.mkdir(exist_ok=True)


def node_available() -> bool:
    """True when Node.js is on PATH - required to build the JS bundle and run vitest.

    The offline dev path relies on this: the bundle drift guard and `test-js` skip
    (rather than fail) when Node is absent, since the committed bundle ships without it.
    """
    return shutil.which("node") is not None


def pytest_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    return env


def run_and_tee(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> tuple[int, str]:
    """Run a command, stream its merged stdout/stderr live, and return (code, output).

    Merging stderr into stdout mirrors the ps1 ``2>&1`` tee, but without the
    PowerShell NativeCommandError trap that decoupled the exit code from the
    real pytest result - here the child's returncode is authoritative.
    """
    proc = subprocess.Popen(
        cmd, cwd=str(cwd), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
    )
    captured: list[str] = []
    assert proc.stdout is not None
    for line in proc.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
        captured.append(line)
    proc.wait()
    return proc.returncode, "".join(captured)


def tail_lines(text: str, count: int) -> list[str]:
    lines = text.splitlines()
    return lines[-count:] if count > 0 else lines


def tail_log(count: int) -> list[str]:
    if not LOG_PATH.exists():
        return []
    return tail_lines(LOG_PATH.read_text(encoding="utf-8", errors="replace"), count)


def print_summary(summary: list[str]) -> None:
    console.print("")
    console.print("[cyan]--- Summary ---[/cyan]")
    for line in summary[-40:]:
        console.print(line)
