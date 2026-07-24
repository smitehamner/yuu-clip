"""
Server-Sent Events helper for streaming subprocess output to the browser.

All long-running pipeline operations (ingest, score, export, demo, retranscribe)
are launched as subprocesses. Their combined stdout+stderr is forwarded as SSE
so the browser can display live progress without polling.

``subprocess_sse`` is the typed-protocol emitter: it translates each child stdout
line into a typed job event (an ``@@PROGRESS`` marker into a ``progress`` event,
every other line into a ``log`` event) and ends with exactly one ``done`` event
carrying the outcome (``ok`` / ``error`` / ``cancelled``). See
``yuu_clip/web/jobevents.py`` for the wire vocabulary. The legacy ``__DONE__``
sentinel helper below is retained only for the hand-rolled route generators not
yet converted (migration stage 2). Lines are also forwarded to the application
log so they appear in the exported debug log.
"""
from __future__ import annotations

import asyncio
import json
import os
import signal
import subprocess
import sys
from pathlib import Path
from typing import AsyncGenerator

from fastapi.responses import StreamingResponse

from yuu_clip.log import get_logger
from yuu_clip.pipeline.progress import parse_progress
from yuu_clip.web.jobevents import (
    OUTCOME_CANCELLED,
    OUTCOME_ERROR,
    OUTCOME_OK,
    done_event,
    log_event,
    progress_event,
)

_log = get_logger(__name__)
_SSE_DONE_SENTINEL = "__DONE__"


def sse_event(payload) -> str:
    """One SSE ``data:`` frame: JSON-encode *payload* and wrap it in the
    ``data: <json>\\n\\n`` envelope. The single definition of the SSE line
    contract shared by the hand-rolled route generators still on the legacy
    wire (converted route by route in migration stage 2)."""
    return f"data: {json.dumps(payload)}\n\n"


def _done_event(*, ok: bool = True, error: str = "") -> str:
    """The legacy terminal SSE completion payload (two-form ``__DONE__`` sentinel).

    Retained only for the hand-rolled route generators not yet converted to the
    typed protocol (``routes/videos.py`` waveform/preview). The two central
    emitters - ``subprocess_sse`` and ``AnalyzeJob`` - now end with a typed
    ``done_event(outcome)`` instead. Removed in migration stage 4 once every
    hand-rolled route speaks the typed wire.
    """
    if ok:
        return sse_event(_SSE_DONE_SENTINEL)
    return sse_event({"type": _SSE_DONE_SENTINEL, "ok": False, "error": error})


def new_session_kwargs() -> dict:
    """Launch kwargs that isolate a subprocess so its whole tree can be killed.

    The analyze CLI shells out to ffmpeg/ffprobe grandchildren; a bare
    ``terminate()`` reaches only the direct child. On POSIX ``start_new_session``
    makes the child a process-group leader (pgid == pid), which
    ``terminate_process_tree`` relies on to ``killpg`` the whole group. On Windows
    the tree is walked by pid via ``taskkill /T``, so no launch-time flag is
    needed. Every subprocess launch whose proc is later passed to
    ``terminate_process_tree`` must splat this in.
    """
    return {} if sys.platform == "win32" else {"start_new_session": True}


def _run_taskkill(pid: int) -> None:
    subprocess.run(
        ["taskkill", "/F", "/T", "/PID", str(pid)],
        capture_output=True, check=False, timeout=10,
    )


def terminate_process_tree(proc) -> None:
    """Terminate *proc* and every descendant it spawned.

    The analyze CLI subprocess shells out to ffmpeg/ffprobe children. A plain
    ``proc.terminate()`` signals only the direct child, so an in-flight ffmpeg
    grandchild is orphaned and keeps running after a cancel. On Windows
    ``taskkill /T`` kills the whole tree by pid. On POSIX the child is launched
    with ``start_new_session=True`` (see ``new_session_kwargs``) so it leads its
    own process group, and we signal the whole group with ``killpg``. Callers
    still ``await proc.wait()`` afterwards to reap the child.

    Synchronous: safe from a sync caller, but blocks on the Windows ``taskkill``.
    Async callers on the event loop should use ``terminate_process_tree_async``.
    """
    if proc is None or proc.returncode is not None:
        return
    if sys.platform == "win32":
        try:
            _run_taskkill(proc.pid)
            return
        except Exception as exc:
            _log.warning("taskkill failed for pid %s (%s) - falling back to terminate()", proc.pid, exc)
    else:
        # Only killpg when the child actually leads its own group (pgid == pid).
        # A proc launched without start_new_session shares the server's group, so
        # this guard makes it impossible to ever signal the server's own group.
        try:
            if os.getpgid(proc.pid) == proc.pid:
                os.killpg(proc.pid, signal.SIGTERM)
                return
        except OSError as exc:
            _log.debug("killpg failed for pid %s (%s) - falling back to terminate()", proc.pid, exc)
    proc.terminate()


