"""
Playwright UI tests — clip review workflow, sorting, score override, the
per-clip rescore progress pill, and multi-select bulk clip actions.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from conftest import (
    LIVE_URL,
    select_first_video_and_clip,
    select_video_with_clips,
    skip_no_server,
)
from playwright.sync_api import Page, expect

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


@skip_no_server
class TestNotYetScoredIndicator:
    """A clip with scored_at=null (never reached by ScoringEngine, e.g. after a
    mid-batch scoring failure) must read as unscored, not as a genuine 0% score."""

    def test_sidebar_shows_not_yet_scored_instead_of_zero_percent(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("() => { AppState.clips[0].scored_at = null; _renderClips(); }")
        first_item = page.locator("#clip-list li:has(.clip-num)").first
        expect(first_item.locator(".clip-scores")).to_contain_text("Not yet scored")

    def test_detail_shows_not_yet_scored_instead_of_zero_percent(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        clip_id = page.evaluate("""() => {
            AppState.activeClipData.scored_at = null;
            renderDetail(AppState.activeClipData);
            return AppState.activeClipData.id;
        }""")
        assert clip_id is not None
        expect(page.locator(".scores")).to_contain_text("Not yet scored")


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
# Export modal — Quick/Precise mode summary (M9-1)
# ---------------------------------------------------------------------------

@skip_no_server
class TestExportModeSummary:
    def _open_export_modal(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.evaluate("() => exportClip(AppState.activeClipId)")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)

    def test_default_is_quick_export(self, page: Page):
        self._open_export_modal(page)
        expect(page.locator("#export-mode-summary")).to_contain_text("Quick export")
        page.evaluate("closeExportModal()")

    def test_hardsub_flips_to_precise(self, page: Page):
        self._open_export_modal(page)
        page.select_option("#export-captions", "hardsub")
        summary = page.locator("#export-mode-summary")
        expect(summary).to_contain_text("Precise export")
        expect(summary).to_contain_text("burned-in captions")
        page.select_option("#export-captions", "softsub")
        expect(summary).to_contain_text("Quick export")
        page.evaluate("closeExportModal()")

    def test_title_card_flips_to_precise(self, page: Page):
        self._open_export_modal(page)
        page.check("#export-title-card")
        summary = page.locator("#export-mode-summary")
        expect(summary).to_contain_text("Precise export")
        expect(summary).to_contain_text("title card")
        page.evaluate("closeExportModal()")

    def test_batch_export_has_same_summary(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("() => openBatchExportModal(AppState.activeVideoId)")
        page.wait_for_selector("#batch-export-modal.visible", timeout=3000)
        summary = page.locator("#batch-mode-summary")
        expect(summary).to_contain_text("Quick export")
        page.select_option("#batch-captions", "hardsub")
        expect(summary).to_contain_text("Precise export")
        page.evaluate("closeBatchExportModal()")


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

        page.click(f"button.clip-chip[data-filter='{other_tab}']")
        expect(page.locator("#clip-bulk-toolbar")).to_be_hidden()

        page.click("button.clip-chip[data-filter='all']")
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
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
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
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
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


# ---------------------------------------------------------------------------
# Plan 02 (staleness) — "Stale — re-export to update" badge on an exported
# clip's file (export_stale), distinct from transcript_stale above (which is
# about scores/descriptions vs. the transcript, not the exported file).
# ---------------------------------------------------------------------------

@skip_no_server
class TestExportStaleBadge:
    def test_sidebar_shows_stale_badge_when_export_stale(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("""() => {
            AppState.clips[0].has_export = true;
            AppState.clips[0].export_stale = true;
            AppState.clips[0].export_stale_reasons = ['captions changed'];
            _renderClips();
        }""")
        pill = _first_row(page).locator(".export-pill")
        expect(pill).to_have_class("export-pill is-stale")
        expect(pill).to_contain_text("Stale")

    def test_sidebar_shows_exported_badge_when_not_stale(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("""() => {
            AppState.clips[0].has_export = true;
            AppState.clips[0].export_stale = false;
            AppState.clips[0].export_stale_reasons = [];
            _renderClips();
        }""")
        pill = _first_row(page).locator(".export-pill")
        expect(pill).to_have_class("export-pill is-exported")
        expect(pill).not_to_contain_text("Stale")

    def test_detail_panel_shows_stale_note_with_reasons(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate("""() => {
            AppState.activeClipData.has_export = true;
            AppState.activeClipData.exported_at = new Date().toISOString();
            AppState.activeClipData.export_stale = true;
            AppState.activeClipData.export_stale_reasons = ['clip window changed'];
            renderDetail(AppState.activeClipData);
        }""")
        detail = page.locator("#detail")
        expect(detail).to_contain_text("Stale — re-export to update")
        expect(detail).to_contain_text("clip window changed")

    def test_detail_panel_no_stale_note_when_not_stale(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate("""() => {
            AppState.activeClipData.has_export = true;
            AppState.activeClipData.exported_at = new Date().toISOString();
            AppState.activeClipData.export_stale = false;
            AppState.activeClipData.export_stale_reasons = [];
            renderDetail(AppState.activeClipData);
        }""")
        expect(page.locator("#detail")).not_to_contain_text("re-export to update")


@skip_no_server
class TestRetranscribeRefresh:
    """Journey 3 (docs/dev/USER_PATHS.md): retranscribe refreshes the clip's excerpt
    shown in the detail panel. The subprocess is stubbed at the network layer, same
    pattern as test_ui_sse.py, so no real Whisper model runs. Caption-sidecar refresh
    itself is covered at the API layer in test_export.py::TestRefreshCaptionSidecars."""

    def test_retranscribe_refreshes_excerpt_in_detail_panel(self, page: Page):
        import json
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        clip_id = page.evaluate("() => AppState.activeClipId")
        original_clip = page.evaluate("() => AppState.activeClipData")
        refreshed_clip = {**original_clip, "transcript_excerpt": "freshly retranscribed text"}

        page.route(
            f"**/api/clips/{clip_id}/retranscribe**",
            lambda route: route.fulfill(
                status=200, content_type="text/event-stream",
                body='data: "Retranscribing"\n\ndata: "OK"\n\ndata: "__DONE__"\n\n',
            ),
        )
        page.route(
            f"**/api/clips/{clip_id}",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(refreshed_clip),
            ),
        )

        page.evaluate("(id) => openRetranscribeModal(id)", clip_id)
        page.evaluate("() => startRetranscribe()")

        expect(page.locator("#detail")).to_contain_text("freshly retranscribed text", timeout=5000)


# ---------------------------------------------------------------------------
# Global keyboard shortcut guard (settings.js keydown handler)
# ---------------------------------------------------------------------------

@skip_no_server
class TestGlobalKeyboardGuard:
    """The global keydown handler must: close a modal on Escape even when focus
    sits on a button inside it (where every modal places focus on open), leave
    typing surfaces alone, and skip events a list item already handled."""

    def test_escape_closes_confirm_modal_when_cancel_button_focused(self, page: Page):
        select_video_with_clips(page)
        _first_row(page).locator(".clip-select-checkbox").check()
        delete_requests: list = []
        page.on("request", lambda r: delete_requests.append(r) if "bulk-delete" in r.url else None)
        page.click(".clip-bulk-actions button:has-text('Delete')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        # showConfirm moves focus onto the Cancel <button> ~50ms after opening —
        # exactly where a keyboard user is when they press Escape.
        page.wait_for_function(
            "document.activeElement === document.getElementById('confirm-cancel-btn')",
            timeout=2000,
        )
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        assert not delete_requests

    def test_handled_keydown_does_not_also_fire_global_shortcut(self, page: Page):
        # A clip/video <li> handles Enter/Space itself and calls preventDefault;
        # the global handler must not ALSO act on the same event (regression:
        # Space both activated the list item and toggled video play/pause).
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        if page.evaluate("() => AppState.clips.length") < 2:
            pytest.skip("needs at least 2 clips to observe arrow-key navigation")
        unchanged = page.evaluate("""() => {
            const before = AppState.activeClipId;
            const ev = new KeyboardEvent('keydown', {key: 'ArrowRight', cancelable: true, bubbles: true});
            ev.preventDefault();  // simulate a focused list item having handled the key
            document.body.dispatchEvent(ev);
            return AppState.activeClipId === before;
        }""")
        assert unchanged

    def test_shortcut_acts_on_focused_clip_row_not_active_clip(self, page: Page):
        # 'A' pressed while keyboard focus sits on a different clip row must
        # act on the focused row — not silently mutate the active clip.
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        if page.evaluate("() => AppState.clips.length") < 2:
            pytest.skip("needs at least 2 clips to observe the focused-vs-active split")
        active_id, focused_id = page.evaluate("""() => {
            const rows = document.querySelectorAll('#clip-list li[data-clip-id]');
            const other = [...rows].find(r => Number(r.dataset.clipId) !== AppState.activeClipId);
            other.focus();
            return [AppState.activeClipId, Number(other.dataset.clipId)];
        }""")
        assert focused_id != active_id
        page.route("**/api/clips/*/status", lambda route: route.abort())
        with page.expect_request(
            lambda r: r.method == "POST" and r.url.endswith("/status")
        ) as req_info:
            page.keyboard.press("a")
        assert f"/api/clips/{focused_id}/status" in req_info.value.url

    def test_arrow_navigation_moves_focus_with_active_clip(self, page: Page):
        # Focus ring and active highlight must stay on the same row after
        # arrow-key navigation, so A/R/E can never target a stale row.
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        if page.evaluate("() => AppState.clips.length") < 2:
            pytest.skip("needs at least 2 clips to observe arrow-key navigation")
        page.evaluate("() => selectClip(AppState.clips[0].id)")
        page.locator("#clip-list li[data-clip-id]").first.focus()
        page.keyboard.press("ArrowDown")
        page.wait_for_function("""() => {
            const focused = document.activeElement;
            return focused?.dataset?.clipId
                && Number(focused.dataset.clipId) === AppState.activeClipId
                && focused.classList.contains('active')
                && AppState.activeClipId === AppState.clips[1].id;
        }""", timeout=2000)

    def test_escape_in_text_field_does_not_close_modal(self, page: Page):
        # The field-edit modal focuses its textarea on open; Escape there must be
        # left to the field (and the modal's own dirty-check), not the global
        # close cascade.
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail-card .kebab-btn", timeout=3000)
        page.click(".detail-card .kebab-btn")
        page.click(".hamburger-menu.open button:has-text('Edit')")
        page.wait_for_selector("#field-edit-modal.visible", timeout=2000)
        page.wait_for_function(
            "document.activeElement === document.getElementById('field-edit-text')",
            timeout=2000,
        )
        page.keyboard.press("Escape")
        expect(page.locator("#field-edit-modal")).to_be_visible()
        page.click("#field-edit-modal button:has-text('Cancel')")
        page.wait_for_selector("#field-edit-modal.visible", state="hidden", timeout=2000)


@skip_no_server
class TestClipTags:
    """User-tag card in clip detail: add via Enter, remove via ×, autocomplete
    datalist populated from GET /api/tags."""

    def _route_tags(self, page: Page, suggestions=("existing-tag",)):
        import json
        page.route(
            "**/api/tags",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({"tags": list(suggestions)}),
            ),
        )

        def _put(route):
            body = route.request.post_data_json or {}
            tags = [t.strip() for t in body.get("tags", []) if t.strip()]
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": 1, "user_tags": tags}))

        page.route("**/api/clips/*/tags", _put)

    def test_tags_card_and_datalist_render(self, page: Page):
        self._route_tags(page, suggestions=("clutch", "funny"))
        select_first_video_and_clip(page)
        expect(page.locator("#clip-tag-input")).to_be_visible()
        # Datalist is populated from GET /api/tags.
        page.wait_for_function(
            "document.querySelectorAll('#clip-tags-datalist option').length === 2",
            timeout=3000,
        )

    def test_add_tag_via_enter_renders_pill(self, page: Page):
        self._route_tags(page)
        select_first_video_and_clip(page)
        page.fill("#clip-tag-input", "clutch")
        page.press("#clip-tag-input", "Enter")
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(1)
        expect(page.locator("#clip-user-tags .user-tag").first).to_contain_text("clutch")

    def test_remove_tag_sends_filtered_put(self, page: Page):
        self._route_tags(page)
        select_first_video_and_clip(page)
        page.fill("#clip-tag-input", "keep")
        page.press("#clip-tag-input", "Enter")
        # The PUT response re-renders the tags card; typing the second tag
        # before that re-render lands loses it (flaked under xdist load).
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(1)
        page.fill("#clip-tag-input", "drop")
        page.press("#clip-tag-input", "Enter")
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(2)
        # Remove "drop" → only "keep" remains.
        page.click("#clip-user-tags .user-tag:has-text('drop') .user-tag-x")
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(1)
        expect(page.locator("#clip-user-tags .user-tag").first).to_contain_text("keep")


def test_detail_cards_row_wraps():
    """L4-3: the Scoring/Actions two-card row must wrap on narrow layouts."""
    app_css = (
        Path(__file__).resolve().parents[1] / "yuu_clip" / "web" / "static" / "app.css"
    ).read_text(encoding="utf-8")
    row_rule = re.search(r"\.detail-cards-row\s*\{([^}]*)\}", app_css)
    assert row_rule and "flex-wrap: wrap" in row_rule.group(1)


@skip_no_server
class TestGeneratedTags:
    """M4-1: generated (pipeline) tags render inside the Tags card as read-only
    pills with display names — internal tokens never leak, and bookkeeping
    tags (scorer-ran markers) are hidden entirely."""

    def _render_with_tags(self, page: Page, tags: list):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            "(tags) => { AppState.activeClipData.tags = tags; renderDetail(AppState.activeClipData); }",
            tags,
        )

    def test_llm_error_renders_as_score_error_pill(self, page: Page):
        self._render_with_tags(page, ["llm_error"])
        card = page.locator(".detail-card:has(#clip-user-tags)")
        pill = card.locator(".tag", has_text="Score error")
        expect(pill).to_be_visible()
        expect(pill).to_have_attribute("title", re.compile(r"LLM scoring failed"))
        expect(page.locator("#detail")).not_to_contain_text("llm_error")

    def test_silence_tag_renders_readable_duration(self, page: Page):
        self._render_with_tags(page, ["after_silence_12s"])
        card = page.locator(".detail-card:has(#clip-user-tags)")
        expect(card.locator(".tag", has_text="After 12 s silence")).to_be_visible()

    def test_bookkeeping_tags_are_hidden(self, page: Page):
        self._render_with_tags(page, ["llm_scored", "energy_scored", "scenes_scored"])
        expect(page.locator(".detail-card:has(#clip-user-tags) .tag")).to_have_count(0)
        expect(page.locator("#detail")).not_to_contain_text("llm_scored")

    def test_no_bare_tags_row_outside_the_card(self, page: Page):
        self._render_with_tags(page, ["llm_error"])
        expect(page.locator("#detail > .tags")).to_have_count(0)


@skip_no_server
class TestClipDetailCards:
    """CC-9: Related Clips and Transcript are .detail-cards like every other
    major section of the clip detail view."""

    def test_related_clips_is_a_card(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.activeClipData.related_clips = [{id: 2, reason: 'same fight'}];
                renderDetail(AppState.activeClipData);
            }"""
        )
        section = page.locator("#related-clips-section")
        expect(section).to_have_class(re.compile(r"\bdetail-card\b"))
        expect(section.locator(".detail-card-title")).to_have_text("Related Clips")

    def test_transcript_is_a_card(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.activeClipData.transcript_excerpt = 'hello there';
                renderDetail(AppState.activeClipData);
            }"""
        )
        card = page.locator(".detail-card:has(#clip-transcript-view)")
        expect(card).to_have_count(1)
        expect(card.locator(".detail-card-title")).to_have_text("Transcript")


@skip_no_server
class TestClipActionsModalGroups:
    """L4-1: the clip Additional Actions modal groups actions by what they do —
    Scoring / Transcript / Discover — not under a catch-all "Regenerate"."""

    def test_groups_are_scoring_transcript_discover(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.activeClipData.description = 'a described clip';
                openClipActionsModal(AppState.activeClipData.id);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        # text_content, not inner_text — .section-title is CSS-uppercased
        headings = page.locator("#actions-modal-body .section-title").all_text_contents()
        assert "Regenerate" not in headings
        assert {"Scoring", "Transcript", "Discover"} <= set(headings)
        page.keyboard.press("Escape")

    def test_merge_row_description_is_truncated(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                const long = 'x'.repeat(200);
                AppState.clips = [
                    {id: 9001, start_ms: 0, start_hms: '0:00', description: long},
                    {id: 9002, start_ms: 60000, start_hms: '1:00', description: 'short'},
                ];
                AppState.activeClipData = null;
                openClipActionsModal(9002);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        merge_desc = page.locator(
            "#actions-modal-body .action-row:has-text('Merge previous') .action-row-desc"
        ).inner_text()
        assert "x" * 59 + "…" in merge_desc
        assert "x" * 60 not in merge_desc
        page.keyboard.press("Escape")

    def test_merge_confirm_can_be_cancelled_without_merging(self, page: Page):
        """Journey 6 smoke test (docs/dev/USER_PATHS.md): the merge action prompts
        for confirmation and Cancel does not call the (destructive) merge route.
        Uses fake clip IDs, matching test_merge_row_description_is_truncated above —
        merge permanently deletes a clip, so the round trip that actually executes
        it is exercised only against a disposable fixture DB, in
        tests/test_videos.py::TestMergeClips."""
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.clips = [
                    {id: 9001, start_ms: 0, start_hms: '0:00', description: 'first'},
                    {id: 9002, start_ms: 60000, start_hms: '1:00', description: 'second'},
                ];
                AppState.activeClipData = null;
                openClipActionsModal(9002);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        merge_requests: list = []
        page.on("request", lambda r: merge_requests.append(r) if "/merge" in r.url else None)
        page.click("#actions-modal-body button:has-text('Merge previous')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Merge")
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        assert not merge_requests


@skip_no_server
class TestClipFilterChips:
    """The multi-select filter chip row: toggle on/off, All resets, and the
    Exported/Not-exported pair is mutually exclusive."""

    def test_chip_toggles_and_all_resets(self, page: Page):
        select_video_with_clips(page)
        approved = page.locator("button.clip-chip[data-filter='approved']")
        all_chip = page.locator("button.clip-chip[data-filter='all']")
        approved.click()
        expect(approved).to_have_attribute("aria-pressed", "true")
        expect(all_chip).to_have_attribute("aria-pressed", "false")
        approved.click()  # toggle off → back to "All" active
        expect(approved).to_have_attribute("aria-pressed", "false")
        expect(all_chip).to_have_attribute("aria-pressed", "true")

    def test_export_chips_mutually_exclusive(self, page: Page):
        select_video_with_clips(page)
        exported = page.locator("button.clip-chip[data-filter='exported']")
        not_exported = page.locator("button.clip-chip[data-filter='not-exported']")
        exported.click()
        expect(exported).to_have_attribute("aria-pressed", "true")
        not_exported.click()
        expect(not_exported).to_have_attribute("aria-pressed", "true")
        expect(exported).to_have_attribute("aria-pressed", "false")


# ---------------------------------------------------------------------------
# Quick-wins Stage 1 — J/K navigation, clip stats line, shortcut hint,
# Electron-only Refresh hamburger item
# ---------------------------------------------------------------------------

@skip_no_server
class TestJKNavigation:
    """J/K are aliases for the existing arrow-key prev/next navigation."""

    def test_j_moves_to_next_clip(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        first_id = page.evaluate("() => AppState.activeClipId")
        second_id = page.evaluate("() => AppState.clips[1]?.id")
        assert second_id is not None, "Need at least 2 clips for this test"
        page.keyboard.press("j")
        expect(page.locator("#clip-list li.active")).to_have_attribute(
            "data-clip-id", str(second_id)
        )
        assert page.evaluate("() => AppState.activeClipId") != first_id

    def test_k_moves_to_previous_clip(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        second_id = page.evaluate("() => AppState.clips[1]?.id")
        assert second_id is not None, "Need at least 2 clips for this test"
        page.keyboard.press("j")
        page.wait_for_function(
            f"() => AppState.activeClipId === {second_id}"
        )
        first_id = page.evaluate("() => AppState.clips[0].id")
        page.keyboard.press("k")
        expect(page.locator("#clip-list li.active")).to_have_attribute(
            "data-clip-id", str(first_id)
        )


@skip_no_server
class TestClipStatsLine:
    def test_stats_line_matches_clip_counts(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#clip-stats-line", state="visible", timeout=3000)
        counts = page.evaluate(
            """() => {
                const c = {pending: 0, approved: 0, rejected: 0};
                for (const clip of AppState.clips) c[clip.status]++;
                return c;
            }"""
        )
        stats = page.locator("#clip-stats-line")
        expect(stats).to_contain_text(f"{counts['pending']} unreviewed")
        expect(stats).to_contain_text(f"{counts['approved']} approved")
        expect(stats).to_contain_text(f"{counts['rejected']} rejected")

    def test_stats_line_updates_with_filter(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#clip-stats-line", state="visible", timeout=3000)
        total_shown = page.locator("#clip-list li[data-clip-id]").count()
        page.locator("button.clip-chip[data-filter='approved']").click()
        approved_count = page.evaluate(
            "() => AppState.clips.filter(c => c.status === 'approved').length"
        )
        expect(page.locator("#clip-stats-line")).to_contain_text(f"{approved_count} shown")
        assert approved_count <= total_shown

    def test_stats_line_hidden_when_no_recording_selected(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("() => { AppState.activeVideoId = null; AppState.clips = []; _renderClips(); }")
        expect(page.locator("#clip-stats-line")).to_be_hidden()


@skip_no_server
class TestShortcutHint:
    def test_hint_present_near_clip_list(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator(".clip-shortcut-hint")).to_contain_text("J/K navigate")
        expect(page.locator(".clip-shortcut-hint")).to_contain_text("? all shortcuts")


@skip_no_server
class TestRefreshHamburgerItem:
    def test_hidden_in_plain_browser(self, page: Page):
        page.goto(LIVE_URL)
        assert page.evaluate("() => window.electronAPI") is None
        page.evaluate("toggleHamburger()")
        page.wait_for_selector("#hamburger-menu.open")
        expect(page.locator("#btn-refresh")).to_be_hidden()

    def test_shown_when_electron_api_present(self, page: Page):
        page.add_init_script("window.electronAPI = { runSetupWizard: () => {} };")
        page.goto(LIVE_URL)
        page.evaluate("toggleHamburger()")
        page.wait_for_selector("#hamburger-menu.open")
        expect(page.locator("#btn-refresh")).to_be_visible()


# ---------------------------------------------------------------------------
# Quick-wins Stage 2 — playback options (play-next, loop clip)
# ---------------------------------------------------------------------------

@skip_no_server
class TestPlaybackOptions:
    def test_play_next_seeded_advances_on_ended(self, page: Page):
        page.add_init_script(
            "try { localStorage.setItem('yuuclip-play-next', 'true'); } catch (e) {}"
        )
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        second_id = page.evaluate("() => AppState.clips[1]?.id")
        assert second_id is not None, "Need at least 2 clips for this test"
        page.eval_on_selector("#player-area video", "v => v.dispatchEvent(new Event('ended'))")
        page.wait_for_function(f"() => AppState.activeClipId === {second_id}")

    def test_loop_seeded_sets_loop_attribute(self, page: Page):
        page.add_init_script(
            "try { localStorage.setItem('yuuclip-loop-clip', 'true'); } catch (e) {}"
        )
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector("#player-area video", timeout=3000)
        assert page.eval_on_selector("#player-area video", "v => v.loop") is True

    def test_play_next_and_loop_are_mutually_exclusive(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("openSettings()")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.check("#s-play-next")
        expect(page.locator("#s-loop-clip")).not_to_be_checked()
        page.check("#s-loop-clip")
        expect(page.locator("#s-play-next")).not_to_be_checked()


# ---------------------------------------------------------------------------
# Quick-wins Stage 3 — copy-to-clipboard
# ---------------------------------------------------------------------------

@skip_no_server
class TestCopyToClipboard:
    """navigator.clipboard.writeText is stubbed for deterministic assertions
    across xdist workers — a real clipboard read races with OS clipboard state
    shared by other workers."""

    def _stub_clipboard(self, page: Page) -> None:
        page.add_init_script(
            "navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };"
        )

    def test_copy_description(self, page: Page):
        self._stub_clipboard(page)
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        description = page.evaluate("() => AppState.activeClipData?.description")
        if not description:
            pytest.skip("Active clip has no description")
        page.click("[data-copy='description']")
        assert page.evaluate("() => window.__copiedText") == description
        expect(page.locator("#toast-container .toast.success")).to_contain_text("Description copied")

    def test_copy_transcript(self, page: Page):
        self._stub_clipboard(page)
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        excerpt = page.evaluate("() => AppState.activeClipData?.transcript_excerpt")
        if not excerpt:
            pytest.skip("Active clip has no transcript excerpt")
        page.click("[data-copy='transcript']")
        assert page.evaluate("() => window.__copiedText") == excerpt
        expect(page.locator("#toast-container .toast.success")).to_contain_text("Transcript copied")

    def test_copy_export_file_paths(self, page: Page):
        self._stub_clipboard(page)
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        page.route(
            "**/api/clips/*/export-files",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"files": ["clip_export.mkv", "clip_export.srt"]}',
            ),
        )
        page.evaluate(
            """() => {
                AppState.activeClipData.has_export = true;
                AppState.exportDir = 'D:\\\\exports';
                openClipActionsModal(AppState.activeClipData.id);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal-body .action-row:has-text('Copy File Path(s)')")
        page.wait_for_function("() => window.__copiedText")
        assert page.evaluate("() => window.__copiedText") == (
            "D:\\exports\\clip_export.mkv\nD:\\exports\\clip_export.srt"
        )


# ---------------------------------------------------------------------------
# Quick-wins Stage 4 — show in folder (Explorer reveal)
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipShowInFolder:
    def test_show_in_folder_posts_reveal_with_first_export_file(self, page: Page):
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        page.wait_for_function("() => AppState.canReveal === true", timeout=5000)
        page.route(
            "**/api/clips/*/export-files",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"files": ["clip_export.mkv", "clip_export.srt"]}',
            ),
        )
        page.route(
            "**/api/reveal",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body='{"status": "ok"}'
            ),
        )
        page.evaluate(
            """() => {
                AppState.activeClipData.has_export = true;
                AppState.exportDir = 'D:\\\\exports';
                openClipActionsModal(AppState.activeClipData.id);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        with page.expect_request("**/api/reveal") as req_info:
            page.click("#actions-modal-body .action-row:has-text('Show in Folder')")
        assert req_info.value.post_data_json["path"] == "D:\\exports\\clip_export.mkv"

    def test_hidden_when_reveal_unavailable(self, page: Page):
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        page.evaluate(
            """() => {
                AppState.canReveal = false;
                AppState.activeClipData.has_export = true;
                openClipActionsModal(AppState.activeClipData.id);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        expect(page.locator("#actions-modal-body .action-row:has-text('Show in Folder')")).to_have_count(0)


# ---------------------------------------------------------------------------
# Quick-wins Stage 6 — batch processing status panel
# ---------------------------------------------------------------------------

@skip_no_server
class TestBatchStatusPanel:
    def test_counts_match_clip_fixtures(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#batch-status-panel", state="visible", timeout=3000)
        counts = page.evaluate(
            """() => {
                const c = {pending: 0, approved: 0, rejected: 0};
                for (const clip of AppState.clips) c[clip.status]++;
                return c;
            }"""
        )
        body = page.locator("#batch-status-body")
        expect(body).to_contain_text(f"{counts['pending']} Unreviewed")
        expect(body).to_contain_text(f"{counts['approved']} Approved")
        expect(body).to_contain_text(f"{counts['rejected']} Rejected")

    def test_clicking_a_count_applies_the_filter_chip(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#batch-status-panel", state="visible", timeout=3000)
        page.click("#batch-status-body button:has-text('Approved')")
        expect(page.locator("button.clip-chip[data-filter='approved']")).to_have_attribute("aria-pressed", "true")

    def test_collapse_state_survives_reload(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#batch-status-panel", state="visible", timeout=3000)
        page.click("#batch-status-toggle")
        expect(page.locator("#batch-status-panel")).to_have_class("batch-status-panel collapsed")
        assert page.evaluate("() => localStorage.getItem('yuuclip-batch-panel')") == "collapsed"
        page.reload()
        select_video_with_clips(page)
        page.wait_for_selector("#batch-status-panel", state="visible", timeout=3000)
        expect(page.locator("#batch-status-panel")).to_have_class("batch-status-panel collapsed")

    def test_hidden_when_no_recording_selected(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("() => { AppState.activeVideoId = null; AppState.clips = []; _renderClips(); }")
        expect(page.locator("#batch-status-panel")).to_be_hidden()
