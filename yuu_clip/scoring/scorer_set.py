"""Canonical scorer-set construction, shared by analyze-time scoring and rescore.

The full analyze-time clip scorer set lives here (not inline in `pipeline.ingest`)
so a rescore path can rebuild the *exact* set the analyze pass used. Before this
existed the set was duplicated across the ingest builder and the rescore
routes/CLI, and the rescore copies silently drifted from it - an LLM-only rescore
dropped the Visual and laugh axes the full pass produced. Keep new scorers wired
into `build_clip_scorers` so full-rescore picks them up automatically.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from yuu_clip.config import Config
    from yuu_clip.scoring.protocol import Scorer


def build_clip_scorers(
    config: "Config",
    *,
    context_text: str = "",
    laugh_scorer: Optional["Scorer"] = None,
    audio_event_scorer: Optional["Scorer"] = None,
) -> list["Scorer"]:
    """The full analyze-time clip scorer set, in engine order.

    *laugh_scorer* / *audio_event_scorer* let the analyze path pass the instances it
    already built (for availability notices and post-run `load_failed` checks); a
    rescore caller omits them and gets fresh ones.
    """
    from yuu_clip.scoring.audio_event import AudioEventScorer
    from yuu_clip.scoring.churn import SpeakerChurnScorer
    from yuu_clip.scoring.energy import AudioEnergyScorer
    from yuu_clip.scoring.laugh import LaughScorer
    from yuu_clip.scoring.lexicon import LexiconScorer
    from yuu_clip.scoring.llm import LLMScorer
    from yuu_clip.scoring.prosody import ProsodyScorer
    from yuu_clip.scoring.scenes import SceneCutScorer
    from yuu_clip.scoring.speechrate import SpeechRateScorer
    from yuu_clip.scoring.visual import VisualActivityScorer

    return [
        AudioEnergyScorer(config),
        SceneCutScorer(config),
        VisualActivityScorer(config),
        laugh_scorer or LaughScorer(config),
        LexiconScorer(config),
        SpeechRateScorer(config),
        SpeakerChurnScorer(config),
        ProsodyScorer(config),
        audio_event_scorer or AudioEventScorer(config),
        LLMScorer(config, context_text=context_text),
    ]


def build_llm_scorers(config: "Config", *, context_text: str = "") -> list["Scorer"]:
    """The LLM-only clip scorer set used by a preserve-axes rescore.

    Recomputes only Funny/Dramatic/Action (and the description); paired with
    `engine.score_clip(..., preserve_unscored_dims=True)` so the signal-derived
    axes the full pass produced (Visual, laugh) survive the rescore.
    """
    from yuu_clip.scoring.llm import LLMScorer

    return [LLMScorer(config, context_text=context_text)]


def build_scene_scorers(config: "Config", *, context_text: str = "") -> list["Scorer"]:
    """The scene scorer set (scene-mode LLM), routed to kind='scene' rows."""
    from yuu_clip.scoring.llm import LLMScorer

    return [LLMScorer(config, context_text=context_text, scene_mode=True)]


def build_rescore_scorers(
    config: "Config", *, context_text: str = "", full: bool = False
) -> tuple[list["Scorer"], bool]:
    """Return ``(scorers, preserve_unscored_dims)`` for a clip rescore.

    ``full=False`` (default): the LLM-only set, which recomputes Funny/Dramatic/Action
    and the description while *preserving* the signal-derived axes (Visual, laugh) the
    last full analysis produced. ``full=True``: the complete analyze-time set, which
    recomputes every axis from the stored signals for a clean re-score at analyze
    scale. Pairing the scorer set with its preserve flag here keeps the two rescore
    routes from choosing one without the other."""
    if full:
        return build_clip_scorers(config, context_text=context_text), False
    return build_llm_scorers(config, context_text=context_text), True
