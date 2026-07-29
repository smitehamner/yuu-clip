# Feature-map - Clip deduplication (near-duplicate overlapping windows)
#   Logic: scoring/dedup.py · UI: static/clips/clips.js · Tests: tests/unit/test_dedup.py, tests/integration/test_dedup_route.py
"""On-demand scan that flags near-duplicate clip candidates (overlapping windows
from different segmentation passes) so the reviewer can merge them with the
existing merge route. Detection lives in scoring/dedup.py; this route persists
the result as a system tag and returns the flagged pairs for the review UI.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from yuu_clip.db.models import Video
from yuu_clip.log import get_logger
from yuu_clip.scoring.dedup import scan_and_tag_duplicates
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.clips.schemas import ClipDismissDuplicateRequest
from yuu_clip.web.routes.common import require_clip

_log = get_logger(__name__)


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/videos/{video_id}/scan-duplicates")
    def scan_duplicates(video_id: int):
        """Flag every clip of *video_id* whose window overlaps another clip's by
        >= 70%. Idempotent: re-tags flagged clips and clears the tag from clips
        no longer flagged (e.g. after one side of a pair is merged or rejected)."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Recording not found")
            result = scan_and_tag_duplicates(video_id, db)
            db.commit()
            _log.info(
                "Duplicate scan on video %d: %d clips checked, %d flagged, %d tags changed",
                video_id, result["clips_checked"], result["clips_flagged"], result["changed"],
            )
            return result
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/dismiss-duplicate")
    def dismiss_duplicate(clip_id: int, body: ClipDismissDuplicateRequest):
        """Mark *clip_id* and *other_clip_id* as not a duplicate of each other, so a
        future scan never re-flags this specific pair (a new overlap with a
        different clip can still flag either one). Re-scans the recording
        immediately so both clips' tags reflect the dismissal without the
        reviewer having to run a separate "Check duplicates" pass."""
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            other = require_clip(db, body.other_clip_id)
            if clip.video_id != other.video_id:
                raise HTTPException(400, "Clips must belong to the same recording")
            if clip.id not in other.dismissed_duplicate_ids:
                other.dismissed_duplicate_ids = other.dismissed_duplicate_ids + [clip.id]
            if other.id not in clip.dismissed_duplicate_ids:
                clip.dismissed_duplicate_ids = clip.dismissed_duplicate_ids + [other.id]
            result = scan_and_tag_duplicates(clip.video_id, db)
            db.commit()
            _log.info("Dismissed duplicate pair (clip %d, clip %d)", clip_id, body.other_clip_id)
            return result
        finally:
            db.close()

    return router
