"""Unit tests — run_ffmpeg choke-point.

Every ffmpeg/ffprobe call outside the analyze pipeline routes through run_ffmpeg so a
missing binary yields find_ffmpeg's actionable install message (not a bare
FileNotFoundError) and a non-zero exit surfaces the captured stderr.
"""
from __future__ import annotations

import subprocess
import types

import pytest

from yuu_clip import config as config_mod


def test_missing_binary_raises_install_hint(monkeypatch):
    def _raise_missing():
        raise RuntimeError("Required tools not found in PATH: ffmpeg\n\nInstall FFmpeg...")

    monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: _raise_missing())

    with pytest.raises(RuntimeError, match="Required tools not found in PATH"):
        config_mod.run_ffmpeg(["ffmpeg", "-i", "x.mkv", "out.mp4"])


def test_nonzero_exit_surfaces_stderr(monkeypatch):
    monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

    def _fake_run(args, capture_output, text, timeout):
        return types.SimpleNamespace(returncode=1, stderr="Invalid data found", stdout="")

    monkeypatch.setattr(subprocess, "run", _fake_run)

    with pytest.raises(RuntimeError, match="Invalid data found"):
        config_mod.run_ffmpeg(["ffmpeg", "-i", "x.mkv", "out.mp4"])


def test_ffprobe_resolves_probe_binary(monkeypatch):
    used = {}
    monkeypatch.setattr(config_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

    def _fake_run(args, capture_output, text, timeout):
        used["exe"] = args[0]
        return types.SimpleNamespace(returncode=0, stderr="", stdout="10.0")

    monkeypatch.setattr(subprocess, "run", _fake_run)

    result = config_mod.run_ffmpeg(["ffprobe", "-show_entries", "format=duration"])

    assert used["exe"] == "ffprobe.exe"
    assert result.stdout == "10.0"
