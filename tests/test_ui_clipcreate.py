"""
Playwright UI tests — manual clip creation picker (clipcreate.js).

The transcript, clip-creation, clip-list-reload, clip-detail, media-url, and
rescore endpoints are all mocked so the tests are deterministic and never
create a real row or run live LLM scoring against the project's actual
database — see test_ui_clips.py's TestRescoreClipProgressPill for the same
rule applied to the existing rescore action.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import json
import re

from conftest import select_first_video_and_clip, select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect

_VIDEO_LINES = {
    "lines": [
        {"start_ms": 0,     "end_ms": 2_000,  "speaker": None, "text": "opening line"},
        {"start_ms": 5_000, "end_ms": 8_000,  "speaker": None, "text": "the good part"},
        {"start_ms": 9_000, "end_ms": 12_000, "speaker": None, "text": "closing line"},
    ],
    "seek_offset_s": 0,
}

_FAKE_CLIP_ID = 999_001


def _fake_clip(start_ms: int, end_ms: int) -> dict:
    return {
        "id": _FAKE_CLIP_ID, "video_id": 1, "start_ms": start_ms, "end_ms": end_ms,
        "start_hms": "0:05", "duration_hms": "0:03",
        "score_overall": 0.0, "score_funny": 0.0, "score_dramatic": 0.0, "score_action": 0.0,
        "score_overall_user": None, "scored_at": None,
        "description": "", "description_original": "", "description_is_edited": False,
        "description_long": "", "description_long_original": "", "description_long_is_edited": False,
        "start_offset": 0.0, "end_offset": 0.0, "status": "pending",
        "tags": ["manual"], "user_tags": [],
        "has_export": False, "exported_at": None, "exported_container": None,
        "exported_burn_subs": None, "exported_embed_subs": None, "exported_title_card": None,
        "subtitle_status": "none",
        "related_clips": None, "related_clips_at": None, "related_clips_stale": False,
        "hotword_matches": [], "hotword_boost": {},
        "transcript_stale": False, "export_stale": False, "export_stale_reasons": [],
        "transcript_excerpt": "the good part",
    }


def _open_picker_from_new_clip_button(page: Page) -> None:
    select_video_with_clips(page)
    page.route("**/api/videos/*/transcript", lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps(_VIDEO_LINES)))
    page.click("#btn-new-clip")
    expect(page.locator("#clipcreate-transcript-view .tline")).to_have_count(3, timeout=3000)


@skip_no_server
class TestClipCreateEntryPoints:
    def test_new_clip_button_above_list_opens_picker(self, page: Page):
        _open_picker_from_new_clip_button(page)
        expect(page.locator("#panelnav-root")).to_be_visible()
        expect(page.locator("#panelnav-breadcrumb")).to_contain_text("New clip")

    def test_create_clip_button_on_transcript_opens_picker(self, page: Page):
        select_video_with_clips(page)
        page.route("**/api/videos/*/transcript", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(_VIDEO_LINES)))
        page.click("#detail button:has-text('Create clip')")
        expect(page.locator("#panelnav-root")).to_be_visible()
        expect(page.locator("#clipcreate-transcript-view .tline")).to_have_count(3, timeout=3000)


@skip_no_server
class TestClipCreatePicking:
    def test_click_click_selects_range_and_shows_duration(self, page: Page):
        _open_picker_from_new_clip_button(page)
        lines = page.locator("#clipcreate-transcript-view .tline")
        lines.nth(1).click()  # start = 5_000ms
        lines.nth(2).click()  # end = 12_000ms
        expect(page.locator("#clipcreate-range-header")).to_have_text(re.compile(r"0:05.*0:12.*7s"))
        expect(page.locator("#clipcreate-confirm-btn")).to_be_enabled()

    def test_clicking_earlier_line_resets_start(self, page: Page):
        _open_picker_from_new_clip_button(page)
        lines = page.locator("#clipcreate-transcript-view .tline")
        lines.nth(2).click()  # start = 9_000ms
        lines.nth(0).click()  # earlier than current start → resets start, clears end
        expect(page.locator("#clipcreate-range-header")).to_contain_text("pick an end")
        expect(page.locator("#clipcreate-confirm-btn")).to_be_disabled()

    def test_same_line_twice_makes_a_one_line_selection(self, page: Page):
        _open_picker_from_new_clip_button(page)
        line = page.locator("#clipcreate-transcript-view .tline").nth(1)
        line.click()
        line.click()
        expect(page.locator("#clipcreate-range-header")).to_have_text(re.compile(r"0:05.*0:08.*3s"))

    def test_manual_time_inputs_accept_hms_and_ms(self, page: Page):
        # Small absolute times so the picked range fits inside any real recording
        # in the live project regardless of its actual duration — "0:01:05" exercises
        # the h:mm:ss parse path while staying under two minutes.
        _open_picker_from_new_clip_button(page)
        page.fill("#clipcreate-start-input", "1:23")
        page.locator("#clipcreate-start-input").blur()
        page.fill("#clipcreate-end-input", "0:01:35")
        page.locator("#clipcreate-end-input").blur()
        expect(page.locator("#clipcreate-confirm-btn")).to_be_enabled()

    def test_manual_time_input_rejects_garbage(self, page: Page):
        _open_picker_from_new_clip_button(page)
        page.fill("#clipcreate-start-input", "not-a-time")
        page.locator("#clipcreate-start-input").blur()
        expect(page.locator(".toast.error")).to_be_visible(timeout=2000)
        expect(page.locator("#clipcreate-confirm-btn")).to_be_disabled()


@skip_no_server
class TestClipCreateConfirm:
    def test_confirm_creates_clip_and_selects_it(self, page: Page):
        _open_picker_from_new_clip_button(page)

        created_bodies = []

        def _handle_clips(route):
            if route.request.method == "POST":
                created_bodies.append(route.request.post_data_json)
                route.fulfill(status=200, content_type="application/json",
                               body=json.dumps(_fake_clip(5_000, 12_000)))
            else:
                route.fulfill(status=200, content_type="application/json",
                               body=json.dumps([_fake_clip(5_000, 12_000)]))

        page.route("**/api/videos/*/clips*", _handle_clips)
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(_fake_clip(5_000, 12_000))))
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}/media_url", lambda route: route.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"url": None, "filename": None, "has_captions": False})))
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}/rescore", lambda route: route.fulfill(
            status=200, content_type="text/event-stream",
            body='data: "Scored 1/1 clips"\n\n'
                 'data: {"type": "__DONE__", "description_new": null, "description_long_new": null}\n\n'))

        lines = page.locator("#clipcreate-transcript-view .tline")
        lines.nth(1).click()
        lines.nth(2).click()
        page.click("#clipcreate-confirm-btn")

        expect(page.locator("#panelnav-root")).to_be_hidden(timeout=3000)
        assert created_bodies == [{"start_ms": 5_000, "end_ms": 12_000}]
        expect(page.locator(f"#clip-list li[data-clip-id='{_FAKE_CLIP_ID}']")).to_have_class(re.compile(r"\bactive\b"))

    def test_confirm_button_disables_immediately_to_prevent_double_submit(self, page: Page):
        _open_picker_from_new_clip_button(page)

        # Delay every fetch() in the page by 300ms — purely page-side JS, so
        # Playwright's own expect() polling (which shares the sync driver's single
        # thread with any Python-side delay) is unaffected and can still observe
        # the button's synchronous disable before the mocked create resolves.
        page.evaluate("""() => {
          const _origFetch = window.fetch;
          window.fetch = (...args) => new Promise(resolve => setTimeout(() => resolve(_origFetch(...args)), 300));
        }""")

        create_requests = []

        def _handle_clips(route):
            if route.request.method == "POST":
                create_requests.append(route.request.post_data_json)
                route.fulfill(status=200, content_type="application/json",
                               body=json.dumps(_fake_clip(5_000, 12_000)))
            else:
                route.fulfill(status=200, content_type="application/json",
                               body=json.dumps([_fake_clip(5_000, 12_000)]))

        page.route("**/api/videos/*/clips*", _handle_clips)
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(_fake_clip(5_000, 12_000))))
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}/media_url", lambda route: route.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"url": None, "filename": None, "has_captions": False})))
        page.route(f"**/api/clips/{_FAKE_CLIP_ID}/rescore", lambda route: route.fulfill(
            status=200, content_type="text/event-stream",
            body='data: {"type": "__DONE__", "description_new": null, "description_long_new": null}\n\n'))

        lines = page.locator("#clipcreate-transcript-view .tline")
        lines.nth(1).click()
        lines.nth(2).click()
        btn = page.locator("#clipcreate-confirm-btn")
        btn.click()
        expect(btn).to_be_disabled()
        expect(page.locator("#panelnav-root")).to_be_hidden(timeout=3000)
        assert len(create_requests) == 1


@skip_no_server
class TestClipCreateDirtyGuardAndShortcuts:
    def test_back_button_guards_a_picked_range(self, page: Page):
        _open_picker_from_new_clip_button(page)
        page.locator("#clipcreate-transcript-view .tline").nth(1).click()
        page.click("#panelnav-breadcrumb button:has-text('Back')")
        expect(page.locator("#confirm-modal")).to_be_visible()
        page.click("#confirm-cancel-btn")
        expect(page.locator("#clipcreate-transcript-view")).to_be_visible()

    def test_approve_shortcut_suppressed_while_picker_open(self, page: Page):
        # Select a real clip first so AppState.activeClipId is set — otherwise
        # the shortcut would no-op anyway (no subject clip) and prove nothing
        # about the PanelNav guard specifically.
        select_first_video_and_clip(page)
        video_id = page.evaluate("AppState.activeVideoId")
        page.route("**/api/videos/*/transcript", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(_VIDEO_LINES)))
        page.evaluate(f"openClipCreatePicker({video_id})")
        expect(page.locator("#clipcreate-transcript-view .tline")).to_have_count(3, timeout=3000)

        status_requests = []
        page.route("**/api/clips/*/status", lambda route: (status_requests.append(1), route.abort())[-1])
        page.keyboard.press("a")
        page.wait_for_timeout(200)
        assert not status_requests
