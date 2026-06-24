"""
AudioEnergyScorer — per-second RMS loudness curves from extracted WAV files.

Pre-computation: compute_energy(track, session) reads the WAV using PyAV (already
a project dependency), computes RMS dB per second, and stores rows in audio_energy.

Scoring: queries the energy rows for the clip time window, weights by track
relevance_weight, and normalises against the track baseline to produce a 0–1
score_action contribution.
"""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import TYPE_CHECKING

from rp_clipper.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from rp_clipper.config import Config
    from rp_clipper.db.models import AudioTrack, ClipCandidate

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pre-computation
# ---------------------------------------------------------------------------

def compute_energy(track: "AudioTrack", session: "Session") -> int:
    """
    Compute per-second RMS energy for *track* and store AudioEnergy rows.

    Idempotent — skips if rows already exist for this track.
    Returns the number of seconds computed (0 if skipped).
    """
    from rp_clipper.db.models import AudioEnergy

    if not track.extracted_path:
        log.warning("Track %d has no extracted_path — skipping energy computation", track.id)
        return 0

    existing_count = (
        session.query(AudioEnergy)
        .filter_by(audio_track_id=track.id)
        .count()
    )
    if existing_count > 0:
        return 0

    wav_path = Path(track.extracted_path)
    if not wav_path.exists():
        log.warning("WAV file not found for track %d: %s", track.id, wav_path)
        return 0

    try:
        import av
        import numpy as np
    except ImportError:
        log.error("av or numpy not available — cannot compute audio energy")
        return 0

    try:
        rows = _read_rms_per_second(wav_path)
    except Exception as exc:
        log.error("Energy computation failed for track %d: %s", track.id, exc)
        return 0

    for second_offset, rms_db in enumerate(rows):
        session.add(AudioEnergy(
            audio_track_id=track.id,
            second_offset=second_offset,
            rms_db=rms_db,
        ))

    return len(rows)


def _read_rms_per_second(wav_path: Path) -> list[float]:
    """Decode *wav_path* with PyAV and return dB-RMS for each whole second."""
    import av
    import numpy as np

    samples_by_second: dict[int, list[float]] = {}

    with av.open(str(wav_path)) as container:
        stream = container.streams.audio[0]
        sample_rate = stream.codec_context.sample_rate or 16_000

        for frame in container.decode(stream):
            # frame.to_ndarray() shape: (channels, samples) — already mono here
            data = frame.to_ndarray().astype(np.float32).flatten()
            pts_s = float(frame.pts * frame.time_base) if frame.pts is not None else 0.0

            for i, sample in enumerate(data):
                t_s = pts_s + i / sample_rate
                bucket = int(t_s)
                samples_by_second.setdefault(bucket, []).append(float(sample))

    result: list[float] = []
    for sec in sorted(samples_by_second):
        arr = samples_by_second[sec]
        rms = math.sqrt(sum(s * s for s in arr) / len(arr))
        rms_db = 20.0 * math.log10(rms + 1e-9)
        result.append(rms_db)

    return result


# ---------------------------------------------------------------------------
# Scorer
# ---------------------------------------------------------------------------

class AudioEnergyScorer:
    name   = "audio_energy"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight  = config.scorer_energy_weight

    def is_available(self) -> bool:
        if not self._config.scorer_energy_enabled:
            return False
        try:
            import av        # noqa: F401
            import numpy     # noqa: F401
            return True
        except ImportError:
            return False

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        from rp_clipper.db.models import AudioEnergy, AudioTrack

        start_s = clip.start_ms // 1000
        end_s   = clip.end_ms   // 1000

        # Gather energy rows for all do_score tracks on this video
        scorable_track_ids = [
            t.id for t in clip.video.audio_tracks
            if t.do_score
        ]
        if not scorable_track_ids:
            return ScoreResult(tags=["energy_no_tracks"])

        rows = (
            session.query(AudioEnergy)
            .filter(
                AudioEnergy.audio_track_id.in_(scorable_track_ids),
                AudioEnergy.second_offset >= start_s,
                AudioEnergy.second_offset <= end_s,
            )
            .all()
        )
        if not rows:
            return ScoreResult(tags=["energy_no_data"])

        # Build track-level weighted mean over clip window
        track_sums:    dict[int, float] = {}
        track_counts:  dict[int, int]   = {}
        for row in rows:
            track_sums[row.audio_track_id]   = track_sums.get(row.audio_track_id, 0.0) + row.rms_db
            track_counts[row.audio_track_id] = track_counts.get(row.audio_track_id, 0) + 1

        # Weighted mean across tracks
        track_map = {t.id: t for t in clip.video.audio_tracks}
        weighted_sum   = 0.0
        weight_total   = 0.0
        for tid, total in track_sums.items():
            mean_db = total / track_counts[tid]
            w = track_map[tid].relevance_weight if tid in track_map else 1.0
            weighted_sum += mean_db * w
            weight_total += w

        if weight_total == 0:
            return ScoreResult()

        clip_mean_db = weighted_sum / weight_total

        # Normalise: compute baseline (global mean + 1 std) across the full track
        all_rows = (
            session.query(AudioEnergy)
            .filter(AudioEnergy.audio_track_id.in_(scorable_track_ids))
            .all()
        )
        if len(all_rows) < 2:
            return ScoreResult()

        all_db = [r.rms_db for r in all_rows]
        n = len(all_db)
        mean_all = sum(all_db) / n
        variance = sum((x - mean_all) ** 2 for x in all_db) / n
        std_all  = math.sqrt(variance)

        baseline = mean_all + std_all  # energy at or above this → score ≥ 1.0
        if baseline <= mean_all:
            return ScoreResult()

        score = max(0.0, min(1.0, (clip_mean_db - mean_all) / (baseline - mean_all)))
        return ScoreResult(
            score_action=score,
            tags=["energy_scored"],
            notes={"clip_mean_db": round(clip_mean_db, 2), "baseline_db": round(baseline, 2)},
        )
