"""Playwright UI tests — timed transcript views (clip + collapsible full recording).

The transcript endpoints are mocked so the test is deterministic, but it drives
the real render + lazy-load flow in transcript.js.
"""
from __future__ import annotations

import json

from playwright.sync_api import Page, expect

from conftest import select_first_video_and_clip, select_video_with_clips, skip_no_server

_CLIP_LINES = {
    "lines": [
        {"start_ms": 0, "end_ms": 2000, "speaker": "Yuu", "text": "let's go go go"},
        {"start_ms": 2000, "end_ms": 4000, "speaker": "Mara", "text": "behind you"},
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
