"""yuu_clip/scoring/llm.py + llm_client.py - LLM scorer, clients, summaries, timeline."""

from __future__ import annotations


class TestClientAvailableReasonNoPathLeak:
    """LlamaCppServerClient.available() reasons render in the UI (clip descriptions,
    analyze warnings), so they must never carry the absolute model path - it would
    leak the user's home dir into screenshots (no-personal-paths rule)."""

    def _config(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_missing_model_path_reason_has_no_path(self, tmp_path):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient
        missing = str(tmp_path / "nope.gguf")
        ok, reason = LlamaCppServerClient(self._config(llm_model_path=missing)).available()
        assert ok is False
        assert missing not in reason
        assert str(tmp_path) not in reason

    def test_unset_model_path_reason_has_no_path(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient
        ok, reason = LlamaCppServerClient(self._config(llm_model_path="")).available()
        assert ok is False
        assert reason

    def test_binary_resolution_failure_reason_has_no_path(self, tmp_path):
        # The model file exists (first two branches pass), but the server binary
        # can't be resolved. The LlamaServerError message embeds an absolute path;
        # available() must not surface it (it flows unredacted into UI warnings).
        from unittest import mock

        from yuu_clip.scoring.llamacpp_server import LlamaServerError
        from yuu_clip.scoring.llm_client import LlamaCppServerClient

        model = tmp_path / "model.gguf"
        model.write_bytes(b"x")
        leaked = str(tmp_path / "bundle" / "llama-server.exe")
        with mock.patch(
            "yuu_clip.scoring.llamacpp_server.resolve_server_binary",
            side_effect=LlamaServerError(f"is set to {leaked} but no llama-server was found"),
        ):
            ok, reason = LlamaCppServerClient(self._config(llm_model_path=str(model))).available()
        assert ok is False
        assert reason
        assert leaked not in reason
        assert str(tmp_path) not in reason


# ---------------------------------------------------------------------------
# LLMScorer - is_available() branches
# ---------------------------------------------------------------------------

class TestLLMScorerIsAvailable:
    """LLMScorer.is_available() covers the llm_enabled gate and the llamacpp checks."""

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

    def test_is_available_caches_result(self, tmp_path):
        """Second call to is_available() must not redo the availability check."""
        import unittest.mock as mock
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        call_count = 0

        def counting_available(self):
            nonlocal call_count
            call_count += 1
            return (True, "")
        with mock.patch("yuu_clip.scoring.llm_client.LlamaCppServerClient.available", counting_available):
            scorer.is_available()
            scorer.is_available()
        assert call_count == 1

    def test_privacy_mode_turned_off_after_construction_is_reflected_live(self, tmp_path):
        """is_available() re-reads ai_privacy_mode on every call (unlike the cached
        backend probe below it), so flipping the setting mid-session takes effect on
        the very next call - even though a prior call already cached _available=True."""
        import unittest.mock as mock
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(
            llm_backend="llamacpp", llm_model_path=str(gguf), ai_privacy_mode="local_only",
        )
        with mock.patch(
            "yuu_clip.scoring.llamacpp_server.resolve_server_binary",
            return_value="llama-server",
        ):
            assert scorer.is_available() is True
        scorer._config.ai_privacy_mode = "none"
        assert scorer.is_available() is False


class TestLLMScorerAvailabilityLogging:
    """The privacy/disabled-off branches must be distinguishable in the log from a
    genuine backend failure - INFO wording naming the deliberate cause vs the
    existing WARNING for a real unavailability reason."""

    def _make_config(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_llm_disabled_logs_info_not_warning(self, caplog):
        import logging

        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(self._make_config(llm_enabled=False))
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.llm"):
            scorer.is_available()
        records = [r for r in caplog.records if r.name == "yuu_clip.scoring.llm"]
        assert len(records) == 1
        assert records[0].levelno == logging.INFO
        assert "disabled in Settings" in records[0].getMessage()

    def test_privacy_mode_off_logs_info_naming_privacy(self, caplog):
        import logging

        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(self._make_config(llm_backend="llamacpp", ai_privacy_mode="none"))
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.llm"):
            scorer.is_available()
        records = [r for r in caplog.records if r.name == "yuu_clip.scoring.llm"]
        assert len(records) == 1
        assert records[0].levelno == logging.INFO
        assert "Generative AI is turned off" in records[0].getMessage()

    def test_off_reason_logged_only_once_across_repeated_calls(self, caplog):
        import logging

        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(self._make_config(llm_enabled=False))
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.llm"):
            scorer.is_available()
            scorer.is_available()
            scorer.is_available()
        records = [r for r in caplog.records if r.name == "yuu_clip.scoring.llm"]
        assert len(records) == 1

    def test_backend_failure_still_logs_warning_not_info(self, caplog, tmp_path):
        import logging

        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(self._make_config(
            llm_backend="llamacpp", llm_model_path=str(tmp_path / "nonexistent.gguf"),
        ))
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.llm"):
            scorer.is_available()
        records = [r for r in caplog.records if r.name == "yuu_clip.scoring.llm"]
        assert len(records) == 1
        assert records[0].levelno == logging.WARNING
        assert "LLM scoring disabled:" in records[0].getMessage()

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


class TestLLMScorerScoreUnderDisabledClient:
    """Defense-in-depth chain: when make_client() hands the scorer a real
    NullLLMClient (llm_enabled False, or generative AI off), score() must catch the
    client's RuntimeError and degrade to llm_error - not raise, and not rely on a
    mocked _call_llm the way TestLLMScorerScore's error-path tests do."""

    def _clip(self, excerpt="some transcript text"):
        import unittest.mock as mock
        clip = mock.MagicMock()
        clip.id = 1
        clip.transcript_excerpt = excerpt
        clip.vision_summary = ""
        return clip

    def test_llm_disabled_scorer_gets_a_null_client_and_degrades_gracefully(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        from yuu_clip.scoring.llm_client import NullLLMClient
        scorer = LLMScorer(Config(llm_enabled=False))
        assert isinstance(scorer._client, NullLLMClient)
        result = scorer.score(self._clip(), None)
        assert result.tags == ["llm_error"]
        assert result.score_funny is None

    def test_generative_ai_off_scorer_gets_a_null_client_and_degrades_gracefully(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        from yuu_clip.scoring.llm_client import NullLLMClient
        scorer = LLMScorer(Config(llm_enabled=True, ai_privacy_mode="none"))
        assert isinstance(scorer._client, NullLLMClient)
        result = scorer.score(self._clip(), None)
        assert result.tags == ["llm_error"]

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

    def test_unknown_backend_falls_back_to_llamacpp(self):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, make_client
        client = make_client(self._cfg(llm_enabled=True, llm_backend="unknown"))
        assert isinstance(client, LlamaCppServerClient)

# ---------------------------------------------------------------------------
# NullLLMClient
# ---------------------------------------------------------------------------

class TestNullLLMClient:
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
        cfg = self._cfg(llm_enabled=True, llm_backend="llamacpp")
        with mock.patch("yuu_clip.scoring.llm_client.LlamaCppServerClient.available",
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

    def test_non_dict_response_raises_value_error(self):
        """summarize_transcript now validates isinstance(dict) before calling .get(),
        matching find_related_clips/request_scene_boundaries's list-shape guards - a
        model that replies with a JSON array gets a clean ValueError, not AttributeError."""
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import summarize_transcript
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps([1, 2])):
            with pytest.raises(ValueError):
                summarize_transcript("text", self._cfg())


class TestSummarizeSession:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_title_and_summary(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_session
        payload = json.dumps({"title": "Epic run", "summary": "Stuff happened."})
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            title, summary = summarize_session(
                [("Rec 1", "First summary"), ("Rec 2", "Second summary")], self._cfg(),
            )
        assert title == "Epic run"
        assert summary == "Stuff happened."

    def test_members_with_no_title_and_no_summary_are_skipped(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_session
        captured = {}

        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_session([("Rec 1", "kept"), ("", "")], self._cfg())
        user_content = captured["messages"][1]["content"]
        assert "kept" in user_content
        assert "Recording 2" not in user_content

    def test_context_prepended_to_system(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_session
        captured = {}

        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_session([("Rec", "s")], self._cfg(), context_text="WORLD CONTEXT")
        assert captured["messages"][0]["content"].startswith("WORLD CONTEXT")

    def test_truncates_blocks_to_12000_chars(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_session
        long_summary = "x" * 20_000
        captured = {}

        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_session([("Rec", long_summary)], self._cfg())
        user_content = captured["messages"][1]["content"]
        assert len(user_content) < 14_000

    def test_non_dict_response_raises_value_error(self):
        """Same isinstance(dict) guard as summarize_transcript."""
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import summarize_session
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps([1, 2])):
            with pytest.raises(ValueError):
                summarize_session([("Rec", "s")], self._cfg())

# ---------------------------------------------------------------------------
# _sample_transcript_for_speaker_names() - B13: a flat head-only [:12000] cut
# never saw introductions later in a long recording (e.g. a press conference).
# ---------------------------------------------------------------------------

class TestSampleTranscriptForSpeakerNames:
    def _long_transcript(self, num_lines=2000):
        return [f"Speaker 1: filler line number {i} of the session" for i in range(num_lines)]

    def test_short_transcript_returned_unchanged(self):
        from yuu_clip.scoring.llm import _sample_transcript_for_speaker_names
        text = "Speaker 1: hi\nSpeaker 2: hello"
        assert _sample_transcript_for_speaker_names(text) == text

    def test_long_transcript_keeps_lines_near_the_end(self):
        from yuu_clip.scoring.llm import _sample_transcript_for_speaker_names
        lines = self._long_transcript()
        lines[-3] = "Speaker 2: joining us today is Dr. Alex"
        text = "\n".join(lines)
        assert len(text) > 12000  # a flat [:12000] truncation would have dropped this line
        sampled = _sample_transcript_for_speaker_names(text)
        assert "joining us today is Dr. Alex" in sampled

    def test_long_transcript_also_keeps_the_opening_lines(self):
        from yuu_clip.scoring.llm import _sample_transcript_for_speaker_names
        lines = self._long_transcript()
        lines[0] = "Speaker 1: I'm Alex, welcome everyone"
        text = "\n".join(lines)
        sampled = _sample_transcript_for_speaker_names(text)
        assert "I'm Alex, welcome everyone" in sampled

    def test_result_does_not_grow_far_past_budget(self):
        from yuu_clip.scoring.llm import _sample_transcript_for_speaker_names
        text = "\n".join(self._long_transcript())
        sampled = _sample_transcript_for_speaker_names(text, max_chars=12000)
        assert len(sampled) <= 12000 * 1.1

    def test_sampled_lines_preserve_original_order(self):
        from yuu_clip.scoring.llm import _sample_transcript_for_speaker_names
        lines = [f"Speaker 1: line {i}" for i in range(2000)]
        text = "\n".join(lines)
        sampled_lines = _sample_transcript_for_speaker_names(text, max_chars=2000).split("\n")
        line_numbers = [int(line.rsplit(" ", 1)[1]) for line in sampled_lines]
        assert line_numbers == sorted(line_numbers)

    def test_no_duplicate_lines_when_windows_overlap(self):
        from yuu_clip.scoring.llm import _sample_transcript_for_speaker_names
        text = "\n".join(self._long_transcript(num_lines=2000))
        sampled_lines = _sample_transcript_for_speaker_names(text, max_chars=100000).split("\n")
        assert len(sampled_lines) == len(set(sampled_lines))


# ---------------------------------------------------------------------------
# infer_speaker_names() / _SPEAKER_NAME_SYSTEM - B13
# ---------------------------------------------------------------------------

class TestSpeakerNameSystemPrompt:
    def test_mentions_third_person_introduction_patterns(self):
        from yuu_clip.scoring.llm import _SPEAKER_NAME_SYSTEM
        lowered = _SPEAKER_NAME_SYSTEM.lower()
        assert "welcome" in lowered
        assert "joining us" in lowered

    def test_still_mentions_direct_address_and_self_identification(self):
        from yuu_clip.scoring.llm import _SPEAKER_NAME_SYSTEM
        lowered = _SPEAKER_NAME_SYSTEM.lower()
        assert "i'm alex" in lowered
        assert "hey yuu" in lowered


class TestInferSpeakerNames:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_long_transcript_is_sampled_before_sending(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import infer_speaker_names
        lines = [f"Speaker 1: filler line number {i} of the session" for i in range(2000)]
        lines[-3] = "Speaker 2: joining us today is Dr. Alex"
        transcript = "\n".join(lines)
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            infer_speaker_names(transcript, self._cfg())
        user_content = captured["messages"][1]["content"]
        assert "joining us today is Dr. Alex" in user_content
        assert len(user_content) < len(transcript)

    def test_short_transcript_sent_unchanged(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import infer_speaker_names
        transcript = "Speaker 1: hey yuu, watch out\nSpeaker 2: nice shot"
        captured = {}
        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            captured["messages"] = messages
            return json.dumps({})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            infer_speaker_names(transcript, self._cfg())
        assert transcript in captured["messages"][1]["content"]

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

    def test_one_malformed_item_is_skipped_not_fatal(self):
        """find_related_clips now matches request_scene_boundaries/scan_hotwords_semantic:
        a single item missing "id" is skipped, not fatal to the whole batch."""
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": 7, "reason": "ok"}, {"reason": "missing id"}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref", [{"id": 7, "description": "d"}], self._cfg())
        assert result == [{"id": 7, "reason": "ok"}]


class TestDescribeClip:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_description_and_long(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import describe_clip
        payload = json.dumps({"description": "short", "description_long": "longer version"})
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            description, description_long = describe_clip("transcript", self._cfg())
        assert description == "short"
        assert description_long == "longer version"

    def test_non_dict_response_raises_value_error(self):
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import describe_clip
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps([1, 2])):
            with pytest.raises(ValueError):
                describe_clip("transcript", self._cfg())


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
