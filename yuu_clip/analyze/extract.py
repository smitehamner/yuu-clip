"""
Audio extraction and clip export via FFmpeg.

All paths are handled as pathlib.Path objects and converted to strings
only at subprocess call time - Path.as_posix() is used on Windows to
avoid backslash confusion in FFmpeg's argument parser.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from yuu_clip.config import find_ffmpeg
from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from yuu_clip.export.presets import ExportPreset

_log = get_logger(__name__)

# libass Alignment codes for the numpad-style caption position. Only bottom/top
# center are exposed; bottom (2) is the renderer default so it emits nothing.
_CAPTION_ALIGNMENT = {"bottom": 2, "top": 8}

# Slack allowed when verifying an exported clip's duration against the requested
# window (keyframe seeking overshoots): the larger of a fixed floor and a fraction
# of the request. Exceeding it means the trim was not applied - fail loudly.
_DURATION_TOLERANCE_FLOOR_S = 5.0
_DURATION_TOLERANCE_FRACTION = 0.5


@dataclass(frozen=True)
class CaptionStyle:
    """Burned-in caption styling applied via libass force_style.

    Empty font_name / zero font_size / "bottom" position each mean "renderer
    default" and contribute no force_style fragment. PrimaryColour is never set -
    per-speaker colours arrive as inline colour tags in the caption file and must win.

    word_highlight switches the burn-in from static SRT lines to word-highlight ASS
    (a chunk of word_chunk_size words with the spoken word tinted); it is not a
    force_style field, so it only affects which caption format is written, not the
    filter fragment. See subtitles.lines_to_ass.
    """
    font_name: str = ""
    font_size: int = 0
    position: str = "bottom"
    word_highlight: bool = False
    word_chunk_size: int = 4

    def is_default(self) -> bool:
        return (
            not self.font_name
            and not self.font_size
            and self.position == "bottom"
            and not self.word_highlight
        )

    def force_style(self) -> Optional[str]:
        """Return the libass force_style value, or None when every field is default."""
        fragments: list[str] = []
        if self.font_name:
            fragments.append(f"FontName={self.font_name}")
        if self.font_size:
            fragments.append(f"FontSize={self.font_size}")
        alignment = _CAPTION_ALIGNMENT.get(self.position, 2)
        if alignment != 2:
            fragments.append(f"Alignment={alignment}")
        return ",".join(fragments) if fragments else None


def _subtitles_filter(subtitle_path: Path, style: Optional[CaptionStyle] = None) -> str:
    """Build the `subtitles=` burn-in filter fragment, with optional force_style.

    FFmpeg filtergraph uses ':' as option separator, so a Windows drive-letter colon
    (C:/) is escaped as C\\:/ AND the whole path is wrapped in single quotes. The
    escaping alone is not enough on the bundled ffmpeg build: an unquoted C\\:/... is
    still split at the drive colon, treating the rest of the path as the filter's
    `original_size` option ("Unable to parse ... as image size") - which broke every
    burned-in caption on Windows. Quoting the path fixes it. The force_style value is
    likewise single-quoted so its own commas are not parsed as filter separators
    (font names with commas are rejected upstream by validation).
    """
    escaped = subtitle_path.as_posix().replace(":", "\\:")
    base = f"subtitles='{escaped}'"
    force = style.force_style() if style is not None else None
    if force is None:
        return base
    return f"{base}:force_style='{force}'"


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
        "Extracting audio: %s stream %d -> %s%s",
        video_path.name, stream_index, output_path.name,
        f" [{start_s}s-{end_s}s]" if start_s is not None or end_s is not None else "",
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
# Building the arg list is split out into _build_clip_cmd so the ordering of -ss/-t
# relative to each -i can be unit-tested: an earlier bug placed -t between the two
# inputs in the softsub branch, where FFmpeg treats it as an input option for the
# subtitle file instead of an output duration limit - which copied the entire source.
def _build_clip_cmd(
    ffmpeg: str,
    video_path: Path,
    start_s: float,
    duration_s: float,
    output_path: Path,
    reencode: bool,
    subtitle_path: Optional[Path],
    subtitle_track_path: Optional[Path],
    audio_stream_index: Optional[int],
    caption_style: Optional[CaptionStyle] = None,
) -> list[str]:
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
            cmd += ["-vf", _subtitles_filter(subtitle_path, caption_style)]
        cmd.append(_ffmpeg_path(output_path))
        return cmd

    if subtitle_track_path is not None:
        # Softsub: stream-copy video+audio, add SRT as a subtitle track (no re-encode).
        # -t must come AFTER both inputs so it is an output option that limits the clip
        # length; placing it between the inputs binds it to the subtitle input instead
        # and leaves the video uncut (the full-source export bug).
        sub_codec = "mov_text" if output_path.suffix.lower() == ".mp4" else "srt"
        return [
            ffmpeg, "-y",
            "-ss", str(start_s),
            "-i",  _ffmpeg_path(video_path),
            "-i",  _ffmpeg_path(subtitle_track_path),
            "-map", "0", "-map", "1:s",
            "-t",  str(duration_s),
            "-c:v", "copy", "-c:a", "copy", "-c:s", sub_codec,
            _ffmpeg_path(output_path),
        ]

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
    return cmd


def _probe_duration_s(ffprobe: str, path: Path) -> Optional[float]:
    """Return the container duration of *path* in seconds, or None if unprobeable."""
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", _ffmpeg_path(path)],
        capture_output=True, text=True,
    )
    try:
        return float(result.stdout.strip())
    except (ValueError, AttributeError, TypeError):
        return None


def _verify_export_duration(ffprobe: str, output_path: Path, expected_s: float) -> None:
    """Guard against the 'whole source got exported' class of bug.

    Stream-copy keyframe seeking can overshoot the requested length slightly, so we
    allow generous slack. A result far longer than requested means the trim arguments
    were not applied - fail loudly rather than hand back a multi-hour file.
    """
    actual_s = _probe_duration_s(ffprobe, output_path)
    if actual_s is None:
        return
    tolerance_s = max(_DURATION_TOLERANCE_FLOOR_S, expected_s * _DURATION_TOLERANCE_FRACTION)
    if actual_s > expected_s + tolerance_s:
        raise RuntimeError(
            f"Exported clip is {actual_s:.0f}s but the requested window was "
            f"{expected_s:.0f}s - the trim was not applied. Output left at {output_path}."
        )


def export_clip(
    video_path: Path,
    start_ms: int,
    end_ms: int,
    output_path: Path,
    reencode: bool = False,
    subtitle_path: Optional[Path] = None,
    subtitle_track_path: Optional[Path] = None,
    audio_stream_index: Optional[int] = None,
    caption_style: Optional[CaptionStyle] = None,
) -> Path:
    """
    Cut a clip from *video_path* between *start_ms* and *end_ms*.

    Default (reencode=False): stream-copy - extremely fast, lossless,
    but seeks to the nearest keyframe so the actual start may be up to
    ~2 seconds early.  For highlight clips this is almost always fine.

    With reencode=True: frame-accurate cut using libx264 + aac.
    Slower but exact.  Use if the keyframe offset is noticeable.

    With subtitle_path: burn subtitles from the given SRT file into the video.
    Forces re-encoding regardless of the reencode flag.

    With audio_stream_index: export only that container stream index for audio
    (plus the first video stream).  When None, all streams are copied.

    The output container format is inferred from output_path's suffix.
    Use .mp4 for broadest compatibility on both Windows and Linux.
    """
    ffmpeg, ffprobe = find_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start_s    = start_ms / 1000.0
    duration_s = (end_ms - start_ms) / 1000.0

    cmd = _build_clip_cmd(
        ffmpeg, video_path, start_s, duration_s, output_path,
        reencode, subtitle_path, subtitle_track_path, audio_stream_index,
        caption_style,
    )

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg clip export failed:\n{result.stderr.strip()}"
        )

    _verify_export_duration(ffprobe, output_path, duration_s)

    return output_path


def _null_sink() -> str:
    """ffmpeg's null-muxer output target - platform-specific bit bucket for pass 1."""
    return "NUL" if sys.platform == "win32" else "/dev/null"


