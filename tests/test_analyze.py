from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# Estimate
# ---------------------------------------------------------------------------

class TestEstimate:
    _BASE = dict(duration_s=3600, model="medium", audio_tracks=2, has_gpu=True, scene_mode="fast")

    def test_estimate_returns_steps(self, client):
        r = client.post("/api/estimate", json=self._BASE)
        assert r.status_code == 200
        d = r.json()
        assert "steps" in d
        assert "total_hms" in d
        assert len(d["steps"]) >= 1
        for step in d["steps"]:
            assert "name" in step
            assert "seconds" in step
            assert "hms" in step

    def test_estimate_gpu_faster_than_cpu(self, client):
        payload = dict(duration_s=3600, model="large-v3", audio_tracks=1, scene_mode="fast")
        gpu = client.post("/api/estimate", json={**payload, "has_gpu": True}).json()
        cpu = client.post("/api/estimate", json={**payload, "has_gpu": False}).json()
        assert gpu["total_seconds"] < cpu["total_seconds"]

    def test_estimate_returns_pct_of_video(self, client):
        d = client.post("/api/estimate", json=self._BASE).json()
        assert "pct_of_video" in d
        assert isinstance(d["pct_of_video"], (int, float))
        assert 0 < d["pct_of_video"] < 200

    def test_estimate_pct_matches_total(self, client):
        d = client.post("/api/estimate", json=self._BASE).json()
        expected = round(d["total_seconds"] / self._BASE["duration_s"] * 100, 1)
        assert abs(d["pct_of_video"] - expected) < 0.5

    def test_estimate_energy_none_cheapest(self, client):
        none_s = client.post("/api/estimate", json={**self._BASE, "energy_mode": "none"}).json()["total_seconds"]
        fast_s = client.post("/api/estimate", json={**self._BASE, "energy_mode": "fast"}).json()["total_seconds"]
        full_s = client.post("/api/estimate", json={**self._BASE, "energy_mode": "full"}).json()["total_seconds"]
        assert none_s < fast_s < full_s

    def test_estimate_energy_step_name_reflects_mode(self, client):
        for mode in ("none", "fast", "full"):
            d = client.post("/api/estimate", json={**self._BASE, "energy_mode": mode}).json()
            energy_step = next(s for s in d["steps"] if "energy" in s["name"].lower())
            assert mode in energy_step["name"]

    def test_estimate_omits_speaker_labels_by_default(self, client):
        d = client.post("/api/estimate", json=self._BASE).json()
        assert not any("Speaker labels" in s["name"] for s in d["steps"])

    def test_estimate_includes_speaker_labels_when_diarize(self, client):
        d = client.post("/api/estimate", json={**self._BASE, "diarize": True}).json()
        assert any("Speaker labels" in s["name"] for s in d["steps"])

    def test_estimate_speaker_labels_increase_total(self, client):
        off = client.post("/api/estimate", json=self._BASE).json()["total_seconds"]
        on  = client.post("/api/estimate", json={**self._BASE, "diarize": True}).json()["total_seconds"]
        assert on > off

    def test_estimate_no_speaker_labels_without_transcription(self, client):
        # External captions => 0 transcribed tracks => nothing to attach speakers to.
        d = client.post("/api/estimate", json={**self._BASE, "diarize": True, "transcribe_tracks": 0}).json()
        assert not any("Speaker labels" in s["name"] for s in d["steps"])


# ---------------------------------------------------------------------------
# Ingest start
# ---------------------------------------------------------------------------

class TestIngestStart:
    @pytest.fixture()
    def video_path(self, project_dir):
        p = project_dir / "session.mkv"
        p.write_bytes(b"fake")
        return p

    def test_missing_file_returns_400(self, client):
        r = client.post("/api/analyze/start", json={"path": "/nonexistent/video.mkv", "model": "medium"})
        assert r.status_code == 400

    def test_invalid_model_returns_400(self, client, video_path):
        r = client.post("/api/analyze/start", json={"path": str(video_path), "model": "gpt-vision"})
        assert r.status_code == 400

    def test_valid_request_with_energy_mode(self, client, video_path):
        r = client.post("/api/analyze/start", json={
            "path": str(video_path),
            "model": "medium",
            "energy_mode": "none",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "started"

    def test_all_energy_modes_accepted(self, client, video_path):
        for mode in ("none", "fast", "full"):
            r = client.post("/api/analyze/start", json={
                "path": str(video_path),
                "model": "medium",
                "energy_mode": mode,
            })
            assert r.status_code == 200, f"energy_mode={mode!r} was rejected"

    def test_no_score_flag_added_to_cmd(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium", "no_score": True,
            })
            assert "--no-score" in app.state.ctx.analyze_cmd

    def test_profile_flag_added_to_cmd(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium", "profile": "my_layout",
            })
            cmd = app.state.ctx.analyze_cmd
            assert "--track-layout" in cmd
            assert "my_layout" in cmd

    def test_subtitle_source_flag_added_to_cmd(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium", "subtitle_source": "stream:0",
            })
            cmd = app.state.ctx.analyze_cmd
            assert "--subtitle-source" in cmd
            assert "stream:0" in cmd

    def test_context_names_added_to_cmd(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium",
                "context_names": ["ctx_alpha", "ctx_beta"],
            })
            cmd = app.state.ctx.analyze_cmd
            assert cmd.count("--context") == 2
            assert "ctx_alpha" in cmd
            assert "ctx_beta" in cmd

    def test_empty_path_without_video_id_returns_400(self, client):
        r = client.post("/api/analyze/start", json={"path": "", "model": "medium"})
        assert r.status_code == 400

    def test_diarize_true_adds_flag(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium", "diarize": True,
            })
            cmd = app.state.ctx.analyze_cmd
            assert "--diarize" in cmd
            assert "--no-diarize" not in cmd

    def test_diarize_false_adds_no_diarize_flag(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium", "diarize": False,
            })
            cmd = app.state.ctx.analyze_cmd
            assert "--no-diarize" in cmd

    def test_diarize_omitted_adds_no_flag(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium",
            })
            cmd = app.state.ctx.analyze_cmd
            assert "--diarize" not in cmd
            assert "--no-diarize" not in cmd


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

