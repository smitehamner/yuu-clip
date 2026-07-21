# Feature-map - GitHub update check (notify-only)
#   UI: static/core/updatecheck.js, static/settings/settings.js (status line + manual check)
#   Siblings: update_check.py · tests/integration/test_updates.py
"""GET /api/updates/check - compares the running version to the latest GitHub release."""
from __future__ import annotations

from dataclasses import asdict
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

from fastapi import APIRouter

from yuu_clip.update_check import check_for_update
from yuu_clip.web.deps import ProjectContext


def _current_version() -> str:
    try:
        return _pkg_version("yuu-clip")
    except PackageNotFoundError:
        return "0.0.0"


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/updates/check")
    def check_update():
        return asdict(check_for_update(_current_version()))

    return router
