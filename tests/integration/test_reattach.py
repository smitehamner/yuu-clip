"""
Stage-2 reattach: a running analysis must survive a browser refresh.

Covers the decoupled AnalyzeJob broadcast/replay, the /api/status identity a
reconnecting page uses to reattach, and the startup reconciliation that fails
rows left stuck mid-analysis by a previous (killed) server.
"""
from __future__ import annotations

import asyncio
import json
import sys

import pytest
from fastapi.testclient import TestClient

from yuu_clip.web.analyze_job import AnalyzeJob
from yuu_clip.web.app import create_app


def _payloads(sse_chunks: list[str]) -> list:
    """Decode the JSON payload out of each ``data: <json>\\n\\n`` SSE chunk."""
    out = []
    for chunk in sse_chunks:
        for line in chunk.splitlines():
            if line.startswith("data: "):
                out.append(json.loads(line.removeprefix("data: ")))
    return out


async def _consume(job: AnalyzeJob) -> list:
    return [chunk async for chunk in job._stream()]


# ---------------------------------------------------------------------------
# AnalyzeJob broadcast / replay
# ---------------------------------------------------------------------------

class TestAnalyzeJobBroadcast:
    def test_finished_job_replays_full_buffer_to_a_late_subscriber(self, tmp_path):
        async def drive():
            job = AnalyzeJob(
                [sys.executable, "-u", "-c", "print('alpha'); print('beta')"], tmp_path,
                filename="rec.mkv",
            )
            await job.start()
            await _consume(job)                 # first client streams to completion
            return _payloads(await _consume(job))  # a later client replays the buffer

        replay = asyncio.run(drive())
        assert "alpha" in replay
        assert "beta" in replay
        assert "__DONE__" in replay

    def test_emit_caps_buffer_to_most_recent_lines(self, tmp_path):
        # An unbounded buffer makes the reconnect replay so large the browser's
        # fetch reader can throw mid-stream; _emit keeps only the most recent lines.
        from yuu_clip.web.analyze_job import _MAX_BUFFER_LINES

        job = AnalyzeJob(["noop"], tmp_path, filename="rec.mkv")
        total = _MAX_BUFFER_LINES + 250
        for i in range(total):
            job._emit(f"line {i}")
        assert len(job.buffer) == _MAX_BUFFER_LINES
        assert job.buffer[0] == f"line {total - _MAX_BUFFER_LINES}"
        assert job.buffer[-1] == f"line {total - 1}"

    def test_two_concurrent_subscribers_both_receive_every_line(self, tmp_path):
        async def drive():
            job = AnalyzeJob(
                [sys.executable, "-u", "-c", "print('one'); print('two'); print('three')"], tmp_path,
            )
            await job.start()
            a, b = await asyncio.gather(_consume(job), _consume(job))
            return _payloads(a), _payloads(b)

        first, second = asyncio.run(drive())
        for stream in (first, second):
            assert {"one", "two", "three", "__DONE__"} <= set(stream)

    def test_cancel_emits_cancelled_message(self, tmp_path):
        async def drive():
            job = AnalyzeJob(
                [sys.executable, "-u", "-c", "import time; print('started'); time.sleep(30)"], tmp_path,
            )
            await job.start()
            collected: list[str] = []

            async def consume():
                async for chunk in job._stream():
                    collected.append(chunk)

            consumer = asyncio.create_task(consume())
            for _ in range(200):
                if any("started" in line for line in job.buffer):
                    break
                await asyncio.sleep(0.05)
            await job.cancel()
            await asyncio.wait_for(consumer, timeout=15)
            return _payloads(collected)

        payloads = asyncio.run(drive())
        assert "[Analysis cancelled]" in payloads
        assert "__DONE__" in payloads
        assert not any(isinstance(p, str) and p.startswith("[Error:") for p in payloads)

    def test_mid_run_subscriber_replays_buffer_then_gets_live_lines_exactly_once(self, tmp_path):
        # The replay/subscribe atomicity: a client attaching WHILE the job is live
        # must replay the already-buffered lines, then receive subsequent live lines,
        # with every line delivered exactly once (never both replayed and queued).
        # Driven without a real subprocess so the interleave is deterministic.
        from yuu_clip.web.analyze_job import _QUEUE_DONE

        async def drive():
            job = AnalyzeJob(["noop"], tmp_path)
            job._emit("before-1")
            job._emit("before-2")
            stream = job._stream()
            replayed = [await stream.__anext__(), await stream.__anext__()]
            job._emit("live-1")                # emitted only after the subscriber attached
            live = await stream.__anext__()
            job.done = True
            for queue in job.subscribers:
                queue.put_nowait(_QUEUE_DONE)
            done = await stream.__anext__()
            await stream.aclose()
            return _payloads(replayed), _payloads([live]), _payloads([done])

        replay, live, done = asyncio.run(drive())
        assert replay == ["before-1", "before-2"]
        assert live == ["live-1"]
        assert done == ["__DONE__"]

    def test_subscriber_attaching_after_done_is_never_registered(self, tmp_path):
        # The already_done fast path: a client attaching after the job finished gets
        # the buffer + __DONE__ and must NOT be added to subscribers (the pump has
        # already fanned out _QUEUE_DONE, so it would never be signalled and would
        # leak).
        async def drive():
            job = AnalyzeJob(["noop"], tmp_path)
            job._emit("only-line")
            job.done = True
            chunks = [chunk async for chunk in job._stream()]
            return _payloads(chunks), len(job.subscribers)

        payloads, remaining = asyncio.run(drive())
        assert payloads == ["only-line", "__DONE__"]
        assert remaining == 0


