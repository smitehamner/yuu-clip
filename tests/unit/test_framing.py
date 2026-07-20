"""Unit tests for the vertical auto-framing detector (yuu_clip/analyze/framing.py).

MediaPipe is never imported here: the crop-position math is pure, and the
per-frame detection parser takes an already-built detector object, so a light
fake stands in for MediaPipe's `FaceDetection`.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from yuu_clip.analyze.framing import (
    _center_x_from_result,
    _median,
    _sample_timestamps,
    crop_x_from_face_center,
)

# For a 16:9 source the 9:16 column spans 81/256 of the width; these are the
# face-center positions that map to the crop's left and right extremes.
_CROP_W_FRACTION_16_9 = (9 / 16) / (16 / 9)  # 0.31640625
_FACE_FOR_LEFT = _CROP_W_FRACTION_16_9 / 2
_FACE_FOR_RIGHT = _CROP_W_FRACTION_16_9 / 2 + (1 - _CROP_W_FRACTION_16_9)


class TestCropXFromFaceCenter:
    def test_centered_face_maps_to_center(self):
        assert crop_x_from_face_center(0.5, 1920, 1080) == pytest.approx(0.5)

    def test_face_at_left_extreme_maps_to_zero(self):
        assert crop_x_from_face_center(_FACE_FOR_LEFT, 1920, 1080) == pytest.approx(0.0)

    def test_face_at_right_extreme_maps_to_one(self):
        assert crop_x_from_face_center(_FACE_FOR_RIGHT, 1920, 1080) == pytest.approx(1.0)

    def test_far_left_face_clamps_to_zero(self):
        assert crop_x_from_face_center(0.0, 1920, 1080) == 0.0

    def test_far_right_face_clamps_to_one(self):
        assert crop_x_from_face_center(1.0, 1920, 1080) == 1.0

    def test_unknown_dimensions_assume_16_9(self):
        assert crop_x_from_face_center(0.5, None, None) == pytest.approx(0.5)
        assert crop_x_from_face_center(0.5, 0, 0) == pytest.approx(0.5)

    def test_source_narrower_than_9_16_returns_center(self):
        # 480x1080 is taller than 9:16 - no horizontal slack, so centering is moot.
        assert crop_x_from_face_center(0.2, 480, 1080) == 0.5


class TestMedian:
    def test_empty_is_none(self):
        assert _median([]) is None

    def test_all_none_is_none(self):
        assert _median([None, None]) is None

    def test_median_of_values(self):
        assert _median([0.2, 0.4, 0.6]) == 0.4

    def test_ignores_none_entries(self):
        assert _median([0.2, None, 0.6]) == pytest.approx(0.4)


class TestSampleTimestamps:
    def test_evenly_spaced_strictly_inside(self):
        assert _sample_timestamps(0.0, 60.0, count=5) == [10.0, 20.0, 30.0, 40.0, 50.0]

    def test_all_within_bounds(self):
        stamps = _sample_timestamps(100.0, 130.0, count=5)
        assert all(100.0 < t < 130.0 for t in stamps)

    def test_zero_span_returns_start(self):
        assert _sample_timestamps(42.0, 42.0) == [42.0]


class TestCenterXFromResult:
    """Tasks-API bounding boxes are in pixels; the parser normalizes by frame width."""

    def _detection(self, origin_x, width, score):
        return SimpleNamespace(
            categories=[SimpleNamespace(score=score)],
            bounding_box=SimpleNamespace(origin_x=origin_x, width=width),
        )

    def test_no_detections_is_none(self):
        assert _center_x_from_result([], image_width=640) is None

    def test_zero_width_is_none(self):
        assert _center_x_from_result([self._detection(100, 50, 0.9)], image_width=0) is None

    def test_returns_normalized_center_of_single_face(self):
        # face pixels [256, 384] of a 640px frame → center 320 → 0.5
        assert _center_x_from_result([self._detection(256, 128, 0.9)], image_width=640) == pytest.approx(0.5)

    def test_picks_highest_confidence_face(self):
        detections = [
            self._detection(0, 64, 0.4),      # center 32/640 = 0.05
            self._detection(448, 128, 0.95),  # center 512/640 = 0.80, wins
        ]
        assert _center_x_from_result(detections, image_width=640) == pytest.approx(0.80)


class TestEnsureFaceModel:
    """framing._ensure_face_model downloads the BlazeFace model to a .part sibling
    then renames, with a bounded timeout and .part cleanup on failure."""

    def _patch_path(self, monkeypatch, tmp_path):
        import yuu_clip.analyze.framing as framing_mod
        model_path = tmp_path / "blaze.tflite"
        monkeypatch.setattr(framing_mod, "_model_path", lambda: model_path)
        return framing_mod, model_path

    def test_returns_cached_path_without_downloading(self, monkeypatch, tmp_path):
        framing_mod, model_path = self._patch_path(monkeypatch, tmp_path)
        model_path.write_bytes(b"already here")

        def _boom(*a, **k):
            raise AssertionError("should not download when cached")

        monkeypatch.setattr(framing_mod.urllib.request, "urlopen", _boom)
        assert framing_mod._ensure_face_model() == model_path

    def test_downloads_with_timeout_then_renames(self, monkeypatch, tmp_path):
        import contextlib
        import io

        framing_mod, model_path = self._patch_path(monkeypatch, tmp_path)
        captured = {}

        @contextlib.contextmanager
        def _fake_urlopen(url, timeout=None):
            captured["timeout"] = timeout
            yield io.BytesIO(b"model-bytes")

        monkeypatch.setattr(framing_mod.urllib.request, "urlopen", _fake_urlopen)
        result = framing_mod._ensure_face_model()

        assert result == model_path
        assert model_path.read_bytes() == b"model-bytes"
        assert captured["timeout"] == framing_mod._DOWNLOAD_TIMEOUT_S
        assert not model_path.with_name(model_path.name + ".part").exists()

    def test_failed_download_cleans_part_and_raises(self, monkeypatch, tmp_path):
        import contextlib

        framing_mod, model_path = self._patch_path(monkeypatch, tmp_path)

        @contextlib.contextmanager
        def _stalling_urlopen(url, timeout=None):
            raise TimeoutError("connection stalled")
            yield  # pragma: no cover

        monkeypatch.setattr(framing_mod.urllib.request, "urlopen", _stalling_urlopen)
        with pytest.raises(TimeoutError, match="stalled"):
            framing_mod._ensure_face_model()

        assert not model_path.exists()
        assert not model_path.with_name(model_path.name + ".part").exists()

    def test_prefetch_face_model_delegates_to_ensure(self, monkeypatch, tmp_path):
        """prefetch_face_model is the boot-time background prefetch entry point
        (initModelPrefetch) - it must reuse the same lazy-download path as
        first-use, not a second implementation."""
        framing_mod, model_path = self._patch_path(monkeypatch, tmp_path)
        calls = []
        monkeypatch.setattr(framing_mod, "_ensure_face_model", lambda: calls.append(1) or model_path)
        framing_mod.prefetch_face_model()
        assert calls == [1]
