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

import pytest
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
        # Path("some/dir/foo").name == "foo" - parent components are stripped
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


class TestBurnReelCaptions:
    """reel.burn_reel_captions - the final burn-in pass reuses the clip-export
    subtitles filter (so the global Caption style applies), stream-copies audio,
    and replaces the reel file in place."""

    def _run(self, tmp_path, monkeypatch, style=None):
        from pathlib import Path

        from yuu_clip import reel as reel_mod
        captured = {}

        def fake_run_ffmpeg(cmd):
            captured["cmd"] = cmd
            # Simulate ffmpeg writing the temp output so .replace() succeeds.
            out = Path(cmd[-1])
            out.write_bytes(b"burned")

        monkeypatch.setattr(reel_mod, "run_ffmpeg", fake_run_ffmpeg)
        reel = tmp_path / "reel.mkv"
        reel.write_bytes(b"original")
        srt = tmp_path / "reel.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nhi\n", encoding="utf-8")
        reel_mod.burn_reel_captions(reel, srt, style)
        return captured["cmd"], reel

    def test_vf_uses_subtitles_filter(self, tmp_path, monkeypatch):
        cmd, _ = self._run(tmp_path, monkeypatch)
        vf = cmd[cmd.index("-vf") + 1]
        assert vf.startswith("subtitles=")
        assert (tmp_path / "reel.srt").name in vf

    def test_style_becomes_force_style(self, tmp_path, monkeypatch):
        from yuu_clip.analyze.extract import CaptionStyle
        cmd, _ = self._run(tmp_path, monkeypatch, CaptionStyle(font_size=40, position="top"))
        vf = cmd[cmd.index("-vf") + 1]
        assert "force_style='FontSize=40,Alignment=8'" in vf

    def test_audio_is_stream_copied(self, tmp_path, monkeypatch):
        cmd, _ = self._run(tmp_path, monkeypatch)
        assert cmd[cmd.index("-c:a") + 1] == "copy"

    def test_replaces_reel_in_place(self, tmp_path, monkeypatch):
        _, reel = self._run(tmp_path, monkeypatch)
        assert reel.read_bytes() == b"burned"
        assert not reel.with_name("reel.burn_tmp.mkv").exists()

    def test_failed_encode_leaves_no_burn_tmp(self, tmp_path, monkeypatch):
        from pathlib import Path

        from yuu_clip import reel as reel_mod

        def failing_run_ffmpeg(cmd):
            # Simulate ffmpeg writing a partial temp then dying.
            Path(cmd[-1]).write_bytes(b"partial")
            raise RuntimeError("ffmpeg exploded")

        monkeypatch.setattr(reel_mod, "run_ffmpeg", failing_run_ffmpeg)
        reel = tmp_path / "reel.mkv"
        reel.write_bytes(b"original")
        srt = tmp_path / "reel.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nhi\n", encoding="utf-8")
        with pytest.raises(RuntimeError, match="ffmpeg exploded"):
            reel_mod.burn_reel_captions(reel, srt)
        assert not reel.with_name("reel.burn_tmp.mkv").exists()
        assert reel.read_bytes() == b"original"


class TestCompileConcat:
    """reel._compile_concat writes the ffmpeg concat-demuxer list. Filenames can
    legitimately contain an apostrophe (e.g. "Tom's stream_clip.mkv"), which the
    demuxer treats as a quote delimiter unless escaped as '\\''."""

    def test_apostrophe_in_path_is_escaped(self, tmp_path, monkeypatch):
        from pathlib import Path

        from yuu_clip import reel as reel_mod
        captured = {}

        def fake_run_ffmpeg(cmd):
            list_path = Path(cmd[cmd.index("-i") + 1])
            captured["list"] = list_path.read_text(encoding="utf-8")
            Path(cmd[-1]).write_bytes(b"concat")

        monkeypatch.setattr(reel_mod, "run_ffmpeg", fake_run_ffmpeg)
        seg = tmp_path / "Tom's stream_clip.mkv"
        seg.write_bytes(b"seg")
        reel_mod._compile_concat([seg], tmp_path / "out.mkv")
        line = captured["list"].strip()
        assert line.startswith("file '") and line.endswith("'")
        assert line.endswith(r"Tom'\''s stream_clip.mkv'")


