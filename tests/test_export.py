from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

# ---------------------------------------------------------------------------
# export_clip FFmpeg command shape — the -t duration flag must land after every
# -i input so FFmpeg treats it as an output limit. An earlier bug placed -t
# between the two inputs of the softsub branch, where it bound to the subtitle
# input and left the video uncut — exporting the entire multi-hour source.
# ---------------------------------------------------------------------------

class TestExportClipCmd:
    def _cmd(self, **overrides):
        from yuu_clip.analyze.extract import _build_clip_cmd
        args = dict(
            ffmpeg="ffmpeg",
            video_path=Path("in.mkv"),
            start_s=10.0,
            duration_s=30.0,
            output_path=Path("out.mkv"),
            reencode=False,
            subtitle_path=None,
            subtitle_track_path=None,
            audio_stream_index=None,
        )
        args.update(overrides)
        return _build_clip_cmd(**args)

    def _assert_t_after_all_inputs(self, cmd):
        last_input = max(i for i, a in enumerate(cmd) if a == "-i")
        t_positions = [i for i, a in enumerate(cmd) if a == "-t"]
        assert t_positions, "export command must limit duration with -t"
        assert all(i > last_input for i in t_positions), \
            "-t must come after every -i or FFmpeg ignores it as an output limit"

    def test_stream_copy_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd())

    def test_reencode_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd(reencode=True))

    def test_burn_in_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd(subtitle_path=Path("subs.srt")))

    def test_softsub_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd(subtitle_track_path=Path("subs.srt")))

    def test_softsub_duration_is_clip_length(self):
        cmd = self._cmd(subtitle_track_path=Path("subs.srt"), duration_s=42.0)
        assert cmd[cmd.index("-t") + 1] == "42.0"


class TestComputeExportWindow:
    """cand.start_ms/end_ms/video.duration_ms are segment-relative for a split
    recording, but video.path (the file export_clip actually opens) is always the
    untrimmed parent — segment_start_s must be added back in after clamping."""

    def _cand(self, start_ms, end_ms, *, start_offset=0.0, end_offset=0.0,
              duration_ms=None, segment_start_s=None):
        return SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms,
            start_offset=start_offset, end_offset=end_offset,
            video=SimpleNamespace(duration_ms=duration_ms, segment_start_s=segment_start_s),
        )

    def test_non_segment_video_unaffected(self):
        from yuu_clip.cli.export import _compute_export_window
        cand = self._cand(10_000, 20_000, duration_ms=600_000, segment_start_s=None)
        assert _compute_export_window(cand) == (10_000, 20_000)

    def test_split_segment_adds_segment_offset(self):
        from yuu_clip.cli.export import _compute_export_window
        # Segment starts at 300s into the parent; clip is 10-20s into the segment.
        cand = self._cand(10_000, 20_000, duration_ms=120_000, segment_start_s=300.0)
        assert _compute_export_window(cand) == (310_000, 320_000)

    def test_split_segment_clamp_uses_segment_relative_duration(self):
        from yuu_clip.cli.export import _compute_export_window
        # end_ms would exceed the 120s segment before the offset is added; clamp
        # against the segment-relative duration, then shift into parent coordinates.
        cand = self._cand(100_000, 150_000, duration_ms=120_000, segment_start_s=300.0)
        start_ms, end_ms = _compute_export_window(cand)
        assert start_ms == 400_000
        assert end_ms == 420_000  # clamped to 120_000 (segment end) + 300_000 offset


class TestVerifyExportDuration:
    def test_raises_when_output_is_full_source(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: 10800.0)
        with pytest.raises(RuntimeError, match="trim was not applied"):
            extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=30.0)

    def test_passes_within_tolerance(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: 31.5)
        extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=30.0)

    def test_unprobeable_output_is_lenient(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: None)
        extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=30.0)


