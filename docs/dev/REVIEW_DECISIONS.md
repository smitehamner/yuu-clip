# Review decisions - deliberate keep-as-is calls

Code-quality reviews (`shqr-code-quality-review`) sometimes flag something that
looks like duplication or an inconsistency, and the right call is to leave it
alone. This file is the record of *why*, so a future review doesn't re-flag the
same thing without the context. Most recent first.

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
