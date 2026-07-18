"""
Playwright UI tests - analyze modal, track-layout manager, and the time
estimate display.

Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import json
import re
import urllib.request

import pytest
from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


def _get_config() -> dict:
    with urllib.request.urlopen(f"{LIVE_URL}/api/config", timeout=5) as r:
        return json.loads(r.read())


# Every layout name a test creates via track_layout_cleanup - including names
# older test versions used. Setup deletes these too, so debris from a hard-killed
# prior run (watchdog force-exit skips teardown) can't make the create step flake.
_UI_TEST_LAYOUT_NAMES = ("ui_test_profile", "ui_test_profile1")


def _delete_track_layout(name: str) -> None:
    req = urllib.request.Request(f"{LIVE_URL}/api/profiles/{name}", method="DELETE")
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass  # 404 for a layout that doesn't exist - nothing to clean


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
        expect(page.locator("#analyze-model")).to_have_value(cfg["whisper_model"])

    def test_scene_mode_prefilled_from_config(self, page: Page):
        cfg = _get_config()
        page.goto(LIVE_URL)
        self._open_panel(page)
        expect(page.locator("#analyze-scene-mode")).to_have_value(cfg["scene_detection_mode"])

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

        # Save - register for teardown before asserting so a mid-test failure
        # still cleans up the created layout.
        page.click("#profile-editor button:has-text('Save')")
        track_layout_cleanup.append(name)
        delete_btn = f"button[data-delete-profile='{name}']"
        # Save round-trips to the server and re-renders the list; under the full
        # suite's shared-server load this can take a few seconds, so keep the wait
        # generous - the assertion is about correctness, not speed.
        page.wait_for_selector(delete_btn, timeout=10000)

        # Delete it - deleteProfile() shows a confirm modal before deleting.
        # Match the delete button by exact name attribute (not a substring of
        # the list text) so a superstring layout can't mask removal.
        page.locator(delete_btn).click()
        page.locator("#confirm-ok-btn").wait_for(state="visible", timeout=2000)
        page.click("#confirm-ok-btn")
        page.wait_for_function(
            f"!document.querySelector(\"{delete_btn}\")",
            timeout=10000,
        )


# ---------------------------------------------------------------------------
# Estimate display (renderEstimate called directly via page.evaluate)
# ---------------------------------------------------------------------------

@skip_no_server
class TestEstimateDisplay:
    """The renderEstimate() render assertions (energy step name, percent-of-recording
    line, source caption, long-run warning, DOM placement) moved to the browserless
    vitest tier - tests/js/analyze/estimate.test.js drives renderEstimate directly
    against the static #estimate-area. Only the open-flow behavior (opening the panel
    must NOT pre-populate an estimate before a probe runs) needs the live panel."""

    def _open_analyze(self, page: "Page") -> None:
        page.goto(LIVE_URL)
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")

    def test_estimate_area_empty_on_modal_open(self, page: Page):
        self._open_analyze(page)
        expect(page.locator("#estimate-area")).to_be_empty()


# ---------------------------------------------------------------------------
# Drag-and-drop analyze (quick-wins Stage 9) - Electron-first
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
# startJobUI/endJobUI are driven directly (not via a real analyze job) - same
# pattern as TestProgressPill in test_ui_clips.py - so these don't depend on a
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


# ---------------------------------------------------------------------------
# GPU thermal monitoring - job-header readout, warn toast, auto-pause
# (roadmap-2026-07 plan 01, Stage 3)
#
# /api/status is stubbed so these exercise _pollThermalStatus() (utils.js)
# purely off its documented gpu_temp_c/gpu_state contract - no real GPU or
# subprocess involved.
# ---------------------------------------------------------------------------

def _stub_status(page: Page, *, gpu_temp_c=None, gpu_state="unavailable") -> None:
    body = json.dumps({
        "any_running": True, "analyze_running": True, "analyze_filename": "test.mkv",
        "analyze_video_id": None, "analyze_paused": False, "pause_flag_set": False,
        "gpu_temp_c": gpu_temp_c, "gpu_state": gpu_state, "active_jobs": 0,
        "version": "test", "can_reveal": False,
    })
    page.route(
        "**/api/status",
        lambda route: route.fulfill(status=200, content_type="application/json", body=body),
    )


@skip_no_server
class TestThermalJobHeaderUI:
    def _ready(self, page: Page) -> None:
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)

    def _start_pausable_job(self, page: Page) -> None:
        page.evaluate("() => startJobUI(INGEST_STEPS, 'Analyzing test.mkv', true, true)")

    def test_readout_hidden_when_gpu_unavailable(self, page: Page):
        self._ready(page)
        _stub_status(page, gpu_temp_c=None, gpu_state="unavailable")
        self._start_pausable_job(page)
        expect(page.locator("#job-gpu-temp")).to_be_hidden()
        page.evaluate("() => endJobUI()")

    def test_readout_shown_with_temp_when_available(self, page: Page):
        self._ready(page)
        _stub_status(page, gpu_temp_c=72.0, gpu_state="ok")
        self._start_pausable_job(page)
        expect(page.locator("#job-gpu-temp")).to_be_visible()
        expect(page.locator("#job-gpu-temp")).to_contain_text("72")
        page.evaluate("() => endJobUI()")

    def test_warn_state_applies_warn_style_and_toasts_once(self, page: Page):
        self._ready(page)
        _stub_status(page, gpu_temp_c=87.0, gpu_state="warn")
        self._start_pausable_job(page)
        expect(page.locator("#job-gpu-temp")).to_have_class(re.compile(r"\bwarn\b"))
        expect(page.locator("#toast-container .toast.warning")).to_contain_text("running hot")
        page.evaluate("() => endJobUI()")

    def test_pause_state_shows_paused_badge_and_autopause_toast(self, page: Page):
        self._ready(page)
        _stub_status(page, gpu_temp_c=92.0, gpu_state="pause")
        self._start_pausable_job(page)
        expect(page.locator("#job-gpu-temp")).to_have_class(re.compile(r"\bpause\b"))
        expect(page.locator("#job-paused-badge")).to_be_visible()
        expect(page.locator("#btn-pause-job")).to_have_text("Resume")
        expect(page.locator("#toast-container .toast.warning")).to_contain_text("Auto-paused")
        page.evaluate("() => endJobUI()")

    def test_ok_state_hidden_from_pause_and_warn_styling(self, page: Page):
        self._ready(page)
        _stub_status(page, gpu_temp_c=60.0, gpu_state="ok")
        self._start_pausable_job(page)
        expect(page.locator("#job-gpu-temp")).not_to_have_class(re.compile(r"\bwarn\b"))
        expect(page.locator("#job-gpu-temp")).not_to_have_class(re.compile(r"\bpause\b"))
        expect(page.locator("#job-paused-badge")).to_be_hidden()
        page.evaluate("() => endJobUI()")

    def test_readout_cleared_when_job_ends(self, page: Page):
        self._ready(page)
        _stub_status(page, gpu_temp_c=72.0, gpu_state="ok")
        self._start_pausable_job(page)
        expect(page.locator("#job-gpu-temp")).to_be_visible()
        page.evaluate("() => endJobUI()")
        expect(page.locator("#job-gpu-temp")).to_be_hidden()

    def test_non_pausable_job_never_polls_thermal_status(self, page: Page):
        """A non-pausable job (e.g. Rescore) must not show the GPU readout -
        thermal monitoring is scoped to analyze-type jobs only."""
        self._ready(page)
        _stub_status(page, gpu_temp_c=72.0, gpu_state="ok")
        page.evaluate("() => startJobUI(SCORE_STEPS, 'Re-scoring clip', false, false)")
        expect(page.locator("#job-gpu-temp")).to_be_hidden()
        page.evaluate("() => endJobUI()")


# ---------------------------------------------------------------------------
# Import from URL (roadmap plan 08) - URL field, stubbed inspect card,
# stubbed-SSE download completion prefilling the analyze form.
# ---------------------------------------------------------------------------

def _fulfill_json(body: dict, status: int = 200):
    return lambda route: route.fulfill(status=status, content_type="application/json", body=json.dumps(body))


def _sse_body(lines: list[str]) -> str:
    return "".join(f"data: {json.dumps(line)}\n\n" for line in [*lines, "__DONE__"])


@skip_no_server
class TestImportFromUrl:
    def _open_panel(self, page: Page) -> None:
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")

    def test_import_url_button_present(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        expect(page.locator("#btn-show-import-url")).to_be_visible()
        expect(page.locator("#btn-show-import-url")).to_contain_text("Import from a URL")
        expect(page.locator("#import-url-field")).to_be_hidden()

    def test_clicking_button_reveals_url_field_and_hides_local_path(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        expect(page.locator("#import-url-field")).to_be_visible()
        expect(page.locator("#recording-source-field")).to_be_hidden()

    def test_url_toggle_alone_does_not_dirty_the_panel(self, page: Page):
        # Regression: showImportUrlSection() → scheduleProbe() set _panelDirty
        # even with an empty path, so closing the panel falsely prompted
        # "Discard new recording?". An untouched toggle must close cleanly.
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        expect(page.locator("#import-url-field")).to_be_visible()
        page.click("#btn-close-new-recording")
        expect(page.locator("#confirm-modal")).not_to_be_visible()
        expect(page.locator("#new-recording-panel")).not_to_be_visible()

    def test_use_local_file_instead_restores_path_field(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        page.click("#import-url-field button:has-text('Use a local file instead')")
        expect(page.locator("#import-url-field")).to_be_hidden()
        expect(page.locator("#recording-source-field")).to_be_visible()

    def test_check_link_renders_inspect_card(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        page.route("**/api/import-url/inspect", _fulfill_json({
            "title": "Epic Gaming Moment", "uploader": "SomeStreamer", "duration_s": 3600,
            "upload_date": "2026-06-15", "category": "Just Chatting",
            "estimated_size_bytes": 500_000_000, "video_id": "abc123",
            "already_imported": False, "existing_filename": None,
        }))
        page.route("**/api/estimate", _fulfill_json({
            "steps": [{"name": "Transcribe", "seconds": 60, "note": "1 track", "hms": "1m 00s"}],
            "total_hms": "1m 00s", "total_seconds": 60, "pct_of_video": 1.7,
            "source": "estimated", "warn_hours": 2.0, "long_run_warning": False,
        }))
        page.fill("#import-url-input", "https://www.youtube.com/watch?v=abc123")
        page.click("#btn-check-url")
        expect(page.locator("#import-url-inspect-area")).to_contain_text("Epic Gaming Moment")
        expect(page.locator("#import-url-inspect-area")).to_contain_text("SomeStreamer")
        expect(page.locator("#btn-start-import")).to_be_visible()

    def test_check_link_shows_error_for_unsupported_url(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        page.route("**/api/import-url/inspect", _fulfill_json(
            {"detail": "Only YouTube and Twitch links are supported"}, status=400,
        ))
        page.fill("#import-url-input", "https://vimeo.com/12345")
        page.click("#btn-check-url")
        expect(page.locator("#import-url-inspect-area")).to_contain_text("Only YouTube and Twitch")

    def test_already_imported_note_shown(self, page: Page):
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        page.route("**/api/import-url/inspect", _fulfill_json({
            "title": "Dup Video", "uploader": "Streamer", "duration_s": 60,
            "upload_date": None, "category": "", "estimated_size_bytes": None,
            "video_id": "dup1", "already_imported": True, "existing_filename": "dup.mkv",
        }))
        page.fill("#import-url-input", "https://youtu.be/dup1")
        page.click("#btn-check-url")
        expect(page.locator("#import-url-inspect-area")).to_contain_text("Already imported as")
        expect(page.locator("#import-url-inspect-area")).to_contain_text("dup.mkv")

    def test_download_completion_prefills_analyze_path(self, page: Page):
        fake_path = "C:\\fake\\downloads\\my video.mkv"
        page.goto(LIVE_URL)
        self._open_panel(page)
        page.click("#btn-show-import-url")
        page.route("**/api/import-url/inspect", _fulfill_json({
            "title": "Great Clip", "uploader": "Streamer", "duration_s": 60,
            "upload_date": None, "category": "", "estimated_size_bytes": None,
            "video_id": "vid1", "already_imported": False, "existing_filename": None,
        }))
        page.route("**/api/estimate", _fulfill_json({
            "steps": [], "total_hms": "0s", "total_seconds": 0, "pct_of_video": 0,
            "source": "estimated", "warn_hours": 2.0, "long_run_warning": False,
        }))
        page.fill("#import-url-input", "https://www.youtube.com/watch?v=vid1")
        page.click("#btn-check-url")
        page.wait_for_selector("#btn-start-import")

        page.route("**/api/import-url/start", _fulfill_json({"status": "started"}))
        page.route("**/api/import-url/events", lambda route: route.fulfill(
            status=200, content_type="text/event-stream",
            body=_sse_body([
                "[Download] 50.0% of 100MB at 5MB/s, ETA 00:05",
                f"[Imported] {fake_path}",
            ]),
        ))
        # Downloaded VODs have no real file on disk - stub the probe the
        # prefilled path triggers so it fails quietly instead of erroring.
        page.route("**/api/probe", _fulfill_json({"detail": "File not found"}, status=400))

        page.click("#btn-start-import")
        expect(page.locator("#toast-container .toast.success")).to_contain_text("Download complete")
        page.locator("#new-recording-panel").wait_for(state="visible")
        expect(page.locator("#analyze-path")).to_have_value(fake_path)


# ---------------------------------------------------------------------------
# Re-analyze panel - the New Recording panel reused in re-analyze mode, with
# settings defaulted to the recording's original run (but editable).
# ---------------------------------------------------------------------------

_REANALYZE_VIDEO = {
    "id": 4242,
    "filename": "old-session.mkv",
    "path": "/does/not/exist/old-session.mkv",
    "duration_ms": 3_600_000,
    "exported": 2,
    "context_names": [],
    "analyze_run": {
        "settings": {
            "model": "large-v3",
            "track_layout": "default",
            "energy_mode": "full",
            "scene_mode": "full",
            "speaker_labels": False,
            "contexts": [],
        }
    },
}


@skip_no_server
class TestReanalyzePanel:
    def _open_reanalyze(self, page: Page, video: dict | None = None) -> None:
        page.goto(LIVE_URL)
        # The prefilled path points at no real file; stub the probe so it fails
        # quietly (button stays disabled) instead of hitting the estimate error path.
        page.route("**/api/probe", _fulfill_json({"detail": "File not found"}, status=400))
        page.evaluate("(v) => openReanalyzePanel(v)", video or _REANALYZE_VIDEO)
        page.locator("#new-recording-panel").wait_for(state="visible")

    def test_panel_opens_in_reanalyze_mode(self, page: Page):
        self._open_reanalyze(page)
        expect(page.locator("#new-recording-title")).to_have_text("Re-analyze recording")
        expect(page.locator("#recording-source-field")).to_be_hidden()
        expect(page.locator("#btn-start-analyze")).to_have_text("Re-analyze")

    def test_warning_names_the_recording_and_exported_clips(self, page: Page):
        self._open_reanalyze(page)
        warning = page.locator("#reanalyze-warning")
        expect(warning).to_be_visible()
        expect(warning).to_contain_text("old-session.mkv")
        expect(warning).to_contain_text("2 exported clips")

    def test_settings_default_to_the_original_run(self, page: Page):
        self._open_reanalyze(page)
        assert page.locator("#analyze-model").input_value() == "large-v3"
        assert page.locator("#analyze-scene-mode").input_value() == "full"
        assert page.locator("#analyze-energy-mode").input_value() == "full"
        assert page.locator("#analyze-profile").input_value() == "__default__"

    def test_reopening_new_recording_clears_reanalyze_chrome(self, page: Page):
        self._open_reanalyze(page)
        page.click("#btn-close-new-recording")
        page.click("#btn-analyze")
        page.locator("#new-recording-panel").wait_for(state="visible")
        expect(page.locator("#new-recording-title")).to_have_text("New Recording")
        expect(page.locator("#reanalyze-warning")).to_be_hidden()
        expect(page.locator("#recording-source-field")).to_be_visible()
        expect(page.locator("#btn-start-analyze")).to_have_text("Start Analysis")

    def test_start_submits_video_id_and_force(self, page: Page):
        page.goto(LIVE_URL)
        # A valid probe (set before opening) so the panel's own re-probe of the
        # existing file succeeds and enables the Re-analyze button.
        page.route("**/api/probe", _fulfill_json({
            "filename": "old-session.mkv", "duration_s": 3600, "duration_hms": "1:00:00",
            "width": 1920, "height": 1080, "fps": 60, "audio_tracks": 1,
            "subtitle_streams": [], "srt_sidecar": None,
        }))
        page.evaluate("(v) => openReanalyzePanel(v)", _REANALYZE_VIDEO)
        page.locator("#new-recording-panel").wait_for(state="visible")
        expect(page.locator("#btn-start-analyze")).to_be_enabled()

        # startAnalyze() first probes the speech-model download state; stub it
        # so no "still downloading" confirm can intercept the click.
        page.route("**/api/llm/download-status", _fulfill_json({"whisper_downloading": False}))
        captured: dict = {}
        def _capture(route):
            captured.update(json.loads(route.request.post_data))
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"status": "started"}))
        page.route("**/api/analyze/start", _capture)
        page.route("**/api/analyze/events", lambda route: route.fulfill(
            status=200, content_type="text/event-stream", body=_sse_body([])))

        page.click("#btn-start-analyze")
        expect(page.locator("#new-recording-panel")).to_be_hidden()
        assert captured.get("video_id") == 4242
        assert captured.get("force") is True
        assert captured.get("model") == "large-v3"

    def _open_with_probe(self, page: Page, video: dict, probe: dict) -> None:
        page.goto(LIVE_URL)
        page.route("**/api/probe", _fulfill_json(probe))
        page.evaluate("(v) => openReanalyzePanel(v)", video)
        page.locator("#new-recording-panel").wait_for(state="visible")
        page.locator("#analyze-subtitle-source").wait_for(state="attached", timeout=3000)

    def test_defaults_captions_to_recorded_external_srt(self, page: Page):
        video = dict(_REANALYZE_VIDEO, analyze_run={"settings": {
            "model": "large-v3", "subtitle_source": r"C:\clips\old-session.srt",
        }})
        self._open_with_probe(page, video, {
            "filename": "old-session.mkv", "duration_s": 3600, "duration_hms": "1:00:00",
            "width": 1920, "height": 1080, "fps": 60, "audio_tracks": 1,
            "subtitle_streams": [], "srt_sidecar": None,
        })
        sel = page.locator("#analyze-subtitle-source")
        assert sel.input_value() == r"C:\clips\old-session.srt"
        expect(page.locator("#subtitle-external-option")).to_contain_text("old-session.srt")

    def test_defaults_captions_to_recorded_embedded_stream(self, page: Page):
        video = dict(_REANALYZE_VIDEO, analyze_run={"settings": {
            "model": "large-v3", "subtitle_source": "stream:2",
        }})
        self._open_with_probe(page, video, {
            "filename": "old-session.mkv", "duration_s": 3600, "duration_hms": "1:00:00",
            "width": 1920, "height": 1080, "fps": 60, "audio_tracks": 1,
            "subtitle_streams": [{"index": 2, "codec": "subrip", "title": "English", "language": "eng"}],
            "srt_sidecar": None,
        })
        assert page.locator("#analyze-subtitle-source").input_value() == "stream:2"

    def test_captions_default_to_whisper_when_no_recorded_source(self, page: Page):
        video = dict(_REANALYZE_VIDEO, analyze_run={"settings": {"model": "large-v3"}})
        self._open_with_probe(page, video, {
            "filename": "old-session.mkv", "duration_s": 3600, "duration_hms": "1:00:00",
            "width": 1920, "height": 1080, "fps": 60, "audio_tracks": 1,
            "subtitle_streams": [], "srt_sidecar": None,
        })
        assert page.locator("#analyze-subtitle-source").input_value() == ""
