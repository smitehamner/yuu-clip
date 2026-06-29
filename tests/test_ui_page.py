"""
Playwright UI tests — page load and sidebar.

Run against the live dev server on port 8080. Skipped automatically if the
server is not reachable. See tests/conftest.py for the shared helpers.
"""
from __future__ import annotations

from playwright.sync_api import Page, expect

from conftest import LIVE_URL, skip_no_server


@skip_no_server
class TestPageLoad:
    def test_title(self, page: Page):
        page.goto(LIVE_URL)
        expect(page).to_have_title("yuu-clip")

    def test_header_buttons_visible(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("button#btn-analyze")).to_be_visible()
        expect(page.locator("button#btn-highlight-reels")).to_be_visible()

    def test_sidebar_has_videos(self, page: Page):
        page.goto(LIVE_URL)
        # Wait for video list to populate
        page.wait_for_selector("#video-list li", timeout=5000)
        items = page.locator("#video-list li")
        assert items.count() > 0

    def test_sidebar_has_no_clip_selected_message(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#no-clip-selected, .detail-empty")).to_be_visible()
