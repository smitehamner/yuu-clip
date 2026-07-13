"""VisualActivityScorer - lifts the Visual axis from on-screen motion.

Reads the model-free VisualActivity timeline (analyze/motion.py) for a clip's
window and turns it into a 0-1 ``score_visual`` from the window's peak and mean
frame-diff intensity. Emits None for the other three axes - visual activity is a
pixel signal, so it must never touch Funny / Dramatic / Action (the engine
normalizes each dimension only over the scorers that emit it).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

# Mean absolute inter-frame pixel difference (0-255 gray scale) that maps to a
# full 1.0 Visual score. A sustained delta this large is strong on-screen motion;
# peak and mean are blended below so a single-frame spike can't max the score alone.
_MAX_INTENSITY = 30.0


class VisualActivityScorer:
    name = "visual_activity"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight = config.scorer_visual_weight

    def is_available(self) -> bool:
        return self._config.scorer_visual_enabled

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        from yuu_clip.db.models import VisualActivity

        if clip.duration_ms <= 0:
            return ScoreResult()

        intensities = [
            row.intensity
            for row in session.query(VisualActivity)
            .filter(
                VisualActivity.video_id == clip.video_id,
                VisualActivity.timecode_ms >= clip.start_ms,
                VisualActivity.timecode_ms < clip.end_ms,
            )
            .all()
        ]
        if not intensities:
            return ScoreResult()

        peak = max(intensities)
        mean = sum(intensities) / len(intensities)
        blended = (peak + mean) / 2.0
        score = min(1.0, blended / _MAX_INTENSITY)

        return ScoreResult(
            score_visual=score,
            tags=["visual_scored"] if score > 0 else [],
            notes={"visual_peak": round(peak, 2), "visual_mean": round(mean, 2)},
        )
