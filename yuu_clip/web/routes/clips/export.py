"""Export HTTP wiring - build the CLI export command, stream per-clip export
progress as SSE, and the video-scoped batch-export route.

This is transport only: the actual cut/encode lives in ``yuu_clip/export/render.py``,
invoked out-of-process via ``python -m yuu_clip.cli export``.
"""
from __future__ import annotations

import asyncio
import subprocess as _subprocess
import sys
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from yuu_clip.config import validate_whisper_model
from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.export.paths import export_paths, validate_export_preset_query
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.jobevents import OUTCOME_OK, done_event, log_event
from yuu_clip.web.routes.common import active_job, reject_if_busy, sse_response
from yuu_clip.web.sse import new_session_kwargs, terminate_process_tree_async

_log = get_logger(__name__)


def _clip_has_export_file(ctx: "ProjectContext", clip_id: int) -> bool:
    """Check whether a clip already has an exported file on disk. Opens and closes its own DB session."""
    db = ctx.get_db()
    try:
        clip = db.get(ClipCandidate, clip_id)
        vid  = db.get(Video, clip.video_id) if clip else None
        if clip and vid:
            return any(p.exists() for p in export_paths(clip, vid, ctx.export_dir, ctx.config.export_name_template))
        return False
    finally:
        db.close()


def _build_export_cmd(
    ctx: ProjectContext,
    clip_id: int,
    *,
    burn_subs: bool,
    embed_subs: bool,
    container: Optional[str],
    retranscribe: bool,
    retranscribe_model: str,
    preset: Optional[str] = None,
) -> list[str]:
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
    if preset:
        cmd.extend(["--preset", preset])
    return cmd


async def _run_export_subprocess(cmd: list[str], cwd) -> tuple[Optional[int], bytes]:
    """Run one clip-export subprocess and return (returncode, combined_output).

    If this coroutine is cancelled - the batch-export SSE client disconnected
    while a clip was mid-encode - the finally kills the python+ffmpeg tree instead
    of letting it run on after the stream is gone. CancelledError is a
    BaseException, so only a finally (not the caller's `except Exception`) can
    guarantee the cleanup.
    """
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=_subprocess.PIPE,
            stderr=_subprocess.STDOUT,
            cwd=str(cwd),
            **new_session_kwargs(),
        )
        out, _ = await proc.communicate()
        return proc.returncode, out
    finally:
        if proc is not None and proc.returncode is None:
            await terminate_process_tree_async(proc)


def _clip_export_stream_response(
    ctx: ProjectContext,
    clip_ids: list[int],
    *,
    skip_exported: bool,
    burn_subs: bool,
    embed_subs: bool,
    container: Optional[str],
    retranscribe: bool,
    retranscribe_model: str,
    preset: Optional[str] = None,
):
    """Stream sequential per-clip exports as SSE. Shared by the video-scoped batch
    export (filtered by approval/score) and the explicit-selection bulk export."""
    reject_if_busy(ctx, "Export")

    async def event_stream():
        async with active_job(ctx):
            total = len(clip_ids)
            exported = 0
            skipped  = 0
            for i, cid in enumerate(clip_ids, 1):
                if skip_exported and _clip_has_export_file(ctx, cid):
                    skipped += 1
                    yield log_event(f'Skipping clip {cid} (already exported) [{i}/{total}]')
                    continue

                yield log_event(f'Exporting clip {cid} [{i}/{total}]...')
                cmd = _build_export_cmd(
                    ctx, cid,
                    burn_subs=burn_subs, embed_subs=embed_subs,
                    container=container,
                    retranscribe=retranscribe, retranscribe_model=retranscribe_model,
                    preset=preset,
                )
                try:
                    returncode, out = await _run_export_subprocess(cmd, ctx.project_dir)
                    if returncode == 0:
                        exported += 1
                        yield log_event(f'OK clip {cid} [{i}/{total}]')
                    else:
                        msg = out.decode(errors="replace").strip().splitlines()
                        last = msg[-1] if msg else "unknown error"
                        _log.error("clip export failed for clip %d (rc=%d): %s", cid, returncode, last)
                        yield log_event(f'[Error clip {cid} (exit {returncode}): {last}]', level="error")
                except Exception as exc:
                    _log.error("clip export subprocess failed for clip %d: %s", cid, exc, exc_info=True)
                    yield log_event(f'[Error clip {cid}: {exc}]', level="error")

            # Partial failures stay prose-only by design: individual clips may fail
            # (log level=error above) while the batch as a whole ends OK.
            yield log_event(f'Export complete: {exported} exported, {skipped} skipped')
            yield done_event(OUTCOME_OK)

    return sse_response(event_stream())


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/videos/{video_id}/batch-export")
    async def batch_export(
        video_id: int,
        min_score: float = Query(0.0),
        skip_exported: bool = Query(True),
        burn_subs: bool = Query(False),
        embed_subs: bool = Query(False),
        container: Optional[str] = Query(None),
        retranscribe: bool = Query(False),
        retranscribe_model: str = Query("large-v3"),
        preset: Optional[str] = Query(None, description="Export preset id (built-in or custom); omit for original quality"),
    ):
        """Export all approved clips for a video above min_score, streaming per-clip progress as SSE."""
        allowed_containers = {"mkv", "mp4"}
        if container is not None and container not in allowed_containers:
            raise HTTPException(400, f"container must be one of {sorted(allowed_containers)}")

        if retranscribe:
            try:
                validate_whisper_model(retranscribe_model)
            except ValueError as e:
                raise HTTPException(400, str(e))
        validate_export_preset_query(ctx, preset, embed_subs)

        db = ctx.get_db()
        try:
            if not db.get(Video, video_id):
                raise HTTPException(404, "Video not found")
            clips = (
                db.query(ClipCandidate)
                .filter(
                    ClipCandidate.video_id == video_id,
                    ClipCandidate.status == "approved",
                    ClipCandidate.score_overall >= min_score,
                )
                .order_by(ClipCandidate.start_ms)
                .all()
            )
            clip_ids = [c.id for c in clips]
        finally:
            db.close()

        if not clip_ids:
            raise HTTPException(400, "No approved clips match the filter")

        return _clip_export_stream_response(
            ctx, clip_ids,
            skip_exported=skip_exported, burn_subs=burn_subs, embed_subs=embed_subs,
            container=container, retranscribe=retranscribe, retranscribe_model=retranscribe_model,
            preset=preset,
        )
