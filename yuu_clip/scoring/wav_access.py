"""Shared WAV access for audio-based scorers (laugh, prosody).

Decodes an extracted per-track WAV with PyAV and selects the most relevant scored
track for a clip. A WavCache reuses decoded samples across clips within one scoring
run, so a two-hour track is decoded once, not once per clip.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.db.models import AudioTrack, ClipCandidate

log = logging.getLogger(__name__)


def read_full_audio(wav_path: Path) -> tuple:
    """Decode every sample from *wav_path*.  Returns (np.ndarray mono, sample_rate)."""
    import av
    import numpy as np

    chunks: list = []
    with av.open(str(wav_path)) as container:
        stream = container.streams.audio[0]
        sample_rate = stream.codec_context.sample_rate or 16_000
        for frame in container.decode(stream):
            chunks.append(frame.to_ndarray().astype(np.float32).flatten())

    if not chunks:
        return np.array([]), sample_rate
    return np.concatenate(chunks), sample_rate


def best_wav_track(clip: "ClipCandidate") -> "AudioTrack | None":
    """The highest relevance-weight scored track for *clip* whose WAV exists on disk."""
    candidates = [
        t for t in clip.video.audio_tracks
        if t.do_score and t.extracted_path and Path(t.extracted_path).exists()
    ]
    return max(candidates, key=lambda t: t.relevance_weight, default=None)


class WavCache:
    """Per-scoring-run cache of decoded WAV samples, keyed by track id."""

    def __init__(self) -> None:
        self._samples_by_track: dict[int, tuple] = {}

    def load(self, track: "AudioTrack") -> tuple:
        """Return (samples, sample_rate) for *track*, decoding once and caching.

        Returns (None, None) when the file can't be read — callers treat that the
        same as a missing WAV.
        """
        if track.id not in self._samples_by_track:
            try:
                self._samples_by_track[track.id] = read_full_audio(Path(track.extracted_path))
            except Exception as exc:
                log.warning("WavCache: failed to read %s: %s", track.extracted_path, exc)
                return None, None
        return self._samples_by_track[track.id]
