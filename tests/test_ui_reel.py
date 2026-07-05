"""
Playwright UI tests — highlight reel ("demo") modal.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import time
from pathlib import Path

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


@skip_no_server
class TestDemoModal:
    def _open_modal(self, page: Page) -> None:
        # openHighlightReelsModal() returns early if there are no approved clips; open directly
        page.evaluate("document.getElementById('highlight-reels-modal').classList.add('visible')")
        page.locator("#highlight-reels-modal").wait_for(state="visible")

    def test_opens_and_closes(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        expect(page.locator("#highlight-reels-modal")).to_be_visible()
        page.click("#highlight-reels-modal button:has-text('Cancel')")
        expect(page.locator("#highlight-reels-modal")).not_to_be_visible()

    def test_has_transition_options(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        options = page.locator("#demo-transition option")
        assert options.count() >= 4

    def test_has_output_name_field(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        # Field is present and accepts text; left blank means the server auto-generates a filename
        expect(page.locator("#demo-output-name")).to_be_visible()
        placeholder = page.locator("#demo-output-name").get_attribute("placeholder")
        assert placeholder is not None and ".mkv" in placeholder

    def test_has_captions_mode_select(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        select = page.locator("#demo-captions")
        expect(select).to_be_visible()
        values = select.locator("option").evaluate_all("opts => opts.map(o => o.value)")
        assert values == ["none", "sidecar", "burnin"]
        assert select.input_value() == "none"

    def test_export_button_hidden_until_unexported_clips(self, page: Page):
        page.goto(LIVE_URL)
        self._open_modal(page)
        # The "Export N clips" button only appears once updateReelEstimate finds
        # included clips lacking an export; with no clips loaded it stays hidden.
        expect(page.locator("#reel-export-btn")).to_be_hidden()

    def test_preview_modal_has_prev_next_buttons(self, page: Page):
        page.goto(LIVE_URL)
        assert page.locator("#reel-preview-prev").count() == 1
        assert page.locator("#reel-preview-next").count() == 1


_FAKE_REEL_CLIPS = [
    {"id": 101, "video_id": 1, "video_name": "s.mkv", "start_hms": "0:00:01",
     "duration_hms": "0:00:05", "duration_ms": 5000, "score_overall": 0.9,
     "description": "first", "status": "approved", "has_export": True},
    {"id": 102, "video_id": 1, "video_name": "s.mkv", "start_hms": "0:00:10",
     "duration_hms": "0:00:05", "duration_ms": 5000, "score_overall": 0.8,
     "description": "second", "status": "approved", "has_export": True},
    {"id": 103, "video_id": 1, "video_name": "s.mkv", "start_hms": "0:00:20",
     "duration_hms": "0:00:05", "duration_ms": 5000, "score_overall": 0.7,
     "description": "third", "status": "approved", "has_export": True},
]


@skip_no_server
class TestReelBuilderCuration:
    """Build-tab clip list: boundary buttons, drag handles, and state that
    survives tab switches (M8-1/M8-3). Clip data is stubbed at the network
    layer so the tests don't depend on the live project's DB contents."""

    def _open_build(self, page: Page) -> None:
        import json
        page.route("**/api/demo/approved-clips*",
                   lambda route: route.fulfill(content_type="application/json",
                                               body=json.dumps(_FAKE_REEL_CLIPS)))
        page.route("**/api/demo/list",
                   lambda route: route.fulfill(content_type="application/json", body="[]"))
        page.evaluate("AppState.videos = [{id: 1, filename: 's.mkv', approved: 3}]")
        page.evaluate("openHighlightReelsModal('build')")
        page.locator(".reel-clip-row").first.wait_for()

    def _names(self, page: Page) -> list:
        return page.locator(".reel-clip-name").all_inner_texts()

    def test_move_buttons_disabled_at_boundaries(self, page: Page):
        self._open_build(page)
        rows = page.locator(".reel-clip-row")
        expect(rows.first.locator("button[title='Move up']")).to_be_disabled()
        expect(rows.first.locator("button[title='Move down']")).to_be_enabled()
        expect(rows.last.locator("button[title='Move up']")).to_be_enabled()
        expect(rows.last.locator("button[title='Move down']")).to_be_disabled()

    def test_each_row_has_drag_handle(self, page: Page):
        self._open_build(page)
        assert page.locator(".reel-clip-row .reel-clip-drag").count() == len(_FAKE_REEL_CLIPS)

    def test_curation_survives_tab_switch(self, page: Page):
        self._open_build(page)
        page.evaluate("_reelMove(0, 1)")       # order: second, first, third
        page.evaluate("_reelToggle(2, false)")  # exclude "third"
        page.evaluate("switchReelTab('view')")
        page.evaluate("switchReelTab('build')")
        page.locator(".reel-clip-row").first.wait_for()
        assert self._names(page) == ["second", "first", "third"]
        expect(page.locator(".reel-clip-row").last).to_have_class("reel-clip-row excluded")

    def test_drag_reorders_and_commits(self, page: Page):
        # Playwright's mouse API can't drive native HTML5 DnD, so dispatch the
        # DragEvents directly: grab row 0 by its handle, hover past the last
        # row, and drop — the row should land at the end and the order commit.
        self._open_build(page)
        page.evaluate("""() => {
          const rows = [...document.querySelectorAll('.reel-clip-row')];
          const list = document.getElementById('reel-clip-list');
          const dt = new DataTransfer();
          rows[0].querySelector('.reel-clip-drag')
                 .dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
          rows[0].dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: dt}));
          const below = rows[rows.length - 1].getBoundingClientRect().bottom + 5;
          list.dispatchEvent(new DragEvent('dragover', {bubbles: true, clientY: below, dataTransfer: dt}));
          rows[0].dispatchEvent(new DragEvent('dragend', {bubbles: true}));
        }""")
        assert self._names(page) == ["second", "third", "first"]

    def test_reopening_modal_resets_curation(self, page: Page):
        self._open_build(page)
        page.evaluate("_reelMove(0, 1)")
        page.evaluate("_reelToggle(2, false)")
        page.evaluate("closeHighlightReelsModal()")
        page.evaluate("openHighlightReelsModal('build')")
        page.locator(".reel-clip-row").first.wait_for()
        assert self._names(page) == ["first", "second", "third"]
        assert page.locator(".reel-clip-row.excluded").count() == 0


_MANY_REEL_CLIPS = [
    {"id": 200 + i, "video_id": 1, "video_name": "s.mkv", "start_hms": f"0:00:{i:02d}",
     "duration_hms": "0:00:05", "duration_ms": 5000, "score_overall": 0.5,
     "description": f"clip {i}", "status": "approved", "has_export": True}
    for i in range(8)
]


@skip_no_server
class TestReelBuilderFooterVisible:
    """The Build Reel action row stays on-screen (sticky footer) even with a
    long clip list at the Electron default 1280x900 window — regression for the
    footer being half-clipped below the fold."""

    def test_build_button_within_viewport_with_many_clips(self, page: Page):
        import json
        page.set_viewport_size({"width": 1280, "height": 900})
        page.route("**/api/demo/approved-clips*",
                   lambda route: route.fulfill(content_type="application/json",
                                               body=json.dumps(_MANY_REEL_CLIPS)))
        page.route("**/api/demo/list",
                   lambda route: route.fulfill(content_type="application/json", body="[]"))
        page.evaluate("AppState.videos = [{id: 1, filename: 's.mkv', approved: 8}]")
        page.evaluate("openHighlightReelsModal('build')")
        page.locator(".reel-clip-row").first.wait_for()
        btn = page.locator("#reel-tab-build .modal-actions button:has-text('Build Reel')")
        box = btn.bounding_box()
        assert box is not None
        assert box["y"] >= 0
        assert box["y"] + box["height"] <= 900 + 1
        page.evaluate("closeHighlightReelsModal()")


_FAKE_PENDING_CLIP = {
    "id": 104, "video_id": 1, "video_name": "s.mkv", "start_hms": "0:00:30",
    "duration_hms": "0:00:05", "duration_ms": 5000, "score_overall": 0.5,
    "description": "fourth-pending", "status": "pending", "has_export": False,
}


@skip_no_server
class TestReelPoolStatusFilters:
    """Quick-wins Stage 5 — Approved/Unreviewed/Rejected pool chips in the
    Build tab. The mocked route branches on the `statuses` query param so
    toggling a chip is observable without a live DB."""

    def _open_build_with_status_routing(self, page: Page) -> None:
        import json
        from urllib.parse import parse_qs, urlparse

        def handler(route):
            qs = parse_qs(urlparse(route.request.url).query)
            statuses = qs.get("statuses", ["approved"])[0].split(",")
            pool = list(_FAKE_REEL_CLIPS)
            if "pending" in statuses:
                pool.append(_FAKE_PENDING_CLIP)
            route.fulfill(content_type="application/json", body=json.dumps(pool))

        page.route("**/api/demo/approved-clips*", handler)
        page.route("**/api/demo/list",
                   lambda route: route.fulfill(content_type="application/json", body="[]"))
        page.evaluate("AppState.videos = [{id: 1, filename: 's.mkv', approved: 3}]")
        page.evaluate("openHighlightReelsModal('build')")
        page.locator(".reel-clip-row").first.wait_for()

    def test_approved_chip_active_by_default(self, page: Page):
        self._open_build_with_status_routing(page)
        expect(page.locator("[data-reel-status='approved']")).to_have_attribute("aria-pressed", "true")
        expect(page.locator("[data-reel-status='pending']")).to_have_attribute("aria-pressed", "false")
        assert page.locator(".reel-clip-row").count() == 3

    def test_toggling_unreviewed_adds_pending_clips_marked_excluded(self, page: Page):
        self._open_build_with_status_routing(page)
        page.click("[data-reel-status='pending']")
        page.wait_for_function("document.querySelectorAll('.reel-clip-row').length === 4")
        new_row = page.locator(".reel-clip-row", has_text="fourth-pending")
        expect(new_row).to_have_class("reel-clip-row excluded")
        # existing approved clips keep their prior (included) state
        expect(page.locator(".reel-clip-row", has_text="first")).to_have_class("reel-clip-row")

    def test_toggling_off_the_last_active_chip_is_a_noop(self, page: Page):
        self._open_build_with_status_routing(page)
        page.click("[data-reel-status='approved']")
        expect(page.locator("[data-reel-status='approved']")).to_have_attribute("aria-pressed", "true")
        assert page.locator(".reel-clip-row").count() == 3


@skip_no_server
class TestReelDelete:
    def test_delete_reel_from_view_tab(self, page: Page):
        # End-to-end against the live server: a throwaway reel file on disk,
        # deleted through the View tab's Delete button + confirm dialog.
        reels_dir = Path(__file__).resolve().parent.parent / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        fake_reel = reels_dir / "uitest_delete_me.mkv"
        fake_reel.write_bytes(b"fake")
        try:
            page.evaluate("openHighlightReelsModal('view')")
            item = page.locator(".reel-item", has_text="uitest_delete_me.mkv")
            item.wait_for()
            item.get_by_role("button", name="Delete").click()
            page.locator("#confirm-ok-btn").click()
            expect(page.locator(".reel-item", has_text="uitest_delete_me.mkv")).to_have_count(0)
            deadline = time.monotonic() + 5
            while fake_reel.exists() and time.monotonic() < deadline:
                time.sleep(0.1)
            assert not fake_reel.exists()
        finally:
            fake_reel.unlink(missing_ok=True)


@skip_no_server
class TestReelShowInFolder:
    def test_show_in_folder_posts_reveal_with_reel_path(self, page: Page):
        reels_dir = Path(__file__).resolve().parent.parent / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        fake_reel = reels_dir / "uitest_show_in_folder.mkv"
        fake_reel.write_bytes(b"fake")
        try:
            page.wait_for_function("() => AppState.canReveal === true", timeout=5000)
            page.route(
                "**/api/reveal",
                lambda route: route.fulfill(
                    status=200, content_type="application/json", body='{"status": "ok"}'
                ),
            )
            page.evaluate("openHighlightReelsModal('view')")
            item = page.locator(".reel-item", has_text="uitest_show_in_folder.mkv")
            item.wait_for()
            with page.expect_request("**/api/reveal") as req_info:
                item.get_by_role("button", name="Show in Folder").click()
            assert req_info.value.post_data_json["path"].endswith("uitest_show_in_folder.mkv")
        finally:
            fake_reel.unlink(missing_ok=True)


@skip_no_server
class TestReelStaleness:
    """Plan 02 (staleness) journey 8: a reel built from a clip that is later
    re-exported (or never/no-longer exported) shows a stale badge. End-to-end
    against the live project: a real .reel.json manifest referencing a real
    clip ID, read back by the real GET /api/demo/list staleness computation —
    no network stubbing, matching the TestReelDelete/TestReelShowInFolder
    pattern of writing throwaway files into the live project's reels dir."""

    def _reels_dir(self) -> Path:
        return Path(__file__).resolve().parent.parent / ".yuu-clip" / "reels"

    def _write_reel(self, reels_dir: Path, name: str, clip_ids: list) -> Path:
        import json
        reels_dir.mkdir(parents=True, exist_ok=True)
        reel = reels_dir / name
        reel.write_bytes(b"fake")
        reel.with_suffix(".reel.json").write_text(
            json.dumps({"version": 1, "clips": [{"id": cid, "duration_s": 5.0} for cid in clip_ids]}),
            encoding="utf-8",
        )
        return reel

    def _find_unexported_clip_id(self, page: Page):
        """First clip in the live project with no export on disk — a reel
        manifest pointing at it should always compute as stale."""
        return page.evaluate("""async () => {
            const videos = await fetch('/api/videos').then(r => r.json());
            for (const v of videos) {
                const clips = await fetch(`/api/videos/${v.id}/clips`).then(r => r.json());
                const unexported = clips.find(c => !c.has_export);
                if (unexported) return unexported.id;
            }
            return null;
        }""")

    def test_stale_badge_shown_for_unexported_member_clip(self, page: Page):
        clip_id = self._find_unexported_clip_id(page)
        assert clip_id is not None, "live project fixture needs at least one unexported clip"
        reels_dir = self._reels_dir()
        fake_reel = self._write_reel(reels_dir, "uitest_stale_reel.mkv", [clip_id])
        try:
            page.evaluate("openHighlightReelsModal('view')")
            item = page.locator(".reel-item", has_text="uitest_stale_reel.mkv")
            item.wait_for()
            expect(item).to_contain_text("Stale")
        finally:
            fake_reel.unlink(missing_ok=True)
            fake_reel.with_suffix(".reel.json").unlink(missing_ok=True)

    def test_no_stale_badge_for_legacy_reel_without_manifest(self, page: Page):
        reels_dir = self._reels_dir()
        reels_dir.mkdir(parents=True, exist_ok=True)
        fake_reel = reels_dir / "uitest_legacy_reel.mkv"
        fake_reel.write_bytes(b"fake")
        try:
            page.evaluate("openHighlightReelsModal('view')")
            item = page.locator(".reel-item", has_text="uitest_legacy_reel.mkv")
            item.wait_for()
            expect(item).not_to_contain_text("Stale")
        finally:
            fake_reel.unlink(missing_ok=True)
