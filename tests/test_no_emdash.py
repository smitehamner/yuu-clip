"""Guard: no em-dash (U+2014) in tracked source (CLAUDE.md: "never use em-dashes,
anywhere"). The codebase was swept clean 2026-07 (see the em-dash sweep plan);
this locks the rule in so it cannot creep back.

Excludes vendored/third-party notice text, which may quote upstream text
verbatim, and non-text/binary files.
"""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
IN_SCOPE_DIRS = ["yuu_clip", "electron", "tests", "scripts", "docs"]

EXCLUDE_DIR_NAMES = {"node_modules", ".venv", "__pycache__", "build", "dist", ".git"}
EXCLUDE_PATH_MARKERS = [
    "THIRD-PARTY",
    "THIRD_PARTY",
    "third-party",
    "third_party",
    "LICENSE-FFMPEG-GPL",
]

EMDASH = "—"
SELF_PATH = Path(__file__).resolve()


def _in_scope_files():
    for dir_name in IN_SCOPE_DIRS:
        for path in (REPO_ROOT / dir_name).rglob("*"):
            if not path.is_file():
                continue
            if EXCLUDE_DIR_NAMES & set(path.relative_to(REPO_ROOT).parts):
                continue
            yield path
    yield from REPO_ROOT.glob("*.md")


def _is_excluded(path: Path) -> bool:
    relpath = str(path.relative_to(REPO_ROOT))
    return any(marker in relpath for marker in EXCLUDE_PATH_MARKERS)


def test_no_emdash_in_tracked_source():
    offenders = []
    for path in _in_scope_files():
        if path == SELF_PATH or _is_excluded(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, ValueError):
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if EMDASH in line:
                offenders.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {line.strip()}")

    assert offenders == [], (
        "em-dash (U+2014) found in tracked source; use a spaced hyphen ( - ) "
        "instead:\n" + "\n".join(offenders)
    )
