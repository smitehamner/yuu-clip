"""Guard: no em-dash or en-dash in tracked source (CLAUDE.md: "never use em-dashes,
anywhere", and ASCII by default for all authored text). The codebase was swept clean
2026-07 (see the em-dash sweep plan); this locks the rule in so it cannot creep back.

Scope covers the public-facing surfaces too - `.github/` (CONTRIBUTING, SECURITY, the
issue/PR templates) and the root config dotfiles are authored text a visitor reads,
and both sat outside the original directory list.

Excludes vendored/third-party notice text, which may quote upstream text
verbatim, and non-text/binary files.
"""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
IN_SCOPE_DIRS = ["yuu_clip", "electron", "tests", "scripts", "docs", ".github"]
ROOT_EXTRA_FILES = [
    ".gitattributes",
    ".gitignore",
    ".claudeignore",
    "pyproject.toml",
    "package.json",
    "pytest.ini",
    "alembic.ini",
    "vitest.config.mjs",
]

EXCLUDE_DIR_NAMES = {"node_modules", ".venv", "__pycache__", "build", "dist", ".git"}
EXCLUDE_PATH_MARKERS = [
    "THIRD-PARTY",
    "THIRD_PARTY",
    "third-party",
    "third_party",
    "LICENSE-FFMPEG-GPL",
]

EMDASH = "—"
ENDASH = "–"
# A UTF-8 em-dash (bytes E2 80 94) that was decoded as cp1252 and re-saved as
# UTF-8 shows up as this trigram. It renders as garbage and, in console/SSE
# strings, risks UnicodeEncodeError - but it is NOT a literal U+2014, so it
# slips past the EMDASH check. Guard it explicitly (see render.py mojibake, 2026-07).
EMDASH_MOJIBAKE = "â€”"
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
    for file_name in ROOT_EXTRA_FILES:
        candidate = REPO_ROOT / file_name
        if candidate.is_file():
            yield candidate


def _is_excluded(path: Path) -> bool:
    relpath = str(path.relative_to(REPO_ROOT))
    return any(marker in relpath for marker in EXCLUDE_PATH_MARKERS)


def _offenders(banned: tuple[str, ...]) -> list[str]:
    found = []
    for path in _in_scope_files():
        if path == SELF_PATH or _is_excluded(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, ValueError):
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if any(bad in line for bad in banned):
                found.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {line.strip()}")
    return found


def test_no_emdash_in_tracked_source():
    offenders = _offenders((EMDASH, EMDASH_MOJIBAKE))
    assert offenders == [], (
        "em-dash (U+2014, or its cp1252 mojibake) found in tracked source; use a "
        "spaced hyphen ( - ) instead:\n" + "\n".join(offenders)
    )


def test_no_endash_in_tracked_source():
    offenders = _offenders((ENDASH,))
    assert offenders == [], (
        "en-dash (U+2013) found in tracked source; use a plain hyphen (-) for "
        "ranges and a spaced hyphen ( - ) for asides:\n" + "\n".join(offenders)
    )
