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

Pure filename sanitisation, segment timing, caption burn-in/concat, clip-file
selection, and caption stitching moved to tests/unit/test_reel.py.
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
        # clear_cmd_attr="demo_cmd" - the queued command is consumed exactly once
        assert ctx.demo_cmd is None
        # subprocess_sse resets analyze_proc in its finally block
        assert ctx.analyze_proc is None

    def test_events_reports_nonzero_exit_before_done(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [sys.executable, "-c", "import sys; sys.exit(3)"]
        messages = _drain_sse(client)
        assert any(isinstance(m, str) and "exited with code 3" in m for m in messages)
        # A non-zero exit ends with the failure sentinel, not a bare "__DONE__", so the
        # frontend routes it to its error path instead of reporting the reel complete.
        done = messages[-1]
        assert isinstance(done, dict) and done["type"] == "__DONE__" and done["ok"] is False
        assert ctx.demo_cmd is None

    def test_events_rejected_while_analyze_is_queued_but_not_yet_launched(self, client):
        # bug-hunt 2.5: /api/analyze/start only sets ctx.analyze_cmd - the analyze
        # job itself doesn't launch until /api/analyze/events connects. That window
        # must still count as busy, or a reel start slipping in during it would run
        # alongside the analyze that launches a moment later.
        ctx = client.app.state.ctx
        ctx.demo_cmd = [sys.executable, "-c", "print('ok')"]
        ctx.analyze_cmd = [sys.executable, "-m", "yuu_clip.cli"]
        r = client.get("/api/demo/events")
        assert r.status_code == 409
        # Rejected before launch - the queued reel command is untouched.
        assert ctx.demo_cmd is not None


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
        # conftest seeds one approved clip - reject it first so none remain approved
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

    def test_statuses_param_filters_correctly(self, client):
        # conftest seeds 1 pending, 1 approved, 1 rejected clip
        r = client.get("/api/demo/approved-clips?statuses=pending")
        assert r.status_code == 200
        clips = r.json()
        assert len(clips) == 1
        assert clips[0]["status"] == "pending"

    def test_statuses_param_accepts_comma_separated_list(self, client):
        r = client.get("/api/demo/approved-clips?statuses=approved,rejected")
        assert r.status_code == 200
        statuses = {c["status"] for c in r.json()}
        assert statuses == {"approved", "rejected"}

    def test_invalid_status_returns_400(self, client):
        r = client.get("/api/demo/approved-clips?statuses=bogus")
        assert r.status_code == 400

    def test_default_statuses_unchanged(self, client):
        r = client.get("/api/demo/approved-clips")
        assert r.status_code == 200
        clips = r.json()
        assert len(clips) == 1
        assert clips[0]["status"] == "approved"


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

    def test_caption_flags_default_false(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "r.mkv").write_bytes(b"x")
        entry = client.get("/api/demo/list").json()[0]
        assert entry["has_captions"] is False
        assert entry["can_caption"] is False

    def _write_reel(self, project_dir, name, clip_ids):
        import json as _json
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        reel = reels_dir / name
        reel.write_bytes(b"x")
        reel.with_suffix(".reel.json").write_text(
            _json.dumps({"version": 1, "clips": [{"id": cid, "duration_s": 5.0} for cid in clip_ids]}),
            encoding="utf-8",
        )
        return reel

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_stale_none_when_no_composition_manifest(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "legacy.mkv").write_bytes(b"x")
        entry = client.get("/api/demo/list").json()[0]
        assert entry["stale"] is None

    def test_stale_false_when_member_clip_exported_before_reel_built(self, client, project_dir):
        from datetime import datetime, timedelta, timezone

        from yuu_clip.db.models import ClipCandidate, make_session

        clip_id = self._first_clip_id(client)
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        db.get(ClipCandidate, clip_id).exported_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
        db.close()

        self._write_reel(project_dir, "fresh.mkv", [clip_id])

        entry = client.get("/api/demo/list").json()[0]
        assert entry["stale"] is False

    def test_stale_true_when_member_clip_reexported_after_reel_built(self, client, project_dir):
        from datetime import datetime, timedelta, timezone

        from yuu_clip.db.models import ClipCandidate, make_session

        clip_id = self._first_clip_id(client)
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        db.get(ClipCandidate, clip_id).exported_at = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        db.close()

        self._write_reel(project_dir, "outdated.mkv", [clip_id])

        entry = client.get("/api/demo/list").json()[0]
        assert entry["stale"] is True

    def test_stale_true_when_member_clip_export_deleted(self, client, project_dir):
        clip_id = self._first_clip_id(client)  # never exported: exported_at is None
        self._write_reel(project_dir, "orphaned.mkv", [clip_id])

        entry = client.get("/api/demo/list").json()[0]
        assert entry["stale"] is True

    def test_stale_true_when_member_clip_row_deleted(self, client, project_dir):
        self._write_reel(project_dir, "ghost.mkv", [999999])

        entry = client.get("/api/demo/list").json()[0]
        assert entry["stale"] is True

    def test_corrupt_composition_manifest_does_not_break_the_list(self, client, project_dir):
        from yuu_clip.reel import reel_composition_path

        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        reel = reels_dir / "damaged.mkv"
        reel.write_bytes(b"x")
        reel_composition_path(reel).write_text('{"clips": [truncated', encoding="utf-8")

        resp = client.get("/api/demo/list")
        assert resp.status_code == 200
        entry = resp.json()[0]
        assert entry["stale"] is None


class TestDeleteReel:
    def _make_reel(self, project_dir, name="del_me.mkv", with_sidecars=False):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        reel = reels_dir / name
        reel.write_bytes(b"fake")
        if with_sidecars:
            reel.with_suffix(".srt").write_text("1\n", encoding="utf-8")
            reel.with_suffix(".reel.json").write_text("{}", encoding="utf-8")
        return reel

    def test_delete_removes_file(self, client, project_dir):
        reel = self._make_reel(project_dir)
        r = client.delete("/api/demo/del_me.mkv")
        assert r.status_code == 200
        assert r.json()["deleted"] == "del_me.mkv"
        assert not reel.exists()

    def test_delete_removes_caption_and_composition_sidecars(self, client, project_dir):
        reel = self._make_reel(project_dir, with_sidecars=True)
        r = client.delete("/api/demo/del_me.mkv")
        assert r.status_code == 200
        assert not reel.exists()
        assert not reel.with_suffix(".srt").exists()
        assert not reel.with_suffix(".reel.json").exists()

    def test_delete_missing_reel_404(self, client):
        r = client.delete("/api/demo/nope.mkv")
        assert r.status_code == 404

    def test_deleted_reel_gone_from_list(self, client, project_dir):
        self._make_reel(project_dir, name="keep.mkv")
        self._make_reel(project_dir, name="gone.mkv")
        client.delete("/api/demo/gone.mkv")
        names = [x["filename"] for x in client.get("/api/demo/list").json()]
        assert names == ["keep.mkv"]


class TestReelCaptionRoutes:
    def _approved_clip_id(self, client) -> int:
        vid = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid}/clips").json()
        return next(c["id"] for c in clips if c["status"] == "approved")

    def _make_reel(self, project_dir, name="reel_x.mkv", composition=None):
        import json
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        reel = reels_dir / name
        reel.write_bytes(b"fake")
        if composition is not None:
            reel.with_suffix(".reel.json").write_text(json.dumps(composition), encoding="utf-8")
        return reel

    def test_start_passes_captions_flag(self, client):
        vid = client.get("/api/videos").json()[0]["id"]
        r = client.post("/api/demo/start", json={"video_id": vid, "transition": "fade", "captions": True})
        assert r.status_code == 200
        assert "--captions" in client.app.state.ctx.demo_cmd

    def test_start_omits_captions_flag_by_default(self, client):
        vid = client.get("/api/videos").json()[0]["id"]
        r = client.post("/api/demo/start", json={"video_id": vid, "transition": "fade"})
        assert r.status_code == 200
        assert "--captions" not in client.app.state.ctx.demo_cmd

    def test_start_bake_captions_uses_bake_flag_not_captions(self, client):
        vid = client.get("/api/videos").json()[0]["id"]
        r = client.post("/api/demo/start", json={
            "video_id": vid, "transition": "fade", "captions": True, "bake_captions": True,
        })
        assert r.status_code == 200
        cmd = client.app.state.ctx.demo_cmd
        assert "--bake-captions" in cmd
        assert "--captions" not in cmd  # bake-captions builds the sidecar itself

    def test_start_bake_with_word_highlight_passes_flags(self, client):
        vid = client.get("/api/videos").json()[0]["id"]
        r = client.post("/api/demo/start", json={
            "video_id": vid, "transition": "fade", "bake_captions": True,
            "word_highlight": True, "word_chunk_size": 6,
        })
        assert r.status_code == 200
        cmd = client.app.state.ctx.demo_cmd
        assert "--word-highlight" in cmd
        assert cmd[cmd.index("--word-chunk-size") + 1] == "6"

    def test_start_sidecar_captions_ignores_word_highlight(self, client):
        vid = client.get("/api/videos").json()[0]["id"]
        r = client.post("/api/demo/start", json={
            "video_id": vid, "transition": "fade", "captions": True, "word_highlight": True,
        })
        assert r.status_code == 200
        assert "--word-highlight" not in client.app.state.ctx.demo_cmd

    def test_regenerate_without_composition_409(self, client, project_dir):
        self._make_reel(project_dir)
        r = client.post("/api/demo/reel_x.mkv/captions")
        assert r.status_code == 409
        assert "rebuild" in r.json()["detail"].lower()

    def test_regenerate_missing_reel_404(self, client):
        r = client.post("/api/demo/nope.mkv/captions")
        assert r.status_code == 404

    def test_regenerate_with_composition_reports_captions(self, client, project_dir):
        cid = self._approved_clip_id(client)
        self._make_reel(project_dir, composition={
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0,
            "clips": [{"id": cid, "duration_s": 5.0}],
        })
        r = client.post("/api/demo/reel_x.mkv/captions")
        assert r.status_code == 200
        assert r.json()["has_captions"] is True
        entry = next(x for x in client.get("/api/demo/list").json() if x["filename"] == "reel_x.mkv")
        assert entry["has_captions"] is True
        assert entry["can_caption"] is True

    def test_vtt_without_srt_404(self, client, project_dir):
        self._make_reel(project_dir, composition={
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0, "clips": [],
        })
        r = client.get("/api/demo/reel_x.mkv/captions.vtt")
        assert r.status_code == 404

    def test_vtt_served_after_regenerate(self, client, project_dir):
        cid = self._approved_clip_id(client)
        self._make_reel(project_dir, composition={
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0,
            "clips": [{"id": cid, "duration_s": 5.0}],
        })
        client.post("/api/demo/reel_x.mkv/captions")
        r = client.get("/api/demo/reel_x.mkv/captions.vtt")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/vtt")
        assert r.text.startswith("WEBVTT")
