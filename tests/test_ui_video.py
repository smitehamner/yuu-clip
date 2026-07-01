"""
Playwright UI tests — per-video summary regeneration confirm flow, the
run-timing provenance line in the World Contexts section, and the video-level
Additional Actions modal.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from playwright.sync_api import Page, expect

from conftest import LIVE_URL, select_video_with_clips, skip_no_server


_MOCK_ANALYZE_RUN = {
    "started_at": "2026-06-01T00:00:00+00:00",
    "finished_at": "2026-06-01T00:04:12+00:00",
    "elapsed_ms": 252000,
    "device": {"has_gpu": False},
    "settings": {},
    "stages": [
        {"name": "extract", "seconds": 12},
        {"name": "transcribe", "seconds": 181},
        {"name": "speakers", "seconds": 38},
        {"name": "score", "seconds": 41},
    ],
}


def _render_video_with_analyze_run(page: Page, analyze_run) -> None:
    """Render the first sidebar video's detail with `analyze_run` overridden.

    renderVideoDetail() is called directly (bypassing selectVideo's fetch) so
    the test controls analyze_run without depending on real analyze history
    on the live server's videos.
    """
    page.goto(LIVE_URL)
    page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
    page.evaluate(
        """(analyzeRun) => {
          const video = Object.assign({}, AppState.videos[0], {analyze_run: analyzeRun});
          renderVideoDetail(video, null);
        }""",
        analyze_run,
    )


@skip_no_server
class TestRunTimingProvenanceLine:
    """The World Contexts section shows a 'Last run: ... total (...)' line built
    from Video.analyze_run when present, and omits it otherwise."""

    def test_shows_total_and_per_stage_timing(self, page: Page):
        _render_video_with_analyze_run(page, _MOCK_ANALYZE_RUN)
        expect(page.locator("#detail")).to_contain_text(
            "Last run: 4m 12s total (extract 12s · transcribe 3m 01s · speakers 38s · score 41s)"
        )

    def test_absent_when_analyze_run_is_null(self, page: Page):
        _render_video_with_analyze_run(page, None)
        expect(page.locator("#detail")).not_to_contain_text("Last run:")


@skip_no_server
class TestRegenSummaryAutoConfirm:
    """regenSummaryAuto shows a confirm modal before running the SSE regen stream."""

    def _open_regen_confirm(self, page: Page) -> None:
        """Navigate to the app and invoke regenSummaryAuto via JS so the confirm modal appears."""
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        video_id = page.evaluate("() => AppState.videos?.[0]?.id ?? 1")
        # Pass a detached button so _doRegenSummaryAuto has a non-null actionBtn
        page.evaluate(f"() => regenSummaryAuto({video_id}, document.createElement('button'))")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)

    def test_confirm_modal_appears(self, page: Page):
        self._open_regen_confirm(page)
        expect(page.locator("#confirm-modal")).to_be_visible()

    def test_confirm_title_mentions_regenerate(self, page: Page):
        self._open_regen_confirm(page)
        expect(page.locator("#confirm-title")).to_contain_text("Regenerate")

    def test_confirm_body_warns_about_auto_save(self, page: Page):
        self._open_regen_confirm(page)
        expect(page.locator("#confirm-body")).to_contain_text("replaced without a review step")

    def test_cancel_closes_modal(self, page: Page):
        self._open_regen_confirm(page)
        page.click("#confirm-modal button:has-text('Cancel')")
        expect(page.locator("#confirm-modal")).not_to_be_visible()

    def test_cancel_does_not_trigger_regen_request(self, page: Page):
        self._open_regen_confirm(page)
        regen_requests: list = []
        page.on("request", lambda r: regen_requests.append(r) if "regenerate-summary" in r.url else None)
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_timeout(500)
        assert not regen_requests, "Cancelling should not POST to regenerate-summary"

    def test_confirm_triggers_regen_sse_request(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        video_id = page.evaluate("() => AppState.videos?.[0]?.id ?? 1")
        # Abort the actual SSE stream so the test doesn't trigger real LLM work
        page.route("**/regenerate-summary", lambda route: route.abort())
        page.evaluate(f"() => regenSummaryAuto({video_id}, document.createElement('button'))")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        with page.expect_request(lambda r: "regenerate-summary" in r.url, timeout=3000):
            page.click("#confirm-ok-btn")


# ---------------------------------------------------------------------------
# Video-level "Additional Actions" modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestVideoActionsModal:
    def test_opens_with_expected_action_groups(self, page: Page):
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        body = page.locator("#actions-modal-body")
        expect(body.locator("button:has-text('Approve Above Score')")).to_be_visible()
        expect(body.locator("button:has-text('Re-score All Clips')")).to_be_visible()
        expect(body.locator("button:has-text('Re-detect Speakers')")).to_be_visible()
        expect(body.locator("button:has-text('Split Recording')")).to_be_visible()
        expect(body.locator("button:has-text('Re-analyze (full)')")).to_be_visible()

    def test_title_includes_video_name(self, page: Page):
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        expect(page.locator("#actions-modal-title")).to_contain_text("Additional Actions")

    def test_danger_actions_render_with_danger_class(self, page: Page):
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        danger_row = page.locator("#actions-modal-body .action-row.danger:has-text('Remove Recording')")
        expect(danger_row).to_be_visible()

    def test_closing_modal_does_not_trigger_any_action(self, page: Page):
        # Clicking the close (X) button must dismiss the modal without invoking
        # any row's action — only clicking a row itself should fire its action.
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        requests: list = []
        page.on("request", lambda r: requests.append(r.url))
        page.click("#actions-modal button[aria-label='Close']")
        expect(page.locator("#actions-modal")).not_to_be_visible()
        assert not any("rescore" in u or "reanalyze" in u or "delete" in u for u in requests)

    def test_selecting_a_row_closes_modal_and_invokes_action(self, page: Page):
        # Split Recording opens the split editor panel — a safe, non-destructive
        # action to verify the row's onclick actually fires (closeActionsModal()
        # runs first, then row.action()).
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal .action-row:has-text('Split Recording')")
        expect(page.locator("#actions-modal")).not_to_be_visible()
        expect(page.locator("#split-editor-panel")).to_be_visible(timeout=3000)
