"""Fixtures for the full-stack system tier (``tests/system/``).

The system tests drive the *real* analyze pipeline (``pipeline.analyze_one``,
i.e. the CLI's ``_analyze_one``/``_run_scoring`` path) against a disposable
project and a tiny ffmpeg-generated fixture video, then exercise the rest of a
use case through the FastAPI ``TestClient``. Real ffmpeg, real DB, real routes,
real energy/scenes/laugh/visual scoring; only two seams are stubbed, per the
e2e-use-cases plan:

- ``yuu_clip.transcribe.whisper_runner.transcribe_track`` -> canned deterministic
  transcript segments (no Whisper model, no network).
- The LLM client behind ``scoring.llm_client.make_client`` -> canned scores +
  descriptions (no llama-server, no network).

Determinism rules (global standards): no real network, no real models, fixed
timestamps, cleanup via fixture teardown, exact-match assertions on the parts we
control (durations, file existence, flag booleans, sidecar contents).

The fixture video is *generated* (ffmpeg ``lavfi``) rather than committed, so
nothing binary lives in the repo; the whole tier guard-skips when ffmpeg is
absent.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Iterator, Optional

import pytest
from fastapi.testclient import TestClient

from tests.system import _stubs

# ---------------------------------------------------------------------------
# Fixture video (ffmpeg lavfi) - generated once per session, never committed.
# ---------------------------------------------------------------------------

FIXTURE_VIDEO_NAME = "system_fixture.mkv"
# 16:9 so the 9:16 vertical-export path crops (rather than letterboxes); long
# enough that two >= min_clip_ms (15 s) windows form from the canned transcript.
_VIDEO_DURATION_S = 60
_VIDEO_SIZE = "426x240"
_VIDEO_RATE = 10
_AUDIO_RATE = 16000


def _ffmpeg_or_skip() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        pytest.skip("ffmpeg not on PATH - the system tier needs real ffmpeg")
    return ffmpeg


@pytest.fixture(scope="session")
def fixture_video(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A tiny synthetic AV clip (testsrc video + sine audio) built once per run."""
    ffmpeg = _ffmpeg_or_skip()
    dest = tmp_path_factory.mktemp("system_media") / FIXTURE_VIDEO_NAME
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"testsrc=duration={_VIDEO_DURATION_S}:size={_VIDEO_SIZE}:rate={_VIDEO_RATE}",
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={_VIDEO_DURATION_S}:sample_rate={_AUDIO_RATE}",
        "-ac", "1", "-shortest", "-pix_fmt", "yuv420p",
        # Force a keyframe every second so stream-copy exports cut accurately at
        # arbitrary window starts (a real recording has regular keyframes; testsrc
        # otherwise gets a sparse GOP and mid-file cuts run long).
        "-c:v", "libx264", "-force_key_frames", "expr:gte(t,n_forced*1)",
        "-c:a", "aac", str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not dest.exists():
        pytest.skip(f"ffmpeg could not generate the fixture video: {result.stderr[-400:]}")
    return dest


# ---------------------------------------------------------------------------
# The two stubbed seams (defined in _stubs; installed here for every test).
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def system_stubs(monkeypatch: pytest.MonkeyPatch) -> None:
    """Install the two stubbed seams for every system test.

    ``transcribe_track`` is patched at its home module (ingest imports it lazily
    inside the transcribe stage, so the module-attribute patch is seen); the LLM
    seam is patched by swapping the ``llamacpp`` backend class the real
    ``make_client`` factory looks up, so all AI-privacy gating still runs. The
    active transcript is reset so an override in one test never leaks into another.
    """
    import yuu_clip.scoring.llm_client as llm_client
    import yuu_clip.transcribe.whisper_runner as whisper_runner

    _stubs.reset_transcript()
    monkeypatch.setattr(whisper_runner, "transcribe_track", _stubs.fake_transcribe_track)
    monkeypatch.setitem(llm_client._BACKEND_CLIENTS, "llamacpp", _stubs.FakeLLMClient)


# ---------------------------------------------------------------------------
# Disposable project + analyze driver.
# ---------------------------------------------------------------------------

