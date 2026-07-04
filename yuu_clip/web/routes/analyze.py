"""
Analysis-pipeline routes.

Covers the full analyze workflow from file selection through to clip export:
  - Native OS file picker
  - Video probe (duration, streams, fps)
  - Processing-time estimates
  - Ingest job start + SSE progress stream
  - Re-score all
  - Single-clip export
  - Single-clip retranscription

Long-running operations follow a start→events pattern: the POST endpoint
queues a CLI command on the shared ProjectContext, and the paired GET endpoint
streams that command's stdout as SSE.
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import statistics
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from yuu_clip.config import validate_whisper_model
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes._shared import (
    _analyze_in_flight,
    _reject_if_analyzing,
    _validate_export_preset_query,
)
from yuu_clip.web.sse import subprocess_sse, terminate_process_tree

_log = get_logger(__name__)


def _analyze_running(ctx: ProjectContext) -> bool:
    """Whether an analyze operation is currently in flight, across both the
    reattachable AnalyzeJob (ctx.analyze_job) and the legacy bare-subprocess
    tracking (ctx.analyze_proc) that other short jobs still use."""
    return _analyze_in_flight(ctx)

# Optional packages installable from Settings. _INSTALLABLE maps a UI slug to its
# pip package name(s); _IMPORT_NAMES maps the slug to the import module name(s)
# used to detect whether it is already present (pip name ≠ import name for some).
_INSTALLABLE: dict[str, str | list[str]] = {
    "pyannote":    "pyannote.audio",
    "llamacpp":    "llama-cpp-python",
    "anthropic":   "anthropic",
    "laugh-deps":  ["transformers", "torch", "torchaudio", "soundfile"],
    "cuda-libs":   ["nvidia-cublas-cu12", "nvidia-cudnn-cu12"],
}
_IMPORT_NAMES: dict[str, list[str]] = {
    "pyannote":    ["pyannote.audio"],
    "llamacpp":    ["llama_cpp"],
    "anthropic":   ["anthropic"],
    "laugh-deps":  ["transformers", "torch", "torchaudio", "soundfile"],
    "cuda-libs":   ["nvidia.cublas", "nvidia.cudnn"],
}

# ── Whisper real-time speed ratios ──────────────────────────────────────────
# Seconds of video processed per second of wall-clock time. Recalibrated against
# real analyze_run_json timings across 0.5h–7.9h recordings on this GPU (single
# transcribed track, cuda float16): base ≈20×, medium ≈9–29× (wide, speech-density
# dependent — kept conservative), large-v3 ≈4× (one short overhead-heavy sample).
_WHISPER_GPU_SPEED: dict[str, float] = {
    "large-v3": 5, "large-v2": 5, "large": 5,
    "medium": 15, "small": 17, "base": 20, "tiny": 35,
}
_WHISPER_CPU_SPEED = 0.4  # large-v3 on CPU; other models scale similarly

_SCENE_COST_FRACTION = {"transcript": 0.0, "fast": 0.005, "full": 0.6}
_SCENE_FAST_FLOOR_S  = 10.0  # ffprobe cold-start minimum for "fast" mode

_SCENE_MODE_LABELS = {
    "transcript": "silence gaps only",
    "fast":       "keyframes + transcript gaps",
    "full":       "full frame scan (slow)",
}

# Audio energy: (wall-clock fraction of source duration, display label).
# With the numpy vectorised implementation the bottleneck is disk I/O, so
# fast and full are close; the real difference is transient resolution.
_ENERGY_MODE: dict[str, tuple[float, str]] = {
    "none": (0.0,   "skipped"),
    "fast": (0.002, "4 kHz numpy"),
    "full": (0.005, "16 kHz numpy"),
}

# Speaker diarization (pyannote): seconds of audio processed per second of
# wall-clock, per transcribed track. GPU recalibrated to ~20× from real runs
# (~4.9% of video duration on long recordings); kept slightly conservative at 18
# since short recordings pay a fixed model-load overhead this linear model omits.
# CPU reflects the FEATURES-documented ~2–4× real-time floor.
_DIARIZATION_RT_SPEED = {"gpu": 18.0, "cpu": 3.0}

# ── Measured-rate estimate (from past analyze_run_json timings) ────────────
# StageRecorder stage names (yuu_clip/cli/_run_meta.py) this estimator can use.
# "Score" is one combined energy+scenes+LLM-scoring pass (see _pipeline._run_scoring) —
# there is no per-substage timing, so it grounds only the "LLM scoring" display step
# (energy/scene detection keep their static, mode-driven formulas).
_STAGE_NAME_TO_KEY = {
    "Extract":    "extract",
    "Transcribe": "transcribe",
    "Speakers":   "speakers",
    "Summarize":  "summarize",
    "Score":      "score",
}
_MEASURED_SAMPLE_LIMIT = 10  # most-recent completed runs considered
_MEASURED_MIN_SAMPLES  = 2   # matching samples required before trusting the median


def _measured_rates(db, model: str, has_gpu: bool) -> dict[str, float]:
    """Median seconds-of-processing per second-of-video, per pipeline stage,
    from the last _MEASURED_SAMPLE_LIMIT completed runs whose recorded model
    and device match the requested run — a model or device change would
    otherwise poison the estimate with an unrelated speed.

    A stage key is only returned once at least _MEASURED_MIN_SAMPLES matching
    runs recorded it; callers fall back to the static formula otherwise.
    """
    from yuu_clip.db.models import Video

    rows = (
        db.query(Video.analyze_run_json, Video.duration_ms)
        .filter(Video.analyze_run_json.isnot(None), Video.duration_ms > 0)
        .order_by(Video.processed_at.desc())
        .limit(_MEASURED_SAMPLE_LIMIT)
        .all()
    )
    samples: dict[str, list[float]] = {}
    for run_json, duration_ms in rows:
        try:
            run = json.loads(run_json)
            settings = run["settings"]
            device = run["device"]
            stages = run["stages"]
        except (TypeError, ValueError, KeyError):
            continue  # malformed/legacy run_json — skip, never raise
        if settings.get("model") != model or bool(device.get("has_gpu")) != has_gpu:
            continue
        duration_s = duration_ms / 1000
        for stage in stages:
            key = _STAGE_NAME_TO_KEY.get(stage.get("name"))
            seconds = stage.get("seconds")
            if key is None or not isinstance(seconds, (int, float)) or seconds < 0:
                continue
            samples.setdefault(key, []).append(seconds / duration_s)

    return {
        key: statistics.median(rates)
        for key, rates in samples.items()
        if len(rates) >= _MEASURED_MIN_SAMPLES
    }


class ProbeRequest(BaseModel):
    path: str


class EstimateRequest(BaseModel):
    duration_s: float
    model: str = "large-v3"
    audio_tracks: int = 2
    transcribe_tracks: Optional[int] = None
    has_gpu: bool = True
    scene_mode: str = "fast"
    energy_mode: str = "fast"
    diarize: bool = False


class IngestRequest(BaseModel):
    path: str = ""
    model: str = "large-v3"
    profile: Optional[str] = None
    no_score: bool = False
    energy_mode: str = "fast"
    scene_mode: str = "fast"
    # None = use config default; True/False = force on/off for this run.
    diarize: Optional[bool] = None
    # Re-process a recording that is already "done" (drops existing clips and re-runs
    # the whole pipeline). Passed through to the CLI's --force.
    force: bool = False
    context_names: list[str] = []
    # Path to an SRT file or "stream:<index>" to import existing subtitles instead of
    # running Whisper.  None = use Whisper (default).
    subtitle_source: Optional[str] = None
    # Target an existing video record by ID (reanalyze after split).
    # When provided, path is ignored — the video's stored path is used.
    video_id: Optional[int] = None
    # For pre-analysis split: trim the source file to this time window.
    segment_start_s: Optional[float] = None
    segment_end_s: Optional[float] = None


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    _PICK_FILE_KINDS = {
        "video": ("Select Recording File", [
            ("Video files", "*.mkv *.mp4 *.mov *.avi *.webm *.flv *.ts"),
            ("All files", "*.*"),
        ]),
        "captions": ("Select Captions File", [
            ("SRT captions", "*.srt"),
            ("All files", "*.*"),
        ]),
    }

    @router.get("/api/pick-file")
    def pick_file(kind: str = "video"):
        """Open the OS-native file dialog on the server machine and return the chosen path."""
        if kind not in _PICK_FILE_KINDS:
            raise HTTPException(400, f"kind must be one of: {sorted(_PICK_FILE_KINDS)}")
        title, filetypes = _PICK_FILE_KINDS[kind]
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", True)
        try:
            path = filedialog.askopenfilename(title=title, filetypes=filetypes)
        finally:
            root.destroy()
        return {"path": str(Path(path)) if path else None}

    @router.post("/api/probe")
    def probe_video_file(req: ProbeRequest):
        """Probe a video file and return its duration, resolution, stream counts, and subtitle info."""
        from yuu_clip.analyze.probe import probe_video
        p = Path(req.path)
        if not p.exists():
            raise HTTPException(400, f"File not found: {req.path}")
        try:
            info = probe_video(p)
        except Exception as e:
            _log.warning("Probe failed for %s: %s", p.name, e)
            raise HTTPException(400, str(e))
        srt_sidecar = next(
            (str(p.with_suffix(ext)) for ext in (".srt", ".SRT") if p.with_suffix(ext).exists()),
            None,
        )
        return {
            "filename":         p.name,
            "duration_s":       (info.duration_ms or 0) / 1000,
            "duration_hms":     info.duration_hms,
            "width":            info.width,
            "height":           info.height,
            "fps":              info.fps,
            "audio_tracks":     len(info.audio_streams),
            "subtitle_streams": _probe_subtitle_streams(p),
            "srt_sidecar":      srt_sidecar,
        }

    @router.post("/api/estimate")
    def estimate_processing_time(req: EstimateRequest):
        """Return per-step wall-clock time estimates for analyzing a video of the given length."""
        db = ctx.get_db()
        try:
            return _compute_time_estimate(req, db, ctx.config.analyze_warn_hours)
        finally:
            db.close()

    @router.post("/api/analyze/start")
    async def start_analyze(req: IngestRequest):
        """Validate the video path, build the analyze CLI command, and queue it for the SSE stream."""
        # Starting while a job is running would let /api/analyze/events overwrite
        # ctx.analyze_job, orphaning the still-running subprocess (cancel and
        # shutdown could no longer reach it) with two writers on the same DB.
        if _analyze_running(ctx):
            running = ctx.analyze_job.filename if ctx.analyze_job else ctx.analyze_pending_filename
            _log.warning(
                "Analyze start rejected — job already running (running=%s, requested=%s)",
                running, req.path or req.video_id,
            )
            raise HTTPException(
                409,
                "Another job is still running — wait for it to finish or cancel it "
                "before starting a new analysis.",
            )
        from yuu_clip.analyze.pause import remove_pause_flag
        remove_pause_flag(ctx.project_dir)
        video_path = _resolve_video_path(req, ctx)
        try:
            validate_whisper_model(req.model)
        except ValueError as e:
            raise HTTPException(400, str(e))
        ctx.analyze_cmd = _build_analyze_cmd(req, video_path, ctx.project_dir)
        ctx.analyze_pending_filename = Path(video_path).name
        ctx.analyze_pending_video_id = req.video_id
        _log.info(
            "Analyze queued: %s (video_id=%s, model=%s, energy=%s, scene=%s)",
            video_path, req.video_id, req.model, req.energy_mode, req.scene_mode,
        )
        return {"status": "started"}

    @router.get("/api/analyze/events")
    async def analyze_events():
        """Stream the analyze subprocess output as SSE.

        Launches the queued command (from /api/analyze/start) on first connect;
        a later connect (e.g. after a page refresh) reattaches to the still-running
        job, replaying everything emitted so far before continuing live. The
        subprocess is not killed when this stream disconnects.
        """
        from yuu_clip.web.analyze_job import AnalyzeJob

        if ctx.analyze_cmd:
            job = AnalyzeJob(
                ctx.analyze_cmd, ctx.project_dir,
                filename=ctx.analyze_pending_filename,
                video_id=ctx.analyze_pending_video_id,
            )
            ctx.analyze_job = job
            ctx.analyze_cmd = None
            ctx.analyze_pending_filename = None
            ctx.analyze_pending_video_id = None
            await job.start()
            job._thermal_task = asyncio.create_task(_thermal_poll_loop(ctx, job))
            return job.sse_response()

        if ctx.analyze_job is not None:
            return ctx.analyze_job.sse_response()

        raise HTTPException(400, "No analysis running. Call /api/analyze/start first.")

    @router.get("/api/status")
    def server_status():
        """Return whether any processing is currently active (analysis, scoring, timeline, etc.)."""
        # Lazy import: analyze.py is loaded by app.py, so a top-level import would be circular.
        from yuu_clip.analyze.pause import pause_flag_exists
        from yuu_clip.web.app import _VERSION_DISPLAY
        job = ctx.analyze_job
        job_running = job is not None and not job.done
        analyze_running = _analyze_running(ctx)
        return {
            "any_running": analyze_running or ctx.active_jobs > 0,
            "analyze_running": analyze_running,
            # Import from URL (roadmap plan 08): set while a download is queued or
            # running; already folded into any_running via active_jobs (see
            # subprocess_sse's track_active_job).
            "import_running": ctx.import_cmd is not None,
            # Identity of the reattachable analyze job, so a freshly loaded page can
            # reconnect to an analysis already in progress. Null for score/export jobs.
            "analyze_filename": job.filename if job_running else None,
            "analyze_video_id": job.video_id if job_running else None,
            # Requires a live job — a pause requested during the last video must not
            # keep showing "paused" once the job has already finished.
            "analyze_paused": job_running and pause_flag_exists(ctx.project_dir),
            # Raw flag state, independent of a live job. The JS sequential-segment
            # runners (each segment is its own separate AnalyzeJob) poll this between
            # segments, when there is briefly no "running" job for analyze_paused to key off.
            "pause_flag_set": pause_flag_exists(ctx.project_dir),
            # GPU thermal monitoring — null/"unavailable" when no NVIDIA GPU is present.
            "gpu_temp_c": job.gpu_temp_c if job_running else None,
            "gpu_state": job.gpu_state if job_running else "unavailable",
            # Auto-pause config so the "running hot" warning can tell the user what
            # happens next (auto-pause at N°C, or that it won't and they should pause).
            "thermal_autopause_enabled": bool(ctx.config.thermal_autopause_enabled),
            "thermal_pause_c": ctx.config.thermal_pause_c,
            "active_jobs": ctx.active_jobs,
            "version": _VERSION_DISPLAY,
            "project_dir": str(ctx.project_dir),
            # Bumped by an in-place project switch (routes/projects.py) so a
            # client can tell the server is now serving a different project.
            "project_generation": ctx.project_generation,
            "export_dir":  str(ctx.export_dir),
            "reels_dir":   str(ctx.reels_dir),
            "db_path":     str(ctx.db_path),
            "can_reveal":  sys.platform == "win32",
        }

    @router.get("/api/prereqs")
    def prereqs():
        """Return prerequisite availability for the UI to surface wizard links."""
        from yuu_clip.config import find_ffmpeg
        try:
            find_ffmpeg()
            ffmpeg_ok = True
        except Exception as exc:
            _log.debug("prereqs: ffmpeg check failed: %s", exc)
            ffmpeg_ok = False
        try:
            cfg = ctx.config
            if cfg.llm_backend == "ollama":
                import urllib.request
                host = cfg.ollama_host or "http://localhost:11434"
                urllib.request.urlopen(f"{host}/api/tags", timeout=2)
                llm_ok = True
            else:
                llm_ok = bool(cfg.llm_model_path and Path(cfg.llm_model_path).exists())
        except Exception as exc:
            _log.debug("prereqs: LLM check failed: %s", exc)
            llm_ok = False
        return {"ffmpeg_ok": ffmpeg_ok, "llm_ok": llm_ok}

    @router.get("/api/analyze/status")
    def analyze_status():
        """Return whether an analyze subprocess is currently running."""
        return {"running": _analyze_running(ctx)}

    @router.post("/api/analyze/pause")
    async def pause_analyze():
        """Request a pause before the next video in the running batch starts.

        The video currently in progress always finishes — this only holds the
        loop before it starts the next one. No-op with a clear message when no
        job is running (including single-video runs, where it simply never fires).
        """
        job = ctx.analyze_job
        if job is None or job.done:
            return {"status": "no-op", "message": "No analysis is running."}
        from yuu_clip.analyze.pause import create_pause_flag
        create_pause_flag(ctx.project_dir)
        job.pause_requested = True
        _log.info("Analyze pause requested — will hold before the next video")
        return {"status": "pause-requested"}

    @router.post("/api/analyze/resume")
    async def resume_analyze():
        """Clear a pending pause so the batch loop continues to the next video."""
        job = ctx.analyze_job
        if job is None or job.done:
            return {"status": "no-op", "message": "No analysis is running."}
        from yuu_clip.analyze.pause import remove_pause_flag
        try:
            remove_pause_flag(ctx.project_dir)
        except OSError as e:
            _log.error("Failed to remove pause flag: %s", e)
            raise HTTPException(500, f"Could not resume — the pause flag file could not be removed: {e}")
        job.pause_requested = False
        if job.thermal_trigger is not None:
            # Suppress auto-pause from immediately re-firing on a still-hot GPU —
            # see ThermalTrigger.note_resumed.
            job.thermal_trigger.note_resumed()
        _log.info("Analyze resumed")
        return {"status": "resumed"}

    @router.post("/api/analyze/cancel")
    async def cancel_analyze():
        """Terminate the currently running analyze subprocess, if any."""
        job = ctx.analyze_job
        if job is not None and not job.done:
            _log.warning("Analysis cancelled by user")
            await job.cancel()
        # Also cover the pre-1.x subprocess path and any queued-but-unlaunched command.
        proc = ctx.analyze_proc
        if proc is not None and proc.returncode is None:
            ctx.analyze_cancelled = True
            terminate_process_tree(proc)
        ctx.analyze_cmd = None
        ctx.analyze_pending_filename = None
        ctx.analyze_pending_video_id = None
        # Cancel always wins over a pending pause — leaving the flag would start
        # the next run already paused.
        from yuu_clip.analyze.pause import remove_pause_flag
        remove_pause_flag(ctx.project_dir)
        # Flip the killed run's row out of the transient 'extracting' state (the
        # long extract+transcribe phase) so the sidebar stops showing an eternal
        # spinner — same cleanup the server runs on startup for crashed runs.
        from yuu_clip.web.app import _fail_interrupted_analyses
        _fail_interrupted_analyses(ctx)
        return {"status": "cancelled"}

    @router.post("/api/score")
    async def score_all():
        """Re-score all videos and stream progress as SSE."""
        _reject_if_analyzing(ctx)
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "score", "--all",
            "--project", str(ctx.project_dir),
        ]
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/clips/{clip_id}/export")
    async def export_clip(
        clip_id: int,
        burn_subs: bool = Query(False),
        embed_subs: bool = Query(False),
        container: Optional[str] = Query(None),
        retranscribe: bool = Query(False),
        retranscribe_model: str = Query("large-v3"),
        speaker_labels: bool = Query(True),
        title_card: bool = Query(False),
        preset: Optional[str] = Query(None, description="Export preset id (built-in or custom); omit for original quality"),
    ):
        """Export a clip to a video file and stream ffmpeg progress as SSE."""
        allowed_containers = {"mkv", "mp4"}
        if container is not None and container not in allowed_containers:
            raise HTTPException(400, f"container must be one of: {', '.join(sorted(allowed_containers))}")
        if retranscribe:
            try:
                validate_whisper_model(retranscribe_model)
            except ValueError as e:
                raise HTTPException(400, str(e))
        _validate_export_preset_query(ctx, preset, embed_subs)
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "export", str(clip_id),
            "--captions", "--project", str(ctx.project_dir),
        ]
        if burn_subs:
            cmd.append("--bake-captions")
        elif embed_subs:
            cmd.append("--embed-subs")
        if container:
            cmd.extend(["--container", container])
        if retranscribe:
            cmd.extend(["--retranscribe", "--retranscribe-model", retranscribe_model])
            cmd.append("--speaker-labels" if speaker_labels else "--no-speaker-labels")
        if title_card:
            cmd.append("--title-card")
        if preset:
            cmd.extend(["--preset", preset])
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/clips/{clip_id}/retranscribe")
    async def retranscribe_clip(clip_id: int, model: str = Query("large-v3"),
                                speaker_labels: bool = Query(True)):
        """Re-transcribe a clip's time window with the given Whisper model."""
        _reject_if_analyzing(ctx)
        try:
            validate_whisper_model(model)
        except ValueError as e:
            raise HTTPException(400, str(e))
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "retranscribe", str(clip_id),
            "--model", model, "--no-rescore", "--project", str(ctx.project_dir),
            "--speaker-labels" if speaker_labels else "--no-speaker-labels",
        ]
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/videos/{video_id}/rediarize")
    async def rediarize_video(video_id: int):
        """Re-run only speaker diarization on a recording's existing transcripts.

        Non-destructive: clips, scores, and transcript text are untouched. Re-runs
        _assign_speakers + _attach_speakers so named speakers re-attach to matching
        voices (the way voiceprint re-attach is validated). Streams progress as SSE.
        """
        from yuu_clip.db.models import Video
        _reject_if_analyzing(ctx)
        db = ctx.get_db()
        try:
            if not db.get(Video, video_id):
                raise HTTPException(404, "Video not found")
        finally:
            db.close()
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "rediarize", str(video_id),
            "--project", str(ctx.project_dir),
        ]
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/install/{slug}")
    async def install_status(slug: str):
        """Report whether an optional package's import modules are present."""
        if slug not in _INSTALLABLE:
            raise HTTPException(400, f"Unknown package slug '{slug}' — allowed: {sorted(_INSTALLABLE)}")
        installed = all(
            importlib.util.find_spec(module) is not None
            for module in _IMPORT_NAMES[slug]
        )
        return {"installed": installed}

    @router.post("/api/install/{slug}")
    async def install_package(slug: str):
        """Install an optional pip package into the current Python environment."""
        if slug not in _INSTALLABLE:
            raise HTTPException(400, f"Unknown package slug '{slug}' — allowed: {sorted(_INSTALLABLE)}")
        pkgs = _INSTALLABLE[slug]
        packages = pkgs if isinstance(pkgs, list) else [pkgs]
        cmd = [sys.executable, "-m", "pip", "install", *packages]
        return await subprocess_sse(cmd, ctx.project_dir)

    return router


