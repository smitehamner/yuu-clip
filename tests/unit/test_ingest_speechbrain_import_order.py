"""Static guard for the SpeechBrain import-order landmine (see CLAUDE.md
"SpeechBrain poisons transformers.pipeline (import order)").

Importing speechbrain before transformers.pipeline is first resolved forces that
resolution to load speechbrain's k2_fsa integration, which hard-imports the
unbundled `k2` package and dies. `_analyze_one` in ingest.py works around this by
calling `prewarm_transformers_pipeline()` before the diarization stage (which
lazily imports speechbrain via its "speechbrain" backend) runs. This test asserts
that call order textually, so a reorder trips a red test instead of a silent
runtime failure that only surfaces with the real (non-mocked) packages installed.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

INGEST_PY = Path(__file__).resolve().parents[2] / "yuu_clip" / "pipeline" / "ingest.py"

PREWARM_CALL_PATTERN = r"prewarm_transformers_pipeline\(\)"
DIARIZATION_CALL_PATTERN = r"_run_speaker_diarization\("


def _assert_call_precedes(source: str, first_pattern: str, second_pattern: str) -> None:
    first = re.search(first_pattern, source)
    second = re.search(second_pattern, source)
    assert first, f"expected to find {first_pattern!r}"
    assert second, f"expected to find {second_pattern!r}"
    assert first.start() < second.start(), (
        f"{first_pattern!r} must appear before {second_pattern!r}"
    )


def test_prewarm_transformers_pipeline_precedes_diarization_in_ingest():
    source = INGEST_PY.read_text(encoding="utf-8")
    _assert_call_precedes(source, PREWARM_CALL_PATTERN, DIARIZATION_CALL_PATTERN)


def test_call_order_guard_fails_on_a_planted_violation():
    reordered_source = (
        "_run_speaker_diarization(config, session, transcripts)\n"
        "prewarm_transformers_pipeline()\n"
    )
    with pytest.raises(AssertionError):
        _assert_call_precedes(reordered_source, PREWARM_CALL_PATTERN, DIARIZATION_CALL_PATTERN)
