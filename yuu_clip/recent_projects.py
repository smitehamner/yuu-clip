"""
Recently-opened-projects list (the project switcher's MRU), stored in the
global config dir alongside config.json.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from yuu_clip import config as _config

_log = logging.getLogger(__name__)

# Cap on the recent-projects list so it never grows without bound.
_KNOWN_PROJECTS_MAX = 20


def _known_projects_path() -> Path:
    return _config._global_config_dir() / "projects.json"


def load_known_projects() -> list[dict]:
    """Load the recent-projects list (most-recent first) from the global config dir.

    Each entry is ``{path, last_opened_at}``. Returns [] on a missing or
    hand-corrupted file rather than raising - the switcher must still open.
    """
    p = _known_projects_path()
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        _log.warning("projects.json is unreadable - ignoring recent-projects list")
        return []
    if not isinstance(data, list):
        return []
    return [e for e in data if isinstance(e, dict) and isinstance(e.get("path"), str)]


def record_known_project(project_dir: Path) -> None:
    """Move *project_dir* to the front of the recent-projects list (dedup by
    resolved path), stamping ``last_opened_at``."""
    resolved = str(Path(project_dir).resolve())
    now = datetime.now(timezone.utc).isoformat()
    projects = [e for e in load_known_projects() if e.get("path") != resolved]
    projects.insert(0, {"path": resolved, "last_opened_at": now})
    del projects[_KNOWN_PROJECTS_MAX:]
    p = _known_projects_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(projects, indent=2), encoding="utf-8")
