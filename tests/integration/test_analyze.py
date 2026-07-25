from __future__ import annotations

from pathlib import Path

import pytest


class TestAnalyzeCommand:
    def test_web_analyze_cmd_is_non_interactive(self, tmp_path: Path):
        """The web UI must never launch analyze interactively - label_tracks()
        would block the subprocess forever waiting on stdin (CLAUDE.md)."""
        from yuu_clip.web.routes.analyze import IngestRequest, _build_analyze_cmd

        cmd = _build_analyze_cmd(IngestRequest(path="x.mkv"), "x.mkv", tmp_path)
        assert "--no-interact" in cmd


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

    def test_estimate_extract_step_is_small_fraction(self, client):
        # Regression: extract was duration*tracks*0.05 (~30x the real ~0.0017);
        # now duration*tracks*0.002.
        d = client.post("/api/estimate", json={**self._BASE, "audio_tracks": 2, "duration_s": 3600}).json()
        extract = next(s for s in d["steps"] if s["name"] == "Extract")
        assert extract["seconds"] == pytest.approx(3600 * 2 * 0.002)

    def test_estimate_includes_summarize_step(self, client):
        d = client.post("/api/estimate", json=self._BASE).json()
        assert any(s["name"] == "Summarize" for s in d["steps"])

    def test_estimate_score_step_scales_per_clip(self, client):
        # ~12s/clip (was 4s, a 2-4x underestimate).
        d = client.post("/api/estimate", json={**self._BASE, "duration_s": 3600}).json()
        score = next(s for s in d["steps"] if s["name"] == "LLM scoring")
        assert score["seconds"] == pytest.approx((3600 // 180) * 12)

    def test_estimate_base_model_faster_than_medium(self, client):
        base = client.post("/api/estimate", json={**self._BASE, "model": "base"}).json()
        med = client.post("/api/estimate", json={**self._BASE, "model": "medium"}).json()
        b = next(s for s in base["steps"] if s["name"].startswith("Transcribe"))
        m = next(s for s in med["steps"] if s["name"].startswith("Transcribe"))
        assert b["seconds"] < m["seconds"]

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
            # A queued-but-unlaunched command counts as busy (bug-hunt 2.5), so
            # clear the previous iteration's queue slot - this test only cares
            # about energy_mode validation, not the start->events launch handoff.
            client.app.state.ctx.analyze_cmd = None
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

    def test_force_flag_added_when_requested(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium", "force": True,
            })
            assert "--force" in app.state.ctx.analyze_cmd

    def test_force_omitted_by_default(self, project_dir, video_path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        with TestClient(app) as tc:
            tc.post("/api/analyze/start", json={
                "path": str(video_path), "model": "medium",
            })
            assert "--force" not in app.state.ctx.analyze_cmd


# ---------------------------------------------------------------------------
# Ingest start - rejected while another job is running (double-submit guard)
# ---------------------------------------------------------------------------

class TestIngestStartWhileRunning:
    """A second /api/analyze/start while a job is in flight must 409 - otherwise
    /api/analyze/events overwrites ctx.analyze_job and orphans the running
    subprocess (cancel and shutdown can no longer reach it)."""

    @pytest.fixture()
    def video_path(self, project_dir):
        p = project_dir / "session.mkv"
        p.write_bytes(b"fake")
        return p

    class _RunningJob:
        done = False
        filename = "other.mkv"
        video_id = None

    class _FinishedJob:
        done = True
        filename = "other.mkv"
        video_id = None

    def _start(self, tc, video_path):
        return tc.post("/api/analyze/start", json={"path": str(video_path), "model": "medium"})

    def test_start_rejected_while_analyze_job_running(self, client, video_path):
        client.app.state.ctx.analyze_job = self._RunningJob()
        r = self._start(client, video_path)
        assert r.status_code == 409
        assert client.app.state.ctx.analyze_cmd is None  # nothing queued

    def test_start_rejected_while_legacy_subprocess_running(self, client, video_path):
        from types import SimpleNamespace
        client.app.state.ctx.analyze_proc = SimpleNamespace(returncode=None)
        r = self._start(client, video_path)
        assert r.status_code == 409

    def test_start_allowed_after_job_finished(self, client, video_path):
        client.app.state.ctx.analyze_job = self._FinishedJob()
        r = self._start(client, video_path)
        assert r.status_code == 200
        assert r.json()["status"] == "started"


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
        # Filename must contain an ISO date (YYYY-MM-DD) - exact value is not asserted
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
    # Only Pyannote (advanced speaker-labels alternative) and the CUDA libraries
    # (GPU acceleration) remain real pip-install actions (packaging-strategy
    # overhaul, Wave 3) - everything else is bundled by default. SpeechBrain keeps
    # a read-only status check (no install action) because the analyze/export
    # panels gate the speaker-labels checkbox on it.
    def test_unknown_slug_returns_400(self, client):
        r = client.get("/api/install/not-a-package")
        assert r.status_code == 400

    def test_reports_installed_for_present_package(self, client):
        # 'speechbrain' reports status by detecting its import modules; patch
        # find_spec so the test does not depend on whether the dep is installed.
        from unittest.mock import patch

        with patch("yuu_clip.web.routes.common.importlib.util.find_spec", return_value=object()):
            r = client.get("/api/install/speechbrain")
        assert r.status_code == 200
        assert r.json() == {"installed": True}

    def test_reports_not_installed_when_module_absent(self, client):
        from unittest.mock import patch

        with patch("yuu_clip.web.routes.common.importlib.util.find_spec", return_value=None):
            r = client.get("/api/install/speechbrain")
        assert r.status_code == 200
        assert r.json() == {"installed": False}

    def test_multi_module_slug_requires_all_present(self, client):
        # cuda-libs needs both nvidia.cublas and nvidia.cudnn; a single missing one
        # means not installed.
        from unittest.mock import patch

        def only_cudnn_missing(module):
            return None if module == "nvidia.cudnn" else object()

        with patch("yuu_clip.web.routes.common.importlib.util.find_spec", side_effect=only_cudnn_missing):
            r = client.get("/api/install/cuda-libs")
        assert r.json() == {"installed": False}

    def test_speechbrain_slug_requires_speechbrain_and_sklearn(self, client):
        from unittest.mock import patch

        def only_sklearn_missing(module):
            return None if module == "sklearn" else object()

        with patch("yuu_clip.web.routes.common.importlib.util.find_spec", side_effect=only_sklearn_missing):
            assert client.get("/api/install/speechbrain").json() == {"installed": False}
        with patch("yuu_clip.web.routes.common.importlib.util.find_spec", return_value=object()):
            assert client.get("/api/install/speechbrain").json() == {"installed": True}

    def test_speechbrain_has_no_post_install_action(self, client):
        # Bundled (Tier A) - no install action, only the read-only status check above.
        r = client.post("/api/install/speechbrain")
        assert r.status_code == 400

    def test_bundled_slugs_are_not_postable(self, client):
        for slug in ("anthropic", "embeddings", "mediapipe", "llamacpp", "laugh-deps", "audio-model"):
            r = client.post(f"/api/install/{slug}")
            assert r.status_code == 400, slug


class TestUninstallPackage:
    """POST /api/install/{slug}/uninstall - the inverse of install_package (B10):
    lets a user who enabled GPU transcription reclaim the ~1 GB CUDA libraries."""

    def _capture_cmd(self, client, monkeypatch, slug):
        from starlette.responses import PlainTextResponse

        from yuu_clip.web.routes import analyze

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(analyze, "subprocess_sse", fake_sse)
        r = client.post(f"/api/install/{slug}/uninstall")
        assert r.status_code == 200
        return captured["cmd"]

    def test_unknown_slug_returns_400(self, client):
        r = client.post("/api/install/not-a-package/uninstall")
        assert r.status_code == 400

    def test_bundled_slugs_are_not_uninstallable(self, client):
        for slug in ("anthropic", "embeddings", "mediapipe", "llamacpp", "laugh-deps", "audio-model", "speechbrain"):
            r = client.post(f"/api/install/{slug}/uninstall")
            assert r.status_code == 400, slug

    def test_uninstall_runs_pip_uninstall_yes_on_the_installed_packages(self, client, monkeypatch):
        cmd = self._capture_cmd(client, monkeypatch, "cuda-libs")
        assert cmd[1:4] == ["-m", "pip", "uninstall"]
        assert "-y" in cmd
        assert "nvidia-cublas-cu12" in cmd
        assert "nvidia-cudnn-cu12" in cmd


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
# Probe (file not found case - no real video needed)
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

    def test_probe_tolerates_na_duration(self, tmp_path):
        """ffprobe emits "duration": "N/A" for containers/streams it can't measure
        (common on MKV). That must degrade to unknown, not crash the analyze run."""
        import json
        from unittest.mock import MagicMock, patch

        from yuu_clip.analyze.probe import probe_video

        video = tmp_path / "stream.mkv"
        video.write_bytes(b"data")
        ffprobe_json = json.dumps({
            "streams": [
                {"codec_type": "video", "avg_frame_rate": "30/1", "width": 1920, "height": 1080},
                {"codec_type": "audio", "index": 1, "codec_name": "aac", "duration": "N/A"},
            ],
            "format": {"duration": "N/A"},
        })

        def ok_run(cmd, **kwargs):
            r = MagicMock()
            r.returncode = 0
            r.stdout = ffprobe_json
            return r

        with patch("yuu_clip.analyze.probe.subprocess.run", side_effect=ok_run), \
             patch("yuu_clip.analyze.probe.find_ffmpeg", return_value=("ffmpeg", "ffprobe")):
            info = probe_video(video)

        assert info.duration_ms == 0
        assert info.audio_streams[0].duration_ms is None


# ---------------------------------------------------------------------------
# Scoring isolation - a scoring crash must not abort the analyze run or
# discard the clips that were already generated and committed.
# ---------------------------------------------------------------------------

class TestScoringIsolation:
    def test_scoring_failure_keeps_clips_and_marks_processed(self, tmp_path):
        from unittest.mock import patch

        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.pipeline import ingest as _pipeline
        from yuu_clip.pipeline.ingest import AnalyzeOptions

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
            # Must not raise - a per-video scoring crash cannot abort the batch.
            _pipeline._analyze_one(
                tmp_path / "s.mkv", session, Config(llm_enabled=False), tmp_path, AnalyzeOptions()
            )

        session.close()
        verify = make_session(tmp_path / "project.db")
        reloaded = verify.get(Video, video_id)
        assert reloaded.processed_at is not None          # run completed
        assert reloaded.clips_scored_at is None            # left visibly unscored
        assert verify.query(ClipCandidate).filter_by(video_id=video_id).count() == 1  # clips preserved
        verify.close()

    def test_clips_scored_before_mid_batch_failure_keep_their_committed_scores(self, tmp_path):
        """ScoringEngine.score_video commits after every clip (engine.py), so a
        scorer that raises partway through a batch does not roll back the clips
        already scored - only video.clips_scored_at (the "fully scored" signal)
        stays null. This is the real contract behind the comment in
        _analyze_one's scoring except-block."""
        from unittest.mock import patch

        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.pipeline import ingest as _pipeline
        from yuu_clip.pipeline.ingest import AnalyzeOptions
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.protocol import ScoreResult

        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="probed", duration_ms=60_000)
        session.add(video)
        session.flush()
        clip_ok = ClipCandidate(video_id=video.id, start_ms=0, end_ms=10_000, status="pending")
        clip_boom = ClipCandidate(video_id=video.id, start_ms=10_000, end_ms=20_000, status="pending")
        session.add_all([clip_ok, clip_boom])
        session.commit()
        video_id = video.id
        clip_ok_id = clip_ok.id

        class _FlakyScorer:
            name = "flaky"
            weight = 1.0

            def is_available(self):
                return True

            def score(self, clip, session):
                if clip.id == clip_boom.id:
                    raise RuntimeError("LLM endpoint unreachable")
                return ScoreResult(score_funny=0.9, score_dramatic=0.5, score_action=0.5)

        def run_real_scoring(video, track_objs, config, session, energy_mode="fast", context_text="",
                             proxy_dir=None, project_dir=None):
            engine = ScoringEngine(config, [_FlakyScorer()])
            engine.score_video(video, session)

        with patch.object(_pipeline, "_resolve_existing_video", return_value=(tmp_path / "s.mkv", video)), \
             patch.object(_pipeline, "_probe_video", return_value=object()), \
             patch.object(_pipeline, "_upsert_video_and_tracks", return_value=(video, [])), \
             patch.object(_pipeline, "_extract_audio_and_check_rms_overlap", return_value=None), \
             patch.object(_pipeline, "_obtain_transcripts", return_value=[]), \
             patch.object(_pipeline, "_generate_candidates", return_value=[clip_ok, clip_boom]), \
             patch.object(_pipeline, "_summarize_video", return_value=None), \
             patch.object(_pipeline, "_run_scoring", side_effect=run_real_scoring):
            # no_transcribe=True keeps run-metadata capture from resolving the
            # whisper device, which imports ctranslate2 (~12 s). Transcription is
            # fully patched out here, so the scoring contract under test is unchanged.
            _pipeline._analyze_one(tmp_path / "s.mkv", session, Config(), tmp_path, AnalyzeOptions(no_transcribe=True))

        session.close()
        verify = make_session(tmp_path / "project.db")
        reloaded_video = verify.get(Video, video_id)
        reloaded_clip_ok = verify.get(ClipCandidate, clip_ok_id)
        assert reloaded_video.clips_scored_at is None       # batch never finished - UI still offers Rescore
        # kept, not rolled back. Overall spreads the three narrative scores over
        # all four axis weights (Visual=0 here, default weight 0.5 -> /3.5).
        assert reloaded_clip_ok.score_overall == pytest.approx((0.9 + 0.5 + 0.5) / 3.5)
        verify.close()


# ---------------------------------------------------------------------------
# _run_scoring - visible "downloading the model" notice (packaging-strategy
# Wave 4). The AST checkpoint is a Tier-B download; a first-time analyze must
# say why scoring pauses instead of looking hung.
# ---------------------------------------------------------------------------

class TestRunScoringModelDownloadNotice:
    def _video(self, tmp_path):
        from yuu_clip.db.models import Video, make_session
        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="probed", duration_ms=60_000)
        session.add(video)
        session.commit()
        return session, video

    def _cfg(self):
        from yuu_clip.config import Config
        return Config(
            scorer_audio_event_enabled=True, scorer_energy_enabled=False,
            scorer_scenes_enabled=False, llm_enabled=False,
        )

    def test_notice_shown_when_model_not_cached(self, tmp_path, monkeypatch, capsys):
        from yuu_clip.pipeline.ingest import _run_scoring
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "available", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: False)

        session, video = self._video(tmp_path)
        _run_scoring(video, [], self._cfg(), session)
        session.close()

        out = capsys.readouterr().out
        assert "Downloading the audio-event model" in out

    def test_notice_omitted_when_model_already_cached(self, tmp_path, monkeypatch, capsys):
        from yuu_clip.pipeline.ingest import _run_scoring
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "available", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: True)

        session, video = self._video(tmp_path)
        _run_scoring(video, [], self._cfg(), session)
        session.close()

        out = capsys.readouterr().out
        assert "Downloading the audio-event model" not in out

    def test_notice_omitted_when_audio_event_disabled(self, tmp_path, monkeypatch, capsys):
        from yuu_clip.config import Config
        from yuu_clip.pipeline.ingest import _run_scoring
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "available", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: False)

        session, video = self._video(tmp_path)
        cfg = Config(
            scorer_audio_event_enabled=False, scorer_energy_enabled=False,
            scorer_scenes_enabled=False, llm_enabled=False,
        )
        _run_scoring(video, [], cfg, session)
        session.close()

        out = capsys.readouterr().out
        assert "Downloading the audio-event model" not in out

    def test_load_failed_notice_shown_after_scoring(self, tmp_path, monkeypatch, capsys):
        """An offline first run whose model fetch actually fails must say so
        after scoring, not just silently score every clip zero."""
        from yuu_clip.pipeline.ingest import _run_scoring
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "available", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: True)
        monkeypatch.setattr(AudioEventScorer, "load_failed", property(lambda self: True))

        session, video = self._video(tmp_path)
        _run_scoring(video, [], self._cfg(), session)
        session.close()

        out = capsys.readouterr().out
        assert "couldn't be downloaded" in out


