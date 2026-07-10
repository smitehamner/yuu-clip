# Feature-map - Recording (code: video / Video) + Split (recording segments)
#   UI: static/videos.js (Recordings sidebar + detail) · static/split.js (Split Editor)
#   Siblings: analyze/proxy.py (preview proxy) · tests/integration/test_videos.py, tests/integration/test_segments.py, tests/ui/test_ui_video.py
"""Video CRUD routes - listing, detail, split, waveform computation, and deletion."""
from __future__ import annotations

import asyncio
import json as json_lib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import case, func, select

from yuu_clip.db.models import (
    AudioEnergy,
    AudioTrack,
    ClipCandidate,
    SceneBoundary,
    Transcript,
    TranscriptSegment,
    Video,
    latest_track_transcript,
)
from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
from yuu_clip.export.paths import all_sidecar_paths, clip_export_row_files, clip_stem
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.file_deletion import delete_files, locked_files_error
from yuu_clip.web.media import media_file_response
from yuu_clip.web.routes.common import active_job, json_list, sse_response

_log = get_logger(__name__)

_EMPTY_STATS = {
    "clip_count": 0, "approved": 0, "exported": 0,
    "total_clip_ms": 0, "score_min": None, "score_max": None,
    "llm_error_count": 0,
}

# Live proxy-encode futures, held only to keep the executor task from being GC'd
# while the browser that started it has disconnected - the encode finishes and
# records its own metadata regardless (see generate_video_proxy).
_PROXY_WORKERS: set = set()


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
    migrate_clips: bool = False


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
        If migrate_clips is set, each of the parent's clips is reassigned to whichever
        segment contains the clip's start time (its times shifted to segment-relative),
        and each transcribable audio track's transcript is copied onto every segment
        it overlaps (also segment-relative; the parent's own track/transcript rows are
        left untouched). Otherwise clips and transcript are left on the now-hidden
        parent - callers that reanalyze each segment generate fresh ones there instead.
        """
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            if video.parent_video_id is not None:
                raise HTTPException(400, "Cannot split a segment - split the parent recording instead")
            _reject_if_video_analyzing(ctx, video, "splitting it")

            duration_s = (video.duration_ms or 0) / 1000.0
            if duration_s <= 0:
                raise HTTPException(400, "Recording has no duration - analyze it first")

            pts = sorted(set(body.split_points))
            _validate_split_points(pts, duration_s)

            # Idempotent: re-splitting deletes and recreates existing segments.
            _delete_existing_segments(db, video_id)
            boundaries = [0.0] + pts + [duration_s]
            segment_ids = _create_segments(db, video, boundaries, body.segment_names)

            migrated_clips = 0
            migrated_transcript_lines = 0
            if body.migrate_clips:
                migrated_clips = _migrate_clips_to_segments(
                    db, video, boundaries, segment_ids, ctx.export_dir, ctx.config.export_name_template,
                )
                migrated_transcript_lines = _migrate_transcript_to_segments(db, video_id, boundaries, segment_ids)

            db.commit()
            _log.info(
                "Split video %d into %d segment(s) at points %s: ids=%s, migrated_clips=%d, migrated_transcript_lines=%d",
                video_id, len(segment_ids), pts, segment_ids, migrated_clips, migrated_transcript_lines,
            )
            return {
                "segment_ids": segment_ids,
                "migrated_clips": migrated_clips,
                "migrated_transcript_lines": migrated_transcript_lines,
            }
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/unsplit")
    def unsplit_video(video_id: int):
        """Reverse a split: merge every segment's clips back onto the parent (restoring
        absolute timing), then delete the segments so the parent is visible again.

        video_id may be the parent or any one of its segments.
        """
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            parent = db.get(Video, video.parent_video_id) if video.parent_video_id is not None else video
            _reject_if_video_analyzing(ctx, parent, "merging its segments")

            segments = db.query(Video).filter_by(parent_video_id=parent.id).all()
            if not segments:
                raise HTTPException(400, "This recording has no segments to merge")

            merged_clips = 0
            for seg in segments:
                offset_ms = int((seg.segment_start_s or 0) * 1000)
                clips = db.query(ClipCandidate).filter_by(video_id=seg.id).all()
                for clip in clips:
                    clip.video_id = parent.id
                    _shift_clip_times(clip, parent, offset_ms, ctx.export_dir, ctx.config.export_name_template)
                    merged_clips += 1
            db.flush()  # persist the clip re-parenting before segment cascade-delete

            _delete_existing_segments(db, parent.id)
            db.commit()
            _log.info(
                "Unsplit video %d: merged %d segment(s), %d clip(s) back onto parent",
                parent.id, len(segments), merged_clips,
            )
            return {"parent_id": parent.id, "merged_segments": len(segments), "merged_clips": merged_clips}
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/clips/clear")
    def clear_video_clips(video_id: int, body: ClearClipsRequest):
        """Delete clips on a video, optionally preserving exported ones.

        Used by the reanalyze-after-split flow to clear stale clips before
        re-running the analysis pipeline on each segment. Only DB records are
        removed - export files on disk are intentionally left in place.
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
                        json_list(video.context_names_json)
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
    def video_source(video_id: int, request: Request):
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
        # media_file_response (StreamingResponse), never FileResponse: starlette
        # cancels a StreamingResponse when the client disconnects, but streams a
        # FileResponse to completion - an abandoned <video> element kept pumping
        # the whole multi-GB recording into a dead socket at full CPU. Bonus:
        # the share-delete handle lets Remove Video work mid-preview.
        return media_file_response(src, request, media_type)

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

        Streams SSE progress. Idempotent - skips tracks that already have energy data.
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
            async with active_job(ctx):
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
                    yield f"data: {json_lib.dumps('[No audio streams found - waveform unavailable]')}\n\n"
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

        return sse_response(event_stream())

    @router.get("/api/videos/{video_id}/proxy")
    def video_proxy(video_id: int, request: Request):
        """Serve the 720p preview proxy when a fresh one exists, else 404."""
        from yuu_clip.analyze.proxy import proxy_file_for, proxy_is_fresh
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            proxy_file = proxy_file_for(Path(video.path), ctx.proxy_dir)
            fresh = proxy_is_fresh(video, proxy_file)
        finally:
            db.close()
        if not fresh:
            raise HTTPException(404, "No preview proxy available")
        return media_file_response(proxy_file, request, media_type="video/mp4")

    @router.get("/api/videos/{video_id}/proxy-status")
    def video_proxy_status(video_id: int):
        """Report whether a fresh 720p preview proxy is available or being built."""
        from yuu_clip.analyze.proxy import PROXY_HEIGHT, proxy_file_for, proxy_is_fresh
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            proxy_file = proxy_file_for(Path(video.path), ctx.proxy_dir)
            fresh = proxy_is_fresh(video, proxy_file)
            return {
                "available": fresh,
                "generating": str(Path(video.path).resolve()) in ctx.proxy_generating,
                "height": PROXY_HEIGHT,
                "generated_at": video.proxy_generated_at.isoformat() if video.proxy_generated_at else None,
                # Absolute path of the proxy file itself - the Electron shell only
                # trusts a "yuu-media://" build once it has this, since the proxy
                # may not have existed yet when the recording's own detail response
                # was fetched (e.g. it was just generated on demand).
                "proxy_path": str(proxy_file.resolve()) if fresh else None,
            }
        finally:
            db.close()

    @router.get("/api/videos/{video_id}/proxy/generate")
    async def generate_video_proxy(video_id: int):
        """Encode a 720p preview proxy for a recording, streaming SSE progress.

        Idempotent: no-ops if a fresh proxy already exists, and never launches a
        second encode while one is already running for the same source. The encode
        runs in a worker thread that records its own metadata and clears the
        in-flight flag even if the browser disconnects mid-encode.
        """
        from yuu_clip.analyze.proxy import (
            generate_proxy,
            proxy_file_for,
            proxy_is_fresh,
            record_proxy_metadata,
        )

        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            source = Path(video.path)
            duration_ms = video.duration_ms
            proxy_file = proxy_file_for(source, ctx.proxy_dir)
            already_fresh = proxy_is_fresh(video, proxy_file)
        finally:
            db.close()

        if not source.exists():
            raise HTTPException(404, "Source video file not found on disk")

        source_key = str(source.resolve())

        async def event_stream():
            async with active_job(ctx):
                if already_fresh:
                    yield f"data: {json_lib.dumps('[Preview already prepared]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return
                if source_key in ctx.proxy_generating:
                    yield f"data: {json_lib.dumps('[Preview is already being prepared…]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return

                ctx.proxy_generating.add(source_key)
                ctx.proxy_dir.mkdir(parents=True, exist_ok=True)
                queue: asyncio.Queue = asyncio.Queue()
                loop = asyncio.get_running_loop()

                def progress_cb(fraction: float) -> None:
                    loop.call_soon_threadsafe(queue.put_nowait, ("progress", fraction))

                def run() -> None:
                    try:
                        generate_proxy(source, proxy_file, duration_ms=duration_ms, progress_cb=progress_cb)
                        rec_db = ctx.get_db()
                        try:
                            rec_video = rec_db.get(Video, video_id)
                            if rec_video:
                                record_proxy_metadata(rec_db, rec_video, proxy_file)
                                rec_db.commit()
                        finally:
                            rec_db.close()
                        loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
                    except Exception as exc:
                        _log.error("Proxy generation failed for video %d: %s", video_id, exc, exc_info=True)
                        loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))
                    finally:
                        loop.call_soon_threadsafe(ctx.proxy_generating.discard, source_key)

                worker = loop.run_in_executor(None, run)
                _PROXY_WORKERS.add(worker)
                worker.add_done_callback(_PROXY_WORKERS.discard)

                yield f"data: {json_lib.dumps('Building 720p preview…')}\n\n"
                last_pct = -100
                while True:
                    kind, payload = await queue.get()
                    if kind == "progress":
                        pct = int(payload * 100)
                        if pct >= last_pct + 5:
                            last_pct = pct
                            yield f"data: {json_lib.dumps(f'Building 720p preview… {pct}%')}\n\n"
                    elif kind == "done":
                        yield f"data: {json_lib.dumps('720p preview ready')}\n\n"
                        break
                    else:  # error
                        yield f"data: {json_lib.dumps(f'[Preview generation failed: {payload}]')}\n\n"
                        break
                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return sse_response(event_stream())


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

    @router.get("/api/videos/{video_id}/transcript")
    def get_video_transcript(video_id: int):
        """Timed full-recording transcript lines (absolute time), for the
        collapsible full-transcript view. Each line has start/end ms, the
        diarized speaker name (or null), and text."""
        from yuu_clip.subtitles import video_transcript_lines
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            # A split segment's transcript is timed from 0, but its player streams the
            # full parent file; seek_offset_s shifts the ▶ back onto the parent timeline.
            return {
                "lines": video_transcript_lines(video),
                "seek_offset_s": video.segment_start_s or 0.0,
            }
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

            _reject_if_video_analyzing(ctx, video, "removing it")

            # Delete exported clip files from disk before removing DB records
            clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            locked: list[Path] = []
            for clip in clips:
                locked += delete_files([
                    *all_sidecar_paths(clip, video, ctx.export_dir, ctx.config.export_name_template),
                    *clip_export_row_files(clip),
                ])
            if locked:
                raise locked_files_error(locked)

            # AudioEnergy and SceneBoundary have no Python-level cascade; delete explicitly
            track_ids = [t.id for t in video.audio_tracks]
            if track_ids:
                db.query(AudioEnergy).filter(
                    AudioEnergy.audio_track_id.in_(track_ids)
                ).delete(synchronize_session=False)
            db.query(SceneBoundary).filter(
                SceneBoundary.video_id == video_id
            ).delete(synchronize_session=False)

            source_path = video.path
            db.delete(video)  # cascades: ClipCandidate, AudioTrack → Transcript → TranscriptSegment
            db.commit()
            _delete_orphaned_proxy(db, ctx, source_path)
            _log.info("Deleted video %d (%s) and %d exported clip(s)", video_id, video.filename, len(clips))
            return {"deleted": video_id}
        finally:
            db.close()


