"""
Playwright UI tests - clip export editor (exporteditor.js).

Every endpoint the editor touches is mocked so the tests are deterministic and
never PATCH a real clip or run a live ffmpeg export against the project's actual
database (same rule as test_ui_clipcreate.py). The editor is opened by calling
openExportEditor() directly against a real selected recording, so its inline
preview <video> points at a real source URL while all data is mocked.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import json

from conftest import select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect

_FAKE_CLIP_ID = 999_002

_CONTEXT = {
    "lines": [
        {"start_ms": 2_000, "end_ms": 4_000, "speaker": None, "color": None,
         "text": "context before", "in_clip": False},
        {"start_ms": 6_000, "end_ms": 8_000, "speaker": "Yuu", "color": "#4fc3f7",
         "text": "the funny bit", "in_clip": True},
        {"start_ms": 9_000, "end_ms": 11_000, "speaker": None, "color": None,
         "text": "context after", "in_clip": False},
    ],
    "seek_offset_s": 0,
}

_PRESETS = {
    "builtins": [{"name": "tiktok-9x16", "label": "Vertical 9:16", "vertical": True}],
    "custom": [],
}


def _fake_clip(video_id: int, start_offset: float = 0.0, end_offset: float = 0.0) -> dict:
    return {
        "id": _FAKE_CLIP_ID, "video_id": video_id, "start_ms": 6_000, "end_ms": 8_000,
        "start_hms": "0:06", "duration_hms": "0:02",
        "score_overall": 0.0, "score_funny": 0.0, "score_dramatic": 0.0, "score_action": 0.0,
        "score_laugh": None, "score_overall_user": None, "scored_at": None,
        "description": "", "description_original": "", "description_is_edited": False,
        "description_long": "", "description_long_original": "", "description_long_is_edited": False,
        "start_offset": start_offset, "end_offset": end_offset, "crop_x": None,
        "status": "pending", "tags": [], "user_tags": [],
        "has_export": False, "exported_at": None, "exported_container": None,
        "exported_burn_subs": None, "exported_embed_subs": None, "exported_title_card": None,
        "subtitle_status": "none",
        "related_clips": None, "related_clips_at": None, "related_clips_stale": False,
        "hotword_matches": [], "hotword_boost": {}, "sensitive_matches": [],
        "transcript_stale": False, "export_stale": False, "export_stale_reasons": [],
        "exports": [], "transcript_excerpt": "the funny bit",
    }


def _open_editor(page: Page) -> int:
    """Select a real recording, mock the editor's endpoints, open the editor."""
    select_video_with_clips(page)
    video_id = page.evaluate("AppState.activeVideoId")

    page.evaluate(
        "(p) => { AppState.exportPresets = p; AppState._exportPresetsLoaded = true; }",
        _PRESETS,
    )
    page.route(f"**/api/clips/{_FAKE_CLIP_ID}", lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps(_fake_clip(video_id))))
    page.route(f"**/api/clips/{_FAKE_CLIP_ID}/context-transcript*", lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps(_CONTEXT)))
    page.route("**/api/config", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"caption_font_name": "", "caption_font_size": 0, "caption_position": "bottom"})))

    page.evaluate(f"openExportEditor({_FAKE_CLIP_ID})")
    expect(page.locator("#ed-transcript .tline")).to_have_count(3, timeout=3000)
    return video_id


@skip_no_server
class TestExportEditorOpen:
    def test_edit_export_button_opens_editor(self, page: Page):
        _open_editor(page)
        expect(page.locator("#panelnav-root")).to_be_visible()
        expect(page.locator("#panelnav-breadcrumb")).to_contain_text("Edit & export")
        expect(page.locator("#ed-duration")).to_have_text("2.0s")

    def test_in_clip_line_is_highlighted(self, page: Page):
        _open_editor(page)
        lines = page.locator("#ed-transcript .tline")
        expect(lines.nth(1)).to_have_class("tline cc-selected")
        expect(lines.nth(0)).not_to_have_class("tline cc-selected")


@skip_no_server
class TestExportEditorTrim:
    def test_line_start_button_moves_boundary_and_duration(self, page: Page):
        _open_editor(page)
        # First context line starts at 2_000ms → extends clip start earlier.
        page.locator("#ed-transcript .tline").nth(0).locator(".ed-bound[data-edge='start']").click()
        expect(page.locator("#ed-start-read")).to_have_text("0:02")
        expect(page.locator("#ed-duration")).to_have_text("6.0s")

    def test_end_nudge_shortens_clip(self, page: Page):
        _open_editor(page)
        page.locator(".ed-nudge[data-edge='end'][data-delta='-0.5']").click()
        expect(page.locator("#ed-duration")).to_have_text("1.5s")

    def test_reset_trim_restores_original_window(self, page: Page):
        _open_editor(page)
        page.locator(".ed-nudge[data-edge='start'][data-delta='-0.5']").click()
        expect(page.locator("#ed-duration")).to_have_text("2.5s")
        page.click("#ed-reset-trim")
        expect(page.locator("#ed-duration")).to_have_text("2.0s")

    def test_too_short_trim_is_rejected(self, page: Page):
        _open_editor(page)
        # 2.0 → 1.5 → 1.0 (the 1s floor is inclusive); the third nudge to 0.5 is rejected.
        end_nudge = page.locator(".ed-nudge[data-edge='end'][data-delta='-0.5']")
        end_nudge.click()
        end_nudge.click()
        expect(page.locator("#ed-duration")).to_have_text("1.0s")
        end_nudge.click()
        expect(page.locator(".toast.warning")).to_be_visible(timeout=2000)
        expect(page.locator("#ed-duration")).to_have_text("1.0s")


