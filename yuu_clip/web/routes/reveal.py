"""Reveal-in-Explorer route.

Windows-only: opens Explorer with the target file pre-selected. Never shells
out with a user-controlled string — subprocess.Popen receives an argument
list, and the target path is required to live inside a project-owned
directory before Explorer ever sees it.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.db.models import Video
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


class RevealRequest(BaseModel):
    path: str


def _is_within(target: Path, base: Path) -> bool:
    try:
        target.relative_to(base)
        return True
    except ValueError:
        return False


def _path_allowed(target: Path, ctx: ProjectContext) -> bool:
    """*target* must resolve inside the exports/reels/proxies dirs or the
    directory of a recording tracked in this project — never an arbitrary path."""
    for base in (ctx.export_dir, ctx.reels_dir, ctx.proxy_dir):
        if _is_within(target, base.resolve()):
            return True
    db = ctx.get_db()
    try:
        for (video_path,) in db.query(Video.path).all():
            if _is_within(target, Path(video_path).resolve().parent):
                return True
    finally:
        db.close()
    return False


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/reveal")
    def reveal(req: RevealRequest):
        if sys.platform != "win32":
            raise HTTPException(501, "Only available on Windows")
        target = Path(req.path).resolve()
        if not _path_allowed(target, ctx):
            raise HTTPException(400, "Path is outside the project's managed directories")
        if not target.exists():
            raise HTTPException(404, "File not found")
        subprocess.Popen(["explorer", f"/select,{target}"])
        return {"status": "ok"}

    return router
