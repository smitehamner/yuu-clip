"""Unit tests for the 720p preview-proxy helper (analyze/proxy.py).

No real FFmpeg is invoked - the encode runner is stubbed so command shape,
NVENC→libx264 fallback, cache freshness, and DB bookkeeping are all exercised
deterministically.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from yuu_clip.analyze import proxy
from yuu_clip.db.models import Video, make_session

# ── command construction ────────────────────────────────────────────────────────

class TestBuildProxyCmd:
    def test_nvenc_command_uses_h264_nvenc_and_downscale(self):
        cmd = proxy.build_proxy_cmd("ffmpeg", Path("in.mkv"), Path("out.mp4"), use_nvenc=True)
        assert "h264_nvenc" in cmd
        assert "scale=-2:720" in cmd
        assert "+faststart" in cmd
        assert cmd[-1] == "out.mp4"

    def test_libx264_command_uses_cpu_encoder(self):
        cmd = proxy.build_proxy_cmd("ffmpeg", Path("in.mkv"), Path("out.mp4"), use_nvenc=False)
        assert "libx264" in cmd
        assert "h264_nvenc" not in cmd
        assert "-crf" in cmd

    def test_height_is_configurable(self):
        cmd = proxy.build_proxy_cmd("ffmpeg", Path("in.mkv"), Path("out.mp4"), use_nvenc=False, height=480)
        assert "scale=-2:480" in cmd


# ── NVENC detection ─────────────────────────────────────────────────────────────

class TestNvencAvailable:
    def setup_method(self):
        proxy._nvenc_cache = None

    def teardown_method(self):
        proxy._nvenc_cache = None

    def test_true_when_encoder_listed(self, monkeypatch):
        monkeypatch.setattr(
            proxy.subprocess, "run",
            lambda cmd, **k: SimpleNamespace(stdout="... h264_nvenc ..."),
        )
        assert proxy.nvenc_available("ffmpeg") is True

    def test_false_when_encoder_absent(self, monkeypatch):
        monkeypatch.setattr(
            proxy.subprocess, "run",
            lambda cmd, **k: SimpleNamespace(stdout="libx264 libx265"),
        )
        assert proxy.nvenc_available("ffmpeg") is False

    def test_result_is_cached_across_calls(self, monkeypatch):
        calls = {"n": 0}

        def fake_run(cmd, **k):
            calls["n"] += 1
            return SimpleNamespace(stdout="h264_nvenc")

        monkeypatch.setattr(proxy.subprocess, "run", fake_run)
        assert proxy.nvenc_available("ffmpeg") is True
        assert proxy.nvenc_available("ffmpeg") is True
        assert calls["n"] == 1

    def test_subprocess_failure_treated_as_unavailable(self, monkeypatch):
        def raising_run(cmd, **k):
            raise OSError("ffmpeg not found")

        monkeypatch.setattr(proxy.subprocess, "run", raising_run)
        assert proxy.nvenc_available("ffmpeg") is False


# ── FFmpeg progress parsing ─────────────────────────────────────────────────────

class TestRunWithProgressHappyPath:
    class _FakeProc:
        def __init__(self, lines, returncode=0):
            self.stdout = iter(lines)
            self.returncode = returncode

        def wait(self):
            return self.returncode

    def test_progress_callback_receives_fractions(self, monkeypatch):
        lines = ["out_time_us=250000\n", "out_time_us=500000\n", "out_time_us=1000000\n"]
        monkeypatch.setattr(proxy.subprocess, "Popen", lambda *a, **k: self._FakeProc(lines))
        fractions: list[float] = []
        proxy._run_with_progress(["ffmpeg"], duration_ms=1000, progress_cb=fractions.append)
        assert fractions == [0.25, 0.5, 1.0]

    def test_na_progress_lines_are_skipped_not_raised(self, monkeypatch):
        lines = ["out_time_us=N/A\n", "out_time_us=500000\n"]
        monkeypatch.setattr(proxy.subprocess, "Popen", lambda *a, **k: self._FakeProc(lines))
        fractions: list[float] = []
        proxy._run_with_progress(["ffmpeg"], duration_ms=1000, progress_cb=fractions.append)
        assert fractions == [0.5]

    def test_no_duration_never_calls_progress_cb(self, monkeypatch):
        lines = ["out_time_us=500000\n"]
        monkeypatch.setattr(proxy.subprocess, "Popen", lambda *a, **k: self._FakeProc(lines))
        fractions: list[float] = []
        proxy._run_with_progress(["ffmpeg"], duration_ms=None, progress_cb=fractions.append)
        assert fractions == []

    def test_nonzero_exit_raises_with_stderr_tail(self, monkeypatch):
        lines = ["frame=1\n", "error: codec not found\n"]
        monkeypatch.setattr(
            proxy.subprocess, "Popen", lambda *a, **k: self._FakeProc(lines, returncode=1),
        )
        with pytest.raises(RuntimeError, match="codec not found"):
            proxy._run_with_progress(["ffmpeg"], duration_ms=None, progress_cb=None)


# ── fallback behaviour ──────────────────────────────────────────────────────────

class TestGenerateProxyFallback:
    def test_falls_back_to_libx264_when_nvenc_run_fails(self, tmp_path, monkeypatch):
        monkeypatch.setattr(proxy, "nvenc_available", lambda ffmpeg=None: True)
        runs: list[bool] = []

        def fake_run(cmd, duration_ms, progress_cb):
            used_nvenc = "h264_nvenc" in cmd
            runs.append(used_nvenc)
            if used_nvenc:
                raise RuntimeError("no NVIDIA device")
            if progress_cb:
                progress_cb(1.0)

        monkeypatch.setattr(proxy, "_run_with_progress", fake_run)
        out = tmp_path / "out.mp4"
        result = proxy.generate_proxy(Path("in.mkv"), out, ffmpeg="ffmpeg")
        assert result == out
        assert runs == [True, False]  # tried NVENC, then libx264

    def test_libx264_only_when_no_nvenc(self, tmp_path, monkeypatch):
        monkeypatch.setattr(proxy, "nvenc_available", lambda ffmpeg=None: False)
        runs: list[bool] = []
        monkeypatch.setattr(proxy, "_run_with_progress",
                            lambda cmd, d, cb: runs.append("h264_nvenc" in cmd))
        proxy.generate_proxy(Path("in.mkv"), tmp_path / "out.mp4", ffmpeg="ffmpeg")
        assert runs == [False]

    def test_raises_when_all_attempts_fail(self, tmp_path, monkeypatch):
        monkeypatch.setattr(proxy, "nvenc_available", lambda ffmpeg=None: True)

        def always_fail(cmd, d, cb):
            raise RuntimeError("boom")

        monkeypatch.setattr(proxy, "_run_with_progress", always_fail)
        with pytest.raises(RuntimeError, match="Proxy generation failed"):
            proxy.generate_proxy(Path("in.mkv"), tmp_path / "out.mp4", ffmpeg="ffmpeg")


# ── cache key + freshness ───────────────────────────────────────────────────────

class TestProxyFileFor:
    def test_deterministic_and_shared_for_same_source(self, tmp_path):
        src = tmp_path / "session.mkv"
        a = proxy.proxy_file_for(src, tmp_path / "proxies")
        b = proxy.proxy_file_for(src, tmp_path / "proxies")
        assert a == b
        assert a.suffix == ".mp4"

    def test_differs_by_source(self, tmp_path):
        a = proxy.proxy_file_for(tmp_path / "one.mkv", tmp_path / "proxies")
        b = proxy.proxy_file_for(tmp_path / "two.mkv", tmp_path / "proxies")
        assert a != b


class TestProxyIsFresh:
    def _video(self, source: Path, **overrides):
        stat = source.stat()
        base = dict(
            path=str(source),
            proxy_generated_at=datetime.now(timezone.utc),
            proxy_source_mtime=stat.st_mtime,
            proxy_source_size=stat.st_size,
        )
        base.update(overrides)
        return SimpleNamespace(**base)

    def test_fresh_when_stats_match(self, tmp_path):
        source = tmp_path / "session.mkv"
        source.write_bytes(b"x" * 100)
        proxy_file = tmp_path / "p.mp4"
        proxy_file.write_bytes(b"proxy")
        assert proxy.proxy_is_fresh(self._video(source), proxy_file) is True

    def test_stale_when_never_generated(self, tmp_path):
        source = tmp_path / "session.mkv"
        source.write_bytes(b"x")
        proxy_file = tmp_path / "p.mp4"
        proxy_file.write_bytes(b"proxy")
        assert proxy.proxy_is_fresh(self._video(source, proxy_generated_at=None), proxy_file) is False

    def test_stale_when_proxy_file_missing(self, tmp_path):
        source = tmp_path / "session.mkv"
        source.write_bytes(b"x")
        assert proxy.proxy_is_fresh(self._video(source), tmp_path / "gone.mp4") is False

    def test_stale_when_source_size_changed(self, tmp_path):
        source = tmp_path / "session.mkv"
        source.write_bytes(b"x" * 100)
        proxy_file = tmp_path / "p.mp4"
        proxy_file.write_bytes(b"proxy")
        video = self._video(source, proxy_source_size=999999)
        assert proxy.proxy_is_fresh(video, proxy_file) is False


# ── DB bookkeeping shared across segments ───────────────────────────────────────

class TestRecordProxyMetadata:
    def test_marks_parent_and_segment_sharing_source(self, tmp_path):
        source = tmp_path / "session.mkv"
        source.write_bytes(b"x" * 500)
        session = make_session(tmp_path / "project.db")
        try:
            parent = Video(path=str(source), filename="session.mkv", status="done")
            session.add(parent)
            session.flush()
            segment = Video(path=str(source), filename="session.mkv", status="done",
                            parent_video_id=parent.id, segment_start_s=0.0, segment_end_s=10.0)
            session.add(segment)
            session.commit()

            proxy_file = tmp_path / "proxies" / "abc_720p.mp4"
            proxy.record_proxy_metadata(session, parent, proxy_file)
            session.commit()

            for row in session.query(Video).all():
                assert row.proxy_path == str(proxy_file)
                assert row.proxy_generated_at is not None
                assert row.proxy_source_size == source.stat().st_size
        finally:
            session.close()


class TestRunWithProgressChildCleanup:
    """_run_with_progress must not orphan the FFmpeg child when the progress
    callback raises mid-stream - it kills a still-running child before re-raising."""

    class _FakeProc:
        def __init__(self):
            self.stdout = iter(["out_time_us=500\n"])
            self.returncode = None
            self.killed = False

        def poll(self):
            return None  # still running when the callback raises

        def kill(self):
            self.killed = True

        def wait(self):
            self.returncode = -9
            return self.returncode

    def test_raising_callback_kills_child_and_propagates(self, monkeypatch):
        fake = self._FakeProc()
        monkeypatch.setattr(proxy.subprocess, "Popen", lambda *a, **k: fake)

        def boom(_frac):
            raise ValueError("cb failed")

        with pytest.raises(ValueError, match="cb failed"):
            proxy._run_with_progress(["ffmpeg", "-i", "x"], duration_ms=1000, progress_cb=boom)
        assert fake.killed, "FFmpeg child was left running after the callback raised"
