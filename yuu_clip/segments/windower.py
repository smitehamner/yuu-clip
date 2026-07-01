"""
Clip candidate generation from transcript segments.

Strategy: group TranscriptSegments by natural silence gaps.
A gap of at least `silence_threshold_ms` marks a boundary between
clip candidates.  Candidates shorter than `min_clip_ms` are dropped;
those longer than `hard_split_ms` are force-split regardless of silence.

This produces far more natural candidate boundaries than a fixed
sliding window — RP sessions have natural conversational rhythms
that align with these gaps.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from yuu_clip.config import Config
from yuu_clip.db.models import ClipCandidate, Transcript, TranscriptSegment, Video
from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

_log = get_logger(__name__)


def generate_candidates(
    video: Video,
    transcripts: list[Transcript],
    config: Config,
    session: "Session",
) -> list[ClipCandidate]:
    """
    Derive ClipCandidates from all transcripts for *video*.

    Merges segments from all transcribable tracks into one timeline,
    then groups them by silence gaps via _silence_window.

    Returns the list of newly created ClipCandidate objects (already
    added to *session* but not yet committed).
    """
    all_segments: list[TranscriptSegment] = []
    for t in transcripts:
        if t.audio_track.do_transcribe:
            all_segments.extend(t.segments)

    if not all_segments:
        _log.info("generate_candidates: no transcribable segments for video %d — returning empty", video.id)
        return []

    all_segments.sort(key=lambda s: s.start_ms)

    windows = _silence_window(
        all_segments,
        silence_threshold_ms=config.silence_threshold_ms,
        min_clip_ms=config.min_clip_ms,
        hard_split_ms=config.hard_split_ms,
    )

    candidates: list[ClipCandidate] = []
    for start_ms, end_ms, segs, tags in windows:
        excerpt = _build_excerpt(segs)

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

    _log.info(
        "generate_candidates: video %d — %d segments → %d candidates (silence=%dms, min=%dms, hard=%dms)",
        video.id, len(all_segments), len(candidates),
        config.silence_threshold_ms, config.min_clip_ms, config.hard_split_ms,
    )
    return candidates


def _segment_speaker_display(seg: TranscriptSegment) -> str | None:
    """The name to show for a segment's speaker: the durable Speaker's display
    name (user name or "Speaker N") when attached, else the raw label as a
    last-resort fallback. Raw ``SPEAKER_00`` should never reach the user, but is
    kept as a safety net for segments diarized before a Speaker was attached."""
    if seg.speaker_id is not None and seg.speaker is not None:
        return seg.speaker.display_name
    return seg.speaker_label


def _build_excerpt(segs: list[TranscriptSegment]) -> str:
    """Join segment texts, grouping by speaker with a name prefix when diarized.

    The prefix resolves to the current Speaker name at the moment the excerpt is
    (re)built, so renaming a speaker and rebuilding refreshes the excerpt.
    """
    if not any(s.speaker_label for s in segs):
        return " ".join(s.text.strip() for s in segs)

    lines: list[str] = []
    current_speaker: str | None = None
    current_texts: list[str] = []

    def _flush_speaker() -> None:
        if not current_texts:
            return
        prefix = f"{current_speaker}: " if current_speaker else ""
        lines.append(prefix + " ".join(current_texts))

    for seg in segs:
        display = _segment_speaker_display(seg)
        if display != current_speaker:
            _flush_speaker()
            current_speaker = display
            current_texts = [seg.text.strip()]
        else:
            current_texts.append(seg.text.strip())

    _flush_speaker()
    return "\n".join(lines)


def _silence_window(
    segments: list[TranscriptSegment],
    silence_threshold_ms: int,
    min_clip_ms: int,
    hard_split_ms: int,
) -> list[tuple[int, int, list[TranscriptSegment], list[str]]]:
    """
    Return a list of (start_ms, end_ms, segs, tags) windows.

    tags is a list of string descriptors that hint at why a boundary
    was placed here (e.g. "hard_split", "long_silence_before").
    """
    if not segments:
        return []

    results: list[tuple[int, int, list[TranscriptSegment], list[str]]] = []

    win_start = segments[0].start_ms
    win_end   = segments[0].end_ms
    win_segs  = [segments[0]]
    win_tags: list[str] = []

    def _flush(tags_extra: list[str]) -> None:
        nonlocal win_start, win_end, win_segs, win_tags
        duration = win_end - win_start
        if duration >= min_clip_ms:
            results.append((win_start, win_end, list(win_segs), win_tags + tags_extra))

    for seg in segments[1:]:
        gap_ms    = seg.start_ms - win_end
        duration  = seg.end_ms   - win_start

        if duration > hard_split_ms:
            _flush(["hard_split"])
            win_start = seg.start_ms
            win_end   = seg.end_ms
            win_segs  = [seg]
            win_tags  = ["after_hard_split"]
            continue

        if gap_ms >= silence_threshold_ms:
            gap_tag = f"silence_{gap_ms // 1000}s"
            _flush([gap_tag])
            win_start = seg.start_ms
            win_end   = seg.end_ms
            win_segs  = [seg]
            win_tags  = [f"after_silence_{gap_ms // 1000}s"]
            if gap_ms >= 10_000:
                win_tags.append("long_silence_before")
            continue

        win_end = max(win_end, seg.end_ms)
        win_segs.append(seg)

    _flush([])

    return results