# ---------------------------------------------------------------------------
# Extract/Transcribe stage progress logging - "Track i/N" lines drive the
# web UI's live progress pill (yuu_clip/web/static/core/utils.js progressPattern).
# ---------------------------------------------------------------------------

class TestPipelineTrackProgressLogging:
    def _make_video_and_tracks(self, tmp_path, n_tracks):
        from yuu_clip.db.models import AudioTrack, Video, make_session
        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="probed", duration_ms=60_000)
        session.add(video)
        session.flush()
        tracks = [
            AudioTrack(
                video_id=video.id, stream_index=i, label=f"track{i}",
                do_transcribe=True, do_score=True,
            )
            for i in range(n_tracks)
        ]
        session.add_all(tracks)
        session.flush()
        return session, video, tracks

    def test_extract_audio_logs_track_i_of_n(self, tmp_path, capsys):
        # The "already extracted" skip path is the one that prints "Track i/N"
        # (the success/OK path only prints the label, no index).
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        session, video, tracks = self._make_video_and_tracks(tmp_path, 3)
        audio_dir = tmp_path / "audio"
        audio_dir.mkdir()
        for i, track in enumerate(tracks):
            wav_path = audio_dir / f"t{i}.wav"
            wav_path.write_bytes(b"\x00")
            track.extracted_path = str(wav_path)
        session.flush()

        try:
            with mock.patch("yuu_clip.analyze.overlap.detect_and_apply_overlap_fallback", return_value=False):
                _pipeline._extract_audio_and_check_rms_overlap(
                    tmp_path / "s.mkv", video, tracks, Config(), audio_dir, session, force=False,
                )
        finally:
            session.close()

        out = capsys.readouterr().out
        assert "Track 1/3" in out
        assert "Track 2/3" in out
        assert "Track 3/3" in out

    def test_transcribe_logs_track_i_of_n(self, tmp_path, capsys):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        session, video, tracks = self._make_video_and_tracks(tmp_path, 2)
        for i, track in enumerate(tracks):
            track.extracted_path = str(tmp_path / f"t{i}.wav")
        session.flush()

        fake_transcript = mock.MagicMock()
        fake_transcript.segments = []
        fake_transcript.language = "en"

        try:
            with mock.patch("yuu_clip.transcribe.whisper_runner.transcribe_track", return_value=fake_transcript), \
                 mock.patch("yuu_clip.analyze.overlap.detect_transcript_overlap", return_value=False):
                _pipeline._transcribe_and_check_overlap(tracks, Config(), session, video, language=None)
        finally:
            session.close()

        out = capsys.readouterr().out
        assert "Track 1/2" in out
        assert "Track 2/2" in out


# ---------------------------------------------------------------------------
# Transcription idempotency - a re-run must not mint a second Transcript per
# track. Without --force an existing track-level transcript is reused; with
# --force it is deleted and replaced (mirrors ClipCandidate force-delete).
# ---------------------------------------------------------------------------

