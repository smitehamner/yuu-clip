"""Stage 2 restore core + re-point engine: round-trip, path re-pointing, safety."""
from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from yuu_clip.db.models import ClipCandidate, Video, make_session
from yuu_clip.project_archive import (
    BACKUP_SCHEMA_VERSION,
    RestoreError,
    apply_repoint,
    build_backup,
    inspect_backup,
    plan_repoint,
    restore_into,
)


def _seed_db(db_path: Path, video_paths: list[Path]) -> None:
    session = make_session(db_path)
    for path in video_paths:
        session.add(Video(
            path=str(path), filename=os.path.basename(str(path)), status="done",
        ))
    session.commit()
    session.close()


# --- re-point engine (the crux) --------------------------------------------


def test_plan_repoint_groups_unresolved_by_parent(tmp_path):
    missing_dir = tmp_path / "gone"  # never created
    db = tmp_path / "p.db"
    _seed_db(db, [missing_dir / "a.mkv", missing_dir / "b.mkv"])
    groups = plan_repoint(db)
    assert len(groups) == 1
    assert groups[0].missing_dir == str(missing_dir)
    assert groups[0].file_count == 2
    assert set(groups[0].sample_filenames) == {"a.mkv", "b.mkv"}


def test_plan_repoint_zero_groups_when_all_resolve(tmp_path):
    real = tmp_path / "vid.mkv"
    real.write_bytes(b"x")
    db = tmp_path / "p.db"
    _seed_db(db, [real])
    assert plan_repoint(db) == []


def test_apply_repoint_remaps_only_files_present_at_new_location(tmp_path):
    old_dir = tmp_path / "old"  # missing
    new_dir = tmp_path / "new"
    new_dir.mkdir()
    (new_dir / "moved.mkv").write_bytes(b"x")  # moved, present at new dir
    db = tmp_path / "p.db"
    _seed_db(db, [old_dir / "moved.mkv", old_dir / "renamed.mkv"])

    result = apply_repoint(db, {str(old_dir): str(new_dir)})

    assert result.remapped == 1
    assert result.still_missing == 1  # renamed.mkv isn't at the new dir -> not guessed
    assert result.skipped_groups == 0
    session = make_session(db)
    paths = {v.filename: v.path for v in session.query(Video).all()}
    session.close()
    assert paths["moved.mkv"] == str(new_dir / "moved.mkv")
    assert paths["renamed.mkv"] == str(old_dir / "renamed.mkv")  # left as missing


def test_apply_repoint_counts_unmapped_groups_as_skipped(tmp_path):
    db = tmp_path / "p.db"
    _seed_db(db, [tmp_path / "d1" / "a.mkv", tmp_path / "d2" / "b.mkv"])
    result = apply_repoint(db, {})  # user skipped both groups
    assert (result.remapped, result.still_missing, result.skipped_groups) == (0, 0, 2)


# --- round-trip + safety ----------------------------------------------------


def test_backup_restore_round_trip_preserves_rows(project_dir, tmp_path):
    archive = build_backup(project_dir, tmp_path / "out.zip")
    target = tmp_path / "restored"
    db_path = restore_into(archive, target)
    session = make_session(db_path)
    video_count = session.query(Video).count()
    clip_count = session.query(ClipCandidate).count()
    session.close()
    assert video_count == 1
    assert clip_count == 3


def test_restore_refuses_existing_project_without_overwrite(project_dir, tmp_path):
    archive = build_backup(project_dir, tmp_path / "out.zip")
    target = tmp_path / "existing"
    (target / ".yuu-clip").mkdir(parents=True)
    (target / ".yuu-clip" / "project.db").write_bytes(b"OLD")
    with pytest.raises(RestoreError):
        restore_into(archive, target, overwrite=False)


def test_restore_overwrite_writes_pre_restore_safety_copy(project_dir, tmp_path):
    archive = build_backup(project_dir, tmp_path / "out.zip")
    target = tmp_path / "existing"
    (target / ".yuu-clip").mkdir(parents=True)
    existing_db = target / ".yuu-clip" / "project.db"
    existing_db.write_bytes(b"OLD-DB-CONTENT")

    restore_into(archive, target, overwrite=True)

    safety = target / ".yuu-clip" / "project.db.pre-restore"
    assert safety.exists()
    assert safety.read_bytes() == b"OLD-DB-CONTENT"


# --- manifest / schema validation ------------------------------------------


