"""HuggingFace offline mode for model-CONSUMING subprocesses.

huggingface_hub/transformers make a Hub round-trip on every model load even when the
weights are cached, printing "You are sending unauthenticated requests to the HF Hub"
into the analyze/score UI log. Once every model is cached the launcher forces offline
mode; while anything is still missing it stays online so a first download can happen.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from yuu_clip.hf_cache import hf_offline_env
from yuu_clip.web.sse import consuming_subprocess_env

_OFFLINE_VARS = ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE")


def _config(laugh_model_id: str = "MIT/ast-finetuned-audioset-10-10-0.4593"):
    return SimpleNamespace(scorer_laugh_model_id=laugh_model_id)


@pytest.fixture(autouse=True)
def _no_ambient_offline(monkeypatch):
    # The dev machine may already export these; assert on what the gate adds.
    for var in _OFFLINE_VARS:
        monkeypatch.delenv(var, raising=False)


def _patch_cached(monkeypatch, *, whisper: bool, speaker: bool, laugh: bool) -> None:
    monkeypatch.setattr(
        "yuu_clip.transcribe.transcriber.make_transcriber",
        lambda config: SimpleNamespace(model_cached=lambda: whisper),
    )
    monkeypatch.setattr(
        "yuu_clip.transcribe.diarization_client.speechbrain_model_cached", lambda: speaker
    )
    monkeypatch.setattr(
        "yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: laugh
    )


class TestHfOfflineEnv:
    def test_offline_once_every_model_is_cached(self, monkeypatch):
        _patch_cached(monkeypatch, whisper=True, speaker=True, laugh=True)
        assert hf_offline_env(_config()) == {"HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"}

    # Staying online is the safe fallback - forcing offline before a model is cached
    # would break its first download.
    @pytest.mark.parametrize("whisper,speaker,laugh", [
        (False, True, True),
        (True, False, True),
        (True, True, False),
        (False, False, False),
    ])
    def test_stays_online_while_any_model_is_missing(self, monkeypatch, whisper, speaker, laugh):
        _patch_cached(monkeypatch, whisper=whisper, speaker=speaker, laugh=laugh)
        assert hf_offline_env(_config()) == {}

    def test_no_laugh_model_configured_does_not_block_offline(self, monkeypatch):
        _patch_cached(monkeypatch, whisper=True, speaker=True, laugh=False)
        assert hf_offline_env(_config(laugh_model_id="")) != {}

    def test_probe_failure_degrades_to_online(self, monkeypatch):
        def boom(config):
            raise RuntimeError("hub cache unreadable")

        monkeypatch.setattr("yuu_clip.transcribe.transcriber.make_transcriber", boom)
        assert hf_offline_env(_config()) == {}


class TestConsumingSubprocessEnv:
    def test_download_launch_without_ctx_is_never_forced_offline(self):
        """The model download/prefetch routes pass no ctx - they must stay online."""
        env = consuming_subprocess_env(None)
        assert not any(var in env for var in _OFFLINE_VARS)

    def test_ctx_double_without_config_is_tolerated(self):
        env = consuming_subprocess_env(SimpleNamespace())
        assert not any(var in env for var in _OFFLINE_VARS)

    def test_consuming_launch_inherits_offline_when_cached(self, monkeypatch):
        _patch_cached(monkeypatch, whisper=True, speaker=True, laugh=True)
        env = consuming_subprocess_env(SimpleNamespace(config=_config()))
        assert env["HF_HUB_OFFLINE"] == "1"
        assert env["TRANSFORMERS_OFFLINE"] == "1"
        assert "PATH" in env  # the parent environment is carried through, not replaced
