# Review open items - punch list from the 2026-07-26 full-app quality review

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` for the same reason as
> `REVIEW_DECISIONS.md` and `REVIEW_MAP.md`.

Every "found but not fixed" or "needs human decision" item surfaced during the
2026-07-26 full-app `/code-review` pass (11 sections, see `REVIEW_MAP.md` for the
partition). Unlike `REVIEW_DECISIONS.md` (settled "keep as-is" calls with
reasoning - closed, not meant to be re-opened), this file is an **open** punch
list: items nobody has decided on yet, or real gaps deferred for a later phase/
section. When an item is resolved (fixed, or a deliberate keep-as-is decision is
made), move its entry to `REVIEW_DECISIONS.md` and delete it from here.

A 2026-07-26 follow-up pass fixed everything in this file that was genuinely
low-risk and clear-cut (see `REVIEW_DECISIONS.md`'s "Follow-up fixes - full-app
review punch list" section for the full list) and moved every settled
deferral/keep-as-is call out to `REVIEW_DECISIONS.md`. What remains below are
the items that still need an explicit human/product decision, plus one item
deliberately deferred to a specific future pass.

---

## Needs a human decision

- **`yuu_clip/analyze/thermal.py::ThermalTrigger.poll`** - pause-streak re-arm
  edge case: if auto-pause is toggled ON mid-run while the GPU is already hot
  for >3 consecutive samples, auto-pause may never re-fire (edge check is
  `== _STREAK_THRESHOLD`, not `>=`). **Recommendation:** change the check to
  `>=` so re-arming isn't strictly tied to catching the exact sample where the
  streak first crosses the threshold - this widens when auto-pause can fire
  without narrowing it, so it shouldn't cause an unwanted re-pause of an
  already-resumed job. Not applied without an explicit go-ahead since the
  review flagged the fix direction as ambiguous. Narrow/low-severity either way.

- **`yuu_clip/web/routes/scoring.py::_rescore_video_clips`** (~lines 437-443) -
  stamps `clips_scored_at` / `clips_scored_context_json` (the "Last scored with"
  provenance) unconditionally after the per-clip loop, even when every clip in
  the batch hit `llm_error`. A fully-failed batch therefore records "scored with
  <context> at <now>", so staleness / related-clips checks think scoring
  succeeded. **Recommendation:** track whether at least one clip in the batch
  scored without `outcome.error` and skip the provenance stamp when the batch is
  non-empty and 100% failed (an empty batch, or a partial failure, should still
  stamp as today - the `llm_error` tags and the failed-clip re-score button
  already surface which clips need a retry). Not applied because this changes
  when a persisted field is written, which is a product call about what
  "scored with X" should mean, not a pure bug fix.

- **`yuu_clip/web/static/core/utils.js::appendLog`** - styles any log line
  containing the bare substring `'error'` (case-insensitive) as a red error
  line, so benign lines like "0 errors" paint red and could alarm a
  non-technical user. **Recommendation:** narrow the match to a line that
  *starts* with an error marker (e.g. the existing `[Error ...]`/`level="error"`
  event convention) rather than a bare substring anywhere in the line - but this
  needs a check across every log line this function currently receives, since
  narrowing risks under-matching a real error that doesn't use that convention.
  Not applied without that verification.

- **`tests/integration/test_analyze.py::TestThermalPollLoopIntegration`**
  (`test_hot_reading_warns_then_auto_pauses` / `test_cool_reading_never_warns_or_pauses`)
  - real wall-clock timing tests (1.0s sleep, 0.01s poll interval, needs 3
  consecutive polls in that window). Generous headroom (100 possible polls vs.
  a streak of 3), not confirmed flaky, but not clock-injectable either.
  **Recommendation:** leave as-is unless it's ever observed to flake - the
  headroom is wide enough that converting it to an injectable clock is
  speculative hardening, not a response to an actual failure. Needs a human
  call only because CLAUDE.md's "determinism over everything" standard would
  otherwise argue for converting it on principle.

## Deferred to a specific future pass (not a human-decision item)

- **`tests/ui/test_ui_clipcreate.py:317`** - `page.wait_for_timeout(200)`, a
  fixed-duration sleep used for a negative assertion (proving the
  approve-shortcut is suppressed while the picker is open). Genuine
  sleep-based-timing fragility, but it's Playwright/UI-tier - reserved for a
  future UI-tier test-integrity pass (`shqr-test-integrity-review` scoped to
  `tests/ui/`), not fixed piecemeal here.
