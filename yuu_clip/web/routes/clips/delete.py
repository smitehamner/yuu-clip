"""Delete routes — clear a clip's exports, delete one export format, delete a clip."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from yuu_clip.db.models import ClipExport, Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes._shared import (
    _all_sidecar_paths,
    _clip_export_row_files,
    _delete_files,
    _locked_files_error,
    _require_clip,
)

_log = get_logger(__name__)


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.delete("/api/clips/{clip_id}/export")
    def delete_clip_export(clip_id: int):
        """Delete every exported format for a clip from disk; keeps the clip record.

        Per-format deletion (keeping the clip's other formats) is
        DELETE /api/clip-exports/{export_id} below.
        """
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            targets = [
                *(p for p in _all_sidecar_paths(clip, video, ctx.export_dir, ctx.config.export_name_template) if p.exists()),
                *_clip_export_row_files(clip),
            ]
            targets = list(dict.fromkeys(targets))  # de-dupe, preserve order
            locked = _delete_files(targets)
            if locked:
                raise _locked_files_error(locked)
            for row in list(clip.exports):
                db.delete(row)
            db.commit()
            _log.info("Cleared export for clip %d (%d file(s))", clip_id, len(targets))
            return {"clip_id": clip_id, "files_deleted": len(targets)}
        finally:
            db.close()

    @router.delete("/api/clip-exports/{export_id}")
    def delete_clip_export_row(export_id: int):
        """Delete one exported format (its file + row) but keep the clip's other formats."""
        db = ctx.get_db()
        try:
            row = db.get(ClipExport, export_id)
            if not row:
                raise HTTPException(404, "Export not found")
            path = Path(row.path)
            if path.exists():
                locked = _delete_files([path])
                if locked:
                    raise _locked_files_error(locked)
            clip_id = row.clip_id
            db.delete(row)
            db.commit()
            _log.info("Deleted export %d (preset=%s) for clip %d", export_id, row.preset_name, clip_id)
            return {"export_id": export_id, "clip_id": clip_id}
        finally:
            db.close()

    @router.delete("/api/clips/{clip_id}")
    def delete_clip(clip_id: int):
        """Remove a clip record and its exported file from the exports folder."""
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            video_id = clip.video_id

            locked = _delete_files([
                *_all_sidecar_paths(clip, video, ctx.export_dir, ctx.config.export_name_template),
                *_clip_export_row_files(clip),
            ])
            if locked:
                raise _locked_files_error(locked)

            db.delete(clip)  # cascades clip_exports rows via the ORM relationship
            db.commit()
            _log.info("Deleted clip %d from video %d", clip_id, video_id)
            return {"deleted": clip_id, "video_id": video_id}
        finally:
            db.close()
