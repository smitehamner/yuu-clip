"""
SceneCutScorer — counts visual scene transitions within a clip window.

Three detection modes (config: scene_detection_mode):

  "transcript"  Gap-based: silence gaps >= scene_transcript_gap_s between
                transcript segments are treated as scene boundaries.
                Instant — uses data already in the DB.

  "fast"        Keyframe timestamps via ffprobe (I-frame index, no decoding)
                + frame-skipped ContentDetector on a downscaled stream.
                Takes seconds to minutes regardless of video length.

  "full"        Full-frame ContentDetector (original behaviour).
                Most accurate, but O(duration × fps) — slow for long videos.

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

_MAX_CPM = 10.0   # cuts/min → score_action = 1.0


def _detect_transcript(video: "Video", session: "Session", gap_s: float) -> list[int]:
    """Return cut timecodes (ms) from silence gaps in the transcript."""
    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment
    from sqlalchemy import asc

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


def _detect_keyframes(video_path: str) -> list[int]:
    """Extract I-frame timestamps in ms via ffprobe (no decoding, instant)."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-select_streams", "v:0",
                "-show_entries", "packet=pts_time,flags",
                "-of", "csv=print_section=0",
                video_path,
            ],
            capture_output=True, text=True, timeout=30,
        )
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
        log.warning("Keyframe extraction failed: %s", exc)
        return []


def _detect_content(video_path: str, frame_skip: int = 0) -> list[int]:
    """Run PySceneDetect ContentDetector, optionally skipping frames."""
    try:
        from scenedetect import ContentDetector, detect
    except ImportError:
        log.warning("scenedetect not installed — scene detection skipped")
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
    fast_frame_skip: int = 0,
) -> int:
    """
    Detect scene cuts for *video* and store SceneBoundary rows.

    Idempotent — skips if rows already exist.
    Returns number of cuts stored (0 if skipped).

    mode:
      "transcript" — gap-based using existing transcript segments
      "fast"       — keyframes (ffprobe) merged with transcript gaps
      "full"       — ContentDetector on every frame (original behaviour)
    """
    from yuu_clip.db.models import SceneBoundary

    if session.query(SceneBoundary).filter_by(video_id=video.id).count() > 0:
        return 0

    if mode == "transcript":
        timecodes = _detect_transcript(video, session, transcript_gap_s)

    elif mode == "fast":
        kf = set(_detect_keyframes(video.path))
        tg = set(_detect_transcript(video, session, transcript_gap_s))
        # Merge: keep keyframes that are within 2s of a transcript gap,
        # plus all transcript gaps (silence is always a meaningful signal).
        merged: set[int] = set(tg)
        for ms in kf:
            if any(abs(ms - t) < 2000 for t in tg) or not tg:
                merged.add(ms)
        # Also keep keyframes not near any other keyframe (deduplicate clusters)
        sorted_kf = sorted(kf)
        prev = -999999
        for ms in sorted_kf:
            if ms - prev > 1000:   # at least 1s apart
                merged.add(ms)
                prev = ms
        timecodes = sorted(merged)

    else:  # "full"
        timecodes = _detect_content(video.path, frame_skip=fast_frame_skip)

    for ms in timecodes:
        session.add(SceneBoundary(video_id=video.id, timecode_ms=ms))

    return len(timecodes)


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
            score_action=score,
            tags=["scenes_scored"] if cuts > 0 else [],
            notes={"cuts_in_clip": cuts, "cuts_per_min": round(cpm, 2)},
        )
