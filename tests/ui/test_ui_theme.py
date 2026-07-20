"""Live-page theme/accent behaviour for app.css (CC-1 / CC-7).

CC-1: muted text and the pill/button color pairs must meet WCAG AA 4.5:1 on
the surfaces they actually appear on - in every theme, since each theme block
replaces the full palette. CC-7: exactly one semantic warning token
(--warning) exists; the legacy --amber / --warn / --yellow names must stay dead.

Contrast is computed from the live page's resolved custom properties, so the
tests hold no hardcoded color values and survive future palette tweaks.

The pure source-file guards (theme-block completeness, no stray colour literals,
dead legacy tokens) moved to ``tests/unit/test_static_theme_colors.py``; the pure
theme/accent switcher DOM cases moved to ``tests/js/settings/settings.test.js``.
What remains here needs a live page (getComputedStyle, before-first-paint reload,
the Settings save-gating form).

Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import pytest
from conftest import skip_no_server
from playwright.sync_api import Page

THEMES = ["dark", "light", "high-contrast"]

# Accent variants are orthogonal to the base theme (data-accent on <html>). The
# AA contract must hold for every (theme, accent) pairing, so the contrast tests
# below run the full product.
ACCENTS = ["default", "red", "orange", "yellow", "green", "blue", "purple", "pink"]

_CONTRAST_JS = """
(pair) => {
  // Some accent-tinted tokens (e.g. --bg on a data-accent variant) are declared as
  // color-mix(...) rather than a plain hex literal. getComputedStyle on a CUSTOM
  // property returns the declared value verbatim - color-mix() is only evaluated
  // when the browser computes a real CSS property - so resolve every value (token
  // or literal) through a probe element's `color`, which the engine always
  // resolves to an rgb()/rgba() string regardless of the original syntax.
  const resolveRgb = v => {
    const probe = document.createElement('div');
    probe.style.color = v.startsWith('--') ? `var(${v})` : v;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  };
  const lum = colorString => {
    // Chromium serializes a plain hex/rgb() color as legacy rgb(0-255, 0-255, 0-255),
    // but a color-mix() result (higher precision than 8-bit) as the CSS Color 4
    // predefined-color-function form color(srgb 0-1 0-1 0-1) - both are handled.
    const rgbMatch = colorString.match(/^rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*(?:,.*)?\\)$/);
    const colorFnMatch = colorString.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/);
    let r, g, b;
    if (rgbMatch) {
      [r, g, b] = rgbMatch.slice(1, 4).map(v => Number(v) / 255);
    } else if (colorFnMatch) {
      [r, g, b] = colorFnMatch.slice(1, 4).map(Number);
    } else {
      throw new Error(`not a resolvable color: ${colorString}`);
    }
    [r, g, b] = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(resolveRgb(pair[0])), lum(resolveRgb(pair[1]))];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
