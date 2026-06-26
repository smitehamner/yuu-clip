"""
Shared context for the yuu-clip web server.

ProjectContext is constructed once per create_app() call and closed over by
every route handler. It holds all derived project paths and provides a DB
session factory, so individual route modules never need to recompute paths.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from yuu_clip.config import Config
from yuu_clip.db.models import make_engine


class ProjectContext:
    """Resolved paths and factories for a single yuu-clip project directory."""

    def __init__(self, project_dir: Path) -> None:
        self.project_dir = project_dir
        self.data_dir    = project_dir / ".yuu-clip"
        self.db_path     = self.data_dir / "project.db"
        self.export_dir  = self.data_dir / "exports"
        self.reels_dir   = self.data_dir / "reels"
        self.audio_dir   = self.data_dir / "audio"

        self.config = Config.load(project_dir)

        # Engine is created once so create_all / _migrate only run at startup,
        # not on every API request (which could race with the ingest subprocess).
        self._engine         = make_engine(self.db_path)
        self._Session        = sessionmaker(bind=self._engine)

        # Transient state shared between paired start→events SSE endpoints.
        # Only one ingest or demo job can be queued at a time (single-user tool).
        self.ingest_cmd:       list[str] | None = None
        self.demo_cmd:         list[str] | None = None
        self.ingest_proc:      object | None    = None  # asyncio.subprocess.Process
        self.ingest_cancelled: bool             = False
        # Count of in-process SSE jobs currently streaming (rescore, timeline, summarize).
        self.active_jobs:      int              = 0

    def get_db(self) -> Session:
        """Open a new SQLAlchemy session against this project's database."""
        return self._Session()
