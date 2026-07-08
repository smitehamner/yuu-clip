"""yuu_clip/scoring/audio_event.py - AudioSet sound-event scoring (classifier mocked)."""

from __future__ import annotations

import sys
import unittest.mock as mock

import numpy as np


def _make_scorer(enabled=True, weight=1.0, model_id="MIT/ast-finetuned-audioset-10-10-0.4593"):
    from yuu_clip.config import Config
    from yuu_clip.scoring.audio_event import AudioEventScorer
    cfg = Config()
    cfg.scorer_audio_event_enabled = enabled
    cfg.scorer_audio_event_weight = weight
    cfg.scorer_laugh_model_id = model_id
    return AudioEventScorer(cfg)


def _results(*pairs):
    return [{"label": label, "score": score} for label, score in pairs]


def _fixed_classifier(*pairs):
    """A stub audio-classification pipeline returning *pairs* regardless of input."""
    def classify(*args, **kwargs):
        return _results(*pairs)
    return classify


class TestGroupScore:
    def test_action_label_maps_to_action_group(self):
        from yuu_clip.scoring.audio_event import _ACTION_LABELS, _group_score
        results = _results(("Gunshot, gunfire", 0.82), ("Speech", 0.1))
        assert _group_score(results, _ACTION_LABELS) == 0.82

    def test_crowd_label_maps_to_crowd_group(self):
        from yuu_clip.scoring.audio_event import _CROWD_LABELS, _group_score
        results = _results(("Cheering", 0.71), ("Music", 0.2))
        assert _group_score(results, _CROWD_LABELS) == 0.71

    def test_unrelated_labels_score_zero(self):
        from yuu_clip.scoring.audio_event import _ACTION_LABELS, _group_score
        results = _results(("Speech", 0.9), ("Music", 0.6))
        assert _group_score(results, _ACTION_LABELS) == 0.0

    def test_takes_highest_matching_probability(self):
        from yuu_clip.scoring.audio_event import _ACTION_LABELS, _group_score
        results = _results(("Explosion", 0.3), ("Gunshot, gunfire", 0.6))
        assert _group_score(results, _ACTION_LABELS) == 0.6


class TestAvailability:
    def test_unavailable_when_disabled(self):
        available, reason = _make_scorer(enabled=False).availability()
        assert available is False
        assert "turned off" in reason

    def test_unavailable_when_no_model_id(self):
        available, reason = _make_scorer(model_id="").availability()
        assert available is False
        assert "model" in reason

    def test_unavailable_when_deps_missing(self):
        scorer = _make_scorer()
        with mock.patch.dict(sys.modules, {"transformers": None, "torch": None}):
            assert scorer.is_available() is False

    def test_missing_deps_reason_is_user_facing(self):
        scorer = _make_scorer()
        with mock.patch.dict(sys.modules, {"transformers": None, "torch": None}):
            available, reason = scorer.availability()
        assert available is False
        assert "dependencies" in reason

    def test_available_when_deps_present(self):
        scorer = _make_scorer()
        with mock.patch.dict(sys.modules, {"transformers": mock.MagicMock(), "torch": mock.MagicMock()}):
            assert scorer.is_available() is True


def _clip(start_ms=0, end_ms=3000):
    clip = mock.MagicMock()
    clip.id = 1
    clip.start_ms = start_ms
    clip.end_ms = end_ms
    return clip


def _scorer_with_classifier(classifier):
    """A scorer whose WAV read and classifier are stubbed - no model download, no disk."""
    scorer = _make_scorer()
    scorer._get_classifier = lambda: classifier
    scorer._wav_cache = mock.MagicMock()
    scorer._wav_cache.load.return_value = (np.ones(16000 * 3, dtype=np.float32), 16000)
    return scorer


