"""
SceneCutScorer - counts visual scene transitions within a clip window.

Three detection modes (config: scene_detection_mode):

  "transcript"  Gap-based: silence gaps >= scene_transcript_gap_s between
                transcript segments are treated as scene boundaries.
                Instant - uses data already in the DB.

  "fast"        Keyframe timestamps via ffprobe (I-frame index, no decoding)
                + frame-skipped ContentDetector on a downscaled stream.
                Takes seconds to minutes regardless of video length.

  "full"        Full-frame ContentDetector (original behaviour).
                Most accurate, but O(duration × fps) - slow for long videos.

Default is "fast".  Switch to "transcript" for 10h+ VODs on first pass.
"""
from __future__ import annotations

import logging
import subprocess
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

log = logging.getLogger(__name__)

_MAX_CPM = 10.0   # cuts/min → score_visual = 1.0

# In "fast" mode, a keyframe corroborates a transcript gap only if it lands within this
# many ms of one; and clustered keyframes are deduplicated to one per this window.
_CORROBORATION_WINDOW_MS = 2000
_KEYFRAME_DEDUP_MS = 1000


def _detect_transcript(video: "Video", session: "Session", gap_s: float) -> list[int]:
    """Return cut timecodes (ms) from silence gaps in the transcript."""
    from sqlalchemy import asc

    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment

    tracks = session.query(AudioTrack).filter_by(video_id=video.id, do_transcribe=True).all()
    cuts: set[int] = set()

    for track in tracks:
        latest = (
            session.query(Transcript)
            .filter_by(audio_track_id=track.id)
            .order_by(Transcript.created_at.desc())
            .first()
        )
        if not latest:
            continue

        segs = (
            session.query(TranscriptSegment)
            .filter_by(transcript_id=latest.id)
            .order_by(asc(TranscriptSegment.start_ms))
            .all()
        )
        for i in range(1, len(segs)):
            gap = (segs[i].start_ms - segs[i - 1].end_ms) / 1000.0
            if gap >= gap_s:
                cuts.add(segs[i].start_ms)

    return sorted(cuts)



# Unlike probe.py's metadata-only read (120s), this demuxes every packet in the
# file to read its flags - real I/O that scales with recording length/bitrate,
# not the "instant" the docstring above implies for a 10h+ VOD.
_KEYFRAME_TIMEOUT_S = 600


def _detect_keyframes(video_path: str) -> list[int]:
    """Extract I-frame timestamps in ms via ffprobe (no decoding, instant)."""
    from yuu_clip.ffmpeg_tools import find_ffmpeg
    try:
        _, ffprobe = find_ffmpeg()  # actionable error if FFmpeg is missing (caught below)
        result = subprocess.run(
            [
                ffprobe, "-v", "quiet",
                "-select_streams", "v:0",
                "-show_entries", "packet=pts_time,flags",
                "-of", "csv=print_section=0",
                video_path,
            ],
            capture_output=True, encoding="utf-8", errors="replace", timeout=_KEYFRAME_TIMEOUT_S,
        )
        if result.returncode != 0:
            log.warning(
                "Keyframe extraction: ffprobe exited %d for %s - falling back to "
                "transcript-gaps-only scene detection. stderr: %s",
                result.returncode, video_path, result.stderr.strip(),
            )
            return []
        cuts: list[int] = []
        for line in result.stdout.splitlines():
            parts = line.strip().split(",")
            if len(parts) == 2 and "K" in parts[1]:
                try:
                    cuts.append(int(float(parts[0]) * 1000))
                except ValueError:
                    pass
        return cuts
    except Exception as exc:
        log.warning("Keyframe extraction failed: %s", exc, exc_info=True)
        return []


def _detect_content(video_path: str, frame_skip: int = 0) -> list[int]:
    """Run PySceneDetect ContentDetector, optionally skipping frames."""
    try:
        from scenedetect import ContentDetector, detect
    except ImportError:
        log.warning("scenedetect not installed - scene detection skipped")
        return []

    try:
        scenes = detect(video_path, ContentDetector(), frame_skip=frame_skip)
        return [int(s[0].get_seconds() * 1000) for s in scenes]
    except Exception as exc:
        log.error("ContentDetector failed: %s", exc, exc_info=True)
        return []


