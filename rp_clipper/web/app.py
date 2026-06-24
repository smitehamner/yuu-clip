"""
rp-clipper web UI — application factory.

Assembles the FastAPI app from domain-specific route modules. All business
logic lives in rp_clipper/web/routes/*; this file is purely wiring.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from rp_clipper.log import configure_logging, get_logger
from rp_clipper.web.deps import ProjectContext
from rp_clipper.web.routes import demo, ingest, logs, profiles, videos

_HERE = Path(__file__).parent
_log  = get_logger(__name__)

_ROUTE_MODULES = (videos, ingest, profiles, demo, logs)


def create_app(project_dir: Path) -> FastAPI:
    """Create a FastAPI app bound to *project_dir*.

    Safe to call multiple times (e.g. in tests) — each call returns an
    independent app with its own ProjectContext.
    """
    configure_logging(project_dir)
    _log.info("Starting rp-clipper web server — project: %s", project_dir)

    ctx = ProjectContext(project_dir)
    ctx.export_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="rp-clipper", version="0.1.0")

    @app.get("/", response_class=HTMLResponse)
    async def index():
        return FileResponse(_HERE / "static" / "index.html")

    app.mount(
        "/media/exports",
        StaticFiles(directory=str(ctx.export_dir), html=False),
        name="exports",
    )

    for module in _ROUTE_MODULES:
        app.include_router(module.make_router(ctx))

    return app
