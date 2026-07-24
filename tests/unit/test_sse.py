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


class TestSseEvent:
    """The single SSE data-frame contract shared by every streaming route."""

    def test_string_payload_framed_and_json_encoded(self):
        from yuu_clip.web.sse import sse_event

        assert sse_event("hello") == 'data: "hello"\n\n'

    def test_dict_payload_json_encoded(self):
        from yuu_clip.web.sse import sse_event

        frame = sse_event({"type": "__DONE__", "ok": False})
        assert frame.startswith("data: ")
        assert frame.endswith("\n\n")
        assert json.loads(frame.removeprefix("data: ").rstrip()) == {"type": "__DONE__", "ok": False}

    def test_frame_ends_with_blank_line_terminator(self):
        from yuu_clip.web.sse import sse_event

        assert sse_event(42).endswith("\n\n")

    def test_special_characters_are_escaped(self):
        from yuu_clip.web.sse import sse_event

        # A newline / quote in the payload must not break the frame's own delimiters.
        frame = sse_event('line1\nline2 "quoted"')
        assert frame.count("\n\n") == 1  # only the terminator, not the embedded newline
        assert json.loads(frame.removeprefix("data: ").rstrip()) == 'line1\nline2 "quoted"'


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

    def test_failed_launch_emits_error_log_and_done_error(self, tmp_path: Path):
        # A bad executable / ENOENT on sys.executable raises out of
        # create_subprocess_exec; the client must still get an error log event and a
        # typed done{outcome=error} so endJobUI runs, the job pill clears, and the
        # frontend reports the job as failed rather than complete.
        payloads = self._drive(["nonexistent-binary"], tmp_path, FileNotFoundError("no such file"))
        assert any(
            isinstance(p, dict) and p.get("type") == "log" and p.get("level") == "error"
            and p.get("text", "").startswith("[Error:")
            for p in payloads
        )
        done = payloads[-1]
        assert isinstance(done, dict) and done["type"] == "done" and done["outcome"] == "error"
        assert done["error"]

    def test_done_event_is_last(self, tmp_path: Path):
        payloads = self._drive(["nonexistent-binary"], tmp_path, OSError("resource limit"))
        done = payloads[-1]
        assert isinstance(done, dict) and done["type"] == "done" and done["outcome"] == "error"
        # Exactly one terminal event, and it is last.
        assert sum(isinstance(p, dict) and p.get("type") == "done" for p in payloads) == 1

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


class TestSubprocessSseTypedWire:
    """subprocess_sse translates the child's prose+marker stdout into typed events."""

    def _run(self, script: str, tmp_path: Path) -> list:
        import sys

        from yuu_clip.web import sse

        async def run():
            resp = await sse.subprocess_sse([sys.executable, "-c", script], tmp_path)
            return [chunk async for chunk in resp.body_iterator]

        return _payloads(asyncio.run(run()))

    def test_prose_line_becomes_a_log_event(self, tmp_path: Path):
        payloads = self._run("print('Extracting audio')", tmp_path)
        assert {"v": 1, "type": "log", "text": "Extracting audio", "level": "info"} in payloads

    def test_marker_line_becomes_a_progress_event_not_a_log_twin(self, tmp_path: Path):
        # The child emits an @@PROGRESS marker; the server must translate it into a
        # progress event and NEVER also emit a log twin (would double-fire the pills).
        from yuu_clip.pipeline.progress import Stage, format_progress

        script = f"print({format_progress(Stage.SCORE, done=2, total=5)!r})"
        payloads = self._run(script, tmp_path)
        assert {"v": 1, "type": "progress", "stage": "score", "done": 2, "total": 5} in payloads
        assert not any(
            isinstance(p, dict) and p.get("type") == "log" and p.get("text", "").startswith("@@PROGRESS")
            for p in payloads
        )

    def test_success_ends_with_done_ok(self, tmp_path: Path):
        payloads = self._run("print('hi')", tmp_path)
        assert payloads[-1] == {"v": 1, "type": "done", "outcome": "ok"}

    def test_nonzero_exit_emits_error_log_and_done_error(self, tmp_path: Path):
        payloads = self._run("raise SystemExit(2)", tmp_path)
        assert any(
            isinstance(p, dict) and p.get("type") == "log" and p.get("level") == "error"
            and "[Error:" in p.get("text", "")
            for p in payloads
        )
        assert payloads[-1]["type"] == "done" and payloads[-1]["outcome"] == "error"

    def test_cancel_flag_yields_done_cancelled(self, tmp_path: Path):
        import sys
        from types import SimpleNamespace

        from yuu_clip.web import sse

        ctx = SimpleNamespace(
            analyze_proc=None, analyze_proc_kind=None, import_cancelled=True,
            active_jobs=0, subprocess_procs=set(), counted_procs=set(),
        )

        async def run():
            resp = await sse.subprocess_sse(
                [sys.executable, "-c", "print('done')"], tmp_path, ctx,
                cancel_flag_attr="import_cancelled", cancel_message="[Import cancelled]",
            )
            return [chunk async for chunk in resp.body_iterator]

        payloads = _payloads(asyncio.run(run()))
        assert payloads[-1] == {"v": 1, "type": "done", "outcome": "cancelled"}
        assert ctx.import_cancelled is False
