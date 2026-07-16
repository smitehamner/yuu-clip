# Feature-map - Highlight reel (code: demo_reel / build_reel)
#   UI: static/analyze/reel.js (Build + View modal)
#   Siblings: reel.py (build_reel, title_card_lines) · tests/integration/test_reel.py, tests/ui/test_ui_reel.py
"""
Highlight reel compilation routes.

Uses the same start→events pattern as ingest: the POST endpoint validates
options and queues the CLI command; the GET endpoint streams its output as SSE.
Validation at the start step prevents starting a long render only to fail early.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from yuu_clip.db.models import ClipCandidate
from yuu_clip.export.paths import export_paths
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.file_deletion import delete_files, locked_files_error
from yuu_clip.web.routes.common import reject_if_busy, srt_to_vtt
from yuu_clip.web.sse import subprocess_sse

_log = get_logger(__name__)


class DemoRequest(BaseModel):
    video_id:    Optional[int]       = None
    clip_ids:    Optional[list[int]] = None   # ordered list; overrides video_id filter
    transition:  str   = "fade"
    trans_dur:   float = 0.5
    title_dur:   float = 3.0
    output_name: str   = ""
    captions:    bool  = False
    bake_captions: bool = False
    word_highlight: Optional[bool] = None
    word_chunk_size: Optional[int] = None


_REEL_POOL_STATUSES = {"approved", "pending", "rejected"}


def _parse_video_ids(raw: Optional[str]) -> list[int]:
    """Parse a comma-separated video_ids query param, ignoring blanks and non-ints."""
    if not raw:
        return []
    ids: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError:
            raise HTTPException(400, f"video_ids must be integers: got '{part}'")
    return ids


def _safe_filename(name: str, default: str = "highlights.mkv") -> str:
    """Return *name* with any directory components stripped.

    Prevents path traversal: 'output_name: ../../etc/evil' becomes 'evil'.
    A bare default is returned if the result would be empty after stripping.
    """
    safe = Path(name).name  # strips all parent components on all platforms
    return safe if safe else default


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/demo/start")
    def start_demo(req: DemoRequest):
        """Validate options, confirm there are approved clips, and queue the demo command."""
        from yuu_clip.reel import TRANSITIONS
        if req.transition not in TRANSITIONS:
            raise HTTPException(
                400,
                f"Unknown transition '{req.transition}'. Options: {', '.join(TRANSITIONS)}",
            )

        db = ctx.get_db()
        try:
            if req.clip_ids:
                clips = [
                    c for cid in req.clip_ids
                    for c in [db.get(ClipCandidate, cid)]
                    if c is not None
                ]
            else:
                q = db.query(ClipCandidate).filter_by(status="approved")
                if req.video_id:
                    q = q.filter_by(video_id=req.video_id)
                clips = q.order_by(ClipCandidate.score_overall.desc()).all()
            if not clips:
                raise HTTPException(400, "No approved clips found to compile into a highlight reel")
        finally:
            db.close()

        if req.output_name:
            output_name = _safe_filename(req.output_name)
            if not output_name.endswith(".mkv"):
                output_name += ".mkv"
        else:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_name = f"highlights_{ts}.mkv"

        ctx.reels_dir.mkdir(parents=True, exist_ok=True)
        output_path = ctx.reels_dir / output_name
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "reel",
            "--project",    str(ctx.project_dir),
            "--transition", req.transition,
            "--trans-dur",  str(req.trans_dur),
            "--title-dur",  str(req.title_dur),
            "--output",     str(output_path),
        ]
        if req.bake_captions:
            cmd += ["--bake-captions"]
            if req.word_highlight is not None:
                cmd.append("--word-highlight" if req.word_highlight else "--no-word-highlight")
            if req.word_chunk_size is not None:
                cmd += ["--word-chunk-size", str(req.word_chunk_size)]
        elif req.captions:
            cmd += ["--captions"]
        if req.clip_ids:
            for cid in req.clip_ids:
                cmd += ["--clip-id", str(cid)]
        else:
            cmd += ["--status", "approved"]
            if req.video_id:
                cmd += ["--video-id", str(req.video_id)]

        ctx.demo_cmd = cmd
        _log.info(
            "Demo reel queued: %d approved clip(s), output=%s, transition=%s",
            len(clips), output_name, req.transition,
        )
        return {"status": "started", "clip_count": len(clips), "output_name": output_name}

    @router.get("/api/demo/events")
    async def demo_events():
        """Stream demo compilation progress as SSE. Call /api/demo/start first."""
        if not ctx.demo_cmd:
            raise HTTPException(400, "No demo queued. Call /api/demo/start first.")
        reject_if_busy(ctx, "Highlight reel")
        return await subprocess_sse(
            ctx.demo_cmd, ctx.project_dir, ctx, clear_cmd_attr="demo_cmd", track_active_job=True
        )

    @router.get("/api/demo/approved-clips")
    def approved_clips_for_reel(
        video_id: Optional[int] = Query(None),
        video_ids: Optional[str] = Query(None),
        statuses: str = Query("approved"),
    ):
        """Return clips (timeline order) for the reel builder pool, with export status.

        Scope: `video_ids` (comma-separated) supersedes `video_id` when present -
        used for a session-scoped pool spanning several recordings. With neither,
        the pool is project-wide. `statuses` is a comma-separated subset of
        {approved, pending, rejected}; defaults to "approved" (historical behavior)."""
        from yuu_clip.db.models import Video
        requested = [s.strip() for s in statuses.split(",") if s.strip()]
        invalid = [s for s in requested if s not in _REEL_POOL_STATUSES]
        if not requested or invalid:
            raise HTTPException(
                400,
                f"statuses must be a comma-separated subset of: {', '.join(sorted(_REEL_POOL_STATUSES))}",
            )
        scope_ids = _parse_video_ids(video_ids)
        db = ctx.get_db()
        try:
            q = db.query(ClipCandidate).filter(ClipCandidate.status.in_(requested))
            if scope_ids:
                q = q.filter(ClipCandidate.video_id.in_(scope_ids))
            elif video_id:
                q = q.filter_by(video_id=video_id)
            clips = q.order_by(ClipCandidate.start_ms).all()

            vid_ids = {c.video_id for c in clips}
            video_map = {
                v.id: v
                for v in db.query(Video).filter(Video.id.in_(vid_ids)).all()
            }

            result = []
            for c in clips:
                video = video_map.get(c.video_id)
                export_file = None
                if video:
                    export_file = next(
                        (p for p in export_paths(c, video, ctx.export_dir, ctx.config.export_name_template) if p.exists()),
                        None,
                    )
                result.append({
                    "id": c.id,
                    "video_id": c.video_id,
                    "video_name": video.filename if video else "",
                    "start_hms": c.start_hms,
                    "duration_hms": c.duration_hms,
                    "duration_ms": c.end_ms - c.start_ms,
                    "score_overall": c.score_overall,
                    "description": c.description or "",
                    "status": c.status,
                    "has_export": export_file is not None,
                    "export_url": f"/api/clips/{c.id}/media_url" if export_file else None,
                })
        finally:
            db.close()
        return result

    @router.get("/api/demo/list")
    def list_reels():
        """Return highlight reel files from the reels directory, newest first."""
        from yuu_clip.reel import reel_caption_path, reel_composition_path
        if not ctx.reels_dir.exists():
            return []
        reels = []
        for f in ctx.reels_dir.iterdir():
            if f.suffix != ".mkv":
                continue
            st = f.stat()
            reels.append({
                "filename": f.name,
                "url": f"/media/reels/{f.name}",
                "size_mb": round(st.st_size / 1_048_576, 1),
                "date": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "mtime": st.st_mtime,
                "has_captions": reel_caption_path(f).exists(),
                "can_caption": reel_composition_path(f).exists(),
                "stale": _reel_stale(f, st.st_mtime),
            })
        reels.sort(key=lambda r: r["mtime"], reverse=True)
        for r in reels:
            del r["mtime"]
        return reels

    def _reel_stale(reel_path: Path, reel_mtime: float) -> Optional[bool]:
        """None (unknown) when the reel predates the composition manifest; otherwise True
        when a member clip was re-exported, or its export deleted, since the reel was built."""
        import json as _json

        from yuu_clip.reel import reel_composition_path

        comp_path = reel_composition_path(reel_path)
        if not comp_path.exists():
            return None
        comp = _json.loads(comp_path.read_text(encoding="utf-8"))
        clip_ids = [entry["id"] for entry in comp.get("clips", [])]
        if not clip_ids:
            return None
        db = ctx.get_db()
        try:
            clips = db.query(ClipCandidate).filter(ClipCandidate.id.in_(clip_ids)).all()
            found_ids = {c.id for c in clips}
            if found_ids != set(clip_ids):
                return True  # a member clip was deleted since the reel was built
            for clip in clips:
                if not clip.exported_at:
                    return True
                # exported_at is stored UTC-naive; attach tzinfo so the comparison against
                # st_mtime (an epoch, tz-agnostic) is apples-to-apples.
                exported_ts = clip.exported_at.replace(tzinfo=timezone.utc).timestamp()
                if exported_ts > reel_mtime:
                    return True
            return False
        finally:
            db.close()

    def _resolve_reel(filename: str) -> Path:
        """Return the reel path for a name, rejecting traversal and missing files."""
        safe = _safe_filename(filename)
        reel_path = ctx.reels_dir / safe
        if safe != filename or not reel_path.is_file():
            raise HTTPException(404, "Reel not found")
        return reel_path

    @router.delete("/api/demo/{filename}")
    def delete_reel(filename: str):
        """Delete a reel file and its caption/composition sidecars from disk."""
        from yuu_clip.reel import reel_ass_caption_path, reel_caption_path, reel_composition_path
        reel_path = _resolve_reel(filename)
        targets = [reel_path, reel_caption_path(reel_path), reel_ass_caption_path(reel_path),
                   reel_composition_path(reel_path)]
        locked = delete_files(targets)
        if locked:
            raise locked_files_error(locked)
        _log.info("Deleted reel %s (with sidecars)", reel_path.name)
        return {"deleted": reel_path.name}

    @router.post("/api/demo/{filename}/captions")
    def regenerate_reel_captions(filename: str):
        """Rebuild a reel's stitched SRT sidecar from its clips' current transcripts.

        Requires the composition sidecar written at build time; reels built before
        captions existed return 409 with a rebuild hint."""
        from yuu_clip.reel import build_reel_caption_srt, reel_composition_path
        reel_path = _resolve_reel(filename)
        if not reel_composition_path(reel_path).exists():
            raise HTTPException(
                409,
                "This reel was built before captions were supported - rebuild it "
                "with captions enabled to generate them.",
            )
        db = ctx.get_db()
        try:
            srt_path = build_reel_caption_srt(db, reel_path)
        finally:
            db.close()
        _log.info("Regenerated captions for reel %s", reel_path.name)
        return {"filename": reel_path.name, "has_captions": srt_path is not None}

    @router.get("/api/demo/{filename}/captions.vtt")
    def reel_captions_vtt(filename: str):
        """Serve a reel's SRT sidecar as WebVTT for <track> use in the reel player."""
        from yuu_clip.reel import reel_caption_path
        reel_path = _resolve_reel(filename)
        srt_path = reel_caption_path(reel_path)
        if not srt_path.exists():
            raise HTTPException(404, "No captions for this reel")
        return PlainTextResponse(
            srt_to_vtt(srt_path.read_text(encoding="utf-8", errors="replace")),
            media_type="text/vtt",
        )

    return router
