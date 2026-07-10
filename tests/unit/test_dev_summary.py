"""Unit tests for the pytest-output summary extraction (yuu_clip.dev._summary)."""
from __future__ import annotations

from yuu_clip.dev._summary import extract_summary, write_run_logs


def test_empty_output_yields_no_summary():
    assert extract_summary([]) == []


def test_all_green_run_falls_back_to_result_tail():
    lines = [
        "collected 3 items",
        "tests/unit/test_a.py ...",
        "",
        "============ 3 passed in 0.42s ============",
    ]
    # No FAILURES section: summary is the up-to-5-line window ending at the result line.
    assert extract_summary(lines) == [
        "collected 3 items",
        "tests/unit/test_a.py ...",
        "",
        "============ 3 passed in 0.42s ============",
    ]


def test_failures_section_starts_the_summary():
    lines = [
        "collected 2 items",
        "tests/unit/test_a.py .F",
        "=================== FAILURES ===================",
        "____________________ test_b ____________________",
        "assert 1 == 2",
        "=========== short test summary info ===========",
        "FAILED tests/unit/test_a.py::test_b - assert 1 == 2",
        "============ 1 failed, 1 passed in 0.5s ============",
    ]
    assert extract_summary(lines) == [
        "=================== FAILURES ===================",
        "____________________ test_b ____________________",
        "assert 1 == 2",
        "=========== short test summary info ===========",
        "FAILED tests/unit/test_a.py::test_b - assert 1 == 2",
        "============ 1 failed, 1 passed in 0.5s ============",
    ]


def test_errors_section_starts_the_summary():
    lines = [
        "tests/unit/test_a.py E",
        "==================== ERRORS ====================",
        "error during collection",
        "============ 1 error in 0.1s ============",
    ]
    assert extract_summary(lines) == [
        "==================== ERRORS ====================",
        "error during collection",
        "============ 1 error in 0.1s ============",
    ]


def test_trailing_noise_after_result_line_is_dropped():
    lines = [
        "=================== FAILURES ===================",
        "boom",
        "============ 1 failed in 0.2s ============",
        "NativeCommandError: bringing up nodes",
    ]
    # The result line is the authoritative end; PowerShell-style stderr noise after
    # it must not leak into the summary.
    assert extract_summary(lines) == [
        "=================== FAILURES ===================",
        "boom",
        "============ 1 failed in 0.2s ============",
    ]


def test_write_run_logs_writes_full_log_and_summary(tmp_path):
    output = "line one\n=================== FAILURES ===================\nboom\n============ 1 failed in 0.2s ============\n"
    log_path = tmp_path / "run.log"
    summary_path = tmp_path / "run-summary.log"

    summary = write_run_logs(output, log_path, summary_path)

    assert log_path.read_text(encoding="utf-8") == output
    assert summary == [
        "=================== FAILURES ===================",
        "boom",
        "============ 1 failed in 0.2s ============",
    ]
    assert summary_path.read_text(encoding="utf-8") == "\n".join(summary) + "\n"