class TestLogs:
    def test_log_export_filename_contains_date(self, client):
        import re
        r = client.get("/api/logs/export")
        assert r.status_code == 200
        disposition = r.headers.get("content-disposition", "")
        assert "yuu-clip-" in disposition
        assert ".log" in disposition
        # Filename must contain an ISO date (YYYY-MM-DD) — exact value is not asserted
        # to avoid a midnight-boundary race where test and server disagree on the date.
        assert re.search(r"\d{4}-\d{2}-\d{2}", disposition)

    def test_log_export_returns_text(self, client):
        r = client.get("/api/logs/export")
        assert r.status_code == 200
        assert "text" in r.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Optional-package install status
# ---------------------------------------------------------------------------

class TestInstallStatus:
    def test_unknown_slug_returns_400(self, client):
        r = client.get("/api/install/not-a-package")
        assert r.status_code == 400

    def test_reports_installed_for_present_package(self, client):
        # 'anthropic' detects the importable 'anthropic' module; patch find_spec
        # so the test does not depend on whether the dep is actually installed.
        from unittest.mock import patch

        with patch("yuu_clip.web.routes.analyze.importlib.util.find_spec", return_value=object()):
            r = client.get("/api/install/anthropic")
        assert r.status_code == 200
        assert r.json() == {"installed": True}

    def test_reports_not_installed_when_module_absent(self, client):
        from unittest.mock import patch

        with patch("yuu_clip.web.routes.analyze.importlib.util.find_spec", return_value=None):
            r = client.get("/api/install/pyannote")
        assert r.status_code == 200
        assert r.json() == {"installed": False}

    def test_multi_module_slug_requires_all_present(self, client):
        # laugh-deps needs four modules; a single missing one means not installed.
        from unittest.mock import patch

        def only_torch_missing(module):
            return None if module == "torch" else object()

        with patch("yuu_clip.web.routes.analyze.importlib.util.find_spec", side_effect=only_torch_missing):
            r = client.get("/api/install/laugh-deps")
        assert r.json() == {"installed": False}


# ---------------------------------------------------------------------------
# Glossary
# ---------------------------------------------------------------------------

class TestGlossary:
    def test_glossary_served_from_bundled_static(self, client):
        # The bundled copy must load (the dev docs/ tree is not in the wheel).
        r = client.get("/api/glossary")
        assert r.status_code == 200
        assert "text" in r.headers.get("content-type", "")
        assert "### Recording" in r.text

    def test_glossary_has_no_dev_only_content(self, client):
        # The user-facing copy must not leak the dev glossary's scaffolding.
        body = client.get("/api/glossary").text
        for dev_marker in ("**Code:**", "Do not call it:", "Internal / Dev-Only Terms"):
            assert dev_marker not in body


# ---------------------------------------------------------------------------
# Probe (file not found case — no real video needed)
# ---------------------------------------------------------------------------

