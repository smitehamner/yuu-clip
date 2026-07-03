"""
Reveal-in-Explorer route (yuu_clip/web/routes/reveal.py).

subprocess.Popen is patched in every accepted-path test — this must never
actually spawn Explorer during a test run.
"""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient


class TestReveal:
    def test_export_dir_path_accepted(self, client: TestClient):
        ctx = client.app.state.ctx
        target = ctx.export_dir / "clip1.mkv"
        target.write_bytes(b"fake video")
        with patch("yuu_clip.web.routes.reveal.subprocess.Popen") as mock_popen:
            r = client.post("/api/reveal", json={"path": str(target)})
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}
        mock_popen.assert_called_once_with(["explorer", f"/select,{target.resolve()}"])

    def test_recording_directory_path_accepted(self, client: TestClient, project_dir):
        target = project_dir / "session.mkv"
        target.write_bytes(b"fake video")
        with patch("yuu_clip.web.routes.reveal.subprocess.Popen") as mock_popen:
            r = client.post("/api/reveal", json={"path": str(target)})
        assert r.status_code == 200
        mock_popen.assert_called_once()

    def test_path_outside_project_rejected(self, client: TestClient, tmp_path):
        outside = tmp_path.parent / "some-other-file.mkv"
        outside.write_bytes(b"x")
        with patch("yuu_clip.web.routes.reveal.subprocess.Popen") as mock_popen:
            r = client.post("/api/reveal", json={"path": str(outside)})
        assert r.status_code == 400
        mock_popen.assert_not_called()

    def test_missing_file_404(self, client: TestClient):
        ctx = client.app.state.ctx
        target = ctx.export_dir / "does-not-exist.mkv"
        with patch("yuu_clip.web.routes.reveal.subprocess.Popen") as mock_popen:
            r = client.post("/api/reveal", json={"path": str(target)})
        assert r.status_code == 404
        mock_popen.assert_not_called()

    def test_non_windows_returns_501(self, client: TestClient):
        ctx = client.app.state.ctx
        target = ctx.export_dir / "clip1.mkv"
        target.write_bytes(b"fake video")
        with patch("yuu_clip.web.routes.reveal.sys.platform", "linux"):
            r = client.post("/api/reveal", json={"path": str(target)})
        assert r.status_code == 501

    def test_status_reports_can_reveal_on_windows(self, client: TestClient):
        with patch("yuu_clip.web.routes.analyze.sys.platform", "win32"):
            r = client.get("/api/status")
        assert r.json()["can_reveal"] is True
