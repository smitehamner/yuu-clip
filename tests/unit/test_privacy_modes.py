"""AI privacy modes - the trust choke-point.

yuu-clip runs all inference locally; the privacy mode only decides whether a
generative model runs at all. These assert the enforcement *directly*, not via UI
state: no LLM client is constructed under "No generative AI".
"""
from __future__ import annotations

import pytest


def _cfg(**overrides):
    from yuu_clip.config import Config
    cfg = Config()
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


def _spy(cls, sink):
    original = cls.__init__

    def _init(self, config):
        sink.append(cls.__name__)
        original(self, config)

    return _init


# ---------------------------------------------------------------------------
# resolve_ai_permissions - the single resolver
# ---------------------------------------------------------------------------

class TestResolveAiPermissions:
    @pytest.mark.parametrize("mode, allow_llm", [
        ("none", False),
        ("local_only", True),
    ])
    def test_each_mode(self, mode, allow_llm):
        from yuu_clip.config import resolve_ai_permissions
        assert resolve_ai_permissions(_cfg(ai_privacy_mode=mode)).allow_llm is allow_llm

    def test_default_is_local_only(self):
        from yuu_clip.config import resolve_ai_permissions
        assert resolve_ai_permissions(_cfg()).allow_llm is True

    def test_unknown_value_fails_safe_to_local_only(self):
        from yuu_clip.config import resolve_ai_permissions
        assert resolve_ai_permissions(_cfg(ai_privacy_mode="anything-else")).allow_llm is True


# ---------------------------------------------------------------------------
# make_client - the construction choke-point (trust guarantee)
# ---------------------------------------------------------------------------

class TestMakeClientEnforcement:
    def test_none_never_constructs_any_client(self, monkeypatch):
        from yuu_clip.scoring import llm_client as lc
        built = []
        monkeypatch.setattr(lc.LlamaCppServerClient, "__init__", _spy(lc.LlamaCppServerClient, built))
        client = lc.make_client(_cfg(
            llm_enabled=True, llm_backend="llamacpp", ai_privacy_mode="none"))
        assert isinstance(client, lc.NullLLMClient)
        assert built == []

    def test_llm_disabled_returns_null(self, monkeypatch):
        from yuu_clip.scoring import llm_client as lc
        built = []
        monkeypatch.setattr(lc.LlamaCppServerClient, "__init__", _spy(lc.LlamaCppServerClient, built))
        client = lc.make_client(_cfg(llm_enabled=False, ai_privacy_mode="local_only"))
        assert isinstance(client, lc.NullLLMClient)
        assert built == []

    def test_local_only_allows_local_llamacpp(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, make_client
        client = make_client(_cfg(
            llm_enabled=True, llm_backend="llamacpp", ai_privacy_mode="local_only"))
        assert isinstance(client, LlamaCppServerClient)

    def test_unknown_backend_falls_back_to_local_llamacpp(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, make_client
        client = make_client(_cfg(
            llm_enabled=True, llm_backend="mystery", ai_privacy_mode="local_only"))
        assert isinstance(client, LlamaCppServerClient)


# ---------------------------------------------------------------------------
# check_llm_available / check_vision_available honor the mode
# ---------------------------------------------------------------------------

class TestGatesHonorMode:
    def test_check_llm_off_under_none(self):
        from yuu_clip.scoring.llm import check_llm_available
        ok, reason = check_llm_available(_cfg(llm_enabled=True, ai_privacy_mode="none"))
        assert ok is False and "generative ai is turned off" in reason.lower()

    def test_check_vision_off_under_none(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(
            llm_enabled=True, vision_enabled=True, ai_privacy_mode="none"))
        assert ok is False and "generative ai is turned off" in reason.lower()


# ---------------------------------------------------------------------------
# Similarity llm backend falls back under "No generative AI"
# ---------------------------------------------------------------------------

class TestSimilarityFallback:
    def test_llm_backend_falls_back_to_tfidf_under_none(self):
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        backend = make_backend(_cfg(similarity_backend="llm", ai_privacy_mode="none"))
        assert isinstance(backend, TfidfBackend)
