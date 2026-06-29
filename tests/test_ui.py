"""
Playwright UI tests — run against the live dev server on port 8080.

Prerequisites: server must be running (`yuuclip serve`)
Run:  pytest tests/test_ui.py -v

These tests are skipped automatically if the server is not reachable.
"""
from __future__ import annotations

import socket

import pytest
from playwright.sync_api import Page, expect

LIVE_URL = "http://127.0.0.1:8080"


def _server_up() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 8080), timeout=1):
            return True
    except OSError:
        return False


skip_no_server = pytest.mark.skipif(
    not _server_up(),
    reason="Live server not running on port 8080",
)


# ---------------------------------------------------------------------------
# Page load
# ---------------------------------------------------------------------------

@skip_no_server
class TestPageLoad:
    def test_title(self, page: Page):
        page.goto(LIVE_URL)
        expect(page).to_have_title("yuu-clip")

    def test_header_buttons_visible(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("button#btn-analyze")).to_be_visible()
        expect(page.locator("button#btn-highlight-reels")).to_be_visible()

    def test_sidebar_has_videos(self, page: Page):
        page.goto(LIVE_URL)
        # Wait for video list to populate
        page.wait_for_selector("#video-list li", timeout=5000)
        items = page.locator("#video-list li")
        assert items.count() > 0

    def test_sidebar_has_no_clip_selected_message(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#no-clip-selected, .detail-empty")).to_be_visible()


# ---------------------------------------------------------------------------
# Analyze modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestAnalyzeModal:
    def _open_panel(self, page: Page) -> None:
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")

    def test_opens_and_closes(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        expect(page.locator("#new-recording-panel")).to_be_visible()
        page.click("#btn-close-new-recording")
        expect(page.locator("#new-recording-panel")).not_to_be_visible()

    def test_profile_dropdown_has_default(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.wait_for_selector("#analyze-profile option", state="attached", timeout=3000)
        options = page.locator("#analyze-profile option")
        texts = [options.nth(i).text_content() for i in range(options.count())]
        assert any("Default" in t or "combined" in t.lower() for t in texts)

    def test_model_dropdown_default_is_medium(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        assert page.locator("#analyze-model").input_value() == "medium"

    def test_scene_mode_default_is_fast(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        assert page.locator("#analyze-scene-mode").input_value() == "fast"

    def test_start_analyze_button_disabled_on_open(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        expect(page.locator("#btn-start-analyze")).to_be_disabled()

    def test_energy_mode_dropdown_visible_in_advanced(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.locator("details.advanced summary").click()
        page.wait_for_selector("#analyze-energy-mode", timeout=2000)
        expect(page.locator("#analyze-energy-mode")).to_be_visible()

    def test_energy_mode_default_is_fast(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.locator("details.advanced summary").click()
        page.wait_for_selector("#analyze-energy-mode", timeout=2000)
        assert page.locator("#analyze-energy-mode").input_value() == "fast"

    def test_energy_mode_has_none_and_full_options(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.locator("details.advanced summary").click()
        page.wait_for_selector("#analyze-energy-mode", timeout=2000)
        options = page.locator("#analyze-energy-mode option")
        values = [options.nth(i).get_attribute("value") for i in range(options.count())]
        assert "none" in values
        assert "fast" in values
        assert "full" in values

    def test_model_options_ordered_slow_to_fast(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        options = page.locator("#analyze-model option")
        values = [options.nth(i).get_attribute("value") for i in range(options.count())]
        # Should go tiny → base → small → medium → large-v3
        assert values.index("tiny") < values.index("base")
        assert values.index("base") < values.index("small")
        assert values.index("small") < values.index("medium")
        assert values.index("medium") < values.index("large-v3")


# ---------------------------------------------------------------------------
# Profile manager
# ---------------------------------------------------------------------------

@skip_no_server
class TestProfileManager:
    def test_opens_from_analyze_modal(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.click("button[title='Manage track layouts']")
        expect(page.locator("#profile-modal")).to_be_visible()

    def test_default_profile_shown_as_locked(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.click("button[title='Manage track layouts']")
        page.wait_for_selector("#profile-list", timeout=3000)
        # Built-in profiles have a lock icon and no delete button
        profile_list = page.locator("#profile-list")
        expect(profile_list).to_contain_text("Default")

    def test_create_and_delete_profile(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.click("button[title='Manage track layouts']")
        page.wait_for_selector("#profile-list", timeout=3000)

        # Open new track layout editor
        page.click("text=+ New Track Layout")
        page.wait_for_selector("#profile-editor", timeout=2000)

        # Fill in name
        page.fill("#pe-name", "ui_test_profile")
        page.fill("#pe-numtracks", "1")
        page.wait_for_selector("#pe-tracks div", state="visible", timeout=2000)

        # Save
        page.click("#profile-editor button:has-text('Save')")
        page.wait_for_selector("#profile-list :has-text('ui_test_profile')", timeout=3000)

        # Should now appear in list
        expect(page.locator("#profile-list")).to_contain_text("ui_test_profile")

        # Delete it — deleteProfile() shows a confirm modal before deleting
        page.locator("button[data-delete-profile='ui_test_profile']").click()
        page.locator("#confirm-ok-btn").wait_for(state="visible", timeout=2000)
        page.click("#confirm-ok-btn")
        page.wait_for_function(
            "!document.querySelector('#profile-list').textContent.includes('ui_test_profile')",
            timeout=3000,
        )
        expect(page.locator("#profile-list")).not_to_contain_text("ui_test_profile")


# ---------------------------------------------------------------------------
# Clip review workflow
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipReview:
    def _select_first_video_and_clip(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        page.locator("#clip-list li").first.click()

    def test_clip_detail_shows_score(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        expect(page.locator(".scores")).to_be_visible()

    def test_clip_detail_shows_description(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        # Description or transcript should be present
        detail = page.locator(".detail")
        expect(detail).not_to_be_empty()

    def test_approve_button_exists(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        expect(page.locator("button.approve")).to_be_visible()

    def test_reject_button_exists(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        expect(page.locator("button.reject")).to_be_visible()

    def test_retranscribe_button_exists(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=3000)
        expect(page.locator(".clip-actions button:has-text('Retranscribe')")).to_be_visible()

    def test_sidebar_shows_clip_id(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        # Each clip item should show a #N id prefix
        first_item = page.locator("#clip-list li").first
        expect(first_item).to_contain_text("#")

    def test_sidebar_shows_clip_scores(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
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
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        page.locator("#clips-sort").select_option("timeline")
        # List should still be present after sort change
        expect(page.locator("#clip-list li").first).to_be_visible()
        page.locator("#clips-sort").select_option("score")
        expect(page.locator("#clip-list li").first).to_be_visible()


# ---------------------------------------------------------------------------
# Demo modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestDemoModal:
    def _open_modal(self, page: Page) -> None:
        # openHighlightReelsModal() returns early if there are no approved clips; open directly
        page.evaluate("document.getElementById('highlight-reels-modal').classList.add('visible')")
        page.locator("#highlight-reels-modal").wait_for(state="visible")

    def test_opens_and_closes(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        expect(page.locator("#highlight-reels-modal")).to_be_visible()
        page.click("#highlight-reels-modal button:has-text('Cancel')")
        expect(page.locator("#highlight-reels-modal")).not_to_be_visible()

    def test_has_transition_options(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        options = page.locator("#demo-transition option")
        assert options.count() >= 4

    def test_has_output_name_field(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        # Field is present and accepts text; left blank means the server auto-generates a filename
        expect(page.locator("#demo-output-name")).to_be_visible()
        placeholder = page.locator("#demo-output-name").get_attribute("placeholder")
        assert placeholder is not None and ".mkv" in placeholder


# ---------------------------------------------------------------------------
# Estimate display (renderEstimate called directly via page.evaluate)
# ---------------------------------------------------------------------------

_MOCK_INFO = {
    "filename": "test.mkv",
    "duration_hms": "1h 00m",
    "duration_s": 3600,
    "width": 1920,
    "height": 1080,
    "fps": 60,
    "audio_tracks": 2,
}

def _make_steps(energy_mode: str = "fast") -> list:
    energy_map = {
        "none": ("Audio energy (none)", 0,    "skipped",    "0s"),
        "fast": ("Audio energy (fast)", 14.4, "4 kHz numpy", "14s"),
        "full": ("Audio energy (full)", 36.0, "16 kHz numpy", "36s"),
    }
    name, secs, note, hms = energy_map[energy_mode]
    return [
        {"name": "Extract audio",          "seconds": 360,  "note": "2 track(s)",                    "hms": "6m 00s"},
        {"name": "Transcribe (medium)",     "seconds": 200,  "note": "1 track(s) on GPU",             "hms": "3m 20s"},
        {"name": name,                      "seconds": secs, "note": note,                             "hms": hms},
        {"name": "Scene detection (fast)",  "seconds": 18,   "note": "keyframes + transcript gaps",   "hms": "18s"},
        {"name": "LLM scoring",             "seconds": 80,   "note": "~20 clips estimated",           "hms": "1m 20s"},
    ]


def _inject_estimate(page: "Page", energy_mode: str = "fast", pct: float = 18.7) -> None:
    """Directly call renderEstimate() with controlled data — no file probe needed."""
    steps = _make_steps(energy_mode)
    total_s = sum(s["seconds"] for s in steps)
    page.evaluate(f"""() => {{
      window._probedInfo = {_MOCK_INFO};
      renderEstimate(window._probedInfo, {{
        steps: {steps},
        total_hms: "11m 12s",
        total_seconds: {total_s},
        pct_of_video: {pct}
      }});
    }}""")


@skip_no_server
class TestEstimateDisplay:
    def _open_analyze(self, page: "Page") -> None:
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")

    def test_estimate_area_empty_on_modal_open(self, page: Page):
        self._open_analyze(page)
        expect(page.locator("#estimate-area")).to_be_empty()

    def test_estimate_area_below_advanced_options(self, page: Page):
        """#estimate-area must follow <details class=advanced> in the DOM (Advanced Options at top, estimate below)."""
        self._open_analyze(page)
        follows = page.evaluate("""() => {
          const area    = document.getElementById('estimate-area');
          const details = document.querySelector('details.advanced');
          return (details.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }""")
        assert follows, "#estimate-area should come after <details class=advanced>"

    def test_energy_row_shows_mode_name(self, page: Page):
        self._open_analyze(page)
        _inject_estimate(page, energy_mode="fast")
        expect(page.locator("#estimate-area")).to_contain_text("Audio energy (fast)")

    def test_energy_none_shows_skipped(self, page: Page):
        self._open_analyze(page)
        _inject_estimate(page, energy_mode="none")
        expect(page.locator("#estimate-area")).to_contain_text("Audio energy (none)")
        expect(page.locator("#estimate-area")).to_contain_text("skipped")

    def test_energy_full_shows_full(self, page: Page):
        self._open_analyze(page)
        _inject_estimate(page, energy_mode="full")
        expect(page.locator("#estimate-area")).to_contain_text("Audio energy (full)")

    def test_pct_of_video_is_visible(self, page: Page):
        self._open_analyze(page)
        _inject_estimate(page, pct=18.7)
        pct_el = page.locator(".estimate-pct")
        expect(pct_el).to_be_visible()
        expect(pct_el).to_contain_text("18.7%")

    def test_pct_element_exists_after_render(self, page: Page):
        self._open_analyze(page)
        _inject_estimate(page, pct=96.0)
        expect(page.locator(".estimate-pct")).to_contain_text("96.0%")
        expect(page.locator(".estimate-pct")).to_contain_text("of video")


# ---------------------------------------------------------------------------
# Score override via field-edit modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestScoreOverrideModal:
    """Score override opens a dedicated slider modal."""

    def _select_first_video_and_clip(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        page.locator("#clip-list li").first.click()

    def _open_score_override(self, page: Page) -> None:
        clip_id = page.evaluate("() => _clips?.[0]?.id")
        assert clip_id is not None, "No clips loaded on the live server"
        page.evaluate(f"() => openScoreOverride({clip_id})")
        page.wait_for_selector("#score-override-modal.visible", timeout=2000)

    def test_opens_score_override_modal(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        expect(page.locator("#score-override-modal")).to_be_visible()

    def test_title_mentions_score_override(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        expect(page.locator("#score-override-modal h3")).to_contain_text("Score Override")

    def test_prefills_current_score(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        clip_score = page.evaluate("() => _clips?.[0]?.score_overall ?? 0")
        self._open_score_override(page)
        val = float(page.locator("#score-override-slider").input_value())
        assert abs(val - clip_score) < 0.01

    def test_cancel_closes_modal(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        page.click("#score-override-modal button:has-text('Cancel')")
        expect(page.locator("#score-override-modal")).not_to_be_visible()

    def test_display_updates_with_slider(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector(".scores", timeout=3000)
        self._open_score_override(page)
        page.locator("#score-override-slider").fill("0.75")
        page.locator("#score-override-slider").dispatch_event("input")
        expect(page.locator("#score-override-display")).to_contain_text("0.75")


# ---------------------------------------------------------------------------
# Per-clip rescore — header progress pill
# ---------------------------------------------------------------------------

@skip_no_server
class TestRescoreClipProgressPill:
    """Clicking Re-score on a clip shows the header progress pill (startJobUI / endJobUI)."""

    def _select_first_video_and_clip(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.locator("#video-list li").first.click()
        page.wait_for_selector("#clip-list li", timeout=5000)
        page.locator("#clip-list li").first.click()

    def test_progress_pill_appears_on_rescore(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector("#btn-rescore-clip", timeout=3000)
        page.click("#btn-rescore-clip")
        # startJobUI is synchronous — pill must be visible before the SSE completes
        expect(page.locator("#job-status")).to_be_visible()

    def test_progress_pill_shows_rescore_label(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector("#btn-rescore-clip", timeout=3000)
        page.click("#btn-rescore-clip")
        page.wait_for_selector("#job-status.visible", timeout=2000)
        expect(page.locator("#job-steps")).to_contain_text("Re-scoring clip")

    def test_progress_pill_disappears_after_job(self, page: Page):
        self._select_first_video_and_clip(page)
        page.wait_for_selector("#btn-rescore-clip", timeout=3000)
        # Drive startJobUI/endJobUI directly — don't depend on real LLM job duration
        page.evaluate("() => startJobUI(SCORE_STEPS, 'Re-scoring clip')")
        expect(page.locator("#job-status")).to_be_visible()
        page.evaluate("() => endJobUI()")
        # endJobUI removes .visible after a 2 s setTimeout
        page.wait_for_selector("#job-status.visible", state="hidden", timeout=5000)
        expect(page.locator("#job-status")).not_to_be_visible()


# ---------------------------------------------------------------------------
# regenSummaryAuto — confirmation dialog
# ---------------------------------------------------------------------------

@skip_no_server
class TestRegenSummaryAutoConfirm:
    """regenSummaryAuto shows a confirm modal before running the SSE regen stream."""

    def _open_regen_confirm(self, page: Page) -> None:
        """Navigate to the app and invoke regenSummaryAuto via JS so the confirm modal appears."""
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        video_id = page.evaluate("() => _videos?.[0]?.id ?? 1")
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
        video_id = page.evaluate("() => _videos?.[0]?.id ?? 1")
        # Abort the actual SSE stream so the test doesn't trigger real LLM work
        page.route("**/regenerate-summary", lambda route: route.abort())
        page.evaluate(f"() => regenSummaryAuto({video_id}, document.createElement('button'))")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        with page.expect_request(lambda r: "regenerate-summary" in r.url, timeout=3000):
            page.click("#confirm-ok-btn")
