# Review decisions - deliberate keep-as-is calls

Code-quality reviews (`shqr-code-quality-review`) sometimes flag something that
looks like duplication or an inconsistency, and the right call is to leave it
alone. This file is the record of *why*, so a future review doesn't re-flag the
same thing without the context. Most recent first.

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
