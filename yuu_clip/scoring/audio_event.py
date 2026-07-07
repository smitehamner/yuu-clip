"""AudioEventScorer — sound-event detection via the AudioSet AST model (heavy opt-in).

Reuses the same Audio-Spectrogram-Transformer already wired for laugh 'model' mode
(MIT/ast-finetuned-audioset-10-10-0.4593). AudioSet's ~527 classes include action
sounds (gunshot, explosion, screaming, …) and crowd/reaction sounds (cheering,
applause, …), so one classifier feeds two dimensions:

  action sounds  → score_action
  crowd/reaction → score_funny

transformers + torch are bundled by default (packaging-strategy overhaul); the AST
checkpoint itself (~350 MB) is a Tier-B model auto-fetched on first use. Degrades to a
no-op per clip (never raises) if the model isn't downloaded yet or can't be fetched
(e.g. offline first run) — see the `_load_failed` short-circuit in `score()`. It shares
scorer_laugh_model_id — no separate model id.
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

# Case-insensitive substrings matched against the AudioSet label of each result.
# Curated + editable; extend on demand (music/impact sounds are deliberately excluded
# in v1 to avoid false positives from background game audio).
_ACTION_LABELS = (
    "gunshot", "gunfire", "machine gun", "fusillade", "artillery",
    "cannon", "explosion", "screaming",
)
_CROWD_LABELS = ("cheering", "applause", "crowd", "clapping")

_TOP_K = 20   # how many of the 527 classes to inspect per clip (matches laugh model mode)


def _group_score(results: list[dict], substrings: tuple[str, ...]) -> float:
    """Highest classifier probability among results whose label matches *substrings*.

    0.0 when no result matches — an event detector reporting "this sound is absent",
    which is real information for the dimension (mirrors LaughScorer's default=0.0).
    """
    return max(
        (
            float(r["score"])
            for r in results
            if any(sub in r["label"].lower() for sub in substrings)
        ),
        default=0.0,
    )


class AudioEventScorer:
    name = "audio_event"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight = config.scorer_audio_event_weight
        self._wav_cache = WavCache()
        self._classifier = None
        # Set once the model fails to load (e.g. offline and not yet downloaded),
        # so a run with many clips doesn't retry — and re-fail — the same
        # multi-second HuggingFace fetch attempt on every single clip.
        self._load_failed = False

    def is_available(self) -> bool:
        return self.availability()[0]

    def availability(self) -> tuple[bool, str]:
        """(available, reason) — reason is a user-facing explanation when unavailable."""
        if not self._config.scorer_audio_event_enabled:
            return False, "audio-event detection is turned off in Settings"
        if not self._config.scorer_laugh_model_id:
            log.warning("AudioEventScorer: scorer_laugh_model_id is not configured")
            return False, "no audio model is selected in Settings"
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401
            return True, ""
        except ImportError:
            log.warning(
                "AudioEventScorer: missing deps — run: "
                "pip install transformers torch torchaudio soundfile"
            )
            return False, (
                "its model dependencies aren't installed — this should be bundled "
                "with yuu-clip, so try reinstalling if this persists"
            )

    def _get_classifier(self):
        if self._classifier is None:
            from transformers import pipeline
            self._classifier = pipeline(
                "audio-classification",
                model=self._config.scorer_laugh_model_id,
            )
        return self._classifier

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        track = best_wav_track(clip)
        if track is None:
            return ScoreResult(tags=["audio_event_no_wav"])

        samples, sr = self._wav_cache.load(track)
        if samples is None:
            return ScoreResult(tags=["audio_event_no_wav"])

        start_s = clip.start_ms * sr // 1000
        end_s   = clip.end_ms   * sr // 1000
        clip_audio = samples[start_s:end_s]
        if len(clip_audio) == 0:
            return ScoreResult(tags=["audio_event_no_wav"])

        if self._load_failed:
            return ScoreResult(tags=["audio_event_no_wav"])

        try:
            classifier = self._get_classifier()
            results = classifier({"array": clip_audio, "sampling_rate": sr}, top_k=_TOP_K)
        except Exception as exc:
            log.warning("AudioEventScorer: inference failed for clip %d: %s", clip.id, exc)
            if self._classifier is None:
                # Failed during model load (not a per-clip inference error) —
                # remember it so the rest of this run skips straight to no-op
                # instead of retrying the same doomed download every clip.
                self._load_failed = True
            return ScoreResult(tags=["audio_event_no_wav"])

        action = _group_score(results, _ACTION_LABELS)
        funny  = _group_score(results, _CROWD_LABELS)
        return ScoreResult(
            score_action=action,
            score_funny=funny,
            tags=["audio_event_scored"],
            notes={
                "model_id": self._config.scorer_laugh_model_id,
                "action_event": round(action, 3),
                "crowd_event": round(funny, 3),
            },
        )