class TestShareDeleteMediaServing:
    """Exports must be deletable while still being streamed (the WinError 32 fix)."""

    def test_open_shared_allows_deletion_while_open(self, tmp_path):
        from yuu_clip.web.media import _open_shared
        target = tmp_path / "clip.mkv"
        target.write_bytes(b"payload" * 1000)
        handle = _open_shared(target)
        try:
            os.unlink(target)  # must not raise even with the read handle open
            assert not target.exists()
        finally:
            handle.close()

    def test_resolve_within_rejects_traversal(self, tmp_path):
        from yuu_clip.web.media import resolve_within
        with pytest.raises(HTTPException):
            resolve_within(tmp_path, "../escape.txt")

    def test_serves_full_file(self, client, project_dir):
        body = b"abcdefgh" * 100
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(body)
        r = client.get("/media/exports/sample.mkv")
        assert r.status_code == 200
        assert r.content == body
        assert r.headers["accept-ranges"] == "bytes"

    def test_serves_single_range(self, client, project_dir):
        body = bytes(range(256)) * 10  # 2560 bytes
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(body)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=10-19"})
        assert r.status_code == 206
        assert r.headers["content-range"] == "bytes 10-19/2560"
        assert r.content == body[10:20]

    def test_unsatisfiable_range_returns_416(self, client, project_dir):
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(b"x" * 10)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=999-1099"})
        assert r.status_code == 416

    def test_missing_export_returns_404(self, client):
        assert client.get("/media/exports/nope.mkv").status_code == 404


class TestUnlinkWithRetry:
    """Deleting a just-closed export retries through the brief handle-release window."""

    def test_succeeds_after_transient_lock(self, tmp_path, monkeypatch):
        from yuu_clip.web.routes import _shared
        target = tmp_path / "clip.mkv"
        target.write_bytes(b"x")
        real_unlink = Path.unlink
        attempts = {"n": 0}

        def flaky_unlink(self, *args, **kwargs):
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise PermissionError("WinError 32")
            return real_unlink(self, *args, **kwargs)

        monkeypatch.setattr(Path, "unlink", flaky_unlink)
        monkeypatch.setattr(_shared.time, "sleep", lambda _s: None)
        _shared._unlink_with_retry(target, attempts=5, delay_s=0)
        assert attempts["n"] == 3
        assert not target.exists()

    def test_raises_after_exhausting_attempts(self, tmp_path, monkeypatch):
        from yuu_clip.web.routes import _shared
        target = tmp_path / "clip.mkv"
        target.write_bytes(b"x")

        def always_locked(self, *args, **kwargs):
            raise PermissionError("WinError 32")

        monkeypatch.setattr(Path, "unlink", always_locked)
        monkeypatch.setattr(_shared.time, "sleep", lambda _s: None)
        with pytest.raises(OSError):
            _shared._unlink_with_retry(target, attempts=3, delay_s=0)

    def test_missing_file_is_noop(self, tmp_path):
        from yuu_clip.web.routes import _shared
        _shared._unlink_with_retry(tmp_path / "gone.mkv")

    def test_delete_files_reports_locked_paths(self, tmp_path, monkeypatch):
        from yuu_clip.web.routes import _shared
        ok = tmp_path / "ok.mkv"
        ok.write_bytes(b"x")
        stuck = tmp_path / "stuck.mkv"
        stuck.write_bytes(b"x")

        real_unlink = Path.unlink

        def selective(self, *args, **kwargs):
            if self.name == "stuck.mkv":
                raise PermissionError("WinError 32")
            return real_unlink(self, *args, **kwargs)

        monkeypatch.setattr(Path, "unlink", selective)
        monkeypatch.setattr(_shared, "_unlink_with_retry",
                            lambda p: _shared.Path.unlink(p))  # single attempt, no retry/sleep
        locked = _shared._delete_files([ok, stuck])
        assert [p.name for p in locked] == ["stuck.mkv"]
        assert not ok.exists()


