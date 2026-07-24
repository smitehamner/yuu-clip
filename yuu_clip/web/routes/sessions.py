# Feature-map - Session (code: RecordingSession / session_id)
#   UI: static/videos/sessions.js (sidebar grouping, suggest, session detail view)
#   Siblings: sessions.py (auto-suggest) · tests/unit/test_sessions.py, tests/integration/test_api_sessions.py, tests/ui/test_ui_sessions.py
"""Session routes - grouping recordings into a play session with a unified timeline.

A Session (ORM: RecordingSession) groups top-level recordings that belong to one
play session. Segments are never direct members - they belong via their parent.
"""
from __future__ import annotations

import asyncio
import json as json_lib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.contexts import format_context_block, load_contexts
from yuu_clip.db.models import ClipCandidate, RecordingSession, Video
from yuu_clip.log import get_logger
from yuu_clip.sessions import SessionCandidate, recording_start_time, suggest_session_groups
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import active_job, json_list, reject_if_busy, sse_response
from yuu_clip.web.sse import sse_event

_log = get_logger(__name__)


class SessionCreate(BaseModel):
    name: Optional[str] = None
    video_ids: list[int]


class SessionRename(BaseModel):
    name: str


class SessionMembers(BaseModel):
    video_ids: list[int]


class SessionFieldsUpdate(BaseModel):
    action: str                          # accept_edit | revert
    field: str                           # title | summary | both
    new_title: Optional[str] = None
    new_summary: Optional[str] = None


def _member_start_time(video: Video) -> datetime:
    """Real-world start time of a recording, for ordering members on the timeline."""
    try:
        mtime = Path(video.path).stat().st_mtime
    except OSError:
        mtime = video.created_at.timestamp() if video.created_at else 0.0
    return recording_start_time(video.filename, mtime, video.duration_ms or 0)


def _hms_to_ms(hms: str) -> int:
    """Parse an 'H:MM:SS' or 'M:SS' stamp back to milliseconds (inverse of _ms_to_hms)."""
    parts = hms.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return 0
    seconds = 0
    for value in nums:
        seconds = seconds * 60 + value
    return seconds * 1000


