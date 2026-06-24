"""
rp-clipper web UI — FastAPI backend.

Thin wrapper over the existing ORM and pipeline functions.
All heavy work is delegated to the same code the CLI uses.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

# ── project imports ─────────────────────────────────────────────────────────
from rp_clipper.db.models import (
    AudioTrack, ClipCandidate, Video, make_session,
)
from rp_clipper.config import Config

_HERE = Path(__file__).parent

# ── time estimate constants ───────────────────────────────────────────────────
# Approximate processing speed ratios relative to real-time, calibrated against
# observed runs (2h10m video, large-v3, RTX-class GPU).
# All values are "how many seconds of video processed per second of wall time."
_WHISPER_RT: dict[str, float] = {
    "large-v3": 6,   # ~10 min / hour on GPU
    "large-v2": 6,
    "large":    6,
    "medium":   18,
    "small":    30,
    "base":     50,
    "tiny":     80,
}
_WHISPER_RT_CPU = 0.4   # large-v3 on CPU; others scale similarly

def _fmt_time(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds//60}m {seconds%60:02d}s"
    h, rem = divmod(seconds, 3600)
    return f"{h}h {rem//60:02d}m"


# ── app factory ─────────────────────────────────────────────────────────────

def create_app(project_dir: Path) -> FastAPI:
    app = FastAPI(title="rp-clipper", version="0.1.0")

    data_dir   = project_dir / ".rp-clipper"
    db_path    = data_dir / "project.db"
    export_dir = data_dir / "exports"
    audio_dir  = data_dir / "audio"
    export_dir.mkdir(parents=True, exist_ok=True)

    def get_db() -> Session:
        return make_session(db_path)

    # ── static + SPA ────────────────────────────────────────────────────────

    @app.get("/", response_class=HTMLResponse)
    async def index():
        return FileResponse(_HERE / "static" / "index.html")

    # serve exported clips and audio
    app.mount("/media/exports", StaticFiles(directory=str(export_dir), html=False), name="exports")

    # ── API: videos ─────────────────────────────────────────────────────────

    @app.get("/api/videos")
    def list_videos():
        db = get_db()
        videos = db.query(Video).order_by(Video.created_at.desc()).all()
        return [
            {
                "id": v.id,
                "filename": v.filename,
                "status": v.status,
                "duration_hms": v.duration_hms,
                "clip_count": db.query(ClipCandidate).filter_by(video_id=v.id).count(),
                "approved": db.query(ClipCandidate).filter_by(video_id=v.id, status="approved").count(),
            }
            for v in videos
        ]

    # ── API: clips ───────────────────────────────────────────────────────────

    @app.get("/api/videos/{video_id}/clips")
    def list_clips(video_id: int, status: Optional[str] = Query(None)):
        db = get_db()
        q = db.query(ClipCandidate).filter_by(video_id=video_id)
        if status:
            q = q.filter_by(status=status)
        clips = q.order_by(ClipCandidate.score_overall.desc()).all()
        return [_clip_dict(c) for c in clips]

    @app.get("/api/clips/{clip_id}")
    def get_clip(clip_id: int):
        db = get_db()
        c = db.get(ClipCandidate, clip_id)
        if not c:
            raise HTTPException(404, "Clip not found")
        return _clip_dict(c, full=True)

    class StatusUpdate(BaseModel):
        status: str   # approved | rejected | pending

    @app.post("/api/clips/{clip_id}/status")
    def set_clip_status(clip_id: int, body: StatusUpdate):
        if body.status not in ("approved", "rejected", "pending"):
            raise HTTPException(400, "status must be approved | rejected | pending")
        db = get_db()
        c = db.get(ClipCandidate, clip_id)
        if not c:
            raise HTTPException(404, "Clip not found")
        c.status = body.status
        db.commit()
        return {"id": clip_id, "status": body.status}

    # ── API: media file path ────────────────────────────────────────────────

    @app.get("/api/clips/{clip_id}/media_url")
    def clip_media_url(clip_id: int):
        """Return the URL path to the exported video file for this clip, if it exists."""
        db = get_db()
        c = db.get(ClipCandidate, clip_id)
        if not c:
            raise HTTPException(404, "Clip not found")
        v = db.get(Video, c.video_id)
        stem = Path(v.filename).stem
        start_hms = c.start_hms.replace(":", "-")
        filename = f"{stem}_clip{c.id}_{start_hms}.mkv"
        full_path = export_dir / filename
        if full_path.exists():
            return {"url": f"/media/exports/{filename}", "filename": filename}
        return {"url": None, "filename": filename}

    # ── API: probe + time estimates ─────────────────────────────────────────

    class ProbeRequest(BaseModel):
        path: str

    @app.post("/api/probe")
    def probe_video_file(req: ProbeRequest):
        """Probe a video file and return duration + stream counts."""
        from rp_clipper.ingest.probe import probe_video
        p = Path(req.path)
        if not p.exists():
            raise HTTPException(400, f"File not found: {req.path}")
        try:
            info = probe_video(p)
        except Exception as e:
            raise HTTPException(400, str(e))
        return {
            "filename": p.name,
            "duration_s": (info.duration_ms or 0) / 1000,
            "duration_hms": info.duration_hms,
            "width": info.width,
            "height": info.height,
            "fps": info.fps,
            "audio_tracks": len(info.audio_streams),
        }

    class EstimateRequest(BaseModel):
        duration_s: float
        model: str = "large-v3"
        audio_tracks: int = 2
        has_gpu: bool = True
        scene_mode: str = "fast"   # transcript | fast | full

    @app.post("/api/estimate")
    def estimate_times(req: EstimateRequest):
        """Return per-step wall-clock time estimates for a given video length."""
        d = req.duration_s
        n_tracks = max(1, req.audio_tracks)
        rt = _WHISPER_RT.get(req.model.split(":")[0], 6)
        if not req.has_gpu:
            rt = _WHISPER_RT_CPU
        transcribe_tracks = max(1, n_tracks // 2)

        scene_seconds = {
            "transcript": 2.0,
            "fast": max(10.0, d * 0.005),   # ffprobe keyframes: ~0.5% of duration
            "full": d * 0.6,                 # full frame scan
        }.get(req.scene_mode, d * 0.005)
        scene_note = {
            "transcript": "silence gaps only",
            "fast": "keyframes + transcript gaps",
            "full": "full frame scan (slow)",
        }.get(req.scene_mode, "")

        steps = [
            {"name": "Extract audio",
             "seconds": d * n_tracks * 0.05,
             "note": f"{n_tracks} tracks"},
            {"name": f"Transcribe ({req.model})",
             "seconds": d * transcribe_tracks / rt,
             "note": f"~{transcribe_tracks} track(s) on {'GPU' if req.has_gpu else 'CPU'}"},
            {"name": "Audio energy",
             "seconds": d * transcribe_tracks * 0.3,
             "note": "fast"},
            {"name": f"Scene detection ({req.scene_mode})",
             "seconds": scene_seconds,
             "note": scene_note},
            {"name": "LLM scoring",
             "seconds": (d / 180) * 4,
             "note": f"~{int(d/180)} clips estimated"},
        ]
        total = sum(s["seconds"] for s in steps)
        for s in steps:
            s["hms"] = _fmt_time(s["seconds"])
        return {"steps": steps, "total_hms": _fmt_time(total), "total_seconds": total}

    # ── SSE: ingest progress ────────────────────────────────────────────────

    class IngestRequest(BaseModel):
        path: str
        model: str = "large-v3"
        profile: Optional[str] = None
        no_score: bool = False

    @app.post("/api/ingest/start")
    async def start_ingest(req: IngestRequest):
        """Launch ingest as a subprocess; stream output via /api/ingest/events."""
        video_path = Path(req.path)
        if not video_path.exists():
            raise HTTPException(400, f"File not found: {req.path}")
        cmd = [
            sys.executable, "-m", "rp_clipper.cli", "ingest",
            str(video_path),
            "--model", req.model,
            "--project", str(project_dir),
        ]
        if req.profile:
            cmd += ["--profile", req.profile]
        if req.no_score:
            cmd += ["--no-score"]
        # Store the command for the SSE endpoint to pick up
        app.state.ingest_cmd = cmd
        app.state.ingest_running = True
        return {"status": "started"}

    @app.get("/api/ingest/events")
    async def ingest_events():
        """SSE stream — emits lines from the running ingest subprocess."""
        cmd = getattr(app.state, "ingest_cmd", None)
        if not cmd:
            raise HTTPException(400, "No ingest running. Call /api/ingest/start first.")

        async def generate() -> AsyncGenerator[str, None]:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(project_dir),
            )
            assert proc.stdout
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").rstrip()
                yield f"data: {json.dumps(text)}\n\n"
            await proc.wait()
            yield f"data: {json.dumps('__DONE__')}\n\n"
            app.state.ingest_running = False

        return StreamingResponse(generate(), media_type="text/event-stream")

    # ── API: score ───────────────────────────────────────────────────────────

    @app.post("/api/score")
    async def score_all():
        """Re-score all videos; streams progress lines."""
        cmd = [sys.executable, "-m", "rp_clipper.cli", "score", "--all", "--project", str(project_dir)]

        async def generate() -> AsyncGenerator[str, None]:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(project_dir),
            )
            assert proc.stdout
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                yield f"data: {json.dumps(line.decode('utf-8', errors='replace').rstrip())}\n\n"
            yield f"data: {json.dumps('__DONE__')}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    # ── API: native file picker ─────────────────────────────────────────────────

    @app.get("/api/pick-file")
    def pick_file():
        """Open the OS-native file dialog on the server machine and return the path."""
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

    # ── API: export ──────────────────────────────────────────────────────────

    @app.get("/api/clips/{clip_id}/export")
    async def export_clip_api(clip_id: int):
        """Export a single clip and stream ffmpeg progress."""
        cmd = [sys.executable, "-m", "rp_clipper.cli", "export", str(clip_id), "--subtitles", "--project", str(project_dir)]

        async def generate() -> AsyncGenerator[str, None]:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(project_dir),
            )
            assert proc.stdout
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                yield f"data: {json.dumps(line.decode('utf-8', errors='replace').rstrip())}\n\n"
            yield f"data: {json.dumps('__DONE__')}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    return app


# ── helpers ──────────────────────────────────────────────────────────────────

def _clip_dict(c: ClipCandidate, full: bool = False) -> dict:
    d = {
        "id": c.id,
        "video_id": c.video_id,
        "start_ms": c.start_ms,
        "end_ms": c.end_ms,
        "start_hms": c.start_hms,
        "duration_hms": c.duration_hms,
        "score_overall": round(c.score_overall, 3),
        "score_funny": round(c.score_funny, 3),
        "score_dramatic": round(c.score_dramatic, 3),
        "score_action": round(c.score_action, 3),
        "description": c.description or "",
        "status": c.status,
        "tags": c.tags,
    }
    if full:
        d["transcript_excerpt"] = c.transcript_excerpt or ""
    return d
