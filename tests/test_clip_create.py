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
            duration_ms=60_000,  # segment-relative - much shorter than the parent
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


class TestClipFramingPatch:
    """PATCH /api/clips/{id}/framing sets the vertical (9:16) crop position,
    clamps it to 0..1, and stamps trim_edited_at so any existing vertical export
    is flagged stale (crop_x moves pixels the same way a trim does)."""

    def _new_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 10_000, "end_ms": 20_000}).json()["id"]

    def test_default_crop_x_is_null(self, client):
        clip_id = self._new_clip_id(client)
        assert client.get(f"/api/clips/{clip_id}").json()["crop_x"] is None

    def test_sets_crop_x(self, client):
        clip_id = self._new_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": 0.25})
        assert r.status_code == 200
        assert r.json()["crop_x"] == 0.25
        assert client.get(f"/api/clips/{clip_id}").json()["crop_x"] == 0.25

    def test_clamps_above_one(self, client):
        clip_id = self._new_clip_id(client)
        assert client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": 1.7}).json()["crop_x"] == 1.0

    def test_clamps_below_zero(self, client):
        clip_id = self._new_clip_id(client)
        assert client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": -0.4}).json()["crop_x"] == 0.0

    def test_null_resets_to_center(self, client):
        clip_id = self._new_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": 0.8})
        assert client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": None}).json()["crop_x"] is None

    def test_stamps_trim_edited_at(self, client, project_dir):
        from yuu_clip.db.models import ClipCandidate, make_session
        clip_id = self._new_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": 0.5})
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            assert session.get(ClipCandidate, clip_id).trim_edited_at is not None
        finally:
            session.close()


class TestSuggestFraming:
    """POST /api/clips/{id}/suggest-framing returns a MediaPipe-suggested crop_x,
    or 503 when the optional package is absent. The detector itself is mocked -
    the tests exercise the gate, the response shape, and the null-face path."""

    def _new_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 10_000, "end_ms": 20_000}).json()["id"]

    def _force_mediapipe(self, monkeypatch, present: bool):
        import importlib.util as _util
        real = _util.find_spec

        def _fake(name, *args, **kwargs):
            if name == "mediapipe":
                return object() if present else None
            return real(name, *args, **kwargs)

        monkeypatch.setattr(_util, "find_spec", _fake)

    def test_503_when_mediapipe_missing(self, client, monkeypatch):
        self._force_mediapipe(monkeypatch, present=False)
        clip_id = self._new_clip_id(client)
        res = client.post(f"/api/clips/{clip_id}/suggest-framing")
        assert res.status_code == 503
        assert "MediaPipe" in res.json()["detail"]

    def test_returns_suggested_crop_x(self, client, project_dir, monkeypatch):
        import yuu_clip.analyze.framing as framing_mod
        self._force_mediapipe(monkeypatch, present=True)
        (project_dir / "session.mkv").write_bytes(b"")  # route guards on src.exists()
        monkeypatch.setattr(framing_mod, "suggest_crop_x", lambda *a, **k: 0.72)
        clip_id = self._new_clip_id(client)
        res = client.post(f"/api/clips/{clip_id}/suggest-framing")
        assert res.status_code == 200
        assert res.json() == {"crop_x": 0.72}

    def test_null_crop_x_when_no_face(self, client, project_dir, monkeypatch):
        import yuu_clip.analyze.framing as framing_mod
        self._force_mediapipe(monkeypatch, present=True)
        (project_dir / "session.mkv").write_bytes(b"")
        monkeypatch.setattr(framing_mod, "suggest_crop_x", lambda *a, **k: None)
        clip_id = self._new_clip_id(client)
        res = client.post(f"/api/clips/{clip_id}/suggest-framing")
        assert res.status_code == 200
        assert res.json() == {"crop_x": None}
