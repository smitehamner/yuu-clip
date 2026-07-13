"""yuu_clip/scoring/visual.py - VisualActivityScorer (Stage 1)."""
from __future__ import annotations

from yuu_clip.config import Config
from yuu_clip.db.models import ClipCandidate, Video, VisualActivity, make_session
from yuu_clip.scoring.visual import VisualActivityScorer


def _db_with_clip(tmp_path, start_ms, end_ms):
    session = make_session(tmp_path / "test.db")
    v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
    session.add(v)
    session.flush()
    clip = ClipCandidate(video_id=v.id, start_ms=start_ms, end_ms=end_ms, status="pending")
    session.add(clip)
    session.flush()
    return session, v, clip


class TestVisualActivityScorer:
    def test_zero_duration_has_no_opinion(self, tmp_path):
        session, v, clip = _db_with_clip(tmp_path, 0, 0)
        try:
            result = VisualActivityScorer(Config()).score(clip, session)
        finally:
            session.close()
        assert result.score_visual is None
        assert result.tags == []

    def test_empty_timeline_has_no_opinion(self, tmp_path):
        session, v, clip = _db_with_clip(tmp_path, 0, 60_000)
        try:
            result = VisualActivityScorer(Config()).score(clip, session)
        finally:
            session.close()
        assert result.score_visual is None
        assert result.score_action is None
        assert result.score_funny is None
        assert result.tags == []

    def test_high_activity_lifts_visual(self, tmp_path):
        session, v, clip = _db_with_clip(tmp_path, 0, 60_000)
        try:
            for ms in range(0, 60_000, 500):
                session.add(VisualActivity(video_id=v.id, timecode_ms=ms, intensity=40.0))
            session.flush()
            result = VisualActivityScorer(Config()).score(clip, session)
        finally:
            session.close()
        assert result.score_visual == 1.0  # 40 > _MAX_INTENSITY, clamped
        assert result.score_action is None  # visual signal never touches Action
        assert "visual_scored" in result.tags

    def test_low_activity_scores_low_but_present(self, tmp_path):
        session, v, clip = _db_with_clip(tmp_path, 0, 60_000)
        try:
            for ms in (10_000, 20_000, 30_000):
                session.add(VisualActivity(video_id=v.id, timecode_ms=ms, intensity=3.0))
            session.flush()
            result = VisualActivityScorer(Config()).score(clip, session)
        finally:
            session.close()
        assert 0.0 < result.score_visual < 0.2
        assert result.notes["visual_peak"] == 3.0

    def test_only_samples_inside_window_count(self, tmp_path):
        session, v, clip = _db_with_clip(tmp_path, 10_000, 20_000)
        try:
            session.add(VisualActivity(video_id=v.id, timecode_ms=5_000, intensity=100.0))   # before
            session.add(VisualActivity(video_id=v.id, timecode_ms=20_000, intensity=100.0))  # at end_ms (excluded)
            session.add(VisualActivity(video_id=v.id, timecode_ms=15_000, intensity=6.0))    # inside
            session.flush()
            result = VisualActivityScorer(Config()).score(clip, session)
        finally:
            session.close()
        assert result.notes["visual_peak"] == 6.0

    def test_peak_blended_with_mean(self, tmp_path):
        # One high spike among calm samples: blended (peak+mean)/2 keeps the spike
        # from maxing the score on its own.
        session, v, clip = _db_with_clip(tmp_path, 0, 60_000)
        try:
            session.add(VisualActivity(video_id=v.id, timecode_ms=1_000, intensity=30.0))
            for ms in (2_000, 3_000, 4_000):
                session.add(VisualActivity(video_id=v.id, timecode_ms=ms, intensity=0.0))
            session.flush()
            result = VisualActivityScorer(Config()).score(clip, session)
        finally:
            session.close()
        # peak=30, mean=7.5 -> blended=18.75 -> 18.75/30 = 0.625
        assert abs(result.score_visual - 0.625) < 1e-6

    def test_is_available_follows_config(self):
        cfg = Config()
        cfg.scorer_visual_enabled = True
        assert VisualActivityScorer(cfg).is_available() is True
        cfg.scorer_visual_enabled = False
        assert VisualActivityScorer(cfg).is_available() is False

    def test_weight_comes_from_config(self):
        cfg = Config()
        cfg.scorer_visual_weight = 1.25
        assert VisualActivityScorer(cfg).weight == 1.25
