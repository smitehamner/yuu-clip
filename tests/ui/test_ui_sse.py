"""
Playwright UI test - SSE job happy path (analyze/score/export share one flow).

Closes the ROADMAP gap: no live-server coverage exercised an SSE job's success
flow, so the Phase 3 stuck-job-UI bug (progress pill stuck visible, buttons left
disabled after a job finished) slipped through both test suites.

The SSE endpoint is mocked via route interception so the test is deterministic
and needs no real video/ffmpeg, but it drives the *real* streamSSE → startJobUI
→ endJobUI lifecycle and asserts the UI returns to idle after __DONE__.
"""
from __future__ import annotations

import json
import re

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect

_SSE_URL = "/api/__test_sse__"

# Two payload lines then the completion sentinel, in the SSE wire format
# (each line JSON-encoded, terminated by a blank line).
_SSE_BODY = (
    'data: "Extracting audio"\n\n'
    'data: "Scoring clips"\n\n'
    'data: "__DONE__"\n\n'
)

# Step labels whose patterns match the two payload lines above.
_STEP_DEFS = [
    {"label": "Audio", "patterns": ["Extracting audio"]},
    {"label": "Scoring", "patterns": ["Scoring clips"]},
]


@skip_no_server
class TestSSEJobHappyPath:
    def _start_job(self, page: Page) -> None:
        page.route(
            f"**{_SSE_URL}",
            lambda route: route.fulfill(
                status=200,
                content_type="text/event-stream",
                body=_SSE_BODY,
            ),
        )
        page.evaluate(
            """([url, steps, label]) => {
                window.__sseDone = false;
                streamSSE(url, () => { window.__sseDone = true; }, steps, label, false);
            }""",
            [_SSE_URL, _STEP_DEFS, "Test job"],
        )

    def test_job_pill_shows_and_buttons_disable_on_start(self, page: Page):
        page.goto(LIVE_URL)
        self._start_job(page)
        expect(page.locator("#job-status")).to_have_class(re.compile(r"\bvisible\b"), timeout=2000)
        expect(page.locator("#btn-analyze")).to_be_disabled()

    def test_done_signal_fires_completion_callback(self, page: Page):
        page.goto(LIVE_URL)
        self._start_job(page)
        page.wait_for_function("window.__sseDone === true", timeout=5000)

    def test_steps_marked_done_after_completion(self, page: Page):
        page.goto(LIVE_URL)
        self._start_job(page)
        page.wait_for_function("window.__sseDone === true", timeout=5000)
        # endJobUI marks every step done immediately on completion
        expect(page.locator("#step-0")).to_have_class("step done")
        expect(page.locator("#step-1")).to_have_class("step done")

    def test_ui_returns_to_idle_after_completion(self, page: Page):
        page.goto(LIVE_URL)
        self._start_job(page)
        page.wait_for_function("window.__sseDone === true", timeout=5000)
        # endJobUI hides the pill and re-enables buttons after a 2 s delay -
        # this is the exact teardown the stuck-job-UI bug skipped.
        expect(page.locator("#job-status")).not_to_have_class(re.compile(r"\bvisible\b"), timeout=4000)
        expect(page.locator("#btn-analyze")).to_be_enabled()


@skip_no_server
class TestProgressMarker:
    """The @@PROGRESS marker drives the pill deterministically and is never shown
    as a log line (that is the whole point of the structured channel)."""

    def test_marker_drives_pill_stage_and_count(self, page: Page):
        page.goto(LIVE_URL)
        marker = "@@PROGRESS " + json.dumps({"stage": "score", "done": 3, "total": 12})
        result = page.evaluate(
            """(marker) => {
                const steps = [
                  {label: 'Energy',  stage: 'energy', patterns: []},
                  {label: 'Scoring', stage: 'score',  patterns: []},
                ];
                startJobUI(steps, 'Test', false, false);
                _driveStepFromMarker(parseProgress(marker));
                const s0 = document.getElementById('step-0');
                const s1 = document.getElementById('step-1');
                const res = {s0: s0.className, s1: s1.className, text: s1.textContent};
                endJobUI();
                return res;
            }""",
            marker,
        )
        assert "done" in result["s0"]      # earlier stage marked done
        assert "active" in result["s1"]    # the marker's stage is active
        assert "3/12" in result["text"]    # count carried through

    def test_marker_line_is_not_logged(self, page: Page):
        page.goto(LIVE_URL)
        marker = "@@PROGRESS " + json.dumps({"stage": "score", "done": 1, "total": 2})
        body = (
            f'data: {json.dumps(marker)}\n\n'
            f'data: {json.dumps("a normal log line")}\n\n'
            f'data: {json.dumps("__DONE__")}\n\n'
        )
        page.route(
            f"**{_SSE_URL}",
            lambda route: route.fulfill(status=200, content_type="text/event-stream", body=body),
        )
        page.evaluate(
            """([url]) => {
                window.__sseDone = false;
                const steps = [{label: 'Scoring', stage: 'score', patterns: []}];
                streamSSE(url, () => { window.__sseDone = true; }, steps, 'Test', false);
            }""",
            [_SSE_URL],
        )
        page.wait_for_function("window.__sseDone === true", timeout=5000)
        log_text = page.locator("#log-lines").inner_text()
        assert "a normal log line" in log_text
        assert "@@PROGRESS" not in log_text
