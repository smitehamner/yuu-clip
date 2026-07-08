"""Bulk clip operations - multi-clip status set/restore, delete, and export.

Registered before the crud routes: these use static paths like /api/clips/bulk-export
that would otherwise be matched as /api/clips/{clip_id}.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.export.paths import (
    all_sidecar_paths,
    clip_export_row_files,
    validate_export_preset_query,
)
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.file_deletion import delete_files
from yuu_clip.web.routes.clips.export import _clip_export_stream_response
from yuu_clip.web.routes.clips.schemas import (
    _VALID_STATUSES,
    BulkClipIds,
    BulkStatusRestore,
    BulkStatusUpdate,
)
from yuu_clip.web.routes.clips.serialize import _parse_clip_ids
from yuu_clip.web.routes.common import missing_ids

_log = get_logger(__name__)


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.post("/api/clips/bulk-status")
    def bulk_set_clip_status(body: BulkStatusUpdate):
        """Set status on multiple clips at once. Unknown IDs are skipped, not an error."""
        if body.status not in _VALID_STATUSES:
            raise HTTPException(400, f"status must be one of: {' | '.join(_VALID_STATUSES)}")
        if not body.clip_ids:
            raise HTTPException(400, "clip_ids must not be empty")
        db = ctx.get_db()
        try:
            clips = db.query(ClipCandidate).filter(ClipCandidate.id.in_(body.clip_ids)).all()
            found_ids = {c.id for c in clips}
            previous = {c.id: c.status for c in clips}
            for clip in clips:
                clip.status = body.status
            db.commit()
            missing = missing_ids(body.clip_ids, found_ids)
            _log.info(
                "Bulk status update: %d clip(s) set to %s, %d missing",
                len(clips), body.status, len(missing),
            )
            return {
                "updated": sorted(found_ids), "status": body.status, "missing": missing,
                "previous": previous,
            }
        finally:
            db.close()

    @router.post("/api/clips/bulk-status-restore")
    def bulk_restore_clip_status(body: BulkStatusRestore):
        """Restore each clip to its own previous status - undo for bulk_set_clip_status.

        Unlike bulk-status, clips may end up on different statuses, so this takes
        a per-clip mapping rather than one status for the whole batch.
        """
        if not body.updates:
            raise HTTPException(400, "updates must not be empty")
        for item in body.updates:
            if item.status not in _VALID_STATUSES:
                raise HTTPException(400, f"status must be one of: {' | '.join(_VALID_STATUSES)}")
        db = ctx.get_db()
        try:
            by_id = {item.id: item.status for item in body.updates}
            clips = db.query(ClipCandidate).filter(ClipCandidate.id.in_(by_id)).all()
            for clip in clips:
                clip.status = by_id[clip.id]
            db.commit()
            found_ids = {c.id for c in clips}
            _log.info("Bulk status restore (undo): %d clip(s) reverted", len(clips))
            return {"restored": sorted(found_ids), "missing": missing_ids(list(by_id), found_ids)}
        finally:
            db.close()

    @router.post("/api/clips/bulk-delete")
    def bulk_delete_clips(body: BulkClipIds):
        """Delete multiple clip records and their exported files.

        Best-effort per clip: a clip whose export file is locked is left in place
        (reported in ``locked``) rather than aborting the whole batch.
        """
        if not body.clip_ids:
            raise HTTPException(400, "clip_ids must not be empty")
        db = ctx.get_db()
        try:
            clips = db.query(ClipCandidate).filter(ClipCandidate.id.in_(body.clip_ids)).all()
            found_ids = {c.id for c in clips}
            deleted: list[int] = []
            locked_ids: list[int] = []
            for clip in clips:
                video = db.get(Video, clip.video_id)
                locked = delete_files([
                    *all_sidecar_paths(clip, video, ctx.export_dir, ctx.config.export_name_template),
                    *clip_export_row_files(clip),
                ])
                if locked:
                    locked_ids.append(clip.id)
                    continue
                db.delete(clip)
                deleted.append(clip.id)
            db.commit()
            missing = missing_ids(body.clip_ids, found_ids)
            _log.info(
                "Bulk delete: %d clip(s) deleted, %d locked, %d missing",
                len(deleted), len(locked_ids), len(missing),
            )
            return {"deleted": deleted, "missing": missing, "locked": locked_ids}
        finally:
            db.close()

    @router.get("/api/clips/bulk-export")
    async def bulk_export_clips(
        clip_ids: str = Query(..., description="Comma-separated clip IDs"),
        skip_exported: bool = Query(True),
        burn_subs: bool = Query(False),
        embed_subs: bool = Query(False),
        container: Optional[str] = Query(None),
        preset: Optional[str] = Query(None, description="Export preset id (built-in or custom); omit for original quality"),
    ):
        """Export a specific set of clips (an explicit selection, not a video-wide
        filter), streaming per-clip progress as SSE."""
        ids = _parse_clip_ids(clip_ids)
        if not ids:
            raise HTTPException(400, "clip_ids must contain at least one ID")
        allowed_containers = {"mkv", "mp4"}
        if container is not None and container not in allowed_containers:
            raise HTTPException(400, f"container must be one of {sorted(allowed_containers)}")
        validate_export_preset_query(ctx, preset, embed_subs)

        db = ctx.get_db()
        try:
            found_ids = {
                c.id for c in db.query(ClipCandidate.id).filter(ClipCandidate.id.in_(ids)).all()
            }
        finally:
            db.close()
        missing = missing_ids(ids, found_ids)
        if missing:
            raise HTTPException(404, f"Clip(s) not found: {', '.join(map(str, missing))}")

        return _clip_export_stream_response(
            ctx, ids,
            skip_exported=skip_exported, burn_subs=burn_subs, embed_subs=embed_subs,
            container=container, retranscribe=False, retranscribe_model="large-v3",
            preset=preset,
        )
