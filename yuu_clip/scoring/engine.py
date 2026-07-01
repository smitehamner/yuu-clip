from __future__ import annotations

from typing import TYPE_CHECKING

from yuu_clip.log import get_logger
from yuu_clip.scoring.protocol import Scorer, ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

_log = get_logger(__name__)


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


class ScoringEngine:
    def __init__(self, config: "Config", scorers: list[Scorer]) -> None:
        self._config  = config
        self._scorers = [s for s in scorers if s.is_available()]
        if not self._scorers:
            _log.warning("ScoringEngine: no scorers are available — clips will not be scored")

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
