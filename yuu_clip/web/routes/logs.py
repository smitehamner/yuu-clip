# Feature-map — Application log download (send-to-developer)
#   UI: index.html footer "Download log" link (no dedicated JS module)
#   Siblings: yuu_clip/log.py · web/sse.py (subprocess stdout capture)
"""
Log export route.

Provides a single download endpoint so non-technical users can send the full
application log to the developer when something goes wrong. The log file
includes all server events and the captured stdout of every subprocess
(ingest, export, demo, etc.) that ran during the session.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from yuu_clip.log import log_path_for, recent_log_lines
from yuu_clip.web.deps import ProjectContext


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/logs/export")
    def export_log():
        """Download the application log as a plain-text file attachment."""
        from datetime import datetime
        filename = f"yuu-clip-{datetime.now().strftime('%Y-%m-%d')}.log"

        log_file = log_path_for(ctx.project_dir)
        if log_file.exists():
            return FileResponse(str(log_file), media_type="text/plain", filename=filename)
        content = "\n".join(recent_log_lines()) or "(no log entries yet)"
        return PlainTextResponse(
            content, headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    @router.get("/api/glossary")
    def get_glossary():
        """Return the user-facing terminology glossary as plain-text markdown.

        Served from the bundled static dir (shipped in the wheel) rather than
        docs/dev/GLOSSARY.md, which is dev-only and not packaged. The dev
        glossary stays the authoritative source; this is its creator-facing copy.
        """
        glossary = Path(__file__).parent.parent / "static" / "glossary.md"
        if not glossary.exists():
            raise HTTPException(404, "Glossary not found")
        return PlainTextResponse(glossary.read_text(encoding="utf-8"))

    return router
