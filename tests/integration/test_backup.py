"""Stage 1 backup core + route: what's in the archive and how /api/backup serves it."""
from __future__ import annotations

import io
import json
import zipfile
from types import SimpleNamespace

from yuu_clip.project_archive import (
    BACKUP_SCHEMA_VERSION,
    INCLUDED_SUBDIRS,
    build_backup,
)

# Every large derived-media dir that can live under .yuu-clip/ (config helpers,
# deps.reels_dir, clips/crud.py preview_cache) plus a rogue dir a user might drop
# there. None of these belongs in a backup.
_DERIVED_DIRS = (
    "audio", "exports", "proxies", "downloads", "reels", "preview_cache", "testvideos",
)


def _seed_state_and_derived(project_dir) -> None:
    """Add the state the bare project_dir fixture omits (config.json, contexts.json,
    a custom sound) plus a junk file in each derived/media dir so the include-list
    is actually exercised."""
    data = project_dir / ".yuu-clip"
    (data / "config.json").write_text('{"theme": "dark"}', encoding="utf-8")
    (data / "contexts.json").write_text('{"my-world": {}}', encoding="utf-8")
    (data / "sounds").mkdir(exist_ok=True)
    (data / "sounds" / "ding.mp3").write_bytes(b"snd")
    for name in _DERIVED_DIRS:
        d = data / name
        d.mkdir(exist_ok=True)
        (d / "junk.bin").write_bytes(b"x" * 1024)


def _names_in(archive_path) -> set[str]:
    with zipfile.ZipFile(archive_path) as archive:
        return set(archive.namelist())


def test_backup_failure_leaves_no_partial_or_temp_file(project_dir, tmp_path, monkeypatch):
    """A failure mid-write (e.g. a file vanishing between listing and archiving)
    must not leave a partial/corrupt file at dest_path or a leaked .tmp file."""
    from yuu_clip import project_archive

    _seed_state_and_derived(project_dir)
    dest = tmp_path / "out.zip"

    def raising_state_files(_project_dir):
        raise OSError("simulated failure mid-backup")

    monkeypatch.setattr(project_archive, "_state_files", raising_state_files)
    try:
        build_backup(project_dir, dest)
    except OSError:
        pass
    assert not dest.exists()
    assert not dest.with_name(dest.name + ".tmp").exists()


def test_backup_contains_project_state(project_dir, tmp_path):
    _seed_state_and_derived(project_dir)
    archive = build_backup(project_dir, tmp_path / "out.zip")
    names = _names_in(archive)
    assert "manifest.json" in names
    assert ".yuu-clip/project.db" in names
    assert ".yuu-clip/config.json" in names
    assert ".yuu-clip/contexts.json" in names
    # Custom notification sounds are small user state and are backed up.
    assert ".yuu-clip/sounds/ding.mp3" in names


def test_backup_excludes_all_derived_media_dirs(project_dir, tmp_path):
    _seed_state_and_derived(project_dir)
    archive = build_backup(project_dir, tmp_path / "out.zip")
    names = _names_in(archive)
    for derived in _DERIVED_DIRS:
        prefix = f".yuu-clip/{derived}/"
        assert not any(name.startswith(prefix) for name in names), derived


def test_included_subdirs_never_contain_a_media_dir():
    """Guard: the state-subdir allowlist must never pick up a large derived dir,
    or a backup would balloon (the failure that motivated the allowlist)."""
    assert INCLUDED_SUBDIRS.isdisjoint(_DERIVED_DIRS)


def test_backup_excludes_sqlite_sidecars_and_logs(project_dir, tmp_path):
    data = project_dir / ".yuu-clip"
    (data / "project.db-wal").write_bytes(b"wal")
    (data / "project.db-shm").write_bytes(b"shm")
    (data / "yuu-clip.log").write_text("runtime log", encoding="utf-8")
    (data / "yuu-clip.log.1").write_text("rotated log", encoding="utf-8")
    archive = build_backup(project_dir, tmp_path / "out.zip")
    names = _names_in(archive)
    assert ".yuu-clip/project.db" in names
    assert ".yuu-clip/project.db-wal" not in names
    assert ".yuu-clip/project.db-shm" not in names
    assert ".yuu-clip/yuu-clip.log" not in names
    assert ".yuu-clip/yuu-clip.log.1" not in names


def test_backup_manifest_shape_and_source_paths(project_dir, tmp_path):
    archive = build_backup(project_dir, tmp_path / "out.zip")
    with zipfile.ZipFile(archive) as zf:
        manifest = json.loads(zf.read("manifest.json"))
    assert set(manifest) == {
        "schema_version",
        "app_version",
        "created_at",
        "project_name",
        "source_paths",
    }
    assert manifest["schema_version"] == BACKUP_SCHEMA_VERSION
    assert manifest["project_name"] == project_dir.name
    # The fixture seeds one Video at <project_dir>/session.mkv.
    assert manifest["source_paths"] == [str(project_dir)]


def test_source_paths_dedup_distinct_parents(project_dir, tmp_path):
    from yuu_clip.db.models import Video, make_session

    session = make_session(project_dir / ".yuu-clip" / "project.db")
    other = tmp_path / "elsewhere"
    session.add(Video(path=str(other / "b.mkv"), filename="b.mkv", status="done"))
    session.add(Video(path=str(other / "c.mkv"), filename="c.mkv", status="done"))
    session.commit()
    session.close()

    archive = build_backup(project_dir, tmp_path / "out.zip")
    with zipfile.ZipFile(archive) as zf:
        manifest = json.loads(zf.read("manifest.json"))
    assert manifest["source_paths"] == sorted([str(project_dir), str(other)])


def test_backup_route_streams_zip(client):
    resp = client.post("/api/backup")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(resp.content)) as archive:
        assert "manifest.json" in archive.namelist()
        assert ".yuu-clip/project.db" in archive.namelist()


def test_backup_route_writes_to_dest_path(client, tmp_path):
    dest = tmp_path / "explicit-backup.zip"
    resp = client.post("/api/backup", json={"dest_path": str(dest)})
    assert resp.status_code == 200
    assert resp.json()["path"] == str(dest)
    assert dest.exists()
    assert zipfile.is_zipfile(dest)


def test_backup_route_refused_while_analyzing(client):
    client.app.state.ctx.analyze_proc = SimpleNamespace(returncode=None)
    resp = client.post("/api/backup")
    assert resp.status_code == 409
