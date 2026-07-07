# Feature-map — Project backup / restore (code: backup)
#   UI: static/settings-backup.js (Stage 3, not yet built)
#   Siblings: project_archive.py (archive core) · routes/projects.py (switch, restore reuses it)
#   Tests: tests/test_backup.py, tests/test_restore.py (Stage 2)
"""Project backup / restore routes.

Stage 1: POST /api/backup builds a portable zip of the project's .yuu-clip state
(see project_archive.build_backup) and returns it as a download, or writes it to a
caller-supplied path (the Electron save dialog). Restore endpoints land in Stage 2.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from yuu_clip.log import get_logger
from yuu_clip.project_archive import build_backup
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import analyze_in_flight

_log = get_logger(__name__)


class BackupRequest(BaseModel):
    dest_path: Optional[str] = None


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/backup")
    def backup(body: Optional[BackupRequest] = None):
        """Build a backup zip of the current project.

        With ``dest_path`` (Electron save dialog) the archive is written there and
        the path returned as JSON. Without it the archive is streamed as a file
        download and its temp copy deleted once the response finishes."""
        if analyze_in_flight(ctx):
            raise HTTPException(
                409,
                "An analysis is still running — wait for it to finish or cancel it "
                "before backing up the project.",
            )

        dest = body.dest_path if body else None
        if dest:
            archive_path = build_backup(ctx.project_dir, Path(dest).expanduser())
            return {"path": str(archive_path)}

        archive_path = build_backup(ctx.project_dir)
        return FileResponse(
            archive_path,
            media_type="application/zip",
            filename=archive_path.name,
            background=BackgroundTask(_cleanup_temp, archive_path),
        )

    return router


def _cleanup_temp(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:  # noqa: BLE001 - a lingering temp file is not fatal
        _log.warning("Could not remove temp backup file %s: %s", path, exc)
