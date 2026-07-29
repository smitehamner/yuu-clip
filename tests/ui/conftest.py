"""Fixtures for the live-server Playwright UI suite (``tests/ui/``).

These tests drive a live server at ``YUU_TEST_URL``. ``yuu-dev test-ui`` sets that
to a disposable, isolated *fixture* server it spawns for the run (freshly-seeded
project + isolated config on a free port - see ``yuu_clip/dev/uiserver.py``), so
the suite is deterministic and never touches the owner's interactive :8080 server.
Run standalone (bare ``pytest tests/ui``) it defaults to ``http://127.0.0.1:8080``.

Because the served project is the fixture, not the repo, tests resolve on-disk
project paths via ``served_project_dir(page)`` below, never the repo root, and
must not assert values from a personal config. The seeded-DB / TestClient fixtures
live in ``tests/integration/conftest.py``; only ``isolate_global_config`` is
inherited from the root ``tests/conftest.py``.
"""
from __future__ import annotations

import os
import socket
import subprocess
import threading
from pathlib import Path
from urllib.parse import urlparse

import pytest
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect

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


def served_project_dir(page) -> Path:
    """Absolute path of the project the live server is serving.

    test-ui stands up a disposable *fixture* project (yuu_clip.dev.uiserver), so
    tests that touch on-disk project files (reels, exports) must resolve the
    served project's dir from the server - never assume the repo root. Read from
    /api/projects, which reports the active project path.
    """
    current = page.evaluate("() => fetch('/api/projects').then(r => r.json()).then(d => d.current)")
    return Path(current)


def select_video_with_clips(page) -> None:
    """Select the first sidebar video that actually has clips and wait for its
    clip list to render.

    Picks the candidate from ``AppState.videos``' own ``clip_count`` rather than
    clicking each row and waiting to see whether clips show up: that trial-and-error
    approach (FLAKE-12 in the test-flakes register) used a wait TIMING OUT as its
    signal for "this video has 0 clips" - a legitimate, common case - so raising
    that wait to survive load contention would have meant every empty video ahead
    of the right one burning the full ceiling first. Reading ``clip_count`` decides
    up front with no guessing, so the one render wait left is a real positive
    assertion (matches the FLAKE-5 principle: safe to give it a generous ceiling).

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
    candidate_id = page.evaluate(
        "() => {"
        " const v = AppState.videos.find("
        "v => v.parent_video_id == null && v.clip_count > 0);"
        " return v ? v.id : null; }"
    )
    if candidate_id is None:
        raise AssertionError("No sidebar video has clips on the live server")
    page.click(f"#video-list li[data-video-id='{candidate_id}']")
    page.wait_for_selector("#clip-list li .clip-num", timeout=8000)


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


def open_modal(page, trigger, modal_visible_selector: str, *, attempts: int = 3) -> None:
    """Run ``trigger()`` and wait for the resulting modal to gain ``.visible``,
    retrying ``trigger`` if it doesn't appear.

    FLAKE-13 (test-flakes register): the actions-modal/batch-export-modal opens
    this guards were previously just a wait_for_selector, raised as high as
    8000ms - but for actions-modal specifically the whole click-to-``.visible``
    path (``openActionsModal``/``openVideoActionsModal``/``openClipActionsModal``
    in core/ui.js, videos.js, clips.js) is synchronous with no fetch and no
    animation-gated step, so the class add IS the earliest possible "ready"
    signal - a longer wait for the same signal doesn't help when the real
    problem is peak full-suite contention starving the page's main thread badly
    enough that the click handler never got a scheduling slot in time. Retrying
    the trigger recovers from that (and from a genuinely dropped click) the same
    way FLAKE-3's place_split_point retry does. Safe because every modal opener
    wired through this helper is idempotent - it fully repopulates a singleton
    modal's content and (re-)adds the visible class, so a trigger that "lands
    twice" is a no-op, not a corrupted state or a duplicated element.
    (openBatchExportModal is the one exception with a real awaited fetch before
    ``.visible`` - retrying still just re-issues that fetch, which is harmless
    against a route-mocked or idle test server.)
    """
    for attempt in range(attempts):
        trigger()
        try:
            page.wait_for_selector(
                modal_visible_selector,
                timeout=2000 if attempt < attempts - 1 else 8000,
            )
            return
        except PlaywrightTimeoutError:
            if attempt == attempts - 1:
                raise


def open_split_editor(page) -> None:
    select_video_with_clips(page)
    open_modal(
        page,
        lambda: page.click(".vid-actions button:has-text('Additional Actions')"),
        "#actions-modal.visible",
    )
    page.click("#actions-modal .action-row:has-text('Split Recording')")
    expect(page.locator("#split-editor-panel")).to_be_visible(timeout=3000)


def place_split_point(page) -> None:
    """Click the middle of the split timeline bar to place a marker.

    Shared by test_ui_split.py and test_ui_panelnav.py - was previously
    duplicated in both files, and a 2026-07-10 fix (FLAKE-3 in the test-flakes
    register) landed in only one of the two copies, so the bug it fixed
    recurred via the other copy. Single source of truth now.

    Deliberately an unqualified bar.click() rather than a manually computed
    position={x, y}: a position offset is an ABSOLUTE pixel value from the
    bar's top-left, resolved against whatever box Playwright reads at the
    actual moment of the click. Computing that offset from an earlier
    page.bounding_box() call (a separate round-trip) reads a box that can be
    stale by click time - e.g. the bar still widening as the split panel
    finishes animating in - so a "50%" offset computed from a narrow snapshot
    can land far from center on the final, wider bar, and on a short fixture
    video that can round the derived second down to 0 (splitTimelineClick's
    `sec <= 0` guard silently drops the placement - the observed "0 markers"
    symptom). An unqualified click() has Playwright compute the center from
    the live, actionability-stable box in one atomic action, which cannot go
    stale between measurement and dispatch.

    FLAKE-3 (test-flakes register) recurred 3x even after the above fix: under
    xdist CPU contention the bar's layout can still be mid-reflow at the exact
    click instant, landing `sec <= 0`. Retries the click (up to 3 attempts)
    rather than widening the wait, because a retry is idempotent here -
    `splitTimelineClick` ignores a click within 0.5% of an existing marker, so
    a retry after a click that actually landed is a no-op, not a duplicate.
    """
    bar = page.locator("#split-timeline-bar")
    expect(bar).to_be_visible()
    markers = page.locator("#split-markers-layer .split-marker")
    for attempt in range(3):
        bar.click()
        try:
            expect(markers).to_have_count(1, timeout=1000 if attempt < 2 else 5000)
            return
        except AssertionError:
            if attempt == 2:
                raise


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
    """Close the browser without hanging the process (Windows).

    Upstream bug (playwright-python #818 family): at session teardown Chromium
    exits, but the driver's response to Browser.close is lost, leaving the sync
    event loop parked in GetQueuedCompletionStatus forever. Confirmed on
    playwright 1.61.0 / Python 3.12.13 too, so this isn't a narrow 3.14-only
    case. The old escape - os._exit watchdogs - is not viable under xdist: a
    force-exited worker reads as a crashed node and its last test is falsely
    marked failed.

    This same bug bites bare ad-hoc Playwright scripts run outside pytest (a
    one-off `python -c "..."` against the live :8080 server hangs on exit, not
    launch) - see docs/dev/ARCHITECTURE.md landmine #9 and
    docs/dev/TESTING.md's "Ad-hoc browser scripts against the live server" for
    the same close-then-kill pattern applied to a standalone script.

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