def test_restore_rejects_backup_missing_project_db(tmp_path):
    """A manifest-only backup passes inspect_backup but has no project.db member;
    restore_into must refuse before touching the target (it would otherwise drop the
    existing WAL for a restore that writes no DB)."""
    archive = tmp_path / "manifest_only.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("manifest.json", json.dumps({"schema_version": BACKUP_SCHEMA_VERSION}))
    target = tmp_path / "existing"
    (target / ".yuu-clip").mkdir(parents=True)
    existing_db = target / ".yuu-clip" / "project.db"
    existing_db.write_bytes(b"OLD-DB")
    wal = target / ".yuu-clip" / "project.db-wal"
    wal.write_bytes(b"WAL")

    with pytest.raises(RestoreError, match="missing its project database"):
        restore_into(archive, target, overwrite=True)

    assert existing_db.read_bytes() == b"OLD-DB"  # untouched
    assert wal.exists()  # WAL not dropped


def test_restore_rejects_zip_slip_member(tmp_path, caplog):
    """A backup carrying a path-traversal member must fail the whole restore, and
    must never write the escaping file outside the target dir (zip slip). The
    user-facing message is deliberately generic, so the offending member name must
    land in the log for a "restore failed" report to be diagnosable."""
    archive = tmp_path / "malicious.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("manifest.json", json.dumps({"schema_version": BACKUP_SCHEMA_VERSION}))
        zf.writestr(".yuu-clip/project.db", b"DB")
        zf.writestr("../escaped.txt", b"pwned")
    target = tmp_path / "restore_target"

    with caplog.at_level("ERROR", logger="yuu_clip.project_archive"):
        with pytest.raises(RestoreError, match="unsafe file path"):
            restore_into(archive, target, overwrite=True)

    assert not (tmp_path / "escaped.txt").exists()  # never escaped target_dir
    assert any("../escaped.txt" in record.message for record in caplog.records)


def test_restore_rejects_corrupt_archive_before_touching_target(tmp_path, caplog):
    """A backup whose central directory is intact (so its members are present) but
    whose data is corrupt - bit-rot on a portable backup, an interrupted build - must
    be refused up front. Restore copies the live project.db aside and drops its WAL
    before extracting, so a member that only fails its CRC mid-extract would otherwise
    leave the live DB half-overwritten with only an opaque error. The user-facing
    message is deliberately generic, so the failing member must land in the log for a
    "restore failed" report to be diagnosable."""
    good = tmp_path / "good.zip"
    with zipfile.ZipFile(good, "w", zipfile.ZIP_STORED) as zf:
        zf.writestr("manifest.json", json.dumps({"schema_version": BACKUP_SCHEMA_VERSION}))
        zf.writestr(".yuu-clip/project.db", b"REAL-DB-CONTENT")
    # Flip a byte inside the stored (uncompressed) project.db data so its CRC no longer
    # matches, while the zip's central directory - and therefore namelist() - stays intact.
    raw = bytearray(good.read_bytes())
    raw[raw.index(b"REAL-DB-CONTENT")] ^= 0xFF
    corrupt = tmp_path / "corrupt.zip"
    corrupt.write_bytes(raw)

    target = tmp_path / "existing"
    (target / ".yuu-clip").mkdir(parents=True)
    existing_db = target / ".yuu-clip" / "project.db"
    existing_db.write_bytes(b"OLD-DB")
    wal = target / ".yuu-clip" / "project.db-wal"
    wal.write_bytes(b"WAL")

    with caplog.at_level("ERROR", logger="yuu_clip.project_archive"):
        with pytest.raises(RestoreError, match="damaged"):
            restore_into(corrupt, target, overwrite=True)

    assert existing_db.read_bytes() == b"OLD-DB"  # untouched
    assert wal.exists()  # WAL not dropped
    assert any(".yuu-clip/project.db" in record.message for record in caplog.records)


def test_inspect_rejects_unsupported_schema(tmp_path):
    bad = tmp_path / "bad.zip"
    with zipfile.ZipFile(bad, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"schema_version": 999}))
    with pytest.raises(RestoreError, match="different version"):
        inspect_backup(bad)


def test_inspect_rejects_non_zip(tmp_path):
    junk = tmp_path / "junk.zip"
    junk.write_bytes(b"not a zip file at all")
    with pytest.raises(RestoreError, match="not a valid"):
        inspect_backup(junk)


def test_inspect_rejects_manifest_that_is_not_json(tmp_path):
    # A valid zip whose manifest.json member is present but unparseable (e.g.
    # truncated by a bad transfer) - a distinct failure mode from "not a zip at all".
    bad = tmp_path / "bad-manifest.zip"
    with zipfile.ZipFile(bad, "w") as archive:
        archive.writestr("manifest.json", "{ not json")
    with pytest.raises(RestoreError, match="unreadable"):
        inspect_backup(bad)


# --- plan_repoint_from_archive (the restore-preview path) -------------------


