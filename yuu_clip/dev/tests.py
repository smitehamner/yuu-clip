"""``yuu-dev test-api`` / ``test-ui`` - the pytest runners.

test-api runs the server-free unit + integration tiers. test-ui runs the
Playwright suite against the live :8080 server, with a set of preflights
(single server, no leftover workers, seeded data, one-run lock) and the
--changed / --smoke selection, reusing scripts/select_ui_tests.py rather than
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
from yuu_clip.dev._base import REPO_ROOT, TEST_LOGS_DIR, app, console, print_summary, pytest_env, run_and_tee
from yuu_clip.dev._summary import write_run_logs
from yuu_clip.dev.uiserver import fixture_server

UNIT_LOG = TEST_LOGS_DIR / "test-unit-last.log"
UNIT_SUMMARY = TEST_LOGS_DIR / "test-unit-last-summary.log"
INTEGRATION_LOG = TEST_LOGS_DIR / "test-integration-last.log"
INTEGRATION_SUMMARY = TEST_LOGS_DIR / "test-integration-last-summary.log"
API_LOG = TEST_LOGS_DIR / "test-api-last.log"
API_SUMMARY = TEST_LOGS_DIR / "test-api-last-summary.log"
SYSTEM_LOG = TEST_LOGS_DIR / "test-system-last.log"
SYSTEM_SUMMARY = TEST_LOGS_DIR / "test-system-last-summary.log"
GOLDEN_LOG = TEST_LOGS_DIR / "test-golden-last.log"
GOLDEN_SUMMARY = TEST_LOGS_DIR / "test-golden-last-summary.log"
UI_LOG = TEST_LOGS_DIR / "test-ui-last.log"
UI_SUMMARY = TEST_LOGS_DIR / "test-ui-last-summary.log"
UI_TESTS_DIR = REPO_ROOT / "tests" / "ui"
SMOKE = "tests/ui/test_ui_smoke.py"
UI_LOCK = TEST_LOGS_DIR / "test-ui.lock"
LOCK_MAX_AGE_MIN = 15
MAX_UI_WORKERS = 4

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


def _run_tiers_code(
    tiers: list[str],
    pytest_args: Optional[List[str]],
    detailed: bool,
    log: Path,
    summary: Path,
    marker: Optional[str] = None,
) -> int:
    """Run one or more pytest tier directories, tee to a log, and return pytest's code.

    An explicit target (a file/nodeid in ``pytest_args``) replaces the default tier
    selection and runs in process; otherwise the named tiers run under xdist. A
    *marker* expression (``-m ...``) is applied to the default tier selection only,
    so an explicit target can still reach an otherwise-deselected test.
    """
    console.print(f"Log: {log}")
    targets, extras = _split_passthrough(pytest_args)
    if targets:
        selection = targets
    else:
        selection = [*tiers, "-n", "auto"]
        if marker:
            selection += ["-m", marker]
    cmd = [sys.executable, *_pytest(selection, detailed), *extras]
    code, output = run_and_tee(cmd, REPO_ROOT, pytest_env())
    print_summary(write_run_logs(output, log, summary))
    console.print(f"[dim]Full log: {log}  |  Summary: {summary}[/dim]")
    return code


def _run_tiers(
    tiers: list[str],
    pytest_args: Optional[List[str]],
    detailed: bool,
    log: Path,
    summary: Path,
    marker: Optional[str] = None,
) -> None:
    raise typer.Exit(_run_tiers_code(tiers, pytest_args, detailed, log, summary, marker))


@app.command("test-unit", context_settings={"ignore_unknown_options": True})
def test_unit(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run the unit tier only (tests/unit) - the fast inner loop: pure, no DB seeding."""
    _run_tiers(["tests/unit"], pytest_args, detailed, UNIT_LOG, UNIT_SUMMARY)


