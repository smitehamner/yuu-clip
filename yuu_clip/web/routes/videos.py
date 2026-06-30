"""Video CRUD routes — listing, detail, split, waveform computation, and deletion."""
from __future__ import annotations

import asyncio
import json as json_lib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import case, func, select

from yuu_clip.db.models import AudioEnergy, AudioTrack, ClipCandidate, SceneBoundary, Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes._shared import (
    _active_job,
    _all_sidecar_paths,
    _json_list,
    _sse_response,
)

_log = get_logger(__name__)

_EMPTY_STATS = {
    "clip_count": 0, "approved": 0, "exported": 0,
    "total_clip_ms": 0, "score_min": None, "score_max": None,
}


class ContextAssignment(BaseModel):
    context_names: list[str]


class VideoFieldsUpdate(BaseModel):
    action: str                          # accept_new | accept_edit | revert
    field: str                           # title | summary | both
    new_title: Optional[str] = None
    new_summary: Optional[str] = None


class SplitRequest(BaseModel):
    split_points: list[float]
    segment_names: list[str] = []


class ClearClipsRequest(BaseModel):
    keep_exported: bool = False


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()
    _register_video_read_routes(router, ctx)
    _register_split_and_edit_routes(router, ctx)
    _register_media_routes(router, ctx)
    _register_video_data_routes(router, ctx)
    return router


def _register_video_read_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos")
    def list_videos():
        db = ctx.get_db()
        try:
            # Hide parent videos that have been split into segments.
            split_parent_ids = select(Video.parent_video_id).where(Video.parent_video_id.isnot(None))
            videos = (
                db.query(Video)
                .filter(~Video.id.in_(split_parent_ids))
                .order_by(Video.created_at.desc())
                .all()
            )
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


def _register_split_and_edit_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.post("/api/videos/{video_id}/split")
    def split_video(video_id: int, body: SplitRequest):
        """Partition a recording into named segments at the given split points (seconds).

        Idempotent: re-splitting a video deletes and recreates its existing segments.
        Clips on the parent are not migrated — callers either reanalyze each segment
        (generating fresh clips) or leave them untouched on the now-hidden parent.
        """
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            if video.parent_video_id is not None:
                raise HTTPException(400, "Cannot split a segment — split the parent recording instead")

            duration_s = (video.duration_ms or 0) / 1000.0
            if duration_s <= 0:
                raise HTTPException(400, "Recording has no duration — analyze it first")

            pts = sorted(set(body.split_points))
            _validate_split_points(pts, duration_s)

            # Idempotent: re-splitting deletes and recreates existing segments.
            _delete_existing_segments(db, video_id)
            boundaries = [0.0] + pts + [duration_s]
            segment_ids = _create_segments(db, video, boundaries, body.segment_names)

            db.commit()
            _log.info(
                "Split video %d into %d segment(s) at points %s: ids=%s",
                video_id, len(segment_ids), pts, segment_ids,
            )
            return {"segment_ids": segment_ids}
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/clips/clear")
    def clear_video_clips(video_id: int, body: ClearClipsRequest):
        """Delete clips on a video, optionally preserving exported ones.

        Used by the reanalyze-after-split flow to clear stale clips before
        re-running the analysis pipeline on each segment. Only DB records are
        removed — export files on disk are intentionally left in place.
        """
        db = ctx.get_db()
        try:
            if not db.get(Video, video_id):
                raise HTTPException(404, "Video not found")
            q = db.query(ClipCandidate).filter(ClipCandidate.video_id == video_id)
            if body.keep_exported:
                q = q.filter(ClipCandidate.exported_at.is_(None))
            deleted = q.delete(synchronize_session=False)
            db.commit()
            _log.info(
                "Cleared %d clip(s) from video %d (keep_exported=%s)",
                deleted, video_id, body.keep_exported,
            )
            return {"deleted": deleted}
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
                    if body.new_title is None:
                        raise HTTPException(400, "new_title is required for accept_new")
                    video.title      = body.new_title.strip()
                    video.title_user = None
                if touch_summary:
                    if body.new_summary is None:
                        raise HTTPException(400, "new_summary is required for accept_new")
                    video.summary      = body.new_summary.strip()
                    video.summary_user = None
                    video.summarized_at        = datetime.now(timezone.utc)
                    video.summary_context_json = json_lib.dumps(
                        _json_list(video.context_names_json)
                    )
            elif body.action == "accept_edit":
                if touch_title:
                    if body.new_title is None:
                        raise HTTPException(400, "new_title is required for accept_edit")
                    video.title_user = body.new_title.strip()
                if touch_summary:
                    if body.new_summary is None:
                        raise HTTPException(400, "new_summary is required for accept_edit")
                    video.summary_user = body.new_summary.strip()
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


