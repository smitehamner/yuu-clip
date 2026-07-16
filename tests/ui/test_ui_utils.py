"""
Browser-only UI-helper tests that survive in Playwright.

The pure logic that used to live here - formatters, escaping, score math,
filter/sort, parse helpers, the job-step pill state machine, the toast stack,
the active-stream supersede contract - moved to the vitest unit layer under
tests/js/ (run via ``yuu-dev test-js``), where it runs in happy-dom without a
live server. What remains is the one case that genuinely needs a real browser:
the job pill must never displace the header buttons, which is a real-geometry
(getBoundingClientRect / viewport layout) assertion.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import pytest
from conftest import skip_no_server
from playwright.sync_api import Page


@pytest.fixture
def page(logic_page):
    """Shares the load-once page (see ``logic_page`` in conftest)."""
    return logic_page


# ---------------------------------------------------------------------------
# M1-1 - the job pill must never displace the header buttons, however long the
# active-step live label grows (min-width:0 chain + active-pill ellipsis).
# ---------------------------------------------------------------------------

@skip_no_server
class TestJobPillHeaderOverflow:
    def test_header_buttons_stay_in_viewport_during_long_ingest(self, page: Page):
        page.set_viewport_size({"width": 800, "height": 720})
        page.evaluate(
            "() => {"
            "  startJobUI(INGEST_STEPS, 'Analyzing');"
            "  ['Extracting audio', 'Transcribing', 'Detecting speakers',"
            "   'Generating clip', 'Computing audio energy', 'Detecting scene',"
            "   'Scoring clips'].forEach(updateJobUI);"
            "  updateJobUI('Scoring 3/12');"
            "  updateJobUI('Scoring 4/12');"
            "}"
        )
        in_viewport = page.evaluate(
            "() => ['btn-analyze', 'btn-highlight-reels', 'btn-hamburger'].every(id => {"
            "  const r = document.getElementById(id).getBoundingClientRect();"
            "  return r.right <= window.innerWidth && r.width > 0;"
            "})"
        )
        page.evaluate("() => endJobUI()")
        assert in_viewport is True
