"""
Highlight reel compilation.

Combines exported clip files into a single highlight reel with:
  - Title cards between clips (color, size, and content configurable - see
    Config.title_card_* in config.py)
  - Optional crossfade / wipe transitions via ffmpeg xfade filter

Requires ffmpeg on PATH.
"""
from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from yuu_clip.config import run_ffmpeg
from yuu_clip.export.naming import (
    DEFAULT_EXPORT_NAME_TEMPLATE,
    EXPORT_VIDEO_EXTENSIONS,
    candidate_export_paths,
    export_base_stem,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

_log = logging.getLogger(__name__)

TRANSITIONS = ("fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright", "none", "random")
_RANDOM_POOL = [t for t in TRANSITIONS if t not in ("none", "random")]
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


_TITLE_CARD_DESCRIPTION_MAX_CHARS = 90


def _to_ffmpeg_color(hex_color: str) -> str:
    """Convert a validated '#RRGGBB' config color to ffmpeg's '0xRRGGBB' form."""
    return "0x" + hex_color.lstrip("#")


def _truncate_description(text: str) -> str:
    """Cap a title-card description line so drawtext (which never wraps) doesn't
    render it off-card - a 300-char description already renders off-card today,
    so this is a strict improvement over the previous unbounded behavior."""
    if len(text) <= _TITLE_CARD_DESCRIPTION_MAX_CHARS:
        return text
    return text[: _TITLE_CARD_DESCRIPTION_MAX_CHARS - 1].rstrip() + "…"


def _render_title_card_template(template: str, values: dict[str, str]) -> list[str]:
    """Substitute placeholders line-by-line, dropping lines that render empty.

    Each newline-separated template line becomes a title-card line. A line that
    is empty after substitution (e.g. {description} on a clip with no
    description) is dropped so the card never shows a blank line. Each line is
    truncated to fit the card (drawtext does not wrap)."""
    lines: list[str] = []
    for raw_line in template.split("\n"):
        rendered = raw_line
        for key, val in values.items():
            rendered = rendered.replace("{" + key + "}", val)
        rendered = _truncate_description(rendered.strip())
        if rendered:
            lines.append(rendered)
    return lines


def title_card_lines(
    cand: "ClipCandidate",
    config: "Config",
    *,
    primary_size: int,
    secondary_size: int,
) -> list[tuple[str, int]]:
    """Return the title-card (text, fontsize) lines for *cand* from
    config.title_card_template, honoring config.title_card_scale.

    The first rendered line uses *primary_size*, remaining lines use
    *secondary_size* - clip exports and reels pass different base sizes but share
    the template, scale multiplier, and this headline/body hierarchy. Uses
    effective_description (the user-edited value, if any) rather than the raw LLM
    description. A template that renders no lines (empty, or every line collapsed
    to blank) falls back to the timecode line so a card is never emitted empty.
    """
    scale = config.title_card_scale
    values = {
        "description": cand.effective_description,
        "start": cand.start_hms,
        "duration": cand.duration_hms,
    }
    rendered = _render_title_card_template(config.title_card_template, values)
    if not rendered:
        rendered = [f"{cand.start_hms}  ·  {cand.duration_hms}"]
    return [
        (text, round((primary_size if idx == 0 else secondary_size) * scale))
        for idx, text in enumerate(rendered)
    ]


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
    bg_color: str = "#000000",
    font_color: str = "#ffffff",
) -> None:
    """Render a title card with centred text lines to *output_path*.

    *bg_color* / *font_color* are validated '#RRGGBB' strings (config.py
    validate_hex_color); escaping is unaffected since they're never
    interpolated as free text into the filter string.

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
                f":fontcolor={_to_ffmpeg_color(font_color)}:fontsize={fs}"
                f":x=(w-text_w)/2:y={y}"
                f"{font_spec}"
            )
            y += fs + line_gap

        vf = ",".join(drawtext_filters)
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i",
            f"color={_to_ffmpeg_color(bg_color)}:size={width}x{height}:rate={fps}:duration={duration}",
            "-f", "lavfi", "-i",
            f"anullsrc=channel_layout=stereo:sample_rate={sample_rate}",
            "-vf", vf,
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "aac", "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            str(output_path),
        ]
        run_ffmpeg(cmd)


def _ffprobe_stream_value(path: Path, entry: str) -> str:
    """Return one stream entry value from ffprobe, or empty string if unavailable."""
    result = run_ffmpeg(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", f"stream={entry}",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ]
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
        result2 = run_ffmpeg(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)]
        )
        out = result2.stdout.strip()
    if not out or out == "N/A":
        raise ValueError(f"ffprobe could not determine duration for {path}")
    return float(out)


def _compile_concat(segments: list[Path], output: Path) -> None:
    """Fast concat using the concat demuxer - stream-copies, no re-encode."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False,
                                    encoding="utf-8") as f:
        list_path = Path(f.name)
        for seg in segments:
            # The concat demuxer treats ' as a quote delimiter and unescapes '\'' to a
            # literal apostrophe - a filename like "Tom's stream_clip.mkv" breaks the
            # list line without this (export_base_stem does not strip apostrophes).
            escaped = seg.as_posix().replace("'", r"'\''")
            f.write(f"file '{escaped}'\n")
    try:
        run_ffmpeg(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "concat", "-safe", "0",
                "-i", str(list_path),
                "-c", "copy",
                str(output),
            ]
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

    *per_cut_transitions* must have exactly len(segments)-1 entries - one
    transition name per cut. Callers that want a single uniform transition
    pass a list of the same value repeated; callers that want random
    transitions pass a list built by sampling the pool with rng.choice per cut.
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
    run_ffmpeg(_build_xfade_cmd(segments, durations, output, transitions, trans_dur))


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
    run_ffmpeg(_build_xfade_cmd(segments, durations, output, transitions, trans_dur))


