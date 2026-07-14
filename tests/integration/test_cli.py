"""
Smoke and behavioural tests for yuu_clip/cli.py.

Uses Typer's CliRunner so no live server or ffmpeg is required for most tests.
Tests that touch the DB use the shared `project_dir` fixture from conftest.py.
"""
from __future__ import annotations

import pytest
from typer import Exit as ClickExit  # typer.Exit is its own class since typer 0.13; test the public API
from typer.testing import CliRunner

from yuu_clip.cli import _resolve_videos, app

runner = CliRunner()


# ---------------------------------------------------------------------------
# --help smoke tests  (no DB, no ffmpeg)
# ---------------------------------------------------------------------------

class TestHelp:
    @pytest.mark.parametrize("command", [
        "probe", "analyze", "score", "export", "reel",
        "status", "clips", "serve", "retranscribe", "prefetch-model", "restore",
        "rediarize", "reextract", "retranscribe-video", "regenerate-clips",
        "prefetch-whisper", "download-gguf", "import-url",
    ])
    def test_help_exits_zero(self, command):
        result = runner.invoke(app, [command, "--help"])
        assert result.exit_code == 0, result.output

    def test_root_help(self):
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "analyze" in result.output
        assert "export" in result.output


# ---------------------------------------------------------------------------
# score: argument validation
# ---------------------------------------------------------------------------

class TestScore:
    def test_score_no_args_exits_nonzero(self, project_dir):
        result = runner.invoke(app, ["score", "--project", str(project_dir)])
        assert result.exit_code != 0
        assert "video ID" in result.output or "--all" in result.output

    def test_score_missing_video_id_exits_nonzero(self, project_dir):
        result = runner.invoke(app, ["score", "999", "--project", str(project_dir)])
        assert result.exit_code != 0
        assert "No video" in result.output

    def test_score_all_succeeds_on_empty_project(self, tmp_path):
        (tmp_path / ".yuu-clip").mkdir()
        result = runner.invoke(app, ["score", "--all", "--project", str(tmp_path)])
        # No videos, but command should complete cleanly
        assert result.exit_code == 0


# ---------------------------------------------------------------------------
# prefetch-model: downloads one Tier-B model on demand (packaging-strategy
# overhaul Wave 4) - invoked as a subprocess by POST /api/models/prefetch.
# ---------------------------------------------------------------------------

class TestPrefetchModel:
    def test_unknown_slug_exits_nonzero(self, tmp_path):
        (tmp_path / ".yuu-clip").mkdir()
        result = runner.invoke(app, ["prefetch-model", "bogus", "--project", str(tmp_path)])
        assert result.exit_code != 0
        assert "Unknown model slug" in result.output

    def test_speaker_slug_calls_the_speechbrain_prefetcher(self, tmp_path, monkeypatch):
        (tmp_path / ".yuu-clip").mkdir()
        from yuu_clip.transcribe import diarization_client
        calls = []
        monkeypatch.setattr(diarization_client, "prefetch_speechbrain_model", lambda config: calls.append(config))
        result = runner.invoke(app, ["prefetch-model", "speaker", "--project", str(tmp_path)])
        assert result.exit_code == 0, result.output
        assert len(calls) == 1
        assert "Done" in result.output

    def test_audio_event_slug_calls_the_ast_prefetcher(self, tmp_path, monkeypatch):
        (tmp_path / ".yuu-clip").mkdir()
        from yuu_clip.scoring import audio_event
        calls = []
        monkeypatch.setattr(audio_event, "prefetch_audio_event_model", lambda config: calls.append(config))
        result = runner.invoke(app, ["prefetch-model", "audio_event", "--project", str(tmp_path)])
        assert result.exit_code == 0, result.output
        assert len(calls) == 1

    def test_embeddings_slug_calls_the_fastembed_prefetcher(self, tmp_path, monkeypatch):
        (tmp_path / ".yuu-clip").mkdir()
        from yuu_clip.scoring import similarity
        calls = []
        monkeypatch.setattr(similarity, "prefetch_embeddings_model", lambda: calls.append(1))
        result = runner.invoke(app, ["prefetch-model", "embeddings", "--project", str(tmp_path)])
        assert result.exit_code == 0, result.output
        assert calls == [1]

    def test_download_failure_exits_nonzero_with_a_friendly_message(self, tmp_path, monkeypatch):
        """An offline machine must fail cleanly with a readable message, not a
        raw traceback - the message becomes the last SSE line the UI shows."""
        (tmp_path / ".yuu-clip").mkdir()
        from yuu_clip.transcribe import diarization_client

        def _boom(config):
            raise OSError("could not download model (offline)")

        monkeypatch.setattr(diarization_client, "prefetch_speechbrain_model", _boom)
        result = runner.invoke(app, ["prefetch-model", "speaker", "--project", str(tmp_path)])
        assert result.exit_code != 0
        assert "Download failed" in result.output
        assert "could not download model (offline)" in result.output


# ---------------------------------------------------------------------------
# status: output shape
# ---------------------------------------------------------------------------

