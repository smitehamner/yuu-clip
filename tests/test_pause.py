"""Pause/resume analysis - flag-file helpers, routes, /api/status, and the CLI
batch-loop poll (yuu_clip/analyze/pause.py, web/routes/analyze.py, cli/analyze.py)."""
from __future__ import annotations

import threading
import time

# ---------------------------------------------------------------------------
# Flag-file helpers
# ---------------------------------------------------------------------------

class TestPauseFlagHelpers:
    def test_flag_absent_by_default(self, tmp_path):
        from yuu_clip.analyze.pause import pause_flag_exists
        assert pause_flag_exists(tmp_path) is False

    def test_create_then_exists(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists
        create_pause_flag(tmp_path)
        assert pause_flag_exists(tmp_path) is True

    def test_remove_clears_flag(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists, remove_pause_flag
        create_pause_flag(tmp_path)
        remove_pause_flag(tmp_path)
        assert pause_flag_exists(tmp_path) is False

    def test_remove_when_absent_does_not_raise(self, tmp_path):
        from yuu_clip.analyze.pause import remove_pause_flag
        remove_pause_flag(tmp_path)  # no-op, must not raise

    def test_create_creates_parent_dir(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists
        project_dir = tmp_path / "fresh_project"  # .yuu-clip does not exist yet
        create_pause_flag(project_dir)
        assert pause_flag_exists(project_dir) is True


# ---------------------------------------------------------------------------
# Startup cleanup - a stale flag from a crashed server must not hold the
# first video of the next run.
# ---------------------------------------------------------------------------

class TestStartupCleansStaleFlag:
    def test_stale_flag_removed_on_create_app(self, project_dir):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists
        create_pause_flag(project_dir)
        assert pause_flag_exists(project_dir) is True

        from yuu_clip.web.app import create_app
        create_app(project_dir)

        assert pause_flag_exists(project_dir) is False


# ---------------------------------------------------------------------------
# Pause/resume routes
# ---------------------------------------------------------------------------

class _RunningJob:
    done = False
    filename = "session.mkv"
    video_id = None
    pause_requested = False
    gpu_temp_c = None
    gpu_state = "unavailable"
    thermal_trigger = None


class _FinishedJob:
    done = True
    filename = "session.mkv"
    video_id = None
    pause_requested = False


class TestPauseRoute:
    def test_noop_when_no_job_running(self, client):
        r = client.post("/api/analyze/pause")
        assert r.status_code == 200
        assert r.json()["status"] == "no-op"

    def test_noop_leaves_no_flag(self, client, project_dir):
        from yuu_clip.analyze.pause import pause_flag_exists
        client.post("/api/analyze/pause")
        assert pause_flag_exists(project_dir) is False

    def test_creates_flag_while_job_running(self, client, project_dir):
        from yuu_clip.analyze.pause import pause_flag_exists
        job = _RunningJob()
        client.app.state.ctx.analyze_job = job
        r = client.post("/api/analyze/pause")
        assert r.status_code == 200
        assert r.json()["status"] == "pause-requested"
        assert pause_flag_exists(project_dir) is True
        assert job.pause_requested is True

    def test_noop_when_job_already_done(self, client, project_dir):
        from yuu_clip.analyze.pause import pause_flag_exists
        client.app.state.ctx.analyze_job = _FinishedJob()
        r = client.post("/api/analyze/pause")
        assert r.json()["status"] == "no-op"
        assert pause_flag_exists(project_dir) is False


class TestResumeRoute:
    def test_noop_when_no_job_running(self, client):
        r = client.post("/api/analyze/resume")
        assert r.status_code == 200
        assert r.json()["status"] == "no-op"

    def test_removes_flag(self, client, project_dir):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists
        job = _RunningJob()
        client.app.state.ctx.analyze_job = job
        create_pause_flag(project_dir)
        r = client.post("/api/analyze/resume")
        assert r.status_code == 200
        assert r.json()["status"] == "resumed"
        assert pause_flag_exists(project_dir) is False
        assert job.pause_requested is False

    def test_safe_when_no_flag_present(self, client):
        client.app.state.ctx.analyze_job = _RunningJob()
        r = client.post("/api/analyze/resume")
        assert r.status_code == 200
        assert r.json()["status"] == "resumed"


# ---------------------------------------------------------------------------
# /api/status - analyze_paused requires a live job
# ---------------------------------------------------------------------------

class TestStatusPausedField:
    def test_false_when_idle(self, client):
        r = client.get("/api/status")
        assert r.json()["analyze_paused"] is False

    def test_true_when_job_running_and_flag_present(self, client, project_dir):
        from yuu_clip.analyze.pause import create_pause_flag
        client.app.state.ctx.analyze_job = _RunningJob()
        create_pause_flag(project_dir)
        r = client.get("/api/status")
        assert r.json()["analyze_paused"] is True

    def test_false_when_job_finished_even_with_flag(self, client, project_dir):
        # A pause requested during the last video: the job ends before the loop
        # ever re-checks the flag. The UI must not keep showing "paused".
        from yuu_clip.analyze.pause import create_pause_flag
        client.app.state.ctx.analyze_job = _FinishedJob()
        create_pause_flag(project_dir)
        r = client.get("/api/status")
        assert r.json()["analyze_paused"] is False


# ---------------------------------------------------------------------------
# Cancel while paused - cancel wins, flag removed
# ---------------------------------------------------------------------------

class TestCancelClearsPauseFlag:
    def test_cancel_removes_pause_flag(self, client, project_dir):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists
        create_pause_flag(project_dir)
        assert pause_flag_exists(project_dir) is True
        client.post("/api/analyze/cancel")
        assert pause_flag_exists(project_dir) is False


# ---------------------------------------------------------------------------
# /api/analyze/start clears a leftover pause flag before queuing the new run
# ---------------------------------------------------------------------------

class TestStartClearsStaleFlag:
    def test_start_removes_leftover_flag(self, client, project_dir):
        from yuu_clip.analyze.pause import create_pause_flag, pause_flag_exists
        video_path = project_dir / "session.mkv"
        video_path.write_bytes(b"fake")
        create_pause_flag(project_dir)
        client.post("/api/analyze/start", json={"path": str(video_path), "model": "medium"})
        assert pause_flag_exists(project_dir) is False


# ---------------------------------------------------------------------------
# CLI batch loop - waits while the flag is present, resumes once it's gone
# ---------------------------------------------------------------------------

class TestCliPauseLoop:
    def test_wait_returns_immediately_without_flag(self, tmp_path):
        from yuu_clip.cli.analyze import _wait_while_paused
        start = time.monotonic()
        _wait_while_paused(tmp_path, poll_interval_s=0.05)
        assert time.monotonic() - start < 0.2

    def test_wait_blocks_until_flag_removed(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag
        from yuu_clip.cli.analyze import _wait_while_paused

        create_pause_flag(tmp_path)

        def _remove_after_delay():
            time.sleep(0.15)
            remove_pause_flag(tmp_path)

        threading.Thread(target=_remove_after_delay, daemon=True).start()
        start = time.monotonic()
        _wait_while_paused(tmp_path, poll_interval_s=0.05)
        assert time.monotonic() - start >= 0.1

    def test_second_video_processed_after_flag_removed(self, tmp_path):
        """End-to-end poll contract: the loop must not skip the paused video -
        it must still process it once the flag disappears."""
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag
        from yuu_clip.cli.analyze import _wait_while_paused

        processed = []
        create_pause_flag(tmp_path)

        def _remove_after_delay():
            time.sleep(0.1)
            remove_pause_flag(tmp_path)

        threading.Thread(target=_remove_after_delay, daemon=True).start()

        for video in ["first.mkv", "second.mkv"]:
            _wait_while_paused(tmp_path, poll_interval_s=0.05)
            processed.append(video)

        assert processed == ["first.mkv", "second.mkv"]