def _register_media_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/source")
    def video_source(video_id: int):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            src = Path(video.path)
        finally:
            db.close()
        if not src.exists():
            raise HTTPException(404, "Source video file not found on disk")
        _EXT_TYPE = {'.mkv': 'video/x-matroska', '.mp4': 'video/mp4',
                     '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm'}
        media_type = _EXT_TYPE.get(src.suffix.lower(), 'video/mp4')
        return FileResponse(str(src), media_type=media_type)

    @router.get("/api/videos/{video_id}/energy")
    def get_video_energy(video_id: int):
        """Return per-second RMS energy (dB) for every audio track of the video."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            tracks = (
                db.query(AudioTrack)
                .filter_by(video_id=video_id)
                .order_by(AudioTrack.id)
                .all()
            )
            result = []
            for track in tracks:
                rows = (
                    db.query(AudioEnergy)
                    .filter_by(audio_track_id=track.id)
                    .order_by(AudioEnergy.second_offset)
                    .all()
                )
                result.append({
                    "track_id": track.id,
                    "label": track.label,
                    "samples": [{"second": r.second_offset, "rms_db": r.rms_db} for r in rows],
                })
            return {"tracks": result}
        finally:
            db.close()

    @router.get("/api/videos/{video_id}/compute-waveform")
    async def compute_waveform(video_id: int):
        """Extract audio and compute per-second RMS energy for a video that was never analyzed.

        Streams SSE progress. Idempotent — skips tracks that already have energy data.
        """
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            video_path = Path(video.path)
        finally:
            db.close()

        if not video_path.exists():
            raise HTTPException(404, "Source video file not found on disk")

        from yuu_clip.config import project_audio_dir
        audio_dir = project_audio_dir(ctx.project_dir)

        async def event_stream():
            async with _active_job(ctx):
                yield f"data: {json_lib.dumps('[Inspecting audio streams…]')}\n\n"

                try:
                    from yuu_clip.analyze.probe import probe_video
                    info = await asyncio.to_thread(probe_video, video_path)
                except Exception as exc:
                    _log.error("compute_waveform: probe failed for video %d: %s", video_id, exc, exc_info=True)
                    yield f"data: {json_lib.dumps(f'[Error inspecting video: {exc}]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return

                if not info.audio_streams:
                    yield f"data: {json_lib.dumps('[No audio streams found — waveform unavailable]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return

                track_data = _sync_waveform_track_data(ctx, video_id, info.audio_streams)

                from yuu_clip.analyze.extract import extract_audio_track
                from yuu_clip.scoring.energy import compute_energy

                for i, (track_id, stream_index, extracted_path, has_energy) in enumerate(track_data, 1):
                    label = f"track {i}/{len(track_data)}"
                    if has_energy:
                        yield f"data: {json_lib.dumps(f'[{label}: energy already computed, skipping]')}\n\n"
                        continue

                    if not extracted_path or not Path(extracted_path).exists():
                        yield f"data: {json_lib.dumps(f'Extracting audio {label}…')}\n\n"
                        stem = Path(video_path).stem
                        out_wav = audio_dir / f"{stem}_stream{stream_index}.wav"
                        try:
                            await asyncio.to_thread(
                                extract_audio_track, video_path, stream_index, out_wav
                            )
                            upd_db = ctx.get_db()
                            try:
                                t = upd_db.get(AudioTrack, track_id)
                                if t:
                                    t.extracted_path = str(out_wav)
                                    upd_db.commit()
                                extracted_path = str(out_wav)
                            finally:
                                upd_db.close()
                        except Exception as exc:
                            _log.error("compute_waveform: audio extraction failed for video %d track %d: %s", video_id, track_id, exc, exc_info=True)
                            yield f"data: {json_lib.dumps(f'[Error extracting {label}: {exc}]')}\n\n"
                            continue

                    yield f"data: {json_lib.dumps(f'Computing waveform {label}…')}\n\n"
                    energy_db = ctx.get_db()
                    try:
                        track_obj = energy_db.get(AudioTrack, track_id)
                        if track_obj:
                            await asyncio.to_thread(compute_energy, track_obj, energy_db)
                            energy_db.commit()
                    except Exception as exc:
                        energy_db.rollback()
                        _log.error("compute_waveform: energy computation failed for video %d track %d: %s", video_id, track_id, exc, exc_info=True)
                        yield f"data: {json_lib.dumps(f'[Error computing waveform {label}: {exc}]')}\n\n"
                    finally:
                        energy_db.close()

                yield f"data: {json_lib.dumps('Waveform ready')}\n\n"
                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return _sse_response(event_stream())


def _register_video_data_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/scene-boundaries")
    def get_scene_boundaries(video_id: int):
        """Return detected scene-cut timecodes (ms) for the video."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            rows = (
                db.query(SceneBoundary)
                .filter_by(video_id=video_id)
                .order_by(SceneBoundary.timecode_ms)
                .all()
            )
            return {"boundaries_ms": [r.timecode_ms for r in rows]}
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/export-transcript")
    def export_video_transcript(video_id: int, overwrite: bool = Query(False)):
        """Write a full-video SRT file next to the source recording file.

        Useful for reimporting the transcript as --subtitle-source when
        re-analyzing the same file, avoiding a second Whisper run.

        Returns 409 with {"exists": true, "path": "..."} when the file already
        exists and overwrite=false, so the caller can confirm and retry.
        """
        from yuu_clip.subtitles import export_video_transcript_srt
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            source_path = Path(video.path)
            output_path = source_path.with_suffix(".srt")
            if output_path.exists() and not overwrite:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=409,
                    content={"exists": True, "path": str(output_path)},
                )
            try:
                export_video_transcript_srt(video, output_path)
            except ValueError as e:
                raise HTTPException(400, str(e))
            _log.info("Exported transcript SRT for video %d → %s", video_id, output_path)
            return {"path": str(output_path)}
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


