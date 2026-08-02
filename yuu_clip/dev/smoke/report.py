"""StepResult, console rendering, and the written run report for release-smoke."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"
STATUS_SKIP = "SKIP"

_MARKERS = {STATUS_PASS: "[ok]", STATUS_FAIL: "[FAIL]", STATUS_SKIP: "[skip]"}

# The plan's "What stays manual, permanently" list - packaged-only or pre-server
# surfaces no HTTP-driving harness can reach. Kept here as a static constant
# (rather than parsed from docs/dev/USE_CASES.md) since docs/ is not part of the
# wheel and this command must run under a packaged install's bundled interpreter.
MANUAL_ONLY_ROWS: tuple[tuple[str, str], ...] = (
    ("UC-A01", "Install the packaged app"),
    ("UC-A02", "Setup wizard: palette, typography, copy, contrast"),
    ("UC-B03", "Keyboard review shortcuts and undo timing"),
    ("UC-B05", "Native yuu-media:// transport / DevTools no-HTTP-fallback check"),
    ("UC-G03", "Desktop lifecycle, Task Manager orphan check, update-mode wizard"),
    ("UC-G02", "Notification-sound playback"),
    ("Tier-B", "Download UX (F1-F3)"),
    ("Tier-C", "CUDA opt-in (G1-G3)"),
    ("UC-G05", "Cross-release schema upgrade"),
)


@dataclass
class StepResult:
    step_no: int
    name: str
    uc_ids: tuple[str, ...]
    status: str
    detail: str = ""
    duration_s: float = 0.0
    frames: list[dict[str, Any]] = field(default_factory=list)


def render_console(results: list[StepResult]) -> list[str]:
    lines = []
    for r in results:
        uc = ",".join(r.uc_ids) if r.uc_ids else "-"
        lines.append(f"{_MARKERS[r.status]} step {r.step_no:>2} ({uc}) {r.name} - {r.duration_s:.1f}s")
        if r.detail and r.status != STATUS_PASS:
            for line in r.detail.splitlines():
                lines.append(f"       {line}")
    return lines


def write_report(path: Path, results: list[StepResult], meta: dict[str, Any]) -> None:
    lines = ["# yuu-dev release-smoke report", ""]
    for key, value in meta.items():
        lines.append(f"{key}: {value}")
    lines.append("")
    for r in results:
        lines.append(f"## Step {r.step_no}: {r.name} [{r.status}] ({','.join(r.uc_ids) or '-'})")
        lines.append(f"duration: {r.duration_s:.2f}s")
        if r.detail:
            lines.append("")
            lines.append(r.detail)
        if r.frames:
            lines.append("")
            lines.append("SSE frames:")
            for frame in r.frames:
                lines.append(f"  {json.dumps(frame)}")
        lines.append("")

    lines.append("## Residual manual-only rows")
    lines.append("")
    lines.append("These stay a human walk permanently - no HTTP-driving harness reaches them:")
    lines.append("")
    for uc_id, title in MANUAL_ONLY_ROWS:
        lines.append(f"- {uc_id}: {title}")
    lines.append("")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
