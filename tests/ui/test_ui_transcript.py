"""Playwright UI tests - timed transcript views (clip + collapsible full recording).

The transcript endpoints are mocked so the test is deterministic, but it drives
the real render + lazy-load flow in transcript.js.
"""
from __future__ import annotations

import json
import re

from conftest import select_first_video_and_clip, select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect

_CLIP_LINES = {
    "lines": [
        {"start_ms": 0, "end_ms": 2000, "speaker": "Yuu", "text": "let's go go go", "seg_id": 11},
        {"start_ms": 2000, "end_ms": 4000, "speaker": "Mara", "text": "behind you", "seg_id": 12},
    ]
}
_VIDEO_LINES = {
    "lines": [
        {"start_ms": 0, "end_ms": 2000, "speaker": None, "text": "opening line"},
        {"start_ms": 90000, "end_ms": 92000, "speaker": None, "text": "much later"},
    ]
}


@skip_no_server
class TestClipTranscript:
    def test_per_line_play_buttons_render(self, page: Page):
        page.route(
            "**/api/clips/*/transcript",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(_CLIP_LINES)
            ),
        )
        select_first_video_and_clip(page)
        # Structured lines replace the plain excerpt fallback.
        expect(page.locator("#clip-transcript-view .tline")).to_have_count(2)
        expect(page.locator("#clip-transcript-view .tline-play")).to_have_count(2)
        expect(page.locator("#clip-transcript-view .tline-speaker").first).to_have_text("Yuu")

    def test_click_line_edits_and_saves_caption(self, page: Page):
        page.route(
            "**/api/clips/*/transcript",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(_CLIP_LINES)
            ),
        )
        put_bodies = []

        def _handle_put(route):
            put_bodies.append(route.request.post_data_json)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"seg_id": 11, "text": "let's GO", "affected_clip_ids": []}),
            )

        page.route("**/api/caption-segments/11", _handle_put)
        select_first_video_and_clip(page)

        first = page.locator("#clip-transcript-view .tline-text.editable").first
        first.click()
        editor = page.locator("#clip-transcript-view .tline-text.editing .tline-edit-input")
        expect(editor).to_be_visible()
        editor.fill("let's GO")
        page.locator("#clip-transcript-view .tline-text.editing .btn.primary").click()

        expect(page.locator("#clip-transcript-view .tline-text").first).to_have_text("let's GO")
        assert put_bodies and put_bodies[0]["text"] == "let's GO"


@skip_no_server
class TestClipTranscriptSpeakerMenu:
    _LINES = {
        "lines": [
            {"start_ms": 0, "end_ms": 2000, "speaker": "Yuu", "speaker_id": 1,
             "speaker_edited": False, "color": "#4fc3f7", "text": "let's go", "seg_id": 11},
            {"start_ms": 2000, "end_ms": 4000, "speaker": "Mara", "speaker_id": 2,
             "speaker_edited": True, "color": "#f0c060", "text": "behind you", "seg_id": 12},
        ]
    }
    _SPEAKERS = [
        {"id": 1, "video_id": 1, "display_index": 1, "name": "Yuu", "display_name": "Yuu",
         "is_named": True, "source": "manual", "confirmed": True, "color": "#4fc3f7",
         "sample_text": "", "sample_start_ms": None, "sample_end_ms": None},
        {"id": 2, "video_id": 1, "display_index": 2, "name": "Mara", "display_name": "Mara",
         "is_named": True, "source": "manual", "confirmed": True, "color": "#f0c060",
         "sample_text": "", "sample_start_ms": None, "sample_end_ms": None},
    ]

    def _route(self, page: Page) -> None:
        page.route("**/api/clips/*/transcript", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(self._LINES)))
        page.route("**/api/videos/*/speakers", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(self._SPEAKERS)))

    def test_speaker_chips_render_with_edited_marker(self, page: Page):
        self._route(page)
        select_first_video_and_clip(page)
        chips = page.locator("#clip-transcript-view .tline-spk")
        expect(chips).to_have_count(2)
        # The second line was hand-reassigned → carries the edited marker class.
        expect(chips.nth(1)).to_have_class(re.compile(r"\bedited\b"))
        expect(chips.nth(0)).not_to_have_class(re.compile(r"\bedited\b"))

    def test_clicking_chip_opens_speaker_menu(self, page: Page):
        self._route(page)
        select_first_video_and_clip(page)
        page.locator("#clip-transcript-view .tline-spk").first.click()
        menu = page.locator(".spk-menu")
        expect(menu).to_be_visible()
        # Two speakers plus the "Unassigned" option, and the inline rename field.
        expect(menu.locator(".spk-menu-item")).to_have_count(3)
        expect(menu.locator(".spk-menu-name")).to_be_visible()


@skip_no_server
class TestVideoTranscript:
    def _select_first_video(self, page: Page) -> None:
        # Select a video that actually has a transcript section (clips > 0 or done)
        # so the test doesn't depend on the newest row being a completed analysis.
        select_video_with_clips(page)

    def test_full_transcript_is_collapsed_then_loads_on_expand(self, page: Page):
        page.route(
            "**/api/videos/*/transcript",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(_VIDEO_LINES)
            ),
        )
        self._select_first_video(page)

        details = page.locator("#video-transcript-details")
        # Collapsed by default → no lines rendered yet.
        expect(details).to_have_count(1)
        expect(page.locator("#video-transcript-view .tline")).to_have_count(0)

        # Expanding lazy-loads the lines.
        details.locator("summary").click()
        expect(page.locator("#video-transcript-view .tline")).to_have_count(2)

    def test_reexpand_after_detail_rerender_reloads(self, page: Page):
        """A detail re-render (e.g. after a re-score) wipes the panel; re-expanding
        must reload it rather than leave it silently blank."""
        page.route(
            "**/api/videos/*/transcript",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(_VIDEO_LINES)
            ),
        )
        self._select_first_video(page)

        details = page.locator("#video-transcript-details")
        details.locator("summary").click()
        expect(page.locator("#video-transcript-view .tline")).to_have_count(2)

        # renderVideoDetail rebuilds #detail, leaving a fresh empty transcript view
        # (and collapsing the <details>) while the fetch-once cache still points here.
        page.evaluate("renderVideoDetail(AppState.activeVideoData, null)")
        expect(page.locator("#video-transcript-view .tline")).to_have_count(0)

        page.locator("#video-transcript-details summary").click()
        expect(page.locator("#video-transcript-view .tline")).to_have_count(2)
