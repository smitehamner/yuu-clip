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

from yuu_clip.config import validate_whisper_model
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.sse import subprocess_sse

_log = get_logger(__name__)

# ── Whisper real-time speed ratios ──────────────────────────────────────────
# Seconds of video processed per second of wall-clock time.
# Calibrated against observed runs (2h10m video, RTX-class GPU).
_WHISPER_GPU_SPEED: dict[str, float] = {
    "large-v3": 6, "large-v2": 6, "large": 6,
    "medium": 18, "small": 30, "base": 50, "tiny": 80,
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
    path: str = ""
    model: str = "large-v3"
    profile: Optional[str] = None
    no_score: bool = False
    energy_mode: str = "fast"
    scene_mode: str = "fast"
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

    @router.get("/api/pick-file")
    def pick_file():
        """Open the OS-native file dialog on the server machine and return the chosen path."""
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", True)
        try:
            path = filedialog.askopenfilename(
                title="Select Video File",
                filetypes=[
                    ("Video files", "*.mkv *.mp4 *.mov *.avi *.webm *.flv *.ts"),
                    ("All files", "*.*"),
                ],
            )
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
        return _compute_time_estimate(req)

    @router.post("/api/analyze/start")
    async def start_analyze(req: IngestRequest):
        """Validate the video path, build the analyze CLI command, and queue it for the SSE stream."""
        video_path = _resolve_video_path(req, ctx)
        try:
            validate_whisper_model(req.model)
        except ValueError as e:
            raise HTTPException(400, str(e))
        ctx.analyze_cmd = _build_analyze_cmd(req, video_path, ctx.project_dir)
        _log.info(
            "Analyze queued: %s (video_id=%s, model=%s, energy=%s, scene=%s)",
            video_path, req.video_id, req.model, req.energy_mode, req.scene_mode,
        )
        return {"status": "started"}

    @router.get("/api/analyze/events")
    async def analyze_events():
        """Stream the queued analyze subprocess output as SSE. Call /api/analyze/start first."""
        if not ctx.analyze_cmd:
            raise HTTPException(400, "No analyze command queued. Call /api/analyze/start first.")
        return await subprocess_sse(ctx.analyze_cmd, ctx.project_dir, ctx, is_analyze=True, clear_cmd_attr="analyze_cmd")

    @router.get("/api/status")
    def server_status():
        """Return whether any processing is currently active (analysis, scoring, timeline, etc.)."""
        # Lazy import: analyze.py is loaded by app.py, so a top-level import would be circular.
        from yuu_clip.web.app import _VERSION_DISPLAY
        proc = ctx.analyze_proc
        analyze_running = proc is not None and proc.returncode is None
        return {
            "any_running": analyze_running or ctx.active_jobs > 0,
            "analyze_running": analyze_running,
            "active_jobs": ctx.active_jobs,
            "version": _VERSION_DISPLAY,
            "project_dir": str(ctx.project_dir),
            "export_dir":  str(ctx.export_dir),
            "db_path":     str(ctx.db_path),
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
        proc = ctx.analyze_proc
        running = proc is not None and proc.returncode is None
        return {"running": running}

    @router.post("/api/analyze/cancel")
    async def cancel_analyze():
        """Terminate the currently running analyze subprocess, if any."""
        proc = ctx.analyze_proc
        if proc is not None and proc.returncode is None:
            _log.warning("Analysis cancelled by user (pid %s)", proc.pid)
            ctx.analyze_cancelled = True
            proc.terminate()
        ctx.analyze_cmd = None
        return {"status": "cancelled"}

    @router.post("/api/score")
    async def score_all():
        """Re-score all videos and stream progress as SSE."""
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
        title_card: bool = Query(False),
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
        if title_card:
            cmd.append("--title-card")
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.get("/api/clips/{clip_id}/retranscribe")
    async def retranscribe_clip(clip_id: int, model: str = Query("large-v3")):
        """Re-transcribe a clip's time window with the given Whisper model."""
        try:
            validate_whisper_model(model)
        except ValueError as e:
            raise HTTPException(400, str(e))
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "retranscribe", str(clip_id),
            "--model", model, "--no-rescore", "--project", str(ctx.project_dir),
        ]
        return await subprocess_sse(cmd, ctx.project_dir, ctx)

    @router.post("/api/install/{slug}")
    async def install_package(slug: str):
        """Install an optional pip package into the current Python environment."""
        _INSTALLABLE: dict[str, str | list[str]] = {
            "pyannote":    "pyannote.audio",
            "llamacpp":    "llama-cpp-python",
            "anthropic":   "anthropic",
            "laugh-deps":  ["transformers", "torch", "torchaudio", "soundfile"],
        }
        if slug not in _INSTALLABLE:
            raise HTTPException(400, f"Unknown package slug '{slug}' — allowed: {sorted(_INSTALLABLE)}")
        pkgs = _INSTALLABLE[slug]
        packages = pkgs if isinstance(pkgs, list) else [pkgs]
        cmd = [sys.executable, "-m", "pip", "install", *packages]
        return await subprocess_sse(cmd, ctx.project_dir)

    return router


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
    if req.no_score:
        cmd += ["--no-score"]
    cmd += ["--energy-mode", req.energy_mode, "--scene-mode", req.scene_mode]
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
            [ffprobe, "-v", "quiet", "-print_format", "json",
             "-show_streams", "-select_streams", "s", str(p)],
            capture_output=True, text=True,
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


def _compute_time_estimate(req: EstimateRequest) -> dict:
    duration_s = req.duration_s
    n_tracks = max(1, req.audio_tracks)
    transcribe_tracks = req.transcribe_tracks if req.transcribe_tracks is not None else max(1, n_tracks // 2)

    scene_seconds = max(
        _SCENE_FAST_FLOOR_S if req.scene_mode == "fast" else 0.0,
        duration_s * _SCENE_COST_FRACTION.get(req.scene_mode, 0.005),
    )
    energy_cost, energy_label = _ENERGY_MODE.get(req.energy_mode, (0.002, ""))

    steps = [
        {
            "name":    "Extract audio",
            "seconds": duration_s * n_tracks * 0.05,
            "note":    f"{n_tracks} track(s)",
        },
        _whisper_step(req.model, req.has_gpu, duration_s, transcribe_tracks),
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
            "name":    "LLM scoring",
            "seconds": (duration_s / 180) * 4,
            "note":    f"~{int(duration_s / 180)} clips estimated",
        },
    ]
    total = sum(s["seconds"] for s in steps)
    for step in steps:
        step["hms"] = _format_duration(step["seconds"])
    pct_of_video = round(total / duration_s * 100, 1) if duration_s > 0 else 0
    return {
        "steps": steps,
        "total_hms": _format_duration(total),
        "total_seconds": total,
        "pct_of_video": pct_of_video,
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
