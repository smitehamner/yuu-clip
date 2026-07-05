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

        # A real mmproj file → vision ready.
        mmproj = project_dir / "mmproj.gguf"
        mmproj.write_bytes(b"gguf")
        _patch(client, llm_mmproj_path=str(mmproj))
        assert client.get("/api/llm/capabilities").json()["vision"] is True

    def test_ollama_text_model_and_vision_model(self, client: TestClient):
        _patch(client, ollama_enabled=True, llm_backend="ollama", ollama_model="qwen2.5:7b")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is False

        _patch(client, ollama_model="moondream")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is True and cap["vision"] is True

    def test_ollama_no_model_is_not_ready(self, client: TestClient):
        _patch(client, ollama_enabled=True, llm_backend="ollama", ollama_model="")
        cap = client.get("/api/llm/capabilities").json()
        assert cap["text"] is False and cap["vision"] is False


class TestOllamaPullGuard:
    def test_unknown_tag_is_rejected(self, client: TestClient):
        resp = client.post("/api/llm/ollama/pull", params={"tag": "evil:latest"})
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
        assert set(tiers) == {"similarity", "descriptions", "audio_events"}
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

    def test_audio_events_off_by_default(self, client: TestClient):
        tiers, _ = self._tiers(client)
        assert tiers["audio_events"]["active"] == "Off"
        assert tiers["audio_events"]["ready"] is False

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