def _select_clip_export_file(clip, video, export_dir: Path, name_template: str) -> Optional[Path]:
    """Pick one exported file for *clip* when several per-preset formats exist.

    A clip can now have multiple exported formats (Export presets - Plan 07).
    Prefers the default (presetless, original-quality) export so a reel always
    uses that file when available; otherwise falls back to the most recently
    modified preset format on disk. Deterministic so a reel build never
    silently changes which format it uses between runs.
    """
    base = export_base_stem(clip, name_template, video_filename=video.filename)
    default_file = next((p for p in candidate_export_paths(export_dir, base) if p.exists()), None)
    if default_file is not None:
        return default_file
    preset_candidates = [p for p in export_dir.glob(f"{base}_*") if p.suffix in EXPORT_VIDEO_EXTENSIONS]
    if not preset_candidates:
        return None
    return max(preset_candidates, key=lambda p: p.stat().st_mtime)


def _resolve_clip_files(
    clips: list["ClipCandidate"],
    video_map: dict[int, "Video"],
    export_dir: Path,
    name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
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
        clip_file = _select_clip_export_file(clip, video, export_dir, name_template)
        if clip_file is None:
            raise FileNotFoundError(
                f"Export not found for clip {clip.id} (tried .mkv/.mp4/.mov/.avi/.webm in {export_dir})\n"
                f"Run 'yuuclip export {clip.id}' first."
            )
        if detected_fps is None:
            try:
                detected_fps = _probe_fps(clip_file)
            except Exception as exc:
                _log.warning("Could not probe fps for %s: %s - using 30 fps", clip_file, exc)
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
    config: "Config",
) -> tuple[list[Path], list[float]]:
    """Render title cards and interleave them with clip files.

    Returns (segments, durations) - alternating title card, clip file for each clip.
    """
    n = len(clips)
    scale = config.title_card_scale
    segments: list[Path] = []
    durations: list[float] = []
    for idx, (clip, clip_file, clip_dur) in enumerate(zip(clips, clip_files, clip_durations)):
        video = video_map[clip.video_id]
        session_date = Path(video.filename).stem[:10]
        title_lines: list[tuple[str, int]] = [
            (f"Clip {idx + 1} of {n}", round(_DEFAULT_FONT_SIZE_H1 * scale)),
            (session_date, round(_DEFAULT_FONT_SIZE_H2 * scale)),
        ]
        title_lines += title_card_lines(
            clip, config, primary_size=_DEFAULT_FONT_SIZE_H2, secondary_size=_DEFAULT_FONT_SIZE_BODY,
        )

        print(f"Generating title card {idx + 1}/{n}...", flush=True)
        card_path = tmp_dir / f"title_{idx:03d}.mkv"
        _make_title_card(
            title_lines, card_path, duration=title_dur, fps=fps,
            bg_color=config.title_card_bg_color, font_color=config.title_card_font_color,
        )
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
    config: "Config",
    transition: str = _DEFAULT_TRANSITION,
    trans_dur: float = _DEFAULT_TRANS_DUR,
    title_dur: float = _DEFAULT_TITLE_DUR,
    name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> None:
    """Build a highlight reel from *clips*.

    Each clip must have a corresponding exported file in *export_dir*.
    Title cards are generated in a temp directory and cleaned up afterward,
    using *config*'s title_card_* fields for color, size, and content.
    """
    import random as _random

    if transition not in TRANSITIONS:
        raise ValueError(f"transition must be one of {TRANSITIONS}")

    n = len(clips)

    clip_files, clip_durations, clip_fps = _resolve_clip_files(clips, video_map, export_dir, name_template)
    total_footage = sum(clip_durations)

    if transition == "none":
        msg = f"Compiling {n} clip(s) - {total_footage:.0f}s footage - stream copy (fast)"
    else:
        eta = (total_footage + n * title_dur) / 3.0
        msg = f"Compiling {n} clip(s) - {total_footage:.0f}s footage - estimated encode ~{eta:.0f}s"
    _log.info(msg)
    print(msg, flush=True)

    try:
        with tempfile.TemporaryDirectory() as tmp:
            segments, durations = _build_segment_list(
                clips, video_map, clip_files, clip_durations, Path(tmp), clip_fps, title_dur, config,
            )
            _log.info("Encoding final reel (%ds footage) -> %s", int(total_footage), output.name)
            print(f"Encoding final reel ({total_footage:.0f}s footage)...", flush=True)
            if transition == "none":
                _compile_concat(segments, output)
            elif transition == "random":
                _compile_xfade_random(segments, durations, output, _RANDOM_POOL, trans_dur, _random)
            else:
                _compile_xfade(segments, durations, output, transition, trans_dur)
            size_mb = output.stat().st_size / (1024 * 1024)
            _log.info("Reel encode complete: %s (%.1f MB)", output.name, size_mb)
            print("Encode complete.", flush=True)
    except Exception as exc:
        _log.error("Reel compilation failed for %s: %s", output.name, exc, exc_info=True)
        raise

    _write_reel_composition(output, clips, clip_durations, transition, trans_dur, title_dur)


