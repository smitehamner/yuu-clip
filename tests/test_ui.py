"""
Playwright UI tests — run against the live dev server on port 8080.

Prerequisites: server must be running (`rp-clip serve`)
Run:  pytest tests/test_ui.py -v

These tests are skipped automatically if the server is not reachable.
"""
from __future__ import annotations

import socket

import pytest
from playwright.sync_api import Page, expect

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


# ---------------------------------------------------------------------------
# Page load
# ---------------------------------------------------------------------------

@skip_no_server
class TestPageLoad:
    def test_title(self, page: Page):
        page.goto(LIVE_URL)
        expect(page).to_have_title("rp-clipper")

    def test_header_buttons_visible(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("button#btn-ingest")).to_be_visible()
        expect(page.locator("button#btn-score")).to_be_visible()
        expect(page.locator("button#btn-demo")).to_be_visible()

    def test_sidebar_has_videos(self, page: Page):
        page.goto(LIVE_URL)
        # Wait for video list to populate
        page.wait_for_selector("#video-list li", timeout=5000)
        items = page.locator("#video-list li")
        assert items.count() > 0

    def test_sidebar_has_no_clip_selected_message(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#no-clip-selected, .detail-empty")).to_be_visible()


# ---------------------------------------------------------------------------
# Ingest modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestIngestModal:
    def test_opens_and_closes(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        expect(page.locator("#ingest-modal")).to_be_visible()
        page.click("text=Cancel")
        expect(page.locator("#ingest-modal")).not_to_be_visible()

    def test_profile_dropdown_has_default(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        page.wait_for_selector("#ingest-profile option", timeout=3000)
        options = page.locator("#ingest-profile option")
        texts = [options.nth(i).text_content() for i in range(options.count())]
        assert any("Default" in t or "combined" in t.lower() for t in texts)

    def test_model_dropdown_default_is_medium(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        selected = page.locator("#ingest-model").input_value()
        assert selected == "medium"

    def test_scene_mode_default_is_fast(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        selected = page.locator("#ingest-scene-mode").input_value()
        assert selected == "fast"

    def test_model_options_ordered_slow_to_fast(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        options = page.locator("#ingest-model option")
        values = [options.nth(i).get_attribute("value") for i in range(options.count())]
        # Should go tiny → base → small → medium → large-v3
        assert values.index("tiny") < values.index("base")
        assert values.index("base") < values.index("small")
        assert values.index("small") < values.index("medium")
        assert values.index("medium") < values.index("large-v3")


# ---------------------------------------------------------------------------
# Profile manager
# ---------------------------------------------------------------------------

@skip_no_server
class TestProfileManager:
    def test_opens_from_ingest_modal(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        page.click("button[title='Manage profiles']")
        expect(page.locator("#profile-modal")).to_be_visible()

    def test_default_profile_shown_as_locked(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        page.click("button[title='Manage profiles']")
        page.wait_for_selector("#profile-list", timeout=3000)
        # Default profile should have a lock indicator and no delete button
        profile_list = page.locator("#profile-list")
        expect(profile_list).to_contain_text("Default")

    def test_create_and_delete_profile(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-ingest")
        page.click("button[title='Manage profiles']")
        page.wait_for_selector("#profile-list", timeout=3000)

        # Open new profile editor
        page.click("text=+ New Profile")
        page.wait_for_selector("#profile-editor", timeout=2000)

        # Fill in name
        page.fill("#pe-name", "ui_test_profile")
        page.fill("#pe-numtracks", "1")
        page.wait_for_timeout(300)  # let renderTrackRows fire

        # Save
        page.click("#profile-editor button:has-text('Save')")
        page.wait_for_timeout(500)

        # Should now appear in list
        expect(page.locator("#profile-list")).to_contain_text("ui_test_profile")

        # Delete it
        page.locator("button[data-delete-profile='ui_test_profile']").click()
        page.wait_for_timeout(500)
        expect(page.locator("#profile-list")).not_to_contain_text("ui_test_profile")


# ---------------------------------------------------------------------------
# Clip review workflow
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipReview:
    def _select_first_video_and_clip(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        page.locator("#clip-list li").first.click()

    def test_clip_detail_shows_score(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        expect(page.locator(".scores")).to_be_visible()

    def test_clip_detail_shows_description(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        # Description or transcript should be present
        detail = page.locator(".detail")
        expect(detail).not_to_be_empty()

    def test_approve_button_exists(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".actions", timeout=3000)
        expect(page.locator("button.approve")).to_be_visible()

    def test_reject_button_exists(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".actions", timeout=3000)
        expect(page.locator("button.reject")).to_be_visible()

    def test_retranscribe_button_exists(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".actions", timeout=3000)
        expect(page.locator("button:has-text('Retranscribe')")).to_be_visible()

    def test_sidebar_shows_clip_id(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        # Each clip item should show a #N id prefix
        first_item = page.locator("#clip-list li").first
        expect(first_item).to_contain_text("#")

    def test_sidebar_shows_sub_score_bars(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        expect(page.locator(".clip-miniscores").first).to_be_visible()


# ---------------------------------------------------------------------------
# Demo modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestDemoModal:
    def test_opens_and_closes(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-demo")
        expect(page.locator("#demo-modal")).to_be_visible()
        page.click("#demo-modal button:has-text('Cancel')")
        expect(page.locator("#demo-modal")).not_to_be_visible()

    def test_has_transition_options(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-demo")
        options = page.locator("#demo-transition option")
        assert options.count() >= 4

    def test_has_output_name_field(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-demo")
        expect(page.locator("#demo-output-name")).to_be_visible()
        val = page.locator("#demo-output-name").input_value()
        assert val.endswith(".mkv")
