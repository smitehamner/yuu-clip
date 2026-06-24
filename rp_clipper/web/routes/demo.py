"""
Demo reel compilation routes.

Uses the same start→events pattern as ingest: the POST endpoint validates
options and queues the CLI command; the GET endpoint streams its output as SSE.
Validation at the start step prevents starting a long render only to fail early.
"""
from __future__ import annotations

import sys
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rp_clipper.db.models import ClipCandidate
from rp_clipper.web.deps import ProjectContext
from rp_clipper.web.sse import subprocess_sse


class DemoRequest(BaseModel):
    video_id:    Optional[int] = None
    transition:  str   = "fade"
    trans_dur:   float = 0.5
    title_dur:   float = 3.0
    output_name: str   = "highlights.mkv"


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
        q = db.query(ClipCandidate).filter_by(status="approved")
        if req.video_id:
            q = q.filter_by(video_id=req.video_id)
        clips = q.order_by(ClipCandidate.score_overall.desc()).all()
        if not clips:
            raise HTTPException(400, "No approved clips found to compile into a demo reel")

        output_dir = ctx.project_dir / "exports"
        output_dir.mkdir(parents=True, exist_ok=True)
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "demo",
            "--project",    str(ctx.project_dir),
            "--transition", req.transition,
            "--trans-dur",  str(req.trans_dur),
            "--title-dur",  str(req.title_dur),
            "--output",     str(output_dir / req.output_name),
            "--status",     "approved",
        ]
        if req.video_id:
            cmd += ["--video-id", str(req.video_id)]

        ctx.demo_cmd = cmd
        return {"status": "started", "clip_count": len(clips)}

    @router.get("/api/demo/events")
    async def demo_events():
        """Stream demo compilation progress as SSE. Call /api/demo/start first."""
        if not ctx.demo_cmd:
            raise HTTPException(400, "No demo queued. Call /api/demo/start first.")
        return await subprocess_sse(ctx.demo_cmd, ctx.project_dir)

    return router
