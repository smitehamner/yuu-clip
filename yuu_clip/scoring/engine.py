from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from yuu_clip.log import get_logger
from yuu_clip.scoring.protocol import Scorer, ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, HotWord, Video

_log = get_logger(__name__)

# Hot-word boost range and per-target clamp, on the same 0-1 scale as score_*.
HOTWORD_BOOST_MIN = -0.5
HOTWORD_BOOST_MAX = 0.5
_HOTWORD_TARGET_CLAMP = 0.3
_HOTWORD_SUB_SCORE_TARGETS = ("funny", "dramatic", "action")


def _compute_overall(cfg: "Config", funny: float, dramatic: float, action: float) -> float | None:
    """Return the weighted overall score, or None when all dimension weights are zero."""
    dim_total = cfg.score_funny_weight + cfg.score_dramatic_weight + cfg.score_action_weight
    if dim_total == 0:
        return None
    return (
        cfg.score_funny_weight * funny +
        cfg.score_dramatic_weight * dramatic +
        cfg.score_action_weight * action
    ) / dim_total


def apply_hotword_boosts(clip: "ClipCandidate", hot_words: list["HotWord"], config: "Config") -> None:
    """Match enabled hot-words against *clip*'s transcript excerpt and apply their
    score boosts, storing the matches and the boost actually applied.

    Idempotent: re-running this (e.g. via the hotword-rescan route, or a second
    score_clip pass) subtracts the boost it applied last time before adding the
    freshly computed one, so repeated calls never compound. A phrase counts once per
    clip regardless of repeat count; multiple distinct phrases stack, clamped to
    ±0.3 per target. score_overall_user (the manual override) is never touched.

    LLM-semantic matches (mode="semantic") are produced only by the Stage 2 scan —
    this function never runs the text matcher against them, but does preserve any
    already stored on the clip (recomputing their boost from the current hot_words
    list, and dropping them if their entry was since deleted) so a text-only rescan
    never wipes semantic results.
    """
    from yuu_clip.scoring.textmatch import MatchTerm, find_matches, strip_speaker_prefixes

    term_by_key = {(hw.phrase, hw.match_mode): hw for hw in hot_words if hw.enabled}

    text = strip_speaker_prefixes(clip.transcript_excerpt or "")
    text_terms = [
        MatchTerm(phrase=hw.phrase, mode=hw.match_mode)
        for hw in hot_words
        if hw.enabled and hw.match_mode in ("exact", "case_insensitive")
    ]
    text_matches = find_matches(text, text_terms) if text else []
    matches = [
        {"phrase": m.phrase, "mode": m.mode, "count": m.count} for m in text_matches
    ] + [
        m for m in (clip.hotword_matches or [])
        if m.get("mode") == "semantic" and (m.get("phrase"), "semantic") in term_by_key
    ]

    new_boost = {"overall": 0.0, "funny": 0.0, "dramatic": 0.0, "action": 0.0}
    for m in matches:
        hw = term_by_key.get((m["phrase"], m["mode"]))
        if hw:
            new_boost[hw.target] += hw.boost
    for target in new_boost:
        new_boost[target] = max(-_HOTWORD_TARGET_CLAMP, min(_HOTWORD_TARGET_CLAMP, new_boost[target]))

    old_boost = clip.hotword_boost or {}
    sub_score_changed = any(
        new_boost[target] != old_boost.get(target, 0.0) for target in _HOTWORD_SUB_SCORE_TARGETS
    )
    for target in _HOTWORD_SUB_SCORE_TARGETS:
        current = getattr(clip, f"score_{target}")
        updated = current - old_boost.get(target, 0.0) + new_boost[target]
        setattr(clip, f"score_{target}", max(0.0, min(1.0, updated)))

    # Only re-derive overall from the (possibly just-boosted) sub-scores when a
    # sub-score boost actually changed — a cheap rescan with nothing to update must
    # leave score_overall byte-for-byte untouched, not silently re-average it against
    # the *current* scoring weights (which may differ from whatever produced the
    # stored value, e.g. after the user edits Settings weights separately).
    if sub_score_changed:
        recomputed = _compute_overall(config, clip.score_funny, clip.score_dramatic, clip.score_action)
        if recomputed is not None:
            clip.score_overall = recomputed
        clip.score_overall = max(0.0, min(1.0, clip.score_overall + new_boost["overall"]))
    else:
        updated_overall = clip.score_overall - old_boost.get("overall", 0.0) + new_boost["overall"]
        clip.score_overall = max(0.0, min(1.0, updated_overall))

    clip.hotword_matches = matches
    clip.hotword_boost = new_boost


