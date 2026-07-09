from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient


def _patch(client: TestClient, **fields):
    resp = client.patch("/api/config", json=fields)
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestCatalogRoute:
    def test_catalog_returns_only_recommended_models(self, client: TestClient):
        body = client.get("/api/llm/catalog").json()
        assert body["models"], "expected a non-empty catalog"
        assert all(m["recommended"] for m in body["models"])
        ids = {m["id"] for m in body["models"]}
        assert "llama-3.1-8b-instruct" not in ids  # rejected, must not be recommended

    def test_catalog_entries_are_well_formed(self, client: TestClient):
        for m in client.get("/api/llm/catalog").json()["models"]:
            assert m["licence"]
            assert m["kinds"]
            assert m["backends"]

    def test_llamacpp_vision_entry_active_matches_on_mmproj(self, client: TestClient, project_dir):
        # Regression: a llamacpp vision model must show as active when its projector
        # (mmproj) and vision model (gguf) are both configured, even though the text
        # base model differs. Previously only the text gguf was matched, so no vision
        # entry ever showed as active.
        vision = next(
            m for m in client.get("/api/llm/catalog").json()["models"]
            if "vision" in m["kinds"] and m["mmproj_filename"]
        )
        _patch(
            client, llm_backend="llamacpp",
            llm_vision_model_path=str(project_dir / vision["gguf_filename"]),
            llm_mmproj_path=str(project_dir / vision["mmproj_filename"]),
        )
        models = client.get("/api/llm/catalog").json()["models"]
        active = {m["id"] for m in models if m["active"]}
        assert vision["id"] in active

    def test_llamacpp_vision_entry_inactive_without_matching_mmproj(self, client: TestClient, project_dir):
        _patch(
            client, llm_backend="llamacpp",
            llm_mmproj_path=str(project_dir / "some-other-projector.gguf"),
        )
        models = client.get("/api/llm/catalog").json()["models"]
        assert not any(m["active"] for m in models if "vision" in m["kinds"] and m["mmproj_filename"])

    def test_llamacpp_vision_entry_inactive_when_only_mmproj_matches(self, client: TestClient, project_dir):
        # A stale projector alone (no matching vision model path) must not flag active.
        vision = next(
            m for m in client.get("/api/llm/catalog").json()["models"]
            if "vision" in m["kinds"] and m["mmproj_filename"]
        )
        _patch(
            client, llm_backend="llamacpp",
            llm_mmproj_path=str(project_dir / vision["mmproj_filename"]),
        )
        models = client.get("/api/llm/catalog").json()["models"]
        assert not any(m["id"] == vision["id"] and m["active"] for m in models)


