"""Playwright driver for visually verifying yuu-clip's web UI.

Assumes the dev server is already running (see SKILL.md for how to start it).
Requires Playwright + Chromium, already installed in this repo's `.venv`:

    .venv\\Scripts\\python.exe .claude\\skills\\run-yuu-clip\\driver.py

Every hardening choice here fixes a real hang hit while writing this driver -
see SKILL.md's Gotchas section for the story behind each one. Import
`open_page` and `dismiss_getting_started` to script your own flow; the
`__main__` block below is one representative flow (open New Recording, check
the disabled Start Analysis button), not the only one.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

DEFAULT_URL = "http://127.0.0.1:8080"
DEFAULT_TIMEOUT_MS = 8000  # fail fast on a bad selector instead of hanging


def open_page(playwright, url: str = DEFAULT_URL, timeout_ms: int = DEFAULT_TIMEOUT_MS):
    """Launch Chromium and return (browser, page) navigated to `url`.

    wait_until="load" (never "networkidle" - this app's periodic status
    polling means the network never goes fully idle, so networkidle hangs
    past Playwright's own timeout instead of resolving). The explicit
    wait_for_selector after goto is the real "page is ready" signal.
    """
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.set_default_timeout(timeout_ms)
    page.goto(url, wait_until="load", timeout=timeout_ms * 2)
    page.wait_for_selector("#btn-analyze", timeout=timeout_ms * 2)
    return browser, page


def dismiss_getting_started(page: Page) -> bool:
    """Close the Getting Started modal if it auto-opened (first run / cleared
    localStorage), returning whether it was open. It intercepts every click
    on the page behind it, so call this right after open_page()."""
    modal = page.query_selector("#getting-started-modal")
    was_visible = bool(modal and modal.evaluate("el => el.classList.contains('visible')"))
    if was_visible:
        page.click("#getting-started-x-btn")
    return was_visible


def finish(exit_code: int = 0) -> None:
    """Ends the process WITHOUT calling browser.close() or letting
    sync_playwright's context manager tear down.

    browser.close() has been observed to hang outright on Windows (not raise -
    just block forever) even after every real step (nav, clicks, screenshots)
    already succeeded and the screenshot file was already flushed to disk.
    try/except does not help against a hang, only a raise. Since every result
    a driver run needs is already on disk or already printed by this point,
    os._exit() (skips Python's normal cleanup, including __exit__ handlers)
    is the reliable way to end the process instead of risking that hang."""
    sys.stdout.flush()
    os._exit(exit_code)


def run_example_flow(url: str, out_dir: Path, timeout_ms: int) -> None:
    # Not wrapped in `with sync_playwright()` - the context manager's own
    # __exit__ can hit the same browser.close()-hangs issue finish() works
    # around. playwright/p is left for the OS to clean up on process exit.
    out_dir.mkdir(parents=True, exist_ok=True)
    p = sync_playwright().start()
    browser, page = open_page(p, url, timeout_ms)
    print("page loaded", flush=True)

    was_open = dismiss_getting_started(page)
    print(f"getting-started-modal was open on load: {was_open}", flush=True)

    page.click("#btn-analyze", timeout=timeout_ms)
    page.wait_for_selector("#btn-start-analyze", timeout=timeout_ms)
    print("new-recording panel open", flush=True)

    btn = page.query_selector("#btn-start-analyze")
    hint = page.query_selector("#start-analyze-hint")
    print(f"btn-start-analyze disabled: {btn.is_disabled() if btn else 'NOT FOUND'}", flush=True)
    print(f"start-analyze-hint text: {hint.inner_text() if hint else 'NOT FOUND'}", flush=True)

    shot = out_dir / "new_recording_panel.png"
    page.screenshot(path=str(shot))
    print(f"screenshot: {shot}", flush=True)
    print("DONE", flush=True)
    finish(0)  # see finish()'s docstring - must not attempt a clean teardown


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--out", default=str(Path(__file__).parent / "screenshots"))
    parser.add_argument("--timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS)
    args = parser.parse_args()
    try:
        run_example_flow(args.url, Path(args.out), args.timeout_ms)
    except Exception as exc:  # noqa: BLE001 - surface a clear failure, not a silent hang
        print(f"FAILED: {exc}", flush=True)
        sys.exit(1)
