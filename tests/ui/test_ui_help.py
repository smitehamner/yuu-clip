"""
Playwright UI tests - Help & Guides modal.

The four user guides ship inside the app (yuu_clip/web/static/help/*.md, copied
from docs/user/ by `yuu-dev help-docs`) and render in-app so Help works offline
and while the repo is private. Each doc keeps a secondary "View online" link.

Run against the live dev server on port 8080.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page

# (data-help-doc key, sidebar tab title) for the four bundled guides.
_DOCS = [
    ("overview", "Overview"),
    ("features", "Feature guide"),
    ("walkthrough", "End-to-end walkthrough"),
    ("performance", "Performance & disk usage"),
]


def _open_help(page: Page) -> None:
    page.evaluate("openHelpModal()")
    page.wait_for_selector("#help-modal.visible")
    page.wait_for_selector("#help-doc-list [data-help-doc]")


@skip_no_server
class TestHelpModal:
    def test_lists_all_four_guides(self, page: Page):
        _open_help(page)
        titles = page.eval_on_selector_all(
            "#help-doc-list .help-doc-tab-title", "els => els.map(e => e.textContent)"
        )
        assert titles == [title for _key, title in _DOCS]
        page.evaluate("closeHelpModal()")

    def test_each_doc_renders_offline(self, page: Page):
        """Opening every guide must render its content from the bundle alone -
        no request may leave the local origin."""
        external: list[str] = []

        def _guard(route):
            url = route.request.url
            if url.startswith(LIVE_URL) or url.startswith("http://127.0.0.1") or url.startswith("http://localhost"):
                route.continue_()
            else:
                external.append(url)
                route.abort()

        page.route("**/*", _guard)
        _open_help(page)
        for key, _title in _DOCS:
            page.click(f'#help-doc-list [data-help-doc="{key}"]')
            page.wait_for_selector("#help-doc-view .help-doc-body h1", timeout=3000)
            body = page.text_content("#help-doc-view .help-doc-body")
            assert body and len(body.strip()) > 100, f"{key} rendered empty"
        assert external == [], f"help viewer made external requests: {external}"
        page.evaluate("closeHelpModal()")
        page.unroute("**/*", _guard)

    def test_view_online_link_targets_github_per_doc(self, page: Page):
        _open_help(page)
        for key, _title in _DOCS:
            page.click(f'#help-doc-list [data-help-doc="{key}"]')
            page.wait_for_selector("#help-doc-view .help-online a")
            href = page.get_attribute("#help-doc-view .help-online a", "href")
            target = page.get_attribute("#help-doc-view .help-online a", "target")
            assert href.startswith("https://github.com/smitehamner/yuu-clip/blob/main/docs/user/")
            assert target == "_blank"
        page.evaluate("closeHelpModal()")

    def test_features_has_a_jump_toc(self, page: Page):
        _open_help(page)
        page.click('#help-doc-list [data-help-doc="features"]')
        page.wait_for_selector("#help-doc-view .help-toc .help-toc-link")
        toc_count = page.eval_on_selector_all(
            "#help-doc-view .help-toc .help-toc-link", "els => els.length"
        )
        assert toc_count > 3, "FEATURES.md should produce a multi-entry TOC"
        page.evaluate("closeHelpModal()")

    def test_escape_closes(self, page: Page):
        _open_help(page)
        page.locator("#help-modal-close-btn").focus()
        page.keyboard.press("Escape")
        page.wait_for_selector("#help-modal.visible", state="hidden")
