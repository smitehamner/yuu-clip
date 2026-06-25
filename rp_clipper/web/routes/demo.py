"""
Demo reel compilation routes.

Uses the same start→events pattern as ingest: the POST endpoint validates
options and queues the CLI command; the GET endpoint streams its output as SSE.
Validation at the start step prevents starting a long render only to fail early.
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rp_clipper.db.models import ClipCandidate
from rp_clipper.log import get_logger
from rp_clipper.web.deps import ProjectContext
from rp_clipper.web.sse import subprocess_sse

_log = get_logger(__name__)


class DemoRequest(BaseModel):
    video_id:    Optional[int] = None
    transition:  str   = "fade"
    trans_dur:   float = 0.5
    title_dur:   float = 3.0
    output_name: str   = ""


def _safe_filename(name: str, default: str = "highlights.mkv") -> str:
    """Return *name* with any directory components stripped.

    Prevents path traversal: 'output_name: ../../etc/evil' becomes 'evil'.
    A bare default is returned if the result would be empty after stripping.
    """
    safe = Path(name).name  # strips all parent components on all platforms
    return safe if safe else default


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/demo/start")
    def start_demo(req: DemoRequest):
        """Validate options, confirm there are approved clips, and queue the demo command."""
        from rp_clipper.demo import TRANSITIONS
        if req.transition not in TRANSITIONS:
            raise HTTPException(
                400,
                f"Unknown transition '{req.transition}'. Options: {', '.join(TRANSITIONS)}",
            )

        db = ctx.get_db()
        try:
            q = db.query(ClipCandidate).filter_by(status="approved")
            if req.video_id:
                q = q.filter_by(video_id=req.video_id)
            clips = q.order_by(ClipCandidate.score_overall.desc()).all()
            if not clips:
                raise HTTPException(400, "No approved clips found to compile into a demo reel")
        finally:
            db.close()

        if req.output_name:
            output_name = _safe_filename(req.output_name)
            if not output_name.endswith(".mkv"):
                output_name += ".mkv"
        else:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_name = f"highlights_{ts}.mkv"

        ctx.reels_dir.mkdir(parents=True, exist_ok=True)
        output_path = ctx.reels_dir / output_name
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "demo",
            "--project",    str(ctx.project_dir),
            "--transition", req.transition,
            "--trans-dur",  str(req.trans_dur),
            "--title-dur",  str(req.title_dur),
            "--output",     str(output_path),
            "--status",     "approved",
        ]
        if req.video_id:
            cmd += ["--video-id", str(req.video_id)]

        ctx.demo_cmd = cmd
        _log.info(
            "Demo reel queued: %d approved clip(s), output=%s, transition=%s",
            len(clips), output_name, req.transition,
        )
        return {"status": "started", "clip_count": len(clips), "output_name": output_name}

    @router.get("/api/demo/events")
    async def demo_events():
        """Stream demo compilation progress as SSE. Call /api/demo/start first."""
        if not ctx.demo_cmd:
            raise HTTPException(400, "No demo queued. Call /api/demo/start first.")
        return await subprocess_sse(ctx.demo_cmd, ctx.project_dir, ctx)

    @router.get("/api/demo/list")
    def list_reels():
        """Return demo reel files from the reels directory, newest first."""
        if not ctx.reels_dir.exists():
            return []
        reels = []
        for f in ctx.reels_dir.iterdir():
            if f.suffix != ".mkv":
                continue
            st = f.stat()
            reels.append({
                "filename": f.name,
                "url": f"/media/reels/{f.name}",
                "size_mb": round(st.st_size / 1_048_576, 1),
                "date": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "mtime": st.st_mtime,
            })
        reels.sort(key=lambda r: r["mtime"], reverse=True)
        for r in reels:
            del r["mtime"]
        return reels

    return router
