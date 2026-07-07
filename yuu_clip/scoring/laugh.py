"""
LaughScorer — detects laughter in clip audio or transcript.

Three modes (config: scorer_laugh_mode):
  "transcript" — pattern-match Whisper markers ([laughs], haha, etc.) in
                 clip.transcript_excerpt.  No extra dependencies.  Default.
  "audio"      — rhythm-based spectral analysis on the extracted WAV file.
                 Uses PyAV + numpy (both already project dependencies).
  "model"      — HuggingFace audio-classification pipeline.  Requires:
                   pip install transformers torch torchaudio soundfile

For "model" mode, set scorer_laugh_model_id to a HuggingFace model that
classifies audio into categories including a laughter label.

Recommended model:
    MIT/ast-finetuned-audioset-10-10-0.4593

This Audio Spectrogram Transformer is trained on Google AudioSet (~527 classes)
which includes "Laughter" as a category.  First run downloads ~350 MB.

Quick setup for model mode:
  1. pip install transformers torch torchaudio soundfile
  2. In your project config (.yuu-clip/config.json):
       "scorer_laugh_mode": "model",
       "scorer_laugh_model_id": "MIT/ast-finetuned-audioset-10-10-0.4593"
  3. First scoring run downloads the model automatically (~350 MB).
"""
from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

from yuu_clip.scoring.protocol import ScoreResult
from yuu_clip.scoring.wav_access import WavCache, best_wav_track

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

# Whisper non-verbal markers and common written-out laugh forms.
_LAUGH_RE = re.compile(
    r'\[(?:laughs?|laughter|chuckles?|giggl(?:es?|ing)|snickers?|cackl(?:es?|ing))\]'
    r'|(?:ha){2,}'
    r'|\b(?:lmao|lmfao|rofl|hehe+|heehee)\b',
    re.IGNORECASE,
)

# Laughter rhythm: 4–12 Hz bursting rate (ha-ha cadence)
_LAUGH_HZ_LOW  = 4.0
_LAUGH_HZ_HIGH = 12.0
_ENVELOPE_FPS  = 20   # 50 ms energy frames


def _score_transcript_text(text: str, duration_s: float) -> float:
    """Return 0–1 score based on laugh-marker density in *text*."""
    count = len(_LAUGH_RE.findall(text))
    if count == 0 or duration_s <= 0:
        return 0.0
    laughs_per_min = count / duration_s * 60
    return min(1.0, laughs_per_min / 4.0)   # 4+ laugh events/min → 1.0


