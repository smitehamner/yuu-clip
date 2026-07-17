"""``yuu-dev help-docs`` - copy the user guides into the packaged static dir.

The Help & Guides modal renders these markdown docs in-app (offline), so the app
must ship copies. ``docs/user/`` stays the single source of truth; this step
mirrors the four user-facing guides into ``yuu_clip/web/static/help/`` (which the
wheel ships) the same way ``glossary.md`` already ships.

Pure file copy - no Node, no build toolchain - so it runs everywhere and the drift
guard (``tests/unit/test_help_docs_drift.py``) can compare byte-for-byte on any
machine. Regenerate whenever a source doc changes and commit the result.
"""
from __future__ import annotations

from pathlib import Path

from yuu_clip.dev._base import REPO_ROOT, app, console

DOCS_USER_DIR = REPO_ROOT / "docs" / "user"
HELP_DIR = REPO_ROOT / "yuu_clip" / "web" / "static" / "help"

# (source path relative to docs/user, destination filename under static/help).
# Flat destination names so the in-app fetch URLs stay simple (/static/help/<name>).
HELP_DOCS: list[tuple[str, str]] = [
    ("OVERVIEW.md", "OVERVIEW.md"),
    ("FEATURES.md", "FEATURES.md"),
    ("tutorials/end-to-end-walkthrough.md", "end-to-end-walkthrough.md"),
    ("PERFORMANCE.md", "PERFORMANCE.md"),
]


def source_path(src_rel: str) -> Path:
    return DOCS_USER_DIR / src_rel


def dest_path(dest_name: str) -> Path:
    return HELP_DIR / dest_name


def sync_help_docs() -> list[Path]:
    """Copy every source guide into static/help/, returning the written paths."""
    HELP_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for src_rel, dest_name in HELP_DOCS:
        src = source_path(src_rel)
        if not src.exists():
            raise FileNotFoundError(f"help source doc missing: {src}")
        dst = dest_path(dest_name)
        dst.write_bytes(src.read_bytes())
        written.append(dst)
    return written


@app.command("help-docs")
def help_docs() -> None:
    """Copy docs/user guides into yuu_clip/web/static/help/ (in-app Help modal)."""
    for path in sync_help_docs():
        console.print(f"Wrote {path.relative_to(REPO_ROOT)}")