@skip_no_server
class TestExportEditorCaptionOverlay:
    def _seek_and_tick(self, page: Page, seconds: float) -> None:
        page.evaluate(
            """(t) => {
              const v = document.getElementById('ed-video');
              Object.defineProperty(v, 'currentTime', {configurable: true, get: () => t});
              v.dispatchEvent(new Event('timeupdate'));
            }""",
            seconds,
        )

    def test_overlay_shows_active_line(self, page: Page):
        _open_editor(page)
        self._seek_and_tick(page, 6.5)  # inside the 6_000–8_000ms in_clip line
        expect(page.locator("#ed-caption-overlay")).to_be_visible()
        expect(page.locator("#ed-caption-overlay")).to_contain_text("the funny bit")

    def test_overlay_hidden_outside_any_line(self, page: Page):
        _open_editor(page)
        self._seek_and_tick(page, 5.0)  # between context lines, no active caption
        expect(page.locator("#ed-caption-overlay")).to_be_hidden()

    def test_overlay_hidden_when_captions_off(self, page: Page):
        _open_editor(page)
        page.select_option("#ed-captions", "none")
        self._seek_and_tick(page, 6.5)
        expect(page.locator("#ed-caption-overlay")).to_be_hidden()


@skip_no_server
class TestExportEditorCropBox:
    def test_crop_box_appears_for_vertical_preset(self, page: Page):
        _open_editor(page)
        expect(page.locator("#ed-crop-box")).to_be_hidden()
        page.select_option("#ed-preset", "tiktok-9x16")
        expect(page.locator("#ed-crop-box")).to_be_visible()
        expect(page.locator("#ed-autoframe-btn")).to_be_visible()

    def test_drag_persists_crop_x_on_export(self, page: Page):
        video_id = _open_editor(page)
        page.select_option("#ed-preset", "tiktok-9x16")
        box_el = page.locator("#ed-crop-box")
        expect(box_el).to_be_visible()

        wrap = page.locator("#ed-preview-wrap").bounding_box()
        box = box_el.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.mouse.move(wrap["x"] + wrap["width"] - 2, box["y"] + box["height"] / 2, steps=5)
        page.mouse.up()

        framing_bodies: list = []
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}/framing", lambda route: (
            framing_bodies.append(route.request.post_data_json),
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": _FAKE_CLIP_ID, "crop_x": 1.0})),
        )[-1])
        _mock_export_endpoints(page, video_id)

        page.click("#ed-export-btn")
        expect(page.locator("#panelnav-root")).to_be_hidden(timeout=4000)
        assert len(framing_bodies) == 1
        assert framing_bodies[0]["crop_x"] >= 0.9


@skip_no_server
class TestExportEditorExport:
    def test_export_saves_trim_and_closes(self, page: Page):
        video_id = _open_editor(page)
        page.locator(".ed-nudge[data-edge='start'][data-delta='-0.5']").click()

        _mock_export_endpoints(page, video_id)
        # Registered last so it wins over _mock_export_endpoints' generic timing route.
        timing_bodies: list = []
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}/timing", lambda route: (
            timing_bodies.append(route.request.post_data_json),
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"start_offset": -0.5, "end_offset": 0.0})),
        )[-1])

        page.click("#ed-export-btn")
        expect(page.locator("#panelnav-root")).to_be_hidden(timeout=4000)
        assert timing_bodies == [{"start_offset": -0.5, "end_offset": 0.0}]

    def test_back_button_guards_dirty_trim(self, page: Page):
        _open_editor(page)
        page.locator(".ed-nudge[data-edge='start'][data-delta='-0.5']").click()
        page.click("#panelnav-breadcrumb button:has-text('Back')")
        expect(page.locator("#confirm-modal")).to_be_visible()
        page.click("#confirm-cancel-btn")
        expect(page.locator("#ed-transcript")).to_be_visible()


def _mock_export_endpoints(page: Page, video_id: int) -> None:
    page.route(f"**/api/clips/{_FAKE_CLIP_ID}/timing", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"start_offset": 0.0, "end_offset": 0.0})))
    page.route(f"**/api/clips/{_FAKE_CLIP_ID}/export*", lambda route: route.fulfill(
        status=200, content_type="text/event-stream",
        body='data: "Exporting clip"\n\ndata: "OK Saved"\n\ndata: "__DONE__"\n\n'))
    page.route(f"**/api/clips/{_FAKE_CLIP_ID}/media_url", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"url": None, "filename": None, "has_captions": False})))
