"""
Playwright UI tests - Settings → LLM scoring model catalog + capability gating.

Covers plan 10: the Claude model dropdown and the per-backend "recommended
models" lists are populated from GET /api/llm/catalog at panel-open time, and
gateOnCapability() disables a control with a linked explanation when the active
model lacks the needed capability (the pattern plan 11's image controls use).

Read-only against the live dev server on port 8080 - no Save is clicked.
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
                body='{"backend":"llamacpp","model":"x","text":true,"vision":false,"detail":"no vision"}',
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
    """packaging-strategy overhaul Wave 4 - the "Download now" flow shared by
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
        # The tiers list re-fetches and re-renders on __DONE__ - wait for the
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
        # hidden again once the stream ends - the tier row itself is not
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


# ── Stage 7: Settings model management (grouping, active state, browse, vision) ──

def _model(**overrides) -> dict:
    """A catalog entry dict shaped like /api/llm/catalog's enriched output."""
    base = {
        "id": "m", "display_name": "A Model", "kinds": ["text"], "licence": "Apache-2.0",
        "why": "why", "backends": ["llamacpp"], "size_gb": 4.7,
        "gguf_url": "https://huggingface.co/x/y", "gguf_filename": "a.gguf",
        "mmproj_url": None, "mmproj_filename": None, "api_model_id": None,
        "recommended": True, "rejected_reason": None,
        "installed": False, "active": False, "gguf_path": "/models/a.gguf", "mmproj_path": None,
    }
    base.update(overrides)
    return base


def _catalog_body(models: list[dict], backend: str = "llamacpp") -> str:
    return json.dumps({"backend": backend, "models_dir": "/models", "free_gb": 42.0, "models": models})


@skip_no_server
class TestModelGrouping:
    """Stage 7: text and vision models render as two labelled groups, not one
    flat list; each card shows the active/downloaded state the backend reports."""

    def _open_with_catalog(self, page: Page, models: list[dict], backend: str = "llamacpp") -> None:
        page.route("**/api/llm/catalog", lambda route: route.fulfill(
            content_type="application/json", body=_catalog_body(models, backend)))
        _open_settings(page)

    def test_text_and_vision_render_as_separate_groups(self, page: Page):
        self._open_with_catalog(page, [
            _model(id="txt", display_name="Text One", kinds=["text"]),
            _model(id="vis", display_name="Vision One", kinds=["vision"],
                   gguf_filename="v.gguf", mmproj_filename="v-mmproj.gguf"),
        ])
        titles = page.eval_on_selector_all(
            "#s-llamacpp-recommended .rec-model-group-title", "els => els.map(e => e.textContent)")
        assert "Text scoring models" in titles
        assert "Image analysis (vision) models" in titles

    def test_active_model_shows_active_badge_and_summary(self, page: Page):
        self._open_with_catalog(page, [
            _model(id="txt", display_name="Active Text", active=True, installed=True),
        ])
        assert page.locator("#s-llamacpp-recommended .rec-model.active .rec-model-badge.active").count() == 1
        summary = page.locator("#s-llm-current-summary")
        assert summary.is_visible()
        assert "Active Text" in summary.inner_text()

    def test_installed_but_inactive_model_offers_use_this(self, page: Page):
        self._open_with_catalog(page, [_model(installed=True, active=False)])
        assert page.locator("#s-llamacpp-recommended [data-act='use-gguf']").count() == 1
        assert page.locator("#s-llamacpp-recommended [data-act='download-gguf']").count() == 0

    def test_missing_model_offers_download_now(self, page: Page):
        self._open_with_catalog(page, [_model(installed=False, active=False)])
        assert page.locator("#s-llamacpp-recommended [data-act='download-gguf']").count() == 1


