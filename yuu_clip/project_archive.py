# Feature-map - Project backup / restore (code: project_archive)
#   Archive core: backup (build_backup), restore (restore_into), and the re-point
#   engine (plan_repoint / apply_repoint) that fixes source-media paths that don't
#   resolve on the target machine.
#   Siblings: web/routes/backup.py (routes) · config.py (project layout helpers)
#   Tests: tests/integration/test_backup.py, tests/integration/test_restore.py
"""Portable backup archive for a yuu-clip project.

Backs up the project's own durable state under ``.yuu-clip/`` - ``project.db``,
``config.json``, ``contexts.json``, and any other small state file - but not the
large regenerable derived media (``audio/``, ``exports/``, ``proxies/``,
``downloads/``). Source videos live *outside* the project and are never included;
restore re-points their paths on the target machine instead.

The archive is a plain ``.zip`` (Open Question 3: transparent, nothing to explain)
laid out so that restore is a straight ``extractall`` into the target project dir:

    manifest.json
    .yuu-clip/project.db
    .yuu-clip/config.json
    .yuu-clip/contexts.json
    ...
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import zipfile
import zlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from yuu_clip.appversion import app_version
from yuu_clip.config import project_db_path
from yuu_clip.db.models import Video, make_engine, make_session
from yuu_clip.log import get_logger
from yuu_clip.pathsafety import is_within

_log = get_logger(__name__)

BACKUP_SCHEMA_VERSION = 1

# Arcname of the SQLite DB inside the archive (see build_backup's layout).
_DB_ARCNAME = ".yuu-clip/project.db"

# Cap on the example filenames shown per missing-directory group in the re-point UI.
_SAMPLE_LIMIT = 5


class RestoreError(Exception):
    """A backup that can't be restored, with a message safe to show the user."""


class ProjectExistsError(RestoreError):
    """The restore target already holds a project and overwrite wasn't requested -
    a recoverable condition the UI turns into a 'replace it?' confirm."""

# Small state subdirectories under .yuu-clip/ that ARE backed up. This is an
# allowlist, not a skip-list, and deliberately so: .yuu-clip/ holds several large
# regenerable media dirs (audio/, exports/, proxies/, downloads/, reels/,
# preview_cache/) and can accumulate more, so a skip-list would keep sweeping new
# multi-GB dirs into a "small" backup (a real 53 GB dir was caught this way).
# An allowlist bounds the backup to known state. Top-level *files* are always
# captured (project.db, config.json, contexts.json, any future small state file),
# so a new state file is never silently dropped - only a new state *subdir* would
# need adding here.
INCLUDED_SUBDIRS = frozenset({"sounds"})

# SQLite runtime sidecars. We checkpoint the WAL into the main DB before archiving
# (so project.db is self-contained), then skip these - they are regenerated on the
# target and a stale copy alongside a checkpointed DB is only noise.
_SQLITE_SIDECAR_SUFFIXES = ("-wal", "-shm", "-journal")


def _checkpoint_wal(db_path: Path) -> None:
    """Fold the write-ahead log into the main DB so the backed-up project.db is a
    complete point-in-time snapshot without its -wal sidecar. Best-effort: a
    checkpoint that loses the race for the write lock (busy_timeout guards it)
    should not abort the backup - the -wal is captured on the next attempt."""
    if not db_path.exists():
        return
    session = make_session(db_path)
    try:
        session.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    except Exception as exc:  # noqa: BLE001 - checkpoint failure must not abort backup
        _log.warning("WAL checkpoint before backup failed (continuing): %s", exc)
    finally:
        session.close()


def _is_sqlite_sidecar(name: str) -> bool:
    return any(name.endswith(suffix) for suffix in _SQLITE_SIDECAR_SUFFIXES)


def _is_runtime_file(name: str) -> bool:
    """Top-level files that aren't durable state and must stay out of a backup:
    SQLite runtime sidecars and the (unbounded, non-state) log file + rotations."""
    return _is_sqlite_sidecar(name) or ".log" in name


def _state_files(project_dir: Path) -> list[Path]:
    """Durable state to back up: every top-level file under .yuu-clip/ (minus the
    SQLite runtime sidecars and the log) plus the files inside each allowlisted
    state subdir. Large derived-media dirs are skipped - see INCLUDED_SUBDIRS."""
    root = project_dir / ".yuu-clip"
    collected: list[Path] = []
    for entry in sorted(root.iterdir()):
        if entry.is_file():
            if not _is_runtime_file(entry.name):
                collected.append(entry)
        elif entry.is_dir() and entry.name in INCLUDED_SUBDIRS:
            collected.extend(sorted(p for p in entry.rglob("*") if p.is_file()))
    return collected


def _distinct_source_dirs(db_path: Path) -> list[str]:
    """Distinct parent directories of every Video.path, for the restore preview.

    Deduped case-insensitively (Windows) but preserving the first-seen original
    spelling, sorted for a stable manifest."""
    if not db_path.exists():
        return []
    session = make_session(db_path)
    try:
        paths = [row[0] for row in session.query(Video.path).all()]
    finally:
        session.close()
    first_seen: dict[str, str] = {}
    for path in paths:
        parent = os.path.dirname(path)
        key = os.path.normcase(parent)
        first_seen.setdefault(key, parent)
    return sorted(first_seen.values())


