"""720p H.264 preview-proxy generation and cache bookkeeping.

Long recordings are multi-hour ``.mkv`` files that Chromium cannot seek - it
linear-scans to reach a timestamp, so in-app scrubbing is unusable. The root
cause is the container, not transport. A downscaled 720p H.264 MP4 (regular
keyframes, ``+faststart``) is seekable and small, so all in-app playback points
at the proxy instead of the raw source.

Generation prefers NVIDIA NVENC (``h264_nvenc``) and falls back to CPU
``libx264`` when no GPU/encoder is available. It uses the same FFmpeg as
extract/export (``find_ffmpeg``) - packaged builds bundle a GPL FFmpeg (see
``docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md``); dev mode resolves it from PATH.
A missing FFmpeg surfaces as a clear RuntimeError.

The proxy file is keyed by the *source path*, not the Video row, so a split
recording's segments all share their parent file's single proxy.
"""
from __future__ import annotations

import hashlib
import subprocess
import threading
from collections import deque
from pathlib import Path
from typing import Callable, Optional

from yuu_clip.ffmpeg_tools import find_ffmpeg
from yuu_clip.log import get_logger

_log = get_logger(__name__)

PROXY_HEIGHT = 720
_NVENC_ENCODER = "h264_nvenc"

_nvenc_cache: Optional[bool] = None


class ProxyCancelled(Exception):
    """Raised out of generate_proxy when cancel_event is set - lets the caller
    tell a deliberate cancel apart from a genuine encode failure, and skips the
    NVENC->libx264 fallback retry a real failure would otherwise trigger."""


def proxy_file_for(source_path: Path, proxy_dir: Path) -> Path:
    """Deterministic proxy path for *source_path*, shared across split segments.

    Keyed by the resolved source path so the parent recording and every segment
    (which reuse the parent's ``path``) map to one cached file.
    """
    digest = hashlib.sha1(str(source_path.resolve()).encode("utf-8")).hexdigest()[:16]
    return proxy_dir / f"{digest}_720p.mp4"


def nvenc_available(ffmpeg: Optional[str] = None) -> bool:
    """Whether this FFmpeg build lists the NVENC H.264 encoder. Cached per process.

    Listing the encoder does not guarantee a working GPU at runtime, so
    ``generate_proxy`` still falls back to libx264 if an NVENC run fails.
    """
    global _nvenc_cache
    if _nvenc_cache is not None:
        return _nvenc_cache
    try:
        ff = ffmpeg or find_ffmpeg()[0]
        result = subprocess.run(
            [ff, "-hide_banner", "-encoders"],
            capture_output=True, encoding="utf-8", errors="replace", timeout=30,
        )
        _nvenc_cache = _NVENC_ENCODER in result.stdout
    except Exception as exc:  # missing ffmpeg, timeout, etc. - treat as no NVENC
        _log.warning("NVENC probe failed (%s) - assuming unavailable", exc)
        _nvenc_cache = False
    _log.info("NVENC %s", "available" if _nvenc_cache else "unavailable - using libx264")
    return _nvenc_cache


def build_proxy_cmd(ffmpeg: str, source: Path, out: Path, *, use_nvenc: bool,
                    height: int = PROXY_HEIGHT) -> list[str]:
    """FFmpeg argument list for a 720p H.264 MP4 proxy encode.

    Split out so the encoder/scale/faststart choices are unit-testable without a
    real FFmpeg. ``scale=-2:H`` keeps the aspect ratio with an even width (NVENC
    requires even dimensions).
    """
    if use_nvenc:
        vcodec = ["-c:v", _NVENC_ENCODER, "-preset", "p4", "-rc", "vbr", "-cq", "30", "-b:v", "0"]
    else:
        vcodec = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26"]
    return [
        ffmpeg, "-y",
        "-i", source.as_posix(),
        "-vf", f"scale=-2:{height}",
        *vcodec,
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        out.as_posix(),
    ]