async def terminate_process_tree_async(proc) -> None:
    """Async wrapper for ``terminate_process_tree`` that never blocks the loop.

    On Windows the kill is a synchronous ``taskkill`` that can take up to its 10 s
    timeout if it wedges; running it inline on the event loop stalls every other
    request (``/api/status`` polls, other SSE streams) - worst at a user-initiated
    cancel, when the app would look hung. Offload just that blocking call to a
    thread. The POSIX ``killpg`` branch is a non-blocking signal, so it stays inline.
    """
    if proc is None or proc.returncode is not None:
        return
    if sys.platform == "win32":
        try:
            await asyncio.to_thread(_run_taskkill, proc.pid)
            return
        except Exception as exc:
            _log.warning("taskkill failed for pid %s (%s) - falling back to terminate()", proc.pid, exc)
        proc.terminate()
        return
    terminate_process_tree(proc)


def consuming_subprocess_env(ctx) -> dict[str, str]:
    """Environment for a subprocess launched with a ProjectContext.

    Passing a ctx marks the job as one that CONSUMES models (analyze, score, export,
    retranscribe, rediarize, reel), so once the models are cached it inherits
    HuggingFace offline mode - no per-load Hub round-trip and no HF_TOKEN warning in
    the UI log. The model download/prefetch routes deliberately pass no ctx, so they
    stay online and can still fetch; keep it that way when adding one.
    """
    env = dict(os.environ)
    config = getattr(ctx, "config", None)  # absent on the tests' lightweight ctx doubles
    if config is not None:
        from yuu_clip.hf_cache import hf_offline_env
        env.update(hf_offline_env(config))
    return env


def release_counted_job(ctx, proc) -> None:
    """Idempotently drop *proc*'s ``active_jobs`` slot.

    Both the subprocess_sse stream's own ``finally`` and the cancel endpoint call
    this for the same proc; membership in ``ctx.counted_procs`` gates the decrement
    so whichever runs first releases the slot and the second is a harmless no-op -
    the counter can never latch high (cancel didn't wait on GC) or go negative
    (the late generator finalization didn't double-decrement).
    """
    if proc is not None and proc in ctx.counted_procs:
        ctx.counted_procs.discard(proc)
        ctx.active_jobs -= 1


