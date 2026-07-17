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
                body='{"backend":"llamacpp","model":"moondream","text":true,"vision":true,"detail":"ok"}',
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


# Nav-survival + blocked-button: the analyze-frames in-flight indicator is driven
# by AppState.clipJobs (durable state), not a captured DOM node, so it is restored
# whenever the panel is rebuilt; and while some OTHER job runs the idle button is
# disabled with a why-tooltip.
_NAV_SURVIVAL = """
async () => {
  const vids = await fetch('/api/videos').then(r => r.json());
  let clip = null;
  for (const v of vids) {
    const cs = await fetch(`/api/videos/${v.id}/clips?sort=score`).then(r => r.json());
    if (cs.length) { clip = await fetch(`/api/clips/${cs[0].id}`).then(r => r.json()); break; }
  }
  if (!clip) return {skip: true};
  window._visionEnabled = true;
  AppState.activeClipId = clip.id;
  AppState.activeClipData = clip;

  // Mark this clip's analyze-frames job in flight, then render: spinner button.
  AppState.clipJobs[clip.id] = {op: 'analyze-frames'};
  renderDetail(clip);
  const b1 = document.getElementById('analyze-frames-btn');
  const inflight1 = !!b1 && b1.disabled && b1.textContent.includes('Analyzing frames');

  // Switch away to a different clip id (no in-flight job): normal button.
  const other = Object.assign({}, clip, {id: clip.id + 100000});
  AppState.activeClipId = other.id;
  renderDetail(other);
  const b2 = document.getElementById('analyze-frames-btn');
  const normalAway = !!b2 && !b2.disabled && /nalyze frames/.test(b2.textContent);

  // Return to the original clip: the spinner is restored from AppState.clipJobs.
  AppState.activeClipId = clip.id;
  renderDetail(clip);
  const b3 = document.getElementById('analyze-frames-btn');
  const inflight2 = !!b3 && b3.disabled && b3.textContent.includes('Analyzing frames');

  delete AppState.clipJobs[clip.id];
  return {skip: false, inflight1, normalAway, inflight2};
}
"""

_BLOCKED_WHILE_JOB = """
async () => {
  const vids = await fetch('/api/videos').then(r => r.json());
  let clip = null;
  for (const v of vids) {
    const cs = await fetch(`/api/videos/${v.id}/clips?sort=score`).then(r => r.json());
    if (cs.length) { clip = await fetch(`/api/clips/${cs[0].id}`).then(r => r.json()); break; }
  }
  if (!clip) return {skip: true};
  window._visionEnabled = true;
  AppState.activeClipId = clip.id;
  AppState.activeClipData = clip;

  // A different job is running; a panel rebuilt mid-job must come up disabled.
  startJobUI(SCORE_STEPS, 'Scoring', false, false);
  renderDetail(clip);
  const b = document.getElementById('analyze-frames-btn');
  const res = {skip: false, disabled: !!b && b.disabled, title: b ? b.title : ''};
  endJobUI();
  return res;
}
"""


@skip_no_server
class TestVisionInFlightIndicator:
    def _mock_caps(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.route(
            "**/api/llm/capabilities",
            lambda route: route.fulfill(
                content_type="application/json",
                body='{"backend":"llamacpp","model":"moondream","text":true,"vision":true,"detail":"ok"}',
            ),
        )

    def test_indicator_survives_clip_switch_and_return(self, page: Page):
        self._mock_caps(page)
        result = page.evaluate(_NAV_SURVIVAL)
        if result.get("skip"):
            pytest.skip("no clips on the live server to render")
        assert result["inflight1"] is True
        assert result["normalAway"] is True
        assert result["inflight2"] is True

    def test_button_disabled_with_tooltip_while_other_job_runs(self, page: Page):
        self._mock_caps(page)
        result = page.evaluate(_BLOCKED_WHILE_JOB)
        if result.get("skip"):
            pytest.skip("no clips on the live server to render")
        assert result["disabled"] is True
        assert "Another job is running" in result["title"]


# analyzeFrames' cancel wiring + in-flight-flag leak fix now has a direct unit test
# that mocks the jobs.js transport seam: tests/js/clips/vision.test.js. It replaced
# the strict-xfail Playwright poke here (window.streamSSE no longer intercepts the
# post-ESM imported binding).


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
