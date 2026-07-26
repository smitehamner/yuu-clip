"""yuu_clip/analyze/frames.py - frame timestamp maths, clamp, window resolution.

The ffmpeg extraction itself isn't exercised here (it needs a real video); the
timestamp maths and window resolution are pure and are what the correctness of a
split-segment clip's frames actually hinges on.
"""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest


class TestFrameTimestamps:
    def _ts(self, start, end, count):
        from yuu_clip.analyze.frames import frame_timestamps
        return frame_timestamps(start, end, count)

    def test_single_frame_is_window_midpoint(self):
        assert self._ts(10.0, 20.0, 1) == [15.0]

    def test_frames_evenly_spaced_strictly_inside(self):
        ts = self._ts(0.0, 10.0, 4)
        assert ts == [2.0, 4.0, 6.0, 8.0]
        assert ts[0] > 0.0 and ts[-1] < 10.0

    def test_zero_length_window_repeats_start(self):
        assert self._ts(5.0, 5.0, 3) == [5.0, 5.0, 5.0]

    def test_count_floored_to_one(self):
        assert self._ts(0.0, 10.0, 0) == [5.0]


class TestClampFrameCount:
    def _clamp(self, value):
        from yuu_clip.analyze.frames import clamp_frame_count
        from yuu_clip.config import Config
        cfg = Config()
        cfg.vision_frames_per_clip = value
        return clamp_frame_count(cfg)

    def test_in_range_unchanged(self):
        assert self._clamp(4) == 4

    def test_below_range_clamped_to_one(self):
        assert self._clamp(0) == 1

    def test_above_range_clamped_to_ten(self):
        assert self._clamp(99) == 10


class TestResolveFrameWindow:
    """resolve_frame_window adds the parent segment offset so a split segment's
    segment-relative clip times land on the parent-keyed proxy/source."""

    def _resolve(self, monkeypatch, *, segment_start_s, start_ms, end_ms,
                 start_offset=0.0, end_offset=0.0, proxy_fresh=False):
        import yuu_clip.analyze.proxy as proxy_mod
        from yuu_clip.analyze.frames import resolve_frame_window

        source = Path("/videos/parent.mkv")
        proxy = Path("/proxies/parent.720p.mp4")
        monkeypatch.setattr(proxy_mod, "proxy_file_for", lambda src, d: proxy)
        monkeypatch.setattr(proxy_mod, "proxy_is_fresh", lambda v, p: proxy_fresh)
        video = SimpleNamespace(path=str(source), segment_start_s=segment_start_s)
        clip = SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms,
            start_offset=start_offset, end_offset=end_offset,
        )
        return resolve_frame_window(video, clip, Path("/proxies"))

    def test_plain_clip_uses_source_when_proxy_stale(self, monkeypatch):
        src, start, end = self._resolve(
            monkeypatch, segment_start_s=None, start_ms=10_000, end_ms=20_000,
        )
        assert src == Path("/videos/parent.mkv")
        assert start == 10.0 and end == 20.0

    def test_fresh_proxy_is_preferred(self, monkeypatch):
        src, _, _ = self._resolve(
            monkeypatch, segment_start_s=None, start_ms=0, end_ms=1_000, proxy_fresh=True,
        )
        assert src == Path("/proxies/parent.720p.mp4")

    def test_segment_offset_added_to_clip_times(self, monkeypatch):
        _, start, end = self._resolve(
            monkeypatch, segment_start_s=120.0, start_ms=5_000, end_ms=15_000,
        )
        assert start == 125.0 and end == 135.0

    def test_trim_offsets_applied(self, monkeypatch):
        _, start, end = self._resolve(
            monkeypatch, segment_start_s=None, start_ms=10_000, end_ms=20_000,
            start_offset=-0.5, end_offset=1.0,
        )
        assert start == 9.5 and end == 21.0


