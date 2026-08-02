"""Source-media resolution for ``yuu-dev release-smoke``.

Resolution order (plan of record, "Default source"): ``--media-dir`` if given,
else a cached download under ``--cache-dir``, else one ``yt-dlp`` fetch into that
cache, else a synthetic testsrc+sine video with a matching ``.srt`` sidecar so the
pipeline still runs end to end (transcript -> clips -> scoring -> export) with
Whisper as the one documented gap when nothing else is available.
"""
from __future__ import annotations

import shutil
import subprocess
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

DEFAULT_RECORDING_URL = "https://www.youtube.com/watch?v=_cMxraX_5RE&list=PL6B3937A5D230E335&index=4"
CACHE_DIRNAME = "yuu-clip-release-media"
CACHED_FILENAME = "release-gate-recording.mkv"
MIN_CANDIDATE_DURATION_S = 60.0
SYNTHETIC_DURATION_S = 95
SYNTHETIC_SIZE = "640x360"
SYNTHETIC_RATE = 15
_VIDEO_EXTS = {".mkv", ".mp4", ".mov", ".webm", ".avi"}

# Each line is >= 15s (min_clip_ms) and the gap between lines is >= 5s, safely over
# the 3s silence_threshold_ms clip-boundary default - so each becomes its own clip
# window instead of merging into one, which is what Stage 1's approve/reject step
# (needs >= 2 clips) and the reel/backup/restore steps downstream depend on.
_SYNTHETIC_DIALOGUE = (
    (2.0, 19.0, "Okay, we're recording. Let's get into it, last session left off right at the gate."),
    (24.0, 41.0, "I still can't believe that worked. Nobody plans for the cart to survive that jump."),
    (46.0, 61.0, "Careful up there, the footing looks rough past the ridge line."),
    (66.0, 81.0, "Let's regroup at the camp and figure out the next move before it gets dark."),
)


class NoQualifyingMediaError(RuntimeError):
    pass


@dataclass(frozen=True)
class ResolvedSource:
    video_path: Path
    srt_path: Optional[Path]
    is_synthetic: bool
    fallback_reason: Optional[str] = None


