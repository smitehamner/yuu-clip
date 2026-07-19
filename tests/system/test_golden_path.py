"""The one opt-in golden path: the core loop on a real clip with real models.

Everything else in ``tests/system`` stubs Whisper and the LLM for determinism.
This single test proves the *wiring* end to end with the real backends - real
faster-whisper (``tiny``) transcription and a real local llama.cpp LLM - so a
break in how the pipeline hands audio to Whisper or clips to the scorer is caught
by something, not only by a manual pre-release walk (UC-B01 / UC-B05).

It is opt-in and env-gated, and **excluded from every default run** (marked
``golden``; ``yuu-dev test-system`` runs ``-m "not golden"``). Run it deliberately
with ``yuu-dev test-golden`` / ``scripts/test-golden.ps1``.

Inputs come from the environment so no media or model weights are committed:

- ``YUU_GOLDEN_CLIP``     - path to a short recording that contains real speech.
- ``YUU_GOLDEN_LLM_MODEL``- path to a real text ``.gguf`` model file.

The test **skips** (never fails) when an input, ffmpeg, the Whisper model, or a
runnable local LLM is missing, so it is safe to leave in the tree. It asserts
*structure only* - a clip exists, a transcript is non-empty, a description is
present, an export file lands on disk - never exact model output, which is
non-deterministic.
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import pytest

from tests.system.conftest import export_clip_file, open_session

pytestmark = pytest.mark.golden


# Real backends on; the same offline/deterministic scaffolding the stubbed tier
# uses (no diarization, no audio-event download, transcript-mode laughter, no
# visual candidates) so the only *real* moving parts are Whisper + the LLM.
_GOLDEN_CONFIG = {
    "diarization_backend": "null",
    "scorer_audio_event_enabled": False,
    "scorer_laugh_mode": "transcript",
    "visual_candidate_mode": "off",
    "whisper_model": "tiny",
    "llm_backend": "llamacpp",
    "llm_enabled": True,
    "ai_privacy_mode": "local_only",
    "vision_enabled": False,
}


def _require_env_path(var: str, what: str) -> Path:
    raw = os.environ.get(var, "").strip()
    if not raw:
        pytest.skip(f"{var} is not set - point it at {what} to run the golden path")
    path = Path(raw)
    if not path.exists():
        pytest.skip(f"{var}={raw} does not exist - point it at {what}")
    return path


def _skip_unless_llm_runs(config) -> None:
    """Skip unless a real local LLM is configured AND actually answers a prompt.

    ``available()`` covers the cheap checks (model file present, server binary
    resolvable); a tiny real completion is the only proof the server actually
    starts and responds. Warming it here also means the analyze step reuses the
    same pooled server rather than paying the startup cost twice.
    """
    from yuu_clip.scoring.llm_client import make_client

    client = make_client(config)
    ok, reason = client.available()
    if not ok:
        pytest.skip(f"local LLM unavailable: {reason}")
    try:
        client.chat([{"role": "user", "content": "Reply with the single word: ok."}], max_tokens=8)
    except Exception as exc:  # server couldn't start / respond - skip, don't fail
        pytest.skip(f"local LLM did not respond (is llama-server runnable?): {exc}")


def _skip_unless_whisper_ready(config) -> None:
    from yuu_clip.transcribe.transcriber import make_transcriber

    transcriber = make_transcriber(config)
    ok, reason = transcriber.available()
    if not ok:
        pytest.skip(f"Whisper backend unavailable: {reason}")
    if transcriber.model_cached():
        return
    try:  # first golden run downloads tiny (~75 MB); skip gracefully if offline
        transcriber.prefetch()
    except Exception as exc:
        pytest.skip(f"Whisper model '{config.whisper_model}' not cached and could not download: {exc}")


def _seed_golden_project(tmp_path: Path, clip: Path, model: Path) -> tuple[Path, str]:
    project_dir = tmp_path / "golden_project"
    data = project_dir / ".yuu-clip"
    data.mkdir(parents=True, exist_ok=True)
    config_dict = {**_GOLDEN_CONFIG, "llm_model_path": str(model)}
    (data / "config.json").write_text(json.dumps(config_dict, indent=2), encoding="utf-8")
    clip_name = f"golden_source{clip.suffix}"
    shutil.copy(clip, project_dir / clip_name)
    return project_dir, clip_name


def _run_real_analyze(project_dir: Path, clip_name: str) -> int:
    from yuu_clip.config import Config, project_audio_dir, project_proxies_dir
    from yuu_clip.db.models import Video
    from yuu_clip.pipeline import AnalyzeOptions, analyze_one

    config = Config.load(project_dir)
    session = open_session(project_dir)
    try:
        analyze_one(
            project_dir / clip_name, session, config,
            project_audio_dir(project_dir), AnalyzeOptions(non_interactive=True),
            proxy_dir=project_proxies_dir(project_dir),
        )
        return session.query(Video).filter_by(parent_video_id=None).first().id
    finally:
        session.close()


def test_golden_path_real_models(tmp_path: Path) -> None:
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not on PATH - the golden path needs real ffmpeg")
    clip = _require_env_path("YUU_GOLDEN_CLIP", "a short recording with real speech")
    model = _require_env_path("YUU_GOLDEN_LLM_MODEL", "a real text .gguf model")

    from yuu_clip.config import Config

    project_dir, clip_name = _seed_golden_project(tmp_path, clip, model)
    config = Config.load(project_dir)
    _skip_unless_whisper_ready(config)
    _skip_unless_llm_runs(config)

    video_id = _run_real_analyze(project_dir, clip_name)

    from fastapi.testclient import TestClient

    from yuu_clip.web.app import create_app

    with TestClient(create_app(project_dir)) as client:
        clips = client.get(f"/api/videos/{video_id}/clips").json()
        assert clips, (
            "real analysis produced no clips - use a longer clip with sustained speech "
            "(the default windower needs a >= 15 s spoken span)"
        )
        detail = client.get(f"/api/clips/{clips[0]['id']}").json()

    # Structure only - real model output is non-deterministic, so never assert text.
    assert detail["transcript_excerpt"].strip(), "real Whisper produced an empty transcript"
    assert any(
        (c.get("description") or "").strip() for c in clips
    ), "no clip received a real LLM description"

    session, _cand, exports_dir = export_clip_file(project_dir, clips[0]["id"])
    session.close()
    # The golden source may be any container, so assert a media file landed
    # rather than pinning an extension (the .srt sidecar is not the export).
    media_files = [p for p in exports_dir.iterdir() if p.is_file() and p.suffix != ".srt"]
    assert media_files, "export produced no media file on disk"
