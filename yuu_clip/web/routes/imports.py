# Feature-map - Import from URL (code: url_import / import-url)
#   UI: static/analyze/analyze.js (New Recording panel → Import from URL)
#   Siblings: url_import.py (yt-dlp download) · tests/unit/test_url_import.py, tests/ui/test_ui_analyze.py
"""Import from URL routes (roadmap plan 08) - Twitch VOD / YouTube downloads.

Follows the same start->events pattern as the highlight reel (routes/reel.py):
the POST endpoint validates the link and queues the CLI download command; the
paired GET endpoint streams that command's stdout as SSE.
"""
from __future__ import annotations

import asyncio
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.config import project_downloads_dir
from yuu_clip.db.models import Video
from yuu_clip.log import get_logger
from yuu_clip.url_import import (
    ImportUrlError,
    inspect_url,
    normalize_import_url,
    validate_import_url,
)
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.jobevents import OUTCOME_ERROR, OUTCOME_OK, done_event, log_event, result_event
from yuu_clip.web.routes.common import active_job, reject_if_busy, sse_response
from yuu_clip.web.sse import subprocess_sse, terminate_process_tree_async

_log = get_logger(__name__)


class ImportUrlRequest(BaseModel):
    url: str


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/import-url/inspect")
    async def inspect(req: ImportUrlRequest):
        """Fetch metadata for a Twitch/YouTube link without downloading it.
        Streamed as SSE - a yt-dlp metadata fetch is a real network call (up to
        yt-dlp's own socket timeout on a slow/flaky link) - so it can show
        progress and be cancelled the same way as the other in-process jobs
        (client-only: aborting the connection unwinds active_job; nothing here
        writes to the DB)."""
        url = normalize_import_url(req.url)
        reject_if_busy(ctx, "Checking link")

        async def event_stream():
            async with active_job(ctx):
                yield log_event('[Checking link…]')
                try:
                    info = await asyncio.to_thread(inspect_url, url)
                except ImportUrlError as e:
                    yield done_event(OUTCOME_ERROR, error=str(e))
                    return
                except Exception as exc:
                    _log.error("URL inspect failed for %s: %s", url, exc, exc_info=True)
                    yield done_event(OUTCOME_ERROR, error=f"Could not check link: {exc}")
                    return

                db = ctx.get_db()
                try:
                    existing = db.query(Video).filter(Video.source_url == url).first()
                finally:
                    db.close()

                yield result_event({
                    **info,
                    "already_imported": existing is not None,
                    "existing_filename": existing.filename if existing else None,
                })
                yield done_event(OUTCOME_OK)

        return sse_response(event_stream())

    @router.post("/api/import-url/start")
    def start(req: ImportUrlRequest):
        """Validate the link and queue the download command for the SSE stream.

        Rejects while another job (including an already-running URL import) is in
        flight - without this, a second start silently overwrote ctx.import_cmd
        while the first download was still active, and the frontend's own
        streamSSE() would then unconditionally supersede/abort the first job's
        still-open SSE connection to open the second, actually killing the first
        download's subprocess rather than leaving it running untouched (found
        2026-07-25: pasting a second URL mid-download broke and orphaned the
        first).
        """
        reject_if_busy(ctx, "Importing from a URL")
        url = normalize_import_url(req.url)
        try:
            validate_import_url(url)
        except ImportUrlError as e:
            raise HTTPException(400, str(e))
        project_downloads_dir(ctx.project_dir)  # ensure it exists before the subprocess starts
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "import-url", url,
            "--project", str(ctx.project_dir),
        ]
        ctx.import_cmd = cmd
        _log.info("URL import queued: %s", url)
        return {"status": "started"}

    @router.get("/api/import-url/events")
    async def events():
        """Stream the download subprocess output as SSE. Call /api/import-url/start first."""
        if not ctx.import_cmd:
            raise HTTPException(400, "No import queued. Call /api/import-url/start first.")
        reject_if_busy(ctx, "Importing from a URL")
        return await subprocess_sse(
            ctx.import_cmd, ctx.project_dir, ctx,
            clear_cmd_attr="import_cmd", track_active_job=True, job_kind="import",
        )

    @router.post("/api/import-url/cancel")
    async def cancel_import():
        """Terminate the running URL-import download subprocess, if any."""
        proc = ctx.analyze_proc
        if proc is not None and getattr(proc, "returncode", None) is None and ctx.analyze_proc_kind == "import":
            ctx.cancelled_procs.add(proc)
            _log.warning("URL import cancelled by user")
            await terminate_process_tree_async(proc)
        ctx.import_cmd = None
        return {"status": "cancelled"}

    return router
