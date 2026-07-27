"""``yuu-dev test-chaos`` - manual exploratory bug-hunting pass, NOT a gate.

Fires deliberately rapid/unusual interaction sequences (stacked modals, mashed
buttons, start/cancel/restart races) against the same disposable fixture server
``test-ui`` uses (see ``uiserver.fixture_server``), then reports any browser
console errors, uncaught page exceptions, or failed requests that resulted. A
"finding" here is a lead for a human to investigate, not a pass/fail assertion
on a specific outcome - the whole point is to surface *unknown* bugs a
structured test wouldn't think to check for.

Deliberately excluded from test-all / test-api / test-ui and from CI: run it
by hand with ``yuu-dev test-chaos`` when bug-hunting, not as part of the
everyday edit -> test -> commit loop.

Known environment flakiness: Playwright's Node driver has been observed going
unresponsive mid-session ("Connection closed while reading from the driver" on
browser.close()), wedging every subsequent call on the same dispatch thread -
not something this script's phases cause. The whole browser session runs under
a bounded watchdog (SESSION_TIMEOUT_S) precisely so a wedged driver still lets
this command finish and report whatever it found, instead of hanging forever.
"""
from __future__ import annotations

import re
import threading

import typer

from yuu_clip.dev import procs
from yuu_clip.dev._base import TEST_LOGS_DIR, app, console
from yuu_clip.dev.uiserver import fixture_server

# Matches tests.py's _ORPHAN_RE convention: identify Playwright's own Node
# driver process by command line, never by bare process name - "node.exe"
# alone could just as easily be an unrelated process.
_DRIVER_RE = re.compile(r"playwright[/\\]driver[/\\]package[/\\]cli\.js")

CHAOS_LOG = TEST_LOGS_DIR / "test-chaos-last.log"
DEFAULT_TIMEOUT_MS = 3000
# A broken Playwright driver connection (seen in practice as "Connection closed
# while reading from the driver" on browser.close()) can make ANY subsequent
# call into it - close(), stop(), even a call that would normally raise -
# hang indefinitely instead of returning or raising, since there is no
# built-in timeout on those lower-level protocol calls. Running the whole
# browser session in a thread and bounding the join guarantees this command
# always terminates within SESSION_TIMEOUT_S, so fixture_server()'s own
# teardown (a forceful taskkill, not a negotiated shutdown) still runs and
# reaps the spawned server even if the driver is wedged.
SESSION_TIMEOUT_S = 90

_findings: list[str] = []
_console_errors: list[str] = []
_page_errors: list[str] = []
_failed_requests: list[str] = []


def _phase(name: str) -> None:
    console.print(f"\n[cyan]=== {name} ===[/cyan]")
    _console_errors.clear()
    _page_errors.clear()
    _failed_requests.clear()


def _report(name: str) -> None:
    local = [f"[{name}] console error: {e}" for e in _console_errors]
    local += [f"[{name}] page exception: {e}" for e in _page_errors]
    local += [f"[{name}] failed request: {e}" for e in _failed_requests]
    if not local:
        console.print("  clean")
        return
    for line in local:
        console.print(f"  ! {line}")
    _findings.extend(local)


def _safe(label: str, fn) -> None:
    try:
        fn()
    except Exception as e:
        msg = f"[{label}] script-side exception (selector drift or genuine hang): {type(e).__name__}: {e}"
        _findings.append(msg)
        console.print(f"  ! {label}: {type(e).__name__}: {e}")




def _click(page, selector: str, timeout: int = DEFAULT_TIMEOUT_MS, **kw) -> None:
    page.click(selector, timeout=timeout, **kw)


def _triple_click(page, selector: str, timeout: int = DEFAULT_TIMEOUT_MS) -> None:
    _click(page, selector, timeout=timeout)
    _click(page, selector, timeout=timeout)
    _click(page, selector, timeout=timeout)


def _click_each(page, selectors: list[str], timeout: int = DEFAULT_TIMEOUT_MS) -> None:
    for selector in selectors:
        _click(page, selector, timeout=timeout)


