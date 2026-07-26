"""API routes for import-from-URL (roadmap plan 08).

Split out from the pure ``test_url_import`` unit tests: these exercise the
routes through a ``TestClient`` and need the seeded project DB.

No real network calls: yt-dlp is always mocked.
"""
from __future__ import annotations

from unittest import mock


class TestImportUrlRoutes:
    def _mock_ydl(self, info: dict):
        instance = mock.MagicMock()
        instance.extract_info.return_value = info
        cm = mock.MagicMock()
        cm.__enter__.return_value = instance
        cm.__exit__.return_value = False
        return cm

    def test_inspect_rejects_unsupported_url(self, client):
        r = client.post("/api/import-url/inspect", json={"url": "https://vimeo.com/1"})
        assert r.status_code == 400

    def test_inspect_returns_metadata(self, client):
        info = {
            "title": "Great Clip", "uploader": "Streamer", "duration": 120,
            "upload_date": "20260101", "categories": ["Gaming"], "id": "vid1",
        }
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            r = client.post("/api/import-url/inspect", json={"url": "https://www.youtube.com/watch?v=vid1"})
        assert r.status_code == 200
        body = r.json()
        assert body["title"] == "Great Clip"
        assert body["already_imported"] is False

    def test_inspect_normalizes_playlist_url_before_lookup(self, client):
        info = {"title": "Great Clip", "id": "vid1"}
        messy_url = (
            "https://www.youtube.com/watch?v=vid1&list=PL123&index=3&pp=iAQB"
        )
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)) as ydl_cls:
            r = client.post("/api/import-url/inspect", json={"url": messy_url})
        assert r.status_code == 200
        called_url = ydl_cls.return_value.__enter__.return_value.extract_info.call_args[0][0]
        assert called_url == "https://www.youtube.com/watch?v=vid1"

    def test_inspect_flags_already_imported_when_stored_url_is_normalized(self, client):
        from yuu_clip.db.models import Video, make_session
        db = make_session(client.app.state.ctx.db_path)
        db.add(Video(path="x", filename="dup.mkv", status="done", source_url="https://youtu.be/dup1"))
        db.commit()
        db.close()

        info = {"title": "Dup", "id": "dup1"}
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            r = client.post("/api/import-url/inspect", json={"url": "youtu.be/dup1?si=abc"})
        assert r.status_code == 200
        assert r.json()["already_imported"] is True

    def test_inspect_flags_already_imported(self, client):
        from yuu_clip.db.models import Video, make_session
        db = make_session(client.app.state.ctx.db_path)
        db.add(Video(path="x", filename="dup.mkv", status="done", source_url="https://youtu.be/dup1"))
        db.commit()
        db.close()

        info = {"title": "Dup", "id": "dup1"}
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            r = client.post("/api/import-url/inspect", json={"url": "https://youtu.be/dup1"})
        assert r.status_code == 200
        body = r.json()
        assert body["already_imported"] is True
        assert body["existing_filename"] == "dup.mkv"

    def test_inspect_live_stream_returns_400(self, client):
        info = {"title": "Live", "id": "live1", "is_live": True}
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            r = client.post("/api/import-url/inspect", json={"url": "https://www.twitch.tv/videos/live1"})
        assert r.status_code == 400
        assert "live" in r.json()["detail"].lower()

    def test_start_rejects_unsupported_url(self, client):
        r = client.post("/api/import-url/start", json={"url": "https://vimeo.com/1"})
        assert r.status_code == 400

    def test_start_queues_command(self, client):
        r = client.post("/api/import-url/start", json={"url": "https://www.youtube.com/watch?v=vid1"})
        assert r.status_code == 200
        assert r.json()["status"] == "started"
        assert client.app.state.ctx.import_cmd is not None

    def test_start_normalizes_url_before_queuing(self, client):
        messy_url = "www.youtube.com/watch?v=vid1&list=PL123&index=3"
        r = client.post("/api/import-url/start", json={"url": messy_url})
        assert r.status_code == 200
        cmd = client.app.state.ctx.import_cmd
        assert "https://www.youtube.com/watch?v=vid1" in cmd
        assert not any("list=" in arg for arg in cmd)

    def test_start_rejected_while_another_job_is_running(self, client):
        # A second /start while a first download's SSE stream is live must not
        # silently clobber ctx.import_cmd - the frontend's streamSSE() would then
        # unconditionally supersede/abort the FIRST download's still-open stream to
        # open the second, actually killing its subprocess rather than leaving it
        # running untouched (found 2026-07-25: pasting a second URL mid-download).
        ctx = client.app.state.ctx
        ctx.active_jobs += 1
        try:
            r = client.post("/api/import-url/start", json={"url": "https://www.youtube.com/watch?v=vid1"})
            assert r.status_code == 409
            assert ctx.import_cmd is None
        finally:
            ctx.active_jobs -= 1

    def test_events_without_start_returns_400(self, client):
        r = client.get("/api/import-url/events")
        assert r.status_code == 400

    def test_events_rejected_while_another_job_is_running(self, client):
        from types import SimpleNamespace

        client.post("/api/import-url/start", json={"url": "https://www.youtube.com/watch?v=vid1"})
        original_proc = SimpleNamespace(returncode=None)
        ctx = client.app.state.ctx
        ctx.analyze_proc = original_proc

        r = client.get("/api/import-url/events")

        assert r.status_code == 409
        # Must not have launched the import and clobbered the running job's slot.
        assert ctx.analyze_proc is original_proc

    def test_status_reports_import_running_when_queued(self, client):
        # import_running flips true as soon as a download is queued (/start), even
        # before /events launches the subprocess - any_running only reflects it once
        # the SSE stream is live (active_jobs), covered by the subprocess_sse tests.
        client.post("/api/import-url/start", json={"url": "https://www.youtube.com/watch?v=vid1"})
        r = client.get("/api/status")
        assert r.json()["import_running"] is True

    def test_status_import_running_false_by_default(self, client):
        r = client.get("/api/status")
        assert r.json()["import_running"] is False

    def test_status_exposes_thermal_autopause_config(self, client):
        body = client.get("/api/status").json()
        assert isinstance(body["thermal_autopause_enabled"], bool)
        assert body["thermal_pause_c"] == client.app.state.ctx.config.thermal_pause_c

    def test_cancel_terminates_proc_and_clears_state(self, client):
        from unittest.mock import MagicMock, patch

        from yuu_clip.web import sse

        ctx = client.app.state.ctx
        client.post("/api/import-url/start", json={"url": "https://www.youtube.com/watch?v=vid1"})
        mock_proc = MagicMock()
        mock_proc.returncode = None
        mock_proc.pid = 4321
        ctx.analyze_proc = mock_proc
        ctx.analyze_proc_kind = "import"
        with patch.object(sse.sys, "platform", "win32"), patch.object(sse.subprocess, "run") as run:
            r = client.post("/api/import-url/cancel")
        assert r.status_code == 200
        assert mock_proc in ctx.cancelled_procs
        assert ctx.import_cmd is None
        assert any(c.args[0][0] == "taskkill" for c in run.call_args_list)

    def test_cancel_does_not_kill_a_different_jobs_proc(self, client):
        """A stale cancel click must not kill an unrelated running job just because
        it happens to hold the shared analyze_proc slot (bug-hunt 2.2)."""
        from unittest.mock import MagicMock, patch

        from yuu_clip.web import sse

        ctx = client.app.state.ctx
        mock_proc = MagicMock()
        mock_proc.returncode = None
        mock_proc.pid = 5555
        ctx.analyze_proc = mock_proc
        ctx.analyze_proc_kind = "frames"  # some other job owns the slot

        with patch.object(sse.subprocess, "run") as run:
            r = client.post("/api/import-url/cancel")

        assert r.status_code == 200
        assert mock_proc not in ctx.cancelled_procs
        assert run.call_count == 0
        assert ctx.analyze_proc is mock_proc  # the other job's proc survives

    def test_cancel_with_no_running_proc_is_safe(self, client):
        ctx = client.app.state.ctx
        ctx.import_cmd = ["queued"]
        r = client.post("/api/import-url/cancel")
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"
        assert ctx.import_cmd is None
        assert ctx.cancelled_procs == set()
