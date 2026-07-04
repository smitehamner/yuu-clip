"""Tests for highlight reel title card generation (yuu_clip.reel)."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pytest

from yuu_clip.reel import _esc, _find_font, _make_title_card

FONT_PATH = _find_font()   # e.g. "C:/Windows/Fonts/arial.ttf", or None

_SMALL = dict(width=160, height=90, duration=0.5, fps=10.0)


# ---------------------------------------------------------------------------
# Low-level helper
# ---------------------------------------------------------------------------

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
# Fontfile path format — verify the one format that works on Windows:
# single-quoted with the drive-letter colon escaped as \:
# ---------------------------------------------------------------------------

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
# _esc unit tests (path escaping — single-quote mode)
# ---------------------------------------------------------------------------

def test_esc_plain_path():
    assert _esc("hello") == "hello"

def test_esc_colon_in_path():
    # Windows drive-letter colon must be escaped for single-quoted fontfile=
    assert _esc("C:/Windows/Fonts/arial.ttf") == "C\\:/Windows/Fonts/arial.ttf"

def test_esc_percent_in_path():
    assert _esc("path%20to") == "path%%20to"

def test_esc_backslash_in_path():
    assert _esc("a\\b") == "a\\\\b"




# ---------------------------------------------------------------------------
# _make_title_card integration tests (calls real ffmpeg)
# ---------------------------------------------------------------------------

def test_title_card_simple(tmp_path: Path) -> None:
    """Plain ASCII text — the baseline case."""
    out = tmp_path / "title.mkv"
    _make_title_card([("Clip 1 of 5", 52), ("2026-03-07", 36)], out, **_SMALL)
    assert out.exists() and out.stat().st_size > 0


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


def test_title_card_single_quotes_in_text(tmp_path: Path) -> None:
    """Description with single-quoted word like 'squishes'."""
    out = tmp_path / "title.mkv"
    _make_title_card(
        [("James gets tackled and 'squishes' on the floor.", 28)],
        out, **_SMALL,
    )
    assert out.exists() and out.stat().st_size > 0


def test_title_card_three_lines(tmp_path: Path) -> None:
    """Three-line card — the layout produced by compile_demo."""
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


def test_title_card_no_description(tmp_path: Path) -> None:
    """Two-line card (no description) still renders."""
    out = tmp_path / "title.mkv"
    _make_title_card([("Clip 4 of 5", 52), ("2026-01-16", 36)], out, **_SMALL)
    assert out.exists() and out.stat().st_size > 0


def test_title_card_custom_colors_real_encode(tmp_path: Path) -> None:
    """Non-default bg/font colors must still produce a valid drawtext/lavfi command
    (tiny real encode — guards the color= / fontcolor= ffmpeg syntax)."""
    out = tmp_path / "title.mkv"
    _make_title_card(
        [("Clip 1 of 5", 52)], out, bg_color="#1a2b3c", font_color="#ffaa00", **_SMALL,
    )
    assert out.exists() and out.stat().st_size > 0


# ---------------------------------------------------------------------------
# _to_ffmpeg_color
# ---------------------------------------------------------------------------

class TestToFfmpegColor:
    def test_strips_hash_and_prefixes_0x(self):
        from yuu_clip.reel import _to_ffmpeg_color
        assert _to_ffmpeg_color("#1a2b3c") == "0x1a2b3c"

    def test_uppercase_hex_preserved(self):
        from yuu_clip.reel import _to_ffmpeg_color
        assert _to_ffmpeg_color("#AABBCC") == "0xAABBCC"


# ---------------------------------------------------------------------------
# _make_title_card command construction — colors and fontsize appear in the
# built ffmpeg args (mocked subprocess.run, no real encode)
# ---------------------------------------------------------------------------

class TestMakeTitleCardCommandConstruction:
    def test_custom_colors_and_fontsize_appear_in_command(self, monkeypatch, tmp_path):
        captured = {}

        def _fake_run(cmd):
            captured["cmd"] = cmd

        monkeypatch.setattr("yuu_clip.reel.run_ffmpeg", _fake_run)
        _make_title_card(
            [("hello", 45)], tmp_path / "card.mkv",
            bg_color="#112233", font_color="#aabbcc", **_SMALL,
        )
        cmd = captured["cmd"]
        assert any(arg.startswith("color=0x112233:") for arg in cmd)
        vf = cmd[cmd.index("-vf") + 1]
        assert "fontcolor=0xaabbcc" in vf
        assert "fontsize=45" in vf

    def test_default_colors_used_when_not_specified(self, monkeypatch, tmp_path):
        captured = {}

        def _fake_run(cmd):
            captured["cmd"] = cmd

        monkeypatch.setattr("yuu_clip.reel.run_ffmpeg", _fake_run)
        _make_title_card([("hello", 30)], tmp_path / "card.mkv", **_SMALL)
        cmd = captured["cmd"]
        assert any(arg.startswith("color=0x000000:") for arg in cmd)
        vf = cmd[cmd.index("-vf") + 1]
        assert "fontcolor=0xffffff" in vf


# ---------------------------------------------------------------------------
# title_card_lines — layout / scale / truncation / effective_description
# ---------------------------------------------------------------------------

class _FakeClip:
    """Duck-types the ClipCandidate attributes title_card_lines reads, mirroring
    the real effective_description property without needing a DB session."""

    def __init__(self, description="", description_user=None, start_hms="1:23", duration_hms="0:30"):
        self.description = description
        self.description_user = description_user
        self.start_hms = start_hms
        self.duration_hms = duration_hms

    @property
    def effective_description(self):
        return self.description_user if self.description_user is not None else (self.description or "")


class TestTitleCardLines:
    def _config(self, **overrides):
        from yuu_clip.config import Config
        return Config(**overrides)

    def test_default_template_renders_description_then_timecode(self):
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="A wild moment happens")
        lines = title_card_lines(clip, self._config(),
                                 primary_size=36, secondary_size=24)
        assert lines == [("A wild moment happens", 36), ("1:23 · 0:30", 24)]

    def test_single_line_template_renders_one_line(self):
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="Something funny")
        lines = title_card_lines(clip, self._config(title_card_template="{description}"),
                                 primary_size=36, secondary_size=24)
        assert lines == [("Something funny", 36)]

    def test_blank_description_line_dropped_but_timecode_kept(self):
        """A line that renders empty (no description) is skipped, not shown blank."""
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="")
        lines = title_card_lines(clip, self._config(),
                                 primary_size=36, secondary_size=24)
        assert lines == [("1:23 · 0:30", 36)]

    def test_empty_template_falls_back_to_timecode(self):
        """A card must never be emitted empty — a template with nothing to show
        falls back to the timecode line."""
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="ignored")
        lines = title_card_lines(clip, self._config(title_card_template="{description}"),
                                 primary_size=36, secondary_size=24)
        clip_no_desc = _FakeClip(description="")
        fallback = title_card_lines(clip_no_desc, self._config(title_card_template="{description}"),
                                    primary_size=36, secondary_size=24)
        assert lines == [("ignored", 36)]
        assert fallback == [("1:23  ·  0:30", 36)]

    def test_static_text_in_template(self):
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="text")
        lines = title_card_lines(clip, self._config(title_card_template="Highlight: {description}"),
                                 primary_size=36, secondary_size=24)
        assert lines == [("Highlight: text", 36)]

    def test_effective_description_user_override_wins(self):
        """cand.description_user (a user edit) must be used on the card, not the
        raw LLM cand.description — the pre-plan09 clip-export path read the raw
        field directly, which ignored user edits."""
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="LLM text", description_user="Creator's version")
        lines = title_card_lines(clip, self._config(title_card_template="{description}"),
                                 primary_size=36, secondary_size=24)
        assert lines == [("Creator's version", 36)]

    def test_scale_multiplies_font_sizes(self):
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="text")
        lines = title_card_lines(clip, self._config(title_card_scale=1.5),
                                 primary_size=36, secondary_size=24)
        assert lines == [("text", 54), ("1:23 · 0:30", 36)]

    def test_long_line_truncated_with_ellipsis(self):
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="x" * 300)
        lines = title_card_lines(clip, self._config(title_card_template="{description}"),
                                 primary_size=36, secondary_size=24)
        text, _ = lines[0]
        assert len(text) == 90
        assert text.endswith("…")

    def test_short_line_not_truncated(self):
        from yuu_clip.reel import title_card_lines
        clip = _FakeClip(description="short")
        lines = title_card_lines(clip, self._config(title_card_template="{description}"),
                                 primary_size=36, secondary_size=24)
        assert lines[0][0] == "short"


# ---------------------------------------------------------------------------
# Two call sites (clip export, reel) both pick up the config through the
# shared title_card_lines helper — the helper is the guard.
# ---------------------------------------------------------------------------

class _FakeVideoForClipExport:
    fps = None
    width = None
    height = None


class TestApplyTitleCardThreadsConfig:
    """cli/export.py's _apply_title_card (clip-export title card) call site."""

    def test_uses_config_colors_duration_and_36_24_base_sizes(self, monkeypatch, tmp_path):
        import yuu_clip.reel as reel_mod
        from yuu_clip.cli.export import _apply_title_card
        from yuu_clip.config import Config

        captured = {}

        def _fake_make_title_card(lines, card_path, **kwargs):
            captured["lines"] = lines
            captured["kwargs"] = kwargs
            Path(card_path).write_bytes(b"fake")

        def _fake_compile_concat(segments, output):
            Path(output).write_bytes(b"fake")

        monkeypatch.setattr(reel_mod, "_make_title_card", _fake_make_title_card)
        monkeypatch.setattr(reel_mod, "_compile_concat", _fake_compile_concat)

        clip_path = tmp_path / "clip.mkv"
        clip_path.write_bytes(b"fake")
        output = tmp_path / "out.mkv"
        cand = _FakeClip(description="A funny moment", start_hms="0:05", duration_hms="0:10")
        cand.video = _FakeVideoForClipExport()
        config = Config(
            title_card_bg_color="#112233", title_card_font_color="#aabbcc", title_card_duration_s=4.0,
        )

        _apply_title_card(clip_path, cand, output, config)

        assert captured["kwargs"]["bg_color"] == "#112233"
        assert captured["kwargs"]["font_color"] == "#aabbcc"
        assert captured["kwargs"]["duration"] == 4.0
        assert captured["lines"] == [("A funny moment", 36), ("0:05 · 0:10", 24)]
        assert not clip_path.exists()  # deleted after concat


