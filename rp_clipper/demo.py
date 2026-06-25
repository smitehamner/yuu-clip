"""
Demo video compilation.

Combines exported clip files into a single highlight reel with:
  - Title cards between clips (black background, white text, clip description)
  - Optional crossfade / wipe transitions via ffmpeg xfade filter

Requires ffmpeg on PATH.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from rp_clipper.db.models import ClipCandidate, Video

TRANSITIONS = ("fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright", "none")
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


# ---------------------------------------------------------------------------
# Title card generation
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Duration probe
# ---------------------------------------------------------------------------

def _probe_fps(path: Path) -> float:
    """Return video frame rate as a float via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=r_frame_rate",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True, text=True, check=True,
    )
    out = result.stdout.strip()
    if "/" in out:
        num, den = out.split("/")
        return float(num) / float(den)
    return float(out)


def _probe_duration(path: Path) -> float:
    """Return duration in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True, text=True, check=True,
    )
    out = result.stdout.strip()
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


# ---------------------------------------------------------------------------
# Concat (hard cut, no re-encode)
# ---------------------------------------------------------------------------

def _compile_concat(segments: list[Path], output: Path) -> None:
    """Fast concat using the concat demuxer — stream-copies, no re-encode."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False,
                                    encoding="utf-8") as f:
        for seg in segments:
            f.write(f"file '{seg.as_posix()}'\n")
        list_path = Path(f.name)
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


# ---------------------------------------------------------------------------
# xfade transitions
# ---------------------------------------------------------------------------

def _compile_xfade(
    segments: list[Path],
    durations: list[float],
    output: Path,
    transition: str,
    trans_dur: float,
) -> None:
    """Re-encode with xfade/acrossfade transitions between every segment pair."""
    n = len(segments)
    assert n == len(durations)

    inputs: list[str] = []
    for seg in segments:
        inputs += ["-i", str(seg)]

    # Build filter_complex for video xfade chain
    v_chain: list[str] = []
    a_chain: list[str] = []
    cumulative = 0.0

    for i in range(n - 1):
        cumulative += durations[i]
        offset = max(0.0, cumulative - (i + 1) * trans_dur)

        in_v = f"[x{i-1}]" if i > 0 else f"[{i}:v]"
        out_v = f"[x{i}]" if i < n - 2 else "[vout]"
        v_chain.append(
            f"{in_v}[{i+1}:v]xfade=transition={transition}"
            f":duration={trans_dur}:offset={offset:.3f}{out_v}"
        )

        in_a = f"[ca{i-1}]" if i > 0 else f"[{i}:a]"
        out_a = f"[ca{i}]" if i < n - 2 else "[aout]"
        a_chain.append(
            f"{in_a}[{i+1}:a]acrossfade=d={trans_dur}{out_a}"
        )

    filter_complex = ";".join(v_chain + a_chain)
    if n == 1:
        # Only one segment — just re-encode it
        filter_complex = "[0:v]copy[vout];[0:a]acopy[aout]"

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        str(output),
    ]
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compile_demo(
    clips: list["ClipCandidate"],
    video_map: dict[int, "Video"],
    export_dir: Path,
    output: Path,
    transition: str = _DEFAULT_TRANSITION,
    trans_dur: float = _DEFAULT_TRANS_DUR,
    title_dur: float = _DEFAULT_TITLE_DUR,
) -> None:
    """
    Build a highlight reel from *clips*.

    Each clip must have a corresponding exported file in *export_dir*.
    Title cards are generated in a temp directory and cleaned up afterward.
    """
    if transition not in TRANSITIONS:
        raise ValueError(f"transition must be one of {TRANSITIONS}")

    n = len(clips)

    # Pass 1: resolve clip files, probe fps + durations.
    clip_files: list[Path] = []
    clip_durations: list[float] = []
    clip_fps: Optional[float] = None
    for clip in clips:
        video = video_map[clip.video_id]
        stem = Path(video.filename).stem
        start_hms = clip.start_hms.replace(":", "-")
        clip_file = export_dir / f"{stem}_clip{clip.id}_{start_hms}.mkv"
        if not clip_file.exists():
            raise FileNotFoundError(
                f"Export not found for clip {clip.id}: {clip_file}\n"
                f"Run 'rp-clip export {clip.id}' first."
            )
        if clip_fps is None:
            try:
                clip_fps = _probe_fps(clip_file)
            except Exception:
                clip_fps = 30.0
        clip_files.append(clip_file)
        clip_durations.append(_probe_duration(clip_file))

    total_footage = sum(clip_durations)
    if transition == "none":
        print(
            f"Compiling {n} clip(s) — {total_footage:.0f}s footage"
            " — stream copy (fast)",
            flush=True,
        )
    else:
        total_encode = total_footage + n * title_dur
        eta = total_encode / 3.0
        print(
            f"Compiling {n} clip(s) — {total_footage:.0f}s footage"
            f" — estimated encode ~{eta:.0f}s",
            flush=True,
        )

    # Pass 2: generate title cards and assemble segment list.
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        segments: list[Path] = []
        durations: list[float] = []

        for idx, (clip, clip_file, clip_dur) in enumerate(
            zip(clips, clip_files, clip_durations)
        ):
            video = video_map[clip.video_id]
            stem = Path(video.filename).stem
            session_date = stem[:10]
            title_lines: list[tuple[str, int]] = [
                (f"Clip {idx + 1} of {n}", _DEFAULT_FONT_SIZE_H1),
                (session_date, _DEFAULT_FONT_SIZE_H2),
            ]
            if clip.description:
                title_lines.append((clip.description, _DEFAULT_FONT_SIZE_BODY))

            print(f"Generating title card {idx + 1}/{n}…", flush=True)
            card_path = tmp_dir / f"title_{idx:03d}.mkv"
            _make_title_card(title_lines, card_path, duration=title_dur,
                             fps=clip_fps or 30.0)
            segments.append(card_path)
            durations.append(title_dur)

            segments.append(clip_file)
            durations.append(clip_dur)

        print(f"Encoding final reel ({total_footage:.0f}s footage)…", flush=True)
        if transition == "none":
            _compile_concat(segments, output)
        else:
            _compile_xfade(segments, durations, output, transition, trans_dur)
        print("Encode complete.", flush=True)
