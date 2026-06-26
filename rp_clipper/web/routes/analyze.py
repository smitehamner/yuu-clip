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

import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from rp_clipper.config import validate_whisper_model
from rp_clipper.log import get_logger
from rp_clipper.web.deps import ProjectContext
from rp_clipper.web.sse import subprocess_sse

_log = get_logger(__name__)

# ── Whisper real-time speed ratios ──────────────────────────────────────────
# Seconds of video processed per second of wall-clock time.
# Calibrated against observed runs (2h10m video, RTX-class GPU).
_WHISPER_GPU_SPEED: dict[str, float] = {
    "large-v3": 6, "large-v2": 6, "large": 6,
    "medium": 18, "small": 30, "base": 50, "tiny": 80,
}
_WHISPER_CPU_SPEED = 0.4  # large-v3 on CPU; other models scale similarly

# Scene-detection wall-clock cost as a fraction of source video duration
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


class IngestRequest(BaseModel):
    path: str
    model: str = "large-v3"
    profile: Optional[str] = None
    no_score: bool = False
    energy_mode: str = "fast"
    scene_mode: str = "fast"
    context_names: list[str] = []


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/pick-file")
    def pick_file():
        """Open the OS-native file dialog on the server machine and return the chosen path."""
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", True)
        path = filedialog.askopenfilename(
            title="Select Video File",
            filetypes=[
                ("Video files", "*.mkv *.mp4 *.mov *.avi *.webm *.flv *.ts"),
                ("All files", "*.*"),
            ],
        )
        root.destroy()
        return {"path": str(Path(path)) if path else None}

    @router.post("/api/probe")
    def probe_video_file(req: ProbeRequest):
        """Probe a video file and return its duration, resolution, stream counts, and subtitle info."""
        import json as _json
        import subprocess as _sp
        from rp_clipper.analyze.probe import probe_video
        from rp_clipper.config import find_ffmpeg
        p = Path(req.path)
        if not p.exists():
            raise HTTPException(400, f"File not found: {req.path}")
        try:
            info = probe_video(p)
        except Exception as e:
            raise HTTPException(400, str(e))

        # Detect embedded subtitle streams and .srt sidecar
        subtitle_streams: list[dict] = []
        try:
            _, ffprobe = find_ffmpeg()
            raw = _sp.run(
                [ffprobe, "-v", "quiet", "-print_format", "json",
                 "-show_streams", "-select_streams", "s", str(p)],
                capture_output=True, text=True,
            )
            if raw.returncode == 0:
                for s in _json.loads(raw.stdout).get("streams", []):
                    subtitle_streams.append({
                        "index": s.get("index"),
                        "codec": s.get("codec_name", ""),
                        "title": s.get("tags", {}).get("title", ""),
                        "language": s.get("tags", {}).get("language", ""),
                    })
        except Exception as exc:
            _log.debug("Subtitle stream detection failed for %s: %s", p.name, exc)

        srt_sidecar: Optional[str] = None
        for ext in (".srt", ".SRT"):
            candidate = p.with_suffix(ext)
            if candidate.exists():
                srt_sidecar = str(candidate)
                break

        return {
            "filename":         p.name,
            "duration_s":       (info.duration_ms or 0) / 1000,
            "duration_hms":     info.duration_hms,
            "width":            info.width,
            "height":           info.height,
            "fps":              info.fps,
            "audio_tracks":     len(info.audio_streams),
            "subtitle_streams": subtitle_streams,
            "srt_sidecar":      srt_sidecar,
        }

    @router.post("/api/estimate")
    def estimate_processing_time(req: EstimateRequest):
        """Return per-step wall-clock time estimates for analyzing a video of the given length."""
        return _compute_time_estimate(req)

    @router.post("/api/analyze/start")
    async def start_ingest(req: IngestRequest):
        """Validate the video path, build the ingest CLI command, and queue it for the SSE stream."""
        if not Path(req.path).exists():
            raise HTTPException(400, f"File not found: {req.path}")
        try:
            validate_whisper_model(req.model)
        except ValueError as e:
            raise HTTPException(400, str(e))
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "analyze",
            str(req.path), "--model", req.model,
            "--project", str(ctx.project_dir),
        ]
        if req.profile:
            cmd += ["--track-layout", req.profile]
        if req.no_score:
            cmd += ["--no-score"]
        cmd += ["--energy-mode", req.energy_mode]
        cmd += ["--scene-mode", req.scene_mode]
        for slug in req.context_names:
            cmd += ["--context", slug]
        cmd += ["--no-interact"]
        ctx.ingest_cmd = cmd
        _log.info("Analyze queued: %s (model=%s, energy=%s, scene=%s)", req.path, req.model, req.energy_mode, req.scene_mode)
        return {"status": "started"}

    @router.get("/api/analyze/events")
    async def ingest_events():
        """Stream the queued ingest subprocess output as SSE. Call /api/analyze/start first."""
        if not ctx.ingest_cmd:
            raise HTTPException(400, "No analyze command queued. Call /api/analyze/start first.")
        return await subprocess_sse(ctx.ingest_cmd, ctx.project_dir, ctx)

    @router.get("/api/status")
    def server_status():
        """Return whether any processing is currently active (analysis, scoring, timeline, etc.)."""
        # Lazy import: analyze.py is loaded by app.py, so a top-level import would be circular.
        from rp_clipper.web.app import _SERVER_START
        proc = ctx.ingest_proc
        analyze_running = proc is not None and proc.returncode is None
        return {
            "any_running": analyze_running or ctx.active_jobs > 0,
            "analyze_running": analyze_running,
            "active_jobs": ctx.active_jobs,
            "version": f"Development · started {_SERVER_START}",
        }

    @router.get("/api/analyze/status")
    def analyze_status():
        """Return whether an analyze subprocess is currently running."""
        proc = ctx.ingest_proc
        running = proc is not None and proc.returncode is None
        return {"running": running}

    @router.post("/api/analyze/cancel")
    async def cancel_analyze():
        """Terminate the currently running analyze subprocess, if any."""
        proc = ctx.ingest_proc
        if proc is not None and proc.returncode is None:
            _log.warning("Analysis cancelled by user (pid %s)", proc.pid)
            ctx.ingest_cancelled = True
            proc.terminate()
        ctx.ingest_cmd = None
        return {"status": "cancelled"}

    @router.post("/api/score")
    async def score_all():
        """Re-score all videos and stream progress as SSE."""
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "score", "--all",
            "--project", str(ctx.project_dir),
        ]
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/clips/{clip_id}/export")
    async def export_clip(
        clip_id: int,
        burn_subs: bool = Query(False),
        container: Optional[str] = Query(None),
    ):
        """Export a clip to a video file and stream ffmpeg progress as SSE."""
        allowed_containers = {"mkv", "mp4"}
        if container is not None and container not in allowed_containers:
            raise HTTPException(400, f"container must be one of: {', '.join(sorted(allowed_containers))}")
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "export", str(clip_id),
            "--captions", "--project", str(ctx.project_dir),
        ]
        if burn_subs:
            cmd.append("--bake-captions")
        if container:
            cmd.extend(["--container", container])
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/clips/{clip_id}/retranscribe")
    async def retranscribe_clip(clip_id: int, model: str = Query("large-v3")):
        """Re-transcribe a clip's time window with the given Whisper model, then re-score."""
        try:
            validate_whisper_model(model)
        except ValueError as e:
            raise HTTPException(400, str(e))
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "retranscribe", str(clip_id),
            "--model", model, "--project", str(ctx.project_dir),
        ]
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    return router


