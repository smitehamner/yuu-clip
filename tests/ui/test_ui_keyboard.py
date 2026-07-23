"""
Playwright UI tests - keyboard layering (CC-2/CC-3/CC-4).

CC-2: Escape closes only the topmost open layer per press (menus, then modals,
      then panels - the Split Editor joins the cascade with its dirty guard).
CC-3: Tab is trapped inside the topmost visible modal.
CC-4: Hamburger and kebab menus focus their first item on open, traverse with
      ArrowUp/Down, and return focus to their trigger on Escape.
"""
from __future__ import annotations

from conftest import skip_no_server
from playwright.sync_api import Page, expect


@skip_no_server
class TestEscapePeelsTopmostLayer:
    def test_alert_over_modal_closes_one_layer_per_press(self, page: Page):
        page.evaluate("openControlsModal()")
        page.wait_for_selector("#controls-modal.visible")
        page.evaluate("showAlert('Something failed', 'details')")
        page.wait_for_selector("#alert-modal.visible")
        page.keyboard.press("Escape")
        page.wait_for_selector("#alert-modal.visible", state="hidden")
        expect(page.locator("#controls-modal")).to_be_visible()
        page.keyboard.press("Escape")
        page.wait_for_selector("#controls-modal.visible", state="hidden")

    def test_hamburger_menu_peels_before_modal(self, page: Page):
        page.evaluate("openControlsModal()")
        page.wait_for_selector("#controls-modal.visible")
        # A real click can't reach #btn-hamburger here - #controls-modal's
        # overlay covers it (the whole point of this test is verifying Escape
        # layering works even though the real UI would never let a user open
        # the hamburger menu while a modal sits on top).
        page.evaluate("toggleHamburger()")
        page.wait_for_selector("#hamburger-menu.open")
        page.keyboard.press("Escape")
        page.wait_for_selector("#hamburger-menu.open", state="hidden")
        expect(page.locator("#controls-modal")).to_be_visible()
        page.keyboard.press("Escape")
        page.wait_for_selector("#controls-modal.visible", state="hidden")

    def test_modal_peels_before_settings_panel(self, page: Page):
        page.evaluate("openSettings()")
        page.wait_for_selector("#settings-panel.visible")
        page.evaluate("openGlossaryModal()")
        page.wait_for_selector("#glossary-modal.visible")
        page.keyboard.press("Escape")
        page.wait_for_selector("#glossary-modal.visible", state="hidden")
        expect(page.locator("#settings-panel")).to_be_visible()
        page.keyboard.press("Escape")
        page.wait_for_selector("#settings-panel.visible", state="hidden")


@skip_no_server
class TestSplitEditorEscape:
    def _open_editor(self, page: Page):
        page.evaluate("""() => {
            AppState.videos.push({id: 999901, filename: 'esc-test.mkv', duration_ms: 60000});
            openSplitEditor(999901);
        }""")
        page.wait_for_selector("#split-editor-panel", state="visible")

    def test_escape_closes_when_no_split_points_placed(self, page: Page):
        self._open_editor(page)
        page.keyboard.press("Escape")
        page.wait_for_selector("#split-editor-panel", state="hidden")

    def test_escape_with_split_points_asks_before_discarding(self, page: Page):
        self._open_editor(page)
        page.evaluate("_splitPoints.push(30); _splitNames = ['Part 1', 'Part 2']")
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible")
        expect(page.locator("#confirm-title")).to_contain_text("Discard changes?")
        expect(page.locator("#split-editor-panel")).to_be_visible()
        page.click("#confirm-ok-btn")
        page.wait_for_selector("#split-editor-panel", state="hidden")

    def test_escape_on_confirm_keeps_editor_and_points(self, page: Page):
        self._open_editor(page)
        page.evaluate("_splitPoints.push(30); _splitNames = ['Part 1', 'Part 2']")
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible")
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible", state="hidden")
        expect(page.locator("#split-editor-panel")).to_be_visible()
        assert page.evaluate("_splitPoints.length") == 1
        page.evaluate("closeSplitEditor()")

    def test_back_button_goes_through_dirty_guard(self, page: Page):
        self._open_editor(page)
        page.evaluate("_splitPoints.push(30); _splitNames = ['Part 1', 'Part 2']")
        page.click("#panelnav-breadcrumb button:has-text('Back')")
        page.wait_for_selector("#confirm-modal.visible")
        expect(page.locator("#split-editor-panel")).to_be_visible()
        page.click("#confirm-cancel-btn")
        page.evaluate("closeSplitEditor()")


