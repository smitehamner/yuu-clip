"""
API unit tests — run against an in-process TestClient (no live server needed).

Run:  pytest tests/test_api.py -v
"""
from __future__ import annotations

import json

import pytest


# ---------------------------------------------------------------------------
# Videos
# ---------------------------------------------------------------------------

class TestVideos:
    def test_list_videos_returns_seeded_video(self, client):
        r = client.get("/api/videos")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["filename"] == "session.mkv"
        assert data[0]["clip_count"] == 3
        assert data[0]["approved"] == 1

    def test_list_clips_for_video(self, client):
        # Get video id from first video
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/clips")
        assert r.status_code == 200
        clips = r.json()
        assert len(clips) == 3
        # Should be sorted by score descending
        scores = [c["score_overall"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_filter_by_status(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/clips?status=approved")
        assert r.status_code == 200
        clips = r.json()
        assert len(clips) == 1
        assert clips[0]["status"] == "approved"


# ---------------------------------------------------------------------------
# Clips
# ---------------------------------------------------------------------------

class TestClips:
    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_get_clip_detail(self, client):
        clip_id = self._first_clip_id(client)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        d = r.json()
        assert "score_overall" in d
        assert "description" in d
        assert "transcript_excerpt" in d

    def test_get_clip_404(self, client):
        r = client.get("/api/clips/99999")
        assert r.status_code == 404

    def test_set_clip_status_approve(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        # Verify persisted
        r2 = client.get(f"/api/clips/{clip_id}")
        assert r2.json()["status"] == "approved"

    def test_set_clip_status_invalid(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "maybe"})
        assert r.status_code == 400

    def test_clip_media_url_no_export(self, client):
        clip_id = self._first_clip_id(client)
        r = client.get(f"/api/clips/{clip_id}/media_url")
        assert r.status_code == 200
        assert r.json()["url"] is None  # not exported yet


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

class TestProfiles:
    def test_list_profiles_includes_default(self, client):
        r = client.get("/api/profiles")
        assert r.status_code == 200
        profiles = r.json()
        names = [p["name"] for p in profiles]
        assert "__default__" in names
        default = next(p for p in profiles if p["name"] == "__default__")
        assert default["builtin"] is True

    def test_create_and_delete_profile(self, client):
        body = {
            "name": "test_profile",
            "assignments": [
                {"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True},
                {"stream_position": 1, "label": "player_voice", "do_transcribe": True, "do_score": True},
            ],
        }
        r = client.post("/api/profiles", json=body)
        assert r.status_code == 200
        assert r.json()["name"] == "test_profile"

        # Should appear in list
        profiles = client.get("/api/profiles").json()
        assert any(p["name"] == "test_profile" for p in profiles)

        # Delete it
        r2 = client.delete("/api/profiles/test_profile")
        assert r2.status_code == 200

        # Gone
        profiles2 = client.get("/api/profiles").json()
        assert not any(p["name"] == "test_profile" for p in profiles2)

    def test_cannot_delete_builtin(self, client):
        r = client.delete("/api/profiles/__default__")
        assert r.status_code == 400

    def test_cannot_create_dunder_profile(self, client):
        r = client.post("/api/profiles", json={
            "name": "__evil__",
            "assignments": [],
        })
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Estimate
# ---------------------------------------------------------------------------

class TestEstimate:
    def test_estimate_returns_steps(self, client):
        r = client.post("/api/estimate", json={
            "duration_s": 3600,
            "model": "medium",
            "audio_tracks": 2,
            "has_gpu": True,
            "scene_mode": "fast",
        })
        assert r.status_code == 200
        d = r.json()
        assert "steps" in d
        assert "total_hms" in d
        assert len(d["steps"]) == 5
        # All steps should have name, seconds, hms, note
        for step in d["steps"]:
            assert "name" in step
            assert "seconds" in step
            assert "hms" in step

    def test_estimate_gpu_faster_than_cpu(self, client):
        payload = dict(duration_s=3600, model="large-v3", audio_tracks=1, scene_mode="fast")
        gpu = client.post("/api/estimate", json={**payload, "has_gpu": True}).json()
        cpu = client.post("/api/estimate", json={**payload, "has_gpu": False}).json()
        assert gpu["total_seconds"] < cpu["total_seconds"]


# ---------------------------------------------------------------------------
# Probe (file not found case — no real video needed)
# ---------------------------------------------------------------------------

class TestProbe:
    def test_probe_missing_file_returns_400(self, client):
        r = client.post("/api/probe", json={"path": "/nonexistent/file.mkv"})
        assert r.status_code == 400
