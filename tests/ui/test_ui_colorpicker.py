"""Playwright UI test - the shared colour picker (colorpicker.js).

Drives the component in isolation: each test mounts a throwaway input, calls
``ColorPicker.attach`` on it, and exercises the real trigger / hex-entry /
swatch / recently-used behaviour. The original input becomes a hidden
value-store; hex entry and swatches live in the popover. No server data is
needed - the component is pure client-side, so the tests seed and read
localStorage directly instead of depending on interaction timing.
"""
from __future__ import annotations

from conftest import skip_no_server
from playwright.sync_api import Page, expect

_MOUNT_JS = """
([value, clearStores]) => {
  if (clearStores) {
    localStorage.removeItem('yuuclip-color-recent');
    localStorage.removeItem('yuuclip-color-palette');
  }
  document.querySelectorAll('#cp-host').forEach(el => el.remove());
  const host = document.createElement('div');
  host.id = 'cp-host';
  const input = document.createElement('input');
  input.id = 'cp-test';
  input.type = 'color';
  input.value = value;
  host.appendChild(input);
  document.body.appendChild(host);
  ColorPicker.attach(input);
}
"""

_VALUE = "#cp-test"
_TRIGGER = "#cp-host .colorpicker-trigger"
_POP = "#cp-host .colorpicker-pop"
_HEX = "#cp-host .colorpicker-hexfield"
_SWATCH = "#cp-host .colorpicker-swatch"
_PAL_NAME = "#cp-host .colorpicker-palette-input"
_PAL_ADD = "#cp-host .colorpicker-palette-add"
_PAL_ITEM = "#cp-host .colorpicker-palette-item"
_PAL_REMOVE = "#cp-host .colorpicker-palette-remove"


def _mount(page: Page, value: str = "#123456", clear_stores: bool = True) -> None:
    page.evaluate(_MOUNT_JS, [value, clear_stores])


def _enter_hex(page: Page, hexval: str) -> None:
    page.click(_TRIGGER)
    field = page.locator(_HEX)
    field.fill(hexval)
    field.dispatch_event("change")


@skip_no_server
class TestColorPicker:
    def test_native_color_input_becomes_hidden_value_store(self, page: Page):
        _mount(page)
        assert page.locator(_VALUE).get_attribute("type") == "hidden"
        assert page.locator(_VALUE).input_value() == "#123456"
        expect(page.locator(_TRIGGER)).to_have_count(1)
        expect(page.locator(_POP)).to_be_hidden()

    def test_hex_entry_commits_and_syncs_trigger(self, page: Page):
        _mount(page)
        _enter_hex(page, "abcdef")
        assert page.locator(_VALUE).input_value() == "#abcdef"
        bg = page.evaluate(f"getComputedStyle(document.querySelector('{_TRIGGER}')).backgroundColor")
        assert bg == "rgb(171, 205, 239)"  # #abcdef

    def test_shorthand_and_uppercase_hex_are_normalized(self, page: Page):
        _mount(page)
        _enter_hex(page, "ABC")
        assert page.locator(_VALUE).input_value() == "#aabbcc"

    def test_invalid_hex_is_not_committed(self, page: Page):
        _mount(page)
        _enter_hex(page, "nothex")
        assert page.locator(_VALUE).input_value() == "#123456"  # unchanged
        recent = page.evaluate("localStorage.getItem('yuuclip-color-recent')")
        assert recent in (None, "[]")

    def test_swatch_pick_commits_and_closes_popover(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        expect(page.locator(_POP)).to_be_visible()
        first_swatch = page.locator(_SWATCH).first
        chosen = first_swatch.get_attribute("data-color")
        first_swatch.click()
        assert page.locator(_VALUE).input_value() == chosen
        expect(page.locator(_POP)).to_be_hidden()

    def test_recently_used_records_a_pick(self, page: Page):
        _mount(page)
        _enter_hex(page, "a1b2c3")
        recent = page.evaluate("JSON.parse(localStorage.getItem('yuuclip-color-recent'))")
        assert recent[0] == "#a1b2c3"

    def test_recently_used_persists_across_reload(self, page: Page):
        _mount(page)
        _enter_hex(page, "a1b2c3")

        page.reload()
        _mount(page, clear_stores=False)
        page.click(_TRIGGER)
        expect(page.locator(_POP)).to_contain_text("Recently used")
        expect(page.locator(f'{_SWATCH}[data-color="#a1b2c3"]')).to_have_count(1)

    def test_popover_closes_on_outside_click(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        expect(page.locator(_POP)).to_be_visible()
        page.locator("body").click(position={"x": 3, "y": 3})
        expect(page.locator(_POP)).to_be_hidden()

    def test_escape_closes_popover(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        expect(page.locator(_POP)).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.locator(_POP)).to_be_hidden()

    def test_escape_restores_focus_to_trigger(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        page.keyboard.press("Escape")
        on_trigger = page.evaluate(
            "document.activeElement === document.querySelector('#cp-host .colorpicker-trigger')"
        )
        assert on_trigger

    def test_tab_focus_stays_trapped_in_popover(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        expect(page.locator(_POP)).to_be_visible()
        # Tab more times than there are focusable controls; focus must never
        # fall through the dialog to the page behind it.
        for _ in range(15):
            page.keyboard.press("Tab")
            assert page.evaluate(
                "document.querySelector('#cp-host .colorpicker-pop')"
                ".contains(document.activeElement)"
            ), "focus escaped the colour-picker popover"

    def test_shift_tab_from_first_control_wraps_backwards(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        # Focus opens on the hex field (first control); Shift+Tab must wrap to
        # the last control inside the dialog, not leave it.
        page.keyboard.press("Shift+Tab")
        assert page.evaluate(
            "document.querySelector('#cp-host .colorpicker-pop')"
            ".contains(document.activeElement)"
        )

    def test_named_palette_add_apply_and_remove_round_trip(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        page.locator(_HEX).fill("aabbcc")
        page.fill(_PAL_NAME, "Brand blue")
        page.click(_PAL_ADD)

        palette = page.evaluate("JSON.parse(localStorage.getItem('yuuclip-color-palette'))")
        assert palette == [{"name": "Brand blue", "color": "#aabbcc"}]
        expect(page.locator(_PAL_ITEM)).to_have_count(1)
        expect(page.locator(_PAL_ITEM)).to_contain_text("Brand blue")

        # Clicking a palette swatch applies its colour and closes the popover.
        page.click(f"{_PAL_ITEM} .colorpicker-swatch")
        assert page.locator(_VALUE).input_value() == "#aabbcc"

        # Reopen and remove the entry.
        page.click(_TRIGGER)
        page.click(_PAL_REMOVE)
        assert page.evaluate("JSON.parse(localStorage.getItem('yuuclip-color-palette'))") == []
        expect(page.locator(_PAL_ITEM)).to_have_count(0)

    def test_named_palette_persists_across_reload(self, page: Page):
        _mount(page)
        page.click(_TRIGGER)
        page.locator(_HEX).fill("112233")
        page.fill(_PAL_NAME, "Deep")
        page.click(_PAL_ADD)

        page.reload()
        _mount(page, clear_stores=False)
        page.click(_TRIGGER)
        expect(page.locator(_PAL_ITEM)).to_have_count(1)
        expect(page.locator(_PAL_ITEM)).to_contain_text("Deep")
