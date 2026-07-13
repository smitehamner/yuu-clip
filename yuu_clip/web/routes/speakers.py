# Feature-map - Speaker labels / Speaker naming (code: Speaker; also "Suggest names", voice match)
#   UI: static/speakers.js (Speakers card in the recording detail view)
#   Siblings: transcribe/diarization_client.py · scoring/llm.py (infer_speaker_names) · tests/integration/test_speakers.py, tests/ui/test_ui_speakers.py
"""Speaker naming routes - list the voices detected in a recording and rename them.

Speakers are durable, per-recording identities (see `Speaker` in db/models). Naming
one refreshes the transcript excerpts that show the name; caption sidecars and reels
already on disk are not rewritten (re-export to pick up the new name).
"""
from __future__ import annotations

import asyncio
import json as json_lib
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func

from yuu_clip.contexts import format_context_block, load_contexts
from yuu_clip.db.models import (
    ClipCandidate,
    ProjectVoice,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
)
from yuu_clip.log import get_logger
from yuu_clip.segments.windower import rebuild_clip_excerpt
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import (
    active_job,
    json_list,
    rebuild_video_excerpts,
    sse_response,
)

_log = get_logger(__name__)


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class SpeakerRename(BaseModel):
    name: Optional[str] = None  # None or "" clears the name back to "Speaker N"
    color: Optional[str] = None  # "#RRGGBB"; None or "" clears back to the palette default


class SegmentSpeaker(BaseModel):
    speaker_id: Optional[int] = None  # None detaches the segment (back to unattributed)


class SpeakerCreate(BaseModel):
    name: Optional[str] = None   # optional; blank = an unnamed "Speaker N"
    color: Optional[str] = None  # optional "#RRGGBB"


