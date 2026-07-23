"""Unit tests - extract_audio_track's ffmpeg trim window.

Pins the -ss/-t/-to argument shape: with an input-side seek (-ss before -i)
ffmpeg resets output timestamps to zero, so an output-side -to would act as a
duration and overrun the requested window (real bug: middle split segments
extracted audio bleeding into the next segment). No ffmpeg runs here - the
subprocess call is captured.
"""
from __future__ import annotations

import subprocess
import types

import pytest

from yuu_clip.analyze import extract


@pytest.fixture
def captured_cmd(monkeypatch, tmp_path):
    calls: list[list[str]] = []

    def _fake_run(cmd, **_kwargs):
        calls.append(cmd)
        return types.SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(extract, "find_ffmpeg", lambda: ("ffmpeg", "ffprobe"))
    monkeypatch.setattr(subprocess, "run", _fake_run)
    return calls


def _extract(tmp_path, **window):
    out = tmp_path / "out.wav"
    extract.extract_audio_track(tmp_path / "src.mkv", 1, out, **window)
    return out


class TestTrimWindow:
    def test_both_bounds_use_duration_not_absolute_stop(self, captured_cmd, tmp_path):
        _extract(tmp_path, start_s=4.0, end_s=6.0)
        cmd = captured_cmd[0]
        seek_idx = cmd.index("-ss")
        assert cmd[seek_idx + 1] == "4.0"
        assert seek_idx < cmd.index("-i")
        assert cmd[cmd.index("-t") + 1] == "2.0"
        assert "-to" not in cmd

    def test_end_only_keeps_absolute_stop(self, captured_cmd, tmp_path):
        _extract(tmp_path, end_s=6.0)
        cmd = captured_cmd[0]
        assert cmd[cmd.index("-to") + 1] == "6.0"
        assert "-ss" not in cmd
        assert "-t" not in cmd

    def test_start_only_reads_to_end(self, captured_cmd, tmp_path):
        _extract(tmp_path, start_s=4.0)
        cmd = captured_cmd[0]
        assert cmd[cmd.index("-ss") + 1] == "4.0"
        assert "-t" not in cmd
        assert "-to" not in cmd

    def test_no_bounds_extracts_whole_stream(self, captured_cmd, tmp_path):
        _extract(tmp_path)
        cmd = captured_cmd[0]
        assert "-ss" not in cmd
        assert "-t" not in cmd
        assert "-to" not in cmd