class TestStatus:
    def test_status_empty_project(self, tmp_path):
        (tmp_path / ".yuu-clip").mkdir()
        result = runner.invoke(app, ["status", "--project", str(tmp_path)])
        assert result.exit_code == 0
        assert "No recordings" in result.output

    def test_status_shows_seeded_video(self, project_dir):
        result = runner.invoke(app, ["status", "--project", str(project_dir)])
        assert result.exit_code == 0
        assert "session.mkv" in result.output


# ---------------------------------------------------------------------------
# clips: listing and filtering
# ---------------------------------------------------------------------------

class TestClips:
    def test_clips_all(self, project_dir):
        result = runner.invoke(app, ["clips", "--project", str(project_dir)])
        assert result.exit_code == 0
        assert "session.mkv" in result.output

    def test_clips_empty_project(self, tmp_path):
        (tmp_path / ".yuu-clip").mkdir()
        result = runner.invoke(app, ["clips", "--project", str(tmp_path)])
        assert result.exit_code == 0
        assert "No clips" in result.output

    def test_clips_status_filter_approved(self, project_dir):
        result = runner.invoke(app, ["clips", "--project", str(project_dir), "--status", "approved"])
        assert result.exit_code == 0
        # One approved clip in the fixture; table has exactly one data row
        assert result.output.count("session.mkv") == 1

    def test_clips_status_filter_rejected(self, project_dir):
        result = runner.invoke(app, ["clips", "--project", str(project_dir), "--status", "rejected"])
        assert result.exit_code == 0
        assert result.output.count("session.mkv") == 1

    def test_clips_status_filter_unreviewed(self, project_dir):
        result = runner.invoke(app, ["clips", "--project", str(project_dir), "--status", "unreviewed"])
        assert result.exit_code == 0
        # One pending clip in the fixture
        assert result.output.count("session.mkv") == 1

    def test_clips_video_name_filter_no_match(self, project_dir):
        result = runner.invoke(app, ["clips", "--project", str(project_dir), "nonexistent_video"])
        assert result.exit_code == 0
        assert "No clips" in result.output

    def test_clips_limit_restricts_output_to_n_rows(self, project_dir):
        result = runner.invoke(app, ["clips", "--project", str(project_dir), "--limit", "1"])
        assert result.exit_code == 0
        # Fixture has 3 clips; limit 1 means the filename should appear exactly once
        assert result.output.count("session.mkv") == 1


# ---------------------------------------------------------------------------
# export: missing clip ID
# ---------------------------------------------------------------------------

class TestExport:
    def test_export_missing_clip_exits_nonzero(self, project_dir):
        result = runner.invoke(app, ["export", "9999", "--project", str(project_dir)])
        assert result.exit_code != 0
        assert "No clip" in result.output

    def test_export_invalid_retranscribe_model_exits_with_error(self, project_dir):
        result = runner.invoke(app, [
            "export", "1", "--project", str(project_dir),
            "--retranscribe", "--retranscribe-model", "invalid_model",
        ])
        assert result.exit_code != 0
        assert "Traceback" not in result.output


# ---------------------------------------------------------------------------
# retranscribe: invalid model exits cleanly (regression for unhandled ValueError)
# ---------------------------------------------------------------------------

class TestRetranscribe:
    def test_invalid_model_exits_cleanly(self, project_dir):
        result = runner.invoke(app, [
            "retranscribe", "1", "--project", str(project_dir),
            "--model", "not_a_real_model",
        ])
        assert result.exit_code != 0
        # Must be a clean error message, not a Python traceback
        assert "Traceback" not in result.output
        assert "ValueError" not in result.output

    def test_missing_clip_exits_nonzero(self, project_dir):
        result = runner.invoke(app, [
            "retranscribe", "9999", "--project", str(project_dir),
        ])
        assert result.exit_code != 0
        assert "No clip" in result.output


# ---------------------------------------------------------------------------
# reel: invalid transition
# ---------------------------------------------------------------------------

class TestReel:
    def test_invalid_transition_exits_nonzero(self, project_dir):
        result = runner.invoke(app, [
            "reel", "--project", str(project_dir), "--transition", "spinny",
        ])
        assert result.exit_code != 0
        assert "Unknown transition" in result.output

    def test_no_clips_exits_zero(self, tmp_path):
        (tmp_path / ".yuu-clip").mkdir()
        result = runner.invoke(app, ["reel", "--project", str(tmp_path)])
        assert result.exit_code == 0
        assert "No clips" in result.output


# ---------------------------------------------------------------------------
# _resolve_videos: helper unit tests (no CLI invocation needed)
# ---------------------------------------------------------------------------

class TestResolveVideos:
    def test_rejects_non_video_file(self, tmp_path):
        f = tmp_path / "readme.txt"
        f.write_text("hello")
        with pytest.raises(ClickExit):
            _resolve_videos(f)

    def test_single_video_file(self, tmp_path):
        f = tmp_path / "clip.mp4"
        f.write_bytes(b"")
        assert _resolve_videos(f) == [f]

    def test_directory_returns_sorted_videos(self, tmp_path):
        (tmp_path / "b.mkv").write_bytes(b"")
        (tmp_path / "a.mp4").write_bytes(b"")
        (tmp_path / "ignore.txt").write_text("x")
        result = _resolve_videos(tmp_path)
        assert len(result) == 2
        assert result[0].name == "a.mp4"
        assert result[1].name == "b.mkv"
