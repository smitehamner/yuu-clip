"""UC-D01 Retranscribe, captions refresh - a recording-level re-transcribe (stubbed
model) rebuilds the transcript, refreshes clip excerpts, and flags clips for
re-score; a later export refreshes the SRT sidecar with the new text.
"""
from __future__ import annotations

from pathlib import Path

from tests.system._stubs import use_transcript
from tests.system.conftest import export_clip_file, only_export_file, open_session

# A distinct transcript the stubbed re-transcribe returns, so we can see the
# excerpt/sidecar actually change (not just re-run identically).
_NEW_TRANSCRIPT = [
    (0, 3000, "Retranscribed opening line with a corrected phrase."),
    (3200, 6000, "The second retranscribed line continues the block."),
    (6200, 9000, "More retranscribed speech to keep the window long."),
    (9200, 12000, "Still in the retranscribed opening block here."),
    (12200, 15500, "That finishes the retranscribed first clip block."),
]


def test_recording_retranscribe_refreshes_excerpt_and_sidecar(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clips = client.get(f"/api/videos/{video_id}/clips").json()
    # Target the first-block clip - the new transcript covers the opening window.
    clip_id = min(clips, key=lambda c: c["start_ms"])["id"]

    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    assert "Retranscribed opening line" not in only_export_file(exports_dir, suffix=".srt").read_text(
        encoding="utf-8"
    )

    # Drive the real recording-level retranscribe pipeline (stubbed model output).
    use_transcript(_NEW_TRANSCRIPT)
    from yuu_clip.config import Config, project_audio_dir
    from yuu_clip.db.models import Video
    from yuu_clip.pipeline import retranscribe_video

    config = Config.load(analyzed_project)
    session = open_session(analyzed_project)
    try:
        video = session.get(Video, video_id)
        retranscribe_video(session, config, video, project_audio_dir(analyzed_project), None)
    finally:
        session.close()

    # Existing clips are kept but flagged as needing a re-score.
    full = client.get(f"/api/clips/{clip_id}").json()
    assert full["transcript_stale"] is True

    # Re-export refreshes the SRT sidecar with the new transcript text.
    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    refreshed = only_export_file(exports_dir, suffix=".srt").read_text(encoding="utf-8")
    assert "Retranscribed opening line" in refreshed
