"""SpeechRateScorer - words-per-second bursts as an excitement / chaos signal.

Fast, dense talking (excited callouts, chaotic banter, rapid-fire reactions) marks
a livelier moment than a slow, calm stretch. Computed from the transcript segments
overlapping the clip window - zero extra dependencies. Feeds funny and action, and
abstains (None) on ordinary, calm-paced speech so it only ever nudges a clip up,
never down (the same "no signal → no opinion" contract the lexicon follows).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Iterable

from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

# Words/sec at or below CALM = ordinary conversation → no opinion. At/above FAST =
# rapid, excited delivery → saturates at 1.0. Between = a linear excitement ramp.
# Heuristic, editable: relaxed English speech sits ~2 wps, animated bursts hit 4–6.
_CALM_WPS = 2.3
_FAST_WPS = 5.0
# Ignore sub-burst segments whose per-segment rate is timestamp noise (a single
# word Whisper stamped across 0.1 s reads as an absurd words-per-sec spike).
_MIN_BURST_S = 0.6


def speech_rate_score(word_durations: Iterable[tuple[int, float]]) -> float | None:
    """Return a 0–1 excitement score from (word_count, duration_s) pairs, or None.

    Blends the clip's mean words-per-sec with its fastest qualifying segment (the
    "burst"), then ramps CALM→FAST to 0–1. Returns None when there's no usable
    speech, or when the blended rate is merely calm (so a slow clip stays silent
    rather than dragging funny/action toward zero).
    """
    valid = [(words, secs) for words, secs in word_durations if words > 0 and secs > 0]
    if not valid:
        return None

    total_words = sum(words for words, _ in valid)
    total_secs = sum(secs for _, secs in valid)
    mean_wps = total_words / total_secs

    bursts = [words / secs for words, secs in valid if secs >= _MIN_BURST_S]
    peak_wps = max(bursts) if bursts else mean_wps

    rate = (mean_wps + peak_wps) / 2.0
    if rate <= _CALM_WPS:
        return None
    return min(1.0, (rate - _CALM_WPS) / (_FAST_WPS - _CALM_WPS))


class SpeechRateScorer:
    name = "speech_rate"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight = config.scorer_speech_rate_weight

    def is_available(self) -> bool:
        return self.availability()[0]

    def availability(self) -> tuple[bool, str]:
        """(available, reason) - reason is a user-facing explanation when unavailable."""
        if not self._config.scorer_speech_rate_enabled:
            return False, "speech-rate scoring is turned off in Settings"
        return True, ""

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        from yuu_clip.segments.windower import clip_window_segments

        segments = clip_window_segments(clip.video, clip.start_ms, clip.end_ms)
        if not segments:
            return ScoreResult(tags=["speech_rate_no_transcript"])

        word_durations = [
            (len((seg.text or "").split()), (seg.end_ms - seg.start_ms) / 1000.0)
            for seg in segments
        ]
        value = speech_rate_score(word_durations)
        if value is None:
            return ScoreResult(tags=["speech_rate_calm"])

        return ScoreResult(
            score_funny=value,
            score_action=value,
            tags=["speech_rate_scored"],
            notes={"speech_rate": round(value, 3)},
        )
