"""WCAG AA contrast contract for the Electron setup wizard and the inline startup
screens in electron/main.js.

The wizard now renders in the app's shared theme tokens (electron/shared/tokens.css, a
mirror of the web static/shared/tokens.css). So this test:
  1. asserts the wizard's <style> carries NO raw colour literal - every colour must be a
     theme token, so nothing bypasses the palette;
  2. resolves the dark (:root) token values and checks that the text/surface pairings the
     wizard actually renders clear AA normal-text (4.5:1);
  3. keeps checking the still-hardcoded inline startup screens in main.js (loading +
     venv-setup), which are pre-token and draw on #12121e.
Pure-python, no server or browser needed.
"""
from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SETUP_HTML = _REPO_ROOT / "electron" / "setup.html"
_MAIN_JS = _REPO_ROOT / "electron" / "main.js"
_TOKENS_CSS = _REPO_ROOT / "yuu_clip" / "web" / "static" / "shared" / "tokens.css"

AA_NORMAL_TEXT = 4.5

# The base background of the two inline startup screens in main.js (loading + venv).
_STARTUP_BG = "#12121e"

_TEXT_COLOR_RE = re.compile(r"(?<![-\w])color\s*:\s*(#[0-9a-fA-F]{3,6})")
_ANY_HEX_RE = re.compile(r"#[0-9a-fA-F]{3,6}\b")


def _relative_luminance(hex_color: str) -> float:
    digits = hex_color.lstrip("#")
    if len(digits) == 3:
        digits = "".join(ch * 2 for ch in digits)
    channels = [int(digits[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [
        c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast(foreground: str, background: str) -> float:
    lighter, darker = sorted(
        (_relative_luminance(foreground), _relative_luminance(background)), reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


def _dark_tokens() -> dict[str, str]:
    """Resolve the :root (dark) colour tokens to concrete hex from tokens.css."""
    root = re.search(r"(?ms)^:root\s*\{(.*?)^\}", _TOKENS_CSS.read_text(encoding="utf-8"))
    assert root, ":root block not found in tokens.css"
    return {name: value for name, value in re.findall(r"(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})\b", root.group(1))}


def _wizard_style(source: str) -> str:
    style = re.search(r"<style>(.*?)</style>", source, re.S)
    assert style, "setup.html <style> block not found"
    return style.group(1)


def test_setup_html_links_shared_tokens():
    assert 'href="shared/tokens.css"' in _SETUP_HTML.read_text(encoding="utf-8"), (
        "setup.html must link the shared theme tokens (shared/tokens.css)"
    )


def test_setup_html_style_has_no_raw_color_literals():
    # Every colour in the wizard <style> must be a var(--token) (or a color-mix of one) -
    # a raw hex would bypass the shared palette. The @font-face url() has no hex.
    style = _wizard_style(_SETUP_HTML.read_text(encoding="utf-8"))
    offenders = _ANY_HEX_RE.findall(style)
    assert offenders == [], f"raw colour literals in wizard <style> (use a theme token): {offenders}"


def test_setup_html_has_no_raw_color_literals_anywhere():
    # The <style>-only check above missed inline `style="color:#..."` attributes in the
    # body markup (four shipped that way - Fable-review WS-1 UX-M8) - scan the whole file
    # so a body literal can't slip past the guard again.
    offenders = _ANY_HEX_RE.findall(_SETUP_HTML.read_text(encoding="utf-8"))
    assert offenders == [], f"raw colour literals anywhere in setup.html (use a theme token): {offenders}"


def test_wizard_token_pairings_meet_aa():
    tokens = _dark_tokens()
    # (text token, background token) pairs the wizard actually renders. Resolved against
    # the dark palette and required to clear AA normal-text.
    pairings = [
        ("--text", "--bg"), ("--text-secondary", "--bg"), ("--muted", "--bg"),
        ("--text", "--surface"), ("--text-secondary", "--surface"), ("--muted", "--surface"),
        ("--text-secondary", "--bg-deep"),
        ("--green", "--bg"), ("--warning", "--bg"), ("--red", "--bg"), ("--accent-text", "--bg"),
        ("--on-accent", "--accent"),
    ]
    failing = {
        f"{fg} on {bg}": round(_contrast(tokens[fg], tokens[bg]), 2)
        for fg, bg in pairings
        if _contrast(tokens[fg], tokens[bg]) < AA_NORMAL_TEXT
    }
    assert failing == {}, f"wizard token pairings below AA: {failing}"


def test_main_js_startup_screens_meet_aa():
    # The loading screen and venv-setup window both draw text on #12121e.
    failing = {
        color: round(_contrast(color, _STARTUP_BG), 2)
        for color in {m.lower() for m in _TEXT_COLOR_RE.findall(_MAIN_JS.read_text(encoding="utf-8"))}
        if _contrast(color, _STARTUP_BG) < AA_NORMAL_TEXT
    }
    assert failing == {}, f"main.js inline startup text below AA on {_STARTUP_BG}: {failing}"
