"""Cheap, model-free on-screen activity detection (video-heavy analysis Stage 1).

compute_activity decodes a DOWNSCALED video stream at a LOW sample fps via PyAV
(``av``, already a dependency, LGPL), computes the mean absolute inter-frame pixel
difference at each sample, and stores one VisualActivity row per sample. Sampling +
downscaling bound the cost so it stays cheap on multi-hour recordings; the smallest
already-warmed proxy is decoded in preference to the full-res source. For a split
segment (which shares the parent media file) the decode is seeked to the segment's
own span rather than reading the whole parent and discarding the rest.

Idempotent (skips when rows already exist), mirroring scoring/scenes.py::compute_scenes.
A file with no video stream is a clean no-op (0 rows), and a corrupt/variable-fps
source is caught, warned, and skipped - motion detection never fails an analyze run.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Iterable, Iterator

if TYPE_CHECKING:
    import numpy as np
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import Video

log = logging.getLogger(__name__)


def compute_activity(video: "Video", session: "Session", config: "Config") -> int:
    """Sample *video*'s on-screen activity and store VisualActivity rows.

    Idempotent - skips (returns 0) if rows already exist for this video.
    Returns the number of samples stored.
    """
    from yuu_clip.db.models import VisualActivity

    if session.query(VisualActivity).filter_by(video_id=video.id).count() > 0:
        return 0

    decode_path = _decode_path(video)
    try:
        samples = list(_decode_samples(
            decode_path, config.visual_sample_fps, config.visual_downscale_height,
            start_s=video.segment_start_s, end_s=video.segment_end_s,
        ))
    except Exception as exc:
        log.warning("Visual-activity decode failed for %s: %s", decode_path, exc, exc_info=True)
        return 0

    series = _to_segment_window(_intensity_series(samples), video.segment_start_s, video.segment_end_s)
    for timecode_ms, intensity in series:
        session.add(VisualActivity(video_id=video.id, timecode_ms=timecode_ms, intensity=intensity))
    return len(series)


def _to_segment_window(
    series: list[tuple[int, float]], segment_start_s: float | None, segment_end_s: float | None
) -> list[tuple[int, float]]:
    """Re-base a parent-timeline intensity series onto a split segment's timeline.

    A pre-analysis split segment is a distinct Video row sharing the parent's media
    file (see pipeline.ingest), so the decode runs on the parent timeline - but the
    segment's clips (and its per-segment-trimmed audio/transcript) are 0-based within
    the segment. Without this rebase the Visual axis reads the wrong region. A
    non-split video (segment_start_s is None) passes through unchanged.
    """
    if segment_start_s is None:
        return series
    start_ms = int(segment_start_s * 1000)
    end_ms = int(segment_end_s * 1000) if segment_end_s is not None else None
    return [
        (timecode_ms - start_ms, intensity)
        for timecode_ms, intensity in series
        if timecode_ms >= start_ms and (end_ms is None or timecode_ms < end_ms)
    ]


def _decode_path(video: "Video") -> Path:
    """Prefer a fresh, already-warmed 720p proxy over the full-res source.

    The proxy is smaller and seekable, so decoding it is far cheaper; a stale or
    missing proxy falls back to the source so activity is still computed."""
    from yuu_clip.analyze.proxy import proxy_is_fresh

    proxy_path = getattr(video, "proxy_path", None)
    if proxy_path:
        proxy_file = Path(proxy_path)
        if proxy_is_fresh(video, proxy_file):
            return proxy_file
    return Path(video.path)


def _intensity_series(samples: Iterable[tuple[int, "np.ndarray"]]) -> list[tuple[int, float]]:
    """Mean absolute inter-frame difference for each sample after the first.

    The first sample has no predecessor to diff against, so it yields no row; every
    later sample carries the mean absolute per-pixel delta from the previous sample."""
    import numpy as np

    series: list[tuple[int, float]] = []
    previous: "np.ndarray | None" = None
    for timecode_ms, frame in samples:
        current = frame.astype(np.float32)
        if previous is not None:
            series.append((timecode_ms, float(np.mean(np.abs(current - previous)))))
        previous = current
    return series


def _decode_samples(
    path: Path, sample_fps: float, downscale_height: int,
    start_s: float | None = None, end_s: float | None = None,
) -> Iterator[tuple[int, "np.ndarray"]]:
    """Yield (timecode_ms, grayscale ndarray) sampled at ~*sample_fps* from *path*.

    When *start_s* is given (a split segment), the decode seeks to the segment's
    span instead of reading the whole parent file. Timecodes stay on the parent
    (absolute) timeline; ``_to_segment_window`` re-bases them afterwards."""
    import av

    with av.open(str(path)) as container:
        yield from _sample_from_container(container, sample_fps, downscale_height, start_s, end_s)


def _sample_from_container(
    container, sample_fps: float, downscale_height: int,
    start_s: float | None = None, end_s: float | None = None,
) -> Iterator[tuple[int, "np.ndarray"]]:
    """Sampling core, split out so the no-video-stream path is testable without a decode."""
    streams = container.streams.video
    if not streams:
        return
    stream = streams[0]

    if start_s is not None:
        _seek_near(container, stream, start_s)

    interval_ms = 1000.0 / sample_fps if sample_fps > 0 else 0.0
    end_ms = end_s * 1000.0 if end_s is not None else None
    target_width = _target_width(stream, downscale_height)
    last_taken_ms: float | None = None

    for frame in container.decode(stream):
        if frame.time is None:
            continue
        timecode_ms = frame.time * 1000.0
        if end_ms is not None and timecode_ms >= end_ms:
            break
        if last_taken_ms is not None and (timecode_ms - last_taken_ms) < interval_ms:
            continue
        last_taken_ms = timecode_ms
        gray = frame.reformat(width=target_width, height=downscale_height, format="gray").to_ndarray()
        yield int(timecode_ms), gray


def _seek_near(container, stream, start_s: float) -> None:
    """Seek to the keyframe at or before *start_s* so decoding starts near the segment.

    Best-effort: a backward seek lands on a keyframe <= start_s, which doubles as the
    inter-frame diff baseline for the first in-window sample. On failure we log and
    decode from the file start - correct, just not sped up for that one segment."""
    try:
        container.seek(int(start_s / stream.time_base), stream=stream, backward=True, any_frame=False)
    except Exception as exc:
        log.debug("Visual-activity seek to %.3fs failed (%s); decoding from start.", start_s, exc)


def _target_width(stream, downscale_height: int) -> int:
    """Downscaled width that preserves aspect ratio (even, >= 2)."""
    source_width = stream.width or downscale_height
    source_height = stream.height or downscale_height
    width = round(source_width * downscale_height / source_height)
    return max(2, width - (width % 2))
