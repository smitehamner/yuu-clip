"""
Highlight reel compilation.

Combines exported clip files into a single highlight reel with:
  - Title cards between clips (black background, white text, clip description)
  - Optional crossfade / wipe transitions via ffmpeg xfade filter

Requires ffmpeg on PATH.
"""
from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.db.models import ClipCandidate, Video

_log = logging.getLogger(__name__)

TRANSITIONS = ("fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright", "none", "random")
_DEFAULT_TRANSITION    = "fade"
_DEFAULT_TRANS_DUR     = 0.5   # seconds of overlap
_DEFAULT_TITLE_DUR     = 3.0   # seconds each title card shows
_DEFAULT_FONT_SIZE_H1  = 52
_DEFAULT_FONT_SIZE_H2  = 36
_DEFAULT_FONT_SIZE_BODY = 28

# Font candidates tried in order; first existing file wins.
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\calibri.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\verdana.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
]


def _find_font() -> Optional[str]:
    for p in _FONT_CANDIDATES:
        if Path(p).exists():
            return p.replace("\\", "/")  # forward-slash for FFmpeg
    return None


def _esc(path: str) -> str:
    """Escape a path for use as a single-quoted ffmpeg filter option value.

    Colons must be escaped as \\: so ffmpeg does not treat them as option
    separators (relevant for Windows drive-letter paths like C:/...).
    """
    return (
        path.replace("\\", "\\\\")
            .replace("'",  "'\\''")
            .replace(":",  "\\:")
            .replace("%",  "%%")
    )



def _make_title_card(
    lines: list[tuple[str, int]],   # [(text, fontsize), ...]
    output_path: Path,
    width: int = 1920,
    height: int = 1080,
    duration: float = _DEFAULT_TITLE_DUR,
    fps: float = 30.0,
    sample_rate: int = 48000,
) -> None:
    """Render a black title card with centred white text lines to *output_path*.

    Text lines are written to temp files and referenced via drawtext's
    textfile= option so that apostrophes, colons, and other special characters
    in descriptions never need escaping in the filter string.
    """
    font_path = _find_font()
    font_spec = f":fontfile='{_esc(font_path)}'" if font_path else ""

    line_gap = 16
    total_h = sum(fs + line_gap for _, fs in lines) - line_gap
    y_start = (height - total_h) // 2

    with tempfile.TemporaryDirectory() as work:
        work_dir = Path(work)
        drawtext_filters = []
        y = y_start
        for i, (text, fs) in enumerate(lines):
            txt_file = work_dir / f"line{i}.txt"
            txt_file.write_text(text, encoding="utf-8")
            txt_path = _esc(str(txt_file).replace("\\", "/"))
            drawtext_filters.append(
                f"drawtext=textfile='{txt_path}'"
                f":fontcolor=white:fontsize={fs}"
                f":x=(w-text_w)/2:y={y}"
                f"{font_spec}"
            )
            y += fs + line_gap

        vf = ",".join(drawtext_filters)
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i",
            f"color=black:size={width}x{height}:rate={fps}:duration={duration}",
            "-f", "lavfi", "-i",
            f"anullsrc=channel_layout=stereo:sample_rate={sample_rate}",
            "-vf", vf,
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "aac", "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            str(output_path),
        ]
        subprocess.run(cmd, check=True)


def _ffprobe_stream_value(path: Path, entry: str) -> str:
    """Return one stream entry value from ffprobe, or empty string if unavailable."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", f"stream={entry}",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def _probe_fps(path: Path) -> float:
    """Return video frame rate as a float via ffprobe."""
    out = _ffprobe_stream_value(path, "r_frame_rate")
    if "/" in out:
        num, den = out.split("/")
        return float(num) / float(den)
    return float(out)


def _probe_duration(path: Path) -> float:
    """Return duration in seconds via ffprobe."""
    out = _ffprobe_stream_value(path, "duration")
    if not out or out == "N/A":
        result2 = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, check=True,
        )
        out = result2.stdout.strip()
    if not out or out == "N/A":
        raise ValueError(f"ffprobe could not determine duration for {path}")
    return float(out)


def _compile_concat(segments: list[Path], output: Path) -> None:
    """Fast concat using the concat demuxer — stream-copies, no re-encode."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False,
                                    encoding="utf-8") as f:
        list_path = Path(f.name)
        for seg in segments:
            f.write(f"file '{seg.as_posix()}'\n")
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "concat", "-safe", "0",
                "-i", str(list_path),
                "-c", "copy",
                str(output),
            ],
            check=True,
        )
    finally:
        list_path.unlink(missing_ok=True)


