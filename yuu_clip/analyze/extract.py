"""
Audio extraction and clip export via FFmpeg.

All paths are handled as pathlib.Path objects and converted to strings
only at subprocess call time — Path.as_posix() is used on Windows to
avoid backslash confusion in FFmpeg's argument parser.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional

from yuu_clip.config import find_ffmpeg
from yuu_clip.log import get_logger

_log = get_logger(__name__)


def _ffmpeg_path(p: Path) -> str:
    """
    Return the string FFmpeg expects for a file path.

    On Windows, FFmpeg handles forward slashes fine, and using
    as_posix() avoids any escaping headaches with backslashes.
    """
    return p.as_posix()


def extract_audio_track(
    video_path: Path,
    stream_index: int,
    output_path: Path,
    sample_rate: int = 16_000,
    channels: int = 1,
    start_s: Optional[float] = None,
    end_s: Optional[float] = None,
) -> Path:
    """
    Extract a single audio stream from *video_path* to a 16kHz mono WAV.

    Parameters
    ----------
    video_path:   source video file
    stream_index: the container stream index (from ffprobe, NOT the audio-only index)
    output_path:  destination .wav file (parent dir is created if absent)
    sample_rate:  target sample rate (Whisper expects 16000 Hz)
    channels:     1 = mono (Whisper expects mono)

    Returns the output_path on success.
    """
    ffmpeg, _ = find_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    _log.debug(
        "Extracting audio: %s stream %d → %s%s",
        video_path.name, stream_index, output_path.name,
        f" [{start_s}s–{end_s}s]" if start_s is not None or end_s is not None else "",
    )
    cmd = [ffmpeg, "-y"]
    if start_s is not None:
        cmd += ["-ss", str(start_s)]
    cmd += ["-i", _ffmpeg_path(video_path)]
    if end_s is not None:
        cmd += ["-to", str(end_s)]
    cmd += [
        "-map", f"0:{stream_index}",       # select exact stream by container index
        "-ac", str(channels),
        "-ar", str(sample_rate),
        "-vn",                             # drop video
        "-f", "wav",
        _ffmpeg_path(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg audio extraction failed for stream {stream_index} "
            f"of {video_path.name}:\n{result.stderr.strip()}"
        )

    return output_path


# export_clip has three distinct FFmpeg command shapes (reencode, softsub, stream-copy).
# Each branch is short on its own but shares the path and duration setup that precedes it.
# Splitting into three helper functions would require passing those shared values as params
# and would send readers jumping across three call sites to understand the full switch logic.
# Left in one function; the branch comments ('Frame-accurate', 'Softsub', 'Fast stream copy')
# serve as in-place section headers.
def export_clip(
    video_path: Path,
    start_ms: int,
    end_ms: int,
    output_path: Path,
    reencode: bool = False,
    subtitle_path: Optional[Path] = None,
    subtitle_track_path: Optional[Path] = None,
    audio_stream_index: Optional[int] = None,
) -> Path:
    """
    Cut a clip from *video_path* between *start_ms* and *end_ms*.

    Default (reencode=False): stream-copy — extremely fast, lossless,
    but seeks to the nearest keyframe so the actual start may be up to
    ~2 seconds early.  For RP highlights this is almost always fine.

    With reencode=True: frame-accurate cut using libx264 + aac.
    Slower but exact.  Use if the keyframe offset is noticeable.

    With subtitle_path: burn subtitles from the given SRT file into the video.
    Forces re-encoding regardless of the reencode flag.

    With audio_stream_index: export only that container stream index for audio
    (plus the first video stream).  When None, all streams are copied.

    The output container format is inferred from output_path's suffix.
    Use .mp4 for broadest compatibility on both Windows and Linux.
    """
    ffmpeg, _ = find_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start_s    = start_ms / 1000.0
    duration_s = (end_ms - start_ms) / 1000.0

    if subtitle_path is not None or reencode:
        # Frame-accurate: seek after -i (slow but exact)
        cmd = [
            ffmpeg, "-y",
            "-i",  _ffmpeg_path(video_path),
            "-ss", str(start_s),
            "-t",  str(duration_s),
        ]
        if audio_stream_index is not None:
            cmd += ["-map", "0:v:0", "-map", f"0:{audio_stream_index}"]
        cmd += [
            "-c:v", "libx264", "-crf", "18", "-preset", "fast",
            "-c:a", "aac",     "-b:a", "192k",
        ]
        if subtitle_path is not None:
            # FFmpeg filtergraph uses ':' as option separator; Windows drive-letter
            # colons (C:/) must be escaped as C\:/ within the filter string.
            escaped = subtitle_path.as_posix().replace(":", "\\:")
            cmd += ["-vf", f"subtitles={escaped}"]
        cmd.append(_ffmpeg_path(output_path))
    elif subtitle_track_path is not None:
        # Softsub: stream-copy video+audio, add SRT as a subtitle track (no re-encode)
        sub_codec = "mov_text" if output_path.suffix.lower() == ".mp4" else "srt"
        cmd = [
            ffmpeg, "-y",
            "-ss", str(start_s),
            "-i",  _ffmpeg_path(video_path),
            "-t",  str(duration_s),
            "-i",  _ffmpeg_path(subtitle_track_path),
            "-map", "0", "-map", "1:s",
            "-c:v", "copy", "-c:a", "copy", "-c:s", sub_codec,
            _ffmpeg_path(output_path),
        ]
    else:
        # Fast stream copy: seek before -i (keyframe-aligned)
        cmd = [
            ffmpeg, "-y",
            "-ss", str(start_s),
            "-i",  _ffmpeg_path(video_path),
            "-t",  str(duration_s),
        ]
        if audio_stream_index is not None:
            cmd += ["-map", "0:v:0", "-map", f"0:{audio_stream_index}"]
        cmd += ["-c", "copy", _ffmpeg_path(output_path)]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg clip export failed:\n{result.stderr.strip()}"
        )

    return output_path
