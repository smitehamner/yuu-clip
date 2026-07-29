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


def test_tied_start_ms_orders_clip_a_by_lower_id(session):
    # Two clips share a start_ms; the query orders by (start_ms, id), so the
    # lower-id clip must be clip_a even though it is inserted second.
    session.add(ClipCandidate(id=20, video_id=1, start_ms=0, end_ms=1000, status="pending"))
    session.add(ClipCandidate(id=10, video_id=1, start_ms=0, end_ms=1000, status="pending"))
    session.flush()
    pairs = find_duplicate_candidates(1, session)
    assert len(pairs) == 1
    clip_a, clip_b, _ = pairs[0]
    assert clip_a.id == 10
    assert clip_b.id == 20


def test_dismissed_pair_not_flagged(session):
    a = _add_clip(session, 1, 0, 1000)
    b = _add_clip(session, 1, 0, 1000)
    a.dismissed_duplicate_ids = [b.id]
    assert find_duplicate_candidates(1, session) == []


def test_dismissal_recorded_on_either_side_suppresses_the_pair(session):
    # Dismissal is checked from both directions - recording it only on the
    # later-starting clip (clip_b in pair order) must still suppress the pair.
    a = _add_clip(session, 1, 0, 1000)
    b = _add_clip(session, 1, 0, 1000)
    b.dismissed_duplicate_ids = [a.id]
    assert find_duplicate_candidates(1, session) == []


def test_dismissing_one_pair_does_not_suppress_a_different_overlap(session):
    a = _add_clip(session, 1, 0, 1000)
    b = _add_clip(session, 1, 0, 1000)
    c = _add_clip(session, 1, 0, 1000)
    a.dismissed_duplicate_ids = [b.id]
    b.dismissed_duplicate_ids = [a.id]
    pairs = find_duplicate_candidates(1, session)
    paired_ids = [{p[0].id, p[1].id} for p in pairs]
    assert {a.id, c.id} in paired_ids
    assert {b.id, c.id} in paired_ids
    assert {a.id, b.id} not in paired_ids


def test_zero_duration_clip_inside_another_never_divides_by_zero(session):
    # A zero-length clip (start == end) sitting inside a longer clip: the shorter
    # duration is 0, so the overlap-ratio guard returns 0.0 (no flag) instead of
    # a ZeroDivisionError. The zero-length clip starts before the long clip's end,
    # so it is compared rather than skipped by the start-order break.
    _add_clip(session, 1, 0, 4000)
    _add_clip(session, 1, 2000, 2000)
    assert find_duplicate_candidates(1, session) == []
