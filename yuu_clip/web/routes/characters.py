# Feature-map - Character (structured world-context lore entity, linkable to a Person)
#   UI: static/contexts.js (Characters section in the world-context editor)
#   Siblings: db/models.py::Character · routes/contexts.py (context-delete cascade) · routes/voices.py (Person link)
#   Tests: tests/integration/test_characters.py, tests/ui/test_ui_contexts.py
"""Character CRUD routes.

A Character is a structured lore entity within a world context - name, lore, and a
0.0-1.0 ``score_boost`` fed to the LLM scorer when a linked Person speaks in a clip.
Characters live in the DB (keyed to a JSON context by ``context_slug``) and coexist with
the context's free-text ``your_characters`` / ``other_characters`` prose; only the
structured records drive per-character scoring boosts. Linking a Character to a Person is
done in the People view (routes/voices.py); deleting a Character nulls any such link here.

GET    /api/contexts/{slug}/characters - list a context's characters
POST   /api/contexts/{slug}/characters - create a character in a context
GET    /api/characters                 - flat list across every context (People-view picker)
PUT    /api/characters/{id}            - edit name / lore / score_boost
DELETE /api/characters/{id}            - delete, nulling any linking Person first
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.contexts import known_context_ids, load_contexts
from yuu_clip.db.models import Character, ProjectVoice
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


class CharacterCreate(BaseModel):
    name: str
    lore: str = ""
    score_boost: float = 0.0


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    lore: Optional[str] = None
    score_boost: Optional[float] = None


def _clamp_boost(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/contexts/{slug}/characters")
    def list_characters(slug: str):
        db = ctx.get_db()
        try:
            rows = (
                db.query(Character)
                .filter(Character.context_slug == slug)
                .order_by(Character.name)
                .all()
            )
            return [_character_dict(c) for c in rows]
        finally:
            db.close()

    @router.post("/api/contexts/{slug}/characters")
    def create_character(slug: str, body: CharacterCreate):
        if slug not in known_context_ids(ctx.project_dir):
            raise HTTPException(404, f"World context '{slug}' not found")
        name = body.name.strip()
        if not name:
            raise HTTPException(400, "Character name must not be empty")
        db = ctx.get_db()
        try:
            char = Character(
                context_slug=slug,
                name=name,
                lore=(body.lore or "").strip() or None,
                score_boost=_clamp_boost(body.score_boost),
            )
            db.add(char)
            db.commit()
            _log.info("Character created: %r in context %s (boost=%.2f)", name, slug, char.score_boost)
            return _character_dict(char)
        finally:
            db.close()

    @router.get("/api/characters")
    def list_all_characters():
        """Every character across all contexts, tagged with its context's display name -
        the flat list the People view uses to populate the per-Person character picker."""
        contexts = load_contexts(ctx.project_dir)
        db = ctx.get_db()
        try:
            rows = db.query(Character).order_by(Character.context_slug, Character.name).all()
            return [_character_dict(c, contexts) for c in rows]
        finally:
            db.close()

    @router.put("/api/characters/{character_id}")
    def update_character(character_id: int, body: CharacterUpdate):
        db = ctx.get_db()
        try:
            char = db.get(Character, character_id)
            if not char:
                raise HTTPException(404, "Character not found")
            fields = body.model_fields_set
            if "name" in fields:
                name = (body.name or "").strip()
                if not name:
                    raise HTTPException(400, "Character name must not be empty")
                char.name = name
            if "lore" in fields:
                char.lore = (body.lore or "").strip() or None
            if "score_boost" in fields:
                char.score_boost = _clamp_boost(body.score_boost)
            db.commit()
            _log.info("Character %d updated: name=%r boost=%.2f", character_id, char.name, char.score_boost)
            return _character_dict(char)
        finally:
            db.close()

    @router.delete("/api/characters/{character_id}")
    def delete_character(character_id: int):
        db = ctx.get_db()
        try:
            char = db.get(Character, character_id)
            if not char:
                raise HTTPException(404, "Character not found")
            unlinked = (
                db.query(ProjectVoice)
                .filter(ProjectVoice.character_id == character_id)
                .update({"character_id": None}, synchronize_session=False)
            )
            db.delete(char)
            db.commit()
            _log.info("Character %d deleted (unlinked %d Person(s))", character_id, unlinked)
            return {"deleted": character_id, "unlinked_people": unlinked}
        finally:
            db.close()

    return router


def _character_dict(char: Character, contexts: Optional[dict] = None) -> dict:
    data = {
        "id": char.id,
        "context_slug": char.context_slug,
        "name": char.name,
        "lore": char.lore or "",
        "score_boost": char.score_boost,
    }
    if contexts is not None:
        ctx_data = contexts.get(char.context_slug) or {}
        data["context_name"] = ctx_data.get("display_name") or char.context_slug
    return data
