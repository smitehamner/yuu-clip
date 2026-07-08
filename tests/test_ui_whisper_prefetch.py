"""Playwright UI tests — background model prefetch banners + analyze coordination
(first-run-friction Stage 6).

On boot, initModelPrefetch reads /api/config and /api/llm/download-status; for each
always-needed analysis model (speech + speaker) that is missing and not already
downloading, and only when prefetch is not disabled, it streams the model's prefetch
endpoint into a stacking top-of-app banner row. When the LLM handoff and both prefetches
run, up to three banners STACK (one row each). Before starting an analysis while the
speech model is downloading, analyze.js shows a heads-up confirm. When the pipeline
reaches transcription before the model is ready, the Transcribe step pill shows a
"waiting" status.

Every fetch the asserted render awaits is stubbed (hermetic-stubbing rule). The tests
call _resetModelDownloads() first so the fixture's own boot (against the real dev
config) can't leave a stream or row that races the assertions. Read-only against the
live dev server on port 8080. See tests/conftest.py.
"""
from __future__ import annotations

import json

from conftest import skip_no_server
from playwright.sync_api import Page

_MODEL_ID = "qwen2.5-7b-instruct"


def _route_config(page: Page, *, prefetch_disabled: bool) -> None:
    page.route(
        "**/api/config",
        lambda route: route.fulfill(
            content_type="application/json",
            body=json.dumps({"model_prefetch_disabled": prefetch_disabled, "whisper_model": "base"}),
        ),
    )


def _route_download_status(page: Page, **fields) -> None:
    body = {
        "pending_model_id": "",
        "downloading": False,
        "downloading_model_id": None,
        "whisper_downloading": False,
        "whisper_model_id": None,
        "whisper_cached": False,
        "speaker_downloading": False,
        "speaker_cached": False,
        "speaker_available": True,
        "model_prefetch_disabled": False,
    }
    body.update(fields)
    page.route(
        "**/api/llm/download-status",
        lambda route: route.fulfill(content_type="application/json", body=json.dumps(body)),
    )


def _hold(page: Page, pattern: str, sink: list) -> None:
    """Intercept *pattern* and never fulfill it, so an SSE stream stays open and its
    banner row sits in its in-progress state for a deterministic assertion."""
    page.route(pattern, lambda route: sink.append(route))


def _reset(page: Page) -> None:
    page.evaluate("() => _resetModelDownloads()")