def compute_scenes(
    video: "Video",
    session: "Session",
    mode: str = "fast",
    transcript_gap_s: float = 3.0,
    frame_skip: int = 0,
) -> int:
    """
    Detect scene cuts for *video* and store SceneBoundary rows.

    Idempotent - skips if rows already exist.
    Returns number of cuts stored (0 if skipped).

    mode:
      "transcript" - gap-based using existing transcript segments
      "fast"       - keyframes (ffprobe) merged with transcript gaps
      "full"       - ContentDetector on every frame (original behaviour)
    """
    from yuu_clip.db.models import SceneBoundary

    if session.query(SceneBoundary).filter_by(video_id=video.id).count() > 0:
        return 0

    seg_start_s, seg_end_s = video.segment_start_s, video.segment_end_s

    if mode == "transcript":
        # Transcript gaps come from the per-segment-trimmed transcript, so they are
        # already segment-relative - no windowing needed.
        timecodes = _detect_transcript(video, session, transcript_gap_s)

    elif mode == "fast":
        # Keyframes are decoded from the shared parent file (parent timeline); rebase
        # them onto the segment before merging with the already-segment-relative
        # transcript gaps, or a split segment mixes two timelines in one cut set.
        kf = set(_to_segment_window_ms(_detect_keyframes(video.path), seg_start_s, seg_end_s))
        tg = set(_detect_transcript(video, session, transcript_gap_s))
        # Merge: keep keyframes within 2s of a transcript gap (corroborated cuts),
        # or all keyframes if there are no transcript gaps.
        # Deduplicate keyframe clusters to one representative per 1s window.
        merged: set[int] = set(tg)
        candidate_kf = sorted(
            ms for ms in kf if any(abs(ms - t) < _CORROBORATION_WINDOW_MS for t in tg)
        ) if tg else sorted(kf)
        prev = -999_999
        for ms in candidate_kf:
            if ms - prev > _KEYFRAME_DEDUP_MS:
                merged.add(ms)
                prev = ms
        timecodes = sorted(merged)

    else:  # "full"
        timecodes = _to_segment_window_ms(
            _detect_content(video.path, frame_skip=frame_skip), seg_start_s, seg_end_s
        )

    for ms in timecodes:
        session.add(SceneBoundary(video_id=video.id, timecode_ms=ms))

    return len(timecodes)


def _to_segment_window_ms(
    timecodes: list[int], segment_start_s: float | None, segment_end_s: float | None
) -> list[int]:
    """Rebase parent-timeline cut timecodes (ms) onto a split segment's timeline.

    Keyframe/content detection decodes the shared parent file, so its cuts are on the
    parent timeline; a split segment's clips are 0-based within the segment (its audio
    is trimmed per segment). Filter to the segment window and subtract its start.
    A non-split video (segment_start_s is None) passes through unchanged.
    """
    if segment_start_s is None:
        return timecodes
    start_ms = int(segment_start_s * 1000)
    end_ms = int(segment_end_s * 1000) if segment_end_s is not None else None
    return [
        ms - start_ms for ms in timecodes
        if ms >= start_ms and (end_ms is None or ms < end_ms)
    ]


class SceneCutScorer:
    name = "scene_cuts"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight  = config.scorer_scene_weight

    def is_available(self) -> bool:
        if not self._config.scorer_scenes_enabled:
            return False
        # transcript mode has no extra deps; others need scenedetect only for "full"
        return True

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        from yuu_clip.db.models import SceneBoundary

        cuts = (
            session.query(SceneBoundary)
            .filter(
                SceneBoundary.video_id == clip.video_id,
                SceneBoundary.timecode_ms >= clip.start_ms,
                SceneBoundary.timecode_ms < clip.end_ms,
            )
            .count()
        )

        duration_min = clip.duration_ms / 60_000
        if duration_min == 0:
            return ScoreResult()

        cpm   = cuts / duration_min
        score = min(1.0, cpm / _MAX_CPM)

        return ScoreResult(
            score_visual=score,
            tags=["scenes_scored"] if cuts > 0 else [],
            notes={"cuts_in_clip": cuts, "cuts_per_min": round(cpm, 2)},
        )
