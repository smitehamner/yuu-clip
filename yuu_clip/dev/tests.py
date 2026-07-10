"""``yuu-dev test-api`` / ``test-ui`` - the pytest runners (replace test-api.ps1 / test-ui.ps1).

test-api runs the server-free unit + integration tiers. test-ui runs the
Playwright suite against the live :8080 server, with the same preflights the
ps1 grew (single server, no leftover workers, seeded data, one-run lock) and the
same -Changed / -Smoke selection, reusing scripts/select_ui_tests.py rather than
reimplementing the mapping.
"""
from __future__ import annotations

import importlib.util
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import typer

from yuu_clip.dev import procs
from yuu_clip.dev._base import REPO_ROOT, app, console, print_summary, pytest_env, run_and_tee
from yuu_clip.dev._summary import write_run_logs

API_LOG = REPO_ROOT / "test-api-last.log"
API_SUMMARY = REPO_ROOT / "test-api-last-summary.log"
UI_LOG = REPO_ROOT / "test-ui-last.log"
UI_SUMMARY = REPO_ROOT / "test-ui-last-summary.log"
UI_TESTS_DIR = REPO_ROOT / "tests" / "ui"
SMOKE = "tests/ui/test_ui_smoke.py"
UI_LOCK = REPO_ROOT / "test-ui.lock"
LOCK_MAX_AGE_MIN = 15
MAX_UI_WORKERS = 4

_SERVE_RE = re.compile(r"yuu_clip\.cli serve")
_ORPHAN_RE = re.compile(r"-m\s+pytest|playwright[/\\]driver[/\\]package[/\\]cli\.js")


def _pytest(args: list[str], detailed: bool) -> list[str]:
    verbosity = "-v" if detailed else "-q"
    return ["-u", "-m", "pytest", *args, verbosity, "--tb=short", "-p", "no:warnings", "-r", "fE"]


def _looks_like_target(arg: str) -> bool:
    """A pytest selection target (path or ``file::Class::test`` nodeid) rather than
    an option or an option value. Used to let an explicit target replace the default
    tier selection instead of being appended to it (which would run BOTH)."""
    if arg.startswith("-"):
        return False
    return arg.endswith(".py") or "::" in arg or "/" in arg or "\\" in arg


def _split_passthrough(pytest_args: Optional[List[str]]) -> tuple[list[str], list[str]]:
    args = pytest_args or []
    targets = [a for a in args if _looks_like_target(a)]
    extras = [a for a in args if not _looks_like_target(a)]
    return targets, extras


