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
import json
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi.responses import StreamingResponse

from yuu_clip.log import get_logger
from yuu_clip.web.sse import (
    _SSE_DONE_SENTINEL,
    new_session_kwargs,
    terminate_process_tree_async,
)

_log = get_logger(__name__)

# Per-subscriber sentinel signalling "the job finished, close this stream".
# Distinct from the wire-level _SSE_DONE_SENTINEL sent to the browser.
_QUEUE_DONE = object()

# Cap on the replay buffer. A reattaching page replays the whole buffer up front; an
# unbounded one (e.g. a run that logged tens of thousands of lines) makes that replay
# so large the browser's fetch reader can throw mid-stream, breaking the reconnect.
# Generous enough that a normal run keeps all its stage headers - the real defence is
# not emitting spam in the first place (llama.cpp verbose off, speaker consolidation).
_MAX_BUFFER_LINES = 5000


class AnalyzeJob:
    """A running analyze subprocess whose output is broadcast to live and
    reconnecting SSE clients."""

    def __init__(self, cmd: list[str], cwd: Path, *, filename: Optional[str] = None,
                 video_id: Optional[int] = None) -> None:
        self.cmd = cmd
        self.cwd = cwd
        self.filename = filename
        self.video_id = video_id
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.buffer: list[str] = []
        self.subscribers: set[asyncio.Queue] = set()
        self.done = False
        self.cancelled = False
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
            **new_session_kwargs(),
        )
        _log.info("Analyze subprocess started (pid %s): %s", self.proc.pid, self.filename or self.cmd)
        self._pump_task = asyncio.create_task(self._pump())

    async def _pump(self) -> None:
        assert self.proc and self.proc.stdout
        job_desc = f"pid={self.proc.pid} filename={self.filename!r} video_id={self.video_id}"
        try:
            async for raw_line in self.proc.stdout:
                self._emit(raw_line.decode("utf-8", errors="replace").rstrip())
            await self.proc.wait()
            self.returncode = self.proc.returncode
            if self.cancelled:
                _log.info("Analyze subprocess cancelled by user (%s)", job_desc)
                self._emit("[Analysis cancelled]")
            elif self.returncode != 0:
                _log.error("Analyze subprocess exited with code %d (%s)", self.returncode, job_desc)
                self._emit(f"[Error: subprocess exited with code {self.returncode}]")
            else:
                _log.info("Analyze subprocess completed successfully (%s)", job_desc)
        except Exception:
            _log.exception("Analyze output pump failed (%s)", job_desc)
            self._emit("[Error: analysis output stream failed]")
        finally:
            self.done = True
            if self._thermal_task is not None:
                self._thermal_task.cancel()
            for queue in self.subscribers:
                queue.put_nowait(_QUEUE_DONE)

    def _emit(self, text: str) -> None:
        self.buffer.append(text)
        if len(self.buffer) > _MAX_BUFFER_LINES:
            # Drop the oldest lines; keep the buffer (and therefore the reconnect
            # replay) bounded. Live subscribers already received them.
            del self.buffer[: len(self.buffer) - _MAX_BUFFER_LINES]
        for queue in self.subscribers:
            queue.put_nowait(text)

    async def cancel(self) -> None:
        self.cancelled = True
        await terminate_process_tree_async(self.proc)

    def sse_response(self) -> StreamingResponse:
        return StreamingResponse(self._stream(), media_type="text/event-stream")

    async def _stream(self) -> AsyncGenerator[str, None]:
        # Snapshot the buffer and register as a subscriber atomically - no await
        # between the two lines means the pump cannot interleave, so every line is
        # delivered exactly once (replayed OR queued, never both, never dropped).
        queue: asyncio.Queue = asyncio.Queue()
        replay = list(self.buffer)
        already_done = self.done
        if not already_done:
            self.subscribers.add(queue)
        try:
            for line in replay:
                yield f"data: {json.dumps(line)}\n\n"
            if already_done:
                yield f"data: {json.dumps(_SSE_DONE_SENTINEL)}\n\n"
                return
            while True:
                item = await queue.get()
                if item is _QUEUE_DONE:
                    yield f"data: {json.dumps(_SSE_DONE_SENTINEL)}\n\n"
                    return
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            self.subscribers.discard(queue)
