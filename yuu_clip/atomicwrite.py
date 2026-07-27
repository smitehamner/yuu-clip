"""Shared atomic-write + corrupt-file-preservation helpers for the small JSON
config files (config.json, contexts.json, profiles.json) that get rewritten on
every settings/context/track-layout change.

Extracted so project_archive.py's restore-path integrity guarantees (verify
before touching disk, never leave a half-written file) apply to these
frequently-rewritten files too, not just the one-shot backup/restore path.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path


def atomic_write_text(path: Path, text: str, encoding: str = "utf-8") -> None:
    """Write *text* to *path* so a crash mid-write can never leave a truncated file.

    Writes to a sibling temp file in the same directory (so the final ``os.replace``
    is a same-filesystem atomic rename, not a copy across filesystems) then swaps
    it into place. On any failure the temp file is removed and the original
    *path* is left untouched.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(text)
        os.replace(tmp_name, path)
    except Exception:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def read_json_object_or_backup_corrupt(path: Path, log: logging.Logger, label: str) -> dict:
    """Read a JSON object file for an overlay-style read-modify-write.

    Returns ``{}`` for a missing file. For an unreadable/invalid file (or one
    whose top level isn't a JSON object), renames it to ``<name>.corrupt.bak``
    (WARN-logged, overwriting any previous backup) so a hand-broken file's bytes
    are preserved rather than silently destroyed by the write that follows, then
    returns ``{}``.
    """
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("top-level JSON is not an object")
        return data
    except (ValueError, OSError) as exc:
        backup = path.with_name(path.name + ".corrupt.bak")
        path.replace(backup)
        log.warning(
            "%s at %s was unreadable (%s) - backed up to %s and rewritten",
            label, path, exc, backup,
        )
        return {}