def _validate_split_points(pts: list[float], duration_s: float) -> None:
    for p in pts:
        if p <= 0 or p >= duration_s:
            raise HTTPException(
                400,
                f"Split point {p}s is outside the recording range (0-{duration_s:.1f}s)",
            )


def _delete_existing_segments(db, video_id: int) -> None:
    """Remove a video's existing segments and their dependent energy/scene rows.

    AudioEnergy and SceneBoundary have no DB-level cascade; delete explicitly.
    ClipCandidate, AudioTrack, Transcript cascade via ORM on db.delete().
    """
    for seg in db.query(Video).filter_by(parent_video_id=video_id).all():
        seg_track_ids = [t.id for t in seg.audio_tracks]
        if seg_track_ids:
            db.query(AudioEnergy).filter(
                AudioEnergy.audio_track_id.in_(seg_track_ids)
            ).delete(synchronize_session=False)
        db.query(SceneBoundary).filter_by(video_id=seg.id).delete(synchronize_session=False)
        db.delete(seg)
    db.flush()


def _create_segments(db, video: Video, boundaries: list[float], segment_names: list[str]) -> list[int]:
    """Create one child Video per [start, end) interval; return the new segment IDs."""
    stem = Path(video.filename).stem
    segment_ids: list[int] = []
    for i, (start, end) in enumerate(zip(boundaries[:-1], boundaries[1:])):
        name = (segment_names[i].strip() if i < len(segment_names) else "")
        seg = Video(
            path=video.path,
            filename=video.filename,
            duration_ms=int((end - start) * 1000),
            fps=video.fps,
            width=video.width,
            height=video.height,
            status=video.status,
            parent_video_id=video.id,
            segment_start_s=start,
            segment_end_s=end,
            title=name or f"{stem} — Part {i + 1}",
        )
        db.add(seg)
        db.flush()
        segment_ids.append(seg.id)
    return segment_ids