def reel_composition_path(reel_path: Path) -> Path:
    """Sidecar recording a reel's clip order + timing, so captions can be
    (re)generated later without re-probing or storing DB composition state."""
    return reel_path.with_suffix(".reel.json")


def reel_caption_path(reel_path: Path) -> Path:
    return reel_path.with_suffix(".srt")


def _write_reel_composition(
    reel_path: Path,
    clips: list["ClipCandidate"],
    clip_durations: list[float],
    transition: str,
    trans_dur: float,
    title_dur: float,
) -> None:
    data = {
        "version": 1,
        "transition": transition,
        "trans_dur": trans_dur,
        "title_dur": title_dur,
        "clips": [
            {"id": clip.id, "duration_s": duration}
            for clip, duration in zip(clips, clip_durations)
        ],
    }
    reel_composition_path(reel_path).write_text(json.dumps(data, indent=2), encoding="utf-8")


def _segment_start_times(durations: list[float], trans_dur: float) -> list[float]:
    """Start time (s) of each reel segment on the output timeline.

    Segments alternate [title, clip, title, clip, ...]. With an xfade transition
    each cut overlaps the previous segment by *trans_dur*, so every segment after
    the first starts *trans_dur* earlier than a plain concat would place it -
    matching the offsets _build_xfade_cmd feeds ffmpeg.
    """
    starts = [0.0]
    for i in range(len(durations) - 1):
        starts.append(max(0.0, starts[-1] + durations[i] - trans_dur))
    return starts


def reel_ass_caption_path(reel_path: Path) -> Path:
    return reel_path.with_suffix(".ass")


def _offset_subline(line, offset_ms: int):
    """Shift a SubLine (and its per-word timings) onto the reel timeline. The words
    must be offset too or word-highlight captions would highlight the wrong moment."""
    words = tuple(
        {**word, "start_ms": word["start_ms"] + offset_ms, "end_ms": word["end_ms"] + offset_ms}
        for word in line.words
    )
    return line._replace(
        start_ms=line.start_ms + offset_ms,
        end_ms=line.end_ms + offset_ms,
        words=words,
    )