def _run_with_progress(cmd: list[str], duration_ms: Optional[int],
                       progress_cb: Optional[Callable[[float], None]], *,
                       on_proc_started: Optional[Callable[[subprocess.Popen], None]] = None,
                       cancel_event: Optional[threading.Event] = None) -> None:
    """Run an FFmpeg encode, reporting fractional progress via *progress_cb*.

    ``-progress pipe:1`` streams ``key=value`` lines to stdout; stderr is merged
    in (``-nostats`` keeps it quiet) and the last lines are kept for the error
    message. Raises RuntimeError with that tail if FFmpeg exits non-zero, or
    ProxyCancelled if *cancel_event* is set (checked after every line, and once
    more after the process exits, so a kill delivered between reads is not
    mistaken for an encode failure).
    """
    full = [cmd[0], "-progress", "pipe:1", "-nostats", *cmd[1:]]
    total_us = duration_ms * 1000 if duration_ms else None
    tail: deque[str] = deque(maxlen=20)
    proc = subprocess.Popen(
        full, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        encoding="utf-8", errors="replace", bufsize=1,
    )
    if on_proc_started:
        on_proc_started(proc)
    assert proc.stdout is not None
    try:
        for raw in proc.stdout:
            if cancel_event is not None and cancel_event.is_set():
                proc.kill()
                break
            line = raw.strip()
            if not line:
                continue
            tail.append(line)
            if progress_cb and total_us and line.startswith("out_time_us="):
                try:
                    current_us = int(line.split("=", 1)[1])
                except ValueError:
                    continue  # "N/A" before the first frame
                progress_cb(min(1.0, current_us / total_us))
    except BaseException:
        # A raising progress_cb (or an interrupt) must not leave the FFmpeg child
        # running headless after we stop reading its stdout.
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        raise
    proc.wait()
    if cancel_event is not None and cancel_event.is_set():
        raise ProxyCancelled()
    if proc.returncode != 0:
        raise RuntimeError("\n".join(tail) or f"FFmpeg exited with code {proc.returncode}")


def generate_proxy(source: Path, out: Path, *, duration_ms: Optional[int] = None,
                   progress_cb: Optional[Callable[[float], None]] = None,
                   ffmpeg: Optional[str] = None,
                   on_proc_started: Optional[Callable[[subprocess.Popen], None]] = None,
                   cancel_event: Optional[threading.Event] = None) -> Path:
    """Encode a 720p H.264 proxy of *source* to *out*, returning *out*.

    Tries NVENC first when the build supports it, then always falls back to
    libx264 (an NVENC encoder can be listed but fail with no usable GPU). Raises
    RuntimeError if every attempt fails or FFmpeg is not installed, or
    ProxyCancelled if *cancel_event* fires mid-encode (skips the fallback retry -
    a deliberate cancel must not be treated as an NVENC failure to recover from).
    """
    ffmpeg = ffmpeg or find_ffmpeg()[0]
    out.parent.mkdir(parents=True, exist_ok=True)

    attempts = [True, False] if nvenc_available(ffmpeg) else [False]
    last_error: Optional[str] = None
    for use_nvenc in attempts:
        encoder = "NVENC" if use_nvenc else "libx264"
        cmd = build_proxy_cmd(ffmpeg, source, out, use_nvenc=use_nvenc)
        try:
            _log.info("Generating 720p proxy (%s): %s -> %s", encoder, source.name, out.name)
            _run_with_progress(
                cmd, duration_ms, progress_cb,
                on_proc_started=on_proc_started, cancel_event=cancel_event,
            )
            _log.info("Proxy ready (%s): %s", encoder, out.name)
            return out
        except RuntimeError as exc:
            last_error = str(exc)
            _log.warning("Proxy encode failed (%s): %s", encoder, last_error)

    raise RuntimeError(f"Proxy generation failed for {source.name}: {last_error}")


# ── cache freshness / DB bookkeeping ────────────────────────────────────────────
# The DB columns live on Video, but the proxy file is shared by a recording and
# all its split segments (same source path), so metadata is written to every row
# with that path and freshness is judged against the current source stat.

def proxy_is_fresh(video, proxy_file: Path) -> bool:
    """Whether *video* has a usable proxy: recorded, on disk, and matching source.

    Invalidated when the source file is re-recorded to the same path (its size or
    mtime changes), so a stale proxy is never served.
    """
    if video.proxy_generated_at is None or not proxy_file.exists():
        return False
    source = Path(video.path)
    if not source.exists():
        return False
    stat = source.stat()
    return (
        video.proxy_source_size == stat.st_size
        and video.proxy_source_mtime is not None
        and abs(video.proxy_source_mtime - stat.st_mtime) < 1.0
    )


def record_proxy_metadata(session, video, proxy_file: Path) -> None:
    """Record the proxy path + source-invalidation stats on *video* and its siblings.

    Segments share the parent's source ``path`` and its single proxy file, so
    every row with that path is marked, letting a segment's clip preview find the
    proxy the parent (or a sibling) generated.
    """
    from datetime import datetime, timezone

    from yuu_clip.db.models import Video

    stat = Path(video.path).stat()
    now = datetime.now(timezone.utc)
    for row in session.query(Video).filter(Video.path == video.path).all():
        row.proxy_path = str(proxy_file)
        row.proxy_generated_at = now
        row.proxy_source_mtime = stat.st_mtime
        row.proxy_source_size = stat.st_size
