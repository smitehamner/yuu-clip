"""POST /api/whisper/prefetch + the prefetch-whisper CLI + the generalized
download-status read surface (first-run-friction Stage 6).

The speech-to-text model prefetches in the background on first launch so the
first analysis isn't a surprise wait. The route mirrors the .gguf download: an
allowlist-free single model (the configured whisper model), a duplicate guard, a
disk precheck, and registration in the shared ctx.model_downloads registry that
both the download banner and the analyze-start coordination read.

The route/CLI drive the transcription backend through the Transcriber interface
(make_transcriber -> FasterWhisperTranscriber). These tests stub subprocess_sse so
no real subprocess runs, and stub the backend's model_cached()/prefetch() so no HF
cache scan or download hits disk.
"""
from __future__ import annotations

import sys
from collections import namedtuple

import pytest
import typer
from fastapi.testclient import TestClient

from yuu_clip.cli import models as models_cli
from yuu_clip.transcribe import transcriber as transcriber_mod
from yuu_clip.transcribe.transcriber import FasterWhisperTranscriber
from yuu_clip.web.routes import llm as llm_route
from yuu_clip.web.routes import models as models_route

_WHISPER_KEY = "whisper"
_SPEAKER_KEY = "speaker"


def _set_cached(monkeypatch, value: bool):
    monkeypatch.setattr(FasterWhisperTranscriber, "model_cached", lambda self: value)


def _force_not_cached(monkeypatch):
    _set_cached(monkeypatch, False)


# -- repo-id + cache helpers (no network, no faster_whisper import) ------------

class TestWhisperRepoId:
    def test_standard_model_maps_to_systran_faster_whisper(self):
        assert transcriber_mod._whisper_repo_id("base") == "Systran/faster-whisper-base"
        assert transcriber_mod._whisper_repo_id("large-v3") == "Systran/faster-whisper-large-v3"

    def test_distil_model_maps_to_faster_distil_whisper(self):
        assert (
            transcriber_mod._whisper_repo_id("distil-large-v3")
            == "Systran/faster-distil-whisper-large-v3"
        )

    def test_cached_reflects_repo_cached(self, monkeypatch):
        from yuu_clip import hf_cache
        from yuu_clip.config import Config

        monkeypatch.setattr(hf_cache, "repo_cached", lambda repo, **k: True)
        assert FasterWhisperTranscriber(Config()).model_cached() is True
        monkeypatch.setattr(hf_cache, "repo_cached", lambda repo, **k: False)
        assert FasterWhisperTranscriber(Config()).model_cached() is False


# -- route: cache short-circuit, duplicate guard, disk precheck, command build --

class TestWhisperPrefetchRoute:
    def test_already_cached_returns_without_spawning(self, client: TestClient, monkeypatch):
        _set_cached(monkeypatch, True)

        async def fail_if_called(*a, **k):
            raise AssertionError("must not spawn a subprocess when already cached")

        monkeypatch.setattr(llm_route, "subprocess_sse", fail_if_called)
        resp = client.post("/api/whisper/prefetch")
        assert resp.status_code == 200
        assert resp.json() == {"status": "already-cached"}

    def test_duplicate_download_is_rejected(self, client: TestClient, monkeypatch):
        _force_not_cached(monkeypatch)
        client.app.state.ctx.model_downloads[_WHISPER_KEY] = "base"
        try:
            resp = client.post("/api/whisper/prefetch")
            assert resp.status_code == 409
            assert "already downloading" in resp.json()["detail"]
        finally:
            client.app.state.ctx.model_downloads.pop(_WHISPER_KEY, None)

    def test_disk_shortfall_returns_actionable_507(self, client: TestClient, monkeypatch):
        _force_not_cached(monkeypatch)

        async def fail_if_called(*a, **k):
            raise AssertionError("must not spawn a subprocess when disk is short")

        monkeypatch.setattr(llm_route, "subprocess_sse", fail_if_called)
        Usage = namedtuple("Usage", "total used free")
        monkeypatch.setattr(llm_route.shutil, "disk_usage", lambda _p: Usage(0, 0, 1_000))
        resp = client.post("/api/whisper/prefetch")
        assert resp.status_code == 507
        detail = resp.json()["detail"]
        assert "Not enough disk space" in detail
        assert "Free up space" in detail

    def test_builds_command_and_registers_then_clears_the_key(self, client, monkeypatch):
        from starlette.responses import PlainTextResponse

        _force_not_cached(monkeypatch)
        ctx = client.app.state.ctx
        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            captured["registered"] = ctx.model_downloads.get(_WHISPER_KEY)
            return PlainTextResponse("ok")

        monkeypatch.setattr(llm_route, "subprocess_sse", fake_sse)
        resp = client.post("/api/whisper/prefetch")
        assert resp.status_code == 200, resp.text
        cmd = captured["cmd"]
        assert cmd[0] == sys.executable
        assert cmd[1:4] == ["-m", "yuu_clip.cli", "prefetch-whisper"]
        assert "--project" in cmd
        # Registered while the stream is being built...
        assert captured["registered"] == ctx.config.whisper_model
        # ...and cleared once the (bodyless) response returns.
        assert _WHISPER_KEY not in ctx.model_downloads


