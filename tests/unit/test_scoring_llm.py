"""yuu_clip/scoring/llm.py + llm_client.py - LLM scorer, clients, summaries, timeline."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# LLMScorer - is_available() branches
# ---------------------------------------------------------------------------

class TestLLMScorerIsAvailable:
    """LLMScorer.is_available() covers llm_enabled gate, llamacpp checks, claude checks."""

    def _make_config(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def _scorer(self, **config_overrides):
        from yuu_clip.scoring.llm import LLMScorer
        return LLMScorer(self._make_config(**config_overrides))

    def test_llm_enabled_false_returns_false_immediately(self):
        scorer = self._scorer(llm_enabled=False, llm_backend="llamacpp")
        assert scorer.is_available() is False

    def test_llamacpp_empty_model_path_returns_false(self):
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path="")
        assert scorer.is_available() is False

    def test_llamacpp_nonexistent_path_returns_false(self, tmp_path):
        scorer = self._scorer(
            llm_backend="llamacpp",
            llm_model_path=str(tmp_path / "nonexistent.gguf"),
        )
        assert scorer.is_available() is False

    def test_llamacpp_path_exists_but_binary_missing_returns_false(self, tmp_path):
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        import unittest.mock as mock

        from yuu_clip.scoring.llamacpp_server import LlamaServerError
        with mock.patch(
            "yuu_clip.scoring.llamacpp_server.resolve_server_binary",
            side_effect=LlamaServerError("llama-server was not found"),
        ):
            assert scorer.is_available() is False

    def test_llamacpp_all_checks_pass_returns_true(self, tmp_path):
        import unittest.mock as mock
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        with mock.patch(
            "yuu_clip.scoring.llamacpp_server.resolve_server_binary",
            return_value="llama-server",
        ):
            scorer._available = None
            result = scorer.is_available()
        assert result is True

    def test_claude_backend_unreachable_returns_false(self):
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="claude", ai_privacy_mode="remote_ok",
                              remote_ai_enabled=True)
        with mock.patch("yuu_clip.scoring.llm_client.ClaudeClient.available",
                        return_value=(False, "key rejected")):
            scorer._available = None
            result = scorer.is_available()
        assert result is False

    def test_claude_backend_reachable_returns_true(self):
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="claude", ai_privacy_mode="remote_ok",
                              remote_ai_enabled=True)
        with mock.patch("yuu_clip.scoring.llm_client.ClaudeClient.available",
                        return_value=(True, "")):
            scorer._available = None
            result = scorer.is_available()
        assert result is True

    def test_is_available_caches_result(self, tmp_path):
        """Second call to is_available() must not redo the availability check."""
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="claude", ai_privacy_mode="remote_ok",
                              remote_ai_enabled=True)
        call_count = 0

        def counting_available(self):
            nonlocal call_count
            call_count += 1
            return (True, "")
        with mock.patch("yuu_clip.scoring.llm_client.ClaudeClient.available", counting_available):
            scorer.is_available()
            scorer.is_available()
        assert call_count == 1

# ---------------------------------------------------------------------------
# LLMScorer - _parse() score clamping
# ---------------------------------------------------------------------------

class TestLLMScorerParse:
    """_parse() clamps scores to [0, 1] and passes through other keys."""

    def _parse(self, data: dict) -> dict:
        import json

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        return scorer._parse(json.dumps(data))

    def test_scores_within_range_unchanged(self):
        result = self._parse({"score_funny": 0.5, "score_dramatic": 0.3, "score_action": 0.8})
        assert abs(result["score_funny"] - 0.5) < 1e-9
        assert abs(result["score_dramatic"] - 0.3) < 1e-9
        assert abs(result["score_action"] - 0.8) < 1e-9

    def test_score_above_one_clamped_to_one(self):
        result = self._parse({"score_funny": 1.5, "score_dramatic": 2.0, "score_action": 99.0})
        assert result["score_funny"] == 1.0
        assert result["score_dramatic"] == 1.0
        assert result["score_action"] == 1.0

    def test_score_below_zero_clamped_to_zero(self):
        result = self._parse({"score_funny": -0.5, "score_dramatic": -1.0, "score_action": -99.0})
        assert result["score_funny"] == 0.0
        assert result["score_dramatic"] == 0.0
        assert result["score_action"] == 0.0

    def test_missing_score_keys_not_added(self):
        result = self._parse({"description": "test"})
        assert "score_funny" not in result
        assert result["description"] == "test"

    def test_description_keys_preserved(self):
        result = self._parse({
            "score_funny": 0.5, "score_dramatic": 0.5, "score_action": 0.5,
            "description": "A moment", "description_long": "Longer text here",
        })
        assert result["description"] == "A moment"
        assert result["description_long"] == "Longer text here"

# ---------------------------------------------------------------------------
# LLMScorer - score() result paths
# ---------------------------------------------------------------------------

class TestLLMScorerScore:
    """score() - no-transcript, error, and success paths."""

    def _make_scorer(self, backend_response=None):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        if backend_response is not None:
            scorer._call_llm = mock.MagicMock(return_value=backend_response)
        return scorer

    def _make_clip(self, excerpt=""):
        import unittest.mock as mock
        clip = mock.MagicMock()
        clip.id = 1
        clip.transcript_excerpt = excerpt
        return clip

    def test_no_transcript_returns_llm_no_transcript_tag(self):
        scorer = self._make_scorer()
        clip = self._make_clip(excerpt="")
        result = scorer.score(clip, None)
        assert "llm_no_transcript" in result.tags
        assert result.score_funny is None   # no transcript → no opinion, not a real zero

    def test_none_transcript_returns_llm_no_transcript_tag(self):
        scorer = self._make_scorer()
        clip = self._make_clip(excerpt=None)
        result = scorer.score(clip, None)
        assert "llm_no_transcript" in result.tags

    def test_backend_exception_returns_llm_error_tag(self):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        scorer._call_llm = mock.MagicMock(side_effect=RuntimeError("backend down"))
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags
        assert result.score_funny is None   # backend error → no opinion, not a real zero

    def test_invalid_json_returns_llm_error_tag(self):
        scorer = self._make_scorer(backend_response="not json {{{{")
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags

    def test_markdown_fenced_json_parsed_without_repair_call(self):
        import json
        import unittest.mock as mock
        payload = json.dumps({"score_funny": 0.6})
        scorer = self._make_scorer(backend_response=f"```json\n{payload}\n```")
        scorer._call_llm = mock.MagicMock(wraps=scorer._call_llm)
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_scored" in result.tags
        assert scorer._call_llm.call_count == 1

    def test_invalid_json_retried_with_repair_request(self):
        import json
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        payload = json.dumps({"score_funny": 0.9})
        scorer = LLMScorer(Config())
        scorer._call_llm = mock.MagicMock(side_effect=["not json {{{{", payload])
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_scored" in result.tags
        assert abs(result.score_funny - 0.9) < 1e-9
        assert scorer._call_llm.call_count == 2
        repair_kwargs = scorer._call_llm.call_args_list[1].kwargs
        assert repair_kwargs["repair_of"] == "not json {{{{"

    def test_repair_still_invalid_returns_llm_error_tag(self):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        scorer._call_llm = mock.MagicMock(side_effect=["not json {{{{", "still not json"])
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags
        assert scorer._call_llm.call_count == 2

    def test_successful_score_populates_all_fields(self):
        import json
        payload = {
            "score_funny": 0.7, "score_dramatic": 0.4, "score_action": 0.2,
            "description": "A funny moment", "description_long": "Very detailed text",
        }
        scorer = self._make_scorer(backend_response=json.dumps(payload))
        clip = self._make_clip(excerpt="transcript here")
        result = scorer.score(clip, None)
        assert "llm_scored" in result.tags
        assert abs(result.score_funny - 0.7) < 1e-6
        assert abs(result.score_dramatic - 0.4) < 1e-6
        assert abs(result.score_action - 0.2) < 1e-6
        assert result.description == "A funny moment"
        assert result.description_long == "Very detailed text"

    def test_out_of_range_scores_clamped(self):
        import json
        payload = {"score_funny": 2.0, "score_dramatic": -1.0, "score_action": 0.5}
        scorer = self._make_scorer(backend_response=json.dumps(payload))
        clip = self._make_clip(excerpt="transcript here")
        result = scorer.score(clip, None)
        assert result.score_funny == 1.0
        assert result.score_dramatic == 0.0

    def test_success_notes_include_model_id_for_llamacpp(self):
        import json
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        cfg = Config()
        cfg.llm_backend = "llamacpp"
        cfg.llm_model_path = "/models/qwen2.5.gguf"
        scorer = LLMScorer(cfg)
        scorer._call_llm = mock.MagicMock(return_value=json.dumps({"score_funny": 0.5}))
        clip = self._make_clip(excerpt="text")
        result = scorer.score(clip, None)
        assert result.notes.get("model") == "/models/qwen2.5.gguf"

    def test_success_notes_include_model_id_for_claude(self):
        import json
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        cfg = Config()
        cfg.llm_backend = "claude"
        cfg.claude_model = "claude-haiku-4-5-20251001"
        scorer = LLMScorer(cfg)
        scorer._call_llm = mock.MagicMock(return_value=json.dumps({"score_funny": 0.5}))
        clip = self._make_clip(excerpt="text")
        result = scorer.score(clip, None)
        assert result.notes.get("model") == "claude-haiku-4-5-20251001"

# ---------------------------------------------------------------------------
# Coverage gaps - pure-function and edge-case paths
# ---------------------------------------------------------------------------

class TestStripJsonFence:
    def _strip(self, raw: str) -> str:
        from yuu_clip.scoring.llm import _strip_json_fence
        return _strip_json_fence(raw)

    def test_plain_json_unchanged(self):
        assert self._strip('{"a": 1}') == '{"a": 1}'

    def test_json_fence_with_language_tag_stripped(self):
        assert self._strip('```json\n{"a": 1}\n```') == '{"a": 1}'

    def test_fence_without_language_tag_stripped(self):
        assert self._strip('```\n{"a": 1}\n```') == '{"a": 1}'

    def test_surrounding_whitespace_stripped(self):
        assert self._strip('  \n{"a": 1}\n  ') == '{"a": 1}'

    def test_fence_amid_prose_is_found(self):
        # A lead-in sentence + a trailing note around the fence still yields the payload.
        raw = 'Sure, here is the JSON:\n```json\n{"a": 1}\n```\nHope that helps!'
        assert self._strip(raw) == '{"a": 1}'

    def test_no_fence_prose_left_intact(self):
        # Fence-only: bare prose (even with a stray brace) is NOT mined for JSON here -
        # that is _loads_lenient's job, so a vision summary is not corrupted.
        assert self._strip("The menu is paused {see HUD}.") == "The menu is paused {see HUD}."


class TestLoadsLenient:
    def _load(self, raw: str):
        from yuu_clip.scoring.llm import _loads_lenient
        return _loads_lenient(raw)

    def test_plain_object(self):
        assert self._load('{"a": 1}') == {"a": 1}

    def test_prose_wrapped_object_extracted(self):
        assert self._load('The scores are {"a": 1} in total.') == {"a": 1}

    def test_prose_wrapped_array_extracted(self):
        assert self._load('Here you go: [1, 2, 3] done.') == [1, 2, 3]

    def test_brace_inside_string_not_mistaken_for_close(self):
        assert self._load('note: {"reason": "a } b"} end') == {"reason": "a } b"}

    def test_truncated_json_raises_for_repair(self):
        import json

        import pytest
        # Unbalanced (cut mid-array) -> no complete span, so it must fail loud so the
        # caller's repair retry fires rather than parsing a partial object.
        with pytest.raises(json.JSONDecodeError):
            self._load('[{"start_ms": 1, "end_ms": 2},')


class TestCallLlmJson:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_valid_json_returned_without_repair(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import _call_llm_json
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps({"a": 1})) as call:
            result = _call_llm_json([{"role": "user", "content": "hi"}], self._cfg())
        assert result == {"a": 1}
        assert call.call_count == 1

    def test_invalid_json_retried_once_and_succeeds(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import _call_llm_json
        with mock.patch(
            "yuu_clip.scoring.llm._call_client",
            side_effect=["not json {{{{", json.dumps({"a": 1})],
        ) as call:
            result = _call_llm_json([{"role": "user", "content": "hi"}], self._cfg())
        assert result == {"a": 1}
        assert call.call_count == 2
        repair_messages = call.call_args_list[1].args[0]
        assert repair_messages[-2] == {"role": "assistant", "content": "not json {{{{"}

    def test_invalid_json_still_invalid_after_repair_raises(self):
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import _call_llm_json
        with mock.patch(
            "yuu_clip.scoring.llm._call_client",
            side_effect=["not json {{{{", "still bad"],
        ):
            with pytest.raises(json.JSONDecodeError):
                _call_llm_json([{"role": "user", "content": "hi"}], self._cfg())

    def test_prose_wrapped_json_parses_without_repair(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import _call_llm_json
        with mock.patch(
            "yuu_clip.scoring.llm._call_client",
            return_value='Sure! {"a": 1} - let me know.',
        ) as call:
            result = _call_llm_json([{"role": "user", "content": "hi"}], self._cfg())
        assert result == {"a": 1}
        assert call.call_count == 1  # no repair round trip for prose-wrapped-but-valid JSON

    def test_max_tokens_threaded_to_client(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import _call_llm_json
        with mock.patch(
            "yuu_clip.scoring.llm._call_client", return_value=json.dumps([]),
        ) as call:
            _call_llm_json([{"role": "user", "content": "hi"}], self._cfg(), max_tokens=2048)
        assert call.call_args.args[3] == 2048


class TestPrependContext:
    def _pp(self, system, context):
        from yuu_clip.scoring.llm import _prepend_context
        return _prepend_context(system, context)

    def test_with_context_prepends_and_separates(self):
        result = self._pp("SYSTEM", "CONTEXT")
        assert result == "CONTEXT\n\nSYSTEM"

    def test_empty_context_returns_system_unchanged(self):
        assert self._pp("SYSTEM", "") == "SYSTEM"

    def test_none_context_not_prepended(self):
        # context_text="" is the expected sentinel; None is not a valid call, but
        # the falsy branch must still return just the system prompt.
        assert self._pp("SYSTEM", None) == "SYSTEM"

# ---------------------------------------------------------------------------
# LLMClient factory - make_client() routing
# ---------------------------------------------------------------------------

class TestMakeClient:
    def _cfg(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_llm_disabled_returns_null_client(self):
        from yuu_clip.scoring.llm_client import NullLLMClient, make_client
        client = make_client(self._cfg(llm_enabled=False))
        assert isinstance(client, NullLLMClient)

    def test_llamacpp_backend_returns_llamacpp_client(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, make_client
        client = make_client(self._cfg(llm_enabled=True, llm_backend="llamacpp"))
        assert isinstance(client, LlamaCppServerClient)

    def test_claude_backend_returns_claude_client(self):
        from yuu_clip.scoring.llm_client import ClaudeClient, make_client
        client = make_client(self._cfg(
            llm_enabled=True, llm_backend="claude", ai_privacy_mode="remote_ok",
            remote_ai_enabled=True))
        assert isinstance(client, ClaudeClient)

    def test_unknown_backend_falls_back_to_llamacpp(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, make_client
        client = make_client(self._cfg(llm_enabled=True, llm_backend="unknown"))
        assert isinstance(client, LlamaCppServerClient)

# ---------------------------------------------------------------------------
# ClaudeClient.available()
# ---------------------------------------------------------------------------

class TestClaudeClientAvailable:
    def _client(self, **overrides):
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm_client import ClaudeClient
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return ClaudeClient(cfg)

    def test_no_api_key_returns_false(self):
        c = self._client(claude_api_key="")
        ok, reason = c.available()
        assert ok is False
        assert "API key" in reason

    def test_missing_anthropic_package_returns_false(self):
        import sys
        import unittest.mock as mock
        c = self._client(claude_api_key="sk-test")
        with mock.patch.dict(sys.modules, {"anthropic": None}):
            ok, reason = c.available()
        assert ok is False
        assert "anthropic" in reason

    def test_api_key_and_package_present_returns_true(self):
        import sys
        import unittest.mock as mock
        c = self._client(claude_api_key="sk-test")
        fake_anthropic = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"anthropic": fake_anthropic}):
            ok, reason = c.available()
        assert ok is True
        assert reason == ""

    def test_rejected_api_key_returns_false(self):
        import sys
        import unittest.mock as mock

        class _AuthError(Exception):
            pass

        c = self._client(claude_api_key="sk-bad")
        fake_anthropic = mock.MagicMock()
        fake_anthropic.AuthenticationError = _AuthError
        fake_anthropic.Anthropic.return_value.models.list.side_effect = _AuthError("401")
        with mock.patch.dict(sys.modules, {"anthropic": fake_anthropic}):
            ok, reason = c.available()
        assert ok is False
        assert "rejected" in reason

    def test_unreachable_api_returns_false(self):
        import sys
        import unittest.mock as mock

        class _AuthError(Exception):
            pass

        c = self._client(claude_api_key="sk-test")
        fake_anthropic = mock.MagicMock()
        fake_anthropic.AuthenticationError = _AuthError
        fake_anthropic.Anthropic.return_value.models.list.side_effect = ConnectionError("no route")
        with mock.patch.dict(sys.modules, {"anthropic": fake_anthropic}):
            ok, reason = c.available()
        assert ok is False
        assert "Couldn't reach" in reason

    def test_old_sdk_without_models_api_trusts_key(self):
        import sys
        import unittest.mock as mock

        class _AuthError(Exception):
            pass

        c = self._client(claude_api_key="sk-test")
        fake_anthropic = mock.MagicMock()
        fake_anthropic.AuthenticationError = _AuthError
        fake_anthropic.Anthropic.return_value = object()  # no .models attribute → AttributeError
        with mock.patch.dict(sys.modules, {"anthropic": fake_anthropic}):
            ok, reason = c.available()
        assert ok is True
        assert reason == ""

    def test_null_client_available_returns_false(self):
        from yuu_clip.scoring.llm_client import NullLLMClient
        ok, reason = NullLLMClient().available()
        assert ok is False

    def test_null_client_chat_raises(self):
        import pytest

        from yuu_clip.scoring.llm_client import NullLLMClient
        with pytest.raises(RuntimeError):
            NullLLMClient().chat([{"role": "user", "content": "hi"}])

# ---------------------------------------------------------------------------
# ClaudeClient.chat() / chat_vision() - message-building payload (WS4 Stage 1).
# These pin the exact kwargs handed to anthropic's messages.create against today's
# code, so the remote-AI flag work below can't silently change the wire payload.
# ---------------------------------------------------------------------------

def _claude_client(**overrides):
    from yuu_clip.config import Config
    from yuu_clip.scoring.llm_client import ClaudeClient
    cfg = Config()
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return ClaudeClient(cfg)


def _fake_anthropic(reply_text="ok"):
    """A stand-in anthropic module whose messages.create records its kwargs and
    returns a text-first content block (the shape ClaudeClient.chat indexes)."""
    import unittest.mock as mock
    fake = mock.MagicMock()
    response = mock.MagicMock()
    response.content = [mock.MagicMock(text=reply_text)]
    fake.Anthropic.return_value.messages.create.return_value = response
    return fake


class TestClaudeClientChat:
    def test_builds_system_and_messages(self):
        import sys
        import unittest.mock as mock
        fake = _fake_anthropic("hello there")
        client = _claude_client(claude_model="claude-haiku-4-5-20251001")
        messages = [
            {"role": "system", "content": "SYS A"},
            {"role": "system", "content": "SYS B"},
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
        ]
        with mock.patch.dict(sys.modules, {"anthropic": fake}):
            result = client.chat(messages, temperature=0.4)
        # response.content[0].text - assumes a text-first content block; a future model
        # returning tool/thinking blocks first would index the wrong block (out of scope).
        assert result == "hello there"
        kwargs = fake.Anthropic.return_value.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert kwargs["max_tokens"] == 1024
        assert kwargs["temperature"] == 0.4
        assert kwargs["system"] == "SYS A\n\nSYS B"
        assert kwargs["messages"] == [
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
        ]

    def test_no_system_messages_omits_system_kwarg(self):
        import sys
        import unittest.mock as mock
        fake = _fake_anthropic()
        client = _claude_client()
        with mock.patch.dict(sys.modules, {"anthropic": fake}):
            client.chat([{"role": "user", "content": "just me"}])
        kwargs = fake.Anthropic.return_value.messages.create.call_args.kwargs
        assert "system" not in kwargs
        assert kwargs["messages"] == [{"role": "user", "content": "just me"}]


class TestClaudeClientChatVision:
    def test_builds_image_blocks_then_text(self, tmp_path):
        import base64
        import sys
        import unittest.mock as mock
        first = tmp_path / "a.jpg"
        second = tmp_path / "b.jpg"
        first.write_bytes(b"\x01\x02frame-one")
        second.write_bytes(b"\x03\x04frame-two")
        fake = _fake_anthropic("a description")
        client = _claude_client(claude_model="claude-haiku-4-5-20251001")
        messages = [
            {"role": "system", "content": "look carefully"},
            {"role": "user", "content": "what is here"},
        ]
        with mock.patch.dict(sys.modules, {"anthropic": fake}):
            result = client.chat_vision(messages, [first, second], temperature=0.2)
        assert result == "a description"
        kwargs = fake.Anthropic.return_value.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-haiku-4-5-20251001"
        assert kwargs["max_tokens"] == 1024
        assert kwargs["temperature"] == 0.2
        assert kwargs["system"] == "look carefully"
        content = kwargs["messages"][0]["content"]
        assert kwargs["messages"][0]["role"] == "user"
        # One base64 image block per image (media_type image/jpeg), then the text block.
        assert content[0] == {"type": "image", "source": {
            "type": "base64", "media_type": "image/jpeg",
            "data": base64.b64encode(b"\x01\x02frame-one").decode("ascii"),
        }}
        assert content[1] == {"type": "image", "source": {
            "type": "base64", "media_type": "image/jpeg",
            "data": base64.b64encode(b"\x03\x04frame-two").decode("ascii"),
        }}
        assert content[2] == {"type": "text", "text": "what is here"}

# ---------------------------------------------------------------------------
# check_llm_available()
# ---------------------------------------------------------------------------

class TestCheckLlmAvailable:
    def _cfg(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_llm_disabled_returns_false(self):
        from yuu_clip.scoring.llm import check_llm_available
        ok, reason = check_llm_available(self._cfg(llm_enabled=False))
        assert ok is False
        assert "disabled" in reason

    def test_delegates_to_client_available(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import check_llm_available
        cfg = self._cfg(llm_enabled=True, llm_backend="claude", ai_privacy_mode="remote_ok",
                        remote_ai_enabled=True)
        with mock.patch("yuu_clip.scoring.llm_client.ClaudeClient.available",
                        return_value=(True, "")):
            ok, reason = check_llm_available(cfg)
        assert ok is True

# ---------------------------------------------------------------------------
# LLM module-level functions: summarize_transcript, generate_timeline_chunk,
# find_related_clips - tested with a mocked _call_client
# ---------------------------------------------------------------------------

class TestSummarizeTranscript:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_title_and_summary(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        payload = json.dumps({"title": "Epic session", "summary": "Things happened."})
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            title, summary = summarize_transcript("some transcript text", self._cfg())
        assert title == "Epic session"
        assert summary == "Things happened."

    def test_truncates_to_12000_chars(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        long_text = "x" * 20_000
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_transcript(long_text, self._cfg())
        user_content = captured["messages"][1]["content"]
        assert len(user_content) < 14_000

    def test_context_prepended_to_system(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_transcript("text", self._cfg(), context_text="WORLD CONTEXT")
        system_content = captured["messages"][0]["content"]
        assert system_content.startswith("WORLD CONTEXT")

    def test_missing_keys_return_empty_strings(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps({})):
            title, summary = summarize_transcript("text", self._cfg())
        assert title == ""
        assert summary == ""

class TestGenerateTimelineChunk:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_stripped_string(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value="  paragraph text  "):
            result = generate_timeline_chunk("transcript", "0:00", "15:00", [], self._cfg())
        assert result == "paragraph text"

    def test_clip_descriptions_included_in_user_message(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return "result"
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            generate_timeline_chunk("text", "0:00", "15:00", ["Clip A", "Clip B"], self._cfg())
        user_content = captured["messages"][1]["content"]
        assert "Clip A" in user_content
        assert "Clip B" in user_content

    def test_no_clip_descriptions_omits_notable_clips_section(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return "result"
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            generate_timeline_chunk("text", "0:00", "15:00", [], self._cfg())
        user_content = captured["messages"][1]["content"]
        assert "Notable clips" not in user_content

    def test_context_prepended_to_system(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return "result"
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            generate_timeline_chunk("text", "0:00", "15:00", [], self._cfg(), context_text="CTX")
        system_content = captured["messages"][0]["content"]
        assert system_content.startswith("CTX")

class TestFindRelatedClips:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_list_of_id_reason_dicts(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": 7, "reason": "both chaotic"}, {"id": 3, "reason": "same tone"}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref desc", [{"id": 7, "description": "d1"}], self._cfg())
        assert result == [{"id": 7, "reason": "both chaotic"}, {"id": 3, "reason": "same tone"}]

    def test_non_list_response_raises_value_error(self):
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import find_related_clips
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps({"error": "bad"})):
            with pytest.raises(ValueError):
                find_related_clips("ref", [], self._cfg())

    def test_id_coerced_to_int(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": "42", "reason": "similar"}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref", [{"id": 42, "description": "d"}], self._cfg())
        assert result[0]["id"] == 42
        assert isinstance(result[0]["id"], int)

    def test_missing_reason_defaults_to_empty_string(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": 1}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref", [{"id": 1, "description": "d"}], self._cfg())
        assert result[0]["reason"] == ""

    def test_empty_candidates_returns_empty_list(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps([])):
            result = find_related_clips("ref", [], self._cfg())
        assert result == []


class TestNullLLMClientVision:
    """A vision call while LLM scoring is disabled reports 'disabled', not the base
    'backend does not support image analysis' - but stays a VisionNotSupportedError
    so the caption-edit route's handler still catches it."""

    def test_chat_vision_raises_disabled_reason(self):
        from pathlib import Path

        import pytest

        from yuu_clip.scoring.llm_client import NullLLMClient, VisionNotSupportedError

        with pytest.raises(VisionNotSupportedError, match="disabled"):
            NullLLMClient().chat_vision([{"role": "user", "content": "hi"}], [Path("f.png")])
