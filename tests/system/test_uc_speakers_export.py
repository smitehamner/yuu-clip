"""UC-D02 Diarize, name speakers, export with captions - a named speaker's name
flows into a clip's exported captions, and renaming the speaker re-propagates.

Diarization itself (the voice model) is golden-only; here the speaker is created
and attached to transcript lines directly, then the name is carried into the SRT.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import export_clip_file, only_export_file, open_session


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


def test_speaker_name_flows_into_captions_and_survives_rename(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{video_id}/clips").json()[0]["id"]

    speaker = client.post(f"/api/videos/{video_id}/speakers", json={"name": "Yuu"}).json()
    speaker_id = speaker["id"]

    seg_id = _first_segment_in_clip(analyzed_project, clip_id)
    resp = client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": speaker_id})
    assert resp.status_code == 200

    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    assert "[Yuu]" in only_export_file(exports_dir, suffix=".srt").read_text(encoding="utf-8")

    # Rename the speaker; the new name must reach a fresh export's captions.
    resp = client.put(f"/api/speakers/{speaker_id}", json={"name": "Renamed"})
    assert resp.status_code == 200

    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    refreshed = only_export_file(exports_dir, suffix=".srt").read_text(encoding="utf-8")
    assert "[Renamed]" in refreshed
    assert "[Yuu]" not in refreshed