class TestTranscriptionIdempotency:
    def _make_video_and_track(self, tmp_path):
        from yuu_clip.db.models import AudioTrack, Video, make_session
        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="probed", duration_ms=60_000)
        session.add(video)
        session.flush()
        track = AudioTrack(
            video_id=video.id, stream_index=0, label="combined",
            do_transcribe=True, do_score=True, extracted_path=str(tmp_path / "t0.wav"),
        )
        session.add(track)
        session.flush()
        return session, video, track

    def _seed_transcript(self, session, track, *, clip_id=None, text="original", completed=True):
        """Seed a transcript. *completed=False* mimics what a run that died mid-track
        leaves behind - committed segments with no completeness marker."""
        from datetime import datetime, timezone

        from yuu_clip.db.models import Transcript, TranscriptSegment
        transcript = Transcript(
            audio_track_id=track.id, clip_id=clip_id, model_name="medium", language="en",
            completed_at=datetime.now(timezone.utc) if completed else None,
        )
        session.add(transcript)
        session.flush()
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=0, end_ms=1000, text=text))
        session.flush()
        return transcript

    @staticmethod
    def _fake_transcribe_track(track, config, session, language=None, pause_gate=None):
        from datetime import datetime, timezone

        from yuu_clip.db.models import Transcript, TranscriptSegment
        transcript = Transcript(
            audio_track_id=track.id, model_name=config.whisper_model, language="en",
            completed_at=datetime.now(timezone.utc),
        )
        session.add(transcript)
        session.flush()
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=0, end_ms=1000, text="fresh"))
        session.flush()
        return transcript

    def _run(self, session, video, tracks, *, force):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        with mock.patch(
            "yuu_clip.transcribe.whisper_runner.transcribe_track",
            side_effect=self._fake_transcribe_track,
        ) as transcribe, mock.patch(
            "yuu_clip.analyze.overlap.detect_transcript_overlap", return_value=False
        ):
            result = _pipeline._transcribe_and_check_overlap(
                tracks, Config(), session, video, language=None, force=force,
            )
        return result, transcribe

    def test_rerun_without_force_reuses_existing_transcript(self, tmp_path):
        from yuu_clip.db.models import Transcript

        session, video, track = self._make_video_and_track(tmp_path)
        existing = self._seed_transcript(session, track)
        existing_id = existing.id

        try:
            result, transcribe = self._run(session, video, [track], force=False)

            transcribe.assert_not_called()
            assert [t.id for t in result] == [existing_id]
            track_level = session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=None).all()
            assert [t.id for t in track_level] == [existing_id]
        finally:
            session.close()

    def test_rerun_with_force_replaces_existing_transcript(self, tmp_path):
        # SQLite recycles the deleted rowid, so identity is asserted via segment
        # content ("original" seeded vs "fresh" from the re-transcribe), not id.
        from yuu_clip.db.models import Transcript

        session, video, track = self._make_video_and_track(tmp_path)
        self._seed_transcript(session, track, text="original")

        try:
            result, transcribe = self._run(session, video, [track], force=True)

            transcribe.assert_called_once()
            track_level = session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=None).all()
            assert len(track_level) == 1
            assert [s.text for s in track_level[0].segments] == ["fresh"]
            assert result == track_level
        finally:
            session.close()

    def test_rerun_discards_an_unfinished_transcript_and_redoes_it(self, tmp_path):
        """Transcription commits in batches so a pause point can block without holding
        SQLite's write lock, which means a crashed run leaves a committed but TRUNCATED
        transcript. Reusing one would pass half a recording off as the whole thing.
        """
        from yuu_clip.db.models import Transcript

        session, video, track = self._make_video_and_track(tmp_path)
        self._seed_transcript(session, track, text="truncated", completed=False)

        try:
            result, transcribe = self._run(session, video, [track], force=False)

            transcribe.assert_called_once()
            track_level = session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=None).all()
            assert len(track_level) == 1
            assert [s.text for s in track_level[0].segments] == ["fresh"]
            assert result == track_level
        finally:
            session.close()

    def test_rerun_prefers_the_complete_transcript_over_an_unfinished_one(self, tmp_path):
        from yuu_clip.db.models import Transcript

        session, video, track = self._make_video_and_track(tmp_path)
        complete_id = self._seed_transcript(session, track, text="whole").id
        self._seed_transcript(session, track, text="truncated", completed=False)

        try:
            result, transcribe = self._run(session, video, [track], force=False)

            transcribe.assert_not_called()
            assert [t.id for t in result] == [complete_id]
            track_level = session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=None).all()
            assert [t.id for t in track_level] == [complete_id]
        finally:
            session.close()

    def test_force_rerun_leaves_clip_specific_transcript_untouched(self, tmp_path):
        from yuu_clip.db.models import ClipCandidate, Transcript

        session, video, track = self._make_video_and_track(tmp_path)
        clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=10_000, status="pending")
        session.add(clip)
        session.flush()
        clip_transcript_id = self._seed_transcript(session, track, clip_id=clip.id, text="clip-level").id
        self._seed_transcript(session, track)

        try:
            self._run(session, video, [track], force=True)

            clip_level = session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=clip.id).all()
            assert [t.id for t in clip_level] == [clip_transcript_id]
        finally:
            session.close()

    def test_force_regeneration_clears_clips_with_exports_and_clip_transcripts(self, tmp_path):
        # Regression: --force clip regeneration must cascade-delete each clip's
        # tracked exports and clip-level retranscripts. A bulk query().delete()
        # bypasses the ORM cascade and trips SQLite's foreign_keys=ON constraint
        # (clip_exports.clip_id / transcripts.clip_id have no ON DELETE CASCADE).
        from unittest import mock

        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, ClipExport, Transcript
        from yuu_clip.pipeline import ingest as _pipeline

        session, video, track = self._make_video_and_track(tmp_path)
        track_transcript = self._seed_transcript(session, track)
        clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=10_000, status="pending")
        session.add(clip)
        session.flush()
        self._seed_transcript(session, track, clip_id=clip.id, text="clip-level")
        session.add(ClipExport(
            clip_id=clip.id, preset_name="default",
            path=str(tmp_path / "c.mp4"), container="mp4",
        ))
        session.flush()

        try:
            with mock.patch("yuu_clip.segments.windower.generate_candidates", return_value=[]):
                _pipeline._generate_candidates(
                    video, [track_transcript], Config(), session,
                    no_segment=False, no_transcribe=False, force=True,
                )
            session.flush()
            assert session.query(ClipCandidate).filter_by(video_id=video.id).count() == 0
            assert session.query(ClipExport).count() == 0
            assert session.query(Transcript).filter_by(clip_id=clip.id).count() == 0
        finally:
            session.close()


# ---------------------------------------------------------------------------
# Process-tree termination - cancel must kill ffmpeg grandchildren, not orphan them
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

    def test_posix_kills_process_group_when_child_leads_it(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "linux"), \
             patch.object(sse.os, "getpgid", return_value=proc.pid, create=True) as getpgid, \
             patch.object(sse.os, "killpg", create=True) as killpg:
            sse.terminate_process_tree(proc)

        getpgid.assert_called_once_with(proc.pid)
        killpg.assert_called_once_with(proc.pid, sse.signal.SIGTERM)
        assert not proc.terminated  # group-kill used, not the plain signal

    def test_posix_falls_back_to_terminate_when_not_group_leader(self):
        # A proc launched without start_new_session shares the server's group
        # (pgid != pid); killpg must NOT fire against that group - fall back to
        # signalling only the direct child.
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "linux"), \
             patch.object(sse.os, "getpgid", return_value=proc.pid + 1, create=True), \
             patch.object(sse.os, "killpg", create=True) as killpg:
            sse.terminate_process_tree(proc)

        killpg.assert_not_called()
        assert proc.terminated

    def test_posix_falls_back_to_terminate_when_getpgid_fails(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "linux"), \
             patch.object(sse.os, "getpgid", side_effect=ProcessLookupError, create=True):
            sse.terminate_process_tree(proc)
        assert proc.terminated

    def test_new_session_kwargs_by_platform(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        with patch.object(sse.sys, "platform", "win32"):
            assert sse.new_session_kwargs() == {}
        with patch.object(sse.sys, "platform", "linux"):
            assert sse.new_session_kwargs() == {"start_new_session": True}

    def test_noop_when_already_exited(self):
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc(returncode=0)
        with patch.object(sse.subprocess, "run") as run:
            sse.terminate_process_tree(proc)
        run.assert_not_called()
        assert not proc.terminated

    def test_async_windows_taskkill_runs_off_the_event_loop(self):
        # The Windows kill must be offloaded to a thread (asyncio.to_thread) so a
        # cancel/shutdown never blocks the event loop on a wedged taskkill.
        import asyncio
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "win32"), \
             patch.object(sse, "_run_taskkill") as run_taskkill, \
             patch.object(sse.asyncio, "to_thread", wraps=asyncio.to_thread) as to_thread:
            asyncio.run(sse.terminate_process_tree_async(proc))
            to_thread.assert_called_once_with(run_taskkill, proc.pid)

        run_taskkill.assert_called_once_with(proc.pid)
        assert not proc.terminated  # tree-kill used, not the plain signal

    def test_async_posix_delegates_to_sync_killpg(self):
        import asyncio
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc()
        with patch.object(sse.sys, "platform", "linux"), \
             patch.object(sse.os, "getpgid", return_value=proc.pid, create=True), \
             patch.object(sse.os, "killpg", create=True) as killpg:
            asyncio.run(sse.terminate_process_tree_async(proc))

        killpg.assert_called_once_with(proc.pid, sse.signal.SIGTERM)
        assert not proc.terminated

    def test_async_noop_when_already_exited(self):
        import asyncio
        from unittest.mock import patch

        from yuu_clip.web import sse

        proc = self._FakeProc(returncode=0)
        with patch.object(sse, "_run_taskkill") as run_taskkill:
            asyncio.run(sse.terminate_process_tree_async(proc))
        run_taskkill.assert_not_called()
        assert not proc.terminated