class _FakeVideoForReel:
    def __init__(self, filename):
        self.filename = filename


class TestBuildSegmentListThreadsConfig:
    """yuu_clip/reel.py's _build_segment_list (reel per-clip title card) call site."""

    def test_reel_card_uses_config_colors_and_scaled_52_36_28_sizes(self, monkeypatch, tmp_path):
        import yuu_clip.reel as reel_mod
        from yuu_clip.config import Config

        captured = []

        def _fake_make_title_card(lines, card_path, **kwargs):
            captured.append((lines, kwargs))
            Path(card_path).write_bytes(b"fake")

        monkeypatch.setattr(reel_mod, "_make_title_card", _fake_make_title_card)

        clip = _FakeClip(description="Great save", start_hms="0:05", duration_hms="0:10")
        clip.video_id = 1
        video = _FakeVideoForReel(filename="2026-01-16_session.mkv")
        config = Config(title_card_scale=2.0,
                        title_card_bg_color="#101010", title_card_font_color="#efefef")

        reel_mod._build_segment_list(
            clips=[clip], video_map={1: video},
            clip_files=[tmp_path / "clip0.mkv"], clip_durations=[12.0],
            tmp_dir=tmp_path, fps=30.0, title_dur=3.0, config=config,
        )

        lines, kwargs = captured[0]
        assert lines == [
            ("Clip 1 of 1", 104),     # _DEFAULT_FONT_SIZE_H1 (52) * scale 2.0
            ("2026-01-16", 72),       # _DEFAULT_FONT_SIZE_H2 (36) * scale 2.0
            ("Great save", 72),       # primary_size = H2 (36) * scale 2.0
            ("0:05 · 0:10", 56),      # secondary_size = BODY (28) * scale 2.0
        ]
        assert kwargs["bg_color"] == "#101010"
        assert kwargs["font_color"] == "#efefef"
