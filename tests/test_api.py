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
# Clips — sort and has_export
# ---------------------------------------------------------------------------

class TestClipsExtended:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_list_clips_sort_timeline(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/clips?sort=timeline")
        assert r.status_code == 200
        clips = r.json()
        start_ms_list = [c["start_ms"] for c in clips]
        assert start_ms_list == sorted(start_ms_list)

    def test_list_clips_sort_score_is_default(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        scores = [c["score_overall"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_has_export_field(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        for c in clips:
            assert "has_export" in c
            assert c["has_export"] is False  # no export files in temp dir

    def test_has_export_true_when_file_exists(self, client, project_dir):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".rp-clipper" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake video content")
        # Re-fetch — file now exists on disk
        clips2 = client.get(f"/api/videos/{vid_id}/clips").json()
        match = next(x for x in clips2 if x["id"] == c["id"])
        assert match["has_export"] is True

    def test_clip_detail_has_has_export(self, client):
        vid_id = self._vid_id(client)
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert "has_export" in r.json()


# ---------------------------------------------------------------------------
# Estimate
# ---------------------------------------------------------------------------

class TestEstimate:
    _BASE = dict(duration_s=3600, model="medium", audio_tracks=2, has_gpu=True, scene_mode="fast")

    def test_estimate_returns_steps(self, client):
        r = client.post("/api/estimate", json=self._BASE)
        assert r.status_code == 200
        d = r.json()
        assert "steps" in d
        assert "total_hms" in d
        assert len(d["steps"]) == 5
        for step in d["steps"]:
            assert "name" in step
            assert "seconds" in step
            assert "hms" in step

    def test_estimate_gpu_faster_than_cpu(self, client):
        payload = dict(duration_s=3600, model="large-v3", audio_tracks=1, scene_mode="fast")
        gpu = client.post("/api/estimate", json={**payload, "has_gpu": True}).json()
        cpu = client.post("/api/estimate", json={**payload, "has_gpu": False}).json()
        assert gpu["total_seconds"] < cpu["total_seconds"]

    def test_estimate_returns_pct_of_video(self, client):
        d = client.post("/api/estimate", json=self._BASE).json()
        assert "pct_of_video" in d
        assert isinstance(d["pct_of_video"], (int, float))
        assert 0 < d["pct_of_video"] < 200

    def test_estimate_pct_matches_total(self, client):
        d = client.post("/api/estimate", json=self._BASE).json()
        expected = round(d["total_seconds"] / self._BASE["duration_s"] * 100, 1)
        assert abs(d["pct_of_video"] - expected) < 0.5

    def test_estimate_energy_none_cheapest(self, client):
        none_s = client.post("/api/estimate", json={**self._BASE, "energy_mode": "none"}).json()["total_seconds"]
        fast_s = client.post("/api/estimate", json={**self._BASE, "energy_mode": "fast"}).json()["total_seconds"]
        full_s = client.post("/api/estimate", json={**self._BASE, "energy_mode": "full"}).json()["total_seconds"]
        assert none_s < fast_s < full_s

    def test_estimate_energy_step_name_reflects_mode(self, client):
        for mode in ("none", "fast", "full"):
            d = client.post("/api/estimate", json={**self._BASE, "energy_mode": mode}).json()
            energy_step = next(s for s in d["steps"] if "energy" in s["name"].lower())
            assert mode in energy_step["name"]


# ---------------------------------------------------------------------------
# Ingest start
# ---------------------------------------------------------------------------

class TestIngestStart:
    @pytest.fixture()
    def video_path(self, project_dir):
        p = project_dir / "session.mkv"
        p.write_bytes(b"fake")
        return p

    def test_missing_file_returns_400(self, client):
        r = client.post("/api/ingest/start", json={"path": "/nonexistent/video.mkv", "model": "medium"})
        assert r.status_code == 400

    def test_invalid_model_returns_400(self, client, video_path):
        r = client.post("/api/ingest/start", json={"path": str(video_path), "model": "gpt-vision"})
        assert r.status_code == 400

    def test_valid_request_with_energy_mode(self, client, video_path):
        r = client.post("/api/ingest/start", json={
            "path": str(video_path),
            "model": "medium",
            "energy_mode": "none",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "started"

    def test_all_energy_modes_accepted(self, client, video_path):
        for mode in ("none", "fast", "full"):
            r = client.post("/api/ingest/start", json={
                "path": str(video_path),
                "model": "medium",
                "energy_mode": mode,
            })
            assert r.status_code == 200, f"energy_mode={mode!r} was rejected"


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

class TestLogs:
    def test_log_export_filename_contains_date(self, client):
        from datetime import datetime
        r = client.get("/api/logs/export")
        assert r.status_code == 200
        today = datetime.now().strftime("%Y-%m-%d")
        disposition = r.headers.get("content-disposition", "")
        assert today in disposition
        assert "rp-clipper-" in disposition
        assert ".log" in disposition

    def test_log_export_returns_text(self, client):
        r = client.get("/api/logs/export")
        assert r.status_code == 200
        assert "text" in r.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Probe (file not found case — no real video needed)
# ---------------------------------------------------------------------------

class TestProbe:
    def test_probe_missing_file_returns_400(self, client):
        r = client.post("/api/probe", json={"path": "/nonexistent/file.mkv"})
        assert r.status_code == 400
