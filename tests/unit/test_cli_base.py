"""Shared CLI prelude helpers in yuu_clip/cli/_base.py.

_require_ffmpeg is the shared "exit with a friendly message" gate that probe,
analyze, reextract, and retranscribe-video all call before doing any real work;
it had no direct test even though every command using it depends on its message
being readable (not a raw traceback) and its exit code being non-zero.
"""
from __future__ import annotations

import pytest
import typer


class TestRequireFfmpeg:
    def _call(self):
        from yuu_clip.cli._base import _require_ffmpeg
        _require_ffmpeg()

    def test_present_returns_without_raising(self, monkeypatch):
        monkeypatch.setattr(
            "yuu_clip.ffmpeg_tools.find_ffmpeg", lambda: ("ffmpeg", "ffprobe")
        )
        self._call()  # must not raise

    def test_missing_exits_nonzero_with_a_friendly_message(self, monkeypatch, capsys):
        def _raise_missing():
            raise RuntimeError("ffmpeg not found - install it and add it to PATH")

        monkeypatch.setattr("yuu_clip.ffmpeg_tools.find_ffmpeg", _raise_missing)
        with pytest.raises(typer.Exit) as exc_info:
            self._call()
        assert exc_info.value.exit_code == 1
        assert "ffmpeg not found" in capsys.readouterr().out