def _delete_orphaned_proxy(db, ctx: ProjectContext, source_path: str) -> None:
    """Remove a recording's cached 720p proxy once no Video row still uses the file.

    The proxy is keyed by source path and shared across split segments, so it is
    only safe to delete after the last row referencing that path is gone. Best-
    effort disk hygiene - a locked file (mid-preview) is logged, never fatal.
    """
    from yuu_clip.analyze.proxy import proxy_file_for

    if db.query(Video).filter(Video.path == source_path).count() > 0:
        return
    proxy_file = proxy_file_for(Path(source_path), ctx.proxy_dir)
    try:
        proxy_file.unlink(missing_ok=True)
    except OSError as exc:
        _log.warning("Could not delete orphaned proxy %s: %s", proxy_file, exc)


def _reject_if_video_analyzing(ctx: ProjectContext, video: Video, action: str) -> None:
    """Fail closed when *video* is mid-analysis: mutating or deleting it would leave
    the ingest subprocess writing rows for a video that changed under it.

    Match by id (reanalyze) or filename (fresh analysis - no video_id until the
    subprocess creates the row). Split segments share the parent's filename, so a
    sibling segment's mutation is also blocked while one is analyzing.
    """
    job = ctx.analyze_job
    if job is None or job.done:
        return
    if job.video_id == video.id or (job.filename is not None and job.filename == video.filename):
        _log.warning(
            "Rejected %s: video %d (%s) - analysis in progress (job video_id=%s)",
            action, video.id, video.filename, job.video_id,
        )
        raise HTTPException(
            409,
            "This recording is currently being analyzed - cancel the "
            f"analysis before {action}.",
        )


