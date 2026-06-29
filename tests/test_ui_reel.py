"""
Playwright UI tests — highlight reel ("demo") modal.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from playwright.sync_api import Page, expect

from conftest import LIVE_URL, skip_no_server


@skip_no_server
class TestDemoModal:
    def _open_modal(self, page: Page) -> None:
        # openHighlightReelsModal() returns early if there are no approved clips; open directly
        page.evaluate("document.getElementById('highlight-reels-modal').classList.add('visible')")
        page.locator("#highlight-reels-modal").wait_for(state="visible")

    def test_opens_and_closes(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        expect(page.locator("#highlight-reels-modal")).to_be_visible()
        page.click("#highlight-reels-modal button:has-text('Cancel')")
        expect(page.locator("#highlight-reels-modal")).not_to_be_visible()

    def test_has_transition_options(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        options = page.locator("#demo-transition option")
        assert options.count() >= 4

    def test_has_output_name_field(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        # Field is present and accepts text; left blank means the server auto-generates a filename
        expect(page.locator("#demo-output-name")).to_be_visible()
        placeholder = page.locator("#demo-output-name").get_attribute("placeholder")
        assert placeholder is not None and ".mkv" in placeholder
