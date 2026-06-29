"""Clip management routes — CRUD, preview, approval, export."""
from __future__ import annotations

import asyncio
import json as json_lib
import re
import subprocess as _subprocess
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import case

from yuu_clip.config import validate_whisper_model
from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes._shared import (
    _active_job,
    _all_sidecar_paths,
    _export_paths,
    _require_clip,
    _srt_path,
    _sse_response,
    _user_or_default,
)

_log = get_logger(__name__)

_VALID_STATUSES = ("approved", "rejected", "pending")

_AUTO_APPROVE_FIELDS = {
    "overall":  ClipCandidate.score_overall,
    "funny":    ClipCandidate.score_funny,
    "dramatic": ClipCandidate.score_dramatic,
    "action":   ClipCandidate.score_action,
}

# LRU cache of preview temp files keyed by clip_id. Evicts oldest when full.
_preview_cache: OrderedDict[int, Path] = OrderedDict()
_PREVIEW_CACHE_MAX = 10


class StatusUpdate(BaseModel):
    status: str  # approved | rejected | pending


class ClipFieldsUpdate(BaseModel):
    action: str                          # accept_new | accept_edit | revert
    field: str                           # description | description_long | both
    new_description: Optional[str] = None
    new_description_long: Optional[str] = None


class ClipTimingUpdate(BaseModel):
    start_offset: float
    end_offset: float


class ClipScoreOverride(BaseModel):
    score_overall_user: Optional[float] = None  # None = clear override


class ClipMergeRequest(BaseModel):
    clip_b_id: int


class AutoApproveBody(BaseModel):
    threshold: float
    score_field: str = "overall"


def _srt_to_vtt(srt: str) -> str:
    vtt = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)
    return f"WEBVTT\n\n{vtt}"


def _subtitle_status(clip: ClipCandidate, video: Optional[Video], export_dir: Optional[Path]) -> str:
    if clip.exported_burn_subs:
        return "baked-in"
    if export_dir and video and _srt_path(clip, video, export_dir) is not None:
        return "srt-sidecar"
    return "none"


def _related_clips_stale(clip: ClipCandidate, video: Optional[Video]) -> bool:
    if not clip.related_clips_at:
        return False
    if video and video.clips_scored_at and clip.related_clips_at < video.clips_scored_at:
        return True
    return False


def _clip_dict(
    clip: ClipCandidate,
    full: bool = False,
    export_dir: Optional[Path] = None,
    video: Optional[Video] = None,
) -> dict:
    has_export = (
        export_dir is not None
        and video is not None
        and any(p.exists() for p in _export_paths(clip, video, export_dir))
    )
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
        "score_overall_user": round(clip.score_overall_user, 3) if clip.score_overall_user is not None else None,
        "description": _user_or_default(clip.description_user, clip.description),
        "description_original": clip.description or "",
        "description_is_edited": clip.description_user is not None,
        "description_long": _user_or_default(clip.description_long_user, clip.description_long),
        "description_long_original": clip.description_long or "",
        "description_long_is_edited": clip.description_long_user is not None,
        "start_offset": clip.start_offset,
        "end_offset": clip.end_offset,
        "status": clip.status,
        "tags": clip.tags,
        "has_export": has_export,
        "exported_at": clip.exported_at.isoformat() if clip.exported_at else None,
        "exported_container": clip.exported_container or None,
        "exported_burn_subs": clip.exported_burn_subs,
        "subtitle_status": _subtitle_status(clip, video, export_dir) if has_export else "none",
        "related_clips": json_lib.loads(clip.related_clips_json) if clip.related_clips_json else None,
        "related_clips_at": clip.related_clips_at.isoformat() if clip.related_clips_at else None,
        "related_clips_stale": _related_clips_stale(clip, video),
    }
    if full:
        d["transcript_excerpt"] = clip.transcript_excerpt or ""
    return d


def _clip_has_export_file(ctx: "ProjectContext", clip_id: int, video_id: int) -> bool:
    """Check whether a clip already has an exported file on disk. Opens and closes its own DB session."""
    db = ctx.get_db()
    try:
        clip = db.get(ClipCandidate, clip_id)
        vid  = db.get(Video, video_id) if clip else None
        if clip and vid:
            return any(p.exists() for p in _export_paths(clip, vid, ctx.export_dir))
        return False
    finally:
        db.close()


