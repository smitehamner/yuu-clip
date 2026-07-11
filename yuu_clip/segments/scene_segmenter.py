"""
LLM transcript-segmentation generator (Clips-vs-Scenes Stage 3).

Asks the LLM to propose longer "scene" boundaries over a recording's transcript,
then materializes them as kind='scene' ClipCandidate rows in the shared
clip_candidates table. Opt-in and OFF by default (config.scene_generation_enabled) -
long windows x an LLM rubric are expensive.

Distinct from:
  - windower.py         - the silence-window clip generator (kind='clip')
  - db.models.SceneBoundary - a visual scene-cut timecode (SceneCutScorer), unrelated

The LLM prompt/parse lives in scoring/llm.request_scene_boundaries; this module owns
the geometry: chunking a long transcript, stitching + clamping boundaries to the video
range and the configured min/max, dropping overlaps, capping the count, and building
each scene's excerpt.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from yuu_clip.db.models import ClipCandidate, Transcript, TranscriptSegment, Video
from yuu_clip.log import get_logger
from yuu_clip.scoring.llm import request_scene_boundaries
from yuu_clip.segments.windower import build_excerpt_for_window, merge_transcribable_segments

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config

_log = get_logger(__name__)

_SCENE_TAGS = ["scene", "llm_segmented"]

# Feed at most this many transcript characters to the LLM per boundary request; longer
# transcripts are chunked and their boundaries stitched, so a multi-hour recording
# stays inside a small local model's context window (and bounds the request cost).
_CHUNK_CHAR_BUDGET = 8_000
# Rough per-line prefix overhead ("[1234567] ") added to each segment's char count so a
# chunk of many short segments still respects the budget.
_LINE_OVERHEAD_CHARS = 16


def generate_scenes(
    video: Video,
    transcripts: list[Transcript],
    config: "Config",
    session: "Session",
) -> list[ClipCandidate]:
    """Propose scene candidates for *video* via the LLM and add kind='scene' rows.

    Returns the newly created ClipCandidate objects (added to *session*, not committed).
    Empty when there is no transcribable speech or the LLM proposes nothing usable -
    never raises for those cases. The caller pre-flights LLM availability.
    """
    segments = merge_transcribable_segments(transcripts)
    if not segments:
        _log.info("generate_scenes: no transcribable segments for video %d - no scenes", video.id)
        return []

    timeline_start = segments[0].start_ms
    timeline_end = max(s.end_ms for s in segments)

    proposals = _request_boundaries_chunked(segments, config)
    bounds = _normalize_boundaries(
        proposals, timeline_start, timeline_end,
        min_ms=config.scene_min_ms, max_ms=config.scene_max_ms,
    )
    bounds = bounds[: max(0, config.scene_target_count)]

    scenes: list[ClipCandidate] = []
    for start_ms, end_ms, reason in bounds:
        scene = ClipCandidate(
            video_id=video.id,
            start_ms=start_ms,
            end_ms=end_ms,
            kind="scene",
            transcript_excerpt=build_excerpt_for_window(video, start_ms, end_ms),
            status="pending",
        )
        scene.tags = list(_SCENE_TAGS)
        if reason:
            scene.reasons = [reason]
        session.add(scene)
        scenes.append(scene)

    _log.info(
        "generate_scenes: video %d - %d scene(s) from %d boundary proposal(s)",
        video.id, len(scenes), len(proposals),
    )
    return scenes


def _request_boundaries_chunked(segments: list[TranscriptSegment], config: "Config") -> list[dict]:
    """Request boundaries for each transcript chunk and concatenate them.

    A chunk that fails to parse (even after the repair retry) is logged and skipped so
    one bad chunk never loses the whole recording's scenes; the boundaries are stitched
    globally afterward (_normalize_boundaries sorts + de-overlaps across chunks)."""
    proposals: list[dict] = []
    for chunk in _chunk_segments(segments, _CHUNK_CHAR_BUDGET):
        block = _format_transcript_block(chunk)
        if not block:
            continue
        try:
            proposals.extend(request_scene_boundaries(block, config))
        except Exception as exc:
            _log.warning("generate_scenes: boundary request failed for a chunk - skipping it: %s", exc)
    return proposals


def _chunk_segments(
    segments: list[TranscriptSegment], char_budget: int
) -> list[list[TranscriptSegment]]:
    chunks: list[list[TranscriptSegment]] = []
    current: list[TranscriptSegment] = []
    current_chars = 0
    for seg in segments:
        seg_chars = len(seg.text or "") + _LINE_OVERHEAD_CHARS
        if current and current_chars + seg_chars > char_budget:
            chunks.append(current)
            current = []
            current_chars = 0
        current.append(seg)
        current_chars += seg_chars
    if current:
        chunks.append(current)
    return chunks


def _format_transcript_block(segments: list[TranscriptSegment]) -> str:
    return "\n".join(
        f"[{seg.start_ms}] {(seg.text or '').strip()}"
        for seg in segments
        if (seg.text or "").strip()
    )


def _normalize_boundaries(
    proposals: list[dict], timeline_start: int, timeline_end: int, min_ms: int, max_ms: int
) -> list[tuple[int, int, str]]:
    """Clamp each proposed boundary to the transcript's time range and the min/max scene
    length, drop invalid or too-short ones, then sort and drop overlaps. Out-of-order and
    overlapping LLM output (the two most common failure modes) are handled here."""
    cleaned: list[tuple[int, int, str]] = []
    for boundary in proposals:
        start = max(timeline_start, min(boundary["start_ms"], timeline_end))
        end = max(timeline_start, min(boundary["end_ms"], timeline_end))
        if end <= start:
            continue
        if end - start > max_ms:
            end = start + max_ms
        if end - start < min_ms:
            continue
        cleaned.append((start, end, boundary.get("reason", "")))

    cleaned.sort(key=lambda b: b[0])
    return _drop_overlaps(cleaned)


def _drop_overlaps(sorted_bounds: list[tuple[int, int, str]]) -> list[tuple[int, int, str]]:
    """Keep the earliest scene and drop any later one that starts before the last kept
    scene ends. Scenes are independent moments, so an overlap is a duplicate boundary."""
    result: list[tuple[int, int, str]] = []
    last_end: int | None = None
    for start, end, reason in sorted_bounds:
        if last_end is not None and start < last_end:
            continue
        result.append((start, end, reason))
        last_end = end
    return result