@skip_no_server
class TestModalFocusTrap:
    def test_tab_wraps_forward_and_backward(self, page: Page):
        page.evaluate("showConfirm('Trap test', 'body', 'Confirm', () => {})")
        page.wait_for_selector("#confirm-modal.visible")
        expect(page.locator("#confirm-cancel-btn")).to_be_focused()
        page.keyboard.press("Tab")
        expect(page.locator("#confirm-ok-btn")).to_be_focused()
        page.keyboard.press("Tab")
        expect(page.locator("#confirm-cancel-btn")).to_be_focused()
        page.keyboard.press("Shift+Tab")
        expect(page.locator("#confirm-ok-btn")).to_be_focused()
        page.keyboard.press("Escape")

    def test_tab_from_outside_is_pulled_into_the_modal(self, page: Page):
        page.evaluate("showConfirm('Trap test', 'body', 'Confirm', () => {})")
        page.wait_for_selector("#confirm-modal.visible")
        page.evaluate("document.getElementById('btn-analyze').focus()")
        page.keyboard.press("Tab")
        focused_in_modal = page.evaluate(
            "document.getElementById('confirm-modal').contains(document.activeElement)"
        )
        assert focused_in_modal is True
        page.keyboard.press("Escape")

    def test_trap_applies_to_topmost_modal_when_stacked(self, page: Page):
        page.evaluate("openGlossaryModal()")
        page.wait_for_selector("#glossary-modal.visible")
        page.evaluate("showConfirm('Top layer', 'body', 'Confirm', () => {})")
        page.wait_for_selector("#confirm-modal.visible")
        page.keyboard.press("Tab")
        page.keyboard.press("Tab")
        focused_in_confirm = page.evaluate(
            "document.getElementById('confirm-modal').contains(document.activeElement)"
        )
        assert focused_in_confirm is True
        page.keyboard.press("Escape")
        page.keyboard.press("Escape")


@skip_no_server
class TestHamburgerMenuKeyboard:
    def test_open_focuses_first_item(self, page: Page):
        page.click("#btn-hamburger")
        expect(page.locator("#hamburger-menu .hamburger-item").first).to_be_focused()
        page.keyboard.press("Escape")

    def test_arrows_traverse_and_wrap(self, page: Page):
        page.click("#btn-hamburger")
        expect(page.locator("#hamburger-menu .hamburger-item").first).to_be_focused()
        page.keyboard.press("ArrowDown")
        expect(page.locator("#hamburger-menu .hamburger-item").nth(1)).to_be_focused()
        page.keyboard.press("ArrowUp")
        expect(page.locator("#hamburger-menu .hamburger-item").first).to_be_focused()
        page.keyboard.press("ArrowUp")  # wraps to the last visible item
        expect(page.locator("#hamburger-menu .hamburger-item:has-text('About')")).to_be_focused()
        page.keyboard.press("Escape")

    def test_escape_closes_and_refocuses_trigger(self, page: Page):
        page.click("#btn-hamburger")
        page.wait_for_selector("#hamburger-menu.open")
        page.keyboard.press("Escape")
        page.wait_for_selector("#hamburger-menu.open", state="hidden")
        expect(page.locator("#btn-hamburger")).to_be_focused()

    def test_activating_item_returns_focus_to_trigger_after_modal_closes(self, page: Page):
        page.click("#btn-hamburger")
        expect(page.locator("#hamburger-menu .hamburger-item").first).to_be_focused()
        page.keyboard.press("ArrowDown")  # Controls
        page.keyboard.press("Enter")
        page.wait_for_selector("#controls-modal.visible")
        page.keyboard.press("Escape")
        page.wait_for_selector("#controls-modal.visible", state="hidden")
        expect(page.locator("#btn-hamburger")).to_be_focused()


@skip_no_server
class TestKebabMenuKeyboard:
    def _open_kebab(self, page: Page):
        page.evaluate("""() => {
            window._kebabHit = null;
            showKebab(document.getElementById('btn-analyze'), [
                {label: 'First action', action: () => { window._kebabHit = 'first'; }},
                null,
                {label: 'Second action', action: () => { window._kebabHit = 'second'; }},
            ]);
        }""")
        page.wait_for_selector("body > .hamburger-menu.open")

    def test_open_focuses_first_item_and_arrows_traverse(self, page: Page):
        self._open_kebab(page)
        expect(page.locator("body > .hamburger-menu .hamburger-item").first).to_be_focused()
        page.keyboard.press("ArrowDown")
        expect(page.locator("body > .hamburger-menu .hamburger-item").nth(1)).to_be_focused()
        page.keyboard.press("Escape")

    def test_escape_closes_and_refocuses_anchor(self, page: Page):
        self._open_kebab(page)
        page.keyboard.press("Escape")
        page.wait_for_selector("body > .hamburger-menu", state="detached")
        expect(page.locator("#btn-analyze")).to_be_focused()
        assert page.evaluate("window._kebabHit") is None

    def test_enter_activates_item_and_refocuses_anchor(self, page: Page):
        self._open_kebab(page)
        page.keyboard.press("Enter")
        page.wait_for_selector("body > .hamburger-menu", state="detached")
        assert page.evaluate("window._kebabHit") == "first"
        expect(page.locator("#btn-analyze")).to_be_focused()


@skip_no_server
class TestControlsModalCopy:
    def test_esc_row_says_topmost_window(self, page: Page):
        page.evaluate("openControlsModal()")
        page.wait_for_selector("#controls-modal.visible")
        expect(page.locator("#controls-modal")).to_contain_text("Close the topmost window")
        page.keyboard.press("Escape")

    def test_slash_alias_is_listed(self, page: Page):
        page.evaluate("openControlsModal()")
        page.wait_for_selector("#controls-modal.visible")
        expect(page.locator("#controls-modal kbd", has_text="/")).to_have_count(1)
        page.keyboard.press("Escape")
