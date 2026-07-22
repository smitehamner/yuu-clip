"""Ratchet guard for the JS module-testability refactor - lever 1 (side-effect-free
imports). See yuu-clip_plans MODULE-TESTABILITY-PLAN-2026-07-21.md.

A feature module that wires DOM listeners at *module scope* (a column-0
``document.getElementById(...).addEventListener(...)`` or
``document.addEventListener('DOMContentLoaded', ...)``) runs that side effect on
import, so it cannot be imported in isolation - the whole ``index.html`` body has to
be seeded first (see ``tests/js/setup.js``). The refactor moves each module's wiring
into an exported ``initX()``/``initXListeners()`` that ``boot.js`` calls once.

This is a pure source scan (no browser, no server) - it lives in the unit tier. It is
a RATCHET: ``_ALLOWED_MODULE_SIDE_EFFECTS`` lists the files that still wire at module
scope today. As each bucket is converted its file drops out of the set; the test fails
if a file in the set is actually already clean (forcing the entry to be removed) or if
a NEW module-scope listener appears in a file not on the list. The allowlist only ever
shrinks, toward empty. ``boot.js`` is the one intentional exception - it is the
first-paint entry, imported for side effects, and exports nothing.
"""
from __future__ import annotations

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"

# A column-0 `name(...);` / `name.method(...);` statement - a bare call, not a
# declaration. `document.`/`window.` are handled by _DECL_PREFIXES (the direct
# addEventListener check covers document.* wiring).
_BARE_CALL_RE = re.compile(r"^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\([^;]*\);?\s*$")

# boot.js is the entry orchestrator (side-effect-only); the two committed bundles and
# the ESM entry are generated/aggregate, not feature modules.
_EXEMPT = {"boot.js", "main.esm.js", "bundle.esm.js"}

# Files that still wire DOM listeners at module scope. SHRINK this as each bucket is
# converted - never add to it. Paths are relative to STATIC_DIR (POSIX separators).
_ALLOWED_MODULE_SIDE_EFFECTS: set[str] = set()

# A DOM listener wired INDIRECTLY - a module-scope bare call to a `_wireX()` helper
# whose body calls addEventListener. It is the same load-time side effect as a literal
# top-level addEventListener (the direct check above misses it because the
# addEventListener is one call-frame down). SHRINK this to empty as the helpers move
# into an exported initX() called from boot.js.
_ALLOWED_MODULE_SCOPE_CALLS = {
    "analyze/split.js",
    "clips/clipexport.js",
    "core/helpmodals.js",
    "library/sounds.js",
    "settings/settings-backup.js",
    "settings/settings-installs.js",
    "settings/settings-previews.js",
    "videos/sessions.js",
    "videos/videos-timeline.js",
}

# Keywords/constructs that legitimately start a column-0 line - not a bare side-effect
# call. A module-scope statement that is none of these and is a bare `name(...);` call
# executes on import.
_DECL_PREFIXES = (
    "export ", "import ", "const ", "let ", "var ", "function ", "async ",
    "return ", "if ", "for ", "while ", "switch ", "class ", "throw ",
    "Object.assign", "Object.defineProperty", "window.", "document.",
)


def _has_module_scope_listener(source: str) -> bool:
    for line in source.splitlines():
        if line[:1].isspace():
            continue  # indented -> inside a function/block, not module scope
        stripped = line.lstrip()
        if stripped.startswith(("//", "*", "/*")):
            continue
        if ".addEventListener(" in stripped:
            return True
    return False


def _has_module_scope_bare_call(source: str) -> bool:
    for line in source.splitlines():
        if line[:1].isspace():
            continue  # indented -> inside a function/block
        stripped = line.lstrip()
        if stripped.startswith(("//", "*", "/*")):
            continue
        if stripped.startswith(_DECL_PREFIXES):
            continue
        # a bare `identifier(...);` statement at column 0 runs on import
        if _BARE_CALL_RE.match(stripped):
            return True
    return False


def _feature_modules() -> list[Path]:
    return [
        path
        for path in STATIC_DIR.rglob("*.js")
        if path.name not in _EXEMPT
    ]


def test_no_new_module_scope_listeners() -> None:
    offenders = {
        path.relative_to(STATIC_DIR).as_posix()
        for path in _feature_modules()
        if _has_module_scope_listener(path.read_text(encoding="utf-8"))
    }
    new_offenders = offenders - _ALLOWED_MODULE_SIDE_EFFECTS
    assert not new_offenders, (
        "New module-scope DOM listener(s) - move wiring into an exported initX() "
        f"called from boot.js: {sorted(new_offenders)}"
    )


def test_allowlist_has_no_already_clean_entries() -> None:
    offenders = {
        path.relative_to(STATIC_DIR).as_posix()
        for path in _feature_modules()
        if _has_module_scope_listener(path.read_text(encoding="utf-8"))
    }
    stale = _ALLOWED_MODULE_SIDE_EFFECTS - offenders
    assert not stale, (
        "These files are already free of module-scope listeners - remove them from "
        f"_ALLOWED_MODULE_SIDE_EFFECTS so the ratchet stays tight: {sorted(stale)}"
    )


def test_no_new_module_scope_bare_call_wiring() -> None:
    offenders = {
        path.relative_to(STATIC_DIR).as_posix()
        for path in _feature_modules()
        if _has_module_scope_bare_call(path.read_text(encoding="utf-8"))
    }
    new_offenders = offenders - _ALLOWED_MODULE_SCOPE_CALLS
    assert not new_offenders, (
        "New module-scope bare call(s) (a _wireX()-style side effect on import) - "
        "move the wiring into an exported initX() called from boot.js: "
        f"{sorted(new_offenders)}"
    )


def test_bare_call_allowlist_has_no_already_clean_entries() -> None:
    offenders = {
        path.relative_to(STATIC_DIR).as_posix()
        for path in _feature_modules()
        if _has_module_scope_bare_call(path.read_text(encoding="utf-8"))
    }
    stale = _ALLOWED_MODULE_SCOPE_CALLS - offenders
    assert not stale, (
        "These files no longer make a module-scope bare call - remove them from "
        f"_ALLOWED_MODULE_SCOPE_CALLS so the ratchet stays tight: {sorted(stale)}"
    )


def test_converted_reference_module_stays_clean() -> None:
    # hotwords.js was the reference conversion for the refactor - if a top-level
    # listener creeps back in, this fires before the allowlist test would.
    hotwords = (STATIC_DIR / "library" / "hotwords.js").read_text(encoding="utf-8")
    assert not _has_module_scope_listener(hotwords)
    assert "initHotwordListeners" in hotwords