def _detect_laugh_rhythm(samples, sample_rate: int, start_ms: int, end_ms: int) -> float:
    """Return 0–1 score from spectral burst-rhythm analysis of the clip window.

    Laughter produces rhythmic energy bursts at 4–12 Hz (ha-ha cadence).
    We extract the energy envelope at 50 ms resolution then check what fraction
    of its spectral power falls in that band.  This won't distinguish laughter
    from other rhythmic sounds perfectly, but on a player-voice track it gives
    a useful supplemental signal.
    """
    import numpy as np

    start_s = start_ms * sample_rate // 1000
    end_s   = end_ms   * sample_rate // 1000
    clip    = samples[start_s:end_s]

    frame_samples = max(1, sample_rate // _ENVELOPE_FPS)
    n_frames = len(clip) // frame_samples
    if n_frames < _ENVELOPE_FPS:   # need at least 1 s of audio
        return 0.0

    frames   = clip[:n_frames * frame_samples].reshape(n_frames, frame_samples)
    envelope = np.sqrt(np.mean(frames ** 2, axis=1))
    envelope -= np.mean(envelope)   # remove DC offset

    fft_mag = np.abs(np.fft.rfft(envelope))
    freqs   = np.fft.rfftfreq(n_frames, d=1.0 / _ENVELOPE_FPS)

    laugh_band = (freqs >= _LAUGH_HZ_LOW) & (freqs <= _LAUGH_HZ_HIGH)
    if not np.any(laugh_band):
        return 0.0

    laugh_power = float(np.sum(fft_mag[laugh_band] ** 2))
    total_power = float(np.sum(fft_mag[1:] ** 2)) + 1e-12   # exclude DC

    # 50% of spectral power in laugh band → score ≈ 1.0
    return min(1.0, (laugh_power / total_power) * 2.0)


class LaughScorer:
    name = "laugh"

    def __init__(self, config: "Config") -> None:
        self._config     = config
        self.weight      = config.scorer_laugh_weight
        # Cache loaded WAV data per track_id across clips in a single scoring run.
        self._wav_cache  = WavCache()
        self._classifier = None
        # Set once the "model" mode classifier fails to load, so a run with many
        # clips doesn't retry the same doomed model fetch on every single clip.
        self._load_failed = False

    def is_available(self) -> bool:
        if not self._config.scorer_laugh_enabled:
            return False
        return self.availability()[0]

    def availability(self) -> tuple[bool, str]:
        """(available, reason) — reason is a user-facing explanation when unavailable."""
        mode = self._config.scorer_laugh_mode
        if mode == "transcript":
            return True, ""
        if mode == "audio":
            try:
                import av  # noqa: F401
                import numpy  # noqa: F401
                return True, ""
            except ImportError:
                log.warning("LaughScorer (audio): av or numpy not available")
                return False, "audio analysis needs the av and numpy packages"
        if mode == "model":
            if not self._config.scorer_laugh_model_id:
                log.warning("LaughScorer (model): scorer_laugh_model_id is not configured")
                return False, "no laughter model is selected in Settings"
            try:
                import torch  # noqa: F401
                import transformers  # noqa: F401
                return True, ""
            except ImportError:
                log.warning(
                    "LaughScorer (model): missing deps — run: "
                    "pip install transformers torch torchaudio soundfile"
                )
                return False, (
                    "its model dependencies aren't installed — this should be bundled "
                    "with yuu-clip, so try reinstalling if this persists"
                )
        log.warning("LaughScorer: unknown mode %r — scorer disabled", mode)
        return False, f"unknown laughter mode {mode!r}"

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        mode = self._config.scorer_laugh_mode
        if mode == "transcript":
            return self._score_transcript(clip)
        if mode == "audio":
            return self._score_audio(clip)
        if mode == "model":
            return self._score_model(clip)
        return ScoreResult()

    # ── transcript mode ───────────────────────────────────────────────────────

    def _score_transcript(self, clip: "ClipCandidate") -> ScoreResult:
        if not clip.transcript_excerpt:
            return ScoreResult(tags=["laugh_no_transcript"])
        duration_s = (clip.end_ms - clip.start_ms) / 1000.0
        count = len(_LAUGH_RE.findall(clip.transcript_excerpt))
        score = _score_transcript_text(clip.transcript_excerpt, duration_s)
        return ScoreResult(
            score_funny=score,
            tags=["laugh_transcript"],
            notes={"laugh_count": count, "duration_s": round(duration_s, 1)},
        )

    # ── audio mode ────────────────────────────────────────────────────────────

    def _score_audio(self, clip: "ClipCandidate") -> ScoreResult:
        track = best_wav_track(clip)
        if track is None:
            return ScoreResult(tags=["laugh_no_wav"])

        samples, sr = self._wav_cache.load(track)
        if samples is None:
            return ScoreResult(tags=["laugh_no_wav"])

        score = _detect_laugh_rhythm(samples, sr, clip.start_ms, clip.end_ms)
        return ScoreResult(
            score_funny=score,
            tags=["laugh_audio"],
            notes={"laugh_rhythm_score": round(score, 3)},
        )

    # ── model mode ────────────────────────────────────────────────────────────

    def _get_classifier(self):
        if self._classifier is None:
            from transformers import pipeline
            self._classifier = pipeline(
                "audio-classification",
                model=self._config.scorer_laugh_model_id,
            )
        return self._classifier

    def _score_model(self, clip: "ClipCandidate") -> ScoreResult:
        track = best_wav_track(clip)
        if track is None:
            return ScoreResult(tags=["laugh_no_wav"])

        samples, sr = self._wav_cache.load(track)
        if samples is None:
            return ScoreResult(tags=["laugh_no_wav"])

        start_s = clip.start_ms * sr // 1000
        end_s   = clip.end_ms   * sr // 1000
        clip_audio = samples[start_s:end_s]
        if len(clip_audio) == 0:
            return ScoreResult(tags=["laugh_no_wav"])

        if self._load_failed:
            return ScoreResult(tags=["laugh_no_wav"])

        try:
            classifier = self._get_classifier()
            results = classifier({"array": clip_audio, "sampling_rate": sr}, top_k=20)
            laugh_score = max(
                (r["score"] for r in results if "laugh" in r["label"].lower()),
                default=0.0,
            )
        except Exception as exc:
            log.warning("LaughScorer (model): inference failed for clip %d: %s", clip.id, exc)
            if self._classifier is None:
                self._load_failed = True
            return ScoreResult(tags=["laugh_no_wav"])

        return ScoreResult(
            score_funny=float(laugh_score),
            tags=["laugh_model"],
            notes={
                "model_id": self._config.scorer_laugh_model_id,
                "laugh_score": round(float(laugh_score), 3),
            },
        )
