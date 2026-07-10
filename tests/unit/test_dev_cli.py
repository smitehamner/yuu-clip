"""Unit tests for the yuu-dev developer CLI (CliRunner + mocked subprocess/proc)."""
from __future__ import annotations

import sys

from typer.testing import CliRunner

from yuu_clip.dev import _base, app, procs
from yuu_clip.dev import lint as lint_mod
from yuu_clip.dev import logs as logs_mod
from yuu_clip.dev import serve as serve_mod
from yuu_clip.dev import status as status_mod
from yuu_clip.dev import tests as tests_mod

runner = CliRunner()


def _proc(pid: int, name: str, command_line: str) -> procs.ProcInfo:
    return procs.ProcInfo(pid=pid, name=name, command_line=command_line)


# --- lint ---------------------------------------------------------------

def test_lint_forwards_exit_code_and_fix_flag(monkeypatch):
    captured: dict = {}

    class _Result:
        returncode = 2

    def fake_run(cmd, cwd=None, **kwargs):
        captured["cmd"] = cmd
        return _Result()

    monkeypatch.setattr(lint_mod.subprocess, "run", fake_run)
    result = runner.invoke(app, ["lint", "--fix"])
    assert result.exit_code == 2
    assert captured["cmd"][:5] == [sys.executable, "-m", "ruff", "check", "yuu_clip"]
    assert "--fix" in captured["cmd"]


# --- logs ---------------------------------------------------------------

def test_logs_prints_only_the_requested_tail(monkeypatch, tmp_path):
    log = tmp_path / "yuu-clip.log"
    log.write_text("\n".join(f"line{i}" for i in range(25)), encoding="utf-8")
    monkeypatch.setattr(_base, "LOG_PATH", log)
    monkeypatch.setattr(logs_mod, "LOG_PATH", log)

    result = runner.invoke(app, ["logs", "--lines", "3"])
    assert result.exit_code == 0
    assert "line24" in result.output
    assert "line21" not in result.output


def test_logs_reports_missing_file(monkeypatch, tmp_path):
    missing = tmp_path / "nope.log"
    monkeypatch.setattr(_base, "LOG_PATH", missing)
    monkeypatch.setattr(logs_mod, "LOG_PATH", missing)

    result = runner.invoke(app, ["logs"])
    assert result.exit_code == 0
    assert "does not exist" in result.output


# --- status -------------------------------------------------------------

def test_status_exits_zero_when_unreachable(monkeypatch):
    monkeypatch.setattr(status_mod, "fetch_status", lambda host, port: None)
    result = runner.invoke(app, ["status"])
    assert result.exit_code == 0
    assert "safe to start" in result.output


def test_status_exits_one_when_processing(monkeypatch):
    monkeypatch.setattr(status_mod, "fetch_status",
                        lambda host, port: {"any_running": True, "analyze_running": True, "active_jobs": 2})
    result = runner.invoke(app, ["status"])
    assert result.exit_code == 1


# --- serve: port fallback + running-job guard ---------------------------

def _serve_happy_path(monkeypatch, spawned):
    monkeypatch.setattr(serve_mod, "fetch_status", lambda host, port: None)
    monkeypatch.setattr(procs, "list_processes", lambda names: [])
    monkeypatch.setattr(serve_mod, "wait_until_ready", lambda *args, **kwargs: True)
    monkeypatch.setattr(serve_mod, "tail_log", lambda count: [])
    monkeypatch.setattr(serve_mod, "_spawn_detached", lambda cmd, env: spawned.setdefault("cmd", cmd))


def test_serve_uses_next_free_port_when_default_is_busy(monkeypatch):
    spawned: dict = {}
    _serve_happy_path(monkeypatch, spawned)
    monkeypatch.setattr(serve_mod, "port_in_use", lambda host, port: port == 8080)

    result = runner.invoke(app, ["serve", "--no-open"])
    assert result.exit_code == 0
    assert "8081" in spawned["cmd"]
    assert "8080" not in spawned["cmd"]


