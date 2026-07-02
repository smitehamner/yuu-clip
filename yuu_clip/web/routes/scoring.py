"""LLM scoring, timeline, and summary routes."""
from __future__ import annotations

import asyncio
import json as json_lib
from dataclasses import replace as _dc_replace
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from yuu_clip.contexts import extract_context_weights, format_context_block, load_contexts
from yuu_clip.db.models import AudioTrack, ClipCandidate, Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes._shared import (
    _active_job,
    _json_list,
    _reject_if_analyzing,
    _require_clip,
    _sse_response,
)

_log = get_logger(__name__)


def _collect_transcript_segments(db, video_id: int) -> list:
    tracks = db.query(AudioTrack).filter_by(video_id=video_id, do_transcribe=True).all()
    segs = []
    for track in tracks:
        for tx in track.transcripts:
            segs.extend(tx.segments)
    segs.sort(key=lambda s: s.start_ms)
    return segs


def _video_transcript_text(db, video_id: int) -> str:
    segs = _collect_transcript_segments(db, video_id)
    return " ".join(s.text.strip() for s in segs)


def _ms_to_hms(ms: int) -> str:
    s = ms // 1000
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _config_with_context_weights(config, contexts: dict, context_names: list[str]):
    weights = extract_context_weights(contexts, context_names)
    overrides = {k: v for k, v in weights.items() if v is not None}
    return _dc_replace(config, **overrides) if overrides else config


def _resolve_context(ctx: ProjectContext, context_names: list[str]) -> tuple:
    """Return (context_text, config) with context weights applied."""
    contexts = load_contexts(ctx.project_dir)
    context_text = format_context_block(contexts, context_names)
    config = _config_with_context_weights(ctx.config, contexts, context_names)
    return context_text, config


def _parse_scope_ids(video_ids: str, default_video_id: int) -> list[int]:
    """Parse the comma-separated video_ids query param, defaulting to the clip's own video."""
    if not video_ids.strip():
        return [default_video_id]
    try:
        scope_ids = [int(x) for x in video_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "video_ids must be comma-separated integers")
    return scope_ids or [default_video_id]


def _load_related_candidates(db, scope_ids: list[int], exclude_clip_id: int) -> list[dict]:
    """Load described clips (excluding the reference clip) as {id, description} dicts."""
    rows = (
        db.query(ClipCandidate.id, ClipCandidate.description_long, ClipCandidate.description)
        .filter(
            ClipCandidate.video_id.in_(scope_ids),
            ClipCandidate.id != exclude_clip_id,
        )
        .all()
    )
    return [
        {"id": r.id, "description": r.description_long or r.description or ""}
        for r in rows
        if (r.description_long or r.description)
    ]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()
    _register_rescore_routes(router, ctx)
    _register_summary_routes(router, ctx)
    _register_clip_scoring_routes(router, ctx)
    return router


def _rescore_video_clips(ctx: ProjectContext, video_id: int, failed_only: bool):
    _reject_if_analyzing(ctx)
    db = ctx.get_db()
    try:
        video = db.get(Video, video_id)
        if not video:
            raise HTTPException(404, "Video not found")
        context_names = _json_list(video.context_names_json)
        query = (
            db.query(ClipCandidate)
            .filter_by(video_id=video_id)
            .order_by(ClipCandidate.start_ms)
        )
        if failed_only:
            query = query.filter(ClipCandidate.tags_json.like('%"llm_error"%'))
        clip_ids = [c.id for c in query.all()]
    finally:
        db.close()

    context_text, config = _resolve_context(ctx, context_names)

    async def event_stream():
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.llm import LLMScorer

        async with _active_job(ctx):
            total = len(clip_ids)
            plural = "s" if total != 1 else ""
            yield f"data: {json_lib.dumps(f'[Starting LLM scoring for {total} clip{plural}…]')}\n\n"
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


