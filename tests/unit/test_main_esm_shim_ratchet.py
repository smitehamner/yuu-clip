"""Ratchet guard for the residual ``window.*`` shim in ``static/main.esm.js`` - Phase 0
of the ui-shim-retirement plan (yuu-clip_plans ui-shim-retirement/INDEX.md).

The shim is the last compatibility bridge left after the ESM migration: a small set of
names still hung on ``window`` so a runtime reader (GROUP 1) or a ``tests/ui``
``page.evaluate`` poke (GROUP 2) can resolve them. The side-effect ratchets pin that no
module wires DOM listeners on import, but NOTHING pinned the shim's size - a fresh
``window.X = ...`` line, or a new name added to the GROUP 2 ``Object.assign(window, {...})``
block, would land silently and the shim would creep back up.

This is a pure source scan (no browser, no server) - it lives in the unit tier. It is a
RATCHET keyed to the three frozen name sets below, in both directions:

* Adding a name to the shim fails the ``no_new`` test - shrinking the shim is the only
  sanctioned direction, so a NEW name needs a documented reason in the shim banner AND an
  entry added here (which makes the addition reviewable, not silent).
* Dropping a name from the shim fails the ``no_stale`` test until you also shrink the
  frozen set here - so the ratchet stays tight and can never go vacuous (an empty parse
  trips every ``no_stale`` test, since the frozen sets are non-empty).

Regenerate the frozen sets from ``main.esm.js`` (never trust this file's line numbers
after other work lands) before editing, and shrink the sets in the SAME commit that drops
a shim line.
"""
from __future__ import annotations

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"
MAIN_ESM = STATIC_DIR / "main.esm.js"

# ---- Frozen expected shim contents (parsed from main.esm.js at Phase 0, 2026-07-25) ----
# Each set is the ceiling: the parsed shim must be a SUBSET. Delete a name here in the same
# commit that drops its shim line; adding one needs a documented reason in the shim banner.

# GROUP 1, individual `window.X = X` assignments. Emptied in Phase 2 (2026-07-25): the
# jobs.js/format.js refresh reads that used to live here moved behind the
# core/refreshhooks.js registration seam, so no individual window.* assignment remains.
# Kept as an (empty) ratchet ceiling so a re-added `window.X = ...` line still trips
# test_no_new_group1_assignment.
_EXPECTED_GROUP1_ASSIGNMENTS: frozenset[str] = frozenset()

# GROUP 1, whole-namespace spreads `Object.assign(window, X)`. Emptied in the Phase 2
# follow-on (2026-07-25): the last spread, Object.assign(window, jobs), had no production
# reader (videos.js imports cancelJob/togglePauseJob and dispatches via data-act, not an
# inline onclick), so it was narrowed to its 9 genuinely-poked names and folded into
# GROUP 2. Kept as an (empty) ceiling so a re-added spread still trips test_no_new_group1_spread.
_EXPECTED_GROUP1_SPREADS: frozenset[str] = frozenset()

# GROUP 2, the test-only `Object.assign(window, { ... })` block: names reachable ONLY via a
# tests/ui page.evaluate poke, kept so page.evaluate("name()") resolves. No production
# JS/HTML reader (the per-cluster note in main.esm.js records why each can't drop yet).
_EXPECTED_GROUP2: frozenset[str] = frozenset({
    "AppState", "ColorPicker", "fmtDuration",
    "startJobUI", "updateJobUI", "endJobUI", "streamSSE", "INGEST_STEPS", "SCORE_STEPS",
    "_driveStepFromMarker",
    "_blockedByAnalyze", "_setPausedUIFromStatus", "_abortActiveStream",
    "showAlert", "showConfirm", "_confirmCancel", "toggleHamburger",
    "openControlsModal", "openDiffModal", "showKebab", "showUndoToast",
    "openHelpModal", "closeHelpModal", "openGlossaryModal",
    "refreshModelCatalog", "gateOnCapability",
    "renderVideoDetail", "_renderVideoList", "regenSummaryAuto", "toggleGroupSelect",
    "toggleVideoFilter",
    "renderDetail", "toggleClipFilter", "_applyFilters", "_renderClips", "openClipActionsModal",
    "openClipCreatePicker",
    "openReanalyzePanel", "startAnalyze", "openNewRecordingPanel",
    "openHighlightReelsModal",
    "_deriveContextId",
    "SoundFx", "commitSoundSettings",
    "openPeopleView", "openExportEditor",
    "openSplitEditor", "closeSplitEditor",
    "openSettings",
})

# The ONLY source modules allowed to read a GROUP 1 assigned name off `window`. main.esm.js
# (the assignment site) and bundle.esm.js (the generated build artifact mirroring it) are
# excluded from the scan. Paths are relative to STATIC_DIR (POSIX separators). Currently
# INERT - _EXPECTED_GROUP1_ASSIGNMENTS is empty, so the scan builds no patterns; kept (with
# the historical readers) in case a GROUP 1 assignment is ever reintroduced.
_ALLOWED_GROUP1_READERS: frozenset[str] = frozenset({"core/jobs.js", "core/format.js"})

_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


def _strip_comments(text: str) -> str:
    text = _BLOCK_COMMENT_RE.sub("", text)
    return "\n".join(line.split("//", 1)[0] for line in text.splitlines())


