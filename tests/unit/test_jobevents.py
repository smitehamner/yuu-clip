"""Contract tests for the typed SSE job-event protocol (yuu_clip/web/jobevents.py).

Builders produce valid v1 frames; parse_event round-trips them; the shared
DECODE_FIXTURES table (the same one the JS decoder is tested against via
job-events.json) decodes identically; invalid outcome / level / stage raise.
"""
from __future__ import annotations

import json

import pytest

from yuu_clip.pipeline.progress import Stage
from yuu_clip.web import jobevents
from yuu_clip.web.jobevents import (
    DECODE_FIXTURES,
    EVENT_TYPES,
    LOG_LEVELS,
    OUTCOMES,
    PROTOCOL_VERSION,
    STAGE_IDS,
    done_event,
    log_event,
    parse_event,
    progress_event,
    result_event,
)


def _payload_of(frame: str):
    assert frame.startswith("data: "), frame
    assert frame.endswith("\n\n"), frame
    return json.loads(frame[len("data: "):-2])


def test_protocol_constants_are_coherent():
    assert PROTOCOL_VERSION == 1
    assert EVENT_TYPES == ("log", "progress", "result", "done")
    assert OUTCOMES == ("ok", "error", "cancelled")
    assert set(STAGE_IDS) == {stage.value for stage in Stage}


def test_log_event_frame_shape():
    assert _payload_of(log_event("Extracting audio")) == {
        "v": 1, "type": "log", "text": "Extracting audio", "level": "info",
    }


def test_log_event_carries_level():
    assert _payload_of(log_event("hot", level="warn"))["level"] == "warn"


def test_log_event_rejects_unknown_level():
    with pytest.raises(ValueError):
        log_event("x", level="loud")


def test_progress_event_includes_optional_fields():
    assert _payload_of(progress_event("score", done=3, total=12)) == {
        "v": 1, "type": "progress", "stage": "score", "done": 3, "total": 12,
    }


def test_progress_event_omits_absent_fields():
    assert _payload_of(progress_event("energy")) == {
        "v": 1, "type": "progress", "stage": "energy",
    }


def test_progress_event_keeps_zero_done():
    assert _payload_of(progress_event("transcribe", done=0, total=4))["done"] == 0


def test_progress_event_accepts_stage_enum():
    assert _payload_of(progress_event(Stage.SCENES))["stage"] == "scenes"


def test_progress_event_rejects_unknown_stage():
    with pytest.raises(ValueError):
        progress_event("not_a_stage")


def test_result_event_frame_shape():
    assert _payload_of(result_event({"results": [1, 2]})) == {
        "v": 1, "type": "result", "data": {"results": [1, 2]},
    }


def test_done_event_ok_omits_error():
    assert _payload_of(done_event("ok")) == {"v": 1, "type": "done", "outcome": "ok"}


def test_done_event_error_carries_message():
    assert _payload_of(done_event("error", "boom")) == {
        "v": 1, "type": "done", "outcome": "error", "error": "boom",
    }


def test_done_event_cancelled():
    assert _payload_of(done_event("cancelled"))["outcome"] == "cancelled"


def test_done_event_rejects_unknown_outcome():
    with pytest.raises(ValueError):
        done_event("aborted")


@pytest.mark.parametrize("fixture", DECODE_FIXTURES, ids=lambda f: f["name"])
def test_decode_fixtures_round_trip(fixture):
    assert parse_event(fixture["payload"]) == fixture["expected"]


def test_builders_round_trip_through_parse_event():
    assert parse_event(_payload_of(log_event("hi"))) == {
        "kind": "log", "text": "hi", "level": "info",
    }
    assert parse_event(_payload_of(progress_event("score", done=1, total=2))) == {
        "kind": "progress", "stage": "score", "done": 1, "total": 2, "label": None,
    }
    assert parse_event(_payload_of(result_event([1]))) == {"kind": "result", "data": [1]}
    assert parse_event(_payload_of(done_event("error", "nope"))) == {
        "kind": "done", "outcome": "error", "error": "nope",
    }


def test_fixture_table_covers_every_decode_kind():
    kinds = {fixture["expected"]["kind"] for fixture in DECODE_FIXTURES}
    assert kinds == {
        "log", "progress", "result", "done",
        "legacy-line", "legacy-done", "unknown", "newer-protocol",
    }


def test_build_job_events_data_matches_constants():
    data = jobevents.build_job_events_data()
    assert data["protocol_version"] == PROTOCOL_VERSION
    assert data["event_types"] == list(EVENT_TYPES)
    assert data["outcomes"] == list(OUTCOMES)
    assert data["log_levels"] == list(LOG_LEVELS)
    assert data["stages"] == list(STAGE_IDS)
    assert data["decode_fixtures"] == DECODE_FIXTURES
