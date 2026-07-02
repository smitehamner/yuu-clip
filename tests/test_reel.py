"""
Highlight reel routes (yuu_clip/web/routes/reel.py): start/list/approved-clips
guards, filename sanitisation, and the SSE endpoint.

SSE notes (demo_events, the "reel_events" path flagged in ROADMAP "Known
issues"):

demo_events forwards ctx to subprocess_sse so the running process is tracked on
ctx.analyze_proc (for /api/status and graceful shutdown) and the queued
demo_cmd is cleared when the stream finishes. That ctx-passing path had no
coverage and was silently broken before the Phase 3 bug-hunt pass.

The command is stubbed with a trivial cross-platform process rather than the
real reel CLI: the path under test is the route + SSE wiring + ctx lifecycle,
which is identical regardless of what the subprocess does, and a stub keeps the
test deterministic and ffmpeg-free.
"""
from __future__ import annotations

import json
import sys

from fastapi.testclient import TestClient


def _drain_sse(client: TestClient) -> list:
    messages = []
    with client.stream("GET", "/api/demo/events") as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        for raw in resp.iter_lines():
            if raw.startswith("data: "):
                messages.append(json.loads(raw[len("data: "):]))
    return messages


class TestDemoEventsSSE:
    def test_events_without_queued_demo_returns_400(self, client):
        r = client.get("/api/demo/events")
        assert r.status_code == 400
        assert "start" in r.json()["detail"].lower()

    def test_events_streams_subprocess_output_then_done(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [
            sys.executable, "-c",
            "print('reel progress 1'); print('reel progress 2')",
        ]
        messages = _drain_sse(client)
        assert "reel progress 1" in messages
        assert "reel progress 2" in messages
        assert messages[-1] == "__DONE__"

    def test_events_clears_queued_cmd_and_proc_on_success(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [sys.executable, "-c", "print('ok')"]
        _drain_sse(client)
        # clear_cmd_attr="demo_cmd" — the queued command is consumed exactly once
        assert ctx.demo_cmd is None
        # subprocess_sse resets analyze_proc in its finally block
        assert ctx.analyze_proc is None

    def test_events_reports_nonzero_exit_before_done(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [sys.executable, "-c", "import sys; sys.exit(3)"]
        messages = _drain_sse(client)
        assert any("exited with code 3" in m for m in messages)
        assert messages[-1] == "__DONE__"
        assert ctx.demo_cmd is None


# ---------------------------------------------------------------------------
# _safe_filename
# ---------------------------------------------------------------------------

class TestSafeFilename:
    def _fn(self, name, default="highlights.mkv"):
        from yuu_clip.web.routes.reel import _safe_filename
        return _safe_filename(name, default)

    def test_plain_name_returned_unchanged(self):
        assert self._fn("myhighlights.mkv") == "myhighlights.mkv"

    def test_path_traversal_stripped(self):
        result = self._fn("../../etc/evil")
        assert "/" not in result
        assert "\\" not in result
        assert result == "evil"

    def test_empty_string_returns_default(self):
        assert self._fn("", default="highlights.mkv") == "highlights.mkv"

    def test_directory_component_stripped_leaving_last_part(self):
        # Path("some/dir/foo").name == "foo" — parent components are stripped
        assert self._fn("some/dir/foo") == "foo"

    def test_windows_path_stripped(self):
        # pathlib.Path normalises \ to / on Windows; Path("C:\\evil.mkv").name == "evil.mkv"
        from pathlib import Path
        result = self._fn("C:\\evil.mkv")
        assert result == Path("C:\\evil.mkv").name


# ---------------------------------------------------------------------------
# start_demo route guards
# ---------------------------------------------------------------------------

class TestStartDemo:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_unknown_transition_returns_400(self, client):
        vid_id = self._vid_id(client)
        r = client.post("/api/demo/start", json={"video_id": vid_id, "transition": "wipe"})
        assert r.status_code == 400
        assert "transition" in r.json()["detail"].lower()

    def test_no_approved_clips_returns_400(self, client):
        # conftest seeds one approved clip — reject it first so none remain approved
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        for c in clips:
            if c["status"] == "approved":
                client.post(f"/api/clips/{c['id']}/status", json={"status": "rejected"})
        r = client.post("/api/demo/start", json={"video_id": vid_id, "transition": "fade"})
        assert r.status_code == 400
        assert "No approved clips" in r.json()["detail"]

    def test_valid_request_returns_started(self, client):
        # conftest seeds one approved clip, so this should succeed
        vid_id = self._vid_id(client)
        r = client.post("/api/demo/start", json={"video_id": vid_id, "transition": "fade"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "started"
        assert d["clip_count"] >= 1
        assert d["output_name"].endswith(".mkv")

    def test_output_name_sanitised(self, client):
        vid_id = self._vid_id(client)
        r = client.post("/api/demo/start", json={
            "video_id": vid_id,
            "transition": "fade",
            "output_name": "../../bad",
        })
        assert r.status_code == 200
        # The path component is stripped; result must not contain parent traversal
        assert "/" not in r.json()["output_name"]
        assert "\\" not in r.json()["output_name"]

    def test_mkv_extension_appended_when_missing(self, client):
        vid_id = self._vid_id(client)
        r = client.post("/api/demo/start", json={
            "video_id": vid_id,
            "transition": "fade",
            "output_name": "my_reel",
        })
        assert r.status_code == 200
        assert r.json()["output_name"].endswith(".mkv")

    def test_clip_ids_path_uses_specific_clips(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        approved_ids = [c["id"] for c in clips if c["status"] == "approved"]
        r = client.post("/api/demo/start", json={"clip_ids": approved_ids, "transition": "fade"})
        assert r.status_code == 200
        assert r.json()["clip_count"] == len(approved_ids)


# ---------------------------------------------------------------------------
# approved_clips_for_reel and list_reels
# ---------------------------------------------------------------------------

class TestApprovedClipsForReel:
    def test_returns_approved_clips_only(self, client):
        r = client.get("/api/demo/approved-clips")
        assert r.status_code == 200
        clips = r.json()
        # conftest seeds exactly 1 approved clip
        assert len(clips) == 1
        assert "has_export" in clips[0]
        assert "description" in clips[0]
        assert "start_hms" in clips[0]
        assert "duration_ms" in clips[0]

    def test_filter_by_video_id(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/demo/approved-clips?video_id={vid_id}")
        assert r.status_code == 200
        # Same result as without filter since there's only one video
        assert len(r.json()) == 1

    def test_filter_by_nonexistent_video_returns_empty(self, client):
        r = client.get("/api/demo/approved-clips?video_id=99999")
        assert r.status_code == 200
        assert r.json() == []


class TestListReels:
    def test_empty_when_no_reels_dir(self, client):
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        assert r.json() == []

    def test_reel_file_appears_in_list(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "highlights_20250101_120000.mkv").write_bytes(b"fake")
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        reels = r.json()
        assert len(reels) == 1
        assert reels[0]["filename"] == "highlights_20250101_120000.mkv"
        assert "url" in reels[0]
        assert "size_mb" in reels[0]
        assert "date" in reels[0]
        assert "mtime" not in reels[0]  # must be stripped before response

    def test_non_mkv_files_excluded(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "notes.txt").write_bytes(b"text")
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        assert r.json() == []
