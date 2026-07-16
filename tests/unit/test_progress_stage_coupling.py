"""Coupling guard: the browser must know every stage the engine can emit.

The @@PROGRESS marker drives the job progress bar. If a Stage is added in
progress.py but the browser's stage set (jobs.js JOB_STAGES) is not updated in
lockstep, that stage's markers would be silently ignored and the pill would never
advance. This test fails on that drift instead of letting the bar quietly break.
"""
from pathlib import Path

from yuu_clip.pipeline.progress import Stage

_JOBS_JS = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static" / "core" / "jobs.js"


def test_every_stage_id_is_known_to_the_browser():
    jobs_js = _JOBS_JS.read_text(encoding="utf-8")
    missing = [stage.value for stage in Stage if f"'{stage.value}'" not in jobs_js]
    assert not missing, f"jobs.js JOB_STAGES is missing stage ids emitted by progress.py: {missing}"
