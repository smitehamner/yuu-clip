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

from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"

# boot.js is the entry orchestrator (side-effect-only); the two committed bundles and
# the ESM entry are generated/aggregate, not feature modules.
_EXEMPT = {"boot.js", "main.esm.js", "bundle.esm.js"}

# Files that still wire DOM listeners at module scope. SHRINK this as each bucket is
# converted - never add to it. Paths are relative to STATIC_DIR (POSIX separators).
_ALLOWED_MODULE_SIDE_EFFECTS = {
    "clips/clipbulk.js",
    "clips/clips.js",
    "core/jobs.js",
    "core/shortcuts.js",
    "core/ui.js",
    "core/utils.js",
}


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


def test_converted_reference_module_stays_clean() -> None:
    # hotwords.js was the reference conversion for the refactor - if a top-level
    # listener creeps back in, this fires before the allowlist test would.
    hotwords = (STATIC_DIR / "library" / "hotwords.js").read_text(encoding="utf-8")
    assert not _has_module_scope_listener(hotwords)
    assert "initHotwordListeners" in hotwords