class TestCapabilities:
    def test_disabled_llm_reports_nothing_available(self, client: TestClient):
        _patch(client, ollama_enabled=False)
        cap = client.get("/api/llm/capabilities").json()
        assert cap == {
            "backend": cap["backend"], "model": None,
            "text": False, "vision": False, "detail": cap["detail"],
        }
        assert cap["text"] is False and cap["vision"] is False

    def test_claude_requires_a_key_for_text_and_vision(self, client: TestClient):
        # remote_ok so the privacy-mode block isn't the reason under test (Stage 07).
        _patch(client, ollama_enabled=True, llm_backend="claude", claude_api_key="",
               ai_privacy_mode="remote_ok")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["backend"] == "claude"
        assert cap["text"] is False and cap["vision"] is False

        _patch(client, claude_api_key="sk-ant-test", claude_model="claude-haiku-4-5-20251001")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is True
        assert cap["model"] == "claude-haiku-4-5-20251001"

    def test_llamacpp_text_needs_a_present_file_vision_needs_mmproj(
        self, client: TestClient, project_dir: Path,
    ):
        # No path set → not ready.
        _patch(client, ollama_enabled=True, llm_backend="llamacpp",
               llm_model_path="", llm_mmproj_path="")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is False and cap["vision"] is False

        # A path that doesn't exist → still not ready.
        missing = str(project_dir / "nope.gguf")
        _patch(client, llm_model_path=missing)
        assert client.get("/api/llm/capabilities").json()["text"] is False

        # A real model file → text ready, but vision still off (no mmproj).
        model_file = project_dir / "model.gguf"
        model_file.write_bytes(b"gguf")
        _patch(client, llm_model_path=str(model_file))
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is False

        # A missing mmproj path → still no vision.
        _patch(client, llm_mmproj_path=str(project_dir / "nope-mmproj.gguf"))
        assert client.get("/api/llm/capabilities").json()["vision"] is False

        # A real mmproj file but no vision model path → still no vision (no fallback
        # to the text model path).
        mmproj = project_dir / "mmproj.gguf"
        mmproj.write_bytes(b"gguf")
        _patch(client, llm_mmproj_path=str(mmproj))
        assert client.get("/api/llm/capabilities").json()["vision"] is False

        # A real vision model file alongside the mmproj → vision ready.
        vision_model_file = project_dir / "vision-model.gguf"
        vision_model_file.write_bytes(b"gguf")
        _patch(client, llm_vision_model_path=str(vision_model_file))
        assert client.get("/api/llm/capabilities").json()["vision"] is True

    def test_ollama_text_model_and_vision_model(self, client: TestClient):
        _patch(client, ollama_enabled=True, llm_backend="ollama", ollama_model="qwen2.5:7b")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is False

        _patch(client, ollama_model="qwen2.5vl:7b")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is True

    def test_ollama_separate_vision_model_enables_vision(self, client: TestClient):
        # A text-only text model plus a vision model in the dedicated slot is ready
        # for both, without forcing the text model to also be vision-capable.
        _patch(client, ollama_enabled=True, llm_backend="ollama",
               ollama_model="qwen2.5:7b", ollama_vision_model="qwen2.5vl:7b")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is True
        assert cap["model"] == "qwen2.5:7b"  # text model still reported

    def test_ollama_text_only_vision_model_leaves_vision_off(self, client: TestClient):
        _patch(client, ollama_enabled=True, llm_backend="ollama",
               ollama_model="moondream", ollama_vision_model="qwen2.5:7b")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["vision"] is False  # the vision slot overrides the model for vision

    def test_ollama_no_model_is_not_ready(self, client: TestClient):
        _patch(client, ollama_enabled=True, llm_backend="ollama", ollama_model="")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is False and cap["vision"] is False


class TestModuleFindable:
    """The tier tests above monkeypatch module_findable; these pin its real
    behavior so the monkeypatch can never mask a regression. Its whole reason to
    exist is the dotted-parent-absent case: find_spec raises ModuleNotFoundError
    (not returns None) when a dotted name's parent package is entirely missing,
    which must still read as 'not installed', not crash the tiers route."""

    def test_true_for_a_present_top_level_module(self):
        from yuu_clip.web.routes.common import module_findable
        assert module_findable("os") is True

    def test_true_for_a_present_dotted_submodule(self):
        from yuu_clip.web.routes.common import module_findable
        assert module_findable("os.path") is True

    def test_false_for_an_absent_top_level_module(self):
        from yuu_clip.web.routes.common import module_findable
        assert module_findable("yuu_clip_no_such_module_xyz") is False

    def test_false_for_a_dotted_name_whose_parent_is_absent(self):
        from yuu_clip.web.routes.common import module_findable
        assert module_findable("yuu_clip_no_such_module_xyz.submodule") is False


class TestOllamaPullGuard:
    def test_unknown_tag_is_rejected(self, client: TestClient):
        resp = client.post("/api/llm/ollama/pull", params={"tag": "evil:latest"})
        assert resp.status_code == 400


class TestOllamaPullDiskPrecheck:
    def _low_disk(self, monkeypatch, free_bytes: int):
        import shutil as shutil_mod
        from unittest import mock

        from yuu_clip.web.routes import llm as llm_routes

        monkeypatch.setattr(shutil_mod, "disk_usage", lambda _p: mock.MagicMock(free=free_bytes))
        return llm_routes

    def test_preflight_reports_shortfall(self, monkeypatch):
        llm_routes = self._low_disk(monkeypatch, 1_000_000_000)  # 1 GB free
        info = llm_routes._preflight_ollama_pull("qwen2.5:7b")
        assert info["sufficient"] is False
        assert info["needed_gb"] > info["free_gb"]

    def test_preflight_ok_with_ample_space(self, monkeypatch):
        llm_routes = self._low_disk(monkeypatch, 500_000_000_000)  # 500 GB free
        info = llm_routes._preflight_ollama_pull("qwen2.5:7b")
        assert info["sufficient"] is True

    def test_insufficient_disk_returns_507_before_spawning(self, client: TestClient, monkeypatch):
        self._low_disk(monkeypatch, 1_000_000_000)
        resp = client.post("/api/llm/ollama/pull", params={"tag": "qwen2.5:7b"})
        assert resp.status_code == 507
        assert "disk space" in resp.json()["detail"].lower()