def _main_esm_code() -> str:
    return _strip_comments(MAIN_ESM.read_text(encoding="utf-8"))


def _parse_group1_assignments(code: str) -> set[str]:
    return set(re.findall(r"window\.(\w+)\s*=", code))


def _parse_group1_spreads(code: str) -> set[str]:
    # `Object.assign(window, IDENT)` with a bare identifier - the object-literal form
    # `Object.assign(window, {` does not match (`{` is not an identifier char).
    return set(re.findall(r"Object\.assign\(window,\s*([A-Za-z_$][\w$]*)\)", code))


def _parse_group2_names(code: str) -> set[str]:
    block = re.search(r"Object\.assign\(window,\s*\{([^}]*)\}\)", code)
    if block is None:
        return set()
    return set(re.findall(r"[A-Za-z_$][\w$]*", block.group(1)))


def _scanned_modules() -> list[Path]:
    return [
        path
        for path in STATIC_DIR.rglob("*.js")
        if path.relative_to(STATIC_DIR).as_posix() not in {"main.esm.js", "bundle.esm.js"}
    ]


# ---- GROUP 1 individual assignments ----

def test_no_new_group1_assignment() -> None:
    actual = _parse_group1_assignments(_main_esm_code())
    new = actual - _EXPECTED_GROUP1_ASSIGNMENTS
    assert not new, (
        "New `window.X = ...` shim assignment(s) in main.esm.js: "
        f"{sorted(new)}. The shim only shrinks - convert the reader to a direct import "
        "instead. If a new window binding is truly unavoidable, document the reason in "
        "main.esm.js's shim banner and add the name to _EXPECTED_GROUP1_ASSIGNMENTS."
    )


def test_no_stale_group1_assignment() -> None:
    actual = _parse_group1_assignments(_main_esm_code())
    stale = _EXPECTED_GROUP1_ASSIGNMENTS - actual
    assert not stale, (
        "These names are no longer assigned on window in main.esm.js - shrink "
        f"_EXPECTED_GROUP1_ASSIGNMENTS in the same commit: {sorted(stale)}"
    )


# ---- GROUP 1 whole-namespace spreads ----

def test_no_new_group1_spread() -> None:
    actual = _parse_group1_spreads(_main_esm_code())
    new = actual - _EXPECTED_GROUP1_SPREADS
    assert not new, (
        f"New `Object.assign(window, X)` namespace spread(s): {sorted(new)}. "
        "Spreading a whole module onto window is the widest coupling there is - drop it "
        "to direct imports rather than adding to _EXPECTED_GROUP1_SPREADS."
    )


def test_no_stale_group1_spread() -> None:
    actual = _parse_group1_spreads(_main_esm_code())
    stale = _EXPECTED_GROUP1_SPREADS - actual
    assert not stale, (
        "These namespace spreads are gone from main.esm.js - shrink "
        f"_EXPECTED_GROUP1_SPREADS in the same commit: {sorted(stale)}"
    )


# ---- GROUP 2 test-only block ----

def test_no_new_group2_name() -> None:
    actual = _parse_group2_names(_main_esm_code())
    new = actual - _EXPECTED_GROUP2
    assert not new, (
        "New name(s) in the GROUP 2 `Object.assign(window, {...})` test-only block: "
        f"{sorted(new)}. Prefer a tests/js vitest import or a real click over a new "
        "page.evaluate poke; if a poke is genuinely required, add the name to "
        "_EXPECTED_GROUP2 with a per-cluster note in main.esm.js."
    )


def test_no_stale_group2_name() -> None:
    actual = _parse_group2_names(_main_esm_code())
    stale = _EXPECTED_GROUP2 - actual
    assert not stale, (
        "These GROUP 2 names are gone from main.esm.js (a poking test was migrated) - "
        f"shrink _EXPECTED_GROUP2 in the same commit: {sorted(stale)}"
    )


def test_group2_block_parsed_nonempty() -> None:
    # Guards against a refactor that reshapes the block so the parser silently matches
    # nothing (which would make the subset tests vacuous). The no_stale tests already trip
    # on an empty parse; this fails first with a clearer reason.
    assert _parse_group2_names(_main_esm_code()), (
        "Parsed zero names from the GROUP 2 Object.assign(window, {...}) block - the "
        "block's shape changed; update _parse_group2_names to match."
    )


# ---- Reader-scan: who is allowed to read a GROUP 1 assigned name off window ----

def test_group1_names_read_only_in_allowlisted_modules() -> None:
    read_res = [
        re.compile(rf"window\.{re.escape(name)}\b(?!\s*=)")
        for name in _EXPECTED_GROUP1_ASSIGNMENTS
    ]
    offenders = {
        path.relative_to(STATIC_DIR).as_posix()
        for path in _scanned_modules()
        if any(pattern.search(_strip_comments(path.read_text(encoding="utf-8")))
               for pattern in read_res)
        if path.relative_to(STATIC_DIR).as_posix() not in _ALLOWED_GROUP1_READERS
    }
    assert not offenders, (
        "GROUP 1 shim name read off `window` outside the allowlisted reader modules "
        f"({sorted(_ALLOWED_GROUP1_READERS)}): {sorted(offenders)}. A window read is the "
        "silent-ReferenceError class this shim exists to bridge - import the name "
        "directly, or (if it must stay on window) extend _ALLOWED_GROUP1_READERS with a "
        "documented reason."
    )
