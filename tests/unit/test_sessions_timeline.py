"""Characterization tests for the unified-session-timeline math in
web/routes/sessions.py (pure helpers, no DB)."""
from __future__ import annotations

from datetime import datetime, timedelta

from yuu_clip.web.routes.sessions import (
    _hms_to_ms,
    _member_offsets,
    _retime_timeline_entries,
)

BASE = datetime(2026, 7, 4, 20, 0, 0)


class TestHmsToMs:
    def test_hms_form(self):
        assert _hms_to_ms("1:02:03") == (3600 + 120 + 3) * 1000

    def test_ms_form(self):
        assert _hms_to_ms("2:05") == (120 + 5) * 1000

    def test_seconds_only(self):
        assert _hms_to_ms("45") == 45_000

    def test_zero(self):
        assert _hms_to_ms("0:00") == 0

    def test_unparsable_returns_zero(self):
        # Documented tolerant fallback - characterized, not changed.
        assert _hms_to_ms("not-a-time") == 0

    def test_empty_returns_zero(self):
        assert _hms_to_ms("") == 0

    def test_partial_non_numeric_returns_zero(self):
        assert _hms_to_ms("1:xx:03") == 0


class TestMemberOffsets:
    def test_empty(self):
        assert _member_offsets([]) == []

    def test_single_member_zero_offset_no_gap(self):
        assert _member_offsets([(BASE, 60_000)]) == [(0, 0)]

    def test_offsets_accumulate_prior_durations(self):
        members = [(BASE, 60_000), (BASE + timedelta(minutes=1), 30_000), (BASE + timedelta(minutes=2), 10_000)]
        offsets = [off for off, _ in _member_offsets(members)]
        assert offsets == [0, 60_000, 90_000]

    def test_gap_is_real_time_silence_between_recordings(self):
        # Second recording starts 2 min after the first began, first is 1 min long
        # -> 1 min real-time gap between them.
        members = [(BASE, 60_000), (BASE + timedelta(minutes=2), 30_000)]
        gaps = [gap for _, gap in _member_offsets(members)]
        assert gaps == [0, 60_000]

    def test_back_to_back_recordings_have_zero_gap(self):
        members = [(BASE, 60_000), (BASE + timedelta(minutes=1), 30_000)]
        gaps = [gap for _, gap in _member_offsets(members)]
        assert gaps == [0, 0]

    def test_overlapping_recordings_clamp_gap_to_zero(self):
        # Second starts before the first ends -> negative raw gap, clamped at 0.
        members = [(BASE, 120_000), (BASE + timedelta(minutes=1), 30_000)]
        gaps = [gap for _, gap in _member_offsets(members)]
        assert gaps == [0, 0]


class TestRetimeTimelineEntries:
    def test_empty(self):
        assert _retime_timeline_entries([], 5_000) == []

    def test_adds_local_and_abs_ms(self):
        entries = _retime_timeline_entries(
            [{"start_hms": "0:10", "end_hms": "0:20", "text": "hi"}], 60_000
        )
        assert entries == [{
            "start_hms": "0:10",
            "end_hms": "0:20",
            "text": "hi",
            "local_ms": 10_000,
            "abs_ms": 70_000,
        }]

    def test_missing_fields_default_to_blank_and_zero(self):
        entries = _retime_timeline_entries([{}], 5_000)
        assert entries == [{
            "start_hms": "",
            "end_hms": "",
            "text": "",
            "local_ms": 0,
            "abs_ms": 5_000,
        }]

    def test_zero_offset_leaves_abs_equal_local(self):
        entries = _retime_timeline_entries([{"start_hms": "1:00"}], 0)
        assert entries[0]["local_ms"] == 60_000
        assert entries[0]["abs_ms"] == 60_000
