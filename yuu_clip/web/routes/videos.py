"""
Video and clip CRUD routes.

Handles listing videos, listing clips for a video, fetching clip detail,
updating clip review status (approved/rejected/pending), and resolving the
exported media URL for the in-browser player.
"""
from __future__ import annotations

import asyncio
import json as json_lib
import re
import subprocess as _subprocess
import sys
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import case, func

from yuu_clip.contexts import format_context_block, load_contexts
from yuu_clip.db.models import AudioEnergy, AudioTrack, ClipCandidate, SceneBoundary, Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)

_VALID_STATUSES = ("approved", "rejected", "pending")


class StatusUpdate(BaseModel):
    status: str  # approved | rejected | pending


class ContextAssignment(BaseModel):
    context_names: list[str]


class VideoFieldsUpdate(BaseModel):
    action: str                          # accept_new | accept_edit | revert
    field: str                           # title | summary | both
    new_title: Optional[str] = None
    new_summary: Optional[str] = None


class ClipFieldsUpdate(BaseModel):
    action: str                          # accept_new | accept_edit | revert
    field: str                           # description | description_long | both
    new_description: Optional[str] = None
    new_description_long: Optional[str] = None


class ClipTimingUpdate(BaseModel):
    start_offset: float
    end_offset: float


_AUTO_APPROVE_FIELDS = {
    "overall":  ClipCandidate.score_overall,
    "funny":    ClipCandidate.score_funny,
    "dramatic": ClipCandidate.score_dramatic,
    "action":   ClipCandidate.score_action,
}


class AutoApproveBody(BaseModel):
    threshold: float
    score_field: str = "overall"


class ConfigPatch(BaseModel):
    # UI
    ui_timeline_interval_seconds: Optional[int]   = None
    ui_timeline_interval_unit:    Optional[str]   = None
    # Whisper
    whisper_model:                Optional[str]   = None
    whisper_device:               Optional[str]   = None
    whisper_compute_type:         Optional[str]   = None
    # LLM backend
    llm_backend:                  Optional[str]   = None
    llm_model_path:               Optional[str]   = None
    # Ollama
    ollama_host:                  Optional[str]   = None
    ollama_model:                 Optional[str]   = None
    ollama_timeout_s:             Optional[float] = None
    ollama_enabled:               Optional[bool]  = None
    # Scoring weights
    scorer_energy_weight:         Optional[float] = None
    scorer_scene_weight:          Optional[float] = None
    scorer_llm_weight:            Optional[float] = None
    score_funny_weight:           Optional[float] = None
    score_dramatic_weight:        Optional[float] = None
    score_action_weight:          Optional[float] = None
    # Analysis defaults
    scene_detection_mode:         Optional[str]   = None
    silence_threshold_ms:         Optional[int]   = None
    min_clip_ms:                  Optional[int]   = None


@asynccontextmanager
async def _active_job(ctx):
    ctx.active_jobs += 1
    try:
        yield
    finally:
        ctx.active_jobs -= 1


_CONFIG_FIELDS = (
    "ui_timeline_interval_seconds", "ui_timeline_interval_unit",
    "whisper_model", "whisper_device", "whisper_compute_type",
    "llm_backend", "llm_model_path",
    "ollama_host", "ollama_model", "ollama_timeout_s", "ollama_enabled",
    "scorer_energy_weight", "scorer_scene_weight", "scorer_llm_weight",
    "score_funny_weight", "score_dramatic_weight", "score_action_weight",
    "scene_detection_mode", "silence_threshold_ms", "min_clip_ms",
)


def _enum_validator(allowed: set, label: str):
    def _v(v):
        if v not in allowed:
            raise HTTPException(400, f"{label} must be one of: {sorted(allowed)}")
        return v
    return _v


def _min_validator(minimum, label: str):
    def _v(v):
        if v < minimum:
            raise HTTPException(400, f"{label} must be >= {minimum}")
        return v
    return _v


def _whisper_model_validator(v: str) -> str:
    from yuu_clip.config import validate_whisper_model
    try:
        validate_whisper_model(v)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return v


