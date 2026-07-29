"""Structured progress channel for the analyze/score pipeline.

The engine prints human-readable stage lines (for the CLI and the debug log) AND,
alongside them, a machine-parseable marker line so the browser can drive the job
progress bar deterministically instead of regex-matching prose. This is the single
source of truth for the marker format; ``parseProgress`` in ``web/static/core/jobs.js``
mirrors ``parse_progress`` - keep the two in sync (the stage set is enforced by
``tests/unit/test_progress_stage_coupling.py``).

Structural precedent: ``yuu_clip/url_import.py`` ``format_progress_line`` /
``parse_progress_line`` (a parseable line printed to stdout, parsed back for tests
and mirrored in JS).
"""
from __future__ import annotations

import json
from enum import Enum
from typing import Optional

_PROGRESS_PREFIX = "@@PROGRESS "


class Stage(str, Enum):
    """Canonical stage ids. Must match the ``stage`` field the browser's step
    definitions carry in ``web/static/core/jobs.js`` (coupling-guarded by a unit test).

    Also the registry ``yuu_clip/web/jobevents.py``'s ``progress_event`` validates
    against, so a stage doesn't have to ride the ``@@PROGRESS``-over-stdout channel
    to be legal - ``EXPORT_CLIP`` is emitted directly as a typed SSE event from
    ``web/routes/clips/export.py``'s in-process async generator, never printed.
    """

    EXTRACT = "extract"
    TRANSCRIBE = "transcribe"
    SPEAKERS = "speakers"
    GENERATE_CLIPS = "generate_clips"
    SUMMARIZE = "summarize"
    ENERGY = "energy"
    SCENES = "scenes"
    SCORE = "score"
    FRAMES_SAMPLE = "frames_sample"
    FRAMES_DESCRIBE = "frames_describe"
    EXPORT_CLIP = "export_clip"


_KNOWN_STAGES = {stage.value for stage in Stage}


def format_progress(
    stage, done: Optional[int] = None, total: Optional[int] = None, label: Optional[str] = None
) -> str:
    """Build the ``@@PROGRESS {json}`` marker line. Absent fields are omitted."""
    stage_id = stage.value if isinstance(stage, Stage) else str(stage)
    payload: dict = {"stage": stage_id}
    if done is not None:
        payload["done"] = done
    if total is not None:
        payload["total"] = total
    if label is not None:
        payload["label"] = label
    return _PROGRESS_PREFIX + json.dumps(payload)


def parse_progress(line: str) -> Optional[dict]:
    """Parse a marker line back into its fields, or None for any non-marker line.

    Returns None unless the line is the ``@@PROGRESS `` prefix followed by a JSON
    object whose ``stage`` is a known Stage - mirroring the None-on-nonmatch
    contract of ``url_import.parse_progress_line`` so ordinary log output and
    malformed markers are ignored rather than crashing the parser.
    """
    if not line.startswith(_PROGRESS_PREFIX):
        return None
    try:
        payload = json.loads(line[len(_PROGRESS_PREFIX):])
    except (ValueError, TypeError):
        return None
    if not isinstance(payload, dict) or payload.get("stage") not in _KNOWN_STAGES:
        return None
    return payload


def emit_progress(
    stage, done: Optional[int] = None, total: Optional[int] = None, label: Optional[str] = None
) -> None:
    """Print a marker line to stdout so it rides the same SSE stream as the human lines.

    Uses a plain ``print`` rather than the Rich ``console`` on purpose: Rich would
    soft-wrap or style a long JSON line, corrupting the marker mid-stream.
    """
    print(format_progress(stage, done=done, total=total, label=label), flush=True)