@skip_no_server
class TestGgufUseRouting:
    """The llamacpp backend also has two independent path fields - llm_model_path
    (text) and llm_vision_model_path + llm_mmproj_path (vision). Clicking "Use
    this model" on an already-installed card must fill the field matching the
    card's kind, never the other (per-function-llm-models plan)."""

    def _clear_fields(self, page: Page) -> None:
        page.eval_on_selector("#s-llm-model-path", "el => el.value = ''")
        page.eval_on_selector("#s-llm-vision-model-path", "el => el.value = ''")
        page.eval_on_selector("#s-llm-mmproj-path", "el => el.value = ''")

    def test_vision_card_fills_vision_and_mmproj_not_text(self, page: Page):
        models = [_model(
            id="vis", display_name="Vision One", kinds=["vision"],
            gguf_filename="v.gguf", gguf_path="/models/v.gguf",
            mmproj_filename="v-mmproj.gguf", mmproj_path="/models/v-mmproj.gguf",
            installed=True, active=False,
        )]
        page.route("**/api/llm/catalog", lambda route: route.fulfill(
            content_type="application/json", body=_catalog_body(models)))
        _open_settings(page)
        self._clear_fields(page)
        page.click("#s-llamacpp-recommended [data-act='use-gguf']")
        assert page.eval_on_selector("#s-llm-vision-model-path", "el => el.value") == "/models/v.gguf"
        assert page.eval_on_selector("#s-llm-mmproj-path", "el => el.value") == "/models/v-mmproj.gguf"
        assert page.eval_on_selector("#s-llm-model-path", "el => el.value") == ""

    def test_text_card_fills_text_not_vision(self, page: Page):
        models = [_model(
            id="txt", display_name="Text One", kinds=["text"],
            gguf_filename="t.gguf", gguf_path="/models/t.gguf",
            installed=True, active=False,
        )]
        page.route("**/api/llm/catalog", lambda route: route.fulfill(
            content_type="application/json", body=_catalog_body(models)))
        _open_settings(page)
        self._clear_fields(page)
        page.click("#s-llamacpp-recommended [data-act='use-gguf']")
        assert page.eval_on_selector("#s-llm-model-path", "el => el.value") == "/models/t.gguf"
        assert page.eval_on_selector("#s-llm-vision-model-path", "el => el.value") == ""


@skip_no_server
class TestGgufDownloadUI:
    """Stage 7: the one-click .gguf download drives a determinate bar and, on
    completion, fills the (advanced) path fields so a Save activates the model.
    The download endpoint is stubbed so no real multi-GB fetch runs."""

    def test_successful_download_fills_path_and_shows_done(self, page: Page):
        models = [_model(id="txt", gguf_filename="a.gguf", gguf_path="/models/a.gguf")]
        page.route("**/api/llm/catalog", lambda route: route.fulfill(
            content_type="application/json", body=_catalog_body(models)))
        _open_settings(page)
        sse_body = 'data: "Downloading A Model - a.gguf: 50% (2.3/4.7 GB)"\n\ndata: "__DONE__"\n\n'
        page.route("**/api/llm/gguf/download*", lambda route: route.fulfill(
            status=200, content_type="text/event-stream", body=sse_body))
        page.click("#s-llamacpp-recommended [data-act='download-gguf']")
        page.wait_for_function(
            "document.querySelector('#s-llm-model-path').value === '/models/a.gguf'", timeout=3000)
        log = page.locator("#s-llamacpp-recommended [data-gguf-log]").inner_text()
        assert "Done" in log


@skip_no_server
class TestModelBrowseButton:
    """Stage 7: a native Browse button appears beside each path field only when
    the Electron bridge exposes pickModelFile; browser-only mode keeps the text
    box as the fallback (button stays hidden)."""

    def test_browse_hidden_without_electron_bridge(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        display = page.eval_on_selector("#btn-browse-llm-model", "el => el.style.display")
        assert display == "none"

    def test_browse_shown_and_sets_path_with_electron_bridge(self, page: Page):
        page.add_init_script(
            "window.electronAPI = { pickModelFile: async () => 'C:/picked/model.gguf' };")
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        assert page.eval_on_selector("#btn-browse-llm-model", "el => el.style.display") == ""
        page.eval_on_selector("#btn-browse-llm-model", "el => el.click()")
        page.wait_for_function(
            "document.querySelector('#s-llm-model-path').value === 'C:/picked/model.gguf'", timeout=3000)
