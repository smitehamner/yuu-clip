"""
Server-Sent Events helper for streaming subprocess output to the browser.

All long-running pipeline operations (ingest, score, export, demo, retranscribe)
are launched as subprocesses. Their combined stdout+stderr is forwarded as SSE
so the browser can display live progress without polling.

Each line is JSON-encoded and sent as::

    data: "the line text"\n\n

A ``"__DONE__"`` sentinel is sent when the process exits. Lines are also
forwarded to the application log so they appear in the exported debug log.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import AsyncGenerator

from fastapi.responses import StreamingResponse

from yuu_clip.log import get_logger

_log = get_logger(__name__)
_SSE_DONE_SENTINEL = "__DONE__"


def terminate_process_tree(proc) -> None:
    """Terminate *proc* and every descendant it spawned.

    The analyze CLI subprocess shells out to ffmpeg/ffprobe children. A plain
    ``proc.terminate()`` signals only the direct child, so on Windows an
    in-flight ffmpeg grandchild is orphaned and keeps running after a cancel.
    ``taskkill /T`` kills the whole tree. Callers still ``await proc.wait()``
    afterwards to reap the child.

    POSIX keeps the existing best-effort ``terminate()`` (the desktop tool is
    Windows-only; group-killing there would need start_new_session at launch).
    """
    if proc is None or proc.returncode is not None:
        return
    if sys.platform == "win32":
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True, check=False, timeout=10,
            )
            return
        except Exception as exc:
            _log.warning("taskkill failed for pid %s (%s) — falling back to terminate()", proc.pid, exc)
    proc.terminate()


async def subprocess_sse(
    cmd: list[str],
    cwd: Path,
    ctx=None,
    *,
    cancel_flag_attr: str | None = None,
    cancel_message: str = "",
    clear_cmd_attr: str | None = None,
    track_active_job: bool = False,
) -> StreamingResponse:
    """Run *cmd* as a subprocess and stream its stdout as an SSE response.

    If *ctx* is a ProjectContext, the running process is stored on
    ``ctx.analyze_proc`` so it can be terminated via the cancel endpoint.

    *cancel_flag_attr* names a boolean ``ctx`` attribute a cancel endpoint sets
    to signal a user-initiated cancel (e.g. ``'import_cancelled'``). When it is
    truthy on exit, the stream emits *cancel_message* instead of the generic
    error line and clears the flag. Jobs with no cancel button (score, export,
    retranscribe, demo) omit it, so a stale flag never leaks a cancel message
    into an unrelated job.

    *clear_cmd_attr* names the ``ctx`` attribute to set to ``None`` when the
    stream finishes (e.g. ``'analyze_cmd'`` or ``'demo_cmd'``). Callers that
    own no queued-command slot (score, export, retranscribe) omit it.

    *track_active_job* increments ``ctx.active_jobs`` for the run's duration —
    the same counter the in-process SSE jobs (rescore, timeline, summarize) use
    — so ``/api/status``'s ``any_running`` reflects this job too. Opt-in: most
    subprocess_sse callers are already reflected via ``ctx.analyze_proc``
    (misleadingly under the "analyze" name), so this only needs to be set where
    a distinct, correctly-named running flag matters (e.g. URL import's
    ``import_running``).
    """

    async def _generate() -> AsyncGenerator[str, None]:
        if track_active_job and ctx is not None:
            ctx.active_jobs += 1
        try:
            _log.debug("Launching subprocess: %s", " ".join(str(c) for c in cmd))
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(cwd),
            )
            assert proc.stdout
            _log.info("Subprocess started (pid %s): %s", proc.pid, cmd[3] if len(cmd) > 3 else cmd[0])
            if ctx is not None:
                ctx.analyze_proc = proc
            try:
                async for raw_line in proc.stdout:
                    text = raw_line.decode("utf-8", errors="replace").rstrip()
                    _log.debug("[subprocess] %s", text)
                    yield f"data: {json.dumps(text)}\n\n"
                await proc.wait()
                if cancel_flag_attr and ctx is not None and getattr(ctx, cancel_flag_attr, False):
                    setattr(ctx, cancel_flag_attr, False)
                    _log.info("Subprocess (pid %s) cancelled by user", proc.pid)
                    yield f"data: {json.dumps(cancel_message)}\n\n"
                elif proc.returncode != 0:
                    _log.error(
                        "Subprocess exited with code %d: %s",
                        proc.returncode,
                        " ".join(str(c) for c in cmd),
                    )
                    yield f"data: {json.dumps(f'[Error: subprocess exited with code {proc.returncode}]')}\n\n"
                else:
                    _log.info("Subprocess (pid %s) completed successfully", proc.pid)
                yield f"data: {json.dumps(_SSE_DONE_SENTINEL)}\n\n"
            finally:
                if proc.returncode is None:
                    terminate_process_tree(proc)
                    await proc.wait()
                if ctx is not None:
                    ctx.analyze_proc = None
                    if clear_cmd_attr is not None:
                        setattr(ctx, clear_cmd_attr, None)
        finally:
            if track_active_job and ctx is not None:
                ctx.active_jobs -= 1

    return StreamingResponse(_generate(), media_type="text/event-stream")
