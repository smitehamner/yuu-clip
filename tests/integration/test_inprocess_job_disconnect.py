"""Client-disconnect releases the in-process job counter.

The in-process (event-loop) LLM/scoring jobs - timeline, summarize, rescore-all,
find-similar, ... - run their work inside ``async with active_job(ctx)`` on an SSE
``StreamingResponse``. PROGRESS-CANCEL-GAP-2026-07-20 Part B option 1 (soft cancel
via client disconnect) relies on the fact that when the browser aborts the fetch,
the server cancels the streaming task, unwinds the ``active_job`` context, and frees
the counter - so ``/api/status`` ``any_running`` goes back to false with no explicit
cancel endpoint. This test guards that assumption at the SSE-teardown seam: it drives
the ``sse_response`` StreamingResponse through the ASGI interface and injects an
``http.disconnect`` mid-stream, then asserts the counter was 1 while streaming and is
released back to 0 after the disconnect.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

from yuu_clip.web.routes.common import active_job, sse_response


async def test_client_disconnect_midstream_releases_active_job_counter():
    ctx = SimpleNamespace(active_jobs=0)
    counter_at_first_chunk = None

    async def gen():
        async with active_job(ctx):
            yield 'data: "hi"\n\n'
            # Never completes on its own: only a client disconnect (cancelling this
            # task) ends the stream, exactly like a long LLM job the user aborts.
            await asyncio.Event().wait()
            yield 'data: "__DONE__"\n\n'  # unreachable

    response = sse_response(gen())
    first_chunk_sent = asyncio.Event()

    async def receive():
        # Starlette's StreamingResponse awaits receive() for http.disconnect; hold off
        # until the first body chunk has streamed so the job is genuinely mid-stream.
        await first_chunk_sent.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        nonlocal counter_at_first_chunk
        if message["type"] == "http.response.body" and message.get("body"):
            counter_at_first_chunk = ctx.active_jobs
            first_chunk_sent.set()

    scope = {"type": "http", "http_version": "1.1", "method": "GET", "headers": [], "path": "/"}
    await response(scope, receive, send)

    assert counter_at_first_chunk == 1, "job must be counted while the stream is live"
    assert ctx.active_jobs == 0, "disconnect must run active_job's finally and release the counter"


async def test_full_drain_releases_active_job_counter():
    """Baseline: a stream that reaches __DONE__ on its own also returns the counter to 0."""
    ctx = SimpleNamespace(active_jobs=0)
    peak = 0

    async def gen():
        nonlocal peak
        async with active_job(ctx):
            peak = ctx.active_jobs
            yield 'data: "hi"\n\n'
            yield 'data: "__DONE__"\n\n'

    response = sse_response(gen())

    async def receive():
        # No disconnect: block forever so listen_for_disconnect never wins the race;
        # stream_response finishes on its own and cancels the disconnect listener.
        await asyncio.Event().wait()

    async def send(message):  # noqa: ARG001 - drain and discard
        return

    scope = {"type": "http", "http_version": "1.1", "method": "GET", "headers": [], "path": "/"}
    await response(scope, receive, send)

    assert peak == 1
    assert ctx.active_jobs == 0
