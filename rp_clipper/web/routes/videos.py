"""
Video and clip CRUD routes.

Handles listing videos, listing clips for a video, fetching clip detail,
updating clip review status (approved/rejected/pending), and resolving the
exported media URL for the in-browser player.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from rp_clipper.db.models import ClipCandidate, Video
from rp_clipper.web.deps import ProjectContext

_VALID_STATUSES = ("approved", "rejected", "pending")


class StatusUpdate(BaseModel):
    status: str  # approved | rejected | pending


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/videos")
    def list_videos():
        db = ctx.get_db()
        videos = db.query(Video).order_by(Video.created_at.desc()).all()
        return [_video_dict(v, db) for v in videos]

    @router.get("/api/videos/{video_id}/clips")
    def list_clips(
        video_id: int,
        status: Optional[str] = Query(None),
        sort: str = Query("score", description="score | timeline"),
    ):
        db = ctx.get_db()
        video = db.get(Video, video_id)
        if not video:
            raise HTTPException(404, "Video not found")
        q = db.query(ClipCandidate).filter_by(video_id=video_id)
        if status:
            q = q.filter_by(status=status)
        order = ClipCandidate.start_ms.asc() if sort == "timeline" else ClipCandidate.score_overall.desc()
        clips = q.order_by(order).all()
        return [_clip_dict(c, export_dir=ctx.export_dir, video=video) for c in clips]

    @router.get("/api/clips/{clip_id}")
    def get_clip(clip_id: int):
        db = ctx.get_db()
        clip = _require_clip(db, clip_id)
        video = db.get(Video, clip.video_id)
        return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video)

    @router.post("/api/clips/{clip_id}/status")
    def set_clip_status(clip_id: int, body: StatusUpdate):
        if body.status not in _VALID_STATUSES:
            raise HTTPException(400, f"status must be one of: {' | '.join(_VALID_STATUSES)}")
        db = ctx.get_db()
        clip = _require_clip(db, clip_id)
        clip.status = body.status
        db.commit()
        return {"id": clip_id, "status": body.status}

    @router.get("/api/clips/{clip_id}/media_url")
    def clip_media_url(clip_id: int):
        """Return the web-accessible URL for this clip's exported video, or null if not yet exported."""
        db = ctx.get_db()
        clip = _require_clip(db, clip_id)
        video = db.get(Video, clip.video_id)
        filename = _export_filename(clip, video)
        if (ctx.export_dir / filename).exists():
            return {"url": f"/media/exports/{filename}", "filename": filename}
        return {"url": None, "filename": filename}

    return router


# ── serialization helpers ────────────────────────────────────────────────────

def _require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def _export_filename(clip: ClipCandidate, video: Video) -> str:
    stem = Path(video.filename).stem
    start_hms = clip.start_hms.replace(":", "-")
    return f"{stem}_clip{clip.id}_{start_hms}.mkv"


def _video_dict(video: Video, db) -> dict:
    return {
        "id": video.id,
        "filename": video.filename,
        "status": video.status,
        "duration_hms": video.duration_hms,
        "clip_count": db.query(ClipCandidate).filter_by(video_id=video.id).count(),
        "approved": db.query(ClipCandidate).filter_by(video_id=video.id, status="approved").count(),
    }


def _clip_dict(
    clip: ClipCandidate,
    full: bool = False,
    export_dir=None,
    video: Video = None,
) -> dict:
    d = {
        "id": clip.id,
        "video_id": clip.video_id,
        "start_ms": clip.start_ms,
        "end_ms": clip.end_ms,
        "start_hms": clip.start_hms,
        "duration_hms": clip.duration_hms,
        "score_overall": round(clip.score_overall, 3),
        "score_funny": round(clip.score_funny, 3),
        "score_dramatic": round(clip.score_dramatic, 3),
        "score_action": round(clip.score_action, 3),
        "description": clip.description or "",
        "status": clip.status,
        "tags": clip.tags,
        "has_export": (
            export_dir is not None
            and video is not None
            and (export_dir / _export_filename(clip, video)).exists()
        ),
    }
    if full:
        d["transcript_excerpt"] = clip.transcript_excerpt or ""
    return d
