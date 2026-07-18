"""The shared UI-fixture seed (`yuu_clip.dev.fixture.seed_project_db`).

Guards the two contracts the integration `project_dir` fixture and the
`yuu-dev fixture-project` builder both depend on: scenes-off reproduces the
integration seed exactly (three clips, no scenes), and scenes-on adds the scene
rows the merged Clips+Scenes view needs.
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path

from yuu_clip.db.models import ClipCandidate, Video, make_session
from yuu_clip.dev.fixture import seed_project_db


def _clips(project_dir: Path) -> list[ClipCandidate]:
    session = make_session(project_dir / ".yuu-clip" / "project.db")
    try:
        return session.query(ClipCandidate).all()
    finally:
        session.close()


def test_scenes_off_seeds_exactly_three_clips(tmp_path: Path) -> None:
    seed_project_db(tmp_path, str(tmp_path / "session.mkv"))
    rows = _clips(tmp_path)
    assert len(rows) == 3
    assert {r.kind for r in rows} == {"clip"}
    assert sorted(round(r.score_overall, 2) for r in rows) == [0.20, 0.60, 0.85]
    assert {r.status for r in rows} == {"pending", "approved", "rejected"}


def test_filename_is_derived_from_the_media_path(tmp_path: Path) -> None:
    seed_project_db(tmp_path, str(tmp_path / "gameplay.mp4"))
    session = make_session(tmp_path / ".yuu-clip" / "project.db")
    try:
        assert session.query(Video).one().filename == "gameplay.mp4"
    finally:
        session.close()


def test_scenes_on_adds_scene_rows(tmp_path: Path) -> None:
    seed_project_db(tmp_path, str(tmp_path / "session.mp4"), with_scenes=True)
    kinds = Counter(r.kind for r in _clips(tmp_path))
    assert kinds == {"clip": 3, "scene": 2}


def test_creates_project_subdirs(tmp_path: Path) -> None:
    seed_project_db(tmp_path, str(tmp_path / "session.mkv"))
    data = tmp_path / ".yuu-clip"
    assert (data / "exports").is_dir()
    assert (data / "audio").is_dir()
    assert (data / "project.db").is_file()
