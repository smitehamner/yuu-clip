"""Terminology behavior contract - the rendered-page half (CC-8).

The static-file assertions (percentage labels, "Recording(s)" copy, the five
model-select option lists) moved to ``tests/unit/test_static_ui_contract.py`` -
they read committed files and need no browser, so paying the live-server setup
here was pure waste. What remains is the one contract that genuinely needs a
rendered page: the sidebar heading reads "Recordings" after boot.

Runs against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import pytest
from conftest import skip_no_server
from playwright.sync_api import Page, expect


@pytest.fixture
def page(logic_page):
    """Read-only DOM assertion - share the load-once page (see ``logic_page`` in
    conftest) instead of paying a fresh full page load."""
    return logic_page


@skip_no_server
def test_sidebar_heading_reads_recordings(page: Page):
    heading = page.locator(".videos-group .clips-section-header .section-toggle-btn").first
    expect(heading).to_have_text("Recordings")
