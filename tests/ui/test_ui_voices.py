"""Playwright UI test - the People view (project-wide speaker identity).

The /api/voices endpoints are mocked via route interception so the test is
deterministic and needs no cross-recording data on the live server, but it drives the
real openPeopleView -> _loadPeople -> render flow and the rename / confirm actions in
voices.js.
"""
from __future__ import annotations

import json

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect

_VOICE = {
    "id": 5001,
    "name": "Alex",
    "display_name": "Alex",
    "display_index": 1,
    "is_named": True,
    "color": "#4fc3f7",
    "confirmed": True,
    "member_count": 1,
    "members": [
        {"speaker_id": 11, "video_id": 1, "video_filename": "match_a.mkv", "display_name": "Alex"},
    ],
    "suggestion_count": 1,
    "suggestions": [
        {"speaker_id": 22, "video_id": 2, "video_filename": "match_b.mkv",
         "display_name": "Speaker 1", "score": 0.86},
    ],
}


@skip_no_server
class TestPeopleView:
    def _open(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_function("typeof openPeopleView === 'function'")
        page.evaluate("openPeopleView()")

    def test_renders_person_member_and_suggestion(self, page: Page):
        page.route(
            "**/api/voices",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([_VOICE])
            ),
        )
        self._open(page)

        expect(page.locator(".person-card .voice-name-input")).to_have_value("Alex")
        expect(page.locator(".person-member .person-member-file")).to_contain_text("match_a.mkv")
        expect(page.locator(".person-suggestion")).to_contain_text("86% voice match")
        expect(page.locator(".voice-confirm-btn")).to_have_count(1)

    def test_rename_person_sends_put(self, page: Page):
        page.route(
            "**/api/voices",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([_VOICE])
            ),
        )
        page.route(
            "**/api/voices/*",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({**_VOICE, "name": "Alexandra", "display_name": "Alexandra"}),
            ),
        )
        self._open(page)

        name_input = page.locator(".voice-name-input")
        name_input.fill("Alexandra")
        with page.expect_request(
            lambda r: "/api/voices/" in r.url and r.method == "PUT"
        ) as req_info:
            name_input.blur()
        assert "Alexandra" in (req_info.value.post_data or "")

    def test_confirm_suggestion_posts(self, page: Page):
        page.route(
            "**/api/voices",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([_VOICE])
            ),
        )
        page.route(
            "**/api/speakers/*/confirm-voice",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(_VOICE)
            ),
        )
        self._open(page)

        with page.expect_request(
            lambda r: "/confirm-voice" in r.url and r.method == "POST"
        ):
            page.click(".voice-confirm-btn")

    def test_empty_state_when_no_people(self, page: Page):
        page.route(
            "**/api/voices",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([])
            ),
        )
        self._open(page)
        expect(page.locator("#people-list")).to_contain_text("No people yet")