class ScoringEngine:
    def __init__(
        self, config: "Config", scorers: list[Scorer], hot_words: list["HotWord"] | None = None,
    ) -> None:
        self._config  = config
        self._scorers = [s for s in scorers if s.is_available()]
        # None (the default) means "caller didn't opt in" — skip hot-word matching
        # entirely rather than treating it the same as an explicitly empty list, so
        # callers that don't care about hot-words (most existing tests) see no change.
        self._hot_words = hot_words
        if not self._scorers:
            _log.warning("ScoringEngine: no scorers are available — clips will not be scored")

    @property
    def has_scorers(self) -> bool:
        return bool(self._scorers)

    # All tags a scorer may emit — stripped before each re-score so stale
    # results from a previous partial run don't accumulate.
    _SCORER_TAGS: frozenset[str] = frozenset({
        "energy_scored", "energy_no_tracks", "energy_no_data",
        "scenes_scored",
        "llm_scored", "llm_error", "llm_no_transcript",
        "laugh_transcript", "laugh_audio", "laugh_model",
        "laugh_no_transcript", "laugh_no_wav",
    })

    def score_clip(self, clip: "ClipCandidate", session: "Session") -> None:
        """Run all available scorers and update clip.score_* fields in place."""
        if not self._scorers:
            return

        clip.tags = [t for t in clip.tags if t not in self._SCORER_TAGS]
        clip.score_funny = clip.score_dramatic = clip.score_action = 0.0
        clip.score_overall = 0.0

        # Per dimension: numerator (Σ value·weight) and the weight total of the
        # scorers that actually emitted that dimension. A scorer that returns
        # None for a dimension is excluded from its denominator entirely.
        num    = {"funny": 0.0, "dramatic": 0.0, "action": 0.0}
        weight = {"funny": 0.0, "dramatic": 0.0, "action": 0.0}

        for scorer in self._scorers:
            result: ScoreResult = scorer.score(clip, session)
            for dim, value in (
                ("funny",    result.score_funny),
                ("dramatic", result.score_dramatic),
                ("action",   result.score_action),
            ):
                if value is not None:
                    num[dim]    += value * scorer.weight
                    weight[dim] += scorer.weight
            self._apply_descriptions(clip, result)
            self._merge_tags(clip, result.tags)

        if not any(weight.values()):
            _log.warning("score_clip: no scorer contributed a weighted dimension — clip %s not scored", getattr(clip, "id", "?"))
            return

        clip.score_funny    = num["funny"]    / weight["funny"]    if weight["funny"]    else 0.0
        clip.score_dramatic = num["dramatic"] / weight["dramatic"] if weight["dramatic"] else 0.0
        clip.score_action   = num["action"]   / weight["action"]   if weight["action"]   else 0.0

        overall = _compute_overall(self._config, clip.score_funny, clip.score_dramatic, clip.score_action)
        if overall is not None:
            clip.score_overall = overall

        if self._hot_words is not None:
            apply_hotword_boosts(clip, self._hot_words, self._config)

        clip.scored_at = datetime.now(timezone.utc)

    @staticmethod
    def _apply_descriptions(clip: "ClipCandidate", result: ScoreResult) -> None:
        if result.description:
            clip.description = result.description
        if result.description_long:
            clip.description_long = result.description_long

    @staticmethod
    def _merge_tags(clip: "ClipCandidate", tags: list[str]) -> None:
        for tag in tags:
            if tag not in clip.tags:
                # Full reassignment — SQLAlchemy JSON column needs a new list
                # object to detect the mutation; in-place .append() is invisible.
                clip.tags = clip.tags + [tag]

    def score_video(self, video: "Video", session: "Session", progress_cb=None) -> int:
        """Score all ClipCandidates for *video*.  Returns count scored."""
        from yuu_clip.db.models import ClipCandidate
        candidates = (
            session.query(ClipCandidate)
            .filter_by(video_id=video.id)
            .all()
        )
        total = len(candidates)
        _log.info("Scoring %d clip(s) for video %d using %d scorer(s)", total, video.id, len(self._scorers))
        for i, clip in enumerate(candidates, 1):
            self.score_clip(clip, session)
            # Commit per clip (not just flush) so the web server — a separate
            # process/connection — can see each score as soon as it's ready,
            # instead of only after the whole video finishes scoring.
            session.commit()
            if progress_cb:
                progress_cb(i, total)
        _log.info("Scoring complete for video %d: %d clip(s) scored", video.id, total)
        return total
