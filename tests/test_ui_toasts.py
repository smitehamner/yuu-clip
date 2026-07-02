"""
Playwright UI tests — toast standards (CC-5).

Warning type, error persistence, stack cap, and the optional action button.
Run against the live dev server on port 8080. Skipped automatically if the
server is not reachable. See tests/conftest.py for the shared helpers.
"""
from __future__ import annotations

from conftest import skip_no_server
from playwright.sync_api import Page, expect


@skip_no_server
class TestToastTypes:
    def test_warning_toast_gets_warning_class(self, page: Page):
        page.evaluate("showToast('Careful now', 'warning')")
        expect(page.locator("#toast-container .toast.warning")).to_have_count(1)

    def test_error_toast_persists_until_dismissed(self, page: Page):
        page.evaluate("showToast('It broke', 'error', {durationMs: 100})")
        page.wait_for_timeout(1200)
        error_toast = page.locator("#toast-container .toast.error")
        expect(error_toast).to_have_count(1)
        error_toast.get_by_role("button", name="Dismiss").click()
        expect(page.locator("#toast-container .toast.error")).to_have_count(0)

    def test_non_error_toast_auto_dismisses(self, page: Page):
        page.evaluate("showToast('Saved', 'success', {durationMs: 100})")
        expect(page.locator("#toast-container .toast.success")).to_have_count(0)

    def test_blocked_by_analyze_guard_is_warning_not_error(self, page: Page):
        page.evaluate("AppState.analyzeFilename = 'busy.mkv'")
        page.evaluate("_blockedByAnalyze('re-score clips')")
        expect(page.locator("#toast-container .toast.warning")).to_contain_text(
            "Wait for the current analysis"
        )
        expect(page.locator("#toast-container .toast.error")).to_have_count(0)


@skip_no_server
class TestToastStackCap:
    def test_stack_capped_at_four_keeping_newest(self, page: Page):
        page.evaluate(
            "() => { for (let i = 0; i < 6; i++)"
            " showToast(`toast ${i}`, 'info', {durationMs: 60000}); }"
        )
        toasts = page.locator("#toast-container .toast")
        expect(toasts).to_have_count(4)
        expect(page.locator("#toast-container")).to_contain_text("toast 5")
        expect(page.locator("#toast-container")).not_to_contain_text("toast 0")


@skip_no_server
class TestToastActionButton:
    def test_action_button_runs_callback_and_dismisses(self, page: Page):
        page.evaluate(
            "() => { window._toastActionFired = false;"
            " showToast('Analysis complete', 'success',"
            " {action: {label: 'Review', onClick: () => { window._toastActionFired = true; }}}); }"
        )
        page.locator("#toast-container .toast").get_by_role("button", name="Review").click()
        assert page.evaluate("window._toastActionFired") is True
        expect(page.locator("#toast-container .toast")).to_have_count(0)

    def test_analysis_complete_toast_offers_review_jump(self, page: Page):
        page.evaluate("AppState.activeVideoId = null")
        page.evaluate("_showAnalysisToast({id: -1, clip_count: 3})")
        toast = page.locator("#toast-container .toast.success")
        expect(toast).to_contain_text("Analysis complete — 3 clips found")
        expect(toast.get_by_role("button", name="Review")).to_be_visible()

    def test_analysis_complete_toast_omits_review_when_already_active(self, page: Page):
        page.evaluate("AppState.activeVideoId = -1")
        page.evaluate("_showAnalysisToast({id: -1, clip_count: 1})")
        toast = page.locator("#toast-container .toast.success")
        expect(toast).to_contain_text("Analysis complete — 1 clip found")
        expect(toast.get_by_role("button", name="Review")).to_have_count(0)