class ReassignSegments(BaseModel):
    seg_ids: list[int]
    target_speaker_id: Optional[int] = None  # None moves the lines to Unassigned


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/videos/{video_id}/speakers")
    def list_speakers(video_id: int):
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            speakers = (
                db.query(Speaker)
                .filter_by(video_id=video_id)
                .order_by(Speaker.display_index)
                .all()
            )
            samples = _speaker_samples(db, [s.id for s in speakers])
            by_id = {s.id: s for s in speakers}
            voice_ids = {s.suggested_voice_id for s in speakers if s.suggested_voice_id}
            voice_names = {
                v.id: v.display_name
                for v in db.query(ProjectVoice).filter(ProjectVoice.id.in_(voice_ids)).all()
            } if voice_ids else {}
            return [
                _speaker_dict(
                    s, samples.get(s.id),
                    suggested_name=(
                        by_id[s.suggested_match_id].display_name
                        if s.suggested_match_id in by_id else None
                    ),
                    suggested_voice_name=voice_names.get(s.suggested_voice_id),
                )
                for s in speakers
            ]
        finally:
            db.close()

    @router.get("/api/videos/{video_id}/infer-speaker-names")
    async def infer_names(video_id: int):
        """Suggest speaker names from direct address in the transcript (LLM-assisted).

        Streams progress as SSE - the LLM pass over the whole transcript can be slow.
        Writes each suggestion as an unconfirmed inferred name (source='inferred',
        confirmed=False) so it surfaces in the Speakers card for the user to accept -
        it never silently reaches captions or excerpts (see Speaker.display_name).
        The done sentinel carries the number of suggestions applied.
        """
        from yuu_clip.scoring.llm import check_llm_available, infer_speaker_names

        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            speakers = db.query(Speaker).filter_by(video_id=video_id).all()
            if not speakers:
                raise HTTPException(400, "No speakers detected - detect speakers first")
            labeled = _labeled_transcript(db, video_id, {s.id: s for s in speakers})
            context_names = json_list(video.context_names_json)
        finally:
            db.close()

        if not labeled:
            raise HTTPException(400, "No speaker-attributed transcript available")
        ok, reason = check_llm_available(ctx.config)
        if not ok:
            raise HTTPException(400, reason)

        context_text = format_context_block(load_contexts(ctx.project_dir), context_names)

        async def event_stream():
            async with active_job(ctx):
                yield f"data: {json_lib.dumps('[Suggesting speaker names…]')}\n\n"
                try:
                    raw = await asyncio.to_thread(
                        infer_speaker_names, labeled, ctx.config, context_text=context_text
                    )
                except Exception as exc:
                    _log.warning("Name inference failed for video %d: %s", video_id, exc, exc_info=True)
                    yield f"data: {json_lib.dumps(f'[Error: {exc}]')}\n\n"
                    yield f"data: {json_lib.dumps('__DONE__')}\n\n"
                    return

                save_db = ctx.get_db()
                try:
                    speakers = save_db.query(Speaker).filter_by(video_id=video_id).all()
                    # Merge the transcript LLM guesses with voiceprint-propagated names
                    # (an unnamed voice inherits the name of the named voice it most
                    # resembles). The LLM wins on conflict; both funnel through the same
                    # dedupe guards. A propagated name only names the speaker - it never
                    # merges, so the separate same-recording "Same voice" merge chip
                    # stays a distinct action.
                    merged = {**_voiceprint_name_suggestions(speakers), **raw}
                    applied = _apply_name_suggestions(speakers, merged)
                    save_db.commit()
                finally:
                    save_db.close()

                _log.info(
                    "Name inference (video %d): LLM suggested %d, applied %d after dedupe",
                    video_id, len(raw), applied,
                )
                summary = (
                    f"[{applied} name suggestion(s) - review and accept]" if applied
                    else "[No names could be inferred from the transcript]"
                )
                yield f"data: {json_lib.dumps(summary)}\n\n"
                yield f"data: {json_lib.dumps({'type': '__DONE__', 'suggested': applied})}\n\n"

        return sse_response(event_stream())

    @router.put("/api/speakers/{speaker_id}")
    def rename_speaker(speaker_id: int, body: SpeakerRename):
        from yuu_clip.subtitles import refresh_export_sidecars
        db = ctx.get_db()
        try:
            speaker = db.get(Speaker, speaker_id)
            if not speaker:
                raise HTTPException(404, "Speaker not found")

            fields_set = body.model_fields_set
            refreshed = 0
            affected: list[ClipCandidate] = []
            if "name" in fields_set:
                name = (body.name or "").strip()
                speaker.name = name or None
                speaker.confirmed = True
                db.flush()
                refreshed = rebuild_video_excerpts(db, speaker.video_id)
                edited_at = datetime.now(timezone.utc)
                affected = db.query(ClipCandidate).filter_by(video_id=speaker.video_id).all()
                for clip in affected:
                    clip.transcript_edited_at = edited_at

            if "color" in fields_set:
                color = (body.color or "").strip()
                if color and not _HEX_COLOR_RE.match(color):
                    raise HTTPException(400, "Color must be a hex value like #4fc3f7")
                speaker.color = color or None

            db.commit()
            for clip in affected:
                refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)
            _log.info(
                "Updated speaker %d (video %d): name=%r color=%r; refreshed %d clip excerpt(s)",
                speaker_id, speaker.video_id, speaker.name, speaker.color, refreshed,
            )
            samples = _speaker_samples(db, [speaker.id])
            return _speaker_dict(speaker, samples.get(speaker.id))
        finally:
            db.close()

    @router.put("/api/transcript-segments/{seg_id}/speaker")
    def reassign_segment_speaker(seg_id: int, body: SegmentSpeaker):
        """Reattribute one transcript line to a different speaker (or detach it).

        Marks the segment as user-edited, rebuilds the excerpt of every clip that
        overlaps it (the excerpt groups by speaker), and flags those clips for
        re-score - mirrors the caption-edit route.
        """
        from yuu_clip.subtitles import refresh_export_sidecars
        db = ctx.get_db()
        try:
            seg = db.get(TranscriptSegment, seg_id)
            if not seg:
                raise HTTPException(404, "Transcript segment not found")
            video_id = seg.transcript.audio_track.video_id

            if body.speaker_id is not None:
                speaker = db.get(Speaker, body.speaker_id)
                if not speaker or speaker.video_id != video_id:
                    raise HTTPException(400, "Speaker does not belong to this recording")

            seg.speaker_id = body.speaker_id
            seg.speaker_edited = True

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
            db.commit()
            for clip in affected:
                refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)

            speaker = db.get(Speaker, seg.speaker_id) if seg.speaker_id is not None else None
            _log.info(
                "Reassigned segment %d (video %d) to speaker %s - rebuilt %d clip excerpt(s)",
                seg_id, video_id, seg.speaker_id, len(affected),
            )
            return {
                "seg_id": seg_id,
                "speaker_id": seg.speaker_id,
                "speaker": speaker.display_name if speaker else None,
                "color": speaker.display_color if speaker else None,
                "speaker_edited": True,
                "affected_clip_ids": [c.id for c in affected],
            }
        finally:
            db.close()

    @router.post("/api/speakers/{speaker_id}/confirm-match")
    def confirm_match(speaker_id: int):
        """Accept a borderline suggestion: merge this new Speaker into its suggested prior.

        Moves this Speaker's segments onto the prior Speaker (keeping its name/color),
        averages the two voiceprints, deletes this row, and refreshes the affected
        clip excerpts + export sidecars so the prior name surfaces. Returns the
        surviving prior Speaker.
        """
        from yuu_clip.subtitles import refresh_export_sidecars
        db = ctx.get_db()
        try:
            new_speaker = db.get(Speaker, speaker_id)
            if not new_speaker or new_speaker.suggested_match_id is None:
                raise HTTPException(404, "No pending voice-match suggestion for this speaker")
            prior = db.get(Speaker, new_speaker.suggested_match_id)
            if not prior:
                new_speaker.suggested_match_id = None
                new_speaker.suggested_match_score = None
                db.commit()
                raise HTTPException(404, "The suggested speaker no longer exists")
            video_id = prior.video_id
            _merge_speaker_into(db, new_speaker, prior)
            refreshed = rebuild_video_excerpts(db, video_id)
            edited_at = datetime.now(timezone.utc)
            affected = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            for clip in affected:
                clip.transcript_edited_at = edited_at
            db.commit()
            for clip in affected:
                refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)
            _log.info(
                "Confirmed voice match (video %d): merged speaker %d into speaker %d; "
                "refreshed %d clip excerpt(s)",
                video_id, speaker_id, prior.id, refreshed,
            )
            samples = _speaker_samples(db, [prior.id])
            return _speaker_dict(prior, samples.get(prior.id))
        finally:
            db.close()

    @router.post("/api/speakers/{speaker_id}/reject-match")
    def reject_match(speaker_id: int):
        """Dismiss a borderline suggestion: keep this Speaker separate, clear the near miss."""
        db = ctx.get_db()
        try:
            speaker = db.get(Speaker, speaker_id)
            if not speaker or speaker.suggested_match_id is None:
                raise HTTPException(404, "No pending voice-match suggestion for this speaker")
            speaker.suggested_match_id = None
            speaker.suggested_match_score = None
            db.commit()
            _log.info("Dismissed voice-match suggestion for speaker %d (video %d)",
                      speaker_id, speaker.video_id)
            samples = _speaker_samples(db, [speaker.id])
            return _speaker_dict(speaker, samples.get(speaker.id))
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/speakers")
    def create_speaker(video_id: int, body: SpeakerCreate):
        """Mint a new empty Speaker on a recording (for a voice diarization missed/merged).

        No voiceprint, source='manual', next display_index. Lines are moved onto it with
        the existing per-line / bulk reassignment endpoints. Name/colour validation
        matches rename_speaker.
        """
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            name = (body.name or "").strip() or None
            color = (body.color or "").strip()
            if color and not _HEX_COLOR_RE.match(color):
                raise HTTPException(400, "Color must be a hex value like #4fc3f7")
            next_index = (
                db.query(func.max(Speaker.display_index)).filter_by(video_id=video_id).scalar() or 0
            ) + 1
            speaker = Speaker(
                video_id=video_id, display_index=next_index, name=name,
                source="manual", confirmed=True, color=color or None,
            )
            db.add(speaker)
            db.commit()
            _log.info("Created manual speaker %d (video %d, index %d, name=%r)",
                      speaker.id, video_id, next_index, name)
            samples = _speaker_samples(db, [speaker.id])
            return _speaker_dict(speaker, samples.get(speaker.id))
        finally:
            db.close()

    @router.post("/api/speakers/{speaker_id}/merge-into/{target_id}")
    def merge_speaker(speaker_id: int, target_id: int):
        """Merge a whole Speaker into another: move all its lines onto the target.

        Reuses _merge_speaker_into (averages voiceprints, clears dangling suggestions),
        then rebuilds the recording's clip excerpts and refreshes export sidecars so the
        target's name surfaces everywhere. Guards self-merge and cross-recording merges.
        """
        from yuu_clip.subtitles import refresh_export_sidecars
        db = ctx.get_db()
        try:
            if speaker_id == target_id:
                raise HTTPException(400, "Cannot merge a speaker into itself")
            source = db.get(Speaker, speaker_id)
            target = db.get(Speaker, target_id)
            if not source or not target:
                raise HTTPException(404, "Speaker not found")
            if source.video_id != target.video_id:
                raise HTTPException(400, "Speakers belong to different recordings")
            video_id = target.video_id
            _merge_speaker_into(db, source, target)
            refreshed = rebuild_video_excerpts(db, video_id)
            edited_at = datetime.now(timezone.utc)
            affected = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            for clip in affected:
                clip.transcript_edited_at = edited_at
            db.commit()
            for clip in affected:
                refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)
            _log.info("Merged speaker %d into %d (video %d); refreshed %d clip excerpt(s)",
                      speaker_id, target_id, video_id, refreshed)
            samples = _speaker_samples(db, [target.id])
            return _speaker_dict(target, samples.get(target.id))
        finally:
            db.close()

    @router.put("/api/speakers/{speaker_id}/reassign-segments")
    def reassign_segments(speaker_id: int, body: ReassignSegments):
        """Move a selected subset of a Speaker's lines onto another Speaker (or Unassigned).

        One bulk endpoint (vs N per-line calls) so the excerpt rebuild + sidecar refresh
        run once. Only lines that actually belong to *speaker_id* are moved; each is
        flagged user-edited. Clips overlapping the moved lines are rebuilt + marked stale.
        """
        from yuu_clip.subtitles import refresh_export_sidecars
        db = ctx.get_db()
        try:
            source = db.get(Speaker, speaker_id)
            if not source:
                raise HTTPException(404, "Speaker not found")
            video_id = source.video_id
            if not body.seg_ids:
                raise HTTPException(400, "No transcript lines selected")
            if body.target_speaker_id is not None:
                target = db.get(Speaker, body.target_speaker_id)
                if not target or target.video_id != video_id:
                    raise HTTPException(400, "Target speaker does not belong to this recording")
            segs = (
                db.query(TranscriptSegment)
                .filter(TranscriptSegment.id.in_(body.seg_ids),
                        TranscriptSegment.speaker_id == speaker_id)
                .all()
            )
            if not segs:
                raise HTTPException(400, "None of the selected lines belong to this speaker")
            for seg in segs:
                seg.speaker_id = body.target_speaker_id
                seg.speaker_edited = True
            db.flush()
            rebuild_video_excerpts(db, video_id)
            affected = [
                clip for clip in db.query(ClipCandidate).filter_by(video_id=video_id).all()
                if any(s.start_ms < clip.end_ms and s.end_ms > clip.start_ms for s in segs)
            ]
            edited_at = datetime.now(timezone.utc)
            for clip in affected:
                clip.transcript_edited_at = edited_at
            db.commit()
            for clip in affected:
                refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)
            _log.info("Reassigned %d line(s) from speaker %d to %s (video %d)",
                      len(segs), speaker_id, body.target_speaker_id, video_id)
            return {
                "reassigned": len(segs),
                "target_speaker_id": body.target_speaker_id,
                "affected_clip_ids": [c.id for c in affected],
            }
        finally:
            db.close()

    return router


