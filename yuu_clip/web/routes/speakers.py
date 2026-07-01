"""Speaker naming routes — list the voices detected in a recording and rename them.

Speakers are durable, per-recording identities (see `Speaker` in db/models). Naming
one refreshes the transcript excerpts that show the name; caption sidecars and reels
already on disk are not rewritten (re-export to pick up the new name).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.contexts import format_context_block, load_contexts
from yuu_clip.db.models import (
    ClipCandidate,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
)
from yuu_clip.log import get_logger
from yuu_clip.segments.windower import _build_excerpt
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes._shared import _json_list

_log = get_logger(__name__)


class SpeakerRename(BaseModel):
    name: Optional[str] = None  # None or "" clears the name back to "Speaker N"


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
            return [_speaker_dict(s, samples.get(s.id)) for s in speakers]
        finally:
            db.close()

    @router.post("/api/videos/{video_id}/infer-speaker-names")
    def infer_names(video_id: int):
        """Suggest speaker names from direct address in the transcript (LLM-assisted).

        Writes each suggestion as an unconfirmed inferred name (source='inferred',
        confirmed=False) so it surfaces in the Speakers card for the user to accept —
        it never silently reaches captions or excerpts (see Speaker.display_name).
        Returns the refreshed speaker list plus how many suggestions were applied.
        """
        from yuu_clip.scoring.llm import check_llm_available, infer_speaker_names

        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")

            speakers = db.query(Speaker).filter_by(video_id=video_id).all()
            if not speakers:
                raise HTTPException(400, "No speakers detected — detect speakers first")

            labeled = _labeled_transcript(db, video_id, {s.id: s for s in speakers})
            if not labeled:
                raise HTTPException(400, "No speaker-attributed transcript available")

            ok, reason = check_llm_available(ctx.config)
            if not ok:
                raise HTTPException(400, reason)

            context_names = _json_list(video.context_names_json)
            context_text = format_context_block(load_contexts(ctx.project_dir), context_names)
            try:
                raw = infer_speaker_names(labeled, ctx.config, context_text=context_text)
            except Exception as exc:
                _log.warning("Name inference failed for video %d: %s", video_id, exc, exc_info=True)
                raise HTTPException(502, f"LLM error: {exc}")

            applied = _apply_name_suggestions(speakers, raw)
            db.commit()
            _log.info(
                "Name inference (video %d): LLM suggested %d, applied %d after dedupe",
                video_id, len(raw), applied,
            )
            samples = _speaker_samples(db, [s.id for s in speakers])
            return {
                "suggested": applied,
                "speakers": [_speaker_dict(s, samples.get(s.id)) for s in speakers],
            }
        finally:
            db.close()

    @router.put("/api/speakers/{speaker_id}")
    def rename_speaker(speaker_id: int, body: SpeakerRename):
        db = ctx.get_db()
        try:
            speaker = db.get(Speaker, speaker_id)
            if not speaker:
                raise HTTPException(404, "Speaker not found")

            name = (body.name or "").strip()
            speaker.name = name or None
            speaker.confirmed = True
            db.flush()

            refreshed = _rebuild_video_excerpts(db, speaker.video_id)
            db.commit()
            _log.info(
                "Renamed speaker %d (video %d) → %r; refreshed %d clip excerpt(s)",
                speaker_id, speaker.video_id, speaker.name, refreshed,
            )
            samples = _speaker_samples(db, [speaker.id])
            return _speaker_dict(speaker, samples.get(speaker.id))
        finally:
            db.close()

    return router


def _speaker_dict(speaker: Speaker, sample: Optional[dict]) -> dict:
    return {
        "id": speaker.id,
        "video_id": speaker.video_id,
        "display_index": speaker.display_index,
        "name": speaker.name,
        "display_name": speaker.display_name,
        "is_named": speaker.name is not None,
        "source": speaker.source,
        "confirmed": speaker.confirmed,
        "sample_text": sample["text"] if sample else "",
        "sample_start_ms": sample["start_ms"] if sample else None,
        "sample_end_ms": sample["end_ms"] if sample else None,
    }


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
    segments are dropped — direct-address inference needs a known speaker to attach to.
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


def _rebuild_video_excerpts(db, video_id: int) -> int:
    """Rebuild transcript excerpts for a video's clips so a rename shows up.

    Rebuilt from the recording's track-level transcripts (the same source clip
    generation used). Clips that were individually retranscribed keep their own
    excerpt — their per-clip transcripts are a separate source. Returns the count
    of clips whose excerpt was rebuilt.
    """
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
