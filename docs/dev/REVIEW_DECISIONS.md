# Review decisions - deliberate keep-as-is calls

Code-quality reviews (`shqr-code-quality-review`) sometimes flag something that
looks like duplication or an inconsistency, and the right call is to leave it
alone. This file is the record of *why*, so a future review doesn't re-flag the
same thing without the context. Most recent first.

---

## Phase 7 UX/UI (dedup, word-highlight captions, colour picker, context-scoped terms) (2026-07-10)

UX/UI phase of the code-quality review over the changes since baseline `16a30fa`.
Applied: added an accessible name (`aria-label="Colour picker"`) to the colour-picker
popover (`role="dialog"` had no name); fixed a lone curly apostrophe in `hotwords.js`
(the same file uses straight apostrophes elsewhere); added an in-flight disabled
"Checking..." state to the "Check duplicates" button (`clips.js scanDuplicates`) so the
scan has visible feedback. The following were reviewed and deliberately left as-is:

### Export dialog word-highlight controls are always editable (not hidden when captions != burn-in)
Decision: Keep as-is.
Rationale: In the export dialog, Word highlight + Words-on-screen live inside the "Caption
style" `<details>`, whose header already states "Applies to burned-in captions only" -
the same rule that governs the Font/Size/Position controls beside them, which are also
always editable and only take effect on burn-in. The reel modal instead *hides* its
word-highlight row until burn-in is chosen; that is a different but internally-consistent
pattern for a smaller control set. Forcing the export dialog to disable only word-highlight
(while leaving Font/Size/Position editable) would break the section's own internal
consistency for no real gain, since the section note already scopes all of them. Revisit
only if the whole Caption-style section is reworked to gate on the caption mode.

### "Settings -> LLM scoring" and other browser-DOM arrow glyphs kept as U+2192
Decision: Keep the arrow glyph.
Rationale: The right-arrow (U+2192) appears ~30 times across the served `.js`/`.html`, an
established browser-DOM typographic convention (same basis as the 2026-07-09 ellipsis
decision and the Phase 6 `llm.py` arrow decision). Browser markup renders as UTF-8, so there
is no cp1252 console risk. Only the lone curly *apostrophe* outlier was ASCII-fixed; the
arrows were left to match convention.

### Merge (dedup) confirmation is sufficient; no undo
Decision: Keep as-is.
Rationale: The merge action deletes clip B and is irreversible, but it is already gated by a
`showConfirm(..., danger=true)` whose body plainly states "The merged clip will span both time
ranges. This cannot be undone.", the confirm defaults focus to Cancel, and the destructive
button is red (`btn danger`). That is proportional confirmation for a single-user tool; a full
undo stack for merges is a feature, not a review fix.

---

## Phase 6 docs and comments (2026-07-10)

Docs-and-comments phase of the code-quality review over the changes since baseline
`16a30fa`. Applied: ASCII-fied non-ASCII glyphs in Python **comments/docstrings/console
strings** (the `db/models.py` status-flow arrows and other inline `->`/`...`/`-` fixes;
`subtitles.py` and `common.py` docstring arrows; `reel.py` two `print()` and one
`_log.info` strings that carried U+2026/U+2192 - a real cp1252 console-crash risk;
`config.py` en-dash comment). Fixed the stale `pytest.ini` markers paragraph in CLAUDE.md
(it claimed `integration`/`ui`/`environment` markers were registered - P4 removed them, only
`live_remote` remains; tiers are split by directory). Fixed the stale flat test paths in the
Feature-map headers of the five in-scope route files (`config`, `dedup`, `hotwords`, `llm`,
`sensitive`) to the new `tests/{unit,integration,ui}/` locations. Added a **Duplicate Clips**
glossary entry (the new clip-dedup concept was undefined) and a **Word highlight** captions
bullet to `docs/user/FEATURES.md` (the feature shipped this window but was undocumented for
users). The following were reviewed and deliberately left as-is:

### Feature-map header `·` separators and `→` arrows, and `# ── … ──` section dividers
Decision: Keep the non-ASCII glyphs.
Rationale: These are an established, codebase-wide typographic convention - the `·`/`→`
Feature-map header comments appear in 21 route files, and the box-drawing `──` section
dividers in 8+ modules. They live only in comments (never reach the cp1252 console), so
there is no crash risk. Sweeping only the files touched this window would desync them from
the ~15 untouched files for no correctness gain - the same reasoning as the kept browser-DOM
`…` (see the 2026-07-09 ellipsis decision). Only the *stale test paths inside* the in-scope
headers were corrected; the glyphs were left intact.

