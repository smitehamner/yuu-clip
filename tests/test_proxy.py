"""Unit tests for the 720p preview-proxy helper (analyze/proxy.py).

No real FFmpeg is invoked — the encode runner is stubbed so command shape,
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
