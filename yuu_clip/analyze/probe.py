"""
Video probing via ffprobe.

ffprobe is part of the FFmpeg distribution and works identically on
Windows, Linux, and macOS.  We call it as a subprocess and parse
the JSON output - no ffmpeg-python wrapper needed.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from yuu_clip.config import find_ffmpeg
from yuu_clip.log import get_logger

log = get_logger(__name__)

# ffprobe only reads container metadata, so it returns in seconds even for huge
# files. A generous cap turns a hung/stuck probe into a clean error instead of
# blocking the whole analyze run forever.
_FFPROBE_TIMEOUT_S = 120


@dataclass
class AudioStreamInfo:
    stream_index: int       # index in the container (across ALL stream types)
    codec_name: str
    sample_rate: int
    channels: int
    channel_layout: Optional[str]
    duration_ms: Optional[int]
    title_tag: Optional[str]   # e.g. "Desktop Audio", "Mic (Clean)" set by OBS


@dataclass
class VideoInfo:
    path: Path
    duration_ms: int
    fps: float
    width: int
    height: int
    audio_streams: list[AudioStreamInfo]

    @property
    def has_multiple_audio_tracks(self) -> bool:
        return len(self.audio_streams) > 1

    @property
    def duration_hms(self) -> str:
        s = self.duration_ms // 1000
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}h {m:02d}m {sec:02d}s" if h else f"{m}m {sec:02d}s"


def probe_video(path: Path) -> VideoInfo:
    """
    Run ffprobe on *path* and return a VideoInfo.

    Raises:
        FileNotFoundError  – if the video file doesn't exist
        RuntimeError       – if ffprobe fails or ffprobe/ffmpeg are not in PATH
    """
    if not path.exists():
        raise FileNotFoundError(f"Video not found: {path}")

    _, ffprobe = find_ffmpeg()

    cmd = [
        ffprobe,
        "-v", "error",   # keep stdout JSON clean but surface real errors on stderr
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        str(path),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=_FFPROBE_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f"ffprobe timed out after {_FFPROBE_TIMEOUT_S}s on {path.name} - "
            f"the file may be unreadable or on an unresponsive drive"
        )

    if result.returncode != 0:
        raise RuntimeError(
            f"ffprobe failed on {path.name}:\n{result.stderr.strip()}"
        )

    data = json.loads(result.stdout)
    streams = data.get("streams", [])
    fmt = data.get("format", {})

    video_stream = next(
        (s for s in streams if s.get("codec_type") == "video"), None
    )

    fps = _parse_fps(video_stream.get("avg_frame_rate", "30/1") if video_stream else "30/1")
    duration_ms = int(float(fmt.get("duration", 0)) * 1000)
    width  = video_stream.get("width",  0) if video_stream else 0
    height = video_stream.get("height", 0) if video_stream else 0

    audio_streams = [
        _parse_audio_stream(s)
        for s in streams
        if s.get("codec_type") == "audio"
    ]

    info = VideoInfo(
        path         = path,
        duration_ms  = duration_ms,
        fps          = fps,
        width        = width,
        height       = height,
        audio_streams = audio_streams,
    )
    log.info(
        "Probed %s: duration=%s, fps=%.3f, %dx%d, audio_tracks=%d",
        path.name, info.duration_hms, fps, width, height, len(audio_streams),
    )
    return info


def _parse_audio_stream(s: dict) -> AudioStreamInfo:
    dur_ms: Optional[int] = int(float(s["duration"]) * 1000) if "duration" in s else None
    return AudioStreamInfo(
        stream_index   = s["index"],
        codec_name     = s.get("codec_name", "unknown"),
        sample_rate    = int(s.get("sample_rate", 44100)),
        channels       = s.get("channels", 2),
        channel_layout = s.get("channel_layout"),
        duration_ms    = dur_ms,
        title_tag      = s.get("tags", {}).get("title"),
    )


def _parse_fps(fps_str: str) -> float:
    """Parse '60000/1001' style fps strings from ffprobe."""
    try:
        if "/" in fps_str:
            num, den = fps_str.split("/")
            den_i = int(den)
            return round(int(num) / den_i, 3) if den_i else 30.0
        return float(fps_str)
    except (ValueError, ZeroDivisionError):
        log.warning("Could not parse fps string %r - defaulting to 30.0", fps_str)
        return 30.0
