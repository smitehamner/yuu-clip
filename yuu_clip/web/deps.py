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
        # GPU thermal monitoring - one lazily-initialised monitor per project context
        # (pynvml init is not free); the analyze job lifecycle owns a fresh
        # ThermalTrigger (streak/hysteresis state) per run. See analyze/thermal.py.
        # Project-independent hardware state, so it is created once and kept across
        # in-place project switches.
        from yuu_clip.analyze.thermal import GpuThermalMonitor
        self.thermal_monitor = GpuThermalMonitor()

        # Bumped on every in-place switch_project so clients (and /api/status) can
        # detect that the server is now serving a different project.
        self.project_generation = 0

        self._bind_project(project_dir)

    def _bind_project(self, project_dir: Path) -> None:
        self.project_dir = project_dir
        self.data_dir    = project_dir / ".yuu-clip"
        self.db_path     = self.data_dir / "project.db"
        self.export_dir  = self.data_dir / "exports"
        self.reels_dir   = self.data_dir / "reels"
        self.audio_dir   = self.data_dir / "audio"
        self.proxy_dir   = self.data_dir / "proxies"

        # make_engine opens (and creates) the SQLite file, which fails if the
        # parent dir is absent - true when switching to a project that has never
        # been opened. On first boot configure_logging already created it.
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.config = Config.load(project_dir)

        # Engine is created once so create_all only runs at startup, not on every
        # API request (which could race with the analyze subprocess).
        self._engine         = make_engine(self.db_path)
        self._Session        = sessionmaker(bind=self._engine)

        # Transient state shared between paired start→events SSE endpoints.
        # Only one analyze or demo job can be queued at a time (single-user tool).
        self.analyze_cmd:       list[str] | None = None
        self.demo_cmd:          list[str] | None = None
        self.import_cmd:        list[str] | None = None
        self.analyze_proc:      object | None    = None  # asyncio.subprocess.Process
        self.import_cancelled:  bool             = False
        # Set by the frame-analysis cancel endpoint so subprocess_sse emits the
        # cancel message (not a generic error) when the killed subprocess exits.
        self.frames_cancelled:  bool             = False

        # Every in-flight subprocess_sse process (export, retranscribe, stage
        # re-runs, reel demo, URL import). analyze_proc is a single "most-recent,
        # cancelable" slot that overlapping jobs clobber; this set is the complete
        # set the lifespan must terminate so an overlapped job is never orphaned
        # (a survivor keeps the SQLite write lock past shutdown). See web/sse.py.
        self.subprocess_procs:  set              = set()

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

        # subprocess_sse jobs (export/score/reel/retranscribe/...) that currently
        # hold an active_jobs increment, keyed by the proc object. A cancel can
        # release a job's slot deterministically (see routes/analyze.py cancel and
        # sse.release_counted_job) instead of waiting on the SSE generator's finally,
        # which only runs when the abandoned async generator is garbage-collected -
        # the client closes its stream the instant it POSTs cancel, so Starlette
        # never aclose()s it. Membership makes the release idempotent: cancel and the
        # generator's own later cleanup can both fire without the counter latching
        # high or going negative.
        self.counted_procs:    set              = set()

        # LRU cache of on-disk clip preview files keyed by clip_id. Scoped to this
        # context so concurrent create_app() instances (e.g. in tests) never share state.
        self.preview_cache: OrderedDict[int, Path] = OrderedDict()

        # Resolved source paths whose 720p preview proxy is currently being encoded,
        # so a second open of the same recording does not launch a duplicate encode.
        self.proxy_generating: set[str] = set()

        # Shared "a required model is downloading right now" registry, keyed by a
        # logical model kind ("llm" for the background local-model handoff; Stage 6
        # adds "whisper"). The value is the catalog model id being fetched. This is
        # the single source of truth both the download banner and the analyze
        # coordination read - the download route registers/deregisters the key
        # around its SSE stream, and it also guards against a duplicate download.
        self.model_downloads: dict[str, str] = {}

    def reload_config(self) -> None:
        """Re-read config.json from disk into ``self.config``.

        A model-download subprocess writes ``llm_model_path`` straight to
        config.json; the running server's in-memory config would otherwise stay
        stale until a restart. Reloading picks up that write (and any other
        on-disk change) without hand-rolling a second config source of truth.
        """
        self.config = Config.load(self.project_dir)

    def switch_project(self, project_dir: Path) -> None:
        """Tear down the current project's resources and rebind to *project_dir*
        in place, bumping project_generation.

        Every route handler closure-captures this object, so the swap mutates it
        rather than replacing it. thermal_monitor is deliberately kept - it is
        project-independent hardware state. Callers must have already refused the
        switch while any job is running (see routes/projects.py).
        """
        self._dispose_project_resources()
        self._bind_project(project_dir)
        self.project_generation += 1

    def _dispose_project_resources(self) -> None:
        for cached in self.preview_cache.values():
            cached.unlink(missing_ok=True)
        self.preview_cache.clear()
        self._engine.dispose()

    def get_db(self) -> Session:
        """Open a new SQLAlchemy session against this project's database."""
        return self._Session()
