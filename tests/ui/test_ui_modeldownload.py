"""
Playwright UI tests - background local-model download banner (first-run-friction
Stage 4).

On boot, modeldownload.js reads /api/llm/download-status; if a local model is
pending and no working text model exists, it streams the server-side .gguf
download (/api/llm/gguf/download) and shows a dismissible top-of-app progress
banner. On success it clears the pending flag and refreshes capabilities; on a
mid-stream error it drops to a failure state without clearing to success; Cancel
closes the banner and the app stays usable.

Every fetch the asserted render awaits is stubbed (hermetic-stubbing rule): the
status/capabilities reads, the SSE download endpoint, the clear endpoint, and the
capability-tiers refresh. The boot flow is driven by calling initModelDownload()
after the routes are in place - the fixture's own initial boot ran against the
real (empty) dev config, so it never renders a banner. Read-only against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py.
"""
from __future__ import annotations

import json

from conftest import skip_no_server
from playwright.sync_api import Page

_CAPS_TEXT_FALSE = (
    '{"backend":"llamacpp","model":null,"text":false,"vision":false,"detail":""}'
)
_DONE = 'data: "__DONE__"\n\n'
_PROGRESS_44 = 'data: "Downloading Qwen2.5 7B Instruct: 44% (2.1/4.7 GB)"\n\n'
_MODEL_ID = "qwen2.5-7b-instruct"


def _route_status(page: Page, *, pending: str) -> None:
    # whisper_cached + speaker_available neutralize the Stage 6 boot prefetch
    # (initModelPrefetch), so these LLM-banner tests exercise only the local-model
    # row and no speech/speaker row can race into the shared banner container.
    page.route(
        "**/api/llm/download-status",
        lambda route: route.fulfill(
            content_type="application/json",
            body=json.dumps(
                {"pending_model_id": pending, "downloading": False, "downloading_model_id": None,
                 "whisper_cached": True, "speaker_available": False}
            ),
        ),
    )


def _isolate_prefetch(page: Page) -> None:
    """Make an LLM-banner test hermetic against the Stage 6 boot prefetch: clear any
    row the fixture's own boot started, and disable model prefetch so a late
    initModelPrefetch bails before touching the banner container."""
    page.evaluate("() => _resetModelDownloads()")
    page.route(
        "**/api/config",
        lambda route: route.fulfill(
            content_type="application/json",
            body=json.dumps({"model_prefetch_disabled": True, "whisper_model": "base"}),
        ),
    )


def _route_caps_text_false(page: Page) -> None:
    page.route(
        "**/api/llm/capabilities",
        lambda route: route.fulfill(content_type="application/json", body=_CAPS_TEXT_FALSE),
    )


def _fulfill_sse(route, body: str) -> None:
    route.fulfill(status=200, content_type="text/event-stream", body=body)