# Project config overrides that keep analyze deterministic and offline: no
# diarization (no speechbrain), no audio-event model download, no visual
# candidates (so the clip set is exactly the transcript windows), transcript-mode
# laughter (model-free). llm_enabled stays on so the stubbed client scores.
_SYSTEM_CONFIG = {
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


@pytest.fixture()
def system_project(tmp_path: Path, fixture_video: Path) -> Path:
    """A fresh disposable project dir: the fixture video copied in + a config.json
    with the deterministic overrides both the pipeline and the app read."""
    project_dir = tmp_path / "project"
    data = project_dir / ".yuu-clip"
    data.mkdir(parents=True, exist_ok=True)
    (data / "config.json").write_text(json.dumps(_SYSTEM_CONFIG, indent=2), encoding="utf-8")
    shutil.copy(fixture_video, project_dir / FIXTURE_VIDEO_NAME)
    return project_dir


def open_session(project_dir: Path):
    """A DB session on the project's SQLite file, for direct engine/ORM access."""
    from yuu_clip.config import project_db_path
    from yuu_clip.db.models import make_session
    return make_session(project_db_path(project_dir))


def run_analyze(project_dir: Path, *, context_names: Optional[list[str]] = None) -> int:
    """Drive the real per-video analyze pipeline against the fixture video.

    Returns the created Video id. Uses ``pipeline.analyze_one`` (the CLI's
    ``_analyze_one``) so this exercises inspect -> extract -> (stubbed) transcribe
    -> generate clips -> energy/scenes/visual -> (stubbed) LLM score as one flow.
    """
    from yuu_clip.config import Config, project_audio_dir, project_proxies_dir
    from yuu_clip.contexts import format_context_block, load_contexts
    from yuu_clip.pipeline import AnalyzeOptions, analyze_one

    config = Config.load(project_dir)
    audio_dir = project_audio_dir(project_dir)
    context_text = (
        format_context_block(load_contexts(project_dir), context_names) if context_names else ""
    )
    opts = AnalyzeOptions(
        non_interactive=True,
        context_names=list(context_names or []),
        context_text=context_text,
    )
    session = open_session(project_dir)
    try:
        analyze_one(
            project_dir / FIXTURE_VIDEO_NAME, session, config, audio_dir, opts,
            proxy_dir=project_proxies_dir(project_dir),
        )
        from yuu_clip.db.models import Video
        video = session.query(Video).filter_by(parent_video_id=None).first()
        return video.id
    finally:
        session.close()


@pytest.fixture()
def analyzed_project(system_project: Path) -> Path:
    """A disposable project with the fixture video fully analyzed (real pipeline)."""
    run_analyze(system_project)
    return system_project


@pytest.fixture()
def client(system_project: Path) -> Iterator[TestClient]:
    """A TestClient bound to the disposable project (created after any analyze)."""
    from yuu_clip.web.app import create_app
    app = create_app(system_project)
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# ffprobe helpers - observable end-state assertions on exported files.
# ---------------------------------------------------------------------------

def probe_duration_s(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def probe_dimensions(path: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", str(path)],
        capture_output=True, text=True,
    )
    width, height = out.stdout.strip().split("x")
    return int(width), int(height)


def export_clip_file(project_dir: Path, clip_id: int, *, preset: Optional[str] = None):
    """Run the real export engine for one clip and return (session, clip, output_path).

    Uses the in-process export engine (``export.render.render_export``) - the same
    code the CLI export subprocess runs - so the assertion is on a real cut file +
    SRT sidecar. Caller closes the returned session.
    """
    from yuu_clip.config import Config, project_exports_dir
    from yuu_clip.db.models import ClipCandidate
    from yuu_clip.export.presets import resolve_preset
    from yuu_clip.export.render import ExportOptions, render_export

    config = Config.load(project_dir)
    session = open_session(project_dir)
    clip = session.get(ClipCandidate, clip_id)
    resolved_preset = resolve_preset(preset, config.export_presets) if preset else None
    exports_dir = project_exports_dir(project_dir)
    render_export(
        clip, session, config,
        ExportOptions(
            captions=True,
            preset=resolved_preset,
            # The CLI folds the preset's container into the export; mirror that so a
            # preset export writes its own container (mp4) rather than the source .mkv.
            container=resolved_preset.container if resolved_preset else None,
        ),
        exports_dir=exports_dir,
    )
    return session, clip, exports_dir


def only_export_file(exports_dir: Path, *, suffix: str = ".mkv") -> Path:
    files = sorted(exports_dir.glob(f"*{suffix}"))
    assert files, f"no {suffix} export found in {exports_dir}"
    return files[-1]