class TestProbe:
    def test_probe_missing_file_returns_400(self, client):
        r = client.post("/api/probe", json={"path": "/nonexistent/file.mkv"})
        assert r.status_code == 400

    def test_probe_timeout_raises_runtime_error(self, tmp_path):
        """A stuck ffprobe must surface a clear timeout error, not hang the run."""
        import subprocess
        from unittest.mock import patch

        from yuu_clip.analyze.probe import probe_video

        video = tmp_path / "stuck.mkv"
        video.write_bytes(b"fake")

        def hang(cmd, **kwargs):
            raise subprocess.TimeoutExpired(cmd, kwargs.get("timeout", 0))

        with patch("yuu_clip.analyze.probe.subprocess.run", side_effect=hang), \
             patch("yuu_clip.analyze.probe.find_ffmpeg", return_value=("ffmpeg", "ffprobe")):
            with pytest.raises(RuntimeError, match="timed out"):
                probe_video(video)

    def test_probe_failure_surfaces_ffprobe_stderr(self, tmp_path):
        """ffprobe must run at a loglevel that emits errors, so failures are diagnosable.

        With -v quiet, ffprobe suppresses its own error output and the RuntimeError
        message is blank. The cmd must request errors (and the message must carry them).
        """
        from unittest.mock import MagicMock, patch

        from yuu_clip.analyze.probe import probe_video

        video = tmp_path / "broken.mkv"
        video.write_bytes(b"not a real video")

        captured = {}

        def failing_run(cmd, **kwargs):
            captured["cmd"] = cmd
            r = MagicMock()
            r.returncode = 1
            r.stderr = "broken.mkv: Invalid data found when processing input"
            return r

        with patch("yuu_clip.analyze.probe.subprocess.run", side_effect=failing_run), \
             patch("yuu_clip.analyze.probe.find_ffmpeg", return_value=("ffmpeg", "ffprobe")):
            with pytest.raises(RuntimeError, match="Invalid data found") as exc:
                probe_video(video)

        assert "quiet" not in captured["cmd"]
        loglevel = captured["cmd"][captured["cmd"].index("-v") + 1]
        assert loglevel == "error"
        assert "Invalid data found" in str(exc.value)


# ---------------------------------------------------------------------------
# Scoring isolation — a scoring crash must not abort the analyze run or
# discard the clips that were already generated and committed.
# ---------------------------------------------------------------------------

class TestScoringIsolation:
    def test_scoring_failure_keeps_clips_and_marks_processed(self, tmp_path):
        from unittest.mock import patch

        from yuu_clip.cli import _pipeline
        from yuu_clip.cli._base import AnalyzeOptions
        from yuu_clip.db.models import ClipCandidate, Video, make_session

        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="probed", duration_ms=60_000)
        session.add(video)
        session.flush()
        session.add(ClipCandidate(video_id=video.id, start_ms=0, end_ms=10_000, status="pending"))
        session.commit()
        video_id = video.id

        def boom(*a, **k):
            raise RuntimeError("LLM endpoint unreachable")

        with patch.object(_pipeline, "_resolve_existing_video", return_value=(tmp_path / "s.mkv", video)), \
             patch.object(_pipeline, "_probe_video", return_value=object()), \
             patch.object(_pipeline, "_upsert_video_and_tracks", return_value=(video, [])), \
             patch.object(_pipeline, "_extract_audio_and_check_rms_overlap", return_value=None), \
             patch.object(_pipeline, "_obtain_transcripts", return_value=[]), \
             patch.object(_pipeline, "_generate_candidates", return_value=[object()]), \
             patch.object(_pipeline, "_summarize_video", return_value=None), \
             patch.object(_pipeline, "_run_scoring", side_effect=boom):
            # Must not raise — a per-video scoring crash cannot abort the batch.
            _pipeline._analyze_one(tmp_path / "s.mkv", session, object(), tmp_path, AnalyzeOptions())

        session.close()
        verify = make_session(tmp_path / "project.db")
        reloaded = verify.get(Video, video_id)
        assert reloaded.processed_at is not None          # run completed
        assert reloaded.clips_scored_at is None            # left visibly unscored
        assert verify.query(ClipCandidate).filter_by(video_id=video_id).count() == 1  # clips preserved
        verify.close()


# ---------------------------------------------------------------------------
# Process-tree termination — cancel must kill ffmpeg grandchildren, not orphan them
# ---------------------------------------------------------------------------

