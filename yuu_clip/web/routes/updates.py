# Feature-map - GitHub update check (notify-only)
#   UI: static/core/updatecheck.js, static/settings/settings.js (status line + manual check)
#   Siblings: update_check.py · tests/integration/test_updates.py
"""GET /api/updates/check - compares the running version to the latest GitHub release."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter

from yuu_clip.appversion import app_version
from yuu_clip.update_check import check_for_update
from yuu_clip.web.deps import ProjectContext


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/updates/check")
    def check_update():
        # A parseable semver default so the version comparison still works when
        # running from an unpackaged checkout (no installed metadata).
        return asdict(check_for_update(app_version("0.0.0")))

    return router
