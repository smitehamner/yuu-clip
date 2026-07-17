"""``yuu-dev shared-data`` - generate the shared model/whisper/preset catalog JSON.

Model selection lives in two runtimes that cannot share code: the web Settings stack
(browser JS -> HTTP -> Python) and the Electron setup wizard (renderer -> IPC ->
main.js, which runs *before* the Python server exists). Historically each hand-copied
the same facts - the recommended model id/filename/size, the Whisper option copy, the
language list - and they drifted. This command bakes those facts, straight from their
Python source of truth, into a single generated ``catalog-data.json`` that both stacks
read. Change ``model_catalog.py`` / ``config.py`` / ``content_presets.py`` /
``whisper_catalog.py`` and re-run ``yuu-dev shared-data``; the drift guard
(``tests/unit/test_shared_data_drift.py``) fails until you do.

The JSON is written to TWO committed locations because the two runtimes package
separately and cannot reach each other's tree at runtime:
  - ``yuu_clip/web/static/shared/catalog-data.json`` - ships in the wheel; the web
    bundle imports it through the esbuild graph.
  - ``electron/shared/catalog-data.json`` - ships inside the Electron app.asar; the
    main process ``require()``s it and the wizard bundle inlines it at build time.
They are byte-identical; the drift test asserts both are current and equal.

The privacy copy strings are authored here (not duplicated from another module) because
this generator is their single home; the wizard and (later) web Settings both consume
them from the JSON.
"""
from __future__ import annotations

import json
from pathlib import Path

from yuu_clip import content_presets, model_catalog, whisper_catalog
from yuu_clip.config import ALLOWED_WHISPER_LANGUAGES
from yuu_clip.dev._base import REPO_ROOT, app, console

WEB_JSON = REPO_ROOT / "yuu_clip" / "web" / "static" / "shared" / "catalog-data.json"
ELECTRON_JSON = REPO_ROOT / "electron" / "shared" / "catalog-data.json"

# Canonical AI-privacy copy (yuu-clip is local-only: the mode only decides whether a
# generative model runs at all). One home for both the wizard and web Settings.
AI_PRIVACY_OPTIONS = [
    {"value": "none", "label": "No generative AI - no language model runs"},
    {"value": "local_only", "label": "Local models only - nothing leaves your machine (recommended)"},
]
AI_PRIVACY_NOTES = {
    "none": "No language model runs. Clips are still found and searchable; scoring uses lightweight signals only.",
    "local_only": "On-device models only. Everything runs locally - nothing you record is sent anywhere.",
}


def _recommended_model_dict() -> dict:
    """The wizard's default local model = the first recommended *text* model. The
    wizard writes the TEXT model only (never a vision model), so this must stay a text
    entry - asserted in the drift/invariant tests."""
    entry = model_catalog.text_models()[0]
    resolve_url = None
    if entry.gguf_url and entry.gguf_filename:
        resolve_url = f"{entry.gguf_url}/resolve/main/{entry.gguf_filename}"
    return {
        "id": entry.id,
        "display_name": entry.display_name,
        "filename": entry.gguf_filename,
        "gguf_url": entry.gguf_url,
        "resolve_url": resolve_url,
        "size_gb": entry.size_gb,
        "licence": entry.licence,
        "why": entry.why,
    }


def build_catalog_data() -> dict:
    """Assemble the shared catalog dict from the Python sources of truth."""
    return {
        "_generated_by": "yuu-dev shared-data",
        "recommended_model": _recommended_model_dict(),
        "whisper_models": [m.to_dict() for m in whisper_catalog.ui_models()],
        "whisper_languages": sorted(ALLOWED_WHISPER_LANGUAGES),
        "content_presets": [
            {"id": p.id, "name": p.name, "description": p.description}
            for p in content_presets.all_presets()
        ],
        "ai_privacy_options": AI_PRIVACY_OPTIONS,
        "ai_privacy_notes": AI_PRIVACY_NOTES,
    }


def render_json(data: dict) -> str:
    """Deterministic serialization (stable across machines) with a trailing newline."""
    return json.dumps(data, indent=2, ensure_ascii=True) + "\n"


def write_shared_data() -> list[Path]:
    payload = render_json(build_catalog_data())
    written: list[Path] = []
    for path in (WEB_JSON, ELECTRON_JSON):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8", newline="\n")
        written.append(path)
    return written


@app.command("shared-data")
def shared_data() -> None:
    """Generate the shared catalog-data.json (web + electron copies) from Python truth."""
    for path in write_shared_data():
        console.print(f"Wrote {path.relative_to(REPO_ROOT)}")
