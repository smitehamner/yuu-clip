---
name: wide-change-verification
description: Run repeated convergence-driven verification passes after a WIDE, multi-surface change to yuu-clip - a plan workstream/stage, a docs-truth or terminology sweep, a wide refactor - where the same fact, label, or number lives in many files. Trigger after finishing any such change and before reporting it done. Includes this repo's concrete gaps that the normal per-edit gate misses. Not for a narrow one-file fix or a cosmetic edit - those need only their own targeted gate.
---

# Wide-change verification passes

Goal: after a change where one fact lives in many files, keep running verification passes until they converge - because drift hides in the surfaces you did NOT edit, and the fast per-edit gate routinely misses whole test tiers and content-pinned tests.

Narrow one-file fixes and cosmetic edits do not need this. This is for wide changes: a plan workstream or stage, a docs/terminology sweep, a wide refactor - anything where the same string, number, label, or behavior is stated in many places.

## Each pass

1. **Re-grep EVERY surface that states a changed fact - not just the files you edited.** Drift hides in the un-touched surfaces: other docs, UI labels, generated help, `<option>` lists, and tests that pin the old string. Grep the literal old value and the new value across the whole repo.
2. **Run the full test tiers your targeted gate skips.** A "changed-files" selector routinely misses content-pinned tests and separate tiers. Run the full suites, not just the fast targeted gate (see the repo-specific tiers below).
3. **Check what tests do not cover:** cross-surface number/label agreement, dangling doc links and anchors, and stray non-ASCII / em-dashes in authored text.

Repeat while a pass keeps finding real issues.

**Stop-gate:** if the 3rd pass is STILL finding non-minor issues, PAUSE and evaluate with the user rather than grinding on. If the 3rd pass finds only minor issues (or nothing), it has converged - done.

## yuu-clip concretions (the gaps this repo's per-edit gate lets through)

The normal `yuu-dev test-ui --changed` targeted gate has specific blind spots here. For step 2, run the tiers it skips:

- **`yuu-dev test-ui` (FULL, not `--changed`).** `--changed` does NOT map content-only edits to `index.html` / `setup.html` / `glossary.md`, and does NOT run the string-pinning tests. The fastest tripwires are `tests/ui/test_ui_terminology.py` (all five Whisper `<option>` lists must share identical copy) and `tests/ui/test_ui_wizard.py`.
- **`yuu-dev test-js`** if any `static/*.js` changed - the vitest tier is separate; neither `test-api` nor `test-ui` runs it. (A `videos.js` default drift once shipped a red `test-js` exactly this way.)
- **`cd electron; npm test`** if anything under `electron/` changed - its Node suite is not covered by any pytest tier.
- **Re-audit `docs/dev/llm/DOC-CLAIMS.md`** for every surface listed against a changed fact (this is the docs-sync skill's job - invoke it if the wide change touched a registry-tracked fact), and grep for cross-surface number/label agreement + dangling doc anchors.

Also always: `yuu-dev lint` and `yuu-dev typecheck` for any Python touched.

## Why it converges (and why to trust the count, not your gut)

A single session's three passes over a docs-truth sweep once caught ~6 real bugs the normal per-edit gate missed - pinned tests in un-run tiers, label drift in an un-edited surface, a dead doc anchor. The passes are cheap relative to shipping drift; run them until a pass comes back clean, then stop.