class TestScore:
    def test_gunshot_raises_action(self):
        classifier = _fixed_classifier(("Gunshot, gunfire", 0.9), ("Speech", 0.05))
        scorer = _scorer_with_classifier(classifier)
        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=mock.MagicMock()):
            result = scorer.score(_clip(), None)
        assert result.score_action == 0.9
        assert result.score_funny == 0.0
        assert "audio_event_scored" in result.tags

    def test_cheering_raises_funny(self):
        classifier = _fixed_classifier(("Cheering", 0.77), ("Speech", 0.05))
        scorer = _scorer_with_classifier(classifier)
        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=mock.MagicMock()):
            result = scorer.score(_clip(), None)
        assert result.score_funny == 0.77
        assert result.score_action == 0.0
        assert "audio_event_scored" in result.tags

    def test_missing_wav_returns_no_wav_tag(self):
        scorer = _make_scorer()
        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=None):
            result = scorer.score(_clip(), None)
        assert "audio_event_no_wav" in result.tags
        assert result.score_action is None
        assert result.score_funny is None

    def test_classifier_failure_never_raises(self):
        def _boom(*a, **k):
            raise RuntimeError("model exploded")
        scorer = _scorer_with_classifier(_boom)
        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=mock.MagicMock()):
            result = scorer.score(_clip(), None)
        assert "audio_event_no_wav" in result.tags
        assert result.score_action is None

    def test_empty_clip_window_returns_no_wav_tag(self):
        classifier = _fixed_classifier(("Gunshot, gunfire", 0.9))
        scorer = _scorer_with_classifier(classifier)
        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=mock.MagicMock()):
            result = scorer.score(_clip(start_ms=5000, end_ms=5000), None)
        assert "audio_event_no_wav" in result.tags

    def test_model_load_failure_never_raises_and_is_cached(self):
        """The AST model is a Tier-B download - an offline machine without it
        cached must skip the audio-event boost for every clip in the run, not
        retry the same doomed fetch (and its network timeout) per clip."""
        scorer = _make_scorer()
        scorer._wav_cache = mock.MagicMock()
        scorer._wav_cache.load.return_value = (np.ones(16000 * 3, dtype=np.float32), 16000)
        load_attempts = mock.MagicMock(side_effect=OSError("could not download model (offline)"))
        scorer._get_classifier = load_attempts

        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=mock.MagicMock()):
            first = scorer.score(_clip(), None)
            second = scorer.score(_clip(), None)

        assert "audio_event_no_wav" in first.tags
        assert first.score_action is None
        assert "audio_event_no_wav" in second.tags
        assert load_attempts.call_count == 1

    def test_load_failed_property_reflects_state(self):
        scorer = _make_scorer()
        assert scorer.load_failed is False
        scorer._wav_cache = mock.MagicMock()
        scorer._wav_cache.load.return_value = (np.ones(16000 * 3, dtype=np.float32), 16000)
        scorer._get_classifier = mock.MagicMock(side_effect=OSError("offline"))
        with mock.patch("yuu_clip.scoring.audio_event.best_wav_track", return_value=mock.MagicMock()):
            scorer.score(_clip(), None)
        assert scorer.load_failed is True


class TestAudioEventModelCached:
    def test_delegates_to_repo_cached_with_the_configured_model_id(self):
        from yuu_clip.scoring import audio_event

        with mock.patch.dict(sys.modules, {"yuu_clip.hf_cache": mock.MagicMock(repo_cached=lambda repo_id: repo_id == "my/model")}):
            assert audio_event.audio_event_model_cached("my/model") is True
            assert audio_event.audio_event_model_cached("other/model") is False


class TestPrefetchAudioEventModel:
    def test_prefetch_builds_the_classification_pipeline(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.audio_event import prefetch_audio_event_model

        cfg = Config()
        cfg.scorer_laugh_model_id = "my/model"
        fake_transformers = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"transformers": fake_transformers}):
            prefetch_audio_event_model(cfg)
        fake_transformers.pipeline.assert_called_once_with("audio-classification", model="my/model")


def test_prewarm_transformers_pipeline_never_raises():
    """Best-effort: pre-warming must swallow any import failure (transformers is
    absent in the test venv, exercising exactly that path) so it can never break
    an analyze run - the scorer's own load guard is the real safety net."""
    from yuu_clip.scoring.audio_event import prewarm_transformers_pipeline
    prewarm_transformers_pipeline()
