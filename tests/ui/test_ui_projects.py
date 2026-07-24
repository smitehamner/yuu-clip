"""
Playwright UI tests - project switcher.

Render/interaction only. These deliberately never let a real POST hit
/api/projects/switch: the live suite shares one server across xdist workers, so
an actual switch would swap the server's project out from under the other
tests. The state-reset test below drives the real UI flow but intercepts that
one route so the shared server's project never actually changes.
"""
from __future__ import annotations

import json
import re

from conftest import LIVE_URL, select_first_video_and_clip, served_project_dir, skip_no_server
from playwright.sync_api import Page, expect

_OPEN = re.compile(r"\bopen\b")
_VISIBLE = re.compile(r"\bvisible\b")


@skip_no_server
class TestProjectSwitcher:
    def _expected_name(self, page: Page) -> str:
        # The switcher shows the basename of whatever project the server serves
        # (the fixture project under test-ui) - derive it, never hardcode.
        return served_project_dir(page).name

    def test_button_shows_current_project_name(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#btn-project-switcher")).to_be_visible()
        expect(page.locator("#project-current-name")).to_have_text(self._expected_name(page))

    def test_menu_opens_with_open_another_item(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text(self._expected_name(page))
        page.locator("#btn-project-switcher").click()
        menu = page.locator("#project-menu")
        expect(menu).to_have_class(_OPEN)
        expect(menu.get_by_text("Open another project…")).to_be_visible()

    def test_open_another_project_shows_modal(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text(self._expected_name(page))
        page.locator("#btn-project-switcher").click()
        page.locator("#project-menu").get_by_text("Open another project…").click()
        expect(page.locator("#open-project-modal")).to_have_class(_VISIBLE)
        expect(page.locator("#open-project-path")).to_be_focused()
        # Browse button is always shown now - Electron's native dialog, or the
        # server-side tkinter fallback in browser-dev mode.
        expect(page.locator("#btn-project-browse")).to_be_visible()
        page.click("#btn-open-project-cancel")

    def test_electron_mode_leads_with_browse_and_demotes_the_path_field(self, page: Page):
        # UX-M9: in Electron, Browse is the primary affordance and the path field
        # becomes its read-back, not the other way around.
        page.add_init_script(
            "window.electronAPI = { pickProjectFolder: async () => 'C:/picked/project' };")
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text(self._expected_name(page))
        page.locator("#btn-project-switcher").click()
        page.locator("#project-menu").get_by_text("Open another project…").click()
        expect(page.locator("#open-project-modal")).to_have_class(_VISIBLE)
        expect(page.locator("#btn-project-browse-primary")).to_be_visible()
        expect(page.locator("#btn-project-browse-primary")).to_be_focused()
        expect(page.locator("#btn-project-browse")).to_be_hidden()
        page.locator("#btn-project-browse-primary").click()
        page.wait_for_function(
            "document.querySelector('#open-project-path').value === 'C:/picked/project'", timeout=3000
        )
        page.click("#btn-open-project-cancel")

    def test_menu_closes_on_outside_click(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text(self._expected_name(page))
        page.locator("#btn-project-switcher").click()
        expect(page.locator("#project-menu")).to_have_class(_OPEN)
        page.locator("header .brand h1").click()
        expect(page.locator("#project-menu")).not_to_have_class(_OPEN)

    def test_escape_closes_menu_and_refocuses_trigger(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#project-current-name")).to_have_text(self._expected_name(page))
        page.locator("#btn-project-switcher").click()
        expect(page.locator("#project-menu")).to_have_class(_OPEN)
        page.keyboard.press("Escape")
        expect(page.locator("#project-menu")).not_to_have_class(_OPEN)
        expect(page.locator("#btn-project-switcher")).to_be_focused()


@skip_no_server
class TestProjectSwitchStateReset:
    def test_switch_clears_active_selection_and_inflight_sse(self, page: Page):
        # switchProject() (settings/projects.js) performs no client-side AppState
        # reset of its own - a successful switch just reloads the whole page, and
        # the browser resetting the JS realm IS the reset. This drives the real
        # open-project-modal -> switch -> reload flow (route-intercepted so the
        # real switch never fires) and proves an active selection and an
        # in-flight SSE stream both go away, rather than assuming the reload
        # alone is enough.
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        assert page.evaluate("AppState.activeVideoId") is not None
        assert page.evaluate("AppState.activeClipId") is not None

        # An SSE request left permanently pending simulates a job still running
        # at the moment of switch - #job-status stays visible until reload.
        page.route("**/api/__test_sse_hang__", lambda route: None)
        page.evaluate(
            "streamSSE('/api/__test_sse_hang__', () => {}, [], 'Test job', false)"
        )
        expect(page.locator("#job-status")).to_have_class(_VISIBLE, timeout=2000)

        page.route(
            "**/api/projects/switch",
            lambda route: route.fulfill(
                content_type="application/json",
                body=json.dumps({"current": route.request.post_data_json["path"]}),
            ),
        )
        page.locator("#btn-project-switcher").click()
        page.locator("#project-menu").get_by_text("Open another project…").click()
        page.fill("#open-project-path", str(served_project_dir(page)))
        page.click("#btn-open-project-confirm")

        # switchProject() reloads ~300ms after the fake-success toast; poll a
        # condition that is only true post-reload (pre-reload it's non-null).
        page.wait_for_function(
            "window.AppState && AppState.activeVideoId === null && AppState.activeClipId === null",
            timeout=15000,
        )
        expect(page.locator("#job-status")).not_to_have_class(_VISIBLE)