async def subprocess_sse(
    cmd: list[str],
    cwd: Path,
    ctx=None,
    *,
    clear_cmd_attr: str | None = None,
    track_active_job: bool = False,
    job_kind: str | None = None,
) -> StreamingResponse:
    """Run *cmd* as a subprocess and stream its stdout as an SSE response.

    If *ctx* is a ProjectContext, the running process is stored on
    ``ctx.analyze_proc`` so it can be terminated via the cancel endpoint.

    *job_kind* names this job on ``ctx.analyze_proc_kind`` (e.g. ``"import"``,
    ``"frames"``) so a job-specific cancel endpoint can confirm it's about to
    kill its own job rather than whatever unrelated job currently holds the
    shared slot. Callers with no job-specific cancel endpoint (score, export,
    retranscribe, demo - all reachable only via the generic /api/analyze/cancel)
    can omit it.

    A user-initiated cancel is signalled by a cancel endpoint adding this run's
    proc to ``ctx.cancelled_procs``; on exit the tail below reports
    ``outcome="cancelled"`` instead of the generic error. Membership is keyed to
    the proc instance, so a stale entry from an earlier job can never leak a
    cancel into an unrelated one - every subprocess job can carry a typed cancel.

    *clear_cmd_attr* names the ``ctx`` attribute to set to ``None`` when the
    stream finishes (e.g. ``'analyze_cmd'`` or ``'demo_cmd'``). Callers that
    own no queued-command slot (score, export, retranscribe) omit it.

    *track_active_job* increments ``ctx.active_jobs`` for the run's duration -
    the same counter the in-process SSE jobs (rescore, timeline, summarize) use
    - so ``/api/status``'s ``any_running`` reflects this job too. Opt-in: most
    subprocess_sse callers are already reflected via ``ctx.analyze_proc``
    (misleadingly under the "analyze" name), so this only needs to be set where
    a distinct, correctly-named running flag matters (e.g. URL import's
    ``import_running``).
    """

    async def _generate() -> AsyncGenerator[str, None]:
        proc = None
        try:
            _log.debug("Launching subprocess: %s", " ".join(str(c) for c in cmd))
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(cwd),
                env=consuming_subprocess_env(ctx),
                **new_session_kwargs(),
            )
            assert proc.stdout
            _log.info("Subprocess started (pid %s): %s", proc.pid, cmd[3] if len(cmd) > 3 else cmd[0])
            if ctx is not None:
                ctx.analyze_proc = proc
                ctx.analyze_proc_kind = job_kind
                ctx.subprocess_procs.add(proc)
                # Counted only once the proc exists and is registered, so the cancel
                # endpoint can release this exact proc's slot idempotently.
                if track_active_job:
                    ctx.counted_procs.add(proc)
                    ctx.active_jobs += 1
            try:
                async for raw_line in proc.stdout:
                    text = raw_line.decode("utf-8", errors="replace").rstrip()
                    _log.debug("[subprocess] %s", text)
                    # Translate the child's prose+marker stdout into the typed wire:
                    # an @@PROGRESS marker becomes a progress event (never ALSO a log
                    # twin - the client fallback then simply never matches), every
                    # other line a log event. See the design's double-emission note.
                    marker = parse_progress(text)
                    if marker is not None:
                        yield progress_event(
                            marker["stage"], done=marker.get("done"),
                            total=marker.get("total"), label=marker.get("label"),
                        )
                    else:
                        yield log_event(text)
                await proc.wait()
                outcome = OUTCOME_OK
                error = ""
                if ctx is not None and proc in ctx.cancelled_procs:
                    ctx.cancelled_procs.discard(proc)
                    _log.info("Subprocess (pid %s) cancelled by user", proc.pid)
                    outcome = OUTCOME_CANCELLED
                elif proc.returncode != 0:
                    _log.error(
                        "Subprocess exited with code %d: %s",
                        proc.returncode,
                        " ".join(str(c) for c in cmd),
                    )
                    yield log_event(f"[Error: subprocess exited with code {proc.returncode}]", level="error")
                    outcome = OUTCOME_ERROR
                    error = "This job did not finish - check the log for details."
                else:
                    _log.info("Subprocess (pid %s) completed successfully", proc.pid)
                yield done_event(outcome, error=error)
            finally:
                if proc.returncode is None:
                    await terminate_process_tree_async(proc)
                    await proc.wait()
                if ctx is not None:
                    ctx.subprocess_procs.discard(proc)
                    # Drop any cancel marker for this proc even when the tail's
                    # on-read discard did not run - an abandoned stream (client
                    # closed on cancel) is finalized here on GC, so this is what
                    # keeps cancelled_procs from growing unbounded.
                    ctx.cancelled_procs.discard(proc)
                    # Only clear the shared slot if it still points at *this* proc;
                    # an overlapping job may have already claimed it (see deps.py).
                    if ctx.analyze_proc is proc:
                        ctx.analyze_proc = None
                        ctx.analyze_proc_kind = None
                    if clear_cmd_attr is not None:
                        setattr(ctx, clear_cmd_attr, None)
        except Exception:
            # A failed launch (bad executable / ENOENT on sys.executable / OS limit)
            # or a mid-stream error would otherwise abort the async generator with no
            # payload: the browser's reader sees the stream die with no error line and
            # no __DONE__, so endJobUI never runs and the job pill sticks. Mirror
            # AnalyzeJob._pump - log it and emit an error line + the done sentinel.
            _log.exception("Subprocess stream failed: %s", " ".join(str(c) for c in cmd))
            yield log_event("[Error: could not start subprocess]", level="error")
            yield done_event(OUTCOME_ERROR, error="This job could not start - check the log for details.")
        finally:
            if track_active_job and ctx is not None:
                release_counted_job(ctx, proc)

    return StreamingResponse(_generate(), media_type="text/event-stream")
