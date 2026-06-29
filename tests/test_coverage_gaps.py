"""
Coverage-gap tests — Phase 2.

Targets: pure helpers that had zero tests, route guard paths that weren't
exercised, and boundary conditions on existing modules.
"""
from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# reel.py — _safe_filename
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
# reel.py — start_demo route guards
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
# reel.py — approved_clips_for_reel and list_reels
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


# ---------------------------------------------------------------------------
# scoring/routes helpers — _ms_to_hms
# ---------------------------------------------------------------------------

class TestMsToHms:
    def _fmt(self, ms):
        from yuu_clip.web.routes.scoring import _ms_to_hms
        return _ms_to_hms(ms)

    def test_zero(self):
        assert self._fmt(0) == "0:00"

    def test_under_one_minute(self):
        assert self._fmt(45_000) == "0:45"

    def test_exact_one_minute(self):
        assert self._fmt(60_000) == "1:00"

    def test_minutes_and_seconds(self):
        assert self._fmt(125_000) == "2:05"

    def test_exactly_one_hour(self):
        assert self._fmt(3_600_000) == "1:00:00"

    def test_hours_minutes_seconds(self):
        assert self._fmt(3_723_000) == "1:02:03"

    def test_large_value(self):
        # 2h 30m 15s
        ms = (2 * 3600 + 30 * 60 + 15) * 1000
        assert self._fmt(ms) == "2:30:15"


# ---------------------------------------------------------------------------
# scoring/routes helpers — _collect_transcript_segments
# ---------------------------------------------------------------------------

class TestCollectTranscriptSegments:
    def _make_db(self, tmp_path, do_transcribe=True):
        from yuu_clip.db.models import AudioTrack, Transcript, Video, make_session
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
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

    def test_no_tracks_returns_empty(self, tmp_path):
        from yuu_clip.db.models import Video, make_session
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session = make_session(tmp_path / "empty.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert result == []

    def test_non_transcribed_track_excluded(self, tmp_path):
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session, v, tx = self._make_db(tmp_path, do_transcribe=False)
        from yuu_clip.db.models import TranscriptSegment
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="hello"))
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert result == []

    def test_segments_returned_sorted_by_start_ms(self, tmp_path):
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session, v, tx = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=10_000, end_ms=15_000, text="second"))
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="first"))
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert len(result) == 2
        assert result[0].start_ms == 0
        assert result[1].start_ms == 10_000


# ---------------------------------------------------------------------------
# _shared.py — _json_list and _user_or_default
# ---------------------------------------------------------------------------

class TestJsonList:
    def _fn(self, s):
        from yuu_clip.web.routes._shared import _json_list
        return _json_list(s)

    def test_none_returns_empty(self):
        assert self._fn(None) == []

    def test_empty_string_returns_empty(self):
        assert self._fn("") == []

    def test_encoded_list_decoded(self):
        import json
        assert self._fn(json.dumps(["a", "b"])) == ["a", "b"]

    def test_encoded_empty_list(self):
        import json
        assert self._fn(json.dumps([])) == []


class TestUserOrDefault:
    def _fn(self, user_val, stored_val):
        from yuu_clip.web.routes._shared import _user_or_default
        return _user_or_default(user_val, stored_val)

    def test_user_val_wins_when_set(self):
        assert self._fn("User edit", "LLM version") == "User edit"

    def test_stored_val_used_when_no_user(self):
        assert self._fn(None, "LLM version") == "LLM version"

    def test_empty_string_user_val_wins(self):
        # Empty string is a deliberate blank, not "unset" — so it wins over stored
        assert self._fn("", "LLM version") == ""

    def test_both_none_returns_empty_string(self):
        assert self._fn(None, None) == ""

    def test_stored_none_with_no_user_returns_empty(self):
        assert self._fn(None, None) == ""


# ---------------------------------------------------------------------------
# clips.py — _srt_to_vtt
# ---------------------------------------------------------------------------

class TestSrtToVtt:
    def _convert(self, srt):
        from yuu_clip.web.routes.clips import _srt_to_vtt
        return _srt_to_vtt(srt)

    def test_webvtt_header_prepended(self):
        result = self._convert("")
        assert result.startswith("WEBVTT")

    def test_comma_converted_to_dot_in_timestamp(self):
        srt = "1\n00:00:01,500 --> 00:00:03,000\nHello\n\n"
        result = self._convert(srt)
        assert "00:00:01.500 --> 00:00:03.000" in result
        assert "," not in result.split("WEBVTT")[1]  # no commas in timestamps

    def test_cue_text_preserved(self):
        srt = "1\n00:00:01,000 --> 00:00:02,000\nHello world\n\n"
        result = self._convert(srt)
        assert "Hello world" in result

    def test_multiple_cues_converted(self):
        srt = (
            "1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n"
            "2\n00:00:03,000 --> 00:00:04,000\nSecond\n\n"
        )
        result = self._convert(srt)
        assert "First" in result
        assert "Second" in result
        assert result.count(".") >= 4  # four decimal timestamps


