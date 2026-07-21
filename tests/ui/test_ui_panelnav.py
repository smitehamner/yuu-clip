"""
Playwright UI tests - panel navigation framework (roadmap plan 04).

Split Editor is the framework's proving consumer, so these tests drive it
through PanelNav rather than testing the framework in isolation. Complements
test_ui_split.py, which covers the editor's own behavior in depth.

Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import pytest
from conftest import open_split_editor as _open_split_editor
from conftest import place_split_point as _place_split_point
from conftest import select_first_video_and_clip, skip_no_server
from playwright.sync_api import Page, expect


@pytest.fixture
def split_editor(page: Page):
    _open_split_editor(page)
    yield page
    # closeSplitEditor bypasses the dirty guard so teardown never hangs on a
    # confirm modal left open by a failing test.
    page.evaluate("_confirmCancel(); closeSplitEditor()")


@skip_no_server
class TestPanelBreadcrumb:
    def test_breadcrumb_shows_back_and_title(self, split_editor: Page):
        crumb = split_editor.locator("#panelnav-breadcrumb")
        expect(crumb.locator("button:has-text('Back')")).to_be_visible()
        expect(crumb).to_contain_text("Split:")

    def test_clean_state_back_closes_with_no_prompt(self, split_editor: Page):
        split_editor.click("#panelnav-breadcrumb button:has-text('Back')")
        expect(split_editor.locator("#confirm-modal")).not_to_be_visible()
        expect(split_editor.locator("#split-editor-panel")).not_to_be_visible()
        expect(split_editor.locator("#panelnav-root")).not_to_be_visible()


@skip_no_server
class TestPanelDirtyGuard:
    def test_discard_closes_panel_and_drops_points(self, split_editor: Page):
        _place_split_point(split_editor)
        split_editor.click("#panelnav-breadcrumb button:has-text('Back')")
        expect(split_editor.locator("#confirm-modal")).to_be_visible()
        split_editor.click("#confirm-ok-btn")
        expect(split_editor.locator("#split-editor-panel")).not_to_be_visible()

    def test_escape_with_dirty_panel_shows_discard_prompt(self, split_editor: Page):
        _place_split_point(split_editor)
        split_editor.keyboard.press("Escape")
        expect(split_editor.locator("#confirm-modal")).to_be_visible()
        split_editor.click("#confirm-cancel-btn")
        expect(split_editor.locator("#split-editor-panel")).to_be_visible()
        expect(split_editor.locator("#split-markers-layer .split-marker")).to_have_count(1)


@skip_no_server
class TestEscapeLayering:
    def test_escape_pops_a_modal_before_the_panel(self, split_editor: Page):
        # A modal opened on top of the panel is the topmost layer - Escape
        # must close it first and leave the panel untouched. The panel covers
        # the sidebar "Additional Actions" trigger, so open a modal directly
        # rather than via a now-unreachable click.
        split_editor.evaluate("openControlsModal()")
        expect(split_editor.locator("#controls-modal.visible")).to_be_visible()
        split_editor.keyboard.press("Escape")
        expect(split_editor.locator("#controls-modal.visible")).not_to_be_visible()
        expect(split_editor.locator("#split-editor-panel")).to_be_visible()

        split_editor.keyboard.press("Escape")
        expect(split_editor.locator("#split-editor-panel")).not_to_be_visible()


@skip_no_server
class TestKeyboardSuppression:
    def test_ajk_shortcuts_do_not_act_on_the_clip_list_behind_the_panel(self, page: Page):
        # Select a clip first so the dispatcher has a subject to (wrongly) act
        # on if the guard were missing, then open the panel directly - opening
        # it via the sidebar's "Additional Actions" would require the
        # recording-detail view, which selecting a clip replaces.
        select_first_video_and_clip(page)
        clip_id = page.evaluate("AppState.activeClipId")
        assert clip_id is not None
        video_id = page.evaluate("AppState.activeVideoId")
        status_before = page.evaluate(
            "(id) => fetch(`/api/clips/${id}`).then(r => r.json()).then(c => c.status)",
            clip_id,
        )

        page.evaluate("(id) => openSplitEditor(id)", video_id)
        expect(page.locator("#split-editor-panel")).to_be_visible(timeout=3000)

        try:
            page.keyboard.press("a")
            page.keyboard.press("r")
            page.keyboard.press("j")
            page.keyboard.press("k")

            status_after = page.evaluate(
                "(id) => fetch(`/api/clips/${id}`).then(r => r.json()).then(c => c.status)",
                clip_id,
            )
            assert status_after == status_before
            assert page.evaluate("AppState.activeClipId") == clip_id
        finally:
            page.evaluate("_confirmCancel(); closeSplitEditor()")