def _run_ffmpeg(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg encode failed:\n{result.stderr.strip()}")


# Vertical (9:16 Shorts) output dimensions.
_VERTICAL_W, _VERTICAL_H = 1080, 1920


def _vertical_crop_filters(crop_x: Optional[float]) -> list[str]:
    """Crop the source to a 9:16 column positioned by *crop_x* (0=left, 0.5=center,
    1=right; None → center), then fit it to 1080x1920.

    The crop width is min(iw, ih*9/16) so a source already narrower than 9:16 (a
    portrait clip, e.g. a re-imported Short) is never asked for more pixels than it
    has - it takes the full width and gets letterboxed by the pad instead of failing
    the encode. The comma inside min() is escaped (\\,) so libavfilter doesn't read
    it as a filter separator. Scale uses decrease+pad so the exact-9:16 case fits
    with no padding and the narrow case is padded rather than distorted.
    """
    fraction = 0.5 if crop_x is None else max(0.0, min(1.0, crop_x))
    crop_w = "min(iw\\,ih*9/16)"
    x_expr = f"(iw-{crop_w})*{fraction:.4f}"
    return [
        f"crop={crop_w}:ih:{x_expr}:0",
        f"scale={_VERTICAL_W}:{_VERTICAL_H}:force_original_aspect_ratio=decrease",
        f"pad={_VERTICAL_W}:{_VERTICAL_H}:(ow-iw)/2:(oh-ih)/2",
    ]


def _preset_video_filter(
    preset: "ExportPreset",
    subtitle_path: Optional[Path],
    caption_style: Optional[CaptionStyle] = None,
    crop_x: Optional[float] = None,
) -> Optional[str]:
    """Build the -vf filter chain for a preset encode: either a 9:16 vertical
    crop+scale (Shorts) or plain scale-down-only (never upscales a smaller source),
    plus burned-in captions last so they are sized for the final frame."""
    parts: list[str] = []
    if preset.vertical:
        parts.extend(_vertical_crop_filters(crop_x))
    elif preset.height is not None:
        parts.append(f"scale=-2:'min(ih,{preset.height})'")
    if subtitle_path is not None:
        parts.append(_subtitles_filter(subtitle_path, caption_style))
    return ",".join(parts) if parts else None


def export_clip_with_preset(
    video_path: Path,
    start_ms: int,
    end_ms: int,
    output_path: Path,
    preset: "ExportPreset",
    subtitle_path: Optional[Path] = None,
    audio_stream_index: Optional[int] = None,
    caption_style: Optional[CaptionStyle] = None,
    crop_x: Optional[float] = None,
) -> Path:
    """Cut a clip from *video_path* using an Export preset's container/resolution/
    bitrate recipe. Always re-encodes (no stream-copy path - a preset's whole
    purpose is to change the encode).

    Two encode modes, chosen by which of preset.crf / preset.target_size_mb is
    set (validate_preset_dict guarantees exactly one):
      - crf: single-pass constant-quality encode at the preset's CRF.
      - target_size_mb: two-pass encode at the bitrate that fills the target
        size (see export_presets.resolve_video_kbps); raises
        ClipTooLongForPresetError before encoding if the clip can't fit it.

    subtitle_path burns captions in via the same -vf chain as a plain Precise
    Export; there is no soft-subtitle (embed) path for a preset export (that
    combination is not offered by the export UI).
    """
    from yuu_clip.export.presets import resolve_video_kbps

    ffmpeg, ffprobe = find_ffmpeg()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start_s    = start_ms / 1000.0
    duration_s = (end_ms - start_ms) / 1000.0
    vf = _preset_video_filter(preset, subtitle_path, caption_style, crop_x)
    map_args = ["-map", "0:v:0", "-map", f"0:{audio_stream_index}"] if audio_stream_index is not None else []

    if preset.target_size_mb is not None:
        video_kbps = resolve_video_kbps(preset, duration_s)
        with tempfile.TemporaryDirectory() as tmp_dir:
            passlog = Path(tmp_dir) / "ffmpeg2pass"
            base_cmd = [
                ffmpeg, "-y", "-i", _ffmpeg_path(video_path), "-ss", str(start_s), "-t", str(duration_s),
                *map_args, "-c:v", "libx264", "-b:v", f"{video_kbps:.0f}k", "-preset", "fast",
                "-passlogfile", _ffmpeg_path(passlog),
            ]
            if vf:
                base_cmd += ["-vf", vf]
            _run_ffmpeg([*base_cmd, "-pass", "1", "-an", "-f", "mp4", _null_sink()])
            _run_ffmpeg([
                *base_cmd, "-pass", "2", "-c:a", "aac", "-b:a", f"{preset.audio_kbps}k",
                _ffmpeg_path(output_path),
            ])
    else:
        cmd = [
            ffmpeg, "-y", "-i", _ffmpeg_path(video_path), "-ss", str(start_s), "-t", str(duration_s),
            *map_args, "-c:v", "libx264", "-crf", str(preset.crf), "-preset", "fast",
            "-c:a", "aac", "-b:a", f"{preset.audio_kbps}k",
        ]
        if vf:
            cmd += ["-vf", vf]
        cmd.append(_ffmpeg_path(output_path))
        _run_ffmpeg(cmd)

    _verify_export_duration(ffprobe, output_path, duration_s)
    return output_path
