"""AI privacy modes (plan non-llm-tiers/07) - the trust choke-point.

These assert the enforcement *directly*, not via UI state: no LLM client is
constructed under "No generative AI", and no remote (Claude) client is ever
constructed under "Local models only" - for both chat and vision paths.
"""
from __future__ import annotations

from pathlib import Path

import pytest


def _cfg(**overrides):
    from yuu_clip.config import Config
    cfg = Config()
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


# ---------------------------------------------------------------------------
# resolve_ai_permissions - the single resolver
# ---------------------------------------------------------------------------

class TestResolveAiPermissions:
    @pytest.mark.parametrize("mode, allow_llm, allow_remote", [
        ("none", False, False),
        ("local_only", True, False),
        ("remote_ok", True, True),
    ])
    def test_each_mode(self, mode, allow_llm, allow_remote):
        from yuu_clip.config import resolve_ai_permissions
        perms = resolve_ai_permissions(_cfg(ai_privacy_mode=mode))
        assert (perms.allow_llm, perms.allow_remote) == (allow_llm, allow_remote)

    def test_default_is_local_only(self):
        from yuu_clip.config import resolve_ai_permissions
        perms = resolve_ai_permissions(_cfg())
        assert (perms.allow_llm, perms.allow_remote) == (True, False)

    def test_unknown_value_fails_safe_to_local_only(self):
        from yuu_clip.config import resolve_ai_permissions
        perms = resolve_ai_permissions(_cfg(ai_privacy_mode="anything-else"))
        assert (perms.allow_llm, perms.allow_remote) == (True, False)


# ---------------------------------------------------------------------------
# make_client - the construction choke-point (trust guarantee)
# ---------------------------------------------------------------------------

class TestMakeClientEnforcement:
    def test_none_never_constructs_any_client(self, monkeypatch):
        from yuu_clip.scoring import llm_client as lc
        built = []
        for cls in (lc.LlamaCppServerClient, lc.ClaudeClient):
            monkeypatch.setattr(cls, "__init__", _spy(cls, built))
        client = lc.make_client(_cfg(
            llm_enabled=True, llm_backend="llamacpp", ai_privacy_mode="none"))
        assert isinstance(client, lc.NullLLMClient)
        assert built == []

    def test_local_only_never_constructs_claude_client(self, monkeypatch):
        from yuu_clip.scoring import llm_client as lc
        built = []
        monkeypatch.setattr(lc.ClaudeClient, "__init__", _spy(lc.ClaudeClient, built))
        client = lc.make_client(_cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="local_only"))
        assert isinstance(client, lc.NullLLMClient)
        assert built == []

    def test_local_only_allows_local_llamacpp(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, make_client
        client = make_client(_cfg(
            llm_enabled=True, llm_backend="llamacpp", ai_privacy_mode="local_only"))
        assert isinstance(client, LlamaCppServerClient)

    def test_remote_ok_constructs_claude_client(self):
        from yuu_clip.scoring.llm_client import ClaudeClient, make_client
        client = make_client(_cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="remote_ok",
            remote_ai_enabled=True))
        assert isinstance(client, ClaudeClient)

    def test_backend_is_remote_reads_class_attr_without_constructing(self, monkeypatch):
        from yuu_clip.scoring import llm_client as lc
        built = []
        monkeypatch.setattr(lc.ClaudeClient, "__init__", _spy(lc.ClaudeClient, built))
        assert lc.backend_is_remote(_cfg(llm_backend="claude")) is True
        assert lc.backend_is_remote(_cfg(llm_backend="llamacpp")) is False
        assert built == []


def _spy(cls, sink):
    original = cls.__init__

    def _init(self, config):
        sink.append(cls.__name__)
        original(self, config)

    return _init


# ---------------------------------------------------------------------------
# remote_ai_enabled flag (WS4) - the distribution gate above the privacy mode
# ---------------------------------------------------------------------------