_THERMAL_POLL_INTERVAL_S = 10.0


async def _thermal_poll_loop(ctx: ProjectContext, job) -> None:
    """Poll GPU temperature every ~10s while *job* runs; warn / auto-pause on
    sustained high temperature (see analyze.thermal.ThermalTrigger). Cancelled
    from AnalyzeJob._pump's finally block when the job ends.

    A no-op (returns immediately) when no NVIDIA GPU is available — the
    monitor itself already logged one WARN explaining why.
    """
    from yuu_clip.analyze.pause import create_pause_flag
    from yuu_clip.analyze.thermal import ThermalTrigger

    monitor = ctx.thermal_monitor
    if not monitor.available():
        return
    trigger = ThermalTrigger(monitor)
    job.thermal_trigger = trigger
    job.gpu_state = "ok"
    try:
        while not job.done:
            cfg = ctx.config  # read thresholds fresh each poll — may change mid-run
            result = trigger.poll(cfg.thermal_warn_c, cfg.thermal_pause_c, cfg.thermal_autopause_enabled)
            job.gpu_temp_c = result.temp_c
            job.gpu_state = result.state
            if result.warn_triggered:
                _log.warning(
                    "GPU thermal warning: %.0f°C sustained (warn threshold %.0f°C)",
                    result.temp_c, cfg.thermal_warn_c,
                )
                job._emit(f"[Warning: GPU at {result.temp_c:.0f}°C]")
            if result.pause_triggered:
                _log.warning(
                    "Auto-paused analysis: GPU reached %.0f°C sustained "
                    "(pause threshold %.0f°C) — holding before the next video",
                    result.temp_c, cfg.thermal_pause_c,
                )
                create_pause_flag(ctx.project_dir)
                job.pause_requested = True
                job._emit(
                    f"[Auto-paused: GPU reached {result.temp_c:.0f}°C "
                    "— will hold before the next video]"
                )
            await asyncio.sleep(_THERMAL_POLL_INTERVAL_S)
    except asyncio.CancelledError:
        pass


