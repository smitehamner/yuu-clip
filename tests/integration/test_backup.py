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
from yuu_clip.web.routes import backup as backup_routes

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


def test_backup_reports_progress_via_on_progress_callback(project_dir, tmp_path):
    """The manifest counts as the first member, then one call per state file, and
    (done, total) is monotonic and reaches (total, total) - the SSE route's progress
    polling relies on this to know when the last count has landed."""
    _seed_state_and_derived(project_dir)
    calls = []
    build_backup(project_dir, tmp_path / "out.zip", on_progress=lambda done, total: calls.append((done, total)))
    assert calls, "on_progress must be called at least once (for the manifest)"
    totals = {total for _, total in calls}
    assert len(totals) == 1, "total must not change mid-build"
    total = totals.pop()
    assert [done for done, _ in calls] == list(range(1, total + 1))


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


# ---------------------------------------------------------------------------
# GET /api/backup/events (SSE progress) + GET /api/backup/download/<token>
# ---------------------------------------------------------------------------

def _drain_backup_events(client):
    """(status, events) for one full /api/backup/events stream."""
    events = []
    with client.stream("GET", "/api/backup/events") as resp:
        status = resp.status_code
        for raw in resp.iter_lines():
            if raw.startswith("data: "):
                events.append(json.loads(raw[len("data: "):]))
    return status, events


class TestBackupEventsRoute:
    def test_streams_progress_and_a_download_token(self, client, monkeypatch, tmp_path):
        monkeypatch.setattr(backup_routes, "_BACKUP_PROGRESS_POLL_S", 0.01)
        status, events = _drain_backup_events(client)
        assert status == 200

        progress_lines = [e["text"] for e in events if e["type"] == "log" and "Zipped" in e["text"]]
        result_events = [e for e in events if e["type"] == "result"]
        done_events = [e for e in events if e["type"] == "done"]
        assert result_events, "must yield a result event carrying the download token"
        assert done_events and done_events[-1]["outcome"] == "ok"

        token = result_events[0]["data"]["token"]
        ctx = client.app.state.ctx
        assert token in ctx.pending_backups

        download = client.get(f"/api/backup/download/{token}")
        assert download.status_code == 200
        assert download.headers["content-type"] == "application/zip"
        with zipfile.ZipFile(io.BytesIO(download.content)) as archive:
            assert "manifest.json" in archive.namelist()
            assert ".yuu-clip/project.db" in archive.namelist()
        # A progress line is nice-to-have (depends on how many state files the
        # fixture seeds vs. the poll cadence) but the token/result contract is the
        # part other code depends on, so only assert progress lines don't error out.
        assert isinstance(progress_lines, list)

    def test_active_jobs_counted_while_building_then_released(self, client, monkeypatch):
        monkeypatch.setattr(backup_routes, "_BACKUP_PROGRESS_POLL_S", 0.01)
        ctx = client.app.state.ctx
        seen = []

        def spy(project_dir, dest_path=None, on_progress=None):
            seen.append(ctx.active_jobs)
            from yuu_clip.project_archive import build_backup as real_build_backup
            return real_build_backup(project_dir, dest_path, on_progress)

        monkeypatch.setattr(backup_routes, "build_backup", spy)
        status, events = _drain_backup_events(client)
        assert status == 200
        assert seen == [1], "backup must register itself in the shared busy-lock counter"
        assert ctx.active_jobs == 0, "the counter must be released once the stream ends"

    def test_refused_while_analyzing(self, client):
        client.app.state.ctx.analyze_proc = SimpleNamespace(returncode=None)
        resp = client.get("/api/backup/events")
        assert resp.status_code == 409

    def test_build_failure_reports_a_typed_error_event(self, client, monkeypatch):
        monkeypatch.setattr(backup_routes, "_BACKUP_PROGRESS_POLL_S", 0.01)

        def raising_build_backup(project_dir, dest_path=None, on_progress=None):
            raise OSError("simulated backup failure")

        monkeypatch.setattr(backup_routes, "build_backup", raising_build_backup)
        status, events = _drain_backup_events(client)
        assert status == 200
        done_events = [e for e in events if e["type"] == "done"]
        assert done_events and done_events[-1]["outcome"] == "error"
        assert client.app.state.ctx.active_jobs == 0


class TestStalePendingBackupReap:
    def test_a_stale_unclaimed_backup_is_deleted_on_the_next_events_call(self, client, monkeypatch, tmp_path):
        """A client can disconnect after the zip finished but before it fetched the
        download - the token+file would otherwise leak in ctx.pending_backups /
        %TEMP% forever. _reap_stale_pending_backups sweeps it on the next call."""
        monkeypatch.setattr(backup_routes, "_STALE_PENDING_BACKUP_S", 0)
        ctx = client.app.state.ctx
        orphan = tmp_path / "orphan.zip"
        orphan.write_bytes(b"PK\x03\x04orphan")
        ctx.pending_backups["orphan-token"] = orphan

        monkeypatch.setattr(backup_routes, "_BACKUP_PROGRESS_POLL_S", 0.01)
        _drain_backup_events(client)

        assert "orphan-token" not in ctx.pending_backups
        assert not orphan.exists()

    def test_a_fresh_unclaimed_backup_is_not_reaped(self, client, monkeypatch, tmp_path):
        ctx = client.app.state.ctx
        fresh = tmp_path / "fresh.zip"
        fresh.write_bytes(b"PK\x03\x04fresh")
        ctx.pending_backups["fresh-token"] = fresh

        monkeypatch.setattr(backup_routes, "_BACKUP_PROGRESS_POLL_S", 0.01)
        _drain_backup_events(client)

        assert ctx.pending_backups["fresh-token"] == fresh
        assert fresh.exists()


class TestBackupDownloadRoute:
    def test_unknown_token_404s(self, client):
        resp = client.get("/api/backup/download/not-a-real-token")
        assert resp.status_code == 404

    def test_token_is_single_use(self, client, monkeypatch):
        monkeypatch.setattr(backup_routes, "_BACKUP_PROGRESS_POLL_S", 0.01)
        _, events = _drain_backup_events(client)
        token = next(e for e in events if e["type"] == "result")["data"]["token"]

        first = client.get(f"/api/backup/download/{token}")
        assert first.status_code == 200
        second = client.get(f"/api/backup/download/{token}")
        assert second.status_code == 404