_CONFIG_PATCH_RULES: list[tuple[str, object]] = [
    ("ui_timeline_interval_seconds", _min_validator(10,   "interval")),
    ("ui_timeline_interval_unit",    _enum_validator({"seconds", "minutes"}, "unit")),
    ("whisper_model",                _whisper_model_validator),
    ("whisper_device",               _enum_validator({"cpu", "cuda", "auto"}, "whisper_device")),
    ("whisper_compute_type",         _enum_validator({"int8", "float16", "float32", "int8_float16"}, "whisper_compute_type")),
    ("llm_backend",                  _enum_validator({"llamacpp", "ollama"}, "llm_backend")),
    ("llm_model_path",               lambda v: v),
    ("ollama_host",                  lambda v: v.strip()),
    ("ollama_model",                 lambda v: v.strip()),
    ("ollama_timeout_s",             _min_validator(1,    "ollama_timeout_s")),
    ("ollama_enabled",               lambda v: v),
    ("scorer_energy_weight",         lambda v: max(0.0, v)),
    ("scorer_scene_weight",          lambda v: max(0.0, v)),
    ("scorer_llm_weight",            lambda v: max(0.0, v)),
    ("score_funny_weight",           lambda v: max(0.0, v)),
    ("score_dramatic_weight",        lambda v: max(0.0, v)),
    ("score_action_weight",          lambda v: max(0.0, v)),
    ("scene_detection_mode",         _enum_validator({"transcript", "fast", "full"}, "scene_detection_mode")),
    ("silence_threshold_ms",         _min_validator(500,  "silence_threshold_ms")),
    ("min_clip_ms",                  _min_validator(1000, "min_clip_ms")),
]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/videos")
    def list_videos():
        db = ctx.get_db()
        try:
            videos = db.query(Video).order_by(Video.created_at.desc()).all()
            stats = _bulk_clip_stats(db, [v.id for v in videos])
            return [_video_dict(v, stats.get(v.id, _EMPTY_STATS)) for v in videos]
        finally:
            db.close()

    @router.get("/api/videos/{video_id}")
    def get_video(video_id: int):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            stats = _bulk_clip_stats(db, [video_id])
            result = _video_dict(video, stats.get(video_id, _EMPTY_STATS))
            result["timeline"] = json_lib.loads(video.timeline_json) if video.timeline_json else None
            return result
        finally:
            db.close()

    @router.patch("/api/videos/{video_id}/contexts")
    def set_video_contexts(video_id: int, body: ContextAssignment):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            video.context_names_json = json_lib.dumps(body.context_names)
            db.commit()
            return {"context_names": body.context_names}
        finally:
            db.close()

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

    @router.get("/api/videos/{video_id}/rescore-clips")
    async def rescore_clips(video_id: int):
        """Re-run LLM scoring for all clips using the video's current context. Streams progress as SSE."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            context_names = _json_list(video.context_names_json)
            clips = (
                db.query(ClipCandidate)
                .filter_by(video_id=video_id)
                .order_by(ClipCandidate.start_ms)
                .all()
            )
            clip_ids = [c.id for c in clips]
        finally:
            db.close()

        contexts = load_contexts(ctx.project_dir)
        context_text = format_context_block(contexts, context_names)
        config = ctx.config

        async def event_stream():
            from yuu_clip.scoring.engine import ScoringEngine
            from yuu_clip.scoring.llm import LLMScorer

            async with _active_job(ctx):
                total = len(clip_ids)
                engine = ScoringEngine(config, [LLMScorer(config, context_text=context_text)])

                for i, clip_id in enumerate(clip_ids, 1):
                    score_db = ctx.get_db()
                    error = None
                    try:
                        clip = score_db.get(ClipCandidate, clip_id)
                        if clip:
                            await asyncio.to_thread(engine.score_clip, clip, score_db)
                            score_db.commit()
                    except Exception as exc:
                        score_db.rollback()
                        error = str(exc)
                        _log.error("rescore_clips: clip %d failed for video %d: %s", clip_id, video_id, exc, exc_info=True)
                    finally:
                        score_db.close()
                    if error:
                        yield f"data: {json_lib.dumps(f'[Error scoring clip {clip_id}: {error}]')}\n\n"
                    else:
                        yield f"data: {json_lib.dumps(f'Scored {i}/{total} clips')}\n\n"

                prov_db = ctx.get_db()
                try:
                    v = prov_db.get(Video, video_id)
                    if v:
                        v.clips_scored_at = datetime.now(timezone.utc)
                        v.clips_scored_context_json = json_lib.dumps(context_names)
                        prov_db.commit()
                finally:
                    prov_db.close()

                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return _sse_response(event_stream())

    @router.get("/api/config")
    def get_config():
        c = ctx.config
        return {k: getattr(c, k) for k in _CONFIG_FIELDS}

    @router.patch("/api/config")
    def patch_config(body: ConfigPatch):
        cfg = ctx.config
        for field_name, transform in _CONFIG_PATCH_RULES:
            val = getattr(body, field_name)
            if val is not None:
                setattr(cfg, field_name, transform(val))
        cfg.save_project(ctx.project_dir)
        _log.info("Config updated: %s", {k: v for k, v in body.model_dump().items() if v is not None})
        return get_config()

    @router.get("/api/videos/{video_id}/timeline")
    async def stream_timeline(video_id: int, interval_s: Optional[int] = Query(None)):
        """Generate a session timeline by chunking the transcript and calling Ollama.
        Streams each entry as an SSE event as it completes."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            tracks = db.query(AudioTrack).filter_by(video_id=video_id, do_transcribe=True).all()
            all_segs = []
            for track in tracks:
                for tx in track.transcripts:
                    all_segs.extend(tx.segments)
            all_segs.sort(key=lambda s: s.start_ms)

            if not all_segs:
                raise HTTPException(400, "No transcript available — analyze the recording first")

            # Extract raw data before closing the session
            context_names = _json_list(video.context_names_json)
            seg_data = [(s.start_ms, s.end_ms, s.text) for s in all_segs]
            clips = (
                db.query(ClipCandidate)
                .filter_by(video_id=video_id)
                .order_by(ClipCandidate.start_ms)
                .all()
            )
            clip_data = [(c.start_ms, c.end_ms, c.description) for c in clips if c.description]
            total_ms = seg_data[-1][1] if seg_data else 0
        finally:
            db.close()

        config = ctx.config
        from yuu_clip.scoring.llm import check_llm_available
        llm_ok, llm_reason = check_llm_available(config)
        if not llm_ok:
            raise HTTPException(503, f"LLM unavailable — {llm_reason}")

        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)

        effective_interval_s = interval_s if interval_s is not None else ctx.config.ui_timeline_interval_seconds
        effective_interval_s = max(10, effective_interval_s)

        async def event_stream():
            from yuu_clip.scoring.llm import generate_timeline_chunk
            async with _active_job(ctx):
                chunk_ms = effective_interval_s * 1000
                entries = []

                for chunk_start in range(0, total_ms + 1, chunk_ms):
                    chunk_end = min(chunk_start + chunk_ms, total_ms + 1)
                    chunk_segs = [(t, ms) for ms, end_ms, t in seg_data if ms >= chunk_start and ms < chunk_end]
                    if not chunk_segs:
                        continue

                    chunk_text = " ".join(t.strip() for t, _ in chunk_segs)
                    window_clips = [desc for s, e, desc in clip_data if s >= chunk_start and s < chunk_end]
                    start_hms = _ms_to_hms(chunk_start)
                    end_hms = _ms_to_hms(min(chunk_end, total_ms))

                    try:
                        entry_text = await asyncio.to_thread(
                            generate_timeline_chunk, chunk_text, start_hms, end_hms, window_clips, config, context_text
                        )
                    except Exception as exc:
                        _log.error("timeline chunk %s–%s failed for video %d: %s", start_hms, end_hms, video_id, exc, exc_info=True)
                        entry_text = f"[Error generating entry: {exc}]"

                    entry = {"start_hms": start_hms, "end_hms": end_hms, "text": entry_text}
                    entries.append(entry)
                    yield f"data: {json_lib.dumps(entry)}\n\n"

                save_db = ctx.get_db()
                try:
                    v = save_db.get(Video, video_id)
                    if v:
                        v.timeline_json = json_lib.dumps(entries)
                        v.timeline_generated_at = datetime.now(timezone.utc)
                        v.timeline_context_json = json_lib.dumps(context_names)
                        save_db.commit()
                finally:
                    save_db.close()

                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return _sse_response(event_stream())

    @router.post("/api/videos/{video_id}/summarize")
    def summarize_video(video_id: int):
        """Generate title + summary via Ollama and return them for the compare modal.

        Does NOT write to the DB — the caller commits via PATCH /fields after the
        user accepts the result in the diff modal.
        """
        from yuu_clip.scoring.llm import summarize_transcript
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            context_names = _json_list(video.context_names_json)
            tracks = db.query(AudioTrack).filter_by(video_id=video_id, do_transcribe=True).all()
            all_segs = []
            for track in tracks:
                for tx in track.transcripts:
                    all_segs.extend(tx.segments)
            all_segs.sort(key=lambda s: s.start_ms)
            full_text = " ".join(s.text.strip() for s in all_segs)

            if not full_text:
                raise HTTPException(400, "No transcript available — analyze the recording first")

            title_current   = _user_or_default(video.title_user, video.title)
            summary_current = _user_or_default(video.summary_user, video.summary)

            context_text = format_context_block(load_contexts(ctx.project_dir), context_names)
            try:
                title_new, summary_new = summarize_transcript(
                    full_text, ctx.config, context_text=context_text
                )
            except Exception as exc:
                _log.warning("Ollama summarize failed for video %d: %s", video_id, exc)
                raise HTTPException(502, f"Ollama error: {exc}")

            return {
                "title_new": title_new,
                "summary_new": summary_new,
                "title_current": title_current,
                "summary_current": summary_current,
            }
        finally:
            db.close()

    @router.patch("/api/videos/{video_id}/fields")
    def update_video_fields(video_id: int, body: VideoFieldsUpdate):
        """Commit the user's accept/edit/revert choice from the diff modal."""
        if body.action not in ("accept_new", "accept_edit", "revert"):
            raise HTTPException(400, "action must be accept_new | accept_edit | revert")
        if body.field not in ("title", "summary", "both"):
            raise HTTPException(400, "field must be title | summary | both")
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            touch_title   = body.field in ("title",   "both")
            touch_summary = body.field in ("summary", "both")

            if body.action == "accept_new":
                if touch_title:
                    video.title      = body.new_title
                    video.title_user = None
                if touch_summary:
                    video.summary      = body.new_summary
                    video.summary_user = None
                video.summarized_at        = datetime.now(timezone.utc)
                video.summary_context_json = json_lib.dumps(
                    _json_list(video.context_names_json)
                )
            elif body.action == "accept_edit":
                if touch_title:
                    video.title_user = body.new_title
                if touch_summary:
                    video.summary_user = body.new_summary
            else:  # revert
                if touch_title:
                    video.title_user = None
                if touch_summary:
                    video.summary_user = None

            db.commit()
            stats = _bulk_clip_stats(db, [video_id]).get(video_id, _EMPTY_STATS)
            return _video_dict(video, stats)
        finally:
            db.close()

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
                order = ClipCandidate.score_overall.desc()
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

    @router.delete("/api/videos/{video_id}")
    def delete_video(video_id: int):
        """Remove a video and all its data from the database. Source file is NOT deleted."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            # Delete exported clip files from disk before removing DB records
            clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            for clip in clips:
                for p in _all_sidecar_paths(clip, video, ctx.export_dir):
                    p.unlink(missing_ok=True)

            # AudioEnergy and SceneBoundary have no Python-level cascade; delete explicitly
            track_ids = [t.id for t in video.audio_tracks]
            if track_ids:
                db.query(AudioEnergy).filter(
                    AudioEnergy.audio_track_id.in_(track_ids)
                ).delete(synchronize_session=False)
            db.query(SceneBoundary).filter(
                SceneBoundary.video_id == video_id
            ).delete(synchronize_session=False)

            db.delete(video)  # cascades: ClipCandidate, AudioTrack → Transcript → TranscriptSegment
            db.commit()
            _log.info("Deleted video %d (%s) and %d exported clip(s)", video_id, video.filename, len(clips))
            return {"deleted": video_id}
        finally:
            db.close()

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

    @router.get("/api/videos/{video_id}/batch-export")
    async def batch_export(
        video_id: int,
        min_score: float = Query(0.0),
        skip_exported: bool = Query(True),
        burn_subs: bool = Query(False),
        container: Optional[str] = Query(None),
    ):
        """Export all approved clips for a video above min_score, streaming per-clip progress as SSE."""
        import asyncio as _asyncio
        import subprocess as _sp

        allowed_containers = {"mkv", "mp4"}
        if container is not None and container not in allowed_containers:
            raise HTTPException(400, f"container must be one of {sorted(allowed_containers)}")

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
                    already_exported = False
                    if skip_exported:
                        check_db = ctx.get_db()
                        try:
                            clip = check_db.get(ClipCandidate, cid)
                            vid  = check_db.get(Video, video_id) if clip else None
                            if clip and vid:
                                already_exported = any(
                                    p.exists() for p in _export_paths(clip, vid, ctx.export_dir)
                                )
                        finally:
                            check_db.close()
                    if already_exported:
                        skipped += 1
                        yield f"data: {json_lib.dumps(f'Skipping clip {cid} (already exported) [{i}/{total}]')}\n\n"
                        continue

                    yield f"data: {json_lib.dumps(f'Exporting clip {cid} [{i}/{total}]...')}\n\n"
                    cmd = [
                        sys.executable, "-m", "yuu_clip.cli", "export", str(cid),
                        "--captions", "--project", str(ctx.project_dir),
                    ]
                    if burn_subs:
                        cmd.append("--bake-captions")
                    if container:
                        cmd.extend(["--container", container])
                    try:
                        proc = await _asyncio.create_subprocess_exec(
                            *cmd,
                            stdout=_sp.PIPE,
                            stderr=_sp.STDOUT,
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
                    clip.description      = body.new_description
                    clip.description_user = None
                if touch_desc_long:
                    clip.description_long      = body.new_description_long
                    clip.description_long_user = None
            elif body.action == "accept_edit":
                if touch_desc:
                    clip.description_user = body.new_description
                if touch_desc_long:
                    clip.description_long_user = body.new_description_long
            else:  # revert
                if touch_desc:
                    clip.description_user = None
                if touch_desc_long:
                    clip.description_long_user = None

            db.commit()
            return _clip_dict(clip, full=True, export_dir=ctx.export_dir, video=video)
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

    @router.get("/api/clips/{clip_id}/rescore")
    async def rescore_clip(clip_id: int):
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            context_names = _json_list(video.context_names_json)
        finally:
            db.close()

        contexts = load_contexts(ctx.project_dir)
        context_text = format_context_block(contexts, context_names)
        config = ctx.config

        async def event_stream():
            from yuu_clip.scoring.engine import ScoringEngine
            from yuu_clip.scoring.llm import LLMScorer

            async with _active_job(ctx):
                engine = ScoringEngine(config, [LLMScorer(config, context_text=context_text)])
                score_db = ctx.get_db()
                error = None
                desc_new = desc_long_new = None
                try:
                    clip = score_db.get(ClipCandidate, clip_id)
                    if clip:
                        # Snapshot existing description values before scoring so we
                        # can restore them — scores are committed, descriptions go
                        # back to the frontend for the compare modal instead.
                        old_desc      = clip.description
                        old_desc_long = clip.description_long
                        await asyncio.to_thread(engine.score_clip, clip, score_db)
                        desc_new      = clip.description
                        desc_long_new = clip.description_long
                        clip.description      = old_desc
                        clip.description_long = old_desc_long
                        score_db.commit()
                except Exception as exc:
                    score_db.rollback()
                    error = str(exc)
                    _log.error("rescore_clip: clip %d failed: %s", clip_id, exc, exc_info=True)
                finally:
                    score_db.close()

                if error:
                    yield f"data: {json_lib.dumps(f'[Error: {error}]')}\n\n"
                else:
                    yield f"data: {json_lib.dumps('Scored clip')}\n\n"
                done_payload = {
                    "type": "__DONE__",
                    "description_new": desc_new,
                    "description_long_new": desc_long_new,
                }
                yield f"data: {json_lib.dumps(done_payload)}\n\n"

        return _sse_response(event_stream())

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

    return router


def _user_or_default(user_val: Optional[str], stored_val: Optional[str]) -> str:
    """Return the user-edited override if set, otherwise the stored value (or empty string)."""
    return user_val if user_val is not None else (stored_val or "")


def _require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def _clip_stem(clip: ClipCandidate, video: Video) -> str:
    """Base filename stem shared by the exported video and its SRT sidecar."""
    return f"{Path(video.filename).stem}_clip{clip.id}_{clip.start_hms.replace(':', '-')}"


def _export_paths(clip: ClipCandidate, video: Video, export_dir: Path) -> list[Path]:
    """Return all candidate export file paths for a clip (any supported container extension)."""
    stem = _clip_stem(clip, video)
    return [export_dir / f"{stem}{ext}" for ext in (".mkv", ".mp4", ".mov", ".avi", ".webm")]


def _srt_path(clip: ClipCandidate, video: Video, export_dir: Path) -> Optional[Path]:
    p = export_dir / f"{_clip_stem(clip, video)}.srt"
    return p if p.exists() else None


def _all_sidecar_paths(clip: ClipCandidate, video: Video, export_dir: Path) -> list[Path]:
    """All on-disk sidecar paths for a clip: video exports + SRT (if it exists)."""
    srt = _srt_path(clip, video, export_dir)
    return [*_export_paths(clip, video, export_dir), *([] if srt is None else [srt])]


def _ms_to_hms(ms: int) -> str:
    s = ms // 1000
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _srt_to_vtt(srt: str) -> str:
    vtt = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)
    return f"WEBVTT\n\n{vtt}"


_EMPTY_STATS = {"clip_count": 0, "approved": 0, "total_clip_ms": 0}
_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

# LRU cache of preview temp files keyed by clip_id. Evicts oldest when full.
_preview_cache: OrderedDict[int, Path] = OrderedDict()
_PREVIEW_CACHE_MAX = 10


def _sse_response(generator) -> StreamingResponse:
    return StreamingResponse(generator, media_type="text/event-stream", headers=_SSE_HEADERS)


def _json_list(s: Optional[str]) -> list:
    """Decode a JSON-encoded list column, returning [] for NULL/missing values."""
    return json_lib.loads(s) if s else []


def _bulk_clip_stats(db, video_ids: list[int]) -> dict[int, dict]:
    """Return clip aggregate stats for each video_id in a single query."""
    if not video_ids:
        return {}
    rows = (
        db.query(
            ClipCandidate.video_id,
            func.count().label("clip_count"),
            func.sum(case((ClipCandidate.status == "approved", 1), else_=0)).label("approved"),
            func.sum(ClipCandidate.end_ms - ClipCandidate.start_ms).label("total_clip_ms"),
        )
        .filter(ClipCandidate.video_id.in_(video_ids))
        .group_by(ClipCandidate.video_id)
        .all()
    )
    return {
        row.video_id: {
            "clip_count":    row.clip_count,
            "approved":      row.approved,
            "total_clip_ms": row.total_clip_ms or 0,
        }
        for row in rows
    }


def _video_dict(video: Video, stats: dict) -> dict:
    return {
        "id": video.id,
        "filename": video.filename,
        "status": video.status,
        "duration_hms": video.duration_hms,
        "duration_ms": video.duration_ms or 0,
        "clip_count": stats["clip_count"],
        "approved": stats["approved"],
        "total_clip_ms": stats["total_clip_ms"],
        "title": _user_or_default(video.title_user, video.title),
        "title_original": video.title or "",
        "title_is_edited": video.title_user is not None,
        "summary": _user_or_default(video.summary_user, video.summary),
        "summary_original": video.summary or "",
        "summary_is_edited": video.summary_user is not None,
        "has_timeline": bool(video.timeline_json),
        "context_names": _json_list(video.context_names_json),
        "clips_scored_at": video.clips_scored_at.isoformat() if video.clips_scored_at else None,
        "clips_scored_context": _json_list(video.clips_scored_context_json),
        "summarized_at": video.summarized_at.isoformat() if video.summarized_at else None,
        "summary_context": _json_list(video.summary_context_json),
        "timeline_generated_at": video.timeline_generated_at.isoformat() if video.timeline_generated_at else None,
        "timeline_context": _json_list(video.timeline_context_json),
    }


def _subtitle_status(clip: ClipCandidate, video: Optional[Video], export_dir: Optional[Path]) -> str:
    if clip.exported_burn_subs:
        return "baked-in"
    if export_dir and video and _srt_path(clip, video, export_dir) is not None:
        return "srt-sidecar"
    return "none"


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
    }
    if full:
        d["transcript_excerpt"] = clip.transcript_excerpt or ""
    return d