class TestTerminateProcessTree:
    class _FakeProc:
        def __init__(self, returncode=None):
            self.pid = 4321
            self.returncode = returncode
            self.terminated = False

        def terminate(self):
            self.terminated = True

    def test_windows_kills_whole_tree_via_taskkill(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "win32"), \
             patch.object(sse.subprocess, "run") as run:
            sse.terminate_process_tree(proc)

        run.assert_called_once()
        argv = run.call_args.args[0]
        assert argv[0] == "taskkill"
        assert "/T" in argv and str(proc.pid) in argv
        assert not proc.terminated  # tree-kill used, not the plain signal

    def test_posix_falls_back_to_terminate(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "linux"):
            sse.terminate_process_tree(proc)
        assert proc.terminated

    def test_noop_when_already_exited(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc(returncode=0)
        with patch.object(sse.subprocess, "run") as run:
            sse.terminate_process_tree(proc)
        run.assert_not_called()
        assert not proc.terminated


# ---------------------------------------------------------------------------
# DB session cleanup — proves no connection lingers after route handlers
# ---------------------------------------------------------------------------

class TestDbSessionCleanup:
    def test_db_writable_after_list_videos(self, client, project_dir):
        """After GET /api/videos the DB must accept writes (no held lock)."""
        client.get("/api/videos")
        client.get("/api/videos")

        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = Video(
                path=str(project_dir / "new_video.mkv"),
                filename="new_video.mkv",
                status="pending",
                duration_ms=30_000,
            )
            session.add(v)
            session.commit()  # raises OperationalError if lock is still held
        finally:
            session.close()

        videos = client.get("/api/videos").json()
        assert any(v["filename"] == "new_video.mkv" for v in videos)

    def test_db_writable_after_clip_status_update(self, client, project_dir):
        """After POST /api/clips/{id}/status the DB must accept writes."""
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        client.post(f"/api/clips/{clip_id}/status", json={"status": "approved"})

        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = Video(
                path=str(project_dir / "another_video.mkv"),
                filename="another_video.mkv",
                status="pending",
                duration_ms=30_000,
            )
            session.add(v)
            session.commit()
        finally:
            session.close()

        videos = client.get("/api/videos").json()
        assert any(v["filename"] == "another_video.mkv" for v in videos)

    def test_many_concurrent_reads_leave_no_lock(self, client, project_dir):
        """Repeated reads from multiple endpoints must not accumulate held locks."""
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        for clip in clips:
            client.get(f"/api/clips/{clip['id']}")
            client.get(f"/api/clips/{clip['id']}/media_url")

        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = Video(
                path=str(project_dir / "third_video.mkv"),
                filename="third_video.mkv",
                status="pending",
                duration_ms=30_000,
            )
            session.add(v)
            session.commit()
        finally:
            session.close()

        videos = client.get("/api/videos").json()
        assert any(v["filename"] == "third_video.mkv" for v in videos)


# ---------------------------------------------------------------------------
# Graceful shutdown — lifespan terminates running analyze subprocess
# ---------------------------------------------------------------------------

class TestGracefulShutdown:
    def test_shutdown_terminates_running_analyze(self, project_dir):
        """When the server exits, a running analyze_proc (and its ffmpeg tree) must be killed."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from fastapi.testclient import TestClient

        from yuu_clip.web import sse
        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = None          # still running
        mock_proc.pid = 99999
        mock_proc.wait = AsyncMock(return_value=0)

        with patch.object(sse.sys, "platform", "win32"), \
             patch.object(sse.subprocess, "run") as run:
            with TestClient(app) as _:
                app.state.ctx.analyze_proc = mock_proc

        argv = run.call_args.args[0]
        assert argv[0] == "taskkill" and "/T" in argv and str(mock_proc.pid) in argv

    def test_shutdown_noop_when_no_analyze_running(self, project_dir):
        """Server shutdown must not raise when there is no active subprocess."""
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app):
            pass  # just verify it exits cleanly

    def test_shutdown_noop_when_analyze_already_finished(self, project_dir):
        """Server shutdown must not call terminate on a process that already exited."""
        from unittest.mock import MagicMock

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = 0  # already exited

        with TestClient(app) as _:
            app.state.ctx.analyze_proc = mock_proc

        mock_proc.terminate.assert_not_called()


# ---------------------------------------------------------------------------
# Analyze cancel — no-op when nothing running
# ---------------------------------------------------------------------------

class TestAnalyzeCancel:
    def test_cancel_when_nothing_running_returns_ok(self, client):
        r = client.post("/api/analyze/cancel")
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_analyze_status_false_when_idle(self, client):
        r = client.get("/api/analyze/status")
        assert r.status_code == 200
        assert r.json()["running"] is False


# ---------------------------------------------------------------------------
# Summarize — 400 when no transcript
# ---------------------------------------------------------------------------

class TestSummarize:
    def test_summarize_returns_400_without_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/summarize")
        assert r.status_code == 400

    def test_summarize_404_for_missing_video(self, client):
        r = client.post("/api/videos/99999/summarize")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Server status
# ---------------------------------------------------------------------------

class TestStatus:
    def test_status_idle(self, client):
        r = client.get("/api/status")
        assert r.status_code == 200
        d = r.json()
        assert d["any_running"] is False
        assert d["analyze_running"] is False
        assert d["active_jobs"] == 0
        assert "version" in d

    def test_status_reflects_running_analyze(self, project_dir):
        from unittest.mock import AsyncMock, MagicMock

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = None  # still running
        mock_proc.pid = 99999
        mock_proc.wait = AsyncMock(return_value=0)
        with TestClient(app) as tc:
            app.state.ctx.analyze_proc = mock_proc
            r = tc.get("/api/status")
        assert r.json()["analyze_running"] is True
        assert r.json()["any_running"] is True


# ---------------------------------------------------------------------------
# Rescore-clips SSE — 404 guard
# ---------------------------------------------------------------------------

class TestRescoreClipsSSE:
    def test_rescore_clips_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/rescore-clips")
        assert r.status_code == 404

    def test_rescore_failed_clips_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/rescore-failed-clips")
        assert r.status_code == 404


def _add_failed_clip(project_dir, video_id: int) -> int:
    """Seed one extra clip carrying the llm_error tag and return its id."""
    from yuu_clip.db.models import ClipCandidate, make_session

    session = make_session(project_dir / ".yuu-clip" / "project.db")
    clip = ClipCandidate(
        video_id=video_id, start_ms=500_000, end_ms=560_000,
        score_overall=0.0, description="failed clip",
    )
    clip.tags = ["llm_error"]
    session.add(clip)
    session.commit()
    clip_id = clip.id
    session.close()
    return clip_id


class TestLLMErrorBadge:
    """Derived clips_llm_error count surfaces failed-scoring clips per video."""

    def test_count_zero_when_no_failures(self, client):
        videos = client.get("/api/videos").json()
        assert videos[0]["clips_llm_error"] == 0

    def test_count_reflects_tagged_clips(self, client, project_dir):
        video_id = client.get("/api/videos").json()[0]["id"]
        _add_failed_clip(project_dir, video_id)
        _add_failed_clip(project_dir, video_id)
        video = next(v for v in client.get("/api/videos").json() if v["id"] == video_id)
        assert video["clips_llm_error"] == 2


class TestRescoreFailedSelection:
    """rescore-failed-clips scores only the clips tagged llm_error."""

    def test_targets_only_failed_clips(self, client, project_dir, monkeypatch):
        from yuu_clip.scoring.engine import ScoringEngine

        monkeypatch.setattr(ScoringEngine, "score_clip", lambda self, clip, session: None)

        video_id = client.get("/api/videos").json()[0]["id"]
        _add_failed_clip(project_dir, video_id)  # 1 failed clip among 4 total

        body = client.get(f"/api/videos/{video_id}/rescore-failed-clips").text
        assert "Starting LLM scoring for 1 clip" in body
        assert "Scored 1/1 clips" in body
        assert "__DONE__" in body


# ---------------------------------------------------------------------------
# Timeline endpoint guard
# ---------------------------------------------------------------------------

class TestTimelineEndpointGuard:
    """stream_timeline returns 400 when no transcript exists."""

    def test_timeline_400_without_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/timeline")
        assert r.status_code == 400

    def test_timeline_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/timeline")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# SSE guards
# ---------------------------------------------------------------------------

class TestSseGuards:
    """Cover 400 guards on SSE event endpoints when no job has been queued."""

    def test_analyze_events_without_start_returns_400(self, client):
        r = client.get("/api/analyze/events")
        assert r.status_code == 400

    def test_demo_events_without_start_returns_400(self, client):
        r = client.get("/api/demo/events")
        assert r.status_code == 400


class TestSseCommandCleared:
    """analyze_cmd and demo_cmd are cleared after the subprocess SSE stream finishes."""

    def test_analyze_cmd_cleared_after_events_stream(self, project_dir):
        """After analyze_events runs to completion, ctx.analyze_cmd must be None."""
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        # Queue a trivial command that exits immediately
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "print('done')"]
            # Consume the stream fully so the generator's finally block runs
            with tc.stream("GET", "/api/analyze/events") as resp:
                list(resp.iter_lines())
            assert ctx.analyze_cmd is None

    def test_demo_cmd_cleared_after_events_stream(self, project_dir):
        """After demo_events runs to completion, ctx.demo_cmd must be None."""
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.demo_cmd = [sys.executable, "-c", "print('done')"]
            with tc.stream("GET", "/api/demo/events") as resp:
                list(resp.iter_lines())
            assert ctx.demo_cmd is None

    def test_second_call_to_analyze_events_replays_finished_job(self, project_dir):
        """After the stream finishes, a second call to /api/analyze/events must NOT
        re-run the old command — it reattaches to the finished job and replays its
        buffered output (this is what lets a page refresh reconnect)."""
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "print('marker-line')"]
            with tc.stream("GET", "/api/analyze/events") as resp:
                list(resp.iter_lines())
            # Second call — no new command queued: replay the finished job, don't re-run.
            with tc.stream("GET", "/api/analyze/events") as resp:
                lines = list(resp.iter_lines())
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert "marker-line" in data_values
        assert "__DONE__" in data_values

    def test_analyze_events_without_any_job_returns_400(self, project_dir):
        """With neither a queued command nor a prior job, /api/analyze/events is a 400."""
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            assert tc.get("/api/analyze/events").status_code == 400

    def test_score_run_does_not_clear_analyze_cmd(self, project_dir):
        """Running /api/score must not erase a queued analyze_cmd (Bug 2)."""
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        sentinel_cmd = [sys.executable, "-c", "print('sentinel')"]
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = sentinel_cmd
            with tc.stream("GET", "/api/score") as resp:
                list(resp.iter_lines())
            assert ctx.analyze_cmd is sentinel_cmd, "score run must not clear analyze_cmd"

    def test_analyze_cancelled_flag_not_triggered_by_score(self, project_dir):
        """analyze_cancelled=True must not cause score SSE to emit '[Analysis cancelled]' (Bug 1)."""

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cancelled = True  # stale flag from a previous cancel
            with tc.stream("GET", "/api/score") as resp:
                lines = list(resp.iter_lines())
            # Flag must be consumed only by analyze runs — score must leave it or ignore it
            assert "[Analysis cancelled]" not in " ".join(lines)
            # Flag should remain True since score did not consume it
            assert ctx.analyze_cancelled is True


# ---------------------------------------------------------------------------
# SSE output paths — error exit, cancellation message, __DONE__ sentinel
# ---------------------------------------------------------------------------

class TestSseOutputPaths:
    """SSE generator emits the right events for success, error-exit, and cancel."""

    def _stream_lines(self, tc, url):
        with tc.stream("GET", url) as resp:
            return list(resp.iter_lines())

    def test_successful_subprocess_emits_done_sentinel(self, project_dir):
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_cmd = [sys.executable, "-c", "print('hi')"]
            lines = self._stream_lines(tc, "/api/analyze/events")
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert "__DONE__" in data_values

    def test_failed_subprocess_emits_error_and_done(self, project_dir):
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_cmd = [sys.executable, "-c", "raise SystemExit(1)"]
            lines = self._stream_lines(tc, "/api/analyze/events")
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert any("[Error:" in v for v in data_values)
        assert "__DONE__" in data_values

# ---------------------------------------------------------------------------
# Cancel endpoint — state side-effects
# ---------------------------------------------------------------------------

class TestAnalyzeCancelSideEffects:
    def test_cancel_clears_analyze_cmd(self, project_dir):
        """POST /api/analyze/cancel must clear analyze_cmd regardless of proc state."""
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "pass"]
            tc.post("/api/analyze/cancel")
            assert ctx.analyze_cmd is None

    def test_cancel_sets_cancelled_flag_when_proc_running(self, project_dir):
        from unittest.mock import AsyncMock, MagicMock, patch

        from fastapi.testclient import TestClient

        from yuu_clip.web import sse
        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = None
        mock_proc.pid = 12345
        mock_proc.wait = AsyncMock(return_value=0)
        with patch.object(sse.sys, "platform", "win32"), \
             patch.object(sse.subprocess, "run") as run:
            with TestClient(app) as tc:
                ctx = app.state.ctx
                ctx.analyze_proc = mock_proc
                tc.post("/api/analyze/cancel")
                assert ctx.analyze_cancelled is True
                # cancel must kill the whole tree, not orphan the ffmpeg grandchild
                assert any(c.args[0][0] == "taskkill" for c in run.call_args_list)


# ---------------------------------------------------------------------------
# Export validation
# ---------------------------------------------------------------------------

class TestExportValidation:
    def test_invalid_container_returns_400(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        r = client.get(f"/api/clips/{clip_id}/export?container=avi")
        assert r.status_code == 400

    def test_valid_containers_accepted(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        for fmt in ("mkv", "mp4"):
            r = client.get(f"/api/clips/{clip_id}/export?container={fmt}")
            assert r.status_code == 200, f"container={fmt!r} was rejected"

    def test_retranscribe_invalid_model_returns_400(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        r = client.get(f"/api/clips/{clip_id}/export?retranscribe=true&retranscribe_model=gpt-4o")
        assert r.status_code == 400


class TestExportSpeakerLabelsFlag:
    """The export route forwards the speaker-labels choice to the CLI, only with retranscribe."""

    def _capture_cmd(self, client, monkeypatch, query):
        from starlette.responses import PlainTextResponse

        from yuu_clip.web.routes import analyze

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(analyze, "subprocess_sse", fake_sse)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        assert client.get(f"/api/clips/{clip_id}/export?{query}").status_code == 200
        return captured["cmd"]

    def test_speaker_labels_flag_on_retranscribe(self, client, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "retranscribe=true&speaker_labels=true")
        assert "--speaker-labels" in cmd
        assert "--no-speaker-labels" not in cmd

    def test_no_speaker_labels_flag_when_disabled(self, client, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "retranscribe=true&speaker_labels=false")
        assert "--no-speaker-labels" in cmd

    def test_no_speaker_flag_without_retranscribe(self, client, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "retranscribe=false&speaker_labels=true")
        assert "--speaker-labels" not in cmd
        assert "--no-speaker-labels" not in cmd


# ---------------------------------------------------------------------------
# Retranscribe validation
# ---------------------------------------------------------------------------

class TestRetranscribeValidation:
    """retranscribe endpoint rejects unknown Whisper models."""

    def test_retranscribe_invalid_model_returns_400(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        r = client.get(f"/api/clips/{clip_id}/retranscribe?model=gpt-4o")
        assert r.status_code == 400

    def _capture_cmd(self, client, monkeypatch, query):
        from starlette.responses import PlainTextResponse

        from yuu_clip.web.routes import analyze

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(analyze, "subprocess_sse", fake_sse)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        assert client.get(f"/api/clips/{clip_id}/retranscribe?{query}").status_code == 200
        return captured["cmd"]

    def test_speaker_labels_default_on(self, client, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "model=medium")
        assert "--speaker-labels" in cmd

    def test_speaker_labels_can_be_disabled(self, client, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "model=medium&speaker_labels=false")
        assert "--no-speaker-labels" in cmd


# ---------------------------------------------------------------------------
# Version endpoint
# ---------------------------------------------------------------------------

class TestVersionEndpoint:
    def test_version_endpoint_returns_version_string(self, client):
        r = client.get("/api/version")
        assert r.status_code == 200
        assert "version" in r.json()


# ---------------------------------------------------------------------------
# Estimate edge cases
# ---------------------------------------------------------------------------

class TestEstimateEdgeCases:
    """Additional _compute_time_estimate branches not covered by TestEstimate."""

    def test_transcript_scene_mode_cheaper_than_fast(self, client):
        """scene_mode=transcript skips ffmpeg scene detection so it costs less than 'fast'."""
        transcript = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "transcript",
        }).json()
        fast = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "fast",
        }).json()
        assert transcript["total_seconds"] < fast["total_seconds"]

    def test_full_scene_mode_slower_than_fast(self, client):
        fast_result = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "fast",
        }).json()
        full = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "full",
        }).json()
        assert full["total_seconds"] > fast_result["total_seconds"]

    def test_explicit_transcribe_tracks_overrides_default(self, client):
        auto = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "audio_tracks": 4,
            "has_gpu": True, "scene_mode": "fast",
        }).json()
        explicit = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "audio_tracks": 4,
            "transcribe_tracks": 1, "has_gpu": True, "scene_mode": "fast",
        }).json()
        # Fewer transcribe tracks → faster Whisper step → lower total
        assert explicit["total_seconds"] < auto["total_seconds"]

    def test_unknown_model_falls_back_to_default_gpu_speed(self, client):
        """An unrecognised model string should not raise — it falls back to speed=6."""
        # Use the internal function directly to avoid the validate_whisper_model guard
        from yuu_clip.web.routes.analyze import EstimateRequest, _compute_time_estimate
        req = EstimateRequest(duration_s=3600, model="custom:tag", has_gpu=True, scene_mode="fast")
        result = _compute_time_estimate(req)
        assert result["total_seconds"] > 0

    def test_zero_duration_pct_is_zero(self, client):
        """Zero-duration input must not cause a division error."""
        from yuu_clip.web.routes.analyze import EstimateRequest, _compute_time_estimate
        req = EstimateRequest(duration_s=0, model="medium", has_gpu=True, scene_mode="fast")
        result = _compute_time_estimate(req)
        assert result["pct_of_video"] == 0


# ---------------------------------------------------------------------------
# analyze/start with video_id — reanalyze-after-split entry point
# ---------------------------------------------------------------------------

class TestAnalyzeStartWithVideoId:
    def test_video_id_queues_analyze_command(self, project_dir):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as c:
            ctx = app.state.ctx
            vid_id = c.get("/api/videos").json()[0]["id"]
            r = c.post("/api/analyze/start", json={"video_id": vid_id, "model": "tiny"})
            assert r.status_code == 200
            assert ctx.analyze_cmd is not None
            assert "--video-id" in ctx.analyze_cmd
            assert str(vid_id) in ctx.analyze_cmd

    def test_video_id_not_found_returns_404(self, project_dir):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as c:
            r = c.post("/api/analyze/start", json={"video_id": 99999, "model": "tiny"})
            assert r.status_code == 404

    def test_segment_start_end_added_to_cmd(self, project_dir):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as c:
            ctx = app.state.ctx
            # Create a real file so path validation passes
            fake_path = project_dir / "session.mkv"
            fake_path.write_bytes(b"")
            r = c.post("/api/analyze/start", json={
                "path": str(fake_path),
                "model": "tiny",
                "segment_start_s": 10.5,
                "segment_end_s": 120.0,
            })
            assert r.status_code == 200
            assert "--segment-start" in ctx.analyze_cmd
            assert "10.5" in ctx.analyze_cmd
            assert "--segment-end" in ctx.analyze_cmd


# ---------------------------------------------------------------------------
# probe._parse_fps — branch coverage
# ---------------------------------------------------------------------------

class TestParseFps:
    def _parse(self, s):
        from yuu_clip.analyze.probe import _parse_fps
        return _parse_fps(s)

    def test_normal_fraction(self):
        assert abs(self._parse("60000/1001") - 59.94) < 0.01

    def test_plain_integer_fraction(self):
        assert abs(self._parse("30/1") - 30.0) < 1e-9

    def test_plain_float_string(self):
        assert abs(self._parse("29.97") - 29.97) < 1e-9


# ---------------------------------------------------------------------------
# labeler.label_tracks — single-stream auto-label
# ---------------------------------------------------------------------------

class TestLabelTracksSingleStream:
    def _make_video_info(self, n_streams=1):
        from unittest.mock import MagicMock
        info = MagicMock()
        info.audio_streams = [
            _make_mock_stream(i, f"Track {i}")
            for i in range(n_streams)
        ]
        return info

    def test_single_stream_auto_labeled_combined(self):
        from yuu_clip.analyze.labeler import label_tracks
        info = self._make_video_info(n_streams=1)
        result = label_tracks(info)
        assert len(result) == 1
        assert result[0]["label"] == "combined"
        assert result[0]["do_transcribe"] is True
        assert result[0]["do_score"] is True


def _make_mock_stream(stream_index: int, title: str | None = None):
    from unittest.mock import MagicMock
    s = MagicMock()
    s.stream_index = stream_index
    s.title_tag = title
    return s


# ---------------------------------------------------------------------------
# labeler._label_non_interactive — profile and fallback paths
# ---------------------------------------------------------------------------

class TestLabelNonInteractive:
    def _streams(self, n):
        return [_make_mock_stream(i) for i in range(n)]

    def test_no_profile_defaults_track0_combined(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        result = _label_non_interactive(self._streams(3), profile_name=None)
        assert result[0]["label"] == "combined"
        assert result[0]["do_transcribe"] is True
        for r in result[1:]:
            assert r["label"] == "unlabeled"
            assert r["do_transcribe"] is False
            assert r["do_score"] is False

    def test_default_sentinel_skips_profile_lookup(self):
        from unittest.mock import patch

        from yuu_clip.analyze.labeler import _label_non_interactive
        with patch("yuu_clip.analyze.labeler.load_profiles") as mock_lp:
            mock_lp.return_value = {"__default__": {}}
            result = _label_non_interactive(self._streams(2), profile_name="__default__")
        # __default__ must not be applied — falls back to track 0 as combined
        assert result[0]["label"] == "combined"
        mock_lp.assert_not_called()

    def test_profile_applied_when_track_count_matches(self):
        from unittest.mock import patch

        from yuu_clip.analyze.labeler import _label_non_interactive
        profile = {
            "my_layout": {
                "num_tracks": 2,
                "assignments": [
                    {"stream_position": 0, "label": "player_voice", "do_transcribe": True, "do_score": True},
                    {"stream_position": 1, "label": "combined",     "do_transcribe": True, "do_score": True},
                ],
            }
        }
        with patch("yuu_clip.analyze.labeler.load_profiles", return_value=profile):
            result = _label_non_interactive(self._streams(2), profile_name="my_layout")
        assert result[0]["label"] == "player_voice"
        assert result[1]["label"] == "combined"

    def test_profile_mismatch_falls_back_to_default(self):
        from unittest.mock import patch

        from yuu_clip.analyze.labeler import _label_non_interactive
        profile = {
            "my_layout": {
                "num_tracks": 5,  # wrong count
                "assignments": [],
            }
        }
        with patch("yuu_clip.analyze.labeler.load_profiles", return_value=profile):
            result = _label_non_interactive(self._streams(2), profile_name="my_layout")
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"


# ---------------------------------------------------------------------------
# labeler._apply_profile
# ---------------------------------------------------------------------------

class TestApplyProfile:
    def _streams(self, n):
        return [_make_mock_stream(i) for i in range(n)]

    def _profile_data(self, n_tracks):
        return {
            "test_layout": {
                "num_tracks": n_tracks,
                "assignments": [
                    {"stream_position": i, "label": "combined", "do_transcribe": True, "do_score": True}
                    for i in range(n_tracks)
                ],
            }
        }

    def test_unknown_name_returns_none(self):
        from unittest.mock import patch

        from yuu_clip.analyze.labeler import _apply_profile
        with patch("yuu_clip.analyze.labeler.load_profiles", return_value={}):
            assert _apply_profile("nonexistent", self._streams(2)) is None

    def test_track_count_mismatch_returns_none(self):
        from unittest.mock import patch

        from yuu_clip.analyze.labeler import _apply_profile
        with patch("yuu_clip.analyze.labeler.load_profiles", return_value=self._profile_data(3)):
            assert _apply_profile("test_layout", self._streams(2)) is None

    def test_matching_profile_returns_assignments(self):
        from unittest.mock import patch

        from yuu_clip.analyze.labeler import _apply_profile
        with patch("yuu_clip.analyze.labeler.load_profiles", return_value=self._profile_data(2)):
            result = _apply_profile("test_layout", self._streams(2))
        assert result is not None
        assert len(result) == 2
        assert all(r["label"] == "combined" for r in result)


# ---------------------------------------------------------------------------
# labeler._guess_label_index
# ---------------------------------------------------------------------------

class TestGuessLabelIndex:
    def _stream(self, title):
        return _make_mock_stream(0, title)

    def _guess_label(self, title):
        from yuu_clip.analyze.labeler import _guess_label_index
        from yuu_clip.config import TRACK_LABELS
        return TRACK_LABELS[_guess_label_index(self._stream(title)) - 1]

    def test_mic_keyword_labels_as_player_voice(self):
        assert self._guess_label("Microphone") == "player_voice"

    def test_voice_keyword_labels_as_player_voice(self):
        assert self._guess_label("Player Voice") == "player_voice"

    def test_desktop_keyword_labels_as_combined(self):
        assert self._guess_label("Desktop Audio") == "combined"

    def test_game_keyword_labels_as_combined(self):
        assert self._guess_label("Game Capture") == "combined"

    def test_unknown_title_labels_as_unlabeled(self):
        assert self._guess_label("Track 3") == "unlabeled"

    def test_none_title_labels_as_unlabeled(self):
        assert self._guess_label(None) == "unlabeled"
