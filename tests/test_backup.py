"""Stage 1 backup core + route: what's in the archive and how /api/backup serves it."""
from __future__ import annotations

import io
import json
import zipfile
from types import SimpleNamespace

from yuu_clip.config import (
    project_audio_dir,
    project_downloads_dir,
    project_exports_dir,
    project_proxies_dir,
)
from yuu_clip.project_archive import (
    BACKUP_SCHEMA_VERSION,
    EXCLUDED_DIRNAMES,
    build_backup,
)


def _seed_state_and_derived(project_dir) -> None:
    """Add the two state files the bare project_dir fixture omits, plus a junk file
    in each derived dir so exclusion is actually exercised."""
    data = project_dir / ".yuu-clip"
    (data / "config.json").write_text('{"theme": "dark"}', encoding="utf-8")
    (data / "contexts.json").write_text('{"my-world": {}}', encoding="utf-8")
    for make_dir in (
        project_audio_dir,
        project_exports_dir,
        project_proxies_dir,
        project_downloads_dir,
    ):
        (make_dir(project_dir) / "junk.bin").write_bytes(b"x" * 1024)


def _names_in(archive_path) -> set[str]:
    with zipfile.ZipFile(archive_path) as archive:
        return set(archive.namelist())


def test_backup_contains_project_state(project_dir, tmp_path):
    _seed_state_and_derived(project_dir)
    archive = build_backup(project_dir, tmp_path / "out.zip")
    names = _names_in(archive)
    assert "manifest.json" in names
    assert ".yuu-clip/project.db" in names
    assert ".yuu-clip/config.json" in names
    assert ".yuu-clip/contexts.json" in names


def test_backup_excludes_derived_dirs(project_dir, tmp_path):
    _seed_state_and_derived(project_dir)
    archive = build_backup(project_dir, tmp_path / "out.zip")
    names = _names_in(archive)
    for excluded in EXCLUDED_DIRNAMES:
        prefix = f".yuu-clip/{excluded}/"
        assert not any(name.startswith(prefix) for name in names), excluded


def test_backup_excludes_sqlite_sidecars(project_dir, tmp_path):
    data = project_dir / ".yuu-clip"
    (data / "project.db-wal").write_bytes(b"wal")
    (data / "project.db-shm").write_bytes(b"shm")
    archive = build_backup(project_dir, tmp_path / "out.zip")
    names = _names_in(archive)
    assert ".yuu-clip/project.db" in names
    assert ".yuu-clip/project.db-wal" not in names
    assert ".yuu-clip/project.db-shm" not in names


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


def test_exclude_list_pinned_to_config_helpers(tmp_path):
    """Guard: the exclude-list must equal the basenames of the config.py derived-dir
    helpers, so a fifth derived dir forces a conscious edit to EXCLUDED_DIRNAMES."""
    helper_names = {
        project_audio_dir(tmp_path).name,
        project_exports_dir(tmp_path).name,
        project_proxies_dir(tmp_path).name,
        project_downloads_dir(tmp_path).name,
    }
    assert helper_names == set(EXCLUDED_DIRNAMES)


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
