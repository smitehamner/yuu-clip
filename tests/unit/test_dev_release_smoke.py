"""Unit tests for the `yuu-dev release-smoke` harness (Stage 1 task 8).

Only the parts testable without a live server: the SSE frame parser, the report
renderer, the scratch-dir safety guard, the --media-dir picker, and the drift
guard that every step's uc_ids exists in docs/dev/USE_CASES.md. The command
itself needs a live server and real models by construction and is deliberately
not integration-tested here (verified instead by running it against a live
`yuu-dev serve`, per the plan's Stage 1 acceptance criteria).
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest
import typer

from yuu_clip.dev.smoke import _validate_explicit_project
from yuu_clip.dev.smoke.client import _read_frames
from yuu_clip.dev.smoke.media import NoQualifyingMediaError, pick_from_media_dir
from yuu_clip.dev.smoke.report import STATUS_FAIL, STATUS_PASS, STATUS_SKIP, StepResult, render_console, write_report
from yuu_clip.dev.smoke.steps import STEP_SPECS
from yuu_clip.web.jobevents import done_payload, frame, log_payload, progress_payload

REPO = Path(__file__).resolve().parents[2]
CATALOG = REPO / "docs" / "dev" / "USE_CASES.md"
UC_HEADING = re.compile(r"^### (UC-[A-G]\d{2}) - ", re.MULTILINE)


class _FakeResponse:
    """A minimal stand-in for http.client.HTTPResponse's line interface."""

    def __init__(self, raw: bytes):
        self._lines = raw.splitlines(keepends=True)
        self._index = 0

    def readline(self) -> bytes:
        if self._index >= len(self._lines):
            return b""
        line = self._lines[self._index]
        self._index += 1
        return line


# --- SSE frame parser --------------------------------------------------------

def test_read_frames_decodes_typed_v1_events_in_order():
    raw = (
        frame(log_payload("hello", level="warn"))
        + frame(progress_payload("transcribe", done=2, total=10))
        + frame(done_payload("ok"))
    ).encode("utf-8")
    frames = list(_read_frames(_FakeResponse(raw), "http://x/y", float("inf"), 1.0))

    assert [f["kind"] for f in frames] == ["log", "progress", "done"]
    assert frames[0] == {"kind": "log", "text": "hello", "level": "warn", "_raw": frames[0]["_raw"]}
    assert frames[1]["done"] == 2 and frames[1]["total"] == 10
    assert frames[2]["outcome"] == "ok"
    assert frames[2]["_raw"]["type"] == "done"


def test_read_frames_ignores_unknown_type_and_newer_protocol():
    raw = (
        b'data: {"v": 1, "type": "totally-unknown"}\n\n'
        b'data: {"v": 2, "type": "log", "text": "future"}\n\n'
        + frame(done_payload("ok")).encode("utf-8")
    )
    frames = list(_read_frames(_FakeResponse(raw), "http://x/y", float("inf"), 1.0))

    assert frames[0]["kind"] == "unknown"
    assert frames[1]["kind"] == "newer-protocol"
    assert frames[2]["kind"] == "done"


def test_read_frames_raises_timeout_when_wall_clock_deadline_passes():
    raw = frame(log_payload("hello")).encode("utf-8")
    with pytest.raises(TimeoutError):
        list(_read_frames(_FakeResponse(raw), "http://x/y", 0.0, 0.0))


class _DroppedConnectionResponse:
    """Simulates the server dying mid-stream (e.g. `yuu-dev serve --stop` while a
    step is draining SSE) - readline() raises the way a reset socket would."""

    def readline(self) -> bytes:
        raise ConnectionResetError("An existing connection was forcibly closed")


def test_read_frames_names_the_endpoint_on_a_dropped_connection():
    with pytest.raises(ConnectionError, match=r"http://x/y.*lost its connection"):
        list(_read_frames(_DroppedConnectionResponse(), "http://x/y", float("inf"), 1.0))


# --- report renderer ----------------------------------------------------------

def test_render_console_is_ascii_only_for_a_mixed_run():
    results = [
        StepResult(1, "Switch to scratch project", ("UC-A03",), STATUS_PASS, detail="ok", duration_s=0.1),
        StepResult(2, "Probe source recording", ("UC-B01",), STATUS_FAIL, detail="boom: 12.3s < 60s", duration_s=0.2),
        StepResult(3, "Analyze the recording", ("UC-B01",), STATUS_SKIP, detail="skipped after an earlier step failed"),
    ]
    lines = render_console(results)
    rendered = "\n".join(lines)

    assert rendered.encode("ascii")  # raises UnicodeEncodeError on any non-ASCII glyph
    assert "[ok]" in rendered and "[FAIL]" in rendered and "[skip]" in rendered
    assert "boom: 12.3s < 60s" in rendered


