"""Playwright UI tests - Sensitive Content Settings section and clip surfacing
(roadmap plan 06).

Follows the same pattern as test_ui_hotwords.py: CRUD tests run against the
fixture project's DB, so every test that creates a sensitive term cleans
it up via a direct API call in a ``finally`` block. Badge/detail-panel rendering
tests use synthetic AppState.clips/renderDetail data so they never touch real
clip scores.

Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


def _delete_sensitive_term(page: Page, term_id) -> None:
    if term_id is None:
        return
    page.evaluate("(id) => fetch(`/api/sensitive-terms/${id}`, {method: 'DELETE'})", term_id)


def _create_sensitive_term(page: Page, term, category="privacy", match_mode="exact", enabled=True, context_slug=None):
    return page.evaluate(
        """(args) => fetch('/api/sensitive-terms', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(args),
        }).then(r => r.json())""",
        {"term": term, "category": category, "match_mode": match_mode, "enabled": enabled,
         "context_slug": context_slug},
    )


def _open_settings(page: Page) -> None:
    page.goto(LIVE_URL)
    page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
    page.click("#btn-settings-header")
    page.wait_for_selector("#settings-panel.visible", timeout=3000)
    page.wait_for_selector("#s-sensitive-rows", timeout=3000)


@skip_no_server
class TestSensitiveContentSettingsSection:
    def test_seeded_term_row_renders_with_saved_values(self, page: Page):
        term = _create_sensitive_term(page, "uitest_john", category="censor", match_mode="case_insensitive")
        try:
            _open_settings(page)
            row = page.locator(f'[data-sensitive-row="{term["id"]}"]')
            expect(row).to_be_visible()
            expect(row.locator(".st-term")).to_have_value("uitest_john")
            expect(row.locator(".st-category")).to_have_value("censor")
            expect(row.locator(".st-mode")).to_have_value("case_insensitive")
        finally:
            _delete_sensitive_term(page, term.get("id"))

    def test_editing_category_persists_via_put(self, page: Page):
        term = _create_sensitive_term(page, "uitest_edit_me")
        try:
            _open_settings(page)
            row = page.locator(f'[data-sensitive-row="{term["id"]}"]')
            row.locator(".st-category").select_option("censor")
            expect(page.locator("#toast-container .toast.success")).to_contain_text("Sensitive term saved")
            saved = page.evaluate(
                "(id) => fetch('/api/sensitive-terms').then(r => r.json())"
                ".then(list => list.find(t => t.id === id))",
                term["id"],
            )
            assert saved["category"] == "censor"
        finally:
            _delete_sensitive_term(page, term.get("id"))

    def test_delete_button_removes_row(self, page: Page):
        term = _create_sensitive_term(page, "uitest_delete_me")
        deleted_via_ui = False
        try:
            _open_settings(page)
            row = page.locator(f'[data-sensitive-row="{term["id"]}"]')
            expect(row).to_be_visible()
            row.locator(".st-delete").click()
            expect(row).to_have_count(0)
            deleted_via_ui = True
        finally:
            if not deleted_via_ui:
                _delete_sensitive_term(page, term.get("id"))

    def test_add_term_button_appends_draft_row_without_persisting_it(self, page: Page):
        _open_settings(page)
        before_rows = page.locator("[data-sensitive-row]").count()
        before_count = page.evaluate("() => fetch('/api/sensitive-terms').then(r => r.json()).then(l => l.length)")
        page.get_by_role("button", name="+ Add Sensitive Term").click()
        expect(page.locator("[data-sensitive-row]")).to_have_count(before_rows + 1)
        after_count = page.evaluate("() => fetch('/api/sensitive-terms').then(r => r.json()).then(l => l.length)")
        assert after_count == before_count

    def test_fuzzy_mode_blocked_for_a_short_term_with_a_message(self, page: Page):
        _open_settings(page)
        page.get_by_role("button", name="+ Add Sensitive Term").click()
        new_row = page.locator("[data-sensitive-row^='draft-']").last
        # Set fuzzy BEFORE the term has a savable value: a per-row auto-save fires
        # on every field change, and a short EXACT term is valid (no min length),
        # so filling the term while the mode is still the default 'exact' can
        # persist "Abc" before fuzzy is chosen - which both defeats the test's
        # intent and pollutes the shared dev DB for the next run. With the mode
        # already fuzzy, any change event trips the client guard and never POSTs.
        new_row.locator(".st-mode").select_option("fuzzy")
        new_row.locator(".st-term").fill("Abc")
        new_row.locator(".st-term").dispatch_event("change")
        try:
            expect(new_row.locator(".st-fuzzy-warning")).to_be_visible()
            expect(new_row.locator(".st-fuzzy-warning")).to_contain_text("at least 4 characters")
            # Blocked client-side - no draft should have reached the server.
            terms = page.evaluate("() => fetch('/api/sensitive-terms').then(r => r.json())")
            assert not any(t["term"] == "Abc" for t in terms)
        finally:
            # Defensive: guarantee the shared DB carries no "Abc" into later runs.
            page.evaluate(
                "() => fetch('/api/sensitive-terms').then(r => r.json()).then(list =>"
                " Promise.all(list.filter(t => t.term === 'Abc')"
                ".map(t => fetch(`/api/sensitive-terms/${t.id}`, {method: 'DELETE'}))))"
            )


@skip_no_server
class TestSensitiveContextScopeUI:
    def test_global_term_renders_under_global_group(self, page: Page):
        term = _create_sensitive_term(page, "uitest_global_scope")
        try:
            _open_settings(page)
            row = page.locator(f'[data-sensitive-row="{term["id"]}"]')
            expect(row.locator(".st-context")).to_have_value("")
            expect(page.locator("#s-sensitive-rows")).to_contain_text("Global (all recordings)")
        finally:
            _delete_sensitive_term(page, term.get("id"))

    def test_context_term_renders_selector_and_group_heading(self, page: Page):
        term = _create_sensitive_term(page, "uitest_ctx_scope", context_slug="fantasy-rp")
        try:
            _open_settings(page)
            row = page.locator(f'[data-sensitive-row="{term["id"]}"]')
            expect(row.locator(".st-context")).to_have_value("fantasy-rp")
            expect(page.locator("#s-sensitive-rows")).to_contain_text("Fantasy RP")
        finally:
            _delete_sensitive_term(page, term.get("id"))

    def test_changing_scope_persists_via_put(self, page: Page):
        term = _create_sensitive_term(page, "uitest_scope_change")
        try:
            _open_settings(page)
            row = page.locator(f'[data-sensitive-row="{term["id"]}"]')
            row.locator(".st-context").select_option("multiplayer-shooter")
            expect(page.locator("#toast-container .toast.success")).to_contain_text("Sensitive term saved")
            saved = page.evaluate(
                "(id) => fetch('/api/sensitive-terms').then(r => r.json())"
                ".then(list => list.find(t => t.id === id))",
                term["id"],
            )
            assert saved["context_slug"] == "multiplayer-shooter"
        finally:
            _delete_sensitive_term(page, term.get("id"))


@skip_no_server
class TestClipSensitiveBadge:
    def _set_clips_and_render(self, page: Page, clips) -> None:
        page.evaluate("(clips) => { AppState.clips = clips; _renderClips(); }", clips)

    def _base_clip(self, clip_id, sensitive_matches):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30", "status": "pending",
            "scored_at": None, "score_overall": 0, "score_funny": 0, "score_dramatic": 0, "score_action": 0,
            "hotword_matches": [], "sensitive_matches": sensitive_matches,
        }

    def test_flagged_clip_shows_warning_badge(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        matches = [{"term": "John", "category": "privacy", "mode": "exact", "matched_text": "John", "count": 1}]
        self._set_clips_and_render(page, [self._base_clip(9301, matches)])
        row = page.locator("#clip-list li[data-clip-id='9301']")
        expect(row.locator(".clip-flag-badge")).to_be_visible()

    def test_unflagged_clip_has_no_badge(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        self._set_clips_and_render(page, [self._base_clip(9302, [])])
        row = page.locator("#clip-list li[data-clip-id='9302']")
        expect(row.locator(".clip-flag-badge")).to_have_count(0)


@skip_no_server
class TestFlaggedFilterTab:
    def _set_clips_and_render(self, page: Page, clips) -> None:
        page.evaluate("(clips) => { AppState.clips = clips; _renderClips(); }", clips)

    def _base_clip(self, clip_id, sensitive_matches, status="pending"):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30", "status": status,
            "scored_at": None, "score_overall": 0, "score_funny": 0, "score_dramatic": 0, "score_action": 0,
            "hotword_matches": [], "sensitive_matches": sensitive_matches,
        }

    def test_flagged_tab_shows_only_flagged_clips(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        matches = [{"term": "John", "category": "privacy", "mode": "exact", "matched_text": "John", "count": 1}]
        self._set_clips_and_render(page, [
            self._base_clip(9401, matches),
            self._base_clip(9402, []),
        ])
        # Flagged now lives inside the collapsed "More filters" expander.
        page.click("#clip-more-filters > summary")
        page.click("[data-filter='flagged']")
        expect(page.locator("#clip-list li[data-clip-id]")).to_have_count(1)
        expect(page.locator("#clip-list li[data-clip-id='9401']")).to_be_visible()
        page.click("[data-filter='all']")

    def test_flagged_tab_empty_state_points_to_settings(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        self._set_clips_and_render(page, [self._base_clip(9403, [])])
        page.click("#clip-more-filters > summary")
        page.click("[data-filter='flagged']")
        expect(page.locator("#clip-list")).to_contain_text("No flagged clips")
        page.click("[data-filter='all']")


@skip_no_server
class TestClipSensitiveDetailBlock:
    def _base_clip(self, clip_id, sensitive_matches):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30",
            "status": "pending", "tags": [], "user_tags": [],
            "start_offset": 0, "end_offset": 0, "has_export": False,
            "hotword_matches": [], "sensitive_matches": sensitive_matches,
        }

    def test_detail_panel_lists_matches_by_category(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        clip = self._base_clip(9501, [
            {"term": "John", "category": "privacy", "mode": "exact", "matched_text": "John", "count": 2},
            {"term": "badword", "category": "censor", "mode": "fuzzy", "matched_text": "badwrd", "count": 1},
        ])
        page.evaluate("(clip) => renderDetail(clip)", clip)
        card = page.locator(".detail-card", has_text="Flagged terms")
        expect(card).to_be_visible()
        expect(card).to_contain_text("John")
        expect(card).to_contain_text("2×")
        expect(card).to_contain_text("badwrd")
        expect(card.locator(".sensitive-category-privacy")).to_be_visible()
        expect(card.locator(".sensitive-category-censor")).to_be_visible()

    def test_detail_panel_omits_card_when_no_matches(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.evaluate("(clip) => renderDetail(clip)", self._base_clip(9502, []))
        expect(page.locator(".detail-card", has_text="Flagged terms")).to_have_count(0)
