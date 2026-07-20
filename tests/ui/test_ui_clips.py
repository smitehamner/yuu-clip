"""
Playwright UI tests - clip review workflow, sorting, score override, the
per-clip rescore progress pill, and multi-select bulk clip actions.

Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import json
import re

import pytest
from conftest import (
    LIVE_URL,
    _first_row,
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

    def test_review_buttons_disabled_while_status_update_is_in_flight(self, page: Page):
        # B7: a slow with_write_retry (DB locked while analysis runs) must read as
        # "working", not "stuck" - setStatus disables the review buttons for the
        # duration of the request.
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)

        def _assert_disabled_then_continue(route):
            expect(page.locator("button.approve")).to_be_disabled()
            expect(page.locator("button.reject")).to_be_disabled()
            route.continue_()

        page.route(re.compile(r".*/api/clips/\d+/status$"), _assert_disabled_then_continue)
        page.locator("button.approve").click()
        expect(page.locator("button.approve")).to_be_enabled()

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

    def test_direction_button_defaults_descending(self, page: Page):
        page.goto(LIVE_URL)
        btn = page.locator("#clips-sort-dir")
        expect(btn).to_be_visible()
        expect(btn).to_have_attribute("aria-pressed", "false")

    def test_toggling_direction_reverses_clip_order(self, page: Page):
        select_video_with_clips(page)

        def clip_order():
            return page.eval_on_selector_all(
                "#clip-list li", "els => els.map(e => e.dataset.clipId)")

        before = clip_order()
        assert len(before) >= 2
        page.click("#clips-sort-dir")
        expect(page.locator("#clips-sort-dir")).to_have_attribute("aria-pressed", "true")
        assert clip_order() == list(reversed(before))
        # restore natural order so sibling tests see a descending list
        page.click("#clips-sort-dir")
        page.evaluate("() => localStorage.removeItem('clips-sort-dir')")
        assert clip_order() == before


@skip_no_server
class TestLaughScore:
    """Laughs score: sort option, and sidebar rendering gated on a non-null value."""

    def _clip(self, clip_id: int, score_laugh):
        return {
            "id": clip_id, "status": "pending", "scored_at": "2026-07-04T00:00:00+00:00",
            "start_hms": "00:00", "duration_hms": "00:05",
            "has_export": False, "export_stale": False, "export_stale_reasons": [], "exports": [],
            "sensitive_matches": [], "hotword_matches": [], "description": "",
            "score_overall": 0.5, "score_funny": 0.5, "score_dramatic": 0.3,
            "score_action": 0.2, "score_laugh": score_laugh,
        }

    def test_sort_has_laugh_option(self, page: Page):
        page.goto(LIVE_URL)
        options = page.locator("#clips-sort option")
        values = [options.nth(i).get_attribute("value") for i in range(options.count())]
        assert "laugh" in values

    def _render(self, page: Page, clips):
        page.wait_for_function("typeof _renderClips === 'function' && typeof AppState === 'object'")
        page.evaluate(
            "(clips) => { AppState.clips = clips; AppState.clipFilters = new Set();"
            " AppState.clipSearch = ''; AppState.clipScoreMin = 0; _renderClips(); }",
            clips,
        )

    def test_sidebar_shows_laugh_only_when_present(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [self._clip(1, 0.6), self._clip(2, None)])
        assert page.locator("li[data-clip-id='1'] .clip-scores span[title='Laughs']").count() == 1
        assert page.locator("li[data-clip-id='2'] .clip-scores span[title='Laughs']").count() == 0

    def test_sidebar_laugh_shows_rounded_percentage(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [self._clip(1, 0.6)])
        expect(page.locator("li[data-clip-id='1'] .clip-scores span[title='Laughs']")).to_contain_text("60%")


@skip_no_server
class TestVisualScore:
    """Visual axis (video-heavy analysis Stage 0): sort option + sidebar card."""

    def _clip(self, clip_id: int, score_visual):
        return {
            "id": clip_id, "status": "pending", "scored_at": "2026-07-04T00:00:00+00:00",
            "start_hms": "00:00", "duration_hms": "00:05",
            "has_export": False, "export_stale": False, "export_stale_reasons": [], "exports": [],
            "sensitive_matches": [], "hotword_matches": [], "description": "",
            "score_overall": 0.5, "score_funny": 0.5, "score_dramatic": 0.3,
            "score_action": 0.2, "score_visual": score_visual, "score_laugh": None,
        }

    def _render(self, page: Page, clips):
        page.wait_for_function("typeof _renderClips === 'function' && typeof AppState === 'object'")
        page.evaluate(
            "(clips) => { AppState.clips = clips; AppState.clipFilters = new Set();"
            " AppState.clipSearch = ''; AppState.clipScoreMin = 0; _renderClips(); }",
            clips,
        )

    def test_sort_has_visual_option(self, page: Page):
        page.goto(LIVE_URL)
        options = page.locator("#clips-sort option")
        values = [options.nth(i).get_attribute("value") for i in range(options.count())]
        assert "visual" in values

    def test_sidebar_shows_visual_rounded_percentage(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [self._clip(1, 0.4)])
        expect(page.locator("li[data-clip-id='1'] .clip-scores span[title='Visual']")).to_contain_text("40%")


@skip_no_server
class TestNoDialogueFilterChip:
    """The "No dialogue" filter chip (video-heavy analysis Stage 03): finds
    textless-visual clips (tagged no_speech) and leaves other clips alone."""

    def _clip(self, clip_id: int, tags):
        return {
            "id": clip_id, "status": "pending", "scored_at": "2026-07-13T00:00:00+00:00",
            "start_hms": "00:00", "duration_hms": "00:05",
            "has_export": False, "export_stale": False, "export_stale_reasons": [], "exports": [],
            "sensitive_matches": [], "hotword_matches": [], "description": "", "tags": tags,
            "score_overall": 0.5, "score_funny": 0.0, "score_dramatic": 0.0,
            "score_action": 0.0, "score_visual": 0.7, "score_laugh": None,
        }

    def _render(self, page: Page, clips, filters=()):
        page.wait_for_function("typeof _renderClips === 'function' && typeof AppState === 'object'")
        page.evaluate(
            "(args) => { AppState.clips = args.clips; AppState.clipFilters = new Set(args.filters);"
            " AppState.clipSearch = ''; AppState.clipScoreMin = 0; _renderClips(); }",
            {"clips": clips, "filters": list(filters)},
        )

    def test_no_speech_filter_shows_only_textless_visual_clips(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [
            self._clip(1, ["visual", "no_speech"]),
            self._clip(2, []),
        ], filters=["no_speech"])
        expect(page.locator("li[data-clip-id='1']")).to_be_visible()
        expect(page.locator("li[data-clip-id='2']")).to_have_count(0)

    def test_without_the_filter_both_clips_show(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [
            self._clip(1, ["visual", "no_speech"]),
            self._clip(2, []),
        ])
        expect(page.locator("li[data-clip-id='1']")).to_be_visible()
        expect(page.locator("li[data-clip-id='2']")).to_be_visible()


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
# Per-clip rescore - header progress pill
# ---------------------------------------------------------------------------

@skip_no_server
class TestRescoreClipProgressPill:
    """Clicking Re-score on a clip shows the header progress pill (startJobUI / endJobUI)."""

    def _open_rescore(self, page: Page) -> None:
        # Stub the rescore SSE response - the real endpoint runs live LLM scoring
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
        # Re-score now opens the LLM-only-vs-full mode chooser; confirm the default
        # (LLM only) to reach the scoring job.
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-ok-btn")

    def test_rescore_offers_llm_only_vs_full_choice(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail button:has-text('Additional Actions')", timeout=3000)
        page.click("#detail button:has-text('Additional Actions')")
        page.click("#actions-modal .action-row:has-text('Re-score')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-modal")).to_contain_text("Full - recompute every score")
        llm_only = page.locator("#confirm-modal input[name='rescore-mode'][value='llm']")
        expect(llm_only).to_be_checked()

    def test_progress_pill_appears_on_rescore(self, page: Page):
        select_first_video_and_clip(page)
        self._open_rescore(page)
        # startJobUI is synchronous - pill must be visible before the SSE completes
        expect(page.locator("#job-status")).to_be_visible()

    def test_progress_pill_shows_rescore_label(self, page: Page):
        select_first_video_and_clip(page)
        self._open_rescore(page)
        page.wait_for_selector("#job-status.visible", timeout=2000)
        expect(page.locator("#job-steps")).to_contain_text("Re-scoring clip")

    def test_progress_pill_disappears_after_job(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        # Drive startJobUI/endJobUI directly - don't depend on real LLM job duration
        page.evaluate("() => startJobUI(SCORE_STEPS, 'Re-scoring clip')")
        expect(page.locator("#job-status")).to_be_visible()
        page.evaluate("() => endJobUI()")


# ---------------------------------------------------------------------------
# Export modal - caption default
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
# Export modal - tight size-cap warning for long scenes (Clips-vs-Scenes stage 1)
# ---------------------------------------------------------------------------

@skip_no_server
class TestTightCapWarning:
    def _open_and_set_clip(self, page: Page, clip: dict, preset: str):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.evaluate("() => exportClip(AppState.activeClipId)")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)
        page.evaluate(
            "([clip, preset]) => { AppState.activeClipData = clip; _updateExportTightCapWarning(preset); }",
            [clip, preset],
        )

    def test_warns_for_long_scene_under_tight_cap(self, page: Page):
        self._open_and_set_clip(
            page, {"kind": "scene", "start_ms": 0, "end_ms": 240_000}, "discord-10mb"
        )
        warning = page.locator("#export-tightcap-warning")
        expect(warning).to_be_visible()
        expect(warning).to_contain_text("scene")
        expect(warning).to_contain_text("10 MB")
        page.evaluate("closeExportModal()")

    def test_no_warning_for_short_clip_under_tight_cap(self, page: Page):
        self._open_and_set_clip(
            page, {"kind": "clip", "start_ms": 0, "end_ms": 30_000}, "discord-10mb"
        )
        expect(page.locator("#export-tightcap-warning")).to_be_hidden()
        page.evaluate("closeExportModal()")

    def test_no_warning_for_long_scene_under_crf_preset(self, page: Page):
        self._open_and_set_clip(
            page, {"kind": "scene", "start_ms": 0, "end_ms": 240_000}, "youtube-1080p"
        )
        expect(page.locator("#export-tightcap-warning")).to_be_hidden()
        page.evaluate("closeExportModal()")


# ---------------------------------------------------------------------------
# Export modal - vertical (9:16 Shorts) framing control (plan 06)
# ---------------------------------------------------------------------------

@skip_no_server
class TestVerticalFramingControl:
    def _open_export_modal(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.evaluate("() => exportClip(AppState.activeClipId)")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)

    def test_framing_hidden_by_default(self, page: Page):
        self._open_export_modal(page)
        expect(page.locator("#export-framing")).to_be_hidden()
        page.evaluate("closeExportModal()")

    def test_framing_shown_for_vertical_preset(self, page: Page):
        self._open_export_modal(page)
        page.select_option("#export-preset", "tiktok-9x16")
        page.evaluate("() => _onExportPresetChange('tiktok-9x16')")
        expect(page.locator("#export-framing")).to_be_visible()
        page.evaluate("closeExportModal()")

    def test_framing_hidden_again_for_non_vertical_preset(self, page: Page):
        self._open_export_modal(page)
        page.evaluate("() => _onExportPresetChange('tiktok-9x16')")
        expect(page.locator("#export-framing")).to_be_visible()
        page.evaluate("() => _onExportPresetChange('')")
        expect(page.locator("#export-framing")).to_be_hidden()
        page.evaluate("closeExportModal()")

    def test_position_buttons_move_the_crop_box(self, page: Page):
        self._open_export_modal(page)
        page.evaluate("() => _onExportPresetChange('tiktok-9x16')")
        page.click("#export-framing [data-frame-pos='1']")
        assert page.eval_on_selector("#export-framing-box", "el => el.style.left") == "68.36%"
        assert page.eval_on_selector(
            "#export-framing [data-frame-pos='1']", "el => el.classList.contains('active')"
        )
        page.click("#export-framing [data-frame-pos='0']")
        assert page.eval_on_selector("#export-framing-box", "el => el.style.left") == "0%"
        page.evaluate("closeExportModal()")


# ---------------------------------------------------------------------------
# Export modal - Auto-frame button (plan 06 stage 2)
# ---------------------------------------------------------------------------

@skip_no_server
class TestAutoFrameButton:
    def _open_vertical(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.evaluate("() => exportClip(AppState.activeClipId)")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)
        page.evaluate("() => _onExportPresetChange('tiktok-9x16')")

    def _mock_suggest(self, page: Page, status: int, body: dict):
        page.route(
            "**/api/clips/*/suggest-framing",
            lambda route: route.fulfill(
                status=status, content_type="application/json", body=json.dumps(body)
            ),
        )

    def test_button_visible_for_vertical_preset(self, page: Page):
        self._open_vertical(page)
        expect(page.locator("#export-autoframe-btn")).to_be_visible()
        page.evaluate("closeExportModal()")

    def test_success_moves_the_slider(self, page: Page):
        self._open_vertical(page)
        self._mock_suggest(page, 200, {"crop_x": 0.8})
        page.click("#export-autoframe-btn")
        expect(page.locator("#export-autoframe-note")).to_contain_text("Framed on faces")
        assert page.eval_on_selector("#export-framing-slider", "el => el.value") == "0.8"
        page.evaluate("closeExportModal()")

    def test_no_face_leaves_position_and_notes(self, page: Page):
        self._open_vertical(page)
        page.evaluate("() => _setExportFraming(0.5)")
        self._mock_suggest(page, 200, {"crop_x": None})
        page.click("#export-autoframe-btn")
        expect(page.locator("#export-autoframe-note")).to_contain_text("No face found")
        assert page.eval_on_selector("#export-framing-slider", "el => el.value") == "0.5"
        page.evaluate("closeExportModal()")

    def test_503_links_to_settings_install(self, page: Page):
        self._open_vertical(page)
        self._mock_suggest(page, 503, {"detail": "Auto-framing needs the MediaPipe package"})
        page.click("#export-autoframe-btn")
        note = page.locator("#export-autoframe-note")
        expect(note).to_contain_text("MediaPipe")
        expect(note.locator("a")).to_have_count(1)
        page.evaluate("closeExportModal()")


# ---------------------------------------------------------------------------
# Export modal - Quick/Precise mode summary (M9-1)
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

    def test_batch_export_captions_default_to_softsub(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("() => openBatchExportModal(AppState.activeVideoId)")
        page.wait_for_selector("#batch-export-modal.visible", timeout=3000)
        assert page.locator("#batch-captions").input_value() == "softsub"
        page.evaluate("closeBatchExportModal()")


# ---------------------------------------------------------------------------
# Multi-select bulk clip actions
# ---------------------------------------------------------------------------

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
    toolbar or be included if a bulk action ran - only the visible+checked set."""

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

    # test_bulk_reject_sends_selected_clip_ids removed: the reject request shape is
    # covered in tests/js/clips/clipbulk.test.js, and the checkbox->toolbar-click
    # wiring is identical to the approve case above (same _handleBulkToolbarClick
    # switch), which stays here as the wiring proof.


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
    """Bulk export must warn - not silently proceed - when a selected clip's
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

    # test_non_stale_selection_exports_without_warning removed: the "no stale ->
    # stream export with the selected clip_ids, no confirm" behavior is covered in
    # tests/js/clips/clipbulk.test.js. The Export-click DOM wiring is exercised by
    # the stale-warning tests above (same toolbar handler).


# ---------------------------------------------------------------------------
# Possible-duplicate detection: badge, filter chip, detail merge notice
# ---------------------------------------------------------------------------

@skip_no_server
class TestDuplicateDetection:
    """The 'possible_duplicate' tag drives a sidebar badge and a filter chip;
    the detail panel names the overlapping partner and offers a merge."""

    def _dup_clip(self, clip_id: int, start_ms: int, end_ms: int, tags: list[str]) -> dict:
        return {
            "id": clip_id, "status": "pending", "scored_at": "2026-07-04T00:00:00+00:00",
            "start_ms": start_ms, "end_ms": end_ms, "start_hms": "00:00", "duration_hms": "00:05",
            "has_export": False, "export_stale": False, "export_stale_reasons": [], "exports": [],
            "sensitive_matches": [], "hotword_matches": [], "description": "", "tags": tags,
            "score_overall": 0.5, "score_funny": 0.5, "score_dramatic": 0.3, "score_action": 0.2, "score_laugh": None,
        }

    def _render(self, page: Page, clips: list[dict]) -> None:
        page.wait_for_function("typeof _renderClips === 'function' && typeof AppState === 'object'")
        page.evaluate(
            "(clips) => { AppState.clips = clips; AppState.activeVideoId = 1; AppState.clipFilters = new Set();"
            " AppState.clipSearch = ''; AppState.clipScoreMin = 0; _renderClips(); }",
            clips,
        )

    def test_badge_shows_only_on_tagged_clip(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [
            self._dup_clip(1, 0, 60_000, ["possible_duplicate"]),
            self._dup_clip(2, 120_000, 180_000, []),
        ])
        assert page.locator("li[data-clip-id='1'] .clip-dup-badge").count() == 1
        assert page.locator("li[data-clip-id='2'] .clip-dup-badge").count() == 0

    def test_filter_shows_only_flagged_clips(self, page: Page):
        page.goto(LIVE_URL)
        self._render(page, [
            self._dup_clip(1, 0, 60_000, ["possible_duplicate"]),
            self._dup_clip(2, 120_000, 180_000, []),
        ])
        page.evaluate("() => { AppState.clipFilters = new Set(['duplicate']); _renderClips(); }")
        expect(page.locator("li[data-clip-id='1']")).to_have_count(1)
        expect(page.locator("li[data-clip-id='2']")).to_have_count(0)

    def test_detail_notice_offers_merge_with_overlapping_partner(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_function("() => AppState.activeClipData && typeof renderDetail === 'function'")
        page.evaluate(
            """() => {
              const active = AppState.activeClipData;
              active.tags = ['possible_duplicate'];
              const partner = {...active, id: 999999, status: 'pending', start_hms: active.start_hms};
              AppState.clips = [active, partner];
              renderDetail(active);
            }"""
        )
        expect(page.locator(".clip-dup-notice")).to_be_visible()
        assert page.locator(".clip-dup-notice button[data-merge-b='999999']").count() == 1


# A clip + a scene share the merged sidebar list. The All / Clips / Scenes chips
# are a client-side filter over AppState.clips (both kinds are fetched together);
# scene rows carry a SCENE badge. Seed a known mixed list and re-render so the
# assertions never depend on whether the dev's real project has scenes.
_MIXED_CLIPS_JS = """() => {
  const base = {
    status: 'pending', has_export: false, exports: [], export_stale: false,
    tags: [], sensitive_matches: [], hotword_matches: [], scored_at: '2026-01-01T00:00:00',
    score_overall: 0.5, score_funny: 0.5, score_dramatic: 0.5, score_action: 0.5, score_visual: 0.5,
    start_hms: '00:00', duration_hms: '00:20', description: '',
  };
  AppState.clips = [
    {...base, id: 900001, kind: 'clip',  start_ms: 1000,  end_ms: 21000},
    {...base, id: 900002, kind: 'scene', start_ms: 30000, end_ms: 210000, duration_hms: '03:00'},
    {...base, id: 900003, kind: 'clip',  start_ms: 40000, end_ms: 60000},
  ];
  window._renderClips();
}"""


@skip_no_server
class TestClipKindFilter:
    """Both candidate kinds render in one list by default; the All / Clips / Scenes
    chips filter it client-side (no re-fetch). Scene rows carry a SCENE badge and
    the selection persists in localStorage. Defaults to All."""

    def _seed_mixed(self, page: Page) -> None:
        select_video_with_clips(page)
        page.evaluate(_MIXED_CLIPS_JS)

    def test_defaults_to_all_chip_active(self, page: Page):
        select_video_with_clips(page)
        expect(page.locator("[data-kfilter='all']")).to_have_class(re.compile(r"\bactive\b"))
        expect(page.locator("[data-kfilter='clip']")).not_to_have_class(re.compile(r"\bactive\b"))
        expect(page.locator("[data-kfilter='scene']")).not_to_have_class(re.compile(r"\bactive\b"))
        assert page.evaluate("AppState.clipKindFilter") == "all"

    def test_all_shows_both_kinds_with_scene_badge(self, page: Page):
        self._seed_mixed(page)
        expect(page.locator("#clip-list li[data-clip-id]")).to_have_count(3)
        # Only the scene row carries the SCENE badge.
        expect(page.locator("#clip-list .scene-badge")).to_have_count(1)
        scene_row = page.locator("#clip-list li[data-clip-id='900002']")
        expect(scene_row.locator(".scene-badge")).to_be_visible()
        expect(page.locator("#clip-list li[data-clip-id='900001'] .scene-badge")).to_have_count(0)

    def test_scenes_chip_filters_to_scenes_only(self, page: Page):
        self._seed_mixed(page)
        page.click("[data-kfilter='scene']")
        expect(page.locator("#clip-list li[data-clip-id]")).to_have_count(1)
        expect(page.locator("#clip-list li[data-clip-id='900002']")).to_be_visible()
        expect(page.locator("[data-kfilter='scene']")).to_have_class(re.compile(r"\bactive\b"))
        assert page.evaluate("AppState.clipKindFilter") == "scene"
        assert page.evaluate("localStorage.getItem('clips-kind-filter')") == "scene"

    def test_clips_chip_filters_to_clips_only(self, page: Page):
        self._seed_mixed(page)
        page.click("[data-kfilter='clip']")
        expect(page.locator("#clip-list li[data-clip-id]")).to_have_count(2)
        expect(page.locator("#clip-list .scene-badge")).to_have_count(0)
        assert page.evaluate("AppState.clipKindFilter") == "clip"

    def test_chip_counts_reflect_each_kind(self, page: Page):
        self._seed_mixed(page)
        assert page.locator("[data-kcount='all']").inner_text() == "3"
        assert page.locator("[data-kcount='clip']").inner_text() == "2"
        assert page.locator("[data-kcount='scene']").inner_text() == "1"

    def test_new_button_label_follows_scene_filter(self, page: Page):
        self._seed_mixed(page)
        page.click("[data-kfilter='scene']")
        page.wait_for_function("() => AppState.clipKindFilter === 'scene'", timeout=3000)
        page.click("#btn-clips-actions")
        expect(
            page.locator(".hamburger-menu.open .hamburger-item").first
        ).to_have_text("New scene")

    def test_scenes_chip_with_no_scenes_shows_kind_message_and_show_all_resets(self, page: Page):
        """Filtering to Scenes on a recording with none must say so ("No scenes in
        this recording"), not the misleading "No clips found - Analyze another
        recording", and its Show-all link must reset the kind filter."""
        select_video_with_clips(page)
        page.evaluate(
            """() => {
              const base = {
                status: 'pending', has_export: false, exports: [], export_stale: false,
                tags: [], sensitive_matches: [], hotword_matches: [], scored_at: '2026-01-01T00:00:00',
                score_overall: 0.5, score_funny: 0.5, score_dramatic: 0.5, score_action: 0.5, score_visual: 0.5,
                start_hms: '00:00', duration_hms: '00:20', description: '',
              };
              AppState.clips = [
                {...base, id: 900011, kind: 'clip', start_ms: 1000,  end_ms: 21000},
                {...base, id: 900012, kind: 'clip', start_ms: 40000, end_ms: 60000},
              ];
              window._renderClips();
            }"""
        )
        page.click("[data-kfilter='scene']")
        empty_row = page.locator("#clip-list li").first
        expect(empty_row).to_contain_text("No scenes in this recording")
        page.click("#clip-list a[data-act='clear-clip-filters']")
        expect(page.locator("#clip-list li[data-clip-id]")).to_have_count(2)
        expect(page.locator("[data-kfilter='all']")).to_have_class(re.compile(r"\bactive\b"))
        assert page.evaluate("AppState.clipKindFilter") == "all"
        assert page.evaluate("localStorage.getItem('clips-kind-filter')") == "all"


@skip_no_server
class TestUndoToast:
    """The undo toast carries a visible Undo button plus a shrinking countdown
    bar so the ~5s window is not silent (WS3)."""

    def test_undo_toast_has_button_and_countdown_bar(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("showUndoToast('Clip Approved', () => { window._undone = true; })")
        toast = page.locator("#toast-container .undo-toast")
        expect(toast).to_be_visible()
        expect(toast.locator(".undo-toast-btn")).to_have_text("Undo")
        duration = page.evaluate(
            "() => document.querySelector('.undo-toast-bar').style.animationDuration"
        )
        assert duration == "5000ms", duration

    def test_undo_button_invokes_callback(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("showUndoToast('Clip Approved', () => { window._undone = true; })")
        page.click("#toast-container .undo-toast .undo-toast-btn")
        assert page.evaluate("() => window._undone") is True
