"""
Playwright UI tests — Settings panel: transcription language select.

The select's options are populated at panel-open time from
GET /api/config/whisper-languages (single-sourced from ALLOWED_WHISPER_LANGUAGES
in config.py) and rendered as English names via Intl.DisplayNames.

Read-only by design: saving whisper_language goes through PATCH /api/config,
which is covered by tests/test_config.py — clicking Save here would write the
live project's real config.json.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


@skip_no_server
class TestTranscriptionLanguageSelect:
    def _open_settings(self, page: Page) -> None:
        # Re-navigate so each test starts from a fresh page load (the fixture's
        # init script keeps the Getting Started modal from auto-opening).
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.querySelectorAll('#s-whisper-language option').length > 1",
            timeout=3000,
        )

    def test_first_option_is_auto_detect_with_empty_value(self, page: Page):
        self._open_settings(page)
        first = page.locator("#s-whisper-language option").first
        expect(first).to_have_text("Auto-detect (recommended)")
        assert first.get_attribute("value") == ""

    def test_options_populated_from_language_endpoint(self, page: Page):
        self._open_settings(page)
        option_count = page.locator("#s-whisper-language option").count()
        endpoint_count = page.evaluate(
            "() => fetch('/api/config/whisper-languages')"
            "  .then(r => r.json()).then(d => d.languages.length)"
        )
        assert option_count == endpoint_count + 1  # + Auto-detect

    def test_options_render_display_names_not_codes(self, page: Page):
        self._open_settings(page)
        values = page.eval_on_selector_all(
            "#s-whisper-language option",
            "els => els.map(e => [e.value, e.textContent])",
        )
        by_code = dict(values)
        assert by_code.get("en") == "English"
        assert by_code.get("de") == "German"

    def test_select_reflects_saved_config_value(self, page: Page):
        self._open_settings(page)
        saved = page.evaluate(
            "() => fetch('/api/config').then(r => r.json())"
            "  .then(d => d.whisper_language || '')"
        )
        assert page.locator("#s-whisper-language").input_value() == saved

    def test_changing_language_marks_settings_dirty(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#btn-settings-save")).to_be_disabled()
        current = page.locator("#s-whisper-language").input_value()
        page.select_option("#s-whisper-language", "de" if current != "de" else "fr")
        expect(page.locator("#btn-settings-save")).to_be_enabled()
        # Restore so the panel isn't left dirty for later tests.
        page.select_option("#s-whisper-language", current)
        expect(page.locator("#btn-settings-save")).to_be_disabled()


@skip_no_server
class TestSettingsPanelLayout:
    """Settings takes over the detail area as a fixed overlay but leaves the
    sidebar visible, and opening the Analyze panel closes settings (no overlap)."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)

    def test_sidebar_stays_visible_when_settings_open(self, page: Page):
        self._open_settings(page)
        expect(page.locator(".sidebar")).to_be_visible()
        # The main layout is no longer hidden — settings is an overlay, not fullscreen.
        display = page.evaluate(
            "getComputedStyle(document.getElementById('main-layout')).display"
        )
        assert display != "none"

    def test_opening_analyze_closes_settings(self, page: Page):
        self._open_settings(page)
        page.click("#btn-analyze")
        expect(page.locator("#settings-panel.visible")).to_have_count(0)
        expect(page.locator("#new-recording-panel")).to_be_visible()
