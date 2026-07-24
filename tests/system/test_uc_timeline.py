"""UC-E02 Session timeline - generating a timeline (stubbed LLM) produces and
persists time-ordered entries mapped to the transcript windows.
"""
from __future__ import annotations

import json
from pathlib import Path


def _drain_sse(client, url: str) -> list[str]:
    events: list[str] = []
    with client.stream("GET", url) as response:
        assert response.status_code == 200
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(line[len("data: "):])
    return events


def test_timeline_generates_and_persists_entries(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]

    events = _drain_sse(client, f"/api/videos/{video_id}/timeline?interval_s=15")
    assert events and json.loads(events[-1]) == {"v": 1, "type": "done", "outcome": "ok"}

    video = client.get(f"/api/videos/{video_id}").json()
    timeline = video["timeline"]
    assert timeline, "timeline must be persisted after generation"
    assert len(timeline) >= 1
    for entry in timeline:
        assert entry["text"] == "A deterministic timeline entry describing this window."
        assert entry["start_hms"] and entry["end_hms"]
