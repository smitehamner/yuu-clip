# Feature-map — NOT a feature: small cross-cutting helpers shared by two or more
#   route modules (clip lookup, SSE response, JSON-list column decode, analyze-in-
#   flight guards, transcript-segment edit staging). Bigger concerns that used to
#   live here now have named homes: web/file_deletion.py, export/paths.py.
"""Cross-cutting helpers shared by two or more route modules."""
from __future__ import annotations

import importlib.util
import json as json_lib
import re
from contextlib import asynccontextmanager
from typing import Iterable, Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from yuu_clip.db.models import ClipCandidate

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def module_findable(module: str) -> bool:
    """Whether *module* can be imported, without importing it.

    importlib.util.find_spec raises ModuleNotFoundError (rather than returning
    None) for a dotted name whose parent package is entirely absent — e.g.
    find_spec("pyannote.audio") raises when "pyannote" itself isn't installed.
    A completely-absent parent means "not installed" just as much as a present
    parent with a missing submodule, so both cases report False here.
    """
    try:
        return importlib.util.find_spec(module) is not None
    except ModuleNotFoundError:
        return False


def analyze_in_flight(ctx) -> bool:
    """Whether an analyze operation is currently running, across both the
    reattachable AnalyzeJob (ctx.analyze_job) and the legacy bare-subprocess
    tracking (ctx.analyze_proc)."""
    job = ctx.analyze_job
    if job is not None and not job.done:
        return True
    proc = ctx.analyze_proc
    return proc is not None and proc.returncode is None


def reject_if_analyzing(ctx) -> None:
    """Guard heavy DB-writing jobs (score/rescore/redescribe/rediarize) from
    running while an analysis is in flight — two writers on the same SQLite file
    would contend on the single-writer lock and stall each other."""
    if analyze_in_flight(ctx):
        raise HTTPException(
            409,
            "An analysis is still running — wait for it to finish or cancel it "
            "before starting another job.",
        )


@asynccontextmanager
async def active_job(ctx):
    ctx.active_jobs += 1
    try:
        yield
    finally:
        ctx.active_jobs -= 1


def sse_response(generator) -> StreamingResponse:
    return StreamingResponse(generator, media_type="text/event-stream", headers=_SSE_HEADERS)


def srt_to_vtt(srt: str) -> str:
    """Convert SRT text to WebVTT (comma→dot in timestamps, WEBVTT header) for
    <track> use in the browser."""
    return "WEBVTT\n\n" + re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)


def json_list(s: Optional[str]) -> list:
    """Decode a JSON-encoded list column, returning [] for NULL/missing values."""
    return json_lib.loads(s) if s else []


def stage_segment_text_edit(db, seg, new_text: str) -> list[ClipCandidate]:
    """Set a transcript segment's text and stage the downstream caption bookkeeping.

    Rebuilds the transcript excerpt of every clip overlapping the segment and stamps
    each with a fresh ``transcript_edited_at`` (so staleness badges fire). Does NOT
    commit and does NOT refresh export sidecars — the caller must ``db.commit()``
    then ``refresh_export_sidecars`` per returned clip (sidecar rewriting reads the
    committed state). Shared by the caption-edit route and name-correction apply so
    a corrected name flows through the exact same path as a manual caption edit.
    """
    from datetime import datetime, timezone

    from yuu_clip.segments.windower import rebuild_clip_excerpt

    seg.text = new_text
    video_id = seg.transcript.audio_track.video_id
    affected = (
        db.query(ClipCandidate)
        .filter(
            ClipCandidate.video_id == video_id,
            ClipCandidate.start_ms < seg.end_ms,
            ClipCandidate.end_ms > seg.start_ms,
        )
        .all()
    )
    edited_at = datetime.now(timezone.utc)
    for clip in affected:
        rebuild_clip_excerpt(clip)
        clip.transcript_edited_at = edited_at
    return affected


def require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def missing_ids(requested: Iterable[int], found_ids: set[int]) -> list[int]:
    """Requested IDs not present in *found_ids*, in the caller's original order."""
    return [cid for cid in requested if cid not in found_ids]