# ---------------------------------------------------------------------------
# DB session cleanup - proves no connection lingers after route handlers
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
# Graceful shutdown - lifespan terminates running analyze subprocess
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

    def test_shutdown_terminates_every_tracked_subprocess(self, project_dir):
        """An overlapped subprocess_sse proc that lost the single analyze_proc slot
        must still be terminated on shutdown (else it is orphaned holding the lock)."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from fastapi.testclient import TestClient

        from yuu_clip.web import sse
        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        winner = MagicMock(returncode=None, pid=1001)   # currently in analyze_proc
        winner.wait = AsyncMock(return_value=0)
        loser = MagicMock(returncode=None, pid=1002)    # clobbered out of the slot
        loser.wait = AsyncMock(return_value=0)

        with patch.object(sse.sys, "platform", "win32"), \
             patch.object(sse.subprocess, "run") as run:
            with TestClient(app) as _:
                app.state.ctx.analyze_proc = winner
                app.state.ctx.subprocess_procs = {winner, loser}

        killed = {argv.args[0][-1] for argv in run.call_args_list}
        assert {"1001", "1002"} <= killed

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
# Analyze cancel - no-op when nothing running
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
# Summarize - 400 when no transcript
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

    def test_gpu_setup_defaults_without_a_bundled_llm_binary(self, client, monkeypatch):
        """No bundled/configured llama-server binary in the test environment - that
        probe must report "don't know" rather than guessing. nvidia_gpu_present and
        cuda_libs_installed are pinned False here (real machines running this suite
        may have a real NVIDIA GPU or CUDA libs installed - those paths are covered
        separately below)."""
        import yuu_clip.web.routes.analyze as analyze_routes
        monkeypatch.setattr(client.app.state.ctx.thermal_monitor, "available", lambda: False)
        monkeypatch.setattr(analyze_routes, "module_findable", lambda _module: False)
        d = client.get("/api/status").json()
        assert d["nvidia_gpu_present"] is False
        assert d["cuda_libs_installed"] is False
        assert d["whisper_device"] == "auto"
        assert d["llm_use_gpu"] is True
        assert d["llm_gpu_available"] is None

    def test_gpu_setup_reports_nvidia_present(self, client, monkeypatch):
        monkeypatch.setattr(client.app.state.ctx.thermal_monitor, "available", lambda: True)
        d = client.get("/api/status").json()
        assert d["nvidia_gpu_present"] is True

    def test_gpu_setup_reports_cuda_libs_installed(self, client, monkeypatch):
        import yuu_clip.web.routes.analyze as analyze_routes
        monkeypatch.setattr(analyze_routes, "module_findable", lambda _module: True)
        d = client.get("/api/status").json()
        assert d["cuda_libs_installed"] is True

    def test_gpu_setup_reports_llm_gpu_available(self, client, monkeypatch):
        monkeypatch.setattr(client.app.state.ctx, "llm_gpu_available", lambda: False)
        d = client.get("/api/status").json()
        assert d["llm_gpu_available"] is False


class TestLlmGpuAvailableCache:
    """ProjectContext.llm_gpu_available caches the (subprocess-spawning) probe so
    /api/status polling doesn't re-run it every call - see web/deps.py."""

    def test_returns_none_when_llm_use_gpu_is_off(self, client):
        client.app.state.ctx.config.llm_use_gpu = False
        assert client.app.state.ctx.llm_gpu_available() is None

    def test_caches_the_probe_result(self, client, monkeypatch):
        ctx = client.app.state.ctx
        calls = []

        def _probe(_config):
            calls.append(1)
            return True

        monkeypatch.setattr(
            "yuu_clip.scoring.llamacpp_server.gpu_offload_available", _probe,
        )
        assert ctx.llm_gpu_available() is True
        assert ctx.llm_gpu_available() is True
        assert len(calls) == 1

    def test_reload_config_invalidates_the_cache(self, client, monkeypatch):
        ctx = client.app.state.ctx
        results = iter([True, False])
        monkeypatch.setattr(
            "yuu_clip.scoring.llamacpp_server.gpu_offload_available",
            lambda _config: next(results),
        )
        assert ctx.llm_gpu_available() is True
        ctx.reload_config()
        assert ctx.llm_gpu_available() is False

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
# GPU thermal monitoring - status payload + poll-loop integration (roadmap
# plan 01, Stage 3)
# ---------------------------------------------------------------------------

class TestThermalStatusFields:
    def test_idle_status_has_null_temp_and_unavailable_state(self, client):
        d = client.get("/api/status").json()
        assert d["gpu_temp_c"] is None
        assert d["gpu_state"] == "unavailable"

    def test_running_job_surfaces_its_thermal_fields(self, project_dir):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        class _RunningJob:
            done = False
            filename = "session.mkv"
            video_id = None
            gpu_temp_c = 72.0
            gpu_state = "ok"

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_job = _RunningJob()
            d = tc.get("/api/status").json()
        assert d["gpu_temp_c"] == 72.0
        assert d["gpu_state"] == "ok"

    def test_finished_job_reports_unavailable_not_stale_reading(self, project_dir):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        class _FinishedJob:
            done = True
            filename = "session.mkv"
            video_id = None
            gpu_temp_c = 95.0
            gpu_state = "pause"

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_job = _FinishedJob()
            d = tc.get("/api/status").json()
        assert d["gpu_temp_c"] is None
        assert d["gpu_state"] == "unavailable"


def _sse_log_texts(data_values) -> list[str]:
    """The text of every typed ``log`` event in a decoded analyze SSE stream.

    Thermal warn/auto-pause notices ride the stream as ``log`` events (level
    ``warn``) now, not bare prose strings - so a substring check reads from here.
    """
    return [v["text"] for v in data_values if isinstance(v, dict) and v.get("type") == "log"]


class TestThermalPollLoopIntegration:
    """End-to-end: a hot injected sampler drives the real /api/analyze/events
    lifecycle through warn -> auto-pause, using a tiny poll interval so the
    test doesn't wait on the real ~10s cadence."""

    def _run(self, project_dir, monkeypatch, *, sampler, sleep_s=1.0):
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.analyze.thermal import GpuThermalMonitor
        from yuu_clip.web.app import create_app
        from yuu_clip.web.routes import analyze as analyze_routes

        monkeypatch.setattr(analyze_routes, "_THERMAL_POLL_INTERVAL_S", 0.01)
        app = create_app(project_dir)
        app.state.ctx.thermal_monitor = GpuThermalMonitor(sampler=sampler)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", f"import time; time.sleep({sleep_s})"]
            with tc.stream("GET", "/api/analyze/events") as resp:
                lines = list(resp.iter_lines())
        return app, lines

    def test_hot_reading_warns_then_auto_pauses(self, project_dir, monkeypatch):
        import json as _json

        app, lines = self._run(project_dir, monkeypatch, sampler=lambda: 95.0)
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        texts = _sse_log_texts(data_values)
        assert any("[Warning: GPU at 95" in t for t in texts)
        assert any("[Auto-paused: GPU reached 95" in t for t in texts)

        from yuu_clip.analyze.pause import pause_flag_exists
        assert pause_flag_exists(app.state.ctx.project_dir) is True
        assert app.state.ctx.analyze_job.gpu_state == "pause"
        assert app.state.ctx.analyze_job.gpu_temp_c == 95.0

    def test_cool_reading_never_warns_or_pauses(self, project_dir, monkeypatch):
        import json as _json

        app, lines = self._run(project_dir, monkeypatch, sampler=lambda: 50.0)
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        texts = _sse_log_texts(data_values)
        assert not any("Warning: GPU" in t for t in texts)
        assert not any("Auto-paused" in t for t in texts)

        from yuu_clip.analyze.pause import pause_flag_exists
        assert pause_flag_exists(app.state.ctx.project_dir) is False
        assert app.state.ctx.analyze_job.gpu_state == "ok"

    def test_autopause_disabled_warns_but_never_pauses(self, project_dir, monkeypatch):
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.analyze.thermal import GpuThermalMonitor
        from yuu_clip.web.app import create_app
        from yuu_clip.web.routes import analyze as analyze_routes

        monkeypatch.setattr(analyze_routes, "_THERMAL_POLL_INTERVAL_S", 0.01)
        app = create_app(project_dir)
        app.state.ctx.thermal_monitor = GpuThermalMonitor(sampler=lambda: 95.0)
        app.state.ctx.config.thermal_autopause_enabled = False
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "import time; time.sleep(1.0)"]
            with tc.stream("GET", "/api/analyze/events") as resp:
                lines = list(resp.iter_lines())
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        texts = _sse_log_texts(data_values)
        assert any("[Warning: GPU at 95" in t for t in texts)
        assert not any("Auto-paused" in t for t in texts)

        from yuu_clip.analyze.pause import pause_flag_exists
        assert pause_flag_exists(app.state.ctx.project_dir) is False

    def test_unavailable_monitor_is_a_noop(self, project_dir, monkeypatch):
        """When available() is False (no NVIDIA GPU), the poll loop must return
        immediately without ever writing job.gpu_state/gpu_temp_c."""
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.analyze.thermal import GpuThermalMonitor
        from yuu_clip.web.app import create_app
        from yuu_clip.web.routes import analyze as analyze_routes

        monkeypatch.setattr(analyze_routes, "_THERMAL_POLL_INTERVAL_S", 0.01)
        app = create_app(project_dir)

        def _boom():
            raise AssertionError("sampler must never be called when unavailable")

        monitor = GpuThermalMonitor(sampler=None)
        monkeypatch.setattr(monitor, "available", lambda: False)
        app.state.ctx.thermal_monitor = monitor
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "print('done')"]
            with tc.stream("GET", "/api/analyze/events") as resp:
                lines = list(resp.iter_lines())
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert not any("GPU" in v for v in data_values if isinstance(v, str))
        assert app.state.ctx.analyze_job.gpu_state == "unavailable"
        assert app.state.ctx.analyze_job.gpu_temp_c is None


