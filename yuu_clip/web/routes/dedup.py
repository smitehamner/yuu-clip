# Feature-map - Clip deduplication (near-duplicate overlapping windows)
#   Logic: scoring/dedup.py · UI: static/clips.js · Tests: tests/unit/test_dedup.py, tests/integration/test_dedup_route.py
"""On-demand scan that flags near-duplicate clip candidates (overlapping windows
from different segmentation passes) so the reviewer can merge them with the
existing merge route. Detection lives in scoring/dedup.py; this route persists
the result as a system tag and returns the flagged pairs for the review UI.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.log import get_logger
from yuu_clip.scoring.dedup import DUPLICATE_TAG, find_duplicate_candidates
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


def _set_duplicate_tag(clip: ClipCandidate, flagged: bool) -> bool:
    """Add or remove DUPLICATE_TAG on *clip*. Returns True if the tag changed."""
    tags = clip.tags
    has_tag = DUPLICATE_TAG in tags
    if flagged and not has_tag:
        clip.tags = tags + [DUPLICATE_TAG]
        return True
    if not flagged and has_tag:
        clip.tags = [tag for tag in tags if tag != DUPLICATE_TAG]
        return True
    return False


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
            pairs = find_duplicate_candidates(video_id, db)
            flagged_ids = {clip.id for pair in pairs for clip in pair[:2]}
            clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            changed = sum(_set_duplicate_tag(clip, clip.id in flagged_ids) for clip in clips)
            db.commit()
            _log.info(
                "Duplicate scan on video %d: %d clips checked, %d flagged, %d tags changed",
                video_id, len(clips), len(flagged_ids), changed,
            )
            return {
                "clips_checked": len(clips),
                "clips_flagged": len(flagged_ids),
                "pairs": [
                    {"clip_a_id": clip_a.id, "clip_b_id": clip_b.id, "overlap_ratio": round(ratio, 3)}
                    for clip_a, clip_b, ratio in pairs
                ],
            }
        finally:
            db.close()

    return router
