# Feature-map - Import from URL (code: url_import / import-url)
#   UI: static/analyze/analyze.js (New Recording panel → Import from URL)
#   Siblings: url_import.py (yt-dlp download) · tests/unit/test_url_import.py, tests/ui/test_ui_analyze.py
"""Import from URL routes (roadmap plan 08) - Twitch VOD / YouTube downloads.

Follows the same start->events pattern as the highlight reel (routes/reel.py):
the POST endpoint validates the link and queues the CLI download command; the
paired GET endpoint streams that command's stdout as SSE.
"""
from __future__ import annotations

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
from yuu_clip.web.routes.common import reject_if_busy
from yuu_clip.web.sse import subprocess_sse, terminate_process_tree_async

_log = get_logger(__name__)


class ImportUrlRequest(BaseModel):
    url: str


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/import-url/inspect")
    def inspect(req: ImportUrlRequest):
        """Fetch metadata for a Twitch/YouTube link without downloading it."""
        url = normalize_import_url(req.url)
        try:
            info = inspect_url(url)
        except ImportUrlError as e:
            raise HTTPException(400, str(e))

        db = ctx.get_db()
        try:
            existing = db.query(Video).filter(Video.source_url == url).first()
        finally:
            db.close()

        return {
            **info,
            "already_imported": existing is not None,
            "existing_filename": existing.filename if existing else None,
        }

    @router.post("/api/import-url/start")
    def start(req: ImportUrlRequest):
        """Validate the link and queue the download command for the SSE stream."""
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
            cancel_flag_attr="import_cancelled", cancel_message="[Import cancelled]",
            clear_cmd_attr="import_cmd", track_active_job=True, job_kind="import",
        )

    @router.post("/api/import-url/cancel")
    async def cancel_import():
        """Terminate the running URL-import download subprocess, if any."""
        proc = ctx.analyze_proc
        if proc is not None and getattr(proc, "returncode", None) is None and ctx.analyze_proc_kind == "import":
            ctx.import_cancelled = True
            _log.warning("URL import cancelled by user")
            await terminate_process_tree_async(proc)
        ctx.import_cmd = None
        return {"status": "cancelled"}

    return router
