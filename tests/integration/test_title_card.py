"""Highlight reel title card - real ffmpeg encode integration (yuu_clip.reel).

Command construction, layout math, and config-threading are pure and live in
tests/unit/test_title_card.py; these run a real (tiny) ffmpeg drawtext encode
and are skipped if ffmpeg isn't on PATH."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from yuu_clip.reel import _esc, _find_font, _make_title_card

requires_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")

FONT_PATH = _find_font()   # e.g. "C:/Windows/Fonts/arial.ttf", or None

_SMALL = dict(width=160, height=90, duration=0.5, fps=10.0)


def _run_drawtext(vf: str) -> tuple[bool, str]:
    """Run a one-frame ffmpeg drawtext job; return (success, stderr)."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.mkv"
        r = subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "lavfi", "-i", "color=black:size=160x90:rate=10:duration=0.5",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-vf", vf,
                "-t", "0.5",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "51",
                "-c:a", "aac", "-b:a", "64k", "-pix_fmt", "yuv420p",
                str(out),
            ],
            capture_output=True,
            text=True,
        )
        return r.returncode == 0, r.stderr


# ---------------------------------------------------------------------------
# Fontfile path format - verify the one format that works on Windows:
# single-quoted with the drive-letter colon escaped as \:
# ---------------------------------------------------------------------------

@requires_ffmpeg
@pytest.mark.skipif(FONT_PATH is None, reason="no system font found")
def test_fontfile_single_quoted_escaped_colon() -> None:
    """fontfile='C\\:/...' is the only format that works on Windows with this ffmpeg."""
    vf = (
        f"drawtext=text='hello':fontcolor=white:fontsize=14:x=4:y=4"
        f":fontfile='{_esc(FONT_PATH)}'"
    )
    ok, err = _run_drawtext(vf)
    assert ok, f"single-quoted \\:-escaped fontfile failed.\nstderr:\n{err}"


# ---------------------------------------------------------------------------
# _make_title_card real-encode tests
# ---------------------------------------------------------------------------

@requires_ffmpeg
def test_title_card_simple(tmp_path: Path) -> None:
    """Plain ASCII text - the baseline case."""
    out = tmp_path / "title.mkv"
    _make_title_card([("Clip 1 of 5", 52), ("2026-03-07", 36)], out, **_SMALL)
    assert out.exists() and out.stat().st_size > 0


@requires_ffmpeg
def test_title_card_apostrophe_in_description(tmp_path: Path) -> None:
    """Description containing an apostrophe must not break the filter string."""
    out = tmp_path / "title.mkv"
    _make_title_card(
        [
            ("Clip 2 of 5", 52),
            ("Heyman strips down to his friends' amusement.", 28),
        ],
        out, **_SMALL,
    )
    assert out.exists() and out.stat().st_size > 0


@requires_ffmpeg
def test_title_card_single_quotes_in_text(tmp_path: Path) -> None:
    """Description with single-quoted word like 'squishes'."""
    out = tmp_path / "title.mkv"
    _make_title_card(
        [("James gets tackled and 'squishes' on the floor.", 28)],
        out, **_SMALL,
    )
    assert out.exists() and out.stat().st_size > 0


@requires_ffmpeg
def test_title_card_three_lines(tmp_path: Path) -> None:
    """Three-line card - the layout produced by compile_demo."""
    out = tmp_path / "title.mkv"
    _make_title_card(
        [
            ("Clip 3 of 5", 52),
            ("2026-01-16", 36),
            ("Chaos erupts as a stabbing incident unfolds in the workplace.", 28),
        ],
        out, **_SMALL,
    )
    assert out.exists() and out.stat().st_size > 0


@requires_ffmpeg
def test_title_card_no_description(tmp_path: Path) -> None:
    """Two-line card (no description) still renders."""
    out = tmp_path / "title.mkv"
    _make_title_card([("Clip 4 of 5", 52), ("2026-01-16", 36)], out, **_SMALL)
    assert out.exists() and out.stat().st_size > 0


@requires_ffmpeg
def test_title_card_custom_colors_real_encode(tmp_path: Path) -> None:
    """Non-default bg/font colors must still produce a valid drawtext/lavfi command
    (tiny real encode - guards the color= / fontcolor= ffmpeg syntax)."""
    out = tmp_path / "title.mkv"
    _make_title_card(
        [("Clip 1 of 5", 52)], out, bg_color="#1a2b3c", font_color="#ffaa00", **_SMALL,
    )
    assert out.exists() and out.stat().st_size > 0
