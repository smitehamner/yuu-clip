"""Image-based clip analysis (plan 11) — prompt assembly, vision clients,
capability gate, and the analyze-frames + include-frames routes."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _cfg(**overrides):
    from yuu_clip.config import Config
    cfg = Config()
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return cfg


# ---------------------------------------------------------------------------
# Prompt assembly — visual context block
# ---------------------------------------------------------------------------

class TestVisualBlock:
    def _block(self, summary):
        from yuu_clip.scoring.llm import _visual_block
        return _visual_block(summary)

    def test_empty_summary_yields_empty_block(self):
        assert self._block("") == ""

    def test_summary_wrapped_in_visual_context_block(self):
        block = self._block("A tense firefight in a warehouse.")
        assert "Visual context" in block
        assert "A tense firefight in a warehouse." in block

    def test_describe_clip_includes_visual_block(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import describe_clip
        captured = {}

        def fake_call(messages, config, temperature=0.1):
            captured["user"] = messages[1]["content"]
            return json.dumps({"description": "d", "description_long": "dl"})

        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            describe_clip("transcript", _cfg(), vision_summary="players open a vault door")
        assert "Visual context" in captured["user"]
        assert "players open a vault door" in captured["user"]

    def test_scorer_feeds_vision_summary_into_prompt(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(_cfg())
        captured = {}

        def fake_chat(messages, temperature=0.1):
            captured["user"] = messages[1]["content"]
            return json.dumps({"score_funny": 0.5})

        scorer._client.chat = fake_chat
        clip = mock.MagicMock()
        clip.id = 1
        clip.transcript_excerpt = "some words"
        clip.vision_summary = "a car chase through the city"
        scorer.score(clip, None)
        assert "a car chase through the city" in captured["user"]


# ---------------------------------------------------------------------------
# _clean_vision_summary
# ---------------------------------------------------------------------------

class TestCleanVisionSummary:
    def _clean(self, raw):
        from yuu_clip.scoring.llm import _clean_vision_summary
        return _clean_vision_summary(raw)

    def test_plain_text_stripped(self):
        assert self._clean("  A game scene.  ") == "A game scene."

    def test_json_reply_extracts_summary_field(self):
        assert self._clean('{"vision_summary": "on screen: a menu"}') == "on screen: a menu"

    def test_fenced_json_extracted(self):
        assert self._clean('```json\n{"vision_summary": "text"}\n```') == "text"

    def test_capped_length(self):
        out = self._clean("x" * 5000)
        assert len(out) == 1500


# ---------------------------------------------------------------------------
# describe_frames — delegates to the client's chat_vision
# ---------------------------------------------------------------------------

class TestDescribeFrames:
    def test_sends_user_prompt_and_returns_cleaned(self, monkeypatch, tmp_path):
        import yuu_clip.scoring.llm as llm_mod

        captured = {}

        class FakeClient:
            def chat_vision(self, messages, images, temperature=0.1):
                captured["messages"] = messages
                captured["images"] = images
                return "  A vault heist scene.  "

        monkeypatch.setattr(llm_mod, "make_client", lambda cfg: FakeClient())
        frames = [tmp_path / "a.jpg", tmp_path / "b.jpg"]
        result = llm_mod.describe_frames(frames, _cfg(), context_text="CTX")
        assert result == "A vault heist scene."
        # Instruction goes in the user turn (no system role — small vision models
        # ignore a system prompt), and world context is prepended.
        assert captured["messages"][0]["role"] == "user"
        assert captured["messages"][0]["content"].startswith("CTX")
        assert captured["images"] == frames


# ---------------------------------------------------------------------------
# check_vision_available — the capability gate routes use
# ---------------------------------------------------------------------------

class TestCheckVisionAvailable:
    def _check(self, **overrides):
        from yuu_clip.scoring.llm import check_vision_available
        return check_vision_available(_cfg(vision_enabled=True, ollama_enabled=True, **overrides))

    def test_llm_disabled(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(ollama_enabled=False, vision_enabled=True))
        assert ok is False and "disabled" in reason

    def test_vision_master_switch_off(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(ollama_enabled=True, vision_enabled=False))
        assert ok is False and "turned off" in reason

    def test_claude_needs_key(self):
        # remote_ok isolates the key check from the privacy-mode block (Stage 07).
        assert self._check(llm_backend="claude", claude_api_key="", ai_privacy_mode="remote_ok")[0] is False
        assert self._check(llm_backend="claude", claude_api_key="sk-x", ai_privacy_mode="remote_ok")[0] is True

    def test_ollama_needs_vision_model(self):
        assert self._check(llm_backend="ollama", ollama_model="llama3.1:8b")[0] is False
        assert self._check(llm_backend="ollama", ollama_model="moondream")[0] is True

    def test_llamacpp_needs_model_and_mmproj(self, tmp_path):
        model = tmp_path / "m.gguf"
        model.write_bytes(b"x")
        mmproj = tmp_path / "mm.gguf"
        mmproj.write_bytes(b"x")
        assert self._check(llm_backend="llamacpp", llm_model_path=str(model), llm_mmproj_path="")[0] is False
        assert self._check(
            llm_backend="llamacpp", llm_model_path=str(model), llm_mmproj_path=str(mmproj),
        )[0] is True

    def test_fresh_install_defaults_are_inactive_not_crashing(self):
        # Wave 6: vision_enabled defaults True, but a fresh install has no vision
        # model downloaded yet. The gate must degrade to "unavailable" with a
        # plain-English reason — never raise — so a first analyze is silent.
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import check_vision_available
        cfg = Config()
        assert cfg.vision_enabled is True
        ok, reason = check_vision_available(cfg)
        assert ok is False
        assert reason


# ---------------------------------------------------------------------------
# Vision client helpers + chat_vision behavior
# ---------------------------------------------------------------------------

class TestVisionClientHelpers:
    def test_base_chat_vision_raises_not_supported(self):
        from yuu_clip.scoring.llm_client import NullLLMClient, VisionNotSupportedError
        with pytest.raises(VisionNotSupportedError):
            NullLLMClient().chat_vision([{"role": "user", "content": "x"}], [Path("a.jpg")])

    def test_attach_images_to_last_user(self):
        from yuu_clip.scoring.llm_client import _attach_images_to_last_user
        msgs = [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}]
        out = _attach_images_to_last_user(msgs, ["b64a", "b64b"])
        assert out[1]["images"] == ["b64a", "b64b"]
        assert msgs[1].get("images") is None  # original untouched

    def test_attach_appends_user_when_none_present(self):
        from yuu_clip.scoring.llm_client import _attach_images_to_last_user
        out = _attach_images_to_last_user([{"role": "system", "content": "s"}], ["b64"])
        assert out[-1]["role"] == "user"
        assert out[-1]["images"] == ["b64"]

    def test_vision_num_ctx_scales_and_caps(self):
        from yuu_clip.scoring.llm_client import _vision_num_ctx
        assert _vision_num_ctx(1) == 4096
        assert _vision_num_ctx(4) == 10240
        assert _vision_num_ctx(50) == 16384  # capped

    def test_ollama_vision_degrades_on_context_overflow(self, monkeypatch, tmp_path):
        import unittest.mock as mock

        from yuu_clip.scoring.llm_client import OllamaClient
        for name in ("a.jpg", "b.jpg", "c.jpg", "d.jpg"):
            (tmp_path / name).write_bytes(b"x")
        images = [tmp_path / n for n in ("a.jpg", "b.jpg", "c.jpg", "d.jpg")]

        attempts = []

        def fake_chat(model, messages, options):
            n_images = len(messages[-1].get("images", []))
            attempts.append(n_images)
            if n_images > 2:
                raise RuntimeError('{"error":{"type":"exceed_context_size_error"}}')
            return mock.MagicMock(message=mock.MagicMock(content="described"))

        fake_client = mock.MagicMock()
        fake_client.chat.side_effect = fake_chat
        with mock.patch("ollama.Client", return_value=fake_client):
            result = OllamaClient(_cfg(ollama_model="moondream")).chat_vision(
                [{"role": "user", "content": "describe"}], images,
            )
        assert result == "described"
        assert attempts == [4, 2]  # retried with half the frames after the overflow

    def test_ollama_vision_uses_dedicated_vision_model(self, monkeypatch, tmp_path):
        import unittest.mock as mock

        from yuu_clip.scoring.llm_client import OllamaClient
        (tmp_path / "a.jpg").write_bytes(b"x")

        used_models = []

        def fake_chat(model, messages, options):
            used_models.append(model)
            return mock.MagicMock(message=mock.MagicMock(content="described"))

        fake_client = mock.MagicMock()
        fake_client.chat.side_effect = fake_chat
        cfg = _cfg(ollama_model="qwen2.5:7b", ollama_vision_model="moondream")
        with mock.patch("ollama.Client", return_value=fake_client):
            OllamaClient(cfg).chat_vision(
                [{"role": "user", "content": "describe"}], [tmp_path / "a.jpg"],
            )
        assert used_models == ["moondream"]  # vision slot, not the text model

    def test_ollama_vision_falls_back_to_text_model_when_unset(self, monkeypatch, tmp_path):
        import unittest.mock as mock

        from yuu_clip.scoring.llm_client import OllamaClient
        (tmp_path / "a.jpg").write_bytes(b"x")

        used_models = []

        def fake_chat(model, messages, options):
            used_models.append(model)
            return mock.MagicMock(message=mock.MagicMock(content="described"))

        fake_client = mock.MagicMock()
        fake_client.chat.side_effect = fake_chat
        cfg = _cfg(ollama_model="moondream", ollama_vision_model="")
        with mock.patch("ollama.Client", return_value=fake_client):
            OllamaClient(cfg).chat_vision(
                [{"role": "user", "content": "describe"}], [tmp_path / "a.jpg"],
            )
        assert used_models == ["moondream"]


class TestLlamaCppGpuOffload:
    """The installer ships a CUDA build for NVIDIA cards, so the client must offload
    to the GPU by default and fall back to CPU when that load fails."""

    def _fake_llama_module(self, monkeypatch, on_construct):
        import sys
        import types
        import unittest.mock as mock

        def factory(**kwargs):
            on_construct(kwargs)
            inst = mock.MagicMock()
            inst.create_chat_completion.return_value = {
                "choices": [{"message": {"content": "ok"}}]
            }
            return inst

        fake = types.ModuleType("llama_cpp")
        fake.Llama = factory
        monkeypatch.setitem(sys.modules, "llama_cpp", fake)

    def _chat(self, cfg):
        from yuu_clip.scoring.llm_client import LlamaCppClient
        return LlamaCppClient(cfg).chat([{"role": "user", "content": "x"}])

    def test_offloads_all_layers_when_gpu_enabled(self, monkeypatch):
        seen = []
        self._fake_llama_module(monkeypatch, lambda kw: seen.append(kw["n_gpu_layers"]))
        assert self._chat(_cfg(llm_model_path="m.gguf", llm_use_gpu=True)) == "ok"
        assert seen == [-1]

    def test_stays_on_cpu_when_gpu_disabled(self, monkeypatch):
        seen = []
        self._fake_llama_module(monkeypatch, lambda kw: seen.append(kw["n_gpu_layers"]))
        assert self._chat(_cfg(llm_model_path="m.gguf", llm_use_gpu=False)) == "ok"
        assert seen == [0]

    def test_falls_back_to_cpu_when_gpu_load_fails(self, monkeypatch):
        seen = []

        def on_construct(kwargs):
            seen.append(kwargs["n_gpu_layers"])
            if kwargs["n_gpu_layers"] == -1:
                raise RuntimeError("CUDA out of memory")

        self._fake_llama_module(monkeypatch, on_construct)
        assert self._chat(_cfg(llm_model_path="m.gguf", llm_use_gpu=True)) == "ok"
        assert seen == [-1, 0]  # tried GPU, then retried on CPU


# ---------------------------------------------------------------------------
# Routes — analyze-frames + rescore include_frames
# ---------------------------------------------------------------------------

def _enable_ollama_vision(client: TestClient):
    resp = client.patch("/api/config", json={
        "ollama_enabled": True, "llm_backend": "ollama",
        "ollama_model": "moondream", "vision_enabled": True,
    })
    assert resp.status_code == 200, resp.text


class TestAnalyzeFramesRoute:
    def test_no_vision_model_configured_returns_503(self, client: TestClient):
        # vision_enabled defaults True (Wave 6), but the default llm_backend
        # (llamacpp) has no model/mmproj path set, so it's inactive, not crashing.
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 503
        assert "vision projector" in resp.json()["detail"]

    def test_non_vision_model_returns_503(self, client: TestClient):
        client.patch("/api/config", json={
            "ollama_enabled": True, "llm_backend": "ollama",
            "ollama_model": "llama3.1:8b", "vision_enabled": True,
        })
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 503

    def test_missing_source_file_returns_404(self, client: TestClient):
        _enable_ollama_vision(client)
        # The seeded video path does not exist on disk.
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 404

    def test_success_stores_and_serializes_summary(
        self, client: TestClient, project_dir: Path, monkeypatch,
    ):
        import yuu_clip.analyze.frames as frames_mod
        _enable_ollama_vision(client)
        (project_dir / "session.mkv").write_bytes(b"x")  # make video.path exist
        monkeypatch.setattr(
            frames_mod, "sample_and_describe",
            lambda *a, **k: "On screen: two players defuse a bomb.",
        )
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["vision_summary"] == "On screen: two players defuse a bomb."
        assert body["vision_analyzed_at"]
        # Persisted + serialized on the clip.
        clip = client.get("/api/clips/1").json()
        assert clip["vision_summary"] == "On screen: two players defuse a bomb."
        assert clip["vision_analyzed_at"]

    def test_clip_deleted_mid_analysis_returns_404(
        self, client: TestClient, project_dir: Path, monkeypatch,
    ):
        # If the clip is deleted while the (seconds-long) vision call runs, the
        # save-back session finds nothing — that must be a clean 404, not a 500.
        import yuu_clip.analyze.frames as frames_mod
        from yuu_clip.db.models import ClipCandidate, make_session
        _enable_ollama_vision(client)
        (project_dir / "session.mkv").write_bytes(b"x")

        def delete_then_describe(*a, **k):
            session = make_session(project_dir / ".yuu-clip" / "project.db")
            session.delete(session.get(ClipCandidate, 1))
            session.commit()
            session.close()
            return "On screen: the clip is already gone."

        monkeypatch.setattr(frames_mod, "sample_and_describe", delete_then_describe)
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 404


class TestRescoreIncludeFrames:
    def test_include_frames_without_vision_model_returns_503(self, client: TestClient):
        # vision_enabled defaults True (Wave 6), but no vision-capable model is
        # configured by default → the batch checkbox path is refused up front.
        resp = client.get("/api/videos/1/rescore-clips?include_frames=1")
        assert resp.status_code == 503