def _speaker_dict(speaker: Speaker, sample: Optional[dict],
                  suggested_name: Optional[str] = None,
                  suggested_voice_name: Optional[str] = None) -> dict:
    voice = speaker.global_voice
    return {
        "id": speaker.id,
        "video_id": speaker.video_id,
        "display_index": speaker.display_index,
        "name": speaker.name,
        "display_name": speaker.display_name,
        "is_named": speaker.name is not None,
        "source": speaker.source,
        "confirmed": speaker.confirmed,
        "color": speaker.display_color,
        "suggested_match_id": speaker.suggested_match_id,
        "suggested_match_score": speaker.suggested_match_score,
        "suggested_match_name": suggested_name,
        # Cross-recording Person (project-wide identity). person_* is the confirmed link;
        # suggested_voice_* is an unconfirmed cross-recording match awaiting confirm-voice.
        "global_voice_id": speaker.global_voice_id,
        "person_name": voice.display_name if voice is not None else None,
        "suggested_voice_id": speaker.suggested_voice_id,
        "suggested_voice_score": speaker.suggested_voice_score,
        "suggested_voice_name": suggested_voice_name,
        "sample_text": sample["text"] if sample else "",
        "sample_start_ms": sample["start_ms"] if sample else None,
        "sample_end_ms": sample["end_ms"] if sample else None,
    }


