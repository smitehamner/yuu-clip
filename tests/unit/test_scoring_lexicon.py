"""yuu_clip/scoring/lexicon.py - curated keyword-density scoring (no model)."""

from __future__ import annotations

from unittest.mock import MagicMock


def _make_scorer(enabled=True, weight=1.0):
    from yuu_clip.config import Config
    from yuu_clip.scoring.lexicon import LexiconScorer
    cfg = Config()
    cfg.scorer_lexicon_enabled = enabled
    cfg.scorer_lexicon_weight = weight
    return LexiconScorer(cfg)


def _make_clip(excerpt="", duration_ms=60_000):
    clip = MagicMock()
    clip.id = 1
    clip.start_ms = 0
    clip.end_ms = duration_ms
    clip.transcript_excerpt = excerpt
    return clip


class TestAvailability:
    def test_available_when_enabled(self):
        assert _make_scorer(enabled=True).is_available() is True

    def test_unavailable_when_disabled(self):
        assert _make_scorer(enabled=False).is_available() is False

    def test_disabled_reason_is_user_facing(self):
        available, reason = _make_scorer(enabled=False).available()
        assert available is False
        assert "turned off" in reason


class TestScore:
    def test_action_markers_score_action_only(self):
        scorer = _make_scorer()
        result = scorer.score(_make_clip("Player: go go go push push, reload now"), None)
        assert result.score_action > 0.0
        assert result.score_funny is None
        assert result.score_dramatic is None
        assert "lexicon_scored" in result.tags

    def test_funny_markers_score_funny(self):
        scorer = _make_scorer()
        result = scorer.score(_make_clip("Alex: lmao that was hilarious no way"), None)
        assert result.score_funny > 0.0

    def test_dramatic_markers_score_dramatic(self):
        scorer = _make_scorer()
        result = scorer.score(_make_clip("Yuu: how could you betray me, I trusted you"), None)
        assert result.score_dramatic > 0.0

    def test_empty_excerpt_returns_no_transcript_tag(self):
        result = _make_scorer().score(_make_clip(""), None)
        assert "lexicon_no_transcript" in result.tags
        assert result.score_funny is None
        assert result.score_dramatic is None
        assert result.score_action is None

    def test_no_markers_returns_no_markers_tag(self):
        result = _make_scorer().score(_make_clip("Player: hello there friend"), None)
        assert "lexicon_no_markers" in result.tags
        assert result.score_funny is None
        assert result.score_dramatic is None
        assert result.score_action is None

    def test_speaker_prefix_named_after_marker_does_not_self_trip(self):
        # A speaker literally named "Betray" must not match the dramatic marker on
        # every line they speak - the "Name:" prefix is stripped before matching.
        result = _make_scorer().score(_make_clip("Betray: hello there friend"), None)
        assert result.score_dramatic is None
        assert "lexicon_no_markers" in result.tags

    def test_score_bounded_at_one(self):
        scorer = _make_scorer()
        dense = "Player: " + "go go go push reload clutch " * 5
        result = scorer.score(_make_clip(dense, duration_ms=30_000), None)
        assert result.score_action == 1.0

    def test_higher_density_scores_higher(self):
        scorer = _make_scorer()
        sparse = scorer.score(_make_clip("Player: reload", duration_ms=60_000), None)
        dense = scorer.score(_make_clip("Player: reload reload reload", duration_ms=60_000), None)
        assert dense.score_action > sparse.score_action

    def test_deterministic(self):
        scorer = _make_scorer()
        excerpt = "Alex: lmao go go go how could you"
        first = scorer.score(_make_clip(excerpt), None)
        second = scorer.score(_make_clip(excerpt), None)
        assert (first.score_funny, first.score_dramatic, first.score_action) == \
               (second.score_funny, second.score_dramatic, second.score_action)


class TestDensityScore:
    def test_zero_hits_is_zero(self):
        from yuu_clip.scoring.lexicon import _density_score
        assert _density_score(0, 30.0) == 0.0

    def test_zero_duration_is_zero(self):
        from yuu_clip.scoring.lexicon import _density_score
        assert _density_score(5, 0.0) == 0.0

    def test_saturates_at_one(self):
        from yuu_clip.scoring.lexicon import _density_score
        assert _density_score(100, 30.0) == 1.0
