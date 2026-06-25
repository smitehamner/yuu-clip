"""
RP Context CRUD routes.

GET    /api/contexts            — list all contexts
POST   /api/contexts            — create or update a context (upsert by slug)
DELETE /api/contexts/{slug}     — delete a context
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rp_clipper.contexts import load_contexts, save_contexts
from rp_clipper.web.deps import ProjectContext


class ContextBody(BaseModel):
    slug: str
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
            {"slug": slug, **_strip(data)}
            for slug, data in contexts.items()
        ]

    @router.post("/api/contexts")
    def upsert_context(body: ContextBody):
        slug = body.slug.strip()
        if not slug:
            raise HTTPException(400, "slug must not be empty")
        if not slug.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(400, "slug may only contain letters, digits, hyphens, and underscores")
        contexts = load_contexts(ctx.project_dir)
        from datetime import datetime
        existing = contexts.get(slug, {})
        contexts[slug] = {
            "display_name":    body.display_name or slug,
            "setting":         body.setting,
            "your_characters": body.your_characters,
            "other_characters": body.other_characters,
            "notes":           body.notes,
            "created_at":      existing.get("created_at", datetime.utcnow().isoformat()),
            "updated_at":      datetime.utcnow().isoformat(),
        }
        save_contexts(ctx.project_dir, contexts)
        return {"slug": slug, **_strip(contexts[slug])}

    @router.delete("/api/contexts/{slug}")
    def delete_context(slug: str):
        contexts = load_contexts(ctx.project_dir)
        if slug not in contexts:
            raise HTTPException(404, f"Context '{slug}' not found")
        del contexts[slug]
        save_contexts(ctx.project_dir, contexts)
        return {"deleted": slug}

    return router


def _strip(data: dict) -> dict:
    return {k: v for k, v in data.items() if k not in ("created_at", "updated_at")}