"""

AA_NORMAL_TEXT = 4.5


def _apply_theme_accent(page: Page, theme: str, accent: str) -> None:
    page.evaluate(
        "([t, a]) => {"
        "  const el = document.documentElement;"
        "  if (t === 'dark') delete el.dataset.theme; else el.dataset.theme = t;"
        "  if (a === 'default') delete el.dataset.accent; else el.dataset.accent = a;"
        "}",
        [theme, accent],
    )


@skip_no_server
@pytest.mark.parametrize("theme", THEMES)
@pytest.mark.parametrize("accent", ACCENTS)
class TestContrastTokens:
    """The AA contract holds under every (theme, accent) combination, not just
    the dark/default baseline."""

    @pytest.fixture(autouse=True)
    def _apply(self, page: Page, theme: str, accent: str):
        _apply_theme_accent(page, theme, accent)

    def _ratio(self, page: Page, fg: str, bg: str) -> float:
        return page.evaluate(_CONTRAST_JS, [fg, bg])

    def test_muted_text_on_surface(self, page: Page):
        assert self._ratio(page, "--muted", "--surface") >= AA_NORMAL_TEXT

    def test_muted_text_on_bg(self, page: Page):
        assert self._ratio(page, "--muted", "--bg") >= AA_NORMAL_TEXT

    def test_muted_text_on_surface_raised(self, page: Page):
        # .rec-model-meta and the "Downloaded" badge render muted text on the
        # recommended-model card (--surface-raised).
        assert self._ratio(page, "--muted", "--surface-raised") >= AA_NORMAL_TEXT

    def test_pending_step_pill_muted_on_border(self, page: Page):
        assert self._ratio(page, "--muted", "--border") >= AA_NORMAL_TEXT

    def test_on_accent_on_accent(self, page: Page):
        # .step.active, .btn.primary, .btn.active, .clip-chip.active
        assert self._ratio(page, "--on-accent", "--accent") >= AA_NORMAL_TEXT

    def test_on_highlight_on_highlight(self, page: Page):
        # Reserved gold fill (Export/keep button, overall-score bar): --on-highlight
        # text over a --highlight fill. Gold is used as fill/border only, never text.
        assert self._ratio(page, "--on-highlight", "--highlight") >= AA_NORMAL_TEXT

    def test_on_green_on_green(self, page: Page):
        # .step.done, .btn.approve.active, .export-pill.is-exported,
        # .run-meta-badge.gpu, .dot-approved
        assert self._ratio(page, "--on-green", "--green") >= AA_NORMAL_TEXT

    def test_on_red_on_red(self, page: Page):
        # .btn.reject.active, .dot-rejected, .split-marker-x
        assert self._ratio(page, "--on-red", "--red") >= AA_NORMAL_TEXT

    def test_pending_dot_bg_on_muted(self, page: Page):
        assert self._ratio(page, "--bg", "--muted") >= AA_NORMAL_TEXT

    def test_accent_text_on_surface(self, page: Page):
        # header h1, .settings-section-title, .spk-menu-item.active
        assert self._ratio(page, "--accent-text", "--surface") >= AA_NORMAL_TEXT

    def test_accent_text_on_bg(self, page: Page):
        # .tline-speaker, .context-chip, .ctx-pill.selected
        assert self._ratio(page, "--accent-text", "--bg") >= AA_NORMAL_TEXT

    def test_warning_text_on_surface(self, page: Page):
        assert self._ratio(page, "--warning", "--surface") >= AA_NORMAL_TEXT

    def test_on_warning_on_warning_fill(self, page: Page):
        # dark-on-amber "Remote LLM" badge: text is --on-warning over a --warning fill
        assert self._ratio(page, "--on-warning", "--warning") >= AA_NORMAL_TEXT

    def test_accent2_text_on_bg(self, page: Page):
        # .description, .video-title, .timeline-stamp render accent2 as body text
        assert self._ratio(page, "--accent2", "--bg") >= AA_NORMAL_TEXT

    def test_accent2_text_on_surface(self, page: Page):
        # .clip-dup-badge and .sensitive-category-privacy render accent2 on the
        # sidebar/card surface
        assert self._ratio(page, "--accent2", "--surface") >= AA_NORMAL_TEXT

    def test_text_on_surface(self, page: Page):
        assert self._ratio(page, "--text", "--surface") >= AA_NORMAL_TEXT

    def test_text_on_bg(self, page: Page):
        # Primary (idle) status filter chips render --text on a --bg fill.
        assert self._ratio(page, "--text", "--bg") >= AA_NORMAL_TEXT


@skip_no_server
class TestThemeSwitcher:
    def test_saved_theme_applied_before_first_paint_on_reload(self, page: Page):
        page.evaluate("localStorage.setItem('yuuclip-theme', 'high-contrast')")
        page.reload()
        assert (
            page.evaluate("document.documentElement.dataset.theme") == "high-contrast"
        )
        bg = page.evaluate(
            "() => getComputedStyle(document.documentElement)"
            ".getPropertyValue('--bg').trim()"
        )
        assert bg == "#000000"

    def test_theme_change_does_not_enable_settings_save(self, page: Page):
        page.evaluate("openSettings()")
        page.select_option("#s-theme", "light")
        assert page.is_disabled("#btn-settings-save")


@skip_no_server
class TestAccentSwitcher:
    def test_saved_accent_applied_before_first_paint_on_reload(self, page: Page):
        page.evaluate("localStorage.setItem('yuuclip-accent', 'blue')")
        page.reload()
        assert page.evaluate("document.documentElement.dataset.accent") == "blue"
        accent = page.evaluate(
            "() => getComputedStyle(document.documentElement)"
            ".getPropertyValue('--accent').trim()"
        )
        assert accent == "#2b5fd0"  # the dark-theme blue --accent

    def test_accent_change_does_not_enable_settings_save(self, page: Page):
        page.evaluate("openSettings()")
        page.select_option("#s-accent", "blue")
        assert page.is_disabled("#btn-settings-save")


@skip_no_server
class TestWarningToken:
    # The --warning-is-defined and legacy-tokens-not-defined contracts moved to
    # static assertions in tests/unit/test_static_theme_colors.py (they read
    # tokens.css, no browser). Only the real-cascade check - that `.muted`
    # actually resolves to var(--muted) through the loaded stylesheet - needs a
    # live browser and stays here.
    def test_muted_utility_class_applies_token_color(self, page: Page):
        colors = page.evaluate(
            """() => {
              const el = document.createElement('span');
              el.className = 'muted';
              const probe = document.createElement('span');
              probe.style.color = getComputedStyle(document.documentElement)
                .getPropertyValue('--muted').trim();
              document.body.append(el, probe);
              const applied  = getComputedStyle(el).color;
              const expected = getComputedStyle(probe).color;
              el.remove(); probe.remove();
              return {applied, expected};
            }"""
        )
        assert colors["applied"] == colors["expected"]
