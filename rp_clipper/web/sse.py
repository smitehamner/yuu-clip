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
from pathlib import Path
from typing import AsyncGenerator

from fastapi.responses import StreamingResponse

from rp_clipper.log import get_logger

_log = get_logger(__name__)
_SSE_DONE_SENTINEL = "__DONE__"


async def subprocess_sse(cmd: list[str], cwd: Path) -> StreamingResponse:
    """Run *cmd* as a subprocess and stream its stdout as an SSE response."""

    async def _generate() -> AsyncGenerator[str, None]:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(cwd),
        )
        assert proc.stdout
        async for raw_line in proc.stdout:
            text = raw_line.decode("utf-8", errors="replace").rstrip()
            _log.info("[subprocess] %s", text)
            yield f"data: {json.dumps(text)}\n\n"
        await proc.wait()
        if proc.returncode != 0:
            _log.error(
                "Subprocess exited with code %d: %s",
                proc.returncode,
                " ".join(str(c) for c in cmd),
            )
        yield f"data: {json.dumps(_SSE_DONE_SENTINEL)}\n\n"

    return StreamingResponse(_generate(), media_type="text/event-stream")
