"""POST /api/models/prefetch — the Tier-B model download route (packaging-
strategy overhaul, Wave 4). Mirrors /api/llm/ollama/pull's subprocess_sse
pattern; these tests stub subprocess_sse itself (as test_analyze.py's export/
retranscribe cmd-capture tests do) so no real model download runs."""
from __future__ import annotations

import sys

from fastapi.testclient import TestClient


class TestPrefetchGuard:
    def test_unknown_slug_is_rejected(self, client: TestClient):
        resp = client.post("/api/models/prefetch", params={"slug": "vision"})
        assert resp.status_code == 400
        assert "Unknown model slug" in resp.json()["detail"]

    def test_unknown_slug_never_spawns_a_subprocess(self, client: TestClient, monkeypatch):
        from yuu_clip.web.routes import models

        async def fail_if_called(*a, **k):
            raise AssertionError("must not spawn a subprocess for an unknown slug")

        monkeypatch.setattr(models, "subprocess_sse", fail_if_called)
        resp = client.post("/api/models/prefetch", params={"slug": "bogus"})
        assert resp.status_code == 400


class TestPrefetchCommand:
    def _capture_cmd(self, client: TestClient, monkeypatch, slug: str):
        from starlette.responses import PlainTextResponse

        from yuu_clip.web.routes import models

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(models, "subprocess_sse", fake_sse)
        resp = client.post("/api/models/prefetch", params={"slug": slug})
        assert resp.status_code == 200, resp.text
        return captured["cmd"]

    def test_speaker_slug_builds_the_prefetch_cli_command(self, client: TestClient, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "speaker")
        assert cmd[0] == sys.executable
        assert cmd[1:4] == ["-m", "yuu_clip.cli", "prefetch-model"]
        assert "speaker" in cmd

    def test_audio_event_slug_builds_the_prefetch_cli_command(self, client: TestClient, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "audio_event")
        assert "audio_event" in cmd

    def test_embeddings_slug_builds_the_prefetch_cli_command(self, client: TestClient, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "embeddings")
        assert "embeddings" in cmd


class TestPrefetchOfflineFailure:
    def test_download_failure_streams_an_error_line_not_a_500(self, client: TestClient):
        """A real (short-lived) subprocess whose fetcher fails -- speechbrain
        isn't installed in the test venv, so this exercises the actual
        "missing/unreachable model" path end to end -- must still come back as
        a 200 streaming response with a readable error line, never a raw 500.
        Mirrors how the browser distinguishes "download failed, retry" from a
        server crash; the exact underlying error text is environment-dependent
        (missing package here, a network timeout on a real offline machine), so
        this only asserts the user-facing shape, not that literal string."""
        with client.stream("POST", "/api/models/prefetch", params={"slug": "speaker"}) as resp:
            assert resp.status_code == 200
            body = "".join(resp.iter_text())

        assert "Download failed" in body
        assert "__DONE__" in body
