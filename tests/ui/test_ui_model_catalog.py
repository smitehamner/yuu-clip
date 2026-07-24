"""
Playwright UI tests - Settings → LLM scoring model catalog + capability gating.

Covers plan 10: the Claude model dropdown and the per-backend "recommended
models" lists are populated from GET /api/llm/catalog at panel-open time, and
gateOnCapability() disables a control with a linked explanation when the active
model lacks the needed capability (the pattern plan 11's image controls use).

Read-only against the live fixture server yuu-dev test-ui spawns - no Save is clicked.
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
        sse_body = (
            'data: {"v": 1, "type": "log", "text": "Downloading the speaker model (~80 MB)...", "level": "info"}\n\n'
            'data: {"v": 1, "type": "done", "outcome": "ok"}\n\n'
        )
        page.route(
            "**/api/models/prefetch*",
            lambda route: route.fulfill(status=200, content_type="text/event-stream", body=sse_body),
        )
        page.click('[data-prefetch="speaker"]')
        # The tiers list re-fetches and re-renders on the terminal done event - wait for
        # the button to disappear (tier is now reported ready) rather than racing
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
        pending["route"].fulfill(
            status=200, content_type="text/event-stream",
            body='data: {"v": 1, "type": "done", "outcome": "ok"}\n\n')


# ── Stage 7: Settings model management (grouping, active state, browse, vision) ──

def _model(**overrides) -> dict:
    """A catalog entry dict shaped like /api/llm/catalog's enriched output."""
    base = {
        "id": "m", "display_name": "A Model", "kinds": ["text"], "licence": "Apache-2.0",
        "why": "why", "backends": ["llamacpp"], "size_gb": 4.7,
        "gguf_url": "https://huggingface.co/x/y", "gguf_filename": "a.gguf",
        "mmproj_url": None, "mmproj_filename": None,
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

    def test_active_but_missing_file_shows_missing_badge_and_redownload(self, page: Page):
        # The config still points at this model but its backing file is gone: it must
        # surface as a recoverable "File missing" state with a re-download, not a plain
        # "Active" badge + inert "in use" note (the confusing state from the VM run).
        self._open_with_catalog(page, [
            _model(id="txt", display_name="Broken Text", active=True, installed=False),
        ])
        assert page.locator("#s-llamacpp-recommended .rec-model-badge.missing").count() == 1
        assert page.locator("#s-llamacpp-recommended .rec-model-badge.active").count() == 0
        assert page.locator("#s-llamacpp-recommended [data-act='download-gguf']").count() == 1
        summary = page.locator("#s-llm-current-summary")
        assert "file missing" in summary.inner_text().lower()


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


def _route_download_status_idle(page: Page) -> None:
    """A download-status body reporting nothing in flight - consulted on every
    catalog render (the re-attach signal), so it must be stubbed for determinism."""
    page.route("**/api/llm/download-status", lambda route: route.fulfill(
        content_type="application/json",
        body='{"downloading":false,"downloading_model_id":null,"whisper_downloading":false,'
             '"speaker_downloading":false,"whisper_cached":true,"speaker_cached":true,'
             '"speaker_available":true,"pending_model_id":""}'))


@skip_no_server
class TestGgufDownloadUI:
    """W3/B6: the one-click .gguf download's progress lives in module state, not the
    card DOM, so it survives a Save/re-render; on completion the server has already
    persisted the model path, so we reload config and the model is active with NO
    Save. The download endpoint is stubbed so no real multi-GB fetch runs."""

    def _route_catalog_activating(self, page: Page) -> None:
        """Catalog reports the model missing first, then active after the post-
        download refresh - mirroring the backend flipping state once it is set."""
        calls = {"n": 0}

        def _handle(route):
            calls["n"] += 1
            active = calls["n"] > 1
            models = [_model(
                id="txt", gguf_filename="a.gguf", gguf_path="/models/a.gguf",
                installed=active, active=active,
            )]
            route.fulfill(content_type="application/json", body=_catalog_body(models))

        page.route("**/api/llm/catalog", _handle)

    def test_successful_download_activates_without_save(self, page: Page):
        self._route_catalog_activating(page)
        _route_download_status_idle(page)
        cleared = {"n": 0}
        page.route("**/api/llm/download-status/clear", lambda route: (
            cleared.__setitem__("n", cleared["n"] + 1),
            route.fulfill(content_type="application/json",
                          body='{"pending_model_id":"","downloading":false}'),
        )[-1])
        _open_settings(page)
        sse_body = (
            'data: {"v": 1, "type": "log", "text": "Downloading A Model - a.gguf: 50% (2.3/4.7 GB)", "level": "info"}\n\n'
            'data: {"v": 1, "type": "done", "outcome": "ok"}\n\n'
        )
        page.route("**/api/llm/gguf/download*", lambda route: route.fulfill(
            status=200, content_type="text/event-stream", body=sse_body))
        page.click("#s-llamacpp-recommended [data-act='download-gguf']")
        # The advanced path field is filled (so a later Save can't clobber it)...
        page.wait_for_function(
            "document.querySelector('#s-llm-model-path').value === '/models/a.gguf'", timeout=3000)
        # ...the card flips to the active state (download button gone)...
        page.wait_for_selector("#s-llamacpp-recommended .rec-model.active", timeout=3000)
        assert page.locator("#s-llamacpp-recommended [data-act='download-gguf']").count() == 0
        # ...and the running server's config was reloaded (no Save needed): the
        # active card is only rendered after that reload completes.
        assert cleared["n"] == 1

    def test_progress_survives_catalog_rerender(self, page: Page):
        models = [_model(id="txt", gguf_filename="a.gguf", gguf_path="/models/a.gguf")]
        page.route("**/api/llm/catalog", lambda route: route.fulfill(
            content_type="application/json", body=_catalog_body(models)))
        _route_download_status_idle(page)
        _open_settings(page)
        # Hold the download open so it stays in flight across the re-render.
        pending: dict = {}
        page.route("**/api/llm/gguf/download*", lambda route: pending.setdefault("route", route))
        page.click("#s-llamacpp-recommended [data-act='download-gguf']")
        page.wait_for_selector("#s-llamacpp-recommended [data-gguf-cancel]", state="visible", timeout=3000)
        # A catalog re-render (what a Save does) rebuilds the cards. The in-flight
        # download must re-attach its progress + Cancel to the new card, not vanish.
        page.evaluate("window.refreshModelCatalog()")
        page.wait_for_selector("#s-llamacpp-recommended [data-gguf-cancel]", state="visible", timeout=3000)
        assert page.locator("#s-llamacpp-recommended [data-act='download-gguf']").is_disabled()
        pending["route"].fulfill(
            status=200, content_type="text/event-stream",
            body='data: {"v": 1, "type": "done", "outcome": "ok"}\n\n')

    def test_text_download_and_whisper_banner_show_together(self, page: Page):
        # Goal: a text (.gguf card) download and a voice/whisper (banner) download
        # render progress at the same time - they are separate DOM regions and
        # separate server download keys, so neither serializes the other.
        page.route("**/api/config", lambda route: route.fulfill(
            content_type="application/json",
            body='{"model_prefetch_disabled":false,"whisper_model":"base"}'))
        page.route("**/api/llm/download-status", lambda route: route.fulfill(
            content_type="application/json",
            body='{"downloading":false,"downloading_model_id":null,"whisper_downloading":false,'
                 '"speaker_downloading":false,"whisper_cached":false,"speaker_cached":true,'
                 '"speaker_available":true,"pending_model_id":""}'))
        models = [_model(id="txt", gguf_filename="a.gguf", gguf_path="/models/a.gguf")]
        page.route("**/api/llm/catalog", lambda route: route.fulfill(
            content_type="application/json", body=_catalog_body(models)))
        whisper_pending: list = []
        page.route("**/api/whisper/prefetch", lambda route: whisper_pending.append(route))
        gguf_pending: dict = {}
        page.route("**/api/llm/gguf/download*", lambda route: gguf_pending.setdefault("route", route))
        # Boot runs initModelPrefetch against the stubs -> the whisper banner starts.
        _open_settings(page)
        page.wait_for_selector('#model-download-banner .mdl-row[data-mdl-kind="whisper"]', timeout=8000)
        page.click("#s-llamacpp-recommended [data-act='download-gguf']")
        page.wait_for_selector("#s-llamacpp-recommended [data-gguf-cancel]", state="visible", timeout=3000)
        # Both are in flight and visible simultaneously.
        assert page.locator('#model-download-banner .mdl-row[data-mdl-kind="whisper"]').is_visible()
        assert page.locator("#s-llamacpp-recommended [data-gguf-cancel]").is_visible()


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
