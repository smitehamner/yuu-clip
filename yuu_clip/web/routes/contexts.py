"""
World context CRUD routes.

GET    /api/contexts                  — list all contexts
POST   /api/contexts                  — create or update a context (upsert by context ID)
DELETE /api/contexts/{context_id}     — delete a context
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.contexts import BUILTIN_IDS, load_contexts, save_contexts
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
            "display_name":    body.display_name or context_id,
            "setting":         body.setting,
            "your_characters": body.your_characters,
            "other_characters": body.other_characters,
            "notes":           body.notes,
            "created_at":      existing.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at":      datetime.now(timezone.utc).isoformat(),
        }
        save_contexts(ctx.project_dir, contexts)
        _log.info("World context %s: %s (display_name=%r)", "created" if is_new else "updated", context_id, body.display_name)
        return {"context_id": context_id, **_strip(contexts[context_id])}

    @router.delete("/api/contexts/{context_id}")
    def delete_context(context_id: str):
        contexts = load_contexts(ctx.project_dir)
        if context_id not in contexts:
            raise HTTPException(404, f"Context '{context_id}' not found")
        del contexts[context_id]
        save_contexts(ctx.project_dir, contexts)
        _log.info("World context deleted: %s", context_id)
        return {"deleted": context_id}

    return router


def _strip(data: dict) -> dict:
    return {k: v for k, v in data.items() if k not in ("created_at", "updated_at")}
