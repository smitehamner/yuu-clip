"""UC-B01 Analyze / UC-B05 Export + play - the core loop, full stack.

Drives the real analyze pipeline against the fixture video (Whisper + LLM
stubbed), approves a clip through the route, exports a real file with the export
engine, and confirms the playable path is served back.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import (
    export_clip_file,
    only_export_file,
    probe_duration_s,
)


def test_analyze_produces_scored_clips(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clips = client.get(f"/api/videos/{video_id}/clips").json()

    assert len(clips) >= 1
    top = clips[0]
    # The stubbed LLM scored every clip: real overall computed, description set,
    # llm_scored tag present, no "Not yet scored" placeholder.
    assert top["score_overall"] is not None and top["score_overall"] > 0
    assert "llm_scored" in top["tags"]
    assert top["description"].startswith("Deterministic clip description")

    full = client.get(f"/api/clips/{top['id']}").json()
    assert full["transcript_excerpt"]


def test_approve_then_export_writes_file_and_sidecar(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clips = client.get(f"/api/videos/{video_id}/clips").json()
    clip = clips[0]
    clip_id = clip["id"]

    resp = client.post(f"/api/clips/{clip_id}/status", json={"status": "approved"})
    assert resp.status_code == 200

    session, cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    try:
        expected_duration_s = (cand.end_ms - cand.start_ms) / 1000.0
    finally:
        session.close()

    export_file = only_export_file(exports_dir, suffix=".mkv")
    sidecars = list(exports_dir.glob("*.srt"))

    assert export_file.exists()
    assert sidecars, "an SRT caption sidecar must land alongside the export"
    # Quick (stream-copy) export lands within a keyframe of the requested window.
    assert abs(probe_duration_s(export_file) - expected_duration_s) < 1.5


def test_media_url_returns_the_exported_file(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{video_id}/clips").json()[0]["id"]

    # Before export there is no playable file: url is null (still 200).
    assert client.get(f"/api/clips/{clip_id}/media_url").json()["url"] is None

    session, _cand, _exports = export_clip_file(analyzed_project, clip_id)
    session.close()

    served = client.get(f"/api/clips/{clip_id}/media_url").json()
    assert served["url"]  # a playable path is now served back
    assert served["has_captions"] is True
