"""GET /api/updates/check (yuu_clip/web/routes/updates.py).

check_for_update is patched in every test - this must never make a real
network call to GitHub during a test run.
"""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from yuu_clip.update_check import UpdateCheckResult


class TestUpdatesCheck:
    def test_reports_update_available(self, client: TestClient):
        fake_result = UpdateCheckResult(
            current_version="0.1.0",
            latest_version="0.2.0",
            update_available=True,
            release_url="https://example.test/releases/v0.2.0",
        )
        with patch("yuu_clip.web.routes.updates.check_for_update", return_value=fake_result):
            r = client.get("/api/updates/check")
        assert r.status_code == 200
        body = r.json()
        assert body["update_available"] is True
        assert body["latest_version"] == "0.2.0"
        assert body["release_url"] == "https://example.test/releases/v0.2.0"
        assert body["error"] is None

    def test_reports_up_to_date(self, client: TestClient):
        fake_result = UpdateCheckResult(current_version="0.1.0", latest_version="0.1.0", update_available=False)
        with patch("yuu_clip.web.routes.updates.check_for_update", return_value=fake_result):
            r = client.get("/api/updates/check")
        assert r.status_code == 200
        assert r.json()["update_available"] is False

    def test_error_surfaces_as_200_with_error_field_not_a_failure(self, client: TestClient):
        fake_result = UpdateCheckResult(current_version="0.1.0", error="no internet")
        with patch("yuu_clip.web.routes.updates.check_for_update", return_value=fake_result):
            r = client.get("/api/updates/check")
        assert r.status_code == 200
        assert r.json()["error"] == "no internet"
        assert r.json()["update_available"] is False

    def test_passes_the_installed_package_version_to_the_check(self, client: TestClient):
        with patch("yuu_clip.web.routes.updates.check_for_update") as mock_check:
            mock_check.return_value = UpdateCheckResult(current_version="0.1.0")
            client.get("/api/updates/check")
        called_version = mock_check.call_args.args[0]
        assert isinstance(called_version, str) and called_version