class TestRemoteAiFlag:
    def test_flag_off_forces_null_client_even_under_remote_ok(self, monkeypatch):
        # Same config that would build a ClaudeClient, but with the gate off (default):
        # no remote client is constructed, regardless of remote_ok + a key.
        from yuu_clip.scoring import llm_client as lc
        monkeypatch.delenv("YUU_REMOTE_AI", raising=False)
        built = []
        monkeypatch.setattr(lc.ClaudeClient, "__init__", _spy(lc.ClaudeClient, built))
        client = lc.make_client(_cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="remote_ok",
            claude_api_key="sk-x", remote_ai_enabled=False))
        assert isinstance(client, lc.NullLLMClient)
        assert built == []

    def test_flag_on_constructs_claude_client(self, monkeypatch):
        from yuu_clip.scoring.llm_client import ClaudeClient, make_client
        monkeypatch.delenv("YUU_REMOTE_AI", raising=False)
        client = make_client(_cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="remote_ok",
            claude_api_key="sk-x", remote_ai_enabled=True))
        assert isinstance(client, ClaudeClient)

    def test_env_var_enables_flag_without_config_field(self, monkeypatch):
        from yuu_clip.scoring.llm_client import ClaudeClient, make_client
        monkeypatch.setenv("YUU_REMOTE_AI", "1")
        client = make_client(_cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="remote_ok",
            claude_api_key="sk-x", remote_ai_enabled=False))
        assert isinstance(client, ClaudeClient)

    def test_flag_on_still_honors_local_only_privacy(self, monkeypatch):
        # The gate sits ABOVE privacy: turning it on must not bypass local_only.
        from yuu_clip.scoring import llm_client as lc
        monkeypatch.delenv("YUU_REMOTE_AI", raising=False)
        built = []
        monkeypatch.setattr(lc.ClaudeClient, "__init__", _spy(lc.ClaudeClient, built))
        client = lc.make_client(_cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="local_only",
            claude_api_key="sk-x", remote_ai_enabled=True))
        assert isinstance(client, lc.NullLLMClient)
        assert built == []

    def test_remote_ai_allowed_resolver(self, monkeypatch):
        from yuu_clip.config import remote_ai_allowed
        monkeypatch.delenv("YUU_REMOTE_AI", raising=False)
        assert remote_ai_allowed(_cfg(remote_ai_enabled=False)) is False
        assert remote_ai_allowed(_cfg(remote_ai_enabled=True)) is True
        monkeypatch.setenv("YUU_REMOTE_AI", "yes")
        assert remote_ai_allowed(_cfg(remote_ai_enabled=False)) is True
        monkeypatch.setenv("YUU_REMOTE_AI", "0")
        assert remote_ai_allowed(_cfg(remote_ai_enabled=False)) is False


# ---------------------------------------------------------------------------
# check_llm_available / check_vision_available honor the mode
# ---------------------------------------------------------------------------

class TestGatesHonorMode:
    def test_check_llm_off_under_none(self):
        from yuu_clip.scoring.llm import check_llm_available
        ok, reason = check_llm_available(_cfg(llm_enabled=True, ai_privacy_mode="none"))
        assert ok is False and "generative ai is turned off" in reason.lower()

    def test_check_llm_blocks_remote_under_local_only(self):
        # remote_ai_enabled so the block under test is the privacy mode, not the WS4 gate.
        from yuu_clip.scoring.llm import check_llm_available
        ok, reason = check_llm_available(_cfg(
            llm_enabled=True, llm_backend="claude", remote_ai_enabled=True,
            claude_api_key="sk-x", ai_privacy_mode="local_only"))
        assert ok is False and "remote" in reason.lower()

    def test_check_vision_off_under_none(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(
            llm_enabled=True, vision_enabled=True, ai_privacy_mode="none"))
        assert ok is False and "generative ai is turned off" in reason.lower()

    def test_check_vision_blocks_remote_under_local_only(self):
        # remote_ai_enabled so the block under test is the privacy mode, not the WS4 gate.
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(
            llm_enabled=True, vision_enabled=True, llm_backend="claude", remote_ai_enabled=True,
            claude_api_key="sk-x", ai_privacy_mode="local_only"))
        assert ok is False and "remote" in reason.lower()


# ---------------------------------------------------------------------------
# Vision hard backstop - describe_frames never reaches a remote client
# ---------------------------------------------------------------------------

class TestVisionBackstop:
    def test_describe_frames_blocked_local_only_claude(self, monkeypatch):
        from yuu_clip.scoring import llm_client as lc
        from yuu_clip.scoring.llm import describe_frames
        from yuu_clip.scoring.llm_client import VisionNotSupportedError

        built = []
        monkeypatch.setattr(lc.ClaudeClient, "__init__", _spy(lc.ClaudeClient, built))
        # remote_ai_enabled so the block under test is the privacy mode, not the WS4 gate.
        cfg = _cfg(llm_enabled=True, llm_backend="claude", remote_ai_enabled=True,
                   claude_api_key="sk-x", ai_privacy_mode="local_only")
        # make_client returns NullLLMClient, whose chat_vision raises the base backstop.
        with pytest.raises(VisionNotSupportedError):
            describe_frames([Path("frame.jpg")], cfg)
        assert built == []


# ---------------------------------------------------------------------------
# Similarity llm backend falls back under "No generative AI"
# ---------------------------------------------------------------------------

class TestSimilarityFallback:
    def test_llm_backend_falls_back_to_tfidf_under_none(self):
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        backend = make_backend(_cfg(similarity_backend="llm", ai_privacy_mode="none"))
        assert isinstance(backend, TfidfBackend)
