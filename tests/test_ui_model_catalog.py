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

import json

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


@skip_no_server
class TestModelPrefetchUI:
    """packaging-strategy overhaul Wave 4 — the "Download now" flow shared by
    every non-LLM Tier-B model (speaker/audio-event/embeddings). Both
    /api/capabilities/tiers and /api/models/prefetch are route-mocked so no
    real download runs; the tiers route is stateful (not-ready, then ready)
    to mirror the real backend flipping state once the model is cached."""

    def _tier_body(self, *, ready: bool, tier_id: str, prefetch_slug: str) -> str:
        return json.dumps({
            "lightweight": False,
            "tiers": [{
                "id": tier_id, "name": "Speaker labels", "purpose": "Identifies speakers.",
                "active": "SpeechBrain", "upgrade": "Bundled by default.",
                "ready": ready,
                "detail": "Ready." if ready else "Downloads automatically the first time you run Detect Speakers.",
                "install_slug": None,
                "prefetch_slug": None if ready else prefetch_slug,
                "section": "settings-sec-speakers",
            }],
        })

    def _open_with_prefetchable_tier(
        self, page: Page, *, tier_id: str = "speaker_labels", prefetch_slug: str = "speaker",
    ) -> dict:
        calls = {"n": 0}

        def _handle(route):
            calls["n"] += 1
            ready = calls["n"] > 1  # first render: not cached; after a refresh: cached
            route.fulfill(
                content_type="application/json",
                body=self._tier_body(ready=ready, tier_id=tier_id, prefetch_slug=prefetch_slug),
            )

        page.route("**/api/capabilities/tiers", _handle)
        _open_settings(page)
        return calls

    def test_not_cached_tier_shows_download_now_button(self, page: Page):
        self._open_with_prefetchable_tier(page)
        btn = page.locator('[data-prefetch="speaker"]')
        assert btn.count() == 1
        assert btn.inner_text() == "Download now"

    def test_successful_prefetch_flips_tier_to_ready(self, page: Page):
        self._open_with_prefetchable_tier(page)
        sse_body = 'data: "Downloading the speaker model (~80 MB)..."\n\ndata: "__DONE__"\n\n'
        page.route(
            "**/api/models/prefetch*",
            lambda route: route.fulfill(status=200, content_type="text/event-stream", body=sse_body),
        )
        page.click('[data-prefetch="speaker"]')
        # The tiers list re-fetches and re-renders on __DONE__ — wait for the
        # button to disappear (tier is now reported ready) rather than racing
        # the transient "Ready." log line the re-render immediately replaces.
        page.wait_for_function('document.querySelector(\'[data-prefetch="speaker"]\') === null', timeout=3000)
        assert page.locator(".capability-mark.ready").count() == 1

    def test_prefetch_failure_shows_error_and_resets_button(self, page: Page):
        self._open_with_prefetchable_tier(page)
        page.route(
            "**/api/models/prefetch*",
            lambda route: route.fulfill(
                status=400, content_type="application/json",
                body='{"detail":"Unknown model slug \'speaker\'"}',
            ),
        )
        page.click('[data-prefetch="speaker"]')
        page.wait_for_function(
            "document.getElementById('cap-prefetch-log-speaker_labels')"
            ".textContent.includes('Unknown model slug')",
            timeout=3000,
        )
        btn = page.locator('[data-prefetch="speaker"]')
        assert btn.inner_text() == "Download now"
        assert btn.is_enabled()
        # The cancel control (provisioned while the request was in flight) is
        # hidden again once the stream ends — the tier row itself is not
        # re-rendered on failure, so unlike the success path this element stays.
        assert page.locator("#cap-prefetch-cancel-speaker_labels").count() == 1
        assert not page.locator("#cap-prefetch-cancel-speaker_labels").is_visible()

    def test_cancel_control_appears_while_download_is_in_flight(self, page: Page):
        self._open_with_prefetchable_tier(page)

        # Hold the route unfulfilled (rather than sleeping in the handler,
        # which blocks Playwright's sync-API driver thread and would make the
        # request appear to resolve instantly from the test's perspective) so
        # the request is genuinely still pending while we check the button.
        pending: dict = {}
        page.route("**/api/models/prefetch*", lambda route: pending.setdefault("route", route))
        page.click('[data-prefetch="speaker"]')
        page.wait_for_selector("#cap-prefetch-cancel-speaker_labels", state="visible", timeout=2000)
        pending["route"].fulfill(status=200, content_type="text/event-stream", body='data: "__DONE__"\n\n')
