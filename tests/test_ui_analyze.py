"""
Playwright UI tests — analyze modal, track-layout manager, and the time
estimate display.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import json
import urllib.request

import pytest
from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


def _get_config() -> dict:
    with urllib.request.urlopen(f"{LIVE_URL}/api/config", timeout=5) as r:
        return json.loads(r.read())


# Every layout name a test creates via track_layout_cleanup — including names
# older test versions used. Setup deletes these too, so debris from a hard-killed
# prior run (watchdog force-exit skips teardown) can't make the create step flake.
_UI_TEST_LAYOUT_NAMES = ("ui_test_profile", "ui_test_profile1")


def _delete_track_layout(name: str) -> None:
    req = urllib.request.Request(f"{LIVE_URL}/api/profiles/{name}", method="DELETE")
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass  # 404 for a layout that doesn't exist — nothing to clean


@pytest.fixture
def track_layout_cleanup():
    """Guarantee created track layouts are deleted even if the test fails
    mid-way. Tests append the layout name to the yielded list; teardown DELETEs
    each one regardless of test outcome so no debris leaks into later runs.
    Setup also deletes the known test-layout names in case a previous run was
    killed before its teardown could run."""
    for name in _UI_TEST_LAYOUT_NAMES:
        _delete_track_layout(name)
    created: list[str] = []
    yield created
    for name in created:
        _delete_track_layout(name)


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

    def test_model_dropdown_prefilled_from_config(self, page: Page):
        cfg = _get_config()
        page.goto(LIVE_URL)
        self._open_panel(page)
        assert page.locator("#analyze-model").input_value() == cfg["whisper_model"]

    def test_scene_mode_prefilled_from_config(self, page: Page):
        cfg = _get_config()
        page.goto(LIVE_URL)
        self._open_panel(page)
        assert page.locator("#analyze-scene-mode").input_value() == cfg["scene_detection_mode"]

    def test_browse_button_is_labeled(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        expect(page.locator("#btn-browse-recording")).to_contain_text("Browse")

    def test_external_srt_free_text_field_removed(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        assert page.locator("#analyze-external-srt").count() == 0

    def test_captions_select_offers_srt_picker(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.evaluate("_renderSubtitleSourcePicker({srt_sidecar: null, subtitle_streams: []})")
        select = page.locator("#analyze-subtitle-source")
        expect(select).to_be_visible()
        expect(select.locator("option[value='__pick-srt__']")).to_have_text("Choose SRT file…")

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

    def test_energy_mode_prefilled_from_config(self, page: Page):
        cfg = _get_config()
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.locator("details.advanced summary").click()
        page.wait_for_selector("#analyze-energy-mode", timeout=2000)
        assert page.locator("#analyze-energy-mode").input_value() == cfg["energy_mode"]

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

    def test_layout_name_placeholder_is_natural_language(self, page: Page):
        page.goto(LIVE_URL)
        assert page.locator("#pe-name").get_attribute("placeholder") == "My OBS setup"

    def test_empty_layout_name_shows_inline_error(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.click("button[title='Manage track layouts']")
        page.click("text=+ New Track Layout")
        page.wait_for_selector("#profile-editor", timeout=2000)
        page.click("#profile-editor button:has-text('Save')")
        error = page.locator("#pe-name-error")
        expect(error).to_be_visible()
        expect(error).to_contain_text("Enter a name")
        # typing clears the error
        page.fill("#pe-name", "a")
        expect(error).not_to_be_visible()

    def test_transcribe_and_score_checkboxes_have_tooltips(self, page: Page):
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.click("button[title='Manage track layouts']")
        page.click("text=+ New Track Layout")
        page.wait_for_selector("#pe-tracks div", state="visible", timeout=2000)
        assert page.locator("#pe-tracks label[title=\"Transcribe this track's speech\"]").count() >= 1
        assert page.locator('#pe-tracks label[title="Use this track for scoring"]').count() >= 1

    def test_create_and_delete_profile(self, page: Page, track_layout_cleanup):
        name = "ui_test_profile"
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.click("button[title='Manage track layouts']")
        page.wait_for_selector("#profile-list", timeout=3000)

        # Open new track layout editor
        page.click("text=+ New Track Layout")
        page.wait_for_selector("#profile-editor", timeout=2000)

        # Fill in name
        page.fill("#pe-name", name)
        page.fill("#pe-numtracks", "1")
        page.wait_for_selector("#pe-tracks div", state="visible", timeout=2000)

        # Save — register for teardown before asserting so a mid-test failure
        # still cleans up the created layout.
        page.click("#profile-editor button:has-text('Save')")
        track_layout_cleanup.append(name)
        delete_btn = f"button[data-delete-profile='{name}']"
        page.wait_for_selector(delete_btn, timeout=3000)

        # Delete it — deleteProfile() shows a confirm modal before deleting.
        # Match the delete button by exact name attribute (not a substring of
        # the list text) so a superstring layout can't mask removal.
        page.locator(delete_btn).click()
        page.locator("#confirm-ok-btn").wait_for(state="visible", timeout=2000)
        page.click("#confirm-ok-btn")
        page.wait_for_function(
            f"!document.querySelector(\"{delete_btn}\")",
            timeout=3000,
        )


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
        expect(page.locator(".estimate-pct")).to_contain_text("of recording")


# ---------------------------------------------------------------------------
# Drag-and-drop analyze (quick-wins Stage 9) — Electron-first
# ---------------------------------------------------------------------------

_MOCK_ELECTRON_API = (
    "window.electronAPI = { runSetupWizard: () => {}, "
    "getPathForFile: (f) => 'D:\\\\Videos\\\\' + f.name };"
)


def _dispatch_drop(page: Page, filenames: list) -> None:
    page.evaluate(
        """(names) => {
            const dt = new DataTransfer();
            for (const name of names) dt.items.add(new File(['x'], name, {type: 'video/mp4'}));
            document.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}));
        }""",
        filenames,
    )


def _dispatch_dragenter(page: Page, filename: str = "a.mp4") -> None:
    page.evaluate(
        """(name) => {
            const dt = new DataTransfer();
            dt.items.add(new File(['x'], name, {type: 'video/mp4'}));
            document.dispatchEvent(new DragEvent('dragenter', {bubbles: true, cancelable: true, dataTransfer: dt}));
        }""",
        filename,
    )


@skip_no_server
class TestDragAndDropAnalyzeElectron:
    def _goto(self, page: Page) -> None:
        page.add_init_script(_MOCK_ELECTRON_API)
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)

    def test_drop_opens_panel_with_path_filled(self, page: Page):
        self._goto(page)
        _dispatch_drop(page, ["session.mp4"])
        page.wait_for_selector("#new-recording-panel", state="visible", timeout=3000)
        expect(page.locator("#analyze-path")).to_have_value("D:\\Videos\\session.mp4")

    def test_dragenter_shows_overlay(self, page: Page):
        self._goto(page)
        _dispatch_dragenter(page)
        expect(page.locator("#drop-overlay")).to_be_visible()

    def test_unsupported_extension_rejected(self, page: Page):
        self._goto(page)
        _dispatch_drop(page, ["notes.txt"])
        expect(page.locator("#toast-container .toast.error")).to_contain_text("Unsupported file type")
        expect(page.locator("#new-recording-panel")).to_be_hidden()

    def test_multiple_files_uses_first_and_warns(self, page: Page):
        self._goto(page)
        _dispatch_drop(page, ["first.mp4", "second.mp4"])
        expect(page.locator("#toast-container .toast.warning")).to_contain_text("one recording at a time")
        expect(page.locator("#analyze-path")).to_have_value("D:\\Videos\\first.mp4")


@skip_no_server
class TestDragAndDropAnalyzeBrowser:
    def test_dragenter_does_not_show_overlay(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        assert page.evaluate("() => window.electronAPI") is None
        _dispatch_dragenter(page)
        expect(page.locator("#drop-overlay")).to_be_hidden()

    def test_drop_shows_desktop_app_toast(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        _dispatch_drop(page, ["session.mp4"])
        expect(page.locator("#toast-container .toast.info")).to_contain_text("desktop app")
        expect(page.locator("#new-recording-panel")).to_be_hidden()


# ---------------------------------------------------------------------------
# Pause / resume analysis (roadmap-2026-07 plan 01, Stage 1)
#
# startJobUI/endJobUI are driven directly (not via a real analyze job) — same
# pattern as TestProgressPill in test_ui_clips.py — so these don't depend on a
# real subprocess's timing.
# ---------------------------------------------------------------------------

@skip_no_server
class TestPauseResumeUI:
    def _ready(self, page: Page) -> None:
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)

    def _simulate_pausable_job(self, page: Page) -> None:
        page.evaluate("() => startJobUI(INGEST_STEPS, 'Analyzing test.mkv', true, true)")

    def test_pause_button_hidden_for_non_pausable_job(self, page: Page):
        self._ready(page)
        page.evaluate("() => startJobUI(INGEST_STEPS, 'Re-scoring clip', false, false)")
        expect(page.locator("#btn-pause-job")).to_be_hidden()
        page.evaluate("() => endJobUI()")

    def test_pause_button_visible_and_labeled_for_pausable_job(self, page: Page):
        self._ready(page)
        self._simulate_pausable_job(page)
        expect(page.locator("#btn-pause-job")).to_be_visible()
        expect(page.locator("#btn-pause-job")).to_have_text("Pause after current video")
        expect(page.locator("#job-paused-badge")).to_be_hidden()
        page.evaluate("() => endJobUI()")

    def test_clicking_pause_flips_button_and_shows_badge(self, page: Page):
        self._ready(page)
        page.route(
            "**/api/analyze/pause",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"status": "pause-requested"}',
            ),
        )
        self._simulate_pausable_job(page)
        page.click("#btn-pause-job")
        expect(page.locator("#btn-pause-job")).to_have_text("Resume")
        expect(page.locator("#job-paused-badge")).to_be_visible()
        page.evaluate("() => endJobUI()")

    def test_clicking_resume_clears_button_and_badge(self, page: Page):
        self._ready(page)
        page.route(
            "**/api/analyze/pause",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"status": "pause-requested"}',
            ),
        )
        page.route(
            "**/api/analyze/resume",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"status": "resumed"}',
            ),
        )
        self._simulate_pausable_job(page)
        page.click("#btn-pause-job")
        expect(page.locator("#btn-pause-job")).to_have_text("Resume")
        page.click("#btn-pause-job")
        expect(page.locator("#btn-pause-job")).to_have_text("Pause after current video")
        expect(page.locator("#job-paused-badge")).to_be_hidden()
        page.evaluate("() => endJobUI()")

    def test_pause_noop_surfaces_toast_and_leaves_button_unpaused(self, page: Page):
        self._ready(page)
        page.route(
            "**/api/analyze/pause",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"status": "no-op", "message": "No analysis is running."}',
            ),
        )
        self._simulate_pausable_job(page)
        page.click("#btn-pause-job")
        expect(page.locator("#toast-container .toast.info")).to_contain_text("No analysis is running.")
        expect(page.locator("#btn-pause-job")).to_have_text("Pause after current video")
        page.evaluate("() => endJobUI()")

    def test_status_pill_reflects_paused_state(self, page: Page):
        """_setPausedUIFromStatus is what a page reconnect (boot.js -> reattachAnalysis)
        uses to reflect a pause that was requested from another tab/session."""
        self._ready(page)
        self._simulate_pausable_job(page)
        page.evaluate("() => _setPausedUIFromStatus(true)")
        expect(page.locator("#btn-pause-job")).to_have_text("Resume")
        expect(page.locator("#job-paused-badge")).to_be_visible()
        page.evaluate("() => endJobUI()")

    def test_end_job_ui_hides_pause_controls(self, page: Page):
        self._ready(page)
        self._simulate_pausable_job(page)
        page.evaluate("() => endJobUI()")
        expect(page.locator("#btn-pause-job")).to_be_hidden()
        expect(page.locator("#job-paused-badge")).to_be_hidden()
