"""yuu_clip/segments/visual_windower.py - visual candidate generation (Stage 2).

generate_visual_candidates proposes clip windows from VisualActivity motion peaks
and SceneBoundary density. Each window carries an empty transcript excerpt and the
"visual"/"no_speech" tags, reuses the min_clip_ms/hard_split_ms bounds, and (in gaps
mode) is restricted to the allowed silent regions. silent_gaps computes the
inter-window complement used to drive gaps mode.
"""
from __future__ import annotations

from yuu_clip.config import Config
from yuu_clip.db.models import (
    ClipCandidate,
    SceneBoundary,
    Video,
    VisualActivity,
    make_session,
)
from yuu_clip.segments.visual_windower import generate_visual_candidates, silent_gaps


def _db(tmp_path, duration_ms=600_000):
    session = make_session(tmp_path / "test.db")
    v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=duration_ms)
    session.add(v)
    session.flush()
    return session, v


def _seed_motion(session, video_id, start_ms, end_ms, intensity, step_ms=500):
    for ms in range(start_ms, end_ms, step_ms):
        session.add(VisualActivity(video_id=video_id, timecode_ms=ms, intensity=intensity))


class TestGenerateVisualCandidates:
    def test_motion_peak_in_region_produces_candidate(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            _seed_motion(session, v.id, 100_000, 130_000, intensity=40.0)
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(90_000, 140_000)])
        finally:
            session.close()
        assert len(cands) == 1
        c = cands[0]
        assert isinstance(c, ClipCandidate)
        assert c.kind == "clip"
        assert c.transcript_excerpt == ""
        assert set(c.tags) == {"visual", "no_speech"}
        assert c.start_ms >= 90_000 and c.end_ms <= 140_000

    def test_no_peaks_yields_no_candidates(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            # All below visual_peak_threshold (12.0)
            _seed_motion(session, v.id, 100_000, 130_000, intensity=3.0)
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(90_000, 140_000)])
        finally:
            session.close()
        assert cands == []

    def test_empty_timeline_yields_no_candidates(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(0, 600_000)])
        finally:
            session.close()
        assert cands == []

    def test_gaps_mode_only_considers_allowed_regions(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            _seed_motion(session, v.id, 100_000, 130_000, intensity=40.0)  # inside region
            _seed_motion(session, v.id, 300_000, 330_000, intensity=40.0)  # outside region
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(90_000, 140_000)])
        finally:
            session.close()
        assert len(cands) == 1
        assert all(c.start_ms >= 90_000 and c.end_ms <= 140_000 for c in cands)

    def test_min_clip_ms_respected_for_short_burst(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            # Single high sample - the window must still be at least min_clip_ms.
            session.add(VisualActivity(video_id=v.id, timecode_ms=100_000, intensity=40.0))
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(0, 600_000)])
        finally:
            session.close()
        assert len(cands) == 1
        assert cands[0].end_ms - cands[0].start_ms >= Config().min_clip_ms

    def test_scene_density_produces_candidate(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            for ms in (100_000, 101_000, 102_000):  # 3 cuts clustered, no motion
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(0, 600_000)])
        finally:
            session.close()
        assert len(cands) == 1
        assert set(cands[0].tags) == {"visual", "no_speech"}

    def test_lone_scene_cut_insufficient(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            session.add(SceneBoundary(video_id=v.id, timecode_ms=100_000))
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(0, 600_000)])
        finally:
            session.close()
        assert cands == []

    def test_visual_peak_recorded_on_candidate(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            _seed_motion(session, v.id, 100_000, 130_000, intensity=42.0)
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=[(90_000, 140_000)])
        finally:
            session.close()
        assert cands[0].visual_peak == 42.0

    def test_parallel_whole_video_uses_duration(self, tmp_path):
        session, v = _db(tmp_path, duration_ms=200_000)
        try:
            _seed_motion(session, v.id, 100_000, 130_000, intensity=40.0)
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=None)
        finally:
            session.close()
        assert len(cands) == 1
        assert cands[0].end_ms <= 200_000

    def test_separated_bursts_produce_separate_candidates(self, tmp_path):
        session, v = _db(tmp_path)
        try:
            _seed_motion(session, v.id, 100_000, 120_000, intensity=40.0)
            _seed_motion(session, v.id, 300_000, 320_000, intensity=40.0)  # > cluster gap away
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=None)
        finally:
            session.close()
        assert len(cands) == 2

    def test_close_bursts_merge_into_single_candidate(self, tmp_path):
        # Two bursts > cluster gap (2 s) but < min_clip_ms (15 s) apart become separate
        # runs, which pre-fix each grew to a ~15 s window -> two ~80%-overlapping clips.
        # Merging close runs first yields one candidate spanning both bursts.
        session, v = _db(tmp_path)
        try:
            session.add(VisualActivity(video_id=v.id, timecode_ms=100_000, intensity=40.0))
            session.add(VisualActivity(video_id=v.id, timecode_ms=104_000, intensity=40.0))
            session.flush()
            cands = generate_visual_candidates(v, Config(), session, allowed_regions=None)
        finally:
            session.close()
        assert len(cands) == 1
        assert cands[0].start_ms <= 100_000 and cands[0].end_ms >= 104_000


class TestSilentGaps:
    def _clip(self, start_ms, end_ms):
        from types import SimpleNamespace
        return SimpleNamespace(start_ms=start_ms, end_ms=end_ms)

    def test_gaps_between_transcript_windows(self):
        v = Video(path="x", filename="x", status="done", duration_ms=100_000)
        cands = [self._clip(10_000, 20_000), self._clip(40_000, 60_000)]
        gaps = silent_gaps(cands, v)
        assert gaps == [(0, 10_000), (20_000, 40_000), (60_000, 100_000)]

    def test_no_transcript_windows_is_whole_video(self):
        v = Video(path="x", filename="x", status="done", duration_ms=100_000)
        assert silent_gaps([], v) == [(0, 100_000)]

    def test_adjacent_windows_leave_no_gap(self):
        v = Video(path="x", filename="x", status="done", duration_ms=100_000)
        cands = [self._clip(0, 50_000), self._clip(50_000, 100_000)]
        assert silent_gaps(cands, v) == []
