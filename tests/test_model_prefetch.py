"""POST /api/models/prefetch - the Tier-B model download route (packaging-
strategy overhaul, Wave 4). Mirrors /api/llm/ollama/pull's subprocess_sse
pattern; these tests stub subprocess_sse itself (as test_analyze.py's export/
retranscribe cmd-capture tests do) so no real model download runs."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

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
    def test_download_failure_streams_an_error_line_not_a_500(self, tmp_path: Path):
        """A prefetch subprocess whose fetcher fails (exits non-zero after printing
        a "Download failed: ..." line) must surface as a 200 streaming response
        carrying that readable line plus the __DONE__ sentinel - never a raw 500.
        This is how the browser distinguishes "download failed, retry" from a
        server crash. Driven against a real failing subprocess through the actual
        subprocess_sse streaming path (the route builds an identical command), so
        it is deterministic regardless of which models are cached in the venv. The
        CLI's own "Download failed:" output on a raising fetch is covered
        separately in test_cli.py."""
        from yuu_clip.web.sse import subprocess_sse

        cmd = [sys.executable, "-c", "print('Download failed: model unreachable'); raise SystemExit(1)"]
        ctx = SimpleNamespace(analyze_proc=None, active_jobs=0)
        chunks: list[str] = []

        async def drive():
            response = await subprocess_sse(cmd, tmp_path, ctx)
            assert response.status_code == 200
            async for chunk in response.body_iterator:
                chunks.append(chunk)

        asyncio.run(drive())
        body = "".join(chunks)
        assert "Download failed" in body
        assert "__DONE__" in body