### `web/routes/llm.py` "Settings → LLM scoring" error-detail strings
Decision: Keep the `→` arrows.
Rationale: These `HTTPException(detail=...)` strings pre-date baseline `16a30fa` (7 present at
baseline) and render in browser toasts as UTF-8, not on the console - browser-rendered non-ASCII
is explicitly allowed (2026-07-09 ellipsis decision). They are not console/log-bound (no handler
logs the detail), so no cp1252 risk. Out of this window's changed-behavior scope.

### `reel.py` title-card text (`… ` truncation marker, `·` separator) and `contexts.py` "Pokemon"
Decision: Keep as-is.
Rationale: The `reel.py:77` ellipsis and `reel.py:123` middle-dot are *rendered into the video
title card* (ffmpeg drawtext data), not console output - changing them changes on-screen output,
not a comment. `contexts.py`'s "Pokemon" (with the accented e) is proper-noun content inside an
LLM prompt string, correct as spelled; it is data, not a comment.

### Markdown docs (`CLAUDE.md`, `FEATURES.md`, `GLOSSARY.md`) arrows/en-dashes
Decision: Keep, and match the convention when adding.
Rationale: These are rendered-as-UTF-8 docs, not console output; they use `→`, `–`, `…`
consistently throughout. New copy added this window (the Word highlight bullet) matches the
file's existing arrow style rather than fighting it. The cp1252 rule targets console/log
strings, not rendered markup.

### FLAGGED (follow-up, not fixed here)
The Feature-map header comments in the **other 16 route files** (`analyze`, `backup`,
`content_presets`, `contexts`, `export_presets`, `imports`, `name_corrections`, `profiles`,
`projects`, `reel`, `reveal`, `scoring`, `sessions`, `sounds`, `speakers`, `videos`) still cite
the old flat `tests/test_*.py` paths after this window's `tests/{unit,integration,ui}/` split.
Same mechanical fix as the five corrected here, but beyond this phase's changed-source scope -
best done as one sweep with each file's two test paths resolved to its tier.

---

## Phase 5 logging (align / dedup / term_scope / captions) (2026-07-10)

Logging-coverage phase of the code-quality review over the changes since baseline
`16a30fa`. Added: two silent-fallback logs in `transcribe/align.py` `realign_words`
(a word with no model-alignable characters -> `debug`; a span/token count mismatch
-> `warning`), so a caption edit silently losing word-highlighting is diagnosable
from `.yuu-clip/yuu-clip.log` (root logger runs at DEBUG-to-file). Cleanup: replaced
9 mojibake em-dashes (a UTF-8 em-dash, bytes E2 80 94, re-decoded as cp1252)
in `export/render.py` with spaced hyphens - three are `console.print` strings that
stream over SSE and render as garbage. The following were reviewed and left as-is:

### `scoring/term_scope.py` `terms_for_video` silently drops orphaned-slug terms
Decision: Keep silent (no log).
Rationale: A term scoped to a deleted world context is filtered out with no log. But
`terms_for_video` is called once per clip inside the full-project rescan loop
(`sensitive.py` `_rescan_all_clips`, and the per-video rescans), so any log there is
per-iteration spam. Orphaned terms only arise after a context is deleted (creation is
guarded by `validate_context_slug`); if that tolerance ever needs to be observable,
the place to surface it is context-deletion time or a one-shot integrity check, not
this hot filter. `video_context_ids`'s malformed-JSON `except` is likewise a
tolerant-by-design normalize, not an error path.

### `align.py` non-English / empty-text gates are silent by design
Decision: Keep silent.
Rationale: The `_is_english` gate and the empty-`words` guard are expected normal
paths (a non-English segment, or text the caller already rejected as empty), not
failures - logging them would be noise on every edit. The genuine failure paths
(missing source, ffmpeg-extract failure, alignment exception, and now the two added
above) all log with the segment id or a bounded `text[:40]` preview.

---

## Phase 4 refactor (context_slug + dedup + dev CLI review) (2026-07-10)

Refactor phase of the code-quality review over the changes since baseline
`16a30fa` (dev CLI, term_scope/dedup, align/subtitles, colorpicker, context_slug
plumbing). Applied: shared `normalize_context_slug` / `validate_context_slug` in
`web/routes/common.py` (was duplicated in `hotwords.py` + `sensitive.py`); merge
buttons in `clips.js` moved from inline `onclick` to `#detail` event delegation;
removed the three never-applied pytest markers (`integration`/`ui`/`environment`).
The following were reviewed and deliberately left as-is:

