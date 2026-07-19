# Feature-map - Export: the cut window a clip's trim offsets actually resolve to.
#   Siblings: render.py (engine, cuts here), paths.py (on-disk paths), presets.py
"""Where a clip's trim offsets land on the source file.

Shared by the export engine (which cuts this window) and the timing route (which
rejects a trim that would leave nothing to cut), so the two can never disagree
about what a given pair of offsets means.
"""
from __future__ import annotations


def export_window_ms(cand) -> tuple[int, int]:
    """Apply the user's start/end offsets and clamp to the source duration.

    Returns ms relative to the source file passed to export_clip. For a split
    segment, cand.start_ms/end_ms/video.duration_ms are all segment-relative, but
    video.path always points at the untrimmed parent file - so segment_start_s is
    added back in after clamping against the (segment-relative) duration.

    The result is NOT guaranteed to be a positive window: offsets that cross over
    each other yield end <= start. Callers that cut must reject that first (see
    window_is_empty) - ffmpeg silently returns a keyframe-length fragment for a
    zero-length request rather than failing.
    """
    start_ms = max(0, cand.start_ms + int((cand.start_offset or 0.0) * 1000))
    end_ms   = cand.end_ms + int((cand.end_offset or 0.0) * 1000)
    if cand.video.duration_ms:
        end_ms = min(end_ms, cand.video.duration_ms)
    segment_offset_ms = int((cand.video.segment_start_s or 0.0) * 1000)
    return start_ms + segment_offset_ms, end_ms + segment_offset_ms


def window_is_empty(cand) -> bool:
    """True when this clip's trim offsets leave no video to export."""
    start_ms, end_ms = export_window_ms(cand)
    return end_ms <= start_ms


EMPTY_WINDOW_MESSAGE = (
    "These trim points leave no clip - the end lands at or before the start. "
    "Adjust the trim so the end comes after the start."
)
