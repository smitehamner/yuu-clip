"""Export preset routes — built-ins are read-only; custom presets are a
per-user (global config) preference, edited from Settings -> Export."""
from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.export_presets import BUILTIN_PRESET_NAMES, BUILTIN_PRESETS, validate_preset_dict
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


class ExportPresetBody(BaseModel):
    label: str
    container: str
    height: Optional[int] = None
    crf: Optional[int] = None
    target_size_mb: Optional[float] = None
    audio_kbps: int = 128
    vertical: bool = False


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", label.strip().lower()).strip("-")
    return slug or "preset"


def _unique_name(label: str, taken: set[str]) -> str:
    """Derive a stable kebab-case id from *label*, the first time a custom preset
    is created — the id then never changes even if the label is edited later
    (it's what clip_exports.preset_name and the export filename suffix key on)."""
    base = _slugify(label)
    name = base
    suffix = 2
    while name in taken:
        name = f"{base}-{suffix}"
        suffix += 1
    return name


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/export-presets")
    def list_export_presets():
        return {
            "builtins": [p.to_dict() for p in BUILTIN_PRESETS],
            "custom": ctx.config.export_presets,
        }

    @router.post("/api/export-presets")
    def create_export_preset(body: ExportPresetBody):
        cfg = ctx.config
        existing_names = {p["name"] for p in cfg.export_presets} | BUILTIN_PRESET_NAMES
        data = body.model_dump()
        data["name"] = _unique_name(body.label, existing_names)
        try:
            preset = validate_preset_dict(data, existing_names)
        except ValueError as e:
            raise HTTPException(400, str(e))
        cfg.export_presets = [*cfg.export_presets, preset.to_dict()]
        cfg.save_global()
        _log.info("Custom export preset created: %s", preset.name)
        return preset.to_dict()

    @router.put("/api/export-presets/{name}")
    def update_export_preset(name: str, body: ExportPresetBody):
        cfg = ctx.config
        customs = cfg.export_presets
        idx = next((i for i, p in enumerate(customs) if p["name"] == name), None)
        if idx is None:
            raise HTTPException(404, "Custom preset not found")
        existing_names = {p["name"] for p in customs if p["name"] != name} | BUILTIN_PRESET_NAMES
        data = body.model_dump()
        data["name"] = name  # the id is immutable once created — only its fields change
        try:
            preset = validate_preset_dict(data, existing_names)
        except ValueError as e:
            raise HTTPException(400, str(e))
        customs[idx] = preset.to_dict()
        cfg.export_presets = customs
        cfg.save_global()
        _log.info("Custom export preset updated: %s", name)
        return preset.to_dict()

    @router.delete("/api/export-presets/{name}")
    def delete_export_preset(name: str):
        cfg = ctx.config
        if name in BUILTIN_PRESET_NAMES:
            raise HTTPException(400, "Built-in presets can't be deleted")
        before = len(cfg.export_presets)
        cfg.export_presets = [p for p in cfg.export_presets if p["name"] != name]
        if len(cfg.export_presets) == before:
            raise HTTPException(404, "Custom preset not found")
        cfg.save_global()
        _log.info("Custom export preset deleted: %s", name)
        return {"deleted": name}

    return router