def _compute_time_estimate(req: EstimateRequest) -> dict:
    d = req.duration_s
    n_tracks = max(1, req.audio_tracks)
    if req.transcribe_tracks is not None:
        transcribe_tracks = req.transcribe_tracks
    else:
        transcribe_tracks = max(1, n_tracks // 2)

    whisper_speed = _WHISPER_GPU_SPEED.get(req.model.split(":")[0], 6)
    if not req.has_gpu:
        whisper_speed = _WHISPER_CPU_SPEED

    scene_seconds = max(
        _SCENE_FAST_FLOOR_S if req.scene_mode == "fast" else 0.0,
        d * _SCENE_COST_FRACTION.get(req.scene_mode, 0.005),
    )
    energy_cost, energy_label = _ENERGY_MODE.get(req.energy_mode, (0.002, ""))

    steps = [
        {
            "name":    "Extract audio",
            "seconds": d * n_tracks * 0.05,
            "note":    f"{n_tracks} track(s)",
        },
        {
            "name":    f"Transcribe ({req.model})",
            "seconds": d * transcribe_tracks / whisper_speed,
            "note":    f"{transcribe_tracks} track(s) on {'GPU' if req.has_gpu else 'CPU'}",
        },
        {
            "name":    f"Audio energy ({req.energy_mode})",
            "seconds": d * n_tracks * energy_cost,
            "note":    energy_label,
        },
        {
            "name":    f"Scene detection ({req.scene_mode})",
            "seconds": scene_seconds,
            "note":    _SCENE_MODE_LABELS.get(req.scene_mode, ""),
        },
        {
            "name":    "LLM scoring",
            "seconds": (d / 180) * 4,
            "note":    f"~{int(d / 180)} clips estimated",
        },
    ]
    total = sum(s["seconds"] for s in steps)
    for step in steps:
        step["hms"] = _format_duration(step["seconds"])
    pct_of_video = round(total / d * 100, 1) if d > 0 else 0
    return {
        "steps": steps,
        "total_hms": _format_duration(total),
        "total_seconds": total,
        "pct_of_video": pct_of_video,
    }


def _format_duration(seconds: float) -> str:
    """Format a duration in seconds as a compact human-readable string (e.g. '1h 23m')."""
    s = int(seconds)
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m {s % 60:02d}s"
    h, rem = divmod(s, 3600)
    return f"{h}h {rem // 60:02d}m"
