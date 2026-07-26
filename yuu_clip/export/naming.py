"""
Export filename stem: template, validation, and rendering.

Shared by the CLI export/retranscribe commands (which create export files) and
the web routes (which independently locate already-exported files on disk for
has_export badges, downloads, playback, delete, and merge-rename). Both sides
must derive the exact same stem from the same template, so this lives in one
place neither `cli/` nor `web/` needs to import the other for.
"""
from __future__ import annotations

import re
from datetime import date as _date
from pathlib import Path
from typing import Optional

from yuu_clip.log import get_logger

_log = get_logger(__name__)

DEFAULT_EXPORT_NAME_TEMPLATE = "{video}_clip{clip_id}_{start}"
EXPORT_NAME_PLACEHOLDERS: frozenset[str] = frozenset(
    {"video", "clip_id", "start", "end", "score", "date", "preset"}
)

# Container extensions a clip's exported video file may have been written with -
# shared by every caller that locates an already-exported file by its base stem
# (web routes, the reel builder, the clip_exports backfill migration).
EXPORT_VIDEO_EXTENSIONS: tuple[str, ...] = (".mkv", ".mp4", ".mov", ".avi", ".webm")


def candidate_export_paths(export_dir: Path, stem: str) -> list[Path]:
    """All candidate export file paths for a given base stem (any supported container)."""
    return [export_dir / f"{stem}{ext}" for ext in EXPORT_VIDEO_EXTENSIONS]


def validate_export_name_template(template: str) -> str:
    """
    Raise ValueError if *template* references a placeholder outside
    EXPORT_NAME_PLACEHOLDERS, or is not a well-formed format string (e.g. an
    unbalanced brace like ``clip_{video}}``). Returns the template unchanged if
    valid.
    """
    used = set(re.findall(r"\{(\w*)\}", template))
    unknown = used - EXPORT_NAME_PLACEHOLDERS
    if unknown:
        raise ValueError(
            f"Unknown placeholder(s) in export filename template: {', '.join(sorted(unknown))}.  "
            f"Allowed: {', '.join(sorted(EXPORT_NAME_PLACEHOLDERS))}"
        )
    # A stray/unbalanced brace passes the placeholder regex above but blows up
    # str.format later (in export_base_stem, on every export AND every has-export
    # lookup). Reject it here so the save fails with a clear message instead.
    try:
        template.format(**{name: "" for name in EXPORT_NAME_PLACEHOLDERS})
    except (ValueError, IndexError, KeyError) as exc:
        raise ValueError(
            "Export filename template has an unbalanced or misplaced brace - "
            "use { and } only around a placeholder name."
        ) from exc
    return template


def _end_hms(cand) -> str:
    """Wall-clock end timecode, same h:mm:ss-or-m:ss format as ClipCandidate.start_hms."""
    s = cand.end_ms // 1000
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _default_stem(cand, video_filename: Optional[str]) -> str:
    video = Path(video_filename if video_filename is not None else cand.video.filename).stem
    return f"{video}_clip{cand.id}_{cand.start_hms.replace(':', '-')}"


def export_base_stem(
    cand, template: str, *, video_filename: Optional[str] = None, preset: Optional[str] = None,
) -> str:
    """Render *template* into a sanitized export filename stem for *cand*.

    video_filename overrides cand.video.filename - callers that already have the
    Video row in hand (the web routes locating already-exported files) pass it
    explicitly rather than relying on the ORM relationship lazy-loading it.

    preset is the Export preset name ("default"/None for the original-quality
    export). When the template doesn't reference {preset} itself, a non-default
    preset name is appended as a "_{preset}" suffix so two formats of the same
    clip never collide on disk - the default export's filename is unchanged
    (back-compat with every pre-Plan-07 lookup and exported file).

    Only computes the placeholder values the template actually references, so a
    caller using the default (or any {video}/{clip_id}/{start}-only) template
    never needs cand.end_ms or cand.score_overall populated.

    Placeholders are validated when the template is saved (see
    validate_export_name_template), so a KeyError/IndexError here means a
    stale/hand-edited template - fall back to the default rather than break a
    lookup or an export. The rendered stem is stripped of filesystem-unsafe
    characters and guaranteed non-empty (also falling back to the default).
    """
    used = set(re.findall(r"\{(\w*)\}", template))
    values: dict = {}
    if "video" in used:
        values["video"] = Path(video_filename if video_filename is not None else cand.video.filename).stem
    if "clip_id" in used:
        values["clip_id"] = cand.id
    if "start" in used:
        values["start"] = cand.start_hms.replace(":", "-")
    if "end" in used:
        values["end"] = _end_hms(cand).replace(":", "-")
    if "score" in used:
        values["score"] = f"{cand.score_overall:.1f}" if cand.score_overall is not None else "no-score"
    if "date" in used:
        values["date"] = _date.today().isoformat()
    if "preset" in used:
        values["preset"] = preset or "default"
    try:
        stem = template.format(**values)
    except (KeyError, IndexError, ValueError) as exc:
        _log.warning(
            "export_base_stem: template %r failed to render for clip %s (%s) - "
            "falling back to the default naming scheme",
            template, cand.id, exc,
        )
        stem = _default_stem(cand, video_filename)
    if preset and preset != "default" and "preset" not in used:
        stem = f"{stem}_{preset}"
    stem = re.sub(r'[\\/:*?"<>|]', "", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem or _default_stem(cand, video_filename)
