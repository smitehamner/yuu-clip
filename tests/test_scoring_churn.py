"""yuu_clip/scoring/churn.py — speaker turn-churn / overlap scoring (no model)."""

from __future__ import annotations

from unittest.mock import MagicMock


def _make_scorer(enabled=True, weight=0.5):
    from yuu_clip.config import Config
    from yuu_clip.scoring.churn import SpeakerChurnScorer
    cfg = Config()
    cfg.scorer_churn_enabled = enabled
    cfg.scorer_churn_weight = weight
    return SpeakerChurnScorer(cfg)


def _seg(speaker_id, speaker_label, start_ms, end_ms):
    seg = MagicMock()
    seg.speaker_id = speaker_id
    seg.speaker_label = speaker_label
    seg.start_ms = start_ms
    seg.end_ms = end_ms
    return seg


class TestSpeakerKey:
    def test_prefers_id_over_label(self):
        from yuu_clip.scoring.churn import _segment_speaker_key
        assert _segment_speaker_key(_seg(7, "SPEAKER_02", 0, 1)) == "id:7"

    def test_falls_back_to_label(self):
        from yuu_clip.scoring.churn import _segment_speaker_key
        assert _segment_speaker_key(_seg(None, "SPEAKER_02", 0, 1)) == "label:SPEAKER_02"

    def test_none_when_undiarized(self):
        from yuu_clip.scoring.churn import _segment_speaker_key
        assert _segment_speaker_key(_seg(None, None, 0, 1)) is None


class TestChurnScore:
    def _score(self, turns, window_s):
        from yuu_clip.scoring.churn import churn_score
        return churn_score(turns, window_s)

    def test_single_speaker_returns_none(self):
        turns = [("id:1", 0, 2000), ("id:1", 2000, 4000)]
        assert self._score(turns, 30.0) is None

    def test_no_speakers_returns_none(self):
        # diarization off — every key None
        turns = [(None, 0, 2000), (None, 2000, 4000)]
        assert self._score(turns, 30.0) is None

    def test_rapid_alternation_scores_positive(self):
        turns = [
            ("id:1", 0, 2000), ("id:2", 2000, 4000),
            ("id:1", 4000, 6000), ("id:2", 6000, 8000),
        ]
        assert self._score(turns, 30.0) > 0.0

    def test_overlap_raises_score(self):
        no_overlap = [("id:1", 0, 2000), ("id:2", 2000, 4000)]
        overlap = [("id:1", 0, 3000), ("id:2", 1000, 4000)]
        assert self._score(overlap, 30.0) > self._score(no_overlap, 30.0)

    def test_bounded_at_one(self):
        # Many rapid switches with heavy cross-talk in a short window
        turns = [("id:1", i * 200, i * 200 + 800) for i in range(20)]
        turns += [("id:2", i * 200 + 100, i * 200 + 900) for i in range(20)]
        value = self._score(turns, 4.0)
        assert value == 1.0

    def test_zero_window_returns_none(self):
        turns = [("id:1", 0, 2000), ("id:2", 2000, 4000)]
        assert self._score(turns, 0.0) is None

    def test_deterministic(self):
        turns = [("id:1", 0, 2000), ("id:2", 1500, 3500)]
        assert self._score(turns, 30.0) == self._score(turns, 30.0)


class TestAvailability:
    def test_available_when_enabled(self):
        assert _make_scorer(enabled=True).is_available() is True

    def test_unavailable_when_disabled(self):
        assert _make_scorer(enabled=False).is_available() is False

    def test_disabled_reason_is_user_facing(self):
        available, reason = _make_scorer(enabled=False).availability()
        assert available is False
        assert "turned off" in reason


class TestScore:
    def _clip(self):
        clip = MagicMock()
        clip.start_ms = 0
        clip.end_ms = 30_000
        return clip

    def test_no_segments_returns_no_transcript_tag(self, monkeypatch):
        monkeypatch.setattr(
            "yuu_clip.segments.windower.clip_window_segments", lambda *a: []
        )
        result = _make_scorer().score(self._clip(), None)
        assert "churn_no_transcript" in result.tags

    def test_undiarized_returns_no_speakers_tag(self, monkeypatch):
        segments = [_seg(None, None, 0, 2000), _seg(None, None, 2000, 4000)]
        monkeypatch.setattr(
            "yuu_clip.segments.windower.clip_window_segments", lambda *a: segments
        )
        result = _make_scorer().score(self._clip(), None)
        assert "churn_no_speakers" in result.tags
        assert result.score_funny is None

    def test_two_speakers_score_funny_and_action(self, monkeypatch):
        segments = [
            _seg(1, "SPEAKER_00", 0, 2000), _seg(2, "SPEAKER_01", 2000, 4000),
            _seg(1, "SPEAKER_00", 4000, 6000), _seg(2, "SPEAKER_01", 6000, 8000),
        ]
        monkeypatch.setattr(
            "yuu_clip.segments.windower.clip_window_segments", lambda *a: segments
        )
        result = _make_scorer().score(self._clip(), None)
        assert "churn_scored" in result.tags
        assert result.score_funny > 0.0
        assert result.score_action == result.score_funny
        assert result.score_dramatic is None
