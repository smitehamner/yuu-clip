"""
Reattachable analyze job - decouples the analyze subprocess from the HTTP stream.

The analyze subprocess is launched once and its stdout is pumped into an
in-memory broadcast buffer. Any number of SSE clients can attach (and reattach,
e.g. after a browser refresh): each first replays everything emitted so far,
then continues live. The subprocess is terminated ONLY on an explicit cancel or
on server shutdown - never when an SSE client disconnects. This is what lets a
running analysis survive a page refresh.

Contrast with sse.subprocess_sse (used by score/export/retranscribe/install):
those short jobs are tied to their single stream and are killed on disconnect.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi.responses import StreamingResponse

from yuu_clip.log import get_logger
from yuu_clip.pipeline.progress import parse_progress
from yuu_clip.web.jobevents import (
    EVENT_PROGRESS,
    OUTCOME_CANCELLED,
    OUTCOME_ERROR,
    OUTCOME_OK,
    done_event,
    frame,
    log_payload,
    progress_payload,
)
from yuu_clip.web.sse import (
    new_session_kwargs,
    terminate_process_tree_async,
)

_log = get_logger(__name__)

# Per-subscriber sentinel signalling "the job finished, close this stream".
# In-process only - the wire-level terminal is the typed done event (_done_payload).
_QUEUE_DONE = object()

# Overall retention cap on the in-memory buffer (see _replay_events below for what a
# reconnecting client actually gets replayed, which is far smaller). Still bounded so
# an extreme run can't grow this list forever.
_MAX_BUFFER_LINES = 5000

# How much plain scrollback a fresh reconnect replays, on top of the progress events
# _replay_events always includes. The browser's own log panel caps its DOM to ~500
# lines (utils.js _MAX_LOG_LINES) and the job-step pills are driven entirely off
# progress events, not prose - so a reconnect needs only a handful of recent lines
# for scrollback context, not the whole multi-thousand-line buffer. Keeping this small
# is what avoids a burst of appendLog()+reflow calls (see utils.js's _MAX_LOG_LINES
# comment) every time a page opens or refreshes mid-run.
_REPLAY_TAIL_LINES = 10


def _replay_events(buffer: list[dict]) -> list[dict]:
    """Trim a reconnect's replay to what the client can actually use.

    A fresh SSE connection needs two things to render correctly, not the full
    buffer: the latest progress event per stage (to restore the step pills -
    jobs.js's _activateStep marks every earlier step "done" when a later one
    activates, so only the newest progress event per stage matters, however far
    back it was emitted) and a small tail of ordinary events for scrollback.
    Progress events are never shown as log text, so including old ones costs
    nothing on screen - only the tail size affects visible scrollback.

    The buffer now holds typed event dicts, so this selects by field access
    (``type``/``stage``) rather than re-parsing prose lines.
    """
    tail_start = max(0, len(buffer) - _REPLAY_TAIL_LINES)
    latest_progress_idx: dict[str, int] = {}
    for i, event in enumerate(buffer):
        if event.get("type") == EVENT_PROGRESS:
            latest_progress_idx[event["stage"]] = i
    progress_indices = sorted(idx for idx in latest_progress_idx.values() if idx < tail_start)
    return [buffer[i] for i in progress_indices] + buffer[tail_start:]


class AnalyzeJob:
    """A running analyze subprocess whose output is broadcast to live and
    reconnecting SSE clients."""

    def __init__(self, cmd: list[str], cwd: Path, *, filename: Optional[str] = None,
                 video_id: Optional[int] = None, env: Optional[dict] = None) -> None:
        self.cmd = cmd
        self.cwd = cwd
        # Overlaid on the parent environment at spawn (see sse.consuming_subprocess_env):
        # carries HuggingFace offline mode once the models are cached.
        self.env = env
        self.filename = filename
        self.video_id = video_id
        self.proc: Optional[asyncio.subprocess.Process] = None
        # Typed event-payload dicts (jobevents log_payload/progress_payload), framed
        # only at stream time. See _replay_events for what a reconnect actually gets.
        self.buffer: list[dict] = []
        self.subscribers: set[asyncio.Queue] = set()
        self.done = False
        self.cancelled = False
        # Drives the terminal SSE sentinel's ok flag. A user cancel is deliberately NOT
        # a failure (it keeps the plain sentinel, matching subprocess_sse's cancel
        # branch); a non-zero exit or a broken output pump is.
        self.failed = False
        self.returncode: Optional[int] = None
        self._pump_task: Optional[asyncio.Task] = None
        # Set/cleared by POST /api/analyze/pause|resume - mirrors the pause flag
        # file's existence so /api/status can report state without a filesystem
        # check on every poll.
        self.pause_requested = False
        # GPU thermal monitoring - set by the poll task started in
        # /api/analyze/events (web/routes/analyze.py::_thermal_poll_loop) and read
        # by /api/status. thermal_trigger holds this run's ThermalTrigger so a
        # resume can call note_resumed() for auto-pause hysteresis.
        self.gpu_temp_c: Optional[float] = None
        self.gpu_state: str = "unavailable"
        self.thermal_trigger = None
        self._thermal_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        self.proc = await asyncio.create_subprocess_exec(
            *self.cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(self.cwd),
            env=self.env,
            **new_session_kwargs(),
        )
        _log.info("Analyze subprocess started (pid %s): %s", self.proc.pid, self.filename or self.cmd)
        self._pump_task = asyncio.create_task(self._pump())

    async def _pump(self) -> None:
        assert self.proc and self.proc.stdout
        job_desc = f"pid={self.proc.pid} filename={self.filename!r} video_id={self.video_id}"
        try:
            async for raw_line in self.proc.stdout:
                line = raw_line.decode("utf-8", errors="replace").rstrip()
                # Same prose+marker -> typed-event translation as subprocess_sse:
                # a marker becomes a progress event (never also a log twin), every
                # other line a log event.
                marker = parse_progress(line)
                self._emit(
                    progress_payload(
                        marker["stage"], done=marker.get("done"),
                        total=marker.get("total"), label=marker.get("label"),
                    )
                    if marker is not None
                    else log_payload(line)
                )
            await self.proc.wait()
            self.returncode = self.proc.returncode
            if self.cancelled:
                # A user cancel is carried by the terminal done event's outcome
                # (see _done_payload), not a prose line - the client also appends
                # its own immediate "[Analysis cancelled]" for UX.
                _log.info("Analyze subprocess cancelled by user (%s)", job_desc)
            elif self.returncode != 0:
                _log.error("Analyze subprocess exited with code %d (%s)", self.returncode, job_desc)
                self.failed = True
                self._emit(log_payload(f"[Error: subprocess exited with code {self.returncode}]", level="error"))
            else:
                _log.info("Analyze subprocess completed successfully (%s)", job_desc)
        except Exception:
            _log.exception("Analyze output pump failed (%s)", job_desc)
            self.failed = True
            self._emit(log_payload("[Error: analysis output stream failed]", level="error"))
        finally:
            self.done = True
            if self._thermal_task is not None:
                self._thermal_task.cancel()
            for queue in self.subscribers:
                queue.put_nowait(_QUEUE_DONE)

    def _emit(self, event: dict) -> None:
        self.buffer.append(event)
        if len(self.buffer) > _MAX_BUFFER_LINES:
            # Drop the oldest events; keep the buffer (and therefore the reconnect
            # replay) bounded. Live subscribers already received them.
            del self.buffer[: len(self.buffer) - _MAX_BUFFER_LINES]
        for queue in self.subscribers:
            queue.put_nowait(event)

    async def cancel(self) -> None:
        self.cancelled = True
        await terminate_process_tree_async(self.proc)

    def sse_response(self) -> StreamingResponse:
        return StreamingResponse(self._stream(), media_type="text/event-stream")

    def _done_payload(self) -> str:
        """The terminal typed ``done`` frame for every subscriber, live or reattached.

        Shares jobevents.done_event with the subprocess_sse jobs so both families
        speak one wire format, decoded in exactly one place (core/jobevents.js).
        A user cancel is first-class (outcome ``cancelled``), no longer conflated
        with success; a non-zero exit or broken pump is ``error``.
        """
        if self.cancelled:
            return done_event(OUTCOME_CANCELLED)
        if self.failed:
            return done_event(
                OUTCOME_ERROR,
                error="The analysis did not finish - check the log for details.",
            )
        return done_event(OUTCOME_OK)

    async def _stream(self) -> AsyncGenerator[str, None]:
        # Snapshot the buffer and register as a subscriber atomically - no await
        # between the two lines means the pump cannot interleave, so every line is
        # delivered exactly once (replayed OR queued, never both, never dropped).
        queue: asyncio.Queue = asyncio.Queue()
        replay = _replay_events(self.buffer)
        already_done = self.done
        if not already_done:
            self.subscribers.add(queue)
        try:
            for event in replay:
                yield frame(event)
            if already_done:
                yield self._done_payload()
                return
            while True:
                item = await queue.get()
                if item is _QUEUE_DONE:
                    yield self._done_payload()
                    return
                yield frame(item)
        finally:
            self.subscribers.discard(queue)
