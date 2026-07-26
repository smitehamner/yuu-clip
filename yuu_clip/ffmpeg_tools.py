"""
FFmpeg / ffprobe binary discovery and the run_ffmpeg choke point.

Packaged (Electron) builds bundle their own GPL FFmpeg (see
docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md) and set YUU_CLIP_FFMPEG_DIR so it is
always used instead of whatever happens to be on PATH.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Optional


def find_ffmpeg() -> tuple[str, str]:
    """
    Return (ffmpeg_exe, ffprobe_exe) paths.

    Packaged (Electron) builds set YUU_CLIP_FFMPEG_DIR to the bundled GPL FFmpeg
    directory (see docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md) and always use it - a
    packaging bug that leaves it unset or pointing at an incomplete directory must
    surface immediately, not silently fall through to whatever happens to be on
    PATH. When unset (dev mode, non-Windows contributors), falls back to PATH via
    shutil.which() as before.
    """
    bundled_dir = os.environ.get("YUU_CLIP_FFMPEG_DIR")
    if bundled_dir:
        ffmpeg = os.path.join(bundled_dir, "ffmpeg.exe")
        ffprobe = os.path.join(bundled_dir, "ffprobe.exe")
        missing = [name for name, path in (("ffmpeg.exe", ffmpeg), ("ffprobe.exe", ffprobe)) if not os.path.isfile(path)]
        if missing:
            raise RuntimeError(
                f"YUU_CLIP_FFMPEG_DIR is set to {bundled_dir!r} but missing: {', '.join(missing)}\n\n"
                "This indicates a broken packaged install, not a missing user dependency - "
                "reinstalling yuu-clip should fix it."
            )
        return ffmpeg, ffprobe

    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")

    missing = []
    if not ffmpeg:
        missing.append("ffmpeg")
    if not ffprobe:
        missing.append("ffprobe")

    if missing:
        if sys.platform == "win32":
            hint = (
                "Install FFmpeg on Windows via:\n"
                "  winget install Gyan.FFmpeg\n"
                "  or: choco install ffmpeg\n"
                "  or: scoop install ffmpeg\n"
                "Then restart your terminal so PATH is updated."
            )
        else:
            hint = (
                "Install FFmpeg via your package manager:\n"
                "  Ubuntu/Debian: sudo apt install ffmpeg\n"
                "  Arch:          sudo pacman -S ffmpeg\n"
                "  macOS:         brew install ffmpeg"
            )
        raise RuntimeError(
            f"Required tools not found in PATH: {', '.join(missing)}\n\n{hint}"
        )

    return ffmpeg, ffprobe


_MAX_LOGGED_ARG_LEN = 200


def _format_cmd_for_log(tool: str, args: list[str]) -> str:
    """Render args as a reproducible command line for logs/errors.

    Uses the logical tool name (not the resolved absolute exe path, which can be
    a long bundled-install path) so the line stays focused on the flags/structure
    that matter for manual repro. Individual args are truncated, not the whole
    line, so a single huge path can't hide the rest of the command.
    """
    def _fmt(arg: str) -> str:
        if len(arg) > _MAX_LOGGED_ARG_LEN:
            arg = arg[:_MAX_LOGGED_ARG_LEN] + "...(truncated)"
        return f'"{arg}"' if " " in arg else arg

    return " ".join([tool, *(_fmt(arg) for arg in args[1:])])


def run_ffmpeg(args: list[str], timeout: Optional[float] = None) -> subprocess.CompletedProcess:
    """Run an ffmpeg/ffprobe command with actionable failures.

    args[0] must be "ffmpeg" or "ffprobe"; it is replaced with the resolved binary
    from find_ffmpeg() so a missing install raises the friendly install-instructions
    error instead of a bare FileNotFoundError. stderr is captured and, on a non-zero
    exit, surfaced in the raised RuntimeError alongside the command line - callers
    (and the user) get both the reason and enough of the invocation to reproduce it
    manually, rather than an opaque "returned non-zero exit status 1".
    """
    ffmpeg, ffprobe = find_ffmpeg()
    tool = args[0]
    exe = ffprobe if tool == "ffprobe" else ffmpeg
    result = subprocess.run(
        [exe, *args[1:]], capture_output=True, encoding="utf-8", errors="replace", timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"{tool} failed (exit {result.returncode}): {_format_cmd_for_log(tool, args)}\n"
            f"{result.stderr.strip()}"
        )
    return result
