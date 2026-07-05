"""yuu_clip/scoring/speechrate.py — words-per-second burst scoring (no model)."""

from __future__ import annotations

from unittest.mock import MagicMock


def _make_scorer(enabled=True, weight=0.5):
    from yuu_clip.config import Config
    from yuu_clip.scoring.speechrate import SpeechRateScorer
    cfg = Config()
    cfg.scorer_speech_rate_enabled = enabled
    cfg.scorer_speech_rate_weight = weight
    return SpeechRateScorer(cfg)


def _seg(text, start_ms, end_ms):
    seg = MagicMock()
    seg.text = text
    seg.start_ms = start_ms
    seg.end_ms = end_ms
    return seg


class TestSpeechRateScore:
    def _score(self, pairs):
        from yuu_clip.scoring.speechrate import speech_rate_score
        return speech_rate_score(pairs)

    def test_calm_speech_returns_none(self):
        # ~2 words/sec — ordinary conversation
        assert self._score([(6, 3.0), (4, 2.0)]) is None

    def test_fast_speech_scores_positive(self):
        # ~6 words/sec sustained — excited, rapid delivery
        assert self._score([(12, 2.0), (18, 3.0)]) > 0.0

    def test_very_fast_saturates_at_one(self):
        assert self._score([(50, 5.0)]) == 1.0

    def test_no_words_returns_none(self):
        assert self._score([(0, 3.0), (0, 1.0)]) is None

    def test_empty_returns_none(self):
        assert self._score([]) is None

    def test_higher_rate_scores_higher(self):
        slower = self._score([(9, 3.0)])   # 3 wps
        faster = self._score([(12, 3.0)])  # 4 wps
        assert faster > slower

    def test_ultrashort_segment_does_not_spike(self):
        # A single word stamped across 0.1 s would read as 10 wps as a burst, but the
        # _MIN_BURST_S guard drops it, and the calm mean keeps the clip below CALM.
        assert self._score([(1, 0.1), (6, 3.0)]) is None

    def test_bounded_zero_to_one(self):
        value = self._score([(20, 4.0)])
        assert value is not None and 0.0 <= value <= 1.0

    def test_deterministic(self):
        pairs = [(12, 2.0), (18, 3.0)]
        assert self._score(pairs) == self._score(pairs)


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
        assert "speech_rate_no_transcript" in result.tags
        assert result.score_funny is None

    def test_calm_segments_return_calm_tag(self, monkeypatch):
        segments = [_seg("one two three four", 0, 2000), _seg("five six", 2000, 3000)]
        monkeypatch.setattr(
            "yuu_clip.segments.windower.clip_window_segments", lambda *a: segments
        )
        result = _make_scorer().score(self._clip(), None)
        assert "speech_rate_calm" in result.tags
        assert result.score_funny is None
        assert result.score_action is None

    def test_fast_segments_score_funny_and_action(self, monkeypatch):
        segments = [_seg("a b c d e f g h i j k l", 0, 2000)]  # 12 words / 2 s = 6 wps
        monkeypatch.setattr(
            "yuu_clip.segments.windower.clip_window_segments", lambda *a: segments
        )
        result = _make_scorer().score(self._clip(), None)
        assert "speech_rate_scored" in result.tags
        assert result.score_funny > 0.0
        assert result.score_action == result.score_funny
        assert result.score_dramatic is None
