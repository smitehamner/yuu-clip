"""
Video probing via ffprobe.

ffprobe is part of the FFmpeg distribution and works identically on
Windows, Linux, and macOS.  We call it as a subprocess and parse
the JSON output — no ffmpeg-python wrapper needed.
"""
from __future__ import annotations

import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from rp_clipper.config import find_ffmpeg

log = logging.getLogger(__name__)


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
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        str(path),
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
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

    audio_raw = [s for s in streams if s.get("codec_type") == "audio"]
    audio_streams: list[AudioStreamInfo] = []

    for s in audio_raw:
        dur_ms: Optional[int] = None
        if "duration" in s:
            dur_ms = int(float(s["duration"]) * 1000)

        audio_streams.append(AudioStreamInfo(
            stream_index   = s["index"],
            codec_name     = s.get("codec_name", "unknown"),
            sample_rate    = int(s.get("sample_rate", 44100)),
            channels       = s.get("channels", 2),
            channel_layout = s.get("channel_layout"),
            duration_ms    = dur_ms,
            title_tag      = s.get("tags", {}).get("title"),
        ))

    return VideoInfo(
        path         = path,
        duration_ms  = duration_ms,
        fps          = fps,
        width        = width,
        height       = height,
        audio_streams = audio_streams,
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
        log.warning("Could not parse fps string %r — defaulting to 30.0", fps_str)
        return 30.0
