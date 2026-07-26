"""Unit tests - run_ffmpeg choke-point.

Every ffmpeg/ffprobe call outside the analyze pipeline routes through run_ffmpeg so a
missing binary yields find_ffmpeg's actionable install message (not a bare
FileNotFoundError) and a non-zero exit surfaces the captured stderr.
"""
from __future__ import annotations

import subprocess
import types

import pytest

from yuu_clip import ffmpeg_tools as ffmpeg_mod


def test_missing_binary_raises_install_hint(monkeypatch):
    def _raise_missing():
        raise RuntimeError("Required tools not found in PATH: ffmpeg\n\nInstall FFmpeg...")

    monkeypatch.setattr(ffmpeg_mod, "find_ffmpeg", lambda: _raise_missing())

    with pytest.raises(RuntimeError, match="Required tools not found in PATH"):
        ffmpeg_mod.run_ffmpeg(["ffmpeg", "-i", "x.mkv", "out.mp4"])


def test_nonzero_exit_surfaces_stderr(monkeypatch):
    monkeypatch.setattr(ffmpeg_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

    def _fake_run(args, **_kwargs):
        return types.SimpleNamespace(returncode=1, stderr="Invalid data found", stdout="")

    monkeypatch.setattr(subprocess, "run", _fake_run)

    with pytest.raises(RuntimeError, match="Invalid data found"):
        ffmpeg_mod.run_ffmpeg(["ffmpeg", "-i", "x.mkv", "out.mp4"])


def test_nonzero_exit_includes_command_line_for_repro(monkeypatch):
    monkeypatch.setattr(ffmpeg_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

    def _fake_run(args, **_kwargs):
        return types.SimpleNamespace(returncode=1, stderr="Invalid data found", stdout="")

    monkeypatch.setattr(subprocess, "run", _fake_run)

    with pytest.raises(RuntimeError, match=r'ffmpeg -i "x y\.mkv" -to 10 out\.mp4'):
        ffmpeg_mod.run_ffmpeg(["ffmpeg", "-i", "x y.mkv", "-to", "10", "out.mp4"])


def test_nonzero_exit_truncates_an_extremely_long_arg(monkeypatch):
    monkeypatch.setattr(ffmpeg_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

    def _fake_run(args, **_kwargs):
        return types.SimpleNamespace(returncode=1, stderr="boom", stdout="")

    monkeypatch.setattr(subprocess, "run", _fake_run)

    huge_path = "C:\\" + ("a" * 500) + "\\out.mp4"
    with pytest.raises(RuntimeError) as exc_info:
        ffmpeg_mod.run_ffmpeg(["ffmpeg", "-i", huge_path])

    message = str(exc_info.value)
    assert "...(truncated)" in message
    assert huge_path not in message


def test_ffprobe_resolves_probe_binary(monkeypatch):
    used = {}
    monkeypatch.setattr(ffmpeg_mod, "find_ffmpeg", lambda: ("ffmpeg.exe", "ffprobe.exe"))

    def _fake_run(args, **_kwargs):
        used["exe"] = args[0]
        return types.SimpleNamespace(returncode=0, stderr="", stdout="10.0")

    monkeypatch.setattr(subprocess, "run", _fake_run)

    result = ffmpeg_mod.run_ffmpeg(["ffprobe", "-show_entries", "format=duration"])

    assert used["exe"] == "ffprobe.exe"
    assert result.stdout == "10.0"


class TestFindFfmpegBundledDir:
    """YUU_CLIP_FFMPEG_DIR is set by packaged (Electron) builds so find_ffmpeg()
    always resolves the bundled GPL FFmpeg instead of an inherited PATH - see
    docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md and electron/main.js spawnBackend()."""

    def test_bundled_dir_with_both_binaries_is_used(self, tmp_path, monkeypatch):
        (tmp_path / "ffmpeg.exe").write_bytes(b"")
        (tmp_path / "ffprobe.exe").write_bytes(b"")
        monkeypatch.setenv("YUU_CLIP_FFMPEG_DIR", str(tmp_path))
        monkeypatch.setattr(ffmpeg_mod.shutil, "which", lambda name: None)

        ffmpeg, ffprobe = ffmpeg_mod.find_ffmpeg()

        assert ffmpeg == str(tmp_path / "ffmpeg.exe")
        assert ffprobe == str(tmp_path / "ffprobe.exe")

    def test_bundled_dir_missing_a_binary_raises_instead_of_falling_back(self, tmp_path, monkeypatch):
        (tmp_path / "ffmpeg.exe").write_bytes(b"")
        monkeypatch.setenv("YUU_CLIP_FFMPEG_DIR", str(tmp_path))
        monkeypatch.setattr(ffmpeg_mod.shutil, "which", lambda name: f"C:\\PATH\\{name}.exe")

        with pytest.raises(RuntimeError, match="ffprobe.exe"):
            ffmpeg_mod.find_ffmpeg()

    def test_unset_env_var_falls_back_to_path(self, monkeypatch):
        monkeypatch.delenv("YUU_CLIP_FFMPEG_DIR", raising=False)
        monkeypatch.setattr(ffmpeg_mod.shutil, "which", lambda name: f"C:\\PATH\\{name}.exe")

        ffmpeg, ffprobe = ffmpeg_mod.find_ffmpeg()

        assert ffmpeg == "C:\\PATH\\ffmpeg.exe"
        assert ffprobe == "C:\\PATH\\ffprobe.exe"

    def test_neither_env_nor_path_raises_with_windows_install_hint(self, monkeypatch):
        monkeypatch.delenv("YUU_CLIP_FFMPEG_DIR", raising=False)
        monkeypatch.setattr(ffmpeg_mod.shutil, "which", lambda name: None)
        monkeypatch.setattr(ffmpeg_mod.sys, "platform", "win32")

        with pytest.raises(RuntimeError, match="Required tools not found in PATH: ffmpeg, ffprobe") as exc_info:
            ffmpeg_mod.find_ffmpeg()
        assert "winget install Gyan.FFmpeg" in str(exc_info.value)

    def test_neither_env_nor_path_raises_with_posix_install_hint(self, monkeypatch):
        monkeypatch.delenv("YUU_CLIP_FFMPEG_DIR", raising=False)
        monkeypatch.setattr(ffmpeg_mod.shutil, "which", lambda name: None)
        monkeypatch.setattr(ffmpeg_mod.sys, "platform", "linux")

        with pytest.raises(RuntimeError, match="Required tools not found in PATH: ffmpeg, ffprobe") as exc_info:
            ffmpeg_mod.find_ffmpeg()
        assert "apt install ffmpeg" in str(exc_info.value)

    def test_only_ffprobe_missing_from_path_is_named(self, monkeypatch):
        monkeypatch.delenv("YUU_CLIP_FFMPEG_DIR", raising=False)
        monkeypatch.setattr(
            ffmpeg_mod.shutil, "which",
            lambda name: "C:\\PATH\\ffmpeg.exe" if name == "ffmpeg" else None,
        )
        monkeypatch.setattr(ffmpeg_mod.sys, "platform", "win32")

        with pytest.raises(RuntimeError) as exc_info:
            ffmpeg_mod.find_ffmpeg()
        message = str(exc_info.value)
        assert "Required tools not found in PATH: ffprobe" in message
        assert "ffmpeg, ffprobe" not in message


class TestRetranscribeResolvesBundledFfmpeg:
    """render._extract_wav_segment (the retranscribe WAV slice) must resolve the
    bundled binary via run_ffmpeg. Before the fix it called a literal "ffmpeg",
    which raises FileNotFoundError in packaged builds where ffmpeg is only at
    YUU_CLIP_FFMPEG_DIR, never on PATH."""

    def test_extract_wav_segment_uses_bundled_dir_not_bare_ffmpeg(self, tmp_path, monkeypatch):
        from yuu_clip.export import render

        (tmp_path / "ffmpeg.exe").write_bytes(b"")
        (tmp_path / "ffprobe.exe").write_bytes(b"")
        monkeypatch.setenv("YUU_CLIP_FFMPEG_DIR", str(tmp_path))
        monkeypatch.setattr(ffmpeg_mod.shutil, "which", lambda name: None)

        used = {}

        def _fake_run(args, **_kwargs):
            used["exe"] = args[0]
            return types.SimpleNamespace(returncode=0, stderr="", stdout="")

        monkeypatch.setattr(subprocess, "run", _fake_run)

        render._extract_wav_segment(tmp_path / "src.wav", tmp_path / "dst.wav", 1.0, 2.0)

        assert used["exe"] == str(tmp_path / "ffmpeg.exe")
