"""
Playwright UI tests — project switcher.

Render/interaction only. These deliberately never POST /api/projects/switch: the
live suite shares one server across xdist workers, so an actual switch would swap
the server's project out from under the other tests.
"""
from __future__ import annotations

import re

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect

_OPEN = re.compile(r"\bopen\b")
_VISIBLE = re.compile(r"\bvisible\b")


@skip_no_server
class TestProjectSwitcher:
    def test_button_shows_current_project_name(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#btn-project-switcher")).to_be_visible()
        # The live dev server runs the repo root project — basename "yuu-clip".
        expect(page.locator("#project-current-name")).to_have_text("yuu-clip")

    def test_menu_opens_with_open_another_item(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text("yuu-clip")
        page.locator("#btn-project-switcher").click()
        menu = page.locator("#project-menu")
        expect(menu).to_have_class(_OPEN)
        expect(menu.get_by_text("Open another project…")).to_be_visible()

    def test_open_another_project_shows_modal(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text("yuu-clip")
        page.locator("#btn-project-switcher").click()
        page.locator("#project-menu").get_by_text("Open another project…").click()
        expect(page.locator("#open-project-modal")).to_have_class(_VISIBLE)
        expect(page.locator("#open-project-path")).to_be_focused()
        # Browse button is Electron-only; hidden in browser-dev mode.
        expect(page.locator("#btn-project-browse")).to_be_hidden()
        page.evaluate("closeOpenProjectModal()")

    def test_menu_closes_on_outside_click(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text("yuu-clip")
        page.locator("#btn-project-switcher").click()
        expect(page.locator("#project-menu")).to_have_class(_OPEN)
        page.locator("header .brand h1").click()
        expect(page.locator("#project-menu")).not_to_have_class(_OPEN)

    def test_escape_closes_menu_and_refocuses_trigger(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text("yuu-clip")
        page.locator("#btn-project-switcher").click()
        expect(page.locator("#project-menu")).to_have_class(_OPEN)
        page.keyboard.press("Escape")
        expect(page.locator("#project-menu")).not_to_have_class(_OPEN)
        expect(page.locator("#btn-project-switcher")).to_be_focused()
