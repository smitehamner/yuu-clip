"""Unit tests for the subprocess-to-SSE streaming helper (yuu_clip.web.sse).

Pure-asyncio: drives the StreamingResponse body generator directly, no live
server. Covers the launch-failure path, which is the one that used to abort the
async generator with no error line and no terminal done event, sticking the job
pill in the browser. The frame contract itself now lives in jobevents.frame and is
tested in test_jobevents.py.
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

    def test_cancelled_proc_yields_done_cancelled(self, tmp_path: Path):
        # A cancel endpoint adds THIS run's proc to ctx.cancelled_procs; the tail
        # reads that membership (keyed by proc identity, not a shared flag) and ends
        # with a typed done{cancelled}, then discards the entry so it can't leak.
        import sys
        from types import SimpleNamespace

        from yuu_clip.web import sse

        ctx = SimpleNamespace(
            analyze_proc=None, analyze_proc_kind=None,
            active_jobs=0, subprocess_procs=set(), counted_procs=set(),
            cancelled_procs=set(),
        )

        async def run():
            resp = await sse.subprocess_sse(
                [sys.executable, "-c", "print('working')"], tmp_path, ctx,
            )
            chunks = []
            async for chunk in resp.body_iterator:
                chunks.append(chunk)
                # Simulate the cancel endpoint firing mid-stream: once the proc is
                # registered, add it to the set before the tail's membership check.
                if ctx.analyze_proc is not None:
                    ctx.cancelled_procs.add(ctx.analyze_proc)
            return chunks

        payloads = _payloads(asyncio.run(run()))
        assert payloads[-1] == {"v": 1, "type": "done", "outcome": "cancelled"}
        assert ctx.cancelled_procs == set()  # discarded on read + in finally, no leak

    def test_stale_cancelled_proc_does_not_leak_into_a_new_job(self, tmp_path: Path):
        # A proc identity left in the set by an earlier, unrelated job must never mark
        # a later, different proc as cancelled - the structural fix for the old
        # ctx-scoped-boolean leak (test_score_after_a_cancel_...).
        import sys
        from types import SimpleNamespace

        from yuu_clip.web import sse

        ctx = SimpleNamespace(
            analyze_proc=None, analyze_proc_kind=None,
            active_jobs=0, subprocess_procs=set(), counted_procs=set(),
            cancelled_procs={object()},  # a stale proc from a prior cancelled job
        )

        async def run():
            resp = await sse.subprocess_sse(
                [sys.executable, "-c", "print('working')"], tmp_path, ctx,
            )
            return [chunk async for chunk in resp.body_iterator]

        payloads = _payloads(asyncio.run(run()))
        assert payloads[-1] == {"v": 1, "type": "done", "outcome": "ok"}


class TestSubprocessSseActiveJobTracking:
    """The track_active_job/clear_cmd_attr options - used by callers (e.g. URL
    import's /api/import-url/events) that need /api/status's any_running to
    reflect a job with no dedicated analyze_proc-based flag."""

    def test_active_jobs_incremented_while_running_and_cleared_after(self, tmp_path: Path):
        import sys
        from types import SimpleNamespace

        from yuu_clip.web.sse import subprocess_sse

        ctx = SimpleNamespace(
            analyze_proc=None, active_jobs=0, import_cmd="queued",
            subprocess_procs=set(), counted_procs=set(), cancelled_procs=set(),
        )
        observed = []

        async def drive():
            response = await subprocess_sse(
                [sys.executable, "-c", "print('hello')"], tmp_path, ctx,
                clear_cmd_attr="import_cmd", track_active_job=True,
            )
            async for _ in response.body_iterator:
                observed.append(ctx.active_jobs)

        asyncio.run(drive())

        assert observed and max(observed) == 1
        assert ctx.active_jobs == 0
        assert ctx.import_cmd is None

    def test_active_jobs_untouched_when_not_tracked(self, tmp_path: Path):
        import sys
        from types import SimpleNamespace

        from yuu_clip.web.sse import subprocess_sse

        ctx = SimpleNamespace(analyze_proc=None, active_jobs=0, subprocess_procs=set(), cancelled_procs=set())

        async def drive():
            response = await subprocess_sse([sys.executable, "-c", "print('hi')"], tmp_path, ctx)
            async for _ in response.body_iterator:
                pass

        asyncio.run(drive())
        assert ctx.active_jobs == 0