def _shift_clip_times(
    clip: ClipCandidate, video: Video, delta_ms: int, export_dir: Path,
    name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> None:
    """Shift a clip's window by *delta_ms*, renaming its exported files to match.

    Export/sidecar filenames embed the clip's start time (clip_stem), so a clip
    migrated between a recording and its segments must have its files renamed or
    every export lookup (exported badge, download, delete) misses them.
    A failed rename is logged, not fatal - the clip is then merely back to
    "file not found", same as if the rename hadn't been attempted.
    """
    existing_files = [p for p in all_sidecar_paths(clip, video, export_dir, name_template) if p.exists()]
    old_stem = clip_stem(clip, video, name_template)
    clip.start_ms += delta_ms
    clip.end_ms += delta_ms
    new_stem = clip_stem(clip, video, name_template)
    if new_stem == old_stem:
        return
    for old_file in existing_files:
        new_file = old_file.with_name(new_stem + old_file.name[len(old_stem):])
        try:
            old_file.rename(new_file)
        except OSError as exc:
            _log.warning("Could not rename export file %s -> %s: %s", old_file, new_file, exc)


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
            title=name or f"{stem} - Part {i + 1}",
            # Segments share the parent's source file and its one proxy - inherit
            # the pointer so a segment's player finds it without rebuilding.
            proxy_path=video.proxy_path,
            proxy_generated_at=video.proxy_generated_at,
            proxy_source_mtime=video.proxy_source_mtime,
            proxy_source_size=video.proxy_source_size,
        )
        db.add(seg)
        db.flush()
        segment_ids.append(seg.id)
    return segment_ids


