# Feature-map — Project switcher (code: project_dir)
#   UI: static/projects.js (header project dropdown)
#   Siblings: deps.py (ProjectContext.switch_project) · config.py (recent projects) · tests/test_projects.py, tests/test_ui_projects.py
"""
Project switcher routes.

Lists the recent-projects registry and switches the live server to another
project directory *in place* — the shared ProjectContext is rebuilt without a
process restart (see deps.py::ProjectContext.switch_project). The frontend does
a full page reload after a successful switch; there is no attempt to hot-swap
client state.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.config import load_known_projects, record_known_project
from yuu_clip.log import get_logger, redirect_logging
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import analyze_in_flight

_log = get_logger(__name__)


class SwitchRequest(BaseModel):
    path: str


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/projects")
    def list_projects():
        """Current project plus the recent-projects list (most-recent first)."""
        return {
            "current": str(ctx.project_dir),
            "known": [
                {
                    "path": entry["path"],
                    "last_opened_at": entry.get("last_opened_at"),
                    "exists": Path(entry["path"]).is_dir(),
                }
                for entry in load_known_projects()
            ],
        }

    @router.post("/api/projects/switch")
    def switch_project(body: SwitchRequest):
        """Rebuild the ProjectContext against *path* in place (no restart)."""
        if analyze_in_flight(ctx) or ctx.active_jobs > 0 or ctx.proxy_generating:
            raise HTTPException(
                409,
                "Analysis is running — wait for it to finish or cancel it before "
                "switching projects.",
            )
        new_dir = Path(body.path).expanduser()
        if not new_dir.is_dir():
            raise HTTPException(400, f"Not a folder: {body.path}")
        new_dir = new_dir.resolve()

        # switch_project mkdirs .yuu-clip before make_engine; redirect_logging then
        # points the file log at the new project so its bootstrap (prepare_project)
        # and everything after logs there rather than into the old project's file.
        ctx.switch_project(new_dir)
        redirect_logging(new_dir)
        from yuu_clip.web.app import prepare_project
        prepare_project(ctx)
        record_known_project(new_dir)
        _log.info("Switched project to %s (generation %d)", new_dir, ctx.project_generation)
        return {"current": str(new_dir), "project_generation": ctx.project_generation}

    return router
