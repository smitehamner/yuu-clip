"""
ScoringEngine: orchestrates all scorers and writes results back to ClipCandidate rows.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from yuu_clip.log import get_logger
from yuu_clip.scoring.protocol import ScoreResult, Scorer

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

_log = get_logger(__name__)


class ScoringEngine:
    def __init__(self, config: "Config", scorers: list[Scorer]) -> None:
        self._config  = config
        self._scorers = [s for s in scorers if s.is_available()]
        if not self._scorers:
            _log.warning("ScoringEngine: no scorers are available — clips will not be scored")

    # Tags emitted by scorers — stripped before each re-score so stale
    # results from a previous partial run don't accumulate.
    _SCORER_TAGS: frozenset[str] = frozenset({
        "energy_scored", "scenes_scored",
        "llm_scored", "llm_error", "llm_skipped", "llm_no_transcript",
    })

    def score_clip(self, clip: "ClipCandidate", session: "Session") -> None:
        """Run all available scorers and update clip.score_* fields in place."""
        if not self._scorers:
            return

        clip.tags = [t for t in clip.tags if t not in self._SCORER_TAGS]

        funny_num = dramatic_num = action_num = weight_sum = 0.0

        for scorer in self._scorers:
            result: ScoreResult = scorer.score(clip, session)
            w = scorer.weight
            funny_num    += result.score_funny    * w
            dramatic_num += result.score_dramatic * w
            action_num   += result.score_action   * w
            weight_sum   += w

            if result.description:
                clip.description = result.description
            if result.description_long:
                clip.description_long = result.description_long

            for tag in result.tags:
                existing = clip.tags
                if tag not in existing:
                    clip.tags = existing + [tag]

        if weight_sum == 0:
            return

        clip.score_funny    = funny_num    / weight_sum
        clip.score_dramatic = dramatic_num / weight_sum
        clip.score_action   = action_num   / weight_sum

        cfg = self._config
        dim_total = cfg.score_funny_weight + cfg.score_dramatic_weight + cfg.score_action_weight
        if dim_total > 0:
            clip.score_overall = (
                cfg.score_funny_weight    * clip.score_funny    +
                cfg.score_dramatic_weight * clip.score_dramatic +
                cfg.score_action_weight   * clip.score_action
            ) / dim_total

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
            if progress_cb:
                progress_cb(i, total)
        _log.info("Scoring complete for video %d: %d clip(s) scored", video.id, total)
        return total