def _build_xfade_cmd(
    segments: list[Path],
    durations: list[float],
    output: Path,
    per_cut_transitions: list[str],
    trans_dur: float,
) -> list[str]:
    """Build an ffmpeg command that re-encodes segments with xfade/acrossfade transitions.

    *per_cut_transitions* must have exactly len(segments)-1 entries — one
    transition name per cut. Callers that want a single uniform transition
    pass a list of the same value repeated; callers that want random
    transitions pass a pre-shuffled list.
    """
    n = len(segments)
    assert n == len(durations)
    assert len(per_cut_transitions) == max(0, n - 1)

    inputs: list[str] = []
    for seg in segments:
        inputs += ["-i", str(seg)]

    v_chain: list[str] = []
    a_chain: list[str] = []
    cumulative = 0.0

    for i in range(n - 1):
        cumulative += durations[i]
        offset = max(0.0, cumulative - (i + 1) * trans_dur)
        t = per_cut_transitions[i]

        in_v = f"[x{i-1}]" if i > 0 else f"[{i}:v]"
        out_v = f"[x{i}]" if i < n - 2 else "[vout]"
        v_chain.append(
            f"{in_v}[{i+1}:v]xfade=transition={t}"
            f":duration={trans_dur}:offset={offset:.3f}{out_v}"
        )

        in_a = f"[ca{i-1}]" if i > 0 else f"[{i}:a]"
        out_a = f"[ca{i}]" if i < n - 2 else "[aout]"
        a_chain.append(f"{in_a}[{i+1}:a]acrossfade=d={trans_dur}{out_a}")

    filter_complex = ";".join(v_chain + a_chain)
    if n == 1:
        # The loop above builds zero filter entries, which would produce an
        # empty -filter_complex and fail. Use passthrough filters instead.
        filter_complex = "[0:v]copy[vout];[0:a]acopy[aout]"

    return [
        "ffmpeg", "-y", "-loglevel", "error",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        str(output),
    ]


def _compile_xfade(
    segments: list[Path],
    durations: list[float],
    output: Path,
    transition: str,
    trans_dur: float,
) -> None:
    """Re-encode with xfade/acrossfade transitions between every segment pair."""
    n = len(segments)
    transitions = [transition] * max(0, n - 1)
    subprocess.run(_build_xfade_cmd(segments, durations, output, transitions, trans_dur), check=True)


def _compile_xfade_random(
    segments: list[Path],
    durations: list[float],
    output: Path,
    pool: list[str],
    trans_dur: float,
    rng,
) -> None:
    """Like _compile_xfade but picks a different transition at each cut."""
    n = len(segments)
    transitions = [rng.choice(pool) for _ in range(max(0, n - 1))]
    subprocess.run(_build_xfade_cmd(segments, durations, output, transitions, trans_dur), check=True)


def _resolve_clip_files(
    clips: list["ClipCandidate"],
    video_map: dict[int, "Video"],
    export_dir: Path,
) -> tuple[list[Path], list[float], float]:
    """Locate exported files for each clip and probe their durations.

    Returns (clip_files, clip_durations, fps_of_first_file).
    Raises FileNotFoundError if any clip has no exported file.
    """
    clip_files: list[Path] = []
    clip_durations: list[float] = []
    detected_fps: Optional[float] = None
    for clip in clips:
        video = video_map[clip.video_id]
        stem = Path(video.filename).stem
        base = f"{stem}_clip{clip.id}_{clip.start_hms.replace(':', '-')}"
        clip_file = next(
            (export_dir / f"{base}{ext}"
             for ext in (".mkv", ".mp4", ".mov", ".avi", ".webm")
             if (export_dir / f"{base}{ext}").exists()),
            None,
        )
        if clip_file is None:
            raise FileNotFoundError(
                f"Export not found for clip {clip.id} (tried .mkv/.mp4/.mov/.avi/.webm in {export_dir})\n"
                f"Run 'yuuclip export {clip.id}' first."
            )
        if detected_fps is None:
            try:
                detected_fps = _probe_fps(clip_file)
            except Exception as exc:
                _log.warning("Could not probe fps for %s: %s — using 30 fps", clip_file, exc)
                detected_fps = 30.0
        clip_files.append(clip_file)
        clip_durations.append(_probe_duration(clip_file))
    return clip_files, clip_durations, detected_fps or 30.0


