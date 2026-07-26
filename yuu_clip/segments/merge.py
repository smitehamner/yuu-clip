"""Merge visual clip candidates into the transcript ones (video-heavy analysis Stage 2).

This is the "don't drown the talk-heavy core" guard. merge_candidates:
  1. drops a visual candidate covered by transcript candidates by more than
     config.visual_dedup_overlap of its own length (transcript wins the overlap), and
  2. caps the surviving visual-only candidates at config.visual_candidate_cap per
     recording, keeping the highest motion peak first.

Returns (transcript_cands, kept_visual): the transcript candidates unchanged, and the
kept visual candidates sorted by start time. The caller appends the two, so the visual
set is handed back directly rather than being recovered from a tag.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

_log = get_logger(__name__)


def merge_candidates(
    transcript_cands: list["ClipCandidate"],
    visual_cands: list["ClipCandidate"],
    config: "Config",
) -> tuple[list["ClipCandidate"], list["ClipCandidate"]]:
    kept = [
        vc for vc in visual_cands
        if _covered_fraction(vc, transcript_cands) <= config.visual_dedup_overlap
    ]
    deduped_away = len(visual_cands) - len(kept)
    kept.sort(key=lambda c: (-_peak(c), c.start_ms, c.end_ms))
    kept_before_cap = len(kept)
    kept = kept[: config.visual_candidate_cap]
    capped_away = kept_before_cap - len(kept)
    kept.sort(key=lambda c: (c.start_ms, c.end_ms))

    _log.info(
        "merge_candidates: %d visual candidate(s) -> %d kept (%d deduped against transcript, %d capped)",
        len(visual_cands), len(kept), deduped_away, capped_away,
    )
    return list(transcript_cands), kept


def _peak(cand: "ClipCandidate") -> float:
    return getattr(cand, "visual_peak", 0.0)


def _covered_fraction(visual: "ClipCandidate", transcript_cands: list["ClipCandidate"]) -> float:
    """Fraction of *visual*'s duration covered by the union of the transcript windows."""
    duration = visual.end_ms - visual.start_ms
    if duration <= 0:
        return 1.0

    overlaps = []
    for tc in transcript_cands:
        start = max(visual.start_ms, tc.start_ms)
        end = min(visual.end_ms, tc.end_ms)
        if end > start:
            overlaps.append((start, end))
    if not overlaps:
        return 0.0

    overlaps.sort()
    covered = 0
    cur_start, cur_end = overlaps[0]
    for start, end in overlaps[1:]:
        if start > cur_end:
            covered += cur_end - cur_start
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    covered += cur_end - cur_start
    return covered / duration
