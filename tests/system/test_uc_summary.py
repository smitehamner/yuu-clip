"""UC-E01 Generate a video summary - analyze produces a persisted title + summary
(stubbed LLM), and the summarize route returns a fresh title + paragraph.
"""
from __future__ import annotations

from pathlib import Path


def test_analyze_persists_summary_and_summarize_route_regenerates(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]

    # The analyze pipeline already ran the (stubbed) summarizer and persisted it.
    video = client.get(f"/api/videos/{video_id}").json()
    assert video["title"] == "Deterministic System Test Session"
    assert video["summary"].startswith("A deterministic")

    # The summarize route returns a fresh title + paragraph for the compare modal.
    resp = client.post(f"/api/videos/{video_id}/summarize")
    assert resp.status_code == 200
    body = resp.json()
    assert body["title_new"] == "Deterministic System Test Session"
    assert body["summary_new"].startswith("A deterministic")