def _register_rescore_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/rescore-clips")
    async def rescore_clips(video_id: int):
        """Re-run LLM scoring for all clips using the video's current context. Streams progress as SSE."""
        return _rescore_video_clips(ctx, video_id, failed_only=False)

    @router.get("/api/videos/{video_id}/rescore-failed-clips")
    async def rescore_failed_clips(video_id: int):
        """Re-run LLM scoring only for clips whose last scoring failed (tagged llm_error). Streams progress as SSE."""
        return _rescore_video_clips(ctx, video_id, failed_only=True)

    @router.get("/api/videos/{video_id}/timeline")
    async def stream_timeline(video_id: int, interval_s: Optional[int] = Query(None)):
        """Generate a session timeline by chunking the transcript and calling the LLM.
        Streams each entry as an SSE event as it completes."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            all_segs = _collect_transcript_segments(db, video_id)

            if not all_segs:
                raise HTTPException(400, "No transcript available — analyze the recording first")

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
                        _log.error("timeline chunk %s-%s failed for video %d: %s", start_hms, end_hms, video_id, exc, exc_info=True)
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


def _register_summary_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.post("/api/videos/{video_id}/summarize")
    def summarize_video(video_id: int):
        """Generate title + summary via LLM and return them for the compare modal.

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
            full_text = _video_transcript_text(db, video_id)

            if not full_text:
                raise HTTPException(400, "No transcript available — analyze the recording first")

            title_current   = video.effective_title
            summary_current = video.effective_summary

            context_text = format_context_block(load_contexts(ctx.project_dir), context_names)
            try:
                title_new, summary_new = summarize_transcript(
                    full_text, ctx.config, context_text=context_text
                )
            except Exception as exc:
                _log.warning("summarize failed for video %d: %s", video_id, exc, exc_info=True)
                raise HTTPException(502, f"LLM error: {exc}")

            return {
                "title_new": title_new,
                "summary_new": summary_new,
                "title_current": title_current,
                "summary_current": summary_current,
            }
        finally:
            db.close()

    @router.get("/api/videos/{video_id}/regenerate-summary")
    async def regenerate_summary(video_id: int):
        """Regenerate title + summary and auto-commit to DB. Streams one log line as SSE."""
        from yuu_clip.scoring.llm import summarize_transcript

        _reject_if_analyzing(ctx)
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            context_names = _json_list(video.context_names_json)
            full_text = _video_transcript_text(db, video_id)
        finally:
            db.close()

        if not full_text:
            raise HTTPException(400, "No transcript available — analyze the recording first")

        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)

        async def event_stream():
            async with _active_job(ctx):
                yield f"data: {json_lib.dumps('[Generating summary…]')}\n\n"
                try:
                    title_new, summary_new = await asyncio.to_thread(
                        summarize_transcript, full_text, ctx.config, context_text=context_text
                    )
                except Exception as exc:
                    _log.warning("regenerate_summary failed for video %d: %s", video_id, exc, exc_info=True)
                    yield f"data: {json_lib.dumps(f'[Error: {exc}]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return

                save_db = ctx.get_db()
                try:
                    v = save_db.get(Video, video_id)
                    if v:
                        v.title = title_new
                        v.title_user = None
                        v.summary = summary_new
                        v.summary_user = None
                        v.summarized_at = datetime.now(timezone.utc)
                        v.summary_context_json = json_lib.dumps(context_names)
                        save_db.commit()
                finally:
                    save_db.close()

                yield f"data: {json_lib.dumps('[Summary regenerated]')}\n\n"
                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return _sse_response(event_stream())


