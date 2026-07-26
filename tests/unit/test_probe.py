"""Unit tests for ffprobe JSON parsing (analyze/probe.py).

The subprocess call itself is mocked - these tests cover the pure parsing and
data-shape logic: fps string parsing, audio-stream field defaults, and the
VideoInfo derived properties. Subprocess failure/timeout paths are covered in
tests/integration/test_analyze.py::TestProbe.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestParseFps:
    def _fps(self, s):
        from yuu_clip.analyze.probe import _parse_fps
        return _parse_fps(s)

    def test_fractional_rate(self):
        assert self._fps("60000/1001") == pytest.approx(59.94, abs=0.01)

    def test_integer_rate_without_slash(self):
        assert self._fps("24") == 24.0

    def test_zero_denominator_falls_back_to_30(self):
        assert self._fps("30/0") == 30.0

    def test_unparseable_string_falls_back_to_30(self):
        assert self._fps("not-a-rate") == 30.0


class TestParseAudioStream:
    def _parse(self, stream_dict):
        from yuu_clip.analyze.probe import _parse_audio_stream
        return _parse_audio_stream(stream_dict)

    def test_defaults_when_fields_missing(self):
        info = self._parse({"index": 1})
        assert info.sample_rate == 44100
        assert info.channels == 2
        assert info.codec_name == "unknown"
        assert info.title_tag is None
        assert info.duration_ms is None

    def test_title_tag_from_tags(self):
        info = self._parse({"index": 2, "tags": {"title": "Mic (Clean)"}})
        assert info.title_tag == "Mic (Clean)"

    def test_duration_present_converted_to_ms(self):
        info = self._parse({"index": 3, "duration": "2.5"})
        assert info.duration_ms == 2500

    def test_stream_index_preserved(self):
        info = self._parse({"index": 7})
        assert info.stream_index == 7


class TestVideoInfoProperties:
    def _info(self, audio_streams, duration_ms=3_665_000):
        from yuu_clip.analyze.probe import VideoInfo
        return VideoInfo(
            path=Path("v.mkv"), duration_ms=duration_ms, fps=30.0,
            width=1920, height=1080, audio_streams=audio_streams,
        )

    def test_has_multiple_audio_tracks_true_with_two(self):
        assert self._info([object(), object()]).has_multiple_audio_tracks is True

    def test_has_multiple_audio_tracks_false_with_one(self):
        assert self._info([object()]).has_multiple_audio_tracks is False

    def test_has_multiple_audio_tracks_false_with_none(self):
        assert self._info([]).has_multiple_audio_tracks is False

    def test_duration_hms_includes_hours_when_present(self):
        assert self._info([]).duration_hms == "1h 01m 05s"

    def test_duration_hms_omits_hours_when_under_an_hour(self):
        assert self._info([], duration_ms=65_000).duration_hms == "1m 05s"


class TestProbeVideo:
    def test_missing_file_raises_file_not_found(self, tmp_path):
        from yuu_clip.analyze.probe import probe_video
        with pytest.raises(FileNotFoundError):
            probe_video(tmp_path / "nope.mkv")

    def test_audio_only_file_has_zero_dimensions_and_default_fps(self, tmp_path):
        from yuu_clip.analyze.probe import probe_video

        video = tmp_path / "audio_only.mka"
        video.write_bytes(b"fake")
        ffprobe_json = json.dumps({
            "streams": [{"codec_type": "audio", "index": 0, "codec_name": "aac"}],
            "format": {"duration": "10.0"},
        })

        def ok_run(cmd, **kwargs):
            r = MagicMock()
            r.returncode = 0
            r.stdout = ffprobe_json
            return r

        with patch("yuu_clip.analyze.probe.subprocess.run", side_effect=ok_run), \
             patch("yuu_clip.analyze.probe.find_ffmpeg", return_value=("ffmpeg", "ffprobe")):
            info = probe_video(video)

        assert info.width == 0
        assert info.height == 0
        assert info.fps == 30.0  # no video stream -> the default "30/1" string is used
        assert len(info.audio_streams) == 1

    def test_multiple_audio_streams_are_all_parsed(self, tmp_path):
        from yuu_clip.analyze.probe import probe_video

        video = tmp_path / "multi.mkv"
        video.write_bytes(b"fake")
        ffprobe_json = json.dumps({
            "streams": [
                {"codec_type": "video", "avg_frame_rate": "30/1", "width": 1920, "height": 1080},
                {"codec_type": "audio", "index": 1, "codec_name": "aac"},
                {"codec_type": "audio", "index": 2, "codec_name": "opus"},
            ],
            "format": {"duration": "60.0"},
        })

        def ok_run(cmd, **kwargs):
            r = MagicMock()
            r.returncode = 0
            r.stdout = ffprobe_json
            return r

        with patch("yuu_clip.analyze.probe.subprocess.run", side_effect=ok_run), \
             patch("yuu_clip.analyze.probe.find_ffmpeg", return_value=("ffmpeg", "ffprobe")):
            info = probe_video(video)

        assert [s.stream_index for s in info.audio_streams] == [1, 2]
        assert info.duration_ms == 60_000
