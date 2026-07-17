"""Fixtures for the live-server Playwright UI suite (``tests/ui/``).

These tests need a dev server running on the test URL (default
``http://127.0.0.1:8080``; override with ``YUU_TEST_URL`` so the harness and a
non-default dev port can agree). The seeded-DB / TestClient fixtures live in
``tests/integration/conftest.py``; only ``isolate_global_config`` is inherited
from the root ``tests/conftest.py``.
"""
from __future__ import annotations

import os
import socket
import subprocess
import threading
from urllib.parse import urlparse

import pytest

# ---------------------------------------------------------------------------
# Live server URL - overridable so the harness and a non-default dev port agree.
# ---------------------------------------------------------------------------

LIVE_URL = os.environ.get("YUU_TEST_URL", "http://127.0.0.1:8080")
_parsed = urlparse(LIVE_URL)
_HOST = _parsed.hostname or "127.0.0.1"
_PORT = _parsed.port or 8080


def _server_up() -> bool:
    try:
        with socket.create_connection((_HOST, _PORT), timeout=1):
            return True
    except OSError:
        return False


skip_no_server = pytest.mark.skipif(
    not _server_up(),
    reason=f"Live server not running on {LIVE_URL}",
)


def select_video_with_clips(page) -> None:
    """Select the first sidebar video that actually has clips and wait for its
    clip list to render.

    Iterating instead of clicking ``#video-list li.first`` keeps the clip tests
    independent of sidebar ordering - a 0-clip video at the top of the list would
    otherwise leave the clip list showing only its empty-state row and time out
    every clip test. Real clip rows carry a ``.clip-num`` badge; the empty-state
    ``<li>`` does not, which is what we wait on.

    Split segments are skipped even when they have clips - most tests assume a
    plain top-level recording (e.g. split tests expect 'Split Recording', not
    'Undo Split', in Additional Actions), and a segment sorting first in a
    recent-created project would otherwise hijack every caller of this helper.
    """
    # The page fixture already navigated to LIVE_URL; only navigate again if a
    # test moved away, so the common path doesn't pay a second full page load.
    if not page.url.startswith(LIVE_URL):
        page.goto(LIVE_URL)
    # 15s (not 5s): /api/videos can stall for several seconds under a full
    # parallel run when its query contends on the single SQLite DB - a 5s wait
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
    """Select a video that has clips, then open the first real clip's detail.

    Waits for the clip to finish loading - not just for the click. ``selectClip``
    sets ``activeClipId`` synchronously but only fills ``activeClipData`` after
    two awaited fetches (clip + media_url), and ``#detail`` is a static shell
    element, so a bare ``wait_for_selector('.detail')`` is not a real gate. Under
    parallel load those fetches lag and callers that read ``activeClipData``
    immediately would race to a null. Gate on activeClipData matching the
    now-active clip instead.
    """
    select_video_with_clips(page)
    page.locator("#clip-list li:has(.clip-num)").first.click()
    page.wait_for_function(
        "() => AppState.activeClipData"
        " && AppState.activeClipData.id === AppState.activeClipId",
        timeout=5000,
    )


def _first_row(page):
    """The first real clip row in the sidebar list (skips the empty-state <li>)."""
    return page.locator("#clip-list li:has(.clip-num)").first


_had_failure = False
_is_ui_session = False


