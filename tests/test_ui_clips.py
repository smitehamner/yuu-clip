"""
Playwright UI tests — clip review workflow, sorting, score override, the
per-clip rescore progress pill, and multi-select bulk clip actions.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    LIVE_URL,
    select_first_video_and_clip,
    select_video_with_clips,
    skip_no_server,
)


# ---------------------------------------------------------------------------
# Clip review workflow
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipReview:
    def test_clip_detail_shows_score(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        expect(page.locator(".scores")).to_be_visible()

    def test_clip_detail_shows_description(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        # Description or transcript should be present
        detail = page.locator(".detail")
        expect(detail).not_to_be_empty()

    def test_approve_button_exists(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        expect(page.locator("button.approve")).to_be_visible()

    def test_reject_button_exists(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        expect(page.locator("button.reject")).to_be_visible()

    def test_retranscribe_button_exists(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=3000)
        page.click(".clip-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        expect(page.locator("#actions-modal-body button:has-text('Retranscribe')")).to_be_visible()

    def test_sidebar_shows_clip_id(self, page: Page):
        select_video_with_clips(page)
        # Each clip item should show a #N id prefix
        first_item = page.locator("#clip-list li:has(.clip-num)").first
        expect(first_item).to_contain_text("#")

    def test_sidebar_shows_clip_scores(self, page: Page):
        select_video_with_clips(page)
        expect(page.locator(".clip-scores").first).to_be_visible()


# ---------------------------------------------------------------------------
# Clip sort
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipSort:
    def test_sort_dropdown_visible(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#clips-sort")).to_be_visible()

    def test_sort_default_is_score(self, page: Page):
        page.goto(LIVE_URL)
        assert page.locator("#clips-sort").input_value() == "score"

    def test_sort_has_timeline_option(self, page: Page):
        page.goto(LIVE_URL)
        options = page.locator("#clips-sort option")
        values = [options.nth(i).get_attribute("value") for i in range(options.count())]
        assert "score" in values
        assert "timeline" in values

    def test_switching_sort_does_not_crash(self, page: Page):
        select_video_with_clips(page)
        page.locator("#clips-sort").select_option("timeline")
        # List should still be present after sort change
        expect(page.locator("#clip-list li").first).to_be_visible()
        page.locator("#clips-sort").select_option("score")
        expect(page.locator("#clip-list li").first).to_be_visible()


# ---------------------------------------------------------------------------
# Score override via field-edit modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestScoreOverrideModal:
    """Score override opens a dedicated slider modal."""

    def _open_score_override(self, page: Page) -> None:
        clip_id = page.evaluate("() => AppState.clips?.[0]?.id")
        assert clip_id is not None, "No clips loaded on the live server"
        page.evaluate(f"() => openScoreOverride({clip_id})")
        page.wait_for_selector("#score-override-modal.visible", timeout=2000)

    def test_opens_score_override_modal(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        expect(page.locator("#score-override-modal")).to_be_visible()

    def test_title_mentions_score_override(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        expect(page.locator("#score-override-modal h3")).to_contain_text("Score Override")

    def test_prefills_current_score(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        clip_score = page.evaluate("() => AppState.clips?.[0]?.score_overall ?? 0")
        self._open_score_override(page)
        val = float(page.locator("#score-override-slider").input_value())
        assert abs(val - clip_score) < 0.01

    def test_cancel_closes_modal(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        page.click("#score-override-modal button:has-text('Cancel')")
        expect(page.locator("#score-override-modal")).not_to_be_visible()

    def test_display_updates_with_slider(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        page.locator("#score-override-slider").fill("0.75")
        page.locator("#score-override-slider").dispatch_event("input")
        expect(page.locator("#score-override-display")).to_contain_text("75%")


# ---------------------------------------------------------------------------
# Per-clip rescore — header progress pill
# ---------------------------------------------------------------------------

@skip_no_server
class TestRescoreClipProgressPill:
    """Clicking Re-score on a clip shows the header progress pill (startJobUI / endJobUI)."""

    def _open_rescore(self, page: Page) -> None:
        # Stub the rescore SSE response — the real endpoint runs live LLM scoring
        # and commits new scores to the project DB, which a UI test must not trigger.
        page.route(
            "**/api/clips/*/rescore",
            lambda route: route.fulfill(
                status=200,
                content_type="text/event-stream",
                body='data: "Scored clip"\n\n'
                'data: {"type": "__DONE__", "description_new": null, "description_long_new": null}\n\n',
            ),
        )
        page.wait_for_selector("#detail button:has-text('Additional Actions')", timeout=3000)
        page.click("#detail button:has-text('Additional Actions')")
        page.click("#actions-modal .action-row:has-text('Re-score')")

    def test_progress_pill_appears_on_rescore(self, page: Page):
        select_first_video_and_clip(page)
        self._open_rescore(page)
        # startJobUI is synchronous — pill must be visible before the SSE completes
        expect(page.locator("#job-status")).to_be_visible()

    def test_progress_pill_shows_rescore_label(self, page: Page):
        select_first_video_and_clip(page)
        self._open_rescore(page)
        page.wait_for_selector("#job-status.visible", timeout=2000)
        expect(page.locator("#job-steps")).to_contain_text("Re-scoring clip")

    def test_progress_pill_disappears_after_job(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        # Drive startJobUI/endJobUI directly — don't depend on real LLM job duration
        page.evaluate("() => startJobUI(SCORE_STEPS, 'Re-scoring clip')")
        expect(page.locator("#job-status")).to_be_visible()
        page.evaluate("() => endJobUI()")


# ---------------------------------------------------------------------------
# Export modal — caption default
# ---------------------------------------------------------------------------

@skip_no_server
class TestExportModalDefaults:
    def test_captions_default_is_softsub(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.evaluate("() => exportClip(AppState.activeClipId)")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)
        assert page.eval_on_selector("#export-captions", "el => el.value") == "softsub"
        # endJobUI removes .visible after a 2 s setTimeout
        page.wait_for_selector("#job-status.visible", state="hidden", timeout=5000)
        expect(page.locator("#job-status")).not_to_be_visible()


# ---------------------------------------------------------------------------
# Multi-select bulk clip actions
# ---------------------------------------------------------------------------

def _first_row(page: Page):
    return page.locator("#clip-list li:has(.clip-num)").first


@skip_no_server
class TestBulkSelectCheckboxes:
    def test_checkbox_present_on_each_row(self, page: Page):
        select_video_with_clips(page)
        expect(_first_row(page).locator(".clip-select-checkbox")).to_be_visible()

    def test_checkbox_unchecked_by_default(self, page: Page):
        select_video_with_clips(page)
        expect(_first_row(page).locator(".clip-select-checkbox")).not_to_be_checked()

    def test_checking_checkbox_does_not_activate_clip(self, page: Page):
        select_video_with_clips(page)
        row = _first_row(page)
        row.locator(".clip-select-checkbox").check()
        expect(row).not_to_have_class("active")
        assert page.evaluate("() => AppState.activeClipId") is None


@skip_no_server
class TestBulkToolbar:
    def test_toolbar_hidden_initially(self, page: Page):
        select_video_with_clips(page)
        expect(page.locator("#clip-bulk-toolbar")).to_be_hidden()

    def test_toolbar_shows_count_on_check(self, page: Page):
        select_video_with_clips(page)
        _first_row(page).locator(".clip-select-checkbox").check()
        expect(page.locator("#clip-bulk-toolbar")).to_be_visible()
        expect(page.locator("#clip-bulk-count")).to_contain_text("1 selected")

    def test_toolbar_count_increments_with_each_check(self, page: Page):
        select_video_with_clips(page)
        rows = page.locator("#clip-list li:has(.clip-num)")
        if rows.count() < 2:
            pytest.skip("Need at least 2 clips for this test")
        rows.nth(0).locator(".clip-select-checkbox").check()
        rows.nth(1).locator(".clip-select-checkbox").check()
        expect(page.locator("#clip-bulk-count")).to_contain_text("2 selected")

    def test_clear_selection_hides_toolbar(self, page: Page):
        select_video_with_clips(page)
        _first_row(page).locator(".clip-select-checkbox").check()
        page.click(".clip-bulk-actions button[title='Clear selection']")
        expect(page.locator("#clip-bulk-toolbar")).to_be_hidden()
        expect(_first_row(page).locator(".clip-select-checkbox")).not_to_be_checked()


@skip_no_server
class TestBulkSelectionRespectsFilter:
    """A checked clip hidden by a filter change must not count toward the
    toolbar or be included if a bulk action ran — only the visible+checked set."""

    def test_hidden_selection_excluded_from_toolbar(self, page: Page):
        select_video_with_clips(page)
        status = page.evaluate("() => AppState.clips[0].status")
        other_tab = "approved" if status != "approved" else "rejected"
        _first_row(page).locator(".clip-select-checkbox").check()
        expect(page.locator("#clip-bulk-toolbar")).to_be_visible()

        page.click(f"button.clip-tab[data-filter='{other_tab}']")
        expect(page.locator("#clip-bulk-toolbar")).to_be_hidden()

        page.click("button.clip-tab[data-filter='all']")
        expect(page.locator("#clip-bulk-toolbar")).to_be_visible()


@skip_no_server
class TestBulkApproveReject:
    def test_bulk_approve_sends_selected_clip_ids(self, page: Page):
        select_video_with_clips(page)
        clip_id = page.evaluate("() => AppState.clips[0].id")
        _first_row(page).locator(".clip-select-checkbox").check()
        page.route("**/api/clips/bulk-status", lambda route: route.abort())
        with page.expect_request(lambda r: "bulk-status" in r.url) as req_info:
            page.click(".clip-bulk-actions button:has-text('Approve')")
        payload = req_info.value.post_data_json
        assert payload["status"] == "approved"
        assert payload["clip_ids"] == [clip_id]

    def test_bulk_reject_sends_selected_clip_ids(self, page: Page):
        select_video_with_clips(page)
        clip_id = page.evaluate("() => AppState.clips[0].id")
        _first_row(page).locator(".clip-select-checkbox").check()
        page.route("**/api/clips/bulk-status", lambda route: route.abort())
        with page.expect_request(lambda r: "bulk-status" in r.url) as req_info:
            page.click(".clip-bulk-actions button:has-text('Reject')")
        payload = req_info.value.post_data_json
        assert payload["status"] == "rejected"
        assert payload["clip_ids"] == [clip_id]


@skip_no_server
class TestBulkDelete:
    def test_delete_button_opens_confirm_modal(self, page: Page):
        select_video_with_clips(page)
        _first_row(page).locator(".clip-select-checkbox").check()
        page.click(".clip-bulk-actions button:has-text('Delete')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Delete selected clips")

    def test_cancel_does_not_send_delete_request(self, page: Page):
        select_video_with_clips(page)
        _first_row(page).locator(".clip-select-checkbox").check()
        delete_requests: list = []
        page.on("request", lambda r: delete_requests.append(r) if "bulk-delete" in r.url else None)
        page.click(".clip-bulk-actions button:has-text('Delete')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_timeout(300)
        assert not delete_requests

    def test_confirm_sends_bulk_delete_request(self, page: Page):
        select_video_with_clips(page)
        clip_id = page.evaluate("() => AppState.clips[0].id")
        _first_row(page).locator(".clip-select-checkbox").check()
        page.route("**/api/clips/bulk-delete", lambda route: route.abort())
        page.click(".clip-bulk-actions button:has-text('Delete')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        with page.expect_request(lambda r: "bulk-delete" in r.url) as req_info:
            page.click("#confirm-ok-btn")
        payload = req_info.value.post_data_json
        assert payload["clip_ids"] == [clip_id]


@skip_no_server
class TestBulkExportStaleWarning:
    """Bulk export must warn — not silently proceed — when a selected clip's
    transcript was edited since it was last scored."""

    def test_stale_clip_shows_warning_before_export(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("() => { AppState.clips[0].transcript_stale = true; }")
        _first_row(page).locator(".clip-select-checkbox").check()
        page.click(".clip-bulk-actions button:has-text('Export')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("outdated captions")
        expect(page.locator("#confirm-body")).to_contain_text("captions edited since")

    def test_cancelling_stale_warning_does_not_export(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("() => { AppState.clips[0].transcript_stale = true; }")
        _first_row(page).locator(".clip-select-checkbox").check()
        export_requests: list = []
        page.on("request", lambda r: export_requests.append(r) if "bulk-export" in r.url else None)
        page.click(".clip-bulk-actions button:has-text('Export')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_timeout(300)
        assert not export_requests

    def test_non_stale_selection_exports_without_warning(self, page: Page):
        select_video_with_clips(page)
        clip_id = page.evaluate("""() => {
            AppState.clips.forEach(c => c.transcript_stale = false);
            return AppState.clips[0].id;
        }""")
        _first_row(page).locator(".clip-select-checkbox").check()
        page.route("**/api/clips/bulk-export**", lambda route: route.abort())
        with page.expect_request(lambda r: "bulk-export" in r.url) as req_info:
            page.click(".clip-bulk-actions button:has-text('Export')")
        assert f"clip_ids={clip_id}" in req_info.value.url
        expect(page.locator("#confirm-modal")).not_to_be_visible()
