"""Extract the failures-plus-summary tail from pytest output.

Mirrors the summary-file logic the ps1 test scripts wrote so the documented
"read test-*-last-summary.log" workflow is unchanged: the summary is everything
from the first FAILURES/ERRORS section (or the short-test-summary line) through
pytest's result line, with a 5-line fallback on an all-green run.
"""
from __future__ import annotations

import re
from pathlib import Path

_SECTION_RE = re.compile(r"^=+ (FAILURES|ERRORS) =+$")
_RESULT_RE = re.compile(r"\d+ (passed|failed|error|skipped).* in ")


def extract_summary(lines: list[str]) -> list[str]:
    if not lines:
        return []

    summary_start: int | None = None
    for index, line in enumerate(lines):
        if _SECTION_RE.match(line):
            summary_start = index
            break
    if summary_start is None:
        for index in range(len(lines) - 1, -1, -1):
            if "short test summary info" in lines[index]:
                summary_start = index
                break

    summary_end = len(lines) - 1
    for index in range(len(lines) - 1, -1, -1):
        if _RESULT_RE.search(lines[index]):
            summary_end = index
            break

    if summary_start is None:
        summary_start = max(0, summary_end - 4)
    return lines[summary_start:summary_end + 1]


def write_run_logs(output: str, log_path: Path, summary_path: Path) -> list[str]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(output, encoding="utf-8")
    summary = extract_summary(output.splitlines())
    summary_path.write_text(("\n".join(summary) + "\n") if summary else "", encoding="utf-8")
    return summary
