"""Unit tests for session auto-grouping (pure logic, no DB)."""
from __future__ import annotations

from datetime import datetime, timedelta

from yuu_clip.sessions import (
    SessionCandidate,
    parse_obs_start_time,
    recording_start_time,
    suggest_session_groups,
)


def _candidate(cid: int, start: datetime, minutes: float) -> SessionCandidate:
    return SessionCandidate(cid, start, int(minutes * 60_000))


def test_parse_obs_start_time_space_separator():
    assert parse_obs_start_time("2026-07-04 21-30-15.mkv") == datetime(2026, 7, 4, 21, 30, 15)


def test_parse_obs_start_time_underscore_separator():
    assert parse_obs_start_time("clip_2026-01-02_08-05-00.mp4") == datetime(2026, 1, 2, 8, 5, 0)


def test_parse_obs_start_time_absent():
    assert parse_obs_start_time("my recording.mkv") is None


def test_parse_obs_start_time_invalid_date():
    assert parse_obs_start_time("2026-13-40 25-99-99.mkv") is None


def test_recording_start_time_prefers_filename():
    # mtime is deliberately far off; the parsed filename wins.
    result = recording_start_time("2026-07-04 21-30-15.mkv", mtime=0.0, duration_ms=60_000)
    assert result == datetime(2026, 7, 4, 21, 30, 15)


def test_recording_start_time_falls_back_to_mtime_minus_duration():
    end = datetime(2026, 7, 4, 22, 0, 0)
    result = recording_start_time("no stamp.mkv", mtime=end.timestamp(), duration_ms=600_000)
    assert result == end - timedelta(milliseconds=600_000)


def test_groups_recordings_within_gap():
    base = datetime(2026, 7, 4, 20, 0, 0)
    # Three 20-minute recordings, each starting 25 min after the last (5 min gaps).
    candidates = [
        _candidate(1, base, 20),
        _candidate(2, base + timedelta(minutes=25), 20),
        _candidate(3, base + timedelta(minutes=50), 20),
    ]
    assert suggest_session_groups(candidates) == [[1, 2, 3]]


def test_splits_on_large_gap():
    base = datetime(2026, 7, 4, 20, 0, 0)
    candidates = [
        _candidate(1, base, 20),
        _candidate(2, base + timedelta(minutes=25), 20),
        # 45-minute recording starting 2h later → its own group; but a lone group
        # is not suggested.
        _candidate(3, base + timedelta(hours=2), 45),
    ]
    assert suggest_session_groups(candidates) == [[1, 2]]


def test_gap_exactly_at_threshold_splits():
    base = datetime(2026, 7, 4, 20, 0, 0)
    # First ends at 20:20; second starts exactly 30 min later (20:50) → gap == 30 min,
    # which is not < 30 min, so they do not group.
    candidates = [
        _candidate(1, base, 20),
        _candidate(2, base + timedelta(minutes=50), 20),
    ]
    assert suggest_session_groups(candidates) == []


def test_singleton_never_suggested():
    candidates = [_candidate(1, datetime(2026, 7, 4, 20, 0, 0), 20)]
    assert suggest_session_groups(candidates) == []


def test_ordering_independent_of_input_order():
    base = datetime(2026, 7, 4, 20, 0, 0)
    candidates = [
        _candidate(3, base + timedelta(minutes=50), 20),
        _candidate(1, base, 20),
        _candidate(2, base + timedelta(minutes=25), 20),
    ]
    assert suggest_session_groups(candidates) == [[1, 2, 3]]


def test_two_separate_sessions():
    base = datetime(2026, 7, 4, 20, 0, 0)
    later = base + timedelta(hours=5)
    candidates = [
        _candidate(1, base, 20),
        _candidate(2, base + timedelta(minutes=25), 20),
        _candidate(3, later, 20),
        _candidate(4, later + timedelta(minutes=25), 20),
    ]
    assert suggest_session_groups(candidates) == [[1, 2], [3, 4]]
