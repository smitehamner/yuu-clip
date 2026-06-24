"""
Log export route.

Provides a single download endpoint so non-technical users can send the full
application log to the developer when something goes wrong. The log file
includes all server events and the captured stdout of every subprocess
(ingest, export, demo, etc.) that ran during the session.
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse, PlainTextResponse

from rp_clipper.log import log_path_for, recent_log_lines
from rp_clipper.web.deps import ProjectContext


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/logs/export")
    def export_log():
        """Download the application log as a plain-text file attachment."""
        from datetime import datetime
        filename = f"rp-clipper-{datetime.now().strftime('%Y-%m-%d')}.log"

        log_file = log_path_for(ctx.project_dir)
        if log_file.exists():
            return FileResponse(str(log_file), media_type="text/plain", filename=filename)
        content = "\n".join(recent_log_lines()) or "(no log entries yet)"
        return PlainTextResponse(
            content, headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    return router
