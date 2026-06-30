"""Cross-cutting helpers shared by two or more route modules."""
from __future__ import annotations

import json as json_lib
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from yuu_clip.db.models import ClipCandidate, Video

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@asynccontextmanager
async def _active_job(ctx):
    ctx.active_jobs += 1
    try:
        yield
    finally:
        ctx.active_jobs -= 1


def _sse_response(generator) -> StreamingResponse:
    return StreamingResponse(generator, media_type="text/event-stream", headers=_SSE_HEADERS)


def _json_list(s: Optional[str]) -> list:
    """Decode a JSON-encoded list column, returning [] for NULL/missing values."""
    return json_lib.loads(s) if s else []


def _require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def _clip_stem(clip: ClipCandidate, video: Video) -> str:
    return f"{Path(video.filename).stem}_clip{clip.id}_{clip.start_hms.replace(':', '-')}"


def _export_paths(clip: ClipCandidate, video: Video, export_dir: Path) -> list[Path]:
    """All candidate export file paths for a clip (any supported container extension)."""
    stem = _clip_stem(clip, video)
    return [export_dir / f"{stem}{ext}" for ext in (".mkv", ".mp4", ".mov", ".avi", ".webm")]


def _srt_path(clip: ClipCandidate, video: Video, export_dir: Path) -> Optional[Path]:
    p = export_dir / f"{_clip_stem(clip, video)}.srt"
    return p if p.exists() else None


def _all_sidecar_paths(clip: ClipCandidate, video: Video, export_dir: Path) -> list[Path]:
    """All on-disk sidecar paths for a clip: video exports + all SRT sidecars.

    Includes per-label sidecars (e.g. {stem}.player_voice.srt) produced by
    export_srt_sidecars when multiple audio tracks are transcribed.
    """
    stem = _clip_stem(clip, video)
    srt_files = list(export_dir.glob(f"{stem}.*.srt"))
    merged_srt = export_dir / f"{stem}.srt"
    if merged_srt.exists():
        srt_files.append(merged_srt)
    return [*_export_paths(clip, video, export_dir), *srt_files]
