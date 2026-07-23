"""
Smoke backstop - a small, fast, high-signal set covering the core surfaces
(page load, sidebar, clip open + detail, settings, export). It runs on every
targeted `yuu-dev test-ui --changed` regardless of what changed, so a broad break
in a shared file (utils.js, the app shell) is caught even when no feature test
maps to the edit.

Deliberately reuses the proven conftest helpers rather than novel selectors so
the backstop itself stays robust. Keep it small - this is a "is the app
fundamentally working?" check, not feature coverage. Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for the shared helpers.
"""
from __future__ import annotations

from conftest import (
    LIVE_URL,
    select_first_video_and_clip,
    select_video_with_clips,
    skip_no_server,
)
from playwright.sync_api import Page, expect


@skip_no_server
class TestSmoke:
    def test_page_loads_with_title(self, page: Page):
        page.goto(LIVE_URL)
        expect(page).to_have_title("YuuClip")

    def test_header_actions_present(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("button#btn-analyze")).to_be_visible()
        expect(page.locator("button#btn-highlight-reels")).to_be_visible()

    def test_sidebar_lists_a_video_with_clips(self, page: Page):
        select_video_with_clips(page)
        expect(page.locator("#clip-list li .clip-num").first).to_be_visible()

    def test_clip_opens_and_renders_detail(self, page: Page):
        select_first_video_and_clip(page)
        assert page.evaluate("() => AppState.activeClipData?.id") is not None
        expect(page.locator("#detail .clip-badge").first).to_be_visible()

    def test_settings_panel_opens(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        expect(page.locator("#btn-settings-save")).to_be_visible()

    def test_export_modal_opens_for_a_clip(self, page: Page):
        select_first_video_and_clip(page)
        page.click(".op-actions [data-act='export-clip']")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)
