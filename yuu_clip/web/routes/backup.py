# Feature-map - Project backup / restore (code: backup)
#   UI: static/settings/settings-backup.js
#   Siblings: project_archive.py (archive + re-point core) · routes/projects.py (switch, restore reuses it)
#   Tests: tests/integration/test_backup.py, tests/integration/test_restore.py
"""Project backup / restore routes.

Backup: POST /api/backup builds a portable zip of the project's .yuu-clip state
(see project_archive.build_backup) and returns it as a download, or writes it to a
caller-supplied path (the Electron save dialog) - unchanged, synchronous, no
progress. GET /api/backup/events is the progress-reporting path the Settings UI
actually uses: it runs the same build off the request thread, streams
"Zipped i/total files" log lines plus a typed done event, and hands back a
one-time download token (ctx.pending_backups) that GET /api/backup/download/
<token> then serves as the file, deleting it afterwards.

Restore is two steps so the user can review before anything is written:
  POST /api/restore/inspect  -> stage the archive, return manifest + the source
                                dirs that don't resolve on this machine (no commit)
  POST /api/restore/apply    -> unpack into the target, re-point mapped dirs, then
                                switch the live server to the restored project

Uploads use the raw request body (no python-multipart, matching routes/sounds.py);
Electron passes a server-side archive_path instead of uploading bytes.
"""
from __future__ import annotations

import asyncio
import tempfile
import time
from dataclasses import asdict
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from yuu_clip.log import get_logger, redirect_logging
from yuu_clip.project_archive import (
    ProjectExistsError,
    RestoreError,
    apply_repoint,
    build_backup,
    plan_repoint_from_archive,
    restore_into,
)
from yuu_clip.recent_projects import record_known_project
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.jobevents import OUTCOME_ERROR, OUTCOME_OK, done_event, log_event, result_event
from yuu_clip.web.routes.common import active_job, analyze_in_flight, sse_response

_log = get_logger(__name__)

_STAGING_PREFIX = "yuu-restore-"
_BACKUP_PROGRESS_POLL_S = 0.2
# A pending_backups entry this old was never claimed (the client disconnected in
# the narrow window after the zip finished but before it fetched the download) -
# swept opportunistically so its temp file doesn't linger in %TEMP% forever.
_STALE_PENDING_BACKUP_S = 30 * 60


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
        # Same busy check as /api/projects/switch: restore_apply rebinds ctx in
        # place, so ANY running job (rescore, timeline, proxy encode) would keep
        # writing into the restored project's database mid-switch.
        if analyze_in_flight(ctx) or ctx.active_jobs > 0 or ctx.proxy_generating:
            raise HTTPException(
                409,
                "A job is still running - wait for it to finish or cancel it "
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

    @router.get("/api/backup/events")
    def backup_events():
        """Build the backup off the request thread while streaming progress.

        Ends with a typed result event carrying a one-time download token; the
        client follows up with GET /api/backup/download/<token> to get the file.
        Aborting this stream (client-only soft-cancel, same as every other
        in-process job) detaches the UI but does not stop the background zip -
        it finishes and is discarded by _discard_orphaned_backup, matching the
        Cancel semantics of rescore-all/redescribe-all/etc.
        """
        _guard_idle()
        _reap_stale_pending_backups(ctx)
        token = uuid4().hex
        dest_path = Path(tempfile.gettempdir()) / f"yuu-backup-{token}.zip"

        async def event_stream():
            async with active_job(ctx):
                yield log_event("Building project backup…")
                loop = asyncio.get_running_loop()
                progress = {"done": 0, "total": 0}

                def on_progress(done: int, total: int) -> None:
                    progress["done"], progress["total"] = done, total

                future = loop.run_in_executor(
                    None, build_backup, ctx.project_dir, dest_path, on_progress
                )
                last = (0, 0)
                try:
                    while not future.done():
                        await asyncio.sleep(_BACKUP_PROGRESS_POLL_S)
                        current = (progress["done"], progress["total"])
                        if current != last and current[1]:
                            yield log_event(f"Zipped {current[0]}/{current[1]} files")
                            last = current
                except asyncio.CancelledError:
                    future.add_done_callback(_discard_orphaned_backup)
                    raise

                try:
                    archive_path = future.result()
                except Exception as exc:  # noqa: BLE001 - reported to the client, not swallowed
                    _log.exception("Project backup failed")
                    yield done_event(OUTCOME_ERROR, str(exc))
                    return
                ctx.pending_backups[token] = archive_path
                yield result_event({"token": token, "filename": archive_path.name})
                yield done_event(OUTCOME_OK)

        return sse_response(event_stream())

    @router.get("/api/backup/download/{token}")
    def backup_download(token: str):
        archive_path = ctx.pending_backups.pop(token, None)
        if archive_path is None or not archive_path.is_file():
            raise HTTPException(404, "That backup is no longer available - build a new one.")
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
            # Not every RestoreError is logged at its raise site (e.g. a schema-
            # version mismatch isn't) - log here too so every rejected restore has
            # a trace regardless of which check inside plan_repoint_from_archive
            # fired, without double-logging the ones that already do.
            _log.warning("Restore inspect rejected %s: %s", staged, exc)
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
            # Routine, expected flow (the user will likely retry with overwrite),
            # not a failure - info level, not warning.
            _log.info("Restore apply into %s needs overwrite confirmation: %s", target, exc)
            # Structured 409 so the UI can offer "replace it?" rather than parsing
            # the message (analysis-in-flight is also 409 but with a plain string).
            raise HTTPException(409, detail={"code": "project_exists", "message": str(exc)})
        except RestoreError as exc:
            _log.warning("Restore apply into %s rejected: %s", target, exc)
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


def _reap_stale_pending_backups(ctx) -> None:
    """Delete + drop any pending_backups entry a client never claimed.

    A client can disconnect in the narrow window after the zip finished (so the
    token is already registered) but before its download fetch lands - opportunistic
    since there is no scheduler here; each new backup sweeps the leftovers of any
    earlier one."""
    now = time.time()
    for token, path in list(ctx.pending_backups.items()):
        try:
            stale = (now - path.stat().st_mtime) > _STALE_PENDING_BACKUP_S
        except OSError:
            stale = True
        if stale:
            ctx.pending_backups.pop(token, None)
            _cleanup_temp(path)


def _discard_orphaned_backup(future) -> None:
    """Delete the zip a cancelled /api/backup/events client never claimed.

    A thread-pool future already running can't be interrupted, so a client-only
    soft-cancel just detaches the SSE stream - the zip keeps writing in the
    background. This done-callback (registered only on that cancel path) throws
    away the result once the thread actually finishes, instead of leaking the
    temp file."""
    try:
        archive_path = future.result()
    except Exception as exc:  # noqa: BLE001 - the backup was abandoned either way
        _log.warning("Cancelled project backup's background zip also failed: %s", exc)
        return
    _cleanup_temp(archive_path)