def _resolve_video_path(req: IngestRequest, ctx) -> str:
    if req.video_id is not None:
        from yuu_clip.db.models import Video
        db = ctx.get_db()
        try:
            video = db.query(Video).filter_by(id=req.video_id).first()
            if not video:
                raise HTTPException(404, f"Video {req.video_id} not found")
            return video.path
        finally:
            db.close()
    if not req.path:
        raise HTTPException(400, "path is required when video_id is not provided")
    if not Path(req.path).exists():
        raise HTTPException(400, f"File not found: {req.path}")
    return req.path


def _build_analyze_cmd(req: IngestRequest, video_path: str, project_dir: Path) -> list[str]:
    cmd = [
        sys.executable, "-m", "yuu_clip.cli", "analyze",
        video_path, "--model", req.model,
        "--project", str(project_dir),
    ]
    if req.video_id is not None:
        cmd += ["--video-id", str(req.video_id)]
    if req.segment_start_s is not None:
        cmd += ["--segment-start", str(req.segment_start_s)]
    if req.segment_end_s is not None:
        cmd += ["--segment-end", str(req.segment_end_s)]
    if req.profile:
        cmd += ["--track-layout", req.profile]
    if req.force:
        cmd += ["--force"]
    if req.no_score:
        cmd += ["--no-score"]
    cmd += ["--energy-mode", req.energy_mode, "--scene-mode", req.scene_mode]
    if req.diarize is True:
        cmd += ["--diarize"]
    elif req.diarize is False:
        cmd += ["--no-diarize"]
    for context_id in req.context_names:
        cmd += ["--context", context_id]
    if req.subtitle_source:
        cmd += ["--subtitle-source", req.subtitle_source]
    cmd += ["--no-interact"]
    return cmd


