"""UC-C04 Split a recording, then export from a segment - Split only redistributes
clips to the segment containing each clip's start, and segment-relative timing
survives export (the cut lands on the correct absolute range).
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import export_clip_file, only_export_file, probe_duration_s


def test_split_migrates_clips_and_segment_export_keeps_timing(analyzed_project: Path, client) -> None:
    parent_id = client.get("/api/videos").json()[0]["id"]
    parent_clips = client.get(f"/api/videos/{parent_id}/clips").json()
    assert len(parent_clips) >= 2

    # Split at 20 s (between the two clip blocks) and migrate clips to segments.
    resp = client.post(
        f"/api/videos/{parent_id}/split",
        json={"split_points": [20.0], "migrate_clips": True},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["segment_ids"]) == 2
    assert body["migrated_clips"] == len(parent_clips)
    seg1_id, seg2_id = body["segment_ids"]

    # The second block's clip landed in segment 2 with segment-relative timing.
    seg2_clips = client.get(f"/api/videos/{seg2_id}/clips").json()
    assert len(seg2_clips) >= 1
    seg2_clip = seg2_clips[0]
    # Segment 2 starts at 20 s, so a clip that was ~22 s absolute is now ~2 s in.
    assert seg2_clip["start_ms"] < 20_000

    session, cand, exports_dir = export_clip_file(analyzed_project, seg2_clip["id"])
    try:
        segment_relative_duration_s = (cand.end_ms - cand.start_ms) / 1000.0
    finally:
        session.close()

    export_file = only_export_file(exports_dir)
    assert export_file.exists()
    # The exported file's duration matches the segment-relative window - the export
    # engine re-added the segment offset to cut the correct absolute range.
    assert abs(probe_duration_s(export_file) - segment_relative_duration_s) < 1.5