def _build_export_cmd(
    ctx: ProjectContext,
    clip_id: int,
    *,
    burn_subs: bool,
    embed_subs: bool,
    container: Optional[str],
    retranscribe: bool,
    retranscribe_model: str,
) -> list[str]:
    cmd = [
        sys.executable, "-m", "yuu_clip.cli", "export", str(clip_id),
        "--captions", "--project", str(ctx.project_dir),
    ]
    if burn_subs:
        cmd.append("--bake-captions")
    elif embed_subs:
        cmd.append("--embed-subs")
    if container:
        cmd.extend(["--container", container])
    if retranscribe:
        cmd.extend(["--retranscribe", "--retranscribe-model", retranscribe_model])
    return cmd


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()
    _register_approval_routes(router, ctx)
    _register_clip_routes(router, ctx)
    _register_delete_routes(router, ctx)
    _register_batch_export_route(router, ctx)
    _register_clip_edit_routes(router, ctx)
    _register_caption_routes(router, ctx)
    return router


def _register_approval_routes(router: APIRouter, ctx: ProjectContext) -> None:
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


def _register_clip_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/clips")
    def list_clips(
        video_id: int,
        status: Optional[str] = Query(None),
        sort: str = Query("score", description="score | funny | dramatic | action | timeline"),
    ):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            q = db.query(ClipCandidate).filter_by(video_id=video_id)
            if status:
                q = q.filter_by(status=status)
            _sort_col = {
                "funny":    ClipCandidate.score_funny,
                "dramatic": ClipCandidate.score_dramatic,
                "action":   ClipCandidate.score_action,
            }
            if sort == "timeline":
                order = ClipCandidate.start_ms.asc()
            elif sort in _sort_col:
                order = _sort_col[sort].desc()
            else:
                # Prefer user override when set, fall back to LLM score.
                order = case(
                    (ClipCandidate.score_overall_user.isnot(None), ClipCandidate.score_overall_user),
                    else_=ClipCandidate.score_overall,
                ).desc()
            clips = q.order_by(order).all()
            return [_clip_dict(c, export_dir=ctx.export_dir, video=video) for c in clips]
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}")
    def get_clip(clip_id: int):
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video)
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/status")
    def set_clip_status(clip_id: int, body: StatusUpdate):
        if body.status not in _VALID_STATUSES:
            raise HTTPException(400, f"status must be one of: {' | '.join(_VALID_STATUSES)}")
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            clip.status = body.status
            db.commit()
            return {"id": clip_id, "status": body.status}
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/media_url")
    def clip_media_url(clip_id: int):
        """Return the web-accessible URL for this clip's exported video, or null if not yet exported."""
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            export_file = next(
                (p for p in _export_paths(clip, video, ctx.export_dir) if p.exists()), None
            )
            srt = _srt_path(clip, video, ctx.export_dir)
            if export_file:
                return {"url": f"/media/exports/{export_file.name}", "filename": export_file.name, "has_captions": srt is not None}
            return {"url": None, "filename": None, "has_captions": False}
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/preview")
    def clip_preview(clip_id: int):
        """Generate a seekable MP4 preview of a clip from the source video (cached on disk)."""
        cached = _preview_cache.get(clip_id)
        if cached and cached.exists():
            _preview_cache.move_to_end(clip_id)
            return FileResponse(str(cached), media_type="video/mp4")

        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
        finally:
            db.close()

        if not video:
            raise HTTPException(404, "Video not found")
        src = Path(video.path)
        if not src.exists():
            raise HTTPException(404, "Source video file not found on disk")

        start_s = clip.start_ms / 1000 + (clip.start_offset or 0)
        end_s = clip.end_ms / 1000 + (clip.end_offset or 0)
        duration_s = max(0.1, end_s - start_s)

        preview_dir = ctx.data_dir / "preview_cache"
        preview_dir.mkdir(exist_ok=True)
        out_path = preview_dir / f"clip_{clip_id}_preview.mp4"

        result = _subprocess.run(
            [
                "ffmpeg", "-y",
                "-ss", str(start_s),
                "-i", str(src),
                "-t", str(duration_s),
                "-c", "copy",
                "-f", "mp4",
                "-movflags", "+faststart",
                str(out_path),
            ],
            stderr=_subprocess.DEVNULL,
        )
        if result.returncode != 0 or not out_path.exists():
            _log.error("Preview generation failed for clip %d (rc=%d, src=%s)", clip_id, result.returncode, src.name)
            raise HTTPException(500, "Preview generation failed")

        _preview_cache[clip_id] = out_path
        _preview_cache.move_to_end(clip_id)
        if len(_preview_cache) > _PREVIEW_CACHE_MAX:
            _, old = _preview_cache.popitem(last=False)
            old.unlink(missing_ok=True)

        return FileResponse(str(out_path), media_type="video/mp4")


