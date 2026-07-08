"""yuu_clip/scoring/laugh.py - laugh detection (transcript, audio, model)."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# LaughScorer
# ---------------------------------------------------------------------------

class TestLaughScorerTranscript:
    """_score_transcript_text and transcript mode score() behaviour."""

    def _score(self, text, duration_s=30.0):
        from yuu_clip.scoring.laugh import _score_transcript_text
        return _score_transcript_text(text, duration_s)

    def test_no_laugh_markers_returns_zero(self):
        assert self._score("this is a normal sentence") == 0.0

    def test_empty_text_returns_zero(self):
        assert self._score("") == 0.0

    def test_zero_duration_returns_zero(self):
        assert self._score("[laughs]", duration_s=0.0) == 0.0

    def test_whisper_bracket_marker_detected(self):
        assert self._score("[laughs]") > 0.0

    def test_laughter_marker_detected(self):
        assert self._score("[laughter]") > 0.0

    def test_chuckles_marker_detected(self):
        assert self._score("[chuckles]") > 0.0

    def test_haha_detected(self):
        assert self._score("haha that was amazing") > 0.0

    def test_hahaha_detected(self):
        assert self._score("hahaha") > 0.0

    def test_lmao_detected(self):
        assert self._score("lmao did you see that") > 0.0

    def test_score_bounded_at_one(self):
        many_laughs = "[laughs] " * 50
        assert self._score(many_laughs, duration_s=10.0) == 1.0

    def test_higher_density_produces_higher_score(self):
        dense = "[laughs] [laughs] [laughs] [laughs]"
        sparse = "[laughs]"
        assert self._score(dense, 30.0) > self._score(sparse, 30.0)

    def test_same_count_shorter_clip_scores_higher(self):
        assert self._score("[laughs]", 15.0) > self._score("[laughs]", 60.0)

    def _make_scorer(self, mode="transcript", enabled=True, weight=1.5):
        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = enabled
        cfg.scorer_laugh_mode    = mode
        cfg.scorer_laugh_weight  = weight
        return LaughScorer(cfg)

    def _make_clip(self, excerpt=""):
        from unittest.mock import MagicMock
        c = MagicMock()
        c.id = 1
        c.start_ms = 0
        c.end_ms   = 30_000
        c.transcript_excerpt = excerpt
        return c

    def test_is_available_true_in_transcript_mode(self):
        assert self._make_scorer(mode="transcript").is_available() is True

    def test_is_available_false_when_disabled(self):
        assert self._make_scorer(enabled=False).is_available() is False

    def test_no_transcript_returns_no_transcript_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt=None), None)
        assert "laugh_no_transcript" in result.tags

    def test_empty_transcript_returns_no_transcript_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt=""), None)
        assert "laugh_no_transcript" in result.tags

    def test_laugh_in_transcript_returns_laugh_transcript_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="[laughs] that was funny"), None)
        assert "laugh_transcript" in result.tags

    def test_laugh_boosts_score_funny(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="[laughs] [laughs] [laughs]"), None)
        assert result.score_funny > 0.0

    def test_notes_include_laugh_count(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="[laughs] [chuckles] haha"), None)
        assert result.notes["laugh_count"] == 3

    def test_no_laugh_markers_score_is_zero(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="nothing funny happened"), None)
        assert result.score_funny == 0.0

class TestLaughScorerAudio:
    """audio mode: no WAV path → laugh_no_wav tag."""

    def _make_scorer(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        return LaughScorer(cfg)

    def _make_clip_no_wav(self):
        from unittest.mock import MagicMock
        track = MagicMock()
        track.id               = 1
        track.do_score         = True
        track.relevance_weight = 1.0
        track.extracted_path   = "/nonexistent/track.wav"

        clip = MagicMock()
        clip.id        = 1
        clip.start_ms  = 0
        clip.end_ms    = 30_000
        clip.video.audio_tracks = [track]
        return clip

    def test_missing_wav_returns_no_wav_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip_no_wav(), None)
        assert "laugh_no_wav" in result.tags

    def test_no_scored_tracks_returns_no_wav_tag(self):
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        scorer = LaughScorer(cfg)

        track = MagicMock()
        track.do_score = False
        clip = MagicMock()
        clip.id = 1
        clip.video.audio_tracks = [track]
        result = scorer.score(clip, None)
        assert "laugh_no_wav" in result.tags

    def test_is_available_audio_mode_when_av_present(self):
        import sys
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        scorer = LaughScorer(cfg)
        fake_av = mock.MagicMock()
        fake_np = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"av": fake_av, "numpy": fake_np}):
            assert scorer.is_available() is True

    def test_is_available_audio_mode_missing_deps_returns_false(self):
        import sys
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        scorer = LaughScorer(cfg)
        with mock.patch.dict(sys.modules, {"av": None, "numpy": None}):
            assert scorer.is_available() is False

class TestLaughScorerModel:
    """model mode: availability checks and missing deps path."""

    def _make_scorer(self, model_id="MIT/ast-finetuned-audioset-10-10-0.4593"):
        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled  = True
        cfg.scorer_laugh_mode     = "model"
        cfg.scorer_laugh_model_id = model_id
        return LaughScorer(cfg)

    def test_no_model_id_returns_false(self):
        scorer = self._make_scorer(model_id="")
        assert scorer.is_available() is False

    def test_missing_transformers_returns_false(self):
        import sys
        import unittest.mock as mock
        scorer = self._make_scorer()
        with mock.patch.dict(sys.modules, {"transformers": None, "torch": None}):
            assert scorer.is_available() is False

    def test_deps_present_returns_true(self):
        import sys
        import unittest.mock as mock
        scorer = self._make_scorer()
        fake_tr = mock.MagicMock()
        fake_th = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"transformers": fake_tr, "torch": fake_th}):
            assert scorer.is_available() is True

    def test_load_failed_property_reflects_state(self):
        import unittest.mock as mock

        import numpy as np

        scorer = self._make_scorer()
        assert scorer.load_failed is False
        scorer._wav_cache = mock.MagicMock()
        scorer._wav_cache.load.return_value = (np.ones(16000 * 3, dtype=np.float32), 16000)
        scorer._get_classifier = mock.MagicMock(side_effect=OSError("offline"))
        clip = mock.MagicMock(id=1, start_ms=0, end_ms=3000)
        with mock.patch("yuu_clip.scoring.laugh.best_wav_track", return_value=mock.MagicMock()):
            scorer.score(clip, None)
        assert scorer.load_failed is True

class TestDetectLaughRhythm:
    """_detect_laugh_rhythm pure function unit tests."""

    def _rhythm(self, samples, sr, start_ms=0, end_ms=None):
        import numpy as np

        from yuu_clip.scoring.laugh import _detect_laugh_rhythm
        arr = np.array(samples, dtype=np.float32)
        if end_ms is None:
            end_ms = len(arr) * 1000 // sr
        return _detect_laugh_rhythm(arr, sr, start_ms, end_ms)

    def test_too_short_returns_zero(self):
        # < 1 s of audio (sr=16000, 0.5 s)
        import numpy as np
        samples = np.zeros(8000, dtype=np.float32)
        assert self._rhythm(samples, 16000, 0, 500) == 0.0

    def test_silent_audio_returns_low_score(self):
        import numpy as np
        # 30 s of silence: no meaningful spectral content
        samples = np.zeros(16000 * 30, dtype=np.float32)
        result = self._rhythm(samples, 16000, 0, 30_000)
        assert result <= 0.5   # may be nonzero due to FFT noise floor

    def test_score_bounded_at_one(self):
        import numpy as np
        # Loud 8 Hz burst signal: pure sinusoid in the laugh band
        t = np.linspace(0, 30, 16000 * 30, endpoint=False)
        samples = np.sin(2 * np.pi * 8 * t).astype(np.float32)
        result = self._rhythm(samples, 16000, 0, 30_000)
        assert result <= 1.0
