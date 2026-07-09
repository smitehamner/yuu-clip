"""
Clip candidate generation from transcript segments.

Strategy: group TranscriptSegments by natural silence gaps.
A gap of at least `silence_threshold_ms` marks a boundary between
clip candidates.  Candidates shorter than `min_clip_ms` are dropped;
those longer than `hard_split_ms` are force-split regardless of silence.

This produces far more natural candidate boundaries than a fixed
sliding window - recorded sessions have natural conversational rhythms
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

# A silence gap at or above this earns the extra "long_silence_before" boundary tag
# (a display hint only - the window split itself is driven by silence_threshold_ms).
_LONG_SILENCE_MS = 10_000


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
        _log.info("generate_candidates: no transcribable segments for video %d - returning empty", video.id)
        return []

    all_segments.sort(key=lambda s: s.start_ms)

    windows = _silence_window(
        all_segments,
        silence_threshold_ms=config.silence_threshold_ms,
        min_clip_ms=config.min_clip_ms,
        hard_split_ms=config.hard_split_ms,
        min_speech_cps=config.min_clip_speech_cps,
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
        "generate_candidates: video %d - %d segments → %d candidates (silence=%dms, min=%dms, hard=%dms)",
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


def clip_window_segments(video: Video, start_ms: int, end_ms: int) -> list[TranscriptSegment]:
    """Segments from the video's transcribable tracks that overlap [start_ms, end_ms).

    Uses the newest transcript per track - the same source generate_candidates
    built the excerpt from - so a rebuild reproduces the original grouping.
    """
    segs: list[TranscriptSegment] = []
    for track in video.audio_tracks:
        if not track.do_transcribe or not track.transcripts:
            continue
        transcript = max(track.transcripts, key=lambda t: t.created_at)
        segs.extend(
            seg for seg in transcript.segments
            if seg.start_ms < end_ms and seg.end_ms > start_ms
        )
    segs.sort(key=lambda s: s.start_ms)
    return segs


def rebuild_clip_excerpt(clip: ClipCandidate) -> None:
    """Recompute ``clip.transcript_excerpt`` from the current segments in its window.

    Call after a caption edit or speaker rename so the excerpt - and any re-score
    that reads it - reflects the change. Mirrors the excerpt build in
    generate_candidates so an untouched clip's excerpt is unchanged.
    """
    clip.transcript_excerpt = build_excerpt_for_window(clip.video, clip.start_ms, clip.end_ms)


def build_excerpt_for_window(video: Video, start_ms: int, end_ms: int) -> str:
    """Build a transcript excerpt for an arbitrary [start_ms, end_ms) window on *video*.

    Shared by rebuild_clip_excerpt (an existing clip's window) and manual clip
    creation (a window with no ClipCandidate yet).
    """
    segs = clip_window_segments(video, start_ms, end_ms)
    return _build_excerpt(segs)


def _silence_window(
    segments: list[TranscriptSegment],
    silence_threshold_ms: int,
    min_clip_ms: int,
    hard_split_ms: int,
    min_speech_cps: float = 0.0,
) -> list[tuple[int, int, list[TranscriptSegment], list[str]]]:
    """
    Return a list of (start_ms, end_ms, segs, tags) windows.

    tags is a list of string descriptors that hint at why a boundary
    was placed here (e.g. "hard_split", "long_silence_before").

    Windows whose transcript text is sparser than *min_speech_cps* characters
    per second are dropped as mostly-silence (0 disables the check). This is what
    keeps a Whisper runaway-timestamp segment - one hallucinated line stamped
    across many minutes - from becoming a long, near-empty clip.
    """
    if not segments:
        return []

    results: list[tuple[int, int, list[TranscriptSegment], list[str]]] = []
    dropped_low_speech = 0

    win_start = segments[0].start_ms
    win_end   = segments[0].end_ms
    win_segs  = [segments[0]]
    win_tags: list[str] = []

    def _flush(tags_extra: list[str]) -> None:
        nonlocal win_start, win_end, win_segs, win_tags, dropped_low_speech
        duration = win_end - win_start
        if duration < min_clip_ms:
            return
        if min_speech_cps > 0:
            chars = sum(len((s.text or "").strip()) for s in win_segs)
            if chars / (duration / 1000) < min_speech_cps:
                dropped_low_speech += 1
                return
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
            if gap_ms >= _LONG_SILENCE_MS:
                win_tags.append("long_silence_before")
            continue

        win_end = max(win_end, seg.end_ms)
        win_segs.append(seg)

    _flush([])

    if dropped_low_speech:
        _log.info(
            "_silence_window: dropped %d mostly-silence window(s) (< %.2f chars/s)",
            dropped_low_speech, min_speech_cps,
        )
    return results