class TestDownloadStatus:
    """The background local-model handoff surface (first-run-friction Stage 4):
    the boot banner reads pending + in-progress state here, and clears the pending
    flag (reloading config so a finished download's llm_model_path lands) after a
    success or a cancel."""

    def test_status_reports_empty_when_nothing_pending(self, client: TestClient):
        body = client.get("/api/llm/download-status").json()
        assert body["pending_model_id"] == ""
        assert body["downloading"] is False
        assert body["downloading_model_id"] is None
        # The generalized read surface also reports the speech-model download state
        # (first-run-friction Stage 6); nothing is downloading here. whisper_cached
        # reflects the real HF cache, so it isn't asserted (env-dependent).
        assert body["whisper_downloading"] is False
        assert body["whisper_model_id"] is None
        assert body["speaker_downloading"] is False
        assert body["model_prefetch_disabled"] is False

    def test_status_reports_pending_model(self, client: TestClient):
        client.app.state.ctx.config.pending_local_model = "qwen2.5-7b-instruct"
        body = client.get("/api/llm/download-status").json()
        assert body["pending_model_id"] == "qwen2.5-7b-instruct"
        assert body["downloading"] is False

    def test_status_reflects_in_progress_download(self, client: TestClient):
        client.app.state.ctx.model_downloads["llm"] = "qwen2.5-7b-instruct"
        body = client.get("/api/llm/download-status").json()
        assert body["downloading"] is True
        assert body["downloading_model_id"] == "qwen2.5-7b-instruct"

    def test_clear_empties_pending_and_reloads_config_from_disk(
        self, client: TestClient, project_dir: Path,
    ):
        ctx = client.app.state.ctx
        # Simulate the download subprocess having written llm_model_path to disk
        # while pending is still set from the wizard.
        model_file = project_dir / "downloaded.gguf"
        model_file.write_bytes(b"gguf")
        ctx.config.pending_local_model = "qwen2.5-7b-instruct"
        ctx.config.llm_model_path = str(model_file)
        ctx.config.save_project(project_dir)
        # In-memory config is now stale (a restart would be needed without reload).
        ctx.config.llm_model_path = "/stale/in-memory/path"

        resp = client.post("/api/llm/download-status/clear")
        assert resp.status_code == 200
        assert resp.json()["pending_model_id"] == ""
        # Reloaded from disk: the subprocess's llm_model_path is now live, and the
        # pending flag is cleared both in memory and on disk.
        assert ctx.config.llm_model_path == str(model_file)
        assert ctx.config.pending_local_model == ""
        from yuu_clip.config import Config
        assert Config.load(project_dir).pending_local_model == ""


class TestGgufDownloadGuard:
    def test_double_start_is_rejected_with_409(self, client: TestClient):
        client.app.state.ctx.model_downloads["llm"] = "qwen2.5-7b-instruct"
        resp = client.post(
            "/api/llm/gguf/download", params={"model_id": "qwen2.5-7b-instruct"}
        )
        assert resp.status_code == 409
        assert "already in progress" in resp.json()["detail"].lower()

    def test_unknown_model_id_is_rejected_with_400(self, client: TestClient):
        resp = client.post("/api/llm/gguf/download", params={"model_id": "evil-model"})
        assert resp.status_code == 400


