"""UC-E01 Generate a video summary - analyze produces a persisted title + summary
(stubbed LLM), and the summarize route streams a fresh title + paragraph.
"""
from __future__ import annotations

import json
from pathlib import Path


def _sse_result(client, url) -> dict:
    with client.stream("GET", url) as resp:
        assert resp.status_code == 200
        for line in resp.iter_lines():
            if not line.startswith("data: "):
                continue
            payload = json.loads(line[len("data: "):])
            if payload.get("type") == "result":
                return payload["data"]
    raise AssertionError(f"no result event in the SSE stream from {url}")


def test_analyze_persists_summary_and_summarize_route_regenerates(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]

    # The analyze pipeline already ran the (stubbed) summarizer and persisted it.
    video = client.get(f"/api/videos/{video_id}").json()
    assert video["title"] == "Deterministic System Test Session"
    assert video["summary"].startswith("A deterministic")

    # The summarize route streams a fresh title + paragraph for the compare modal.
    body = _sse_result(client, f"/api/videos/{video_id}/summarize")
    assert body["title_new"] == "Deterministic System Test Session"
    assert body["summary_new"].startswith("A deterministic")
