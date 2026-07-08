# Feature-map - Project backup / restore (code: backup)
#   UI: static/settings-backup.js (Stage 3, not yet built)
#   Siblings: project_archive.py (archive + re-point core) · routes/projects.py (switch, restore reuses it)
#   Tests: tests/test_backup.py, tests/test_restore.py
"""Project backup / restore routes.

Backup: POST /api/backup builds a portable zip of the project's .yuu-clip state
(see project_archive.build_backup) and returns it as a download, or writes it to a
caller-supplied path (the Electron save dialog).

Restore is two steps so the user can review before anything is written:
  POST /api/restore/inspect  -> stage the archive, return manifest + the source
                                dirs that don't resolve on this machine (no commit)
  POST /api/restore/apply    -> unpack into the target, re-point mapped dirs, then
                                switch the live server to the restored project

Uploads use the raw request body (no python-multipart, matching routes/sounds.py);
Electron passes a server-side archive_path instead of uploading bytes.
"""
from __future__ import annotations

import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from yuu_clip.config import record_known_project
from yuu_clip.log import get_logger, redirect_logging
from yuu_clip.project_archive import (
    ProjectExistsError,
    RestoreError,
    apply_repoint,
    build_backup,
    plan_repoint_from_archive,
    restore_into,
)
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import analyze_in_flight

_log = get_logger(__name__)

_STAGING_PREFIX = "yuu-restore-"


class BackupRequest(BaseModel):
    dest_path: Optional[str] = None


class RestoreApplyRequest(BaseModel):
    archive_path: str
    target_dir: str
    mapping: dict[str, str] = {}
    overwrite: bool = False


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    def _guard_idle() -> None:
        if analyze_in_flight(ctx):
            raise HTTPException(
                409,
                "An analysis is still running - wait for it to finish or cancel it "
                "before backing up or restoring the project.",
            )

    @router.post("/api/backup")
    def backup(body: Optional[BackupRequest] = None):
        """Build a backup zip of the current project.

        With ``dest_path`` (Electron save dialog) the archive is written there and
        the path returned as JSON. Without it the archive is streamed as a file
        download and its temp copy deleted once the response finishes."""
        _guard_idle()
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

    @router.post("/api/restore/inspect")
    async def restore_inspect(request: Request, archive_path: Optional[str] = None):
        """Preview a restore: manifest + the source dirs that don't resolve here.

        Nothing is written to the target. Returns ``staging_path`` - the server-side
        path of the archive to pass back to /api/restore/apply, so the browser
        upload isn't re-sent."""
        _guard_idle()
        staged, is_temp = await _stage_archive(request, archive_path)
        try:
            manifest, groups = plan_repoint_from_archive(staged)
        except RestoreError as exc:
            if is_temp:
                _cleanup_temp(staged)
            raise HTTPException(400, str(exc))
        return {
            "manifest": manifest,
            "groups": [asdict(group) for group in groups],
            "staging_path": str(staged),
        }

    @router.post("/api/restore/apply")
    def restore_apply(body: RestoreApplyRequest):
        """Unpack the staged archive into the target, apply the re-point mapping,
        then switch the live server to the restored project (as a project switch
        does - the client reloads afterwards)."""
        _guard_idle()
        archive = Path(body.archive_path)
        if not archive.is_file():
            raise HTTPException(
                400, "The backup file is no longer available - start the restore again."
            )
        target = Path(body.target_dir).expanduser()
        try:
            db_path = restore_into(archive, target, overwrite=body.overwrite)
        except ProjectExistsError as exc:
            # Structured 409 so the UI can offer "replace it?" rather than parsing
            # the message (analysis-in-flight is also 409 but with a plain string).
            raise HTTPException(409, detail={"code": "project_exists", "message": str(exc)})
        except RestoreError as exc:
            raise HTTPException(400, str(exc))

        repoint = apply_repoint(db_path, body.mapping)

        target = target.resolve()
        ctx.switch_project(target)
        redirect_logging(target)
        from yuu_clip.web.app import prepare_project
        prepare_project(ctx)
        record_known_project(target)
        _log.info(
            "Restored + switched to %s (remapped=%d still_missing=%d skipped_groups=%d)",
            target, repoint.remapped, repoint.still_missing, repoint.skipped_groups,
        )

        if _is_staged_temp(archive):
            _cleanup_temp(archive)

        return {
            "current": str(target),
            "project_generation": ctx.project_generation,
            "repoint": asdict(repoint),
        }

    return router


async def _stage_archive(request: Request, archive_path: Optional[str]) -> tuple[Path, bool]:
    """Return (archive_path, is_temp). Electron passes a server-side path we use in
    place; the browser POSTs raw bytes we save to a temp staging file."""
    if archive_path:
        path = Path(archive_path).expanduser()
        if not path.is_file():
            raise HTTPException(400, f"Backup file not found: {archive_path}")
        return path, False
    body = await request.body()
    if not body:
        raise HTTPException(400, "No backup file was uploaded.")
    staged = Path(tempfile.gettempdir()) / f"{_STAGING_PREFIX}{uuid4().hex}.zip"
    staged.write_bytes(body)
    return staged, True


def _is_staged_temp(path: Path) -> bool:
    """Whether *path* is one of our own temp staging uploads (never a user's own
    backup file), so apply only ever deletes files it created."""
    return (
        path.parent == Path(tempfile.gettempdir())
        and path.name.startswith(_STAGING_PREFIX)
    )


def _cleanup_temp(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:  # noqa: BLE001 - a lingering temp file is not fatal
        _log.warning("Could not remove temp backup file %s: %s", path, exc)
