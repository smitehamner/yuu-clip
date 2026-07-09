"""Overlap-detection logic for near-duplicate clip candidates
(yuu_clip/scoring/dedup.py). Pure query + pairwise comparison; no live server."""
from __future__ import annotations

from pathlib import Path

import pytest

from yuu_clip.db.models import ClipCandidate, Video, make_session
from yuu_clip.scoring.dedup import find_duplicate_candidates


@pytest.fixture()
def session(tmp_path: Path):
    db = make_session(tmp_path / "dedup.db")
    for video_id in (1, 2):
        db.add(Video(id=video_id, path=f"/v{video_id}.mkv", filename=f"v{video_id}.mkv", status="done"))
    db.flush()
    yield db
    db.close()


def _add_clip(session, video_id: int, start_ms: int, end_ms: int, status: str = "pending") -> ClipCandidate:
    clip = ClipCandidate(video_id=video_id, start_ms=start_ms, end_ms=end_ms, status=status)
    session.add(clip)
    session.flush()
    return clip


def test_identical_windows_flagged_with_full_ratio(session):
    a = _add_clip(session, 1, 0, 1000)
    b = _add_clip(session, 1, 0, 1000)
    pairs = find_duplicate_candidates(1, session)
    assert len(pairs) == 1
    clip_a, clip_b, ratio = pairs[0]
    assert {clip_a.id, clip_b.id} == {a.id, b.id}
    assert ratio == 1.0


def test_overlap_exactly_at_threshold_flagged(session):
    # overlap 700 of the shorter (1000ms) clip = 0.7, the default threshold.
    _add_clip(session, 1, 0, 1000)
    _add_clip(session, 1, 300, 1300)
    assert len(find_duplicate_candidates(1, session)) == 1


def test_overlap_below_threshold_not_flagged(session):
    # overlap 500 of the shorter (1000ms) clip = 0.5, below 0.7.
    _add_clip(session, 1, 0, 1000)
    _add_clip(session, 1, 500, 1500)
    assert find_duplicate_candidates(1, session) == []


def test_adjacent_non_overlapping_clips_not_flagged(session):
    _add_clip(session, 1, 0, 1000)
    _add_clip(session, 1, 1000, 2000)
    assert find_duplicate_candidates(1, session) == []


def test_short_clip_contained_in_long_clip_flagged(session):
    # ratio uses the SHORTER clip's duration: a small clip fully inside a large
    # one overlaps 100% of itself, so it flags even though it is a small slice
    # of the large clip.
    _add_clip(session, 1, 0, 4000)
    _add_clip(session, 1, 1000, 1500)
    assert len(find_duplicate_candidates(1, session)) == 1


def test_clips_from_different_videos_never_paired(session):
    _add_clip(session, 1, 0, 1000)
    _add_clip(session, 2, 0, 1000)
    assert find_duplicate_candidates(1, session) == []
    assert find_duplicate_candidates(2, session) == []


def test_rejected_clip_excluded_from_pairs(session):
    _add_clip(session, 1, 0, 1000)
    _add_clip(session, 1, 0, 1000, status="rejected")
    assert find_duplicate_candidates(1, session) == []


def test_pair_ordering_is_earlier_clip_first(session):
    later = _add_clip(session, 1, 200, 1200)
    earlier = _add_clip(session, 1, 0, 1000)
    pairs = find_duplicate_candidates(1, session)
    assert len(pairs) == 1
    clip_a, clip_b, _ = pairs[0]
    assert clip_a.id == earlier.id
    assert clip_b.id == later.id


def test_approved_and_trimmed_clips_still_scanned(session):
    _add_clip(session, 1, 0, 1000, status="approved")
    _add_clip(session, 1, 0, 1000, status="trimmed")
    assert len(find_duplicate_candidates(1, session)) == 1


def test_custom_threshold_respected(session):
    # overlap 500/1000 = 0.5: flagged at threshold 0.4, not at 0.6.
    _add_clip(session, 1, 0, 1000)
    _add_clip(session, 1, 500, 1500)
    assert len(find_duplicate_candidates(1, session, threshold=0.4)) == 1
    assert find_duplicate_candidates(1, session, threshold=0.6) == []
