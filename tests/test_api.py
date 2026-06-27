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

        profiles = client.get("/api/profiles").json()
        assert any(p["name"] == "test_profile" for p in profiles)

        r2 = client.delete("/api/profiles/test_profile")
        assert r2.status_code == 200

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
        export_dir = project_dir / ".yuu-clip" / "exports"
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
        assert len(d["steps"]) >= 1
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
        r = client.post("/api/analyze/start", json={"path": "/nonexistent/video.mkv", "model": "medium"})
        assert r.status_code == 400

    def test_invalid_model_returns_400(self, client, video_path):
        r = client.post("/api/analyze/start", json={"path": str(video_path), "model": "gpt-vision"})
        assert r.status_code == 400

    def test_valid_request_with_energy_mode(self, client, video_path):
        r = client.post("/api/analyze/start", json={
            "path": str(video_path),
            "model": "medium",
            "energy_mode": "none",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "started"

    def test_all_energy_modes_accepted(self, client, video_path):
        for mode in ("none", "fast", "full"):
            r = client.post("/api/analyze/start", json={
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
        import re
        r = client.get("/api/logs/export")
        assert r.status_code == 200
        disposition = r.headers.get("content-disposition", "")
        assert "yuu-clip-" in disposition
        assert ".log" in disposition
        # Filename must contain an ISO date (YYYY-MM-DD) — exact value is not asserted
        # to avoid a midnight-boundary race where test and server disagree on the date.
        assert re.search(r"\d{4}-\d{2}-\d{2}", disposition)

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


# ---------------------------------------------------------------------------
# DB session cleanup — proves no connection lingers after route handlers
# ---------------------------------------------------------------------------

class TestDbSessionCleanup:
    def test_db_writable_after_list_videos(self, client, project_dir):
        """After GET /api/videos the DB must accept writes (no held lock)."""
        client.get("/api/videos")
        client.get("/api/videos")

        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = Video(
                path=str(project_dir / "new_video.mkv"),
                filename="new_video.mkv",
                status="pending",
                duration_ms=30_000,
            )
            session.add(v)
            session.commit()  # raises OperationalError if lock is still held
        finally:
            session.close()

        videos = client.get("/api/videos").json()
        assert any(v["filename"] == "new_video.mkv" for v in videos)

    def test_db_writable_after_clip_status_update(self, client, project_dir):
        """After POST /api/clips/{id}/status the DB must accept writes."""
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        client.post(f"/api/clips/{clip_id}/status", json={"status": "approved"})

        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = Video(
                path=str(project_dir / "another_video.mkv"),
                filename="another_video.mkv",
                status="pending",
                duration_ms=30_000,
            )
            session.add(v)
            session.commit()
        finally:
            session.close()

        videos = client.get("/api/videos").json()
        assert any(v["filename"] == "another_video.mkv" for v in videos)

    def test_many_concurrent_reads_leave_no_lock(self, client, project_dir):
        """Repeated reads from multiple endpoints must not accumulate held locks."""
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        for clip in clips:
            client.get(f"/api/clips/{clip['id']}")
            client.get(f"/api/clips/{clip['id']}/media_url")

        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = Video(
                path=str(project_dir / "third_video.mkv"),
                filename="third_video.mkv",
                status="pending",
                duration_ms=30_000,
            )
            session.add(v)
            session.commit()
        finally:
            session.close()

        videos = client.get("/api/videos").json()
        assert any(v["filename"] == "third_video.mkv" for v in videos)


# ---------------------------------------------------------------------------
# Graceful shutdown — lifespan terminates running analyze subprocess
# ---------------------------------------------------------------------------

class TestGracefulShutdown:
    def test_shutdown_terminates_running_analyze(self, project_dir):
        """When the server exits, a running analyze_proc must be terminated."""
        from unittest.mock import AsyncMock, MagicMock
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = None          # still running
        mock_proc.pid = 99999
        mock_proc.wait = AsyncMock(return_value=0)

        with TestClient(app) as tc:
            app.state.ctx.analyze_proc = mock_proc

        mock_proc.terminate.assert_called_once()

    def test_shutdown_noop_when_no_analyze_running(self, project_dir):
        """Server shutdown must not raise when there is no active subprocess."""
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        with TestClient(app):
            pass  # just verify it exits cleanly

    def test_shutdown_noop_when_analyze_already_finished(self, project_dir):
        """Server shutdown must not call terminate on a process that already exited."""
        from unittest.mock import MagicMock
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app

        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = 0  # already exited

        with TestClient(app) as tc:
            app.state.ctx.analyze_proc = mock_proc

        mock_proc.terminate.assert_not_called()


# ---------------------------------------------------------------------------
# Single video detail
# ---------------------------------------------------------------------------

class TestVideoDetail:
    def test_get_video_returns_detail(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == vid_id
        assert d["filename"] == "session.mkv"
        assert "timeline" in d

    def test_get_video_404(self, client):
        r = client.get("/api/videos/99999")
        assert r.status_code == 404

    def test_patch_video_contexts(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.patch(f"/api/videos/{vid_id}/contexts", json={"context_names": ["ctx-a", "ctx-b"]})
        assert r.status_code == 200
        assert r.json()["context_names"] == ["ctx-a", "ctx-b"]
        d = client.get(f"/api/videos/{vid_id}").json()
        assert d["context_names"] == ["ctx-a", "ctx-b"]

    def test_patch_video_contexts_404(self, client):
        r = client.patch("/api/videos/99999/contexts", json={"context_names": []})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Delete video and clips
# ---------------------------------------------------------------------------

class TestDelete:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_delete_clip_removes_record(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        r = client.delete(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] == clip_id
        remaining = client.get(f"/api/videos/{vid_id}/clips").json()
        assert not any(c["id"] == clip_id for c in remaining)

    def test_delete_clip_404(self, client):
        r = client.delete("/api/clips/99999")
        assert r.status_code == 404

    def test_delete_video_removes_video_and_clips(self, client):
        vid_id = self._vid_id(client)
        r = client.delete(f"/api/videos/{vid_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] == vid_id
        videos = client.get("/api/videos").json()
        assert not any(v["id"] == vid_id for v in videos)

    def test_delete_video_404(self, client):
        r = client.delete("/api/videos/99999")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Context CRUD
# ---------------------------------------------------------------------------

class TestContexts:
    def test_list_contexts_seeds_builtins(self, client):
        r = client.get("/api/contexts")
        assert r.status_code == 200
        contexts = r.json()
        context_ids = {c["context_id"] for c in contexts}
        expected = {"fantasy-rp", "multiplayer-shooter", "variety-stream", "horror-game", "speedrun", "sandbox-survival", "challenge-run"}
        assert expected <= context_ids
        assert all(c["builtin"] is True for c in contexts if c["context_id"] in expected)

    def test_create_and_list_context(self, client):
        body = {
            "context_id": "test-ctx",
            "display_name": "Test Context",
            "setting": "A fantasy world",
            "your_characters": "Hero",
            "other_characters": "Villain",
            "notes": "Fun campaign",
        }
        r = client.post("/api/contexts", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["context_id"] == "test-ctx"
        assert d["display_name"] == "Test Context"
        assert d["setting"] == "A fantasy world"

        contexts = client.get("/api/contexts").json()
        assert any(c["context_id"] == "test-ctx" for c in contexts)

    def test_upsert_updates_existing(self, client):
        body = {"context_id": "upd-ctx", "display_name": "Old Name", "setting": "old"}
        client.post("/api/contexts", json=body)
        r = client.post("/api/contexts", json={**body, "display_name": "New Name", "setting": "new"})
        assert r.status_code == 200
        assert r.json()["display_name"] == "New Name"

    def test_delete_context(self, client):
        client.post("/api/contexts", json={"context_id": "del-ctx", "display_name": "To Delete"})
        r = client.delete("/api/contexts/del-ctx")
        assert r.status_code == 200
        contexts = client.get("/api/contexts").json()
        assert not any(c["context_id"] == "del-ctx" for c in contexts)

    def test_delete_context_404(self, client):
        r = client.delete("/api/contexts/nonexistent")
        assert r.status_code == 404

    def test_create_context_invalid_id(self, client):
        r = client.post("/api/contexts", json={"context_id": "bad slug!", "display_name": "X"})
        assert r.status_code == 400

    def test_create_context_empty_id(self, client):
        r = client.post("/api/contexts", json={"context_id": "", "display_name": "X"})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Captions VTT endpoint
# ---------------------------------------------------------------------------

class TestCaptionsVTT:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_captions_vtt_404_without_srt(self, client):
        clip = self._first_clip(client)
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 404

    def test_captions_vtt_returns_vtt_format(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        srt_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.srt"
        srt_file.write_text(
            "1\n00:00:01,000 --> 00:00:03,500\nHello world\n\n",
            encoding="utf-8",
        )
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 200
        assert "text/vtt" in r.headers["content-type"]
        assert r.text.startswith("WEBVTT")
        assert "00:00:01.000 --> 00:00:03.500" in r.text


# ---------------------------------------------------------------------------
# Analyze cancel — no-op when nothing running
# ---------------------------------------------------------------------------

class TestAnalyzeCancel:
    def test_cancel_when_nothing_running_returns_ok(self, client):
        r = client.post("/api/analyze/cancel")
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_analyze_status_false_when_idle(self, client):
        r = client.get("/api/analyze/status")
        assert r.status_code == 200
        assert r.json()["running"] is False


# ---------------------------------------------------------------------------
# Summarize — 400 when no transcript
# ---------------------------------------------------------------------------

class TestSummarize:
    def test_summarize_returns_400_without_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/summarize")
        assert r.status_code == 400

    def test_summarize_404_for_missing_video(self, client):
        r = client.post("/api/videos/99999/summarize")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Server status
# ---------------------------------------------------------------------------

class TestStatus:
    def test_status_idle(self, client):
        r = client.get("/api/status")
        assert r.status_code == 200
        d = r.json()
        assert d["any_running"] is False
        assert d["analyze_running"] is False
        assert d["active_jobs"] == 0
        assert "version" in d

    def test_status_reflects_running_analyze(self, project_dir):
        from unittest.mock import AsyncMock, MagicMock
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app
        app = create_app(project_dir)
        mock_proc = MagicMock()
        mock_proc.returncode = None  # still running
        mock_proc.pid = 99999
        mock_proc.wait = AsyncMock(return_value=0)
        with TestClient(app) as tc:
            app.state.ctx.analyze_proc = mock_proc
            r = tc.get("/api/status")
        assert r.json()["analyze_running"] is True
        assert r.json()["any_running"] is True


# ---------------------------------------------------------------------------
# Rescore-clips SSE — 404 guard
# ---------------------------------------------------------------------------

class TestRescoreClipsSSE:
    def test_rescore_clips_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/rescore-clips")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Demo reel start + list
# ---------------------------------------------------------------------------

class TestDemoStart:
    def test_start_rejects_invalid_transition(self, client):
        r = client.post("/api/demo/start", json={"transition": "dissolve_to_mars"})
        assert r.status_code == 400

    def test_start_rejects_when_video_has_no_approved_clips(self, client):
        r = client.post("/api/demo/start", json={"video_id": 99999, "transition": "fade"})
        assert r.status_code == 400

    def test_start_queues_command_and_returns_clip_count(self, client):
        r = client.post("/api/demo/start", json={"transition": "fade"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "started"
        assert d["clip_count"] >= 1
        assert d["output_name"].endswith(".mkv")


class TestDemoList:
    def test_list_reels_empty(self, client):
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        assert r.json() == []

    def test_list_reels_returns_files(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "highlights_20260101.mkv").write_bytes(b"fake reel")
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        reels = r.json()
        assert len(reels) == 1
        assert reels[0]["filename"] == "highlights_20260101.mkv"
        assert "url" in reels[0]
        assert "size_mb" in reels[0]
        assert "date" in reels[0]


# ---------------------------------------------------------------------------
# Pure-function unit tests — no HTTP, no DB
# ---------------------------------------------------------------------------

class TestSafeFilename:
    """_safe_filename strips directory traversal components."""

    def _safe(self, name, default="highlights.mkv"):
        from yuu_clip.web.routes.reel import _safe_filename
        return _safe_filename(name, default)

    def test_plain_name_unchanged(self):
        assert self._safe("myreel.mkv") == "myreel.mkv"

    def test_strips_parent_components(self):
        assert self._safe("../../etc/evil") == "evil"

    def test_strips_windows_path(self):
        # Path("C:/Windows/System32/cmd.exe").name == "cmd.exe" on all platforms
        result = self._safe("C:/Windows/System32/cmd.exe")
        assert "/" not in result
        assert "\\" not in result

    def test_empty_name_returns_default(self):
        assert self._safe("", "highlights.mkv") == "highlights.mkv"

    def test_custom_default_used_when_empty(self):
        assert self._safe("", "fallback.mkv") == "fallback.mkv"

    def test_name_with_spaces_preserved(self):
        result = self._safe("my reel.mkv")
        assert result == "my reel.mkv"


class TestSrtToVtt:
    """_srt_to_vtt converts SRT comma separators to VTT dot separators."""

    def _convert(self, srt):
        from yuu_clip.web.routes.videos import _srt_to_vtt
        return _srt_to_vtt(srt)

    def test_prepends_webvtt_header(self):
        result = self._convert("")
        assert result.startswith("WEBVTT")

    def test_comma_replaced_by_dot_in_timestamp(self):
        srt = "1\n00:00:01,000 --> 00:00:03,500\nHello\n\n"
        result = self._convert(srt)
        assert "00:00:01.000 --> 00:00:03.500" in result
        assert "," not in result.split("WEBVTT")[1].split("Hello")[0]

    def test_text_content_preserved(self):
        srt = "1\n00:00:01,000 --> 00:00:02,000\nSome text\n\n"
        result = self._convert(srt)
        assert "Some text" in result

    def test_multiple_entries(self):
        srt = (
            "1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n"
            "2\n00:00:03,500 --> 00:00:05,000\nSecond\n\n"
        )
        result = self._convert(srt)
        assert "00:00:01.000 --> 00:00:02.000" in result
        assert "00:00:03.500 --> 00:00:05.000" in result
        assert "First" in result
        assert "Second" in result

    def test_empty_srt_produces_webvtt_only(self):
        result = self._convert("")
        assert result == "WEBVTT\n\n"


class TestMsToHms:
    """_ms_to_hms converts milliseconds to h:mm:ss or m:ss."""

    def _convert(self, ms):
        from yuu_clip.web.routes.videos import _ms_to_hms
        return _ms_to_hms(ms)

    def test_seconds_only(self):
        assert self._convert(30_000) == "0:30"

    def test_minutes_and_seconds(self):
        assert self._convert(90_000) == "1:30"

    def test_exactly_one_hour(self):
        assert self._convert(3_600_000) == "1:00:00"

    def test_hours_minutes_seconds(self):
        assert self._convert(3_661_000) == "1:01:01"

    def test_zero_ms(self):
        assert self._convert(0) == "0:00"

    def test_one_minute_boundary(self):
        assert self._convert(60_000) == "1:00"


class TestFormatContextBlock:
    """format_context_block builds the LLM injection text for named contexts."""

    def _fmt(self, contexts, context_ids):
        from yuu_clip.contexts import format_context_block
        return format_context_block(contexts, context_ids)

    def test_empty_context_ids_returns_empty_string(self):
        contexts = {"una": {"display_name": "Una", "setting": "A world"}}
        assert self._fmt(contexts, []) == ""

    def test_unknown_context_id_skipped(self):
        assert self._fmt({}, ["nonexistent"]) == ""

    def test_single_context_contains_header_and_footer(self):
        contexts = {"una": {"display_name": "Una Server", "setting": "A fantasy world"}}
        result = self._fmt(contexts, ["una"])
        assert "== WORLD CONTEXT: Una Server ==" in result
        assert "== END CONTEXT ==" in result

    def test_setting_field_included(self):
        contexts = {"una": {"display_name": "Una", "setting": "Dragons everywhere"}}
        result = self._fmt(contexts, ["una"])
        assert "Dragons everywhere" in result

    def test_empty_field_omitted(self):
        contexts = {
            "una": {
                "display_name": "Una",
                "setting": "A world",
                "your_characters": "",
                "other_characters": "",
                "notes": "",
            }
        }
        result = self._fmt(contexts, ["una"])
        assert "Your characters" not in result

    def test_multiple_contexts_joined(self):
        contexts = {
            "ctx1": {"display_name": "C1", "setting": "Setting one"},
            "ctx2": {"display_name": "C2", "setting": "Setting two"},
        }
        result = self._fmt(contexts, ["ctx1", "ctx2"])
        assert "C1" in result
        assert "C2" in result
        assert "Setting one" in result
        assert "Setting two" in result

    def test_context_id_order_preserved(self):
        contexts = {
            "a": {"display_name": "Alpha", "setting": "First"},
            "b": {"display_name": "Beta", "setting": "Second"},
        }
        result = self._fmt(contexts, ["b", "a"])
        assert result.index("Beta") < result.index("Alpha")


class TestValidateWhisperModel:
    """validate_whisper_model rejects arbitrary model strings."""

    def _validate(self, model):
        from yuu_clip.config import validate_whisper_model
        return validate_whisper_model(model)

    def test_valid_model_returns_unchanged(self):
        assert self._validate("medium") == "medium"

    def test_large_v3_accepted(self):
        assert self._validate("large-v3") == "large-v3"

    def test_arbitrary_string_raises(self):
        with pytest.raises(ValueError, match="Unknown Whisper model"):
            self._validate("gpt-4o-audio")

    def test_huggingface_repo_id_rejected(self):
        with pytest.raises(ValueError):
            self._validate("user/my-custom-model")

    def test_empty_string_rejected(self):
        with pytest.raises(ValueError):
            self._validate("")


class TestValidateWhisperLanguage:
    """validate_whisper_language accepts ISO codes and None/auto, rejects others."""

    def _validate(self, lang):
        from yuu_clip.config import validate_whisper_language
        return validate_whisper_language(lang)

    def test_none_returns_none(self):
        assert self._validate(None) is None

    def test_auto_returns_none(self):
        assert self._validate("auto") is None

    def test_empty_string_returns_none(self):
        assert self._validate("") is None

    def test_valid_code_returned_lowercase(self):
        assert self._validate("EN") == "en"

    def test_valid_code_fr(self):
        assert self._validate("fr") == "fr"

    def test_invalid_code_raises(self):
        with pytest.raises(ValueError, match="Unrecognised language code"):
            self._validate("xx")

    def test_arbitrary_string_rejected(self):
        with pytest.raises(ValueError):
            self._validate("klingon")


class TestPearsonCorrelation:
    """_pearson correlation helper covers edge cases used in overlap detection."""

    def _pearson(self, a, b):
        from yuu_clip.analyze.overlap import _pearson
        return _pearson(a, b)

    def test_identical_sequences_returns_one(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert abs(self._pearson(a, a) - 1.0) < 1e-9

    def test_perfectly_anticorrelated_returns_minus_one(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        b = [5.0, 4.0, 3.0, 2.0, 1.0]
        assert abs(self._pearson(a, b) - (-1.0)) < 1e-9

    def test_short_sequence_returns_zero(self):
        assert self._pearson([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == 0.0

    def test_constant_sequences_returns_one(self):
        # Both all-same: da == 0 and db == 0 → returns 1.0
        a = [0.5, 0.5, 0.5, 0.5, 0.5]
        assert self._pearson(a, a) == 1.0

    def test_one_constant_other_varying_returns_zero(self):
        a = [0.5, 0.5, 0.5, 0.5, 0.5]
        b = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert self._pearson(a, b) == 0.0

    def test_unequal_lengths_uses_shorter(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        b = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = self._pearson(a, b)
        assert abs(result - 1.0) < 1e-9


class TestFormatDuration:
    """_format_duration produces compact human-readable strings."""

    def _fmt(self, seconds):
        from yuu_clip.web.routes.analyze import _format_duration
        return _format_duration(seconds)

    def test_zero_seconds(self):
        assert self._fmt(0) == "0s"

    def test_under_one_minute(self):
        assert self._fmt(45) == "45s"

    def test_exactly_one_minute(self):
        assert self._fmt(60) == "1m 00s"

    def test_minutes_and_seconds(self):
        assert self._fmt(90) == "1m 30s"

    def test_exactly_one_hour(self):
        assert self._fmt(3600) == "1h 00m"

    def test_hours_and_minutes(self):
        assert self._fmt(5400) == "1h 30m"


# ---------------------------------------------------------------------------
# Additional API route gap coverage
# ---------------------------------------------------------------------------

class TestListClipsAdditional:
    """Cover gaps in list_clips: 404 for unknown video, sub-score sorts."""

    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_list_clips_404_for_unknown_video(self, client):
        r = client.get("/api/videos/99999/clips")
        assert r.status_code == 404

    def test_list_clips_sort_funny(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=funny").json()
        scores = [c["score_funny"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_sort_dramatic(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=dramatic").json()
        scores = [c["score_dramatic"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_sort_action(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=action").json()
        scores = [c["score_action"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_unknown_sort_falls_back_to_score(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=bogus").json()
        scores = [c["score_overall"] for c in clips]
        assert scores == sorted(scores, reverse=True)


class TestMediaUrl:
    """Cover the exported-file path through clip_media_url."""

    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_media_url_returns_url_when_file_exists(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake video")
        r = client.get(f"/api/clips/{clip['id']}/media_url")
        assert r.status_code == 200
        d = r.json()
        assert d["url"] is not None
        assert d["url"].endswith(".mkv")
        assert d["has_captions"] is False

    def test_media_url_has_captions_true_when_srt_exists(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        base = f"session_clip{clip['id']}_{start_hms_dashes}"
        (export_dir / f"{base}.mkv").write_bytes(b"fake video")
        (export_dir / f"{base}.srt").write_text(
            "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n", encoding="utf-8"
        )
        r = client.get(f"/api/clips/{clip['id']}/media_url")
        assert r.status_code == 200
        assert r.json()["has_captions"] is True


class TestDeleteSrtCleanup:
    """Deleting a clip or video also removes SRT sidecars."""

    def test_delete_clip_removes_srt_file(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        base = f"session_clip{c['id']}_{start_hms_dashes}"
        srt_file = export_dir / f"{base}.srt"
        srt_file.write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n\n", encoding="utf-8")
        assert srt_file.exists()
        client.delete(f"/api/clips/{c['id']}")
        assert not srt_file.exists()

    def test_delete_video_removes_srt_files(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        srt_files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            base = f"session_clip{c['id']}_{start_hms_dashes}"
            f = export_dir / f"{base}.srt"
            f.write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n\n", encoding="utf-8")
            srt_files.append(f)
        client.delete(f"/api/videos/{vid_id}")
        for f in srt_files:
            assert not f.exists(), f"{f.name} should have been deleted"


class TestMultiExtensionExport:
    """Clips exported as non-.mkv containers are found by media_url, has_export, and delete."""

    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_media_url_finds_mp4_export(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        mp4_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.mp4"
        mp4_file.write_bytes(b"fake mp4 video")
        r = client.get(f"/api/clips/{clip['id']}/media_url")
        assert r.status_code == 200
        d = r.json()
        assert d["url"] is not None
        assert d["url"].endswith(".mp4")

    def test_has_export_true_for_mp4(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        mp4_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mp4"
        mp4_file.write_bytes(b"fake mp4 video")
        clips2 = client.get(f"/api/videos/{vid_id}/clips").json()
        match = next(x for x in clips2 if x["id"] == c["id"])
        assert match["has_export"] is True

    def test_delete_clip_removes_mp4_export(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        mp4_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mp4"
        mp4_file.write_bytes(b"fake mp4 video")
        assert mp4_file.exists()
        client.delete(f"/api/clips/{c['id']}")
        assert not mp4_file.exists()

    def test_delete_video_removes_mp4_exports(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        mp4_files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            f = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mp4"
            f.write_bytes(b"fake mp4 video")
            mp4_files.append(f)
        client.delete(f"/api/videos/{vid_id}")
        for f in mp4_files:
            assert not f.exists(), f"{f.name} should have been deleted"


class TestSseGuards:
    """Cover 400 guards on SSE event endpoints when no job has been queued."""

    def test_analyze_events_without_start_returns_400(self, client):
        r = client.get("/api/analyze/events")
        assert r.status_code == 400

    def test_demo_events_without_start_returns_400(self, client):
        r = client.get("/api/demo/events")
        assert r.status_code == 400


class TestVersionEndpoint:
    def test_version_returns_200(self, client):
        r = client.get("/api/version")
        assert r.status_code == 200
        assert "version" in r.json()


class TestRetranscribeValidation:
    """retranscribe endpoint rejects unknown Whisper models."""

    def test_retranscribe_invalid_model_returns_400(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        r = client.get(f"/api/clips/{clip_id}/retranscribe?model=gpt-4o")
        assert r.status_code == 400


class TestVideoDetailFields:
    """Confirm _video_dict serializes all expected fields."""

    def test_video_detail_includes_duration_and_status_fields(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        d = client.get(f"/api/videos/{vid_id}").json()
        for field in (
            "id", "filename", "status", "duration_hms", "duration_ms",
            "clip_count", "approved", "total_clip_ms",
            "title", "summary", "has_timeline", "context_names",
            "clips_scored_at", "summarized_at", "timeline_generated_at",
        ):
            assert field in d, f"missing field: {field}"

    def test_video_list_includes_total_clip_ms(self, client):
        videos = client.get("/api/videos").json()
        assert len(videos) == 1
        v = videos[0]
        assert "total_clip_ms" in v
        assert v["total_clip_ms"] > 0

    def test_video_list_has_timeline_false_initially(self, client):
        videos = client.get("/api/videos").json()
        assert videos[0]["has_timeline"] is False


class TestSetClipStatusAllValues:
    """Confirm all three valid statuses are accepted."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_status_pending(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "pending"})
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_set_status_rejected(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "rejected"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_set_status_404_for_missing_clip(self, client):
        r = client.post("/api/clips/99999/status", json={"status": "pending"})
        assert r.status_code == 404


class TestTimelineEndpointGuard:
    """stream_timeline returns 400 when no transcript exists."""

    def test_timeline_400_without_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/timeline")
        assert r.status_code == 400

    def test_timeline_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/timeline")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# TestDeleteExportCleanup
# ---------------------------------------------------------------------------

class TestDeleteExportCleanup:
    def test_delete_clip_removes_export_file(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake video")
        assert export_file.exists()
        client.delete(f"/api/clips/{c['id']}")
        assert not export_file.exists()

    def test_delete_video_removes_export_files(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            f = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mkv"
            f.write_bytes(b"fake video")
            files.append(f)
        client.delete(f"/api/videos/{vid_id}")
        for f in files:
            assert not f.exists(), f"{f.name} should have been deleted"


# ---------------------------------------------------------------------------
# Bug-hunt fixes — regression tests
# ---------------------------------------------------------------------------

class TestSseCommandCleared:
    """analyze_cmd and demo_cmd are cleared after the subprocess SSE stream finishes."""

    def test_analyze_cmd_cleared_after_events_stream(self, project_dir):
        """After analyze_events runs to completion, ctx.analyze_cmd must be None."""
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app
        import sys

        app = create_app(project_dir)
        # Queue a trivial command that exits immediately
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "print('done')"]
            # Consume the stream fully so the generator's finally block runs
            with tc.stream("GET", "/api/analyze/events") as resp:
                list(resp.iter_lines())
            assert ctx.analyze_cmd is None

    def test_demo_cmd_cleared_after_events_stream(self, project_dir):
        """After demo_events runs to completion, ctx.demo_cmd must be None."""
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app
        import sys

        app = create_app(project_dir)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.demo_cmd = [sys.executable, "-c", "print('done')"]
            with tc.stream("GET", "/api/demo/events") as resp:
                list(resp.iter_lines())
            assert ctx.demo_cmd is None

    def test_second_call_to_analyze_events_without_new_start_returns_400(self, project_dir):
        """After stream finishes, a second call to /api/analyze/events without a new start
        must return 400, not re-run the old command."""
        from fastapi.testclient import TestClient
        from yuu_clip.web.app import create_app
        import sys

        app = create_app(project_dir)
        with TestClient(app) as tc:
            ctx = app.state.ctx
            ctx.analyze_cmd = [sys.executable, "-c", "print('done')"]
            with tc.stream("GET", "/api/analyze/events") as resp:
                list(resp.iter_lines())
            # Second call — no command queued, must return 400
            r = tc.get("/api/analyze/events")
            assert r.status_code == 400


class TestDemoOutputMkv:
    """Demo output_name always gets .mkv extension."""

    def test_start_demo_adds_mkv_to_bare_name(self, client):
        """If output_name has no extension, the route must append .mkv."""
        r = client.post("/api/demo/start", json={
            "transition": "fade",
            "output_name": "myreel",
        })
        assert r.status_code == 200
        assert r.json()["output_name"].endswith(".mkv")

    def test_start_demo_does_not_double_add_mkv(self, client):
        """If output_name already ends in .mkv, do not append again."""
        r = client.post("/api/demo/start", json={
            "transition": "fade",
            "output_name": "myreel.mkv",
        })
        assert r.status_code == 200
        assert r.json()["output_name"] == "myreel.mkv"


class TestEnergyBoundary:
    """AudioEnergyScorer clips window is [start_s, end_s) — end second is excluded."""

    def test_energy_query_excludes_end_second(self):
        """When the only energy row sits at second_offset == end_s (outside the window),
        scorer.score() must return the energy_no_data tag, not count that row."""
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        config = Config()
        scorer = AudioEnergyScorer(config)

        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "test.db"
            session = make_session(db_path)
            try:
                v = Video(
                    path="/fake/session.mkv",
                    filename="session.mkv",
                    status="done",
                    duration_ms=120_000,
                )
                session.add(v)
                session.flush()

                track = AudioTrack(
                    video_id=v.id,
                    stream_index=0,
                    label="combined",
                    do_transcribe=True,
                    do_score=True,
                    relevance_weight=1.0,
                )
                session.add(track)
                session.flush()

                # Place one very loud row at exactly end_s (second_offset == 120).
                # If the scorer uses <= it would be included and produce a non-zero score;
                # with the correct < boundary it is excluded and score returns energy_no_data.
                session.add(AudioEnergy(
                    audio_track_id=track.id,
                    second_offset=120,  # == end_s, must be excluded
                    rms_db=10.0,        # loud — would boost score if incorrectly included
                ))
                session.commit()

                clip = MagicMock()
                clip.start_ms = 60_000   # start_s = 60
                clip.end_ms   = 120_000  # end_s   = 120

                # Reload track via session so the ORM relationship is live
                db_track = session.query(AudioTrack).filter_by(id=track.id).one()
                clip.video.audio_tracks = [db_track]

                result = scorer.score(clip, session)
            finally:
                session.close()

        assert "energy_no_data" in result.tags, (
            "Boundary row at second_offset == end_s was incorrectly included in the clip window"
        )


# ---------------------------------------------------------------------------
# SceneCutScorer unit tests
# ---------------------------------------------------------------------------

class TestSceneCutScorer:
    """SceneCutScorer.score() covers 0-duration clip, no cuts, and cuts present."""

    def _make_db_with_video_and_clip(self, tmp_path, start_ms, end_ms):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        db_path = tmp_path / "test.db"
        session = make_session(db_path)
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        clip = ClipCandidate(video_id=v.id, start_ms=start_ms, end_ms=end_ms, status="pending")
        session.add(clip)
        session.flush()
        return session, v, clip

    def test_score_zero_duration_returns_empty(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 0)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action == 0.0
        assert result.tags == []

    def test_score_no_scene_boundaries_returns_zero(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action == 0.0
        assert "scenes_scored" not in result.tags
        assert result.notes["cuts_in_clip"] == 0

    def test_score_with_cuts_inside_window(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            # Add 5 scene cuts inside the 1-minute window → 5 cuts/min → score = 0.5
            for ms in [10_000, 20_000, 30_000, 40_000, 50_000]:
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action > 0.0
        assert "scenes_scored" in result.tags
        assert result.notes["cuts_in_clip"] == 5

    def test_score_cut_at_end_ms_excluded(self, tmp_path):
        """A cut at exactly end_ms must not be counted (< end_ms, not <=)."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            session.add(SceneBoundary(video_id=v.id, timecode_ms=60_000))  # at end_ms
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.notes["cuts_in_clip"] == 0

    def test_is_available_true_when_enabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        config.scorer_scenes_enabled = True
        assert SceneCutScorer(config).is_available() is True

    def test_is_available_false_when_disabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        config.scorer_scenes_enabled = False
        assert SceneCutScorer(config).is_available() is False

    def test_score_maxes_at_one(self, tmp_path):
        """score_action must not exceed 1.0 even with very high cut density."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            for ms in range(1000, 60_000, 1000):   # 59 cuts in 1 minute
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action <= 1.0


# ---------------------------------------------------------------------------
# ScoringEngine unit tests
# ---------------------------------------------------------------------------

class TestScoringEngine:
    """ScoringEngine.score_clip() and score_video() orchestration."""

    def _make_scorer(self, score_funny=0.0, score_dramatic=0.0, score_action=0.0,
                     description="", description_long="", tags=None, weight=1.0, available=True):
        from unittest.mock import MagicMock
        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.is_available.return_value = available
        mock.weight = weight
        mock.score.return_value = ScoreResult(
            score_funny=score_funny,
            score_dramatic=score_dramatic,
            score_action=score_action,
            description=description,
            description_long=description_long,
            tags=tags or [],
        )
        return mock

    def _make_clip(self):
        from unittest.mock import MagicMock
        clip = MagicMock()
        clip.tags = []
        clip.score_funny = 0.0
        clip.score_dramatic = 0.0
        clip.score_action = 0.0
        clip.score_overall = 0.0
        clip.description = ""
        clip.description_long = ""
        return clip

    def test_no_scorers_returns_without_update(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        engine = ScoringEngine(config, [])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.score_overall == 0.0

    def test_unavailable_scorer_filtered_out(self):
        from unittest.mock import MagicMock
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        unavailable = self._make_scorer(score_action=1.0, available=False)
        engine = ScoringEngine(config, [unavailable])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.score_overall == 0.0
        unavailable.score.assert_not_called()

    def test_score_clip_writes_dimension_scores(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(score_funny=0.8, score_dramatic=0.4, score_action=0.2)
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.8) < 1e-6
        assert abs(clip.score_dramatic - 0.4) < 1e-6
        assert abs(clip.score_action - 0.2) < 1e-6

    def test_score_clip_computes_overall_from_dim_weights(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        config.score_funny_weight = 2.0
        config.score_dramatic_weight = 1.0
        config.score_action_weight = 1.0
        scorer = self._make_scorer(score_funny=1.0, score_dramatic=0.0, score_action=0.0)
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # overall = (2*1 + 1*0 + 1*0) / 4 = 0.5
        assert abs(clip.score_overall - 0.5) < 1e-6

    def test_score_clip_description_set_by_scorer(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(description="A dramatic moment", description_long="Full text here")
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.description == "A dramatic moment"
        assert clip.description_long == "Full text here"

    def test_score_clip_tags_accumulated(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(tags=["energy_scored"])
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert "energy_scored" in clip.tags

    def test_score_clip_stale_scorer_tags_removed(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(tags=["energy_scored"])
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        clip.tags = ["energy_scored", "llm_error", "user_tag"]
        engine.score_clip(clip, None)
        # Stale scorer tags removed, user_tag preserved, fresh tag re-added
        assert "user_tag" in clip.tags
        assert clip.tags.count("energy_scored") == 1

    def test_score_clip_tags_not_duplicated(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(tags=["energy_scored"])
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        engine.score_clip(clip, None)
        assert clip.tags.count("energy_scored") == 1

    def test_score_clip_weighted_average_of_two_scorers(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        s1 = self._make_scorer(score_action=1.0, weight=2.0)
        s2 = self._make_scorer(score_action=0.0, weight=1.0)
        engine = ScoringEngine(config, [s1, s2])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # Weighted: (1.0*2 + 0.0*1) / (2+1) = 2/3
        assert abs(clip.score_action - (2.0 / 3.0)) < 1e-6


# ---------------------------------------------------------------------------
# AudioEnergyScorer — no-scorable-tracks path
# ---------------------------------------------------------------------------

class TestAudioEnergyScorerNoTracks:
    """AudioEnergyScorer returns energy_no_tracks tag when do_score is False on all tracks."""

    def test_no_scorable_tracks_returns_tag(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock
        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        config = Config()
        scorer = AudioEnergyScorer(config)

        with tempfile.TemporaryDirectory() as tmp:
            session = make_session(Path(tmp) / "test.db")
            try:
                v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=60_000)
                session.add(v)
                session.flush()
                track = AudioTrack(
                    video_id=v.id, stream_index=0, label="game_sounds",
                    do_transcribe=False, do_score=False, relevance_weight=0.1
                )
                session.add(track)
                session.flush()

                clip = MagicMock()
                clip.start_ms = 0
                clip.end_ms = 30_000
                db_track = session.query(AudioTrack).filter_by(id=track.id).one()
                clip.video.audio_tracks = [db_track]

                result = scorer.score(clip, session)
            finally:
                session.close()

        assert "energy_no_tracks" in result.tags

    def test_is_available_false_when_disabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.energy import AudioEnergyScorer
        config = Config()
        config.scorer_energy_enabled = False
        assert AudioEnergyScorer(config).is_available() is False


# ---------------------------------------------------------------------------
# Windower (_silence_window) unit tests
# ---------------------------------------------------------------------------

class TestSilenceWindow:
    """_silence_window boundary conditions and split logic."""

    def _seg(self, start_ms, end_ms, text="x"):
        from unittest.mock import MagicMock
        s = MagicMock()
        s.start_ms = start_ms
        s.end_ms = end_ms
        s.text = text
        return s

    def _window(self, segments, silence_ms=3000, min_ms=5000, hard_ms=180_000):
        from yuu_clip.segments.windower import _silence_window
        return _silence_window(segments, silence_ms, min_ms, hard_ms)

    def test_empty_segments_returns_empty(self):
        assert self._window([]) == []

    def test_single_segment_too_short_dropped(self):
        segs = [self._seg(0, 2000)]  # 2 s < min_ms=5000
        assert self._window(segs) == []

    def test_single_segment_long_enough_kept(self):
        segs = [self._seg(0, 10_000)]  # 10 s > min_ms=5000
        result = self._window(segs)
        assert len(result) == 1
        assert result[0][0] == 0
        assert result[0][1] == 10_000

    def test_silence_gap_creates_two_windows(self):
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(15_000, 25_000, "second"),  # 5 s gap >= silence_ms=3000
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert result[0][1] == 10_000
        assert result[1][0] == 15_000

    def test_small_gap_merges_into_one_window(self):
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(11_000, 21_000, "second"),  # 1 s gap < silence_ms=3000
        ]
        result = self._window(segs)
        assert len(result) == 1
        assert result[0][1] == 21_000

    def test_hard_split_breaks_long_window(self):
        # Two segments forming a 200 s window — exceeds hard_split_ms=180_000
        segs = [
            self._seg(0, 100_000, "long first part"),
            self._seg(101_000, 201_000, "long second part"),
        ]
        result = self._window(segs, hard_ms=180_000)
        # hard_split fires during the second segment, creating two candidates
        assert len(result) == 2
        assert "hard_split" in result[0][3]

    def test_long_silence_tag_added(self):
        """A silence >= 10 s adds 'long_silence_before' tag to the new window."""
        segs = [
            self._seg(0, 10_000, "before"),
            self._seg(25_000, 35_000, "after"),  # 15 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert "long_silence_before" in result[1][3]

    def test_window_texts_collected(self):
        segs = [
            self._seg(0, 5_000, "hello"),
            self._seg(5_500, 10_500, "world"),
        ]
        result = self._window(segs, silence_ms=3000)
        assert len(result) == 1
        texts = result[0][2]
        assert "hello" in texts
        assert "world" in texts


# ---------------------------------------------------------------------------
# Estimate edge cases
# ---------------------------------------------------------------------------

class TestEstimateEdgeCases:
    """Additional _compute_time_estimate branches not covered by TestEstimate."""

    def test_transcript_scene_mode_zero_cost(self, client):
        """scene_mode=transcript has no wall-clock cost."""
        transcript = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "transcript",
        }).json()
        fast = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "fast",
        }).json()
        assert transcript["total_seconds"] < fast["total_seconds"]

    def test_full_scene_mode_slower_than_fast(self, client):
        transcript = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "fast",
        }).json()
        full = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "has_gpu": True,
            "scene_mode": "full",
        }).json()
        assert full["total_seconds"] > transcript["total_seconds"]

    def test_explicit_transcribe_tracks_overrides_default(self, client):
        auto = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "audio_tracks": 4,
            "has_gpu": True, "scene_mode": "fast",
        }).json()
        explicit = client.post("/api/estimate", json={
            "duration_s": 3600, "model": "medium", "audio_tracks": 4,
            "transcribe_tracks": 1, "has_gpu": True, "scene_mode": "fast",
        }).json()
        # Fewer transcribe tracks → faster Whisper step → lower total
        assert explicit["total_seconds"] < auto["total_seconds"]

    def test_unknown_model_falls_back_to_default_gpu_speed(self, client):
        """An unrecognised model string should not raise — it falls back to speed=6."""
        # Use the internal function directly to avoid the validate_whisper_model guard
        from yuu_clip.web.routes.analyze import _compute_time_estimate, EstimateRequest
        req = EstimateRequest(duration_s=3600, model="custom:tag", has_gpu=True, scene_mode="fast")
        result = _compute_time_estimate(req)
        assert result["total_seconds"] > 0

    def test_zero_duration_pct_is_zero(self, client):
        """Zero-duration input must not cause a division error."""
        from yuu_clip.web.routes.analyze import _compute_time_estimate, EstimateRequest
        req = EstimateRequest(duration_s=0, model="medium", has_gpu=True, scene_mode="fast")
        result = _compute_time_estimate(req)
        assert result["pct_of_video"] == 0


# ---------------------------------------------------------------------------
# Demo list — non-mkv files filtered
# ---------------------------------------------------------------------------

class TestDemoListFiltering:
    def test_non_mkv_files_not_listed(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "highlights_20260101.mkv").write_bytes(b"reel")
        (reels_dir / "notes.txt").write_text("ignore me")
        (reels_dir / "thumbnail.png").write_bytes(b"img")
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        reels = r.json()
        names = [x["filename"] for x in reels]
        assert "highlights_20260101.mkv" in names
        assert "notes.txt" not in names
        assert "thumbnail.png" not in names

    def test_reels_sorted_newest_first(self, client, project_dir):
        import time
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        older = reels_dir / "old_20260101.mkv"
        older.write_bytes(b"old")
        time.sleep(0.05)
        newer = reels_dir / "new_20260102.mkv"
        newer.write_bytes(b"new")
        r = client.get("/api/demo/list")
        reels = r.json()
        assert len(reels) == 2
        assert reels[0]["filename"] == "new_20260102.mkv"


# ---------------------------------------------------------------------------
# Video contexts — clearing with empty list
# ---------------------------------------------------------------------------

class TestVideoContextsEmpty:
    def test_patch_video_contexts_empty_list_clears(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        # First assign some contexts
        client.patch(f"/api/videos/{vid_id}/contexts", json={"context_names": ["ctx-a"]})
        # Then clear them
        r = client.patch(f"/api/videos/{vid_id}/contexts", json={"context_names": []})
        assert r.status_code == 200
        assert r.json()["context_names"] == []
        # Persisted
        d = client.get(f"/api/videos/{vid_id}").json()
        assert d["context_names"] == []


# ---------------------------------------------------------------------------
# Profile delete — nonexistent name is a no-op
# ---------------------------------------------------------------------------

class TestProfileDeleteNonexistent:
    def test_delete_nonexistent_profile_returns_200(self, client):
        """Deleting a nonexistent profile is a silent no-op (matches delete_profile impl)."""
        r = client.delete("/api/profiles/does_not_exist")
        assert r.status_code == 200
        assert r.json()["deleted"] == "does_not_exist"


# ---------------------------------------------------------------------------
# _word_set (overlap detection helper)
# ---------------------------------------------------------------------------

class TestWordSet:
    def _ws(self, text):
        from yuu_clip.analyze.overlap import _word_set
        return _word_set(text)

    def test_empty_string_returns_empty_set(self):
        assert self._ws("") == set()

    def test_lowercases_words(self):
        assert "hello" in self._ws("Hello World")
        assert "world" in self._ws("Hello World")

    def test_strips_punctuation(self):
        result = self._ws("hello, world!")
        assert "hello" in result
        assert "world" in result
        assert "," not in result
        assert "!" not in result

    def test_apostrophes_preserved(self):
        result = self._ws("can't won't")
        assert "can't" in result

    def test_numbers_excluded(self):
        result = self._ws("123 hello")
        assert "hello" in result
        assert "123" not in result


# ---------------------------------------------------------------------------
# Config.load() — project overrides global
# ---------------------------------------------------------------------------

class TestConfigLoad:
    def test_project_config_overrides_global(self, tmp_path):
        """Values in project config.json take precedence over global defaults."""
        import json
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"whisper_model": "tiny", "ollama_enabled": False}),
            encoding="utf-8",
        )
        config = Config.load(project_dir)
        assert config.whisper_model == "tiny"
        assert config.ollama_enabled is False

    def test_missing_config_returns_defaults(self, tmp_path):
        """When no config files exist, defaults are used."""
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        config = Config.load(project_dir)
        assert config.whisper_model == "base"  # default
        assert config.ollama_enabled is True    # default

    def test_unknown_keys_in_project_config_ignored(self, tmp_path):
        """Unknown keys in project config.json must not raise."""
        import json
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"whisper_model": "small", "unknown_future_key": 42}),
            encoding="utf-8",
        )
        config = Config.load(project_dir)
        assert config.whisper_model == "small"


# ---------------------------------------------------------------------------
# UI config endpoint — GET/PATCH /api/config
# ---------------------------------------------------------------------------

class TestUiConfig:
    def test_get_config_returns_defaults(self, client):
        r = client.get("/api/config")
        assert r.status_code == 200
        d = r.json()
        assert d["ui_timeline_interval_seconds"] == 900
        assert d["ui_timeline_interval_unit"] == "minutes"

    def test_patch_config_updates_interval(self, client):
        r = client.patch("/api/config", json={"ui_timeline_interval_seconds": 300, "ui_timeline_interval_unit": "seconds"})
        assert r.status_code == 200
        d = r.json()
        assert d["ui_timeline_interval_seconds"] == 300
        assert d["ui_timeline_interval_unit"] == "seconds"

    def test_patch_config_partial_update(self, client):
        client.patch("/api/config", json={"ui_timeline_interval_seconds": 600})
        r = client.get("/api/config")
        assert r.json()["ui_timeline_interval_seconds"] == 600

    def test_patch_config_interval_below_10_returns_400(self, client):
        r = client.patch("/api/config", json={"ui_timeline_interval_seconds": 5})
        assert r.status_code == 400

    def test_patch_config_invalid_unit_returns_400(self, client):
        r = client.patch("/api/config", json={"ui_timeline_interval_unit": "hours"})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Bug-hunt: clip description contains raw HTML characters (XSS regression)
# ---------------------------------------------------------------------------

class TestClipDescriptionRawText:
    """The API must return raw (unescaped) description text.
    The JS layer is responsible for escaping it before inserting into innerHTML.
    These tests document that contract so a regression (e.g. API double-escaping
    or JS forgetting to call escHtml) can be caught.
    """

    def _seed_clip_with_description(self, project_dir, description: str) -> int:
        """Insert a clip with the given description and return its id."""
        from yuu_clip.db.models import ClipCandidate, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            vid_id = session.query(ClipCandidate).first().video_id
            clip = ClipCandidate(
                video_id=vid_id,
                start_ms=900_000,
                end_ms=960_000,
                score_overall=0.5,
                description=description,
                status="pending",
            )
            session.add(clip)
            session.commit()
            return clip.id
        finally:
            session.close()

    def test_description_with_html_chars_returned_unescaped(self, client, project_dir):
        """API must return raw HTML characters in description, not entity-encoded.
        The JavaScript renderDetail() must call escHtml(clip.description) before
        writing to innerHTML — this test locks in the API contract so a regression
        on either side is visible.
        """
        raw = '<script>alert("xss")</script>'
        clip_id = self._seed_clip_with_description(project_dir, raw)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        # API returns raw text — the JS must escape it
        assert r.json()["description"] == raw

    def test_description_with_quotes_returned_unescaped(self, client, project_dir):
        """Quotes in LLM-generated descriptions must survive the API round-trip."""
        raw = 'He said "hello" & she said \'bye\''
        clip_id = self._seed_clip_with_description(project_dir, raw)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert r.json()["description"] == raw


# ---------------------------------------------------------------------------
# Editable LLM fields — PATCH /api/videos/{id}/fields
# ---------------------------------------------------------------------------

class TestEditableVideoFields:
    """PATCH /api/videos/{id}/fields — accept_new, accept_edit, revert."""

    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def _seed_title_summary(self, project_dir, title="LLM Title", summary="LLM Summary"):
        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = session.query(Video).first()
            v.title   = title
            v.summary = summary
            session.commit()
        finally:
            session.close()

    def test_accept_new_overwrites_title_clears_user(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_new", "field": "title", "new_title": "Brand New Title",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "Brand New Title"
        assert d["title_is_edited"] is False
        assert d["title_original"] == "Brand New Title"

    def test_accept_edit_sets_user_title_preserves_original(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "title", "new_title": "My Edit",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "My Edit"
        assert d["title_is_edited"] is True
        assert d["title_original"] == "LLM Title"

    def test_revert_title_clears_user_edit(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "title", "new_title": "My Edit",
        })
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "revert", "field": "title",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "LLM Title"
        assert d["title_is_edited"] is False

    def test_accept_edit_summary_preserves_original(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "summary", "new_summary": "Edited summary",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["summary"] == "Edited summary"
        assert d["summary_is_edited"] is True
        assert d["summary_original"] == "LLM Summary"

    def test_invalid_action_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "bad_action", "field": "title",
        })
        assert r.status_code == 400

    def test_invalid_field_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "revert", "field": "unknown_field",
        })
        assert r.status_code == 400

    def test_patch_video_fields_404(self, client):
        r = client.patch("/api/videos/99999/fields", json={"action": "revert", "field": "title"})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Editable LLM fields — PATCH /api/clips/{id}/fields
# ---------------------------------------------------------------------------

class TestEditableClipFields:
    """PATCH /api/clips/{id}/fields — accept_new, accept_edit, revert."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_accept_edit_sets_description_user(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description",
            "new_description": "My custom description",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == "My custom description"
        assert d["description_is_edited"] is True

    def test_accept_new_overwrites_description_clears_user(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_new", "field": "description",
            "new_description": "New LLM description",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == "New LLM description"
        assert d["description_is_edited"] is False
        assert d["description_original"] == "New LLM description"

    def test_revert_description_clears_user_edit(self, client):
        clip_id = self._first_clip_id(client)
        orig = client.get(f"/api/clips/{clip_id}").json()["description"]
        client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description", "new_description": "My edit",
        })
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "revert", "field": "description",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == orig
        assert d["description_is_edited"] is False

    def test_user_override_shown_as_description_in_get(self, client):
        """GET /api/clips/{id} must surface the user override as 'description'."""
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description",
            "new_description": "Override value",
        })
        d = client.get(f"/api/clips/{clip_id}").json()
        assert d["description"] == "Override value"
        assert d["description_original"] != "Override value"
        assert d["description_is_edited"] is True

    def test_patch_clip_fields_404(self, client):
        r = client.patch("/api/clips/99999/fields", json={"action": "revert", "field": "description"})
        assert r.status_code == 404

    def test_invalid_action_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "zap", "field": "description",
        })
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Clip timing — PATCH /api/clips/{id}/timing
# ---------------------------------------------------------------------------

class TestClipTiming:
    """PATCH /api/clips/{id}/timing — stores start_offset and end_offset."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_timing_offsets_returned_in_response(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": 2.5, "end_offset": -1.0,
        })
        assert r.status_code == 200
        d = r.json()
        assert abs(d["start_offset"] - 2.5) < 1e-6
        assert abs(d["end_offset"] - (-1.0)) < 1e-6

    def test_timing_offsets_persisted(self, client):
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 3.0, "end_offset": 0.0})
        d = client.get(f"/api/clips/{clip_id}").json()
        assert abs(d["start_offset"] - 3.0) < 1e-6
        assert d["end_offset"] == 0.0

    def test_clip_detail_includes_offset_fields(self, client):
        clip_id = self._first_clip_id(client)
        d = client.get(f"/api/clips/{clip_id}").json()
        assert "start_offset" in d
        assert "end_offset" in d

    def test_timing_patch_404(self, client):
        r = client.patch("/api/clips/99999/timing", json={"start_offset": 0.0, "end_offset": 0.0})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Reset approvals — POST /api/videos/{id}/reset-approvals
# ---------------------------------------------------------------------------

class TestResetApprovals:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_reset_approvals_sets_all_clips_to_pending(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/reset-approvals")
        assert r.status_code == 200
        d = r.json()
        assert "reset" in d
        assert d["reset"] >= 1  # seeded with 1 approved + 1 rejected
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        assert all(c["status"] == "pending" for c in clips)

    def test_reset_approvals_count_excludes_already_pending(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/reset-approvals")
        assert r.json()["reset"] == 2  # exactly the approved + rejected seeds

    def test_reset_approvals_404(self, client):
        r = client.post("/api/videos/99999/reset-approvals")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Video list — editable field metadata present
# ---------------------------------------------------------------------------

class TestVideoListEditableFields:
    def test_video_list_includes_editable_field_keys(self, client):
        v = client.get("/api/videos").json()[0]
        for key in ("title_is_edited", "title_original", "summary_is_edited", "summary_original"):
            assert key in v, f"missing key: {key}"

    def test_title_is_edited_false_when_no_user_override(self, client):
        v = client.get("/api/videos").json()[0]
        assert v["title_is_edited"] is False
        assert v["summary_is_edited"] is False


# ---------------------------------------------------------------------------
# subtitles.py — _ms_to_srt_time
# ---------------------------------------------------------------------------

class TestMsToSrtTime:
    def _fmt(self, ms):
        from yuu_clip.subtitles import _ms_to_srt_time
        return _ms_to_srt_time(ms)

    def test_zero(self):
        assert self._fmt(0) == "00:00:00,000"

    def test_negative_clamped_to_zero(self):
        assert self._fmt(-500) == "00:00:00,000"

    def test_one_second(self):
        assert self._fmt(1000) == "00:00:01,000"

    def test_one_minute(self):
        assert self._fmt(60_000) == "00:01:00,000"

    def test_one_hour(self):
        assert self._fmt(3_600_000) == "01:00:00,000"

    def test_fractional_ms(self):
        assert self._fmt(1_234) == "00:00:01,234"

    def test_complex_value(self):
        # 1h 2m 3s 456ms
        ms = 3_600_000 + 2 * 60_000 + 3_000 + 456
        assert self._fmt(ms) == "01:02:03,456"


# ---------------------------------------------------------------------------
# subtitles.py — _label_display
# ---------------------------------------------------------------------------

class TestLabelDisplay:
    def _ld(self, label):
        from yuu_clip.subtitles import _label_display
        return _label_display(label)

    def test_known_player_voice(self):
        assert self._ld("player_voice") == "Player"

    def test_known_ingame_voicechat(self):
        assert self._ld("ingame_voicechat") == "Voice Chat"

    def test_known_combined(self):
        assert self._ld("combined") == "Combined"

    def test_known_unlabeled(self):
        assert self._ld("unlabeled") == "Unknown"

    def test_unknown_label_titlifies(self):
        assert self._ld("my_custom_track") == "My Custom Track"


# ---------------------------------------------------------------------------
# subtitles.py — lines_to_srt
# ---------------------------------------------------------------------------

class TestLinesToSrt:
    def _srt(self, lines):
        from yuu_clip.subtitles import lines_to_srt
        return lines_to_srt(lines)

    def test_empty_input_returns_empty_string(self):
        assert self._srt([]) == ""

    def test_single_line_no_speaker(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 1000, "Hello")])
        assert "1\n" in result
        assert "00:00:00,000 --> 00:00:01,000" in result
        assert "Hello" in result
        assert "[" not in result

    def test_single_line_with_speaker(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 1000, "Hi", "Player")])
        assert "[Player] Hi" in result

    def test_multiple_lines_sorted_by_start(self):
        from yuu_clip.subtitles import SubLine
        lines = [SubLine(2000, 3000, "Second"), SubLine(0, 1000, "First")]
        result = self._srt(lines)
        first_pos = result.index("First")
        second_pos = result.index("Second")
        assert first_pos < second_pos

    def test_sequential_numbering(self):
        from yuu_clip.subtitles import SubLine
        lines = [SubLine(0, 500, "A"), SubLine(600, 1000, "B")]
        result = self._srt(lines)
        assert "1\n" in result
        assert "2\n" in result

    def test_text_is_stripped(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 500, "  trimmed  ")])
        assert "trimmed" in result
        assert "  trimmed  " not in result

    def test_blocks_separated_by_double_newline(self):
        from yuu_clip.subtitles import SubLine
        lines = [SubLine(0, 500, "A"), SubLine(600, 1000, "B")]
        result = self._srt(lines)
        assert "\n\n" in result


# ---------------------------------------------------------------------------
# subtitles.py — collect_clip_subtitles (with mock DB objects)
# ---------------------------------------------------------------------------

class TestCollectClipSubtitles:
    def _make_clip(self, tracks):
        class FakeClip:
            start_ms = 5_000
            end_ms   = 10_000

            class FakeVideo:
                pass

        clip = FakeClip()
        clip.video = FakeClip.FakeVideo()
        clip.video.audio_tracks = tracks
        return clip

    def _make_track(self, label, do_transcribe, segments, transcripts=None):
        import types, datetime
        track = types.SimpleNamespace(
            label=label,
            do_transcribe=do_transcribe,
            transcripts=transcripts if transcripts is not None else [],
        )
        if segments is not None:
            tx = types.SimpleNamespace(
                created_at=datetime.datetime(2024, 1, 1),
                segments=segments,
            )
            track.transcripts = [tx]
        return track

    def _make_seg(self, start_ms, end_ms, text):
        import types
        return types.SimpleNamespace(start_ms=start_ms, end_ms=end_ms, text=text)

    def test_empty_when_no_tracks(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        clip = self._make_clip([])
        assert collect_clip_subtitles(clip) == {}

    def test_skips_game_sounds_track(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg = self._make_seg(5_000, 8_000, "noise")
        track = self._make_track("game_sounds", True, [seg])
        clip = self._make_clip([track])
        assert collect_clip_subtitles(clip) == {}

    def test_skips_do_transcribe_false(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg = self._make_seg(5_000, 8_000, "speech")
        track = self._make_track("player_voice", False, [seg])
        clip = self._make_clip([track])
        assert collect_clip_subtitles(clip) == {}

    def test_skips_segments_outside_clip_window(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg_before = self._make_seg(0, 4_000, "before")
        seg_after  = self._make_seg(11_000, 13_000, "after")
        track = self._make_track("player_voice", True, [seg_before, seg_after])
        clip = self._make_clip([track])
        assert collect_clip_subtitles(clip) == {}

    def test_clips_segment_to_window_and_makes_relative(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        # segment spans 4s–8s; clip window is 5s–10s → clipped to 5s–8s → relative 0–3s
        seg = self._make_seg(4_000, 8_000, "overlap")
        track = self._make_track("player_voice", True, [seg])
        clip = self._make_clip([track])
        result = collect_clip_subtitles(clip)
        assert "player_voice" in result
        line = result["player_voice"][0]
        assert line.start_ms == 0
        assert line.end_ms == 3_000

    def test_fully_inside_segment_correct_relative_times(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg = self._make_seg(6_000, 9_000, "hello")
        track = self._make_track("player_voice", True, [seg])
        clip = self._make_clip([track])
        result = collect_clip_subtitles(clip)
        line = result["player_voice"][0]
        assert line.start_ms == 1_000
        assert line.end_ms == 4_000

    def test_uses_most_recent_transcript(self):
        import types, datetime
        from yuu_clip.subtitles import collect_clip_subtitles

        seg_old = self._make_seg(6_000, 7_000, "old")
        seg_new = self._make_seg(6_000, 7_000, "new")
        tx_old = types.SimpleNamespace(
            created_at=datetime.datetime(2024, 1, 1), segments=[seg_old]
        )
        tx_new = types.SimpleNamespace(
            created_at=datetime.datetime(2024, 6, 1), segments=[seg_new]
        )
        track = self._make_track("player_voice", True, None, transcripts=[tx_old, tx_new])
        clip = self._make_clip([track])
        result = collect_clip_subtitles(clip)
        assert result["player_voice"][0].text == "new"


# ---------------------------------------------------------------------------
# subtitles.py — merged_srt_lines
# ---------------------------------------------------------------------------

class TestMergedSrtLines:
    def _make_clip(self, track_data):
        """track_data: list of (label, do_transcribe, segments)"""
        import types, datetime

        class FakeClip:
            start_ms = 0
            end_ms = 10_000

        clip = FakeClip()

        tracks = []
        for label, do_transcribe, segs in track_data:
            seg_objs = [
                types.SimpleNamespace(start_ms=s, end_ms=e, text=t)
                for s, e, t in segs
            ]
            tx = types.SimpleNamespace(
                created_at=datetime.datetime(2024, 1, 1), segments=seg_objs
            )
            tracks.append(types.SimpleNamespace(
                label=label, do_transcribe=do_transcribe, transcripts=[tx]
            ))

        clip.video = types.SimpleNamespace(audio_tracks=tracks)
        return clip

    def test_empty_clip_returns_empty(self):
        from yuu_clip.subtitles import merged_srt_lines
        clip = self._make_clip([])
        assert merged_srt_lines(clip) == []

    def test_single_track_has_speaker_prefix(self):
        from yuu_clip.subtitles import merged_srt_lines
        clip = self._make_clip([("player_voice", True, [(1000, 2000, "hi")])])
        lines = merged_srt_lines(clip)
        assert len(lines) == 1
        assert lines[0].speaker == "Player"

    def test_multi_track_sorted_by_start(self):
        from yuu_clip.subtitles import merged_srt_lines
        clip = self._make_clip([
            ("player_voice", True, [(3000, 4000, "later")]),
            ("ingame_voicechat", True, [(1000, 2000, "earlier")]),
        ])
        lines = merged_srt_lines(clip)
        assert lines[0].text == "earlier"
        assert lines[1].text == "later"


# ---------------------------------------------------------------------------
# analyze/probe.py — _parse_fps
# ---------------------------------------------------------------------------

class TestParseFps:
    def _fps(self, s):
        from yuu_clip.analyze.probe import _parse_fps
        return _parse_fps(s)

    def test_integer_string(self):
        assert self._fps("30") == 30.0

    def test_fraction_string(self):
        result = self._fps("60000/1001")
        assert abs(result - 59.94) < 0.01

    def test_exact_fraction(self):
        assert self._fps("30/1") == 30.0

    def test_zero_denominator_returns_default(self):
        assert self._fps("30/0") == 30.0

    def test_invalid_string_returns_default(self):
        assert self._fps("not_a_number") == 30.0

    def test_empty_string_returns_default(self):
        assert self._fps("") == 30.0


# ---------------------------------------------------------------------------
# analyze/probe.py — VideoInfo properties
# ---------------------------------------------------------------------------

class TestVideoInfoProperties:
    def _make_info(self, duration_ms, n_audio=1):
        from yuu_clip.analyze.probe import VideoInfo, AudioStreamInfo
        from pathlib import Path
        streams = [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None, title_tag=None,
            )
            for i in range(n_audio)
        ]
        return VideoInfo(
            path=Path("fake.mkv"), duration_ms=duration_ms,
            fps=60.0, width=1920, height=1080, audio_streams=streams,
        )

    def test_has_multiple_audio_tracks_false_for_one(self):
        assert self._make_info(1000, n_audio=1).has_multiple_audio_tracks is False

    def test_has_multiple_audio_tracks_true_for_two(self):
        assert self._make_info(1000, n_audio=2).has_multiple_audio_tracks is True

    def test_duration_hms_minutes_only(self):
        # 5m 30s = 330 000 ms
        info = self._make_info(330_000)
        assert info.duration_hms == "5m 30s"

    def test_duration_hms_with_hours(self):
        # 1h 2m 3s = 3723000 ms
        info = self._make_info(3_723_000)
        assert info.duration_hms == "1h 02m 03s"

    def test_duration_hms_zero(self):
        info = self._make_info(0)
        assert info.duration_hms == "0m 00s"


# ---------------------------------------------------------------------------
# analyze/labeler.py — label_tracks single-track auto-label
# ---------------------------------------------------------------------------

class TestLabelTracksSingleTrack:
    def _make_video_info(self, n_streams, title_tags=None):
        from yuu_clip.analyze.probe import VideoInfo, AudioStreamInfo
        from pathlib import Path
        streams = [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None,
                title_tag=(title_tags[i] if title_tags else None),
            )
            for i in range(n_streams)
        ]
        return VideoInfo(
            path=Path("fake.mkv"), duration_ms=60_000,
            fps=30.0, width=1920, height=1080, audio_streams=streams,
        )

    def test_single_track_auto_labeled_combined(self):
        from yuu_clip.analyze.labeler import label_tracks
        vi = self._make_video_info(1)
        result = label_tracks(vi, non_interactive=True)
        assert len(result) == 1
        assert result[0]["label"] == "combined"
        assert result[0]["do_transcribe"] is True
        assert result[0]["do_score"] is True

    def test_multi_track_non_interactive_no_profile_uses_track0(self):
        from yuu_clip.analyze.labeler import label_tracks
        vi = self._make_video_info(3)
        result = label_tracks(vi, non_interactive=True)
        assert len(result) == 3
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"
        assert result[2]["label"] == "unlabeled"
        assert result[1]["do_transcribe"] is False
        assert result[2]["do_score"] is False


# ---------------------------------------------------------------------------
# analyze/labeler.py — _label_non_interactive
# ---------------------------------------------------------------------------

class TestLabelNonInteractive:
    def _make_streams(self, n, title_tags=None):
        from yuu_clip.analyze.probe import AudioStreamInfo
        return [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None,
                title_tag=(title_tags[i] if title_tags else None),
            )
            for i in range(n)
        ]

    def test_single_stream_returns_primary_only(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(1)
        result = _label_non_interactive(streams, None)
        assert len(result) == 1
        assert result[0]["label"] == "combined"

    def test_two_streams_second_is_unlabeled(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, None)
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"
        assert result[1]["do_transcribe"] is False

    def test_stream_index_preserved(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, None)
        assert result[0]["stream_index"] == 0
        assert result[1]["stream_index"] == 1

    def test_default_profile_name_skipped(self):
        """__default__ profile name should not attempt a profile lookup."""
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, "__default__")
        assert result[0]["label"] == "combined"


# ---------------------------------------------------------------------------
# analyze/labeler.py — _guess_label_index
# ---------------------------------------------------------------------------

class TestGuessLabelIndex:
    def _make_stream(self, title):
        from yuu_clip.analyze.probe import AudioStreamInfo
        return AudioStreamInfo(
            stream_index=0, codec_name="aac", sample_rate=48000,
            channels=2, channel_layout="stereo", duration_ms=None, title_tag=title,
        )

    def _guess(self, title):
        from yuu_clip.analyze.labeler import _guess_label_index
        return _guess_label_index(self._make_stream(title))

    def test_mic_in_title_returns_player_voice(self):
        assert self._guess("Mic (Clean)") == 1

    def test_voice_in_title_returns_player_voice(self):
        assert self._guess("My Voice") == 1

    def test_desktop_in_title_returns_combined(self):
        assert self._guess("Desktop Audio") == 4

    def test_game_in_title_returns_combined(self):
        assert self._guess("Game Capture") == 4

    def test_unknown_title_returns_unlabeled(self):
        assert self._guess("Track 1") == 5

    def test_none_title_returns_unlabeled(self):
        assert self._guess(None) == 5


# ---------------------------------------------------------------------------
# analyze/overlap.py — detect_transcript_overlap (unit, no DB)
# ---------------------------------------------------------------------------

class TestDetectTranscriptOverlap:
    def _make_track(self, label, do_score, words):
        """Build a minimal track-like object whose transcript returns *words*."""
        import types
        return types.SimpleNamespace(
            id=1,
            label=label,
            do_score=do_score,
            relevance_weight=1.0,
            do_transcribe=False,
            _words=words,
        )

    def _run(self, tracks, threshold=0.75):
        from yuu_clip.analyze.overlap import detect_transcript_overlap

        track_text_map = {t.id: t._words for t in tracks}

        class FakeTx:
            def __init__(self, text):
                self._text = text
            def full_text(self):
                return self._text

        class FakeOrderBy:
            def __init__(self, text):
                self._text = text
            def order_by(self, *a):
                return self
            def first(self):
                return FakeTx(self._text)

        class FakeQuery:
            def filter_by(self, **kw):
                tid = kw.get("audio_track_id")
                return FakeOrderBy(track_text_map.get(tid, ""))

        class FakeSession:
            def query(self, model):
                return FakeQuery()

        return detect_transcript_overlap(tracks, FakeSession(), threshold=threshold)

    def test_no_combined_returns_false(self):
        tracks = [self._make_track("player_voice", True, "hello world foo bar")]
        result = self._run(tracks)
        assert result is False

    def test_no_specialized_returns_false(self):
        long_text = " ".join(["word"] * 25)
        tracks = [self._make_track("combined", True, long_text)]
        result = self._run(tracks)
        assert result is False

    def test_combined_too_short_returns_false(self):
        tracks = [
            self._make_track("combined", True, "short text"),
            self._make_track("player_voice", True, "short text"),
        ]
        result = self._run(tracks)
        assert result is False

    def test_high_overlap_disables_specialized_scoring(self):
        # _word_set uses [a-z']+ so words must be purely alphabetic
        import string
        # 26 unique single-letter words a-z as combined; specialized uses a-x (24)
        alpha = list(string.ascii_lowercase)        # 26 unique words
        combined_words = " ".join(alpha)            # a b c ... z
        specialized_words = " ".join(alpha[:24])    # a b c ... x  (24/24 = 100% overlap)
        combined = self._make_track("combined", True, combined_words)
        combined.id = 10
        specialized = self._make_track("player_voice", True, specialized_words)
        specialized.id = 11
        tracks = [combined, specialized]
        result = self._run(tracks, threshold=0.75)
        assert result is True
        assert specialized.do_score is False
        assert combined.do_transcribe is True
        assert combined.do_score is True

    def test_low_overlap_leaves_specialized_unchanged(self):
        import string
        alpha = list(string.ascii_lowercase)        # 26 unique words
        # combined has a-z; specialized has entirely different words
        combined_words = " ".join(alpha)
        # build 20 words not in alpha by repeating suffixes
        specialized_words = " ".join([f"zz{c}" for c in alpha[:20]])
        combined = self._make_track("combined", True, combined_words)
        combined.id = 10
        specialized = self._make_track("player_voice", True, specialized_words)
        specialized.id = 11
        tracks = [combined, specialized]
        result = self._run(tracks, threshold=0.75)
        assert result is False
        assert specialized.do_score is True


# ---------------------------------------------------------------------------
# Auto-approve endpoint
# ---------------------------------------------------------------------------

class TestAutoApprove:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_approves_pending_clips_above_threshold(self, client):
        vid_id = self._vid_id(client)
        # conftest seeds one pending clip with score 0.85
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.8})
        assert r.status_code == 200
        assert r.json()["approved"] == 1

    def test_does_not_approve_below_threshold(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99})
        assert r.status_code == 200
        assert r.json()["approved"] == 0

    def test_does_not_re_approve_already_approved(self, client):
        vid_id = self._vid_id(client)
        # conftest seeds one approved clip (score 0.60) — threshold 0.5 would match it
        # but it's already approved, not pending, so it should be ignored
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 200
        # only the pending clip with score 0.85 qualifies; rejected/approved are skipped
        assert r.json()["approved"] == 1

    def test_invalid_threshold_above_one(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 1.5})
        assert r.status_code == 400

    def test_invalid_threshold_below_zero(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": -0.1})
        assert r.status_code == 400

    def test_invalid_score_field(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.5, "score_field": "nonexistent"})
        assert r.status_code == 400

    def test_valid_sub_score_fields(self, client):
        vid_id = self._vid_id(client)
        for field in ("funny", "dramatic", "action"):
            r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99, "score_field": field})
            assert r.status_code == 200

    def test_video_not_found(self, client):
        r = client.post("/api/videos/99999/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Batch-export endpoint — validation guards (SSE body not inspected)
# ---------------------------------------------------------------------------

class TestBatchExportValidation:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_invalid_container_rejected(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/batch-export?container=avi")
        assert r.status_code == 400

    def test_valid_containers_accepted(self, client):
        vid_id = self._vid_id(client)
        # Both mkv and mp4 should pass validation; no approved clips exist at score>1.0
        for fmt in ("mkv", "mp4"):
            r = client.get(f"/api/videos/{vid_id}/batch-export?container={fmt}&min_score=1.1")
            # 400 because no clips pass the filter, not because container is wrong
            assert r.status_code == 400
            assert "container" not in r.text.lower()

    def test_video_not_found(self, client):
        r = client.get("/api/videos/99999/batch-export")
        assert r.status_code == 404

    def test_no_approved_clips_returns_400(self, client):
        vid_id = self._vid_id(client)
        # Use min_score > 1.0 so no clips can pass
        r = client.get(f"/api/videos/{vid_id}/batch-export?min_score=1.1")
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Approved-clips endpoint for reel builder
# ---------------------------------------------------------------------------

class TestApprovedClipsForReel:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_returns_approved_clips_only(self, client):
        r = client.get("/api/demo/approved-clips")
        assert r.status_code == 200
        clips = r.json()
        # conftest seeds one approved clip
        assert len(clips) == 1
        assert all(c["id"] for c in clips)

    def test_response_shape(self, client):
        clips = client.get("/api/demo/approved-clips").json()
        assert len(clips) >= 1
        c = clips[0]
        for key in ("id", "video_id", "video_name", "start_hms", "duration_hms",
                    "duration_ms", "score_overall", "description", "has_export"):
            assert key in c, f"missing key: {key}"

    def test_filter_by_video_id(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/demo/approved-clips?video_id={vid_id}")
        assert r.status_code == 200
        clips = r.json()
        assert all(c["video_id"] == vid_id for c in clips)

    def test_filter_by_nonexistent_video_returns_empty(self, client):
        r = client.get("/api/demo/approved-clips?video_id=99999")
        assert r.status_code == 200
        assert r.json() == []


# ---------------------------------------------------------------------------
# LLMScorer — is_available() branches (new dual-backend code)
# ---------------------------------------------------------------------------

class TestLLMScorerIsAvailable:
    """LLMScorer.is_available() covers ollama_enabled gate, llamacpp checks, ollama checks."""

    def _make_config(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def _scorer(self, **config_overrides):
        from yuu_clip.scoring.llm import LLMScorer
        return LLMScorer(self._make_config(**config_overrides))

    def test_ollama_enabled_false_returns_false_immediately(self):
        scorer = self._scorer(ollama_enabled=False, llm_backend="llamacpp")
        assert scorer.is_available() is False

    def test_llamacpp_empty_model_path_returns_false(self):
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path="")
        assert scorer.is_available() is False

    def test_llamacpp_nonexistent_path_returns_false(self, tmp_path):
        scorer = self._scorer(
            llm_backend="llamacpp",
            llm_model_path=str(tmp_path / "nonexistent.gguf"),
        )
        assert scorer.is_available() is False

    def test_llamacpp_path_exists_but_import_fails_returns_false(self, tmp_path):
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        import unittest.mock as mock
        with mock.patch.dict("sys.modules", {"llama_cpp": None}):
            assert scorer.is_available() is False

    def test_llamacpp_all_checks_pass_returns_true(self, tmp_path):
        import sys
        import unittest.mock as mock
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        fake_module = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"llama_cpp": fake_module}):
            scorer._available = None
            result = scorer._check_llamacpp()
        assert result is True

    def test_ollama_backend_unreachable_returns_false(self):
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="ollama")
        with mock.patch("ollama.Client") as mock_client:
            mock_client.return_value.list.side_effect = Exception("connection refused")
            scorer._available = None
            result = scorer._check_ollama()
        assert result is False

    def test_ollama_backend_reachable_returns_true(self):
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="ollama")
        with mock.patch("ollama.Client") as mock_client:
            mock_client.return_value.list.return_value = []
            result = scorer._check_ollama()
        assert result is True

    def test_is_available_caches_result(self, tmp_path):
        """Second call to is_available() must not redo the availability check."""
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="ollama")
        call_count = 0
        def counting_list():
            nonlocal call_count
            call_count += 1
            return []
        with mock.patch("ollama.Client") as mock_client:
            mock_client.return_value.list.side_effect = counting_list
            scorer.is_available()
            scorer.is_available()
        assert call_count == 1


# ---------------------------------------------------------------------------
# LLMScorer — _parse() score clamping
# ---------------------------------------------------------------------------

class TestLLMScorerParse:
    """_parse() clamps scores to [0, 1] and passes through other keys."""

    def _parse(self, data: dict) -> dict:
        import json
        from yuu_clip.scoring.llm import LLMScorer
        from yuu_clip.config import Config
        scorer = LLMScorer(Config())
        return scorer._parse(json.dumps(data))

    def test_scores_within_range_unchanged(self):
        result = self._parse({"score_funny": 0.5, "score_dramatic": 0.3, "score_action": 0.8})
        assert abs(result["score_funny"] - 0.5) < 1e-9
        assert abs(result["score_dramatic"] - 0.3) < 1e-9
        assert abs(result["score_action"] - 0.8) < 1e-9

    def test_score_above_one_clamped_to_one(self):
        result = self._parse({"score_funny": 1.5, "score_dramatic": 2.0, "score_action": 99.0})
        assert result["score_funny"] == 1.0
        assert result["score_dramatic"] == 1.0
        assert result["score_action"] == 1.0

    def test_score_below_zero_clamped_to_zero(self):
        result = self._parse({"score_funny": -0.5, "score_dramatic": -1.0, "score_action": -99.0})
        assert result["score_funny"] == 0.0
        assert result["score_dramatic"] == 0.0
        assert result["score_action"] == 0.0

    def test_missing_score_keys_not_added(self):
        result = self._parse({"description": "test"})
        assert "score_funny" not in result
        assert result["description"] == "test"

    def test_description_keys_preserved(self):
        result = self._parse({
            "score_funny": 0.5, "score_dramatic": 0.5, "score_action": 0.5,
            "description": "A moment", "description_long": "Longer text here",
        })
        assert result["description"] == "A moment"
        assert result["description_long"] == "Longer text here"


# ---------------------------------------------------------------------------
# LLMScorer — score() result paths
# ---------------------------------------------------------------------------

class TestLLMScorerScore:
    """score() — no-transcript, error, and success paths."""

    def _make_scorer(self, backend_response=None):
        import unittest.mock as mock
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        if backend_response is not None:
            scorer._call_llm = mock.MagicMock(return_value=backend_response)
        return scorer

    def _make_clip(self, excerpt=""):
        import unittest.mock as mock
        clip = mock.MagicMock()
        clip.id = 1
        clip.transcript_excerpt = excerpt
        return clip

    def test_no_transcript_returns_llm_no_transcript_tag(self):
        scorer = self._make_scorer()
        clip = self._make_clip(excerpt="")
        result = scorer.score(clip, None)
        assert "llm_no_transcript" in result.tags
        assert result.score_funny == 0.0

    def test_none_transcript_returns_llm_no_transcript_tag(self):
        scorer = self._make_scorer()
        clip = self._make_clip(excerpt=None)
        result = scorer.score(clip, None)
        assert "llm_no_transcript" in result.tags

    def test_backend_exception_returns_llm_error_tag(self):
        import unittest.mock as mock
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        scorer._call_llm = mock.MagicMock(side_effect=RuntimeError("backend down"))
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags
        assert result.score_funny == 0.0

    def test_invalid_json_returns_llm_error_tag(self):
        scorer = self._make_scorer(backend_response="not json {{{{")
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags

    def test_successful_score_populates_all_fields(self):
        import json
        payload = {
            "score_funny": 0.7, "score_dramatic": 0.4, "score_action": 0.2,
            "description": "A funny moment", "description_long": "Very detailed text",
        }
        scorer = self._make_scorer(backend_response=json.dumps(payload))
        clip = self._make_clip(excerpt="transcript here")
        result = scorer.score(clip, None)
        assert "llm_scored" in result.tags
        assert abs(result.score_funny - 0.7) < 1e-6
        assert abs(result.score_dramatic - 0.4) < 1e-6
        assert abs(result.score_action - 0.2) < 1e-6
        assert result.description == "A funny moment"
        assert result.description_long == "Very detailed text"

    def test_out_of_range_scores_clamped(self):
        import json
        payload = {"score_funny": 2.0, "score_dramatic": -1.0, "score_action": 0.5}
        scorer = self._make_scorer(backend_response=json.dumps(payload))
        clip = self._make_clip(excerpt="transcript here")
        result = scorer.score(clip, None)
        assert result.score_funny == 1.0
        assert result.score_dramatic == 0.0

    def test_success_notes_include_model_id_for_llamacpp(self):
        import json
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        import unittest.mock as mock
        cfg = Config()
        cfg.llm_backend = "llamacpp"
        cfg.llm_model_path = "/models/llama3.gguf"
        scorer = LLMScorer(cfg)
        scorer._call_llm = mock.MagicMock(return_value=json.dumps({"score_funny": 0.5}))
        clip = self._make_clip(excerpt="text")
        result = scorer.score(clip, None)
        assert result.notes.get("model") == "/models/llama3.gguf"

    def test_success_notes_include_model_id_for_ollama(self):
        import json
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        import unittest.mock as mock
        cfg = Config()
        cfg.llm_backend = "ollama"
        cfg.ollama_model = "llama3.1:8b"
        scorer = LLMScorer(cfg)
        scorer._call_llm = mock.MagicMock(return_value=json.dumps({"score_funny": 0.5}))
        clip = self._make_clip(excerpt="text")
        result = scorer.score(clip, None)
        assert result.notes.get("model") == "llama3.1:8b"


# ---------------------------------------------------------------------------
# Config — new llm_backend / llm_model_path defaults
# ---------------------------------------------------------------------------

class TestConfigNewLlmFields:
    def test_llm_backend_default_is_llamacpp(self):
        from yuu_clip.config import Config
        assert Config().llm_backend == "llamacpp"

    def test_llm_model_path_default_is_empty_string(self):
        from yuu_clip.config import Config
        assert Config().llm_model_path == ""

    def test_llm_backend_roundtrips_through_config_load(self, tmp_path):
        import json
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"llm_backend": "ollama", "llm_model_path": "/models/foo.gguf"}),
            encoding="utf-8",
        )
        cfg = Config.load(project_dir)
        assert cfg.llm_backend == "ollama"
        assert cfg.llm_model_path == "/models/foo.gguf"


# ---------------------------------------------------------------------------
# /api/config — patch llm_backend and llm_model_path
# ---------------------------------------------------------------------------

class TestConfigApiLlmFields:
    def test_get_config_includes_new_llm_fields(self, client):
        d = client.get("/api/config").json()
        assert "llm_backend" in d
        assert "llm_model_path" in d

    def test_patch_llm_backend_to_ollama(self, client):
        r = client.patch("/api/config", json={"llm_backend": "ollama"})
        assert r.status_code == 200
        assert r.json()["llm_backend"] == "ollama"

    def test_patch_llm_model_path(self, client):
        r = client.patch("/api/config", json={"llm_model_path": "/models/llama3.gguf"})
        assert r.status_code == 200
        assert r.json()["llm_model_path"] == "/models/llama3.gguf"


# ---------------------------------------------------------------------------
# reel._esc() — path escaping for ffmpeg filter strings
# ---------------------------------------------------------------------------

class TestReelEsc:
    def _esc(self, s):
        from yuu_clip.reel import _esc
        return _esc(s)

    def test_plain_path_unchanged(self):
        assert self._esc("/usr/share/fonts/arial.ttf") == "/usr/share/fonts/arial.ttf"

    def test_backslash_doubled(self):
        result = self._esc("C:\\fonts\\arial.ttf")
        assert "\\\\" in result

    def test_colon_escaped(self):
        result = self._esc("C:/fonts/arial.ttf")
        assert "\\:" in result
        assert result.count(":") == 0 or all(result[i-1] == "\\" for i in range(len(result)) if result[i] == ":")

    def test_percent_doubled(self):
        result = self._esc("path%20with%20spaces")
        assert "%%" in result

    def test_single_quote_escaped(self):
        result = self._esc("path/with'quote")
        assert "'" not in result or "'\\''" in result

    def test_empty_string_unchanged(self):
        assert self._esc("") == ""


# ---------------------------------------------------------------------------
# reel._build_xfade_cmd() — pure command builder, no ffmpeg needed
# ---------------------------------------------------------------------------

class TestBuildXfadeCmd:
    def _build(self, segments, durations, transition="fade", trans_dur=0.5):
        from pathlib import Path
        from yuu_clip.reel import _build_xfade_cmd
        paths = [Path(f"/fake/seg{i}.mkv") for i in range(segments)]
        durs = durations if isinstance(durations, list) else [durations] * segments
        transitions = [transition] * max(0, segments - 1)
        output = Path("/fake/output.mkv")
        return _build_xfade_cmd(paths, durs, output, transitions, trans_dur)

    def test_single_segment_uses_passthrough_filter(self):
        cmd = self._build(1, [10.0])
        fc = " ".join(cmd)
        assert "copy[vout]" in fc
        assert "acopy[aout]" in fc

    def test_two_segments_produces_one_xfade(self):
        cmd = self._build(2, [10.0, 10.0])
        fc_idx = cmd.index("-filter_complex") + 1
        fc = cmd[fc_idx]
        assert "xfade" in fc
        assert "acrossfade" in fc

    def test_output_path_present_in_command(self):
        cmd = self._build(2, [5.0, 5.0])
        cmd_str = " ".join(cmd)
        assert "output.mkv" in cmd_str

    def test_all_input_paths_present(self):
        cmd = self._build(3, [5.0, 5.0, 5.0])
        cmd_str = " ".join(cmd)
        for i in range(3):
            assert f"seg{i}.mkv" in cmd_str

    def test_three_segments_produces_two_xfades(self):
        cmd = self._build(3, [10.0, 10.0, 10.0])
        fc_idx = cmd.index("-filter_complex") + 1
        fc = cmd[fc_idx]
        assert fc.count("xfade") == 2

    def test_vout_and_aout_mapped(self):
        cmd = self._build(2, [5.0, 5.0])
        assert "[vout]" in cmd
        assert "[aout]" in cmd


# ---------------------------------------------------------------------------
# analyze/extract._ffmpeg_path — pure Windows-path normalisation
# ---------------------------------------------------------------------------

class TestFfmpegPath:
    """_ffmpeg_path converts backslash paths to forward slashes for FFmpeg."""

    def _fp(self, path_str):
        from pathlib import Path
        from yuu_clip.analyze.extract import _ffmpeg_path
        return _ffmpeg_path(Path(path_str))

    def test_posix_path_unchanged(self):
        result = self._fp("/usr/share/video.mkv")
        assert "\\" not in result
        assert result.endswith("video.mkv")

    def test_windows_path_uses_forward_slashes(self):
        # On Windows, Path("C:\\Users\\foo\\bar.mkv").as_posix() → "C:/Users/foo/bar.mkv"
        from pathlib import PureWindowsPath
        from yuu_clip.analyze.extract import _ffmpeg_path
        p = PureWindowsPath("C:\\Users\\foo\\bar.mkv")
        result = _ffmpeg_path(p)
        assert "\\" not in result
        assert "bar.mkv" in result

    def test_returns_string(self):
        result = self._fp("/some/path.mkv")
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# analyze/extract.export_clip — command structure (subprocess mocked)
# ---------------------------------------------------------------------------

class TestExportClipCommand:
    """Validate the ffmpeg command built by export_clip without running FFmpeg."""

    def _run_export(self, tmp_path, reencode=False, subtitle_path=None,
                    audio_stream_index=None):
        from pathlib import Path
        from unittest.mock import patch, MagicMock
        from yuu_clip.analyze.extract import export_clip

        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")
        output = tmp_path / "out.mkv"

        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            r = MagicMock()
            r.returncode = 0
            return r

        with patch("yuu_clip.analyze.extract.subprocess.run", side_effect=fake_run), \
             patch("yuu_clip.analyze.extract.find_ffmpeg", return_value=("ffmpeg", None)):
            export_clip(
                video, start_ms=5_000, end_ms=15_000, output_path=output,
                reencode=reencode, subtitle_path=subtitle_path,
                audio_stream_index=audio_stream_index,
            )

        return captured["cmd"]

    def test_stream_copy_mode_uses_copy_codec(self, tmp_path):
        cmd = self._run_export(tmp_path)
        assert "-c" in cmd
        copy_idx = cmd.index("-c")
        assert cmd[copy_idx + 1] == "copy"

    def test_stream_copy_seek_before_input(self, tmp_path):
        cmd = self._run_export(tmp_path)
        ss_idx = cmd.index("-ss")
        i_idx  = cmd.index("-i")
        assert ss_idx < i_idx

    def test_reencode_seek_after_input(self, tmp_path):
        cmd = self._run_export(tmp_path, reencode=True)
        i_idx  = cmd.index("-i")
        ss_idx = next(i for i, v in enumerate(cmd) if v == "-ss" and i > i_idx)
        assert ss_idx > i_idx

    def test_reencode_uses_libx264(self, tmp_path):
        cmd = self._run_export(tmp_path, reencode=True)
        assert "libx264" in cmd

    def test_subtitle_forces_reencode(self, tmp_path):
        subtitle = tmp_path / "subs.srt"
        subtitle.write_text("1\n00:00:00,000 --> 00:00:01,000\nHi\n\n", encoding="utf-8")
        cmd = self._run_export(tmp_path, subtitle_path=subtitle)
        assert "libx264" in cmd
        assert any("subtitles=" in str(arg) for arg in cmd)

    def test_audio_stream_index_adds_map_flags(self, tmp_path):
        cmd = self._run_export(tmp_path, audio_stream_index=2)
        maps = [cmd[i + 1] for i, v in enumerate(cmd) if v == "-map"]
        assert "0:v:0" in maps
        assert "0:2" in maps

    def test_no_audio_stream_index_omits_map_flags(self, tmp_path):
        cmd = self._run_export(tmp_path)
        assert "-map" not in cmd

    def test_failure_raises_runtime_error(self, tmp_path):
        from pathlib import Path
        from unittest.mock import patch, MagicMock
        from yuu_clip.analyze.extract import export_clip

        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")

        def failing_run(cmd, **kwargs):
            r = MagicMock()
            r.returncode = 1
            r.stderr = "codec not found"
            return r

        with patch("yuu_clip.analyze.extract.subprocess.run", side_effect=failing_run), \
             patch("yuu_clip.analyze.extract.find_ffmpeg", return_value=("ffmpeg", None)):
            with pytest.raises(RuntimeError, match="FFmpeg clip export failed"):
                export_clip(video, 0, 5_000, tmp_path / "out.mkv")


# ---------------------------------------------------------------------------
# windower.generate_candidates — public API with a real DB session
# ---------------------------------------------------------------------------

class TestGenerateCandidates:
    """generate_candidates produces ClipCandidates from Transcript + TranscriptSegments."""

    def _setup_db(self, tmp_path, do_transcribe=True):
        from yuu_clip.db.models import (
            AudioTrack, Transcript, TranscriptSegment, Video, make_session,
        )
        db_path = tmp_path / "test.db"
        session = make_session(db_path)

        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv",
                  status="done", duration_ms=600_000)
        session.add(v)
        session.flush()

        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=do_transcribe, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()

        return session, v, tx

    def _add_seg(self, session, tx_id, start_ms, end_ms, text="x"):
        from yuu_clip.db.models import TranscriptSegment
        session.add(TranscriptSegment(
            transcript_id=tx_id, start_ms=start_ms, end_ms=end_ms, text=text,
        ))

    def test_empty_transcripts_returns_empty_list(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        try:
            result = generate_candidates(v, [], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_non_transcribable_track_ignored(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import Transcript
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path, do_transcribe=False)
        # Add segments — they should be ignored because do_transcribe=False
        self._add_seg(session, tx.id, 0, 10_000)
        session.flush()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_segments_shorter_than_min_clip_dropped(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # 2-second segment, default min_clip_ms = 5000
        self._add_seg(session, tx.id, 0, 2_000, "short")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert result == []

    def test_long_segment_produces_one_candidate(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 30_000, "hello world")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) == 1
        assert result[0].start_ms == 0
        assert result[0].end_ms == 30_000
        assert result[0].video_id == v.id
        assert result[0].status == "pending"

    def test_silence_gap_produces_two_candidates(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # Two clusters each > min_clip_ms (15 s), separated by > silence_threshold_ms (3 s)
        # Cluster A: 0 – 20 000 ms  (4 × 5 s segments)
        for i in range(4):
            self._add_seg(session, tx.id, i * 5_000, (i + 1) * 5_000, f"a{i}")
        # Cluster B: 30 000 – 50 000 ms
        for i in range(4):
            offset = 30_000 + i * 5_000
            self._add_seg(session, tx.id, offset, offset + 5_000, f"b{i}")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) == 2
        assert result[0].end_ms < result[1].start_ms

    def test_transcript_excerpt_joins_segment_texts(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 10_000, "hello")
        self._add_seg(session, tx.id, 11_000, 20_000, "world")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) >= 1
        # Both words should appear in at least one excerpt
        all_text = " ".join(c.transcript_excerpt or "" for c in result)
        assert "hello" in all_text
        assert "world" in all_text

    def test_candidates_added_to_session(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 30_000, "content")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
            session.commit()
            count = session.query(ClipCandidate).count()
        finally:
            session.close()
        assert count == len(result)
        assert count >= 1


# ---------------------------------------------------------------------------
# AudioEnergyScorer — happy path (data inside window produces positive score)
# ---------------------------------------------------------------------------

class TestAudioEnergyScorerHappyPath:
    """score() with energy rows inside the clip window returns energy_scored tag."""

    def _make_db_with_energy(self, tmp_path, n_rows=30, loud_start=10, loud_end=20,
                              loud_db=10.0, quiet_db=-30.0):
        from unittest.mock import MagicMock
        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        session = make_session(tmp_path / "test.db")
        v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=True, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        # Populate the whole track with mostly quiet rows, and louder rows in
        # [loud_start, loud_end) — these are the ones the clip window covers.
        for s in range(n_rows):
            db = loud_db if loud_start <= s < loud_end else quiet_db
            session.add(AudioEnergy(audio_track_id=track.id, second_offset=s, rms_db=db))
        session.flush()

        db_track = session.query(AudioTrack).filter_by(id=track.id).one()

        clip = MagicMock()
        clip.start_ms = loud_start * 1000
        clip.end_ms   = loud_end   * 1000
        clip.video.audio_tracks = [db_track]

        return AudioEnergyScorer(Config()), clip, session

    def test_energy_rows_inside_window_produce_energy_scored_tag(self, tmp_path):
        scorer, clip, session = self._make_db_with_energy(tmp_path)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert "energy_scored" in result.tags

    def test_loud_window_produces_positive_score_action(self, tmp_path):
        scorer, clip, session = self._make_db_with_energy(tmp_path, loud_db=0.0, quiet_db=-60.0)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action > 0.0

    def test_score_action_does_not_exceed_one(self, tmp_path):
        # Clip window is extremely loud; score must be clamped at 1.0
        scorer, clip, session = self._make_db_with_energy(
            tmp_path, loud_db=100.0, quiet_db=-100.0
        )
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action <= 1.0

    def test_score_result_includes_notes(self, tmp_path):
        scorer, clip, session = self._make_db_with_energy(tmp_path)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert "clip_mean_db" in result.notes
        assert "baseline_db" in result.notes

    def test_quiet_window_in_loud_video_scores_lower(self, tmp_path):
        """A clip at the quiet section of an otherwise loud video scores low."""
        from unittest.mock import MagicMock
        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        session = make_session(tmp_path / "test.db")
        v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=True, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        # Most of the video is loud; seconds 0–9 are quiet
        for s in range(30):
            db = -60.0 if s < 10 else 0.0
            session.add(AudioEnergy(audio_track_id=track.id, second_offset=s, rms_db=db))
        session.flush()

        db_track = session.query(AudioTrack).filter_by(id=track.id).one()
        clip = MagicMock()
        clip.start_ms = 0
        clip.end_ms   = 10_000
        clip.video.audio_tracks = [db_track]

        scorer = AudioEnergyScorer(Config())
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()

        # Score should be 0.0 (below baseline) — quiet clip in a loud video
        assert result.score_action == 0.0


# ---------------------------------------------------------------------------
# contexts.py — load/save/seed unit tests
# ---------------------------------------------------------------------------

class TestLoadSaveContexts:
    def test_load_contexts_returns_empty_when_no_file(self, tmp_path):
        from yuu_clip.contexts import load_contexts
        assert load_contexts(tmp_path) == {}

    def test_save_and_load_roundtrip(self, tmp_path):
        from yuu_clip.contexts import load_contexts, save_contexts
        data = {"my-ctx": {"display_name": "My Ctx", "setting": "A world"}}
        save_contexts(tmp_path, data)
        assert load_contexts(tmp_path) == data

    def test_save_creates_parent_dirs(self, tmp_path):
        from yuu_clip.contexts import save_contexts, load_contexts
        nested = tmp_path / "deep" / "project"
        save_contexts(nested, {"x": {"display_name": "X"}})
        assert load_contexts(nested) == {"x": {"display_name": "X"}}

    def test_seed_builtin_contexts_writes_all_builtins(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, load_contexts, BUILTIN_IDS
        seed_builtin_contexts(tmp_path)
        result = load_contexts(tmp_path)
        assert BUILTIN_IDS <= set(result)

    def test_seed_builtin_contexts_does_not_overwrite_existing(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, save_contexts, load_contexts
        existing = {"fantasy-rp": {"display_name": "Custom", "setting": "changed"}}
        save_contexts(tmp_path, existing)
        seed_builtin_contexts(tmp_path)
        result = load_contexts(tmp_path)
        assert result["fantasy-rp"]["display_name"] == "Custom"

    def test_seed_builtin_contexts_adds_timestamps(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, load_contexts
        seed_builtin_contexts(tmp_path)
        result = load_contexts(tmp_path)
        ctx = result["fantasy-rp"]
        assert "created_at" in ctx
        assert "updated_at" in ctx

    def test_seed_is_idempotent(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, load_contexts
        seed_builtin_contexts(tmp_path)
        first = load_contexts(tmp_path)
        seed_builtin_contexts(tmp_path)
        second = load_contexts(tmp_path)
        assert first == second


# ---------------------------------------------------------------------------
# config.py — load_profiles / save_profile / delete_profile unit tests
# ---------------------------------------------------------------------------

class TestProfileFunctions:
    def test_load_profiles_returns_empty_when_no_file(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import load_profiles
        assert load_profiles() == {}

    def test_save_and_load_profile(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import save_profile, load_profiles
        assignments = [{"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True}]
        save_profile("my_layout", assignments)
        result = load_profiles()
        assert "my_layout" in result
        assert result["my_layout"]["assignments"] == assignments
        assert result["my_layout"]["num_tracks"] == 1

    def test_save_profile_overwrites_existing(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import save_profile, load_profiles
        save_profile("p", [{"stream_position": 0, "label": "old"}])
        save_profile("p", [{"stream_position": 0, "label": "new"}, {"stream_position": 1, "label": "voice"}])
        result = load_profiles()
        assert result["p"]["num_tracks"] == 2
        assert result["p"]["assignments"][0]["label"] == "new"

    def test_delete_profile_removes_entry(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import save_profile, delete_profile, load_profiles
        save_profile("to_remove", [])
        delete_profile("to_remove")
        assert "to_remove" not in load_profiles()

    def test_delete_profile_nonexistent_is_no_op(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import delete_profile, load_profiles
        delete_profile("ghost")
        assert load_profiles() == {}


# ---------------------------------------------------------------------------
# Preview cache invalidation — regression test
# ---------------------------------------------------------------------------

class TestPreviewCacheInvalidation:
    """Updating clip timing must evict the cached preview file so the next
    request regenerates it from the new offsets."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_timing_update_evicts_preview_cache(self, client, project_dir):
        """After PATCH /timing, the in-memory cache entry for that clip must be
        removed so a stale preview is never served."""
        from yuu_clip.web.routes import videos as videos_mod

        clip_id = self._first_clip_id(client)

        # Manually plant a fake preview file in the module-level cache to simulate
        # a previously generated preview.
        preview_dir = project_dir / ".yuu-clip" / "preview_cache"
        preview_dir.mkdir(parents=True, exist_ok=True)
        fake_preview = preview_dir / f"clip_{clip_id}_preview.mp4"
        fake_preview.write_bytes(b"old preview content")
        videos_mod._preview_cache[clip_id] = fake_preview

        # Update clip timing — this must evict the cache entry and delete the file.
        r = client.patch(f"/api/clips/{clip_id}/timing",
                         json={"start_offset": 2.0, "end_offset": -1.0})
        assert r.status_code == 200

        assert clip_id not in videos_mod._preview_cache, (
            "Cache entry was not evicted after timing update"
        )
        assert not fake_preview.exists(), (
            "Stale preview file was not deleted after timing update"
        )
