"""Visual clip-candidate generation (video-heavy analysis Stage 2).

The transcript windower (segments/windower.py) only ever proposes clips where there
is speech, so a silent-but-visual highlight - a clutch play, a crash, a sick flick -
never becomes a candidate. generate_visual_candidates fills that gap: it proposes
clip windows from the model-free VisualActivity motion timeline and SceneBoundary
density, tagged "visual"/"no_speech" with an empty transcript excerpt.

Each window reuses the transcript windower's min_clip_ms / hard_split_ms bounds and is
created as kind="clip" (a visual clip, not a separate DB kind). Candidates are returned
un-added to the session on purpose: segments/merge.py::merge_candidates dedups them
against the transcript clips and caps them per recording before ingest persists the
survivors, so the visual source never drowns a talk-heavy ranking.

Modes (config.visual_candidate_mode, dispatched in pipeline/ingest.py):
  "gaps"     - allowed_regions = the silent gaps between transcript clips (silent_gaps)
  "parallel" - allowed_regions = None -> the whole recording, dedup handles overlaps
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

# Interest points (motion peaks + scene cuts) within this many ms of each other form
# one run; a gap wider than this starts a new candidate. Motion is sampled at ~2 fps
# (500 ms), so a sustained action span stays a single run.
_CLUSTER_GAP_MS = 2_000

# A run with no motion peak needs at least this many scene cuts to qualify on its own -
# "SceneBoundary density", not a lone cut.
_MIN_SCENE_DENSITY = 3


def silent_gaps(transcript_cands, video: "Video") -> list[tuple[int, int]]:
    """The complement of the transcript clip windows over the recording - the regions
    with no transcript clip, used to restrict gaps-mode visual candidates.

    Falls back to the last clip's end when the recording duration is unknown, so a
    trailing silent span is only captured once duration_ms is set (post-analyze)."""
    end = video.duration_ms or 0
    spans = sorted((c.start_ms, c.end_ms) for c in transcript_cands)
    gaps: list[tuple[int, int]] = []
    cursor = 0
    for start_ms, stop_ms in spans:
        if start_ms > cursor:
            gaps.append((cursor, start_ms))
        cursor = max(cursor, stop_ms)
    if end > cursor:
        gaps.append((cursor, end))
    return gaps


def generate_visual_candidates(
    video: "Video",
    config: "Config",
    session: "Session",
    allowed_regions: list[tuple[int, int]] | None = None,
) -> list["ClipCandidate"]:
    """Propose visual clip candidates for *video*, restricted to *allowed_regions*
    (gaps mode) or spanning the whole recording when None (parallel mode).

    Returns un-added ClipCandidate rows with tags ["visual", "no_speech"], an empty
    transcript excerpt, and a transient ``visual_peak`` (the window's peak motion
    intensity) used by merge_candidates for the per-recording cap.
    """
    from yuu_clip.db.models import ClipCandidate, SceneBoundary, VisualActivity

    motion = sorted(
        (row.timecode_ms, row.intensity)
        for row in session.query(VisualActivity).filter_by(video_id=video.id).all()
    )
    scenes = sorted(
        row.timecode_ms
        for row in session.query(SceneBoundary).filter_by(video_id=video.id).all()
    )
    if not motion and not scenes:
        return []

    regions = allowed_regions if allowed_regions is not None else [(0, _video_end(video, motion, scenes))]

    candidates: list["ClipCandidate"] = []
    for region_start, region_end in regions:
        for start_ms, end_ms, peak in _windows_in_region(region_start, region_end, motion, scenes, config):
            cand = ClipCandidate(
                video_id=video.id,
                start_ms=start_ms,
                end_ms=end_ms,
                kind="clip",
                transcript_excerpt="",
                status="pending",
            )
            cand.tags = ["visual", "no_speech"]
            cand.visual_peak = peak
            candidates.append(cand)
    return candidates


def _video_end(video: "Video", motion, scenes) -> int:
    if video.duration_ms:
        return video.duration_ms
    last = max(
        (motion[-1][0] if motion else 0),
        (scenes[-1] if scenes else 0),
    )
    return last + 1


def _windows_in_region(
    region_start: int, region_end: int, motion, scenes, config: "Config"
) -> list[tuple[int, int, float]]:
    """Cluster the motion peaks + scene cuts inside [region_start, region_end) into
    (start_ms, end_ms, peak_intensity) windows honoring min_clip_ms / hard_split_ms."""
    peak_pts = [
        (ts, intensity, "motion")
        for ts, intensity in motion
        if region_start <= ts < region_end and intensity >= config.visual_peak_threshold
    ]
    scene_pts = [
        (ts, 0.0, "scene")
        for ts in scenes
        if region_start <= ts < region_end
    ]
    interest = sorted(peak_pts + scene_pts)
    if not interest:
        return []

    qualifying = [run for run in _cluster(interest) if _run_qualifies(run)]
    windows: list[tuple[int, int, float]] = []
    for run in _merge_close_runs(qualifying, config.min_clip_ms):
        lo, hi = run[0][0], run[-1][0]
        for start_ms, end_ms in _bounded_windows(lo, hi, config.min_clip_ms, config.hard_split_ms, region_start, region_end):
            peak = max((i for ts, i, kind in run if kind == "motion" and start_ms <= ts < end_ms), default=0.0)
            windows.append((start_ms, end_ms, peak))
    return windows


def _cluster(interest: list[tuple[int, float, str]]) -> list[list[tuple[int, float, str]]]:
    runs: list[list[tuple[int, float, str]]] = [[interest[0]]]
    for point in interest[1:]:
        if point[0] - runs[-1][-1][0] <= _CLUSTER_GAP_MS:
            runs[-1].append(point)
        else:
            runs.append([point])
    return runs


def _merge_close_runs(
    runs: list[list[tuple[int, float, str]]], min_gap_ms: int
) -> list[list[tuple[int, float, str]]]:
    """Coalesce consecutive qualifying runs whose inter-run gap is under *min_gap_ms*.

    Two runs closer than a min-length clip each grow to min_clip_ms in _fit_window,
    producing heavily-overlapping near-duplicate windows (the Stage 5 dedup gap). Merging
    them first yields one window over the pair; a merged span past hard_split_ms is still
    re-split downstream by _bounded_windows."""
    if not runs:
        return []
    merged = [runs[0]]
    for run in runs[1:]:
        if run[0][0] - merged[-1][-1][0] < min_gap_ms:
            merged[-1] = merged[-1] + run
        else:
            merged.append(run)
    return merged


def _run_qualifies(run: list[tuple[int, float, str]]) -> bool:
    if any(kind == "motion" for _, _, kind in run):
        return True
    return sum(1 for _, _, kind in run if kind == "scene") >= _MIN_SCENE_DENSITY


def _bounded_windows(
    lo: int, hi: int, min_clip_ms: int, hard_split_ms: int, region_start: int, region_end: int
) -> list[tuple[int, int]]:
    span = hi - lo
    if span <= hard_split_ms:
        fitted = _fit_window(lo, hi, min_clip_ms, region_start, region_end)
        return [fitted] if fitted else []

    chunks = math.ceil(span / hard_split_ms)
    step = span / chunks
    out: list[tuple[int, int]] = []
    for k in range(chunks):
        sub_lo = int(lo + k * step)
        sub_hi = int(lo + (k + 1) * step)
        fitted = _fit_window(sub_lo, sub_hi, min_clip_ms, region_start, region_end)
        if fitted:
            out.append(fitted)
    return out


def _fit_window(
    lo: int, hi: int, min_clip_ms: int, region_start: int, region_end: int
) -> tuple[int, int] | None:
    """A window covering [lo, hi], grown to at least min_clip_ms, shifted to sit inside
    the region. Returns None when the region is too small to hold a min-length clip."""
    region_span = region_end - region_start
    if region_span < min_clip_ms:
        return None

    length = max(hi - lo, min_clip_ms)
    length = min(length, region_span)
    mid = (lo + hi) / 2
    start = int(mid - length / 2)
    end = start + length
    if start < region_start:
        start, end = region_start, region_start + length
    if end > region_end:
        end, start = region_end, region_end - length
    return start, end
