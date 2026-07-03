"""
Shared context for the yuu-clip web server.

ProjectContext is constructed once per create_app() call and closed over by
every route handler. It holds all derived project paths and provides a DB
session factory, so individual route modules never need to recompute paths.
"""
from __future__ import annotations

from collections import OrderedDict
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
        self.proxy_dir   = self.data_dir / "proxies"

        self.config = Config.load(project_dir)

        # Engine is created once so create_all / _migrate only run at startup,
        # not on every API request (which could race with the analyze subprocess).
        self._engine         = make_engine(self.db_path)
        self._Session        = sessionmaker(bind=self._engine)

        # Transient state shared between paired start→events SSE endpoints.
        # Only one analyze or demo job can be queued at a time (single-user tool).
        self.analyze_cmd:       list[str] | None = None
        self.demo_cmd:          list[str] | None = None
        self.analyze_proc:      object | None    = None  # asyncio.subprocess.Process
        self.analyze_cancelled: bool             = False

        # /api/analyze/start records the file/target for the queued command so
        # /api/analyze/events can attach that identity to the AnalyzeJob it launches
        # (used by /api/status to tell a reconnecting page which recording is running).
        self.analyze_pending_filename: str | None = None
        self.analyze_pending_video_id: int | None = None

        # The live (or most-recently-finished) reattachable analyze job. Unlike the
        # short subprocess_sse jobs, its lifecycle is decoupled from any HTTP stream
        # so a browser refresh can reconnect mid-analysis. See web/analyze_job.py.
        self.analyze_job: object | None = None  # AnalyzeJob
        # Count of in-process SSE jobs currently streaming (rescore, timeline, summarize).
        self.active_jobs:      int              = 0

        # LRU cache of on-disk clip preview files keyed by clip_id. Scoped to this
        # context so concurrent create_app() instances (e.g. in tests) never share state.
        self.preview_cache: OrderedDict[int, Path] = OrderedDict()

        # Resolved source paths whose 720p preview proxy is currently being encoded,
        # so a second open of the same recording does not launch a duplicate encode.
        self.proxy_generating: set[str] = set()

        # GPU thermal monitoring — one lazily-initialised monitor per project context
        # (pynvml init is not free); the analyze job lifecycle owns a fresh
        # ThermalTrigger (streak/hysteresis state) per run. See analyze/thermal.py.
        from yuu_clip.analyze.thermal import GpuThermalMonitor
        self.thermal_monitor = GpuThermalMonitor()

    def get_db(self) -> Session:
        """Open a new SQLAlchemy session against this project's database."""
        return self._Session()
