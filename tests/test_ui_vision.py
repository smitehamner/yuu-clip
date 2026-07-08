"""Playwright UI tests - image-based clip analysis (plan 11).

Covers the "What's on screen" clip-detail card (shown only when the Image
analysis master switch is on) and the Settings → LLM scoring fields. Read-only
against the live dev server on port 8080. /api/llm/capabilities is on-demand, so
it is route-mocked after goto, right before the interaction that reads it.
"""
from __future__ import annotations

import pytest
from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page

_RENDER_CLIP_WITH_VISION = """
async (enabled) => {
  const vids = await fetch('/api/videos').then(r => r.json());
  let clip = null;
  for (const v of vids) {
    const clips = await fetch(`/api/videos/${v.id}/clips?sort=score`).then(r => r.json());
    if (clips.length) { clip = await fetch(`/api/clips/${clips[0].id}`).then(r => r.json()); break; }
  }
  if (!clip) return {skip: true};
  clip.vision_summary = 'On screen: a test summary sentinel.';
  clip.vision_analyzed_at = new Date().toISOString();
  window._visionEnabled = enabled;
  renderDetail(clip);
  const detail = document.getElementById('detail').textContent;
  const btn = document.getElementById('analyze-frames-btn');
  return {
    hasCard: detail.includes("What's on screen"),
    hasSummary: detail.includes('test summary sentinel'),
    btnLabel: btn ? btn.textContent.trim() : null,
  };
}
"""


@skip_no_server
class TestVisionDetailCard:
    def _render(self, page: Page, enabled: bool) -> dict:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.route(
            "**/api/llm/capabilities",
            lambda route: route.fulfill(
                content_type="application/json",
                body='{"backend":"ollama","model":"moondream","text":true,"vision":true,"detail":"ok"}',
            ),
        )
        return page.evaluate(_RENDER_CLIP_WITH_VISION, enabled)

    def test_card_and_summary_render_when_enabled(self, page: Page):
        result = self._render(page, True)
        if result.get("skip"):
            pytest.skip("no clips on the live server to render")
        assert result["hasCard"] is True
        assert result["hasSummary"] is True
        assert result["btnLabel"] == "Re-analyze frames"

    def test_card_hidden_when_master_switch_off(self, page: Page):
        result = self._render(page, False)
        if result.get("skip"):
            pytest.skip("no clips on the live server to render")
        assert result["hasCard"] is False


@skip_no_server
class TestVisionSettingsFields:
    def test_image_analysis_fields_present(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        assert page.locator("#s-vision-enabled").count() == 1
        frames = page.locator("#s-vision-frames")
        assert frames.count() == 1
        assert frames.get_attribute("min") == "1"
        assert frames.get_attribute("max") == "10"
