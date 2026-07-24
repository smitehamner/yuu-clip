"""web/analyze_job.py - the reattachable analyze job's replay buffer.

Driven directly on a constructed AnalyzeJob / _replay_events - no server, no
subprocess. The buffer holds typed event dicts (jobevents log_payload /
progress_payload), so replay selection is by field access, not prose re-parsing.
Previously only reachable indirectly via tests/integration/test_reattach.py's
client + subprocess mocks."""
from __future__ import annotations

import asyncio

from yuu_clip.web.jobevents import log_payload, progress_payload


def _log(text):
    return log_payload(text)


# ---------------------------------------------------------------------------
# _replay_events
# ---------------------------------------------------------------------------

class TestReplayEvents:
    def _marker(self, stage, done=None, total=None):
        return progress_payload(stage, done=done, total=total)

    def _replay(self, buffer):
        from yuu_clip.web.analyze_job import _replay_events
        return _replay_events(buffer)

    def test_empty_buffer_replays_empty(self):
        assert self._replay([]) == []

    def test_short_plain_buffer_replays_in_full(self):
        buffer = [_log(f"line {i}") for i in range(5)]
        assert self._replay(buffer) == buffer

    def test_long_plain_buffer_replays_only_the_tail(self):
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES
        buffer = [_log(f"line {i}") for i in range(_REPLAY_TAIL_LINES + 20)]
        assert self._replay(buffer) == buffer[-_REPLAY_TAIL_LINES:]

    def test_old_marker_outside_the_tail_is_still_included(self):
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES
        marker = self._marker("extract", done=1, total=2)
        buffer = [marker] + [_log(f"line {i}") for i in range(_REPLAY_TAIL_LINES + 20)]
        replay = self._replay(buffer)
        assert marker in replay
        assert replay == [marker] + buffer[-_REPLAY_TAIL_LINES:]

    def test_marker_already_inside_the_tail_is_not_duplicated(self):
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES
        marker = self._marker("extract", done=1, total=2)
        buffer = [_log(f"line {i}") for i in range(5)] + [marker]
        assert len(buffer) <= _REPLAY_TAIL_LINES
        replay = self._replay(buffer)
        assert replay == buffer
        assert replay.count(marker) == 1

    def test_only_the_latest_marker_per_stage_is_kept(self):
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES
        old_marker = self._marker("extract", done=1, total=10)
        new_marker = self._marker("extract", done=5, total=10)
        buffer = [old_marker, new_marker] + [_log(f"line {i}") for i in range(_REPLAY_TAIL_LINES + 20)]
        replay = self._replay(buffer)
        assert old_marker not in replay
        assert new_marker in replay
        assert replay.count(new_marker) == 1

    def test_one_marker_kept_per_distinct_stage(self):
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES
        extract_marker = self._marker("extract", done=1, total=1)
        transcribe_marker = self._marker("transcribe", done=1, total=1)
        buffer = [extract_marker, transcribe_marker] + [_log(f"line {i}") for i in range(_REPLAY_TAIL_LINES + 20)]
        replay = self._replay(buffer)
        assert extract_marker in replay
        assert transcribe_marker in replay

    def test_markers_kept_in_original_buffer_order(self):
        from yuu_clip.web.analyze_job import _REPLAY_TAIL_LINES
        extract_marker = self._marker("extract", done=1, total=1)
        transcribe_marker = self._marker("transcribe", done=1, total=1)
        # transcribe appears earlier in the buffer than extract
        buffer = [transcribe_marker, extract_marker] + [_log(f"line {i}") for i in range(_REPLAY_TAIL_LINES + 20)]
        replay = self._replay(buffer)
        assert replay.index(transcribe_marker) < replay.index(extract_marker)


# ---------------------------------------------------------------------------
# AnalyzeJob._emit - buffer bounding + subscriber broadcast
# ---------------------------------------------------------------------------

class TestAnalyzeJobEmit:
    def _job(self, tmp_path):
        from yuu_clip.web.analyze_job import AnalyzeJob
        return AnalyzeJob(cmd=["true"], cwd=tmp_path)

    def test_lines_within_cap_are_all_kept(self, tmp_path):
        job = self._job(tmp_path)
        for i in range(10):
            job._emit(_log(f"line {i}"))
        assert job.buffer == [_log(f"line {i}") for i in range(10)]

    def test_buffer_trimmed_to_cap_when_exceeded(self, tmp_path, monkeypatch):
        import yuu_clip.web.analyze_job as analyze_job_mod
        monkeypatch.setattr(analyze_job_mod, "_MAX_BUFFER_LINES", 5)
        job = self._job(tmp_path)
        for i in range(8):
            job._emit(_log(f"line {i}"))
        assert len(job.buffer) == 5
        assert job.buffer == [_log(f"line {i}") for i in range(3, 8)]  # oldest 3 dropped

    def test_emitted_line_broadcast_to_subscriber_queues(self, tmp_path):
        job = self._job(tmp_path)
        queue: asyncio.Queue = asyncio.Queue()
        job.subscribers.add(queue)
        job._emit(_log("hello"))
        assert queue.get_nowait() == _log("hello")

    def test_emit_with_no_subscribers_does_not_raise(self, tmp_path):
        job = self._job(tmp_path)
        job._emit(_log("no one is listening"))  # must not raise
        assert job.buffer == [_log("no one is listening")]
