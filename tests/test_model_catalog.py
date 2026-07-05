from __future__ import annotations

from yuu_clip import model_catalog as mc


class TestCatalogIntegrity:
    def test_every_entry_has_kind_licence_and_a_backend(self):
        for entry in mc.CATALOG:
            assert entry.kinds, f"{entry.id} has no kinds"
            assert entry.kinds <= {"text", "vision"}, f"{entry.id} has an unknown kind"
            assert entry.licence, f"{entry.id} has no licence"
            assert entry.backends, f"{entry.id} has no backend"
            assert entry.backends <= {
                mc.BACKEND_OLLAMA, mc.BACKEND_LLAMACPP, mc.BACKEND_CLAUDE,
            }, f"{entry.id} has an unknown backend"

    def test_ids_are_unique(self):
        ids = [entry.id for entry in mc.CATALOG]
        assert len(ids) == len(set(ids))

    def test_recommended_entries_permit_monetization(self):
        for entry in mc.recommended_models():
            assert mc.licence_permits_monetization(entry.licence), (
                f"recommended model {entry.id} has non-monetizable licence {entry.licence}"
            )

    def test_rejected_entries_carry_a_reason_and_a_restrictive_licence(self):
        rejected = [e for e in mc.CATALOG if not e.recommended]
        assert rejected, "expected the recorded Llama/Gemma rejections"
        for entry in rejected:
            assert entry.rejected_reason, f"{entry.id} rejected without a reason"
            assert not mc.licence_permits_monetization(entry.licence), (
                f"{entry.id} is rejected but its licence is monetizable — recommend it instead"
            )


class TestCatalogHelpers:
    def test_text_and_vision_filters(self):
        assert all("text" in e.kinds for e in mc.text_models())
        assert all("vision" in e.kinds for e in mc.vision_models())
        assert all(e.recommended for e in mc.text_models())

    def test_claude_models_are_both_text_and_vision(self):
        claude = mc.catalog_for_backend(mc.BACKEND_CLAUDE)
        assert claude, "expected Claude entries"
        for entry in claude:
            assert entry.kinds == {"text", "vision"}
            assert entry.api_model_id

    def test_catalog_for_backend_only_returns_runnable_recommended_models(self):
        for backend in (mc.BACKEND_OLLAMA, mc.BACKEND_LLAMACPP, mc.BACKEND_CLAUDE):
            for entry in mc.catalog_for_backend(backend):
                assert entry.recommended
                assert backend in entry.backends

    def test_model_by_id_roundtrips(self):
        entry = mc.CATALOG[0]
        assert mc.model_by_id(entry.id) is entry
        assert mc.model_by_id("does-not-exist") is None

    def test_local_recommended_models_declare_a_download_path(self):
        for entry in mc.recommended_models():
            if mc.BACKEND_OLLAMA in entry.backends:
                assert entry.ollama_tag, f"{entry.id} runs on ollama but has no tag"
            if mc.BACKEND_LLAMACPP in entry.backends:
                assert entry.gguf_url, f"{entry.id} runs on llamacpp but has no gguf_url"

    def test_to_dict_is_json_friendly(self):
        d = mc.CATALOG[0].to_dict()
        assert isinstance(d["kinds"], list)
        assert isinstance(d["backends"], list)
        assert set(d) >= {"id", "display_name", "kinds", "licence", "why", "backends"}
