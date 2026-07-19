"""Unit tests for the subprocess-to-SSE streaming helper (yuu_clip.web.sse).

Pure-asyncio: drives the StreamingResponse body generator directly, no live
server. Covers the launch-failure path, which is the one that used to abort the
async generator with no error line and no __DONE__ sentinel, sticking the job
pill in the browser.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import patch


def _payloads(chunks: list) -> list:
    out = []
    for chunk in chunks:
        text = chunk.decode("utf-8") if isinstance(chunk, (bytes, bytearray)) else chunk
        for line in text.splitlines():
            if line.startswith("data: "):
                out.append(json.loads(line.removeprefix("data: ")))
    return out


class TestSubprocessSseLaunchFailure:
    def _drive(self, cmd, tmp_path: Path, exc: Exception) -> list:
        from yuu_clip.web import sse

        async def run():
            with patch.object(sse.asyncio, "create_subprocess_exec", side_effect=exc):
                resp = await sse.subprocess_sse(cmd, tmp_path)
                return [chunk async for chunk in resp.body_iterator]

        return _payloads(asyncio.run(run()))

    def test_failed_launch_emits_error_and_done(self, tmp_path: Path):
        # A bad executable / ENOENT on sys.executable raises out of
        # create_subprocess_exec; the client must still get an error line and a
        # failure __DONE__ sentinel so endJobUI runs, the job pill clears, and the
        # frontend reports the job as failed rather than complete.
        payloads = self._drive(["nonexistent-binary"], tmp_path, FileNotFoundError("no such file"))
        assert any(isinstance(p, str) and p.startswith("[Error:") for p in payloads)
        done = payloads[-1]
        assert isinstance(done, dict) and done["type"] == "__DONE__" and done["ok"] is False

    def test_done_sentinel_is_last(self, tmp_path: Path):
        payloads = self._drive(["nonexistent-binary"], tmp_path, OSError("resource limit"))
        done = payloads[-1]
        assert isinstance(done, dict) and done["type"] == "__DONE__" and done["ok"] is False

    def test_active_job_counter_restored_after_failed_launch(self, tmp_path: Path):
        from yuu_clip.web import sse

        class _Ctx:
            def __init__(self):
                self.active_jobs = 0
                self.subprocess_procs = set()
                self.analyze_proc = None

        ctx = _Ctx()

        async def run():
            with patch.object(sse.asyncio, "create_subprocess_exec", side_effect=OSError("boom")):
                resp = await sse.subprocess_sse(
                    ["nonexistent-binary"], tmp_path, ctx, track_active_job=True
                )
                async for _ in resp.body_iterator:
                    pass

        asyncio.run(run())
        assert ctx.active_jobs == 0
