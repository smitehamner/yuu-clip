r"""Regenerate the README screenshots from the live dev server.

Run it whenever the UI changes to refresh the images the README references -
the shot list below is the single place to add, remove, or reframe a shot.

Usage (via the wrapper):
    .\scripts\screenshots.ps1            # regenerate every shot
    .\scripts\screenshots.ps1 -List      # list shot names, capture nothing
    .\scripts\screenshots.ps1 -Only settings   # only shots whose file matches

Requires the dev server running on :8080 (yuu-dev serve) with at least
one analyzed recording that has clips. Images land in docs/screenshots/ at
stable filenames, so regenerating keeps the README links valid.
"""
from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, sync_playwright

LIVE_URL = "http://127.0.0.1:8080"
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "docs" / "screenshots"

# A fixed viewport keeps every shot the same size run to run; scale 2 renders
# at retina density so text stays crisp when GitHub downscales the image.
VIEWPORT = {"width": 1360, "height": 850}
DEVICE_SCALE_FACTOR = 2

# Seed the first-run "Getting Started" flag before boot.js runs, so the modal
# overlay never opens over a shot. Must be an init script (runs on every
# navigation), not a post-goto evaluate - see tests/conftest.py page fixture.
SEED_SEEN_FLAG = "try { localStorage.setItem('yuu-getting-started-seen', '1'); } catch (e) {}"


def _server_up() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 8080), timeout=1):
            return True
    except OSError:
        return False


def _select_recording_with_clips(page: Page) -> None:
    """Click the first non-segment recording that has clips (mirrors the UI tests)."""
    page.wait_for_selector("#video-list li[data-video-id]", timeout=15000)
    recordings = page.locator("#video-list li[data-video-id]")
    segment_ids = set(page.evaluate(
        "AppState.videos.filter(v => v.parent_video_id != null).map(v => v.id)"
    ))
    for index in range(recordings.count()):
        row = recordings.nth(index)
        if int(row.get_attribute("data-video-id")) in segment_ids:
            continue
        row.click()
        try:
            page.wait_for_selector("#clip-list li .clip-num", timeout=3000)
            return
        except PlaywrightError:
            continue
    raise RuntimeError(
        "No recording with clips found on the live server - analyze a recording first."
    )


def _shot_review(page: Page) -> None:
    _select_recording_with_clips(page)
    page.locator("#clip-list li:has(.clip-num)").first.click()
    page.wait_for_function(
        "() => AppState.activeClipData && AppState.activeClipData.id === AppState.activeClipId",
        timeout=5000,
    )
    page.wait_for_timeout(600)


def _shot_settings(page: Page) -> None:
    _select_recording_with_clips(page)
    page.evaluate("openSettings()")
    page.wait_for_selector("#settings-panel.visible", timeout=5000)
    page.wait_for_timeout(800)


def _shot_highlight_reels(page: Page) -> None:
    _select_recording_with_clips(page)
    page.evaluate("openHighlightReelsModal('build')")
    page.wait_for_selector("#highlight-reels-modal.visible", timeout=5000)
    page.wait_for_timeout(800)


# (filename, caption, prepare) - add or reorder here to change the README set.
SHOTS = [
    ("review.png",
     "Clip review: recordings sidebar, clip list, player, and per-clip scores",
     _shot_review),
    ("settings.png",
     "Settings: track layouts, scoring weights, and model configuration",
     _shot_settings),
    ("highlight-reels.png",
     "Highlight reels: compile approved clips into a single reel",
     _shot_highlight_reels),
]


def _capture(page: Page, filename: str, prepare) -> Path:
    page.goto(LIVE_URL, wait_until="domcontentloaded")
    prepare(page)
    out_path = OUTPUT_DIR / filename
    page.screenshot(path=str(out_path))
    return out_path


def _shutdown(browser, exit_code: int) -> None:
    """Close the browser, force-exiting if Playwright's close hangs.

    On Windows the sync driver can park forever waiting on a lost close reply
    (see tests/conftest.py _close_browser_unhang). This is a short-lived manual
    script, so a plain os._exit fallback with the real exit code is enough.
    """
    def _force_exit() -> None:
        import time
        time.sleep(6)
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(exit_code)

    threading.Thread(target=_force_exit, daemon=True).start()
    try:
        browser.close()
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="List shot names and exit")
    parser.add_argument("--only", metavar="NAME",
                        help="Capture only shots whose filename contains NAME")
    args = parser.parse_args()

    if args.list:
        for filename, caption, _ in SHOTS:
            print(f"  {filename:22} {caption}")
        return 0

    if not _server_up():
        print("ERROR: dev server not reachable on http://127.0.0.1:8080", file=sys.stderr)
        print("Start it with:  yuu-dev serve", file=sys.stderr)
        return 2

    shots = [s for s in SHOTS if not args.only or args.only in s[0]]
    if not shots:
        print(f"ERROR: no shot filename matched --only {args.only!r}", file=sys.stderr)
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    exit_code = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport=VIEWPORT, device_scale_factor=DEVICE_SCALE_FACTOR)
        context.add_init_script(SEED_SEEN_FLAG)
        page = context.new_page()
        page.set_default_timeout(10_000)
        page.set_default_navigation_timeout(30_000)
        try:
            for filename, _caption, prepare in shots:
                out_path = _capture(page, filename, prepare)
                print(f"  captured {out_path.relative_to(REPO_ROOT)}", flush=True)
        except Exception as exc:
            print(f"ERROR while capturing: {exc}", file=sys.stderr)
            exit_code = 1
        finally:
            _shutdown(browser, exit_code)

    if exit_code == 0:
        print(f"\n{len(shots)} screenshot(s) written to {OUTPUT_DIR.relative_to(REPO_ROOT)}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
