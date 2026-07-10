"""yuu_clip/scoring/prosody.py - vocal delivery dynamics scoring (numpy/av)."""

from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np


def _make_scorer(enabled=True, weight=0.5):
    from yuu_clip.config import Config
    from yuu_clip.scoring.prosody import ProsodyScorer
    cfg = Config()
    cfg.scorer_prosody_enabled = enabled
    cfg.scorer_prosody_weight = weight
    return ProsodyScorer(cfg)


def _flat_tone(sr=16000, seconds=3.0):
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    return (0.3 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)


def _expressive(sr=16000, seconds=3.0):
    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    tremolo = 0.3 * (1.0 + 0.9 * np.sin(2 * np.pi * 0.5 * t))    # loudness swings
    freq = 150 + 150 * t                                        # rising pitch (chirp)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    return (tremolo * np.sin(phase)).astype(np.float32)


class TestProsodyDynamics:
    def _score(self, samples, sr=16000, start_ms=0, end_ms=None):
        from yuu_clip.scoring.prosody import prosody_dynamics
        if end_ms is None:
            end_ms = len(samples) * 1000 // sr
        return prosody_dynamics(samples, sr, start_ms, end_ms)

    def test_expressive_scores_higher_than_flat(self):
        flat = self._score(_flat_tone())
        expressive = self._score(_expressive())
        assert expressive > flat

    def test_flat_tone_is_low(self):
        assert self._score(_flat_tone()) < 0.3

    def test_bounded_zero_to_one(self):
        value = self._score(_expressive())
        assert 0.0 <= value <= 1.0

    def test_silence_returns_none(self):
        assert self._score(np.zeros(16000 * 3, dtype=np.float32)) is None

    def test_too_short_returns_none(self):
        # 0.5 s < 1 s minimum
        assert self._score(np.zeros(8000, dtype=np.float32), end_ms=500) is None


class TestAvailability:
    def test_unavailable_when_disabled(self):
        assert _make_scorer(enabled=False).is_available() is False

    def test_disabled_reason_is_user_facing(self):
        available, reason = _make_scorer(enabled=False).availability()
        assert available is False
        assert "turned off" in reason

    def test_available_when_av_and_numpy_present(self):
        import sys
        import unittest.mock as mock
        scorer = _make_scorer()
        with mock.patch.dict(sys.modules, {"av": mock.MagicMock(), "numpy": mock.MagicMock()}):
            assert scorer.is_available() is True

    def test_unavailable_when_deps_missing(self):
        import sys
        import unittest.mock as mock
        scorer = _make_scorer()
        with mock.patch.dict(sys.modules, {"av": None, "numpy": None}):
            assert scorer.is_available() is False


class TestScore:
    def _clip_no_wav(self):
        track = MagicMock()
        track.do_score = True
        track.relevance_weight = 1.0
        track.extracted_path = "/nonexistent/track.wav"
        clip = MagicMock()
        clip.start_ms = 0
        clip.end_ms = 30_000
        clip.video.audio_tracks = [track]
        return clip

    def test_missing_wav_returns_no_wav_tag(self):
        result = _make_scorer().score(self._clip_no_wav(), None)
        assert "prosody_no_wav" in result.tags
        assert result.score_dramatic is None

    def test_no_scored_track_returns_no_wav_tag(self):
        track = MagicMock()
        track.do_score = False
        clip = MagicMock()
        clip.start_ms = 0
        clip.end_ms = 30_000
        clip.video.audio_tracks = [track]
        result = _make_scorer().score(clip, None)
        assert "prosody_no_wav" in result.tags
