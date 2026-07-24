"""UC-F01 World contexts: create, assign, re-score - assigning a context and
re-scoring injects the context into the LLM prompt (the stub echoes it back).
"""
from __future__ import annotations

import json
from pathlib import Path

from tests.system._stubs import CONTEXT_MARKER


def _drain_sse(client, url: str) -> list[str]:
    events: list[str] = []
    with client.stream("GET", url) as response:
        assert response.status_code == 200
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(line[len("data: "):])
    return events


def test_assign_context_then_rescore_injects_context(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{video_id}/clips").json()[0]["id"]

    # Baseline: analyze scored with no context, so the stub echoed ctx=none.
    assert CONTEXT_MARKER not in client.get(f"/api/clips/{clip_id}").json()["description"]

    resp = client.post("/api/contexts", json={
        "context_id": "systemtest",
        "display_name": "System Test World",
        "setting": f"A world whose defining detail is {CONTEXT_MARKER}.",
    })
    assert resp.status_code == 200

    resp = client.patch(f"/api/videos/{video_id}/contexts", json={"context_names": ["systemtest"]})
    assert resp.status_code == 200

    events = _drain_sse(client, f"/api/videos/{video_id}/rescore-clips")
    assert events and json.loads(events[-1]) == {"v": 1, "type": "done", "outcome": "ok"}

    # The re-score injected the context into the prompt; the stub echoed the marker
    # into the description, proving the assigned context reached the LLM.
    assert CONTEXT_MARKER in client.get(f"/api/clips/{clip_id}").json()["description"]
    # "Last scored with" now reflects the assigned context.
    assert client.get(f"/api/videos/{video_id}").json()["clips_scored_context"] == ["systemtest"]
