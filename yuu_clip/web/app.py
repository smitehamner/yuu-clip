"""
yuu-clip web UI — application factory.

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
from yuu_clip.web.routes import analyze, clips, config, contexts, logs, profiles, reel, scoring, videos
from yuu_clip.web.sse import terminate_process_tree

_HERE = Path(__file__).parent
_log  = get_logger(__name__)

_SERVER_START = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

try:
    _PKG_VERSION = _pkg_version("yuu-clip")
except PackageNotFoundError:
    _PKG_VERSION = "unknown"

if _BUILD_DATE == "dev":
    _VERSION_DISPLAY = f"{_PKG_VERSION}-dev · started {_SERVER_START}"
else:
    _VERSION_DISPLAY = f"{_PKG_VERSION} · {_BUILD_DATE}"

_ROUTE_MODULES = (videos, clips, analyze, profiles, reel, logs, contexts, config, scoring)


def _reload_factory() -> FastAPI:
    """App factory for uvicorn --reload mode. Reads project dir from env."""
    proj_dir = Path(os.environ.get("YUU_CLIP_PROJECT", ".")).resolve()
    return create_app(proj_dir)


def create_app(project_dir: Path) -> FastAPI:
    """Create a FastAPI app bound to *project_dir*.

    Safe to call multiple times (e.g. in tests) — each call returns an
    independent app with its own ProjectContext.
    """
    configure_logging(project_dir)
    _log.info("Starting yuu-clip web server — project: %s", project_dir)

    ctx = ProjectContext(project_dir)
    ctx.export_dir.mkdir(parents=True, exist_ok=True)
    ctx.reels_dir.mkdir(parents=True, exist_ok=True)
    seed_builtin_contexts(project_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        proc = ctx.analyze_proc
        if proc is not None and proc.returncode is None:
            _log.info("Server shutting down — terminating analyze subprocess (pid %s)", proc.pid)
            terminate_process_tree(proc)
            try:
                await asyncio.wait_for(proc.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                _log.warning("Subprocess did not exit in 5 s — killing")
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
