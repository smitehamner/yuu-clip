"""
Shared fixtures for yuu-clip tests.
"""
from __future__ import annotations

import os
import socket
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import yuu_clip.config as config_mod
from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    Video,
    make_session,
)
from yuu_clip.web.app import create_app

# ---------------------------------------------------------------------------
# Global config isolation — Config.load() always reads the real OS-level
# global config dir (platformdirs), so without this every test run picks up
# whatever settings are saved on the machine actually running the suite.
# Autouse so every test gets an isolated, empty global config dir by default;
# tests that need specific global values still monkeypatch _global_config_dir
# themselves (that continues to work — it just overrides this default).
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def isolate_global_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        config_mod, "_global_config_dir", lambda: tmp_path / "_isolated_global_config"
    )


# ---------------------------------------------------------------------------
# Minimal project dir fixture — isolated temp dir with a seeded DB
# ---------------------------------------------------------------------------

@pytest.fixture()
def project_dir(tmp_path: Path) -> Path:
    """A temporary project directory with a pre-seeded SQLite DB."""
    data = tmp_path / ".yuu-clip"
    data.mkdir()
    (data / "exports").mkdir()
    (data / "audio").mkdir()

    db_path = data / "project.db"
    session = make_session(db_path)

    # Seed one video and a few clips
    v = Video(
        path=str(tmp_path / "session.mkv"),
        filename="session.mkv",
        status="done",
        duration_ms=600_000,
    )
    session.add(v)
    session.flush()

    track = AudioTrack(
        video_id=v.id,
        stream_index=1,
        label="combined",
        do_transcribe=True,
        do_score=True,
        relevance_weight=1.5,
    )
    session.add(track)
    session.flush()

    scored_at = datetime.now(timezone.utc)
    for i, (score, status) in enumerate([
        (0.85, "pending"),
        (0.60, "approved"),
        (0.20, "rejected"),
    ]):
        session.add(ClipCandidate(
            video_id=v.id,
            start_ms=i * 60_000,
            end_ms=(i + 1) * 60_000,
            score_overall=score,
            score_funny=score * 0.9,
            score_dramatic=score * 0.5,
            score_action=score * 0.3,
            description=f"Test clip {i + 1}",
            status=status,
            scored_at=scored_at,
        ))

    session.commit()
    session.close()
    return tmp_path


@pytest.fixture()
def client(project_dir: Path) -> TestClient:
    """A TestClient backed by the FastAPI app pointed at the temp project."""
    app = create_app(project_dir)
    return TestClient(app)


# ---------------------------------------------------------------------------
# Playwright — connect to the already-running dev server
# ---------------------------------------------------------------------------

LIVE_URL = "http://127.0.0.1:8080"


def _server_up() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 8080), timeout=1):
            return True
    except OSError:
        return False


skip_no_server = pytest.mark.skipif(
    not _server_up(),
    reason="Live server not running on port 8080",
)


def select_video_with_clips(page) -> None:
    """Select the first sidebar video that actually has clips and wait for its
    clip list to render.

    Iterating instead of clicking ``#video-list li.first`` keeps the clip tests
    independent of sidebar ordering — a 0-clip video at the top of the list would
    otherwise leave the clip list showing only its empty-state row and time out
    every clip test. Real clip rows carry a ``.clip-num`` badge; the empty-state
    ``<li>`` does not, which is what we wait on.

    Split segments are skipped even when they have clips — most tests assume a
    plain top-level recording (e.g. split tests expect 'Split Recording', not
    'Undo Split', in Additional Actions), and a segment sorting first in a
    recent-created project would otherwise hijack every caller of this helper.
    """
    # The page fixture already navigated to LIVE_URL; only navigate again if a
    # test moved away, so the common path doesn't pay a second full page load.
    if not page.url.startswith(LIVE_URL):
        page.goto(LIVE_URL)
    # 15s (not 5s): /api/videos can stall for several seconds under a full
    # parallel run when its query contends on the single SQLite DB — a 5s wait
    # here failed this shared helper for reasons unrelated to the test.
    page.wait_for_selector("#video-list li[data-video-id]", timeout=15000)
    videos = page.locator("#video-list li[data-video-id]")
    segment_ids = set(page.evaluate(
        "AppState.videos.filter(v => v.parent_video_id != null).map(v => v.id)"
    ))
    for i in range(videos.count()):
        li = videos.nth(i)
        if int(li.get_attribute("data-video-id")) in segment_ids:
            continue
        li.click()
        try:
            page.wait_for_selector("#clip-list li .clip-num", timeout=3000)
            return
        except Exception:
            continue
    raise AssertionError("No sidebar video has clips on the live server")


def select_first_video_and_clip(page) -> None:
    """Select a video that has clips, then open the first real clip's detail."""
    select_video_with_clips(page)
    page.locator("#clip-list li:has(.clip-num)").first.click()


