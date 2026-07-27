---
name: use-case-catalog
description: Keep yuu-clip's end-to-end use-case catalog, its derived manual release checklist, and its automated coverage in lockstep when a user-facing flow is added or materially changed. Trigger this whenever you add or change a user-facing feature or flow - a new panel action, an export path, a wizard step, a settings surface - and before reporting such a change done. Enforced by tests/unit/test_use_case_catalog.py. Not for internal refactors with no user-facing behavior change.
---

# Use-case catalog

Goal: every user-facing flow has a stable `UC-` entry, a matching manual-checklist row, and either a real automated test or a justified `manual-only` tag - and the three never drift apart. `tests/unit/test_use_case_catalog.py` enforces the links.

Two authoritative files:
- `docs/dev/USE_CASES.md` - the end-to-end use-case catalog. IDs are `UC-<section><nn>` (section-scoped, e.g. `UC-B05`), stable once assigned - never reuse or renumber a retired ID; new cases append within their section.
- `docs/dev/testing/installed-app-checklist.md` - the derived manual release sign-off. One row per use case.

## When this fires

You add or materially change a user-facing flow: a new action in a panel, a new export or import path, a wizard step, a settings surface, a keyboard action, a first-run behavior. An internal-only refactor that changes no user-visible behavior does not.

## Procedure

1. **Add or update the `UC-` entry** in `docs/dev/USE_CASES.md`. Keep every field:
   - **Actor goal** - what the user is trying to accomplish.
   - **Preconditions** - app state required to start.
   - **Steps** - the numbered walk-through.
   - **Expected** - observable outcome.
   - **Automation** - one of `automated` / `golden` / `manual-only` (slash-separate when a case mixes postures). `automated` = drivable headless (api/ui/js/system test); `golden` = proven only by the opt-in real-models golden path; `manual-only` = a packaged-Electron surface no headless suite can reach.
   - **Coverage** - where it is covered. For an `automated`/`golden` case the line MUST end with `Automated by <pytest node id>` naming a real test node (e.g. `tests/system/test_x.py::test_y`). The catalog test fails if that node id does not exist.
   - **Pre-release priority** - P0 (must walk / core loop / packaged-only) / P1 (common flow, real user-data consequences) / P2 (long-tail or well-covered by automation).

   For a **new** case pick the next free number in its section - never reuse a retired ID. Read the section's "How to read an entry" header if unsure of a field's meaning.

2. **Add or update the matching row** in `docs/dev/testing/installed-app-checklist.md`. Every catalog entry needs its checklist counterpart and vice versa - the catalog test flags an orphan on either side.

3. **Add the real test (or justify manual-only).**
   - `automated`/`golden`: add or update a `tests/system/` test (or another real api/ui/js test) and cite its node id on the `Coverage` line.
   - `manual-only`: the packaged-surface justification (install, wizard, native media protocol, process lifecycle) stands in for a test - state it in the entry.

4. **Run `yuu-dev test-unit`.** `tests/unit/test_use_case_catalog.py` enforces unique sequential IDs, valid Automation/priority tags, no orphaned checklist/catalog entry, and that every cited pytest node id still exists. Read `test-*-last-summary.log`.

## Done criteria

- The `UC-` entry, the checklist row, and the test coverage all exist and agree.
- Any `automated`/`golden` case cites a real, existing pytest node id.
- `yuu-dev test-unit` green.