def _migrate_clips_to_segments(
    db, parent: Video, boundaries: list[float], segment_ids: list[int], export_dir: Path,
    name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> int:
    """Reassign each of the parent's clips to the segment containing its start time.

    A clip that straddles a split point keeps its full original duration and is
    owned by the segment its start falls in - its end_ms may then run past that
    segment's own length, which is fine since segments share the parent's file.
    """
    clips = db.query(ClipCandidate).filter_by(video_id=parent.id).all()
    for clip in clips:
        start_s = clip.start_ms / 1000.0
        seg_idx = next(
            (i for i in range(len(segment_ids)) if boundaries[i] <= start_s < boundaries[i + 1]),
            len(segment_ids) - 1,
        )
        clip.video_id = segment_ids[seg_idx]
        _shift_clip_times(clip, parent, -int(boundaries[seg_idx] * 1000), export_dir, name_template)
    db.flush()
    return len(clips)


def _migrate_transcript_to_segments(
    db, parent_video_id: int, boundaries: list[float], segment_ids: list[int],
) -> int:
    """Copy each transcribable track's transcript onto every segment it overlaps,
    with segment-relative timing - same start-time ownership rule as clips.

    The parent's own AudioTrack/Transcript/TranscriptSegment rows are untouched;
    each segment gets its own copy, so deleting a segment (re-split, unsplit)
    never touches the source data.
    """
    parent = db.get(Video, parent_video_id)
    migrated = 0
    for track in parent.audio_tracks:
        if not track.do_transcribe or track.label == "game_sounds" or not track.transcripts:
            continue
        transcript = latest_track_transcript(track)

        by_segment: dict[int, list] = {}
        for seg in transcript.segments:
            seg_idx = next(
                (i for i in range(len(segment_ids)) if boundaries[i] <= seg.start_ms / 1000.0 < boundaries[i + 1]),
                len(segment_ids) - 1,
            )
            by_segment.setdefault(seg_idx, []).append(seg)

        for seg_idx, segs in by_segment.items():
            offset_ms = int(boundaries[seg_idx] * 1000)
            new_track = AudioTrack(
                video_id=segment_ids[seg_idx],
                stream_index=track.stream_index,
                label=track.label,
                relevance_weight=track.relevance_weight,
                do_transcribe=track.do_transcribe,
                do_score=track.do_score,
                codec=track.codec,
                sample_rate=track.sample_rate,
                channels=track.channels,
                channel_layout=track.channel_layout,
                stream_title_tag=track.stream_title_tag,
                extracted_path=track.extracted_path,
            )
            db.add(new_track)
            db.flush()

            new_transcript = Transcript(
                audio_track_id=new_track.id,
                model_name=transcript.model_name,
                language=transcript.language,
            )
            db.add(new_transcript)
            db.flush()

            for seg in segs:
                db.add(TranscriptSegment(
                    transcript_id=new_transcript.id,
                    start_ms=seg.start_ms - offset_ms,
                    end_ms=seg.end_ms - offset_ms,
                    text=seg.text,
                    confidence=seg.confidence,
                    speaker_label=seg.speaker_label,
                    speaker_id=seg.speaker_id,
                    speaker_edited=seg.speaker_edited,
                ))
                migrated += 1
    db.flush()
    return migrated


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
            func.sum(case((ClipCandidate.tags_json.like('%"llm_error"%'), 1), else_=0)).label("llm_error_count"),
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
            "llm_error_count": row.llm_error_count or 0,
        }
        for row in rows
    }