### `clips.js` `_duplicatePartners` recomputes overlap as `end_ms - start_ms`
Decision: Keep as-is (client recompute).
Rationale: The server's `dedup._overlap_ratio` divides by `clip.duration_ms`, but
`ClipCandidate.duration_ms` (`db/models.py`) is a *computed property* returning
`end_ms - start_ms`, not a stored column - so the client's `end_ms - start_ms` and
the server's `duration_ms` are the same expression and cannot diverge. There is no
correctness gap to close; adding `duration_ms` to the serializer just to have the
client echo a server field would be churn. Revisit only if `duration_ms` ever
becomes an independently-stored column.

### `dev/` CLI, `transcribe/align.py`, `subtitles.py`, `colorpicker.js`, `config.py` rules table
Decision: Keep as-is (already well-decomposed).
Rationale: All reviewed for the phase's hard rules (function length, one concern,
naming, no hardcoded colours, DB-session hygiene). Each is already cohesive with
short single-concern functions and shared helpers in the right place (`dev/_base.py`,
`dev/_summary.py`, `common.py`); `config.py`'s validator rules-table and
`colorpicker.js`'s decomposition are clear. No high-value structural change found -
further edits would be cosmetic churn.

---

## "Current transcript" selection keyed on created_at, not id (2026-07-09)

Phase B (whole-codebase refactor) of the code-quality review unified the ~7 sites
that pick a track's latest transcript. Two divergent sort keys existed for the same
concept: `key=t.id` (in `pipeline/ingest.py`) and `key=t.created_at` (in
`subtitles.py`, `segments/windower.py`, `web/routes/videos.py`). These were collapsed
into one helper, `latest_track_transcript(track)` in `db/models.py`, keyed on
`created_at`.

**Keep the `created_at` key; do not flip it back to `id` or re-debate without new
evidence.** The two keys cannot disagree in the current schema: force-retranscribe
deletes all prior track-level transcript rows before inserting the new one
(`ingest.py` `_transcribe_and_check_overlap`), so each track holds a single
track-level transcript and both keys are monotonic at insert with no ties.
`created_at` was chosen because it directly expresses "most recently created" and was
already the majority (5 of 7 sites). This only becomes worth revisiting if multiple
concurrent track-level transcripts per track ever become possible.

---

## U+2026 ellipsis in browser DOM text is fine (not a cp1252 violation) (2026-07-09)

Phase B (whole-codebase UX/UI review) confirmed the web UI uses the real ellipsis
glyph `…` (U+2026) consistently across ~80 sites in the `.js`/`.html` served to the
browser. A future pass may be tempted to "sweep" these to ASCII `...` under the
project's ASCII-copy rule.

**Kept as-is - do not sweep.** The cp1252 hard-rule exists because the legacy Windows
*console* encodes stdout as cp1252 and crashes on non-cp1252 glyphs. It targets
console/log output, not browser markup, which is served and rendered as UTF-8 where
`…` displays correctly. Sweeping ~80 consistent UI strings would be churn that fights
an established typographic convention for no correctness gain. (The two stray literal
`...` in `modelcatalog.js` are the only local outliers and are inert.) This applies
only to browser DOM text - any `…` reaching a `print()`/`console.print`/log string
still must be ASCII.

---

## Docs review after Ollama removal - archive Ollama mentions kept (2026-07-09)

Phase 6 (docs and comments) of the code-quality review over the bundled-Vulkan
llama.cpp migration, which removed the Ollama backend entirely. `docs/project/
COMPLETED.md` and `docs/project/COMPLETED-archive.md` still mention Ollama in many
places. These are **kept as-is**: they are dated ship-record entries describing work
as it shipped at the time (e.g. the old `ollama_model` / `ollama_vision_model` split,
the disk-precheck for `ollama pull`). A ship log is history - rewriting it to hide a
backend that used to exist would falsify the record. The authoritative
roadmap/COMPLETED/FEATURES reconciliation is a separate later phase. Live docs
(CLAUDE.md, GLOSSARY.md, README.md) were confirmed Ollama-free (the one stale
licensing example, "Ollama tags", was removed from CLAUDE.md). Not re-flag material.

