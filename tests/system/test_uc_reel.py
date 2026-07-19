"""UC-E03 Build a highlight reel (and reel staleness) - compile a reel from
exported clips, and re-exporting a member flips the reel's stale flag.
"""
from __future__ import annotations

from pathlib import Path

from tests.system.conftest import export_clip_file, open_session


def _export_two_clips(project_dir: Path, client) -> list[int]:
    video_id = client.get("/api/videos").json()[0]["id"]
    clips = client.get(f"/api/videos/{video_id}/clips").json()
    assert len(clips) >= 2
    clips.sort(key=lambda c: c["start_ms"])
    clip_ids = [clips[0]["id"], clips[1]["id"]]
    for clip_id in clip_ids:
        session, _cand, _exports = export_clip_file(project_dir, clip_id)
        session.close()
    return clip_ids


def _build_reel(project_dir: Path, clip_ids: list[int]) -> Path:
    from yuu_clip.config import Config, project_exports_dir
    from yuu_clip.db.models import ClipCandidate, Video
    from yuu_clip.reel import compile_demo

    config = Config.load(project_dir)
    reels_dir = project_dir / ".yuu-clip" / "reels"
    reels_dir.mkdir(parents=True, exist_ok=True)
    output = reels_dir / "highlights.mkv"
    session = open_session(project_dir)
    try:
        clips = [session.get(ClipCandidate, cid) for cid in clip_ids]
        video_map = {c.video_id: session.get(Video, c.video_id) for c in clips}
        compile_demo(
            clips, video_map, project_exports_dir(project_dir), output, config,
            transition="none",
        )
    finally:
        session.close()
    return output


def test_reel_compiles_and_staleness_flips_on_member_reexport(analyzed_project: Path, client) -> None:
    clip_ids = _export_two_clips(analyzed_project, client)
    reel_path = _build_reel(analyzed_project, clip_ids)

    assert reel_path.exists()
    listing = client.get("/api/demo/list").json()
    row = next(r for r in listing if r["filename"] == "highlights.mkv")
    assert row["stale"] is False  # fresh reel, all members exported before it

    # Re-export one member: its exported_at moves past the reel's mtime -> stale.
    session, _cand, _exports = export_clip_file(analyzed_project, clip_ids[0])
    session.close()

    listing = client.get("/api/demo/list").json()
    row = next(r for r in listing if r["filename"] == "highlights.mkv")
    assert row["stale"] is True
