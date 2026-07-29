"""Near-duplicate ClipCandidate detection.

Flags pairs of clips on the same recording whose time windows overlap heavily -
the same underlying moment captured by two segmentation passes. The signal is
pure timestamp overlap, not transcript/content similarity: this is a
segmentation artifact (one source video, different windower runs), not a
cross-clip similarity problem. The actual merge is done by the existing
POST /api/clips/{id}/merge route; this module only finds the pairs.
"""
from __future__ import annotations

from yuu_clip.db.models import ClipCandidate

DEFAULT_OVERLAP_THRESHOLD = 0.7

# System tag written to a flagged clip's tags_json so the badge survives a page
# reload and the clip stays filterable in the existing tag-based UI.
DUPLICATE_TAG = "possible_duplicate"


def _overlap_ratio(clip_a: ClipCandidate, clip_b: ClipCandidate) -> float:
    overlap_ms = max(0, min(clip_a.end_ms, clip_b.end_ms) - max(clip_a.start_ms, clip_b.start_ms))
    shorter_ms = min(clip_a.duration_ms, clip_b.duration_ms)
    if shorter_ms <= 0:
        return 0.0
    return overlap_ms / shorter_ms


def find_duplicate_candidates(
    video_id: int, session, threshold: float = DEFAULT_OVERLAP_THRESHOLD
) -> list[tuple[ClipCandidate, ClipCandidate, float]]:
    """Return (clip_a, clip_b, overlap_ratio) for every live candidate pair on
    *video_id* whose windows overlap by at least *threshold* of the shorter
    clip's duration. clip_a is always the earlier-starting clip (ties broken by
    id) so the ordering is deterministic. Rejected clips are excluded - no point
    flagging a pair where one side is already dead.
    """
    clips = (
        session.query(ClipCandidate)
        .filter(ClipCandidate.video_id == video_id, ClipCandidate.status != "rejected")
        .order_by(ClipCandidate.start_ms, ClipCandidate.id)
        .all()
    )
    duplicates: list[tuple[ClipCandidate, ClipCandidate, float]] = []
    for index, clip_a in enumerate(clips):
        for clip_b in clips[index + 1:]:
            # Sorted by start_ms: once a later clip starts at or after clip_a's
            # end it cannot overlap clip_a, and neither can any clip after it.
            if clip_b.start_ms >= clip_a.end_ms:
                break
            if clip_b.id in clip_a.dismissed_duplicate_ids or clip_a.id in clip_b.dismissed_duplicate_ids:
                continue
            ratio = _overlap_ratio(clip_a, clip_b)
            if ratio >= threshold:
                duplicates.append((clip_a, clip_b, ratio))
    return duplicates


def _set_duplicate_tag(clip: ClipCandidate, flagged: bool) -> bool:
    """Add or remove DUPLICATE_TAG on *clip*. Returns True if the tag changed."""
    tags = clip.tags
    has_tag = DUPLICATE_TAG in tags
    if flagged and not has_tag:
        clip.tags = tags + [DUPLICATE_TAG]
        return True
    if not flagged and has_tag:
        clip.tags = [tag for tag in tags if tag != DUPLICATE_TAG]
        return True
    return False


def scan_and_tag_duplicates(video_id: int, session) -> dict:
    """Find near-duplicate pairs on *video_id* and persist DUPLICATE_TAG on the
    flagged clips - idempotent, also clearing the tag from clips no longer
    flagged (e.g. after one side of a pair is merged or rejected). Caller
    commits. Shared by the explicit "Check duplicates" scan route and by
    manual-clip creation, so a clip that overlaps an existing one gets flagged
    immediately instead of only on the next manual scan.
    """
    pairs = find_duplicate_candidates(video_id, session)
    flagged_ids = {clip.id for pair in pairs for clip in pair[:2]}
    clips = session.query(ClipCandidate).filter_by(video_id=video_id).all()
    changed = sum(_set_duplicate_tag(clip, clip.id in flagged_ids) for clip in clips)
    return {
        "clips_checked": len(clips),
        "clips_flagged": len(flagged_ids),
        "changed": changed,
        "pairs": [
            {"clip_a_id": clip_a.id, "clip_b_id": clip_b.id, "overlap_ratio": round(ratio, 3)}
            for clip_a, clip_b, ratio in pairs
        ],
    }
