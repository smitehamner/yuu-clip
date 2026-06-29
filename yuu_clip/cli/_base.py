"""
Shared CLI infrastructure: the Typer app, console, constants, and the helpers
used across multiple yuuclip commands.
"""
from __future__ import annotations

import io
import subprocess
import sys
from typing import Optional

# Force UTF-8 output on Windows so Rich never falls back to the cp1252 legacy
# console renderer, which crashes on characters outside Latin-1. This must run
# before the Console below is created.
if sys.stdout and hasattr(sys.stdout, "buffer") and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer") and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dataclasses import dataclass, field
from pathlib import Path

import typer
from rich.console import Console

from yuu_clip.log import configure_logging, get_logger

app = typer.Typer(
    name="yuuclip",
    help="Video session clip extraction pipeline.",
    add_completion=False,
)
console = Console()
log = get_logger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".ts"}
BYTES_PER_MB: int = 1_048_576


@dataclass
class AnalyzeOptions:
    profile: Optional[str] = None
    no_transcribe: bool = False
    no_segment: bool = False
    no_score: bool = False
    force: bool = False
    language: Optional[str] = None
    energy_mode: str = "fast"
    non_interactive: bool = False
    context_names: list[str] = field(default_factory=list)
    context_text: str = ""
    # Path to an .srt file, or "stream:<index>" for an embedded subtitle stream.
    # When set, transcription is skipped and the subtitles are imported directly.
    subtitle_source: Optional[str] = None
    # When set, the video row is looked up by ID rather than by path; path arg is ignored.
    video_id: Optional[int] = None
    # Time window for pre-analysis splits: trim audio extraction to this range.
    segment_start_s: Optional[float] = None
    segment_end_s: Optional[float] = None


def _project_dir(given: Optional[Path]) -> Path:
    return (given or Path.cwd()).resolve()


def _get_session(project_dir: Path):
    from yuu_clip.config import project_db_path
    from yuu_clip.db.models import make_session
    return make_session(project_db_path(project_dir))


def _load_project(project: Optional[Path]):
    """Resolve project dir, open DB session, and load config. Used by every command that needs DB access."""
    from yuu_clip.config import Config
    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    session  = _get_session(proj_dir)
    config   = Config.load(proj_dir)
    return proj_dir, session, config


def _require_ffmpeg() -> None:
    """Exit with a friendly error message if ffmpeg is not found on PATH."""
    from yuu_clip.config import find_ffmpeg
    try:
        find_ffmpeg()
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)


def _resolve_videos(path: Path) -> list[Path]:
    """Accept a single video file or a directory; return a sorted list of video paths."""
    path = path.resolve()
    if path.is_dir():
        return sorted(p for p in path.iterdir() if p.suffix.lower() in VIDEO_EXTENSIONS)
    if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS:
        return [path]
    console.print(f"[red]Not a video file or directory: {path}[/red]")
    raise typer.Exit(1)


def _parse_srt(text: str) -> list[tuple[int, int, str]]:
    """Parse SRT subtitle text into (start_ms, end_ms, text) triples."""
    import re as _re
    segments = []
    for block in _re.split(r"\n\n+", text.strip()):
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        m = _re.match(
            r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)",
            lines[1].strip(),
        )
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        start_ms = (g[0] * 3600 + g[1] * 60 + g[2]) * 1000 + g[3]
        end_ms   = (g[4] * 3600 + g[5] * 60 + g[6]) * 1000 + g[7]
        text_body = " ".join(lines[2:]).strip()
        if text_body:
            segments.append((start_ms, end_ms, text_body))
    return segments


def _extract_wav_segment(src: Path, dst: Path, start_s: float, end_s: float) -> None:
    """Slice a time range out of a WAV file using ffmpeg stream-copy (fast, lossless)."""
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-i", str(src), "-ss", str(start_s), "-to", str(end_s), "-c", "copy", str(dst)],
        check=True,
    )