def _stitch_reel_lines(session: "Session", reel_path: Path):
    """Merge every reel clip's caption lines onto the reel timeline, or None when the
    reel has no composition sidecar (built before captions existed)."""
    from yuu_clip.db.models import ClipCandidate
    from yuu_clip.subtitles import merged_srt_lines

    comp_path = reel_composition_path(reel_path)
    if not comp_path.exists():
        return None
    comp = json.loads(comp_path.read_text(encoding="utf-8"))

    title_dur = float(comp.get("title_dur", _DEFAULT_TITLE_DUR))
    trans_dur = float(comp.get("trans_dur", _DEFAULT_TRANS_DUR))
    effective_trans = 0.0 if comp.get("transition") == "none" else trans_dur

    clip_entries = comp.get("clips", [])
    segment_durations: list[float] = []
    for entry in clip_entries:
        segment_durations.append(title_dur)
        segment_durations.append(float(entry.get("duration_s", 0.0)))
    starts = _segment_start_times(segment_durations, effective_trans)

    stitched = []
    for idx, entry in enumerate(clip_entries):
        clip = session.get(ClipCandidate, entry["id"])
        if clip is None:
            continue
        offset_ms = int(round(starts[2 * idx + 1] * 1000))
        for line in merged_srt_lines(clip):
            stitched.append(_offset_subline(line, offset_ms))
    return stitched


def build_reel_caption_srt(session: "Session", reel_path: Path) -> Optional[Path]:
    """Stitch each reel clip's transcript into one SRT on the reel timeline.

    Reads the composition sidecar written at build time, offsets every clip's
    lines by its segment start, and writes ``<reel>.srt``. Returns the SRT path,
    or None when the reel has no composition sidecar (built before captions
    existed - it must be rebuilt to enable them).
    """
    from yuu_clip.subtitles import lines_to_srt

    stitched = _stitch_reel_lines(session, reel_path)
    if stitched is None:
        return None
    srt_path = reel_caption_path(reel_path)
    srt_path.write_text(lines_to_srt(stitched), encoding="utf-8")
    return srt_path


def build_reel_caption_ass(session: "Session", reel_path: Path, chunk_size: int) -> Optional[Path]:
    """Stitch the reel's captions into a word-highlight ``<reel>.ass`` for burn-in.

    The parallel of build_reel_caption_srt for the word-highlight path - reuses the
    same lines_to_ass renderer as single-clip export so the two paths can't drift.
    Returns the ASS path, or None when the reel has no composition sidecar."""
    from yuu_clip.subtitles import lines_to_ass

    stitched = _stitch_reel_lines(session, reel_path)
    if stitched is None:
        return None
    ass_path = reel_ass_caption_path(reel_path)
    ass_path.write_text(lines_to_ass(stitched, chunk_size, _probe_dimensions(reel_path)), encoding="utf-8")
    return ass_path


def _probe_dimensions(path: Path) -> Optional[tuple[int, int]]:
    """The reel's frame size for the word-highlight ASS PlayRes, or None if unprobeable."""
    try:
        return int(_ffprobe_stream_value(path, "width")), int(_ffprobe_stream_value(path, "height"))
    except (ValueError, RuntimeError):
        return None


def burn_reel_captions(reel_path: Path, srt_path: Path, caption_style=None) -> None:
    """Re-encode *reel_path* in place with *srt_path* burned into the video.

    Reuses the clip-export burn-in filter (`analyze.extract._subtitles_filter`) so
    reel captions honor the same global Caption style (font/size/position) and never
    override per-speaker colours (they arrive as inline <font color> tags in the SRT).
    The caption file may be SRT or word-highlight ASS - libass burns both. Audio is
    stream-copied - only the video is re-encoded.
    """
    from yuu_clip.analyze.extract import _subtitles_filter

    vf = _subtitles_filter(srt_path, caption_style)
    tmp_out = reel_path.with_name(reel_path.stem + ".burn_tmp" + reel_path.suffix)
    try:
        run_ffmpeg([
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(reel_path),
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            "-pix_fmt", "yuv420p",
            str(tmp_out),
        ])
        tmp_out.replace(reel_path)
    finally:
        # A failed encode leaves a partial .burn_tmp next to the reel (a user-visible
        # dir, not a TemporaryDirectory); on success replace() already consumed it.
        tmp_out.unlink(missing_ok=True)