def test_serve_binds_default_port_when_free(monkeypatch):
    spawned: dict = {}
    _serve_happy_path(monkeypatch, spawned)
    monkeypatch.setattr(serve_mod, "port_in_use", lambda host, port: False)

    result = runner.invoke(app, ["serve", "--no-open"])
    assert result.exit_code == 0
    assert "8080" in spawned["cmd"]


def test_serve_aborts_when_job_running_and_declined(monkeypatch):
    spawned: dict = {}
    monkeypatch.setattr(serve_mod, "fetch_status",
                        lambda host, port: {"any_running": True, "analyze_running": True, "active_jobs": 1})
    monkeypatch.setattr(serve_mod.typer, "confirm", lambda *args, **kwargs: False)
    monkeypatch.setattr(procs, "list_processes", lambda names: [])
    monkeypatch.setattr(serve_mod, "_spawn_detached", lambda cmd, env: spawned.setdefault("cmd", cmd))

    result = runner.invoke(app, ["serve"])
    assert result.exit_code == 1
    assert "cmd" not in spawned


def test_serve_exhausted_ports_fails_with_plain_message(monkeypatch):
    monkeypatch.setattr(serve_mod, "fetch_status", lambda host, port: None)
    monkeypatch.setattr(procs, "list_processes", lambda names: [])
    monkeypatch.setattr(serve_mod, "port_in_use", lambda host, port: True)

    result = runner.invoke(app, ["serve", "--no-open"])
    assert result.exit_code == 1
    assert "in use" in result.output


# --- serve: process-matching pure functions -----------------------------

def test_stale_serve_pids_matches_only_this_repo(monkeypatch):
    root = serve_mod.REPO_ROOT
    processes = [
        _proc(1, "python.exe", f"python -m yuu_clip.cli serve --project {root}"),
        _proc(2, "python.exe", "python -m yuu_clip.dev serve"),
        _proc(3, "python.exe", "python -m yuu_clip.cli serve --project D:\\other"),
        _proc(4, "chrome.exe", f"chrome yuu_clip.cli serve {root}"),
    ]
    assert serve_mod.stale_serve_pids(processes, root) == [1]


def test_orphan_llama_pids_matches_repo_runtime_dir():
    llama_dir = serve_mod.LLAMA_RUNTIME_DIR
    processes = [
        _proc(5, "llama-server.exe", f"llama-server.exe -m {llama_dir}\\model.gguf"),
        _proc(6, "llama-server.exe", "llama-server.exe -m D:\\elsewhere\\model.gguf"),
    ]
    assert serve_mod.orphan_llama_pids(processes, llama_dir) == [5]


def test_find_free_port_returns_none_when_all_busy(monkeypatch):
    monkeypatch.setattr(serve_mod, "port_in_use", lambda host, port: True)
    assert serve_mod.find_free_port("127.0.0.1", 8080, max_tries=3) is None


# --- test-ui: preflight + selection helpers -----------------------------

def test_running_server_count_counts_serve_processes():
    processes = [
        _proc(1, "python.exe", "python -m yuu_clip.cli serve --project X"),
        _proc(2, "python.exe", "python -m yuu_clip.cli serve --project X"),
        _proc(3, "chrome.exe", "chrome"),
    ]
    assert tests_mod.running_server_count(processes) == 2


def test_orphan_test_procs_flags_pytest_and_playwright():
    processes = [
        _proc(1, "python.exe", "python -m pytest tests/ui"),
        _proc(2, "node.exe", "node C:/x/playwright/driver/package/cli.js run-server"),
        _proc(3, "python.exe", "python -m yuu_clip.cli serve"),
    ]
    assert [proc.pid for proc in tests_mod.orphan_test_procs(processes)] == [1, 2]


def test_ui_test_paths_smoke_only():
    paths, notes = tests_mod.ui_test_paths(smoke=True, changed=False)
    assert paths == [tests_mod.SMOKE]
    assert notes == []