@skip_no_server
class TestModelPrefetchBanner:
    def test_speech_banner_appears_when_missing_and_enabled(self, page: Page):
        _reset(page)
        _route_config(page, prefetch_disabled=False)
        _route_download_status(page, whisper_cached=False, speaker_cached=True)
        _hold(page, "**/api/whisper/prefetch", [])

        page.evaluate("() => initModelPrefetch()")
        page.wait_for_selector('#model-download-banner .mdl-row[data-mdl-kind="whisper"]', timeout=4000)
        row = page.locator('.mdl-row[data-mdl-kind="whisper"]')
        assert "speech model" in row.inner_text().lower()
        # No percent parsed yet -> indeterminate bar, and a Cancel control is present.
        assert page.locator('.mdl-row[data-mdl-kind="whisper"] .mdl-bar-fill.indeterminate').count() == 1
        assert page.locator('.mdl-row[data-mdl-kind="whisper"] .mdl-cancel').count() == 1

    def test_speaker_banner_appears_when_missing_and_enabled(self, page: Page):
        _reset(page)
        _route_config(page, prefetch_disabled=False)
        _route_download_status(page, whisper_cached=True, speaker_cached=False)
        _hold(page, "**/api/models/prefetch*", [])

        page.evaluate("() => initModelPrefetch()")
        page.wait_for_selector('#model-download-banner .mdl-row[data-mdl-kind="speaker"]', timeout=4000)
        assert "speaker" in page.locator('.mdl-row[data-mdl-kind="speaker"]').inner_text().lower()
        # Only the speaker banner - the cached speech model must not start one.
        assert page.locator('.mdl-row[data-mdl-kind="whisper"]').count() == 0

    def test_no_banner_when_prefetch_disabled(self, page: Page):
        _reset(page)
        _route_config(page, prefetch_disabled=True)
        _route_download_status(page, whisper_cached=False, speaker_cached=False)
        page.evaluate("() => initModelPrefetch()")
        assert page.locator("#model-download-banner .mdl-row").count() == 0
        assert page.locator("#model-download-banner").is_hidden()

    def test_no_banner_when_models_already_cached(self, page: Page):
        _reset(page)
        _route_config(page, prefetch_disabled=False)
        _route_download_status(page, whisper_cached=True, speaker_cached=True)
        page.evaluate("() => initModelPrefetch()")
        assert page.locator("#model-download-banner .mdl-row").count() == 0
        assert page.locator("#model-download-banner").is_hidden()

    def test_three_banners_stack(self, page: Page):
        _reset(page)
        _route_config(page, prefetch_disabled=False)
        _route_download_status(
            page, pending_model_id=_MODEL_ID, downloading=False,
            whisper_cached=False, speaker_cached=False,
        )
        page.route(
            "**/api/llm/capabilities",
            lambda route: route.fulfill(
                content_type="application/json",
                body='{"backend":"llamacpp","model":null,"text":false,"vision":false,"detail":""}',
            ),
        )
        _hold(page, "**/api/llm/gguf/download*", [])
        _hold(page, "**/api/whisper/prefetch", [])
        _hold(page, "**/api/models/prefetch*", [])

        page.evaluate("() => { initModelDownload(); initModelPrefetch(); }")
        page.wait_for_function(
            "() => document.querySelectorAll('#model-download-banner .mdl-row').length === 3",
            timeout=4000,
        )
        kinds = page.eval_on_selector_all(
            "#model-download-banner .mdl-row",
            "els => els.map(e => e.getAttribute('data-mdl-kind')).sort()",
        )
        assert kinds == ["llm", "speaker", "whisper"]
        assert page.locator("#model-download-banner .mdl-cancel").count() == 3


@skip_no_server
class TestAnalyzeCoordination:
    def test_analyze_heads_up_when_speech_model_downloading(self, page: Page):
        _route_download_status(page, whisper_downloading=True, whisper_model_id="base")
        page.evaluate("() => { document.getElementById('analyze-path').value = 'C:/rec.mp4'; }")
        page.evaluate("() => startAnalyze()")
        page.wait_for_selector("#confirm-modal.visible", timeout=4000)
        assert "still downloading" in page.locator("#confirm-body").inner_text().lower()
        assert page.locator("#confirm-ok-btn").inner_text() == "Start anyway"
        assert page.locator("#confirm-cancel-btn").inner_text() == "Wait"

    def test_transcribe_step_shows_waiting_then_clears_on_progress(self, page: Page):
        page.evaluate(
            "() => { startJobUI(INGEST_STEPS, 'Analyzing rec.mp4', true, true);"
            " updateJobUI('  Transcribing (model: base)...');"
            " updateJobUI('Waiting for the speech-to-text model to finish downloading...'); }"
        )
        assert "waiting" in page.locator("#step-1").inner_text().lower()
        # Once transcription reports real progress, the waiting status clears.
        page.evaluate("() => updateJobUI('  Track 1/2 [combined]...')")
        assert "waiting" not in page.locator("#step-1").inner_text().lower()
        # tidy up the job header so the pill row doesn't linger for later tests
        page.evaluate("() => endJobUI()")


@skip_no_server
class TestGettingStartedModal:
    def test_modal_opens_on_first_run_and_marks_seen_on_close(self, page: Page):
        page.evaluate("() => { localStorage.removeItem('yuu-getting-started-seen'); openGettingStartedModal(); }")
        page.wait_for_selector("#getting-started-modal.visible", timeout=4000)
        page.evaluate("() => closeGettingStartedModal()")
        page.wait_for_selector("#getting-started-modal.visible", state="hidden", timeout=4000)
        assert page.evaluate("() => localStorage.getItem('yuu-getting-started-seen')") == "1"
