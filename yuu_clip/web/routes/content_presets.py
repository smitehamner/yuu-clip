# Feature-map - Content type (code: content_preset)
#   UI: static/settings.js (Settings → Scoring weights → Content type)
#   Siblings: content_presets.py · scoring/llm.py (live prompt flavor) · tests/integration/test_content_presets.py, tests/ui/test_ui_content_presets.py
"""Content-type preset routes (plan 12).

GET  /api/content-presets        - list built-in presets + the active one
POST /api/content-presets/apply  - copy a preset's weights into config and, opt-in,
                                    insert its starter hot-words (skipping duplicates)

Applying copies the *weights* (users tune them afterwards) and records the preset id
in Config.content_preset; the prompt *flavor* is read live from that id at scoring
time (see scoring/llm.py). Weights save to project config, matching where the Settings
weight sliders save (PATCH /api/config → save_project).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.content_presets import all_presets, preset_by_id
from yuu_clip.db.models import HotWord
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


class ApplyPresetBody(BaseModel):
    id: str
    add_hotwords: bool = True


def _insert_starter_hotwords(preset, db) -> int:
    """Insert the preset's starter hot-words, skipping any phrase (case-insensitive)
    that already exists so a re-apply never duplicates them. Returns the count added."""
    existing = {hw.phrase.strip().lower() for hw in db.query(HotWord).all()}
    inserted = 0
    for spec in preset.starter_hotwords:
        key = spec.phrase.strip().lower()
        if key in existing:
            continue
        db.add(HotWord(
            phrase=spec.phrase, match_mode=spec.match_mode,
            boost=spec.boost, target=spec.target, enabled=True,
        ))
        existing.add(key)
        inserted += 1
    return inserted


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/content-presets")
    def list_content_presets():
        return {
            "active": ctx.config.content_preset,
            "presets": [preset.to_dict() for preset in all_presets()],
        }

    @router.post("/api/content-presets/apply")
    def apply_content_preset(body: ApplyPresetBody):
        preset = preset_by_id(body.id)
        if preset is None:
            raise HTTPException(400, f"Unknown content type '{body.id}'")

        cfg = ctx.config
        for field_name, value in preset.dimension_weights.items():
            setattr(cfg, field_name, value)
        cfg.scorer_laugh_weight = preset.laugh_weight
        cfg.content_preset = preset.id
        cfg.save_project(ctx.project_dir)

        hotwords_added = 0
        if body.add_hotwords and preset.starter_hotwords:
            db = ctx.get_db()
            try:
                hotwords_added = _insert_starter_hotwords(preset, db)
                db.commit()
            finally:
                db.close()

        _log.info("Applied content preset '%s' (hot-words added: %d)", preset.id, hotwords_added)
        return {
            "applied": preset.id,
            "hotwords_added": hotwords_added,
            "weights": {
                "score_funny_weight": cfg.score_funny_weight,
                "score_dramatic_weight": cfg.score_dramatic_weight,
                "score_action_weight": cfg.score_action_weight,
                "scorer_laugh_weight": cfg.scorer_laugh_weight,
            },
        }

    return router
