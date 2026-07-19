"""UC-F04 Vertical / Shorts export with auto-framing - the 9:16 preset renders a
1080x1920 file and records the framing choice on the clip.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import (
    export_clip_file,
    only_export_file,
    probe_dimensions,
)


def test_vertical_preset_exports_1080x1920(analyzed_project: Path, client) -> None:
    video_id = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{video_id}/clips").json()[0]["id"]

    # Record a framing choice (crop position) before exporting vertical.
    resp = client.patch(f"/api/clips/{clip_id}/framing", json={"crop_x": 0.5})
    assert resp.status_code == 200
    assert client.get(f"/api/clips/{clip_id}").json()["crop_x"] == 0.5

    session, _cand, exports_dir = export_clip_file(analyzed_project, clip_id, preset="tiktok-9x16")
    session.close()

    export_file = only_export_file(exports_dir, suffix=".mp4")
    assert probe_dimensions(export_file) == (1080, 1920)