def _mean_voiceprint(a: Optional[bytes], b: Optional[bytes]) -> Optional[bytes]:
    """Element-wise mean of two serialized voiceprint centroids.

    Falls back to whichever side is present when the other is missing or the two
    have mismatched dimensions (never raises - a bad merge must not lose a print).
    """
    from yuu_clip.transcribe.whisper_runner import _deserialize_voiceprint, _serialize_voiceprint
    if not a:
        return b
    if not b:
        return a
    va, vb = _deserialize_voiceprint(a), _deserialize_voiceprint(b)
    if len(va) != len(vb):
        return a
    return _serialize_voiceprint([(x + y) / 2 for x, y in zip(va, vb)])


def _merge_speaker_into(db, source: Speaker, target: Speaker) -> None:
    """Move *source*'s segments to *target*, average voiceprints, delete *source*.

    The bulk update rewrites only speaker_id, so per-segment ``speaker_edited`` flags
    are preserved. Any other Speaker still suggesting *source* has that dangling
    suggestion cleared so the UI never points at a deleted row.
    """
    db.query(TranscriptSegment).filter_by(speaker_id=source.id).update(
        {"speaker_id": target.id}, synchronize_session=False
    )
    target.voiceprint = _mean_voiceprint(target.voiceprint, source.voiceprint)
    db.query(Speaker).filter_by(suggested_match_id=source.id).update(
        {"suggested_match_id": None, "suggested_match_score": None},
        synchronize_session=False,
    )
    db.delete(source)
    db.flush()


