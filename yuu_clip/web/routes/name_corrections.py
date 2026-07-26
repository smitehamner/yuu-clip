# Feature-map - Name corrections (code: name_corrections; UI "Fix names")
#   UI: static/people/namecorrections.js (PanelNav takeover from the transcript card)
#   Siblings: scoring/textmatch.py (find_name_corrections) · tests/integration/test_name_corrections.py, tests/js/people/namecorrections.test.js
"""Transcript name-correction routes (Plan 09).

Whisper mis-hears spoken names ("You" for "Yuu"). Scan a recording's transcript for
likely mis-transcriptions of *known* names (confirmed speakers + world-context
characters), present them grouped for review, and apply only what the user approves.
Nothing is ever auto-applied; applying routes through the same caption-edit path as a
manual edit (``stage_segment_text_edit``) so staleness badges and sidecars behave
identically.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.contexts import load_contexts
from yuu_clip.db.models import ClipCandidate, Speaker, Transcript, TranscriptSegment, Video
from yuu_clip.log import get_logger
from yuu_clip.scoring.textmatch import (
    LexiconName,
    extract_character_names,
    find_name_corrections,
)
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import (
    json_list,
    stage_segment_text_edit,
    touch_video_transcript_edited,
    with_write_retry,
)

_log = get_logger(__name__)


class ApplyItem(BaseModel):
    segment_id: int
    token_start: int
    token_end: int
    token: str          # the original text expected at [start:end] - drift check
    replacement: str


class ApplyRequest(BaseModel):
    corrections: list[ApplyItem]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/videos/{video_id}/name-corrections/scan")
    def scan(video_id: int):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            speakers = db.query(Speaker).filter_by(video_id=video_id).all()
            lexicon = _build_lexicon(ctx, video, speakers)
            segments = _track_segments(db, video)
            corrections = find_name_corrections(segments, lexicon)
            return {
                "lexicon": [entry.name for entry in lexicon],
                "scanned_segments": len(segments),
                "groups": _group_corrections(corrections, segments, speakers),
            }
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/name-corrections/apply")
    def apply(video_id: int, body: ApplyRequest):
        from yuu_clip.subtitles import refresh_export_sidecars

        def _op():
            db = ctx.get_db()
            try:
                video = db.get(Video, video_id)
                if not video:
                    raise HTTPException(404, "Video not found")
                valid_seg_ids = {s.id for s in _track_segments(db, video)}
                by_segment: dict[int, list[ApplyItem]] = {}
                for item in body.corrections:
                    by_segment.setdefault(item.segment_id, []).append(item)

                results: list[dict] = []
                affected: dict[int, object] = {}
                for seg_id, items in by_segment.items():
                    seg = db.get(TranscriptSegment, seg_id)
                    if seg is None or seg_id not in valid_seg_ids:
                        results.extend(_failed(items, "segment_not_found"))
                        continue
                    new_text, seg_results = _apply_spans(seg.text, items)
                    results.extend(seg_results)
                    if new_text != seg.text:
                        for clip in stage_segment_text_edit(db, seg, new_text):
                            affected[clip.id] = clip
                if affected:
                    touch_video_transcript_edited(db, video_id)
                db.commit()
                return results, list(affected), len(by_segment)
            finally:
                db.close()

        results, affected_clip_ids, segment_count = with_write_retry(_op)

        db = ctx.get_db()
        try:
            for clip_id in affected_clip_ids:
                clip = db.get(ClipCandidate, clip_id)
                if clip is not None:
                    refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)
        finally:
            db.close()
        applied = sum(1 for r in results if r["applied"])
        _log.info(
            "Name corrections (video %d): applied %d of %d across %d segment(s)",
            video_id, applied, len(results), segment_count,
        )
        return {"applied": applied, "results": results,
                "affected_clip_ids": affected_clip_ids}

    return router


def _build_lexicon(ctx: ProjectContext, video: Video, speakers: list[Speaker]) -> list[LexiconName]:
    """Confirmed speaker names (owned) + world-context character names (unowned).

    A name shared by a speaker and a character keeps the speaker entry so the
    own-name exclusion still applies.
    """
    entries: list[LexiconName] = []
    seen: set[str] = set()
    for speaker in speakers:
        if speaker.name and speaker.confirmed:
            key = speaker.name.casefold()
            if key not in seen:
                seen.add(key)
                entries.append(LexiconName(speaker.name, owner_speaker_id=speaker.id))

    contexts = load_contexts(ctx.project_dir)
    for context_id in json_list(video.context_names_json):
        context = contexts.get(context_id, {})
        free_text = f"{context.get('your_characters', '')}\n{context.get('other_characters', '')}"
        for name in extract_character_names(free_text):
            key = name.casefold()
            if key not in seen:
                seen.add(key)
                entries.append(LexiconName(name, owner_speaker_id=None))
    return entries


def _track_segments(db, video: Video) -> list[TranscriptSegment]:
    """Track-level (clip_id IS NULL) transcript segments for a recording, time-ordered."""
    track_ids = [t.id for t in video.audio_tracks if t.do_transcribe]
    if not track_ids:
        return []
    tx_ids = [
        tx.id for tx in db.query(Transcript)
        .filter(Transcript.audio_track_id.in_(track_ids), Transcript.clip_id.is_(None))
        .all()
    ]
    if not tx_ids:
        return []
    return (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.transcript_id.in_(tx_ids))
        .order_by(TranscriptSegment.start_ms)
        .all()
    )


def _group_corrections(corrections, segments, speakers: list[Speaker]) -> list[dict]:
    """Group corrections by (token, suggested) with per-instance ±1-line context."""
    order = {seg.id: i for i, seg in enumerate(segments)}
    speaker_names = {s.id: s.display_name for s in speakers}
    groups: dict[tuple[str, str], dict] = {}
    for correction in corrections:
        key = (correction.token.casefold(), correction.suggested)
        group = groups.get(key)
        if group is None:
            group = {"token": correction.token, "suggested": correction.suggested, "instances": []}
            groups[key] = group
        index = order.get(correction.segment_id)
        # `line` is the raw (unstripped) segment text so token_start/token_end index
        # into it correctly for highlighting; before/after are display-only context.
        raw_line = segments[index].text if index is not None else ""
        group["instances"].append({
            "segment_id": correction.segment_id,
            "token": correction.token,
            "token_start": correction.token_start,
            "token_end": correction.token_end,
            "score": correction.score,
            "speaker_scoped": correction.speaker_scoped,
            "common_word": correction.common_word,
            "speaker": speaker_names.get(_segment_speaker_id(segments, index)),
            "before": _line_text(segments, index, -1),
            "line": raw_line,
            "after": _line_text(segments, index, 1),
        })
    ranked = sorted(groups.values(), key=lambda g: len(g["instances"]), reverse=True)
    for group in ranked:
        group["count"] = len(group["instances"])
    return ranked


def _segment_speaker_id(segments, index: Optional[int]) -> Optional[int]:
    if index is None or not (0 <= index < len(segments)):
        return None
    return segments[index].speaker_id


def _line_text(segments, index: Optional[int], offset: int) -> str:
    if index is None:
        return ""
    pos = index + offset
    if not (0 <= pos < len(segments)):
        return ""
    return (segments[pos].text or "").strip()


def _apply_spans(text: str, items: list[ApplyItem]) -> tuple[str, list[dict]]:
    """Apply span replacements to *text*, rightmost first so earlier offsets stay valid.

    Each item is validated against the current text at its span; a mismatch (the user
    edited the line since the scan) is reported as ``text_changed`` and skipped without
    disturbing the other items.
    """
    ordered = sorted(items, key=lambda item: item.token_start, reverse=True)
    results: list[dict] = []
    new_text = text
    for item in ordered:
        current = new_text[item.token_start:item.token_end]
        applied = current == item.token
        if applied:
            new_text = new_text[:item.token_start] + item.replacement + new_text[item.token_end:]
        results.append({
            "segment_id": item.segment_id,
            "token_start": item.token_start,
            "applied": applied,
            "error": None if applied else "text_changed",
        })
    results.reverse()  # report in the caller's original left-to-right order
    return new_text, results


def _failed(items: list[ApplyItem], error: str) -> list[dict]:
    return [{"segment_id": item.segment_id, "token_start": item.token_start,
             "applied": False, "error": error} for item in items]
