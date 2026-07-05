"""
Playwright UI tests — transcript name correction (namecorrections.js).

The scan/apply endpoints are on-demand (fired after the panel opens), so they are
mocked with page.route right before opening the panel — the panel is opened by
calling openNameCorrections() directly against a real selected recording. No real
transcript is scanned or edited.

Run against the live dev server on port 8080. See tests/conftest.py for helpers.
"""
from __future__ import annotations

import json

from conftest import select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect

_SCAN = {
    "lexicon": ["Yuu", "Mara"],
    "scanned_segments": 3,
    "groups": [{
        "token": "You", "suggested": "Yuu", "count": 2,
        "instances": [
            {"segment_id": 11, "token": "You", "token_start": 0, "token_end": 3,
             "score": 66.7, "speaker_scoped": True, "common_word": True, "speaker": "Mara",
             "before": "warm up first", "line": "You were amazing there", "after": "then it ended"},
            {"segment_id": 12, "token": "You", "token_start": 8, "token_end": 11,
             "score": 66.7, "speaker_scoped": False, "common_word": True, "speaker": None,
             "before": "", "line": "I think You won it", "after": ""},
        ],
    }],
}

_EMPTY = {"lexicon": ["Yuu"], "scanned_segments": 5, "groups": []}


def _mock_scan(page: Page, payload: dict) -> None:
    page.route("**/api/videos/*/name-corrections/scan", lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps(payload)))


def _open_panel(page: Page, payload: dict = _SCAN) -> int:
    select_video_with_clips(page)
    video_id = page.evaluate("AppState.activeVideoId")
    _mock_scan(page, payload)
    page.evaluate(f"openNameCorrections({video_id})")
    expect(page.locator("#panelnav-root")).to_be_visible()
    return video_id


@skip_no_server
class TestNameCorrectionsPanel:
    def test_panel_opens_with_grouped_results(self, page: Page):
        _open_panel(page)
        expect(page.locator("#panelnav-breadcrumb")).to_contain_text("Fix names")
        expect(page.locator(".nc-group")).to_have_count(1)
        expect(page.locator(".nc-from")).to_have_text("You")
        expect(page.locator(".nc-to")).to_have_text("Yuu")
        expect(page.locator(".nc-instance")).to_have_count(2)

    def test_matched_token_is_highlighted(self, page: Page):
        _open_panel(page)
        marks = page.locator(".nc-mark")
        expect(marks).to_have_count(2)
        expect(marks.first).to_have_text("You")

    def test_unattributed_instance_shows_speaker_unknown_chip(self, page: Page):
        _open_panel(page)
        expect(page.locator(".nc-chip", has_text="speaker unknown")).to_have_count(1)
        expect(page.locator(".nc-chip", has_text="Mara")).to_have_count(1)

    def test_group_select_all_toggles_instances(self, page: Page):
        _open_panel(page)
        boxes = page.locator(".nc-inst")
        expect(boxes.nth(0)).to_be_checked()
        page.locator(".nc-group-all").uncheck()
        expect(boxes.nth(0)).not_to_be_checked()
        expect(boxes.nth(1)).not_to_be_checked()
        expect(page.locator("#nc-apply")).to_be_disabled()

    def test_apply_sends_only_checked_instances(self, page: Page):
        video_id = _open_panel(page)
        captured: dict = {}
        page.route(f"**/api/videos/{video_id}/name-corrections/apply", lambda route: (
            captured.update(json.loads(route.request.post_data)),
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"applied": 1, "results": [{"applied": True}],
                                           "affected_clip_ids": []})),
        )[-1])
        # Uncheck the second instance, apply just the first.
        page.locator(".nc-inst").nth(1).uncheck()
        expect(page.locator("#nc-apply")).to_have_text("Apply 1 correction")
        page.locator("#nc-apply").click()
        expect(page.locator(".toast")).to_contain_text("Applied 1 correction")
        assert len(captured["corrections"]) == 1
        assert captured["corrections"][0]["segment_id"] == 11
        assert captured["corrections"][0]["replacement"] == "Yuu"

    def test_empty_scan_shows_clean_message(self, page: Page):
        _open_panel(page, _EMPTY)
        expect(page.locator("#nc-results")).to_contain_text("No likely name corrections")
        expect(page.locator("#nc-footer")).to_be_hidden()
