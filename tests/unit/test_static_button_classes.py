"""Guard: every ``btn-*`` button class used in the served UI has a CSS rule.

UX-REVIEW-2026-07-23 H3: ``.btn-secondary`` was referenced by ~15 buttons but
defined in no stylesheet, so with app.css's ``* { padding: 0 }`` reset they rendered
as cramped, off-theme browser-default chrome with no hover state. This pure
source-scan (no browser, no server) fails if any ``btn-<name>`` class appears in a
served ``class="..."`` attribute or JS class string without a matching ``.btn-<name>``
rule in app.css - a cheap regression tripwire for the same undefined-class class.
"""
from __future__ import annotations

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"
APP_CSS = STATIC_DIR / "app.css"


def _button_classes_used() -> set[str]:
    used: set[str] = set()
    for path in list(STATIC_DIR.glob("**/*.html")) + list(STATIC_DIR.glob("**/*.js")):
        text = path.read_text(encoding="utf-8")
        for attr in re.findall(r'class="([^"$]*)"', text):
            for cls in attr.split():
                if cls.startswith("btn-"):
                    used.add(cls)
    return used


def test_every_btn_class_has_a_css_rule() -> None:
    css = APP_CSS.read_text(encoding="utf-8")
    defined = set(re.findall(r"\.(btn-[a-z0-9-]+)", css))
    missing = _button_classes_used() - defined
    assert not missing, (
        "button classes used in served HTML/JS with no CSS rule in app.css: "
        f"{sorted(missing)}"
    )


def test_btn_secondary_is_defined() -> None:
    # The specific class the finding was about - keep an explicit pin.
    assert ".btn-secondary" in APP_CSS.read_text(encoding="utf-8")
