# Feature-map - World context (code: rp_context / Context; UI term "Contexts")
#   UI: static/library/contexts.js (context manager modal + chips)
#   Siblings: contexts.py (storage + prompt formatting) · tests/integration/test_profiles_contexts.py, tests/ui/test_ui_contexts.py
"""
World context CRUD routes.

GET    /api/contexts                    - list all contexts
POST   /api/contexts                    - create or update a context (upsert by context ID)
DELETE /api/contexts/{context_id}       - delete a context
POST   /api/contexts/{context_id}/reset - restore a template context to its shipped content
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.contexts import BUILTIN_CONTEXTS, BUILTIN_IDS, WEIGHT_FIELDS, load_contexts, save_contexts
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


class ContextBody(BaseModel):
    context_id: str
    display_name: str
    setting: str = ""
    your_characters: str = ""
    other_characters: str = ""
    notes: str = ""
    score_funny_weight: float | None = None
    score_dramatic_weight: float | None = None
    score_action_weight: float | None = None


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/contexts")
    def list_contexts():
        contexts = load_contexts(ctx.project_dir)
        return [
            {"context_id": context_id, "builtin": context_id in BUILTIN_IDS, **_strip(data)}
            for context_id, data in contexts.items()
        ]

    @router.post("/api/contexts")
    def upsert_context(body: ContextBody):
        context_id = body.context_id.strip()
        if not context_id:
            raise HTTPException(400, "Context ID must not be empty")
        if not context_id.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(400, "Context ID may only contain letters, digits, hyphens, and underscores")
        contexts = load_contexts(ctx.project_dir)
        existing = contexts.get(context_id, {})
        is_new = context_id not in contexts
        contexts[context_id] = {
            "display_name":          (body.display_name or context_id).strip(),
            "setting":               body.setting,
            "your_characters":       body.your_characters,
            "other_characters":      body.other_characters,
            "notes":                 body.notes,
            "score_funny_weight":    body.score_funny_weight,
            "score_dramatic_weight": body.score_dramatic_weight,
            "score_action_weight":   body.score_action_weight,
            "created_at":            existing.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at":            datetime.now(timezone.utc).isoformat(),
        }
        save_contexts(ctx.project_dir, contexts)
        _log.info("World context %s: %s (display_name=%r)", "created" if is_new else "updated", context_id, body.display_name)
        return {"context_id": context_id, **_strip(contexts[context_id])}

    @router.delete("/api/contexts/{context_id}")
    def delete_context(context_id: str):
        if context_id in BUILTIN_IDS:
            raise HTTPException(400, "Template contexts cannot be deleted - reset them to the shipped version instead")
        contexts = load_contexts(ctx.project_dir)
        if context_id not in contexts:
            raise HTTPException(404, f"Context '{context_id}' not found")
        _delete_context_characters(ctx, context_id)
        del contexts[context_id]
        save_contexts(ctx.project_dir, contexts)
        _log.info("World context deleted: %s", context_id)
        return {"deleted": context_id}

    @router.post("/api/contexts/{context_id}/reset")
    def reset_context(context_id: str):
        if context_id not in BUILTIN_IDS:
            raise HTTPException(400, "Only template contexts can be reset to their shipped content")
        contexts = load_contexts(ctx.project_dir)
        existing = contexts.get(context_id, {})
        contexts[context_id] = {
            **BUILTIN_CONTEXTS[context_id],
            "created_at": existing.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        save_contexts(ctx.project_dir, contexts)
        _log.info("World context reset to template: %s", context_id)
        return {"context_id": context_id, "builtin": True, **_strip(contexts[context_id])}

    return router


def _delete_context_characters(ctx: ProjectContext, context_id: str) -> None:
    """Delete a context's structured Characters and any Person alias linked to them.

    Characters are an overlay keyed to this context by slug; a context deletion must
    remove them and their person_characters alias links so none dangle. It never touches
    a Person's own name or voiceprint (the link is the only thing that goes away).
    """
    from yuu_clip.db.models import Character, PersonCharacterLink

    db = ctx.get_db()
    try:
        char_ids = [
            cid for (cid,) in db.query(Character.id)
            .filter(Character.context_slug == context_id).all()
        ]
        if not char_ids:
            return
        db.query(PersonCharacterLink).filter(PersonCharacterLink.character_id.in_(char_ids)).delete(
            synchronize_session=False)
        db.query(Character).filter(Character.id.in_(char_ids)).delete(synchronize_session=False)
        db.commit()
        _log.info("Deleted %d character(s) with context %s", len(char_ids), context_id)
    finally:
        db.close()


_OMIT_KEYS = frozenset(("created_at", "updated_at"))


def _strip(data: dict) -> dict:
    d = {k: v for k, v in data.items() if k not in _OMIT_KEYS}
    for k in WEIGHT_FIELDS:
        d.setdefault(k, None)
    return d
