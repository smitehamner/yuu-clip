"""yuu_clip/scoring/scenes.py - scene-cut detection and scorer."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# SceneCutScorer unit tests
# ---------------------------------------------------------------------------

class TestSceneCutScorer:
    """SceneCutScorer.score() covers 0-duration clip, no cuts, and cuts present."""

    def _make_db_with_video_and_clip(self, tmp_path, start_ms, end_ms):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        db_path = tmp_path / "test.db"
        session = make_session(db_path)
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        clip = ClipCandidate(video_id=v.id, start_ms=start_ms, end_ms=end_ms, status="pending")
        session.add(clip)
        session.flush()
        return session, v, clip

    def test_score_zero_duration_returns_empty(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 0)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_visual is None   # zero duration → no opinion, not a real zero
        assert result.score_action is None    # scene cuts feed Visual now, never Action
        assert result.tags == []

    def test_score_no_scene_boundaries_returns_zero(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_visual == 0.0
        assert result.score_action is None    # never populates Action
        assert "scenes_scored" not in result.tags
        assert result.notes["cuts_in_clip"] == 0

    def test_score_with_cuts_inside_window(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            # Add 5 scene cuts inside the 1-minute window → 5 cuts/min → score = 0.5
            for ms in [10_000, 20_000, 30_000, 40_000, 50_000]:
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_visual > 0.0
        assert result.score_action is None   # cuts lift Visual, not Action
        assert "scenes_scored" in result.tags
        assert result.notes["cuts_in_clip"] == 5

    def test_score_cut_at_end_ms_excluded(self, tmp_path):
        """A cut at exactly end_ms must not be counted (< end_ms, not <=)."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            session.add(SceneBoundary(video_id=v.id, timecode_ms=60_000))  # at end_ms
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.notes["cuts_in_clip"] == 0

    def test_is_available_true_when_enabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        config.scorer_scenes_enabled = True
        assert SceneCutScorer(config).is_available() is True

    def test_is_available_false_when_disabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        config.scorer_scenes_enabled = False
        assert SceneCutScorer(config).is_available() is False

    def test_score_maxes_at_one(self, tmp_path):
        """score_visual must not exceed 1.0 even with very high cut density."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            for ms in range(1000, 60_000, 1000):   # 59 cuts in 1 minute
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_visual <= 1.0

class TestComputeScenesIdempotent:
    def test_skips_if_boundaries_already_exist(self, tmp_path):
        from yuu_clip.db.models import SceneBoundary, Video, make_session
        from yuu_clip.scoring.scenes import compute_scenes
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        session.add(SceneBoundary(video_id=v.id, timecode_ms=5_000))
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript")
        finally:
            session.close()
        assert result == 0

# ---------------------------------------------------------------------------
# compute_scenes - transcript mode writes SceneBoundary rows
# ---------------------------------------------------------------------------

class TestComputeScenesTranscriptMode:
    def _make_db(self, tmp_path):
        from yuu_clip.db.models import (
            AudioTrack,
            Transcript,
            Video,
            make_session,
        )
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=120_000)
        session.add(v)
        session.flush()
        track = AudioTrack(video_id=v.id, stream_index=0, label="combined", do_transcribe=True, do_score=True)
        session.add(track)
        session.flush()
        transcript = Transcript(audio_track_id=track.id, model_name="base")
        session.add(transcript)
        session.flush()
        return session, v, transcript

    def test_transcript_mode_no_gap_returns_zero_cuts(self, tmp_path):
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.scoring.scenes import compute_scenes
        session, v, transcript = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=0, end_ms=10_000, text="a"))
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=10_500, end_ms=20_000, text="b"))
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript", transcript_gap_s=3.0)
        finally:
            session.close()
        assert result == 0

    def test_transcript_mode_gap_exceeds_threshold_creates_boundary(self, tmp_path):
        from yuu_clip.db.models import SceneBoundary, TranscriptSegment
        from yuu_clip.scoring.scenes import compute_scenes
        session, v, transcript = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=0, end_ms=10_000, text="a"))
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=15_000, end_ms=25_000, text="b"))
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript", transcript_gap_s=3.0)
            boundaries = session.query(SceneBoundary).filter_by(video_id=v.id).all()
        finally:
            session.close()
        assert result == 1
        assert boundaries[0].timecode_ms == 15_000

    def test_transcript_mode_no_transcribed_tracks_returns_zero(self, tmp_path):
        from yuu_clip.db.models import AudioTrack, Video, make_session
        from yuu_clip.scoring.scenes import compute_scenes
        session = make_session(tmp_path / "t2.db")
        v = Video(path=str(tmp_path / "v2.mkv"), filename="v2.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        track = AudioTrack(video_id=v.id, stream_index=0, label="combined", do_transcribe=False, do_score=True)
        session.add(track)
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript")
        finally:
            session.close()
        assert result == 0


class TestComputeScenesFastModeSegment:
    def test_keyframes_windowed_and_segment_relative_for_split(self, tmp_path, monkeypatch):
        # In fast mode a split segment's keyframes come off the shared parent file
        # (parent timeline) while its transcript is segment-relative; keyframes must
        # be filtered to the segment window and re-based, or the two timelines mix.
        from yuu_clip.db.models import SceneBoundary, Video, make_session
        from yuu_clip.scoring import scenes
        session = make_session(tmp_path / "seg.db")
        seg = Video(
            path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done",
            duration_ms=120_000, segment_start_s=10.0, segment_end_s=70.0,
        )
        session.add(seg)
        session.flush()
        # Parent-timeline keyframes; window [10s,70s) keeps 15s and 40s, offset -10s.
        monkeypatch.setattr(scenes, "_detect_keyframes", lambda _p: [5_000, 15_000, 40_000, 80_000])
        try:
            n = scenes.compute_scenes(seg, session, mode="fast")
            rows = session.query(SceneBoundary).filter_by(video_id=seg.id).order_by(SceneBoundary.timecode_ms).all()
        finally:
            session.close()
        assert [r.timecode_ms for r in rows] == [5_000, 30_000]
        assert n == 2


# ---------------------------------------------------------------------------
# _detect_keyframes - bug-hunt 4.2: the ffprobe timeout was too short for a
# long recording (the exact case "fast" mode targets), and a non-zero exit
# was never checked, silently degrading to transcript-gaps-only with no trace.
# ---------------------------------------------------------------------------

class TestDetectKeyframes:
    def test_extracts_keyframe_timestamps_from_a_successful_run(self, monkeypatch):
        import subprocess
        import types

        from yuu_clip import config as config_mod
        from yuu_clip.scoring import scenes

        monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))
        stdout = "5.000000,K\n5.500000,\n15.000000,K__\n"
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: types.SimpleNamespace(returncode=0, stdout=stdout, stderr=""),
        )
        assert scenes._detect_keyframes("v.mkv") == [5_000, 15_000]

    def test_uses_a_generous_timeout_for_a_full_packet_demux(self, monkeypatch):
        # A full-file packet scan scales with recording length/bitrate; the old
        # 30s timeout contradicted the module's own "10h+ VODs" fast-mode claim.
        import subprocess
        import types

        from yuu_clip import config as config_mod
        from yuu_clip.scoring import scenes

        monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))
        captured = {}

        def _fake_run(*args, **kwargs):
            captured["timeout"] = kwargs.get("timeout")
            return types.SimpleNamespace(returncode=0, stdout="", stderr="")

        monkeypatch.setattr(subprocess, "run", _fake_run)
        scenes._detect_keyframes("v.mkv")
        assert captured["timeout"] >= 300

    def test_nonzero_exit_logs_a_warning_and_returns_empty(self, monkeypatch, caplog):
        import logging
        import subprocess
        import types

        from yuu_clip import config as config_mod
        from yuu_clip.scoring import scenes

        monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **kw: types.SimpleNamespace(returncode=1, stdout="", stderr="Invalid data found"),
        )
        with caplog.at_level(logging.WARNING, logger="yuu_clip.scoring.scenes"):
            result = scenes._detect_keyframes("v.mkv")
        assert result == []
        assert any("ffprobe exited 1" in r.message for r in caplog.records)

    def test_timeout_expiry_still_degrades_gracefully(self, monkeypatch):
        import subprocess

        from yuu_clip import config as config_mod
        from yuu_clip.scoring import scenes

        monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

        def _timeout(*a, **kw):
            raise subprocess.TimeoutExpired(cmd="ffprobe", timeout=kw.get("timeout"))

        monkeypatch.setattr(subprocess, "run", _timeout)
        assert scenes._detect_keyframes("v.mkv") == []
