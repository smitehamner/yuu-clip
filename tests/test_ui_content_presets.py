"""
Playwright UI tests — Settings → Scoring weights → Content type (plan 12).

The preset select and info line render from the live GET /api/content-presets at
panel-open time (read-only, no mock). The Apply flow is exercised against a
route-mocked POST so the test never mutates the real project's config or hot-words;
the mock is registered after goto, right before the interaction. See conftest.py.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page


def _open_settings(page: Page) -> None:
    page.goto(LIVE_URL)
    page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
    page.click("#btn-settings-header")
    page.wait_for_selector("#settings-panel.visible", timeout=3000)
    page.wait_for_function(
        "document.getElementById('s-paths-display').textContent.trim().length > 0",
        timeout=3000,
    )


@skip_no_server
class TestContentPresetSettings:
    def test_select_populated_and_active_shown(self, page: Page):
        _open_settings(page)
        values = page.eval_on_selector_all(
            "#s-content-preset option", "els => els.map(e => e.value)"
        )
        assert "generic" in values
        assert "competitive" in values
        assert page.locator("#s-content-preset-active").inner_text().startswith("Currently active:")

    def test_description_updates_on_change(self, page: Page):
        _open_settings(page)
        page.select_option("#s-content-preset", "speedrun")
        desc = page.locator("#s-content-preset-desc").inner_text()
        assert desc.strip()
        assert "clock" in desc.lower() or "run" in desc.lower()

    def test_apply_confirms_then_updates_weight_sliders(self, page: Page):
        _open_settings(page)
        page.route(
            "**/api/content-presets/apply",
            lambda route: route.fulfill(
                content_type="application/json",
                body=(
                    '{"applied":"competitive","hotwords_added":0,'
                    '"weights":{"score_funny_weight":1.0,"score_dramatic_weight":1.1,'
                    '"score_action_weight":1.8,"scorer_laugh_weight":1.4}}'
                ),
            ),
        )
        page.select_option("#s-content-preset", "competitive")
        # Don't add hot-words in the test even though the box defaults on.
        page.uncheck("#s-content-preset-hotwords")
        page.click("#btn-apply-content-preset")
        page.wait_for_selector("#confirm-modal.visible", timeout=3000)
        assert "Action 1.8" in page.locator("#confirm-body").inner_text()
        page.click("#confirm-ok-btn")
        page.wait_for_function(
            "document.getElementById('s-action-weight').value === '1.8'", timeout=3000
        )
        assert page.locator("#s-action-weight-val").inner_text() == "1.8"
        assert page.locator("#s-laugh-weight").input_value() == "1.4"

    def test_applied_weights_do_not_flag_settings_dirty(self, page: Page):
        _open_settings(page)
        page.route(
            "**/api/content-presets/apply",
            lambda route: route.fulfill(
                content_type="application/json",
                body=(
                    '{"applied":"competitive","hotwords_added":0,'
                    '"weights":{"score_funny_weight":1.0,"score_dramatic_weight":1.1,'
                    '"score_action_weight":1.8,"scorer_laugh_weight":1.4}}'
                ),
            ),
        )
        page.select_option("#s-content-preset", "competitive")
        page.uncheck("#s-content-preset-hotwords")
        page.click("#btn-apply-content-preset")
        page.wait_for_selector("#confirm-modal.visible", timeout=3000)
        page.click("#confirm-ok-btn")
        page.wait_for_function(
            "document.getElementById('s-action-weight').value === '1.8'", timeout=3000
        )
        # The preset already saved server-side; the Save button must stay disabled
        # (weights were rebaselined) so closing won't prompt "discard changes?".
        assert page.locator("#btn-settings-save").is_disabled()
