"""
API tests for manual clip creation (POST /api/videos/{video_id}/clips).

Covers the happy path (excerpt built from overlapping transcript segments,
"manual" tag, pending status), validation errors, the no-transcript fallback,
segment-relative bounds on a split segment, and that the existing per-clip
rescore endpoint accepts a freshly-created clip (scored_at is NULL).
"""
from __future__ import annotations

from datetime import datetime, timezone

from yuu_clip.db.models import (
    AudioTrack,
    Transcript,
    TranscriptSegment,
    Video,
    make_session,
)


def _add_transcript(project_dir, video_id: int, segments: list[tuple[int, int, str]]) -> None:
    session = make_session(project_dir / ".yuu-clip" / "project.db")
    track = AudioTrack(video_id=video_id, stream_index=2, label="combined", do_transcribe=True, do_score=True)
    session.add(track)
    session.flush()
    transcript = Transcript(audio_track_id=track.id, model_name="test")
    session.add(transcript)
    session.flush()
    for start_ms, end_ms, text in segments:
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=start_ms, end_ms=end_ms, text=text))
    session.commit()
    session.close()


class TestCreateManualClipHappyPath:
    def test_creates_pending_clip_with_manual_tag(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 10_000, "end_ms": 20_000})
        assert r.status_code == 200
        clip = r.json()
        assert clip["start_ms"] == 10_000
        assert clip["end_ms"] == 20_000
        assert clip["status"] == "pending"
        assert clip["tags"] == ["manual"]

    def test_excerpt_built_from_overlapping_segments_only(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        _add_transcript(project_dir, vid_id, [
            (0, 5_000, "before the window"),
            (10_000, 15_000, "inside the window"),
            (30_000, 35_000, "after the window"),
        ])
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 8_000, "end_ms": 20_000})
        assert r.status_code == 200
        excerpt = r.json()["transcript_excerpt"]
        assert "inside the window" in excerpt
        assert "before the window" not in excerpt
        assert "after the window" not in excerpt


class TestCreateManualClipValidation:
    def test_404_unknown_video(self, client):
        r = client.post("/api/videos/99999/clips", json={"start_ms": 0, "end_ms": 5_000})
        assert r.status_code == 404

    def test_400_start_after_end(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 10_000, "end_ms": 5_000})
        assert r.status_code == 400

    def test_400_start_equals_end(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 5_000, "end_ms": 5_000})
        assert r.status_code == 400

    def test_400_negative_start(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": -1, "end_ms": 5_000})
        assert r.status_code == 400

    def test_400_end_beyond_recording_duration(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        # seeded video duration is 600_000 ms
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 590_000, "end_ms": 700_000})
        assert r.status_code == 400

    def test_400_shorter_than_one_second(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 0, "end_ms": 500})
        assert r.status_code == 400

    def test_400_longer_than_ten_minutes(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 0, "end_ms": 601_000})
        assert r.status_code == 400


class TestCreateManualClipNoTranscript:
    def test_no_transcript_creates_clip_with_empty_excerpt(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 10_000, "end_ms": 20_000})
        assert r.status_code == 200
        assert r.json()["transcript_excerpt"] == ""


class TestCreateManualClipOnSegment:
    def test_bounds_validated_against_segment_relative_duration(self, client, project_dir):
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        parent = session.query(Video).first()
        segment = Video(
            path=str(project_dir / "segment.mkv"),
            filename="segment.mkv",
            status="done",
            duration_ms=60_000,  # segment-relative — much shorter than the parent
            parent_video_id=parent.id,
            segment_start_s=100.0,
            segment_end_s=160.0,
        )
        session.add(segment)
        session.commit()
        seg_id = segment.id
        session.close()

        ok = client.post(f"/api/videos/{seg_id}/clips", json={"start_ms": 0, "end_ms": 30_000})
        assert ok.status_code == 200

        too_long = client.post(f"/api/videos/{seg_id}/clips", json={"start_ms": 0, "end_ms": 70_000})
        assert too_long.status_code == 400


class TestRescoreAfterManualCreate:
    def test_rescore_accepts_clip_with_null_scored_at(self, client, project_dir, monkeypatch):
        from yuu_clip.scoring.engine import ScoringEngine

        def _fake_score_clip(self, clip, session):
            clip.scored_at = datetime.now(timezone.utc)

        monkeypatch.setattr(ScoringEngine, "score_clip", _fake_score_clip)

        vid_id = client.get("/api/videos").json()[0]["id"]
        created = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 10_000, "end_ms": 20_000}).json()
        assert created["scored_at"] is None

        body = client.get(f"/api/clips/{created['id']}/rescore").text
        assert "Scored 1/1 clips" in body
        assert "__DONE__" in body

        rescored = client.get(f"/api/clips/{created['id']}").json()
        assert rescored["scored_at"] is not None
