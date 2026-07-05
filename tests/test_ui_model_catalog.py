"""
Playwright UI tests — Settings → LLM scoring model catalog + capability gating.

Covers plan 10: the Claude model dropdown and the per-backend "recommended
models" lists are populated from GET /api/llm/catalog at panel-open time, and
gateOnCapability() disables a control with a linked explanation when the active
model lacks the needed capability (the pattern plan 11's image controls use).

Read-only against the live dev server on port 8080 — no Save is clicked.
/api/llm/capabilities is an on-demand endpoint, so it is route-mocked after
goto, right before the interaction that reads it. See tests/conftest.py.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page


def _open_settings(page: Page) -> None:
    page.goto(LIVE_URL)
    page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
    page.click("#btn-settings-header")
    page.wait_for_selector("#settings-panel.visible", timeout=3000)
    # #s-paths-display is populated last (after _applySettingsToUI), so waiting
    # on it means the async catalog load has also settled.
    page.wait_for_function(
        "document.getElementById('s-paths-display').textContent.trim().length > 0",
        timeout=3000,
    )


@skip_no_server
class TestModelCatalogSettings:
    def test_claude_dropdown_populated_from_catalog(self, page: Page):
        _open_settings(page)
        values = page.eval_on_selector_all(
            "#s-claude-model option", "els => els.map(e => e.value)"
        )
        assert "claude-opus-4-8" in values
        assert "claude-sonnet-5" in values
        # The stale model that used to be hardcoded must be gone.
        assert "claude-sonnet-4-6" not in values

    def test_llamacpp_recommended_list_renders_cards(self, page: Page):
        _open_settings(page)
        count = page.locator("#s-llamacpp-recommended .rec-model").count()
        assert count >= 1
        # Each card exposes a download link (llamacpp entries carry a gguf_url).
        assert page.locator("#s-llamacpp-recommended .rec-model a").count() >= 1

    def test_ollama_recommended_list_has_pull_and_use_buttons(self, page: Page):
        _open_settings(page)
        card = page.locator("#s-ollama-recommended .rec-model").first
        assert card.locator("[data-act='use']").count() == 1
        assert card.locator("[data-act='pull']").count() == 1


@skip_no_server
class TestCapabilityGating:
    def _gate_result(self, page: Page, capability: str) -> dict:
        return page.evaluate(
            """async (cap) => {
                const btn = document.createElement('button');
                const wrap = document.createElement('div');
                wrap.appendChild(btn);
                document.body.appendChild(wrap);
                await window.gateOnCapability(btn, cap, 'This needs a vision model.');
                const note = wrap.querySelector('.gate-note');
                return {
                    disabled: btn.disabled,
                    hasNote: !!note,
                    hasLink: !!(note && note.querySelector('a')),
                };
            }""",
            capability,
        )

    def test_missing_capability_disables_and_explains(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.route(
            "**/api/llm/capabilities",
            lambda route: route.fulfill(
                content_type="application/json",
                body='{"backend":"ollama","model":"x","text":true,"vision":false,"detail":"no vision"}',
            ),
        )
        result = self._gate_result(page, "vision")
        assert result == {"disabled": True, "hasNote": True, "hasLink": True}

    def test_present_capability_enables_and_clears_note(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.route(
            "**/api/llm/capabilities",
            lambda route: route.fulfill(
                content_type="application/json",
                body='{"backend":"claude","model":"x","text":true,"vision":true,"detail":"ok"}',
            ),
        )
        result = self._gate_result(page, "vision")
        assert result == {"disabled": False, "hasNote": False, "hasLink": False}