def test_plan_repoint_from_archive_reports_manifest_and_groups(project_dir, tmp_path):
    # project_dir's fixture seed already carries one unresolved video (session.mkv
    # is never written to disk) - reuse it rather than seeding a second row.
    from yuu_clip.project_archive import plan_repoint_from_archive

    archive = build_backup(project_dir, tmp_path / "out.zip")

    manifest, groups = plan_repoint_from_archive(archive)

    assert manifest["schema_version"] == BACKUP_SCHEMA_VERSION
    assert len(groups) == 1
    assert groups[0].missing_dir == str(project_dir)
    assert groups[0].file_count == 1


def test_plan_repoint_from_archive_rejects_archive_missing_project_db(tmp_path):
    from yuu_clip.project_archive import plan_repoint_from_archive

    archive = tmp_path / "no-db.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("manifest.json", json.dumps({"schema_version": BACKUP_SCHEMA_VERSION}))
    with pytest.raises(RestoreError, match="missing its project database"):
        plan_repoint_from_archive(archive)


# --- routes -----------------------------------------------------------------


def test_restore_inspect_route_returns_manifest_and_missing_group(client, project_dir, tmp_path):
    archive = build_backup(project_dir, tmp_path / "out.zip")
    resp = client.post("/api/restore/inspect", content=archive.read_bytes())
    assert resp.status_code == 200
    data = resp.json()
    assert data["manifest"]["schema_version"] == 1
    assert data["staging_path"]
    # The fixture's one video lives at <project_dir>/session.mkv, which is never
    # written to disk, so it surfaces as a single unresolved-source group.
    assert len(data["groups"]) == 1
    assert data["groups"][0]["missing_dir"] == str(project_dir)


def test_restore_inspect_route_rejects_bad_upload(client):
    resp = client.post("/api/restore/inspect", content=b"garbage")
    assert resp.status_code == 400


def test_restore_apply_route_switches_to_restored_project(client, project_dir, tmp_path):
    archive = build_backup(project_dir, tmp_path / "out.zip")
    target = tmp_path / "restored"
    resp = client.post("/api/restore/apply", json={
        "archive_path": str(archive),
        "target_dir": str(target),
        "mapping": {},
        "overwrite": False,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert Path(data["current"]) == target.resolve()
    assert data["repoint"]["skipped_groups"] == 1  # unresolved fixture video dir


def test_restore_inspect_refused_while_analyzing(client):
    client.app.state.ctx.analyze_proc = SimpleNamespace(returncode=None)
    resp = client.post("/api/restore/inspect", content=b"whatever")
    assert resp.status_code == 409


def test_restore_refused_while_counted_job_running(client):
    # Same contract as /api/projects/switch: ANY running job (rescore, timeline,
    # proxy) blocks a restore - switch_project would rebind ctx under it.
    client.app.state.ctx.active_jobs = 1
    try:
        resp = client.post("/api/restore/inspect", content=b"whatever")
        assert resp.status_code == 409
        backup_resp = client.post("/api/backup", json={})
        assert backup_resp.status_code == 409
    finally:
        client.app.state.ctx.active_jobs = 0


# --- CLI restore command (used by the first-run wizard) ---------------------


def test_cli_restore_unpacks_into_fresh_folder(project_dir, tmp_path):
    from typer.testing import CliRunner

    from yuu_clip.cli import app

    archive = build_backup(project_dir, tmp_path / "out.zip")
    target = tmp_path / "restored"
    result = CliRunner().invoke(
        app, ["restore", "--archive", str(archive), "--project", str(target)]
    )
    assert result.exit_code == 0, result.output
    assert (target / ".yuu-clip" / "project.db").exists()


def test_cli_restore_exits_2_when_project_exists(project_dir, tmp_path):
    from typer.testing import CliRunner

    from yuu_clip.cli import app

    archive = build_backup(project_dir, tmp_path / "out.zip")
    target = tmp_path / "existing"
    (target / ".yuu-clip").mkdir(parents=True)
    (target / ".yuu-clip" / "project.db").write_bytes(b"OLD")

    result = CliRunner().invoke(
        app, ["restore", "--archive", str(archive), "--project", str(target)]
    )
    assert result.exit_code == 2, result.output
    # --overwrite proceeds and keeps the safety copy.
    result = CliRunner().invoke(
        app, ["restore", "--archive", str(archive), "--project", str(target), "--overwrite"]
    )
    assert result.exit_code == 0, result.output
    assert (target / ".yuu-clip" / "project.db.pre-restore").exists()


def test_cli_restore_exits_1_when_archive_missing(tmp_path):
    from typer.testing import CliRunner

    from yuu_clip.cli import app

    result = CliRunner().invoke(
        app, ["restore", "--archive", str(tmp_path / "nope.zip"), "--project", str(tmp_path / "t")]
    )
    assert result.exit_code == 1
