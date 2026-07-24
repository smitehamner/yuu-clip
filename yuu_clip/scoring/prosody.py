"""ProsodyScorer - vocal delivery dynamics (loudness swings + pitch movement).

Extends the energy-envelope + FFT approach in laugh._detect_laugh_rhythm to a broader
prosody signal: a monotone, flat delivery scores low; an expressive one - rising and
falling intensity, shifting pitch - scores high. Unlike the two excitement-nudge
signals it is a *continuous* delivery-quality measure (like audio energy), so it emits
a real 0–1 whenever the clip has present, non-silent audio, giving the dramatic
dimension a genuine non-LLM baseline. Feeds dramatic and action; needs the player-voice
WAV (PyAV + numpy), like laugh 'audio' mode.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult
from yuu_clip.scoring.wav_access import WavCache, best_wav_track

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

_ENVELOPE_FPS = 20            # 50 ms frames, matching LaughScorer
_MIN_FRAMES = _ENVELOPE_FPS   # need at least ~1 s of audio
_SILENCE_FLOOR = 1e-4         # mean frame RMS below this = effectively silent → no opinion

# Coefficient-of-variation saturation points (heuristic, editable): expressive speech
# swings loudness ~0.8 CoV and shifts its spectral centroid ~0.4 CoV. Intensity is
# weighted a little above pitch because loudness dynamics read as drama more reliably
# than a coarse centroid estimate.
_INTENSITY_CV_SAT = 0.8
_CENTROID_CV_SAT = 0.4
_INTENSITY_MIX = 0.6
_CENTROID_MIX = 0.4


def prosody_dynamics(samples, sample_rate: int, start_ms: int, end_ms: int) -> float | None:
    """0–1 delivery-dynamics score for the clip window, or None when there's no usable
    (present, non-silent, ≥ ~1 s) audio."""
    import numpy as np

    start = start_ms * sample_rate // 1000
    end = end_ms * sample_rate // 1000
    clip = samples[start:end]

    frame_len = max(1, sample_rate // _ENVELOPE_FPS)
    n_frames = len(clip) // frame_len
    if n_frames < _MIN_FRAMES:
        return None

    frames = clip[:n_frames * frame_len].reshape(n_frames, frame_len)
    envelope = np.sqrt(np.mean(frames ** 2, axis=1))
    mean_env = float(np.mean(envelope))
    if mean_env < _SILENCE_FLOOR:
        return None

    intensity_cv = float(np.std(envelope)) / (mean_env + 1e-9)

    # Per-frame spectral centroid, then its coefficient of variation: how much the
    # dominant pitch/timbre moves over the clip.
    mags = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(frame_len, d=1.0 / sample_rate)
    centroids = (mags @ freqs) / (np.sum(mags, axis=1) + 1e-9)
    mean_centroid = float(np.mean(centroids))
    centroid_cv = float(np.std(centroids)) / mean_centroid if mean_centroid > 0 else 0.0

    intensity = min(1.0, intensity_cv / _INTENSITY_CV_SAT)
    pitch = min(1.0, centroid_cv / _CENTROID_CV_SAT)
    return max(0.0, min(1.0, _INTENSITY_MIX * intensity + _CENTROID_MIX * pitch))


class ProsodyScorer:
    name = "prosody"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight = config.scorer_prosody_weight
        self._wav_cache = WavCache()

    def is_available(self) -> bool:
        return self.available()[0]

    def available(self) -> tuple[bool, str]:
        """(available, reason) - reason is a user-facing explanation when unavailable."""
        if not self._config.scorer_prosody_enabled:
            return False, "prosody scoring is turned off in Settings"
        try:
            import av  # noqa: F401
            import numpy  # noqa: F401
            return True, ""
        except ImportError:
            log.warning("ProsodyScorer: av or numpy not available")
            return False, "prosody analysis needs the av and numpy packages"

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        track = best_wav_track(clip)
        if track is None:
            return ScoreResult(tags=["prosody_no_wav"])

        samples, sr = self._wav_cache.load(track)
        if samples is None or len(samples) == 0:
            return ScoreResult(tags=["prosody_no_wav"])

        value = prosody_dynamics(samples, sr, clip.start_ms, clip.end_ms)
        if value is None:
            return ScoreResult(tags=["prosody_no_audio"])

        return ScoreResult(
            score_dramatic=value,
            score_action=value,
            tags=["prosody_scored"],
            notes={"prosody": round(value, 3)},
        )
