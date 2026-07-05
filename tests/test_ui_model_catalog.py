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
class TestOllamaPullUI:
    """Stage 08 — the one-click pull surfaces a disk-precheck failure and a
    cancel control. The pull endpoint is route-mocked so no real Ollama runs."""

    def _pull(self, page: Page, tag: str = "qwen2.5:7b") -> str:
        return page.evaluate(
            "async (tag) => { await window.pullOllamaModel(tag); "
            "return document.getElementById('ollama-pull-log').textContent; }",
            tag,
        )

    def test_precheck_failure_shows_actionable_message(self, page: Page):
        _open_settings(page)
        page.route(
            "**/api/llm/ollama/pull*",
            lambda route: route.fulfill(
                status=507,
                content_type="application/json",
                body='{"detail":"Not enough disk space: about 6.7 GB is needed but only 1.0 GB is free. Free up space and try again."}',
            ),
        )
        log = self._pull(page)
        assert "Not enough disk space" in log
        assert "Free up space" in log

    def test_successful_pull_shows_done_and_provisions_cancel_control(self, page: Page):
        _open_settings(page)
        sse_body = 'data: "pulling manifest"\n\ndata: "__DONE__"\n\n'
        page.route(
            "**/api/llm/ollama/pull*",
            lambda route: route.fulfill(
                status=200, content_type="text/event-stream", body=sse_body,
            ),
        )
        log = self._pull(page)
        assert "✓ Done" in log
        # A cancel control is provisioned for the pull (hidden again once done).
        assert page.locator("#ollama-pull-cancel").count() == 1


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
