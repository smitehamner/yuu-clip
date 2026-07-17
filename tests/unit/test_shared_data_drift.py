"""Drift + invariant guards for the generated shared catalog JSON.

`yuu-dev shared-data` bakes the Python sources of truth (model_catalog, config,
content_presets, whisper_catalog) into two committed catalog-data.json copies that the
web bundle and the Electron wizard read. These tests fail until a stale copy is
regenerated (`yuu-dev shared-data`), and pin the invariants both stacks rely on so a
future edit to a source module can't silently break the wizard's model download or its
language list.
"""
from __future__ import annotations

import json

from yuu_clip import content_presets, model_catalog
from yuu_clip.config import ALLOWED_WHISPER_LANGUAGES
from yuu_clip.dev.shareddata import (
    ELECTRON_JSON,
    WEB_JSON,
    build_catalog_data,
    render_json,
)


def _load(path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_web_copy_is_current():
    assert WEB_JSON.exists(), "run `yuu-dev shared-data`"
    assert WEB_JSON.read_text(encoding="utf-8") == render_json(build_catalog_data()), (
        f"{WEB_JSON.name} is stale - run `yuu-dev shared-data` and commit the result"
    )


def test_electron_copy_is_current():
    assert ELECTRON_JSON.exists(), "run `yuu-dev shared-data`"
    assert ELECTRON_JSON.read_text(encoding="utf-8") == render_json(build_catalog_data()), (
        f"{ELECTRON_JSON.name} is stale - run `yuu-dev shared-data` and commit the result"
    )


def test_the_two_copies_are_byte_identical():
    assert WEB_JSON.read_bytes() == ELECTRON_JSON.read_bytes()


def test_recommended_model_is_a_recommended_text_entry():
    # The wizard writes the TEXT model only (never a vision model) and downloads this
    # entry - it must stay a recommended, monetization-safe, text llama.cpp model.
    rec = _load(WEB_JSON)["recommended_model"]
    entry = model_catalog.model_by_id(rec["id"])
    assert entry is not None
    assert entry.recommended
    assert "text" in entry.kinds
    assert "vision" not in entry.kinds
    assert model_catalog.BACKEND_LLAMACPP in entry.backends
    assert model_catalog.licence_permits_monetization(entry.licence)


def test_recommended_model_fields_match_the_catalog():
    rec = _load(WEB_JSON)["recommended_model"]
    entry = model_catalog.model_by_id(rec["id"])
    assert rec["filename"] == entry.gguf_filename
    assert rec["gguf_url"] == entry.gguf_url
    assert rec["size_gb"] == entry.size_gb
    assert rec["licence"] == entry.licence
    assert rec["resolve_url"] == f"{entry.gguf_url}/resolve/main/{entry.gguf_filename}"


def test_whisper_languages_match_config():
    langs = _load(WEB_JSON)["whisper_languages"]
    assert langs == sorted(ALLOWED_WHISPER_LANGUAGES)


def test_content_presets_match_the_catalog():
    presets = _load(WEB_JSON)["content_presets"]
    assert [p["id"] for p in presets] == [p.id for p in content_presets.all_presets()]
    for got, expected in zip(presets, content_presets.all_presets()):
        assert got["name"] == expected.name
        assert got["description"] == expected.description


def test_whisper_models_cover_the_ui_selectable_set():
    ids = [m["id"] for m in _load(WEB_JSON)["whisper_models"]]
    assert ids == ["tiny", "base", "small", "medium", "large-v3"]
