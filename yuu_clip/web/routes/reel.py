"""
Highlight reel compilation routes.

Uses the same start→events pattern as ingest: the POST endpoint validates
options and queues the CLI command; the GET endpoint streams its output as SSE.
Validation at the start step prevents starting a long render only to fail early.
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from yuu_clip.db.models import ClipCandidate
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.sse import subprocess_sse

_log = get_logger(__name__)


class DemoRequest(BaseModel):
    video_id:    Optional[int]       = None
    clip_ids:    Optional[list[int]] = None   # ordered list; overrides video_id filter
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
        from yuu_clip.reel import TRANSITIONS
        if req.transition not in TRANSITIONS:
            raise HTTPException(
                400,
                f"Unknown transition '{req.transition}'. Options: {', '.join(TRANSITIONS)}",
            )

        db = ctx.get_db()
        try:
            if req.clip_ids:
                clips = [
                    c for cid in req.clip_ids
                    for c in [db.get(ClipCandidate, cid)]
                    if c is not None
                ]
            else:
                q = db.query(ClipCandidate).filter_by(status="approved")
                if req.video_id:
                    q = q.filter_by(video_id=req.video_id)
                clips = q.order_by(ClipCandidate.score_overall.desc()).all()
            if not clips:
                raise HTTPException(400, "No approved clips found to compile into a highlight reel")
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
            sys.executable, "-m", "yuu_clip.cli", "reel",
            "--project",    str(ctx.project_dir),
            "--transition", req.transition,
            "--trans-dur",  str(req.trans_dur),
            "--title-dur",  str(req.title_dur),
            "--output",     str(output_path),
        ]
        if req.clip_ids:
            for cid in req.clip_ids:
                cmd += ["--clip-id", str(cid)]
        else:
            cmd += ["--status", "approved"]
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

    @router.get("/api/demo/approved-clips")
    def approved_clips_for_reel(video_id: Optional[int] = Query(None)):
        """Return approved clips (timeline order) for the reel builder, with export status."""
        from yuu_clip.db.models import Video
        db = ctx.get_db()
        try:
            q = db.query(ClipCandidate).filter_by(status="approved")
            if video_id:
                q = q.filter_by(video_id=video_id)
            clips = q.order_by(ClipCandidate.start_ms).all()

            vid_ids = {c.video_id for c in clips}
            video_map = {
                v.id: v
                for v in db.query(Video).filter(Video.id.in_(vid_ids)).all()
            }

            result = []
            for c in clips:
                video = video_map.get(c.video_id)
                stem = Path(video.filename).stem if video else ""
                start_hms = c.start_hms.replace(":", "-")
                export_file = None
                for ext in (".mkv", ".mp4", ".mov", ".avi", ".webm"):
                    candidate = ctx.export_dir / f"{stem}_clip{c.id}_{start_hms}{ext}"
                    if candidate.exists():
                        export_file = candidate
                        break
                result.append({
                    "id": c.id,
                    "video_id": c.video_id,
                    "video_name": video.filename if video else "",
                    "start_hms": c.start_hms,
                    "duration_hms": c.duration_hms,
                    "duration_ms": c.end_ms - c.start_ms,
                    "score_overall": c.score_overall,
                    "description": c.description or "",
                    "has_export": export_file is not None,
                    "export_url": f"/api/clips/{c.id}/media_url" if export_file else None,
                })
        finally:
            db.close()
        return result

    @router.get("/api/demo/list")
    def list_reels():
        """Return highlight reel files from the reels directory, newest first."""
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
