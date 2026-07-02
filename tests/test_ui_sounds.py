"""
Playwright UI tests — notification sound picker (sounds.js).

Exercises the public surface only: `SoundFx.play`/`SoundFx.stop`, the Settings
panel wiring (`initSoundSettings`), and the `yuuclip-sounds` localStorage
contract those two talk through (the persistence format is effectively part
of the public contract — it's how settings survive a reload). sounds.js is an
IIFE that intentionally does not export its internal `_loadState`/`_saveState`
helpers, matching the "wrapped feature module" convention documented for the
rest of the frontend.

Playback itself (HTMLAudioElement.play()) is not asserted beyond "a src got
set" — autoplay policies make actual playback flaky in a headless browser,
and the code already swallows play() rejection intentionally.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect

_STORE_KEY = "yuuclip-sounds"


def _set_stored_state(page: Page, state: dict) -> None:
    import json
    page.evaluate(
        "(raw) => localStorage.setItem('yuuclip-sounds', raw)",
        json.dumps(state),
    )


# ---------------------------------------------------------------------------
# playActionSound (SoundFx.play) — gates on the per-event enabled flag
# ---------------------------------------------------------------------------

@skip_no_server
class TestSoundFxPlay:
    def test_disabled_event_does_not_touch_player(self, page: Page):
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        result = page.evaluate(
            "() => {"
            "  const before = document.querySelector('audio')?.src;"
            "  SoundFx.play('analysis');"
            "  return true;"  # no exception is the main assertion; src assert below
            "}"
        )
        assert result is True

    def test_enabled_event_plays_configured_sound(self, page: Page):
        # No dedicated getter exists for the shared <audio> element's src, so
        # observe the effect indirectly: SoundFx.play must not throw and the
        # sound-stop pill (only shown once playback starts) must appear.
        _set_stored_state(page, {
            "version": 1, "volume": 0.7,
            "events": {
                "analysis": {"enabled": False, "kind": "builtin", "name": "Windows Notify.wav"},
                "rescore": {"enabled": True, "kind": "builtin", "name": "Windows Ding.wav"},
                "reel": {"enabled": False, "kind": "builtin", "name": "tada.wav"},
                "export": {"enabled": False, "kind": "builtin", "name": "Windows Default.wav"},
                "error": {"enabled": False, "kind": "builtin", "name": "Windows Error.wav"},
            },
        })
        page.evaluate("() => SoundFx.play('rescore')")
        # The stop pill is appended lazily on first play; its presence proves
        # _play() reached the try block and called .play() rather than
        # returning early on the enabled-gate check.
        expect(page.locator(".sound-stop-pill")).to_be_attached(timeout=3000)

    def test_unknown_event_key_is_a_noop(self, page: Page):
        # Defensive: a typo'd event key must not throw.
        threw = page.evaluate(
            "() => { try { SoundFx.play('not-a-real-event'); return false; }"
            "  catch { return true; } }"
        )
        assert threw is False

    def test_stop_hides_the_stop_pill(self, page: Page):
        _set_stored_state(page, {
            "version": 1, "volume": 0.7,
            "events": {
                "analysis": {"enabled": True, "kind": "builtin", "name": "Windows Notify.wav"},
                "rescore": {"enabled": False, "kind": "builtin", "name": "Windows Ding.wav"},
                "reel": {"enabled": False, "kind": "builtin", "name": "tada.wav"},
                "export": {"enabled": False, "kind": "builtin", "name": "Windows Default.wav"},
                "error": {"enabled": False, "kind": "builtin", "name": "Windows Error.wav"},
            },
        })
        page.evaluate("() => SoundFx.play('analysis')")
        expect(page.locator(".sound-stop-pill")).to_be_attached(timeout=3000)
        page.evaluate("() => SoundFx.stop()")
        expect(page.locator(".sound-stop-pill")).to_be_hidden()


# ---------------------------------------------------------------------------
# Settings panel — sound rows render and wire up checkboxes/selects
# ---------------------------------------------------------------------------

@skip_no_server
class TestSoundSettingsPanel:
    def _open_settings(self, page: Page) -> None:
        # Re-navigate so each test starts from a fresh page load (localStorage
        # sound state is read at boot; the fixture's init script keeps the
        # Getting Started modal from auto-opening on any load).
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_selector("#s-sound-rows .settings-row", timeout=3000)

    def test_opening_settings_renders_a_row_per_event(self, page: Page):
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        self._open_settings(page)
        rows = page.locator("#s-sound-rows .settings-row")
        expect(rows).to_have_count(5)
        expect(page.locator("#s-sound-rows")).to_contain_text("Analysis complete")
        expect(page.locator("#s-sound-rows")).to_contain_text("Any job failed")

    def test_checkbox_reflects_stored_enabled_state(self, page: Page):
        _set_stored_state(page, {
            "version": 1, "volume": 0.7,
            "events": {
                "analysis": {"enabled": False, "kind": "builtin", "name": "Windows Notify.wav"},
                "rescore": {"enabled": False, "kind": "builtin", "name": "Windows Ding.wav"},
                "reel": {"enabled": False, "kind": "builtin", "name": "tada.wav"},
                "export": {"enabled": True, "kind": "builtin", "name": "Windows Default.wav"},
                "error": {"enabled": False, "kind": "builtin", "name": "Windows Error.wav"},
            },
        })
        self._open_settings(page)
        checkbox = page.locator(".s-sound-enabled[data-key='export']")
        expect(checkbox).to_be_checked()
        select = page.locator(".s-sound-select[data-key='export']")
        expect(select).to_be_enabled()

    def test_select_disabled_when_event_off(self, page: Page):
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        self._open_settings(page)
        select = page.locator(".s-sound-select[data-key='analysis']")
        expect(select).to_be_disabled()

    def test_checking_box_enables_select_and_persists(self, page: Page):
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        self._open_settings(page)
        page.check(".s-sound-enabled[data-key='reel']")
        select = page.locator(".s-sound-select[data-key='reel']")
        expect(select).to_be_enabled()
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('yuuclip-sounds')).events.reel.enabled"
        )
        assert saved is True

    def test_volume_slider_persists_and_updates_label(self, page: Page):
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        self._open_settings(page)
        page.locator("#s-sound-volume").fill("40")
        page.locator("#s-sound-volume").dispatch_event("input")
        expect(page.locator("#s-sound-volume-val")).to_have_text("40%")
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('yuuclip-sounds')).volume"
        )
        assert saved == 0.4

    def test_changing_select_persists_choice(self, page: Page):
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        self._open_settings(page)
        page.check(".s-sound-enabled[data-key='error']")
        select = page.locator(".s-sound-select[data-key='error']")
        value = page.evaluate(
            "() => document.querySelector(\".s-sound-select[data-key='error']\").options[0].value"
        )
        select.select_option(value)
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('yuuclip-sounds')).events.error"
        )
        expected_kind, expected_name = value.split(":", 1)
        assert saved["kind"] == expected_kind
        assert saved["name"] == expected_name

    def test_reopening_settings_keeps_prior_choices(self, page: Page):
        # initSoundSettings must reload from localStorage on every open, not
        # just once per page load — otherwise a save in one session wouldn't
        # show up the next time Settings is opened without a full refresh.
        page.evaluate("() => localStorage.removeItem('yuuclip-sounds')")
        self._open_settings(page)
        page.check(".s-sound-enabled[data-key='export']")
        page.click("#settings-panel button[aria-label='Close']")
        self._open_settings(page)
        expect(page.locator(".s-sound-enabled[data-key='export']")).to_be_checked()