class TestCapabilityTiers:
    def _tiers(self, client: TestClient) -> tuple[dict, bool]:
        resp = client.get("/api/capabilities/tiers")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        return {t["id"]: t for t in body["tiers"]}, body["lightweight"]

    def test_no_model_reports_lightweight_and_basic_descriptions(self, client: TestClient):
        _patch(client, ollama_enabled=False)
        tiers, lightweight = self._tiers(client)
        assert lightweight is True
        assert set(tiers) == {
            "similarity", "descriptions", "speaker_labels", "audio_events", "vertical_framing",
        }
        assert tiers["descriptions"]["active"] == "Basic (template)"
        assert tiers["descriptions"]["ready"] is False

    def test_similarity_defaults_to_fast_keyword(self, client: TestClient):
        _patch(client, ollama_enabled=False, similarity_backend="tfidf")
        tiers, _ = self._tiers(client)
        assert tiers["similarity"]["active"] == "Fast (keyword)"

    def test_llm_similarity_falls_back_when_no_model(self, client: TestClient):
        # 'llm' selected but no model ready → active tier honestly reports the fallback.
        _patch(client, ollama_enabled=False, similarity_backend="llm")
        tiers, _ = self._tiers(client)
        assert tiers["similarity"]["active"] == "Fast (keyword)"

    def test_similarity_not_ready_when_fastembed_missing(self, client: TestClient, monkeypatch):
        # When fastembed can't be imported the embeddings tier is not-ready and has
        # nothing to prefetch (a click would just fail the same way). Mock the
        # absence at availability() so the test holds on a correctly-synced venv
        # where fastembed is actually installed.
        from yuu_clip.scoring.similarity import EmbeddingsBackend

        monkeypatch.setattr(EmbeddingsBackend, "availability", lambda self: (False, "fastembed not installed"))
        tiers, _ = self._tiers(client)
        assert tiers["similarity"]["ready"] is False
        assert tiers["similarity"]["prefetch_slug"] is None

    def test_similarity_offers_prefetch_when_package_ready_but_model_not_cached(
        self, client: TestClient, monkeypatch,
    ):
        from yuu_clip.scoring.similarity import EmbeddingsBackend

        monkeypatch.setattr(EmbeddingsBackend, "availability", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.similarity.embeddings_model_cached", lambda: False)
        tiers, _ = self._tiers(client)
        assert tiers["similarity"]["ready"] is False
        assert tiers["similarity"]["prefetch_slug"] == "embeddings"
        assert "downloads automatically" in tiers["similarity"]["detail"]

    def test_similarity_ready_and_no_prefetch_when_model_cached(self, client: TestClient, monkeypatch):
        from yuu_clip.scoring.similarity import EmbeddingsBackend

        monkeypatch.setattr(EmbeddingsBackend, "availability", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.similarity.embeddings_model_cached", lambda: True)
        tiers, _ = self._tiers(client)
        assert tiers["similarity"]["ready"] is True
        assert tiers["similarity"]["prefetch_slug"] is None
        assert tiers["similarity"]["detail"] == "The Smart (embeddings) engine is ready."

    def test_audio_events_reports_off_when_model_deps_unavailable(self, client: TestClient, monkeypatch):
        # Audio-event scoring is ON by default post-Wave-2 (asserted in
        # test_config.py); the tier still reports "Off"/not-ready when the scorer's
        # deps (transformers/torch) can't load, so availability() is False. Mock
        # that degradation state rather than relying on a venv missing the bundled
        # packages. No deps -> nothing to prefetch either.
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "availability", lambda self: (False, "model deps unavailable"))
        tiers, _ = self._tiers(client)
        assert tiers["audio_events"]["active"] == "Off"
        assert tiers["audio_events"]["ready"] is False
        assert tiers["audio_events"]["prefetch_slug"] is None

    def test_audio_events_offers_prefetch_when_deps_ready_but_model_not_cached(self, client: TestClient, monkeypatch):
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "availability", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: False)
        tiers, _ = self._tiers(client)
        assert tiers["audio_events"]["ready"] is False
        assert tiers["audio_events"]["prefetch_slug"] == "audio_event"
        assert "downloads automatically" in tiers["audio_events"]["detail"]

    def test_audio_events_ready_and_no_prefetch_when_model_cached(self, client: TestClient, monkeypatch):
        from yuu_clip.scoring.audio_event import AudioEventScorer

        monkeypatch.setattr(AudioEventScorer, "availability", lambda self: (True, ""))
        monkeypatch.setattr("yuu_clip.scoring.audio_event.audio_event_model_cached", lambda model_id: True)
        tiers, _ = self._tiers(client)
        assert tiers["audio_events"]["ready"] is True
        assert tiers["audio_events"]["prefetch_slug"] is None
        assert tiers["audio_events"]["detail"] == "Audio-event detection is on and ready."

    def test_ready_llamacpp_model_flips_descriptions_and_lightweight(
        self, client: TestClient, project_dir: Path,
    ):
        model_file = project_dir / "model.gguf"
        model_file.write_bytes(b"gguf")
        _patch(client, ollama_enabled=True, llm_backend="llamacpp",
               llm_model_path=str(model_file), llm_mmproj_path="")
        tiers, lightweight = self._tiers(client)
        assert lightweight is False
        assert tiers["descriptions"]["active"] == "AI (language model)"
        assert tiers["descriptions"]["ready"] is True

    # ── packaging-strategy overhaul (Wave 3): bundled tiers never offer an
    # install action anymore - install_slug is always None for them.
    def test_similarity_and_audio_events_never_offer_install(self, client: TestClient):
        tiers, _ = self._tiers(client)
        assert tiers["similarity"]["install_slug"] is None
        assert tiers["audio_events"]["install_slug"] is None

    def test_speaker_labels_off_reports_ready(self, client: TestClient):
        _patch(client, diarization_backend="null")
        tiers, _ = self._tiers(client)
        assert tiers["speaker_labels"]["active"] == "Off"
        assert tiers["speaker_labels"]["ready"] is True
        assert tiers["speaker_labels"]["install_slug"] is None

    def test_speaker_labels_speechbrain_never_offers_install(self, client: TestClient, monkeypatch):
        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client.speechbrain_model_cached",
            lambda: False,
        )
        _patch(client, diarization_backend="speechbrain")
        tiers, _ = self._tiers(client)
        assert tiers["speaker_labels"]["active"] == "SpeechBrain"
        assert tiers["speaker_labels"]["ready"] is False
        assert tiers["speaker_labels"]["install_slug"] is None
        assert tiers["speaker_labels"]["prefetch_slug"] == "speaker"
        assert "downloads automatically" in tiers["speaker_labels"]["detail"]

    def test_speaker_labels_speechbrain_ready_when_model_cached(self, client: TestClient, monkeypatch):
        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client.speechbrain_model_cached",
            lambda: True,
        )
        _patch(client, diarization_backend="speechbrain")
        tiers, _ = self._tiers(client)
        assert tiers["speaker_labels"]["ready"] is True
        assert tiers["speaker_labels"]["prefetch_slug"] is None
        assert tiers["speaker_labels"]["detail"] == "Ready."

    def test_speaker_labels_pyannote_not_installed_offers_install(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("yuu_clip.web.routes.llm.module_findable", lambda name: False)
        _patch(client, diarization_backend="pyannote", huggingface_token="")
        tiers, _ = self._tiers(client)
        assert tiers["speaker_labels"]["active"] == "Pyannote (advanced)"
        assert tiers["speaker_labels"]["ready"] is False
        assert tiers["speaker_labels"]["install_slug"] == "pyannote"

    def test_speaker_labels_pyannote_installed_needs_token(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("yuu_clip.web.routes.llm.module_findable", lambda name: True)
        _patch(client, diarization_backend="pyannote", huggingface_token="")
        tiers, _ = self._tiers(client)
        assert tiers["speaker_labels"]["ready"] is False
        assert tiers["speaker_labels"]["install_slug"] is None
        assert "token" in tiers["speaker_labels"]["detail"].lower()

    def test_vertical_framing_never_offers_install(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("yuu_clip.web.routes.llm.module_findable", lambda name: False)
        tiers, _ = self._tiers(client)
        assert tiers["vertical_framing"]["active"] == "Unavailable"
        assert tiers["vertical_framing"]["ready"] is False
        assert tiers["vertical_framing"]["install_slug"] is None

    def test_vertical_framing_ready_when_model_cached(self, client: TestClient, monkeypatch):
        monkeypatch.setattr(
            "yuu_clip.web.routes.llm.module_findable",
            lambda name: True,
        )
        monkeypatch.setattr(
            "yuu_clip.analyze.framing.face_model_cached",
            lambda: True,
        )
        tiers, _ = self._tiers(client)
        assert tiers["vertical_framing"]["active"] == "Available"
        assert tiers["vertical_framing"]["ready"] is True

    # ── packaging-strategy overhaul (Wave 4): the GGUF/Ollama model and the
    # sub-second BlazeFace asset keep their own download flows - never a
    # "Download now" button from this generic Tier-B prefetch mechanism.
    def test_descriptions_and_vertical_framing_never_offer_prefetch(self, client: TestClient):
        tiers, _ = self._tiers(client)
        assert tiers["descriptions"]["prefetch_slug"] is None
        assert tiers["vertical_framing"]["prefetch_slug"] is None
