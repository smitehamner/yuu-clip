"""yuu_clip/scoring/engine.py - the Visual axis (Stage 0).

Pure (MagicMock) engine tests: the 4th "Visual" dimension lifts Visual and
Overall in isolation without touching the three narrative axes, and the
all-weights-zero edge still yields "no opinion". Seeded-DB engine tests live in
tests/integration/test_scoring_engine.py.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from yuu_clip.config import Config
from yuu_clip.scoring.engine import ScoringEngine, _compute_overall
from yuu_clip.scoring.protocol import ScoreResult


def _partial_scorer(weight=1.0, **dims):
    """Scorer emitting ONLY the named dimensions (others stay None - no opinion)."""
    scorer = MagicMock()
    scorer.name = "visual_probe"
    scorer.is_available.return_value = True
    scorer.weight = weight
    scorer.score.return_value = ScoreResult(**dims)
    return scorer


def _clip():
    clip = MagicMock()
    clip.tags = []
    clip.transcript_excerpt = None
    clip.score_funny = clip.score_dramatic = clip.score_action = 0.0
    clip.score_visual = 0.0
    clip.score_overall = 0.0
    clip.description = clip.description_long = ""
    clip.scored_at = None
    return clip


class TestVisualAxis:
    def test_visual_only_scorer_lifts_visual_and_overall(self):
        cfg = Config()
        engine = ScoringEngine(cfg, [_partial_scorer(score_visual=1.0, weight=1.0)])
        clip = _clip()
        engine.score_clip(clip, None)

        assert clip.score_visual == pytest.approx(1.0)
        # The three narrative axes are untouched by a visual-only scorer.
        assert clip.score_funny == 0.0
        assert clip.score_dramatic == 0.0
        assert clip.score_action == 0.0

        denom = (
            cfg.score_funny_weight + cfg.score_dramatic_weight
            + cfg.score_action_weight + cfg.score_visual_weight
        )
        assert clip.score_overall == pytest.approx(cfg.score_visual_weight / denom)

    def test_visual_scorer_does_not_dilute_a_narrative_axis(self):
        # An action scorer and a visual scorer must each land their own axis at
        # full value - neither drags the other toward a shared average.
        cfg = Config()
        engine = ScoringEngine(
            cfg,
            [
                _partial_scorer(score_action=1.0, weight=1.0),
                _partial_scorer(score_visual=1.0, weight=1.0),
            ],
        )
        clip = _clip()
        engine.score_clip(clip, None)
        assert clip.score_action == pytest.approx(1.0)   # not 0.5
        assert clip.score_visual == pytest.approx(1.0)   # not 0.5

    def test_compute_overall_includes_visual_weight(self):
        cfg = Config()
        cfg.score_funny_weight = 1.0
        cfg.score_dramatic_weight = 0.0
        cfg.score_action_weight = 0.0
        cfg.score_visual_weight = 1.0
        # (1*1 + 0 + 0 + 1*1) / (1 + 0 + 0 + 1) = 1.0
        assert _compute_overall(cfg, 1.0, 0.0, 0.0, 1.0) == pytest.approx(1.0)

    def test_all_four_dim_weights_zero_returns_none(self):
        cfg = Config()
        cfg.score_funny_weight = 0.0
        cfg.score_dramatic_weight = 0.0
        cfg.score_action_weight = 0.0
        cfg.score_visual_weight = 0.0
        assert _compute_overall(cfg, 0.5, 0.5, 0.5, 0.5) is None

    def test_visual_weight_alone_still_computes_overall(self):
        # Zeroing the three narrative axes but keeping Visual is a valid opinion.
        cfg = Config()
        cfg.score_funny_weight = 0.0
        cfg.score_dramatic_weight = 0.0
        cfg.score_action_weight = 0.0
        cfg.score_visual_weight = 0.5
        assert _compute_overall(cfg, 0.0, 0.0, 0.0, 0.8) == pytest.approx(0.8)