def test_worker_args_scale_with_file_count():
    assert tests_mod._worker_args(1, sequential=False) == []
    assert tests_mod._worker_args(2, sequential=False) == \
        ["-n", "2", "--dist", "loadfile", "--max-worker-restart", "0"]
    assert tests_mod._worker_args(10, sequential=False)[:2] == ["-n", "4"]
    assert tests_mod._worker_args(5, sequential=True) == []


def test_test_api_propagates_exit_and_passes_extra_args(monkeypatch, tmp_path):
    calls: dict = {}

    def fake_run_and_tee(cmd, cwd, env=None):
        calls["cmd"] = cmd
        return 5, "============ 1 failed in 0.1s ============\n"

    monkeypatch.setattr(tests_mod, "run_and_tee", fake_run_and_tee)
    monkeypatch.setattr(tests_mod, "API_LOG", tmp_path / "a.log")
    monkeypatch.setattr(tests_mod, "API_SUMMARY", tmp_path / "a-summary.log")

    result = runner.invoke(app, ["test-api", "-k", "foo"])
    assert result.exit_code == 5
    assert "tests/unit" in calls["cmd"] and "tests/integration" in calls["cmd"]
    assert "-k" in calls["cmd"] and "foo" in calls["cmd"]


def test_test_ui_propagates_failing_exit_code(monkeypatch, tmp_path):
    # A wrapper that swallowed the pytest exit code would hide red UI tests. Stub
    # the live-server preflights + lock so only the exit-code plumbing is exercised.
    monkeypatch.setattr(tests_mod, "_preflight_processes", lambda: None)
    monkeypatch.setattr(tests_mod, "_preflight_seed_data", lambda: None)
    monkeypatch.setattr(tests_mod, "acquire_ui_lock", lambda lock_path: True)
    monkeypatch.setattr(tests_mod, "UI_LOCK", tmp_path / "test-ui.lock")
    monkeypatch.setattr(tests_mod, "UI_LOG", tmp_path / "ui.log")
    monkeypatch.setattr(tests_mod, "UI_SUMMARY", tmp_path / "ui-summary.log")
    monkeypatch.setattr(
        tests_mod, "run_and_tee",
        lambda cmd, cwd, env=None: (4, "============ 1 failed in 0.2s ============\n"),
    )

    result = runner.invoke(app, ["test-ui", "--smoke"])
    assert result.exit_code == 4


def test_test_ui_releases_lock_even_when_run_fails(monkeypatch, tmp_path):
    lock = tmp_path / "test-ui.lock"
    monkeypatch.setattr(tests_mod, "_preflight_processes", lambda: None)
    monkeypatch.setattr(tests_mod, "_preflight_seed_data", lambda: None)
    monkeypatch.setattr(tests_mod, "UI_LOCK", lock)
    monkeypatch.setattr(tests_mod, "UI_LOG", tmp_path / "ui.log")
    monkeypatch.setattr(tests_mod, "UI_SUMMARY", tmp_path / "ui-summary.log")
    monkeypatch.setattr(
        tests_mod, "run_and_tee",
        lambda cmd, cwd, env=None: (4, "============ 1 failed in 0.2s ============\n"),
    )

    runner.invoke(app, ["test-ui", "--smoke"])
    assert not lock.exists()


# --- procs: CIM JSON parsing --------------------------------------------

def test_parse_cim_json_handles_empty_single_and_array():
    assert procs.parse_cim_json("") == []
    assert procs.parse_cim_json("not json") == []
    assert procs.parse_cim_json('{"ProcessId":10,"Name":"python.exe","CommandLine":"x"}') == \
        [procs.ProcInfo(10, "python.exe", "x")]
    parsed = procs.parse_cim_json(
        '[{"ProcessId":1,"Name":"a","CommandLine":null},{"ProcessId":2,"Name":"b","CommandLine":"c"}]'
    )
    assert parsed == [procs.ProcInfo(1, "a", ""), procs.ProcInfo(2, "b", "c")]
