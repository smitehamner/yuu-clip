"""
Design-token contract for app.css (CC-1 / CC-7 in UX_REVIEW_PLAN.md).

CC-1: muted text and the pill/button color pairs must meet WCAG AA 4.5:1 on
the surfaces they actually appear on. CC-7: exactly one semantic warning
token (--warning) exists; the legacy --amber / --warn / --yellow names must
stay dead, in token definitions and in references.

Contrast is computed from the live page's resolved custom properties, so the
tests hold no hardcoded color values and survive future palette tweaks.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from pathlib import Path

from conftest import skip_no_server
from playwright.sync_api import Page

STATIC_DIR = Path(__file__).resolve().parents[1] / "yuu_clip" / "web" / "static"

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


@skip_no_server
class TestContrastTokens:
    def _ratio(self, page: Page, fg: str, bg: str) -> float:
        return page.evaluate(_CONTRAST_JS, [fg, bg])

    def test_muted_text_on_surface(self, page: Page):
        assert self._ratio(page, "--muted", "--surface") >= AA_NORMAL_TEXT

    def test_muted_text_on_bg(self, page: Page):
        assert self._ratio(page, "--muted", "--bg") >= AA_NORMAL_TEXT

    def test_pending_step_pill_muted_on_border(self, page: Page):
        assert self._ratio(page, "--muted", "--border") >= AA_NORMAL_TEXT

    def test_white_on_accent(self, page: Page):
        # .step.active, .btn.primary, .btn.active, .clip-chip.active
        assert self._ratio(page, "#ffffff", "--accent") >= AA_NORMAL_TEXT

    def test_done_step_pill_bg_on_green(self, page: Page):
        # .step.done, .btn.approve.active, .export-pill.is-exported,
        # .run-meta-badge.gpu — all dark-text-on-green
        assert self._ratio(page, "--bg", "--green") >= AA_NORMAL_TEXT

    def test_warning_text_on_surface(self, page: Page):
        assert self._ratio(page, "--warning", "--surface") >= AA_NORMAL_TEXT


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
