"""Disposable, isolated fixture server for the Playwright UI suite.

``yuu-dev test-ui`` no longer drives the repo owner's interactive :8080 dev
server, whose project data and ``config.json`` mutate as the app is used - that
made the UI tier non-deterministic (its starting state was "whatever the app
looks like today"). Instead each run stands up its own throwaway server:

  * a freshly-seeded fixture project (``build_fixture_project``, force-rebuilt so
    every run starts from an identical 3-clip / 2-scene seed),
  * served on a free loopback port (never :8080, so the owner's live server is
    untouched and cross-session runs never collide on a port),
  * with an isolated empty global-config dir (``YUU_CONFIG_DIR``) so the server
    reads pure ``Config`` defaults and writes none of the owner's real settings.

Torn down (process tree + temp config dir) when the run ends.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from yuu_clip.dev import procs
from yuu_clip.dev._base import REPO_ROOT, console
from yuu_clip.dev.fixture import DEFAULT_FIXTURE_DIR, build_fixture_project
from yuu_clip.dev.serve import LLAMA_RUNTIME_DIR, find_free_port
from yuu_clip.dev.status import wait_until_ready

TEST_HOST = "127.0.0.1"
# Deliberately not 8080 (the interactive dev server). A free port at/after this
# base is chosen per run so two concurrent test-ui runs never fight for it.
TEST_PORT_BASE = 8091
READY_TIMEOUT_S = 30
# Endpoints whose first call on a cold server probes hardware/models/disk and can
# take several seconds. Warming them once, before Playwright starts, keeps a test
# with an 8s wait_for_function from racing that one-time cold cost (settings opens
# gate on /api/capabilities/tiers). The dev :8080 server was always warm.
_WARMUP_PATHS = ("/api/capabilities/tiers",)


def _spawn(project_dir: Path, config_dir: Path, host: str, port: int) -> subprocess.Popen:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["YUU_CONFIG_DIR"] = str(config_dir)
    if LLAMA_RUNTIME_DIR.exists():
        env["YUU_CLIP_LLAMA_SERVER_DIR"] = str(LLAMA_RUNTIME_DIR)
    cmd = [
        sys.executable, "-m", "yuu_clip.cli", "serve",
        "--project", str(project_dir),
        "--host", host, "--port", str(port),
        "--no-open",
    ]
    kwargs: dict = {
        "cwd": str(REPO_ROOT), "env": env,
        "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL,
    }
    if sys.platform == "win32":
        # New process group so the tree kill in _teardown reaps any llama child.
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen(cmd, **kwargs)


def _teardown(proc: subprocess.Popen, config_dir: Path) -> None:
    if sys.platform == "win32":
        procs.kill(proc.pid)  # taskkill /F /T - reaps the tree (llama child)
    else:
        proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
    shutil.rmtree(config_dir, ignore_errors=True)


@contextmanager
def fixture_server(host: str = TEST_HOST) -> Iterator[str]:
    """Build a fresh fixture project + isolated config, serve it on a free port,
    yield the base URL, and tear the server down on exit."""
    project_dir = build_fixture_project(DEFAULT_FIXTURE_DIR, force=True)
    config_dir = Path(tempfile.mkdtemp(prefix="yuu-ui-config-"))
    port = find_free_port(host, TEST_PORT_BASE)
    if port is None:
        shutil.rmtree(config_dir, ignore_errors=True)
        raise RuntimeError(f"No free port near {TEST_PORT_BASE} for the fixture server.")

    proc = _spawn(project_dir, config_dir, host, port)
    url = f"http://{host}:{port}"
    try:
        if not wait_until_ready(host, port, timeout=READY_TIMEOUT_S):
            raise RuntimeError(f"Fixture server did not become ready at {url} within {READY_TIMEOUT_S}s.")
        _warm(url)
        console.print(f"[green]Fixture server ready at[/green] {url} [dim](isolated project + config)[/dim]")
        yield url
    finally:
        _teardown(proc, config_dir)


def _warm(url: str) -> None:
    import httpx
    for path in _WARMUP_PATHS:
        try:
            httpx.get(f"{url}{path}", timeout=20)
        except Exception:
            pass  # best-effort; a slow warm just means the first test pays the cost