# ---------------------------------------------------------------------------
# Rescore-clips SSE - 404 guard
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

        monkeypatch.setattr(ScoringEngine, "score_clip", lambda self, clip, session, **kwargs: None)

        video_id = client.get("/api/videos").json()[0]["id"]
        _add_failed_clip(project_dir, video_id)  # 1 failed clip among 4 total

        body = client.get(f"/api/videos/{video_id}/rescore-failed-clips").text
        assert "Starting LLM scoring for 1 clip" in body
        assert "Scored 1/1 clips" in body
        assert '"type": "done"' in body
        assert '"outcome": "ok"' in body


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
        re-run the old command - it reattaches to the finished job and replays its
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
            # Second call - no new command queued: replay the finished job, don't re-run.
            with tc.stream("GET", "/api/analyze/events") as resp:
                lines = list(resp.iter_lines())
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert "marker-line" in _sse_log_texts(data_values)
        assert {"v": 1, "type": "done", "outcome": "ok"} in data_values

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

    def test_score_after_a_cancel_does_not_report_itself_as_cancelled(self, project_dir):
        """A prior cancel must not leak a cancel outcome into an unrelated job (Bug 1).

        Cancellation is now keyed to the process instance (ctx.cancelled_procs), not a
        server-scoped boolean flag: a proc left in the set by an earlier cancelled job
        can never mark a later, different proc as cancelled. Seed a stale proc identity
        and assert the fresh score stream still ends non-cancelled. Asserts the outcome,
        so it keeps its meaning if the plumbing changes again.
        """
        import json as _json

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.cancelled_procs.add(object())  # a stale proc from a prior cancel
            with tc.stream("POST", "/api/score") as resp:  # /api/score is POST, not GET
                lines = list(resp.iter_lines())
        data = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        done = [d for d in data if isinstance(d, dict) and d.get("type") == "done"]
        assert done, "score stream must end with a typed done event"
        assert all(d.get("outcome") != "cancelled" for d in done)


# ---------------------------------------------------------------------------
# SSE output paths - error exit, cancellation, terminal done event
# ---------------------------------------------------------------------------

class TestSseOutputPaths:
    """SSE generator emits the right events for success, error-exit, and cancel."""

    def _stream_lines(self, tc, url):
        with tc.stream("GET", url) as resp:
            return list(resp.iter_lines())

    def _done_events(self, data_values):
        return [v for v in data_values if isinstance(v, dict) and v.get("type") == "done"]

    def test_successful_subprocess_emits_done_ok(self, project_dir):
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_cmd = [sys.executable, "-c", "print('hi')"]
            lines = self._stream_lines(tc, "/api/analyze/events")
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert self._done_events(data_values) == [{"v": 1, "type": "done", "outcome": "ok"}]

    def test_failed_subprocess_emits_error_log_and_done_error(self, project_dir):
        """A non-zero analyze exit must end with a typed done{error}.

        A success terminal (jobs.js routes it to onDone) made a crashed analysis
        render as "Analysis complete - 0 clips found" with the success chime; the
        typed error outcome is what routes it to onError instead.
        """
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_cmd = [sys.executable, "-c", "raise SystemExit(1)"]
            lines = self._stream_lines(tc, "/api/analyze/events")
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        assert any(
            isinstance(v, dict) and v.get("type") == "log" and v.get("level") == "error"
            and "[Error:" in v.get("text", "")
            for v in data_values
        )
        done = self._done_events(data_values)
        assert len(done) == 1
        assert done[0]["outcome"] == "error"
        assert done[0]["error"]

    def test_failed_job_replays_done_error_to_a_reattaching_client(self, project_dir):
        """The reattach path (already-finished job) must report failure too.

        A page refreshed after the analysis died replays the buffer and then the
        terminal event; the reconnect branch must carry the same error outcome.
        """
        import json as _json
        import sys

        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app) as tc:
            app.state.ctx.analyze_cmd = [sys.executable, "-c", "raise SystemExit(3)"]
            self._stream_lines(tc, "/api/analyze/events")
            # Second connect: no queued command, so this replays the finished job.
            lines = self._stream_lines(tc, "/api/analyze/events")
        data_values = [_json.loads(ln.removeprefix("data: ")) for ln in lines if ln.startswith("data: ")]
        done = self._done_events(data_values)
        assert len(done) == 1
        assert done[0]["outcome"] == "error"

    def test_cancelled_job_emits_done_cancelled(self, project_dir):
        """A user cancel is first-class: outcome 'cancelled', not conflated with
        success or failure, so a reattached client sees a clean end rather than an
        error toast for something the user asked for."""
        import asyncio
        import json as _json

        from fastapi.testclient import TestClient

        from yuu_clip.web.analyze_job import AnalyzeJob
        from yuu_clip.web.app import create_app
        from yuu_clip.web.jobevents import log_payload

        app = create_app(project_dir)
        with TestClient(app):
            job = AnalyzeJob(["unused"], project_dir)
            job.cancelled = True
            job.returncode = 1
            job.done = True
            job.buffer = [log_payload("stopping")]

            async def _collect():
                return [chunk async for chunk in job._stream()]

            chunks = asyncio.run(_collect())
        data_values = [
            _json.loads(c.removeprefix("data: ").strip())
            for c in chunks if c.startswith("data: ")
        ]
        assert self._done_events(data_values) == [{"v": 1, "type": "done", "outcome": "cancelled"}]

