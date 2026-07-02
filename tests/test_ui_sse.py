"""
Playwright UI test — SSE job happy path (analyze/score/export share one flow).

Closes the ROADMAP gap: no live-server coverage exercised an SSE job's success
flow, so the Phase 3 stuck-job-UI bug (progress pill stuck visible, buttons left
disabled after a job finished) slipped through both test suites.

The SSE endpoint is mocked via route interception so the test is deterministic
and needs no real video/ffmpeg, but it drives the *real* streamSSE → startJobUI
→ endJobUI lifecycle and asserts the UI returns to idle after __DONE__.
"""
from __future__ import annotations

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
        # endJobUI hides the pill and re-enables buttons after a 2 s delay —
        # this is the exact teardown the stuck-job-UI bug skipped.
        expect(page.locator("#job-status")).not_to_have_class(re.compile(r"\bvisible\b"), timeout=4000)
        expect(page.locator("#btn-analyze")).to_be_enabled()
