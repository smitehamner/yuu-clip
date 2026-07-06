"""Approval routes — threshold auto-approve and reset for a video's clips."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.clips.schemas import AutoApproveBody

_log = get_logger(__name__)

_AUTO_APPROVE_FIELDS = {
    "overall":  ClipCandidate.score_overall,
    "funny":    ClipCandidate.score_funny,
    "dramatic": ClipCandidate.score_dramatic,
    "action":   ClipCandidate.score_action,
}


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.post("/api/videos/{video_id}/auto-approve")
    def auto_approve(video_id: int, body: AutoApproveBody):
        """Approve all pending clips at or above the given score threshold on the chosen sub-score."""
        if not (0.0 <= body.threshold <= 1.0):
            raise HTTPException(400, "threshold must be between 0.0 and 1.0")
        if body.score_field not in _AUTO_APPROVE_FIELDS:
            raise HTTPException(400, f"score_field must be one of: {', '.join(_AUTO_APPROVE_FIELDS)}")
        db = ctx.get_db()
        try:
            if not db.get(Video, video_id):
                raise HTTPException(404, "Video not found")
            score_col = _AUTO_APPROVE_FIELDS[body.score_field]
            clips = (
                db.query(ClipCandidate)
                .filter(
                    ClipCandidate.video_id == video_id,
                    ClipCandidate.status == "pending",
                    score_col >= body.threshold,
                )
                .all()
            )
            count = len(clips)
            for clip in clips:
                clip.status = "approved"
            db.commit()
            _log.info(
                "Auto-approved %d clips with %s >= %.2f for video %d",
                count, body.score_field, body.threshold, video_id,
            )
            return {"approved": count}
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/reset-approvals")
    def reset_approvals(video_id: int):
        """Reset all clip statuses to 'pending' for a video."""
        db = ctx.get_db()
        try:
            if not db.get(Video, video_id):
                raise HTTPException(404, "Video not found")
            clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            count = sum(1 for c in clips if c.status != "pending")
            for clip in clips:
                clip.status = "pending"
            db.commit()
            _log.info("Reset %d clip approvals for video %d", count, video_id)
            return {"reset": count}
        finally:
            db.close()
