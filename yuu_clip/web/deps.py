"""
Shared context for the yuu-clip web server.

ProjectContext is constructed once per create_app() call and closed over by
every route handler. It holds all derived project paths and provides a DB
session factory, so individual route modules never need to recompute paths.
"""
from __future__ import annotations

import threading
from collections import OrderedDict
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from yuu_clip.config import Config, strip_global_only_keys_from_project
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

        # One-time heal for installs written by the old full-dump save, which froze
        # global-only keys (export_presets) into the project layer and masked later
        # global changes. Runs once per project open, before the merged load below,
        # so non-technical users are fixed automatically. Kept out of Config.load
        # (also used by the download subprocess + tests) to keep that a pure read.
        strip_global_only_keys_from_project(project_dir)

        self.config = Config.load(project_dir)

        # Bring the DB to the latest schema revision (after a timestamped backup when
        # a migration is pending) BEFORE make_engine's create_all runs - a future
        # migration that adds a whole new table must win over create_all, not race it.
        # This is the single server-side migrate choke point: it covers first boot,
        # in-place project switch, and restore, since all rebind through here. The
        # analyze subprocess never constructs a ProjectContext, so it never migrates -
        # it opens the DB only after the server has already brought it to head. Raises
        # MigrationError on a failed upgrade so the server refuses to serve on a
        # half-migrated DB (the backup is preserved).
        from yuu_clip.db.migrate import run_startup_migrations
        run_startup_migrations(self.db_path, self.config)

        # Cached result of the llama-server Vulkan device probe (see
        # llm_gpu_available below) - None means "not probed yet" or "inconclusive",
        # so it is retried; True/False are cached to avoid re-spawning
        # `llama-server --list-devices` on every /api/status poll. Reset here so a
        # project switch or config reload (a different llama-server binary/model
        # path) re-probes instead of reusing a stale result.
        self._llm_gpu_probe: bool | None = None

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
        # Which job currently owns analyze_proc (e.g. "import", "frames"); None for
        # callers that don't identify themselves. Lets a job-specific cancel endpoint
        # (cancel_import, cancel_analyze_frames) confirm it's killing its own job
        # rather than whatever unrelated job happens to hold the shared slot.
        self.analyze_proc_kind: str | None = None

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

        # Procs a cancel endpoint has killed by user request, keyed by the process
        # instance. subprocess_sse's tail checks membership (then discards) to pick
        # outcome="cancelled" over the generic error line. Because it is keyed to the
        # proc identity - not a server-scoped boolean flag - a stale entry from an
        # earlier job can never mark a later, different proc as cancelled, so every
        # subprocess job can now report a typed cancel without leaking into the next.
        # Discarded on read and in the stream's finally, so it never grows unbounded.
        self.cancelled_procs:  set              = set()

        # LRU cache of on-disk clip preview files keyed by clip_id. Scoped to this
        # context so concurrent create_app() instances (e.g. in tests) never share state.
        self.preview_cache: OrderedDict[int, Path] = OrderedDict()

        # Resolved source paths whose 720p preview proxy is currently being encoded,
        # so a second open of the same recording does not launch a duplicate encode.
        self.proxy_generating: set[str] = set()

        # The FFmpeg subprocess.Popen currently encoding each source's proxy (see
        # analyze/proxy.py's generate_proxy), keyed the same way as proxy_generating,
        # so a cancel endpoint can terminate the in-flight encode. Absent between the
        # NVENC and libx264 fallback attempts and once the encode ends.
        self.proxy_procs: dict[str, object] = {}

        # threading.Event signaling a cancel request for a source's in-flight proxy
        # encode - checked inside generate_proxy so a killed encode raises
        # ProxyCancelled instead of retrying the libx264 fallback.
        self.proxy_cancel_events: dict[str, threading.Event] = {}

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
        self._llm_gpu_probe = None

    def llm_gpu_available(self) -> bool | None:
        """Cached: can llama-server find a GPU device to offload to right now?

        None means unknown/inapplicable (llm_use_gpu is off, or no server binary
        is resolvable yet) - the header GPU-warning chip treats None as "don't
        warn". The underlying probe spawns a subprocess
        (`llama-server --list-devices`), so the result is cached per project/config
        generation rather than re-run on every /api/status poll.
        """
        if not self.config.llm_use_gpu:
            return None
        if self._llm_gpu_probe is None:
            from yuu_clip.scoring.llamacpp_server import gpu_offload_available
            self._llm_gpu_probe = gpu_offload_available(self.config)
        return self._llm_gpu_probe

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