def test_write_report_includes_residual_manual_only_rows(tmp_path):
    results = [StepResult(1, "Switch to scratch project", ("UC-A03",), STATUS_PASS, duration_s=0.1)]
    report_path = tmp_path / "release-smoke-report.md"

    write_report(report_path, results, {"base_url": "http://127.0.0.1:8080"})
    text = report_path.read_text(encoding="utf-8")

    assert "UC-A03" in text
    assert "Residual manual-only rows" in text
    assert "UC-A01" in text  # a permanently-manual row, not one Stage 1 exercises


# --- scratch-dir safety guard --------------------------------------------------

def test_validate_explicit_project_refuses_a_real_project_dir(tmp_path):
    project_dir = tmp_path / "my-real-project"
    (project_dir / ".yuu-clip").mkdir(parents=True)
    (project_dir / ".yuu-clip" / "project.db").write_text("not really sqlite", encoding="utf-8")

    with pytest.raises(typer.Exit) as excinfo:
        _validate_explicit_project(project_dir)
    assert excinfo.value.exit_code == 1


def test_validate_explicit_project_allows_an_autotest_suffixed_dir(tmp_path):
    project_dir = tmp_path / "scratch_autotest"
    (project_dir / ".yuu-clip").mkdir(parents=True)
    (project_dir / ".yuu-clip" / "project.db").write_text("not really sqlite", encoding="utf-8")

    _validate_explicit_project(project_dir)  # must not raise


def test_validate_explicit_project_allows_a_marked_scratch_dir(tmp_path):
    project_dir = tmp_path / "some-scratch-dir"
    (project_dir / ".yuu-clip").mkdir(parents=True)
    (project_dir / ".yuu-clip" / "project.db").write_text("not really sqlite", encoding="utf-8")
    (project_dir / ".yuu-clip-smoke-scratch").write_text("marker", encoding="utf-8")

    _validate_explicit_project(project_dir)  # must not raise


def test_validate_explicit_project_allows_a_dir_with_no_project_db(tmp_path):
    project_dir = tmp_path / "brand-new-empty-dir"
    project_dir.mkdir()

    _validate_explicit_project(project_dir)  # must not raise


# --- --media-dir picker ---------------------------------------------------------

def _make_short_clip(dest: Path, duration_s: int) -> None:
    ffmpeg = shutil.which("ffmpeg")
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"testsrc=duration={duration_s}:size=64x64:rate=5",
        "-c:v", "libx264", "-t", str(duration_s), str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not dest.is_file():
        pytest.skip(f"ffmpeg could not generate a test clip: {result.stderr[-300:]}")


def test_pick_from_media_dir_rejects_an_all_under_60s_folder(tmp_path):
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        pytest.skip("ffmpeg/ffprobe not on PATH")
    _make_short_clip(tmp_path / "clip_a.mkv", 3)
    _make_short_clip(tmp_path / "clip_b.mkv", 5)

    with pytest.raises(NoQualifyingMediaError) as excinfo:
        pick_from_media_dir(tmp_path)
    message = str(excinfo.value)
    assert "clip_a.mkv" in message and "clip_b.mkv" in message
    assert "60" in message


def test_pick_from_media_dir_picks_the_first_qualifying_file(tmp_path):
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        pytest.skip("ffmpeg/ffprobe not on PATH")
    _make_short_clip(tmp_path / "a_too_short.mkv", 3)
    _make_short_clip(tmp_path / "b_long_enough.mkv", 61)

    picked = pick_from_media_dir(tmp_path)
    assert picked.name == "b_long_enough.mkv"


# --- uc_ids drift guard ---------------------------------------------------------

def test_every_step_uc_id_exists_in_the_use_case_catalog():
    known_ids = set(UC_HEADING.findall(CATALOG.read_text(encoding="utf-8")))
    referenced = {uc_id for spec in STEP_SPECS for uc_id in spec.uc_ids}

    missing = referenced - known_ids
    assert not missing, f"release-smoke steps reference UC ids missing from USE_CASES.md: {sorted(missing)}"
