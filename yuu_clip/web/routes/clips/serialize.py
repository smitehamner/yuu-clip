"""Clip → JSON serialization and the shared parse/normalize helpers.

The staleness helpers decide whether a clip's exported artifacts still reflect its
current state; `_clip_dict` assembles the wire shape the UI consumes.
"""
from __future__ import annotations

import json as json_lib
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from yuu_clip.db.models import ClipCandidate, ClipExport, Video
from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
from yuu_clip.export.paths import export_paths, srt_path

_MAX_TAG_LEN = 40
_MAX_TAGS = 25


def _subtitle_status(
    clip: ClipCandidate, video: Optional[Video], export_dir: Optional[Path], name_template: str,
) -> str:
    if clip.exported_burn_subs:
        return "baked-in"
    if export_dir and video and srt_path(clip, video, export_dir, name_template) is not None:
        return "srt-sidecar"
    return "none"


def _related_clips_stale(clip: ClipCandidate, video: Optional[Video]) -> bool:
    if not clip.related_clips_at:
        return False
    if video and video.clips_scored_at and clip.related_clips_at < video.clips_scored_at:
        return True
    return False


def _transcript_stale(clip: ClipCandidate, video: Optional[Video]) -> bool:
    """True when a caption overlapping this clip was edited after it was last scored,
    so its scores/descriptions no longer match the transcript."""
    if not clip.transcript_edited_at:
        return False
    return bool(
        video and video.clips_scored_at and clip.transcript_edited_at > video.clips_scored_at
    )


def _export_stale(clip: ClipCandidate) -> tuple[bool, list[str]]:
    """Whether the exported video file for *clip* no longer reflects its current state.

    Only concerns the encoded file itself - cheap text artifacts (transcript excerpt,
    SRT caption sidecar) auto-refresh in place and are never "stale". A caption edit only
    stales the file when captions are actually part of the file's bytes (baked-in or
    muxed as a soft subtitle track); a plain cut is unaffected by transcript changes.
    """
    if not clip.exported_at:
        return False, []
    reasons: list[str] = []
    if clip.trim_edited_at and clip.trim_edited_at > clip.exported_at:
        reasons.append("clip window changed")
    captions_in_file = bool(clip.exported_burn_subs or clip.exported_embed_subs)
    if captions_in_file and clip.transcript_edited_at and clip.transcript_edited_at > clip.exported_at:
        reasons.append("captions changed")
    if clip.exported_title_card and clip.description_edited_at and clip.description_edited_at > clip.exported_at:
        reasons.append("description changed")
    return bool(reasons), reasons


def _row_export_stale(clip: ClipCandidate, row: ClipExport) -> tuple[bool, list[str]]:
    """Per-format analogue of _export_stale, above: uses this row's own created_at
    and recorded settings instead of the clip's single legacy exported_at/exported_*
    snapshot, so each Export preset format gets its own independent stale flag."""
    settings = row.settings
    reasons: list[str] = []
    if clip.trim_edited_at and clip.trim_edited_at > row.created_at:
        reasons.append("clip window changed")
    captions_in_file = bool(settings.get("burn_subs") or settings.get("embed_subs"))
    if captions_in_file and clip.transcript_edited_at and clip.transcript_edited_at > row.created_at:
        reasons.append("captions changed")
    if settings.get("title_card") and clip.description_edited_at and clip.description_edited_at > row.created_at:
        reasons.append("description changed")
    return bool(reasons), reasons


def _clip_export_row_dict(clip: ClipCandidate, row: ClipExport) -> dict:
    stale, reasons = _row_export_stale(clip, row)
    path = Path(row.path)
    return {
        "id": row.id,
        "preset_name": row.preset_name,
        "container": row.container,
        "filename": path.name,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "size_bytes": row.size_bytes,
        "exists": path.exists(),
        "export_stale": stale,
        "export_stale_reasons": reasons,
    }


def _clip_dict(
    clip: ClipCandidate,
    full: bool = False,
    export_dir: Optional[Path] = None,
    video: Optional[Video] = None,
    name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> dict:
    export_rows = [_clip_export_row_dict(clip, row) for row in clip.exports]
    has_export = (
        export_dir is not None
        and video is not None
        and any(p.exists() for p in export_paths(clip, video, export_dir, name_template))
    ) or any(row["exists"] for row in export_rows)
    export_stale, export_stale_reasons = _export_stale(clip) if has_export else (False, [])
    d = {
        "id": clip.id,
        "video_id": clip.video_id,
        "start_ms": clip.start_ms,
        "end_ms": clip.end_ms,
        "start_hms": clip.start_hms,
        "duration_hms": clip.duration_hms,
        "score_overall": round(clip.score_overall, 3),
        "score_funny": round(clip.score_funny, 3),
        "score_dramatic": round(clip.score_dramatic, 3),
        "score_action": round(clip.score_action, 3),
        "score_laugh": round(clip.score_laugh, 3) if clip.score_laugh is not None else None,
        "score_overall_user": round(clip.score_overall_user, 3) if clip.score_overall_user is not None else None,
        "scored_at": clip.scored_at.isoformat() if clip.scored_at else None,
        "description": clip.effective_description,
        "description_original": clip.description or "",
        "description_is_edited": clip.description_user is not None,
        "description_long": clip.effective_description_long,
        "description_long_original": clip.description_long or "",
        "description_long_is_edited": clip.description_long_user is not None,
        "start_offset": clip.start_offset,
        "end_offset": clip.end_offset,
        "crop_x": clip.crop_x,
        "status": clip.status,
        "tags": clip.tags,
        "user_tags": clip.user_tags,
        "has_export": has_export,
        "exported_at": clip.exported_at.isoformat() if clip.exported_at else None,
        "exported_container": clip.exported_container or None,
        "exported_burn_subs": clip.exported_burn_subs,
        "exported_embed_subs": clip.exported_embed_subs,
        "exported_title_card": clip.exported_title_card,
        "subtitle_status": _subtitle_status(clip, video, export_dir, name_template) if has_export else "none",
        "related_clips": json_lib.loads(clip.related_clips_json) if clip.related_clips_json else None,
        "related_clips_at": clip.related_clips_at.isoformat() if clip.related_clips_at else None,
        "related_clips_stale": _related_clips_stale(clip, video),
        "vision_summary": clip.vision_summary or None,
        "vision_analyzed_at": clip.vision_analyzed_at.isoformat() if clip.vision_analyzed_at else None,
        "hotword_matches": clip.hotword_matches,
        "hotword_boost": clip.hotword_boost,
        "sensitive_matches": clip.sensitive_matches,
        "transcript_stale": _transcript_stale(clip, video),
        "export_stale": export_stale,
        "export_stale_reasons": export_stale_reasons,
        "exports": export_rows,
    }
    if full:
        d["transcript_excerpt"] = clip.transcript_excerpt or ""
    return d


def _parse_clip_ids(raw: str) -> list[int]:
    try:
        return [int(x.strip()) for x in raw.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "clip_ids must be a comma-separated list of integers")


def _normalize_tags(raw: list[str]) -> list[str]:
    """Trim, length-cap, de-dupe (case-insensitively, keeping first casing), and
    cap the count. Empty entries are dropped; order is preserved."""
    seen: set[str] = set()
    out: list[str] = []
    for item in raw:
        tag = (item or "").strip()[:_MAX_TAG_LEN].strip()
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(tag)
        if len(out) >= _MAX_TAGS:
            break
    return out
