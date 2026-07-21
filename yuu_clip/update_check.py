# Feature-map - GitHub release update check (notify-only)
#   UI: static/core/updatecheck.js, static/settings/settings.js (status line + manual check)
#   Siblings: web/routes/updates.py · tests/unit/test_update_check.py
"""Compares the running version against the latest GitHub release tag.

Never downloads or installs anything - this only reports whether a newer
release exists and links to it. Never raises: a network failure or malformed
response comes back as an explicit `error` field so the UI can show "Couldn't
check for updates" instead of crashing.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

from yuu_clip.log import get_logger

_log = get_logger(__name__)

_REPO = "smitehamner/yuu-clip"
_TIMEOUT_S = 5.0


@dataclass
class UpdateCheckResult:
    current_version: str
    latest_version: Optional[str] = None
    update_available: bool = False
    release_url: Optional[str] = None
    error: Optional[str] = None


def _parse_version(version: str) -> tuple[int, ...]:
    """Parse a semver-ish string ('v0.1.28', '0.1.28-dev') into a comparable tuple.

    Only the numeric MAJOR.MINOR.PATCH prefix is compared - a pre-release suffix
    is ignored rather than rejected, since it can't be compared numerically anyway.
    """
    stripped = version.strip().lstrip("vV")
    numeric: list[int] = []
    for part in stripped.split("."):
        digits = ""
        for ch in part:
            if not ch.isdigit():
                break
            digits += ch
        if not digits:
            break
        numeric.append(int(digits))
    return tuple(numeric) or (0,)


def _fetch_latest_release(repo: str) -> dict:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    request = urllib.request.Request(url, headers={
        "User-Agent": "yuu-clip",
        "Accept": "application/vnd.github+json",
    })
    with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as response:
        return json.loads(response.read())


def check_for_update(current_version: str, repo: str = _REPO) -> UpdateCheckResult:
    """Fetch the latest GitHub release for *repo* and compare it to *current_version*.

    *repo* 404s unauthenticated while the GitHub repo stays private - that surfaces
    here as an ordinary error result, not an exception.
    """
    try:
        data = _fetch_latest_release(repo)
        latest_tag = data["tag_name"]
        release_url = data["html_url"]
    except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
        _log.info("Update check failed: %s", e)
        return UpdateCheckResult(current_version=current_version, error=str(e))

    latest_version = latest_tag.lstrip("vV")
    update_available = _parse_version(latest_version) > _parse_version(current_version)
    return UpdateCheckResult(
        current_version=current_version,
        latest_version=latest_version,
        update_available=update_available,
        release_url=release_url,
    )