def _default_backup_name(project_dir: Path) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"{project_dir.name}-backup-{stamp}.zip"


def build_backup(project_dir: Path, dest_path: Path | None = None) -> Path:
    """Write a portable backup zip of *project_dir* and return its path.

    Writes to a temp file when *dest_path* is omitted (the browser-download path);
    the caller is responsible for streaming and cleaning up that temp file."""
    project_dir = Path(project_dir)
    db_path = project_db_path(project_dir)
    _checkpoint_wal(db_path)

    manifest = {
        "schema_version": BACKUP_SCHEMA_VERSION,
        "app_version": app_version(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "project_name": project_dir.name,
        "source_paths": _distinct_source_dirs(db_path),
    }

    if dest_path is None:
        dest_path = Path(tempfile.gettempdir()) / _default_backup_name(project_dir)
    dest_path = Path(dest_path)

    root = project_dir / ".yuu-clip"
    tmp_path = dest_path.with_name(dest_path.name + ".tmp")
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json", json.dumps(manifest, indent=2))
            for file_path in _state_files(project_dir):
                arcname = (Path(".yuu-clip") / file_path.relative_to(root)).as_posix()
                archive.write(file_path, arcname)
        os.replace(tmp_path, dest_path)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise
    _log.info("Wrote project backup: %s", dest_path)
    return dest_path


# ---------------------------------------------------------------------------
# Restore + re-point engine (Stage 2)
# ---------------------------------------------------------------------------


@dataclass
class RepointGroup:
    """A source directory that no longer resolves on this machine, with the count
    of videos under it and a few example filenames for the re-point prompt."""

    missing_dir: str
    file_count: int
    sample_filenames: list[str] = field(default_factory=list)


@dataclass
class RepointResult:
    remapped: int
    still_missing: int
    skipped_groups: int


def _validate_manifest(manifest: dict) -> None:
    version = manifest.get("schema_version")
    if version != BACKUP_SCHEMA_VERSION:
        raise RestoreError(
            "This backup was made by a different version of yuu-clip "
            f"(backup format {version!r}, this app expects {BACKUP_SCHEMA_VERSION}) "
            "and can't be restored here."
        )


def inspect_backup(archive_path: Path) -> dict:
    """Read and validate the manifest without unpacking the archive."""
    try:
        with zipfile.ZipFile(archive_path) as archive:
            raw = archive.read("manifest.json")
    except (zipfile.BadZipFile, KeyError, OSError) as exc:
        raise RestoreError("This file is not a valid yuu-clip backup.") from exc
    try:
        manifest = json.loads(raw)
    except ValueError as exc:
        raise RestoreError("This backup's manifest is unreadable.") from exc
    _validate_manifest(manifest)
    return manifest


def plan_repoint(db_path: Path) -> list[RepointGroup]:
    """Group every Video whose source path doesn't resolve on this machine by its
    parent directory (case-insensitively), preserving the original spelling."""
    engine = make_engine(Path(db_path))
    groups: dict[str, RepointGroup] = {}
    try:
        with Session(engine) as session:
            for video in session.query(Video).all():
                if Path(video.path).exists():
                    continue
                parent = os.path.dirname(video.path)
                key = os.path.normcase(parent)
                group = groups.get(key)
                if group is None:
                    group = RepointGroup(missing_dir=parent, file_count=0)
                    groups[key] = group
                group.file_count += 1
                if len(group.sample_filenames) < _SAMPLE_LIMIT:
                    group.sample_filenames.append(os.path.basename(video.path))
    finally:
        engine.dispose()
    return sorted(groups.values(), key=lambda g: g.missing_dir)


def apply_repoint(db_path: Path, mapping: dict[str, str]) -> RepointResult:
    """Rewrite Video.path for each unresolved video whose parent dir the user mapped
    to a new location, but only when the file actually exists at that new location -
    a renamed (not just moved) file stays missing and is counted, never guessed."""
    normalized = {os.path.normcase(old): new for old, new in mapping.items()}
    engine = make_engine(Path(db_path))
    remapped = still_missing = 0
    unresolved_keys: set[str] = set()
    try:
        with Session(engine) as session:
            for video in session.query(Video).all():
                if Path(video.path).exists():
                    continue
                key = os.path.normcase(os.path.dirname(video.path))
                unresolved_keys.add(key)
                new_dir = normalized.get(key)
                if new_dir is None:
                    continue
                candidate = Path(new_dir) / os.path.basename(video.path)
                if candidate.exists():
                    video.path = str(candidate)
                    remapped += 1
                else:
                    still_missing += 1
            session.commit()
    finally:
        engine.dispose()
    skipped_groups = len(unresolved_keys - set(normalized))
    return RepointResult(
        remapped=remapped, still_missing=still_missing, skipped_groups=skipped_groups
    )


def plan_repoint_from_archive(archive_path: Path) -> tuple[dict, list[RepointGroup]]:
    """Manifest + missing-source-dir groups for a backup, computed against the
    *current* filesystem without unpacking into the target (the restore preview)."""
    manifest = inspect_backup(archive_path)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        # Mirror the real layout (<proj>/.yuu-clip/project.db) so make_engine's
        # backfill, which derives the project dir as db_path.parent.parent, keeps
        # its stray exports-dir mkdir inside this temp tree instead of %TEMP% root.
        db_dest = Path(tmp) / ".yuu-clip" / "project.db"
        db_dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            with zipfile.ZipFile(archive_path) as archive, \
                    archive.open(_DB_ARCNAME) as src, open(db_dest, "wb") as dst:
                shutil.copyfileobj(src, dst)
        except KeyError as exc:
            raise RestoreError("This backup is missing its project database.") from exc
        groups = plan_repoint(db_dest)
    return manifest, groups


def restore_into(archive_path: Path, target_dir: Path, overwrite: bool = False) -> Path:
    """Unpack a validated backup into *target_dir* and return the restored DB path.

    Refuses a target that already holds a non-empty project unless *overwrite* is
    set; when overwriting, the existing project.db is first copied to
    project.db.pre-restore so a restore can never be the thing that loses data."""
    inspect_backup(archive_path)  # validates schema before we touch the target
    target_dir = Path(target_dir)
    with zipfile.ZipFile(archive_path) as archive:
        # inspect_backup only checks the manifest; guard the DB member too, or the
        # overwrite path below would drop the old WAL for a backup that then writes
        # no project.db - the same check plan_repoint_from_archive already makes.
        if _DB_ARCNAME not in archive.namelist():
            raise RestoreError("This backup is missing its project database.")
        # Verify the whole archive (CRC integrity + zip-slip safety) BEFORE any target
        # mutation. The overwrite path below copies the live project.db aside and drops
        # its WAL before extracting; a corrupt member (bit-rot on a portable backup, an
        # interrupted build) or an unsafe path must fail here, cleanly and with the
        # target untouched, rather than surface as a BadZipFile mid-extract after the
        # live DB was already half-overwritten.
        _verify_restorable(archive, target_dir)
    existing_db = target_dir / ".yuu-clip" / "project.db"
    if existing_db.exists() and existing_db.stat().st_size > 0:
        if not overwrite:
            raise ProjectExistsError(
                "The target folder already contains a project. Confirm overwrite to "
                "replace it."
            )
        shutil.copy2(existing_db, existing_db.with_name("project.db.pre-restore"))
        # Drop the old project's WAL sidecars - replaying them onto the restored DB
        # would corrupt it (the backup carries a fully checkpointed project.db).
        for suffix in _SQLITE_SIDECAR_SUFFIXES:
            existing_db.with_name(existing_db.name + suffix).unlink(missing_ok=True)

    with zipfile.ZipFile(archive_path) as archive:
        _extract_members(archive, target_dir)
    _log.info("Restored project into %s", target_dir)
    return project_db_path(target_dir)


def _reject_unsafe_member(name: str, target_dir: Path, target_root: Path) -> None:
    """Raise if *name* would resolve outside *target_dir* (zip slip). ``ZipFile.extract``
    already strips ``..`` and drive letters, so this is defense in depth - but a hostile
    member should fail the whole restore loudly, not be silently rewritten and dropped."""
    dest = (target_dir / name).resolve()
    if not is_within(dest, target_root):
        _log.error(
            "Backup restore rejected unsafe member %r - resolves to %s, outside target %s",
            name, dest, target_root,
        )
        raise RestoreError(
            "This backup contains an unsafe file path and was not restored."
        )


def _verify_restorable(archive: zipfile.ZipFile, target_dir: Path) -> None:
    """Fail the restore before it mutates the target if the archive is corrupt or
    carries an unsafe path. ``testzip`` CRC-checks every member (backups hold only the
    small state files, never the large derived media, so this is cheap)."""
    try:
        bad_member = archive.testzip()
    except (zipfile.BadZipFile, OSError, EOFError, zlib.error) as exc:
        _log.error("Backup restore aborted - archive failed integrity check: %s", exc)
        raise RestoreError(
            "This backup is damaged and was not restored."
        ) from exc
    if bad_member is not None:
        _log.error("Backup restore aborted - member %r failed its CRC check", bad_member)
        raise RestoreError(
            "This backup is damaged (a file inside it failed its integrity check) "
            "and was not restored."
        )
    target_root = target_dir.resolve()
    for name in archive.namelist():
        if name != "manifest.json":
            _reject_unsafe_member(name, target_dir, target_root)


def _extract_members(archive: zipfile.ZipFile, target_dir: Path) -> None:
    """Extract every member except the manifest. The archive was already integrity-
    and zip-slip-checked by _verify_restorable before the target was touched; the
    per-member check here stays as defense in depth on the actual write."""
    target_root = target_dir.resolve()
    for name in archive.namelist():
        if name == "manifest.json":
            continue
        _reject_unsafe_member(name, target_dir, target_root)
        archive.extract(name, target_dir)