@app.command("test-api", context_settings={"ignore_unknown_options": True})
def test_api(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run the unit + integration tiers (fast, no live server needed)."""
    console.print(f"Log: {API_LOG}")
    targets, extras = _split_passthrough(pytest_args)
    # An explicit target (a file/nodeid) replaces the default tiers and runs in
    # process; otherwise run both tiers under xdist.
    selection = targets if targets else ["tests/unit", "tests/integration", "-n", "auto"]
    cmd = [sys.executable, *_pytest(selection, detailed), *extras]
    code, output = run_and_tee(cmd, REPO_ROOT, pytest_env())
    print_summary(write_run_logs(output, API_LOG, API_SUMMARY))
    console.print(f"[dim]Full log: {API_LOG}  |  Summary: {API_SUMMARY}[/dim]")
    raise typer.Exit(code)


def _load_selector():
    spec = importlib.util.spec_from_file_location(
        "select_ui_tests", REPO_ROOT / "scripts" / "select_ui_tests.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def ui_test_paths(smoke: bool, changed: bool) -> tuple[list[str], list[str]]:
    if smoke:
        return [SMOKE], []
    if changed:
        selector = _load_selector()
        selected, notes = selector.select(selector._changed_files())
        return (selected or [SMOKE]), notes
    full = sorted(f"tests/ui/{path.name}" for path in UI_TESTS_DIR.glob("test_ui_*.py"))
    return full, []


def running_server_count(processes: list[procs.ProcInfo]) -> int:
    return sum(
        1 for proc in processes
        if proc.name.lower() == "python.exe" and _SERVE_RE.search(proc.command_line)
    )


def orphan_test_procs(processes: list[procs.ProcInfo]) -> list[procs.ProcInfo]:
    return [
        proc for proc in processes
        if proc.name.lower() in ("python.exe", "node.exe") and _ORPHAN_RE.search(proc.command_line)
    ]


def acquire_ui_lock(lock_path: Path) -> bool:
    for _ in range(2):
        try:
            with open(lock_path, "x", encoding="utf-8") as handle:
                handle.write(f"PID {os.getpid()} started {datetime.now().isoformat()}")
            return True
        except FileExistsError:
            age_min = (time.time() - lock_path.stat().st_mtime) / 60
            if age_min >= LOCK_MAX_AGE_MIN:
                console.print(f"Removing stale UI test lock ({int(age_min)} min old).")
                lock_path.unlink(missing_ok=True)
                continue
            return False
    return False


def _preflight_processes() -> None:
    processes = procs.list_processes(["python.exe", "node.exe"])
    count = running_server_count(processes)
    if count == 0:
        console.print("[red]No yuu-clip server is running. Start one with yuu-dev serve, then retry.[/red]")
        raise typer.Exit(3)
    if count > 2:
        console.print(f"[red]More than one yuu-clip server is running ({count} serve procs; one server is 2).[/red]")
        console.print("[red]Run yuu-dev serve (stops strays, starts one), then retry.[/red]")
        raise typer.Exit(3)
    orphans = orphan_test_procs(processes)
    if orphans:
        console.print("[red]Leftover pytest/Playwright process(es) from a prior run are still alive:[/red]")
        for proc in orphans:
            console.print(f"  PID {proc.pid}  {proc.name}")
        console.print("[red]Kill them, then retry.[/red]")
        raise typer.Exit(3)


def _preflight_seed_data() -> None:
    import httpx
    try:
        videos = httpx.get("http://127.0.0.1:8080/api/videos", timeout=10).json()
    except Exception as exc:
        console.print(f"[red]Could not reach /api/videos to check for seed data: {exc}[/red]")
        raise typer.Exit(3)
    if not videos:
        console.print("[red]The dev project has no analyzed videos - most UI tests will fail waiting[/red]")
        console.print("[red]for a sidebar video that never appears. Analyze a test video first.[/red]")
        raise typer.Exit(3)


def _worker_args(path_count: int, sequential: bool) -> list[str]:
    if sequential:
        return []
    workers = min(MAX_UI_WORKERS, max(1, path_count))
    if workers < 2:
        return []
    return ["-n", str(workers), "--dist", "loadfile", "--max-worker-restart", "0"]


@app.command("test-ui", context_settings={"ignore_unknown_options": True})
def test_ui(
    detailed: bool = typer.Option(False, "--detailed"),
    sequential: bool = typer.Option(False, "--sequential"),
    changed: bool = typer.Option(False, "--changed", help="Only tests around the working-tree diff + smoke."),
    smoke: bool = typer.Option(False, "--smoke", help="Just the smoke backstop."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run the Playwright UI suite against the live :8080 dev server."""
    console.print("UI tests require a live server at http://127.0.0.1:8080 (run yuu-dev serve first)")
    _preflight_processes()
    _preflight_seed_data()

    if not acquire_ui_lock(UI_LOCK):
        holder = UI_LOCK.read_text(encoding="utf-8", errors="replace").strip()
        console.print(f"[red]Another UI test run is already in progress ({holder}).[/red]")
        console.print(f"[red]Wait for it, or delete {UI_LOCK} if it is stale.[/red]")
        raise typer.Exit(2)

    try:
        targets, extras = _split_passthrough(pytest_args)
        # An explicit target (file or file::nodeid) replaces the smoke/changed/full
        # selection so `test-ui tests/ui/test_ui_split.py` runs only that file
        # instead of appending it to the whole suite.
        if targets:
            paths, notes = targets, []
        else:
            paths, notes = ui_test_paths(smoke, changed)
        for note in notes:
            console.print(f"[yellow]note: {note}[/yellow]")
        console.print(f"[cyan]Running {len(paths)} UI test file(s):[/cyan]")
        for path in paths:
            console.print(f"  {Path(path).name}")
        cmd = [sys.executable, *_pytest(paths, detailed), "--no-header", "--timeout=60",
               *_worker_args(len(paths), sequential), *extras]
        code, output = run_and_tee(cmd, REPO_ROOT, pytest_env())
        print_summary(write_run_logs(output, UI_LOG, UI_SUMMARY))
        console.print(f"[dim]Full log: {UI_LOG}  |  Summary: {UI_SUMMARY}[/dim]")
    finally:
        UI_LOCK.unlink(missing_ok=True)
    raise typer.Exit(code)
