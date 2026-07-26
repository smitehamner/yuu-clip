from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from yuu_clip import model_catalog as mc
from yuu_clip.config import Config

_REPO_ROOT = Path(__file__).resolve().parents[2]


class TestCatalogIntegrity:
    def test_every_entry_has_kind_licence_and_a_backend(self):
        for entry in mc.CATALOG:
            assert entry.kinds, f"{entry.id} has no kinds"
            assert entry.kinds <= {"text", "vision"}, f"{entry.id} has an unknown kind"
            assert entry.licence, f"{entry.id} has no licence"
            assert entry.backends, f"{entry.id} has no backend"
            assert entry.backends <= {
                mc.BACKEND_LLAMACPP,
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


class TestLicencePermitsMonetization:
    """Direct coverage of the allowlist itself - the catalog-integrity tests above only
    exercise licences that some CATALOG entry actually carries, so BSD-3-Clause (in the
    allowlist but not used by any current entry) was otherwise never asserted True."""

    @pytest.mark.parametrize("licence", ["Apache-2.0", "MIT", "BSD-3-Clause"])
    def test_allowlisted_licences_permit_monetization(self, licence):
        assert mc.licence_permits_monetization(licence) is True

    @pytest.mark.parametrize("licence", [
        "Llama 3.1 Community License",
        "Gemma Terms of Use",
        "GPL-3.0",
        "apache-2.0",  # case must match exactly - no normalization
        "",
    ])
    def test_other_licences_do_not_permit_monetization(self, licence):
        assert mc.licence_permits_monetization(licence) is False


class TestCatalogHelpers:
    def test_text_and_vision_filters(self):
        assert all("text" in e.kinds for e in mc.text_models())
        assert all("vision" in e.kinds for e in mc.vision_models())
        assert all(e.recommended for e in mc.text_models())

    def test_qwen2_5_vl_is_the_steered_default_vision_model(self):
        # 2026-07-09: moondream2 (inaccurate) and SmolVLM2 (broken handler) were
        # dropped, leaving Qwen2.5-VL 7B as the sole recommended local vision model.
        # Catalog order drives the Settings/wizard model pickers (they render in
        # this order), so it must be first among vision entries.
        vision = mc.vision_models()
        assert vision[0].id == "qwen2.5-vl-7b-instruct"

    def test_new_local_vision_models_are_present_and_monetizable(self):
        # Qwen2-VL 2B (small/fast) and Pixtral 12B (quality) were added 2026-07-08 after
        # smoke-testing against the real Vulkan llama-server. Granite Vision was rejected
        # (garbage output), so it must NOT appear as a recommended entry.
        vision_ids = {e.id for e in mc.vision_models()}
        assert {"qwen2-vl-2b-instruct", "pixtral-12b"} <= vision_ids
        assert not any("granite" in i for i in vision_ids)
        for model_id in ("qwen2-vl-2b-instruct", "pixtral-12b"):
            entry = mc.model_by_id(model_id)
            assert entry.recommended
            assert entry.licence == "Apache-2.0"
            assert entry.backends == {mc.BACKEND_LLAMACPP}

    def test_recommended_llamacpp_vision_models_declare_gguf_and_mmproj_filenames(self):
        # The one-click vision download needs both exact filenames (gguf + projector)
        # to resolve real file URLs from the HF repo page.
        for entry in mc.vision_models():
            if mc.BACKEND_LLAMACPP in entry.backends:
                assert entry.gguf_filename, f"{entry.id} has no gguf_filename"
                assert entry.mmproj_filename, f"{entry.id} has no mmproj_filename"
                assert entry.mmproj_url, f"{entry.id} has no mmproj_url"

    def test_catalog_for_backend_only_returns_runnable_recommended_models(self):
        for entry in mc.catalog_for_backend(mc.BACKEND_LLAMACPP):
            assert entry.recommended
            assert mc.BACKEND_LLAMACPP in entry.backends

    def test_model_by_id_roundtrips(self):
        entry = mc.CATALOG[0]
        assert mc.model_by_id(entry.id) is entry
        assert mc.model_by_id("does-not-exist") is None

    def test_local_recommended_models_declare_a_download_path(self):
        for entry in mc.recommended_models():
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
    old llama3.2 default lagged the licence policy)."""

    def test_config_default_backend_is_llamacpp(self):
        # Locked user decision 2026-07-05: the offline local model file is the
        # out-of-box backend (one-click engine install + Apache-2.0 model, no
        # third-party app). The electron wizard default below must match.
        assert Config().llm_backend == "llamacpp"

    def test_electron_wizard_default_backend_is_llamacpp(self):
        main_js = (_REPO_ROOT / "electron" / "main.js").read_text(encoding="utf-8")
        match = re.search(r"llmBackend:\s*'([^']+)'", main_js)
        assert match, "llmBackend literal not found (or shape changed) in electron/main.js"
        assert match.group(1) == "llamacpp"

    def test_electron_wizard_default_llamacpp_model_matches_the_catalog(self):
        # constants.js no longer hardcodes the model - DEFAULT_LLAMACPP_MODEL is derived
        # from the generated electron/shared/catalog-data.json (`yuu-dev shared-data`).
        # Assert that generated recommended_model still matches the catalog; the byte
        # drift between JSON and Python is guarded in test_shared_data_drift.py.
        rec = json.loads(
            (_REPO_ROOT / "electron" / "shared" / "catalog-data.json").read_text(encoding="utf-8")
        )["recommended_model"]

        entry = mc.model_by_id(rec["id"])
        assert entry is not None, f"electron's recommended_model id {rec['id']!r} isn't in the catalog"
        assert entry.recommended
        assert mc.BACKEND_LLAMACPP in entry.backends
        assert entry.gguf_url == rec["gguf_url"]
        assert entry.gguf_filename == rec["filename"]
        # The wizard's disk-precheck size must track the catalog's on-disk size.
        assert float(rec["size_gb"]) == entry.size_gb
