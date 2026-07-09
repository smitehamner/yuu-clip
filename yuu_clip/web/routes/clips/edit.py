"""Clip edit routes - description accept/edit/revert, score override, merge,
timing, vertical framing (manual + auto), and vision frame analysis.
"""
from __future__ import annotations

import asyncio
import importlib.util
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.export.paths import all_sidecar_paths, clip_export_row_files
from yuu_clip.log import get_logger
from yuu_clip.scoring.dedup import DUPLICATE_TAG
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.file_deletion import delete_files
from yuu_clip.web.routes.clips.schemas import (
    ClipFieldsUpdate,
    ClipFramingUpdate,
    ClipMergeRequest,
    ClipScoreOverride,
    ClipTimingUpdate,
)
from yuu_clip.web.routes.clips.serialize import _clip_dict
from yuu_clip.web.routes.common import json_list, reject_if_analyzing, require_clip

_log = get_logger(__name__)


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.patch("/api/clips/{clip_id}/fields")
    def update_clip_fields(clip_id: int, body: ClipFieldsUpdate):
        """Commit the user's accept/edit/revert choice from the diff modal."""
        if body.action not in ("accept_new", "accept_edit", "revert"):
            raise HTTPException(400, "action must be accept_new | accept_edit | revert")
        if body.field not in ("description", "description_long", "both"):
            raise HTTPException(400, "field must be description | description_long | both")
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
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

            # description_edited_at only tracks the short description - that's the
            # only one burned into a title card export.
            if touch_desc:
                clip.description_edited_at = datetime.now(timezone.utc)

            db.commit()
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video, name_template=ctx.config.export_name_template)
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
            clip = require_clip(db, clip_id)
            clip.score_overall_user = val
            db.commit()
            video = db.get(Video, clip.video_id)
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video, name_template=ctx.config.export_name_template)
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/merge")
    def merge_clips(clip_id: int, body: ClipMergeRequest):
        """Merge clip_b into clip_a: extends clip_a's end to clip_b's end, then deletes clip_b."""
        db = ctx.get_db()
        try:
            clip_a = require_clip(db, clip_id)
            clip_b = require_clip(db, body.clip_b_id)
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
            clip_a.exported_embed_subs = None
            clip_a.exported_title_card = None
            # The merged window makes any prior possible-duplicate flag stale
            # (its specific partner is now gone); a re-scan re-flags if it still
            # overlaps a third clip.
            clip_a.tags = [tag for tag in clip_a.tags if tag != DUPLICATE_TAG]

            video = db.get(Video, clip_a.video_id)
            delete_files([
                *all_sidecar_paths(clip_b, video, ctx.export_dir, ctx.config.export_name_template),
                *clip_export_row_files(clip_b),
            ])
            delete_files([
                *all_sidecar_paths(clip_a, video, ctx.export_dir, ctx.config.export_name_template),
                *clip_export_row_files(clip_a),
            ])
            # clip_b's rows cascade with its delete below; clip_a keeps its id but its
            # merged window invalidates every format it had, same as the legacy fields above.
            for row in list(clip_a.exports):
                db.delete(row)
            db.delete(clip_b)
            db.commit()

            for _cid in (clip_id, body.clip_b_id):
                _cached = ctx.preview_cache.pop(_cid, None)
                if _cached:
                    _cached.unlink(missing_ok=True)

            _log.info("Merged clip %d into clip %d (new range %d-%d ms)", body.clip_b_id, clip_id, start_ms, end_ms)
            return _clip_dict(clip_a, full=True, export_dir=ctx.export_dir, video=video, name_template=ctx.config.export_name_template)
        finally:
            db.close()

    @router.patch("/api/clips/{clip_id}/timing")
    def update_clip_timing(clip_id: int, body: ClipTimingUpdate):
        """Set start_offset and end_offset (seconds) on a clip."""
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            clip.start_offset = body.start_offset
            clip.end_offset   = body.end_offset
            clip.trim_edited_at = datetime.now(timezone.utc)
            db.commit()
            # Invalidate the cached preview so the next request reflects the new timing.
            cached = ctx.preview_cache.pop(clip_id, None)
            if cached:
                cached.unlink(missing_ok=True)
            return {"start_offset": clip.start_offset, "end_offset": clip.end_offset}
        finally:
            db.close()

    @router.patch("/api/clips/{clip_id}/framing")
    def update_clip_framing(clip_id: int, body: ClipFramingUpdate):
        """Set the vertical (9:16) crop position on a clip. crop_x is clamped to
        0..1 (None = center). Moves pixels the same way a trim does, so it stamps
        trim_edited_at to flag any existing vertical export as stale."""
        crop_x = None if body.crop_x is None else round(max(0.0, min(1.0, body.crop_x)), 4)
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            clip.crop_x = crop_x
            clip.trim_edited_at = datetime.now(timezone.utc)
            db.commit()
            return {"id": clip_id, "crop_x": clip.crop_x}
        finally:
            db.close()

    @router.post("/api/clips/{clip_id}/suggest-framing")
    async def suggest_framing(clip_id: int):
        """Suggest a vertical (9:16) crop position by finding the median face
        position across sampled frames (MediaPipe). Returns {crop_x: float|null}
        - null when no face is found; the creator still confirms before it sticks.

        503 when the MediaPipe package isn't present - it's bundled with yuu-clip
        by default, so this only fires on a broken/partial install. The detection
        runs off the event loop via asyncio.to_thread - it is CPU-bound frame
        extraction + inference.
        """
        if importlib.util.find_spec("mediapipe") is None:
            raise HTTPException(
                503,
                "Auto-framing needs the MediaPipe package, which should be bundled "
                "with yuu-clip - try reinstalling if this persists.",
            )
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            src = Path(video.path)
            if not src.exists():
                raise HTTPException(404, "Source video file not found on disk")
            from yuu_clip.analyze.proxy import proxy_file_for, proxy_is_fresh
            proxy_file = proxy_file_for(src, ctx.proxy_dir)
            encode_src = proxy_file if proxy_is_fresh(video, proxy_file) else src
            segment_offset_s = video.segment_start_s or 0
            start_s = segment_offset_s + clip.start_ms / 1000 + (clip.start_offset or 0)
            end_s = segment_offset_s + clip.end_ms / 1000 + (clip.end_offset or 0)
            source_w, source_h = video.width, video.height
        finally:
            db.close()

        from yuu_clip.analyze.framing import suggest_crop_x
        try:
            crop_x = await asyncio.to_thread(
                suggest_crop_x, encode_src, start_s, end_s, source_w, source_h
            )
        except Exception as exc:
            _log.error("Auto-framing failed for clip %d: %s", clip_id, exc, exc_info=True)
            raise HTTPException(500, "Auto-framing failed - see the log for details")
        return {"crop_x": crop_x}

    @router.post("/api/clips/{clip_id}/analyze-frames")
    async def analyze_frames(clip_id: int):
        """Sample frames from the clip window, send them to the vision model, and store
        a short 'what's on screen' summary that enriches descriptions and gives the text
        scorer visual context. In-process (asyncio.to_thread) - seconds, not minutes, so
        no SSE. 503 when no vision-capable model is configured. Re-running
        overwrites the previous summary.
        """
        from yuu_clip.analyze.frames import (
            clamp_frame_count,
            resolve_frame_window,
            sample_and_describe,
        )
        from yuu_clip.contexts import format_context_block, load_contexts
        from yuu_clip.scoring.llm import check_vision_available
        from yuu_clip.scoring.llm_client import VisionNotSupportedError

        reject_if_analyzing(ctx)
        vision_ok, reason = check_vision_available(ctx.config)
        if not vision_ok:
            raise HTTPException(503, f"Image analysis unavailable - {reason}")

        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            if not Path(video.path).exists():
                raise HTTPException(404, "Source video file not found on disk")
            encode_src, start_s, end_s = resolve_frame_window(video, clip, ctx.proxy_dir)
            frame_count = clamp_frame_count(ctx.config)
            context_names = json_list(video.context_names_json)
        finally:
            db.close()

        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)
        started = time.monotonic()
        try:
            summary = await asyncio.to_thread(
                sample_and_describe, encode_src, start_s, end_s,
                frame_count, ctx.config, context_text,
            )
        except VisionNotSupportedError as exc:
            raise HTTPException(503, f"Image analysis unavailable - {exc}")
        except Exception as exc:
            _log.error("Frame analysis failed for clip %d: %s", clip_id, exc, exc_info=True)
            raise HTTPException(500, "Image analysis failed - see the log for details")
        if not summary:
            raise HTTPException(502, "The vision model returned an empty description - try again")
        elapsed_s = round(time.monotonic() - started, 1)

        save_db = ctx.get_db()
        try:
            stored = save_db.get(ClipCandidate, clip_id)
            if not stored:
                raise HTTPException(404, "Clip not found")
            stored.vision_summary = summary
            stored.vision_analyzed_at = datetime.now(timezone.utc)
            save_db.commit()
            analyzed_at = stored.vision_analyzed_at
        finally:
            save_db.close()
        _log.info("Analyzed %d frame(s) for clip %d in %.1fs", frame_count, clip_id, elapsed_s)
        return {
            "clip_id": clip_id,
            "vision_summary": summary,
            "vision_analyzed_at": analyzed_at.isoformat(),
            "elapsed_s": elapsed_s,
        }
