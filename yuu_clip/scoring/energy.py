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
from collections import defaultdict
from pathlib import Path
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import AudioTrack, ClipCandidate

log = logging.getLogger(__name__)


# Downsample factor per mode: keeps every Nth sample before computing RMS.
# IO-bound at typical SSD speeds so "fast" is only marginally quicker in
# wall-clock time; the real quality difference is transient resolution.
_ENERGY_DOWNSAMPLE: dict[str, int] = {
    "fast": 4,   # 4 kHz effective — fine for loudness detection
    "full": 1,   # 16 kHz — captures brief audio spikes more accurately
}


def compute_energy(track: "AudioTrack", session: "Session", energy_mode: str = "fast") -> int:
    """
    Compute per-second RMS energy for *track* and store AudioEnergy rows.

    Idempotent — skips if rows already exist for this track.
    Returns the number of seconds computed (0 if skipped).
    """
    from yuu_clip.db.models import AudioEnergy

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
        import av  # noqa: F401
        import numpy as np  # noqa: F401
    except ImportError:
        log.warning("av or numpy not available — cannot compute audio energy")
        return 0

    downsample_factor = _ENERGY_DOWNSAMPLE.get(energy_mode, 4)
    try:
        rows = _read_rms_per_second(wav_path, downsample_factor=downsample_factor)
    except Exception as exc:
        log.error("Energy computation failed for track %d: %s", track.id, exc, exc_info=True)
        return 0

    for second_offset, rms_db in enumerate(rows):
        session.add(AudioEnergy(
            audio_track_id=track.id,
            second_offset=second_offset,
            rms_db=rms_db,
        ))

    return len(rows)


def _read_rms_per_second(wav_path: Path, downsample_factor: int = 1) -> list[float]:
    """Decode *wav_path* with PyAV and return dB-RMS for each whole second.

    Uses numpy vectorised reshape instead of a per-sample Python loop, giving
    ~100x speedup over the naive approach for a 2-hour audio file.
    *downsample_factor* keeps every Nth sample before bucketing; reduces numpy
    work at the cost of missing brief transients (fine for loudness scoring).
    """
    import av
    import numpy as np

    chunks: list[np.ndarray] = []

    with av.open(str(wav_path)) as container:
        stream = container.streams.audio[0]
        sample_rate = stream.codec_context.sample_rate or 16_000
        for frame in container.decode(stream):
            data = frame.to_ndarray().astype(np.float32).flatten()
            chunks.append(data)

    if not chunks:
        return []

    samples = np.concatenate(chunks)
    if downsample_factor > 1:
        samples = samples[::downsample_factor]
        effective_rate = max(1, sample_rate // downsample_factor)
    else:
        effective_rate = sample_rate

    n_secs = len(samples) // effective_rate
    if n_secs == 0:
        return []

    trimmed = samples[: n_secs * effective_rate]
    per_second = trimmed.reshape(n_secs, effective_rate)
    rms = np.sqrt(np.mean(per_second ** 2, axis=1))
    rms_db = 20.0 * np.log10(rms + 1e-9)
    return rms_db.tolist()


def _weighted_mean_db(rows: list, track_map: dict) -> float | None:
    """Return track-relevance-weighted mean dB across *rows*, or None if total weight is 0."""
    track_sums:   defaultdict[int, float] = defaultdict(float)
    track_counts: defaultdict[int, int]   = defaultdict(int)
    for row in rows:
        track_sums[row.audio_track_id]   += row.rms_db
        track_counts[row.audio_track_id] += 1

    weighted_sum = weight_total = 0.0
    for tid, total in track_sums.items():
        mean_db = total / track_counts[tid]
        w = track_map[tid].relevance_weight if tid in track_map else 1.0
        weighted_sum += mean_db * w
        weight_total += w

    return weighted_sum / weight_total if weight_total else None


def _compute_baseline(all_rows: list) -> tuple[float, float] | None:
    """Return (global_mean_db, baseline_db) for normalising clip scores, or None.

    Returns None when there are fewer than 2 rows (can't estimate spread) or when
    std == 0 (all rows identical — no meaningful spread to normalise against).
    baseline_db = mean + std; a clip at or above baseline scores 1.0.
    """
    if len(all_rows) < 2:
        return None
    all_db = [r.rms_db for r in all_rows]
    n = len(all_db)
    mean_all = sum(all_db) / n
    std_all  = math.sqrt(sum((x - mean_all) ** 2 for x in all_db) / n)
    baseline = mean_all + std_all
    return None if baseline <= mean_all else (mean_all, baseline)


class AudioEnergyScorer:
    name   = "audio_energy"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight  = config.scorer_energy_weight

    def is_available(self) -> bool:
        if not self._config.scorer_energy_enabled:
            return False
        try:
            import av  # noqa: F401
            import numpy  # noqa: F401
            return True
        except ImportError:
            return False

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        from yuu_clip.db.models import AudioEnergy

        scorable_track_ids = [t.id for t in clip.video.audio_tracks if t.do_score]
        if not scorable_track_ids:
            return ScoreResult(tags=["energy_no_tracks"])

        start_s = clip.start_ms // 1000
        end_s   = clip.end_ms   // 1000
        clip_rows = (
            session.query(AudioEnergy)
            .filter(
                AudioEnergy.audio_track_id.in_(scorable_track_ids),
                AudioEnergy.second_offset >= start_s,
                AudioEnergy.second_offset < end_s,
            )
            .all()
        )
        if not clip_rows:
            return ScoreResult(tags=["energy_no_data"])

        track_map    = {t.id: t for t in clip.video.audio_tracks}
        clip_mean_db = _weighted_mean_db(clip_rows, track_map)
        if clip_mean_db is None:
            return ScoreResult()

        all_rows = (
            session.query(AudioEnergy)
            .filter(AudioEnergy.audio_track_id.in_(scorable_track_ids))
            .all()
        )
        baseline_pair = _compute_baseline(all_rows)
        if baseline_pair is None:
            return ScoreResult()

        mean_all, baseline = baseline_pair
        score = max(0.0, min(1.0, (clip_mean_db - mean_all) / (baseline - mean_all)))
        return ScoreResult(
            score_action=score,
            tags=["energy_scored"],
            notes={"clip_mean_db": round(clip_mean_db, 2), "baseline_db": round(baseline, 2)},
        )