class TestLockedFilesError:
    """The 409 names the holding process when the Restart Manager can identify it."""

    def test_names_holding_process(self, tmp_path, monkeypatch):
        from yuu_clip.web.routes import _shared
        monkeypatch.setattr(_shared, "_locking_processes", lambda path: ["Acme Backup"])
        exc = _shared._locked_files_error([tmp_path / "clip.mkv"])
        assert exc.status_code == 409
        assert "open in: Acme Backup" in exc.detail

    def test_falls_back_when_holder_unknown(self, tmp_path, monkeypatch):
        from yuu_clip.web.routes import _shared
        monkeypatch.setattr(_shared, "_locking_processes", lambda path: [])
        exc = _shared._locked_files_error([tmp_path / "clip.mkv"])
        assert exc.status_code == 409
        assert "another program" in exc.detail

    def test_locking_processes_empty_off_windows(self, monkeypatch):
        from yuu_clip.web.routes import _shared
        monkeypatch.setattr(_shared.sys, "platform", "linux")
        assert _shared._locking_processes(Path("/tmp/x.mkv")) == []


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
        import os
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        older = reels_dir / "old_20260101.mkv"
        older.write_bytes(b"old")
        newer = reels_dir / "new_20260102.mkv"
        newer.write_bytes(b"new")
        # Set mtimes explicitly — sleeping between writes made ordering depend
        # on filesystem timestamp resolution.
        now = os.path.getmtime(newer)
        os.utime(older, (now - 60, now - 60))
        r = client.get("/api/demo/list")
        reels = r.json()
        assert len(reels) == 2
        assert reels[0]["filename"] == "new_20260102.mkv"


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

    def test_invalid_retranscribe_model_returns_400(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/batch-export?retranscribe=true&retranscribe_model=gpt-4o&min_score=1.1")
        assert r.status_code == 400

    def test_valid_retranscribe_model_passes_validation(self, client):
        vid_id = self._vid_id(client)
        # min_score=1.1 means no clips pass filter → 400 from clip check, not model validation
        for mdl in ("tiny", "base", "small", "medium", "large-v3"):
            r = client.get(f"/api/videos/{vid_id}/batch-export?retranscribe=true&retranscribe_model={mdl}&min_score=1.1")
            assert r.status_code == 400
            assert "model" not in r.text.lower()

    def test_retranscribe_false_skips_model_validation(self, client):
        vid_id = self._vid_id(client)
        # retranscribe=false with a bad model name should be fine (validation skipped)
        r = client.get(f"/api/videos/{vid_id}/batch-export?retranscribe=false&retranscribe_model=gpt-4o&min_score=1.1")
        assert r.status_code == 400
        assert "model" not in r.text.lower()


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

    def test_percent_doubled(self):
        result = self._esc("path%20with%20spaces")
        assert "%%" in result

    def test_single_quote_escaped(self):
        result = self._esc("path/with'quote")
        assert "'\\''" in result

    def test_empty_string_unchanged(self):
        assert self._esc("") == ""


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


class TestExportClipCommand:
    """Validate the ffmpeg command built by export_clip without running FFmpeg."""

    def _run_export(self, tmp_path, reencode=False, subtitle_path=None,
                    audio_stream_index=None):
        from unittest.mock import MagicMock, patch

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
             patch("yuu_clip.analyze.extract._verify_export_duration"), \
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
        from unittest.mock import MagicMock, patch

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


class TestPerLabelSrtSidecarDeletion:
    """Per-label SRT sidecars (e.g. .player_voice.srt) are removed on clip/video delete."""

    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_delete_clip_removes_per_label_srt(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        stem = f"session_clip{clip['id']}_{start_hms_dashes}"
        pv_srt = export_dir / f"{stem}.player_voice.srt"
        vc_srt = export_dir / f"{stem}.ingame_voicechat.srt"
        merged_srt = export_dir / f"{stem}.srt"
        pv_srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nHi\n\n", encoding="utf-8")
        vc_srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nHey\n\n", encoding="utf-8")
        merged_srt.write_text("1\n00:00:00,000 --> 00:00:01,000\n[Player] Hi\n\n", encoding="utf-8")

        client.delete(f"/api/clips/{clip['id']}")

        assert not pv_srt.exists(), "player_voice sidecar should have been deleted"
        assert not vc_srt.exists(), "ingame_voicechat sidecar should have been deleted"
        assert not merged_srt.exists(), "merged sidecar should have been deleted"

    def test_delete_video_removes_per_label_srts(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        srt_files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            stem = f"session_clip{c['id']}_{start_hms_dashes}"
            f = export_dir / f"{stem}.player_voice.srt"
            f.write_text("1\n00:00:00,000 --> 00:00:01,000\nSpeech\n\n", encoding="utf-8")
            srt_files.append(f)

        client.delete(f"/api/videos/{vid_id}")

        for f in srt_files:
            assert not f.exists(), f"{f.name} should have been deleted with the video"


class TestExportVideoTranscript:
    """POST /api/videos/{id}/export-transcript writes SRT next to the source file."""

    def _seed_transcript(self, project_dir):
        from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            vid = session.query(Video).first()
            track = session.query(AudioTrack).filter_by(video_id=vid.id).first()
            tx = Transcript(audio_track_id=track.id, model_name="large-v3")
            session.add(tx)
            session.flush()
            session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=2000, text="Hello world"))
            session.add(TranscriptSegment(transcript_id=tx.id, start_ms=3000, end_ms=5000, text="Second line"))
            session.commit()
            return vid.id, vid.path
        finally:
            session.close()

    def test_exports_srt_next_to_source(self, client, project_dir, tmp_path):
        vid_id, source_path = self._seed_transcript(project_dir)
        r = client.post(f"/api/videos/{vid_id}/export-transcript")
        assert r.status_code == 200, r.text
        data = r.json()
        from pathlib import Path
        srt_path = Path(data["path"])
        assert srt_path.suffix == ".srt"
        assert srt_path.stem == Path(source_path).stem
        assert srt_path.exists()
        content = srt_path.read_text(encoding="utf-8")
        assert "Hello world" in content
        assert "Second line" in content

    def test_returns_409_when_srt_exists(self, client, project_dir):
        vid_id, source_path = self._seed_transcript(project_dir)
        from pathlib import Path
        existing = Path(source_path).with_suffix(".srt")
        existing.write_text("old content", encoding="utf-8")
        r = client.post(f"/api/videos/{vid_id}/export-transcript")
        assert r.status_code == 409
        data = r.json()
        assert data["exists"] is True
        assert data["path"] == str(existing)
        assert existing.read_text(encoding="utf-8") == "old content"

    def test_overwrite_param_replaces_existing(self, client, project_dir):
        vid_id, source_path = self._seed_transcript(project_dir)
        from pathlib import Path
        existing = Path(source_path).with_suffix(".srt")
        existing.write_text("old content", encoding="utf-8")
        r = client.post(f"/api/videos/{vid_id}/export-transcript?overwrite=true")
        assert r.status_code == 200
        assert "Hello world" in existing.read_text(encoding="utf-8")

    def test_returns_400_when_no_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/export-transcript")
        assert r.status_code == 400

    def test_returns_404_for_missing_video(self, client):
        r = client.post("/api/videos/99999/export-transcript")
        assert r.status_code == 404


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


# ---------------------------------------------------------------------------
# _resolve_clip_files
# ---------------------------------------------------------------------------

class TestResolveClipFiles:
    """_resolve_clip_files locates exported clip files and probes their durations."""

    def _make_clip(self, clip_id, video_id, start_ms, start_hms):
        import unittest.mock as mock
        clip = mock.MagicMock()
        clip.id = clip_id
        clip.video_id = video_id
        clip.start_ms = start_ms
        clip.start_hms = start_hms
        return clip

    def _make_video(self, video_id, filename):
        import unittest.mock as mock
        video = mock.MagicMock()
        video.id = video_id
        video.filename = filename
        return video

    def test_raises_when_no_export_file_found(self, tmp_path):
        import pytest

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(1, 10, 0, "0:00:00")
        video = self._make_video(10, "session.mkv")
        with pytest.raises(FileNotFoundError, match="clip 1"):
            _resolve_clip_files([clip], {10: video}, tmp_path)

    def test_finds_mkv_export(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(1, 10, 0, "0-00-00")
        video = self._make_video(10, "session.mkv")
        export_file = tmp_path / "session_clip1_0-00-00.mkv"
        export_file.write_bytes(b"fake")
        with mock.patch("yuu_clip.reel._probe_fps", return_value=30.0), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=60.0):
            files, durations, fps = _resolve_clip_files([clip], {10: video}, tmp_path)
        assert files == [export_file]
        assert durations == [60.0]
        assert fps == 30.0

    def test_finds_mp4_export(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(2, 10, 0, "0-00-00")
        video = self._make_video(10, "session.mkv")
        export_file = tmp_path / "session_clip2_0-00-00.mp4"
        export_file.write_bytes(b"fake")
        with mock.patch("yuu_clip.reel._probe_fps", return_value=60.0), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=30.0):
            files, durations, fps = _resolve_clip_files([clip], {10: video}, tmp_path)
        assert files[0].suffix == ".mp4"
        assert fps == 60.0

    def test_fps_probed_only_from_first_file(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip_a = self._make_clip(1, 10, 0, "0-00-00")
        clip_b = self._make_clip(2, 10, 60_000, "0-01-00")
        video = self._make_video(10, "session.mkv")
        (tmp_path / "session_clip1_0-00-00.mkv").write_bytes(b"fake")
        (tmp_path / "session_clip2_0-01-00.mkv").write_bytes(b"fake")
        probe_fps_calls = []
        def counting_fps(path):
            probe_fps_calls.append(path)
            return 30.0
        with mock.patch("yuu_clip.reel._probe_fps", side_effect=counting_fps), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=10.0):
            _resolve_clip_files([clip_a, clip_b], {10: video}, tmp_path)
        assert len(probe_fps_calls) == 1

    def test_fps_falls_back_to_30_when_probe_fails(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(1, 10, 0, "0-00-00")
        video = self._make_video(10, "session.mkv")
        (tmp_path / "session_clip1_0-00-00.mkv").write_bytes(b"fake")
        with mock.patch("yuu_clip.reel._probe_fps", side_effect=Exception("probe failed")), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=10.0):
            _, _, fps = _resolve_clip_files([clip], {10: video}, tmp_path)
        assert fps == 30.0


class TestRefreshCaptionSidecars:
    """retranscribe --refresh-captions regenerates an existing SRT sidecar in place,
    but does nothing for a clip that was never exported (no sidecar to refresh)."""

    def _make_clip(self, speaker_label):
        import datetime
        import types
        seg = types.SimpleNamespace(
            start_ms=1_000, end_ms=2_000, text="updated text", speaker_label=speaker_label
        )
        tx = types.SimpleNamespace(
            audio_track_id=1, created_at=datetime.datetime(2024, 6, 1), segments=[seg]
        )
        track = types.SimpleNamespace(
            id=1, label="combined", do_transcribe=True, transcripts=[tx]
        )
        return types.SimpleNamespace(
            id=7, start_ms=0, end_ms=10_000, start_offset=0.0, end_offset=0.0,
            start_hms="00:00:00", clip_transcripts=[tx],
            video=types.SimpleNamespace(filename="session.mkv", audio_tracks=[track]),
        )

    def _exports_dir(self, proj_dir):
        exports = proj_dir / ".yuu-clip" / "exports"
        exports.mkdir(parents=True, exist_ok=True)
        return exports

    def test_refreshes_existing_sidecar(self, tmp_path):
        from yuu_clip.cli.export import _refresh_caption_sidecars
        exports = self._exports_dir(tmp_path)
        srt = exports / "session_clip7_00-00-00.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nstale\n\n", encoding="utf-8")

        _refresh_caption_sidecars(self._make_clip("SPEAKER_00"), tmp_path)

        content = srt.read_text(encoding="utf-8")
        assert "updated text" in content
        assert "[Speaker 00]" in content
        assert "stale" not in content

    def test_noop_when_no_sidecar_exists(self, tmp_path):
        from yuu_clip.cli.export import _refresh_caption_sidecars
        exports = self._exports_dir(tmp_path)

        _refresh_caption_sidecars(self._make_clip("SPEAKER_00"), tmp_path)

        assert list(exports.glob("*.srt")) == []
