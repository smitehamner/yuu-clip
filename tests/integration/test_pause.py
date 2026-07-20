"""Pause/resume analysis - flag-file helpers, routes, /api/status, and the CLI
batch-loop poll (yuu_clip/analyze/pause.py, web/routes/analyze.py, cli/analyze.py)."""
from __future__ import annotations

import threading
import time

import pytest

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


# ---------------------------------------------------------------------------
# Shared wait_while_paused helper - the poll every pause point is built on
# ---------------------------------------------------------------------------

class TestWaitWhilePaused:
    def test_returns_false_without_flag(self, tmp_path):
        from yuu_clip.analyze.pause import wait_while_paused
        assert wait_while_paused(tmp_path, poll_interval_s=0.05) is False

    def test_returns_true_after_waiting(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag, wait_while_paused
        create_pause_flag(tmp_path)
        threading.Timer(0.1, remove_pause_flag, args=(tmp_path,)).start()
        assert wait_while_paused(tmp_path, poll_interval_s=0.05) is True

    def test_on_pause_not_called_when_not_paused(self, tmp_path):
        from yuu_clip.analyze.pause import wait_while_paused
        notices = []
        wait_while_paused(tmp_path, poll_interval_s=0.05, on_pause=lambda: notices.append(1))
        assert notices == []

    def test_on_pause_announced_exactly_once_per_wait(self, tmp_path):
        """The notice fires on entering the wait, not on every poll - otherwise a
        long cool-down would spam the analyze log with the same line."""
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag, wait_while_paused
        create_pause_flag(tmp_path)
        notices = []
        threading.Timer(0.2, remove_pause_flag, args=(tmp_path,)).start()
        wait_while_paused(tmp_path, poll_interval_s=0.02, on_pause=lambda: notices.append(1))
        assert notices == [1]


# ---------------------------------------------------------------------------
# Mid-video pause point (UX bug hunt B9) - scoring honours the flag between
# clips, so a single-video run is actually protected by thermal auto-pause.
# ---------------------------------------------------------------------------

class TestScoringPauseGateWiring:
    def test_no_gate_without_a_project_dir(self):
        from yuu_clip.pipeline.ingest import _make_scoring_pause_gate
        assert _make_scoring_pause_gate(None) is None

    def test_gate_returns_immediately_when_not_paused(self, tmp_path):
        from yuu_clip.pipeline.ingest import _make_scoring_pause_gate
        gate = _make_scoring_pause_gate(tmp_path)
        start = time.monotonic()
        gate()
        assert time.monotonic() - start < 0.5

    def test_gate_blocks_while_the_flag_is_present(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag
        from yuu_clip.pipeline.ingest import _make_scoring_pause_gate
        create_pause_flag(tmp_path)
        threading.Timer(0.15, remove_pause_flag, args=(tmp_path,)).start()
        gate = _make_scoring_pause_gate(tmp_path)
        start = time.monotonic()
        gate()
        assert time.monotonic() - start >= 0.1

    def test_run_scoring_passes_a_gate_through_to_score_video(self, tmp_path, monkeypatch):
        """The regression B9 was: the flag existed, the poll existed, but nothing
        in the per-video path ever consulted it."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import Video, make_session
        from yuu_clip.pipeline import ingest as _ingest
        from yuu_clip.scoring.engine import ScoringEngine

        captured = {}

        def _fake_score_video(self, video, session, progress_cb=None, kind="clip", pause_gate=None):
            captured["pause_gate"] = pause_gate
            return 0

        monkeypatch.setattr(ScoringEngine, "score_video", _fake_score_video)

        session = make_session(tmp_path / "gate.db")
        video = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=1000)
        session.add(video)
        session.flush()
        config = Config()
        config.scorer_energy_enabled = False
        config.scorer_scenes_enabled = False
        config.scorer_visual_enabled = False
        try:
            _ingest._run_scoring(video, [], config, session, project_dir=tmp_path)
        finally:
            session.close()

        assert callable(captured["pause_gate"])


# ---------------------------------------------------------------------------
# Transcription pause point (UX bug hunt B9, remaining gap) - the other
# sustained-GPU stage. The gate is only safe because transcription commits at
# segment batch boundaries; blocking inside the old single-transaction loop
# would hold SQLite's write lock for the whole cool-down.
# ---------------------------------------------------------------------------

class _FakeSegment:
    def __init__(self, index):
        self.start_ms = index * 1000
        self.end_ms = (index + 1) * 1000
        self.text = f"seg{index}"
        self.confidence = -0.1
        self.words = None


class _FakeResult:
    language = "en"

    def __init__(self, count):
        self.segments = (_FakeSegment(i) for i in range(count))


def _transcribable_track(tmp_path, name="project.db"):
    from yuu_clip.db.models import AudioTrack, Video, make_session
    audio = tmp_path / "t0.wav"
    audio.write_bytes(b"fake")
    session = make_session(tmp_path / name)
    video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="probed", duration_ms=60_000)
    session.add(video)
    session.flush()
    track = AudioTrack(
        video_id=video.id, stream_index=0, label="combined",
        do_transcribe=True, do_score=True, extracted_path=str(audio),
    )
    session.add(track)
    session.flush()
    return session, video, track


def _stub_transcriber(monkeypatch, segment_count):
    from yuu_clip.transcribe import whisper_runner

    class _Backend:
        def transcribe(self, audio_path, language):
            return _FakeResult(segment_count)

    monkeypatch.setattr(whisper_runner, "make_transcriber", lambda config: _Backend())


class TestTranscriptionPauseGate:
    def test_gate_called_once_per_commit_batch(self, tmp_path, monkeypatch):
        from yuu_clip.config import Config
        from yuu_clip.transcribe import whisper_runner

        monkeypatch.setattr(whisper_runner, "SEGMENTS_PER_COMMIT", 10)
        _stub_transcriber(monkeypatch, 35)
        session, _video, track = _transcribable_track(tmp_path)
        calls = []
        try:
            whisper_runner.transcribe_track(
                track, Config(), session, pause_gate=lambda: calls.append(1),
            )
        finally:
            session.close()

        assert len(calls) == 3  # after segments 10, 20, 30 - not the trailing 5

    def test_gate_sees_preceding_segments_already_committed(self, tmp_path, monkeypatch):
        """The whole point of moving from flush() to commit(): the gate may block for
        minutes, so nothing may be left sitting in an open write transaction."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import TranscriptSegment, make_session
        from yuu_clip.transcribe import whisper_runner

        monkeypatch.setattr(whisper_runner, "SEGMENTS_PER_COMMIT", 10)
        _stub_transcriber(monkeypatch, 12)
        session, _video, track = _transcribable_track(tmp_path)
        visible_to_others = []

        def _peek_over_a_second_connection():
            other = make_session(tmp_path / "project.db")
            try:
                visible_to_others.append(other.query(TranscriptSegment).count())
            finally:
                other.close()

        try:
            whisper_runner.transcribe_track(
                track, Config(), session, pause_gate=_peek_over_a_second_connection,
            )
        finally:
            session.close()

        assert visible_to_others == [10]

    def test_no_gate_still_transcribes_everything(self, tmp_path, monkeypatch):
        from yuu_clip.config import Config
        from yuu_clip.transcribe import whisper_runner

        monkeypatch.setattr(whisper_runner, "SEGMENTS_PER_COMMIT", 10)
        _stub_transcriber(monkeypatch, 25)
        session, _video, track = _transcribable_track(tmp_path)
        try:
            transcript = whisper_runner.transcribe_track(track, Config(), session)
            assert len(transcript.segments) == 25
        finally:
            session.close()

    def test_finished_track_is_marked_complete(self, tmp_path, monkeypatch):
        from yuu_clip.config import Config
        from yuu_clip.transcribe import whisper_runner

        monkeypatch.setattr(whisper_runner, "SEGMENTS_PER_COMMIT", 10)
        _stub_transcriber(monkeypatch, 25)
        session, _video, track = _transcribable_track(tmp_path)
        try:
            transcript = whisper_runner.transcribe_track(track, Config(), session)
            assert transcript.completed_at is not None
        finally:
            session.close()

    def test_track_that_dies_mid_loop_stays_incomplete(self, tmp_path, monkeypatch):
        """The committed-but-truncated case the completeness marker exists for: the
        segments are durable, but nothing may read them as a finished transcript."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import Transcript, TranscriptSegment, make_session
        from yuu_clip.transcribe import whisper_runner

        def _dies_after_twelve():
            for index in range(12):
                yield _FakeSegment(index)
            raise RuntimeError("backend fell over mid-track")

        class _Backend:
            def transcribe(self, audio_path, language):
                result = _FakeResult(0)
                result.segments = _dies_after_twelve()
                return result

        monkeypatch.setattr(whisper_runner, "SEGMENTS_PER_COMMIT", 10)
        monkeypatch.setattr(whisper_runner, "make_transcriber", lambda config: _Backend())
        session, _video, track = _transcribable_track(tmp_path)
        try:
            with pytest.raises(RuntimeError):
                whisper_runner.transcribe_track(track, Config(), session)
        finally:
            session.close()

        verify = make_session(tmp_path / "project.db")
        try:
            assert verify.query(TranscriptSegment).count() == 10  # the committed batch
            assert verify.query(Transcript).one().completed_at is None
        finally:
            verify.close()

    def test_gate_blocks_while_the_flag_is_present(self, tmp_path, monkeypatch):
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag
        from yuu_clip.config import Config
        from yuu_clip.pipeline.ingest import _make_pause_gate
        from yuu_clip.transcribe import whisper_runner

        monkeypatch.setattr(whisper_runner, "SEGMENTS_PER_COMMIT", 10)
        _stub_transcriber(monkeypatch, 12)
        session, _video, track = _transcribable_track(tmp_path)
        create_pause_flag(tmp_path)
        threading.Timer(0.15, remove_pause_flag, args=(tmp_path,)).start()

        start = time.monotonic()
        try:
            whisper_runner.transcribe_track(
                track, Config(), session, pause_gate=_make_pause_gate(tmp_path, "paused"),
            )
        finally:
            session.close()
        assert time.monotonic() - start >= 0.1


class TestTranscriptionPauseGateWiring:
    """The B9 regression shape: the flag, the poll and the loop can all exist while
    nothing in the per-video path ever hands one to the other."""

    def _capture_pause_gate(self, monkeypatch):
        from yuu_clip.transcribe import whisper_runner
        captured = {}

        def _fake(track, config, session, language=None, pause_gate=None):
            captured["pause_gate"] = pause_gate
            raise RuntimeError("stop here - only the wiring is under test")

        monkeypatch.setattr(whisper_runner, "transcribe_track", _fake)
        return captured

    def _run(self, tmp_path, monkeypatch, project_dir):
        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _ingest

        captured = self._capture_pause_gate(monkeypatch)
        monkeypatch.setattr(
            "yuu_clip.analyze.overlap.detect_transcript_overlap", lambda *a, **k: False
        )
        session, video, track = _transcribable_track(tmp_path)
        try:
            _ingest._transcribe_and_check_overlap(
                [track], Config(), session, video, language=None, project_dir=project_dir,
            )
        finally:
            session.close()
        return captured

    def test_analyze_path_hands_a_gate_to_transcribe_track(self, tmp_path, monkeypatch):
        captured = self._run(tmp_path, monkeypatch, project_dir=tmp_path)
        assert callable(captured["pause_gate"])

    def test_no_gate_without_a_project_dir(self, tmp_path, monkeypatch):
        """Retranscribe (a UI job with no Pause control and no thermal monitor) must
        not get a gate - a stale flag would stall it with nothing able to clear it."""
        captured = self._run(tmp_path, monkeypatch, project_dir=None)
        assert captured["pause_gate"] is None

    def test_retranscribe_video_passes_no_project_dir(self, tmp_path, monkeypatch):
        from yuu_clip.config import Config
        from yuu_clip.pipeline import ingest as _ingest

        seen = {}

        def _fake_transcribe(track_objs, config, session, video, language, force=False, project_dir=None):
            seen["project_dir"] = project_dir
            return []

        monkeypatch.setattr(_ingest, "_transcribe_and_check_overlap", _fake_transcribe)
        monkeypatch.setattr(_ingest, "_extract_audio_and_check_rms_overlap", lambda *a, **k: None)
        session, video, _track = _transcribable_track(tmp_path)
        try:
            _ingest._retranscribe_video(session, Config(), video, tmp_path)
        finally:
            session.close()

        assert seen["project_dir"] is None


# ---------------------------------------------------------------------------
# Between-stage pause point - the coarse backstop for the stages with no pause
# point of their own. Safe because every call site follows a session.commit().
# ---------------------------------------------------------------------------

class TestPauseBetweenStages:
    def test_noop_without_a_project_dir(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag
        from yuu_clip.pipeline.ingest import _pause_between_stages
        create_pause_flag(tmp_path)  # set, but no project dir to watch it
        start = time.monotonic()
        _pause_between_stages(None)
        assert time.monotonic() - start < 0.5

    def test_returns_immediately_when_not_paused(self, tmp_path):
        from yuu_clip.pipeline.ingest import _pause_between_stages
        start = time.monotonic()
        _pause_between_stages(tmp_path)
        assert time.monotonic() - start < 0.5

    def test_blocks_while_the_flag_is_present(self, tmp_path):
        from yuu_clip.analyze.pause import create_pause_flag, remove_pause_flag
        from yuu_clip.pipeline.ingest import _pause_between_stages
        create_pause_flag(tmp_path)
        threading.Timer(0.15, remove_pause_flag, args=(tmp_path,)).start()
        start = time.monotonic()
        _pause_between_stages(tmp_path)
        assert time.monotonic() - start >= 0.1
