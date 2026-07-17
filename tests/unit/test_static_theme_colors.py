"""Static design-token / colour-literal guards for the web UI (CC-1 / CC-7).

These are pure source-file scanners - no browser, no server - so they live in the
unit tier and run under ``yuu-dev test-api`` (relocated from the Playwright
``tests/ui/test_ui_theme.py`` during the vitest test-rebalance). The live-page
contrast checks (getComputedStyle) and the theme/accent switcher behaviour stay in
``tests/ui/test_ui_theme.py``; the pure switcher DOM cases moved to
``tests/js/settings/settings.test.js``.

Guards enforced here:
  - every theme block overrides the complete colour-token set;
  - app.css carries no colour literal outside a theme-definition block;
  - the served *.js / index.html carry no hardcoded colour (CLAUDE.md);
  - the legacy --amber / --warn / --yellow warning tokens stay dead.
"""
from __future__ import annotations

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"

THEMES = ["dark", "light", "high-contrast"]

# Every theme block must override each of these - a theme that inherits a
# color from the dark defaults is almost certainly an unreadable accident.
COLOR_TOKENS = [
    "--bg", "--bg-deep", "--surface", "--surface-raised", "--selection",
    "--border", "--text", "--muted", "--text-secondary",
    "--accent", "--accent-text", "--accent2", "--on-accent",
    "--highlight", "--on-highlight",
    "--green", "--on-green", "--red", "--on-red",
    "--warning", "--on-warning", "--warn-hot",
    "--funny", "--dramatic", "--action", "--laugh",
]


def test_no_legacy_warning_token_references_in_static_files():
    legacy = ("var(--amber", "var(--warn)", "var(--warn,", "var(--yellow")
    offenders = [
        f"{path.name}: {name}"
        for path in sorted(STATIC_DIR.rglob("*"))
        if path.suffix in {".js", ".css", ".html"}
        for name in legacy
        if name in path.read_text(encoding="utf-8")
    ]
    assert offenders == []


_THEME_BLOCK_RE = re.compile(
    r'(?ms)^(?::root|html\[data-theme="([^"]+)"\])\s*\{(.*?)^\}'
)

# Broader: every :root / html[...] block, including the accent variants
# (html[data-accent=...] and html[data-theme=...][data-accent=...]). Used only to
# strip token-definition blocks before scanning for stray colour literals, so the
# accent variants' hex values are recognised as token definitions, not chrome.
_TOKEN_BLOCK_RE = re.compile(r'(?ms)^(?::root|html\[[^{]*\])\s*\{.*?^\}')


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
    outside = _TOKEN_BLOCK_RE.sub("", css)
    literals = re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", outside)
    offenders = sorted(set(literals) - {"#000"})
    assert offenders == []


# ── No hardcoded colors in JS-built HTML / inline styles (CLAUDE.md) ─────────
# The rule in CLAUDE.md bans color literals in JS-built HTML and inline styles,
# not just in app.css. This scans the static *.js and index.html for them.
#
# Legitimate non-token colors are stripped or allowlisted, by class:
#   - HTML numeric entities (&#8230;) are not colors at all.
#   - `var(--token, #fallback)` - the literal is a defensive CSS-var fallback
#     that never fires (the token is always defined by a theme block).
#   - `|| '#data'` - a JS fallback for user/data-supplied colors (speaker dot,
#     title-card color-picker default), not UI chrome.
#   - Over-video overlays (#000/#fff/#e6e6e6 caption text, black/white scrims):
#     drawn over video, theme-independent by design - same class as #000
#     letterboxing (the documented CLAUDE.md exemption).
#   - The score-gradient stops in format.js: data encoding, not chrome.
#   - The starter swatches in colorpicker.js: pickable colour data (the colours a
#     user can choose), not UI chrome - same class as the score-gradient stops.
# Adding a new literal outside these classes breaks this test.
_OVER_VIDEO_HEX = {"#000", "#fff", "#e6e6e6"}
_SCORE_GRADIENT_STOPS = {"#6b6b80", "#4fc3f7", "#4caf7d", "#f0c060", "#f7a85a"}
_COLORPICKER_STARTERS = {
    "#ffffff", "#000000", "#e05c5c", "#f0803c", "#f0c060", "#4caf7d",
    "#4fc3f7", "#0a7a9b", "#b06af7", "#f77ac0", "#9e9e9e", "#7a4b2a",
}
_ALLOWED_HEX = _OVER_VIDEO_HEX | _SCORE_GRADIENT_STOPS | _COLORPICKER_STARTERS

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
        for path in sorted(STATIC_DIR.rglob("*"))
        if path.suffix in {".js", ".html"}
        if (found := _color_literal_offenders(path.read_text(encoding="utf-8")))
    }
    assert offenders == {}, f"hardcoded color literals (use a theme token): {offenders}"