def _register_clip_scoring_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/clips/{clip_id}/rescore")
    async def rescore_clip(clip_id: int):
        _reject_if_analyzing(ctx)
        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            context_names = _json_list(video.context_names_json)
        finally:
            db.close()

        context_text, config = _resolve_context(ctx, context_names)

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
                        # Snapshot existing descriptions before scoring so we can restore them —
                        # scores are committed but descriptions go back via the compare modal.
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

    @router.get("/api/videos/{video_id}/redescribe-clips")
    async def redescribe_clips(video_id: int):
        """Re-generate LLM descriptions for all clips without changing scores. Streams as SSE."""
        from yuu_clip.scoring.llm import check_llm_available
        from yuu_clip.scoring.llm import describe_clip as _describe_clip

        _reject_if_analyzing(ctx)
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            context_names = _json_list(video.context_names_json)
            clip_ids = [
                c.id for c in
                db.query(ClipCandidate)
                .filter_by(video_id=video_id)
                .order_by(ClipCandidate.start_ms)
                .all()
                if c.transcript_excerpt
            ]
        finally:
            db.close()

        llm_ok, llm_reason = check_llm_available(ctx.config)
        if not llm_ok:
            raise HTTPException(503, f"LLM unavailable — {llm_reason}")

        context_text, config = _resolve_context(ctx, context_names)

        async def event_stream():
            async with _active_job(ctx):
                total = len(clip_ids)
                plural = "s" if total != 1 else ""
                yield f"data: {json_lib.dumps(f'[Re-generating descriptions for {total} clip{plural}…]')}\n\n"

                for i, clip_id in enumerate(clip_ids, 1):
                    desc_db = ctx.get_db()
                    error = None
                    try:
                        clip = desc_db.get(ClipCandidate, clip_id)
                        if clip and clip.transcript_excerpt:
                            desc, desc_long = await asyncio.to_thread(
                                _describe_clip, clip.transcript_excerpt, config, context_text
                            )
                            if desc:
                                clip.description = desc
                                clip.description_long = desc_long or None
                            desc_db.commit()
                    except Exception as exc:
                        desc_db.rollback()
                        error = str(exc)
                        _log.error(
                            "redescribe_clips: clip %d failed for video %d: %s",
                            clip_id, video_id, exc, exc_info=True,
                        )
                    finally:
                        desc_db.close()
                    if error:
                        yield f"data: {json_lib.dumps(f'[Error describing clip {clip_id}: {error}]')}\n\n"
                    else:
                        yield f"data: {json_lib.dumps(f'Described {i}/{total} clips')}\n\n"

                yield f"data: {json_lib.dumps('__DONE__')}\n\n"

        return _sse_response(event_stream())

    @router.get("/api/clips/{clip_id}/related-clips")
    async def find_related_clips(clip_id: int, video_ids: str = Query("")):
        """Find clips similar to this one via LLM. Streams progress as SSE.

        video_ids: comma-separated list of video IDs to search (empty = current video only).
        Saves results to related_clips_json on the clip.
        """
        from yuu_clip.scoring.llm import check_llm_available
        from yuu_clip.scoring.llm import find_related_clips as _find_related

        config = ctx.config

        db = ctx.get_db()
        try:
            clip = _require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            ref_desc = (clip.description_long_user or clip.description_long or
                        clip.description_user or clip.description or "")
            if not ref_desc:
                raise HTTPException(400, "Clip has no description — re-score first")

            context_names = _json_list(video.context_names_json)

            scope_ids = _parse_scope_ids(video_ids, clip.video_id)
            candidates = _load_related_candidates(db, scope_ids, clip_id)
        finally:
            db.close()

        llm_ok, llm_reason = check_llm_available(config)
        if not llm_ok:
            raise HTTPException(503, f"LLM unavailable — {llm_reason}")

        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)

        async def event_stream():
            async with _active_job(ctx):
                total = len(candidates)
                yield f"data: {json_lib.dumps(f'[Searching {total} clips for similar moments…]')}\n\n"

                results = None
                error = None
                try:
                    results = await asyncio.to_thread(
                        _find_related, ref_desc, candidates, config, context_text
                    )
                except Exception as exc:
                    error = str(exc)
                    _log.error("find_related_clips: clip %d failed: %s", clip_id, exc, exc_info=True)

                if error:
                    yield f"data: {json_lib.dumps(f'[Error: {error}]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return

                save_db = ctx.get_db()
                try:
                    c = save_db.get(ClipCandidate, clip_id)
                    if c:
                        c.related_clips_json = json_lib.dumps(results)
                        c.related_clips_at = datetime.now(timezone.utc)
                        save_db.commit()
                finally:
                    save_db.close()

                yield f"data: {json_lib.dumps({'type': '__DONE__', 'results': results})}\n\n"

        return _sse_response(event_stream())