# ---------------------------------------------------------------------------
# /api/status identity for reattach
# ---------------------------------------------------------------------------

class TestStatusAnalyzeIdentity:
    def test_status_exposes_running_job_identity(self, project_dir):
        class _RunningJob:
            done = False
            filename = "running.mkv"
            video_id = 42
            gpu_temp_c = None
            gpu_state = "unavailable"

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_job = _RunningJob()
            d = tc.get("/api/status").json()
        assert d["analyze_running"] is True
        assert d["analyze_filename"] == "running.mkv"
        assert d["analyze_video_id"] == 42

    def test_status_omits_identity_when_job_finished(self, project_dir):
        class _FinishedJob:
            done = True
            filename = "done.mkv"
            video_id = 1

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_job = _FinishedJob()
            d = tc.get("/api/status").json()
        assert d["analyze_running"] is False
        assert d["analyze_filename"] is None

    def test_status_idle_has_null_identity(self, client):
        d = client.get("/api/status").json()
        assert d["analyze_filename"] is None
        assert d["analyze_video_id"] is None


# ---------------------------------------------------------------------------
# Startup reconciliation - interrupted 'extracting' rows become 'failed'
# ---------------------------------------------------------------------------

class TestFailInterruptedAnalyses:
    def _add_video(self, project_dir, status: str) -> int:
        from yuu_clip.db.models import Video, make_session

        session = make_session(project_dir / ".yuu-clip" / "project.db")
        video = Video(path=str(project_dir / f"{status}.mkv"), filename=f"{status}.mkv",
                      status=status, duration_ms=60_000)
        session.add(video)
        session.commit()
        vid = video.id
        session.close()
        return vid

    # Every mid-analysis transient status (not just 'extracting') must recover:
    # a crash during extraction strands 'labeled', during diarization strands
    # 'transcribed', etc. - all of these were previously never flipped.
    @pytest.mark.parametrize(
        "transient", ["labeled", "extracting", "transcribing", "transcribed", "segmented"]
    )
    def test_transient_row_flipped_to_failed_on_startup(self, project_dir, transient):
        stuck_id = self._add_video(project_dir, transient)

        app = create_app(project_dir)
        with TestClient(app) as tc:
            row = next(v for v in tc.get("/api/videos").json() if v["id"] == stuck_id)
        assert row["status"] == "failed"

    # Resting statuses (not-yet-analyzed or finished) must be left alone.
    @pytest.mark.parametrize("resting", ["pending", "probed", "done", "failed"])
    def test_resting_rows_untouched(self, project_dir, resting):
        rid = self._add_video(project_dir, resting)

        app = create_app(project_dir)
        with TestClient(app) as tc:
            row = next(v for v in tc.get("/api/videos").json() if v["id"] == rid)
        assert row["status"] == resting


# ---------------------------------------------------------------------------
# Cancel also cleans up the killed run's stuck 'extracting' row
# ---------------------------------------------------------------------------

class TestCancelCleansStuckRow:
    def test_cancel_flips_extracting_row_to_failed(self, project_dir):
        """A cancelled run's row shouldn't be left spinning at 'extracting' until
        the next server restart - the cancel route runs the same cleanup."""
        from yuu_clip.db.models import Video, make_session

        app = create_app(project_dir)
        with TestClient(app) as tc:
            # Add the stuck row AFTER startup so it's the cancel route (not the
            # startup reconciliation) that flips it.
            session = make_session(project_dir / ".yuu-clip" / "project.db")
            v = Video(path=str(project_dir / "stuck.mkv"), filename="stuck.mkv",
                      status="extracting", duration_ms=1000)
            session.add(v)
            session.commit()
            vid = v.id
            session.close()

            assert tc.post("/api/analyze/cancel").status_code == 200
            row = next(x for x in tc.get("/api/videos").json() if x["id"] == vid)
        assert row["status"] == "failed"


# ---------------------------------------------------------------------------
# Heavy DB/GPU jobs are refused while an analysis is in flight
# ---------------------------------------------------------------------------

class _RunningJob:
    done = False
    filename = "running.mkv"
    video_id = 1


class TestRejectWhileAnalyzing:
    def test_reject_helper_only_fires_while_in_flight(self):
        from fastapi import HTTPException

        from yuu_clip.web.routes.common import reject_if_analyzing

        class _Ctx:
            analyze_job = None
            analyze_proc = None

        ctx = _Ctx()
        reject_if_analyzing(ctx)  # idle → no raise

        ctx.analyze_job = _RunningJob()
        with pytest.raises(HTTPException) as exc:
            reject_if_analyzing(ctx)
        assert exc.value.status_code == 409

    def test_score_all_rejected(self, project_dir):
        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_job = _RunningJob()
            assert tc.post("/api/score").status_code == 409

    def test_rescore_clips_rejected(self, project_dir):
        app = create_app(project_dir)
        with TestClient(app) as tc:
            vid = tc.get("/api/videos").json()[0]["id"]
            app.state.ctx.analyze_job = _RunningJob()
            assert tc.get(f"/api/videos/{vid}/rescore-clips").status_code == 409

    def test_rediarize_rejected(self, project_dir):
        app = create_app(project_dir)
        with TestClient(app) as tc:
            vid = tc.get("/api/videos").json()[0]["id"]
            app.state.ctx.analyze_job = _RunningJob()
            assert tc.get(f"/api/videos/{vid}/rediarize").status_code == 409