def _speaker_samples(db, speaker_ids: list[int]) -> dict[int, dict]:
    """One representative snippet per speaker: the text of their longest segment."""
    if not speaker_ids:
        return {}
    segs = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.speaker_id.in_(speaker_ids))
        .all()
    )
    best: dict[int, TranscriptSegment] = {}
    for seg in segs:
        current = best.get(seg.speaker_id)
        if current is None or (seg.end_ms - seg.start_ms) > (current.end_ms - current.start_ms):
            best[seg.speaker_id] = seg
    return {
        sid: {"text": seg.text.strip(), "start_ms": seg.start_ms, "end_ms": seg.end_ms}
        for sid, seg in best.items()
    }


def _labeled_transcript(db, video_id: int, speakers_by_id: dict[int, Speaker]) -> str:
    """Build the recording's transcript with each line prefixed by its "Speaker N" label.

    Uses only track-level transcripts (clip_id is None). Consecutive segments from the
    same speaker are merged onto one line to keep the prompt compact. Unattributed
    segments are dropped - direct-address inference needs a known speaker to attach to.
    """
    video = db.get(Video, video_id)
    track_ids = [t.id for t in video.audio_tracks if t.do_transcribe] if video else []
    if not track_ids:
        return ""
    tx_ids = [
        tx.id for tx in db.query(Transcript)
        .filter(Transcript.audio_track_id.in_(track_ids), Transcript.clip_id.is_(None))
        .all()
    ]
    if not tx_ids:
        return ""
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.transcript_id.in_(tx_ids))
        .order_by(TranscriptSegment.start_ms)
        .all()
    )
    lines: list[str] = []
    current_index: Optional[int] = None
    for seg in segments:
        speaker = speakers_by_id.get(seg.speaker_id)
        if speaker is None:
            continue
        text = seg.text.strip()
        if not text:
            continue
        if speaker.display_index == current_index:
            lines[-1] += " " + text
        else:
            lines.append(f"Speaker {speaker.display_index}: {text}")
            current_index = speaker.display_index
    return "\n".join(lines)


