---
name: docs-sync
description: Keep yuu-clip's user-visible facts in sync across every surface that states them, driven by the DOC-CLAIMS.md registry. Trigger this whenever you change a user-visible fact - a default, a model recommendation, the scoring axes, a keyboard shortcut, the Whisper/hardware numbers, clip/scene durations, or any glossary term - and before reporting such a change done. Not for internal-only changes that no doc, UI label, or help text states.
---

# Docs sync (DOC-CLAIMS registry)

Goal: when a user-visible fact changes, the code AND every surface that states it change in the *same* commit, so docs never silently drift behind the code.

The registry `docs/dev/llm/DOC-CLAIMS.md` is the source of truth for which facts are volatile and cross-cutting, and exactly which surfaces state each one. Memory is not - the registry is.

## When this fires

Any change to a user-visible fact: a default value, a recommended/default model, the scoring axes or weights, a keyboard shortcut, the Whisper per-model download-size / VRAM numbers, analysis-time estimates, clip-vs-scene durations, or the wording of a glossary term. If unsure whether a fact is registry-tracked, open the registry and check - it is cheap.

## Procedure

1. **Open `docs/dev/llm/DOC-CLAIMS.md`.** Find the row for the fact you are changing (the `# / Fact` columns).
2. **Change the Code truth first.** The row's `Code truth` column names the authoritative source (a `Config.*` field, a `model_catalog.py` function, a scorer). Change that.
3. **Sweep every surface in the row.** The `Surfaces that state it` column is the complete list - docs under `docs/user/**` and `docs/dev/**`, the Getting Started modal and other partials under `web/static/partials/**`, the in-app glossary `web/static/glossary.md`, the relevant `web/static/**/*.js`, the `<option>` lists in `index.html`, and the wizard `setup.html`. Update each one in the same change. Do not stop at the code.
4. **Respect the glossary.** User-facing text uses the glossary term (`docs/dev/llm/GLOSSARY.md`), even where the code identifier differs. A registry sweep is a common place to accidentally paste a code name into prose - do not.
5. **Rebuild artifacts if you touched a source.** If a surface was `index.html`, a `static/partials/**` file, or a `static/*.js`, run `yuu-dev bundle` (it re-stitches `index.html`, rebuilds the ESM bundles, and regenerates the shared catalog). Editing the committed `index.html` or `bundle.esm.js` directly is wrong - they are overwritten by the stitch/build.
6. **Run the fact guards.** `yuu-dev test-api` - `tests/unit/test_doc_claims.py` runs in the unit tier. Read `test-api-last-summary.log`.

## Guarded vs sweep-by-hand rows

Some rows are bound to code by a `test_doc_claims.py` test (currently rows 1, 4, 6, 7, 8 per the registry's footer) - those fail the build if you miss a surface. The rest (2, 3, 5, 9, 10, 11) are **sweep-by-hand**: no test catches a missed surface, so the manual sweep in step 3 is the only guard. Do not lean on the test suite to catch a sweep-by-hand miss.

## Adding a new tracked fact

If you introduce a new user-visible fact that lives in more than one place, add a row to the registry (Fact / Code truth / every surface) so the next person who changes it has the map. Prefer adding a `test_doc_claims.py` guard for it when the fact is a discrete string or number the test can pin.

## Done criteria

- The registry row's code truth and every listed surface agree with the new fact.
- No banned code term leaked into user-facing prose.
- `yuu-dev test-api` green (fact guards included); artifacts rebuilt if a UI source changed.
