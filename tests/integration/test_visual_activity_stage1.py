"""Video-heavy analysis Stage 1: the frame-diff timeline lifts the Visual axis.

Exercises the scorer wiring end to end through ScoringEngine (SceneCutScorer +
VisualActivityScorer, both feeding score_visual): a candidate overlapping a silent
high-motion span scores Visual up, the scene-only path still works, and a candidate
with neither signal stays at zero Visual.
"""
from __future__ import annotations

from yuu_clip.config import Config
from yuu_clip.db.models import (
    ClipCandidate,
    SceneBoundary,
    Video,
    VisualActivity,
    make_session,
)
from yuu_clip.scoring.engine import ScoringEngine
from yuu_clip.scoring.scenes import SceneCutScorer
from yuu_clip.scoring.visual import VisualActivityScorer


def _engine(config):
    return ScoringEngine(config, scorers=[SceneCutScorer(config), VisualActivityScorer(config)])


def _seed(tmp_path):
    session = make_session(tmp_path / "test.db")
    v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
    session.add(v)
    session.flush()
    return session, v


def _clip(session, video_id, start_ms, end_ms):
    clip = ClipCandidate(video_id=video_id, start_ms=start_ms, end_ms=end_ms, status="pending")
    session.add(clip)
    session.flush()
    return clip


def test_silent_high_motion_span_lifts_overlapping_candidate(tmp_path):
    config = Config()
    session, v = _seed(tmp_path)
    clip = _clip(session, v.id, 0, 60_000)
    try:
        # No scene cuts, no transcript - only on-screen activity.
        for ms in range(0, 60_000, 500):
            session.add(VisualActivity(video_id=v.id, timecode_ms=ms, intensity=40.0))
        session.flush()
        _engine(config).score_clip(clip, session)
        session.flush()
        assert clip.score_visual > 0.0
        assert clip.score_action == 0.0   # visual signal never feeds Action
        assert clip.score_overall > 0.0
    finally:
        session.close()


def test_scene_only_path_still_scores_visual(tmp_path):
    config = Config()
    session, v = _seed(tmp_path)
    clip = _clip(session, v.id, 0, 60_000)
    try:
        # Scene cuts but no activity timeline: SceneCutScorer alone lifts Visual.
        for ms in (10_000, 20_000, 30_000, 40_000, 50_000):
            session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
        session.flush()
        _engine(config).score_clip(clip, session)
        session.flush()
        assert clip.score_visual > 0.0
        assert "scenes_scored" in clip.tags
    finally:
        session.close()


def test_both_signals_combine_on_visual(tmp_path):
    config = Config()
    session, v = _seed(tmp_path)
    clip = _clip(session, v.id, 0, 60_000)
    try:
        for ms in (10_000, 20_000, 30_000, 40_000, 50_000):
            session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
        for ms in range(0, 60_000, 500):
            session.add(VisualActivity(video_id=v.id, timecode_ms=ms, intensity=40.0))
        session.flush()
        _engine(config).score_clip(clip, session)
        session.flush()
        assert clip.score_visual > 0.0
        assert "scenes_scored" in clip.tags
        assert "visual_scored" in clip.tags
    finally:
        session.close()


def test_no_visual_signal_leaves_visual_zero(tmp_path):
    config = Config()
    session, v = _seed(tmp_path)
    clip = _clip(session, v.id, 0, 60_000)
    try:
        _engine(config).score_clip(clip, session)
        session.flush()
        assert clip.score_visual == 0.0
        assert "visual_scored" not in clip.tags
    finally:
        session.close()
