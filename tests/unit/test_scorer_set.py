"""yuu_clip/scoring/scorer_set.py - canonical scorer-set factory.

Pure construction tests (no DB, no models loaded): the full analyze-time set, the
LLM-only rescore set, and the scene set are built here so a rescore path cannot
drift from the analyze pass. See the cohesion finding these guard against
(LLM-only rescore silently dropped Visual/laugh).
"""

from __future__ import annotations

from yuu_clip.config import Config
from yuu_clip.scoring.scorer_set import (
    build_clip_scorers,
    build_llm_scorers,
    build_scene_scorers,
)


def _names(scorers):
    return [s.name for s in scorers]


def test_build_clip_scorers_is_the_full_ordered_set():
    scorers = build_clip_scorers(Config())
    assert _names(scorers) == [
        "audio_energy",
        "scene_cuts",
        "visual_activity",
        "laugh",
        "lexicon",
        "speech_rate",
        "speaker_churn",
        "prosody",
        "audio_event",
        "llm",
    ]


def test_build_clip_scorers_reuses_passed_instances():
    """The analyze path builds laugh/audio_event early for availability notices and
    checks their load_failed after; the factory must reuse those exact instances."""
    config = Config()
    from yuu_clip.scoring.audio_event import AudioEventScorer
    from yuu_clip.scoring.laugh import LaughScorer

    laugh_scorer = LaughScorer(config)
    audio_event_scorer = AudioEventScorer(config)
    scorers = build_clip_scorers(
        config, laugh_scorer=laugh_scorer, audio_event_scorer=audio_event_scorer
    )
    by_name = {s.name: s for s in scorers}
    assert by_name["laugh"] is laugh_scorer
    assert by_name["audio_event"] is audio_event_scorer


def test_build_clip_scorers_passes_context_to_llm():
    scorers = build_clip_scorers(Config(), context_text="world lore")
    llm = next(s for s in scorers if s.name == "llm")
    assert llm._context_text == "world lore"


def test_build_llm_scorers_is_single_llm_scorer():
    scorers = build_llm_scorers(Config(), context_text="lore")
    assert _names(scorers) == ["llm"]
    assert scorers[0]._scene_mode is False
    assert scorers[0]._context_text == "lore"


def test_build_scene_scorers_is_scene_mode_llm():
    scorers = build_scene_scorers(Config(), context_text="lore")
    assert _names(scorers) == ["llm"]
    assert scorers[0]._scene_mode is True
    assert scorers[0]._context_text == "lore"
