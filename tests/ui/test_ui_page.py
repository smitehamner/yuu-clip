"""
Playwright UI tests - page load and sidebar.

Run against the live fixture server yuu-dev test-ui spawns. Skipped automatically if the
server is not reachable. See tests/conftest.py for the shared helpers.
"""
from __future__ import annotations

import re

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


@skip_no_server
class TestPageLoad:
    def test_title(self, page: Page):
        page.goto(LIVE_URL)
        expect(page).to_have_title("YuuClip")

    def test_header_buttons_visible(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("button#btn-analyze")).to_be_visible()
        expect(page.locator("button#btn-highlight-reels")).to_be_visible()

    def test_core_nav_promoted_out_of_hamburger(self, page: Page):
        # WS3: World Contexts + People are primary nav, visible in the header
        # rather than buried in the overflow menu; Highlight Reels sits with them.
        page.goto(LIVE_URL)
        nav = page.locator("header nav.primary-nav")
        expect(nav.locator("#btn-people")).to_be_visible()
        expect(nav.locator("#btn-world-contexts")).to_be_visible()
        expect(nav.locator("#btn-highlight-reels")).to_be_visible()

    def test_hamburger_has_no_duplicate_settings_or_moved_items(self, page: Page):
        # WS3: Settings lives only on the gear (no hamburger dup); People and
        # World Contexts moved to the primary nav.
        page.goto(LIVE_URL)
        page.click("#btn-hamburger")
        page.wait_for_selector("#hamburger-menu.open")
        items = page.locator("#hamburger-menu .hamburger-item")
        texts = items.all_inner_texts()
        assert not any(t.strip() == "Settings" for t in texts), texts
        assert not any("World Contexts" in t for t in texts), texts
        assert not any(t.strip() == "People" for t in texts), texts
        expect(page.locator("#btn-settings-header")).to_be_visible()

    def test_brand_logo_next_to_name(self, page: Page):
        page.goto(LIVE_URL)
        logo = page.locator("header .brand .brand-logo")
        expect(logo).to_be_visible()
        assert logo.get_attribute("src").endswith("gamercat.png")

    def test_footer_version_tag_has_v_prefix(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#version-tag")).to_have_text(re.compile(r"^v\d"))

    def test_about_modal_shows_version(self, page: Page):
        page.goto(LIVE_URL)
        # Wait for the /api/status fetch that populates both version displays
        expect(page.locator("#version-tag")).to_have_text(re.compile(r"^v\d"))
        page.evaluate("openAboutModal()")
        page.wait_for_selector("#about-modal.visible")
        expect(page.locator("#about-version")).to_have_text(re.compile(r"^Version v\d"))
        page.evaluate("closeAboutModal()")


@skip_no_server
class TestJobGuardWhileAnalyzing:
    """Competing SSE jobs bail with a toast while an analysis is running, so they
    don't tear down the live analyze progress stream."""

    def test_guard_blocks_and_toasts_while_analyzing(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.evaluate("AppState.analyzeFilename = 'busy.mkv'")
        assert page.evaluate("_blockedByAnalyze('re-score clips')") is True
        expect(page.locator("#toast-container")).to_contain_text("Wait for the current analysis")

    def test_guard_allows_when_idle(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.evaluate("AppState.analyzeFilename = null")
        assert page.evaluate("_blockedByAnalyze('re-score clips')") is False


@skip_no_server
class TestLogPanelPlacement:
    """The log lives inside the main column so the sidebar extends full height
    beside it - no full-width bar (or body-background gap) under the sidebar."""

    def test_log_panel_is_inside_main(self, page: Page):
        page.goto(LIVE_URL)
        assert page.evaluate("!!document.querySelector('.main #log-panel')") is True

    def test_log_left_aligns_with_main_and_clears_sidebar(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.evaluate(
            "const p = document.getElementById('log-panel');"
            "p.classList.add('visible'); p.classList.remove('minimized');"
        )
        r = page.evaluate(
            "() => ({"
            "  main: document.querySelector('.main').getBoundingClientRect().left,"
            "  log:  document.getElementById('log-panel').getBoundingClientRect().left,"
            "  sideR: document.querySelector('.sidebar').getBoundingClientRect().right,"
            "})"
        )
        assert abs(r["log"] - r["main"]) < 2   # aligned with the detail column
        assert r["log"] >= r["sideR"] - 1      # does not span under the sidebar

    def test_sidebar_has_videos(self, page: Page):
        page.goto(LIVE_URL)
        # Wait for video list to populate
        page.wait_for_selector("#video-list li", timeout=5000)
        items = page.locator("#video-list li")
        assert items.count() > 0

    def test_sidebar_has_no_clip_selected_message(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#no-clip-selected, .detail-empty")).to_be_visible()


@skip_no_server
class TestDiffModalUnsavedEdits:
    """The diff modal's Discard/Escape must not silently throw away textarea
    edits - same dirty-check confirm the field-edit modal already has."""

    def _open_diff(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("""() => {
            window._diffCommitted = null;
            openDiffModal('Review Generated Content',
                [{label: 'Description', current: 'old text', proposed: 'proposed text'}],
                (action, edited) => { window._diffCommitted = action; });
        }""")
        page.wait_for_selector("#diff-modal.visible", timeout=2000)

    def test_untouched_discard_closes_without_confirm(self, page: Page):
        self._open_diff(page)
        page.click("#diff-discard-btn")
        page.wait_for_selector("#diff-modal.visible", state="hidden", timeout=2000)
        expect(page.locator("#confirm-modal")).not_to_be_visible()

    def test_edited_discard_asks_before_losing_the_edit(self, page: Page):
        self._open_diff(page)
        page.fill("#diff-new-0", "my careful edit")
        page.click("#diff-discard-btn")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Discard edit?")
        expect(page.locator("#diff-modal")).to_be_visible()
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        expect(page.locator("#diff-modal")).to_be_visible()
        assert page.input_value("#diff-new-0") == "my careful edit"

    def test_edited_escape_asks_then_confirm_discards(self, page: Page):
        self._open_diff(page)
        page.fill("#diff-new-0", "my careful edit")
        # Escape from a button (where modal focus normally sits), not the
        # textarea - typing surfaces keep Escape to themselves.
        page.locator("#diff-discard-btn").focus()
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-ok-btn")
        page.wait_for_selector("#diff-modal.visible", state="hidden", timeout=2000)
        assert page.evaluate("() => window._diffCommitted") is None


@skip_no_server
class TestVideoSidebarControls:
    """Video sidebar search + sort + filter chips are present and the chips
    toggle (with 'All' resetting)."""

    def test_controls_present(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator("#video-search-input")).to_be_visible()
        expect(page.locator("#videos-sort")).to_be_visible()
        expect(page.locator("button[data-vfilter='has-clips']")).to_be_visible()

    def test_video_chip_toggles_and_all_resets(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        has_clips = page.locator("button[data-vfilter='has-clips']")
        all_chip = page.locator("button[data-vfilter='all']")
        has_clips.click()
        expect(has_clips).to_have_attribute("aria-pressed", "true")
        expect(all_chip).to_have_attribute("aria-pressed", "false")
        has_clips.click()
        expect(all_chip).to_have_attribute("aria-pressed", "true")

    def test_video_sort_persists_and_restores(self, page: Page):
        page.goto(LIVE_URL)
        page.select_option("#videos-sort", "length")
        assert page.evaluate("() => localStorage.getItem('videos-sort')") == "length"
        page.reload()
        assert page.input_value("#videos-sort") == "length"
        assert page.evaluate("() => AppState.videoSort") == "length"

    def test_clip_chip_sync_leaves_video_chips_alone(self, page: Page):
        # Regression: _syncFilterChips (clips) used to match every .clip-chip,
        # stripping the active state off the videos "All" chip on video select.
        page.goto(LIVE_URL)
        page.evaluate(
            "() => { AppState.clipFilters = new Set(['approved']); _syncFilterChips(); }"
        )
        expect(page.locator("button[data-vfilter='all']")).to_have_attribute(
            "aria-pressed", "true"
        )

    def test_filter_chips_wrap_within_sidebar(self, page: Page):
        # H2-1: chips must wrap, never overflow horizontally out of view.
        page.goto(LIVE_URL)
        overflowing = page.evaluate(
            """() => {
              const tabs = document.querySelector('.clips-group .clip-filter-tabs');
              const right = tabs.getBoundingClientRect().right;
              return [...tabs.querySelectorAll('.clip-chip')]
                .filter(chip => chip.getBoundingClientRect().right > right + 1)
                .map(chip => chip.textContent.trim());
            }"""
        )
        assert overflowing == []

    def test_primary_status_chips_single_line_at_default_width(self, page: Page):
        # Sidebar-declutter Stage 3 / Part B: at the default --sidebar-width the
        # everyday chip rows must NOT wrap. The Clips status row (All /
        # Unreviewed / Approved / Rejected) with its count badges is the tight
        # one; the Recordings row (All / Has clips) is checked too. Counts are
        # seeded single-digit (the common review state) so the assertion is
        # deterministic regardless of the seeded DB.
        page.goto(LIVE_URL)
        page.wait_for_selector(".clip-chip[data-filter='pending']", timeout=8000)
        result = page.evaluate(
            """() => {
              // Neutralize any drag-persisted width so we measure the CSS default.
              document.documentElement.style.removeProperty('--sidebar-width');
              const dflt = getComputedStyle(document.documentElement)
                .getPropertyValue('--sidebar-width').trim();
              document.documentElement.style.setProperty('--sidebar-width', dflt);
              document.querySelectorAll('.clip-chip-count[data-count]')
                .forEach(b => b.textContent = '9');
              const rowTops = sel => [...document.querySelectorAll(sel)]
                .map(c => Math.round(c.getBoundingClientRect().top));
              // Direct-child rows only - excludes the collapsed More-filters
              // details (display:none => top 0) and the clips kind row ([role]).
              const status = rowTops(".clips-group > .clip-filter-tabs:not([role]) .clip-chip[data-filter]");
              const recs = rowTops(".videos-group > .clip-filter-tabs .clip-chip[data-vfilter]");
              const spread = t => Math.max(...t) - Math.min(...t);
              return {width: dflt, statusSpread: spread(status), recsSpread: spread(recs)};
            }"""
        )
        # Same offsetTop for every chip in the row => one visual line.
        assert result["statusSpread"] <= 1, result
        assert result["recsSpread"] <= 1, result