def _build_segment_list(
    clips: list["ClipCandidate"],
    video_map: dict[int, "Video"],
    clip_files: list[Path],
    clip_durations: list[float],
    tmp_dir: Path,
    fps: float,
    title_dur: float,
) -> tuple[list[Path], list[float]]:
    """Render title cards and interleave them with clip files.

    Returns (segments, durations) — alternating title card, clip file for each clip.
    """
    n = len(clips)
    segments: list[Path] = []
    durations: list[float] = []
    for idx, (clip, clip_file, clip_dur) in enumerate(zip(clips, clip_files, clip_durations)):
        video = video_map[clip.video_id]
        session_date = Path(video.filename).stem[:10]
        title_lines: list[tuple[str, int]] = [
            (f"Clip {idx + 1} of {n}", _DEFAULT_FONT_SIZE_H1),
            (session_date, _DEFAULT_FONT_SIZE_H2),
        ]
        if clip.description:
            title_lines.append((clip.description, _DEFAULT_FONT_SIZE_BODY))

        print(f"Generating title card {idx + 1}/{n}…", flush=True)
        card_path = tmp_dir / f"title_{idx:03d}.mkv"
        _make_title_card(title_lines, card_path, duration=title_dur, fps=fps)
        segments.append(card_path)
        durations.append(title_dur)

        segments.append(clip_file)
        durations.append(clip_dur)
    return segments, durations


def compile_demo(
    clips: list["ClipCandidate"],
    video_map: dict[int, "Video"],
    export_dir: Path,
    output: Path,
    transition: str = _DEFAULT_TRANSITION,
    trans_dur: float = _DEFAULT_TRANS_DUR,
    title_dur: float = _DEFAULT_TITLE_DUR,
) -> None:
    """Build a highlight reel from *clips*.

    Each clip must have a corresponding exported file in *export_dir*.
    Title cards are generated in a temp directory and cleaned up afterward.
    """
    import random as _random

    if transition not in TRANSITIONS:
        raise ValueError(f"transition must be one of {TRANSITIONS}")

    _RANDOM_POOL = [t for t in TRANSITIONS if t not in ("none", "random")]
    n = len(clips)

    clip_files, clip_durations, clip_fps = _resolve_clip_files(clips, video_map, export_dir)
    total_footage = sum(clip_durations)

    if transition == "none":
        msg = f"Compiling {n} clip(s) — {total_footage:.0f}s footage — stream copy (fast)"
    else:
        eta = (total_footage + n * title_dur) / 3.0
        msg = f"Compiling {n} clip(s) — {total_footage:.0f}s footage — estimated encode ~{eta:.0f}s"
    _log.info(msg)
    print(msg, flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        segments, durations = _build_segment_list(
            clips, video_map, clip_files, clip_durations, Path(tmp), clip_fps, title_dur,
        )
        _log.info("Encoding final reel (%ds footage) → %s", int(total_footage), output.name)
        print(f"Encoding final reel ({total_footage:.0f}s footage)…", flush=True)
        if transition == "none":
            _compile_concat(segments, output)
        elif transition == "random":
            _compile_xfade_random(segments, durations, output, _RANDOM_POOL, trans_dur, _random)
        else:
            _compile_xfade(segments, durations, output, transition, trans_dur)
        size_mb = output.stat().st_size / (1024 * 1024)
        _log.info("Reel encode complete: %s (%.1f MB)", output.name, size_mb)
        print("Encode complete.", flush=True)
