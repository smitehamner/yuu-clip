"""
Playwright UI tests - World Context manager (M9-2, M9-3, M9-4).

M9-2: context list rows are real buttons (keyboard-reachable).
M9-3: shipped contexts are badged "Template", stay editable, hide Delete, and
      offer Reset-to-template + Use-as-base instead.
M9-4: the Context ID auto-derives from the name while creating a new context.

These tests only inspect the editor DOM - they never Save, Delete, or Reset,
because the live server persists to the real project's contexts.json.
"""
from __future__ import annotations

from conftest import skip_no_server
from playwright.sync_api import Page, expect


def _open_manager(page: Page) -> None:
    page.evaluate("openContextManager()")
    page.wait_for_selector("#context-modal.visible")
    page.wait_for_selector("#context-list-items [data-edit-ctx]")


def _close_manager(page: Page) -> None:
    page.evaluate("cancelContextEdit(); closeContextManager()")
    page.wait_for_selector("#context-modal.visible", state="hidden")


@skip_no_server
class TestContextListRows:
    def test_rows_are_buttons(self, page: Page):
        _open_manager(page)
        rows = page.locator("#context-list-items [data-edit-ctx]")
        assert rows.count() > 0
        tags = page.eval_on_selector_all(
            "#context-list-items [data-edit-ctx]", "els => els.map(e => e.tagName)"
        )
        assert set(tags) == {"BUTTON"}
        _close_manager(page)

    def test_enter_on_focused_row_opens_editor(self, page: Page):
        _open_manager(page)
        page.locator("#context-list-items [data-edit-ctx]").first.focus()
        page.keyboard.press("Enter")
        expect(page.locator("#context-editor")).to_be_visible()
        _close_manager(page)

    def test_shipped_contexts_are_badged_template(self, page: Page):
        _open_manager(page)
        row = page.locator("#context-list-items [data-edit-ctx='fantasy-rp']")
        expect(row).to_contain_text("Template")
        expect(row).not_to_contain_text("Built-in")
        _close_manager(page)


def _edit_template(page: Page) -> None:
    page.click("#context-list-items [data-edit-ctx='fantasy-rp']")
    page.wait_for_selector("#context-editor", state="visible")


@skip_no_server
class TestTemplateEditorActions:
    def test_template_hides_delete_offers_reset_and_duplicate(self, page: Page):
        _open_manager(page)
        _edit_template(page)
        expect(page.locator("#btn-delete-context")).not_to_be_visible()
        expect(page.locator("#btn-reset-context")).to_be_visible()
        expect(page.locator("#btn-duplicate-context")).to_be_visible()
        _close_manager(page)

    def test_template_fields_are_editable(self, page: Page):
        _open_manager(page)
        _edit_template(page)
        expect(page.locator("#ce-setting")).to_be_enabled()
        expect(page.locator("#ce-display-name")).to_be_enabled()
        _close_manager(page)

    def test_duplicate_becomes_new_unsaved_copy(self, page: Page):
        _open_manager(page)
        _edit_template(page)
        # Read live values first - the user may have edited the template's content
        original_name = page.eval_on_selector("#ce-display-name", "el => el.value")
        original_setting = page.eval_on_selector("#ce-setting", "el => el.value")
        page.evaluate("duplicateContext()")
        assert page.evaluate("AppState.editingContextId") is None
        expect(page.locator("#ce-context-id")).to_be_enabled()
        copy_name = f"{original_name} copy"
        assert page.eval_on_selector("#ce-display-name", "el => el.value") == copy_name
        derived_id = page.evaluate("(name) => _deriveContextId(name)", copy_name)
        assert page.eval_on_selector("#ce-context-id", "el => el.value") == derived_id
        assert derived_id.endswith("-copy")
        # Content carried over as the base for the copy
        assert page.eval_on_selector("#ce-setting", "el => el.value") == original_setting
        expect(page.locator("#btn-reset-context")).not_to_be_visible()
        expect(page.locator("#btn-delete-context")).not_to_be_visible()
        _close_manager(page)


@skip_no_server
class TestContextIdDerivation:
    def test_new_context_derives_id_from_name(self, page: Page):
        _open_manager(page)
        page.evaluate("openNewContext()")
        page.fill("#ce-display-name", "My Cool Game!")
        assert page.eval_on_selector("#ce-context-id", "el => el.value") == "my-cool-game"
        _close_manager(page)

    def test_hand_edited_id_stops_following_the_name(self, page: Page):
        _open_manager(page)
        page.evaluate("openNewContext()")
        page.fill("#ce-display-name", "First Name")
        page.fill("#ce-context-id", "custom-id")
        page.fill("#ce-display-name", "Second Name")
        assert page.eval_on_selector("#ce-context-id", "el => el.value") == "custom-id"
        _close_manager(page)

    def test_new_context_focuses_name_not_id(self, page: Page):
        _open_manager(page)
        page.evaluate("openNewContext()")
        expect(page.locator("#ce-display-name")).to_be_focused()
        _close_manager(page)


# The Characters section is DB-backed, so these tests never Save/Delete against the
# live server's project.db - they drive the visibility/form logic in the DOM and mock
# the one GET the list render awaits (per the hermetic-stubbing rule).
def _route_characters(page: Page, characters: list) -> None:
    import json
    page.route(
        "**/api/contexts/*/characters",
        lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(characters)
        ),
    )


@skip_no_server
class TestCharacterSection:
    def test_new_unsaved_context_hides_add_shows_note(self, page: Page):
        _open_manager(page)
        page.evaluate("openNewContext()")
        expect(page.locator("#ce-characters-note")).to_be_visible()
        expect(page.locator("#ce-add-character-btn")).not_to_be_visible()
        _close_manager(page)

    def test_saved_context_shows_add_button(self, page: Page):
        _route_characters(page, [])
        _open_manager(page)
        _edit_template(page)
        expect(page.locator("#ce-add-character-btn")).to_be_visible()
        expect(page.locator("#ce-characters-note")).not_to_be_visible()
        _close_manager(page)

    def test_list_renders_characters_with_boost(self, page: Page):
        _route_characters(page, [
            {"id": 1, "context_slug": "fantasy-rp", "name": "Alara", "lore": "elf", "score_boost": 0.3},
            {"id": 2, "context_slug": "fantasy-rp", "name": "Bram", "lore": "", "score_boost": 0.0},
        ])
        _open_manager(page)
        _edit_template(page)
        page.wait_for_selector("#ce-characters-list [data-edit-char]")
        rows = page.locator("#ce-characters-list [data-edit-char]")
        assert rows.count() == 2
        # Only the boosted character shows a boost badge.
        expect(page.locator("#ce-characters-list")).to_contain_text("boost 30%")
        _close_manager(page)

    def test_open_form_reveals_inputs_and_boost_label_tracks_slider(self, page: Page):
        _route_characters(page, [])
        _open_manager(page)
        _edit_template(page)
        page.evaluate("openCharacterForm()")
        expect(page.locator("#ce-character-form")).to_be_visible()
        expect(page.locator("#ce-add-character-btn")).not_to_be_visible()
        page.evaluate("document.getElementById('ce-char-boost').value = 0.5; _updateCharBoostLabel()")
        assert page.eval_on_selector("#ce-char-boost-label", "el => el.textContent") == "50%"
        page.evaluate("cancelCharacterEdit()")
        expect(page.locator("#ce-character-form")).not_to_be_visible()
        expect(page.locator("#ce-add-character-btn")).to_be_visible()
        _close_manager(page)
