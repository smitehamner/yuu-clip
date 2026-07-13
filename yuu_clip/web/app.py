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

from yuu_clip._build_info import BUILD_DATE as _BUILD_DATE
from yuu_clip.contexts import seed_builtin_contexts
from yuu_clip.log import configure_logging, get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.media import media_file_response, resolve_within
from yuu_clip.web.routes import (
    analyze,
    backup,
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
from yuu_clip.web.sse import terminate_process_tree

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
    dedup, voices,
)


def _reload_factory() -> FastAPI:
    """App factory for uvicorn --reload mode. Reads project dir from env."""
    proj_dir = Path(os.environ.get("YUU_CLIP_PROJECT", ".")).resolve()
    return create_app(proj_dir)


def _fail_interrupted_analyses(ctx: ProjectContext) -> None:
    """Mark videos left mid-analysis by a previous server as failed.

    A running analyze subprocess sets status='extracting' for the long
    extract→transcribe phase. If the server (and its subprocess) died there -
    a crash, a kill, or a restart - the row is stuck in that transient state
    with no job to advance it. On startup no analysis is running yet, so any
    such row is a leftover: flip it to 'failed' so the UI stops showing an
    eternal spinner and the user can re-run it.
    """
    from yuu_clip.db.models import Video

    db = ctx.get_db()
    try:
        stuck = db.query(Video).filter(Video.status == "extracting").all()
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
    clear stuck 'extracting' rows, and drop any stale pause flag."""
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
        if ctx.analyze_proc is not None:
            procs.append(ctx.analyze_proc)
        for proc in procs:
            if proc.returncode is not None:
                continue
            _log.info("Server shutting down - terminating subprocess (pid %s)", proc.pid)
            terminate_process_tree(proc)
            try:
                await asyncio.wait_for(proc.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                _log.warning("Subprocess did not exit in 5 s - killing")
                proc.kill()
                await proc.wait()

    app = FastAPI(title="yuu-clip", version="0.1.0", lifespan=lifespan)
    app.state.ctx = ctx  # expose for tests and diagnostics

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
