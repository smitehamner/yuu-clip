"""Frame sampling for image-based clip analysis (plan 11).

Samples a handful of JPEG frames evenly across a clip's window and hands them to
a vision model (see scoring/llm.describe_frames) for a short "what's on screen"
summary. The timestamp maths is separated from the ffmpeg calls so it can be
unit-tested without a real video (pattern: analyze/framing.py).

Frames come from the 720p proxy when it is fresh (plenty for a vision model and
much faster to seek); the source file is the fallback. The proxy shares the
untrimmed parent timeline, so a split segment's clip times get the parent
segment offset added - the same maths the preview and auto-framing routes use.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from yuu_clip.ffmpeg_tools import find_ffmpeg
from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

_log = get_logger(__name__)

# Longest edge fed to the vision model. 1280px keeps HUD text and small on-screen
# events legible without ballooning the per-frame token cost.
_FRAME_MAX_WIDTH = 1280


def frame_timestamps(start_s: float, end_s: float, count: int) -> list[float]:
    """`count` timestamps evenly spaced strictly inside [start_s, end_s].

    count=1 returns the window midpoint. A zero-length window returns start_s
    repeated, so a degenerate clip still yields something to sample.
    """
    count = max(1, count)
    span = max(0.0, end_s - start_s)
    if span <= 0:
        return [start_s] * count
    step = span / (count + 1)
    return [start_s + step * (i + 1) for i in range(count)]


def _extract_frame(ffmpeg: str, src: Path, timestamp_s: float, out_path: Path) -> bool:
    result = subprocess.run(
        [ffmpeg, "-y", "-ss", str(timestamp_s), "-i", src.as_posix(),
         "-frames:v", "1", "-q:v", "4",
         "-vf", f"scale=w='min({_FRAME_MAX_WIDTH},iw)':h=-2", out_path.as_posix()],
        capture_output=True, encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        _log.debug("Frame extract failed at %.2fs: %s", timestamp_s, result.stderr.strip()[-200:])
    return result.returncode == 0 and out_path.exists()


def sample_clip_frames(
    encode_src: Path, start_s: float, end_s: float, count: int, out_dir: Path,
) -> list[Path]:
    """Extract up to *count* JPEG frames across [start_s, end_s] into *out_dir*.

    Returns the frames that were written, in time order - a timestamp ffmpeg
    could not seek to is skipped rather than aborting the whole set.
    """
    ffmpeg, _ = find_ffmpeg()
    frames: list[Path] = []
    for index, timestamp_s in enumerate(frame_timestamps(start_s, end_s, count)):
        out_path = out_dir / f"frame_{index}.jpg"
        if _extract_frame(ffmpeg, encode_src, timestamp_s, out_path):
            frames.append(out_path)
    return frames


def resolve_frame_window(
    video: "Video", clip: "ClipCandidate", proxy_dir: Path,
) -> tuple[Path, float, float]:
    """Return (encode_src, start_s, end_s) for sampling *clip*'s frames.

    Prefers the fresh proxy; adds the parent segment offset so a split segment's
    segment-relative clip times land on the parent-keyed proxy/source. Call this
    inside the DB session - it only reads already-loaded scalar attributes, so
    the returned primitives can be handed to a worker thread after the session
    closes (same pattern as the auto-framing route).
    """
    from yuu_clip.analyze.proxy import proxy_file_for, proxy_is_fresh

    src = Path(video.path)
    proxy_file = proxy_file_for(src, proxy_dir)
    encode_src = proxy_file if proxy_is_fresh(video, proxy_file) else src
    segment_offset_s = video.segment_start_s or 0
    start_s = segment_offset_s + clip.start_ms / 1000 + (clip.start_offset or 0)
    end_s = segment_offset_s + clip.end_ms / 1000 + (clip.end_offset or 0)
    return encode_src, start_s, end_s


def sample_and_describe(
    encode_src: Path, start_s: float, end_s: float,
    count: int, config: "Config", context_text: str = "",
) -> str:
    """Sample frames across the window and return the vision model's summary.

    CPU/IO/network-bound (ffmpeg + a vision inference call) - callers run it off
    the event loop via asyncio.to_thread. Raises on a vision failure or when no
    frame could be sampled; the caller surfaces that to the user.
    """
    from yuu_clip.scoring.llm import describe_frames

    with tempfile.TemporaryDirectory() as tmp_dir:
        frames = sample_clip_frames(encode_src, start_s, end_s, count, Path(tmp_dir))
        if not frames:
            raise RuntimeError("Could not sample any frames from the clip window")
        return describe_frames(frames, config, context_text)


def clamp_frame_count(config: "Config") -> int:
    lo, hi = 1, 10
    return max(lo, min(hi, config.vision_frames_per_clip))


def analyze_clip_frames(
    video: "Video", clip: "ClipCandidate", config: "Config",
    proxy_dir: Path, context_text: str = "",
) -> Optional[str]:
    """Convenience wrapper: resolve the window then sample-and-describe.

    Used by the batch Re-score loop, which already holds the ORM objects. The
    single-clip route resolves the window itself (inside its session) and calls
    sample_and_describe directly so the DB session can close before the slow work.
    """
    encode_src, start_s, end_s = resolve_frame_window(video, clip, proxy_dir)
    return sample_and_describe(
        encode_src, start_s, end_s, clamp_frame_count(config), config, context_text,
    )
