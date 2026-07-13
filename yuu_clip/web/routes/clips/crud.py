"""Core clip routes - list/filter, detail, manual create, tags, status, export
file listing, media URL, and on-demand preview generation.
"""
from __future__ import annotations

import json as json_lib
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import case

from yuu_clip.config import run_ffmpeg
from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.export.paths import (
    clip_export_row_files,
    export_paths,
    srt_path,
    srt_sidecar_paths,
)
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.media import media_file_response
from yuu_clip.web.routes.clips.schemas import (
    _VALID_STATUSES,
    ManualClipCreate,
    StatusUpdate,
    TagsBody,
)
from yuu_clip.web.routes.clips.serialize import _clip_dict, _normalize_tags
from yuu_clip.web.routes.common import require_clip

_log = get_logger(__name__)

# Per-context LRU cache of preview temp files lives on ProjectContext.preview_cache;
# this is the eviction bound. Evicts oldest when full.
_PREVIEW_CACHE_MAX = 10

_MANUAL_CLIP_MIN_MS = 1_000
_MANUAL_CLIP_MAX_MS = 10 * 60 * 1_000


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/clips")
    def list_clips(
        video_id: int,
        status: Optional[str] = Query(None),
        kind: Optional[str] = Query(None, description="clip | scene; None returns all kinds"),
        sort: str = Query("score", description="score | funny | dramatic | action | visual | laugh | length | timeline"),
    ):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            q = db.query(ClipCandidate).filter_by(video_id=video_id)
            if status:
                q = q.filter_by(status=status)
            if kind:
                q = q.filter_by(kind=kind)
            _sort_col = {
                "funny":    ClipCandidate.score_funny,
                "dramatic": ClipCandidate.score_dramatic,
                "action":   ClipCandidate.score_action,
                "visual":   ClipCandidate.score_visual,
                "laugh":    ClipCandidate.score_laugh,
            }
            if sort == "timeline":
                order = ClipCandidate.start_ms.asc()
            elif sort == "length":
                order = (ClipCandidate.end_ms - ClipCandidate.start_ms).desc()
            elif sort in _sort_col:
                order = _sort_col[sort].desc()
            else:
                # Prefer user override when set, fall back to LLM score.
                order = case(
                    (ClipCandidate.score_overall_user.isnot(None), ClipCandidate.score_overall_user),
                    else_=ClipCandidate.score_overall,
                ).desc()
            clips = q.order_by(order).all()
            return [_clip_dict(c, export_dir=ctx.export_dir, video=video, name_template=ctx.config.export_name_template) for c in clips]
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/clips")
    def create_manual_clip(video_id: int, body: ManualClipCreate):
        """Create a clip from a creator-picked time window (the manual clip picker).

        Scoring is not run here - an LLM call inside a request handler would block;
        the UI chains the existing per-clip rescore SSE immediately after creation.
        """
        from yuu_clip.segments.windower import build_excerpt_for_window

        if body.kind not in ("clip", "scene"):
            raise HTTPException(400, "kind must be 'clip' or 'scene'")
        noun = "Scene" if body.kind == "scene" else "Clip"
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            if body.start_ms < 0:
                raise HTTPException(400, f"{noun} start can't be before the beginning of the recording")
            if body.end_ms <= body.start_ms:
                raise HTTPException(400, f"{noun} end must be after the start")
            duration_ms = body.end_ms - body.start_ms
            if duration_ms < _MANUAL_CLIP_MIN_MS:
                raise HTTPException(400, f"{noun} must be at least 1 second long")
            if duration_ms > _MANUAL_CLIP_MAX_MS:
                raise HTTPException(400, f"{noun} can't be longer than 10 minutes")
            if video.duration_ms is not None and body.end_ms > video.duration_ms:
                raise HTTPException(400, f"{noun} end is beyond the end of the recording")

            clip = ClipCandidate(
                video_id=video_id,
                start_ms=body.start_ms,
                end_ms=body.end_ms,
                kind=body.kind,
                status="pending",
                transcript_excerpt=build_excerpt_for_window(video, body.start_ms, body.end_ms),
            )
            clip.tags = ["manual"]
            db.add(clip)
            db.commit()
            _log.info("Created manual %s %d for video %d (%d-%dms)", body.kind, clip.id, video_id, body.start_ms, body.end_ms)
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video, name_template=ctx.config.export_name_template)
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}")
    def get_clip(clip_id: int):
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video, name_template=ctx.config.export_name_template)
        finally:
            db.close()

    @router.get("/api/tags")
    def list_all_tags():
        """Distinct user tags across all clips, for add-a-tag autocomplete."""
        db = ctx.get_db()
        try:
            by_key: dict[str, str] = {}
            rows = (
                db.query(ClipCandidate.user_tags_json)
                .filter(ClipCandidate.user_tags_json.isnot(None))
                .all()
            )
            for (raw,) in rows:
                try:
                    for tag in json_lib.loads(raw) or []:
                        tag = str(tag).strip()
                        if tag:
                            by_key.setdefault(tag.lower(), tag)
                except (ValueError, TypeError):
                    continue
            return {"tags": sorted(by_key.values(), key=str.lower)}
        finally:
            db.close()

    @router.put("/api/clips/{clip_id}/tags")
    def set_clip_tags(clip_id: int, body: TagsBody):
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            clip.user_tags = _normalize_tags(body.tags)
            db.commit()
            _log.info("Clip %d user tags set: %s", clip_id, clip.user_tags)
            return {"id": clip.id, "user_tags": clip.user_tags}
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/status")
    def set_clip_status(clip_id: int, body: StatusUpdate):
        if body.status not in _VALID_STATUSES:
            raise HTTPException(400, f"status must be one of: {' | '.join(_VALID_STATUSES)}")
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            clip.status = body.status
            db.commit()
            return {"id": clip_id, "status": body.status}
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/export-files")
    def clip_export_files(clip_id: int):
        """Filenames the user should get when downloading this clip's export: every
        clip_exports row's video file, plus any SRT caption sidecars on disk (all
        under /media/exports/). Falls back to the legacy default-stem glob for a
        file that exists on disk but has no clip_exports row yet (a project not
        yet backfilled, or a row deleted without deleting its file)."""
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            files: list[str] = []
            seen_names: set[str] = set()
            for row_path in clip_export_row_files(clip):
                if row_path.name not in seen_names:
                    files.append(row_path.name)
                    seen_names.add(row_path.name)
            legacy_export = next(
                (p for p in export_paths(clip, video, ctx.export_dir, ctx.config.export_name_template)
                 if p.exists() and p.name not in seen_names), None
            )
            if legacy_export:
                files.append(legacy_export.name)
            files.extend(p.name for p in srt_sidecar_paths(clip, video, ctx.export_dir, ctx.config.export_name_template))
            return {"files": files}
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/media_url")
    def clip_media_url(clip_id: int):
        """Return the web-accessible URL for this clip's exported video, or null if not yet exported."""
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            export_file = next(
                (p for p in export_paths(clip, video, ctx.export_dir, ctx.config.export_name_template) if p.exists()), None
            )
            srt = srt_path(clip, video, ctx.export_dir, ctx.config.export_name_template)
            if export_file:
                return {"url": f"/media/exports/{export_file.name}", "filename": export_file.name, "has_captions": srt is not None}
            return {"url": None, "filename": None, "has_captions": False}
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/preview")
    def clip_preview(clip_id: int, request: Request):
        """Generate a seekable MP4 preview of a clip from the source video (cached on disk)."""
        cached = ctx.preview_cache.get(clip_id)
        if cached and cached.exists():
            ctx.preview_cache.move_to_end(clip_id)
            return media_file_response(cached, request, media_type="video/mp4")

        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
        finally:
            db.close()

        if not video:
            raise HTTPException(404, "Video not found")
        src = Path(video.path)
        if not src.exists():
            raise HTTPException(404, "Source video file not found on disk")

        # Prefer the 720p proxy when one is available: it shares the source's full
        # timeline (so the offset maths below are unchanged) and cuts reliably to a
        # seekable MP4, where a raw-MKV stream-copy can fail on odd codecs.
        from yuu_clip.analyze.proxy import proxy_file_for, proxy_is_fresh
        proxy_file = proxy_file_for(src, ctx.proxy_dir)
        encode_src = proxy_file if proxy_is_fresh(video, proxy_file) else src

        # clip.start_ms/end_ms are segment-relative for a split recording, but the
        # source/proxy is the untrimmed parent - add segment_start_s to land right.
        segment_offset_s = video.segment_start_s or 0
        start_s = segment_offset_s + clip.start_ms / 1000 + (clip.start_offset or 0)
        end_s = segment_offset_s + clip.end_ms / 1000 + (clip.end_offset or 0)
        duration_s = max(0.1, end_s - start_s)

        preview_dir = ctx.data_dir / "preview_cache"
        preview_dir.mkdir(exist_ok=True)
        out_path = preview_dir / f"clip_{clip_id}_preview.mp4"

        try:
            run_ffmpeg([
                "ffmpeg", "-y",
                "-ss", str(start_s),
                "-i", str(encode_src),
                "-t", str(duration_s),
                "-c", "copy",
                "-f", "mp4",
                "-movflags", "+faststart",
                str(out_path),
            ])
        except RuntimeError as exc:
            _log.error("Preview generation failed for clip %d (src=%s): %s", clip_id, src.name, exc)
            raise HTTPException(500, f"Preview generation failed: {exc}")
        if not out_path.exists():
            _log.error("Preview generation produced no file for clip %d (src=%s)", clip_id, src.name)
            raise HTTPException(500, "Preview generation failed - no output produced")

        ctx.preview_cache[clip_id] = out_path
        ctx.preview_cache.move_to_end(clip_id)
        if len(ctx.preview_cache) > _PREVIEW_CACHE_MAX:
            _, old = ctx.preview_cache.popitem(last=False)
            old.unlink(missing_ok=True)

        return media_file_response(out_path, request, media_type="video/mp4")