def _ffprobe_duration_s(ffprobe: str, path: Path) -> Optional[float]:
    cmd = [ffprobe, "-v", "error", "-show_entries", "format=duration",
           "-of", "default=noprint_wrappers=1:nokey=1", str(path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def pick_from_media_dir(media_dir: Path) -> Path:
    """Probe every video in *media_dir* (name order) and return the first >= 60s.

    Raises NoQualifyingMediaError naming every rejected file's duration when none
    qualifies, so the caller can surface it directly as a clear step failure.
    """
    ffprobe = shutil.which("ffprobe")
    if ffprobe is None:
        raise NoQualifyingMediaError("ffprobe is not on PATH - cannot inspect --media-dir candidates")
    candidates = sorted(p for p in media_dir.iterdir() if p.suffix.lower() in _VIDEO_EXTS)
    if not candidates:
        raise NoQualifyingMediaError(f"No video files found under {media_dir}")
    rejected: list[str] = []
    for candidate in candidates:
        duration_s = _ffprobe_duration_s(ffprobe, candidate)
        if duration_s is not None and duration_s >= MIN_CANDIDATE_DURATION_S:
            return candidate
        label = f"{duration_s:.1f}s" if duration_s is not None else "unprobeable"
        rejected.append(f"{candidate.name} ({label})")
    raise NoQualifyingMediaError(
        f"No candidate in {media_dir} reached {MIN_CANDIDATE_DURATION_S:.0f}s: " + ", ".join(rejected)
    )


def yt_dlp_fetch(cache_dir: Path) -> Path:
    yt_dlp = shutil.which("yt-dlp")
    if yt_dlp is None:
        raise NoQualifyingMediaError("yt-dlp is not on PATH - cannot fetch the default release-gate recording")
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / CACHED_FILENAME
    cmd = [yt_dlp, "-f", "bv*+ba/b", "--merge-output-format", "mkv", "-o", str(dest), DEFAULT_RECORDING_URL]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not dest.is_file():
        raise NoQualifyingMediaError(f"yt-dlp fetch failed: {result.stderr[-400:]}")
    return dest


def _format_srt_timestamp(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    hours, rem_ms = divmod(total_ms, 3_600_000)
    minutes, rem_ms = divmod(rem_ms, 60_000)
    secs, ms = divmod(rem_ms, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def _write_synthetic_srt(path: Path) -> None:
    blocks = []
    for index, (start_s, end_s, text) in enumerate(_SYNTHETIC_DIALOGUE, start=1):
        wrapped = "\n".join(textwrap.wrap(text, 60))
        blocks.append(f"{index}\n{_format_srt_timestamp(start_s)} --> {_format_srt_timestamp(end_s)}\n{wrapped}\n")
    path.write_text("\n".join(blocks), encoding="utf-8")


def generate_synthetic(dest_dir: Path) -> ResolvedSource:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise NoQualifyingMediaError("ffmpeg is not on PATH - cannot generate synthetic media")
    dest_dir.mkdir(parents=True, exist_ok=True)
    video_path = dest_dir / "synthetic-smoke.mkv"
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"testsrc=duration={SYNTHETIC_DURATION_S}:size={SYNTHETIC_SIZE}:rate={SYNTHETIC_RATE}",
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={SYNTHETIC_DURATION_S}:sample_rate=16000",
        "-ac", "1", "-shortest", "-pix_fmt", "yuv420p",
        # Force a keyframe every second so stream-copy exports cut accurately at
        # arbitrary window starts (mirrors tests/system/conftest.py's fixture).
        "-c:v", "libx264", "-force_key_frames", "expr:gte(t,n_forced*1)",
        "-c:a", "aac", str(video_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not video_path.is_file():
        raise NoQualifyingMediaError(f"ffmpeg could not generate the synthetic fixture: {result.stderr[-400:]}")
    srt_path = video_path.with_suffix(".srt")
    _write_synthetic_srt(srt_path)
    return ResolvedSource(video_path=video_path, srt_path=srt_path, is_synthetic=True)


def trim_to_minutes(video_path: Path, max_minutes: int, dest_dir: Path) -> Path:
    """Stream-copy the first *max_minutes* of *video_path* into *dest_dir*.

    Always runs (even when the source is already short) so this doubles as the
    "copy into the scratch project" step the hard safety rules require - the
    original source file is never touched or analyzed in place."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise NoQualifyingMediaError("ffmpeg is not on PATH - cannot copy/trim the source video")
    dest_dir.mkdir(parents=True, exist_ok=True)
    trimmed = dest_dir / video_path.name
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-t", str(max_minutes * 60),
           "-i", str(video_path), "-c", "copy", str(trimmed)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not trimmed.is_file():
        raise NoQualifyingMediaError(f"ffmpeg could not copy/trim the source: {result.stderr[-400:]}")
    return trimmed


def resolve_source(
    *, media_dir: Optional[Path], cache_dir: Path, raw_dir: Path, max_source_minutes: int
) -> ResolvedSource:
    if media_dir is not None:
        picked = pick_from_media_dir(media_dir)
        trimmed = trim_to_minutes(picked, max_source_minutes, raw_dir)
        return ResolvedSource(video_path=trimmed, srt_path=None, is_synthetic=False)

    try:
        cached = cache_dir / CACHED_FILENAME
        if not cached.is_file():
            cached = yt_dlp_fetch(cache_dir)
        trimmed = trim_to_minutes(cached, max_source_minutes, raw_dir)
        return ResolvedSource(video_path=trimmed, srt_path=None, is_synthetic=False)
    except NoQualifyingMediaError as exc:
        synthetic = generate_synthetic(raw_dir)
        return ResolvedSource(
            video_path=synthetic.video_path, srt_path=synthetic.srt_path, is_synthetic=True,
            fallback_reason=f"Falling back to synthetic media (no real recording available): {exc}",
        )
