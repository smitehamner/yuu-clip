"""Clip edit routes - description accept/edit/revert, score override, merge,
timing, vertical framing (manual + auto), and vision frame analysis.
"""
from __future__ import annotations

import asyncio
import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from yuu_clip.db.models import Video
from yuu_clip.export.paths import all_sidecar_paths, clip_export_row_files
from yuu_clip.export.window import EMPTY_WINDOW_MESSAGE, window_is_empty
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
from yuu_clip.web.routes.common import (
    reject_if_busy,
    require_clip,
    require_clip_with_source,
)
from yuu_clip.web.sse import subprocess_sse, terminate_process_tree_async

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
        """Set start_offset and end_offset (seconds) on a clip.

        Rejects a trim whose offsets cross over each other. The export dialog's
        trim fields are free text, so this is reachable by typing (e.g. -20 into
        the End box of a 20s clip); left unchecked it reaches ffmpeg as a
        zero-length cut, which succeeds and yields a fraction-of-a-second file.
        """
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            clip.start_offset = body.start_offset
            clip.end_offset   = body.end_offset
            if window_is_empty(clip):
                db.rollback()
                raise HTTPException(400, EMPTY_WINDOW_MESSAGE)
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
            clip, video = require_clip_with_source(db, clip_id)
            src = Path(video.path)
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

    async def _ensure_vision_server_url(clip_id: int) -> str:
        """Ensure the web server's warm vision llama-server is up and return its base
        URL for the subprocess to POST to. Offloaded so a first-run cold model load
        never blocks the event loop. 503 if the server cannot be started."""
        from yuu_clip.scoring.llamacpp_server import get_server_pool

        config = ctx.config
        try:
            return await asyncio.to_thread(
                get_server_pool().ensure_server_url,
                config,
                model_path=config.llm_vision_model_path,
                mmproj_path=config.llm_mmproj_path,
            )
        except Exception as exc:
            _log.error(
                "Could not start the vision model server for clip %d: %s",
                clip_id, exc, exc_info=True,
            )
            raise HTTPException(
                503, "Image analysis unavailable - the vision model could not be started"
            )

    @router.post("/api/clips/{clip_id}/analyze-frames")
    async def analyze_frames(clip_id: int):
        """Sample frames from the clip window, send them to the vision model, and store
        a short 'what's on screen' summary. Runs as a killable subprocess
        (pipeline/frame_analysis.py) that POSTs to the web server's warm vision
        llama-server, so a long inference on a large model can be cancelled - killing
        the subprocess drops the connection and generation stops, while the model stays
        warm for the next run. Streamed as SSE with two stages (sampling -> describing);
        counted (active_job via track_active_job) and serialized via reject_if_busy.
        503 when no vision-capable model is configured. Re-running overwrites the summary.
        """
        from yuu_clip.scoring.llm import check_vision_available

        reject_if_busy(ctx, "Image analysis")
        vision_ok, reason = check_vision_available(ctx.config)
        if not vision_ok:
            raise HTTPException(503, f"Image analysis unavailable - {reason}")

        db = ctx.get_db()
        try:
            require_clip_with_source(db, clip_id)
        finally:
            db.close()

        base_url = await _ensure_vision_server_url(clip_id)
        cmd = [
            sys.executable, "-m", "yuu_clip.pipeline.frame_analysis",
            "--clip-id", str(clip_id), "--project", str(ctx.project_dir),
            "--base-url", base_url,
        ]
        return await subprocess_sse(
            cmd, ctx.project_dir, ctx,
            track_active_job=True, job_kind="frames",
        )

    @router.post("/api/clips/{clip_id}/analyze-frames/cancel")
    async def cancel_analyze_frames(clip_id: int):
        """Cancel a running frame-analysis subprocess by killing its process tree, which
        drops the llama-server connection so generation stops. clip_id is only for a
        clean per-clip URL - one frame job runs at a time (reject_if_busy)."""
        proc = ctx.analyze_proc
        if proc is not None and proc.returncode is None and ctx.analyze_proc_kind == "frames":
            ctx.cancelled_procs.add(proc)
            _log.info("Image analysis cancelled by user (clip %d)", clip_id)
            await terminate_process_tree_async(proc)
        return {"status": "cancelled"}
