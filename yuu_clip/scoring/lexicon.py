"""
LexiconScorer - nudges funny / dramatic / action from curated keyword density.

Zero-dependency scorer that complements the audio-energy, scene-cut, laugh, and
(optional) LLM signals: it scans a clip's transcript excerpt for genre-neutral
marker phrases and turns their per-minute density into a 0–1 score per dimension.
A dimension with no markers returns None ("no opinion"), so it never drags that
dimension's weighted average down.

The lexicons below are deliberately editable and content-agnostic - a *starting*
vocabulary, not an exhaustive classifier. Matching reuses
scoring/textmatch.find_matches (word-boundary aware, case-insensitive) after
stripping "Name:" speaker prefixes so a speaker whose name equals a marker word
never trips their own lines.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult
from yuu_clip.scoring.textmatch import MatchTerm, find_matches, strip_speaker_prefixes

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

# Marker phrases per scoring dimension. Genre-neutral by design (see plan 13 de-RP):
# laughter/absurdity → funny, confrontation/emotion → dramatic, urgency/combat and
# profanity intensity → action. Curated starting vocabulary - edit freely.
_LEXICONS: dict[str, tuple[str, ...]] = {
    "funny": (
        "lol", "lmao", "lmfao", "rofl", "hilarious", "so funny", "too funny",
        "cracking up", "i'm dying", "i'm crying", "oh my god", "oh my gosh",
        "what the", "wtf", "no way", "are you kidding", "you're kidding",
        "ridiculous", "absurd", "bruh", "goofy", "clown", "cursed", "comedy",
    ),
    "dramatic": (
        "i can't believe", "how could you", "how dare", "betray", "betrayed",
        "i trusted you", "you promised", "unbelievable", "are you serious",
        "terrified", "terrifying", "so scared", "please no", "oh no",
        "we need to talk", "i'm sorry", "forgive", "regret", "devastated",
        "heartbroken", "shocked", "why would you", "it's over", "goodbye",
    ),
    "action": (
        "go go go", "let's go", "come on", "watch out", "look out", "behind you",
        "incoming", "reload", "clutch", "get him", "got him", "take the shot",
        "nice shot", "cover me", "on your left", "on your right", "push",
        "flank", "they're coming", "hurry", "attack", "defend", "revive",
        "fuck", "shit", "damn", "holy shit",
    ),
}

# 6+ marker occurrences per minute saturate a dimension at 1.0 - mirrors the
# per-minute normalisation LaughScorer uses, so lexicon density is comparable to it.
_SATURATION_PER_MIN = 6.0

_MATCH_TERMS: dict[str, list[MatchTerm]] = {
    dimension: [MatchTerm(phrase=phrase, mode="case_insensitive") for phrase in phrases]
    for dimension, phrases in _LEXICONS.items()
}


def _density_score(hit_count: int, duration_s: float) -> float:
    """Return a 0–1 score from marker hits per minute, saturating at the cap."""
    if hit_count == 0 or duration_s <= 0:
        return 0.0
    per_minute = hit_count / duration_s * 60
    return min(1.0, per_minute / _SATURATION_PER_MIN)


class LexiconScorer:
    name = "lexicon"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight = config.scorer_lexicon_weight

    def is_available(self) -> bool:
        return self.available()[0]

    def available(self) -> tuple[bool, str]:
        """(available, reason) - reason is a user-facing explanation when unavailable."""
        if not self._config.scorer_lexicon_enabled:
            return False, "lexicon scoring is turned off in Settings"
        return True, ""

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        if not clip.transcript_excerpt:
            return ScoreResult(tags=["lexicon_no_transcript"])

        text = strip_speaker_prefixes(clip.transcript_excerpt)
        duration_s = (clip.end_ms - clip.start_ms) / 1000.0

        scores: dict[str, float | None] = {}
        notes: dict[str, int] = {}
        for dimension, terms in _MATCH_TERMS.items():
            hits = sum(match.count for match in find_matches(text, terms))
            scores[dimension] = _density_score(hits, duration_s) if hits else None
            if hits:
                notes[f"{dimension}_hits"] = hits

        if all(value is None for value in scores.values()):
            return ScoreResult(tags=["lexicon_no_markers"])

        return ScoreResult(
            score_funny=scores["funny"],
            score_dramatic=scores["dramatic"],
            score_action=scores["action"],
            tags=["lexicon_scored"],
            notes=notes,
        )