@skip_no_server
class TestModelDownloadBanner:
    def test_banner_shows_parsed_progress_when_pending_and_model_missing(self, page: Page):
        _isolate_prefetch(page)
        _route_status(page, pending=_MODEL_ID)
        _route_caps_text_false(page)
        page.route(
            "**/api/llm/gguf/download*",
            lambda route: _fulfill_sse(route, _PROGRESS_44 + _DONE),
        )
        # Hold the clear route so the success path suspends after rendering 44%,
        # leaving the banner on-screen at that percentage for a deterministic assert.
        held: dict = {}
        page.route("**/api/llm/download-status/clear", lambda route: held.setdefault("route", route))

        page.evaluate("() => initModelDownload()")
        page.wait_for_selector("#model-download-banner .mdl-pct", timeout=4000)
        assert page.locator(".mdl-pct").inner_text() == "44%"
        assert page.evaluate("() => document.querySelector('.mdl-bar-fill').style.width") == "44%"
        # Dismissible: a Cancel control is present while downloading.
        assert page.locator(".mdl-cancel").count() == 1

    def test_success_hides_banner_clears_and_refreshes_capabilities(self, page: Page):
        _isolate_prefetch(page)
        calls = {"clear": 0, "cap": 0}
        _route_status(page, pending=_MODEL_ID)

        def _caps(route):
            calls["cap"] += 1
            route.fulfill(content_type="application/json", body=_CAPS_TEXT_FALSE)

        def _clear(route):
            calls["clear"] += 1
            route.fulfill(
                content_type="application/json",
                body='{"pending_model_id":"","downloading":false}',
            )

        page.route("**/api/llm/capabilities", _caps)
        page.route("**/api/capabilities/tiers", lambda r: r.fulfill(
            content_type="application/json", body='{"lightweight":true,"tiers":[]}'))
        page.route("**/api/llm/gguf/download*", lambda r: _fulfill_sse(r, _PROGRESS_44 + _DONE))
        page.route("**/api/llm/download-status/clear", _clear)

        page.evaluate("() => initModelDownload()")
        page.wait_for_selector("#model-download-banner", state="hidden", timeout=4000)
        assert calls["clear"] == 1
        # The gate fetch plus the post-success refresh -> capabilities read again.
        assert calls["cap"] >= 2
        page.wait_for_function(
            "() => document.getElementById('toast-container')"
            ".textContent.includes('LLM scoring is now available')",
            timeout=3000,
        )

    def test_error_line_before_done_shows_failure_and_does_not_clear(self, page: Page):
        _isolate_prefetch(page)
        calls = {"clear": 0}
        _route_status(page, pending=_MODEL_ID)
        _route_caps_text_false(page)
        page.route(
            "**/api/llm/gguf/download*",
            lambda r: _fulfill_sse(r, 'data: "Download failed: HTTP 404 fetching model"\n\n' + _DONE),
        )

        def _clear(route):
            calls["clear"] += 1
            route.fulfill(content_type="application/json", body='{"pending_model_id":"","downloading":false}')

        page.route("**/api/llm/download-status/clear", _clear)

        page.evaluate("() => initModelDownload()")
        page.wait_for_function(
            "() => { const el = document.getElementById('model-download-banner');"
            " return el && el.style.display !== 'none'"
            " && el.textContent.includes('Model download failed'); }",
            timeout=4000,
        )
        # A failed download must never be treated as success (pending stays set).
        assert calls["clear"] == 0

    def test_cancel_closes_banner_clears_and_app_stays_usable(self, page: Page):
        _isolate_prefetch(page)
        calls = {"clear": 0}
        _route_status(page, pending=_MODEL_ID)
        _route_caps_text_false(page)
        # Hold the download open so the banner sits in its in-progress state.
        held: dict = {}
        page.route("**/api/llm/gguf/download*", lambda route: held.setdefault("route", route))

        def _clear(route):
            calls["clear"] += 1
            route.fulfill(content_type="application/json", body='{"pending_model_id":"","downloading":false}')

        page.route("**/api/llm/download-status/clear", _clear)

        page.evaluate("() => initModelDownload()")
        page.wait_for_selector("#model-download-banner .mdl-cancel", timeout=4000)
        page.click(".mdl-cancel")
        page.wait_for_selector("#model-download-banner", state="hidden", timeout=4000)
        assert calls["clear"] == 1
        # Non-blocking chrome: the app's primary action stays usable throughout.
        assert page.locator("#btn-analyze").is_enabled()

    def test_no_banner_when_nothing_pending(self, page: Page):
        _isolate_prefetch(page)
        _route_status(page, pending="")
        _route_caps_text_false(page)
        page.evaluate("() => initModelDownload()")
        assert page.locator("#model-download-banner").is_hidden()


@skip_no_server
class TestPrereqRefreshAfterServerChange:
    """The boot-cached server state (window._prereqs etc.) must re-sync after a
    server-side change so surfaces like the analyze prereq banner update without a
    restart. Regression guard for the class of stale-until-restart bugs."""

    # test_apply_prereq_warnings_clears_a_previously_shown_banner moved to
    # tests/js/core/ui.test.js - _applyPrereqWarnings only reads/writes the static
    # #prereq-banner, so it runs browserless there. The download-resync fetch flow
    # below stays in Playwright.

    def test_successful_download_resyncs_prereqs(self, page: Page):
        # A completed download must trigger refreshServerState(), which re-fetches
        # /api/prereqs - the wiring that fixes "downloaded a model but the analyze
        # panel still warns until restart".
        _isolate_prefetch(page)
        _route_status(page, pending=_MODEL_ID)
        _route_caps_text_false(page)
        page.route("**/api/capabilities/tiers", lambda r: r.fulfill(
            content_type="application/json", body='{"lightweight":true,"tiers":[]}'))
        page.route("**/api/llm/gguf/download*", lambda r: _fulfill_sse(r, _PROGRESS_44 + _DONE))
        page.route("**/api/llm/download-status/clear", lambda r: r.fulfill(
            content_type="application/json", body='{"pending_model_id":"","downloading":false}'))
        page.route("**/api/prereqs", lambda r: r.fulfill(
            content_type="application/json",
            body='{"ffmpeg_ok":true,"llm_ok":true,"llm_reason":""}'))

        with page.expect_request("**/api/prereqs", timeout=5000):
            page.evaluate("() => initModelDownload()")