# ---------------------------------------------------------------------------
# analyze.py — _format_duration
# ---------------------------------------------------------------------------

class TestFormatDuration:
    def _fmt(self, seconds):
        from yuu_clip.web.routes.analyze import _format_duration
        return _format_duration(seconds)

    def test_under_60_seconds(self):
        assert self._fmt(45.0) == "45s"

    def test_exactly_60_seconds(self):
        assert self._fmt(60.0) == "1m 00s"

    def test_minutes_and_seconds(self):
        assert self._fmt(125.0) == "2m 05s"

    def test_exactly_one_hour(self):
        assert self._fmt(3600.0) == "1h 00m"

    def test_hours_and_minutes(self):
        assert self._fmt(3_900.0) == "1h 05m"

    def test_zero_seconds(self):
        assert self._fmt(0.0) == "0s"


# ---------------------------------------------------------------------------
# analyze.py — _whisper_step (zero transcribe_tracks path)
# ---------------------------------------------------------------------------

class TestWhisperStep:
    def _step(self, model="base", has_gpu=True, duration_s=3600, transcribe_tracks=1):
        from yuu_clip.web.routes.analyze import _whisper_step
        return _whisper_step(model, has_gpu, duration_s, transcribe_tracks)

    def test_zero_tracks_returns_load_captions(self):
        result = self._step(transcribe_tracks=0)
        assert result["name"] == "Load captions"
        assert result["seconds"] == 2.0
        assert result["note"] == "from file"

    def test_gpu_faster_than_cpu(self):
        gpu = self._step(model="large-v3", has_gpu=True)
        cpu = self._step(model="large-v3", has_gpu=False)
        assert gpu["seconds"] < cpu["seconds"]

    def test_more_tracks_longer(self):
        one = self._step(transcribe_tracks=1)
        two = self._step(transcribe_tracks=2)
        assert two["seconds"] > one["seconds"]


# ---------------------------------------------------------------------------
# scoring routes — regenerate_summary guards
# ---------------------------------------------------------------------------

class TestRegenerateSummaryGuards:
    def test_regenerate_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/regenerate-summary")
        assert r.status_code == 404

    def test_regenerate_400_when_no_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/regenerate-summary")
        assert r.status_code == 400
        assert "transcript" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# scoring routes — redescribe_clips LLM-unavailable guard
# ---------------------------------------------------------------------------

class TestRedescribeClipsGuard:
    def test_redescribe_503_when_llm_disabled(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/redescribe-clips")
        # Default config has ollama_enabled=True but no real backend — check_llm_available
        # returns False → 503
        assert r.status_code == 503

    def test_redescribe_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/redescribe-clips")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# scoring routes — rescore_clip 404 guard
# ---------------------------------------------------------------------------

class TestRescoreClipGuard:
    def test_rescore_clip_404_for_missing_clip(self, client):
        r = client.get("/api/clips/99999/rescore")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# config route — whisper_model patch validation
# ---------------------------------------------------------------------------

class TestConfigPatchWhisperModel:
    def test_valid_whisper_model_accepted(self, client):
        r = client.patch("/api/config", json={"whisper_model": "small"})
        assert r.status_code == 200
        assert r.json()["whisper_model"] == "small"

    def test_invalid_whisper_model_returns_400(self, client):
        r = client.patch("/api/config", json={"whisper_model": "gpt-4o"})
        assert r.status_code == 400

    def test_empty_whisper_model_returns_400(self, client):
        r = client.patch("/api/config", json={"whisper_model": ""})
        assert r.status_code == 400

    def test_scene_detection_mode_valid(self, client):
        r = client.patch("/api/config", json={"scene_detection_mode": "fast"})
        assert r.status_code == 200
        assert r.json()["scene_detection_mode"] == "fast"

    def test_scene_detection_mode_invalid(self, client):
        r = client.patch("/api/config", json={"scene_detection_mode": "magic"})
        assert r.status_code == 400

    def test_silence_threshold_below_min_returns_400(self, client):
        r = client.patch("/api/config", json={"silence_threshold_ms": 50})
        assert r.status_code == 400

    def test_scorer_weight_negative_clamped_to_zero(self, client):
        r = client.patch("/api/config", json={"scorer_llm_weight": -2.0})
        assert r.status_code == 200
        assert r.json()["scorer_llm_weight"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# scoring/routes — _config_with_context_weights
# ---------------------------------------------------------------------------

class TestConfigWithContextWeights:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_no_overrides_returns_same_config(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        result = _config_with_context_weights(cfg, {}, [])
        assert result is cfg

    def test_weight_override_applied(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        contexts = {"ctx-a": {"score_funny_weight": 3.0}}
        result = _config_with_context_weights(cfg, contexts, ["ctx-a"])
        assert result.score_funny_weight == pytest.approx(3.0)

    def test_none_weight_not_applied(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        original_funny = cfg.score_funny_weight
        contexts = {"ctx-a": {"score_funny_weight": None}}
        result = _config_with_context_weights(cfg, contexts, ["ctx-a"])
        assert result.score_funny_weight == pytest.approx(original_funny)
