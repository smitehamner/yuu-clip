"""Pure logic in yuu_clip/whisper_catalog.py - the <option> label builder and the
by-id lookup. The drift tests (test_shared_data_drift / test_static_ui_contract)
only pin these values against the generated JSON and the live UI; they never assert
the label FORMAT or the unknown-id lookup independently, so those are pinned here.
"""
from __future__ import annotations

from yuu_clip import whisper_catalog


class TestOptionText:
    def test_includes_vram_clause_when_a_model_has_a_vram_figure(self):
        small = next(m for m in whisper_catalog.WHISPER_UI_MODELS if m.id == "small")
        assert small.option_text() == "small - fast, decent quality (~465 MB download, ~1 GB VRAM)"

    def test_omits_the_vram_clause_for_a_cpu_friendly_model(self):
        tiny = next(m for m in whisper_catalog.WHISPER_UI_MODELS if m.id == "tiny")
        # tiny/base carry no VRAM figure, so the parenthetical is download-only.
        assert tiny.option_text() == "tiny - fastest, lowest quality (~75 MB download)"
        assert "VRAM" not in tiny.option_text()


class TestOptionTextLookup:
    def test_returns_the_label_for_a_known_id(self):
        assert whisper_catalog.option_text("medium") == "medium - good balance (~1.5 GB download, ~2.8 GB VRAM)"

    def test_returns_none_for_an_unknown_id(self):
        assert whisper_catalog.option_text("gpt-4") is None


class TestUiModels:
    def test_lists_every_catalog_model_fastest_first(self):
        ids = [m.id for m in whisper_catalog.ui_models()]
        assert ids == ["tiny", "base", "small", "medium", "large-v3"]

    def test_returns_a_fresh_list_that_does_not_mutate_the_catalog(self):
        models = whisper_catalog.ui_models()
        models.clear()
        assert len(whisper_catalog.ui_models()) == len(whisper_catalog.WHISPER_UI_MODELS)
