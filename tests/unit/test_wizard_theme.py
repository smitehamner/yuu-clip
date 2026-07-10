"""WCAG AA contrast contract for the Electron setup wizard and the inline
startup screens in electron/main.js.

Unlike the web UI (app.css, guarded by test_ui_theme.py), the wizard is a
self-contained Electron surface with hardcoded hex colors and no theme-token
system - so nothing else enforces contrast on it. A 2026-07 review measured its
muted grays at 2.5–3.3:1 on the #12121e background. This test statically parses
the wizard's CSS and asserts every text color clears AA normal-text (4.5:1)
against the surface it renders on. Pure-python, no server or browser needed.
"""
from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SETUP_HTML = _REPO_ROOT / "electron" / "setup.html"
_MAIN_JS = _REPO_ROOT / "electron" / "main.js"

AA_NORMAL_TEXT = 4.5

# The base background shared by the wizard window and both inline startup
# screens (loading + venv-setup). All muted text renders on this surface.
_WIZARD_BG = "#12121e"

# `color:` only - not `background`, `border-top-color`, `background-color`, etc.
_TEXT_COLOR_RE = re.compile(r"(?<![-\w])color\s*:\s*(#[0-9a-fA-F]{3,6})")


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


def _text_colors(source: str) -> set[str]:
    return {match.lower() for match in _TEXT_COLOR_RE.findall(source)}


def test_setup_html_text_meets_aa_on_wizard_background():
    style = re.search(r"<style>(.*?)</style>", _SETUP_HTML.read_text(encoding="utf-8"), re.S)
    assert style, "setup.html <style> block not found"
    body_bg = re.search(r"body\s*\{[^}]*?background:\s*(#[0-9a-fA-F]{3,6})", style.group(1))
    assert body_bg and body_bg.group(1).lower() == _WIZARD_BG, "wizard base background changed - update _WIZARD_BG"

    failing = {
        color: round(_contrast(color, _WIZARD_BG), 2)
        for color in _text_colors(style.group(1))
        if _contrast(color, _WIZARD_BG) < AA_NORMAL_TEXT
    }
    assert failing == {}, f"setup.html text colors below AA on {_WIZARD_BG}: {failing}"


def test_main_js_startup_screens_meet_aa():
    # The loading screen and venv-setup window both draw text on #12121e.
    failing = {
        color: round(_contrast(color, _WIZARD_BG), 2)
        for color in _text_colors(_MAIN_JS.read_text(encoding="utf-8"))
        if _contrast(color, _WIZARD_BG) < AA_NORMAL_TEXT
    }
    assert failing == {}, f"main.js inline startup text below AA on {_WIZARD_BG}: {failing}"
