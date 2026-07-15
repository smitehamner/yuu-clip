# Feature-map - NOT a feature: small cross-cutting helpers shared by two or more
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

from yuu_clip.db.models import ClipCandidate, Transcript, TranscriptSegment, Video

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def module_findable(module: str) -> bool:
    """Whether *module* can be imported, without importing it.

    importlib.util.find_spec raises ModuleNotFoundError (rather than returning
    None) for a dotted name whose parent package is entirely absent - e.g.
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


def job_in_flight(ctx) -> bool:
    """Whether ANY long-running op is active - the analyze subprocess, any counted
    in-process/subprocess SSE job, or a proxy build. The single source of truth for
    "is the app busy" that ``/api/status``'s ``any_running`` and the uniform busy
    guard both read."""
    return analyze_in_flight(ctx) or ctx.active_jobs > 0 or bool(ctx.proxy_generating)


def reject_if_busy(ctx, action: str) -> None:
    """Serialize every long-running op: 409 a new heavy job while any job is in
    flight. The app runs one job at a time (SQLite is single-writer, so overlapping
    DB writers would contend, and the single-job UI assumes it). *action* names the
    blocked op so the message is specific, e.g. "LLM scoring can't start - ...".
    """
    if job_in_flight(ctx):
        raise HTTPException(
            409,
            f"{action} can't start - another job is running. Wait for it to finish "
            "or cancel it before starting another.",
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


def register_model_download(response, ctx, key: str):
    """Clear ``ctx.model_downloads[key]`` when *response*'s SSE stream ends - on
    normal completion, subprocess exit, or client disconnect (StreamingResponse
    cancels the iterator, running the finally). The caller registers the key
    *before* building the stream so the shared "a required model is downloading"
    registry (read by the download banners and the analyze-start coordination) is
    already set while the stream runs. A non-streaming response (e.g. a test stub)
    is deregistered immediately."""
    iterator = getattr(response, "body_iterator", None)
    if iterator is None:
        ctx.model_downloads.pop(key, None)
        return response

    async def _gen():
        try:
            async for chunk in iterator:
                yield chunk
        finally:
            ctx.model_downloads.pop(key, None)

    response.body_iterator = _gen()
    return response


def srt_to_vtt(srt: str) -> str:
    """Convert SRT text to WebVTT (comma->dot in timestamps, WEBVTT header) for
    <track> use in the browser."""
    return "WEBVTT\n\n" + re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)


def json_list(s: Optional[str]) -> list:
    """Decode a JSON-encoded list column, returning [] for NULL/missing values."""
    return json_lib.loads(s) if s else []


def stage_segment_text_edit(db, seg, new_text: str) -> list[ClipCandidate]:
    """Set a transcript segment's text and stage the downstream caption bookkeeping.

    Rebuilds the transcript excerpt of every clip overlapping the segment and stamps
    each with a fresh ``transcript_edited_at`` (so staleness badges fire). Does NOT
    commit and does NOT refresh export sidecars - the caller must ``db.commit()``
    then ``refresh_export_sidecars`` per returned clip (sidecar rewriting reads the
    committed state). Shared by the caption-edit route and name-correction apply so
    a corrected name flows through the exact same path as a manual caption edit.
    """
    from datetime import datetime, timezone

    from yuu_clip.segments.windower import rebuild_clip_excerpt
    from yuu_clip.transcribe.align import realign_segment_words

    seg.text = new_text
    # Re-align per-word timings to the edited text so word-highlight captions track
    # the new wording; cleared to NULL (static-caption fallback) when alignment can't
    # run (non-English, missing source, failure).
    seg.words = realign_segment_words(seg)
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


def rebuild_video_excerpts(db, video_id: int) -> int:
    """Rebuild transcript excerpts for a video's clips so a speaker/Person rename shows up.

    Rebuilt from the recording's track-level transcripts (the same source clip
    generation used). Clips that were individually retranscribed keep their own
    excerpt - their per-clip transcripts are a separate source. Returns the count
    of clips whose excerpt was rebuilt. Shared by the Speaker-rename and People-view
    (ProjectVoice) routes so both refresh excerpts through the exact same path.
    """
    from yuu_clip.segments.windower import _build_excerpt

    video = db.get(Video, video_id)
    if not video:
        return 0
    track_ids = [t.id for t in video.audio_tracks if t.do_transcribe]
    if not track_ids:
        return 0
    tx_ids = [
        tx.id for tx in db.query(Transcript)
        .filter(Transcript.audio_track_id.in_(track_ids), Transcript.clip_id.is_(None))
        .all()
    ]
    if not tx_ids:
        return 0
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.transcript_id.in_(tx_ids))
        .order_by(TranscriptSegment.start_ms)
        .all()
    )

    rebuilt = 0
    clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
    for clip in clips:
        if clip.clip_transcripts:
            continue
        window = [s for s in segments if s.start_ms < clip.end_ms and s.end_ms > clip.start_ms]
        if window:
            clip.transcript_excerpt = _build_excerpt(window)
            rebuilt += 1
    return rebuilt


def require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def normalize_context_slug(raw: Optional[str]) -> Optional[str]:
    """A blank / whitespace-only context_slug means "global" (None); else trimmed.

    Shared by the hot-word and sensitive-term routes so "what a blank scope means"
    is decided in one place for both term types.
    """
    return (raw or "").strip() or None


def validate_context_slug(
    context_slug: Optional[str], project_dir, current_slug: Optional[str] = None
) -> None:
    """Reject a scoped hot-word / sensitive-term whose world context does not exist.

    Skips the check when the slug is unchanged from *current_slug*, so an already
    orphaned term (its context was deleted) can still be edited in other ways
    without being forced to re-scope. The rule and its user-facing message are
    shared by both term types - keep them in lockstep here rather than in each route.
    """
    from yuu_clip.contexts import known_context_ids

    if (
        context_slug is not None
        and context_slug != current_slug
        and context_slug not in known_context_ids(project_dir)
    ):
        raise HTTPException(
            400,
            f"Unknown world context '{context_slug}' - pick an existing context or leave it Global",
        )


def missing_ids(requested: Iterable[int], found_ids: set[int]) -> list[int]:
    """Requested IDs not present in *found_ids*, in the caller's original order."""
    return [cid for cid in requested if cid not in found_ids]
