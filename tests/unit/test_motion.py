"""yuu_clip/analyze/motion.py - model-free on-screen activity detection.

The diff math (_intensity_series) is exercised with synthetic numpy frames, and
compute_activity's idempotency + graceful no-op paths are exercised without a real
decode (the container/decoder is stubbed), per the Stage 1 plan.
"""
from __future__ import annotations

import numpy as np

from yuu_clip.analyze import motion
from yuu_clip.config import Config
from yuu_clip.db.models import Video, VisualActivity, make_session


def _gray(value: int, size: int = 8) -> np.ndarray:
    return np.full((size, size), value, dtype=np.uint8)


class TestIntensitySeries:
    def test_first_sample_has_no_row(self):
        series = motion._intensity_series([(0, _gray(10))])
        assert series == []

    def test_static_frames_score_near_zero(self):
        frames = [(0, _gray(120)), (500, _gray(120)), (1000, _gray(120))]
        series = motion._intensity_series(frames)
        assert [ms for ms, _ in series] == [500, 1000]
        assert all(intensity == 0.0 for _, intensity in series)

    def test_alternating_frames_score_high(self):
        frames = [(0, _gray(0)), (500, _gray(255)), (1000, _gray(0))]
        series = motion._intensity_series(frames)
        assert all(intensity == 255.0 for _, intensity in series)

    def test_partial_change_is_proportional(self):
        # Half the pixels flip 0->255, the rest stay -> mean abs diff = 127.5
        frame_a = np.zeros((2, 2), dtype=np.uint8)
        frame_b = np.array([[255, 255], [0, 0]], dtype=np.uint8)
        series = motion._intensity_series([(0, frame_a), (500, frame_b)])
        assert series == [(500, 127.5)]


class _FakeStreams:
    def __init__(self, video):
        self.video = video


class _FakeContainer:
    def __init__(self, video_streams):
        self.streams = _FakeStreams(video_streams)


class TestSampleFromContainerNoVideoStream:
    def test_no_video_stream_yields_nothing(self):
        container = _FakeContainer(video_streams=[])
        assert list(motion._sample_from_container(container, 2.0, 360)) == []


class TestComputeActivity:
    def _video(self, tmp_path):
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=10_000)
        session.add(v)
        session.flush()
        return session, v

    def test_stores_one_row_per_diffed_sample(self, tmp_path, monkeypatch):
        session, v = self._video(tmp_path)
        samples = [(0, _gray(0)), (500, _gray(255)), (1000, _gray(0))]
        monkeypatch.setattr(motion, "_decode_samples", lambda *a, **k: iter(samples))
        try:
            n = motion.compute_activity(v, session, Config())
            rows = session.query(VisualActivity).filter_by(video_id=v.id).order_by(VisualActivity.timecode_ms).all()
        finally:
            session.close()
        assert n == 2  # three samples -> two inter-frame diffs
        assert [r.timecode_ms for r in rows] == [500, 1000]
        assert all(r.intensity == 255.0 for r in rows)

    def test_idempotent_skips_when_rows_exist(self, tmp_path, monkeypatch):
        session, v = self._video(tmp_path)
        session.add(VisualActivity(video_id=v.id, timecode_ms=0, intensity=5.0))
        session.flush()

        def _must_not_decode(*_a, **_k):
            raise AssertionError("decode must not run when rows already exist")

        monkeypatch.setattr(motion, "_decode_samples", _must_not_decode)
        try:
            n = motion.compute_activity(v, session, Config())
            count = session.query(VisualActivity).filter_by(video_id=v.id).count()
        finally:
            session.close()
        assert n == 0
        assert count == 1

    def test_decode_failure_is_swallowed(self, tmp_path, monkeypatch):
        session, v = self._video(tmp_path)

        def _boom(*_a, **_k):
            raise RuntimeError("corrupt stream")

        monkeypatch.setattr(motion, "_decode_samples", _boom)
        try:
            n = motion.compute_activity(v, session, Config())
            count = session.query(VisualActivity).filter_by(video_id=v.id).count()
        finally:
            session.close()
        assert n == 0
        assert count == 0

    def test_no_video_stream_stores_no_rows(self, tmp_path, monkeypatch):
        session, v = self._video(tmp_path)
        # A file with no video stream: the sampler yields nothing, never raises.
        monkeypatch.setattr(motion, "_decode_samples", lambda *a, **k: iter([]))
        try:
            n = motion.compute_activity(v, session, Config())
            count = session.query(VisualActivity).filter_by(video_id=v.id).count()
        finally:
            session.close()
        assert n == 0
        assert count == 0

    def test_split_segment_rows_are_windowed_and_segment_relative(self, tmp_path, monkeypatch):
        # A split segment shares the parent media file, so the decode runs on the
        # parent timeline; rows must be filtered to the segment window and re-based to
        # 0 so the Visual axis (which reads segment-relative clip times) lines up.
        session = make_session(tmp_path / "seg.db")
        seg = Video(
            path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done",
            duration_ms=10_000, segment_start_s=0.5, segment_end_s=1.5,
        )
        session.add(seg)
        session.flush()
        # Parent-timeline samples: diffs land at 500/1000/1500 ms. Window [500,1500)
        # keeps 500 and 1000, drops 1500 (exclusive end), and offsets by -500.
        samples = [(0, _gray(0)), (500, _gray(255)), (1000, _gray(0)), (1500, _gray(255))]
        monkeypatch.setattr(motion, "_decode_samples", lambda *a, **k: iter(samples))
        try:
            n = motion.compute_activity(seg, session, Config())
            rows = session.query(VisualActivity).filter_by(video_id=seg.id).order_by(VisualActivity.timecode_ms).all()
        finally:
            session.close()
        assert n == 2
        assert [r.timecode_ms for r in rows] == [0, 500]


class TestTargetWidth:
    class _Stream:
        def __init__(self, width, height):
            self.width = width
            self.height = height

    def test_preserves_aspect_and_is_even(self):
        # 1920x1080 -> 360 tall keeps 16:9 -> 640 wide (even)
        assert motion._target_width(self._Stream(1920, 1080), 360) == 640

    def test_never_below_two(self):
        assert motion._target_width(self._Stream(1, 1000), 360) == 2