def _run_phases(page) -> None:
    # Phase 1: stacked modal spam, then Escape-spam to unwind. Modals correctly
    # block clicks to elements behind them (modal-bg intercepts pointer events) -
    # that is expected, not a bug; short timeouts fail those attempts fast.
    _phase("Stacked modal spam")
    _safe("open hamburger", lambda: _click(page, "#btn-hamburger"))
    _safe("About", lambda: _click(page, "#hamburger-item-about"))
    _safe("hamburger again (expect blocked by About modal)", lambda: _click(page, "#btn-hamburger"))
    _safe("Glossary (expect blocked)", lambda: _click(page, "#hamburger-item-glossary"))
    _safe("People (expect blocked by About modal)", lambda: _click(page, "#btn-people"))
    _safe("Settings (expect blocked)", lambda: _click(page, "#btn-settings-header"))
    page.wait_for_timeout(300)
    for _ in range(8):
        _safe("Escape spam", lambda: page.keyboard.press("Escape"))
        page.wait_for_timeout(50)
    _report("Stacked modal spam")

    # Phase 2: New Recording panel open/close/reopen thrash.
    _phase("New Recording panel thrash")
    for i in range(6):
        _safe(f"open New Recording #{i}", lambda: _click(page, "#btn-analyze"))
        page.wait_for_timeout(30)
        _safe(f"Escape #{i}", lambda: page.keyboard.press("Escape"))
        page.wait_for_timeout(30)
    _report("New Recording panel thrash")

    # Phase 3: rapid sidebar video selection race.
    _phase("Rapid sidebar selection race")
    _safe("wait for video rows", lambda: page.wait_for_selector("li[data-video-id]", timeout=5000))
    ids = page.eval_on_selector_all("li[data-video-id]", "els => els.map(e => e.dataset.videoId)")
    for _ in range(3):
        for vid in ids:
            _safe(f"click video {vid}", lambda vid=vid: _click(page, f"li[data-video-id='{vid}']", timeout=2000))
    _report("Rapid sidebar selection race")

    # Phase 4: log toggle mash.
    _phase("Log toggle mash")
    for _ in range(15):
        _safe("toggle log", lambda: _click(page, "#btn-log-toggle", timeout=1000))
    _report("Log toggle mash")

    # Phase 5: Settings open, mash section jump links, close without saving.
    _phase("Settings jump-link mash + discard")
    _safe("open settings", lambda: _click(page, "#btn-settings-header"))
    page.wait_for_timeout(300)
    jump_links = [f"button.settings-jump-link:nth-of-type({n})" for n in range(1, 6)]
    _safe("jump links", lambda: _click_each(page, jump_links, timeout=1000))
    _safe("close settings via Escape", lambda: page.keyboard.press("Escape"))
    _report("Settings jump-link mash + discard")

    # Phase 6: keyboard shortcut spam while a clip is selected.
    _phase("Keyboard shortcut spam")
    _safe("select first clip if any", lambda: _click(page, "li[data-clip-id]", timeout=2000))
    for key in ["?", "/", "Escape", "ArrowDown", "ArrowUp", "Tab", "Tab", "Escape"] * 3:
        _safe(f"key {key}", lambda key=key: page.keyboard.press(key))
        page.wait_for_timeout(20)
    _report("Keyboard shortcut spam")

    # Phase 7: batch export modal open/confirm-spam without filling fields.
    _phase("Batch export modal double-submit")
    _safe("open batch export", lambda: _click(page, "[data-act='open-batch-export']", timeout=2000))
    page.wait_for_timeout(300)
    _safe("triple-click Export", lambda: _triple_click(page, "#batch-confirm-btn", timeout=1000))
    page.wait_for_timeout(500)
    _safe("Escape out", lambda: page.keyboard.press("Escape"))
    _report("Batch export modal double-submit")

    # Phase 8: resize viewport mid-modal.
    _phase("Resize mid-modal")
    _safe("open settings again", lambda: _click(page, "#btn-settings-header"))
    page.wait_for_timeout(200)
    _safe("resize small", lambda: page.set_viewport_size({"width": 480, "height": 640}))
    page.wait_for_timeout(150)
    _safe("resize large", lambda: page.set_viewport_size({"width": 1920, "height": 1080}))
    page.wait_for_timeout(150)
    _safe("resize back", lambda: page.set_viewport_size({"width": 1280, "height": 900}))
    _safe("close", lambda: page.keyboard.press("Escape"))
    _report("Resize mid-modal")

    # Phase 9: real job start/cancel/restart race (rediarize). The most
    # bug-prone area a past QA pass found (false-success-after-cancel,
    # mislabeled confirm dialogs, stale busy-lock) - hammer start->cancel->
    # start on a real backend job. Scoped to #actions-modal specifically:
    # "Re-detect Speakers" also appears (hidden) in Settings' help copy, and a
    # bare text= selector can resolve to that instead.
    _phase("Job start/cancel/restart race")
    redetect_row = "#actions-modal .action-row:has(.action-row-label:has-text('Re-detect Speakers'))"
    _safe("open Additional Actions", lambda: _click(page, "[data-act='open-video-actions']", timeout=2000))
    page.wait_for_timeout(200)
    _safe("click Re-detect Speakers", lambda: _click(page, redetect_row, timeout=2000))
    page.wait_for_timeout(150)
    _safe("cancel job immediately", lambda: _click(page, "#btn-cancel-job", timeout=1500))
    page.wait_for_timeout(100)
    _safe("confirm cancel dialog if shown", lambda: _click(page, "button:has-text('Cancel Re-detection')", timeout=1500))
    page.wait_for_timeout(300)
    _safe("open Additional Actions again", lambda: _click(page, "[data-act='open-video-actions']", timeout=2000))
    _safe("click Re-detect Speakers again immediately", lambda: _click(page, redetect_row, timeout=2000))
    page.wait_for_timeout(2000)
    _safe("cancel again", lambda: _click(page, "#btn-cancel-job", timeout=1500))
    _safe("confirm cancel dialog again", lambda: _click(page, "button:has-text('Cancel Re-detection')", timeout=1500))
    page.wait_for_timeout(1000)
    _report("Job start/cancel/restart race")


