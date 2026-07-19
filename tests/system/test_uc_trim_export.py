"""UC-C02 Trim a clip, then export - trim offsets change the output duration,
``trim_edited_at`` is set, and the stale-export badge flips.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import export_clip_file, only_export_file, probe_duration_s


def test_trim_changes_duration_and_flips_stale(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{video_id}/clips").json()[0]["id"]

    session, cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    try:
        untrimmed_duration_s = (cand.end_ms - cand.start_ms) / 1000.0
    finally:
        session.close()
    untrimmed_file_duration = probe_duration_s(only_export_file(exports_dir))

    # Freshly exported clip is not stale.
    assert client.get(f"/api/clips/{clip_id}").json()["export_stale"] is False

    # Trim 3 s off each end.
    resp = client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 3.0, "end_offset": -3.0})
    assert resp.status_code == 200

    trimmed = client.get(f"/api/clips/{clip_id}").json()
    assert trimmed["start_offset"] == 3.0 and trimmed["end_offset"] == -3.0
    assert trimmed["export_stale"] is True  # trim_edited_at now newer than the export

    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id)
    session.close()
    retrimmed_file_duration = probe_duration_s(only_export_file(exports_dir))

    # 6 s shorter (within a keyframe), and re-exporting clears the stale flag.
    assert retrimmed_file_duration < untrimmed_file_duration - 4.0
    assert abs(retrimmed_file_duration - (untrimmed_duration_s - 6.0)) < 1.5
    assert client.get(f"/api/clips/{clip_id}").json()["export_stale"] is False
