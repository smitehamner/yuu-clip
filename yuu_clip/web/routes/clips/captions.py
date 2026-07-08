"""Caption/transcript routes - per-clip transcript lines, context transcript for the
export editor, caption-segment text edits, and the WebVTT sidecar for the player.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from yuu_clip.db.models import TranscriptSegment, Video
from yuu_clip.export.paths import srt_path
from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.clips.schemas import CaptionSegmentUpdate
from yuu_clip.web.routes.common import require_clip, srt_to_vtt, stage_segment_text_edit

_log = get_logger(__name__)


def register(router: APIRouter, ctx: ProjectContext) -> None:
    @router.get("/api/clips/{clip_id}/transcript")
    def clip_transcript(clip_id: int):
        """Timed transcript lines for the clip, clip-relative (0 = clip start).

        Each line carries start/end ms, the diarized speaker name (or null), and
        text - drives the per-line play-to-seek transcript view.
        """
        from yuu_clip.subtitles import clip_transcript_lines
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            return {"lines": clip_transcript_lines(clip)}
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/context-transcript")
    def clip_context_transcript(clip_id: int, pad_s: float = Query(30.0, ge=0, le=300)):
        """Transcript lines around a clip for the export editor's boundary extension:
        the clip's own lines flagged ``in_clip`` plus ~``pad_s`` seconds of neighboring
        context, timed recording-relative (segment-relative for a split segment).

        ``seek_offset_s`` is the segment start to add when seeking the parent player.
        """
        from yuu_clip.subtitles import clip_context_transcript_lines
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            return {
                "lines": clip_context_transcript_lines(clip, video, int(pad_s * 1000)),
                "seek_offset_s": video.segment_start_s or 0.0,
            }
        finally:
            db.close()

    @router.put("/api/caption-segments/{seg_id}")
    def update_caption_segment(seg_id: int, body: CaptionSegmentUpdate):
        """Edit a caption segment's text, then rebuild the excerpt of every clip that
        overlaps it and flag those clips as needing a re-score.

        Preserves the segment's speaker and timing - only the text changes.
        """
        from yuu_clip.subtitles import refresh_export_sidecars
        new_text = body.text.strip()
        if not new_text:
            raise HTTPException(400, "Caption text cannot be empty")
        db = ctx.get_db()
        try:
            seg = db.get(TranscriptSegment, seg_id)
            if not seg:
                raise HTTPException(404, "Caption segment not found")
            video_id = seg.transcript.audio_track.video_id
            affected = stage_segment_text_edit(db, seg, new_text)
            db.commit()
            for clip in affected:
                refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)
            _log.info(
                "Edited caption segment %d (video %d) - rebuilt %d clip excerpt(s)",
                seg_id, video_id, len(affected),
            )
            return {
                "seg_id": seg_id,
                "text": seg.text,
                "affected_clip_ids": [c.id for c in affected],
            }
        finally:
            db.close()

    @router.get("/api/clips/{clip_id}/captions.vtt")
    def clip_captions_vtt(clip_id: int):
        """Convert the exported SRT sidecar to WebVTT and return it for browser <track> use."""
        db = ctx.get_db()
        try:
            clip = require_clip(db, clip_id)
            video = db.get(Video, clip.video_id)
            srt = srt_path(clip, video, ctx.export_dir, ctx.config.export_name_template)
            if srt is None:
                raise HTTPException(404, "No SRT file found for this clip")
            return PlainTextResponse(srt_to_vtt(srt.read_text(encoding="utf-8", errors="replace")), media_type="text/vtt")
        finally:
            db.close()
