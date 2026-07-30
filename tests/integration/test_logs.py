"""web/routes/logs.py - the application-log download and glossary routes.

Neither had a dedicated test file anywhere. Both are simple, but /api/logs/export has
two real branches (a log file on disk for this project vs. the in-memory buffer
fallback) worth pinning, and /api/glossary is the one route serving a bundled static
file outside the usual DB-backed pattern.
"""
from __future__ import annotations

from pathlib import Path

from yuu_clip.log import log_path_for


class TestExportLog:
    def test_downloads_the_project_log_file_when_it_exists(self, client, project_dir: Path):
        log_file = log_path_for(project_dir)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        log_file.write_text("2026-01-01 12:00:00 INFO server started\n", encoding="utf-8")

        resp = client.get("/api/logs/export")

        assert resp.status_code == 200
        # FileResponse streams the file's raw bytes - normalize Windows CRLF before
        # comparing so the assertion isn't platform-dependent.
        assert resp.text.replace("\r\n", "\n") == "2026-01-01 12:00:00 INFO server started\n"
        assert resp.headers["content-type"].startswith("text/plain")
        disposition = resp.headers["content-disposition"]
        assert disposition.startswith("attachment;")
        assert disposition.endswith('.log"')

    def test_falls_back_to_the_in_memory_buffer_when_no_log_file_exists(self, client, project_dir: Path):
        log_file = log_path_for(project_dir)
        assert not log_file.exists()

        resp = client.get("/api/logs/export")

        assert resp.status_code == 200
        assert resp.headers["content-disposition"].startswith("attachment;")
        # Either buffered lines or the documented placeholder - never a 500 or an
        # attempt to read a file that isn't there.
        assert resp.text != ""

    def test_redacts_a_username_that_predates_the_formatter(self, client, project_dir: Path):
        # Historical log content (written before a redaction rule covered it, or by
        # any other path that bypassed _SanitizingFormatter) must not ship verbatim
        # just because it's already sitting in the file - the download route
        # re-redacts on read, not just at write time (found 2026-07-30: 5 old lines
        # in the owner's real dev log leaked their Windows username this way).
        log_file = log_path_for(project_dir)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        log_file.write_text(
            r"2026-01-01 12:00:00 DEBUG yuu_clip.config - Loaded global config from"
            "\n" r"C:\Users\realname\AppData\Local\yuu-clip\yuu-clip\config.json",
            encoding="utf-8",
        )

        resp = client.get("/api/logs/export")

        assert resp.status_code == 200
        assert "realname" not in resp.text
        assert r"C:\Users\<user>\AppData" in resp.text

    def test_filename_is_dated(self, client, project_dir: Path):
        from datetime import datetime

        resp = client.get("/api/logs/export")

        today = datetime.now().strftime("%Y-%m-%d")
        assert f"yuu-clip-{today}.log" in resp.headers["content-disposition"]


class TestGlossary:
    def test_returns_the_bundled_glossary_as_plain_text(self, client):
        resp = client.get("/api/glossary")

        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/plain")
        assert len(resp.text) > 0

    def test_missing_glossary_file_returns_404(self, client, monkeypatch):
        import yuu_clip.web.routes.logs as logs_module

        original_exists = logs_module.Path.exists

        def _fake_exists(self):
            if self.name == "glossary.md":
                return False
            return original_exists(self)

        monkeypatch.setattr(logs_module.Path, "exists", _fake_exists)

        resp = client.get("/api/glossary")

        assert resp.status_code == 404
