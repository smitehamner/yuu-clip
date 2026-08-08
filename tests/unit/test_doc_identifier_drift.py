"""Drift guards binding doc-stated code names to code that actually exists.

Two surfaces name code identifiers in prose and go stale silently:

* ``docs/dev/llm/GLOSSARY.md`` - the ``Code`` column of its tables and its
  ``- **Code:**`` prose lines.
* the ``# Feature-map`` header comment block at the top of a ``yuu_clip`` module.

A backticked name in a glossary Code position, or a snake_case/CamelCase name or
file path in a Feature-map header, is a claim about this repo's code. These tests
fail when the claim stops being true. A name a doc states on purpose before it is
built carries a literal ``(planned)`` marker right after the backticks; that is the
only way to exempt one - there is no allowlist in here.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GLOSSARY = REPO / "docs" / "dev" / "llm" / "GLOSSARY.md"
PACKAGE = REPO / "yuu_clip"

# The source tree = shipped code plus the config/manifest files that carry real
# identifiers; docs/ and tests/ are excluded, so a name surviving only in prose or in
# a test fixture still counts as missing.
SOURCE_DIRS = ("yuu_clip", "electron", "scripts")
SOURCE_MANIFESTS = (
    "pyproject.toml",
    "package.json",
    "alembic.ini",
    "pytest.ini",
    "requirements.lock",
    "vitest.config.mjs",
)
SOURCE_SUFFIXES = {".py", ".js", ".mjs", ".css", ".html", ".json", ".toml", ".ini", ".ps1"}
# Committed build artifacts: their contents are generated from the sources above, so
# a name that only survives in one of them is stale, not shipped.
GENERATED = {
    PACKAGE / "web" / "static" / "bundle.esm.js",
    PACKAGE / "web" / "static" / "index.html",
    REPO / "electron" / "setup.bundle.js",
}
SKIPPED_DIRS = {"node_modules", "__pycache__", ".venv", "dist", "build"}

# Where a doc-stated relative path may be rooted.
PATH_ROOTS = (REPO, PACKAGE, PACKAGE / "web", PACKAGE / "web" / "static")
PATH_SUFFIXES = (".py", ".js", ".mjs", ".css", ".html", ".json", ".toml", ".ini", ".ps1", ".md")

HTTP_VERBS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
PLANNED = "(planned)"
GLOB_MIN_LITERALS = 4

_WORD = re.compile(r"[A-Za-z0-9_]+")
_PLAIN_WORD = re.compile(r"[A-Za-z0-9_]+\Z")
_CSS_VAR = re.compile(r"--[A-Za-z0-9_-]+\Z")
_IDENTIFIER_GLOB = re.compile(r"[A-Za-z0-9_*]*\*[A-Za-z0-9_*]*\Z")


@dataclass(frozen=True)
class Claim:
    """One code name a doc states, with enough context to find it again."""

    term: str
    name: str
    line: int
    # Files the surrounding doc entry names; its own identifiers may live there too.
    scope: tuple[Path, ...] = field(default=())


@lru_cache(maxsize=1)
def _source_files() -> tuple[Path, ...]:
    found = [REPO / name for name in SOURCE_MANIFESTS if (REPO / name).is_file()]
    for directory in SOURCE_DIRS:
        for path in (REPO / directory).rglob("*"):
            if path.suffix not in SOURCE_SUFFIXES or path in GENERATED:
                continue
            if SKIPPED_DIRS & set(path.relative_to(REPO).parts):
                continue
            found.append(path)
    return tuple(found)


@lru_cache(maxsize=1)
def _source_blob() -> str:
    return "\n".join(_file_text(path) for path in _source_files())


@lru_cache(maxsize=1)
def _source_words() -> frozenset[str]:
    return frozenset(_WORD.findall(_source_blob()))


@lru_cache(maxsize=None)
def _file_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


@lru_cache(maxsize=None)
def _file_words(path: Path) -> frozenset[str]:
    return frozenset(_WORD.findall(_file_text(path)))


def _haystacks(scope: tuple[Path, ...]) -> tuple[str, ...]:
    return (_source_blob(), *(_file_text(path) for path in scope))


def _word_sets(scope: tuple[Path, ...]) -> tuple[frozenset[str], ...]:
    return (_source_words(), *(_file_words(path) for path in scope))


def _pattern_found(pattern: str, scope: tuple[Path, ...]) -> bool:
    return any(re.search(pattern, text) for text in _haystacks(scope))


def _word_exists(word: str, scope: tuple[Path, ...]) -> bool:
    """Word-boundary match, never a substring match."""
    if _PLAIN_WORD.match(word):
        return any(word in words for words in _word_sets(scope))
    return _pattern_found(rf"(?<![\w-]){re.escape(word)}(?![\w-])", scope)


def _glob_exists(pattern: str, scope: tuple[Path, ...]) -> bool:
    """`hotword_*` / `*_context_json` document a family of identifiers, not one name."""
    matcher = re.compile(pattern.replace("*", "[A-Za-z0-9_]*") + r"\Z")
    return any(any(matcher.match(word) for word in words) for words in _word_sets(scope))


def _route_exists(route: str, scope: tuple[Path, ...]) -> bool:
    """Match a documented route against its declaration, ignoring path-param names."""
    prefix_only = route.endswith("*")
    pattern = re.escape(route.rstrip("*")).replace(r"\{", "{").replace(r"\}", "}")
    pattern = re.sub(r"\{[^}]*\}", r"\\{\\w+\\}", pattern)
    if not prefix_only:
        pattern += r"(?![\w/-])"
    return _pattern_found(pattern, scope)


def _resolve_path(candidate: str, scope: tuple[Path, ...]) -> bool:
    if any((root / candidate).exists() for root in PATH_ROOTS):
        return True
    # A bare filename (docs name sibling modules that way) may sit anywhere in the tree.
    if "/" not in candidate and any(p.name == candidate for p in _source_files()):
        return True
    # A path the code only ever builds at runtime still has to appear as a literal.
    return _pattern_found(rf"(?<![\w./-]){re.escape(candidate)}(?![\w-])", scope)


def _looks_like_path(text: str) -> bool:
    return bool(re.fullmatch(r"[\w][\w./-]*", text)) and text.endswith(PATH_SUFFIXES)


def _strip_verbs(text: str) -> str:
    """`POST /api/x` and `POST/GET /api/x` both document the path `/api/x`."""
    head, _, tail = text.partition(" ")
    if tail and all(part in HTTP_VERBS for part in head.split("/") if part):
        return tail.strip()
    return text


def _identifier_atoms(text: str) -> list[str]:
    """Code-shaped atoms in a span; a dotted name is checked by its last component."""
    atoms = []
    for raw in re.findall(r"[A-Za-z_][A-Za-z0-9_.-]*", text):
        atom = raw.rstrip(".-").split(".")[-1]
        if len(atom) > 1:
            atoms.append(atom)
    return atoms


def _name_missing(text: str, scope: tuple[Path, ...]) -> str:
    """Return the first part of a documented name that is absent, or "" if all exist."""
    text = _strip_verbs(text.strip())
    if text.startswith("/"):
        return "" if _route_exists(text, scope) else text
    if _CSS_VAR.match(text):
        return "" if _pattern_found(re.escape(text) + r"(?![\w-])", scope) else text
    if _IDENTIFIER_GLOB.match(text) and len(text.replace("*", "")) >= GLOB_MIN_LITERALS:
        return "" if _glob_exists(text, scope) else text
    if _looks_like_path(text):
        return "" if _resolve_path(text, scope) else text
    return next((atom for atom in _identifier_atoms(text) if not _word_exists(atom, scope)), "")


_BACKTICKED = re.compile(r"`([^`]+)`([^`]*)")


def _spans(text: str, first_line: int) -> list[tuple[str, int]]:
    """Backticked spans in a Code cell/line, minus the ones tagged (planned)."""
    spans = []
    for match in _BACKTICKED.finditer(text):
        if match.group(2).lstrip().startswith(PLANNED):
            continue
        spans.append((match.group(1), first_line + text[: match.start(1)].count("\n")))
    return spans


def _entry_scope(spans: list[tuple[str, int]]) -> tuple[Path, ...]:
    """Code files the entry itself names - its own identifiers may live in them."""
    found = set()
    for text, _ in spans:
        if not _looks_like_path(text) or text.endswith(".md"):
            continue
        for root in PATH_ROOTS:
            resolved = root / text
            if resolved.is_file() and resolved not in GENERATED:
                found.add(resolved)
                break
    return tuple(sorted(found))


def _table_code_cells(lines: list[str]) -> list[tuple[str, str, int]]:
    """(term, code cell, line number) for every row of a table with a Code column."""
    cells: list[tuple[str, str, int]] = []
    code_column: int | None = None
    for number, line in enumerate(lines, start=1):
        if not line.startswith("|"):
            code_column = None
            continue
        columns = [c.strip() for c in line.strip().strip("|").split("|")]
        if code_column is None:
            code_column = columns.index("Code") if "Code" in columns else None
            continue
        if set("".join(columns)) <= set("-: "):
            continue
        if code_column < len(columns):
            term = columns[0].strip("*").strip()
            cells.append((term, columns[code_column], number))
    return cells


_CODE_PROSE = re.compile(r"^\s*-\s+\*\*Code:\*\*(.*)$")
_HEADING = re.compile(r"^#{2,}\s+(.*)$")
_WRAPPED = re.compile(r"^\s{2,}\S")


def _prose_code_lines(lines: list[str]) -> list[tuple[str, str, int]]:
    """(term, code text, line number) for every `- **Code:**` bullet, wraps included."""
    entries: list[tuple[str, str, int]] = []
    term = "(no heading)"
    index = 0
    while index < len(lines):
        heading = _HEADING.match(lines[index])
        if heading:
            term = heading.group(1).strip()
        match = _CODE_PROSE.match(lines[index])
        if not match:
            index += 1
            continue
        first_line = index + 1
        block = [match.group(1)]
        index += 1
        while index < len(lines) and _WRAPPED.match(lines[index]) and not lines[index].lstrip().startswith("- **"):
            block.append(lines[index])
            index += 1
        entries.append((term, "\n".join(block), first_line))
    return entries


def _glossary_entries() -> list[tuple[str, str, int]]:
    lines = GLOSSARY.read_text(encoding="utf-8").splitlines()
    return _table_code_cells(lines) + _prose_code_lines(lines)


def _glossary_claims() -> list[Claim]:
    claims = []
    for term, text, number in _glossary_entries():
        spans = _spans(text, number)
        scope = _entry_scope(spans)
        claims.extend(Claim(term, span, line, scope) for span, line in spans)
    return claims


def test_glossary_code_names_exist_in_the_source_tree():
    missing = []
    for claim in _glossary_claims():
        absent = _name_missing(claim.name, claim.scope)
        if absent:
            missing.append(f"{GLOSSARY.name}:{claim.line}: {claim.term!r} names `{claim.name}`"
                           f" - {absent!r} is not in the source tree")
    assert missing == [], "Glossary Code names with no matching code:\n" + "\n".join(missing)


# --- Feature-map headers ---------------------------------------------------------

_HEADER_PATH = re.compile(r"[\w][\w./-]*\.(?:py|js|mjs|css|html|json|ini|toml)\b")
_QUALIFIED = re.compile(r"\.(?:py|js)::(\w+)")
_CODE_CLAUSE = re.compile(r"\(code:\s*([^)]*)\)")
_SNAKE = re.compile(r"[a-z][a-z0-9_]*_[a-z0-9_]+(?:\.[A-Za-z_][A-Za-z0-9_]*)*")
_CAMEL = re.compile(r"[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+(?:\.[A-Za-z_][A-Za-z0-9_]*)*")


def _feature_map_headers() -> list[tuple[Path, list[tuple[str, int]]]]:
    headers = []
    for path in sorted(PACKAGE.rglob("*.py")):
        lines = _file_text(path).splitlines()
        if not lines or not lines[0].startswith("# Feature-map"):
            continue
        block = []
        for number, line in enumerate(lines, start=1):
            if not line.startswith("#"):
                break
            block.append((line, number))
        headers.append((path, block))
    return headers


def _header_claims(path: Path, block: list[tuple[str, int]]) -> list[Claim]:
    term = path.relative_to(REPO).as_posix()
    claims = []
    for line, number in block:
        if PLANNED in line:
            continue
        paths = _HEADER_PATH.findall(line)
        claims.extend(Claim(term, p, number) for p in paths)
        claims.extend(Claim(term, name, number) for name in _QUALIFIED.findall(line))
        prose = _HEADER_PATH.sub(" ", line)
        names = set(_SNAKE.findall(prose)) | set(_CAMEL.findall(prose))
        for clause in _CODE_CLAUSE.findall(prose):
            names.update(re.findall(r"[A-Za-z_][A-Za-z0-9_./-]*", clause))
        claims.extend(Claim(term, name, number) for name in sorted(names))
    return claims


def _all_header_claims() -> list[Claim]:
    return [claim for path, block in _feature_map_headers() for claim in _header_claims(path, block)]


def test_feature_map_headers_name_code_that_exists():
    missing = []
    for claim in _all_header_claims():
        absent = _name_missing(claim.name, claim.scope)
        if absent:
            missing.append(f"{claim.term}:{claim.line}: header names `{claim.name}`"
                           f" - {absent!r} is not in the source tree")
    assert missing == [], "Feature-map headers naming code that does not exist:\n" + "\n".join(missing)


# --- Guard: the parsers must keep matching the shape of the files they read -------

# Floors, far below the current counts - they catch a parser that silently stopped
# matching (which would make the drift tests above pass on nothing), not doc edits.
MIN_TABLE_ENTRIES = 50
MIN_PROSE_ENTRIES = 50
MIN_GLOSSARY_CLAIMS = 200
MIN_FEATURE_MAP_HEADERS = 10
MIN_HEADER_CLAIMS = 40


def test_parsers_still_find_the_names_they_guard():
    lines = GLOSSARY.read_text(encoding="utf-8").splitlines()
    assert len(_table_code_cells(lines)) >= MIN_TABLE_ENTRIES
    assert len(_prose_code_lines(lines)) >= MIN_PROSE_ENTRIES
    assert len(_glossary_claims()) >= MIN_GLOSSARY_CLAIMS
    assert len(_feature_map_headers()) >= MIN_FEATURE_MAP_HEADERS
    assert len(_all_header_claims()) >= MIN_HEADER_CLAIMS


def test_planned_tag_is_the_only_exemption():
    row = "`shipped_name`, `not_built_yet` (planned), `also_shipped`"
    assert [name for name, _ in _spans(row, 1)] == ["shipped_name", "also_shipped"]


def test_source_tree_scan_covers_the_shipped_code():
    scanned = _source_files()
    assert PACKAGE / "web" / "app.py" in scanned
    assert PACKAGE / "web" / "static" / "core" / "boot.js" in scanned
    assert not any(path in GENERATED for path in scanned)
    assert not any("tests" in path.relative_to(REPO).parts for path in scanned)
