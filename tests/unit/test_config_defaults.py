"""Config scoring-weight defaults (Stage 0 - the Visual axis)."""

from __future__ import annotations

from yuu_clip.config import Config


def test_score_visual_weight_default_present():
    assert Config().score_visual_weight == 0.5


def test_score_visual_weight_below_narrative_axes():
    # Visual surfaces silent highlights without ever dominating a talk-heavy
    # user's ranking, so it sits below each 1.0 narrative axis by default.
    cfg = Config()
    assert cfg.score_visual_weight < cfg.score_funny_weight
    assert cfg.score_visual_weight < cfg.score_dramatic_weight
    assert cfg.score_visual_weight < cfg.score_action_weight