def _apply_name_suggestions(speakers: list[Speaker], suggestions: dict[str, str]) -> int:
    """Write deduped LLM name suggestions onto unconfirmed speakers. Returns the count applied.

    Guards: a name inferred for two different speakers is dropped for both (an ambiguous
    match is worse than none), and a name that collides with an already-confirmed speaker
    is skipped so two identities never share a name. Confirmed manual names are never
    overwritten. Suggestions are stored unconfirmed for the user to accept.
    """
    by_index = {s.display_index: s for s in speakers}
    taken = {s.name.lower() for s in speakers if s.name and s.confirmed}

    name_counts: dict[str, int] = {}
    for name in suggestions.values():
        name_counts[name.lower()] = name_counts.get(name.lower(), 0) + 1

    applied = 0
    for index_str, name in suggestions.items():
        try:
            speaker = by_index.get(int(index_str))
        except ValueError:
            continue
        if speaker is None or (speaker.name and speaker.confirmed):
            continue
        if name_counts[name.lower()] > 1 or name.lower() in taken:
            continue
        speaker.name = name
        speaker.source = "inferred"
        speaker.confirmed = False
        applied += 1
    return applied


_VOICEPRINT_SUGGEST_FLOOR = 0.5


def _voiceprint_name_suggestions(speakers: list[Speaker]) -> dict[str, str]:
    """Propose a name for each unnamed voiceprinted Speaker: the confirmed-named
    same-recording Speaker its voice most resembles.

    Seeds from the same-recording near-miss already recorded (``suggested_match_id``)
    when it points at a named Speaker, then extends by recomputing the best same-backend
    cosine against every confirmed-named Speaker above a suggest floor. Keyed by
    display_index (string) to match the LLM suggestion shape so both merge into one list
    and share the ``_apply_name_suggestions`` dedupe guards. Returns names only - it
    never merges Speakers.
    """
    from yuu_clip.transcribe.whisper_runner import _best_voiceprint_match, _deserialize_voiceprint

    by_id = {s.id: s for s in speakers}
    named = [s for s in speakers if s.name and s.confirmed and s.voiceprint]
    suggestions: dict[str, str] = {}
    for speaker in speakers:
        if (speaker.name and speaker.confirmed) or not speaker.voiceprint:
            continue
        prior = by_id.get(speaker.suggested_match_id)
        if prior is not None and prior.name and prior.confirmed:
            suggestions[str(speaker.display_index)] = prior.name
            continue
        match, _score, _top = _best_voiceprint_match(
            _deserialize_voiceprint(speaker.voiceprint), named, {speaker.id},
            threshold=_VOICEPRINT_SUGGEST_FLOOR, active_backend=speaker.voiceprint_backend,
        )
        if match is not None:
            suggestions[str(speaker.display_index)] = match.name
    return suggestions


