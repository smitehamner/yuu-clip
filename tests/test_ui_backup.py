"""Playwright UI tests — Settings > Backup & Restore.

Every server call the render awaits is stubbed with page.route (hermetic): the
live suite shares one server across xdist workers, so a real /api/restore/apply
would switch the server's project out from under the other tests (same reason
test_ui_projects never POSTs a switch).
"""
from __future__ import annotations

import json
import re

from conftest import skip_no_server
from playwright.sync_api import Page, expect

_VISIBLE = re.compile(r"\bvisible\b")

_INSPECT_NO_MISSING = {
    "manifest": {"project_name": "Demo", "created_at": "2026-07-05T12:00:00+00:00"},
    "groups": [],
    "staging_path": "/tmp/staged.zip",
}
_INSPECT_ONE_MISSING = {
    "manifest": {"project_name": "Demo", "created_at": "2026-07-05T12:00:00+00:00"},
    "groups": [{
        "missing_dir": "D:\\Old\\Recordings",
        "file_count": 3,
        "sample_filenames": ["a.mkv", "b.mkv"],
    }],
    "staging_path": "/tmp/staged.zip",
}


def _fulfill_json(route, payload, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(payload))


def _open_settings(page: Page) -> None:
    # Reveal the panel directly instead of openSettings() so the test stays
    # hermetic (openSettings fires /api/config, /api/status, catalog fetches).
    page.evaluate("document.getElementById('settings-panel').classList.add('visible')")


def _choose_backup_file(page: Page) -> None:
    page.set_input_files("#restore-file-input", files=[
        {"name": "backup.zip", "mimeType": "application/zip", "buffer": b"PK\x03\x04stub"},
    ])


@skip_no_server
class TestBackup:
    def test_backup_button_calls_endpoint_and_toasts(self, page: Page):
        page.route("**/api/backup", lambda route: route.fulfill(
            status=200,
            headers={
                "content-type": "application/zip",
                "content-disposition": 'attachment; filename="proj-backup.zip"',
            },
            body=b"PK\x03\x04zip-bytes",
        ))
        _open_settings(page)
        with page.expect_request("**/api/backup") as req:
            page.locator("#btn-backup-project").click()
        assert req.value.method == "POST"
        expect(page.locator("#toast-container")).to_contain_text("Backup saved")


@skip_no_server
class TestRestore:
    def test_restore_with_no_missing_media_skips_repoint_and_applies(self, page: Page):
        page.route("**/api/restore/inspect", lambda route: _fulfill_json(route, _INSPECT_NO_MISSING))
        page.route("**/api/restore/apply", lambda route: _fulfill_json(route, {
            "current": "D:\\restored",
            "project_generation": 2,
            "repoint": {"remapped": 0, "still_missing": 0, "skipped_groups": 0},
        }))
        _open_settings(page)
        _choose_backup_file(page)

        expect(page.locator("#restore-target")).to_be_visible()
        # No missing-media groups -> no re-point rows.
        expect(page.locator(".restore-repoint-row")).to_have_count(0)

        page.fill("#restore-target", "D:\\restored")
        with page.expect_request("**/api/restore/apply") as req:
            page.locator("#btn-restore-confirm").click()
        body = req.value.post_data_json
        assert body["target_dir"] == "D:\\restored"
        assert body["overwrite"] is False
        assert body["mapping"] == {}
        expect(page.locator("#toast-container")).to_contain_text("Restored")

    def test_restore_with_missing_media_shows_repoint_rows(self, page: Page):
        page.route("**/api/restore/inspect", lambda route: _fulfill_json(route, _INSPECT_ONE_MISSING))
        _open_settings(page)
        _choose_backup_file(page)

        flow = page.locator("#restore-flow")
        expect(flow).to_contain_text("D:\\Old\\Recordings")
        expect(flow).to_contain_text("3 files")
        expect(flow).to_contain_text("a.mkv, b.mkv")
        # A per-directory location field the user can fill or leave blank (skip).
        expect(page.locator("#repoint-0")).to_be_visible()
        expect(page.locator(".restore-repoint-row")).to_have_count(1)

    def test_restore_maps_repointed_directory_into_apply_payload(self, page: Page):
        page.route("**/api/restore/inspect", lambda route: _fulfill_json(route, _INSPECT_ONE_MISSING))
        page.route("**/api/restore/apply", lambda route: _fulfill_json(route, {
            "current": "D:\\restored",
            "project_generation": 2,
            "repoint": {"remapped": 3, "still_missing": 0, "skipped_groups": 0},
        }))
        _open_settings(page)
        _choose_backup_file(page)

        page.fill("#restore-target", "D:\\restored")
        page.fill("#repoint-0", "E:\\Clips\\Recordings")
        with page.expect_request("**/api/restore/apply") as req:
            page.locator("#btn-restore-confirm").click()
        assert req.value.post_data_json["mapping"] == {"D:\\Old\\Recordings": "E:\\Clips\\Recordings"}

    def test_restore_target_required(self, page: Page):
        page.route("**/api/restore/inspect", lambda route: _fulfill_json(route, _INSPECT_NO_MISSING))
        _open_settings(page)
        _choose_backup_file(page)
        page.locator("#btn-restore-confirm").click()
        expect(page.locator("#toast-container")).to_contain_text("Choose a folder")

    def test_restore_existing_project_prompts_to_replace(self, page: Page):
        page.route("**/api/restore/inspect", lambda route: _fulfill_json(route, _INSPECT_NO_MISSING))
        page.route("**/api/restore/apply", lambda route: _fulfill_json(
            route,
            {"detail": {"code": "project_exists", "message": "The target folder already contains a project."}},
            status=409,
        ))
        _open_settings(page)
        _choose_backup_file(page)
        page.fill("#restore-target", "D:\\restored")
        page.locator("#btn-restore-confirm").click()
        expect(page.locator("#confirm-modal")).to_have_class(_VISIBLE)
        expect(page.locator("#confirm-title")).to_contain_text("Replace the existing project")

    def test_restore_bad_file_toasts_and_hides_flow(self, page: Page):
        page.route("**/api/restore/inspect", lambda route: _fulfill_json(
            route, {"detail": "This file is not a valid yuu-clip backup."}, status=400))
        _open_settings(page)
        _choose_backup_file(page)
        expect(page.locator("#toast-container")).to_contain_text("not a valid")
        expect(page.locator("#restore-flow")).to_be_hidden()