class TestSampleClipFrames:
    def _patch(self, monkeypatch, extract_ok=True):
        import yuu_clip.analyze.frames as frames_mod
        monkeypatch.setattr(frames_mod, "find_ffmpeg", lambda: ("ffmpeg", "ffprobe"))
        monkeypatch.setattr(frames_mod, "_extract_frame", lambda ffmpeg, src, ts, out: extract_ok)
        return frames_mod

    def test_returns_written_frames_in_time_order(self, monkeypatch, tmp_path):
        frames_mod = self._patch(monkeypatch)
        frames = frames_mod.sample_clip_frames(tmp_path / "src.mkv", 0.0, 10.0, 3, tmp_path)
        assert [f.name for f in frames] == ["frame_0.jpg", "frame_1.jpg", "frame_2.jpg"]

    def test_skips_timestamps_that_fail_to_extract(self, monkeypatch, tmp_path):
        import yuu_clip.analyze.frames as frames_mod
        monkeypatch.setattr(frames_mod, "find_ffmpeg", lambda: ("ffmpeg", "ffprobe"))
        calls = {"n": 0}

        def fake_extract(ffmpeg, src, ts, out):
            calls["n"] += 1
            return calls["n"] != 2  # the second sampled timestamp fails to extract

        monkeypatch.setattr(frames_mod, "_extract_frame", fake_extract)
        frames = frames_mod.sample_clip_frames(tmp_path / "src.mkv", 0.0, 10.0, 3, tmp_path)
        assert len(frames) == 2
        assert calls["n"] == 3

    def test_no_frames_extracted_returns_empty_list(self, monkeypatch, tmp_path):
        frames_mod = self._patch(monkeypatch, extract_ok=False)
        frames = frames_mod.sample_clip_frames(tmp_path / "src.mkv", 0.0, 10.0, 3, tmp_path)
        assert frames == []


class TestAnalyzeClipFrames:
    def test_resolves_window_then_delegates_to_sample_and_describe(self, monkeypatch, tmp_path):
        import yuu_clip.analyze.frames as frames_mod
        from yuu_clip.config import Config

        video = SimpleNamespace(path=str(tmp_path / "v.mkv"), segment_start_s=None)
        clip = SimpleNamespace(start_ms=1000, end_ms=5000, start_offset=0, end_offset=0)
        config = Config()
        captured = {}

        def fake_resolve(v, c, proxy_dir):
            captured["resolve_args"] = (v, c, proxy_dir)
            return Path("/enc/src.mkv"), 1.0, 5.0

        def fake_sample_and_describe(encode_src, start_s, end_s, count, cfg, context_text=""):
            captured["sample_args"] = (encode_src, start_s, end_s, count, context_text)
            return "described"

        monkeypatch.setattr(frames_mod, "resolve_frame_window", fake_resolve)
        monkeypatch.setattr(frames_mod, "sample_and_describe", fake_sample_and_describe)

        result = frames_mod.analyze_clip_frames(video, clip, config, tmp_path, context_text="ctx")

        assert result == "described"
        assert captured["resolve_args"] == (video, clip, tmp_path)
        assert captured["sample_args"][:3] == (Path("/enc/src.mkv"), 1.0, 5.0)
        assert captured["sample_args"][4] == "ctx"


class TestSampleAndDescribe:
    def test_raises_when_no_frames_sampled(self, monkeypatch, tmp_path):
        import yuu_clip.analyze.frames as frames_mod
        from yuu_clip.config import Config

        monkeypatch.setattr(frames_mod, "sample_clip_frames", lambda *a, **k: [])
        with pytest.raises(RuntimeError, match="Could not sample"):
            frames_mod.sample_and_describe(tmp_path / "x.mkv", 0.0, 5.0, 4, Config())

    def test_passes_sampled_frames_to_describe(self, monkeypatch, tmp_path):
        import yuu_clip.analyze.frames as frames_mod
        from yuu_clip.config import Config

        captured = {}
        fake_frames = [tmp_path / "f0.jpg", tmp_path / "f1.jpg"]
        monkeypatch.setattr(frames_mod, "sample_clip_frames", lambda *a, **k: fake_frames)

        def fake_describe(frames, config, context_text=""):
            captured["frames"] = frames
            captured["context"] = context_text
            return "on screen: a game"

        monkeypatch.setattr("yuu_clip.scoring.llm.describe_frames", fake_describe)
        result = frames_mod.sample_and_describe(
            tmp_path / "x.mkv", 0.0, 5.0, 2, Config(), context_text="CTX",
        )
        assert result == "on screen: a game"
        assert captured["frames"] == fake_frames
        assert captured["context"] == "CTX"