_had_failure = False
_is_ui_session = False


def pytest_collection_finish(session) -> None:
    global _is_ui_session
    _is_ui_session = any("test_ui" in str(item.fspath) for item in session.items)


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    global _had_failure
    if report.when == "call" and report.failed:
        _had_failure = True


def _force_exit_after(seconds: float, exit_code_fn) -> None:
    import threading
    import time

    def _watchdog() -> None:
        time.sleep(seconds)
        os._exit(exit_code_fn())

    threading.Thread(target=_watchdog, daemon=True).start()


def pytest_runtest_teardown(item, nextitem) -> None:
    # Fallback for the Playwright teardown hang (see _close_browser_unhang, which
    # normally resolves it). Only fires if the process is still alive 20s after
    # the last test's teardown started — i.e. the driver kill failed too.
    # Skipped under xdist: nextitem is None between work units too, and killing an
    # idle worker crashes the run. Workers get their own watchdog in sessionfinish.
    if not _is_ui_session or nextitem is not None or os.environ.get("PYTEST_XDIST_WORKER"):
        return
    _force_exit_after(20, lambda: 1 if _had_failure else 0)


def pytest_sessionfinish(session, exitstatus) -> None:
    # Teardown normally completes now that _close_browser_unhang guards the
    # Playwright hang, so a normal exit (with pytest's summary line) is expected.
    # The delayed force-exit only fires if something else wedges the interpreter.
    if not _is_ui_session:
        return
    _force_exit_after(10, lambda: int(exitstatus))


def _playwright_driver_pid(browser) -> int | None:
    # Private playwright internals (verified against 1.60): the sync Browser's
    # connection transport holds the node.exe driver subprocess. If an upgrade
    # breaks this path we return None and the force-exit fallbacks take over.
    try:
        return browser._impl_obj._connection._transport._proc.pid
    except AttributeError:
        return None


def _close_browser_unhang(browser) -> None:
    """Close the browser without hanging the process (Windows / Python 3.14).

    Upstream bug (playwright-python #818 family): at session teardown Chromium
    exits, but the driver's response to Browser.close is lost, leaving the sync
    event loop parked in GetQueuedCompletionStatus forever. The old escape —
    os._exit watchdogs — is not viable under xdist: a force-exited worker reads
    as a crashed node and its last test is falsely marked failed.

    Instead, give close() a few seconds, then kill the node driver: the broken
    pipe wakes the event loop and close() raises 'Connection closed while
    reading from the driver', which we swallow. Teardown then completes
    normally, so workers shut down cleanly and pytest prints its real summary.
    """
    driver_pid = _playwright_driver_pid(browser)
    close_finished = threading.Event()

    def _kill_driver_if_stuck() -> None:
        if close_finished.wait(5) or driver_pid is None:
            return
        subprocess.run(
            ["taskkill", "/F", "/PID", str(driver_pid)],
            capture_output=True, check=False, timeout=10,
        )

    threading.Thread(target=_kill_driver_if_stuck, daemon=True).start()
    try:
        browser.close()
    except Exception:
        pass
    finally:
        close_finished.set()


@pytest.fixture(scope="session")
def browser(launch_browser):
    """Override pytest-playwright's browser fixture: same launch, guarded close."""
    browser = launch_browser()
    yield browser
    _close_browser_unhang(browser)


@pytest.fixture
def page(page):
    """Override pytest-playwright's page fixture to set default timeouts.

    Playwright defaults to 30s for actions and assertions, which means a
    selector miss silently hangs for half a minute before the test fails.
    10s gives faster feedback on a genuine miss.

    Navigation keeps the full 30s, though: page.goto waits for the ``load``
    event, i.e. all ~20 static JS files served by the single shared dev server.
    Under a full parallel run (4 browsers re-fetching them while /api/videos
    queries contend on the one SQLite DB) that occasionally stalls past 10s and
    failed unrelated tests at their fixture goto. 30s absorbs the transient
    contention without hiding a real hang (the teardown watchdog still bounds
    those).

    Also seeds the Getting Started seen-flag via an init script so the modal
    never auto-opens — the script runs before boot.js on *every* navigation,
    including the fixture's own first load. (Seeding with page.evaluate after
    goto is not enough: boot.js has already opened the modal by then, and the
    overlay intercepts all clicks until a test happens to re-navigate.)
    """
    page.set_default_timeout(10_000)
    page.set_default_navigation_timeout(30_000)
    page.add_init_script(
        "try { localStorage.setItem('yuu-getting-started-seen', '1'); } catch (e) {}"
    )
    page.goto(LIVE_URL)
    yield page
    try:
        page.evaluate("if (window._activeES) { window._activeES.close(); window._activeES = null; }")
    except Exception:
        pass
    try:
        page.unroute("**")
    except Exception:
        pass
    try:
        page.goto("about:blank", timeout=2000)
    except Exception:
        pass
