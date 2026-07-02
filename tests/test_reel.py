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

    def test_caption_flags_default_false(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "r.mkv").write_bytes(b"x")
        entry = client.get("/api/demo/list").json()[0]
        assert entry["has_captions"] is False
        assert entry["can_caption"] is False


# ---------------------------------------------------------------------------
# Reel caption stitching (yuu_clip/reel.py) + regenerate/vtt routes
# ---------------------------------------------------------------------------

class TestSegmentStartTimes:
    def _starts(self, durations, trans_dur):
        from yuu_clip.reel import _segment_start_times
        return _segment_start_times(durations, trans_dur)

    def test_concat_offsets_are_cumulative(self):
        assert self._starts([3.0, 5.0, 3.0, 4.0], 0.0) == [0.0, 3.0, 8.0, 11.0]

    def test_xfade_overlap_pulls_each_segment_earlier(self):
        assert self._starts([3.0, 5.0], 0.5) == [0.0, 2.5]

    def test_single_segment(self):
        assert self._starts([3.0], 0.5) == [0.0]

    def test_never_negative(self):
        assert self._starts([0.2, 0.2], 0.5) == [0.0, 0.0]


def _seed_transcribed_project(tmp_path):
    """A project DB with one approved clip carrying one transcript segment.

    Returns (open session, clip_id). Caller closes the session.
    """
    from yuu_clip.db.models import (
        AudioTrack,
        ClipCandidate,
        Transcript,
        TranscriptSegment,
        Video,
        make_session,
    )
    data = tmp_path / ".yuu-clip"
    data.mkdir(exist_ok=True)
    (data / "reels").mkdir(exist_ok=True)
    session = make_session(data / "project.db")
    video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="done", duration_ms=600_000)
    session.add(video)
    session.flush()
    track = AudioTrack(video_id=video.id, stream_index=1, label="combined",
                       do_transcribe=True, do_score=True, relevance_weight=1.0)
    session.add(track)
    session.flush()
    tx = Transcript(audio_track_id=track.id, model_name="tiny", language="en")
    session.add(tx)
    session.flush()
    session.add(TranscriptSegment(transcript_id=tx.id, start_ms=1000, end_ms=2000, text="hello world"))
    clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=5000,
                         score_overall=0.6, status="approved", description="c1")
    session.add(clip)
    session.commit()
    return session, clip.id


class TestBuildReelCaptionSrt:
    def test_stitches_and_offsets_lines_by_segment_start(self, tmp_path):
        import json

        from yuu_clip.reel import build_reel_caption_srt, reel_caption_path, reel_composition_path
        session, clip_id = _seed_transcribed_project(tmp_path)
        reel = tmp_path / ".yuu-clip" / "reels" / "reel_x.mkv"
        reel.write_bytes(b"fake")
        reel_composition_path(reel).write_text(json.dumps({
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0,
            "clips": [{"id": clip_id, "duration_s": 5.0}],
        }), encoding="utf-8")

        out = build_reel_caption_srt(session, reel)
        session.close()

        assert out == reel_caption_path(reel)
        srt = out.read_text(encoding="utf-8")
        # concat (transition none): clip segment starts at title_dur=3.0s; the
        # clip-relative line at 1.0-2.0s lands at 4.0-5.0s on the reel timeline.
        assert "00:00:04,000 --> 00:00:05,000" in srt
        assert "hello world" in srt

    def test_missing_composition_returns_none(self, tmp_path):
        from yuu_clip.reel import build_reel_caption_srt
        session, _ = _seed_transcribed_project(tmp_path)
        reel = tmp_path / ".yuu-clip" / "reels" / "noconfig.mkv"
        reel.write_bytes(b"x")
        assert build_reel_caption_srt(session, reel) is None
        session.close()


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
