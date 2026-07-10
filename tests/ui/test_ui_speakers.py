"""Playwright UI test - the Speakers card in the recording detail view.

The /api/speakers endpoints are mocked via route interception so the test is
deterministic and needs no diarized data on the live server, but it drives the
real loadSpeakers → render → rename flow in speakers.js.
"""
from __future__ import annotations

import json

from conftest import LIVE_URL, select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect

_SPEAKER = {
    "id": 90001,
    "video_id": 1,
    "display_index": 1,
    "name": None,
    "display_name": "Speaker 1",
    "is_named": False,
    "source": "manual",
    "confirmed": True,
    "color": "#4fc3f7",
    "sample_text": "let's go go go",
    "sample_start_ms": 0,
    "sample_end_ms": 3000,
}


@skip_no_server
class TestSpeakerNaming:
    def _select_first_video(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.locator("#video-list li[data-video-id]").first.click()

    def test_card_renders_and_rename_sends_put(self, page: Page):
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([_SPEAKER])
            ),
        )
        put_bodies: list[str] = []

        def _handle_put(route):
            put_bodies.append(route.request.post_data or "")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({**_SPEAKER, "name": "Yuu", "display_name": "Yuu", "is_named": True}),
            )

        page.route("**/api/speakers/*", _handle_put)

        self._select_first_video(page)

        # Card renders with the "Speaker N" tag, a play button, and the sample snippet.
        expect(page.locator("#speakers-section .speaker-tag")).to_have_text("Speaker 1")
        expect(page.locator("#speakers-section .speaker-play")).to_have_count(1)
        expect(page.locator("#speakers-section .speaker-sample")).to_contain_text("let's go go go")

        # Typing a name and blurring sends a PUT with the name and toasts success.
        name_input = page.locator(".speaker-name-input")
        name_input.fill("Yuu")
        name_input.blur()

        expect(page.locator("#toast-container")).to_contain_text("Yuu")
        assert any("Yuu" in body for body in put_bodies), put_bodies

    def test_color_input_prefilled_and_change_sends_put(self, page: Page):
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([_SPEAKER])
            ),
        )
        put_bodies: list[str] = []

        def _handle_put(route):
            put_bodies.append(route.request.post_data or "")
            route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({**_SPEAKER, "color": "#abcdef"}),
            )

        page.route("**/api/speakers/*", _handle_put)
        self._select_first_video(page)

        # The native input is now the picker's hidden value-store; it keeps the
        # speaker's saved colour and the change still fires the PUT.
        color_input = page.locator(".speaker-color-input")
        expect(color_input).to_have_value("#4fc3f7")

        # The PUT is an async fetch; wait for it to actually reach the route
        # rather than asserting on put_bodies before the request lands (the
        # bare assert raced the network under full-suite load).
        with page.expect_request(
            lambda r: "/api/speakers/" in r.url and r.method == "PUT"
        ):
            page.click(".colorpicker:has(.speaker-color-input) .colorpicker-trigger")
            hex_field = page.locator(".colorpicker:has(.speaker-color-input) .colorpicker-hexfield")
            hex_field.fill("abcdef")
            hex_field.dispatch_event("change")

        assert any("abcdef" in body for body in put_bodies), put_bodies

    def test_rename_reloads_open_recording_transcript(self, page: Page):
        """Renaming a speaker refreshes the expanded full-transcript in place.

        Regression: the transcript's fetch-once cache kept the old "Speaker N"
        label until a manual page refresh.
        """
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([_SPEAKER])
            ),
        )

        calls = {"n": 0}

        def _handle_transcript(route):
            calls["n"] += 1
            speaker = "Speaker 1" if calls["n"] == 1 else "Yuu"
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {"lines": [{"start_ms": 0, "end_ms": 2000, "speaker": speaker, "text": "let's go go go"}]}
                ),
            )

        page.route("**/api/videos/*/transcript", _handle_transcript)
        page.route(
            "**/api/speakers/*",
            lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({**_SPEAKER, "name": "Yuu", "display_name": "Yuu", "is_named": True}),
            ),
        )

        select_video_with_clips(page)

        page.locator("#video-transcript-details summary").click()
        expect(page.locator("#video-transcript-view .tline-speaker").first).to_have_text("Speaker 1")

        name_input = page.locator(".speaker-name-input")
        name_input.fill("Yuu")
        name_input.blur()

        # The open transcript reloads with the new name - no manual refresh.
        expect(page.locator("#video-transcript-view .tline-speaker").first).to_have_text("Yuu")

    def test_voice_match_chip_renders_and_confirm_posts(self, page: Page):
        prior = {**_SPEAKER, "id": 90001, "display_index": 1, "name": "Yuu",
                 "display_name": "Yuu", "is_named": True,
                 "suggested_match_id": None, "suggested_match_name": None,
                 "suggested_match_score": None}
        suggested = {**_SPEAKER, "id": 90002, "display_index": 2,
                     "suggested_match_id": 90001, "suggested_match_name": "Yuu",
                     "suggested_match_score": 0.7}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([prior, suggested])
            ),
        )
        posted = {"url": None}

        def _handle_confirm(route):
            posted["url"] = route.request.url
            route.fulfill(status=200, content_type="application/json", body=json.dumps(prior))

        page.route("**/api/speakers/*/confirm-match", _handle_confirm)
        self._select_first_video(page)

        chip = page.locator("#speakers-section .speaker-voicematch")
        expect(chip).to_have_count(1)  # only the borderline speaker shows one
        expect(chip).to_contain_text("Might be")
        expect(chip).to_contain_text("Yuu")
        expect(chip).to_contain_text("70% voice match")

        page.locator(".speaker-samevoice").click()
        expect(page.locator("#toast-container")).to_contain_text("Merged into Yuu")
        assert posted["url"] and posted["url"].endswith("/api/speakers/90002/confirm-match"), posted

    def test_voice_match_different_voice_posts_reject(self, page: Page):
        suggested = {**_SPEAKER, "id": 90002, "display_index": 2,
                     "suggested_match_id": 90001, "suggested_match_name": "Yuu",
                     "suggested_match_score": 0.7}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([suggested])
            ),
        )
        posted = {"url": None}

        def _handle_reject(route):
            posted["url"] = route.request.url
            route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({**suggested, "suggested_match_id": None,
                                 "suggested_match_name": None, "suggested_match_score": None}),
            )

        page.route("**/api/speakers/*/reject-match", _handle_reject)
        self._select_first_video(page)

        page.locator(".speaker-diffvoice").click()
        expect(page.locator("#toast-container")).to_contain_text("Kept as a separate speaker")
        assert posted["url"] and posted["url"].endswith("/api/speakers/90002/reject-match"), posted

    def test_card_absent_when_no_speakers(self, page: Page):
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body="[]"
            ),
        )
        self._select_first_video(page)
        # #speakers-section stays present but empty - no card rendered.
        expect(page.locator("#speakers-section .detail-card")).to_have_count(0)
