"""
Design-token and theme contract for app.css (CC-1 / CC-7 in UX_REVIEW_PLAN.md).

CC-1: muted text and the pill/button color pairs must meet WCAG AA 4.5:1 on
the surfaces they actually appear on — in every theme, since each theme block
replaces the full palette. CC-7: exactly one semantic warning token
(--warning) exists; the legacy --amber / --warn / --yellow names must stay
dead, in token definitions and in references.

Also guards the theme system itself: every color literal in app.css must live
inside a theme definition block (:root or html[data-theme=...]) so that adding
a hardcoded color anywhere else breaks the build, every theme block must
override the complete color token set, and the Settings theme switcher must
apply instantly and survive a reload.

Contrast is computed from the live page's resolved custom properties, so the
tests hold no hardcoded color values and survive future palette tweaks.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from conftest import skip_no_server
from playwright.sync_api import Page

STATIC_DIR = Path(__file__).resolve().parents[1] / "yuu_clip" / "web" / "static"

THEMES = ["dark", "light", "high-contrast"]

# Every theme block must override each of these — a theme that inherits a
# color from the dark defaults is almost certainly an unreadable accident.
COLOR_TOKENS = [
    "--bg", "--bg-deep", "--surface", "--surface-raised", "--selection",
    "--border", "--text", "--muted", "--text-secondary",
    "--accent", "--accent-text", "--accent2", "--on-accent",
    "--green", "--on-green", "--red", "--on-red",
    "--warning", "--on-warning", "--warn-hot",
    "--funny", "--dramatic", "--action", "--laugh",
]

_CONTRAST_JS = """
(pair) => {
  const styles = getComputedStyle(document.documentElement);
  const resolve = v => v.startsWith('--') ? styles.getPropertyValue(v).trim() : v;
  const lum = c => {
    const m = c.match(/^#([0-9a-f]{6})$/i);
    if (!m) throw new Error(`not a 6-digit hex token: ${c}`);
    const [r, g, b] = [0, 2, 4]
      .map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(resolve(pair[0])), lum(resolve(pair[1]))];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
"""

AA_NORMAL_TEXT = 4.5


def _set_theme(page: Page, theme: str) -> None:
    page.evaluate(
        "(t) => { if (t === 'dark') delete document.documentElement.dataset.theme;"
        " else document.documentElement.dataset.theme = t; }",
        theme,
    )


@skip_no_server
@pytest.mark.parametrize("theme", THEMES)
class TestContrastTokens:
    """The AA contract holds under every theme, not just the dark default."""

    def _ratio(self, page: Page, theme: str, fg: str, bg: str) -> float:
        _set_theme(page, theme)
        return page.evaluate(_CONTRAST_JS, [fg, bg])

    def test_muted_text_on_surface(self, page: Page, theme: str):
        assert self._ratio(page, theme, "--muted", "--surface") >= AA_NORMAL_TEXT

    def test_muted_text_on_bg(self, page: Page, theme: str):
        assert self._ratio(page, theme, "--muted", "--bg") >= AA_NORMAL_TEXT

    def test_pending_step_pill_muted_on_border(self, page: Page, theme: str):
        assert self._ratio(page, theme, "--muted", "--border") >= AA_NORMAL_TEXT

    def test_on_accent_on_accent(self, page: Page, theme: str):
        # .step.active, .btn.primary, .btn.active, .clip-chip.active
        assert self._ratio(page, theme, "--on-accent", "--accent") >= AA_NORMAL_TEXT

    def test_on_green_on_green(self, page: Page, theme: str):
        # .step.done, .btn.approve.active, .export-pill.is-exported,
        # .run-meta-badge.gpu, .dot-approved
        assert self._ratio(page, theme, "--on-green", "--green") >= AA_NORMAL_TEXT

    def test_on_red_on_red(self, page: Page, theme: str):
        # .btn.reject.active, .dot-rejected, .split-marker-x
        assert self._ratio(page, theme, "--on-red", "--red") >= AA_NORMAL_TEXT

    def test_pending_dot_bg_on_muted(self, page: Page, theme: str):
        assert self._ratio(page, theme, "--bg", "--muted") >= AA_NORMAL_TEXT

    def test_accent_text_on_surface(self, page: Page, theme: str):
        # header h1, .settings-section-title, .spk-menu-item.active
        assert self._ratio(page, theme, "--accent-text", "--surface") >= AA_NORMAL_TEXT

    def test_accent_text_on_bg(self, page: Page, theme: str):
        # .tline-speaker, .context-chip, .ctx-pill.selected
        assert self._ratio(page, theme, "--accent-text", "--bg") >= AA_NORMAL_TEXT

    def test_warning_text_on_surface(self, page: Page, theme: str):
        assert self._ratio(page, theme, "--warning", "--surface") >= AA_NORMAL_TEXT

    def test_on_warning_on_warning_fill(self, page: Page, theme: str):
        # dark-on-amber "Remote LLM" badge: text is --on-warning over a --warning fill
        assert self._ratio(page, theme, "--on-warning", "--warning") >= AA_NORMAL_TEXT

    def test_accent2_text_on_bg(self, page: Page, theme: str):
        # .description, .video-title, .timeline-stamp render accent2 as body text
        assert self._ratio(page, theme, "--accent2", "--bg") >= AA_NORMAL_TEXT

    def test_text_on_surface(self, page: Page, theme: str):
        assert self._ratio(page, theme, "--text", "--surface") >= AA_NORMAL_TEXT


@skip_no_server
class TestThemeSwitcher:
    def test_settings_select_lists_all_themes(self, page: Page):
        values = page.evaluate(
            "() => [...document.querySelectorAll('#s-theme option')].map(o => o.value)"
        )
        assert values == THEMES

    def test_apply_theme_sets_attribute_and_persists(self, page: Page):
        page.evaluate("applyTheme('light')")
        assert page.evaluate("document.documentElement.dataset.theme") == "light"
        assert page.evaluate("localStorage.getItem('yuuclip-theme')") == "light"

    def test_apply_dark_removes_attribute(self, page: Page):
        page.evaluate("applyTheme('light')")
        page.evaluate("applyTheme('dark')")
        assert page.evaluate("document.documentElement.dataset.theme") is None
        assert page.evaluate("localStorage.getItem('yuuclip-theme')") == "dark"

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
class TestWarningToken:
    def test_warning_token_is_defined(self, page: Page):
        value = page.evaluate(
            "() => getComputedStyle(document.documentElement)"
            ".getPropertyValue('--warning').trim()"
        )
        assert value != ""

    def test_legacy_warning_tokens_are_not_defined(self, page: Page):
        values = page.evaluate(
            "() => ['--amber', '--warn', '--yellow'].map(name =>"
            "  getComputedStyle(document.documentElement)"
            "  .getPropertyValue(name).trim())"
        )
        assert values == ["", "", ""]

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


def test_no_legacy_warning_token_references_in_static_files():
    legacy = ("var(--amber", "var(--warn)", "var(--warn,", "var(--yellow")
    offenders = [
        f"{path.name}: {name}"
        for path in sorted(STATIC_DIR.iterdir())
        if path.suffix in {".js", ".css", ".html"}
        for name in legacy
        if name in path.read_text(encoding="utf-8")
    ]
    assert offenders == []


_THEME_BLOCK_RE = re.compile(
    r'(?ms)^(?::root|html\[data-theme="([^"]+)"\])\s*\{(.*?)^\}'
)


def _theme_blocks(css: str) -> dict[str, str]:
    return {
        match.group(1) or "dark": match.group(2)
        for match in _THEME_BLOCK_RE.finditer(css)
    }


def test_every_theme_block_overrides_the_full_color_token_set():
    css = (STATIC_DIR / "app.css").read_text(encoding="utf-8")
    blocks = _theme_blocks(css)
    assert sorted(blocks) == sorted(THEMES)
    missing = [
        f"{theme}: {token}"
        for theme, body in blocks.items()
        for token in COLOR_TOKENS
        if f"{token}:" not in body
    ]
    assert missing == []


def test_app_css_has_no_color_literals_outside_theme_blocks():
    """Every color must be a var()/color-mix() of a theme token, or themes
    silently break. The only allowed literal is #000 for video letterboxing,
    which is deliberately identical in all themes."""
    css = (STATIC_DIR / "app.css").read_text(encoding="utf-8")
    outside = _THEME_BLOCK_RE.sub("", css)
    literals = re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", outside)
    offenders = sorted(set(literals) - {"#000"})
    assert offenders == []


# ── No hardcoded colors in JS-built HTML / inline styles (CLAUDE.md) ─────────
# The rule in CLAUDE.md bans color literals in JS-built HTML and inline styles,
# not just in app.css. This scans the static *.js and index.html for them.
#
# Legitimate non-token colors are stripped or allowlisted, by class:
#   - HTML numeric entities (&#8230;) are not colors at all.
#   - `var(--token, #fallback)` — the literal is a defensive CSS-var fallback
#     that never fires (the token is always defined by a theme block).
#   - `|| '#data'` — a JS fallback for user/data-supplied colors (speaker dot,
#     title-card color-picker default), not UI chrome.
#   - Over-video overlays (#000/#fff/#e6e6e6 caption text, black/white scrims):
#     drawn over video, theme-independent by design — same class as #000
#     letterboxing (the documented CLAUDE.md exemption).
#   - The score-gradient stops in format.js: data encoding, not chrome.
# Adding a new literal outside these classes breaks this test.
_OVER_VIDEO_HEX = {"#000", "#fff", "#e6e6e6"}
_SCORE_GRADIENT_STOPS = {"#6b6b80", "#4fc3f7", "#4caf7d", "#f0c060", "#f7a85a"}
_ALLOWED_HEX = _OVER_VIDEO_HEX | _SCORE_GRADIENT_STOPS

_HTML_ENTITY_RE = re.compile(r"&#\d+;?")
_VAR_FALLBACK_RE = re.compile(r"var\(\s*--[\w-]+\s*,[^)]*\)")
_JS_COLOR_FALLBACK_RE = re.compile(
    r"""\|\|\s*['"](?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"]"""
)
_RGB_INTERP_RE = re.compile(r"rgb\(\$\{[^)]*\)")
_COLOR_LITERAL_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)")


def _color_literal_offenders(text: str) -> list[str]:
    for pattern in (_HTML_ENTITY_RE, _VAR_FALLBACK_RE, _JS_COLOR_FALLBACK_RE, _RGB_INTERP_RE):
        text = pattern.sub(" ", text)
    offenders = []
    for literal in _COLOR_LITERAL_RE.findall(text):
        low = literal.lower()
        if low in _ALLOWED_HEX:
            continue
        # Over-video black/white scrims at any alpha.
        if re.match(r"rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]", low):
            continue
        if re.match(r"rgba?\(\s*255\s*,\s*255\s*,\s*255\s*[,)]", low):
            continue
        offenders.append(literal)
    return offenders


def test_no_hardcoded_colors_in_static_js_and_html():
    offenders = {
        path.name: found
        for path in sorted(STATIC_DIR.iterdir())
        if path.suffix in {".js", ".html"}
        if (found := _color_literal_offenders(path.read_text(encoding="utf-8")))
    }
    assert offenders == {}, f"hardcoded color literals (use a theme token): {offenders}"
