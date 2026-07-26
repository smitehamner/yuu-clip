"""Path-containment predicate shared by every path-traversal guard.

One kernel for "does *target* resolve inside *base*?" so the media server, the
backup restore extractor, and the reveal-in-Explorer guard can't drift into
subtly different traversal checks. The predicate is pure: callers resolve their
own paths first (so each owns its symlink-resolution policy) and keep their own
error type (HTTPException vs RestoreError vs a boolean gate).
"""
from __future__ import annotations

from pathlib import Path


def is_within(target: Path, base: Path) -> bool:
    """True when *target* is *base* itself or lives inside it. Both paths should
    already be resolved by the caller. Uses the flavour's own case rules
    (case-insensitive on Windows)."""
    try:
        target.relative_to(base)
        return True
    except ValueError:
        return False