class TestSelectClipExportFile:
    """reel._select_clip_export_file - which exported file a reel build uses when a
    clip has several per-preset formats. Must deterministically prefer the default
    (presetless) export and never silently change format between runs."""

    def _clip_and_video(self):
        import types
        clip = types.SimpleNamespace(id=1, start_hms="0:15", video_id=1)
        video = types.SimpleNamespace(filename="session.mkv")
        return clip, video

    def _select(self, export_dir):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
        from yuu_clip.reel import _select_clip_export_file
        clip, video = self._clip_and_video()
        return _select_clip_export_file(clip, video, export_dir, DEFAULT_EXPORT_NAME_TEMPLATE)

    def test_returns_none_when_no_export_files(self, tmp_path):
        assert self._select(tmp_path) is None

    def test_returns_default_export_when_only_default_exists(self, tmp_path):
        (tmp_path / "session_clip1_0-15.mp4").write_bytes(b"x")
        assert self._select(tmp_path) == tmp_path / "session_clip1_0-15.mp4"

    def test_prefers_default_over_a_preset_format(self, tmp_path):
        (tmp_path / "session_clip1_0-15.mkv").write_bytes(b"x")
        (tmp_path / "session_clip1_0-15_youtube-1080p.mp4").write_bytes(b"x")
        assert self._select(tmp_path) == tmp_path / "session_clip1_0-15.mkv"

    def test_falls_back_to_most_recent_preset_when_no_default(self, tmp_path):
        import os
        older = tmp_path / "session_clip1_0-15_discord-10mb.mp4"
        newer = tmp_path / "session_clip1_0-15_youtube-1080p.mp4"
        older.write_bytes(b"x")
        newer.write_bytes(b"x")
        os.utime(older, (1_000_000, 1_000_000))
        os.utime(newer, (2_000_000, 2_000_000))
        assert self._select(tmp_path) == newer

    def test_ignores_non_video_sidecars_with_base_prefix(self, tmp_path):
        (tmp_path / "session_clip1_0-15_youtube-1080p.srt").write_text("1\n", encoding="utf-8")
        assert self._select(tmp_path) is None


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


class TestBuildReelCaptionAss:
    """The word-highlight reel path reuses subtitles.lines_to_ass, so it produces
    the same per-word ASS as single-clip export, with word timings offset onto the
    reel timeline."""

    def _reel_with_words(self, tmp_path):
        import json

        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.reel import reel_composition_path
        session, clip_id = _seed_transcribed_project(tmp_path)
        seg = session.query(TranscriptSegment).first()
        seg.words = [
            {"text": "hello", "start_ms": 1000, "end_ms": 1400},
            {"text": "world", "start_ms": 1400, "end_ms": 2000},
        ]
        session.commit()
        reel = tmp_path / ".yuu-clip" / "reels" / "reel_x.mkv"
        reel.write_bytes(b"fake")
        reel_composition_path(reel).write_text(json.dumps({
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0,
            "clips": [{"id": clip_id, "duration_s": 5.0}],
        }), encoding="utf-8")
        return session, reel

    def test_word_highlight_reel_produces_ass_with_offset_words(self, tmp_path):
        from yuu_clip.reel import build_reel_caption_ass, reel_ass_caption_path
        session, reel = self._reel_with_words(tmp_path)

        out = build_reel_caption_ass(session, reel, chunk_size=4)
        session.close()

        assert out == reel_ass_caption_path(reel)
        ass = out.read_text(encoding="utf-8")
        assert "[Events]" in ass
        dialogues = [line for line in ass.splitlines() if line.startswith("Dialogue:")]
        assert len(dialogues) == 2  # one event per word
        # Segment starts at title_dur=3.0s, so the word at 1.0s lands at 4.0s and its
        # event runs until the next word begins (4.4s) on the reel timeline.
        assert "0:00:04.00,0:00:04.40" in ass

    def test_missing_composition_returns_none(self, tmp_path):
        from yuu_clip.reel import build_reel_caption_ass
        session, _ = _seed_transcribed_project(tmp_path)
        reel = tmp_path / ".yuu-clip" / "reels" / "noconfig.mkv"
        reel.write_bytes(b"x")
        assert build_reel_caption_ass(session, reel, chunk_size=4) is None
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
