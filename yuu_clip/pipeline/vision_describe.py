"""Opt-in auto vision-LLM description for silent, high-Visual clips (video-heavy
analysis Stage 4). OFF by default - reserves the expensive vision-LLM pass for the
top-N textless clips ranked by score_visual, reusing the existing frame-sampling +
vision path (analyze/frames.py) rather than adding a new one.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from yuu_clip.console import console
from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate, Video

log = get_logger(__name__)


def select_vision_candidates(clips: list["ClipCandidate"], topn: int) -> list["ClipCandidate"]:
    """Pick the top *topn* silent clips for auto vision description.

    Eligible = an empty transcript excerpt (nothing for a text-based scorer to
    describe) AND never yet vision-analyzed (``vision_analyzed_at`` is None) - a
    clip already described stays untouched so a re-run never re-describes (and
    re-bills) the same clip. Ranked by highest score_visual; ties keep the
    caller's original order (stable sort).
    """
    eligible = [
        clip for clip in clips
        if not (clip.transcript_excerpt or "").strip() and clip.vision_analyzed_at is None
    ]
    eligible.sort(key=lambda clip: clip.score_visual or 0.0, reverse=True)
    return eligible[:max(0, topn)]


def auto_describe_visual_clips(
    video: "Video", config: "Config", session: "Session",
    proxy_dir: Optional[Path], context_text: str = "",
) -> int:
    """Run the vision-LLM pass over *video*'s top-N silent, high-Visual clips.

    OFF by default (``config.visual_auto_vision_enabled``); hard-capped at
    ``config.visual_vision_topn``. Never raises - a disabled toggle, an
    unavailable vision model, a missing proxy directory, or a per-clip failure
    all degrade to a skip notice or a logged warning. Returns the number of
    clips actually described.
    """
    if not config.visual_auto_vision_enabled:
        return 0

    from yuu_clip.scoring.llm import check_vision_available

    vision_ok, reason = check_vision_available(config)
    if not vision_ok:
        console.print(f"  [yellow]Auto-describe silent clips skipped - {reason}.[/yellow]")
        log.info("Auto vision-describe skipped: %s. video_id=%s", reason, video.id)
        return 0

    if proxy_dir is None:
        console.print(
            "  [yellow]Auto-describe silent clips skipped - no preview proxy directory "
            "available.[/yellow]"
        )
        return 0

    from yuu_clip.db.models import ClipCandidate

    clips = (
        session.query(ClipCandidate)
        .filter_by(video_id=video.id, kind="clip")
        .order_by(ClipCandidate.start_ms)
        .all()
    )
    candidates = select_vision_candidates(clips, config.visual_vision_topn)
    if not candidates:
        return 0

    from yuu_clip.analyze.frames import analyze_clip_frames
    from yuu_clip.scoring.engine import DESC_BASIC_TAG

    console.print(f"  [bold]Describing {len(candidates)} silent clip(s) with the vision model...[/bold]")
    described = 0
    for clip in candidates:
        try:
            summary = analyze_clip_frames(video, clip, config, proxy_dir, context_text)
        except Exception as exc:
            console.print(f"  [yellow]  Vision description failed for clip {clip.id}: {exc}[/yellow]")
            log.warning("Auto vision-describe failed for clip %d: %s", clip.id, exc, exc_info=True)
            continue
        if not summary:
            continue
        clip.description = summary
        clip.tags = [t for t in clip.tags if t != DESC_BASIC_TAG]
        clip.vision_summary = summary
        clip.vision_analyzed_at = datetime.now(timezone.utc)
        session.commit()
        described += 1

    console.print(f"  [green]  OK[/green] {described} clip(s) described")
    return described