def pytest_collection_finish(session) -> None:
    global _is_ui_session
    # Detect by directory (tests/ui/), not the "test_ui" filename substring: the
    # suite now lives under tests/ui/ and the watchdogs should key off that.
    _is_ui_session = any(
        "ui" in os.path.normpath(str(item.fspath)).split(os.sep) for item in session.items
    )


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
    # the last test's teardown started - i.e. the driver kill failed too.
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
    event loop parked in GetQueuedCompletionStatus forever. The old escape -
    os._exit watchdogs - is not viable under xdist: a force-exited worker reads
    as a crashed node and its last test is falsely marked failed.

    Instead, give close() a couple of seconds, then kill the node driver: the
    broken pipe wakes the event loop and close() raises 'Connection closed while
    reading from the driver', which we swallow. Teardown then completes
    normally, so workers shut down cleanly and pytest prints its real summary.

    The 2s grace is a pure tail tax paid once per worker at session end. When
    close() genuinely hangs (the common case here) it always burns the full
    grace, so keep it short - the taskkill is the real recovery path, not a
    last resort. A clean close (rare on this platform) still returns early.
    """
    driver_pid = _playwright_driver_pid(browser)
    close_finished = threading.Event()

    def _kill_driver_if_stuck() -> None:
        if close_finished.wait(2) or driver_pid is None:
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


@pytest.fixture(scope="session")
def logic_page(browser):
    """One page, loaded once, shared by the pure-logic UI test files.

    test_ui_utils / test_ui_terminology / test_ui_globals only ever call
    ``page.evaluate(...)`` against the served JS globals - no DOM interaction,
    no navigation, no server-state mutation. Any test that reads ``AppState``
    seeds exactly what it needs first, so one shared page is safe and skips
    ~115 redundant full page loads (each ~0.3s of fetching + parsing 36
    scripts). Those files opt in by overriding ``page`` to return this fixture.

    Overlays (e.g. the Getting Started modal boot.js may open) are irrelevant:
    page.evaluate runs regardless of what covers the DOM, and these tests never
    click. So, unlike the ``page`` fixture, this one skips the seen-flag seed.
    """
    context = browser.new_context()
    shared = context.new_page()
    shared.set_default_timeout(10_000)
    shared.set_default_navigation_timeout(30_000)
    shared.goto(LIVE_URL, wait_until="domcontentloaded")
    yield shared
    try:
        context.close()
    except Exception:
        pass


@pytest.fixture
def page(page):
    """Override pytest-playwright's page fixture to set default timeouts.

    Playwright defaults to 30s for actions and assertions, which means a
    selector miss silently hangs for half a minute before the test fails.
    10s gives faster feedback on a genuine miss.

    Navigation waits for ``domcontentloaded`` rather than the default ``load``:
    all ~36 static JS files are parser-blocking (no defer/async), so the app's
    globals are already defined at DOMContentLoaded - waiting for ``load`` only
    adds the trailing sub-resources (favicon, etc.), pure latency × every test.
    The nav timeout stays at 30s (not the 10s action default): under a full
    parallel run (4 browsers re-fetching the scripts while /api/videos queries
    contend on the one SQLite DB) even DOMContentLoaded occasionally stalls past
    10s and would fail unrelated tests at their fixture goto. 30s absorbs the
    transient contention without hiding a real hang (the teardown watchdog still
    bounds those).

    Also seeds the Getting Started seen-flag via an init script so the modal
    never auto-opens - the script runs before boot.js on *every* navigation,
    including the fixture's own first load. (Seeding with page.evaluate after
    goto is not enough: boot.js has already opened the modal by then, and the
    overlay intercepts all clicks until a test happens to re-navigate.)

    A shared, cache-warm context was tried here to cut the per-test page load
    (deferred lever #5) and measured to give no gain: on localhost the ~0.3s
    setup is page creation + V8 parse/execute of the scripts + DOMContentLoaded,
    not the (already ~1ms) fetch, so caching the fetch saves nothing. Reverted to
    a fresh context per test to keep full state isolation.
    """
    page.set_default_timeout(10_000)
    page.set_default_navigation_timeout(30_000)
    page.add_init_script(
        "try { localStorage.setItem('yuu-getting-started-seen', '1'); } catch (e) {}"
    )
    page.goto(LIVE_URL, wait_until="domcontentloaded")
    yield page
    try:
        # Abort any in-flight SSE so it can't bleed into the next test (jobs.js).
        page.evaluate("window._abortActiveStream && window._abortActiveStream()")
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
