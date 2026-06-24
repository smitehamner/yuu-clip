"""
Shared context for the rp-clipper web server.

ProjectContext is constructed once per create_app() call and closed over by
every route handler. It holds all derived project paths and provides a DB
session factory, so individual route modules never need to recompute paths.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from rp_clipper.db.models import make_session


class ProjectContext:
    """Resolved paths and factories for a single rp-clipper project directory."""

    def __init__(self, project_dir: Path) -> None:
        self.project_dir = project_dir
        self.data_dir    = project_dir / ".rp-clipper"
        self.db_path     = self.data_dir / "project.db"
        self.export_dir  = self.data_dir / "exports"
        self.audio_dir   = self.data_dir / "audio"

        # Transient state shared between paired start→events SSE endpoints.
        # Only one ingest or demo job can be queued at a time (single-user tool).
        self.ingest_cmd: list[str] | None = None
        self.demo_cmd:   list[str] | None = None

    def get_db(self) -> Session:
        """Open a new SQLAlchemy session against this project's database."""
        return make_session(self.db_path)
