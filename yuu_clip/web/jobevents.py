"""Typed SSE job-event protocol (v1) - the server->browser wire vocabulary.

This is the single Python home for the versioned event contract described in the
SSE-event-protocol design. It owns the protocol version, the event-type and outcome
names, the registry of valid progress stage ids (the ``pipeline.progress.Stage``
enum), the builder functions emitters call, and ``parse_event`` - the decode rules
mirrored on the browser side by ``static/core/jobevents.js``. Both decoders are
verified against the ONE ``DECODE_FIXTURES`` table below, so they cannot silently
diverge.

Framing note: the raw ``data: <json>\\n\\n`` SSE frame is built here (``_frame``)
rather than reusing a shared ``sse_event`` helper, because no such helper exists in
``web/sse.py`` today (the emitters inline the framing). The typed protocol keeps its
own framing so this module has no import dependency on the FastAPI emitter layer.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from yuu_clip.pipeline.progress import Stage

PROTOCOL_VERSION = 1

EVENT_LOG = "log"
EVENT_PROGRESS = "progress"
EVENT_RESULT = "result"
EVENT_DONE = "done"
EVENT_TYPES = (EVENT_LOG, EVENT_PROGRESS, EVENT_RESULT, EVENT_DONE)

OUTCOME_OK = "ok"
OUTCOME_ERROR = "error"
OUTCOME_CANCELLED = "cancelled"
OUTCOMES = (OUTCOME_OK, OUTCOME_ERROR, OUTCOME_CANCELLED)

LOG_LEVELS = ("info", "warn", "error")

# Valid progress stage ids: the engine's Stage enum. The in-process job stages the
# PROGRESS-CANCEL-GAP plan will add do not exist yet, so the registry is exactly the
# Stage enum for now (the design's "just wrap that enum for now").
STAGE_IDS = tuple(stage.value for stage in Stage)

_DONE_SENTINEL = "__DONE__"


def _frame(payload: Any) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def log_event(text: str, level: str = "info") -> str:
    if level not in LOG_LEVELS:
        raise ValueError(f"invalid log level {level!r}; expected one of {LOG_LEVELS}")
    return _frame({"v": PROTOCOL_VERSION, "type": EVENT_LOG, "text": text, "level": level})


def progress_event(
    stage, done: Optional[int] = None, total: Optional[int] = None, label: Optional[str] = None
) -> str:
    stage_id = stage.value if isinstance(stage, Stage) else str(stage)
    if stage_id not in STAGE_IDS:
        raise ValueError(f"unknown progress stage {stage_id!r}; expected one of {STAGE_IDS}")
    payload: dict = {"v": PROTOCOL_VERSION, "type": EVENT_PROGRESS, "stage": stage_id}
    if done is not None:
        payload["done"] = done
    if total is not None:
        payload["total"] = total
    if label is not None:
        payload["label"] = label
    return _frame(payload)


def result_event(data: Any) -> str:
    return _frame({"v": PROTOCOL_VERSION, "type": EVENT_RESULT, "data": data})


def done_event(outcome: str, error: str = "") -> str:
    if outcome not in OUTCOMES:
        raise ValueError(f"invalid outcome {outcome!r}; expected one of {OUTCOMES}")
    payload: dict = {"v": PROTOCOL_VERSION, "type": EVENT_DONE, "outcome": outcome}
    if error:
        payload["error"] = error
    return _frame(payload)


def _decode_string(payload: str) -> dict:
    if payload == _DONE_SENTINEL:
        return {"kind": "legacy-done", "payload": payload, "error": None}
    return {"kind": "legacy-line", "payload": payload}


def _decode_typed(payload: dict) -> dict:
    event_type = payload.get("type")
    if event_type == EVENT_LOG:
        return {"kind": EVENT_LOG, "text": payload.get("text", ""), "level": payload.get("level", "info")}
    if event_type == EVENT_PROGRESS:
        return {
            "kind": EVENT_PROGRESS,
            "stage": payload.get("stage"),
            "done": payload.get("done"),
            "total": payload.get("total"),
            "label": payload.get("label"),
        }
    if event_type == EVENT_RESULT:
        return {"kind": EVENT_RESULT, "data": payload.get("data")}
    if event_type == EVENT_DONE:
        return {"kind": EVENT_DONE, "outcome": payload.get("outcome"), "error": payload.get("error", "")}
    return {"kind": "unknown"}


def _decode_object(payload: dict) -> dict:
    if payload.get("type") == _DONE_SENTINEL:
        error = payload.get("error") if payload.get("ok") is False else None
        return {"kind": "legacy-done", "payload": payload, "error": error}
    version = payload.get("v")
    if version == PROTOCOL_VERSION:
        return _decode_typed(payload)
    if isinstance(version, (int, float)) and not isinstance(version, bool) and version > PROTOCOL_VERSION:
        return {"kind": "newer-protocol"}
    return {"kind": "legacy-line", "payload": payload}


def parse_event(payload: Any) -> dict:
    """Decode one already-JSON-parsed SSE payload into a discriminated result.

    Mirrors ``decodeEvent`` in ``static/core/jobevents.js`` exactly (verified against
    ``DECODE_FIXTURES``). Implements the section-2 consumer rules: legacy prose string,
    legacy ``__DONE__`` sentinel (both forms), typed v1 events, unknown v1 type
    (ignored), and a newer protocol version.
    """
    if isinstance(payload, str):
        return _decode_string(payload)
    if isinstance(payload, dict):
        return _decode_object(payload)
    return {"kind": "legacy-line", "payload": payload}


# The single cross-runtime decode fixture table: (payload, expected-decode) pairs
# consumed by BOTH tests/unit/test_jobevents.py (parse_event) and
# tests/js/core/jobevents.test.js (decodeEvent), routed through job-events.json so the
# two decoders share one authoritative set and cannot diverge undetected.
DECODE_FIXTURES = [
    {
        "name": "typed log",
        "payload": {"v": 1, "type": "log", "text": "Extracting audio", "level": "info"},
        "expected": {"kind": "log", "text": "Extracting audio", "level": "info"},
    },
    {
        "name": "typed log defaults to info",
        "payload": {"v": 1, "type": "log", "text": "hello"},
        "expected": {"kind": "log", "text": "hello", "level": "info"},
    },
    {
        "name": "typed log warn level",
        "payload": {"v": 1, "type": "log", "text": "GPU running hot", "level": "warn"},
        "expected": {"kind": "log", "text": "GPU running hot", "level": "warn"},
    },
    {
        "name": "typed progress",
        "payload": {"v": 1, "type": "progress", "stage": "score", "done": 3, "total": 12},
        "expected": {"kind": "progress", "stage": "score", "done": 3, "total": 12, "label": None},
    },
    {
        "name": "typed progress with zero done and label",
        "payload": {"v": 1, "type": "progress", "stage": "transcribe", "done": 0, "total": 4, "label": "Track 1/4"},
        "expected": {"kind": "progress", "stage": "transcribe", "done": 0, "total": 4, "label": "Track 1/4"},
    },
    {
        "name": "typed result",
        "payload": {"v": 1, "type": "result", "data": {"results": [1, 2, 3]}},
        "expected": {"kind": "result", "data": {"results": [1, 2, 3]}},
    },
    {
        "name": "typed done ok",
        "payload": {"v": 1, "type": "done", "outcome": "ok"},
        "expected": {"kind": "done", "outcome": "ok", "error": ""},
    },
    {
        "name": "typed done error",
        "payload": {"v": 1, "type": "done", "outcome": "error", "error": "boom"},
        "expected": {"kind": "done", "outcome": "error", "error": "boom"},
    },
    {
        "name": "typed done cancelled",
        "payload": {"v": 1, "type": "done", "outcome": "cancelled"},
        "expected": {"kind": "done", "outcome": "cancelled", "error": ""},
    },
    {
        "name": "legacy bare string prose line",
        "payload": "Extracting audio track 1",
        "expected": {"kind": "legacy-line", "payload": "Extracting audio track 1"},
    },
    {
        "name": "legacy done bare string",
        "payload": "__DONE__",
        "expected": {"kind": "legacy-done", "payload": "__DONE__", "error": None},
    },
    {
        "name": "legacy done failure object",
        "payload": {"type": "__DONE__", "ok": False, "error": "This job did not finish - check the log for details."},
        "expected": {
            "kind": "legacy-done",
            "payload": {"type": "__DONE__", "ok": False, "error": "This job did not finish - check the log for details."},
            "error": "This job did not finish - check the log for details.",
        },
    },
    {
        "name": "legacy done success object carrying result data",
        "payload": {"type": "__DONE__", "results": [1, 2]},
        "expected": {
            "kind": "legacy-done",
            "payload": {"type": "__DONE__", "results": [1, 2]},
            "error": None,
        },
    },
    {
        "name": "v1 unknown type is ignored",
        "payload": {"v": 1, "type": "heartbeat"},
        "expected": {"kind": "unknown"},
    },
    {
        "name": "newer protocol version",
        "payload": {"v": 2, "type": "log", "text": "from a newer server"},
        "expected": {"kind": "newer-protocol"},
    },
]


def build_job_events_data() -> dict:
    """The shared contract facts baked into static/shared/job-events.json."""
    return {
        "_generated_by": "yuu-dev shared-data",
        "protocol_version": PROTOCOL_VERSION,
        "event_types": list(EVENT_TYPES),
        "outcomes": list(OUTCOMES),
        "log_levels": list(LOG_LEVELS),
        "stages": list(STAGE_IDS),
        "decode_fixtures": DECODE_FIXTURES,
    }
