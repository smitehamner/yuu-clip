"""
Track layout CRUD routes.

Track layouts define how each audio track is labelled and whether it participates
in transcription and scoring. The built-in ``__default__`` layout (combined track
only) is synthesised at request time and cannot be modified or deleted.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.web.deps import ProjectContext


class ProfileSave(BaseModel):
    name: str
    assignments: list[dict]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/profiles")
    def list_profiles():
        from yuu_clip.config import load_profiles
        user_profiles = load_profiles()
        return [_builtin_default()] + [
            {
                "name":         name,
                "display_name": name,
                "builtin":      False,
                "num_tracks":   p["num_tracks"],
                "assignments":  p["assignments"],
            }
            for name, p in user_profiles.items()
        ]

    @router.post("/api/profiles")
    def save_profile(body: ProfileSave):
        from yuu_clip.config import save_profile as _save
        if not body.name or body.name.startswith("__"):
            raise HTTPException(400, "Invalid track layout name — names beginning with __ are reserved")
        _save(body.name, body.assignments)
        return {"name": body.name}

    @router.delete("/api/profiles/{name}")
    def delete_profile(name: str):
        from yuu_clip.config import delete_profile as _delete
        if name.startswith("__"):
            raise HTTPException(400, "Built-in track layouts cannot be deleted")
        _delete(name)
        return {"deleted": name}

    return router


def _builtin_default() -> dict:
    """Return the hard-coded default profile (single combined track)."""
    return {
        "name":         "__default__",
        "display_name": "Default (combined only)",
        "builtin":      True,
        "num_tracks":   1,
        "assignments":  [
            {"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True}
        ],
    }
