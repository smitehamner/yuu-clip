"""yuu_clip/pipeline/vision_describe.py - opt-in auto vision-LLM description
(video-heavy analysis Stage 4)."""
from __future__ import annotations

from types import SimpleNamespace


def _clip(clip_id, excerpt="", score_visual=0.0, vision_analyzed_at=None):
    return SimpleNamespace(
        id=clip_id, transcript_excerpt=excerpt, score_visual=score_visual,
        vision_analyzed_at=vision_analyzed_at, tags=[], description="",
    )


class TestSelectVisionCandidates:
    def test_picks_highest_scoring_textless_clips(self):
        from yuu_clip.pipeline.vision_describe import select_vision_candidates
        low = _clip(1, score_visual=0.2)
        high = _clip(2, score_visual=0.9)
        mid = _clip(3, score_visual=0.5)
        result = select_vision_candidates([low, high, mid], topn=2)
        assert result == [high, mid]

    def test_excludes_clips_with_a_transcript(self):
        from yuu_clip.pipeline.vision_describe import select_vision_candidates
        talk = _clip(1, excerpt="Yuu: we won", score_visual=0.9)
        silent = _clip(2, excerpt="", score_visual=0.1)
        result = select_vision_candidates([talk, silent], topn=8)
        assert result == [silent]

    def test_excludes_already_vision_analyzed_clips(self):
        from datetime import datetime, timezone

        from yuu_clip.pipeline.vision_describe import select_vision_candidates
        done = _clip(1, score_visual=0.9, vision_analyzed_at=datetime.now(timezone.utc))
        pending = _clip(2, score_visual=0.4)
        result = select_vision_candidates([done, pending], topn=8)
        assert result == [pending]

    def test_respects_the_cap(self):
        from yuu_clip.pipeline.vision_describe import select_vision_candidates
        clips = [_clip(i, score_visual=i / 10) for i in range(20)]
        result = select_vision_candidates(clips, topn=3)
        assert len(result) == 3
        assert [c.id for c in result] == [19, 18, 17]

    def test_empty_when_no_eligible_clips(self):
        from yuu_clip.pipeline.vision_describe import select_vision_candidates
        talk = _clip(1, excerpt="Yuu: hello", score_visual=0.9)
        assert select_vision_candidates([talk], topn=8) == []


class TestAutoDescribeVisualClipsGating:
    """Config/availability gating only - no DB, no vision call (see
    tests/integration/test_vision_describe.py for the DB-backed happy path)."""

    def _config(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for key, value in overrides.items():
            setattr(cfg, key, value)
        return cfg

    def test_disabled_by_default_makes_no_calls(self):
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips
        video = SimpleNamespace(id=1)
        config = self._config()  # visual_auto_vision_enabled defaults False
        assert config.visual_auto_vision_enabled is False
        described = auto_describe_visual_clips(video, config, session=None, proxy_dir=None)
        assert described == 0

    def test_skips_without_raising_when_vision_model_unavailable(self):
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips
        video = SimpleNamespace(id=1)
        # Enabled, but a fresh Config() has no vision model/mmproj configured, so
        # check_vision_available() returns False - this must degrade to a no-op,
        # never raise, and never touch the (deliberately None) session.
        config = self._config(visual_auto_vision_enabled=True)
        described = auto_describe_visual_clips(video, config, session=None, proxy_dir=None)
        assert described == 0
