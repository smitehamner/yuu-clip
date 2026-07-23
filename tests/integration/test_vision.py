"""Image-based clip analysis (plan 11) - prompt assembly, vision clients,
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
# Prompt assembly - visual context block
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

        def fake_call(messages, config, temperature=0.1, max_tokens=None):
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
# describe_frames - delegates to the client's chat_vision
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
        # Instruction goes in the user turn (no system role - small vision models
        # ignore a system prompt), and world context is prepended.
        assert captured["messages"][0]["role"] == "user"
        assert captured["messages"][0]["content"].startswith("CTX")
        assert captured["images"] == frames


# ---------------------------------------------------------------------------
# check_vision_available - the capability gate routes use
# ---------------------------------------------------------------------------

class TestCheckVisionAvailable:
    def _check(self, **overrides):
        from yuu_clip.scoring.llm import check_vision_available
        return check_vision_available(_cfg(vision_enabled=True, llm_enabled=True, **overrides))

    def test_llm_disabled(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(llm_enabled=False, vision_enabled=True))
        assert ok is False and "disabled" in reason

    def test_vision_master_switch_off(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(_cfg(llm_enabled=True, vision_enabled=False))
        assert ok is False and "turned off" in reason

    def test_generative_ai_off_blocks_vision(self):
        from yuu_clip.scoring.llm import check_vision_available
        ok, reason = check_vision_available(
            _cfg(llm_enabled=True, vision_enabled=True, ai_privacy_mode="none"))
        assert ok is False and "generative ai is turned off" in reason.lower()

    def test_llamacpp_needs_vision_model_and_mmproj(self, tmp_path):
        vision_model = tmp_path / "m.gguf"
        vision_model.write_bytes(b"x")
        mmproj = tmp_path / "mm.gguf"
        mmproj.write_bytes(b"x")
        assert self._check(
            llm_backend="llamacpp", llm_vision_model_path=str(vision_model), llm_mmproj_path="",
        )[0] is False
        assert self._check(
            llm_backend="llamacpp", llm_vision_model_path=str(vision_model), llm_mmproj_path=str(mmproj),
        )[0] is True

    def test_llamacpp_text_model_alone_does_not_enable_vision(self, tmp_path):
        # llm_model_path (text) must never satisfy the vision gate - no fallback.
        model = tmp_path / "m.gguf"
        model.write_bytes(b"x")
        mmproj = tmp_path / "mm.gguf"
        mmproj.write_bytes(b"x")
        assert self._check(
            llm_backend="llamacpp", llm_model_path=str(model), llm_mmproj_path=str(mmproj),
        )[0] is False

    def test_fresh_install_defaults_are_inactive_not_crashing(self):
        # Wave 6: vision_enabled defaults True, but a fresh install has no vision
        # model downloaded yet. The gate must degrade to "unavailable" with a
        # plain-English reason - never raise - so a first analyze is silent.
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


class _FakePool:
    """Stands in for the llama-server pool: records the chat_completion kwargs so tests
    can assert the text/vision split, and returns a canned reply."""

    def __init__(self, reply="a scene"):
        self.reply = reply
        self.calls: list[dict] = []

    def chat_completion(self, config, **kwargs):
        self.calls.append(kwargs)
        return self.reply


def _patch_pool(monkeypatch, pool):
    monkeypatch.setattr(
        "yuu_clip.scoring.llamacpp_server.get_server_pool", lambda: pool,
    )


class TestLlamaCppChatVision:
    """chat_vision must route to llm_vision_model_path (never llm_model_path) with the
    projector, and refuse with no fallback when the vision model is unset."""

    def test_uses_vision_model_path_not_text_model_path(self, monkeypatch, tmp_path):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient
        vision_model = tmp_path / "vision.gguf"
        vision_model.write_bytes(b"x")
        mmproj = tmp_path / "mm.gguf"
        mmproj.write_bytes(b"x")
        image = tmp_path / "a.jpg"
        image.write_bytes(b"x")
        pool = _FakePool()
        _patch_pool(monkeypatch, pool)
        cfg = _cfg(
            llm_backend="llamacpp", llm_model_path="text-model-should-not-be-used.gguf",
            llm_vision_model_path=str(vision_model), llm_mmproj_path=str(mmproj),
        )
        result = LlamaCppServerClient(cfg).chat_vision(
            [{"role": "user", "content": "describe"}], [image],
        )
        assert result == "a scene"
        assert pool.calls[0]["model_path"] == str(vision_model)
        assert pool.calls[0]["mmproj_path"] == str(mmproj)

    def test_raises_when_vision_model_path_empty_even_with_mmproj_set(self, tmp_path):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient, VisionNotSupportedError
        mmproj = tmp_path / "mm.gguf"
        mmproj.write_bytes(b"x")
        cfg = _cfg(
            llm_backend="llamacpp", llm_vision_model_path="", llm_mmproj_path=str(mmproj),
        )
        with pytest.raises(VisionNotSupportedError):
            LlamaCppServerClient(cfg).chat_vision(
                [{"role": "user", "content": "describe"}], [tmp_path / "a.jpg"],
            )


class TestLlamaCppServerTextChat:
    """Text chat routes to llm_model_path with no projector (mmproj_path empty), keeping
    the text and vision towers independent."""

    def test_text_chat_uses_text_model_and_no_mmproj(self, monkeypatch):
        from yuu_clip.scoring.llm_client import LlamaCppServerClient
        pool = _FakePool(reply="ok")
        _patch_pool(monkeypatch, pool)
        cfg = _cfg(llm_backend="llamacpp", llm_model_path="text.gguf")
        result = LlamaCppServerClient(cfg).chat([{"role": "user", "content": "x"}])
        assert result == "ok"
        assert pool.calls[0]["model_path"] == "text.gguf"
        assert pool.calls[0]["mmproj_path"] == ""


# ---------------------------------------------------------------------------
# Routes - analyze-frames + rescore include_frames
# ---------------------------------------------------------------------------

def _enable_llamacpp_vision(client: TestClient, project_dir: Path):
    vision_model = project_dir / "vision.gguf"
    vision_model.write_bytes(b"x")
    mmproj = project_dir / "mmproj.gguf"
    mmproj.write_bytes(b"x")
    resp = client.patch("/api/config", json={
        "llm_enabled": True, "llm_backend": "llamacpp",
        "llm_vision_model_path": str(vision_model), "llm_mmproj_path": str(mmproj),
        "vision_enabled": True,
    })
    assert resp.status_code == 200, resp.text


class TestAnalyzeFramesRoute:
    def test_no_vision_model_configured_returns_503(self, client: TestClient):
        # vision_enabled defaults True (Wave 6), but the default llm_backend
        # (llamacpp) has no model/mmproj path set, so it's inactive, not crashing.
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 503
        assert "vision projector" in resp.json()["detail"]

    def test_text_only_model_returns_503(self, client: TestClient):
        # A text model set but no vision model/projector → image analysis is refused.
        client.patch("/api/config", json={
            "llm_enabled": True, "llm_backend": "llamacpp",
            "llm_model_path": "text.gguf", "llm_vision_model_path": "", "llm_mmproj_path": "",
            "vision_enabled": True,
        })
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 503

    def test_missing_source_file_returns_404(self, client: TestClient, project_dir: Path):
        _enable_llamacpp_vision(client, project_dir)
        # The seeded video path does not exist on disk.
        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 404

    def test_launches_killable_subprocess_with_warm_server_url(
        self, client: TestClient, project_dir: Path, monkeypatch,
    ):
        # The route now ensures the web server's warm vision llama-server, hands its
        # base URL to a killable subprocess (pipeline/frame_analysis.py), and streams
        # it via subprocess_sse with the frames cancel flag. Assert that wiring rather
        # than running a real subprocess/server.
        import yuu_clip.web.routes.clips.edit as edit_mod
        _enable_llamacpp_vision(client, project_dir)
        (project_dir / "session.mkv").write_bytes(b"x")  # make video.path exist

        class _FakePool:
            def ensure_server_url(self, config, *, model_path, mmproj_path):
                return "http://127.0.0.1:9931"

        monkeypatch.setattr(
            "yuu_clip.scoring.llamacpp_server.get_server_pool", lambda: _FakePool()
        )
        captured: dict = {}

        async def fake_subprocess_sse(cmd, cwd, ctx=None, **kwargs):
            from starlette.responses import StreamingResponse
            captured["cmd"] = cmd
            captured["kwargs"] = kwargs

            async def _gen():
                yield 'data: "__DONE__"\n\n'

            return StreamingResponse(_gen(), media_type="text/event-stream")

        monkeypatch.setattr(edit_mod, "subprocess_sse", fake_subprocess_sse)

        resp = client.post("/api/clips/1/analyze-frames")
        assert resp.status_code == 200, resp.text
        cmd = captured["cmd"]
        assert "yuu_clip.pipeline.frame_analysis" in cmd
        assert cmd[cmd.index("--clip-id") + 1] == "1"
        assert cmd[cmd.index("--base-url") + 1] == "http://127.0.0.1:9931"
        assert captured["kwargs"]["cancel_flag_attr"] == "frames_cancelled"
        assert captured["kwargs"]["track_active_job"] is True


class TestRunFrameAnalysis:
    """The killable subprocess entry point: samples frames, describes them against the
    handed-off warm server, stores the summary, and emits progress markers."""

    def test_stores_summary_and_emits_progress(
        self, project_dir: Path, monkeypatch, capsys,
    ):
        import yuu_clip.analyze.frames as frames_mod
        import yuu_clip.pipeline.frame_analysis as fa
        import yuu_clip.scoring.llm as llm_mod
        from yuu_clip.db.models import ClipCandidate, make_session
        (project_dir / "session.mkv").write_bytes(b"x")
        monkeypatch.setattr(frames_mod, "sample_clip_frames", lambda *a, **k: [project_dir / "f1.jpg"])
        monkeypatch.setattr(
            llm_mod, "describe_frames_via_server",
            lambda *a, **k: "On screen: two players defuse a bomb.",
        )
        assert fa.run_frame_analysis(1, project_dir, "http://127.0.0.1:1") == 0
        out = capsys.readouterr().out
        assert "@@PROGRESS" in out           # marker-driven progress for the job header
        assert "Analyzed 1 frame(s)" in out  # success line (not bracketed - no toast)
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            clip = session.get(ClipCandidate, 1)
            assert clip.vision_summary == "On screen: two players defuse a bomb."
            assert clip.vision_analyzed_at is not None
        finally:
            session.close()

    def test_no_frames_sampled_emits_error_line(self, project_dir: Path, monkeypatch, capsys):
        import yuu_clip.analyze.frames as frames_mod
        import yuu_clip.pipeline.frame_analysis as fa
        (project_dir / "session.mkv").write_bytes(b"x")
        monkeypatch.setattr(frames_mod, "sample_clip_frames", lambda *a, **k: [])
        assert fa.run_frame_analysis(1, project_dir, "http://x") == 0
        assert "could not sample any frames" in capsys.readouterr().out

    def test_vision_call_failure_reports_bracketed_line(self, project_dir: Path, monkeypatch, capsys):
        import yuu_clip.analyze.frames as frames_mod
        import yuu_clip.pipeline.frame_analysis as fa
        import yuu_clip.scoring.llm as llm_mod
        (project_dir / "session.mkv").write_bytes(b"x")
        monkeypatch.setattr(frames_mod, "sample_clip_frames", lambda *a, **k: [project_dir / "f1.jpg"])

        def _boom(*a, **k):
            raise RuntimeError("connection refused")

        monkeypatch.setattr(llm_mod, "describe_frames_via_server", _boom)
        assert fa.run_frame_analysis(1, project_dir, "http://x") == 0
        assert "[Image analysis failed" in capsys.readouterr().out

    def test_clip_deleted_mid_analysis_skips_save_cleanly(
        self, project_dir: Path, monkeypatch,
    ):
        # If the clip is deleted while the vision call runs, the save-back session
        # finds nothing and skips silently - the run still returns success.
        import yuu_clip.analyze.frames as frames_mod
        import yuu_clip.pipeline.frame_analysis as fa
        import yuu_clip.scoring.llm as llm_mod
        from yuu_clip.db.models import ClipCandidate, make_session
        (project_dir / "session.mkv").write_bytes(b"x")

        def delete_then_describe(*a, **k):
            session = make_session(project_dir / ".yuu-clip" / "project.db")
            session.delete(session.get(ClipCandidate, 1))
            session.commit()
            session.close()
            return "On screen: the clip is already gone."

        monkeypatch.setattr(frames_mod, "sample_clip_frames", lambda *a, **k: [project_dir / "f1.jpg"])
        monkeypatch.setattr(llm_mod, "describe_frames_via_server", delete_then_describe)
        assert fa.run_frame_analysis(1, project_dir, "http://x") == 0

        session = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            assert session.get(ClipCandidate, 1) is None
        finally:
            session.close()


class TestCancelAnalyzeFrames:
    def test_cancel_sets_flag_and_terminates_the_proc(self, client: TestClient, monkeypatch):
        from types import SimpleNamespace

        from yuu_clip.web.routes.clips import edit as edit_mod
        terminated: list = []

        async def fake_terminate(proc):
            terminated.append(proc)

        monkeypatch.setattr(edit_mod, "terminate_process_tree_async", fake_terminate)
        ctx = client.app.state.ctx
        ctx.frames_cancelled = False
        ctx.analyze_proc = SimpleNamespace(returncode=None, pid=4242)
        ctx.analyze_proc_kind = "frames"

        resp = client.post("/api/clips/1/analyze-frames/cancel")
        assert resp.status_code == 200
        assert resp.json() == {"status": "cancelled"}
        assert ctx.frames_cancelled is True
        assert terminated == [ctx.analyze_proc]

    def test_cancel_is_a_noop_when_nothing_is_running(self, client: TestClient):
        client.app.state.ctx.analyze_proc = None
        resp = client.post("/api/clips/1/analyze-frames/cancel")
        assert resp.status_code == 200
        assert resp.json() == {"status": "cancelled"}
        assert client.app.state.ctx.frames_cancelled is False

    def test_cancel_does_not_kill_a_different_jobs_proc(self, client: TestClient, monkeypatch):
        """A stale/cross-tab cancel click must not kill an unrelated running job just
        because it happens to hold the shared analyze_proc slot (bug-hunt 2.2)."""
        from types import SimpleNamespace

        from yuu_clip.web.routes.clips import edit as edit_mod
        terminated: list = []

        async def fake_terminate(proc):
            terminated.append(proc)

        monkeypatch.setattr(edit_mod, "terminate_process_tree_async", fake_terminate)
        ctx = client.app.state.ctx
        ctx.frames_cancelled = False
        ctx.analyze_proc = SimpleNamespace(returncode=None, pid=9999)
        ctx.analyze_proc_kind = "export"  # some other job owns the slot

        resp = client.post("/api/clips/1/analyze-frames/cancel")
        assert resp.status_code == 200
        assert terminated == []
        assert ctx.frames_cancelled is False
        assert ctx.analyze_proc is not None  # the other job's proc survives


class TestVisionServerHelpers:
    def test_vision_payload_messages_attaches_images_to_user_turn(self, tmp_path):
        from yuu_clip.scoring.llm_client import vision_payload_messages
        img = tmp_path / "a.jpg"
        img.write_bytes(b"x")
        messages = vision_payload_messages(
            [{"role": "system", "content": "SYS"}, {"role": "user", "content": "describe"}],
            [img],
        )
        assert messages[0] == {"role": "system", "content": "SYS"}
        user = messages[-1]
        assert user["role"] == "user"
        assert user["content"][0] == {"type": "text", "text": "describe"}
        assert user["content"][1]["type"] == "image_url"
        assert user["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")

    def test_describe_frames_via_server_posts_and_cleans(self, monkeypatch, tmp_path):
        import yuu_clip.scoring.llm as llm_mod
        captured: dict = {}

        def fake_post(base_url, payload, timeout=600.0):
            captured["base_url"] = base_url
            captured["payload"] = payload
            return {"choices": [{"message": {"content": "  A vault heist.  "}}]}

        monkeypatch.setattr("yuu_clip.scoring.llamacpp_server.post_chat_completion", fake_post)
        frames = [tmp_path / "a.jpg"]
        (tmp_path / "a.jpg").write_bytes(b"x")
        result = llm_mod.describe_frames_via_server(frames, "CTX", "http://127.0.0.1:5")
        assert result == "A vault heist."  # cleaned/stripped
        assert captured["base_url"] == "http://127.0.0.1:5"
        # World context is prepended to the user prompt text.
        assert captured["payload"]["messages"][-1]["content"][0]["text"].startswith("CTX")


class TestRescoreIncludeFrames:
    def test_include_frames_without_vision_model_returns_503(self, client: TestClient):
        # vision_enabled defaults True (Wave 6), but no vision-capable model is
        # configured by default → the batch checkbox path is refused up front.
        resp = client.get("/api/videos/1/rescore-clips?include_frames=1")
        assert resp.status_code == 503