def _probe_subtitle_streams(p: Path) -> list[dict]:
    import json as _json
    import subprocess as _sp

    from yuu_clip.config import find_ffmpeg
    try:
        _, ffprobe = find_ffmpeg()
        raw = _sp.run(
            [ffprobe, "-v", "error", "-print_format", "json",
             "-show_streams", "-select_streams", "s", str(p)],
            capture_output=True, text=True, timeout=120,
        )
        if raw.returncode == 0:
            return [
                {
                    "index":    s.get("index"),
                    "codec":    s.get("codec_name", ""),
                    "title":    s.get("tags", {}).get("title", ""),
                    "language": s.get("tags", {}).get("language", ""),
                }
                for s in _json.loads(raw.stdout).get("streams", [])
            ]
    except Exception as exc:
        _log.debug("Subtitle stream detection failed for %s: %s", p.name, exc)
    return []


def _compute_time_estimate(req: EstimateRequest, db=None, warn_hours: float = 2.0) -> dict:
    duration_s = req.duration_s
    n_tracks = max(1, req.audio_tracks)
    transcribe_tracks = req.transcribe_tracks if req.transcribe_tracks is not None else max(1, n_tracks // 2)

    # Medians from the creator's own past runs, keyed to this exact model+device so a
    # different model/CPU-vs-GPU choice can't poison the numbers. None of the individual
    # step formulas below are touched unless a matching measured rate exists for them.
    measured = _measured_rates(db, req.model, req.has_gpu) if db is not None else {}
    used_measured = False

    scene_seconds = max(
        _SCENE_FAST_FLOOR_S if req.scene_mode == "fast" else 0.0,
        duration_s * _SCENE_COST_FRACTION.get(req.scene_mode, 0.005),
    )
    energy_cost, energy_label = _ENERGY_MODE.get(req.energy_mode, (0.002, ""))

    extract_seconds = duration_s * n_tracks * 0.002
    if "extract" in measured:
        extract_seconds = measured["extract"] * duration_s
        used_measured = True

    transcribe_step = _whisper_step(req.model, req.has_gpu, duration_s, transcribe_tracks)
    if transcribe_tracks > 0 and "transcribe" in measured:
        transcribe_step["seconds"] = measured["transcribe"] * duration_s
        used_measured = True

    summarize_seconds = max(15.0, duration_s * 0.0015)
    if "summarize" in measured:
        summarize_seconds = measured["summarize"] * duration_s
        used_measured = True

    est_clips = int(duration_s / 180)
    llm_scoring_seconds = est_clips * 12  # ~12s/clip observed (cold model + per-clip prompt)

    steps = [
        {
            "name":    "Extract",
            "seconds": extract_seconds,
            "note":    f"{n_tracks} track(s)",
        },
        transcribe_step,
        {
            "name":    f"Audio energy ({req.energy_mode})",
            "seconds": duration_s * n_tracks * energy_cost,
            "note":    energy_label,
        },
        {
            "name":    f"Scene detection ({req.scene_mode})",
            "seconds": scene_seconds,
            "note":    _SCENE_MODE_LABELS.get(req.scene_mode, ""),
        },
        {
            "name":    "Summarize",
            "seconds": summarize_seconds,
            "note":    "one LLM pass over the transcript",
        },
        {
            "name":    "LLM scoring",
            "seconds": llm_scoring_seconds,
            "note":    f"~{est_clips} clips estimated",
        },
    ]
    if "score" in measured:
        # "Score" is the one combined energy+scenes+LLM-scoring StageRecorder timing —
        # ground the roughest guess (LLM scoring) in it, net of this run's own energy/
        # scene estimates so the two aren't double-counted against the measured total.
        energy_seconds = steps[2]["seconds"]
        scene_detect_seconds = steps[3]["seconds"]
        measured_score_total = measured["score"] * duration_s
        steps[5]["seconds"] = max(0.0, measured_score_total - energy_seconds - scene_detect_seconds)
        used_measured = True
    if req.diarize and transcribe_tracks > 0:
        diar_speed = _DIARIZATION_RT_SPEED["gpu" if req.has_gpu else "cpu"]
        speaker_seconds = duration_s * transcribe_tracks / diar_speed
        if "speakers" in measured:
            speaker_seconds = measured["speakers"] * duration_s
            used_measured = True
        steps.insert(2, {
            "name":    "Speaker labels",
            "seconds": speaker_seconds,
            "note":    f"{transcribe_tracks} track(s), pyannote",
        })
    total = sum(s["seconds"] for s in steps)
    for step in steps:
        step["hms"] = _format_duration(step["seconds"])
    pct_of_video = round(total / duration_s * 100, 1) if duration_s > 0 else 0
    return {
        "steps": steps,
        "total_hms": _format_duration(total),
        "total_seconds": total,
        "pct_of_video": pct_of_video,
        "source": "measured" if used_measured else "estimated",
        "warn_hours": warn_hours,
        "long_run_warning": total >= warn_hours * 3600,
    }


def _whisper_step(model: str, has_gpu: bool, duration_s: float, transcribe_tracks: int) -> dict:
    if transcribe_tracks == 0:
        return {"name": "Load captions", "seconds": 2.0, "note": "from file"}
    speed = _WHISPER_CPU_SPEED if not has_gpu else _WHISPER_GPU_SPEED.get(model.split(":")[0], 6)
    device = "GPU" if has_gpu else "CPU"
    return {
        "name":    f"Transcribe ({model})",
        "seconds": duration_s * transcribe_tracks / speed,
        "note":    f"{transcribe_tracks} track(s) on {device}",
    }


def _format_duration(seconds: float) -> str:
    s = int(seconds)
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m {s % 60:02d}s"
    h, rem = divmod(s, 3600)
    return f"{h}h {rem // 60:02d}m"
