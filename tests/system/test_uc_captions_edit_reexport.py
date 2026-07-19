"""UC-C03 Edit captions, then re-export - editing a caption line rebuilds the
overlapping clip's excerpt, flags it for re-score, and re-export refreshes the
SRT sidecar with the corrected text.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import export_clip_file, only_export_file, open_session

CORRECTED_TEXT = "This caption line was corrected by the system test."


def _first_segment_in_clip(project_dir: Path, clip_id: int) -> int:
    from yuu_clip.db.models import ClipCandidate, TranscriptSegment
    session = open_session(project_dir)
    try:
        clip = session.get(ClipCandidate, clip_id)
        seg = (
            session.query(TranscriptSegment)
            .filter(
                TranscriptSegment.start_ms >= clip.start_ms,
                TranscriptSegment.start_ms < clip.end_ms,
            )
            .order_by(TranscriptSegment.start_ms)
            .first()
        )
        return seg.id
    finally:
        session.close()


def test_caption_edit_rebuilds_excerpt_and_refreshes_sidecar(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{video_id}/clips").json()[0]["id"]

    # Export once so there is a sidecar to refresh.
    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    original_srt = only_export_file(exports_dir, suffix=".srt").read_text(encoding="utf-8")
    assert CORRECTED_TEXT not in original_srt

    seg_id = _first_segment_in_clip(analyzed_project, clip_id)
    resp = client.put(f"/api/caption-segments/{seg_id}", json={"text": CORRECTED_TEXT})
    assert resp.status_code == 200
    body = resp.json()
    assert body["text"] == CORRECTED_TEXT
    assert clip_id in body["affected_clip_ids"]  # overlapping clip marked

    # The excerpt was rebuilt from the corrected transcript, and the clip is now
    # flagged as edited-since-scoring.
    full = client.get(f"/api/clips/{clip_id}").json()
    assert CORRECTED_TEXT in full["transcript_excerpt"]
    assert full["transcript_stale"] is True

    # Re-export refreshes the SRT sidecar with the corrected text.
    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    refreshed_srt = only_export_file(exports_dir, suffix=".srt").read_text(encoding="utf-8")
    assert CORRECTED_TEXT in refreshed_srt