# -- generalized download-status read surface ---------------------------------

class TestDownloadStatusWhisper:
    def test_reports_whisper_download_in_progress(self, client: TestClient, monkeypatch):
        _force_not_cached(monkeypatch)
        ctx = client.app.state.ctx
        ctx.model_downloads[_WHISPER_KEY] = "base"
        try:
            data = client.get("/api/llm/download-status").json()
            assert data["whisper_downloading"] is True
            assert data["whisper_model_id"] == "base"
            assert data["whisper_cached"] is False
            assert data["model_prefetch_disabled"] is False
        finally:
            ctx.model_downloads.pop(_WHISPER_KEY, None)

    def test_reports_cached_when_model_present(self, client: TestClient, monkeypatch):
        _set_cached(monkeypatch, True)
        data = client.get("/api/llm/download-status").json()
        assert data["whisper_cached"] is True
        assert data["whisper_downloading"] is False

    def test_reports_speaker_download_in_progress(self, client: TestClient, monkeypatch):
        import yuu_clip.transcribe.diarization_client as diar

        _force_not_cached(monkeypatch)
        monkeypatch.setattr(diar, "speechbrain_model_cached", lambda: False)
        ctx = client.app.state.ctx
        ctx.model_downloads[_SPEAKER_KEY] = "speaker"
        try:
            data = client.get("/api/llm/download-status").json()
            assert data["speaker_downloading"] is True
            assert data["speaker_cached"] is False
        finally:
            ctx.model_downloads.pop(_SPEAKER_KEY, None)


# -- speaker prefetch reuses /api/models/prefetch, registering the "speaker" key -

class TestSpeakerPrefetchRegistration:
    def test_prefetch_registers_then_clears_the_slug_key(self, client, monkeypatch):
        from starlette.responses import PlainTextResponse

        ctx = client.app.state.ctx
        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            captured["registered"] = ctx.model_downloads.get(_SPEAKER_KEY)
            return PlainTextResponse("ok")

        monkeypatch.setattr(models_route, "subprocess_sse", fake_sse)
        resp = client.post("/api/models/prefetch", params={"slug": "speaker"})
        assert resp.status_code == 200, resp.text
        assert captured["cmd"][1:5] == ["-m", "yuu_clip.cli", "prefetch-model", "speaker"]
        # Registered while the stream builds, cleared once the response returns.
        assert captured["registered"] == "speaker"
        assert _SPEAKER_KEY not in ctx.model_downloads


# -- CLI: prefetch-whisper command --------------------------------------------

class _RecordingTranscriber:
    """Stands in for a Transcriber so the CLI test drives .prefetch() without
    touching faster-whisper or the network."""

    last_prefetched_model: str | None = None
    prefetch_error: Exception | None = None

    def __init__(self, config):
        self._config = config

    def prefetch(self):
        if _RecordingTranscriber.prefetch_error is not None:
            raise _RecordingTranscriber.prefetch_error
        _RecordingTranscriber.last_prefetched_model = self._config.whisper_model


class TestPrefetchWhisperCommand:
    @pytest.fixture(autouse=True)
    def _reset(self):
        _RecordingTranscriber.last_prefetched_model = None
        _RecordingTranscriber.prefetch_error = None
        yield

    def test_invokes_prefetch_with_loaded_config(self, tmp_path, monkeypatch):
        from yuu_clip.config import Config

        monkeypatch.setattr(transcriber_mod, "make_transcriber", _RecordingTranscriber)
        models_cli.prefetch_whisper_cmd(project=tmp_path)
        assert _RecordingTranscriber.last_prefetched_model == Config.load(tmp_path).whisper_model

    def test_download_failure_exits_nonzero(self, tmp_path, monkeypatch):
        _RecordingTranscriber.prefetch_error = RuntimeError("no network")
        monkeypatch.setattr(transcriber_mod, "make_transcriber", _RecordingTranscriber)
        with pytest.raises(typer.Exit) as exc:
            models_cli.prefetch_whisper_cmd(project=tmp_path)
        assert exc.value.exit_code == 1
