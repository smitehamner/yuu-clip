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


def _route_json(page: Page, url: str, payload) -> None:
    page.route(url, lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps(payload)))


@skip_no_server
class TestPeopleView:
    def _open(self, page: Page, characters=None) -> None:
        # _loadPeople awaits /api/characters too; stub it so the render is hermetic.
        _route_json(page, "**/api/characters", characters or [])
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


_CHARACTER = {"id": 77, "context_slug": "fantasy-rp", "name": "Alara",
              "lore": "elf", "score_boost": 0.3, "context_name": "Fantasy RP"}
_CHARACTER_2 = {"id": 78, "context_slug": "scifi-rp", "name": "Vex",
                "lore": "captain", "score_boost": 0.0, "context_name": "Sci-Fi RP"}


@skip_no_server
class TestCharacterPicker:
    def _open(self, page: Page, characters) -> None:
        _route_json(page, "**/api/characters", characters)
        page.goto(LIVE_URL)
        page.wait_for_function("typeof openPeopleView === 'function'")
        page.evaluate("openPeopleView()")

    def test_picker_shows_when_characters_exist(self, page: Page):
        _route_json(page, "**/api/voices", [{**_VOICE, "characters": []}])
        self._open(page, [_CHARACTER])
        select = page.locator(".voice-character-select")
        expect(select).to_have_count(1)
        expect(select).to_contain_text("Alara")
        assert select.input_value() == ""  # "No character" selected

    def test_picker_hidden_with_no_characters_and_no_link(self, page: Page):
        _route_json(page, "**/api/voices", [{**_VOICE, "characters": []}])
        self._open(page, [])
        expect(page.locator(".voice-character-select")).to_have_count(0)

    def test_preselects_linked_character(self, page: Page):
        _route_json(page, "**/api/voices",
                    [{**_VOICE, "characters": [{"id": 77, "name": "Alara", "context_slug": "fantasy-rp"}]}])
        self._open(page, [_CHARACTER])
        assert page.locator(".voice-character-select").input_value() == "77"

    def test_selecting_character_posts_context_and_link(self, page: Page):
        _route_json(page, "**/api/voices", [{**_VOICE, "characters": []}])
        _route_json(page, "**/api/voices/*/characters", {**_VOICE, "characters": [_CHARACTER]})
        self._open(page, [_CHARACTER])
        with page.expect_request(
            lambda r: r.url.endswith("/characters") and r.method == "POST"
        ) as req_info:
            page.locator(".voice-character-select").select_option("77")
        body = json.loads(req_info.value.post_data)
        assert body == {"context_slug": "fantasy-rp", "character_id": 77}

    def test_two_contexts_render_independent_pickers(self, page: Page):
        """A Person aliased in one context but not the other shows two selects, one per
        world context, each scoped to only that context's characters."""
        _route_json(page, "**/api/voices",
                    [{**_VOICE, "characters": [{"id": 77, "name": "Alara", "context_slug": "fantasy-rp"}]}])
        self._open(page, [_CHARACTER, _CHARACTER_2])
        selects = page.locator(".voice-character-select")
        expect(selects).to_have_count(2)
        fantasy = page.locator('[data-context-slug="fantasy-rp"]')
        scifi = page.locator('[data-context-slug="scifi-rp"]')
        assert fantasy.input_value() == "77"
        assert scifi.input_value() == ""

    def test_changing_one_context_does_not_touch_the_other(self, page: Page):
        _route_json(page, "**/api/voices",
                    [{**_VOICE, "characters": [{"id": 77, "name": "Alara", "context_slug": "fantasy-rp"}]}])
        _route_json(page, "**/api/voices/*/characters", {
            **_VOICE,
            "characters": [
                {"id": 77, "name": "Alara", "context_slug": "fantasy-rp"},
                {"id": 78, "name": "Vex", "context_slug": "scifi-rp"},
            ],
        })
        self._open(page, [_CHARACTER, _CHARACTER_2])
        with page.expect_request(
            lambda r: r.url.endswith("/characters") and r.method == "POST"
        ) as req_info:
            page.locator('[data-context-slug="scifi-rp"]').select_option("78")
        body = json.loads(req_info.value.post_data)
        assert body == {"context_slug": "scifi-rp", "character_id": 78}
