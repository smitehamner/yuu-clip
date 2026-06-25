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
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func

from rp_clipper.contexts import format_context_block, load_contexts
from rp_clipper.db.models import AudioEnergy, AudioTrack, ClipCandidate, SceneBoundary, Video
from rp_clipper.web.deps import ProjectContext

_VALID_STATUSES = ("approved", "rejected", "pending")


class StatusUpdate(BaseModel):
    status: str  # approved | rejected | pending


class ContextAssignment(BaseModel):
    context_names: list[str]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/videos")
    def list_videos():
        db = ctx.get_db()
        try:
            videos = db.query(Video).order_by(Video.created_at.desc()).all()
            return [_video_dict(v, db) for v in videos]
        finally:
            db.close()

    @router.get("/api/videos/{video_id}")
    def get_video(video_id: int):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            result = _video_dict(video, db)
            if video.timeline_json:
                result["timeline"] = json_lib.loads(video.timeline_json)
            else:
                result["timeline"] = None
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

    @router.get("/api/videos/{video_id}/rescore-clips")
    async def rescore_clips(video_id: int):
        """Re-run LLM scoring for all clips using the video's current context. Streams progress as SSE."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            context_names = json_lib.loads(video.context_names_json) if video.context_names_json else []
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
            from datetime import datetime
            from rp_clipper.scoring.engine import ScoringEngine
            from rp_clipper.scoring.llm import LLMScorer

            total = len(clip_ids)
            engine = ScoringEngine(config, [LLMScorer(config, context_text=context_text)])

            for i, clip_id in enumerate(clip_ids, 1):
                score_db = ctx.get_db()
                try:
                    clip = score_db.get(ClipCandidate, clip_id)
                    if clip:
                        await asyncio.to_thread(engine.score_clip, clip, score_db)
                        score_db.commit()
                except Exception as exc:
                    score_db.rollback()
                    yield f"data: {json_lib.dumps(f'[Error scoring clip {clip_id}: {exc}]')}\n\n"
                finally:
                    score_db.close()
                yield f"data: {json_lib.dumps(f'Scored {i}/{total} clips')}\n\n"

            prov_db = ctx.get_db()
            try:
                v = prov_db.get(Video, video_id)
                if v:
                    v.clips_scored_at = datetime.utcnow()
                    v.clips_scored_context_json = json_lib.dumps(context_names)
                    prov_db.commit()
            finally:
                prov_db.close()

            yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @router.get("/api/videos/{video_id}/timeline")
    async def stream_timeline(video_id: int):
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
                raise HTTPException(400, "No transcript available — run ingest first")

            # Extract raw data before closing the session
            context_names = json_lib.loads(video.context_names_json) if video.context_names_json else []
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
        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)

        async def event_stream():
            from datetime import datetime
            from rp_clipper.scoring.llm import generate_timeline_chunk
            chunk_ms = 15 * 60 * 1000
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
                    entry_text = f"[Error generating entry: {exc}]"

                entry = {"start_hms": start_hms, "end_hms": end_hms, "text": entry_text}
                entries.append(entry)
                yield f"data: {json_lib.dumps(entry)}\n\n"

            save_db = ctx.get_db()
            try:
                v = save_db.get(Video, video_id)
                if v:
                    v.timeline_json = json_lib.dumps(entries)
                    v.timeline_generated_at = datetime.utcnow()
                    v.timeline_context_json = json_lib.dumps(context_names)
                    save_db.commit()
            finally:
                save_db.close()

            yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @router.post("/api/videos/{video_id}/summarize")
    def summarize_video(video_id: int):
        """Generate a title and summary for a video's transcript via Ollama."""
        from datetime import datetime
        from rp_clipper.scoring.llm import summarize_transcript
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            context_names = json_lib.loads(video.context_names_json) if video.context_names_json else []
            tracks = db.query(AudioTrack).filter_by(video_id=video_id, do_transcribe=True).all()
            all_segs = []
            for track in tracks:
                for tx in track.transcripts:
                    all_segs.extend(tx.segments)
            all_segs.sort(key=lambda s: s.start_ms)
            full_text = " ".join(s.text.strip() for s in all_segs)

            if not full_text:
                raise HTTPException(400, "No transcript available — run ingest first")

            context_text = format_context_block(load_contexts(ctx.project_dir), context_names)
            try:
                title, summary = summarize_transcript(full_text, ctx.config, context_text=context_text)
            except Exception as exc:
                raise HTTPException(502, f"Ollama error: {exc}")

            video.title = title
            video.summary = summary
            video.summarized_at = datetime.utcnow()
            video.summary_context_json = json_lib.dumps(context_names)
            db.commit()
            return {"title": title, "summary": summary}
        finally:
            db.close()

    @router.get("/api/videos/{video_id}/clips")
    def list_clips(
        video_id: int,
        status: Optional[str] = Query(None),
        sort: str = Query("score", description="score | timeline"),
    ):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            q = db.query(ClipCandidate).filter_by(video_id=video_id)
            if status:
                q = q.filter_by(status=status)
            order = ClipCandidate.start_ms.asc() if sort == "timeline" else ClipCandidate.score_overall.desc()
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
            filename = _export_filename(clip, video)
            exported = (ctx.export_dir / filename).exists()
            srt = _srt_path(clip, video, ctx.export_dir)
            if exported:
                return {"url": f"/media/exports/{filename}", "filename": filename, "has_captions": srt is not None}
            return {"url": None, "filename": filename, "has_captions": False}
        finally:
            db.close()

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
                for p in [ctx.export_dir / _export_filename(clip, video),
                          _srt_path(clip, video, ctx.export_dir)]:
                    if p and p.exists():
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
            return {"deleted": video_id}
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

            for p in [ctx.export_dir / _export_filename(clip, video),
                      _srt_path(clip, video, ctx.export_dir)]:
                if p and p.exists():
                    p.unlink(missing_ok=True)

            db.delete(clip)
            db.commit()
            return {"deleted": clip_id, "video_id": video_id}
        finally:
            db.close()

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
            return PlainTextResponse(_srt_to_vtt(srt.read_text(encoding="utf-8")), media_type="text/vtt")
        finally:
            db.close()

    return router


