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


# TestTextlessVisualClipTranscriptCard moved to tests/js/clips/renderdetail.test.js -
# renderDetail builds #detail as pure HTML (window.loadClipTranscript is only called
# when defined, so no fetch), so the no-dialogue / vision-summary / talk-clip states
# render browserless.


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
        # Two speakers plus "Unassigned" and "+ New speaker", and the inline rename field.
        expect(menu.locator(".spk-menu-item")).to_have_count(4)
        expect(menu.locator(".spk-menu-new")).to_have_count(1)
        expect(menu.locator(".spk-menu-name")).to_be_visible()

    def test_speaker_name_label_is_a_rename_affordance(self, page: Page):
        # R1: rename a speaker straight from the transcript, on the clip surface too -
        # the name label itself is the control, not just the dot menu.
        self._route(page)
        select_first_video_and_clip(page)
        label = page.locator("#clip-transcript-view .tline-speaker.editable").first
        expect(label).to_have_text("Yuu")
        expect(label).to_have_attribute("role", "button")

    def test_unassigned_line_keeps_its_dot(self, page: Page):
        # An Unassigned line has no speaker_id; its dot must still render (with an empty
        # speaker id) so the line can be reattributed - otherwise it is a dead end.
        mixed = {"lines": [
            {"start_ms": 0, "end_ms": 2000, "speaker": "Yuu", "speaker_id": 1,
             "speaker_edited": False, "color": "#4fc3f7", "text": "a", "seg_id": 11},
            {"start_ms": 2000, "end_ms": 4000, "speaker": None, "speaker_id": None,
             "speaker_edited": True, "color": None, "text": "b", "seg_id": 12},
        ]}
        page.route("**/api/clips/*/transcript", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(mixed)))
        page.route("**/api/videos/*/speakers", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(self._SPEAKERS)))
        select_first_video_and_clip(page)
        dots = page.locator("#clip-transcript-view .tline-spk")
        expect(dots).to_have_count(2)
        expect(dots.nth(1)).to_have_attribute("data-speaker-id", "")
        dots.nth(1).click()
        expect(page.locator(".spk-menu")).to_be_visible()


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
        details.locator(".detail-card-title").click()
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
        details.locator(".detail-card-title").click()
        expect(page.locator("#video-transcript-view .tline")).to_have_count(2)

        # renderVideoDetail rebuilds #detail, emptying the transcript view. Because
        # the card's expanded state persists, the re-render reloads it in place
        # rather than leaving a blank panel.
        page.evaluate("renderVideoDetail(AppState.activeVideoData, null)")
        expect(page.locator("#video-transcript-view .tline")).to_have_count(2)


_VIDEO_LINES_SPK = {
    "lines": [
        {"start_ms": 0, "end_ms": 2000, "speaker": "Yuu", "speaker_id": 1,
         "color": "#4fc3f7", "text": "line one", "seg_id": 101},
        {"start_ms": 2000, "end_ms": 4000, "speaker": "Mara", "speaker_id": 2,
         "color": "#f0c060", "text": "line two", "seg_id": 102},
    ]
}
_TWO_SPEAKERS = [
    {"id": 1, "display_index": 1, "name": "Yuu", "display_name": "Yuu", "is_named": True, "color": "#4fc3f7"},
    {"id": 2, "display_index": 2, "name": "Mara", "display_name": "Mara", "is_named": True, "color": "#f0c060"},
]


@skip_no_server
class TestTranscriptSpeakerEditing:
    """Feature B: create-new-speaker from a line menu, and multi-select bulk move."""

    def _open_full_transcript(self, page: Page) -> None:
        select_video_with_clips(page)
        page.locator("#video-transcript-details .detail-card-title").click()
        expect(page.locator("#video-transcript-view .tline")).to_have_count(2)

    def test_new_speaker_from_line_menu_posts(self, page: Page):
        page.route(
            "**/api/videos/*/transcript",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(_VIDEO_LINES_SPK)),
        )

        def _speakers(route):
            if route.request.method == "POST":
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps({"id": 3, "display_index": 3,
                                               "display_name": "Speaker 3", "color": "#4caf7d"}))
            else:
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps(_TWO_SPEAKERS))

        page.route("**/api/videos/*/speakers", _speakers)
        page.route(
            "**/api/transcript-segments/*/speaker",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps({"seg_id": 101, "affected_clip_ids": []})),
        )
        self._open_full_transcript(page)

        page.locator("#video-transcript-view .tline-spk").first.click()
        expect(page.locator(".spk-menu")).to_be_visible()
        with page.expect_request(
            lambda r: r.url.endswith("/speakers") and r.method == "POST"
        ):
            page.click(".spk-menu-new")

    def test_multiselect_move_lines_puts_bulk_reassign(self, page: Page):
        page.route(
            "**/api/videos/*/transcript",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(_VIDEO_LINES_SPK)),
        )
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(_TWO_SPEAKERS)),
        )
        page.route(
            "**/reassign-segments",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps({"reassigned": 1, "target_speaker_id": 2,
                                                         "affected_clip_ids": []})),
        )
        self._open_full_transcript(page)

        page.click(".tx-move-toggle")
        page.locator("#video-transcript-view .tline-text").first.click()  # select Yuu's line
        expect(page.locator(".tx-move-count")).to_contain_text("1 line")
        with page.expect_request(
            lambda r: "/reassign-segments" in r.url and r.method == "PUT"
        ) as req_info:
            page.locator(".tx-move-target").select_option("2")
        body = req_info.value.post_data_json
        assert body["seg_ids"] == [101]
        assert body["target_speaker_id"] == 2
        assert req_info.value.url.endswith("/api/speakers/1/reassign-segments")

    def test_rename_from_label_puts_new_name(self, page: Page):
        page.route(
            "**/api/videos/*/transcript",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(_VIDEO_LINES_SPK)),
        )
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(_TWO_SPEAKERS)),
        )
        page.route(
            "**/api/speakers/1",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps({"id": 1, "is_named": True,
                                                         "display_name": "Hamner"})),
        )
        self._open_full_transcript(page)

        page.locator("#video-transcript-view .tline-speaker.editable").first.click()
        editor = page.locator("#video-transcript-view .tline-speaker.editing .tline-speaker-input")
        expect(editor).to_be_visible()
        editor.fill("Hamner")
        with page.expect_request(
            lambda r: r.url.endswith("/api/speakers/1") and r.method == "PUT"
        ) as req_info:
            editor.press("Enter")
        assert req_info.value.post_data_json["name"] == "Hamner"
