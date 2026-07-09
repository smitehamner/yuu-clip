from __future__ import annotations

import re
from pathlib import Path

from yuu_clip import model_catalog as mc
from yuu_clip.config import Config

_REPO_ROOT = Path(__file__).resolve().parents[1]


def _recommended_ollama_tags() -> set[str]:
    return {e.ollama_tag for e in mc.catalog_for_backend(mc.BACKEND_OLLAMA)}


def _recommended_claude_ids() -> set[str]:
    return {e.api_model_id for e in mc.catalog_for_backend(mc.BACKEND_CLAUDE)}


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
                f"{entry.id} is rejected but its licence is monetizable - recommend it instead"
            )


class TestCatalogHelpers:
    def test_text_and_vision_filters(self):
        assert all("text" in e.kinds for e in mc.text_models())
        assert all("vision" in e.kinds for e in mc.vision_models())
        assert all(e.recommended for e in mc.text_models())

    def test_ollama_vision_tag_bases_match_vision_models(self):
        bases = mc.ollama_vision_tag_bases()
        assert "qwen2.5vl" in bases  # recommended vision model's ollama tag base
        # Every base derives from a recommended vision model's ollama tag.
        expected = {e.ollama_tag.split(":", 1)[0].lower() for e in mc.vision_models() if e.ollama_tag}
        assert bases == frozenset(expected)

    def test_qwen2_5_vl_is_the_steered_default_vision_model(self):
        # 2026-07-09: moondream2 (inaccurate) and SmolVLM2 (broken handler) were
        # dropped, leaving Qwen2.5-VL 7B as the sole recommended local vision model.
        # Catalog order drives the Settings/wizard model pickers (they render in
        # this order), so it must be first among vision entries.
        vision = mc.vision_models()
        assert vision[0].id == "qwen2.5-vl-7b-instruct"

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

    def test_recommended_text_models_declare_an_exact_gguf_filename(self):
        # gguf_url is an HF *repo page*, not a direct download - the setup wizard's
        # one-click model download needs the exact quant filename to resolve a real
        # file URL (gguf_url + "/resolve/main/" + gguf_filename).
        for entry in mc.text_models():
            if mc.BACKEND_LLAMACPP in entry.backends:
                assert entry.gguf_filename, f"{entry.id} runs on llamacpp but has no gguf_filename"

    def test_to_dict_is_json_friendly(self):
        d = mc.CATALOG[0].to_dict()
        assert isinstance(d["kinds"], list)
        assert isinstance(d["backends"], list)
        assert set(d) >= {"id", "display_name", "kinds", "licence", "why", "backends"}


class TestDefaultsMatchCatalog:
    """The out-of-box default models must be *recommended* catalog entries, so a
    default can't silently drift to a non-monetization-safe model (the way the
    old llama3.2 default lagged the licence policy - see COMPLETED.md plan 10)."""

    def test_config_default_backend_is_llamacpp(self):
        # Locked user decision 2026-07-05: the offline local model file is the
        # out-of-box backend (one-click engine install + Apache-2.0 model, no
        # third-party app). The electron wizard default below must match.
        assert Config().llm_backend == "llamacpp"

    def test_electron_wizard_default_backend_is_llamacpp(self):
        main_js = (_REPO_ROOT / "electron" / "main.js").read_text(encoding="utf-8")
        match = re.search(r"defaultBackend\s*=\s*existingBackend\s*\|\|\s*'([^']+)'", main_js)
        assert match, "defaultBackend fallback not found (or shape changed) in electron/main.js"
        assert match.group(1) == "llamacpp"

    def test_config_default_ollama_model_is_recommended(self):
        assert Config().ollama_model in _recommended_ollama_tags()

    def test_config_default_claude_model_is_recommended(self):
        assert Config().claude_model in _recommended_claude_ids()

    def test_electron_wizard_default_ollama_model_is_recommended(self):
        constants_js = (_REPO_ROOT / "electron" / "constants.js").read_text(encoding="utf-8")
        match = re.search(r"DEFAULT_OLLAMA_MODEL\s*=\s*'([^']+)'", constants_js)
        assert match, "DEFAULT_OLLAMA_MODEL constant not found in electron/constants.js"
        assert match.group(1) in _recommended_ollama_tags()

    def test_electron_wizard_default_llamacpp_model_matches_the_catalog(self):
        constants_js = (_REPO_ROOT / "electron" / "constants.js").read_text(encoding="utf-8")
        match = re.search(
            r"DEFAULT_LLAMACPP_MODEL\s*=\s*\{\s*"
            r"id:\s*'([^']+)',\s*"
            r"repoUrl:\s*'([^']+)',\s*"
            r"filename:\s*'([^']+)',\s*"
            r"sizeGb:\s*([\d.]+),?\s*\}",
            constants_js,
        )
        assert match, "DEFAULT_LLAMACPP_MODEL constant not found (or shape changed) in electron/constants.js"
        model_id, repo_url, filename, size_gb = match.groups()

        entry = mc.model_by_id(model_id)
        assert entry is not None, f"electron's DEFAULT_LLAMACPP_MODEL id {model_id!r} isn't in the catalog"
        assert entry.recommended
        assert mc.BACKEND_LLAMACPP in entry.backends
        assert entry.gguf_url == repo_url
        assert entry.gguf_filename == filename
        # The wizard's disk-precheck size must track the catalog's on-disk size.
        assert float(size_gb) == entry.size_gb