def _video_dict(video: Video, stats: dict) -> dict:
    return {
        "id": video.id,
        "filename": video.filename,
        "path": video.path,
        "status": video.status,
        "duration_hms": video.duration_hms,
        "duration_ms": video.duration_ms or 0,
        "clip_count": stats["clip_count"],
        "approved": stats["approved"],
        "exported": stats["exported"],
        "total_clip_ms": stats["total_clip_ms"],
        "score_min": stats["score_min"],
        "score_max": stats["score_max"],
        "clips_llm_error": stats["llm_error_count"],
        "title": video.effective_title,
        "title_original": video.title or "",
        "title_is_edited": video.title_user is not None,
        "summary": video.effective_summary,
        "summary_original": video.summary or "",
        "summary_is_edited": video.summary_user is not None,
        "has_timeline": bool(video.timeline_json),
        "context_names": json_list(video.context_names_json),
        "parent_video_id": video.parent_video_id,
        "segment_start_s": video.segment_start_s,
        "segment_end_s": video.segment_end_s,
        "session_id": video.session_id,
        "clips_scored_at": video.clips_scored_at.isoformat() if video.clips_scored_at else None,
        "clips_scored_context": json_list(video.clips_scored_context_json),
        "summarized_at": video.summarized_at.isoformat() if video.summarized_at else None,
        "summary_context": json_list(video.summary_context_json),
        "timeline_generated_at": video.timeline_generated_at.isoformat() if video.timeline_generated_at else None,
        "timeline_context": json_list(video.timeline_context_json),
        "analyze_started_at": video.analyze_started_at.isoformat() if video.analyze_started_at else None,
        "analyze_run": json_lib.loads(video.analyze_run_json) if video.analyze_run_json else None,
        "source_url": video.source_url,
        "source_title": video.source_title,
        "source_uploader": video.source_uploader,
        "source_upload_date": video.source_upload_date.strftime("%Y-%m-%d") if video.source_upload_date else None,
        "source_category": video.source_category,
        # Absolute path to the recording on disk - lets the Electron shell build a
        # yuu-media:// URL for direct native playback instead of proxying bytes
        # through this HTTP server (plain-browser dev mode ignores this field).
        "source_path": str(Path(video.path).resolve()),
    }