@app.command("test-integration", context_settings={"ignore_unknown_options": True})
def test_integration(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run the integration tier only (tests/integration) - seeded DB / in-process TestClient."""
    _run_tiers(["tests/integration"], pytest_args, detailed, INTEGRATION_LOG, INTEGRATION_SUMMARY)


@app.command("test-api", context_settings={"ignore_unknown_options": True})
def test_api(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run unit + integration together (the pre-done gate) - a convenience combo of
    test-unit + test-integration. No live server needed."""
    _run_tiers(["tests/unit", "tests/integration"], pytest_args, detailed, API_LOG, API_SUMMARY)


@app.command("test-system", context_settings={"ignore_unknown_options": True})
def test_system(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run the full-stack system tier (tests/system) - the real analyze pipeline
    against a generated fixture video (Whisper + LLM stubbed) plus the FastAPI
    TestClient. Needs ffmpeg on PATH (guard-skips otherwise); no live server. This
    is a pre-release gate, not a per-edit check - it is deliberately excluded from
    test-api's default selection.

    The opt-in `golden` real-models test is excluded here (`-m "not golden"`); run
    it separately with `yuu-dev test-golden`."""
    _run_tiers(["tests/system"], pytest_args, detailed, SYSTEM_LOG, SYSTEM_SUMMARY,
               marker="not golden")


@app.command("test-golden", context_settings={"ignore_unknown_options": True})
def test_golden(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
    pytest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run ONLY the opt-in golden path (tests/system, `-m golden`): the core loop on
    a real clip with real Whisper + a real local LLM.

    It is env-gated (YUU_GOLDEN_CLIP + YUU_GOLDEN_LLM_MODEL) and skips - never fails
    - when an input, ffmpeg, the Whisper model, or a runnable local LLM is missing.
    Because a skip means it did NOT actually exercise the real models, this command
    prints the skip reason prominently so a human is never misled into thinking the
    golden path ran when it only skipped."""
    # -rfEs so the short summary carries the skip *reason* (the default -r fE omits
    # skips); the banner below reads it back out of the log.
    args = [*(pytest_args or []), "-rfEs"]
    code = _run_tiers_code(["tests/system"], args, detailed, GOLDEN_LOG,
                           GOLDEN_SUMMARY, marker="golden")
    _announce_golden_outcome(GOLDEN_LOG)
    raise typer.Exit(code)


def _announce_golden_outcome(log: Path) -> None:
    """Print a loud banner distinguishing 'the golden path actually ran' from 'it
    skipped', with the skip reason, so a skip is never mistaken for a real run."""
    text = log.read_text(encoding="utf-8", errors="replace") if log.exists() else ""
    # pytest's short summary: "SKIPPED [1] path:line: <reason>" - grab the reason.
    reasons = re.findall(r"^SKIPPED\b.*?:\d+:\s*(.+)$", text, re.MULTILINE)
    console.print("")
    if reasons:
        console.print("[yellow]" + "=" * 68 + "[/yellow]")
        console.print("[yellow]GOLDEN PATH SKIPPED - it did NOT run the real models.[/yellow]")
        for reason in reasons:
            console.print(f"[yellow]  reason: {reason.strip()}[/yellow]")
        console.print("[yellow]Set YUU_GOLDEN_CLIP + YUU_GOLDEN_LLM_MODEL and ensure ffmpeg +[/yellow]")
        console.print("[yellow]a runnable local llama-server are present, then re-run.[/yellow]")
        console.print("[yellow]" + "=" * 68 + "[/yellow]")
    elif "1 passed" in text or " passed" in text:
        console.print("[green]" + "=" * 68 + "[/green]")
        console.print("[green]GOLDEN PATH RAN with real Whisper + a real local LLM.[/green]")
        console.print("[green]" + "=" * 68 + "[/green]")


@app.command("test-all")
def test_all(
    detailed: bool = typer.Option(False, "--detailed", help="Per-test -v output."),
) -> None:
    """Run every server-free tier in one go: js -> unit -> integration.

    The ui tier is deliberately excluded: it drives a *live* server and needs a
    seeded project, so it stays a separate `yuu-dev test-ui` run. Exits non-zero if
    any tier fails; a missing Node toolchain skips the js tier (not a failure).
    """
    from yuu_clip.dev.testjs import run_vitest

    console.print("[cyan]== test-all: js -> unit -> integration (ui runs separately) ==[/cyan]")
    results = [
        ("js", run_vitest(required=False)),
        ("unit+integration",
         _run_tiers_code(["tests/unit", "tests/integration"], None, detailed, API_LOG, API_SUMMARY)),
    ]
    console.print("")
    console.print("[cyan]== test-all summary ==[/cyan]")
    for tier, code in results:
        status = "[green]PASS[/green]" if code == 0 else f"[red]FAIL (exit {code})[/red]"
        console.print(f"  {tier:<18} {status}")
    raise typer.Exit(1 if any(code != 0 for _, code in results) else 0)


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


def _runs_from_this_repo(command_line: str) -> bool:
    """True when the command runs out of this repo's tree (its venv or the prebuilt
    build runtime, both under REPO_ROOT). Scopes the orphan check to OUR processes so
    a concurrent OTHER project's pytest/Playwright (its own venv path) isn't mistaken
    for a leftover yuu-clip worker and does not block the run."""
    root = str(REPO_ROOT).replace("\\", "/").lower()
    return root in command_line.replace("\\", "/").lower()


def orphan_test_procs(processes: list[procs.ProcInfo]) -> list[procs.ProcInfo]:
    return [
        proc for proc in processes
        if proc.name.lower() in ("python.exe", "node.exe")
        and _ORPHAN_RE.search(proc.command_line)
        and _runs_from_this_repo(proc.command_line)
    ]


def acquire_ui_lock(lock_path: Path) -> bool:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
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


def _preflight_orphans() -> None:
    """Reject leftover pytest/Playwright workers from a crashed prior run.

    The pre-existing-server and seed-data checks are gone: test-ui now stands up
    its own isolated fixture server (yuu_clip.dev.uiserver), so nothing needs to
    be serving :8080 beforehand and the seed is guaranteed by the fixture. Only
    the orphan guard remains - a stray worker from a killed run would fight the
    new one for the browser driver.
    """
    processes = procs.list_processes(["python.exe", "node.exe"])
    orphans = orphan_test_procs(processes)
    if orphans:
        console.print("[red]Leftover pytest/Playwright process(es) from a prior run are still alive:[/red]")
        for proc in orphans:
            console.print(f"  PID {proc.pid}  {proc.name}")
        console.print("[red]Kill them, then retry.[/red]")
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
    """Run the Playwright UI suite against a disposable, isolated fixture server.

    test-ui builds a freshly-seeded fixture project, serves it on a free port with
    an isolated config, points Playwright at it via YUU_TEST_URL, and tears it all
    down when the run ends - the owner's interactive :8080 server is never touched
    or required.
    """
    _preflight_orphans()

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

        with fixture_server() as url:
            env = pytest_env()
            env["YUU_TEST_URL"] = url
            cmd = [sys.executable, *_pytest(paths, detailed), "--no-header", "--timeout=60",
                   *_worker_args(len(paths), sequential), *extras]
            code, output = run_and_tee(cmd, REPO_ROOT, env)
        print_summary(write_run_logs(output, UI_LOG, UI_SUMMARY))
        console.print(f"[dim]Full log: {UI_LOG}  |  Summary: {UI_SUMMARY}[/dim]")
    finally:
        UI_LOCK.unlink(missing_ok=True)
    raise typer.Exit(code)