def _reap_wedged_driver() -> None:
    """After abandoning a hung browser session, kill the Playwright driver
    process - taskkill's tree kill takes any browser process it spawned with
    it - so it doesn't linger as an orphan. Matched by command line so this
    can never touch an unrelated chrome.exe/node.exe (e.g. the owner's own
    browser windows)."""
    for proc in procs.list_processes(["node.exe"]):
        if _DRIVER_RE.search(proc.command_line):
            console.print(f"  ! killing wedged Playwright driver PID {proc.pid}")
            procs.kill(proc.pid)


def _run_browser_session(url: str, headed: bool) -> None:
    from playwright.sync_api import sync_playwright

    playwright = sync_playwright().start()
    try:
        browser = playwright.chromium.launch(headless=not headed)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.add_init_script(
            "try { localStorage.setItem('yuu-getting-started-seen', '1'); } catch (e) {}"
        )
        page.on("console", lambda msg: _console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: _page_errors.append(str(exc)))
        page.on("requestfailed", lambda req: (
            None if "/source" in req.url and req.failure == "net::ERR_ABORTED"
            else _failed_requests.append(f"{req.method} {req.url} - {req.failure}")
        ))
        page.on("response", lambda res: _failed_requests.append(f"{res.status} {res.url}") if res.status >= 400 else None)

        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)

        try:
            _run_phases(page)
        except Exception as e:
            _findings.append(f"[run] uncaught script exception: {type(e).__name__}: {e}")
            console.print(f"  ! run raised: {type(e).__name__}: {e}")

        try:
            browser.close()
        except Exception as e:
            console.print(f"  ! browser.close() raised (non-fatal for reporting): {type(e).__name__}: {e}")
    finally:
        try:
            playwright.stop()
        except Exception:
            pass


@app.command("test-chaos")
def test_chaos(
    headed: bool = typer.Option(False, "--headed", help="Show the browser window instead of running headless."),
) -> None:
    """Exploratory Playwright bug-hunt against the disposable fixture server.

    Fires rapid/unusual interaction sequences (stacked modals, mashed buttons,
    job start/cancel/restart races) and reports console errors, uncaught page
    exceptions, and failed requests. Non-deterministic by nature - a finding is
    a lead to investigate by hand, not a regression assertion. NOT part of
    test-all/test-api/test-ui and never run by CI; run it deliberately when
    bug-hunting.
    """
    _findings.clear()
    with fixture_server() as url:
        # Run the whole browser session (launch through close) in a thread with
        # a bounded join - see SESSION_TIMEOUT_S. A broken driver connection can
        # make any Playwright call hang rather than raise, so a plain try/except
        # around individual calls is not enough; only a bounded join guarantees
        # this command (and fixture_server()'s own teardown) always completes.
        done = threading.Event()

        def _worker() -> None:
            try:
                _run_browser_session(url, headed)
            finally:
                done.set()

        threading.Thread(target=_worker, daemon=True).start()
        if not done.wait(timeout=SESSION_TIMEOUT_S):
            _findings.append(
                f"[session] browser session did not finish within {SESSION_TIMEOUT_S}s "
                "(driver likely wedged) - abandoning it; findings above are what was "
                "collected before the hang"
            )
            console.print(f"\n  ! session did not finish within {SESSION_TIMEOUT_S}s - abandoning it")
            _reap_wedged_driver()

    console.print("\n[cyan]========== FINDINGS ==========[/cyan]")
    if not _findings:
        console.print("None - all phases clean.")
    else:
        for f in _findings:
            console.print(f"- {f}")
    console.print(f"\nTotal: {len(_findings)} finding(s)")
    CHAOS_LOG.write_text("\n".join(_findings), encoding="utf-8")
    console.print(f"[dim]Findings: {CHAOS_LOG}[/dim]")

    raise typer.Exit(1 if _findings else 0)