def _register_delete_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.delete("/api/clips/{clip_id}/export")
    def delete_clip_export(clip_id: int):
        """Delete the exported file(s) for a clip from disk; keeps the clip record."""
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            deleted = [p for p in _all_sidecar_paths(clip, video, ctx.export_dir) if p.exists()]
            for p in deleted:
                p.unlink()
            _log.info("Cleared export for clip %d (%d file(s))", clip_id, len(deleted))
            return {"clip_id": clip_id, "files_deleted": len(deleted)}
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

            for p in _all_sidecar_paths(clip, video, ctx.export_dir):
                p.unlink(missing_ok=True)

            db.delete(clip)
            db.commit()
            _log.info("Deleted clip %d from video %d", clip_id, video_id)
            return {"deleted": clip_id, "video_id": video_id}
        finally:
            db.close()


def _register_batch_export_route(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/batch-export")
    async def batch_export(
        video_id: int,
        min_score: float = Query(0.0),
        skip_exported: bool = Query(True),
        burn_subs: bool = Query(False),
        embed_subs: bool = Query(False),
        container: Optional[str] = Query(None),
        retranscribe: bool = Query(False),
        retranscribe_model: str = Query("large-v3"),
    ):
        """Export all approved clips for a video above min_score, streaming per-clip progress as SSE."""
        allowed_containers = {"mkv", "mp4"}
        if container is not None and container not in allowed_containers:
            raise HTTPException(400, f"container must be one of {sorted(allowed_containers)}")

        if retranscribe:
            try:
                validate_whisper_model(retranscribe_model)
            except ValueError as e:
                raise HTTPException(400, str(e))

        db = ctx.get_db()
        try:
            if not db.get(Video, video_id):
                raise HTTPException(404, "Video not found")
            clips = (
                db.query(ClipCandidate)
                .filter(
                    ClipCandidate.video_id == video_id,
                    ClipCandidate.status == "approved",
                    ClipCandidate.score_overall >= min_score,
                )
                .order_by(ClipCandidate.start_ms)
                .all()
            )
            clip_ids = [c.id for c in clips]
        finally:
            db.close()

        if not clip_ids:
            raise HTTPException(400, "No approved clips match the filter")

        async def event_stream():
            async with _active_job(ctx):
                total = len(clip_ids)
                exported = 0
                skipped  = 0
                for i, cid in enumerate(clip_ids, 1):
                    if skip_exported and _clip_has_export_file(ctx, cid, video_id):
                        skipped += 1
                        yield f"data: {json_lib.dumps(f'Skipping clip {cid} (already exported) [{i}/{total}]')}\n\n"
                        continue

                    yield f"data: {json_lib.dumps(f'Exporting clip {cid} [{i}/{total}]...')}\n\n"
                    cmd = _build_export_cmd(
                        ctx, cid,
                        burn_subs=burn_subs, embed_subs=embed_subs,
                        container=container,
                        retranscribe=retranscribe, retranscribe_model=retranscribe_model,
                    )
                    try:
                        proc = await asyncio.create_subprocess_exec(
                            *cmd,
                            stdout=_subprocess.PIPE,
                            stderr=_subprocess.STDOUT,
                            cwd=str(ctx.project_dir),
                        )
                        out, _ = await proc.communicate()
                        if proc.returncode == 0:
                            exported += 1
                            yield f"data: {json_lib.dumps(f'OK clip {cid} [{i}/{total}]')}\n\n"
                        else:
                            msg = out.decode(errors="replace").strip().splitlines()
                            last = msg[-1] if msg else "unknown error"
                            _log.error("batch_export: clip %d export failed for video %d (rc=%d): %s", cid, video_id, proc.returncode, last)
                            yield f"data: {json_lib.dumps(f'[Error clip {cid}: {last}]')}\n\n"
                    except Exception as exc:
                        _log.error("batch_export: clip %d subprocess failed for video %d: %s", cid, video_id, exc, exc_info=True)
                        yield f"data: {json_lib.dumps(f'[Error clip {cid}: {exc}]')}\n\n"

                yield f"data: {json_lib.dumps(f'Batch export complete: {exported} exported, {skipped} skipped')}\n\n"
                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return _sse_response(event_stream())


def _register_clip_edit_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.patch("/api/clips/{clip_id}/fields")
    def update_clip_fields(clip_id: int, body: ClipFieldsUpdate):
        """Commit the user's accept/edit/revert choice from the diff modal."""
        if body.action not in ("accept_new", "accept_edit", "revert"):
            raise HTTPException(400, "action must be accept_new | accept_edit | revert")
        if body.field not in ("description", "description_long", "both"):
            raise HTTPException(400, "field must be description | description_long | both")
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)

            touch_desc      = body.field in ("description",      "both")
            touch_desc_long = body.field in ("description_long", "both")

            if body.action == "accept_new":
                if touch_desc:
                    if body.new_description is None:
                        raise HTTPException(400, "new_description is required for accept_new")
                    clip.description      = body.new_description.strip()
                    clip.description_user = None
                if touch_desc_long:
                    if body.new_description_long is None:
                        raise HTTPException(400, "new_description_long is required for accept_new")
                    clip.description_long      = body.new_description_long.strip()
                    clip.description_long_user = None
            elif body.action == "accept_edit":
                if touch_desc:
                    if body.new_description is None:
                        raise HTTPException(400, "new_description is required for accept_edit")
                    clip.description_user = body.new_description.strip()
                if touch_desc_long:
                    if body.new_description_long is None:
                        raise HTTPException(400, "new_description_long is required for accept_edit")
                    clip.description_long_user = body.new_description_long.strip()
            else:  # revert
                if touch_desc:
                    clip.description_user = None
                if touch_desc_long:
                    clip.description_long_user = None

            db.commit()
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video)
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/score-override")
    def set_clip_score_override(clip_id: int, body: ClipScoreOverride):
        """Set or clear a manual overall-score override for a clip."""
        if body.score_overall_user is not None:
            val = round(max(0.0, min(1.0, body.score_overall_user)), 3)
        else:
            val = None
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            clip.score_overall_user = val
            db.commit()
            video = db.get(Video, clip.video_id)
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video)
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/merge")
    def merge_clips(clip_id: int, body: ClipMergeRequest):
        """Merge clip_b into clip_a: extends clip_a's end to clip_b's end, then deletes clip_b."""
        db = ctx.get_db()
        try:
            clip_a = _require_clip(db, clip_id)
            clip_b = _require_clip(db, body.clip_b_id)
            if clip_a.video_id != clip_b.video_id:
                raise HTTPException(400, "Clips must belong to the same recording")
            if clip_a.id == clip_b.id:
                raise HTTPException(400, "Cannot merge a clip with itself")

            # Always merge so the result spans from the earlier start to the later end.
            start_ms = min(clip_a.start_ms, clip_b.start_ms)
            end_ms   = max(clip_a.end_ms,   clip_b.end_ms)
            clip_a.start_ms     = start_ms
            clip_a.end_ms       = end_ms
            clip_a.start_offset = 0.0
            clip_a.end_offset   = 0.0
            clip_a.exported_at  = None
            clip_a.exported_container = None
            clip_a.exported_burn_subs = None

            video = db.get(Video, clip_a.video_id)
            for p in _all_sidecar_paths(clip_b, video, ctx.export_dir):
                p.unlink(missing_ok=True)
            for p in _all_sidecar_paths(clip_a, video, ctx.export_dir):
                p.unlink(missing_ok=True)
            db.delete(clip_b)
            db.commit()

            for _cid in (clip_id, body.clip_b_id):
                _cached = _preview_cache.pop(_cid, None)
                if _cached:
                    _cached.unlink(missing_ok=True)

            _log.info("Merged clip %d into clip %d (new range %d-%d ms)", body.clip_b_id, clip_id, start_ms, end_ms)
            return _clip_dict(clip_a, full=True, export_dir=ctx.export_dir, video=video)
        finally:
            db.close()

    @router.patch("/api/clips/{clip_id}/timing")
    def update_clip_timing(clip_id: int, body: ClipTimingUpdate):
        """Set start_offset and end_offset (seconds) on a clip."""
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            clip.start_offset = body.start_offset
            clip.end_offset   = body.end_offset
            db.commit()
            # Invalidate the cached preview so the next request reflects the new timing.
            cached = _preview_cache.pop(clip_id, None)
            if cached:
                cached.unlink(missing_ok=True)
            return {"start_offset": clip.start_offset, "end_offset": clip.end_offset}
        finally:
            db.close()


def _register_caption_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/clips/{clip_id}/captions.vtt")
    def clip_captions_vtt(clip_id: int):
        """Convert the exported SRT sidecar to WebVTT and return it for browser <track> use."""
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            srt = _srt_path(clip, video, ctx.export_dir)
            if srt is None:
                raise HTTPException(404, "No SRT file found for this clip")
            return PlainTextResponse(_srt_to_vtt(srt.read_text(encoding="utf-8", errors="replace")), media_type="text/vtt")
        finally:
            db.close()
