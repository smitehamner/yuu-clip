"""Floating-menu height guard.

A floating menu (a popup positioned over the page, dismissed on outside click) must
cap its height and scroll internally. Without a cap, a menu whose contents are
variable-length - most acutely the per-line speaker menu, which lists every diarized
speaker and a diarization can produce dozens - grows taller than the viewport and
clips its footer (the "Name this speaker" rename field) off-screen with no way to
reach it. This is a pure source-file scan, so it lives in the unit tier.

When a new floating menu class is added, add it here so the invariant travels with it.
"""
from __future__ import annotations

import re
from pathlib import Path

APP_CSS = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static" / "app.css"

# Every floating menu overlay in the app. Each must declare a height cap and a scroll.
FLOATING_MENUS = [".spk-menu", ".hamburger-menu", ".colorpicker-pop"]


def _rule_body(css: str, selector: str) -> str:
    # Match the base rule `selector { ... }` only - not `selector-list`/`selector:hover`.
    match = re.search(r"(?<![\w-])" + re.escape(selector) + r"\s*\{([^}]*)\}", css)
    assert match, f"no base CSS rule found for {selector}"
    return match.group(1)


def test_every_floating_menu_caps_height_and_scrolls():
    css = APP_CSS.read_text(encoding="utf-8")
    for selector in FLOATING_MENUS:
        body = _rule_body(css, selector)
        assert "max-height" in body, f"{selector} must cap its height (max-height)"
        assert "overflow" in body, f"{selector} must scroll when capped (overflow)"
