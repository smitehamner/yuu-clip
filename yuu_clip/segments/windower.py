"""
Phase 1 clip candidate generation.

Strategy: group TranscriptSegments by natural silence gaps.
A gap longer than `silence_threshold_ms` marks a boundary between
clip candidates.  Candidates shorter than `min_clip_ms` are dropped;
those longer than `hard_split_ms` are force-split regardless of silence.

This produces far more natural candidate boundaries than a fixed
sliding window — RP sessions have natural conversational rhythms
that align with these gaps.

Phase 2 will add scoring; for now every candidate has score 0.0.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from yuu_clip.config import Config
from yuu_clip.db.models import ClipCandidate, Transcript, TranscriptSegment, Video

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def generate_candidates(
    video: Video,
    transcripts: list[Transcript],
    config: Config,
    session: "Session",
) -> list[ClipCandidate]:
    """
    Derive ClipCandidates from all transcripts for *video*.

    Transcripts from higher-weight tracks (e.g. player_voice) are used
    first; if no segments overlap a window from the combined/game_sounds
    track, that track's segments fill in.  For Phase 1 we simply merge
    all segments from transcribeable tracks into one timeline.

    Returns the list of newly created ClipCandidate objects (already
    added to *session* but not yet committed).
    """
    all_segments: list[TranscriptSegment] = []
    for t in transcripts:
        if t.audio_track.do_transcribe:
            all_segments.extend(t.segments)

    if not all_segments:
        return []

    all_segments.sort(key=lambda s: s.start_ms)

    windows = _silence_window(
        all_segments,
        silence_threshold_ms=config.silence_threshold_ms,
        min_clip_ms=config.min_clip_ms,
        hard_split_ms=config.hard_split_ms,
    )

    candidates: list[ClipCandidate] = []
    for start_ms, end_ms, texts, tags in windows:
        excerpt = " ".join(t.strip() for t in texts)

        cand = ClipCandidate(
            video_id=video.id,
            start_ms=start_ms,
            end_ms=end_ms,
            transcript_excerpt=excerpt,
            status="pending",
        )
        cand.tags = tags
        session.add(cand)
        candidates.append(cand)

    return candidates


def _silence_window(
    segments: list[TranscriptSegment],
    silence_threshold_ms: int,
    min_clip_ms: int,
    hard_split_ms: int,
) -> list[tuple[int, int, list[str], list[str]]]:
    """
    Return a list of (start_ms, end_ms, texts, tags) windows.

    tags is a list of string descriptors that hint at why a boundary
    was placed here — useful for Phase 2 scoring and for display.
    """
    if not segments:
        return []

    results: list[tuple[int, int, list[str], list[str]]] = []

    win_start = segments[0].start_ms
    win_end   = segments[0].end_ms
    win_texts = [segments[0].text]
    win_tags: list[str] = []

    def _flush(tags_extra: list[str]) -> None:
        nonlocal win_start, win_end, win_texts, win_tags
        duration = win_end - win_start
        if duration >= min_clip_ms:
            results.append((win_start, win_end, list(win_texts), win_tags + tags_extra))

    for seg in segments[1:]:
        gap_ms    = seg.start_ms - win_end
        duration  = seg.end_ms   - win_start

        if duration > hard_split_ms:
            _flush(["hard_split"])
            win_start = seg.start_ms
            win_end   = seg.end_ms
            win_texts = [seg.text]
            win_tags  = ["after_hard_split"]
            continue

        if gap_ms >= silence_threshold_ms:
            gap_tag = f"silence_{gap_ms // 1000}s"
            _flush([gap_tag])
            win_start = seg.start_ms
            win_end   = seg.end_ms
            win_texts = [seg.text]
            win_tags  = [f"after_silence_{gap_ms // 1000}s"]
            # Flag unusually long silences — interesting for RP (dramatic pause?)
            if gap_ms >= 10_000:
                win_tags.append("long_silence_before")
            continue

        win_end = seg.end_ms
        win_texts.append(seg.text)

    _flush([])

    return results
