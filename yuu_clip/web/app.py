"""
yuu-clip web UI - application factory.

Assembles the FastAPI app from domain-specific route modules. All business
logic lives in yuu_clip/web/routes/*; this file is purely wiring.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError

from yuu_clip._build_info import BUILD_DATE as _BUILD_DATE
from yuu_clip.contexts import seed_builtin_contexts
from yuu_clip.log import configure_logging, get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.media import media_file_response, resolve_within
from yuu_clip.web.routes import (
    analyze,
    backup,
    characters,
    clips,
    config,
    content_presets,
    contexts,
    dedup,
    export_presets,
    hotwords,
    imports,
    llm,
    logs,
    models,
    name_corrections,
    profiles,
    projects,
    reel,
    reveal,
    scoring,
    sensitive,
    sessions,
    sounds,
    speakers,
    videos,
    voices,
)
from yuu_clip.web.sse import terminate_process_tree_async

_HERE = Path(__file__).parent
_log  = get_logger(__name__)

_SERVER_START = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

try:
    _PKG_VERSION = _pkg_version("yuu-clip")
except PackageNotFoundError:
    _PKG_VERSION = "unknown"

# ASCII separators only - this string is surfaced via /api/status and gets
# pasted into terminals, where a "·" mojibakes under PowerShell 5.1 / cp1252.
if _BUILD_DATE == "dev":
    _VERSION_DISPLAY = f"{_PKG_VERSION}-dev - started {_SERVER_START}"
else:
    _VERSION_DISPLAY = f"{_PKG_VERSION} - {_BUILD_DATE}"

_ROUTE_MODULES = (
    videos, clips, analyze, profiles, reel, reveal, logs, contexts, config,
    scoring, sounds, speakers, hotwords, sensitive, export_presets, imports,
    projects, sessions, name_corrections, llm, content_presets, models, backup,
    dedup, voices, characters,
)


def _reload_factory() -> FastAPI:
    """App factory for uvicorn --reload mode. Reads project dir from env."""
    proj_dir = Path(os.environ.get("YUU_CLIP_PROJECT", ".")).resolve()
    return create_app(proj_dir)


# Statuses a video can rest in with no analyze job running: not-yet-analyzed
# (pending/probed) or finished (done/failed). Every other status the pipeline
# sets - labeled, extracting, transcribing, transcribed, segmented - is a
# mid-analysis transient. Recovering the complement (rather than a hardcoded
# list of transients) means a newly added transient status can never silently
# strand a recording again.
_VIDEO_RESTING_STATUSES = ("pending", "probed", "done", "failed")


def _fail_interrupted_analyses(ctx: ProjectContext) -> None:
    """Mark videos left mid-analysis by a previous server as failed.

    The analyze subprocess advances a row through several transient statuses
    (labeled -> extracting -> ... -> segmented) before 'done'. If the server
    (and its subprocess) died at any of them - a crash, a kill, or a restart -
    the row is stuck in that transient state with no job to advance it. On
    startup no analysis is running yet, so any row not in a resting status is a
    leftover: flip it to 'failed' so the UI stops showing an eternal spinner and
    the user can re-run it.
    """
    from yuu_clip.db.models import Video

    db = ctx.get_db()
    try:
        stuck = db.query(Video).filter(Video.status.notin_(_VIDEO_RESTING_STATUSES)).all()
        for video in stuck:
            video.status = "failed"
        if stuck:
            db.commit()
            _log.warning(
                "Marked %d interrupted analysis run(s) as failed: video_ids=%s",
                len(stuck), [v.id for v in stuck],
            )
    finally:
        db.close()


def prepare_project(ctx: ProjectContext) -> None:
    """Per-project filesystem + DB setup shared by boot and the in-place project
    switch (routes/projects.py): ensure output dirs, seed built-in contexts,
    fail stuck mid-analysis rows, and drop any stale pause flag."""
    ctx.export_dir.mkdir(parents=True, exist_ok=True)
    ctx.reels_dir.mkdir(parents=True, exist_ok=True)
    seed_builtin_contexts(ctx.project_dir)
    _fail_interrupted_analyses(ctx)
    # A pause flag left by a server that died mid-analysis would otherwise hold
    # the very first video of the next run - the job it belonged to is gone anyway.
    from yuu_clip.analyze.pause import remove_pause_flag
    remove_pause_flag(ctx.project_dir)


def create_app(project_dir: Path) -> FastAPI:
    """Create a FastAPI app bound to *project_dir*.

    Safe to call multiple times (e.g. in tests) - each call returns an
    independent app with its own ProjectContext.
    """
    configure_logging(project_dir)
    _log.info("Starting yuu-clip web server - project: %s", project_dir)

    ctx = ProjectContext(project_dir)
    prepare_project(ctx)
    from yuu_clip.config import record_known_project
    record_known_project(project_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        from yuu_clip.scoring.llamacpp_server import shutdown_server_pool
        shutdown_server_pool()
        procs = []
        job = ctx.analyze_job
        if job is not None and getattr(job, "proc", None) is not None:
            procs.append(job.proc)
        # Every in-flight subprocess_sse proc, not just the single most-recent
        # analyze_proc slot - overlapping jobs would otherwise leave a survivor
        # orphaned, holding the SQLite write lock past shutdown.
        seen = {id(p) for p in procs}
        for proc in [ctx.analyze_proc, *ctx.subprocess_procs]:
            if proc is not None and id(proc) not in seen:
                seen.add(id(proc))
                procs.append(proc)
        for proc in procs:
            if proc.returncode is not None:
                continue
            _log.info("Server shutting down - terminating subprocess (pid %s)", proc.pid)
            await terminate_process_tree_async(proc)
            try:
                await asyncio.wait_for(proc.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                _log.warning("Subprocess did not exit in 5 s - killing")
                proc.kill()
                await proc.wait()

    app = FastAPI(title="yuu-clip", version="0.1.0", lifespan=lifespan)
    app.state.ctx = ctx  # expose for tests and diagnostics

    @app.exception_handler(OperationalError)
    async def _db_operational_error(request: Request, exc: OperationalError):
        # SQLite is single-writer. While an analyze/score subprocess holds the write
        # lock past busy_timeout, a normal user write (approve/reject, speaker merge,
        # caption edit) raises "database is locked" - which without this surfaced as an
        # opaque 500 ("Unknown error (no details from server)"). Turn just that case into
        # an actionable 503; any other OperationalError stays a logged 500.
        detail = str(getattr(exc, "orig", exc)).lower()
        if "locked" in detail or "busy" in detail:
            _log.warning("DB busy on %s %s - returning 503", request.method, request.url.path)
            return JSONResponse(
                status_code=503,
                content={"detail": "The database is busy right now - an analysis or "
                                   "another job is writing to it. Wait a moment and try again."},
            )
        _log.error("Database error on %s %s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "A database error occurred. Check the log for details."},
        )

    @app.exception_handler(Exception)
    async def _unhandled_error(request: Request, exc: Exception):
        # FastAPI's default 500 returns a bare plaintext "Internal Server Error" body,
        # which the UI cannot parse a detail from - so a failed action (e.g. Remove
        # Recording) showed the opaque "Unknown error (no details from server)". Return
        # JSON with a detail naming the exception type so the toast is actionable and the
        # real traceback is always logged. More specific handlers (HTTPException,
        # OperationalError) still win; this only catches the otherwise-unhandled 500s.
        _log.error(
            "Unhandled error on %s %s", request.method, request.url.path, exc_info=exc
        )
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(exc).__name__}: {exc}. Check the log for details."},
        )

    @app.get("/", response_class=HTMLResponse)
    async def index():
        return FileResponse(_HERE / "static" / "index.html")

    @app.get("/api/version")
    async def version():
        return JSONResponse({"version": _VERSION_DISPLAY})

    app.mount(
        "/static",
        StaticFiles(directory=str(_HERE / "static")),
        name="static",
    )

    # Exports and reels are served with a share-delete handle (see web/media.py) so
    # the file can be deleted while a <video> is still streaming it. StaticFiles holds
    # a plain read handle for the whole response and would lock the file on Windows.
    @app.get("/media/exports/{filename:path}")
    def serve_export(filename: str, request: Request):
        return media_file_response(resolve_within(ctx.export_dir, filename), request)

    @app.get("/media/reels/{filename:path}")
    def serve_reel(filename: str, request: Request):
        return media_file_response(resolve_within(ctx.reels_dir, filename), request)

    for module in _ROUTE_MODULES:
        app.include_router(module.make_router(ctx))

    return app
