"""
Playwright UI tests — Hot-words Settings section and clip surfacing (roadmap plan
03, both stages).

CRUD tests run against the live dev server's real project DB, so every test that
creates a hot-word cleans it up via a direct API call in a ``finally`` block —
mirroring the fake-reel-file cleanup pattern in test_ui_reel.py. Pill and detail-panel
rendering tests use synthetic AppState.clips/renderDetail data (the established
pattern in test_ui_clips.py) so they never touch real clip scores.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from conftest import LIVE_URL, select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect


def _delete_hotword(page: Page, hotword_id) -> None:
    if hotword_id is None:
        return
    page.evaluate("(id) => fetch(`/api/hotwords/${id}`, {method: 'DELETE'})", hotword_id)


def _create_hotword(page: Page, phrase, match_mode="exact", boost=0.2, target="funny", enabled=True):
    return page.evaluate(
        """(args) => fetch('/api/hotwords', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(args),
        }).then(r => r.json())""",
        {"phrase": phrase, "match_mode": match_mode, "boost": boost, "target": target, "enabled": enabled},
    )


def _open_settings(page: Page) -> None:
    page.goto(LIVE_URL)
    page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
    page.click("#btn-settings-header")
    page.wait_for_selector("#settings-panel.visible", timeout=3000)
    page.wait_for_selector("#s-hotword-rows", timeout=3000)


@skip_no_server
class TestHotwordSettingsSection:
    def test_seeded_hotword_row_renders_with_saved_values(self, page: Page):
        hw = _create_hotword(page, "uitest_haha", boost=0.25, target="dramatic")
        try:
            _open_settings(page)
            row = page.locator(f'[data-hotword-row="{hw["id"]}"]')
            expect(row).to_be_visible()
            expect(row.locator(".hw-phrase")).to_have_value("uitest_haha")
            expect(row.locator(".hw-target")).to_have_value("dramatic")
        finally:
            _delete_hotword(page, hw.get("id"))

    def test_editing_boost_persists_via_put(self, page: Page):
        hw = _create_hotword(page, "uitest_edit_me")
        try:
            _open_settings(page)
            row = page.locator(f'[data-hotword-row="{hw["id"]}"]')
            row.locator(".hw-boost").fill("0.4")
            row.locator(".hw-boost").dispatch_event("change")
            expect(page.locator("#toast-container .toast.success")).to_contain_text("Hot-word saved")
            saved = page.evaluate(
                "(id) => fetch('/api/hotwords').then(r => r.json())"
                ".then(list => list.find(h => h.id === id))",
                hw["id"],
            )
            assert saved["boost"] == 0.4
        finally:
            _delete_hotword(page, hw.get("id"))

    def test_delete_button_removes_row(self, page: Page):
        hw = _create_hotword(page, "uitest_delete_me")
        deleted_via_ui = False
        try:
            _open_settings(page)
            row = page.locator(f'[data-hotword-row="{hw["id"]}"]')
            expect(row).to_be_visible()
            row.locator(".hw-delete").click()
            expect(row).to_have_count(0)
            deleted_via_ui = True
        finally:
            if not deleted_via_ui:
                _delete_hotword(page, hw.get("id"))

    def test_add_hotword_button_appends_draft_row_without_persisting_it(self, page: Page):
        _open_settings(page)
        before_rows = page.locator("[data-hotword-row]").count()
        before_count = page.evaluate("() => fetch('/api/hotwords').then(r => r.json()).then(l => l.length)")
        page.get_by_role("button", name="+ Add hot-word").click()
        expect(page.locator("[data-hotword-row]")).to_have_count(before_rows + 1)
        # An empty draft (no phrase typed) must never reach the server.
        after_count = page.evaluate("() => fetch('/api/hotwords').then(r => r.json()).then(l => l.length)")
        assert after_count == before_count

    def test_duplicate_phrase_and_mode_shows_error_toast(self, page: Page):
        hw = _create_hotword(page, "uitest_dup")
        try:
            _open_settings(page)
            page.get_by_role("button", name="+ Add hot-word").click()
            new_row = page.locator("[data-hotword-row^='draft-']").last
            new_row.locator(".hw-phrase").fill("uitest_dup")
            new_row.locator(".hw-phrase").dispatch_event("change")
            expect(page.locator("#toast-container .toast.error")).to_contain_text("already exists")
        finally:
            _delete_hotword(page, hw.get("id"))


@skip_no_server
class TestClipHotwordPills:
    def _set_clips_and_render(self, page: Page, clips) -> None:
        page.evaluate("(clips) => { AppState.clips = clips; _renderClips(); }", clips)

    def _base_clip(self, clip_id, matches):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30", "status": "pending",
            "scored_at": None, "score_overall": 0, "score_funny": 0, "score_dramatic": 0, "score_action": 0,
            "hotword_matches": matches,
        }

    def test_three_or_fewer_matches_render_individual_pills(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        matches = [
            {"phrase": "haha", "mode": "exact", "count": 2},
            {"phrase": "wow", "mode": "exact", "count": 1},
        ]
        self._set_clips_and_render(page, [self._base_clip(9101, matches)])
        row = page.locator("#clip-list li[data-clip-id='9101']")
        expect(row.locator(".tag")).to_have_count(2)
        expect(row.locator(".tag").first).to_contain_text("haha")

    def test_more_than_three_matches_collapse_to_count_pill(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        matches = [{"phrase": f"p{i}", "mode": "exact", "count": 1} for i in range(4)]
        self._set_clips_and_render(page, [self._base_clip(9102, matches)])
        row = page.locator("#clip-list li[data-clip-id='9102']")
        expect(row.locator(".tag")).to_have_count(1)
        expect(row.locator(".tag")).to_contain_text("4")

    def test_no_matches_renders_no_pill(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        self._set_clips_and_render(page, [self._base_clip(9103, [])])
        row = page.locator("#clip-list li[data-clip-id='9103']")
        expect(row.locator(".tag")).to_have_count(0)


@skip_no_server
class TestClipHotwordDetailBlock:
    def _base_clip(self, clip_id, matches, boost=None):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30",
            "status": "pending", "tags": [], "user_tags": [],
            "start_offset": 0, "end_offset": 0, "has_export": False,
            "hotword_matches": matches, "hotword_boost": boost or {},
        }

    def test_detail_panel_lists_matches_and_boost(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        clip = self._base_clip(
            9201,
            [{"phrase": "haha", "mode": "exact", "count": 3}],
            {"funny": 0.2, "overall": 0.0, "dramatic": 0.0, "action": 0.0},
        )
        page.evaluate("(clip) => renderDetail(clip)", clip)
        card = page.locator(".detail-card", has_text="Hot-words")
        expect(card).to_be_visible()
        expect(card).to_contain_text("haha")
        expect(card).to_contain_text("3×")
        expect(card).to_contain_text("funny: +20%")

    def test_detail_panel_omits_card_when_no_matches(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.evaluate("(clip) => renderDetail(clip)", self._base_clip(9202, []))
        expect(page.locator(".detail-card", has_text="Hot-words")).to_have_count(0)


@skip_no_server
class TestSemanticModeSettingsUI:
    def test_semantic_option_is_selectable_and_shows_llm_hint(self, page: Page):
        hw = _create_hotword(page, "uitest_semantic", match_mode="semantic", boost=0.15, target="dramatic")
        try:
            _open_settings(page)
            row = page.locator(f'[data-hotword-row="{hw["id"]}"]')
            expect(row.locator(".hw-mode")).to_have_value("semantic")
            expect(row.locator(".hw-mode option[value='semantic']")).to_be_enabled()
            expect(row).to_contain_text("Uses LLM")
        finally:
            _delete_hotword(page, hw.get("id"))


@skip_no_server
class TestScanActionGating:
    """The recording detail's Additional Actions modal only offers "Scan for
    Hot-words" when at least one enabled 'Meaning (LLM)' hot-word exists."""

    def _open_video_actions(self, page: Page) -> None:
        select_video_with_clips(page)
        page.evaluate("() => openVideoActionsModal(AppState.activeVideoId)")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)

    def test_scan_action_hidden_with_no_semantic_hotwords(self, page: Page):
        self._open_video_actions(page)
        expect(page.locator("#actions-modal-body .action-row:has-text('Scan for Hot-words')")).to_have_count(0)
        page.keyboard.press("Escape")

    def test_scan_action_visible_with_enabled_semantic_hotword(self, page: Page):
        hw = _create_hotword(page, "uitest_scan_gate", match_mode="semantic")
        try:
            page.goto(LIVE_URL)
            page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
            page.evaluate("() => ensureHotwordsCache(true)")
            page.wait_for_function("() => AppState._hotWordsLoaded === true", timeout=3000)
            self._open_video_actions(page)
            expect(page.locator("#actions-modal-body .action-row:has-text('Scan for Hot-words')")).to_be_visible()
            page.keyboard.press("Escape")
        finally:
            _delete_hotword(page, hw.get("id"))

    def test_scan_action_hidden_when_semantic_hotword_disabled(self, page: Page):
        hw = _create_hotword(page, "uitest_scan_gate_disabled", match_mode="semantic", enabled=False)
        try:
            page.goto(LIVE_URL)
            page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
            page.evaluate("() => ensureHotwordsCache(true)")
            page.wait_for_function("() => AppState._hotWordsLoaded === true", timeout=3000)
            self._open_video_actions(page)
            expect(page.locator("#actions-modal-body .action-row:has-text('Scan for Hot-words')")).to_have_count(0)
            page.keyboard.press("Escape")
        finally:
            _delete_hotword(page, hw.get("id"))
