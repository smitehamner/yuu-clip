"""SpeakerChurnScorer - rapid speaker turn-taking and cross-talk as a chaos signal.

Fast back-and-forth between speakers, and cross-talk where two people speak at
once, mark lively, chaotic banter. Computed from the transcript segments overlapping
the clip window and their diarized speaker attribution - zero extra dependencies, but
it needs diarization: it abstains (None) when fewer than two speakers are attributed
in the window (diarization off, or a solo stretch). Feeds funny and action.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, TranscriptSegment

log = logging.getLogger(__name__)

# A speaker switch every 2.5 s (24/min) of rapid banter saturates the churn term.
# Heuristic, editable.
_SATURATION_SWITCHES_PER_MIN = 24.0


def _segment_speaker_key(seg: "TranscriptSegment") -> str | None:
    """A durable per-speaker key: the attributed Speaker id, else the raw diarization
    label, else None (undiarized - the abstain signal)."""
    if seg.speaker_id is not None:
        return f"id:{seg.speaker_id}"
    if seg.speaker_label:
        return f"label:{seg.speaker_label}"
    return None


def _overlap_seconds(turns: list[tuple[str, int, int]]) -> float:
    """Total wall-time (s) where two different-speaker turns cover the same instant."""
    total_ms = 0
    for i in range(len(turns)):
        speaker_a, start_a, end_a = turns[i]
        for j in range(i + 1, len(turns)):
            speaker_b, start_b, end_b = turns[j]
            if speaker_a == speaker_b:
                continue
            overlap = min(end_a, end_b) - max(start_a, start_b)
            if overlap > 0:
                total_ms += overlap
    return total_ms / 1000.0


def churn_score(turns: list[tuple[str | None, int, int]], window_duration_s: float) -> float | None:
    """0–1 chaos score from (speaker_key, start_ms, end_ms) turns, or None.

    None when fewer than two distinct speakers are attributed (diarization off or a
    solo stretch). Otherwise combines the speaker-switch rate along the time-ordered
    turns with the fraction of the window spent in cross-talk overlap.
    """
    attributed = [t for t in turns if t[0] is not None]
    if len({speaker for speaker, _, _ in attributed}) < 2 or window_duration_s <= 0:
        return None

    ordered = sorted(attributed, key=lambda t: t[1])
    switches = sum(1 for a, b in zip(ordered, ordered[1:]) if a[0] != b[0])
    switch_rate_per_min = switches / window_duration_s * 60
    churn = min(1.0, switch_rate_per_min / _SATURATION_SWITCHES_PER_MIN)

    overlap_frac = min(1.0, _overlap_seconds(attributed) / window_duration_s)
    return min(1.0, churn + overlap_frac)


class SpeakerChurnScorer:
    name = "speaker_churn"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight = config.scorer_churn_weight

    def is_available(self) -> bool:
        return self.availability()[0]

    def availability(self) -> tuple[bool, str]:
        """(available, reason) - reason is a user-facing explanation when unavailable."""
        if not self._config.scorer_churn_enabled:
            return False, "speaker-overlap scoring is turned off in Settings"
        return True, ""

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        from yuu_clip.segments.windower import clip_window_segments

        segments = clip_window_segments(clip.video, clip.start_ms, clip.end_ms)
        if not segments:
            return ScoreResult(tags=["churn_no_transcript"])

        turns = [(_segment_speaker_key(seg), seg.start_ms, seg.end_ms) for seg in segments]
        window_s = (clip.end_ms - clip.start_ms) / 1000.0
        value = churn_score(turns, window_s)
        if value is None:
            return ScoreResult(tags=["churn_no_speakers"])

        return ScoreResult(
            score_funny=value,
            score_action=value,
            tags=["churn_scored"],
            notes={"churn": round(value, 3)},
        )
