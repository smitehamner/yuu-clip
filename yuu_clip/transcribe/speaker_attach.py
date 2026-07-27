"""
Speaker attribution - mapping diarization output to durable per-recording Speakers.

Backend-agnostic post-processing that sits downstream of any DiarizationClient: it
takes the raw speaker turns + voiceprints a backend produced and resolves them to
Speaker rows (re-attaching a named voice by voiceprint, or minting a new Speaker),
then proposes cross-recording Person matches. Split out of the transcription
orchestrator (whisper_runner) because it is about speaker identity, not speech-to-text.
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from rich.console import Console

from yuu_clip.db.models import ProjectVoice, Speaker, TranscriptSegment
from yuu_clip.log import get_logger
from yuu_clip.transcribe.diarization_client import (
    DiarizationError,
    make_diarization_client,
)

# The pure voiceprint math lives in project_voice (importable in the offline unit tier
# without torch/whisper). Re-exported under the historical private names so existing
# importers (e.g. speakers._mean_voiceprint) keep working unchanged.
from yuu_clip.transcribe.project_voice import best_voice_match
from yuu_clip.transcribe.project_voice import (
    cosine_similarity as _cosine_similarity,
)
from yuu_clip.transcribe.project_voice import (
    deserialize_voiceprint as _deserialize_voiceprint,
)
from yuu_clip.transcribe.project_voice import (
    serialize_voiceprint as _serialize_voiceprint,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import AudioTrack, Transcript

_log = get_logger(__name__)
console = Console()


def _assign_speakers(
    session: "Session",
    transcript_id: int,
    turns: list[tuple[float, float, str]],
) -> None:
    """Populate speaker_label on every segment by greatest time overlap with *turns*."""
    if not turns:
        return
    segs = (
        session.query(TranscriptSegment)
        .filter_by(transcript_id=transcript_id)
        .order_by(TranscriptSegment.start_ms)
        .all()
    )
    for seg in segs:
        seg_start = seg.start_ms / 1000
        seg_end   = seg.end_ms   / 1000
        best_label: str | None = None
        best_overlap = 0.0
        for turn_start, turn_end, label in turns:
            overlap = max(0.0, min(seg_end, turn_end) - max(seg_start, turn_start))
            if overlap > best_overlap:
                best_overlap = overlap
                best_label   = label
        seg.speaker_label = best_label
    session.flush()


def _strip_reimported_speaker_prefixes(
    session: "Session", transcript_id: int, track_label: str
) -> None:
    """Drop a leading ``[Speaker]`` prefix a re-imported yuu-clip SRT baked into a cue,
    now that this run's diarization has re-assigned each segment's speaker, so the fresh
    render prefix doesn't double it. Generic and track-label prefixes are already stripped
    at import (``_import_subtitles``); this pass adds the re-attributed NAMED speaker's
    own display. A no-op for normally-transcribed cues, whose text never starts with a tag.
    """
    from yuu_clip.subtitles import strip_baked_speaker_prefix, track_label_display

    track_display = track_label_display(track_label)
    segs = (
        session.query(TranscriptSegment)
        .filter_by(transcript_id=transcript_id)
        .all()
    )
    changed = False
    for seg in segs:
        extra = [track_display]
        if seg.speaker_id is not None and seg.speaker is not None:
            extra.append(seg.speaker.display_name)
        elif seg.speaker_label:
            extra.append(track_label_display(seg.speaker_label))
        cleaned = strip_baked_speaker_prefix(seg.text, extra)
        if cleaned != seg.text:
            seg.text = cleaned
            changed = True
    if changed:
        session.flush()


# Default cosine similarity above which a new diarization cluster is treated as the
# same voice as an existing named Speaker and re-attached to it. Deliberately high:
# the user's requirement is to never mis-remap a name, so when unsure we would rather
# mint a fresh "Speaker N" to re-confirm than attach a name to the wrong voice.
# Overridable per-project via Config.speaker_match_threshold (Settings -> Speaker labels).
_VOICEPRINT_MATCH_THRESHOLD = 0.75

# Width of the borderline "confirm this voice" band immediately below the match
# threshold. A cluster whose best similarity lands in [threshold - band, threshold)
# is minted as a fresh Speaker (as before) but also records a suggested match so the
# user can confirm it is the same voice rather than the re-attach silently dropping
# it. Fixed at 0.10 in v1 (plan 01); no Settings field for it yet.
_CONFIRM_BAND_WIDTH = 0.10


def _best_voiceprint_match(vector, candidates, taken_ids, threshold=_VOICEPRINT_MATCH_THRESHOLD,
                           active_backend=None):
    """Score *vector* against each unused candidate Speaker's voiceprint.

    Returns ``(matched, score, top)`` where ``top`` is the single most-similar unused
    candidate that has a voiceprint (or ``None`` when there were none), ``score`` its
    cosine, and ``matched`` is ``top`` when ``score >= threshold`` else ``None``.
    Callers use ``top`` / ``score`` to record a near-threshold suggestion when
    ``matched`` is ``None``.

    Candidates whose voiceprint came from a different diarization backend are
    skipped: embeddings from different backends live in incompatible spaces (and
    dimensionalities), so a cross-backend cosine would be meaningless.
    """
    top_speaker = None
    top_score = 0.0
    for speaker in candidates:
        if speaker.id in taken_ids or not speaker.voiceprint:
            continue
        # active_backend=None means the current run's backend is unknown (legacy
        # caller) - deliberately skip the filter rather than reject every candidate,
        # tolerating a cross-backend comparison against an old/different backend.
        if active_backend is not None and speaker.voiceprint_backend != active_backend:
            continue
        score = _cosine_similarity(vector, _deserialize_voiceprint(speaker.voiceprint))
        if top_speaker is None or score > top_score:
            top_speaker = speaker
            top_score = score
    matched = top_speaker if (top_speaker is not None and top_score >= threshold) else None
    return matched, top_score, top_speaker


def _report_attach_decision(video_id, speaker, score, threshold, matched,
                            has_candidates, suggested=False) -> None:
    """Log (INFO) and surface via the SSE stream one cluster's re-attach outcome.

    The best similarity is reported even on a miss so the voiceprint threshold can
    be validated against real recordings from the Re-diarize stream without tailing
    the log (plan 01, stage 1). ``console`` output goes to the subprocess stdout the
    web UI streams as SSE.
    """
    if matched:
        _log.info("Voiceprint re-attach: speaker %d (video %d, cosine %.3f)",
                  speaker.id, video_id, score)
        console.print(f"    [dim]Re-attached to Speaker {speaker.display_index} "
                      f"(voice similarity {score:.2f})[/dim]")
    elif suggested:
        _log.info("Voiceprint near-miss: minted speaker %d (video %d, cosine %.3f in "
                  "[%.2f, %.2f)) - suggested match to speaker %d",
                  speaker.id, video_id, score, threshold - _CONFIRM_BAND_WIDTH,
                  threshold, speaker.suggested_match_id)
        console.print(f"    [dim]New Speaker {speaker.display_index} - possible match "
                      f"(voice similarity {score:.2f}, just below {threshold:.2f})[/dim]")
    elif has_candidates:
        _log.info("Voiceprint miss: minted speaker %d (video %d, best cosine %.3f < %.2f)",
                  speaker.id, video_id, score, threshold)
        console.print(f"    [dim]New Speaker {speaker.display_index} "
                      f"(closest existing voice {score:.2f}, below {threshold:.2f})[/dim]")
    else:
        _log.info("New speaker %d minted (video %d, no prior voiceprints)", speaker.id, video_id)
        console.print(f"    [dim]New Speaker {speaker.display_index}[/dim]")


def _match_or_mint_cluster(
    session: "Session",
    video_id: int,
    vector: list[float] | None,
    prior_speakers: list["Speaker"],
    taken_ids: set[int],
    threshold: float,
    active_backend: str | None,
    has_candidates: bool,
    mint_display_index: int,
) -> tuple[int, str]:
    """Resolve one raw cluster to a Speaker id: re-attach to a matching prior
    Speaker or mint a new one. Returns (speaker_id, "matched" | "minted").

    Mutates *taken_ids* on a match so each prior Speaker is claimed at most once.
    The caller owns display numbering: *mint_display_index* is used only when a new
    Speaker is minted.
    """
    match, score, near = (
        _best_voiceprint_match(vector, prior_speakers, taken_ids, threshold, active_backend)
        if vector else (None, 0.0, None)
    )
    if match is not None:
        taken_ids.add(match.id)
        if not match.voiceprint:
            match.voiceprint = _serialize_voiceprint(vector)
            match.voiceprint_backend = active_backend
        _report_attach_decision(video_id, match, score, threshold,
                                matched=True, has_candidates=has_candidates)
        return match.id, "matched"

    in_band = near is not None and score >= threshold - _CONFIRM_BAND_WIDTH
    speaker = Speaker(
        video_id=video_id,
        display_index=mint_display_index,
        source="manual",
        voiceprint=_serialize_voiceprint(vector) if vector else None,
        voiceprint_backend=active_backend if vector else None,
        suggested_match_id=near.id if in_band else None,
        suggested_match_score=score if in_band else None,
    )
    session.add(speaker)
    session.flush()
    if vector:
        _report_attach_decision(video_id, speaker, score, threshold, matched=False,
                                has_candidates=has_candidates, suggested=in_band)
    return speaker.id, "minted"


def _attach_speakers(
    session: "Session",
    video_id: int,
    transcript_id: int,
    embeddings_by_label: dict[str, list[float]] | None = None,
    threshold: float = _VOICEPRINT_MATCH_THRESHOLD,
    active_backend: str | None = None,
) -> None:
    """Attribute this run's segments to durable per-recording Speakers.

    When a raw cluster carries a voiceprint that matches an existing Speaker
    (cosine >= threshold), the segments re-attach to that Speaker so its name
    survives re-diarization. Otherwise a fresh Speaker is minted (storing the
    voiceprint when available). Matches are only made against Speakers that
    existed *before* this run, and each prior Speaker matches at most one current
    cluster - the diarization backend already separated the current clusters, so
    two of them must not collapse onto one identity. display_index continues from
    the recording's current max so "Speaker N" numbering never collides.
    """
    embeddings_by_label = embeddings_by_label or {}
    segs = (
        session.query(TranscriptSegment)
        .filter_by(transcript_id=transcript_id)
        .order_by(TranscriptSegment.start_ms)
        .all()
    )
    labels_in_order: list[str] = []
    for seg in segs:
        if seg.speaker_label and seg.speaker_label not in labels_in_order:
            labels_in_order.append(seg.speaker_label)
    if not labels_in_order:
        return

    prior_speakers = session.query(Speaker).filter_by(video_id=video_id).all()
    has_candidates = any(s.voiceprint for s in prior_speakers)
    next_index = max((s.display_index for s in prior_speakers), default=0)
    taken_ids: set[int] = set()
    label_to_speaker_id: dict[str, int] = {}
    matched = 0
    minted = 0
    without_voiceprint = 0

    for label in labels_in_order:
        vector = embeddings_by_label.get(label)
        if not vector:
            without_voiceprint += 1
        speaker_id, outcome = _match_or_mint_cluster(
            session, video_id, vector, prior_speakers, taken_ids,
            threshold, active_backend, has_candidates, next_index + 1,
        )
        label_to_speaker_id[label] = speaker_id
        if outcome == "matched":
            matched += 1
        else:
            minted += 1
            next_index += 1

    for seg in segs:
        if seg.speaker_label in label_to_speaker_id:
            seg.speaker_id = label_to_speaker_id[seg.speaker_label]
    session.flush()

    _log.info(
        "Speaker attribution (video %d): %d cluster(s) -> %d re-attached, %d minted "
        "(%d had no voiceprint), %d prior speaker(s)",
        video_id, len(labels_in_order), matched, minted,
        without_voiceprint, len(prior_speakers),
    )


def prune_empty_speakers(session: "Session", video_id: int) -> int:
    """Delete unnamed Speaker rows for *video_id* left with zero segments.

    Re-diarization can split a previously over-merged voice into new Speaker rows,
    leaving the old one with none of this run's segments attached (see
    _attach_speakers - prior Speakers are only ever matched or left alone, never
    removed). Only unnamed rows are auto-deleted: a user-given name is never
    silently discarded, so an empty *named* Speaker is left for the user to merge
    or remove by hand. Mirrors the delete side of _merge_speaker_into (routes/
    speakers.py): clear dangling suggested_match_id pointers before the delete so
    SQLite's FK enforcement doesn't block it.
    """
    speakers = session.query(Speaker).filter_by(video_id=video_id).all()
    if not speakers:
        return 0
    speaker_ids = [s.id for s in speakers]
    still_used = {
        row[0]
        for row in session.query(TranscriptSegment.speaker_id)
        .filter(TranscriptSegment.speaker_id.in_(speaker_ids))
        .distinct()
    }
    removed = 0
    for speaker in speakers:
        if speaker.name or speaker.id in still_used:
            continue
        session.query(Speaker).filter_by(suggested_match_id=speaker.id).update(
            {"suggested_match_id": None, "suggested_match_score": None},
            synchronize_session=False,
        )
        session.delete(speaker)
        removed += 1
    if removed:
        session.flush()
        _log.info("Pruned %d empty unnamed speaker(s) for video %d", removed, video_id)
    return removed


def suggest_project_voices(session: "Session", video_id: int, threshold: float) -> None:
    """Propose cross-recording Person matches for this recording's Speakers.

    For each Speaker with a voiceprint that is not already linked to a Person, find the
    most similar existing ProjectVoice (nearest exemplar, same backend) and, at/above
    the strict cross-recording threshold, record it as a SUGGESTION
    (suggested_voice_id / suggested_voice_score). ``global_voice_id`` is NEVER set here:
    a wrong cross-recording merge propagates a name project-wide, so application is a
    People-view confirm action only (locked decision). One Person is suggested to at
    most one Speaker per recording. No project voices yet, no voiceprint, or a backend
    that matches no exemplar all mean "no suggestion" (never an error).
    """
    voices = session.query(ProjectVoice).all()
    if not voices:
        return
    speakers = (
        session.query(Speaker)
        .filter_by(video_id=video_id)
        .order_by(Speaker.display_index)
        .all()
    )
    taken_ids: set[int] = set()
    suggested = 0
    for speaker in speakers:
        if speaker.global_voice_id is not None or not speaker.voiceprint:
            continue
        vector = _deserialize_voiceprint(speaker.voiceprint)
        match, score, _top = best_voice_match(
            vector, speaker.voiceprint_backend, voices, taken_ids, threshold
        )
        if match is None:
            continue
        taken_ids.add(match.id)
        speaker.suggested_voice_id = match.id
        speaker.suggested_voice_score = score
        suggested += 1
        _log.info(
            "Cross-recording suggestion (video %d): speaker %d looks like Person %d '%s' "
            "(cosine %.3f >= %.2f)",
            video_id, speaker.id, match.id, match.display_name, score, threshold,
        )
        console.print(
            f"    [dim]Speaker {speaker.display_index} looks like {match.display_name} "
            f"from another recording (voice match {score:.2f}) - confirm in People[/dim]"
        )
    if suggested:
        session.flush()


def diarize_track(
    config: "Config",
    session: "Session",
    transcript: "Transcript",
    audio_path: Path,
    track: "AudioTrack",
) -> None:
    """Run diarization and assign speaker labels, if a backend is available.

    Called as its own pipeline stage (see ``ingest._run_speaker_diarization``), not
    from transcription - diarization is slow enough that it needs its own visible step
    rather than hiding inside transcription.
    """
    diar_client = make_diarization_client(config)
    ok, reason = diar_client.available()
    if not ok:
        _log.warning("Diarization skipped for track %d [%s]: %s", track.id, track.label, reason)
        console.print(f"[yellow]Speaker labels skipped for [{track.label}]: {reason}[/yellow]")
        return

    if not diar_client.model_cached():
        console.print(
            f"  [dim]Downloading the speaker model (~80 MB) so speaker labels can run "
            f"for [{track.label}] - this happens once...[/dim]"
        )

    _log.info(
        "Running diarization for track %d [%s] using backend=%s...",
        track.id, track.label, config.diarization_backend,
    )
    try:
        turns, embeddings = diar_client.diarize_with_embeddings(str(audio_path))
        _assign_speakers(session, transcript.id, turns)
        _attach_speakers(
            session, track.video_id, transcript.id, embeddings,
            threshold=config.speaker_match_threshold,
            active_backend=config.diarization_backend,
        )
        _strip_reimported_speaker_prefixes(session, transcript.id, track.label)
        _log.info(
            "Diarization complete: %d turns, %d voiceprint(s) for track %d",
            len(turns), len(embeddings), track.id,
        )
    except DiarizationError as exc:
        _log.warning("Diarization failed for track %d [%s]: %s", track.id, track.label, exc)
        console.print(f"[yellow]Speaker labels skipped for [{track.label}]:[/yellow]")
        console.print(str(exc), markup=False, highlight=False)
    except Exception as exc:
        _log.warning(
            "Diarization failed for track %d [%s], speaker labels skipped: %s",
            track.id, track.label, exc, exc_info=True,
        )
        console.print(
            f"[yellow]Speaker labels skipped for [{track.label}] (unexpected error): {exc}[/yellow]"
        )
