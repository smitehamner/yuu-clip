"""Session auto-grouping: infer which recordings belong to one play session.

Pure logic (no DB, no I/O) so it is trivially unit-testable. The web layer
builds SessionCandidate rows from Video records and calls suggest_session_groups.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

# Recordings within this gap (previous recording's end → next recording's start)
# are treated as one session. A hard constant, not a user setting (locked decision).
SESSION_GAP = timedelta(minutes=30)

# OBS default "Recording Filename Formatting": YYYY-MM-DD HH-MM-SS. Accept a space
# or underscore between date and time, and allow surrounding text in the stem.
_OBS_STAMP_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})[ _](\d{2})-(\d{2})-(\d{2})")


@dataclass(frozen=True)
class SessionCandidate:
    """One recording as far as grouping is concerned: an id, when it started,
    and how long it ran. start_time is real-world wall-clock, not a DB insert time."""
    id: int
    start_time: datetime
    duration_ms: int


def parse_obs_start_time(filename: str) -> Optional[datetime]:
    """Parse an OBS-style recording start time from a filename, or None if absent."""
    match = _OBS_STAMP_RE.search(filename)
    if not match:
        return None
    year, month, day, hour, minute, second = (int(g) for g in match.groups())
    try:
        return datetime(year, month, day, hour, minute, second)
    except ValueError:
        return None


def recording_start_time(filename: str, mtime: float, duration_ms: int) -> datetime:
    """Best estimate of a recording's real start time.

    Prefer the OBS timestamp in the filename; otherwise fall back to the file's
    modification time (≈ when recording stopped) minus its duration.
    """
    parsed = parse_obs_start_time(filename)
    if parsed is not None:
        return parsed
    return datetime.fromtimestamp(mtime) - timedelta(milliseconds=duration_ms or 0)


def suggest_session_groups(candidates: list[SessionCandidate]) -> list[list[int]]:
    """Group recordings whose consecutive gap is under SESSION_GAP.

    Orders by start time, then greedily extends a run while the gap between the
    previous recording's end and the next one's start is under the threshold.
    Only groups of two or more recordings are returned - a lone recording is
    never a "session" worth suggesting.
    """
    ordered = sorted(candidates, key=lambda c: c.start_time)
    groups: list[list[SessionCandidate]] = []
    for candidate in ordered:
        if groups:
            previous = groups[-1][-1]
            previous_end = previous.start_time + timedelta(milliseconds=previous.duration_ms or 0)
            if candidate.start_time - previous_end < SESSION_GAP:
                groups[-1].append(candidate)
                continue
        groups.append([candidate])
    return [[c.id for c in group] for group in groups if len(group) >= 2]
