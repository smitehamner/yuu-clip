# Feature-map - Project switcher (code: project_dir)
#   UI: static/settings/projects.js (header project dropdown)
#   Siblings: deps.py (ProjectContext.switch_project) · recent_projects.py (recent projects) · tests/integration/test_projects.py, tests/ui/test_ui_projects.py
"""
Project switcher routes.

Lists the recent-projects registry and switches the live server to another
project directory *in place* - the shared ProjectContext is rebuilt without a
process restart (see deps.py::ProjectContext.switch_project). The frontend does
a full page reload after a successful switch; there is no attempt to hot-swap
client state.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.log import get_logger, redirect_logging
from yuu_clip.recent_projects import load_known_projects, record_known_project
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import analyze_in_flight

_log = get_logger(__name__)


def _seed_default_llm_model(ctx: ProjectContext, project_dir: Path) -> None:
    """A brand-new project starts with no llm_model_path - if a recommended text
    model is already downloaded (from an earlier project's setup), point this
    project at it too instead of leaving LLM scoring unconfigured until the user
    visits Settings by hand. Never overwrites an existing choice."""
    if ctx.config.llm_model_path:
        return
    from yuu_clip.config import models_dir
    from yuu_clip.web.routes.llm import default_text_model_path

    default_path = default_text_model_path(models_dir())
    if default_path is None:
        return
    ctx.config.llm_model_path = str(default_path)
    ctx.config.save_project(project_dir, keys=["llm_model_path"])
    _log.info("Seeded llm_model_path for new project from an already-downloaded model: %s", default_path)


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
                "Analysis is running - wait for it to finish or cancel it before "
                "switching projects.",
            )
        new_dir = Path(body.path).expanduser()
        created = not new_dir.is_dir()
        if created:
            # "A new folder becomes a fresh, empty project" (open-project.html) - honor
            # that promise when the parent exists (a plausible new-project path), but
            # still 400 when the parent is also missing (that's a typo, not a request
            # to create an entire directory tree). Also covers a *previously known*
            # project path whose folder has since been moved/deleted - reported
            # 2026-07-25 as silently starting a blank project with no indication the
            # old one wasn't found; `created` in the response lets the frontend say so.
            if new_dir.exists() or not new_dir.parent.is_dir():
                raise HTTPException(400, f"Not a folder: {body.path}")
            new_dir.mkdir()
        new_dir = new_dir.resolve()

        # switch_project mkdirs .yuu-clip before make_engine; redirect_logging then
        # points the file log at the new project so its bootstrap (prepare_project)
        # and everything after logs there rather than into the old project's file.
        ctx.switch_project(new_dir)
        redirect_logging(new_dir)
        from yuu_clip.web.app import prepare_project
        prepare_project(ctx)
        if created:
            _seed_default_llm_model(ctx, new_dir)
        record_known_project(new_dir)
        _log.info("Switched project to %s (generation %d)", new_dir, ctx.project_generation)
        return {"current": str(new_dir), "project_generation": ctx.project_generation, "created": created}

    return router
