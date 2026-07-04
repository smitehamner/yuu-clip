"""
Playwright UI tests — session grouping (sidebar groups, suggest prompt, detail
view, reel scope). Uses route mocking so the tests don't depend on or mutate the
live project's real recordings.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import json

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


def _video(vid, session_id=None, title="", approved=0, **extra):
    base = {
        "id": vid, "filename": f"rec{vid}.mkv", "path": f"rec{vid}.mkv",
        "status": "done", "duration_hms": "20m 00s", "duration_ms": 1_200_000,
        "clip_count": 0, "approved": approved, "exported": 0, "total_clip_ms": 0,
        "score_min": None, "score_max": None, "clips_llm_error": 0,
        "title": title, "title_original": title, "title_is_edited": False,
        "summary": "", "summary_original": "", "summary_is_edited": False,
        "has_timeline": False, "context_names": [],
        "parent_video_id": None, "segment_start_s": None, "segment_end_s": None,
        "session_id": session_id, "source_url": None, "source_path": f"rec{vid}.mkv",
    }
    base.update(extra)
    return base


_VIDEOS = [
    _video(9001, session_id=7001, title="Part A"),
    _video(9002, session_id=7001, title="Part B"),
    _video(9003, title="Loner", approved=2),
]

_SESSIONS = [{
    "id": 7001, "name": "Raid Night", "title": "", "member_ids": [9001, 9002],
    "member_count": 2, "created_at": "2026-07-04T20:00:00+00:00",
}]

_SESSION_DETAIL = {
    "id": 7001, "name": "Raid Night", "title": "The Big Raid",
    "title_original": "The Big Raid", "title_is_edited": False,
    "summary": "", "summary_original": "", "summary_is_edited": False,
    "summarized_at": None, "summary_context": [], "total_ms": 2_400_000,
    "members": [
        {
            "id": 9001, "title": "Part A", "filename": "rec9001.mkv",
            "duration_ms": 1_200_000, "offset_ms": 0, "gap_before_ms": 0,
            "has_timeline": True, "clip_count": 0,
            "timeline": [{"start_hms": "5:00", "end_hms": "10:00", "text": "Intro fight",
                          "local_ms": 300_000, "abs_ms": 300_000}],
            "clips": [],
        },
        {
            "id": 9002, "title": "Part B", "filename": "rec9002.mkv",
            "duration_ms": 1_200_000, "offset_ms": 1_200_000, "gap_before_ms": 300_000,
            "has_timeline": False, "clip_count": 1,
            "timeline": [],
            "clips": [{"id": 555, "local_ms": 30_000, "abs_ms": 1_230_000,
                       "description": "Clutch play", "score_overall": 0.9, "status": "approved"}],
        },
    ],
}


def _route_json(page, pattern, payload):
    page.route(pattern, lambda route: route.fulfill(
        content_type="application/json", body=json.dumps(payload)))


def _boot_with_sessions(page, videos=None, sessions=None, extra_routes=None):
    """Register the sidebar route mocks (plus any extras) BEFORE navigating, so
    boot.js's own loadVideos() renders the mocked recordings/sessions — otherwise
    the real boot fetch races and clobbers a post-goto mock render."""
    _route_json(page, "**/api/videos", videos if videos is not None else _VIDEOS)
    _route_json(page, "**/api/sessions", sessions if sessions is not None else _SESSIONS)
    for pattern, payload in (extra_routes or []):
        _route_json(page, pattern, payload)
    page.evaluate("localStorage.removeItem('yuuclip-view')")
    page.goto(LIVE_URL)
    page.locator("#video-list li.session-header").wait_for(state="visible")


@skip_no_server
class TestSidebarGrouping:
    def test_session_header_groups_members(self, page: Page):
        _boot_with_sessions(page)
        header = page.locator("#video-list li.session-header")
        expect(header).to_contain_text("Raid Night")
        expect(header).to_contain_text("2 recordings")
        assert page.locator("#video-list li.video-item.in-session").count() == 2

    def test_collapse_hides_members(self, page: Page):
        _boot_with_sessions(page)
        page.click("#video-list li.session-header .session-caret")
        assert page.locator("#video-list li.video-item.in-session").count() == 0
        page.click("#video-list li.session-header .session-caret")
        assert page.locator("#video-list li.video-item.in-session").count() == 2


@skip_no_server
class TestGroupingMode:
    def test_selection_mode_shows_checkboxes_and_bar(self, page: Page):
        _boot_with_sessions(page)
        page.click("#session-toolbar button:has-text('Group')")
        expect(page.locator("#session-grouping-bar")).to_be_visible()
        assert page.locator("#video-list .session-select-box").count() >= 1
        # Selecting the lone ungrouped recording is not enough (needs 2+) — the
        # confirm button stays disabled at one selection.
        page.evaluate("toggleGroupSelect(9003)")
        expect(page.locator("#btn-confirm-group")).to_be_disabled()
        page.evaluate("toggleGroupSelect(9001)")
        expect(page.locator("#btn-confirm-group")).to_be_enabled()
        page.click("#session-grouping-bar button:has-text('Cancel')")
        expect(page.locator("#session-grouping-bar")).to_be_hidden()


@skip_no_server
class TestSuggestPrompt:
    def test_suggestion_dismiss_is_remembered(self, page: Page):
        page.evaluate("localStorage.removeItem('yuuclip-session-dismissed')")
        _boot_with_sessions(page, extra_routes=[
            ("**/api/sessions/suggestions",
             [{"video_ids": [9003, 9004], "titles": ["Loner", "Other"]}]),
        ])
        page.click("#session-toolbar button:has-text('Suggest')")
        expect(page.locator(".session-suggestion")).to_be_visible()
        page.click(".session-suggestion button:has-text('Dismiss')")
        # Dismissing the only suggestion closes the modal.
        expect(page.locator(".session-suggestion")).to_have_count(0)
        # Re-opening surfaces no new suggestion (dismissal persisted) → info toast.
        page.click("#session-toolbar button:has-text('Suggest')")
        expect(page.locator(".toast")).to_contain_text("separate")


@skip_no_server
class TestSessionDetailView:
    def test_detail_renders_unified_timeline(self, page: Page):
        _boot_with_sessions(page, extra_routes=[("**/api/sessions/7001", _SESSION_DETAIL)])
        page.click("#video-list li.session-header .session-header-label")
        expect(page.locator("#detail .detail-type-badge")).to_contain_text("Session")
        expect(page.locator("#detail")).to_contain_text("The Big Raid")
        # A timeline entry, a clip marker, and the real-world gap separator.
        expect(page.locator("#session-timeline .session-tl-row")).to_have_count(2)
        expect(page.locator("#session-timeline")).to_contain_text("Clutch play")
        expect(page.locator("#session-timeline .session-gap")).to_contain_text("5 min")


@skip_no_server
class TestReelSessionScope:
    def test_session_appears_as_reel_scope(self, page: Page):
        # Give the session a member with approved clips so it qualifies for the pool.
        videos = [
            _video(9001, session_id=7001, title="Part A", approved=3),
            _video(9002, session_id=7001, title="Part B"),
        ]
        _boot_with_sessions(page, videos=videos,
                            extra_routes=[("**/api/demo/approved-clips*", [])])
        page.evaluate("openHighlightReelsModal('build')")
        expect(page.locator("#highlight-reels-modal")).to_be_visible()
        option = page.locator("#demo-video-id option[value='session:7001']")
        expect(option).to_have_count(1)
        expect(option).to_contain_text("Raid Night")
