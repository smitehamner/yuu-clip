"""
Playwright UI tests - per-video summary regeneration confirm flow and the
video-level Additional Actions modal.

Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import re

from conftest import (
    LIVE_URL,
    select_first_video_and_clip,
    select_video_with_clips,
    skip_no_server,
)
from playwright.sync_api import Page, expect

# TestRunTimingProvenanceLine (the 'Last run: ...' timing line) and
# TestVideoDetailCardLayout (per-section .detail-card layout) moved to
# tests/js/videos/videodetail.test.js (vitest): both only called
# renderVideoDetail(video, null) and read the built #detail DOM, so they run
# browserless with setupRecordingPreview / the window.* timeline+speaker seams
# stubbed and the real _runTimingLine under test.


# TestAnalysisLivePanel (Cancel wiring + active-step progress fill) moved to
# tests/js/videos/videos.test.js (vitest), driven through the public
# startJobUI/updateJobUI API instead of seeding jobs.js's private step state.


# TestVideoShowInFolder (Explorer reveal button - visible/hidden by canReveal,
# clicking posts the active video's path to /api/reveal) moved to
# tests/js/videos/videodetail.test.js (vitest) as the 'reveal-in-folder button
# (data-act delegation)' describe block, calling the exported _handleDetailClick
# directly. This retires FLAKE-6 in the test-flakes register - the Playwright
# version raced a background re-render from boot's own pollers between locating
# and clicking the button.


@skip_no_server
class TestContextsSelfHeal:
    """Opening a recording refetches world contexts if the boot-time load left the
    list empty (transient failure / race), so the context section never renders
    from an empty list until a manual page refresh."""

    def test_empty_context_list_reloads_on_select(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        # Simulate the boot load not having populated (or having failed) yet.
        page.evaluate("AppState.contexts = []")
        page.click("#video-list li[data-video-id]")
        # Built-in contexts guarantee a non-empty list once ensureContexts refetches.
        page.wait_for_function("() => AppState.contexts.length > 0", timeout=5000)


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

    # The confirm-dialog copy (title/body), "confirm starts the regenerate-summary
    # stream", and "nothing streams until confirmed" moved to
    # tests/js/videos/videos-summary.test.js (they drive regenSummaryAuto through the
    # mocked ui.js confirm + jobs.js SSE seams). What stays here is the real
    # #confirm-modal show/hide wiring.

    def test_cancel_closes_modal(self, page: Page):
        self._open_regen_confirm(page)
        page.click("#confirm-modal button:has-text('Cancel')")
        expect(page.locator("#confirm-modal")).not_to_be_visible()


@skip_no_server
class TestDeleteVideoConfirm:
    """deleteVideo shows a confirm modal; only OK sends the DELETE request.

    The DELETE is intercepted and aborted so the live server's video is never
    actually removed.
    """

    def _open_delete_confirm(self, page: Page) -> int:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        video_id = page.evaluate("() => AppState.videos[0].id")
        page.route(
            "**/api/videos/*",
            lambda route: route.abort()
            if route.request.method == "DELETE"
            else route.continue_(),
        )
        page.click("#video-list li[data-video-id]")
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal .action-row:has-text('Remove Recording')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        return video_id

    def test_confirm_modal_has_remove_title(self, page: Page):
        self._open_delete_confirm(page)
        expect(page.locator("#confirm-title")).to_contain_text("Remove recording?")

    def test_body_says_source_file_is_kept(self, page: Page):
        self._open_delete_confirm(page)
        expect(page.locator("#confirm-body")).to_contain_text(
            "Your source recording file is not deleted."
        )

    def test_cancel_sends_no_delete_request(self, page: Page):
        self._open_delete_confirm(page)
        delete_requests: list = []
        page.on(
            "request",
            lambda r: delete_requests.append(r)
            if r.method == "DELETE" and "/api/videos/" in r.url
            else None,
        )
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_timeout(500)
        assert not delete_requests, "Cancelling must not DELETE the video"

    def test_confirm_sends_delete_for_that_video(self, page: Page):
        video_id = self._open_delete_confirm(page)
        with page.expect_request(
            lambda r: r.method == "DELETE" and r.url.endswith(f"/api/videos/{video_id}"),
            timeout=3000,
        ):
            page.click("#confirm-ok-btn")


@skip_no_server
class TestTimelineModalUnitOrder:
    """The Generate Timeline modal lists units in the same order as Settings'
    timeline-interval control: seconds, then minutes (L3-2)."""

    def test_unit_order_matches_settings(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        modal_units = page.locator("#timeline-interval-unit option").all_text_contents()
        settings_units = page.locator("#s-timeline-unit option").all_text_contents()
        assert modal_units == settings_units == ["seconds", "minutes"]

    def test_default_unit_is_still_minutes(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        assert page.eval_on_selector("#timeline-interval-unit", "el => el.value") == "minutes"


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
        # any row's action - only clicking a row itself should fire its action.
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        requests: list = []
        page.on("request", lambda r: requests.append(r.url))
        page.click("#actions-modal button[aria-label='Close']")
        expect(page.locator("#actions-modal")).not_to_be_visible()
        assert not any("rescore" in u or "reanalyze" in u or "delete" in u for u in requests)

    def test_selecting_a_row_closes_modal_and_invokes_action(self, page: Page):
        # Split Recording opens the split editor panel - a safe, non-destructive
        # action to verify the row's onclick actually fires (closeActionsModal()
        # runs first, then row.action()).
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal .action-row:has-text('Split Recording')")
        expect(page.locator("#actions-modal")).not_to_be_visible()
        expect(page.locator("#split-editor-panel")).to_be_visible(timeout=3000)


# TestNativeMediaProtocolUrlBuilder (utils.js:_buildMediaUrl - the transport
# picker between the packaged app's native "yuu-media://" scheme and the
# unchanged HTTP route) moved to tests/js/core/preview.test.js (vitest): it is
# a pure function with window.electronAPI.mediaProtocol stubbed, no DOM or
# navigation involved, so it runs browserless.


@skip_no_server
class TestRecordingFilterCounts:
    """The recording filter chips carry per-filter counts derived from
    AppState.videos, mirroring the clip filter chips (but keyed data-vcount)."""

    def _badge(self, page: Page, key: str):
        return page.locator(f".clip-chip-count[data-vcount='{key}']")

    def _seed(self, page: Page, videos: list) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.evaluate(
            """(videos) => {
              AppState.videos = videos;
              AppState.sessions = [];
              _renderVideoList();
            }""",
            videos,
        )

    def test_counts_reflect_videos(self, page: Page):
        self._seed(page, [
            {"id": 1, "filename": "a.mkv", "clip_count": 3, "clips_scored_at": "2026-01-01", "clips_llm_error": 0},
            {"id": 2, "filename": "b.mkv", "clip_count": 0, "clips_scored_at": None, "clips_llm_error": 0},
            {"id": 3, "filename": "c.mkv", "clip_count": 5, "clips_scored_at": "2026-01-01", "clips_llm_error": 2},
        ])
        expect(self._badge(page, "all")).to_have_text("3")
        expect(self._badge(page, "has-clips")).to_have_text("2")
        expect(self._badge(page, "unscored")).to_have_text("1")
        expect(self._badge(page, "errors")).to_have_text("1")

    def test_errors_badge_blank_when_none(self, page: Page):
        self._seed(page, [
            {"id": 1, "filename": "a.mkv", "clip_count": 1, "clips_scored_at": "2026-01-01", "clips_llm_error": 0},
        ])
        expect(self._badge(page, "all")).to_have_text("1")
        expect(self._badge(page, "errors")).to_have_text("")

    def test_all_badges_blank_when_no_videos(self, page: Page):
        self._seed(page, [])
        for key in ("all", "has-clips", "unscored", "errors"):
            expect(self._badge(page, key)).to_have_text("")


@skip_no_server
class TestRecordingMoreFilters:
    """Stage 3: the rare recording filters (Unscored, Errors) live inside a
    collapsed "More filters" expander; the everyday All / Has clips chips stay
    visible. Activating a hidden filter auto-opens the expander (mirrors the
    Clips block)."""

    def test_primary_chips_visible_rare_chips_hidden_when_collapsed(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        assert page.evaluate(
            "() => document.getElementById('video-more-filters').open"
        ) is False
        for token in ("all", "has-clips"):
            expect(
                page.locator(f"button.clip-chip[data-vfilter='{token}']")
            ).to_be_visible()
        for token in ("unscored", "errors"):
            expect(
                page.locator(f"button.clip-chip[data-vfilter='{token}']")
            ).not_to_be_visible()

    def test_activating_hidden_filter_autoopens_expander(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        assert page.evaluate(
            "() => document.getElementById('video-more-filters').open"
        ) is False
        page.evaluate("() => toggleVideoFilter('unscored')")
        assert page.evaluate(
            "() => document.getElementById('video-more-filters').open"
        ) is True
        expect(page.locator("#video-more-filters .clip-more-flag")).to_be_visible()
        expect(
            page.locator("button.clip-chip[data-vfilter='unscored']")
        ).to_be_visible()

    def test_flag_clears_and_collapse_allowed_back_at_all(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        # Activate then clear back to All: the flag hides and the expander is no
        # longer forced open (the user may collapse it).
        page.evaluate("() => toggleVideoFilter('errors')")
        expect(page.locator("#video-more-filters .clip-more-flag")).to_be_visible()
        page.evaluate("() => toggleVideoFilter('all')")
        expect(page.locator("#video-more-filters .clip-more-flag")).to_be_hidden()
        page.evaluate("() => { document.getElementById('video-more-filters').open = false; }")
        assert page.evaluate(
            "() => document.getElementById('video-more-filters').open"
        ) is False


@skip_no_server
class TestInProcessJobHeader:
    """PROGRESS-CANCEL-GAP-2026-07-20 Part A: the in-process (event-loop) LLM jobs -
    here the regenerate-summary flow - now surface the shared job-header pill row
    while they run (previously log-only), so a long job is no longer silent. The SSE
    endpoint is mocked so the test is deterministic; the pill-label/progress parsing
    itself is unit-tested in tests/js/core/jobs.test.js. Part A adds progress only -
    there is no Cancel button yet (server-side cancel is Part B)."""

    def test_regenerate_summary_shows_the_job_header_without_a_cancel_button(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        video_id = page.evaluate("() => AppState.videos?.[0]?.id ?? 1")
        body = (
            'data: {"v": 1, "type": "log", "text": "[Generating summary…]", "level": "info"}\n\n'
            'data: {"v": 1, "type": "log", "text": "[Summary regenerated]", "level": "info"}\n\n'
            'data: {"v": 1, "type": "done", "outcome": "ok"}\n\n'
        )
        page.route(
            f"**/api/videos/{video_id}/regenerate-summary",
            lambda route: route.fulfill(
                status=200, content_type="text/event-stream", body=body
            ),
        )
        # Pass a detached button so _doRegenSummaryAuto has a non-null actionBtn.
        page.evaluate(f"() => regenSummaryAuto({video_id}, document.createElement('button'))")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-modal button:has-text('Regenerate')")
        # The shared job header appears (job label span persists for the whole
        # visible window, unlike the pill text which collapses to a check on done).
        expect(page.locator("#job-status")).to_have_class(
            re.compile(r"\bvisible\b"), timeout=2000
        )
        expect(page.locator("#job-steps")).to_contain_text("Regenerating summary")
        # Part A is progress-only: no Cancel affordance on these in-process jobs.
        expect(page.locator("#btn-cancel-job")).to_be_hidden()


@skip_no_server
class TestInProcessBatchJobCancel:
    """PROGRESS-CANCEL-GAP Part B: the looped in-process jobs (here Re-score All
    Clips) now show a Cancel button, and cancelling is a client-only soft stop -
    no server cancel endpoint, just aborting the fetch. The SSE request is left
    hanging (never resolved) so the job stays active while we assert the header +
    Cancel, then verify Cancel confirms and tears the job UI down."""

    def test_rescore_all_shows_cancel_and_client_cancel_stops_it(self, page: Page):
        select_video_with_clips(page)
        # Hang the rescore SSE so the job stays live (route registered but never
        # fulfilled/continued); the client aborts it on Cancel.
        page.route("**/api/videos/*/rescore-clips*", lambda route: None)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal .action-row:has-text('Re-score All Clips')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-ok-btn")  # "Re-score All"
        # The job header appears with a Cancel button (this is a cancellable batch job).
        expect(page.locator("#job-status")).to_have_class(
            re.compile(r"\bvisible\b"), timeout=2000
        )
        expect(page.locator("#btn-cancel-job")).to_be_visible()
        # Cancel -> soft-stop confirm -> the job UI tears down.
        page.click("#btn-cancel-job")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Stop re-scoring?")
        page.click("#confirm-ok-btn")  # "Stop"
        expect(page.locator("#job-status")).not_to_have_class(
            re.compile(r"\bvisible\b"), timeout=4000
        )
        expect(page.locator("#btn-cancel-job")).to_be_hidden()


@skip_no_server
class TestFindSimilarFeedback:
    """PROGRESS-CANCEL-GAP Part B / bug 3.3: Find Similar (a single-shot ranking
    call) is progress-only - the Related Clips card shows an inline spinner while
    it runs and there is no Cancel button (nothing to interrupt). The related-clips
    SSE is left hanging so the searching state persists for the assertions."""

    def _start_find_similar(self, page: Page) -> None:
        select_first_video_and_clip(page)
        page.route("**/api/clips/*/related-clips*", lambda route: None)  # hang
        page.click("#detail button[data-act='open-clip-actions-modal']")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal .action-row:has-text('Find Similar')")
        page.wait_for_selector("#similar-clips-modal.visible", timeout=2000)
        page.click("#btn-find-similar-go")

    def test_related_card_shows_a_searching_spinner_and_no_cancel(self, page: Page):
        self._start_find_similar(page)
        # Inline feedback co-located with where results land (visibility-agnostic:
        # the card may be collapsed, so assert on text content).
        expect(page.locator("#related-clips-section")).to_contain_text(
            "Searching for similar clips"
        )
        expect(page.locator("#related-clips-section .spinner")).to_have_count(1)
        # Single-shot job: progress only, no Cancel affordance.
        expect(page.locator("#btn-cancel-job")).to_be_hidden()