# ── serialization helpers ────────────────────────────────────────────────────

def _require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def _export_filename(clip: ClipCandidate, video: Video) -> str:
    stem = Path(video.filename).stem
    start_hms = clip.start_hms.replace(":", "-")
    return f"{stem}_clip{clip.id}_{start_hms}.mkv"


def _srt_path(clip: ClipCandidate, video: Video, export_dir: Path) -> Optional[Path]:
    stem = Path(video.filename).stem
    start_hms = clip.start_hms.replace(":", "-")
    base = f"{stem}_clip{clip.id}_{start_hms}"
    p = export_dir / f"{base}.srt"
    return p if p.exists() else None


def _ms_to_hms(ms: int) -> str:
    s = ms // 1000
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _srt_to_vtt(srt: str) -> str:
    vtt = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)
    return f"WEBVTT\n\n{vtt}"


def _video_dict(video: Video, db) -> dict:
    total_clip_ms = (
        db.query(func.sum(ClipCandidate.end_ms - ClipCandidate.start_ms))
        .filter(ClipCandidate.video_id == video.id)
        .scalar() or 0
    )
    return {
        "id": video.id,
        "filename": video.filename,
        "status": video.status,
        "duration_hms": video.duration_hms,
        "duration_ms": video.duration_ms or 0,
        "clip_count": db.query(ClipCandidate).filter_by(video_id=video.id).count(),
        "approved": db.query(ClipCandidate).filter_by(video_id=video.id, status="approved").count(),
        "total_clip_ms": total_clip_ms,
        "title": video.title or "",
        "summary": video.summary or "",
        "has_timeline": bool(video.timeline_json),
        "context_names": json_lib.loads(video.context_names_json) if video.context_names_json else [],
        "clips_scored_at": video.clips_scored_at.isoformat() if video.clips_scored_at else None,
        "clips_scored_context": json_lib.loads(video.clips_scored_context_json) if video.clips_scored_context_json else [],
        "summarized_at": video.summarized_at.isoformat() if video.summarized_at else None,
        "summary_context": json_lib.loads(video.summary_context_json) if video.summary_context_json else [],
        "timeline_generated_at": video.timeline_generated_at.isoformat() if video.timeline_generated_at else None,
        "timeline_context": json_lib.loads(video.timeline_context_json) if video.timeline_context_json else [],
    }


def _clip_dict(
    clip: ClipCandidate,
    full: bool = False,
    export_dir=None,
    video: Video = None,
) -> dict:
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
        "description": clip.description or "",
        "description_long": clip.description_long or "",
        "status": clip.status,
        "tags": clip.tags,
        "has_export": (
            export_dir is not None
            and video is not None
            and (export_dir / _export_filename(clip, video)).exists()
        ),
    }
    if full:
        d["transcript_excerpt"] = clip.transcript_excerpt or ""
    return d
