# Feature-map — Clips (code: ClipCandidate)
#   UI: static/clips.js (list, detail, player, tags, score override, export modal, bulk ops)
#   This package's files map 1:1 to the clip API surface:
#     schemas    request bodies        serialize  clip → JSON + parse/normalize helpers
#     approval   auto-approve/reset    crud       list/detail/tags/status/preview/manual create
#     edit       fields/score/merge/timing/framing/vision
#     export     batch-export + SSE    bulk       multi-clip status/delete/export
#     delete     clip + export deletes captions   transcript/context/caption edit/VTT
#   Siblings: scoring/engine.py · export/render.py (engine) · cli/export.py (command)
#   Tests: tests/test_videos.py, tests/test_captions.py, tests/test_clip_create.py, tests/test_ui_clips.py
"""Clip management routes — CRUD, preview, approval, export, edit, captions."""
from __future__ import annotations

from fastapi import APIRouter

from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.clips import (
    approval,
    bulk,
    captions,
    crud,
    delete,
    edit,
    export,
)


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()
    approval.register(router, ctx)
    # Bulk routes use static paths like /api/clips/bulk-export — must be registered
    # before /api/clips/{clip_id} or FastAPI matches "bulk-export" as a clip_id.
    bulk.register(router, ctx)
    crud.register(router, ctx)
    delete.register(router, ctx)
    export.register(router, ctx)
    edit.register(router, ctx)
    captions.register(router, ctx)
    return router