def _session_dict(session: RecordingSession) -> dict:
    """Sidebar/list shape: identity + member ids, no heavy rollup payload."""
    return {
        "id": session.id,
        "name": session.name or "",
        "title": session.effective_title,
        "member_ids": [v.id for v in session.videos],
        "member_count": len(session.videos),
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()
    _register_crud_routes(router, ctx)
    _register_detail_routes(router, ctx)
    return router


def _grouping_recordings(db) -> list[Video]:
    """Top-level recordings eligible for session grouping (never split segments)."""
    return db.query(Video).filter(Video.parent_video_id.is_(None)).all()


def _validate_members(db, video_ids: list[int]) -> list[Video]:
    """Fetch member videos, rejecting unknown ids and split segments (400 on any bad id)."""
    if not video_ids:
        raise HTTPException(400, "Provide at least one recording to group")
    videos = db.query(Video).filter(Video.id.in_(video_ids)).all()
    found = {v.id for v in videos}
    missing = [vid for vid in video_ids if vid not in found]
    if missing:
        raise HTTPException(400, f"Unknown recording id(s): {missing}")
    segments = [v.id for v in videos if v.parent_video_id is not None]
    if segments:
        raise HTTPException(400, f"Split segments cannot join a session directly: {segments}")
    return videos


def _register_crud_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/sessions")
    def list_sessions():
        db = ctx.get_db()
        try:
            sessions = db.query(RecordingSession).order_by(RecordingSession.created_at.desc()).all()
            return [_session_dict(s) for s in sessions]
        finally:
            db.close()

    @router.post("/api/sessions")
    def create_session(body: SessionCreate):
        db = ctx.get_db()
        try:
            members = _validate_members(db, body.video_ids)
            session = RecordingSession(name=(body.name or "").strip() or None)
            db.add(session)
            db.flush()
            for video in members:
                video.session_id = session.id
            db.commit()
            _log.info("Created session %d with %d recording(s): %s",
                      session.id, len(members), [v.id for v in members])
            return _session_dict(session)
        finally:
            db.close()

    @router.patch("/api/sessions/{session_id}")
    def rename_session(session_id: int, body: SessionRename):
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            session.name = body.name.strip() or None
            db.commit()
            return _session_dict(session)
        finally:
            db.close()

    @router.post("/api/sessions/{session_id}/members")
    def add_members(session_id: int, body: SessionMembers):
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            members = _validate_members(db, body.video_ids)
            for video in members:
                video.session_id = session.id
            db.commit()
            _log.info("Added %d recording(s) to session %d: %s",
                      len(members), session_id, [v.id for v in members])
            return _session_dict(session)
        finally:
            db.close()

    @router.delete("/api/sessions/{session_id}/members/{video_id}")
    def remove_member(session_id: int, video_id: int):
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            video = db.get(Video, video_id)
            if not video or video.session_id != session_id:
                raise HTTPException(404, "Recording is not a member of this session")
            video.session_id = None
            db.commit()
            _log.info("Removed recording %d from session %d", video_id, session_id)
            return _session_dict(session)
        finally:
            db.close()

    @router.delete("/api/sessions/{session_id}")
    def dissolve_session(session_id: int):
        """Dissolve a session: detach every member (session_id → NULL), then delete
        the session row. Recordings are never deleted."""
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            member_count = len(session.videos)
            for video in list(session.videos):
                video.session_id = None
            db.flush()
            db.delete(session)
            db.commit()
            _log.info("Dissolved session %d (detached %d recording(s))", session_id, member_count)
            return {"dissolved": session_id, "detached": member_count}
        finally:
            db.close()

    @router.get("/api/sessions/suggestions")
    def session_suggestions():
        """Suggest recordings that look like one session (gap-based auto-grouping).

        Only ungrouped top-level recordings are considered - a recording already in
        a session is left out so an accepted suggestion is never re-proposed."""
        db = ctx.get_db()
        try:
            ungrouped = [v for v in _grouping_recordings(db) if v.session_id is None]
            candidates = [
                SessionCandidate(v.id, _member_start_time(v), v.duration_ms or 0)
                for v in ungrouped
            ]
            groups = suggest_session_groups(candidates)
            title_by_id = {v.id: (v.title or v.filename) for v in ungrouped}
            return [
                {"video_ids": ids, "titles": [title_by_id.get(i, "") for i in ids]}
                for ids in groups
            ]
        finally:
            db.close()


def _register_detail_routes(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/sessions/{session_id}")
    def get_session(session_id: int):
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            members = sorted(session.videos, key=_member_start_time)
            return _session_detail_dict(db, session, members)
        finally:
            db.close()

    @router.patch("/api/sessions/{session_id}/fields")
    def update_session_fields(session_id: int, body: SessionFieldsUpdate):
        if body.action not in ("accept_edit", "revert"):
            raise HTTPException(400, "action must be accept_edit | revert")
        if body.field not in ("title", "summary", "both"):
            raise HTTPException(400, "field must be title | summary | both")
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            touch_title = body.field in ("title", "both")
            touch_summary = body.field in ("summary", "both")
            if body.action == "accept_edit":
                if touch_title:
                    if body.new_title is None:
                        raise HTTPException(400, "new_title is required for accept_edit")
                    session.title_user = body.new_title.strip()
                if touch_summary:
                    if body.new_summary is None:
                        raise HTTPException(400, "new_summary is required for accept_edit")
                    session.summary_user = body.new_summary.strip()
            else:  # revert
                if touch_title:
                    session.title_user = None
                if touch_summary:
                    session.summary_user = None
            db.commit()
            members = sorted(session.videos, key=_member_start_time)
            return _session_detail_dict(db, session, members)
        finally:
            db.close()

    @router.get("/api/sessions/{session_id}/summarize")
    async def summarize_session_route(session_id: int):
        """Roll up a session title + summary from members and auto-commit. SSE-wrapped."""
        from yuu_clip.scoring.llm import summarize_session

        reject_if_busy(ctx, "Session summary")
        db = ctx.get_db()
        try:
            session = db.get(RecordingSession, session_id)
            if not session:
                raise HTTPException(404, "Session not found")
            members = sorted(session.videos, key=_member_start_time)
            member_pairs = [(v.effective_title, v.effective_summary) for v in members]
            context_names = _merged_context_names(members)
        finally:
            db.close()

        if not any(t or s for t, s in member_pairs):
            raise HTTPException(400, "No recording titles or summaries yet - summarize the recordings first")

        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)

        async def event_stream():
            async with active_job(ctx):
                yield sse_event('[Generating session summary…]')
                try:
                    title_new, summary_new = await asyncio.to_thread(
                        summarize_session, member_pairs, ctx.config, context_text
                    )
                except Exception as exc:
                    _log.warning("session summarize failed for session %d: %s", session_id, exc, exc_info=True)
                    yield sse_event(f'[Error: {exc}]')
                    yield sse_event('__DONE__')
                    return

                save_db = ctx.get_db()
                try:
                    saved = save_db.get(RecordingSession, session_id)
                    if saved:
                        saved.title = title_new
                        saved.title_user = None
                        saved.summary = summary_new
                        saved.summary_user = None
                        saved.summarized_at = datetime.now(timezone.utc)
                        saved.summary_context_json = json_lib.dumps(context_names)
                        save_db.commit()
                finally:
                    save_db.close()

                yield sse_event('[Session summary generated]')
                yield sse_event('__DONE__')

        return sse_response(event_stream())


def _merged_context_names(members: list[Video]) -> list[str]:
    """Union of the members' assigned world-context ids, order-stable."""
    seen: list[str] = []
    for video in members:
        for name in json_list(video.context_names_json):
            if name not in seen:
                seen.append(name)
    return seen


def _member_offsets(members: list[tuple[datetime, int]]) -> list[tuple[int, int]]:
    """Cumulative axis offset and inter-recording gap per session member.

    *members* is (real-world start time, duration_ms) in timeline order. Returns
    (offset_ms, gap_before_ms) per member: offset_ms is the running sum of prior
    durations; gap_before_ms is the real-time silence between the previous
    recording's end and this one's start, clamped at 0 (overlaps read as no gap).
    """
    result: list[tuple[int, int]] = []
    offset_ms = 0
    prev_start: Optional[datetime] = None
    prev_duration_ms = 0
    for start_time, duration_ms in members:
        gap_before_ms = 0
        if prev_start is not None:
            gap_s = (start_time - prev_start).total_seconds() - prev_duration_ms / 1000.0
            gap_before_ms = max(0, int(gap_s * 1000))
        result.append((offset_ms, gap_before_ms))
        offset_ms += duration_ms
        prev_start = start_time
        prev_duration_ms = duration_ms
    return result


def _retime_timeline_entries(timeline: list[dict], offset_ms: int) -> list[dict]:
    """Re-offset raw {start_hms, end_hms, text} timeline entries onto the unified
    session axis: each gains local_ms (parsed from its start stamp) and abs_ms
    (local_ms shifted by the member's cumulative offset)."""
    entries = []
    for entry in timeline:
        local_ms = _hms_to_ms(entry.get("start_hms", ""))
        entries.append({
            "start_hms": entry.get("start_hms", ""),
            "end_hms": entry.get("end_hms", ""),
            "text": entry.get("text", ""),
            "local_ms": local_ms,
            "abs_ms": offset_ms + local_ms,
        })
    return entries


def _session_detail_dict(db, session: RecordingSession, members: list[Video]) -> dict:
    """Full session payload: rollup fields + members with unified-timeline offsets."""
    member_specs = [(_member_start_time(v), v.duration_ms or 0) for v in members]
    offsets = _member_offsets(member_specs)
    member_dicts = [
        _member_timeline_dict(db, video, offset_ms, gap_before_ms)
        for video, (offset_ms, gap_before_ms) in zip(members, offsets)
    ]
    total_ms = sum(duration_ms for _, duration_ms in member_specs)

    return {
        "id": session.id,
        "name": session.name or "",
        "title": session.effective_title,
        "title_original": session.title or "",
        "title_is_edited": session.title_user is not None,
        "summary": session.effective_summary,
        "summary_original": session.summary or "",
        "summary_is_edited": session.summary_user is not None,
        "summarized_at": session.summarized_at.isoformat() if session.summarized_at else None,
        "summary_context": json_list(session.summary_context_json),
        "total_ms": total_ms,
        "members": member_dicts,
    }


def _member_timeline_dict(db, video: Video, offset_ms: int, gap_before_ms: int) -> dict:
    """One member's contribution to the unified timeline: its re-offset timeline
    entries and clip markers, plus its cumulative axis offset."""
    timeline = json_lib.loads(video.timeline_json) if video.timeline_json else []
    entries = _retime_timeline_entries(timeline, offset_ms)
    clips = (
        db.query(ClipCandidate)
        .filter_by(video_id=video.id)
        .order_by(ClipCandidate.start_ms)
        .all()
    )
    clip_markers = [
        {
            "id": c.id,
            "local_ms": c.start_ms,
            "abs_ms": offset_ms + c.start_ms,
            "description": c.description or "",
            "score_overall": c.score_overall,
            "status": c.status,
        }
        for c in clips
    ]
    return {
        "id": video.id,
        "title": video.effective_title or video.filename,
        "filename": video.filename,
        "duration_ms": video.duration_ms or 0,
        "offset_ms": offset_ms,
        "gap_before_ms": gap_before_ms,
        "has_timeline": bool(video.timeline_json),
        "clip_count": len(clip_markers),
        "timeline": entries,
        "clips": clip_markers,
    }