The new-module WHY comments (gpu-layers auto-fit OOM note in `scoring/
llamacpp_server.py`, the Windows orphan-reaping backstop, the "old in-process wheel
was CPU-only" migration-rationale comments in `config.py` / scoring) were reviewed and
kept - they explain non-obvious invariants and the reason today's code differs from
the removed wheel, exactly what a comment is for.

---

## Logging review of the llama-server pool - deliberate silences (2026-07-09)

Phase 5 (logging coverage) of the code-quality review over the bundled-Vulkan
llama.cpp changes. The pool (`scoring/llamacpp_server.py`) gained context on the
spawn/health/stop/Vulkan-fallback lifecycle. Two paths were left intentionally
silent and should not be re-flagged:

- **`_post` (per chat request) and `_pump_logs` (per stdout line)** are not logged
  per-call. `_post` runs once per clip during a re-score of hundreds of clips, and
  `_pump_logs` runs once per line of llama.cpp's own (verbose-off) output; logging
  either per-iteration would be spam. A failed `_post` propagates to the scorer,
  which logs it once with `exc_info` and the clip id (`scoring/llm.py`
  `LLMScorer.score`).
- **Startup failures are raised, not logged in the pool.** `_raise_startup_error`
  embeds the last 15 lines of the child's stdout/stderr in the `LlamaServerError`
  message; the caller that owns the operation logs it (the scorer with `exc_info`,
  or the route surfaces it to the user). Adding a `_log.error` inside the pool as
  well would double-log the same failure. The one exception now logged in-place is
  the Vulkan->CPU fallback, because there the exception is *swallowed* (we recover)
  so its detail would otherwise be lost.

---

## UX review of LLM model selection - "LLM scoring" term kept (2026-07-08)

The UX/UI review of the Settings model manager and the setup wizard restructured
both to lead with the model picker and hide the privacy guarantee / engine choice /
manual paths under an "Advanced AI options" disclosure (the two surfaces now mirror
each other). One finding was deliberately **not** acted on:

### "LLM scoring" / "LLM" acronym in the section title and labels

Reads as developer jargon to a non-developer; a plainer "AI scoring" would be
lower-friction on first read.

**Kept as-is.** "LLM scoring" is the authoritative `docs/dev/GLOSSARY.md` term,
explicitly recorded as "not AI scoring" - the split is intentional and consistent
across UI, CLI help, and docs. Renaming it here would either desync this surface
from the glossary or require a glossary change plus a sweep of every other use,
which is out of scope for a UX pass and would re-open a settled naming decision.
Revisit only as a deliberate glossary change, not as a one-off relabel of this
screen.

---

## Packaging-overhaul review - two keep-as-is calls (2026-07-07)

From the refactor phase of the code-quality review over the
packaging-strategy-overhaul changes (`docs/project/COMPLETED.md` section
"Packaging-strategy overhaul").

### `routes/llm.py` capability-tier builder functions

Five small functions build the tier objects returned by
`/api/capabilities/tiers` (one per capability: speaker labels, laugh/audio-event,
similarity, vertical framing, vision). They have the same shape - check
availability, report installed/missing, pick a status string - which looks like
a candidate for one generic `_build_tier(...)` helper.

**Kept separate.** The shared shape is coincidental, not shared knowledge: each
tier's availability check is a different backend call, the status strings and
"what this unlocks" copy are capability-specific, and the two are added to
independently (a change to how vision reports readiness has no reason to touch
how speaker labels does). Collapsing them into one parameterized helper would
trade five short, readable functions for one longer function with a branch per
capability - worse for a newcomer trying to find "how does the audio-event tier
decide it's ready." The response shape each function returns is also public
API surface (consumed by `settings.js`'s Capabilities section) - keeping one
function per capability keeps a change to one capability's response from
risking an accidental shape change to the others.

### `audio_event.py` / `laugh.py` `_load_failed` load-guard duplication

Both scorers cache a "the model failed to load, don't retry every clip"
boolean the same way: a module-level flag checked before attempting a load,
set on `except`, logged once.

**Kept duplicated.** Below the rule-of-three (only two instances), and the two
call sites are already coupled to tests that assert on each module's own
`_load_failed` state independently - extracting a shared helper would require
either a shared mutable singleton (the two scorers would then be able to
accidentally clear each other's failure state) or a small class per scorer
instance, either of which is more machinery than two five-line guards justify.
Revisit if a third scorer needs the same pattern.

---

## SPA decomposition Stage 05 - `index.html` to server-side partials: NO-GO (2026-07-05)

The `spa-decomposition` plan's stage 05 was written as an explicit go/no-go
gate: after stages 01-04 pulled `settings.js` and `videos.js` into cohesive
modules, would splitting the still-large `index.html` into server-side-included
partials be worth it too? Landed as `9d2ebdc` - **declined**.

The boundaries do split cleanly (the file is already banded into clearly
commented sections mirroring the JS modules). But a bespoke include layer earns
its keep by solving a real problem - reuse across pages, or a file too large to
navigate - and neither applies here: this is deliberately a **no-build** SPA
with a single served page, the sections don't repeat anywhere else, and the
existing section-divider comments already give a newcomer the same "where am I"
orientation a partial-file boundary would. Introducing include semantics (a
templating step, or a means of splicing partials at request time) adds a layer
of indirection - "which partial renders this element" - for markup that is
already easy to jump around with a plain text search. Revisit only if
`index.html` grows enough that browsing it becomes the bottleneck, not just its
line count.
