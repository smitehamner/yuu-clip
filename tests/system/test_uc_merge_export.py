"""UC-C05 Merge duplicate or adjacent clips, then export - merge resets export
metadata and the merged range exports as one file.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import export_clip_file, only_export_file, probe_duration_s


def test_merge_resets_export_metadata_and_exports_one_file(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clips = client.get(f"/api/videos/{video_id}/clips").json()
    assert len(clips) >= 2, "the fixture transcript must yield two clips to merge"
    # Order by start time so the merged span is predictable.
    clips.sort(key=lambda c: c["start_ms"])
    clip_a, clip_b = clips[0], clips[1]

    # Export clip A first so we can prove the merge resets its export metadata.
    session, cand_a, _exports = export_clip_file(analyzed_project, clip_a["id"])
    session.close()
    assert client.get(f"/api/clips/{clip_a['id']}").json()["exported_at"] is not None

    expected_start = min(clip_a["start_ms"], clip_b["start_ms"])
    expected_end = max(clip_a["end_ms"], clip_b["end_ms"])

    merged = client.post(
        f"/api/clips/{clip_a['id']}/merge", json={"clip_b_id": clip_b["id"]}
    ).json()

    assert merged["start_ms"] == expected_start
    assert merged["end_ms"] == expected_end
    assert merged["exported_at"] is None  # export metadata reset by the merge
    # clip_b is gone; only the merged clip remains where two were.
    remaining = client.get(f"/api/videos/{video_id}/clips").json()
    assert clip_b["id"] not in [c["id"] for c in remaining]

    session, cand, exports_dir = export_clip_file(analyzed_project, clip_a["id"])
    try:
        merged_duration_s = (cand.end_ms - cand.start_ms) / 1000.0
    finally:
        session.close()

    export_file = only_export_file(exports_dir)
    assert export_file.exists()
    assert abs(probe_duration_s(export_file) - merged_duration_s) < 1.5
