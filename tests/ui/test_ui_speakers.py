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
        # bare assert raced the network under full-suite load). Read the body
        # off the matched request itself (request_info.value), not the
        # put_bodies side list - Playwright does not guarantee the "request"
        # event fires after the page.route handler has finished running, so
        # the list append can still race the assertion even inside this wait.
        with page.expect_request(
            lambda r: "/api/speakers/" in r.url and r.method == "PUT"
        ) as request_info:
            page.click(".colorpicker:has(.speaker-color-input) .colorpicker-trigger")
            hex_field = page.locator(".colorpicker:has(.speaker-color-input) .colorpicker-hexfield")
            hex_field.fill("abcdef")
            hex_field.dispatch_event("change")

        assert "abcdef" in (request_info.value.post_data or ""), put_bodies

    def test_rename_patches_open_recording_transcript_in_place(self, page: Page):
        """Renaming a speaker updates the expanded full-transcript label in place -
        WITHOUT re-fetching/rebuilding the panel.

        The old behaviour re-fetched the whole transcript on every rename, which was
        disruptive while editing inside it (lost scroll/focus/in-progress edits). Now the
        label is patched directly from the rename response, so the transcript endpoint is
        hit exactly once (the initial expand), never again on rename.
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
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {"lines": [{"start_ms": 0, "end_ms": 2000, "speaker": "Speaker 1",
                                "speaker_id": _SPEAKER["id"], "text": "let's go go go"}]}
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

        page.locator("#video-transcript-details .detail-card-title").click()
        expect(page.locator("#video-transcript-view .tline-speaker").first).to_have_text("Speaker 1")

        name_input = page.locator(".speaker-name-input")
        name_input.fill("Yuu")
        name_input.blur()

        # The label updates in place to the new name...
        expect(page.locator("#video-transcript-view .tline-speaker").first).to_have_text("Yuu")
        # ...and the transcript was NOT re-fetched (only the initial expand hit it).
        assert calls["n"] == 1

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
        expect(chip).to_contain_text("Same voice as")
        expect(chip).to_contain_text("Yuu")
        expect(chip).to_contain_text("70%")

        page.locator(".speaker-samevoice").click()
        expect(page.locator("#toast-container")).to_contain_text("Merged into Yuu")
        assert posted["url"] and posted["url"].endswith("/api/speakers/90002/confirm-match"), posted


@skip_no_server
class TestSpeakerPersonControls:
    """Project-wide identity (Person) controls on the per-recording Speakers card."""

    def _select_first_video(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.locator("#video-list li[data-video-id]").first.click()

    def test_named_speaker_can_promote_to_person(self, page: Page):
        named = {**_SPEAKER, "name": "Yuu", "display_name": "Yuu", "is_named": True,
                 "global_voice_id": None, "person_name": None,
                 "suggested_voice_id": None, "suggested_voice_name": None,
                 "suggested_voice_score": None}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([named])
            ),
        )

        def _handle_promote(route):
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": 7001, "display_name": "Yuu", "is_named": True}))

        page.route("**/api/voices", _handle_promote)
        self._select_first_video(page)

        promote = page.locator(".speaker-promote")
        expect(promote).to_have_count(1)
        with page.expect_request(lambda r: r.url.endswith("/api/voices") and r.method == "POST"):
            promote.click()

    def test_unconfirmed_suggestion_hides_promote(self, page: Page):
        # Promoting an unconfirmed inferred name would mint an unnamed Person, so the
        # button must not show until the name is accepted.
        suggestion = {**_SPEAKER, "name": "Guess", "display_name": "Speaker 1",
                      "is_named": True, "source": "inferred", "confirmed": False,
                      "global_voice_id": None, "person_name": None,
                      "suggested_voice_id": None, "suggested_voice_name": None}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([suggestion])
            ),
        )
        self._select_first_video(page)
        expect(page.locator("#speakers-section .speaker-row")).to_have_count(1)
        expect(page.locator(".speaker-promote")).to_have_count(0)

    def test_person_line_shown_when_linked(self, page: Page):
        linked = {**_SPEAKER, "global_voice_id": 7001, "person_name": "Yuu",
                  "suggested_voice_id": None, "suggested_voice_name": None,
                  "suggested_voice_score": None}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([linked])
            ),
        )
        self._select_first_video(page)
        person = page.locator("#speakers-section .speaker-person")
        expect(person).to_have_count(1)
        expect(person).to_contain_text("Yuu")
        expect(page.locator(".speaker-promote")).to_have_count(0)

    def test_override_note_shown_only_when_identity_override_true(self, page: Page):
        linked = {**_SPEAKER, "global_voice_id": 7001, "person_name": "Yuu",
                  "identity_override": True,
                  "suggested_voice_id": None, "suggested_voice_name": None,
                  "suggested_voice_score": None}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([linked])
            ),
        )
        self._select_first_video(page)
        expect(page.locator(".speaker-override-note")).to_have_count(1)

    def test_unlink_button_confirms_then_posts_split(self, page: Page):
        linked = {**_SPEAKER, "global_voice_id": 7001, "person_name": "Yuu",
                  "suggested_voice_id": None, "suggested_voice_name": None,
                  "suggested_voice_score": None}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([linked])
            ),
        )
        page.route(
            "**/api/voices/*/split",
            lambda route: route.fulfill(status=200, content_type="application/json", body="{}"),
        )
        self._select_first_video(page)

        page.locator(".speaker-unlink-btn").click()
        page.locator("#confirm-ok-btn").wait_for(state="visible", timeout=2000)
        with page.expect_request(
            lambda r: r.url.endswith("/api/voices/7001/split") and r.method == "POST"
        ) as req_info:
            page.click("#confirm-ok-btn")
        assert json.loads(req_info.value.post_data)["speaker_id"] == _SPEAKER["id"]

    def test_cross_recording_chip_confirm_posts(self, page: Page):
        suggested = {**_SPEAKER, "id": 90003, "global_voice_id": None, "person_name": None,
                     "suggested_voice_id": 7001, "suggested_voice_name": "Yuu",
                     "suggested_voice_score": 0.85}
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps([suggested])
            ),
        )
        page.route(
            "**/api/speakers/*/confirm-voice",
            lambda route: route.fulfill(status=200, content_type="application/json", body="{}"),
        )
        self._select_first_video(page)

        chip = page.locator("#speakers-section .speaker-personmatch")
        expect(chip).to_contain_text("85% match")
        with page.expect_request(
            lambda r: "/confirm-voice" in r.url and r.method == "POST"
        ):
            page.locator(".speaker-sameperson").click()


@skip_no_server
class TestSpeakerCardEditing:
    """Feature B: create a new speaker and whole-speaker merge from the Speakers card."""

    def _two(self):
        return [
            _SPEAKER,
            {**_SPEAKER, "id": 90002, "display_index": 2, "name": "Bob",
             "display_name": "Bob", "is_named": True},
        ]

    def _select_first_video(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.locator("#video-list li[data-video-id]").first.click()

    def test_new_speaker_button_posts(self, page: Page):
        def _speakers(route):
            if route.request.method == "POST":
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps({**_SPEAKER, "id": 90003, "display_index": 2,
                                               "display_name": "Speaker 2"}))
            else:
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps([_SPEAKER]))

        page.route("**/api/videos/*/speakers", _speakers)
        self._select_first_video(page)

        expect(page.locator(".speaker-new-btn")).to_have_count(1)
        with page.expect_request(
            lambda r: r.url.endswith("/speakers") and r.method == "POST"
        ):
            page.click(".speaker-new-btn")

    def test_merge_select_confirms_and_posts(self, page: Page):
        page.route(
            "**/api/videos/*/speakers",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(self._two())),
        )
        page.route(
            "**/api/speakers/*/merge-into/*",
            lambda route: route.fulfill(status=200, content_type="application/json",
                                        body=json.dumps(_SPEAKER)),
        )
        self._select_first_video(page)

        # First row is Speaker 90001; its only merge option is Bob (90002).
        page.locator(".speaker-merge-select").first.select_option("90002")
        page.locator("#confirm-ok-btn").wait_for(state="visible", timeout=2000)
        with page.expect_request(
            lambda r: "/merge-into/" in r.url and r.method == "POST"
        ):
            page.click("#confirm-ok-btn")

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