# ---------------------------------------------------------------------------
# Cancel endpoint - state side-effects
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

    def test_cancel_kills_the_whole_process_tree_when_proc_running(self, project_dir):
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
                # cancel must kill the whole tree, not orphan the ffmpeg grandchild
                assert any(c.args[0][0] == "taskkill" for c in run.call_args_list)

    def test_cancel_releases_subprocess_job_state_without_waiting_on_generator(self, project_dir):
        """B3/W1: cancel must deterministically release a subprocess_sse job's busy
        state. The frontend closes its SSE stream the instant it POSTs cancel, so the
        abandoned generator's finally only runs on GC finalization - if cancel relied
        on it, /api/status would keep reporting analyze_running/active_jobs with no
        subprocess alive (the latch the user hit)."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from fastapi.testclient import TestClient

        from yuu_clip.web import sse
        from yuu_clip.web.app import create_app
        from yuu_clip.web.sse import release_counted_job

        app = create_app(project_dir)
        # Mirror the state subprocess_sse establishes for a running export/score/reel.
        mock_proc = MagicMock()
        mock_proc.returncode = None
        mock_proc.pid = 12345
        mock_proc.wait = AsyncMock(return_value=0)
        with patch.object(sse.sys, "platform", "win32"), \
             patch.object(sse.subprocess, "run"):
            with TestClient(app) as tc:
                ctx = app.state.ctx
                ctx.analyze_proc = mock_proc
                ctx.subprocess_procs.add(mock_proc)
                ctx.counted_procs.add(mock_proc)
                ctx.active_jobs += 1

                busy = tc.get("/api/status").json()
                assert busy["analyze_running"] is True and busy["any_running"] is True

                tc.post("/api/analyze/cancel")

                # Released immediately, not left for GC of the abandoned generator.
                assert ctx.active_jobs == 0
                assert ctx.analyze_proc is None
                assert mock_proc not in ctx.subprocess_procs
                idle = tc.get("/api/status").json()
                assert idle["analyze_running"] is False
                assert idle["any_running"] is False
                assert idle["active_jobs"] == 0

                # The abandoned generator's finally still fires later; it must be a
                # no-op, never driving active_jobs negative.
                release_counted_job(ctx, mock_proc)
                assert ctx.active_jobs == 0


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
# Re-detect speakers (rediarize) endpoint
# ---------------------------------------------------------------------------

class TestRediarizeEndpoint:
    def test_rediarize_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/rediarize")
        assert r.status_code == 404

    def test_rediarize_builds_cli_command(self, client, monkeypatch):
        from starlette.responses import PlainTextResponse

        from yuu_clip.web.routes import analyze

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(analyze, "subprocess_sse", fake_sse)
        vid_id = client.get("/api/videos").json()[0]["id"]
        assert client.get(f"/api/videos/{vid_id}/rediarize").status_code == 200
        cmd = captured["cmd"]
        assert "rediarize" in cmd
        assert str(vid_id) in cmd


# ---------------------------------------------------------------------------
# Single-stage re-run endpoints (reextract / retranscribe / regenerate-clips)
# ---------------------------------------------------------------------------

class TestStageRerunEndpoints:
    def _capture_cmd(self, client, monkeypatch, path):
        from starlette.responses import PlainTextResponse

        from yuu_clip.web.routes import analyze

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(analyze, "subprocess_sse", fake_sse)
        vid_id = client.get("/api/videos").json()[0]["id"]
        assert client.get(path.format(id=vid_id)).status_code == 200
        return captured["cmd"], vid_id

    def test_reextract_builds_cli_command(self, client, monkeypatch):
        cmd, vid_id = self._capture_cmd(client, monkeypatch, "/api/videos/{id}/reextract")
        assert "reextract" in cmd
        assert str(vid_id) in cmd

    def test_retranscribe_builds_cli_command_with_model(self, client, monkeypatch):
        cmd, _ = self._capture_cmd(client, monkeypatch, "/api/videos/{id}/retranscribe")
        assert "retranscribe-video" in cmd
        assert "--model" in cmd

    def test_regenerate_clips_builds_cli_command(self, client, monkeypatch):
        cmd, vid_id = self._capture_cmd(client, monkeypatch, "/api/videos/{id}/regenerate-clips")
        assert "regenerate-clips" in cmd
        assert str(vid_id) in cmd

    def test_stage_reruns_404_for_missing_video(self, client):
        for path in ("reextract", "retranscribe", "regenerate-clips"):
            assert client.get(f"/api/videos/99999/{path}").status_code == 404

    def test_video_retranscribe_rejects_unknown_model(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/retranscribe?model=gpt-4o")
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Single-stage re-run engine functions
# ---------------------------------------------------------------------------

class TestStageRerunEngine:
    def _seed(self, tmp_path, *, with_transcript, with_clip):
        from yuu_clip.db.models import (
            AudioTrack,
            ClipCandidate,
            Transcript,
            Video,
            make_session,
        )

        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="done", duration_ms=60_000)
        session.add(video)
        session.flush()
        wav = tmp_path / "t.wav"
        wav.write_bytes(b"x")
        track = AudioTrack(video_id=video.id, stream_index=1, do_transcribe=True, extracted_path=str(wav))
        session.add(track)
        session.flush()
        if with_transcript:
            session.add(Transcript(audio_track_id=track.id, model_name="m"))
        if with_clip:
            session.add(ClipCandidate(video_id=video.id, start_ms=0, end_ms=10_000, status="approved"))
        session.commit()
        return session, video

    def test_reextract_forces_and_preserves_status(self, tmp_path):
        from unittest.mock import patch

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        session, video = self._seed(tmp_path, with_transcript=False, with_clip=False)
        with patch.object(_pipeline, "_extract_audio_and_check_rms_overlap") as extract:
            n = _pipeline._reextract_video(session, Config(), video, tmp_path)
        assert extract.call_args.kwargs["force"] is True
        assert video.status == "done"
        assert n == 1
        session.close()

    def test_retranscribe_forces_stamps_clips_and_preserves_status(self, tmp_path):
        from unittest.mock import patch

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        session, video = self._seed(tmp_path, with_transcript=True, with_clip=True)
        with patch.object(_pipeline, "_extract_audio_and_check_rms_overlap"), \
             patch.object(_pipeline, "_transcribe_and_check_overlap", return_value=[object()]) as transcribe:
            transcripts = _pipeline._retranscribe_video(session, Config(), video, tmp_path)
        assert transcribe.call_args.kwargs["force"] is True
        assert len(transcripts) == 1
        assert video.status == "done"
        assert all(clip.transcript_edited_at is not None for clip in video.clip_candidates)
        session.close()

    def test_regenerate_clips_forces_and_clears_scored_marker(self, tmp_path):
        from datetime import datetime, timezone
        from unittest.mock import patch

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        session, video = self._seed(tmp_path, with_transcript=True, with_clip=True)
        video.clips_scored_at = datetime.now(timezone.utc)
        session.commit()
        with patch.object(_pipeline, "_generate_candidates", return_value=[object(), object()]) as generate:
            candidates = _pipeline._regenerate_clips(session, Config(), video)
        assert generate.call_args.kwargs["force"] is True
        assert len(candidates) == 2
        assert video.clips_scored_at is None
        session.close()

    def test_regenerate_clips_without_transcripts_is_noop(self, tmp_path):
        from unittest.mock import patch

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        session, video = self._seed(tmp_path, with_transcript=False, with_clip=True)
        with patch.object(_pipeline, "_generate_candidates") as generate:
            candidates = _pipeline._regenerate_clips(session, Config(), video)
        assert candidates == []
        generate.assert_not_called()
        session.close()


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
        """An unrecognised model string should not raise - it falls back to speed=6."""
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
# analyze/start with video_id - reanalyze-after-split entry point
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
# probe._parse_fps - branch coverage
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
# labeler.label_tracks - single-stream auto-label
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
# labeler._label_non_interactive - profile and fallback paths
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
        # __default__ must not be applied - falls back to track 0 as combined
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
        from yuu_clip.track_labels import TRACK_LABELS
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


# ---------------------------------------------------------------------------
# GET /api/prereqs
# ---------------------------------------------------------------------------

class TestPrereqs:
    def test_reports_ffmpeg_missing(self, client, monkeypatch):
        def _no_ffmpeg():
            raise FileNotFoundError("ffmpeg not found")
        monkeypatch.setattr("yuu_clip.ffmpeg_tools.find_ffmpeg", _no_ffmpeg)
        r = client.get("/api/prereqs")
        assert r.status_code == 200
        assert r.json()["ffmpeg_ok"] is False

    def test_reports_ffmpeg_present(self, client, monkeypatch):
        monkeypatch.setattr("yuu_clip.ffmpeg_tools.find_ffmpeg", lambda: ("ffmpeg", "ffprobe"))
        assert client.get("/api/prereqs").json()["ffmpeg_ok"] is True

    def test_llm_not_ok_without_model_path(self, client):
        # Default config: llamacpp backend with an empty llm_model_path.
        assert client.get("/api/prereqs").json()["llm_ok"] is False

    def test_llm_ok_delegates_to_check_llm_available(self, client, monkeypatch):
        # prereqs delegates the llamacpp/claude decision to check_llm_available, which
        # also verifies the runtime resolves - mocked here so the test doesn't depend
        # on whether the llama-server binary is present in the runner's environment.
        monkeypatch.setattr("yuu_clip.scoring.llm.check_llm_available", lambda _cfg: (True, ""))
        body = client.get("/api/prereqs").json()
        assert body["llm_ok"] is True
        assert body["llm_reason"] == ""

    def test_llm_reason_surfaced_when_unavailable(self, client, monkeypatch):
        monkeypatch.setattr(
            "yuu_clip.scoring.llm.check_llm_available",
            lambda _cfg: (False, "llama-server was not found"),
        )
        body = client.get("/api/prereqs").json()
        assert body["llm_ok"] is False
        assert "llama-server was not found" in body["llm_reason"]

    def test_response_has_boolean_flags(self, client):
        body = client.get("/api/prereqs").json()
        assert isinstance(body["ffmpeg_ok"], bool)
        assert isinstance(body["llm_ok"], bool)
        assert isinstance(body["llm_reason"], str)


# ---------------------------------------------------------------------------
# _whisper_step (zero transcribe_tracks path)
# ---------------------------------------------------------------------------

class TestWhisperStep:
    def _step(self, model="base", has_gpu=True, duration_s=3600, transcribe_tracks=1):
        from yuu_clip.web.routes.analyze import _whisper_step
        return _whisper_step(model, has_gpu, duration_s, transcribe_tracks)

    def test_zero_tracks_returns_load_captions(self):
        result = self._step(transcribe_tracks=0)
        assert result["name"] == "Load captions"
        assert result["seconds"] == 2.0
        assert result["note"] == "from file"

    def test_gpu_faster_than_cpu(self):
        gpu = self._step(model="large-v3", has_gpu=True)
        cpu = self._step(model="large-v3", has_gpu=False)
        assert gpu["seconds"] < cpu["seconds"]

    def test_more_tracks_longer(self):
        one = self._step(transcribe_tracks=1)
        two = self._step(transcribe_tracks=2)
        assert two["seconds"] > one["seconds"]


# ---------------------------------------------------------------------------
# Measured-rate estimate - roadmap-2026-07 plan 01 Stage 2
# ---------------------------------------------------------------------------

def _run_json(*, model="medium", has_gpu=True, stages):
    import json as _json
    return _json.dumps({
        "started_at": "2026-07-01T00:00:00+00:00",
        "finished_at": "2026-07-01T01:00:00+00:00",
        "elapsed_ms": 3_600_000,
        "device": {"has_gpu": has_gpu, "transcribe": "cuda (float16)" if has_gpu else "cpu (int8)"},
        "settings": {"model": model, "track_layout": "default", "energy_mode": "fast",
                     "scene_mode": "fast", "speaker_labels": False, "captions_source": "whisper",
                     "scoring": True, "contexts": [], "weights": {}},
        "stages": stages,
    })


def _seed_run(session, *, model="medium", has_gpu=True, duration_ms=3_600_000, stages, processed_at=None):
    from datetime import datetime, timedelta, timezone

    from yuu_clip.db.models import Video
    if processed_at is None:
        processed_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    v = Video(
        path=f"/tmp/seed-{id(stages)}.mkv", filename=f"seed-{id(stages)}.mkv",
        status="done", duration_ms=duration_ms, processed_at=processed_at,
        analyze_run_json=_run_json(model=model, has_gpu=has_gpu, stages=stages),
    )
    session.add(v)
    session.flush()
    return v


class TestMeasuredRates:
    def _db(self, project_dir):
        from yuu_clip.db.models import make_session
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def test_no_matching_runs_returns_empty(self, project_dir):
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            assert _measured_rates(db, "medium", True) == {}
        finally:
            db.close()

    def test_single_sample_not_trusted(self, project_dir):
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}])
            db.commit()
            assert _measured_rates(db, "medium", True) == {}
        finally:
            db.close()

    def test_median_of_two_matching_samples(self, project_dir):
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            # 3600s video: 36s extract -> rate 0.01; 72s extract -> rate 0.02
            _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}])
            _seed_run(db, stages=[{"name": "Extract", "seconds": 72.0}])
            db.commit()
            rates = _measured_rates(db, "medium", True)
            assert rates["extract"] == pytest.approx(0.015)
        finally:
            db.close()

    def test_different_model_excludes_transcribe_only(self, project_dir):
        """The Whisper model keys the transcribe stage only. A medium + large-v3
        pair leaves one 'medium' transcribe sample (below the trust threshold), but
        the model-independent Extract stage pools both samples across models."""
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            _seed_run(db, model="medium", stages=[
                {"name": "Transcribe", "seconds": 300.0}, {"name": "Extract", "seconds": 36.0}])
            _seed_run(db, model="large-v3", stages=[
                {"name": "Transcribe", "seconds": 900.0}, {"name": "Extract", "seconds": 36.0}])
            db.commit()
            rates = _measured_rates(db, "medium", True)
            assert "transcribe" not in rates  # only one "medium" transcribe sample
            assert rates["extract"] == pytest.approx(0.01)  # pooled across models
        finally:
            db.close()

    def test_score_stage_pools_across_models(self, project_dir):
        """The combined energy+scenes+LLM 'Score' stage is model-independent, so its
        samples pool across Whisper models - the fix for LLM scoring appearing to
        change with the Whisper model."""
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            _seed_run(db, model="tiny", stages=[{"name": "Score", "seconds": 360.0}])
            _seed_run(db, model="base", stages=[{"name": "Score", "seconds": 360.0}])
            db.commit()
            assert _measured_rates(db, "small", True)["score"] == pytest.approx(0.1)
        finally:
            db.close()

    def test_different_device_excluded(self, project_dir):
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            _seed_run(db, has_gpu=True, stages=[{"name": "Extract", "seconds": 36.0}])
            _seed_run(db, has_gpu=False, stages=[{"name": "Extract", "seconds": 36.0}])
            db.commit()
            assert "extract" not in _measured_rates(db, "medium", True)
        finally:
            db.close()

    def test_malformed_run_json_skipped_not_raised(self, project_dir):
        from yuu_clip.db.models import Video
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            db.add(Video(
                path="/tmp/broken.mkv", filename="broken.mkv", status="done",
                duration_ms=60_000, analyze_run_json="{not valid json",
            ))
            db.commit()
            assert _measured_rates(db, "medium", True) == {}  # must not raise
        finally:
            db.close()

    def test_missing_stage_excluded_not_zero(self, project_dir):
        """A --no-score run has no 'Score' stage - it must be excluded from that
        stage's sample set, not counted as a zero-second sample (which would
        corrupt the median toward under-estimating)."""
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}])  # no "Score"
            _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}])  # no "Score"
            db.commit()
            assert "score" not in _measured_rates(db, "medium", True)
        finally:
            db.close()

    def test_zero_duration_video_excluded(self, project_dir):
        """Guards the seconds/duration division - a zero-duration row must not raise."""
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            _seed_run(db, duration_ms=0, stages=[{"name": "Extract", "seconds": 36.0}])
            _seed_run(db, duration_ms=0, stages=[{"name": "Extract", "seconds": 36.0}])
            db.commit()
            assert _measured_rates(db, "medium", True) == {}
        finally:
            db.close()

    def test_only_last_n_samples_considered(self, project_dir):
        from yuu_clip.web.routes.analyze import _measured_rates
        db = self._db(project_dir)
        try:
            from datetime import datetime, timedelta, timezone
            now = datetime.now(timezone.utc)
            # 10 recent runs at rate 0.01, plus 2 older runs (outside the last-10
            # window) at a wildly different rate that must not affect the median.
            for i in range(10):
                _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}],
                          processed_at=now - timedelta(minutes=i))
            for i in range(2):
                _seed_run(db, stages=[{"name": "Extract", "seconds": 3600.0}],
                          processed_at=now - timedelta(days=10 + i))
            db.commit()
            assert _measured_rates(db, "medium", True)["extract"] == pytest.approx(0.01)
        finally:
            db.close()


class TestComputeTimeEstimateMeasured:
    def _req(self, **overrides):
        from yuu_clip.web.routes.analyze import EstimateRequest
        return EstimateRequest(**{
            "duration_s": 3600, "model": "medium", "audio_tracks": 2,
            "has_gpu": True, "scene_mode": "fast", **overrides,
        })

    def _db(self, project_dir):
        from yuu_clip.db.models import make_session
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def test_no_db_falls_back_to_estimated(self, project_dir):
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        result = _compute_time_estimate(self._req())
        assert result["source"] == "estimated"

    def test_source_estimated_without_history(self, project_dir):
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        db = self._db(project_dir)
        try:
            result = _compute_time_estimate(self._req(), db)
            assert result["source"] == "estimated"
        finally:
            db.close()

    def test_source_measured_with_enough_history(self, project_dir):
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        db = self._db(project_dir)
        try:
            _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}])
            _seed_run(db, stages=[{"name": "Extract", "seconds": 36.0}])
            db.commit()
            result = _compute_time_estimate(self._req(), db)
            assert result["source"] == "measured"
            extract = next(s for s in result["steps"] if s["name"] == "Extract")
            assert extract["seconds"] == pytest.approx(36.0)  # rate 0.01 * 3600s
        finally:
            db.close()

    def test_score_stage_grounds_llm_scoring_net_of_energy_and_scene(self, project_dir):
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        db = self._db(project_dir)
        try:
            # 3600s video, 600s combined Score stage each run.
            _seed_run(db, stages=[{"name": "Score", "seconds": 600.0}])
            _seed_run(db, stages=[{"name": "Score", "seconds": 600.0}])
            db.commit()
            result = _compute_time_estimate(self._req(), db)
            energy = next(s for s in result["steps"] if s["name"].startswith("Audio energy"))
            scene = next(s for s in result["steps"] if s["name"].startswith("Scene cut detection"))
            llm = next(s for s in result["steps"] if s["name"] == "LLM scoring")
            assert llm["seconds"] == pytest.approx(600.0 - energy["seconds"] - scene["seconds"])
        finally:
            db.close()

    def test_llm_scoring_grounded_regardless_of_whisper_model(self, project_dir):
        """LLM scoring must not vary with the Whisper model. Score-stage history
        recorded under 'tiny'/'base' grounds a 'small' estimate the same way."""
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        db = self._db(project_dir)
        try:
            _seed_run(db, model="tiny", stages=[{"name": "Score", "seconds": 600.0}])
            _seed_run(db, model="base", stages=[{"name": "Score", "seconds": 600.0}])
            db.commit()
            result = _compute_time_estimate(self._req(model="small"), db)
            energy = next(s for s in result["steps"] if s["name"].startswith("Audio energy"))
            scene = next(s for s in result["steps"] if s["name"].startswith("Scene cut detection"))
            llm = next(s for s in result["steps"] if s["name"] == "LLM scoring")
            assert result["source"] == "measured"
            assert llm["seconds"] == pytest.approx(600.0 - energy["seconds"] - scene["seconds"])
        finally:
            db.close()

    def test_warning_true_above_threshold(self, project_dir):
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        result = _compute_time_estimate(self._req(duration_s=36000, model="large-v3", has_gpu=False), warn_hours=1.0)
        assert result["long_run_warning"] is True
        assert result["warn_hours"] == 1.0

    def test_warning_false_below_threshold(self, project_dir):
        from yuu_clip.web.routes.analyze import _compute_time_estimate
        result = _compute_time_estimate(self._req(duration_s=60), warn_hours=2.0)
        assert result["long_run_warning"] is False


class TestEstimateRouteMeasured:
    def test_estimate_route_returns_source_and_warning_fields(self, client):
        d = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "audio_tracks": 2,
            "has_gpu": True, "scene_mode": "fast",
        }).json()
        assert d["source"] == "estimated"
        assert "warn_hours" in d
        assert "long_run_warning" in d


class TestShouldPrewarmTransformers:
    """Guards the gate that resolves transformers.pipeline before diarization
    imports speechbrain. SpeechBrain 1.x poisons a not-yet-resolved
    transformers.pipeline (its k2 integration hard-imports the unbundled k2), so
    audio-event/laugh scoring must warm pipeline first - but only when both a
    speechbrain diarization and a transformers-backed scorer will run this run."""

    def _gate(self, **cfg):
        from yuu_clip.config import Config
        from yuu_clip.pipeline.ingest import AnalyzeOptions, _should_prewarm_transformers
        no_score = cfg.pop("no_score", False)
        return _should_prewarm_transformers(Config(**cfg), AnalyzeOptions(no_score=no_score))

    def test_speechbrain_plus_audio_event_prewarms(self):
        assert self._gate(diarization_backend="speechbrain", scorer_audio_event_enabled=True) is True

    def test_speechbrain_plus_laugh_model_prewarms(self):
        assert self._gate(
            diarization_backend="speechbrain",
            scorer_audio_event_enabled=False, scorer_laugh_mode="model",
        ) is True

    def test_non_speechbrain_backend_never_prewarms(self):
        # Only speechbrain poisons transformers, so a run with diarization off
        # never needs the pre-warm even when a transformers-backed scorer runs.
        assert self._gate(diarization_backend="null", scorer_audio_event_enabled=True) is False

    def test_no_transformers_backed_scorer_skips_prewarm(self):
        assert self._gate(
            diarization_backend="speechbrain",
            scorer_audio_event_enabled=False, scorer_laugh_mode="transcript",
        ) is False

    def test_no_score_skips_prewarm(self):
        assert self._gate(
            diarization_backend="speechbrain", scorer_audio_event_enabled=True, no_score=True,
        ) is False


# ---------------------------------------------------------------------------
# _parse_srt / _ffmpeg_stderr_tail - pure helpers
# ---------------------------------------------------------------------------

class TestParseSrt:
    def _parse(self, text):
        from yuu_clip.pipeline.ingest import _parse_srt
        return _parse_srt(text)

    def test_comma_and_dot_decimal_separators(self):
        srt = (
            "1\n00:00:01,000 --> 00:00:02,500\nHello\n\n"
            "2\n00:00:03.000 --> 00:00:04.000\nWorld"
        )
        assert self._parse(srt) == [(1000, 2500, "Hello"), (3000, 4000, "World")]

    def test_hours_minutes_seconds_summed(self):
        start = (1 * 3600 + 2 * 60 + 3) * 1000 + 4
        assert self._parse("1\n01:02:03,004 --> 01:02:04,000\nx")[0][0] == start

    def test_multiline_cue_text_is_joined(self):
        assert self._parse("1\n00:00:00,000 --> 00:00:05,000\nline one\nline two") == [
            (0, 5000, "line one line two")
        ]

    def test_block_with_fewer_than_three_lines_skipped(self):
        srt = "1\n00:00:01,000 --> 00:00:02,000\n\n\n2\n00:00:03,000 --> 00:00:04,000\nkept"
        assert self._parse(srt) == [(3000, 4000, "kept")]

    def test_empty_cue_text_dropped(self):
        srt = "1\n00:00:01,000 --> 00:00:02,000\n   \n\n2\n00:00:03,000 --> 00:00:04,000\nkept"
        assert self._parse(srt) == [(3000, 4000, "kept")]

    def test_malformed_timestamp_line_skipped(self):
        srt = "1\nnot a timestamp\ntext here\n\n2\n00:00:01,000 --> 00:00:02,000\nok"
        assert self._parse(srt) == [(1000, 2000, "ok")]


class TestFfmpegStderrTail:
    def _tail(self, stderr, **kw):
        from yuu_clip.pipeline.ingest import _ffmpeg_stderr_tail
        return _ffmpeg_stderr_tail(stderr, **kw)

    def test_none_returns_empty(self):
        assert self._tail(None) == ""

    def test_decodes_bytes_and_keeps_last_lines(self):
        assert self._tail(b"a\nb\nc\nd\n", max_lines=2) == "c\nd"

    def test_strips_blank_lines(self):
        assert self._tail(b"real error\n\n  \n") == "real error"


# ---------------------------------------------------------------------------
# _summarize_video - segment-relative transcript window
# ---------------------------------------------------------------------------

class TestSummarizeVideoSegmentOffset:
    def _seed(self, tmp_path, *, segment_start_s=None, segment_end_s=None, seg_times):
        from yuu_clip.db.models import (
            AudioTrack,
            Transcript,
            TranscriptSegment,
            Video,
            make_session,
        )
        session = make_session(tmp_path / "project.db")
        video = Video(
            path=str(tmp_path / "seg.mkv"), filename="seg.mkv", status="transcribed",
            duration_ms=60_000, segment_start_s=segment_start_s, segment_end_s=segment_end_s,
        )
        session.add(video)
        session.flush()
        track = AudioTrack(video_id=video.id, stream_index=0, label="combined")
        session.add(track)
        session.flush()
        transcript = Transcript(audio_track_id=track.id, model_name="whisper")
        session.add(transcript)
        session.flush()
        for start_ms, end_ms, text in seg_times:
            session.add(TranscriptSegment(
                transcript_id=transcript.id, start_ms=start_ms, end_ms=end_ms, text=text,
            ))
        session.flush()
        return session, video, transcript

    def _run(self, session, video, transcript):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _pipeline

        captured = {}

        def fake_summarize(text, config, context_text=""):
            captured["text"] = text
            return ("A title", "A summary")

        with mock.patch("yuu_clip.scoring.llm.summarize_transcript", side_effect=fake_summarize):
            _pipeline._summarize_video(video, [transcript], Config(), session)
        return captured

    def test_segment_starting_after_zero_is_still_summarized(self, tmp_path):
        # Regression: a split segment's audio is extracted trimmed, so its transcript
        # is 0-based. Filtering by the absolute segment_start_s dropped every line and
        # silently produced no summary for any segment starting > 0s.
        session, video, transcript = self._seed(
            tmp_path, segment_start_s=100.0, segment_end_s=160.0,
            seg_times=[(0, 5000, "first line"), (5000, 10000, "second line")],
        )
        try:
            captured = self._run(session, video, transcript)
            assert "first line" in captured["text"]
            assert "second line" in captured["text"]
            assert video.title == "A title"
            assert video.summary == "A summary"
        finally:
            session.close()

    def test_non_segment_video_summarized_normally(self, tmp_path):
        session, video, transcript = self._seed(
            tmp_path, seg_times=[(0, 3000, "alpha"), (3000, 6000, "beta")],
        )
        try:
            captured = self._run(session, video, transcript)
            assert captured["text"] == "alpha beta"
            assert video.summary == "A summary"
        finally:
            session.close()

    def test_empty_transcript_skips_summary(self, tmp_path):
        session, video, transcript = self._seed(tmp_path, seg_times=[])
        try:
            captured = self._run(session, video, transcript)
            assert "text" not in captured  # summarize_transcript never called
            assert video.summary is None
        finally:
            session.close()


# ---------------------------------------------------------------------------
# _import_subtitles - Import-captions ingest branch
# ---------------------------------------------------------------------------

class TestImportSubtitles:
    def _seed(self, tmp_path, *, do_transcribe=True):
        from yuu_clip.db.models import AudioTrack, Video, make_session
        session = make_session(tmp_path / "project.db")
        video = Video(
            path=str(tmp_path / "v.mkv"), filename="v.mkv", status="labeled", duration_ms=60_000,
        )
        session.add(video)
        session.flush()
        track = AudioTrack(
            video_id=video.id, stream_index=0, label="combined", do_transcribe=do_transcribe,
        )
        session.add(track)
        session.flush()
        return session, video, [track]

    def test_srt_file_creates_transcript_segments(self, tmp_path):
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.pipeline import ingest as _pipeline

        srt = tmp_path / "caps.srt"
        srt.write_text(
            "1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:04,000\nWorld",
            encoding="utf-8",
        )
        session, video, tracks = self._seed(tmp_path)
        try:
            transcripts = _pipeline._import_subtitles(
                str(srt), tmp_path / "v.mkv", tracks, session, video,
            )
            session.flush()
            assert len(transcripts) == 1
            segs = (
                session.query(TranscriptSegment)
                .filter_by(transcript_id=transcripts[0].id)
                .order_by(TranscriptSegment.start_ms)
                .all()
            )
            assert [(s.start_ms, s.end_ms, s.text) for s in segs] == [
                (0, 2000, "Hello"), (2000, 4000, "World"),
            ]
            assert video.status == "segmented"
        finally:
            session.close()

    def test_falls_back_to_track_zero_when_none_transcribed(self, tmp_path):
        from yuu_clip.pipeline import ingest as _pipeline

        srt = tmp_path / "caps.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nhi", encoding="utf-8")
        session, video, tracks = self._seed(tmp_path, do_transcribe=False)
        try:
            transcripts = _pipeline._import_subtitles(
                str(srt), tmp_path / "v.mkv", tracks, session, video,
            )
            assert len(transcripts) == 1
            assert transcripts[0].audio_track_id == tracks[0].id
        finally:
            session.close()

    def test_missing_srt_file_returns_empty_and_logs(self, tmp_path, capsys):
        from yuu_clip.pipeline import ingest as _pipeline

        session, video, tracks = self._seed(tmp_path)
        try:
            result = _pipeline._import_subtitles(
                str(tmp_path / "nope.srt"), tmp_path / "v.mkv", tracks, session, video,
            )
        finally:
            session.close()
        assert result == []
        assert "Subtitle import failed" in capsys.readouterr().out

    def test_srt_rebased_and_windowed_for_a_split_segment(self, tmp_path):
        # bug-hunt 4.3 - an imported SRT always carries parent-absolute
        # timestamps, but a split segment's transcript convention is
        # segment-relative. A line must be rebased onto the segment window
        # and dropped if its start falls outside it (matching how
        # _migrate_transcript_to_segments assigns a line by its start time).
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.pipeline import ingest as _pipeline

        srt = tmp_path / "caps.srt"
        srt.write_text(
            "1\n00:00:00,000 --> 00:00:02,000\nBefore segment\n\n"
            "2\n00:01:00,000 --> 00:01:02,000\nInside segment\n\n"
            "3\n00:02:00,000 --> 00:02:02,000\nAt the boundary (excluded)",
            encoding="utf-8",
        )
        session, video, tracks = self._seed(tmp_path)
        video.segment_start_s = 60.0
        video.segment_end_s = 120.0
        session.flush()
        try:
            transcripts = _pipeline._import_subtitles(
                str(srt), tmp_path / "v.mkv", tracks, session, video,
            )
            session.flush()
            segs = (
                session.query(TranscriptSegment)
                .filter_by(transcript_id=transcripts[0].id)
                .order_by(TranscriptSegment.start_ms)
                .all()
            )
            assert [(s.start_ms, s.end_ms, s.text) for s in segs] == [
                (0, 2000, "Inside segment"),
            ]
        finally:
            session.close()

    def test_stream_extract_failure_surfaces_ffmpeg_stderr(self, tmp_path, capsys):
        import subprocess as _subprocess
        import unittest.mock as mock

        from yuu_clip.pipeline import ingest as _pipeline

        session, video, tracks = self._seed(tmp_path)
        failure = _subprocess.CalledProcessError(
            1, ["ffmpeg"], output=b"", stderr=b"Stream map '0:5' matches no streams",
        )
        try:
            with mock.patch("yuu_clip.ffmpeg_tools.find_ffmpeg", return_value=("ffmpeg", "ffprobe")), \
                 mock.patch.object(_pipeline.subprocess, "run", side_effect=failure):
                result = _pipeline._import_subtitles(
                    "stream:5", tmp_path / "v.mkv", tracks, session, video,
                )
        finally:
            session.close()
        assert result == []
        # The real ffmpeg reason (in exc.stderr) must reach the streamed console log,
        # not just "returned non-zero exit status 1".
        assert "matches no streams" in capsys.readouterr().out
