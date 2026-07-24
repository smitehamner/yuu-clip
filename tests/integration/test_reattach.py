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


def _log_texts(payloads: list) -> list[str]:
    """The text of every typed ``log`` event, for prose assertions."""
    return [p["text"] for p in payloads if isinstance(p, dict) and p.get("type") == "log"]


def _done_outcomes(payloads: list) -> list[str]:
    """The outcome of every terminal ``done`` event (expect exactly one)."""
    return [p["outcome"] for p in payloads if isinstance(p, dict) and p.get("type") == "done"]


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
        assert "alpha" in _log_texts(replay)
        assert "beta" in _log_texts(replay)
        assert _done_outcomes(replay) == ["ok"]

    def test_replay_trims_a_long_buffer_to_the_latest_marker_per_stage_plus_a_tail(self):
        # A reconnect shouldn't replay the whole buffer - just enough to restore the
        # step pills (the latest progress event per stage, however far back it was
        # emitted) plus a small tail of ordinary events for scrollback.
        from yuu_clip.pipeline.progress import Stage
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES, _replay_events
        from yuu_clip.web.jobevents import log_payload, progress_payload

        extract_evt = progress_payload(Stage.EXTRACT, done=1, total=1)
        transcribe_evt = progress_payload(Stage.TRANSCRIBE, done=3, total=10)
        buffer = [log_payload("noise 0"), extract_evt]
        buffer += [log_payload(f"noise {i}") for i in range(1, 20)]
        buffer.append(transcribe_evt)
        buffer += [log_payload(f"tail {i}") for i in range(_REPLAY_TAIL_LINES - 1)]

        replay = _replay_events(buffer)

        assert len(replay) < len(buffer)
        # The stale extract progress event survives outside the tail window (pill
        # state), but the plain noise events around it are dropped.
        assert extract_evt in replay
        assert log_payload("noise 5") not in replay
        # Everything inside the tail window - including the more recent transcribe
        # progress event - is kept verbatim.
        assert replay[-_REPLAY_TAIL_LINES:] == buffer[-_REPLAY_TAIL_LINES:]

    def test_emit_caps_buffer_to_most_recent_lines(self, tmp_path):
        # An unbounded buffer makes the reconnect replay so large the browser's
        # fetch reader can throw mid-stream; _emit keeps only the most recent lines.
        from yuu_clip.web.analyze_job import _MAX_BUFFER_LINES
        from yuu_clip.web.jobevents import log_payload

        job = AnalyzeJob(["noop"], tmp_path, filename="rec.mkv")
        total = _MAX_BUFFER_LINES + 250
        for i in range(total):
            job._emit(log_payload(f"line {i}"))
        assert len(job.buffer) == _MAX_BUFFER_LINES
        assert job.buffer[0] == log_payload(f"line {total - _MAX_BUFFER_LINES}")
        assert job.buffer[-1] == log_payload(f"line {total - 1}")

    def test_pump_translates_a_progress_marker_into_a_progress_event(self, tmp_path):
        # Symmetric with subprocess_sse: an @@PROGRESS marker on the child's stdout
        # becomes a typed progress event in the buffer (never also a log twin), so a
        # reconnect restores the pills by field access.
        from yuu_clip.pipeline.progress import Stage, format_progress

        marker = format_progress(Stage.SCORE, done=2, total=5)

        async def drive():
            job = AnalyzeJob(
                [sys.executable, "-u", "-c", f"print('scoring'); print({marker!r})"], tmp_path,
            )
            await job.start()
            return _payloads(await _consume(job))

        payloads = asyncio.run(drive())
        assert {"v": 1, "type": "progress", "stage": "score", "done": 2, "total": 5} in payloads
        assert "scoring" in _log_texts(payloads)
        assert not any(t.startswith("@@PROGRESS") for t in _log_texts(payloads))

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
            assert {"one", "two", "three"} <= set(_log_texts(stream))
            assert _done_outcomes(stream) == ["ok"]

    def test_cancel_ends_with_a_cancelled_done_event(self, tmp_path):
        # A user cancel is now first-class: the terminal event is done{cancelled},
        # no longer a prose "[Analysis cancelled]" line + a success sentinel.
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
                if any(evt.get("type") == "log" and "started" in evt.get("text", "") for evt in job.buffer):
                    break
                await asyncio.sleep(0.05)
            await job.cancel()
            await asyncio.wait_for(consumer, timeout=15)
            return _payloads(collected)

        payloads = asyncio.run(drive())
        assert _done_outcomes(payloads) == ["cancelled"]
        # A cancel is not a failure: no error done, no error log line.
        assert not any(isinstance(p, dict) and p.get("level") == "error" for p in payloads)

    def test_mid_run_subscriber_replays_buffer_then_gets_live_lines_exactly_once(self, tmp_path):
        # The replay/subscribe atomicity: a client attaching WHILE the job is live
        # must replay the already-buffered lines, then receive subsequent live lines,
        # with every line delivered exactly once (never both replayed and queued).
        # Driven without a real subprocess so the interleave is deterministic.
        from yuu_clip.web.analyze_job import _QUEUE_DONE
        from yuu_clip.web.jobevents import log_payload

        async def drive():
            job = AnalyzeJob(["noop"], tmp_path)
            job._emit(log_payload("before-1"))
            job._emit(log_payload("before-2"))
            stream = job._stream()
            replayed = [await stream.__anext__(), await stream.__anext__()]
            job._emit(log_payload("live-1"))   # emitted only after the subscriber attached
            live = await stream.__anext__()
            job.done = True
            for queue in job.subscribers:
                queue.put_nowait(_QUEUE_DONE)
            done = await stream.__anext__()
            await stream.aclose()
            return _payloads(replayed), _payloads([live]), _payloads([done])

        replay, live, done = asyncio.run(drive())
        assert _log_texts(replay) == ["before-1", "before-2"]
        assert _log_texts(live) == ["live-1"]
        assert _done_outcomes(done) == ["ok"]

    def test_subscriber_attaching_after_done_is_never_registered(self, tmp_path):
        # The already_done fast path: a client attaching after the job finished gets
        # the buffer + __DONE__ and must NOT be added to subscribers (the pump has
        # already fanned out _QUEUE_DONE, so it would never be signalled and would
        # leak).
        from yuu_clip.web.jobevents import log_payload

        async def drive():
            job = AnalyzeJob(["noop"], tmp_path)
            job._emit(log_payload("only-line"))
            job.done = True
            chunks = [chunk async for chunk in job._stream()]
            return _payloads(chunks), len(job.subscribers)

        payloads, remaining = asyncio.run(drive())
        assert _log_texts(payloads) == ["only-line"]
        assert _done_outcomes(payloads) == ["ok"]
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

        from yuu_clip.web.routes.common import reject_if_busy

        class _Ctx:
            analyze_cmd = None
            analyze_job = None
            analyze_proc = None
            active_jobs = 0
            proxy_generating: set = set()

        ctx = _Ctx()
        reject_if_busy(ctx, "Scoring")  # idle → no raise

        # Any of the three busy signals must trip the guard.
        ctx.analyze_job = _RunningJob()
        with pytest.raises(HTTPException) as exc:
            reject_if_busy(ctx, "Scoring")
        assert exc.value.status_code == 409

        ctx.analyze_job = None
        ctx.active_jobs = 1
        with pytest.raises(HTTPException) as exc:
            reject_if_busy(ctx, "Scoring")
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

    # The uniform busy policy: every long op 409s while ANY job is counted in
    # active_jobs (not only while an analyze subprocess is in flight).
    @pytest.mark.parametrize("method,path", [
        ("post", "/api/score"),
        ("get",  "/api/videos/{vid}/rescore-clips"),
        ("get",  "/api/videos/{vid}/timeline"),
        ("get",  "/api/videos/{vid}/regenerate-summary"),
        ("get",  "/api/videos/{vid}/infer-speaker-names"),
        ("post", "/api/videos/{vid}/summarize"),
        ("get",  "/api/clips/1/rescore"),
        ("get",  "/api/clips/1/related-clips"),
        ("post", "/api/clips/1/analyze-frames"),
        ("get",  "/api/clips/1/export"),
    ])
    def test_long_op_rejected_when_any_job_running(self, project_dir, method, path):
        app = create_app(project_dir)
        with TestClient(app) as tc:
            vid = tc.get("/api/videos").json()[0]["id"]
            app.state.ctx.active_jobs = 1  # a non-analyze job is in flight
            resp = getattr(tc, method)(path.format(vid=vid))
            assert resp.status_code == 409, f"{method} {path}: {resp.status_code}"

    def test_analyze_start_rejected_when_any_job_running(self, project_dir):
        app = create_app(project_dir)
        with TestClient(app) as tc:
            vid = tc.get("/api/videos").json()[0]["id"]
            app.state.ctx.active_jobs = 1
            resp = tc.post("/api/analyze/start", json={"video_id": vid})
            assert resp.status_code == 409

    def test_status_any_running_reflects_active_jobs(self, project_dir):
        app = create_app(project_dir)
        with TestClient(app) as tc:
            base = tc.get("/api/status").json()
            assert base["any_running"] is False and base["active_jobs"] == 0
            app.state.ctx.active_jobs = 1  # a counted job, not an analyze subprocess
            busy = tc.get("/api/status").json()
            assert busy["any_running"] is True
            assert busy["analyze_running"] is False
            assert busy["active_jobs"] == 1