def _sync_waveform_track_data(ctx: ProjectContext, video_id: int, audio_streams) -> list[tuple]:
    """Upsert AudioTrack rows for each discovered stream, return track_data tuples.

    Returns a list of (track_id, stream_index, extracted_path, has_energy) for
    every track belonging to this video.
    """
    db = ctx.get_db()
    try:
        for stream in audio_streams:
            if not db.query(AudioTrack).filter_by(
                video_id=video_id, stream_index=stream.stream_index
            ).first():
                db.add(AudioTrack(
                    video_id=video_id,
                    stream_index=stream.stream_index,
                    label="unlabeled",
                    codec=stream.codec_name,
                    sample_rate=stream.sample_rate,
                    channels=stream.channels,
                    channel_layout=stream.channel_layout,
                    stream_title_tag=stream.title_tag,
                ))
        db.commit()
        track_rows = db.query(AudioTrack).filter_by(video_id=video_id).all()
        track_ids_with_energy = set(
            r.audio_track_id
            for r in db.query(AudioEnergy.audio_track_id)
            .filter(AudioEnergy.audio_track_id.in_([t.id for t in track_rows]))
            .distinct()
            .all()
        )
        return [
            (t.id, t.stream_index, t.extracted_path, t.id in track_ids_with_energy)
            for t in track_rows
        ]
    finally:
        db.close()


def _bulk_clip_stats(db, video_ids: list[int]) -> dict[int, dict]:
    """Return clip aggregate stats for each video_id in a single query."""
    if not video_ids:
        return {}
    rows = (
        db.query(
            ClipCandidate.video_id,
            func.count().label("clip_count"),
            func.sum(case((ClipCandidate.status == "approved", 1), else_=0)).label("approved"),
            func.sum(case((ClipCandidate.exported_at.isnot(None), 1), else_=0)).label("exported"),
            func.sum(ClipCandidate.end_ms - ClipCandidate.start_ms).label("total_clip_ms"),
            func.min(ClipCandidate.score_overall).label("score_min"),
            func.max(ClipCandidate.score_overall).label("score_max"),
        )
        .filter(ClipCandidate.video_id.in_(video_ids))
        .group_by(ClipCandidate.video_id)
        .all()
    )
    return {
        row.video_id: {
            "clip_count":    row.clip_count,
            "approved":      row.approved,
            "exported":      row.exported,
            "total_clip_ms": row.total_clip_ms or 0,
            "score_min":     row.score_min,
            "score_max":     row.score_max,
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
        "exported": stats["exported"],
        "total_clip_ms": stats["total_clip_ms"],
        "score_min": stats["score_min"],
        "score_max": stats["score_max"],
        "title": video.effective_title,
        "title_original": video.title or "",
        "title_is_edited": video.title_user is not None,
        "summary": video.effective_summary,
        "summary_original": video.summary or "",
        "summary_is_edited": video.summary_user is not None,
        "has_timeline": bool(video.timeline_json),
        "context_names": _json_list(video.context_names_json),
        "parent_video_id": video.parent_video_id,
        "segment_start_s": video.segment_start_s,
        "segment_end_s": video.segment_end_s,
        "clips_scored_at": video.clips_scored_at.isoformat() if video.clips_scored_at else None,
        "clips_scored_context": _json_list(video.clips_scored_context_json),
        "summarized_at": video.summarized_at.isoformat() if video.summarized_at else None,
        "summary_context": _json_list(video.summary_context_json),
        "timeline_generated_at": video.timeline_generated_at.isoformat() if video.timeline_generated_at else None,
        "timeline_context": _json_list(video.timeline_context_json),
    }
