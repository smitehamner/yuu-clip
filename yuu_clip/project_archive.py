# Feature-map — Project backup / restore (code: project_archive)
#   Backup core only (Stage 1). Restore + re-point engine land in Stage 2.
#   Siblings: web/routes/backup.py (routes) · config.py (project layout helpers)
#   Tests: tests/test_backup.py
"""Portable backup archive for a yuu-clip project.

Backs up the project's own durable state under ``.yuu-clip/`` — ``project.db``,
``config.json``, ``contexts.json``, and any other small state file — but not the
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
import tempfile
import zipfile
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version
from pathlib import Path

from sqlalchemy import text

from yuu_clip.config import project_db_path
from yuu_clip.db.models import Video, make_session
from yuu_clip.log import get_logger

_log = get_logger(__name__)

BACKUP_SCHEMA_VERSION = 1

# Large regenerable subdirectories under .yuu-clip/ that are NOT backed up. Pinned
# to the config.py project_*_dir helpers by tests/test_backup.py so a fifth derived
# dir can't be silently swept into the backup, and a new *state* file can't be
# silently excluded (the guard forces a conscious edit here).
EXCLUDED_DIRNAMES = frozenset({"audio", "exports", "proxies", "downloads"})

# SQLite runtime sidecars. We checkpoint the WAL into the main DB before archiving
# (so project.db is self-contained), then skip these — they are regenerated on the
# target and a stale copy alongside a checkpointed DB is only noise.
_SQLITE_SIDECAR_SUFFIXES = ("-wal", "-shm", "-journal")


def _app_version() -> str:
    try:
        return _pkg_version("yuu-clip")
    except PackageNotFoundError:
        return "unknown"


def _checkpoint_wal(db_path: Path) -> None:
    """Fold the write-ahead log into the main DB so the backed-up project.db is a
    complete point-in-time snapshot without its -wal sidecar. Best-effort: a
    checkpoint that loses the race for the write lock (busy_timeout guards it)
    should not abort the backup — the -wal is captured on the next attempt."""
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


def _state_files(project_dir: Path) -> list[Path]:
    """Every file under .yuu-clip/ worth backing up: excludes the four derived
    dirs and the SQLite runtime sidecars, keeps everything else."""
    root = project_dir / ".yuu-clip"
    collected: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRNAMES]
        for name in filenames:
            if _is_sqlite_sidecar(name):
                continue
            collected.append(Path(dirpath) / name)
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
        "app_version": _app_version(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "project_name": project_dir.name,
        "source_paths": _distinct_source_dirs(db_path),
    }

    if dest_path is None:
        dest_path = Path(tempfile.gettempdir()) / _default_backup_name(project_dir)
    dest_path = Path(dest_path)

    root = project_dir / ".yuu-clip"
    with zipfile.ZipFile(dest_path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        for file_path in _state_files(project_dir):
            arcname = (Path(".yuu-clip") / file_path.relative_to(root)).as_posix()
            archive.write(file_path, arcname)
    _log.info("Wrote project backup: %s", dest_path)
    return dest_path
