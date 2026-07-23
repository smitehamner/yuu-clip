# Feature-map - Export: on-disk path resolution for a clip's export + sidecars,
#   plus the shared 400-validation for the ?preset= / caption-style query params.
#   Siblings: naming.py (stem template), presets.py (preset defs), render.py (engine)
"""Where a clip's exported files live on disk, and query-param validation for exports."""
from __future__ import annotations

import glob
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE, candidate_export_paths, export_base_stem


def clip_stem(clip: ClipCandidate, video: Video, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE) -> str:
    return export_base_stem(clip, name_template, video_filename=video.filename)


def export_paths(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> list[Path]:
    """All candidate export file paths for a clip's *default* (presetless) export."""
    stem = clip_stem(clip, video, name_template)
    return candidate_export_paths(export_dir, stem)


def srt_path(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> Optional[Path]:
    p = export_dir / f"{clip_stem(clip, video, name_template)}.srt"
    return p if p.exists() else None


def srt_sidecar_paths(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> list[Path]:
    """Existing SRT sidecars for a clip: per-label ({stem}.player_voice.srt) plus
    the merged {stem}.srt. Video files are excluded - this is captions only."""
    stem = clip_stem(clip, video, name_template)
    files = list(export_dir.glob(f"{glob.escape(stem)}.*.srt"))
    merged = export_dir / f"{stem}.srt"
    if merged.exists():
        files.append(merged)
    return files


def all_sidecar_paths(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> list[Path]:
    """All on-disk sidecar paths for a clip: video exports + all SRT sidecars.

    Includes per-label sidecars (e.g. {stem}.player_voice.srt) produced by
    export_srt_sidecars when multiple audio tracks are transcribed.
    """
    stem = clip_stem(clip, video, name_template)
    srt_files = list(export_dir.glob(f"{glob.escape(stem)}.*.srt"))
    merged_srt = export_dir / f"{stem}.srt"
    if merged_srt.exists():
        srt_files.append(merged_srt)
    return [*export_paths(clip, video, export_dir, name_template), *srt_files]


def clip_export_row_files(clip: ClipCandidate) -> list[Path]:
    """Existing on-disk files referenced by this clip's clip_exports rows (every
    tracked Export preset format) - the per-format counterpart to export_paths'
    single-file, glob-based "default" lookup."""
    return [p for p in (Path(row.path) for row in clip.exports) if p.exists()]


def validate_export_preset_query(ctx, preset: Optional[str], embed_subs: bool) -> None:
    """Shared 400 checks for the ?preset= query param on every export route
    (single, batch, bulk): unknown preset id, or combined with embed_subs (a
    preset export doesn't support the soft-subtitle track)."""
    if not preset:
        return
    if embed_subs:
        raise HTTPException(400, "embed_subs isn't supported together with a preset export")
    from yuu_clip.export.presets import resolve_preset
    if resolve_preset(preset, ctx.config.export_presets) is None:
        raise HTTPException(400, f"Unknown export preset '{preset}'")


def validate_caption_style_query(
    caption_font: Optional[str], caption_size: Optional[int], caption_position: Optional[str],
    word_chunk_size: Optional[int] = None,
) -> None:
    """Shared 400 checks for the per-export caption-style overrides on the single
    export route - same rules the config PATCH route and the CLI resolver enforce."""
    from yuu_clip.config import (
        CAPTION_POSITIONS,
        validate_caption_font_name,
        validate_caption_font_size,
        validate_caption_word_chunk_size,
    )
    try:
        if caption_font is not None:
            validate_caption_font_name(caption_font)
        if caption_size is not None:
            validate_caption_font_size(caption_size)
        if word_chunk_size is not None:
            validate_caption_word_chunk_size(word_chunk_size)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if caption_position is not None and caption_position not in CAPTION_POSITIONS:
        raise HTTPException(400, f"caption_position must be one of: {sorted(CAPTION_POSITIONS)}")
