# Review decisions - deliberate keep-as-is calls

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` to make that explicit. It exists
> so an automated review does not re-flag something a human already decided to keep.

Code-quality reviews (`shqr-code-quality-review`) sometimes flag something that
looks like duplication or an inconsistency, and the right call is to leave it
alone. This file is the record of *why*, so a future review doesn't re-flag the
same thing without the context. Most recent first.

---

## Phase 7 UX/UI - full-app review section 10, app shell & core plumbing (2026-07-26)

UX/UI walk over the shared app chrome every screen renders inside of: the header/nav,
sidebar, all 22 modals + their shared confirm/alert pattern, toast/job-pill feedback,
keyboard shortcuts, getting-started onboarding, help/glossary/about, theming
(`tokens.css`/`app.css`), and the core JS plumbing (`boot.js` a11y stamping, `ui.js`
`showConfirm`/`showAlert`, `shortcuts.js`). Anchored hard against the 2026-07-23/24
full-surface UX review (11 HIGH / ~24 MEDIUM / ~29 LOW all fixed or settled) and the
YuuClip-retheme Phase 7 - this pass looked for genuine drift/gaps those didn't cover
(individual modal content quality, onboarding copy, per-form label a11y), not
re-derivation. The shared chrome is high quality: single document-level focus trap +
boot-time `role=dialog`/`aria-modal`/`aria-labelledby` stamping, Cancel-left /
verb-specific-primary-right button order, `danger` vs `primary` OK styling driven by
`showConfirm(..., danger)`, universal `:focus-visible` ring + `prefers-reduced-motion`
block, `#sr-live-*` mirrors, `lang="en"` + viewport + theme-flash-prevention inline
script. Two clear-cut fixes applied; the rest verified good or Low/note-only.

### Applied: `auto-approve.html` used raw emoji where every other partial uses numeric entities
The score-type `<select>` rendered its axis glyphs as literal emoji (funny/dramatic/action/visual/laugh) while
`&#11088;` (Overall) and every other partial (sidebar `clips-sort`, getting-started,
etc.) use numeric HTML entities. It was the ONLY partial with raw emoji (verified by
grep over `partials/`). Renders identically in-browser, but it is real drift from the
codebase's established authored-text convention (CLAUDE.md "default to plain ASCII in
all authored text"). Aligned the five glyphs to the same entities the sidebar
`clips-sort` list uses (`&#128514;`/`&#127917;`/`&#9876;&#65039;`/`&#127916;`/`&#129315;`).
No test pinned the raw emoji; unit tier + UI smoke green after re-stitch.

### Applied: `field-edit.html` `<textarea>` had no accessible name (WCAG 4.1.2)
The single free-text field in the shared Field Edit modal had no `<label>`, no
`aria-label`, and no placeholder - its only name came indirectly from the modal's
`aria-labelledby` (the dynamic `#field-edit-title` h3). A screen reader focusing the
field announced just "edit, multi-line, blank". Added `aria-labelledby="field-edit-title"`
to the textarea so the field itself carries the dialog's dynamic title as its name
("Edit description" etc.). Low/Medium a11y; cheap and safe.

### Verified good, do NOT re-flag - getting-started is a strong non-dev first-run surface
Auto-opens once (`boot.js` gates on `localStorage 'yuu-getting-started-seen'`), focuses
the top-right X (deliberate - focusing a bottom control scrolled the tall modal open at
the bottom, see the code comment), and its top banner is state-driven off
`/api/capabilities/tiers` + `/api/llm/download-status` so a user who already set up a
local model (or has one downloading) is never told to go do it again. Content is
well-chunked (numbered Analyze/Review/Export/Build-a-reel workflow, score legend, key
concepts, quick tips) in glossary-correct terms. No bottom "Close"/CTA is by design
(2026-07-23 Low 13 removed it from all five info modals). Not a finding.

### Verified good, do NOT re-flag - help/glossary modals are clear and offline-safe
Help & Guides always lands on Overview (`HELP_DOCS[0]`, no longer reopens on last-viewed
- fixed 2026-07-25), renders the four bundled `static/help/*.md` in-app so Help works
offline/while-private, per-doc "View online" escape hatch, in-app TOC with smooth-scroll,
and a plain-English "Could not load this guide" + online-fallback error state. Glossary
has a live filter with a "No terms match your filter" empty state, `aria-label`led search
input, and section/term wrappers the filter shows/hides. Both close via top-right X,
Escape (`shortcuts.js` cascade), and background click, with focus-return to the opener.

### Verified good, do NOT re-flag - modal form copy is exemplary plain-English for a non-dev
Spot-checked the form-bearing modals (export-settings, batch-export, context-manager,
retranscribe, highlight-reels, profile-manager). Caption options read
"Embed captions - toggle on/off in your player (fast, no re-encode)" /
"Burn in captions - can't turn off later (slower, re-encodes)"; trim help gives concrete
examples and points at Edit-&-export for a visual alternative; context-manager groups
destructive actions under a labelled "Danger zone" (Delete + Reset, both `btn danger`);
profile-manager and export have `role="alert"` inline validation slots tied via
`aria-describedby`. Job-launching confirms (export/batch/retranscribe) all carry
`data-job-blocked`. Whisper `<option>` copy is identical across all five lists
(`test_ui_terminology.py`). Nothing to add.

### Low, note-only - view-switch tab buttons use `.active` class, not `role=tab`/`aria-selected`
The Highlight Reels Build/View tab bar (`reel-tab-btn`) and a few similar in-modal
view switchers signal their active view with a CSS `.active` class only, where the
sidebar's filter chips use `aria-pressed`. Minor a11y polish (a screen-reader user
doesn't hear which view is active), not a defect - the visible active state is clear and
these are pointer-first controls in a single-user desktop tool. Consistent with the app's
established tab pattern; deferred rather than reworked. Trigger to revisit: a broader
tablist a11y pass, or an AT user reports confusion.

---

## Phase 6 docs and comments - full-app review section 10, app shell & core plumbing (2026-07-26)

Grep-first survey of every `//`/`/* */` comment and Feature-map header across the HIGH scope
(`static/core/*.js`, `static/shared/{escapehtml,whisperlang}.js`, `main.esm.js`) plus MEDIUM
`library/colorpicker.js`, `routes/common.py`, `app.css`, `shared/tokens.css`, and a lighter
pass over the LOW HTML/glossary scope. Zero TODO/FIXME/XXX/HACK markers anywhere in scope.
Comment quality itself was, as Phases 1-5 already found, exceptionally clean - this section's
prose comments are uniformly WHY-focused with no restatement/obsolete/reactive/apology text
to delete. The real findings were factual drift: one stale CLAUDE.md paragraph, two Feature-map
header `API:` omissions, and two "AI scoring"/"AI scorer" self-contradictions inside
`GLOSSARY.md`'s own no-that-phrase rule. `yuu-dev bundle` (2 static JS files had comment-only
edits), `yuu-dev lint` clean, `yuu-dev test-api` 3516 passed (unchanged - comment-only diffs),
`yuu-dev typecheck` `new: 0`. No `test-js`/`test-ui` re-run - no JS logic changed, only comment
text, so neither tier's assertions could be affected.

### Fixed: `CLAUDE.md`'s jobs.js/format.js "9 `window.*` reads" paragraph was stale
The frontend-build section's "Do NOT defer a cross-module import" paragraph (added 2026-07-21)
claimed `core/jobs.js` "keeps 9 `window.*` reads" as the one exception to direct cross-module
imports, breaking vitest's `vi.mock`/`importActual` resolution. But the ui-shim-retirement
plan's Phase 2 (2026-07-25, `67a106b`) replaced that exact mechanism: `jobs.js` now has zero
`window.*` reads (confirmed by grep) and instead imports `refreshHooks` from the new
`core/refreshhooks.js` registry, which explicitly states it "replaces the old implicit
`window.loadVideos`/`window._renderClips` contract with an explicit one." The literal "9
window.* reads" language also collides with an unrelated "9" - the main.esm.js GROUP 2
test-poke shim's 9 job-machinery names kept on `window` for Playwright `page.evaluate`, a
different problem (test reachability, not import-cycle/vi.mock avoidance). Rewrote the
CLAUDE.md paragraph to name `core/refreshhooks.js`'s registry seam instead of "9 window.*
reads," and to point at that module's own header for the mechanism. NOTE: today's earlier
Phase 4 refactor entry below ("jobs.js's 9 window.* reads are the documented vi.mock
exception (CLAUDE.md), not a refactor target") repeats the same now-corrected claim - left
that entry as a historical record rather than editing it, since this entry supersedes it.

### Fixed: two Feature-map header `API:` lines were incomplete/wrong (same drift class as Sections 8/9)
`core/helpmodals.js`'s header cited only "routes/config.py (glossary)" - `/api/glossary` is
actually served by `routes/logs.py` (verified via `@router.get`), and the header omitted
`routes/llm.py` entirely despite the module fetching `/api/capabilities/tiers` and
`/api/llm/download-status` from it (both used by `_renderGettingStartedBanner`). Fixed to
"routes/logs.py (glossary), routes/llm.py (capability tiers, download status)".
`core/utils.js`'s header cited only "routes/config.py, routes/logs.py (indirectly)" but the
module also fetches `/api/install/{slug}` (routes/analyze.py's generic install endpoint, used
by the speechbrain-install helper) and `/api/reveal` (its own dedicated `routes/reveal.py`,
backing the file's own "reveal in folder" feature named in its summary line one line above).
Added both.

### Fixed: `GLOSSARY.md` contradicted its own "do not call it AI scoring" rule in two spots
The `LLM Scoring` entry (line ~807) explicitly bans "AI scoring" as a term ("LLM is the
accurate term... distinguishing LLMs from 'AI' broadly") and the terminology table at line 73
enforces this too - but the file's own `World Context` entry (line 949) described it as
helping "the AI scorer" understand context, and the Disambiguation table's `Model` row
(line 1389) glossed the LLM model as "AI scoring model (LLM)" and told readers to qualify it
as "AI model." Both are literal instances of the banned phrase inside the file that owns the
ban. Fixed both to "LLM scorer" / "LLM scoring model (LLM)" / "LLM model" respectively.
Also fixed a third instance at the `Speech-to-Text Model` entry's "Do not call it" line
("ambiguous with the AI scoring model" -> "the LLM scoring model"). Left `Session Summary`/
`Session Timeline`'s "AI-generated" phrasing and the Disambiguation `Timeline` row's "AI
15-min chunk descriptions" alone - those describe a generation feature, not the scoring
feature the ban specifically targets, and are internally consistent with each other.

### Verified clean, no drift found - `docs/dev/llm/GLOSSARY.md` vs `static/glossary.md` term-by-term
Spot-checked every term appearing in both files (Recording Segment/Split, Track Layout,
World Context, Clip, Clip Status, Highlight Reel, LLM Scoring, and the full `### ` header
list diffed side by side) for wording drift following the many Section 1-9 terminology
fixes (LLM scoring not AI scoring, Track layout not Profile, World context not RP context,
Clip not clip candidate, Highlight reel not demo reel). All current and matching; the
2026-07-13 "intentionally different files" decision below still holds - the two files differ
in scope and depth by design, not in terminology. `static/glossary.md` also re-verified free
of every banned code-name term (profile/probe/pending/demo reel/clip candidate/ingest/subtitle).

### Verified clean, no fix needed - `renderInlineMarkdown()`'s doc comment
The Phase 4 extraction's doc comment ("Escape HTML then apply the inline emphasis subset...
the doc viewer and the glossary renderer (helpmodals.js) both use") already states the WHY
(shared knowledge, not coincidence) concisely - no expansion needed.

### Verified clean, no fix needed - Phase 5's new `console.error`/`console.warn` calls
The four new log calls in `jobs.js`/`boot.js` (SSE catch sites, `refreshServerState`'s four
catches) are self-explanatory one-liners naming the failing call and the fallback behavior,
matching the file's existing `console.warn` convention - no comment needed per the "message
already clear" rule.

### Verified clean, no fix needed - `partials/modals/profile-manager.html`'s "Profile" naming
The include comment ("Profile Manager Modal"), filename, and internal DOM ids all use the
code name "profile," but the actual rendered `<h3>` reads "Track Layouts" and every button
says "Track Layout" - exactly the documented Code/UI-label split (glossary: `Code: profile`).
Not a drift; code identifiers are allowed to differ from user-facing text.

---

## Phase 5 logging coverage - full-app review section 10, app shell & core plumbing (2026-07-26)

Logging-coverage phase over the HIGH-priority app-shell/core-plumbing scope
(`static/core/*.js`, `static/shared/*.js`, `main.esm.js`) plus MEDIUM
`library/colorpicker.js` and `routes/common.py`. Grepped every `console.`/`try {`/
`catch` in scope, then read each catch site for whether a swallowed exception
would ever reach a developer (console or `core/errorreporter.js`'s global
`window.onerror`/`unhandledrejection` surface). Two real gaps fixed (both in
`core/jobs.js`/`core/boot.js`); everything else reviewed and confirmed
deliberate/already-visible. `yuu-dev bundle`, `yuu-dev test-js` 725 passed
(unchanged), `yuu-dev test-api` 3516 passed (unchanged), `yuu-dev test-ui` full
suite run (cross-cutting `boot.js`/`jobs.js` per CLAUDE.md), lint clean,
typecheck `new: 0`.

### Fixed: `core/jobs.js::_openSSE`'s two catch blocks swallowed the real error
The SSE read-loop `catch (err)` reported every failure - a malformed JSON line, a
bug in `decodeEvent`, or an exception thrown by a *consumer-supplied*
onLine/onProgress/onResult callback (jobs.js's own callbacks, or a caller like
`preview.js`/`settings-installs.js`/`modelcatalog.js` that calls `_openSSE`
directly) - as the same generic "Connection lost - server disconnected", with
zero trace of `err` anywhere. Because the exception is caught here, it never
reaches `errorreporter.js`'s global handler either, so a genuine JS bug firing
mid-stream was reported to the user as a network blip with literally no way for a
developer to find the real cause short of reproducing it. Same issue on the outer
`.catch(err => ...)` around the initial `fetch()` (any error, not just the
expected "backend stopped" `TypeError` `netErrMsg` is built for, landed there
silently too). Added `console.error(...)` in both catches before calling
`onError` - user-facing message and control flow unchanged. No test asserted
console silence (`errorreporter.test.js` is the only file that spies on
`console.error`, unrelated to `jobs.js`).

### Fixed: `core/boot.js`'s three `refreshServerState()` catches and the initial `/api/status` fetch's `.catch(() => {})` were silent
`refreshServerState()`'s three `try { fetch(...) } catch { /* keep the last known
X */ }` blocks, and the very first boot-time `/api/status` fetch (sets the
version tag, `AppState.exportDir`/`reelsDir`/`canReveal`, and reattaches an
in-progress analysis after a page refresh), had comments explaining the
fallback but no `console.warn` - a genuine backend bug (not just "the app
stopped") on any of these would be completely invisible, and for the initial
fetch specifically, a real failure means an in-progress analysis silently fails
to reattach after a refresh with no signal anywhere. These are not hot-loop
polls (`refreshServerState` fires ~6 times across the app, all user-action- or
boot-triggered, not on a timer), so a `console.warn` per failure is not log
spam - added one to each of the four catches, matching the existing
`utils.js::_toggleCollapsibleCard` convention (`console.warn('Could not persist
card collapse state:', err)`) already established in this same scope. Toast/UI
behavior unchanged.

### Not a gap (confirmed): `core/panelnav.js`'s `render(container)` call has no try/catch
`_doPanelNavOpen` calls the caller-supplied `render(container)` synchronously,
uncaught. Traced the call chain (`panelNavOpen` -> `closeSettings(callback)` ->
`_doPanelNavOpen` -> `render`): `closeSettings` invokes its callback either
directly or from inside `showConfirm`'s confirm-button click handler - both
synchronous DOM-event call chains, never deferred through an unguarded promise.
A throw inside `render()` therefore propagates all the way to the browser's
event dispatch and fires `window.onerror`, which `errorreporter.js` (wired first
thing in `boot.js`, before any other init) already catches, consoles, and
surfaces to the user via the log panel + toast. No `try/catch` needed here -
matches the pattern already confirmed for this codebase in the section 8/9
Phase 5 entries below (explicit try/catch isn't needed everywhere; the global
handler is the backstop for genuine bugs).

### Not a gap (confirmed): `core/jobs.js`'s `_pollThermalStatus`/`_waitWhileAnalyzePaused` and `utils.js::_diarizationReadiness` silent `.catch(() => null)`/`.catch(() => ({}))`
These are periodic polls (5s/3s intervals while a job runs) or a low-stakes UI
default (a checkbox's pre-check state) - logging on every failed poll would be
exactly the log-spam case the skill's "no log spam" rule warns about, and a
poll's next tick self-heals regardless. Left silent, matching the project's
established "expected transient failure, tolerant fallback" pattern (`helpmodals.js`'s
network catches, `preview.js`'s video/PiP catches, `colorpicker.js`'s localStorage
catches) - all of these either show a user-visible fallback already or guard a
low-risk, self-correcting best-effort path, not a hidden production failure.

### Not a gap (confirmed): `routes/common.py` has adequate logging
`reject_if_busy` and `with_write_retry` already log at `info` (a 409 rejection
names the blocked action; a lock-retry names the attempt count); every other
function either has no failure path worth logging (pure helpers, `HTTPException`
raises that the route's own error response documents) or propagates unchanged
for the caller/route to handle. No gap.

---

## Phase 4 refactor - full-app review section 10, app shell & core plumbing (2026-07-26)

Refactor pass over the app-shell/core-plumbing scope (`static/core/*.js`,
`static/shared/*.js`, `main.esm.js`, `library/colorpicker.js`, `routes/common.py`).
Structural survey (line counts + function-length + duplication heat map) then targeted
reads. This is the last web-layer section, so it also swept for cross-cutting duplication
now that every other web section is visible in this file's history. Two changes applied
(one assigned convention fix, one genuine extraction); everything else reviewed and left
as-is (reasons below). `yuu-dev bundle` (2 static JS edited), `yuu-dev test-js` 725 passed
(724 baseline + 1 new), `yuu-dev test-api` 3516 passed (unchanged - drift guards green),
lint clean, typecheck `new: 0`.

### Applied (assigned Phase-2 carry-forward): `core/ui.js::_applyPrereqWarnings` inline `onclick=` -> `addEventListener`
The FFmpeg/LLM prerequisite banner built its "Re-run Setup Wizard" link with an inline
`onclick="window.electronAPI.runSetupWizard();return false"` string - constant-only, no
injection risk, but a deviation from the project's hard "event delegation, never inline
onclick= with JS values" rule. Converted: the link now carries a `.prereq-wizard-link`
class and the two banner branches route through a new `_showPrereqBanner(banner, html)`
helper that sets the innerHTML then wires the click via `addEventListener` (preventDefault
+ `runSetupWizard()`). Behavior is identical; the previously-untested Electron path is now
pinned by `tests/js/core/ui.test.js` ("wires the Electron Setup Wizard link to
runSetupWizard on click"). The `style="color:var(--warning)"` is a theme token, not a
literal, so it stays.

### Applied (cross-section DRY): inline-markdown escaper extracted from `helpmodals.js` into `markdown.js`
`core/markdown.js`'s `inlineMd` and `core/helpmodals.js`'s `_renderGlossaryMd` each carried
the byte-identical escape+emphasis chain (`&<>` escape, then `` `code` ``/`**bold**`/
`*italic*`). That is shared *knowledge* (the inline-markdown subset the app supports), not a
coincidence - a future syntax addition (e.g. strikethrough) would otherwise have to touch
both. Extracted `renderInlineMarkdown(text)` (exported from `markdown.js`); `inlineMd` now
layers only its link pass on top (links stay markdown.js-only, since only the doc viewer
resolves relative hrefs), and `helpmodals.js` imports it (the import edge to `markdown.js`
already existed via `renderMarkdown`, so no new coupling). Byte-exact output, covered by the
existing `markdown.test.js` (9) + `helpmodals.test.js` (`_renderGlossaryMd`, 9). NOTE: only
the tiny inline primitive was shared - see the keep-as-is below on why the two *full*
renderers stay forked.

### Keep as-is: the two full markdown renderers (`markdown.js::renderMarkdown` vs `helpmodals.js::_renderGlossaryMd`) NOT merged
Decision: Keep the two block-level renderers separate.
Rationale: They emit structurally different HTML for different surfaces. `renderMarkdown`
(Help & Guides viewer) emits heading anchors + a table-of-contents and resolves relative
cross-links to GitHub. `_renderGlossaryMd` emits `.glossary-section`/`.glossary-term`
wrapper divs (the exact units the glossary filter shows/hides) with per-element inline
styles, no anchors/TOC/links. `markdown.js`'s own header documents this as a deliberate fork
("Modeled on the glossary modal's renderer... but generalized"). Merging would require
parameterizing the wrapper-div/inline-style/anchor differences into one function - the
"generic base that buries each caller's specifics" the codebase repeatedly rejects. Only the
inline primitive was genuinely shared knowledge (extracted above); the block structure is
not.

### Keep as-is: `core/utils.js::netErrMsg` and `core/format.js::formatApiError` are NOT duplication
Decision: Keep both error formatters.
Rationale: They format different inputs. `netErrMsg` takes a thrown `Error`/`TypeError` from
the fetch/network layer and distinguishes the "server stopped" `TypeError` into a plain-
English retry message. `formatApiError` takes a *parsed server error body* and unpacks its
`detail` (FastAPI string or validation-array) / `message` shape. Different concerns, no
shared kernel worth extracting.

### Keep as-is: `library/colorpicker.js::attach` (~51 lines) not decomposed
Decision: Keep whole.
Rationale: Over the ~30-line guideline but a single cohesive concern - construct one color
picker's DOM (hidden input + trigger button + popover) and wire that same widget's listeners,
read top-to-bottom. Splitting the construction from its own wiring would fragment tightly-
coupled setup across a seam for no legibility gain (same class as the `_attach_speakers` /
`transcribe_track` and boot-wiring keep-as-is calls). Every other function in the file is
already a small focused helper.

### Keep as-is: `core/ui.js` (675 lines) and `core/jobs.js` (698 lines) large-but-cohesive
Decision: Do not split either "core" module.
Rationale: Both are collections of small, single-concern functions around one cohesive area -
`ui.js` is the shared modal/menu/kebab/resize/toast primitive set; `jobs.js` is the job-pill
+ SSE-stream state machine. Line count comes from breadth of small helpers, not from any
long function (largest functions in each are well under the guideline). `jobs.js`'s 9
`window.*` reads are the documented `vi.mock` exception (CLAUDE.md), not a refactor target.
No natural sub-module seam that wouldn't just scatter tightly-related helpers.

### Keep as-is (re-confirmed, already anchored): `main.esm.js` residual `window.X = X` shim
Decision: Not shrunk in this pass.
Rationale: Already anchored ("Phase 4 refactor - window.X shim-drain slice (2026-07-23):
GROUP 1 shim lines all verified alive; GROUP 2 kept whole"). Draining it further is the
deferred vitest follow-on's territory, not this pass's mandate; nothing was trivially/safely
removable. `test_main_esm_shim_ratchet.py` still green (part of the test-api run). No change.

---

## Phase 3 test coverage - full-app review section 10, app shell & core plumbing (2026-07-26)

Closed the coverage gap Phase 1/2 recorded in `REVIEW_OPEN_ITEMS.md` for `core/boot.js`,
`core/refreshhooks.js`, and `core/helpmodals.js` having no dedicated `tests/js/` file, plus
checked `routes/common.py`'s `require_clip`/`require_clip_with_source` (added in Section 8)
for direct coverage while the file was already open. `yuu-dev test-js` 724 passed (698
baseline + 26 new), `yuu-dev test-api` 3516 passed (3510 baseline + 6 new), lint clean,
typecheck `new: 0`.

### Fixed: `core/refreshhooks.js` had zero `tests/js/` coverage of its own contract
The registration/dispatch/no-op-fallback registry seam was only ever exercised
incidentally, through 2 of its 7 hook keys, as test fixture setup inside
`jobs.test.js`/`format.test.js` - its own guarantees (additive registration, override
on re-register, the "unregistered hook is a safe no-op, never a ReferenceError" contract
the module's own header comment promises) were never asserted directly. Added
`tests/js/core/refreshhooks.test.js` (7 tests, no DOM needed - pure registry logic).

### Fixed: `core/helpmodals.js` had zero `tests/js/` coverage of its parsing/state logic
The modal open/close flows and the bundled help docs are already covered end to end in
`tests/ui/test_ui_help.py`, `test_ui_settings.py` (`TestGlossaryFilter`), and
`test_ui_whisper_prefetch.py` (`TestGettingStartedModal`) - but two pieces of real,
non-trivial logic inside the module had no case-by-case coverage anywhere: the hand-rolled
`_renderGlossaryMd` markdown-to-HTML parser (sections/terms/lists/tables/inline formatting/
HTML-escaping, with a section/term open-close state machine that could silently mis-nest)
and `_renderGettingStartedBanner`'s 4-branch state machine (tiers-fetch failure, a full
model already active, a lightweight tier with a model downloading, a lightweight tier with
none downloading) driven off two chained fetches that Playwright never exercises branch by
branch. Exported both (previously module-private) following the project's existing
underscore-prefixed test-only export convention (matches `_filterGlossary`,
`_resetRefreshHooks`). Added `tests/js/core/helpmodals.test.js` (19 tests): 9 for
`_renderGlossaryMd` (including a balanced-nesting check and HTML-escaping), 4 for
`_filterGlossary` (a light addition since Playwright already covers this one end to end),
and 6 for `_renderGettingStartedBanner`'s branches plus its early-return guard when the
banner element isn't in the DOM.

### Not a gap (checked, ruled out): `core/boot.js` has no dedicated `tests/js/` file
`boot.js` is the project's one deliberately-exempt module (per `CLAUDE.md`'s frontend-build
section: "the side-effect entry point") - importing it re-runs the entire app's first-paint
wiring against a bare DOM, which is exactly what `tests/js/setup.js`'s seeded-DOM approach
exists to make unnecessary elsewhere, and re-importing it per-case would require
`vi.resetModules()` plus re-seeding the whole graph for every test, the kind of new test
infrastructure this phase's skill says to confirm scope on rather than build unasked. Its
practically-testable behaviors are already exercised end to end via Playwright, spread
across the files the boot logic actually feeds: the version-tag/about-modal text
(`test_ui_page.py::test_footer_version_tag_has_v_prefix`,
`::test_about_modal_shows_version`), the clip/video sort restore-from-localStorage
(`test_ui_page.py::test_video_sort_persists_and_restores`), the getting-started-modal
open-on-first-run (`test_ui_whisper_prefetch.py::TestGettingStartedModal`), and the GPU/LLM
setup-warning chip rendering it wires from `/api/status` (`gpustatus.test.js` for the pure
logic, Settings-panel Playwright coverage for the live DOM). No test added; same pattern
Section 9 confirmed for `library/{contexts,exporteditor,sounds}.js` (DOM-heavy modules
deliberately covered in Playwright, not `tests/js/`).

### Fixed: `routes/common.py`'s `require_clip`/`require_clip_with_source` had no direct unit test
Both are shared cross-cutting helpers (used by clip preview, auto-framing, and frame
analysis routes) with real branching - `require_clip`'s 404, and
`require_clip_with_source`'s three outcomes (clip missing, recording row missing, source
file missing on disk) plus the happy path - but `test_routes_common.py` (whose own
docstring scopes it to "pure helpers... no DB, no TestClient") only ever exercised them
indirectly through the routes that call them. Added `TestRequireClip` +
`TestRequireClipWithSource` (6 tests) using a small `_FakeDb` stub (`.get(model, id)` over
a dict) plus `tmp_path` for the real/missing source-file check - no real DB or TestClient
involved, consistent with the file's existing scope. `missing_ids`, `json_list`, and
`srt_to_vtt` (the file's other pure helpers) were checked too: `json_list` and `srt_to_vtt`
already have direct unit tests (`test_utils.py::TestJsonList`, `test_captions.py`);
`missing_ids` is exercised only indirectly (`test_videos.py`'s
`test_bulk_status_reports_missing_ids` and siblings) but is a two-line order-preserving
filter with no branching worth a dedicated case - left as adequate indirect coverage, not
manufactured for its own sake.

---

## Phase 7 UX/UI - full-app review section 9, people/settings/project ops (2026-07-26)

UX/UI walk over the Section 9 static JS (reading the rendered template strings, not just
route logic): `people/{namecorrections,speakers,voices}.js`, `settings/{modelcatalog,
modeldownload,projects,settings-backup,settings-installs,settings-previews,settings}.js`,
`library/{contexts,exporteditor,exportpresets,sounds}.js`. Anchored against Section 8's
Phase 7 and the 2026-07-23/24 full-surface UX review (both found this codebase's UX quality
high - state coverage, focus management, confirm dialogs, typed-outcome `onDone` all solid),
so this pass looked for Section-9-specific gaps rather than re-deriving general principles.
**No code changes** - no clear-cut defect surfaced; the few findings are Low and either
anchored or deferred (below). No tests re-run (doc-only edit to this file).

### Verified good, do NOT re-flag - the Phase 2 path-leak message reads clearly to a non-dev
The brief asked to re-check the model-download-unavailable copy after Phase 2 made
`available()`'s binary-resolution reason generic. Traced the surface: `modelcatalog.js`'s
`_updateLlmCapabilities` renders `cap.detail` from `/api/llm/capabilities`, which is served
by `llm.py::_llamacpp_capabilities` - and per Phase 2 that endpoint does its own path-existence
checks and never calls `resolve_server_binary`, so it never carried the leak. Its detail
strings are plain-English ("No local model is set up yet", "the set-up local model file is
missing"). The generic reason only surfaces via `check_llm_available` in the scoring/speakers
routes, where it reads "The local AI engine (llama-server) could not be started - reinstall
yuu-clip, or set its path under Settings -> LLM scoring" (the one parenthetical jargon term
is bracketed and the actionable half is plain). Both read fine for a non-developer. No change.

### Verified good, do NOT re-flag - Settings information architecture is discoverable
Phase 6 found `settings.js`'s *code/comment* scope claims had drifted (fixed there), which
raised the question of whether the *UI* IA had accumulated awkwardly. It has not: the panel
opens on a Capabilities overview, carries a jump-nav (`.settings-jump-link[data-section]`),
per-section "Reset to defaults", a whole-panel reset with a reassuring "nothing saves until
you click Save" confirm, a live dirty-state Save gate, and a "discard changes?" guard on
close. Sections are chunked (STT / LLM / Speakers / Weights / Analysis / Hardware / UI /
Export / Updates + Backup + Presets + Sounds + Installs). Sub-panels are separate JS modules
but present as one coherent sectioned panel. Good IA - not a finding.

### Verified good, do NOT re-flag - contexts.js dual scope is well-separated in the UI
Phase 6 flagged that `contexts.js` owns World Context CRUD *and* Characters CRUD *and* the
re-score/retranscribe/auto-approve flows in one file. In the actual UI these are cleanly
separated surfaces: Characters render as a nested sub-section *inside* the context editor
(`#ce-characters-section`, gated behind "save the context first"); the re-score / retranscribe
/ auto-approve flows are detail-panel actions invoked elsewhere, never shown in the context
modal. The shared code file is not a shared UI - no user confusion. Confirms Phase 6's call.

### Verified good, do NOT re-flag - People merge/detach reversibility reads honestly
Merge/detach/promote/character-link all confirm proportionally and describe consequences in
plain language: detach says "you can link it again later from the voice match suggestions";
merge says "their recordings move over and the other person is removed" (an honest statement
that a merge is not one-click-undoable, gated behind a confirm); character-link is unconfirmed
because it is trivially reversible ("No character" unlinks). Speaker-side mirrors this. Empty
states double as onboarding ("No people yet. Open a recording's Speakers panel and choose
Promote to Person..."). This is the reversibility-proportionate pattern done right.

### Verified good, do NOT re-flag - model-download & backup/restore feedback is exemplary
Exactly the "long-running, can-fail-scary" flows the brief called out. `modeldownload.js`
gives per-kind progress / failure / offline ("No internet - will download when you're back
online") / cancel states with stacking banners; `modelcatalog.js` survives a Settings
re-render mid-download (progress reattaches to the rebuilt card) and reconnects to a download
another window owns, and confirms success only after verifying the file actually landed;
`settings-backup.js` restore is a review-before-commit flow that previews contents + missing
media folders, offers re-point, and its replace-existing confirm states the safety copy is
kept ("project.db.pre-restore"). Nothing to add.

### Deferred (Low) - project-switcher / backup / restore controls aren't tagged `data-job-blocked`
`/api/projects/switch` and `/api/restore/apply` are backend-guarded (409 "Analysis is
running - wait or cancel before switching/restoring"), and the JS surfaces that detail as an
error toast, so the busy case IS handled gracefully. But per the project's own convention
(CLAUDE.md: a control that launches a `reject_if_busy`-guarded action should carry
`data-job-blocked` so the user sees a *disabled* control with a why-tooltip instead of a
click-then-409), the switcher menu items and the Backup/Restore buttons could be tagged to
pre-empt the 409. Deferred as Low: these use a manual busy-check (not the `reject_if_busy`
job machinery the attribute keys off), they are rare deliberate actions, the reactive toast
is clear, and tagging the switcher (a runtime-built `<button>` menu) + the Settings buttons
is partly Section-10 HTML scope. Trigger to revisit: if a user reports confusion switching
projects mid-analysis, wire `applyJobBlockedState` coverage to these controls.

### Deferred (Low, WCAG 3.2.2 nuance, anchored) - the "Merge in..."/"Merge into..." select triggers an action on change
The per-Person / per-speaker merge picker is a `<select>` whose `change` opens a merge confirm
(a context change), which WCAG 3.2.2 (On Input) prefers be advised beforehand. It is advised
in practice - the placeholder ("Merge in...") and aria-label ("Merge another person into X")
name the action, and it opens a *confirm* rather than acting immediately, and the list reloads
to reset the select either way. Anchored: this is an established, settled app-wide pattern
(identical in `speakers.js`), pointer-first single-user desktop tool, with a confirm gate.
Not worth reworking into a button+picker. Note-only.

### Low, note-only - first-run banner copy says "the AI model" where Settings says "local model"
`modeldownload.js`'s first-run/handoff banners use friendlier "the AI model" / "AI model will
download", while `modelcatalog.js`/`settings.js` consistently say "local model" / "LLM
scoring". Not a glossary violation (the forbidden phrase is "AI scoring", which appears
nowhere - the success toast correctly says "LLM scoring is now available"), and the friendlier
"AI model" on the first-run surface is a defensible non-developer-onboarding choice. Left as-is;
recorded so a future terminology sweep doesn't treat it as drift.

### Confirmed clean - no hardcoded-color / theme violations in scope
`test_static_theme_colors.py` passes; the only literals in scope are `exporteditor.js`'s
over-video `#000` letterboxing + `rgba(0,0,0,.x)` scrims (documented theme-independent
exception) and the caption-text `l.color || '#fff'` data-encoded speaker colour (same class
as the score-gradient exception). Every UI-chrome colour is a `var(--token)` /
`color-mix(... var(--token) ...)`. No finding.

---

## Phase 6 docs and comments - full-app review section 9, people/settings/project ops (2026-07-26)

Grep-first survey (every `#`/`//` comment, docstring, and Feature-map header) over the 20
route files + 14 static JS files in Section 9 plus `appversion.py`/`pathsafety.py`. Zero
TODO/FIXME/XXX/HACK markers anywhere in scope. As Phases 1-5 already found, comment
*quality* in this section is exceptionally clean - every comment body earns its place
(WHY-focused, no restatement, no obsolete/reactive/apology text); the real category of
finding this phase surfaced, same as Section 8's Phase 6, was Feature-map header drift -
several headers named a UI/API owner that had since moved in a prior extraction (settings.js
-> modelcatalog.js, settings.js -> analyze.js) and one cited a UI file as "not yet built"
that has long since shipped. `yuu-dev bundle` (14 static JS files touched, comment-only),
`yuu-dev lint` clean, `yuu-dev test-api` 3510 passed (unchanged - doc-only edits), `yuu-dev
test-js` 698 passed (unchanged), typecheck `new: 0`.

### Applied: `routes/backup.py`'s header called its own shipped UI "Stage 3, not yet built"
Line 2 read `UI: static/settings/settings-backup.js (Stage 3, not yet built)` - but
`settings-backup.js` is a fully-built, tested feature (backup download + the
review-before-commit restore flow, `tests/ui/test_ui_backup.py`), not a stub. Actively
misleading (the exact "obsolete comment" failure mode the docs-review skill calls out as
always a finding regardless of prior sign-off). Dropped the stale parenthetical.

### Applied: `routes/llm.py` and `static/settings/modelcatalog.js` headers both named the wrong owner for `/api/capabilities/tiers`
`modelcatalog.js`'s header claimed `routes/config.py (capabilities/tiers)`; grepped every
`@router.get`/`.post` in `llm.py` vs `config.py` and every `fetch()` in `modelcatalog.js` -
`/api/capabilities/tiers` (and every other endpoint the file calls) is defined in `llm.py`,
never `config.py`. Also added `routes/models.py` (the file's `/api/models/prefetch` call,
previously uncited). Corrected both headers' API lines.

### Applied: `routes/llm.py`'s own header claimed the setup wizard as a live UI consumer of this route file
Line 2 listed `· setup wizard` alongside `modelcatalog.js` as a "UI:" consumer, and the
`GET /api/llm/catalog` docstring said "so Settings and the setup wizard render the same
... list" in a way that reads as the wizard calling this HTTP route. Grepped `electron/`
for `api/llm/catalog` - zero hits. Per the project's own locked wizard/Settings
architecture note (CLAUDE.md), the wizard runs before the Python server exists and reads
the generated `catalog-data.json` instead, never a live route. Removed the wizard from the
"UI:" line and reworded the docstring to state the real relationship (same source-of-truth
module, two different consumption paths) instead of implying a shared HTTP call.

### Applied: `routes/profiles.py`'s header pointed at the wrong UI file entirely
Claimed `UI: static/settings/settings.js (Settings → Track layouts + Profile Manager
modal)`. Grepped every `api/profiles` fetch call and every `Profile Manager`/`Track
layout` string across the JS tree - the Profile Manager modal, its open/close/save/delete
handlers, and every `/api/profiles*` fetch all live in `static/analyze/analyze.js` (New
Recording panel); `settings.js` has zero references to either. Corrected the UI line.

### Applied: `static/settings/settings.js`'s own header cited two routes it doesn't call
Claimed `API: routes/config.py, llm.py, profiles.py, content_presets.py, export_presets.py`.
Grepped every `fetch()` call and every `import` in the file: `llm.py` and `profiles.py` are
absent from both (the LLM-catalog surface was extracted to `modelcatalog.js` - which
`settings.js` does not import - and the Profile Manager was always `analyze.js`, see above).
Corrected to the file's real surface: `config.py`, `content_presets.py`, `export_presets.py`
(reached via its `exportpresets.js` import), and `routes/analyze.py` (`/api/status`,
`/api/install/speechbrain`, both directly fetched).

### Applied: `static/library/contexts.js`'s header undercounted its own scope by a wide margin
Claimed `API: routes/contexts.py` only, matching its "World context" title - but the file's
own section banners (grepped first) show it also owns Characters CRUD, the batch/individual
re-score flows, reset-approvals, auto-approve, and retranscribe. Traced every `fetch`/
`_openSSE`/`streamSSE` call to its owning route file: `routes/characters.py`,
`routes/scoring.py` (rescore-clips, rescore, redescribe-clips), `routes/analyze.py`
(retranscribe, cancel), `routes/videos.py` (auto-approve, reset-approvals) - none of which
the header named. Same shape of drift Section 8 Phase 6 fixed for `transcript.js`
undercounting its API surface. Rewrote the header to name the real scope and every route
file it touches; left the file's actual content untouched (a possible future split of
re-score/retranscribe out of "contexts.js" is a Phase-4-style refactor call, not this
phase's job - noted here so a later refactor pass sees the pointer).

### Applied: `routes/name_corrections.py` and its JS counterpart both cited a nonexistent test file
Both headers claimed `tests/ui/test_ui_namecorrections.py` - grepped `tests/ui/` and found
no such file; the real UI-layer coverage is `tests/js/people/namecorrections.test.js`
(Phase 3 of this section added it, mirrored from the same pattern that later covered
`speakers.js`/`voices.js`). Corrected both citations. While auditing this, found and closed
the same completeness gap (existing citation not wrong, just missing the newer `tests/js/`
counterpart) across every other file in scope that has one: `voices.py`/`voices.js`,
`speakers.js`, `logs.py` (had no Tests line at all despite Phase 3 adding
`tests/integration/test_logs.py` - added it), `modeldownload.js`, `settings-backup.js`,
`settings-previews.js`, `modelcatalog.js`, `exporteditor.js`, `exportpresets.js`,
`sounds.js`, `projects.js`, `settings.js`. `settings-installs.js` has no `tests/js/`
counterpart (verified) - left as-is.

### Verified, no change: `routes/sounds.py::_safe_name`'s drive-colon rejection comment
Re-read against the Phase 2 security fix it documents. It already states the WHY, not just
the what: `":" is rejected too: on Windows "C:foo.wav" has no slash but is drive-relative,
so \`sounds_dir / "C:foo.wav"\` resolves outside the sounds dir entirely` - names the
mechanism (Windows drive-relative paths) and shows the concrete escape it prevents. Exactly
the shape of comment the governing rule asks for. No edit.

### Verified, no change: `appversion.py` / `pathsafety.py` docstrings
Both re-read against "internal helpers don't need ceremony, but explain genuinely
non-obvious behavior." `pathsafety.py::is_within`'s docstring already states its exact
semantics - "Both paths should already be resolved by the caller" (symlink-resolution
policy is the caller's, not this predicate's) and "case-insensitive on Windows" - without
restating the trivial `relative_to` call. `appversion.py::app_version`'s docstring explains
the parameterized-default design (why callers pass different defaults) rather than
restating the try/except. Both already covered by Phase 4's structural review
(`Verified clean, no change: appversion.py / pathsafety.py placement + call sites`); this
pass adds the comment-content confirmation Phase 4 didn't need to make.

### Terminology sweep - clean
Grepped `clip candidate|demo reel|\bingest\b|\bprobe\b|\bpending\b|RP context|\bslug\b|
\bsubtitle\b|\bprofile\b|AI scoring|context id` (case-insensitive) across every file in
scope. Every hit was a code-level identifier (`slug` as a URL path param / JS variable,
`status == "pending"` as the literal DB value, `profile` as the documented code-name for
Track layout, `ingest` in an internal "same start->events pattern as ingest" comparison)
or an accurate internal docstring - never user-facing text reading the wrong glossary term.
No drift, consistent with every prior section's terminology sweep.

### Confirmed clean, no findings: everything else in scope
`routes/{characters,voices,contexts,content_presets,export_presets,models,imports,updates,
projects,sessions,reveal,reel,config}.py` and the JS files not called out above
(`settings-installs.js`) - every comment explains a non-obvious WHY (the SQLite
`switch_project`-mutates-ctx-in-place gotcha, the session-timeline offset math, the
speechbrain/transformers import-order landmine referenced from `speakers.py`, the
event-delegation-over-per-row-listener pattern, the `init*Listeners()`/no-module-scope-
side-effect convention) or documents a real external/product constraint (the Windows
`%SystemRoot%\Media` sound-folder path, the 25 MB upload cap, the raw-body-not-multipart
choice to avoid a `python-multipart` dependency). No restatement, no obsolete text, no
reactive/apology comments, no orphaned TODOs.

---

## Phase 5 logging coverage - full-app review section 9, people/settings/project ops (2026-07-26)

Grep-first survey (`logger.`/`_log.` calls, then bare `except` blocks, then an
imported-but-unused-logger sweep) over the 20 route files + 14 static JS files in
Section 9 plus `appversion.py`/`pathsafety.py`. Two real gaps fixed, both in
Python route layers; several apparent gaps were checked against their upstream
callee and confirmed already covered (below), and the JS half needed no changes -
confirmed covered by the project-wide `errorreporter.js` uncaught-error surface,
same as Section 8 Phase 5 found. `yuu-dev test-api` 3510 passed (unchanged - log
lines only, no behavior change), lint clean, typecheck `new: 0`.

### Applied: `routes/backup.py`'s restore-rejection catches now log before converting to HTTPException
`restore_inspect`'s `except RestoreError` and `restore_apply`'s `except
ProjectExistsError` / `except RestoreError` blocks returned the real reason to the
UI (never a generic 500) but logged nothing server-side. `project_archive.py`
logs at ERROR for the security-relevant raises (zip-slip, CRC failure) but NOT for
every `RestoreError` (a schema-version mismatch and a missing-database-member
backup raise with no log at their site), so whether a botched restore left a log
trace depended on which internal check fired - not visible from the route. Added
`_log.warning` in both `RestoreError` catches (target/staged path + the exception)
and `_log.info` in the `ProjectExistsError` catch (routine "needs overwrite
confirmation" flow, not a failure - info, not warning). No behavior change to the
returned HTTP responses.

### Applied: `routes/reveal.py` had a `_log = get_logger(__name__)` that was never called
Grepped every file in scope for `get_logger` imported vs. `_log.` actually used -
`reveal.py` was the only file where the logger was imported and assigned but had
zero call sites, so a rejected "Show in Folder" (`_path_allowed` returning False -
the security boundary that keeps Explorer from opening an arbitrary path) or a
missing target file left no trace at all. Its sibling security-boundary rejection,
`project_archive.py::_reject_unsafe_member`, already logs at ERROR when it rejects
a path outside the target dir - `reveal.py`'s guard is the same shape of check and
was the odd one out. Added `_log.warning` on both the `_path_allowed` rejection and
the missing-file 404.

### Confirmed already covered, no changes needed: model/whisper download failures (`models.py`, `llm.py`)
`routes/models.py::prefetch` and `routes/llm.py::gguf_download`/`whisper_prefetch`
have zero `logger`/`log` calls, but they delegate to `web/sse.py::subprocess_sse`,
which logs **every** stdout/stderr line of the child CLI process at DEBUG
(`_log.debug("[subprocess] %s", text)`) and the exit code failure at ERROR - and
the root logger is DEBUG (`log.py`), so the file always captures it. Traced the
actual failure text: `cli/models.py`'s `download_gguf_cmd`/`prefetch_model_cmd`/
`prefetch_whisper_cmd` all do `console.print(f"[red]Download failed: {exc}[/red]")`
on the real exception before exiting 1 - that line is stdout, so it lands in the
log at DEBUG via the same per-line capture. A failed HTTP fetch (bad URL, network
drop, incomplete download) is diagnosable from the log without a code re-read.
Route-level logging here would only duplicate what the subprocess layer already
captures.

### Confirmed already covered, no changes needed: `routes/speakers.py::infer_names` passing through `check_llm_available`'s reason
Flagged by this phase's brief (mirrors Phase 2's llm_client.py path-leak fix
pattern) - checked whether `infer_names` needed its own log before returning
`check_llm_available`'s `(ok, reason)` as a 400. Traced `check_llm_available`
(scoring/llm.py, docstring literally says "without logging") through to
`LlamaCppServerClient.available()` (scoring/llm_client.py, fixed in this section's
Phase 2): every branch's returned reason is either fully self-explanatory ("No
local model is set up yet", "the set-up local model file is missing" - the message
IS the diagnosis) or, for the one branch that redacts detail (the llama-server
binary-resolution failure, which can embed an absolute path), the full unredacted
detail is already logged at WARNING inside `available()` itself before the generic
reason is returned. No route-level log needed on top - would just repeat one of
the two things already true.

### Confirmed already covered, no changes needed: config-save and project-switch unhandled failures (`config.py`, `projects.py`)
Neither `patch_config`'s `cfg.save_project(...)` call nor `switch_project`'s
`ctx.switch_project`/`prepare_project`/`new_dir.mkdir()` calls are wrapped in a
try/except - an OSError (disk full, permission denied, AV lock) would propagate
unhandled. Checked `web/app.py`'s `@app.exception_handler(Exception)`
(`_unhandled_error`): it logs every otherwise-unhandled exception at ERROR with
the request method + path and the full traceback (`exc_info=exc`) before
returning a JSON 500 that also names the exception type to the UI. That's the
same "route + traceback" pair a dedicated per-route catch would add - a config
save or project switch failing mid-write is diagnosable from the log via this
global backstop without a code re-read. Confirmed the same for `restore_apply`'s
target directory operations before the newly-added catches take over for the
already-typed failure modes.

### Confirmed already covered, no changes needed: validation-rejection 400s across the section
Swept every plain `raise HTTPException(400, ...)` in the section's config/sounds/
reel/sessions/content-preset/export-preset routes for whether an unlogged
rejection would be undiagnosable. Every one returns a message that already states
the reason in full (`"Invalid file name"`, `"Unsupported audio type '{ext}'"`,
`"video_ids must be integers: got '{exc}'"`, `"Unknown transition '{x}'..."`) - the
response body itself is the diagnosis, so logging it server-side would be a
duplicate, not new information. This matches the section's existing pattern
(config.py's `_CONFIG_PATCH_RULES` validators, none of which log) and is left as-is.

---

## Phase 4 refactor - full-app review section 9, people/settings/project ops (2026-07-26)

Refactor pass over the 20 route files + 14 static JS files in Section 9 plus the two new
Phase 2 modules (`appversion.py`, `pathsafety.py`). Structural survey (function-length +
duplication heat map) then targeted reads. One genuine extraction applied; everything else
reviewed and deliberately left as-is (reasons below). `yuu-dev test-api` 3510 passed
(unchanged from Phase 3 baseline - pure structural change, no test added/removed), lint
clean, typecheck `new: 0`. No static JS touched (no bundle/test-js needed).

### Applied: `llm.py` disk-preflight payload shape extracted to `_disk_preflight(needed_gb, target)`
`_preflight_gguf_download` and `_preflight_whisper_prefetch` each computed
`free_gb = round(disk_usage(target).free / 1e9, 1)` and built the identical 4-key
`{sufficient, free_gb, needed_gb, target}` dict - a contract both then read verbatim in
their route handlers to raise the 507 "not enough disk space" error. The duplicated
*knowledge* is the payload shape + the free-vs-needed comparison; the domain-specific bits
(size source, headroom constant, target dir) stay in each caller. Extracted the shared
kernel; each preflight now computes its own `needed_gb`/`target` and delegates. Rule-of-two,
but the shape is exact and consumed identically twice, so the extraction removes a real
drift risk (a future change to the dict keys or the GB rounding would otherwise have to
touch both). Covered end-to-end by `test_gguf_download.py` / `test_whisper_prefetch.py`
(the 507 branch) - both still green, dict shape unchanged.

### Confirmed necessary - do NOT re-flag: the two ESM import cycles are genuine domain coupling
Phase 3 flagged `voices.js <-> speakers.js <-> transcript.js` and
`modeldownload.js -> modelcatalog.js -> settings.js -> analyze.js -> modeldownload.js` as a
testing gotcha and asked whether the cycles could be restructured away. Traced every edge:
each is a real cross-module call inside a handler body, not an accident. `speakers.js` needs
`openPeopleView` (the "manage People" action) from `voices.js`; `voices.js` needs
`loadSpeakers` (refresh the Speakers card after a People change) from `speakers.js`;
`transcript.js` needs `loadSpeakers` (refresh after a speaker reassign) and both People
modules need `reloadVideoTranscriptIfOpen`. The three views cross-navigate and
cross-refresh by nature - the cycle mirrors the domain. Same for the settings/model cluster:
`modeldownload.js` renders capability tiers owned by `modelcatalog.js`, which drives
settings-dirty/scroll state owned by `settings.js`. Breaking either would require an
event-bus/mediator indirection the project explicitly rejects (CLAUDE.md: "Do NOT defer a
cross-module import because it looks like a cycle" - esbuild bundles the graph into one
scope and hoists declarations, so function-body-only cross-references are safe). No refactor;
the testing gotcha is inherent and already documented (seed the real DOM instead of mocking
a cyclic module).

### Keep as-is: config-CRUD route modules (characters/content_presets/export_presets/contexts) NOT merged
These four (and the sibling voices/name_corrections/speakers) share a visible shape -
`make_router(ctx)`, `db = ctx.get_db(); try/finally: db.close()`, a `_*_dict` serializer,
per-field `model_fields_set` update, `_log.info` on mutate - but encode different domain
knowledge: Character has `context_slug` + `_clamp_boost` + a Person-unlink delete cascade;
content-presets copy weight fields into config and insert starter hot-words; export-presets
carry a `_slugify`/`_unique_name` immutable-id rule + `validate_preset_dict`. The shared
shape is the codebase's mandated route pattern (the `try/finally: db.close()` convention and
the one-serializer-per-entity habit), not duplicated *rules*. A generic CRUD base would
couple entities that evolve independently and bury each one's specifics - the exact call
Section 8 made for `hotwords.py`/`sensitive.py`. No merge.

### Keep as-is: `voices.py` `_members_of`/`_members_by_voice` and `_suggestions_of`/`_suggestions_by_voice` pairs
Each pair is a single-voice query and an all-voices grouped query over the same join. They
look mergeable but exist for a real reason: the grouped `_by_voice` variants (with
`joinedload(Speaker.global_voice)`) feed `list_voices` in one shot to avoid an N+1 across
every Person, while the single-voice variants serve the mutation routes that return one
Person. Collapsing them behind a "filter or group" flag would reintroduce boolean-blindness
and obscure the N+1-avoidance intent. Left as two small focused helpers.

### Verified clean, no change: `appversion.py` / `pathsafety.py` placement + call sites
Both new Phase 2 modules sit at the package root (correct - each is a cross-cutting kernel
used by both `yuu_clip/` core and `web/`, so neither belongs under `web/`). Docstrings state
the single-source-of-truth rationale; predicates are pure (callers own resolve + error
type). Grepped every call site: `app_version` (3 sites - project_archive/app/updates) and
`is_within` (3 sites - project_archive/media/reveal) each import and delegate with no
leftover inline copy of the old block. `dev/notices.py`'s own version copy is deliberately
out of scope (Section 6, noted in Phase 2). Nothing to refactor.

## Phase 3 test coverage - full-app review section 9, people/settings/project ops (2026-07-26)

Closed the five coverage gaps Phase 1 recorded in `REVIEW_OPEN_ITEMS.md`. `yuu-dev
test-api` 3510 passed (3497 baseline + 13 new), `yuu-dev test-js` 698 passed (54 files,
+4 new), lint clean, typecheck `new: 0`.

### Fixed: `people/voices.js` had zero `tests/js/` coverage (~46 top-level functions)
Added `tests/js/people/voices.test.js` (21 tests) driving the real `openPeopleView` ->
`PanelNav.open` -> fetch -> render chain, mirroring the `namecorrections.test.js`
pattern: render/gating (empty state, merge-control visibility, character-picker
grouping and the orphaned-link display case), every card action's request shape
(rename/recolor/merge/detach/character-link/suggestion-resolve/backfill), and error
toasts. While writing these, found and fixed a real (if minor) bug: `_backfillPeople`'s
success toast called `plural(data.created, 'person')` with no plural form, so
`plural`'s default (`singular + 's'`) produced "Found 3 persons to review" instead of
"people" - added the third argument. Caught mid-test by an assertion that expected the
correct grammar and failed against the actual code.

**Gotcha for a future test in this cluster:** `voices.js` <-> `speakers.js` <->
`transcript.js` form a real ESM import cycle (`speakers.js` imports `openPeopleView`
from `voices.js`; `transcript.js` imports `loadSpeakers` from `speakers.js`).
`vi.mock(...) ` + `importActual` on a module that sits inside a live cycle does not
reliably intercept the binding the cyclic importer sees - the mocked function's
`.mock.calls` stayed empty while the REAL function silently ran (and no-opped, since
its target DOM section wasn't seeded), with no exception anywhere to signal the mock
never took. This is the same class of limitation `core/jobs.js`'s CLAUDE.md note
documents for its 9 `window.*` reads. The fix used here: don't mock the cyclic module at
all - seed the real DOM section (`#speakers-section`) and let the real function run, then
assert on the resulting DOM. Confirmed via `console.log` instrumentation, not guesswork,
per the "stop reasoning, run an experiment" convention. The same issue reappeared testing
`modeldownload.js` (`modeldownload.js -> modelcatalog.js -> settings.js -> analyze.js ->
modeldownload.js` is a 4-node cycle) - same fix: don't mock `modelcatalog.js`, route its
real `/api/llm/capabilities` and `/api/capabilities/tiers` fetches, and assert on the
real DOM update (`#s-llm-capabilities` text) as proof it ran.

### Fixed: `name_corrections.py::_apply_spans`'s multi-correction-per-segment path was untested
Added `tests/unit/test_name_corrections_apply_spans.py` (8 tests, pure function - no
DB/TestClient) covering the rightmost-first replacement order (so an earlier span's
offsets are never shifted by a later, different-length replacement), the
reverse-back-to-ascending-order result contract (independent of the order items arrive
in the request), and a drifted item in the same segment not blocking its siblings.

### Fixed: `routes/logs.py` had no dedicated test file anywhere
Added `tests/integration/test_logs.py` (5 tests): `/api/logs/export`'s two branches (a
real per-project log file vs. the in-memory buffer fallback when none exists yet), the
dated filename, and `/api/glossary`'s 200/404 paths.

### Fixed: `settings/{modeldownload,settings-backup,settings-previews}.js` had zero `tests/js/` coverage
Added three files (26 tests total): `settings-previews.test.js` (12, pure DOM-in/DOM-out
- the export-filename and title-card live previews, including the contrast-warning
threshold and unknown-placeholder handling), `settings-backup.test.js` (9, the backup
download and the restore review-before-commit flow: quoted-path stripping, the repoint
mapping, and the 409 `project_exists` replace-confirmation branch), and
`modeldownload.test.js` (13, the boot-time LLM-handoff and analysis-model-prefetch
banners: per-kind gating, SSE progress/failure/offline/cancel, and
`getWhisperDownloadPct`'s reset-on-completion).

### Not a gap (already covered, review's list was stale): `contexts.py::_delete_context_characters` cascade
`REVIEW_OPEN_ITEMS.md` listed this as untested, but
`tests/integration/test_characters.py::TestContextDeleteCascade::test_deleting_context_deletes_characters_and_unlinks`
(added in commit `578b84a`, well before this review pass) already deletes a context via
the route and asserts both halves of the cascade directly against the DB: the linked
`Character` row is gone and the `ProjectVoice.character_id` that pointed at it is nulled.
No test change made; the Phase 1 gap listing was simply incorrect for this item.

---

## Phase 2 bug hunt - full-app review section 9, people/settings/project ops (2026-07-26)

Bug hunt over the Section 9 scope (20 route files + 14 static JS). The section was as
clean as Phase 1 predicted; four items were fixed (three carried-forward from Sections 4
and 7, plus one new bug found here). `yuu-dev test-api` 3497 passed (3486 baseline + 11
new), lint clean, typecheck `new: 0`.

### Fixed (carried from Section 4): `LlamaCppServerClient.available()` no longer leaks the binary path
`scoring/llm_client.py::available()` returned `str(exc)` verbatim on a `LlamaServerError`
from `resolve_server_binary`. Two of that function's three raises embed an absolute path
(the configured `llamacpp_server_binary`, or the `YUU_CLIP_LLAMA_SERVER_DIR` bundle base).
That reason flows unredacted through `check_llm_available` into UI-facing surfaces
(`routes/scoring.py`, `routes/speakers.py` `infer-speaker-names`, `routes/analyze.py`
analyze warnings), so a screenshot could leak the user's home dir - the exact leak the
sibling "missing model file" branch three lines up deliberately avoids with an explicit
comment. Matched that precedent: catch `LlamaServerError`, log the full detail at WARNING
(the log file is redacted by `_SanitizingFormatter`; the extra log keeps diagnosability),
and return a fixed generic UI reason. Confirmed via grep that no test pinned the old
leaky behavior. Pinned by
`test_scoring_llm.py::TestClientAvailableReasonNoPathLeak::test_binary_resolution_failure_reason_has_no_path`.
Note: `routes/llm.py::_llamacpp_capabilities` was already safe - it does its own
path-existence checks and never calls `resolve_server_binary`, so the capabilities
endpoint never carried the leak.

### Fixed (carried from Section 7): app-version lookup extracted to `yuu_clip/appversion.py`
The `_pkg_version("yuu-clip")` -> fallback try/except was duplicated across four sites.
Extracted `app_version(default="unknown")` (a parameterized default, because the update
check needs a parseable semver fallback `"0.0.0"` while the others want `"unknown"`).
Converted the three in-scope/already-fixed sites: `project_archive.py` (dropped its local
`_app_version`), `web/app.py` (module-level `_PKG_VERSION`), and `web/routes/updates.py`
(`app_version("0.0.0")`). `dev/notices.py` (Section 6, out of scope, closed) still has its
own copy - a low-value follow-up to adopt the helper later, left untouched deliberately.
Pinned by `tests/unit/test_appversion.py`.

### Fixed (carried from Section 7): path-containment predicate extracted to `yuu_clip/pathsafety.py`
The "does target resolve inside base?" check existed as three subtly-worded copies
(`media.py::resolve_within` and `project_archive.py::_reject_unsafe_member` used
`base not in target.parents`; `reveal.py::_is_within` used `relative_to`). Verified they
are semantically equivalent (both treat `target == base` as within, both case-insensitive
on Windows) and all callers already resolve their paths before checking. Extracted a pure
`is_within(target, base) -> bool` (the `relative_to` form) used by all three; each caller
keeps its own resolve step and its own error type (HTTPException / RestoreError / boolean
gate). Pinned by `tests/unit/test_pathsafety.py` (plus the existing
`test_resolve_within_rejects_traversal`, unchanged). `routes/backup.py` and
`routes/projects.py` (listed as candidates in the Section 7 note) turned out NOT to have
their own guard - backup delegates to `project_archive`, and the project switcher
intentionally resolves to an arbitrary user-chosen folder (no base to contain within), so
neither needs the predicate.

### Fixed (new, found here): `routes/sounds.py::_safe_name` allowed a Windows drive-relative escape
`_safe_name` rejected `/`, `\`, `.`, `..` and empty, but NOT a name like `C:evil.wav` -
which has no slash but is drive-relative on Windows, so `sounds_dir / "C:evil.wav"`
resolves to C:'s cwd, escaping the sounds dir. Reachable from three endpoints
(`/api/sounds/upload` writes bytes there, `/api/sounds/file` serves, `/api/sounds/custom`
DELETE unlinks). Low severity in a single-user loopback app, but the codebase already
treats DNS-rebinding-bypass as in-scope (see the `config.py` token-redaction comment), and
the fix is a one-line hardening: also reject `":"` (never legitimate in an audio filename
on any platform). Verified the escape empirically (`Path("sounds")/"C:x.wav"` -> `C:x.wav`)
before fixing. Pinned by `test_sounds.py::test_upload_rejects_drive_relative_name` +
`test_file_rejects_drive_relative_name`.

---

## Phase 7 UX/UI - full-app review section 8, web UI content & analysis (2026-07-26)

UX/UI walk over the Section 8 scope: `static/videos/{sessions,videos-runmeta,videos-summary,
videos-timeline,videos}.js`, `static/clips/{clipbulk,clipcreate,clipexport,clips}.js`,
`static/analyze/{analyze,reel,split,transcript}.js`, `static/library/{hotwords,sensitive}.js`
(reading the template strings they render, not just route logic). Anchored against the
2026-07-23/24 full-surface UX review (below) - most core UX was already walked and settled
there, so this pass looked for Section-8-specific drift and gaps that pass didn't cover. One
clear-cut copy fix applied; three Low findings surfaced (two deferred, reasons below). This
scope is exceptionally polished - state coverage (loading/empty/error/success + stale) is
complete on every async surface, focus is captured/restored on every static modal, every
long op has a job pill + typed-outcome-aware `onDone`, every confirm names its specific
action, and error copy is plain-English throughout. `yuu-dev test-js` 642 passed, `test-unit`
2023 passed (bundle + index drift guards green), `test-ui --changed` 205 passed, lint clean.

### Applied: "database"/"record" implementation jargon removed from three delete confirmations
`clips.js::deleteClip` ("The clip record will be removed from the database."),
`clipbulk.js::bulkDeleteClips` ("N clip records will be removed from the database."), and
`videos.js::deleteVideo` ("...are removed from the database.") all leaked implementation
terms into user-facing confirm copy, against the plain-English-for-non-developers convention
(global + project CLAUDE.md: user-facing text uses plain language, not code/impl names).
`deleteVideo` was also internally inconsistent - its dialog title and success toast both say
"YuuClip" while the body said "the database." Reworded to: "This clip will be permanently
deleted.", "N clips will be permanently deleted." (also dropping the `plural(..., 'clip
record')` -> `'clip'`), and "...are permanently removed from YuuClip." No test pinned the old
strings (grepped `tests/` first). Rebuilt the committed `bundle.esm.js` (`yuu-dev bundle`);
drift guard + `test-ui --changed` (delete flows) green.

### Deferred (Low): dynamically-built session modals lack a focus trap / focus-return
`sessions.js::_promptText` (create/rename session) and `_showSuggestionModal` (suggest
sessions) build their `.modal-bg` at runtime and `document.body.appendChild` it, so they sit
OUTSIDE the boot-time modal-a11y stamping + single document-level focus trap (`boot.js`/
`ui.js`) that the 2026-07-24 review confirmed covers the static index.html modals. Consequence:
Tab can move to background controls while these two runtime modals are open, and closing them
doesn't restore focus to the opener. They DO have `role="dialog" aria-modal="true"`, a labelled
input, autofocus, and Enter/Escape handling, so they're usable. Deferred as Low: this is a
mouse-first single-user Windows desktop tool (same rationale the review's Low 29 accepted for
pointer-only split/resize), and a proper fix wants a shared "trap a runtime-built modal" helper
rather than a per-modal patch - out of proportion for this pass. Trigger to revisit: a
keyboard-only/AT user actually needs to create or rename a session, or a shared runtime-modal
helper lands for another reason.

### Deferred (Low): split re-analyze clip-clear error names a raw internal segment id
`split.js::_doSplitAndReanalyze`'s per-segment clip-clear loop shows `Failed to clear clips on
segment ${segId}` on failure - `segId` is the raw DB row id, which a user can't map to any
visible label (the segments aren't shown numbered at that moment). Edge error path (a DB
write failing mid-split, rare). Deferred as Low: the loop is `for (const segId of activeIds)`
with no position handy, so a clean fix wants the segment's 1-based index/name threaded through;
low value for a rarely-hit path. The sibling `_abortReanalyzeChain` / `_segmentChainAbortMessage`
already do this right ("segments N-M"), so the pattern to copy exists if it's ever worth it.

### Confirmed-intentional - do NOT re-flag (verified good during this walk, scope-specific)
- Clip review/approval flow (`clips.js`): Approve/Reject/Unreviewed with A/R/U shortcuts +
  tooltips, active-state styling, review buttons disabled during a slow DB-lock retry so the
  wait reads as "working", and an undo toast on every status change (single + bulk arbitrated
  through one `undoLastStatus`). Low-friction and discoverable - the primary surface is solid.
- Bulk partial-failure surfacing (`clipbulk.js::_doBulkDeleteClips`): "Deleted N clips - M
  could not be deleted (file in use)" gives count + reason; the failed clips remain visible in
  the list (only the deleted ones vanish, selection cleared), so "which" is discoverable by
  inspection. Adequate for the audience; Phase 5 added the server-side which-ids log for the
  maintainer. Not a gap.
- Split feature clarity (`split.js`): confirm copy states exact consequences ("This deletes N
  unexported clips (keeping M exported) and runs analysis fresh on K segments"), the confirm
  button carries a disabled-reason title ("Place at least one split point first"), danger vs
  primary styling tracks the destructive vs partition action, and Undo Split exists with clear
  reversal copy. The Section-8-Phase-2 correctness fix is invisible to the user by design.
- Hot-words vs Sensitive Terms distinction (`hotwords.js`/`sensitive.js`): carried by the
  Settings section headers (Section 9/10 HTML scope); the JS row labels, empty states, and the
  `_sensitiveFuzzyGuardTripped` inline "Close spelling needs >=4 chars" warning are all clear
  and actionable. The client-side fuzzy guard pre-empts the server 400 with the same wording
  as the mode dropdown - exemplary error prevention.
- `reel.js` status-chip trap guard (`_toggleReelPoolStatus` never leaves zero statuses) and
  `mergeReelPool` (newly-entering non-approved clips default to excluded so toggling a status
  can't silently stuff clips into a reel) - both deliberate anti-foot-gun choices.
- `analyze.js` estimate/first-run copy (CPU-slower note, long-run split suggestion, measured-
  vs-rough source line) and the drag-and-drop Electron-only affordance with a browser-drop
  toast fallback - correct capability-gating, not a gap.

---

## Phase 6 docs and comments - full-app review section 8, web UI content & analysis (2026-07-26)

Docs-and-comments phase over `web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py`,
`routes/clips/{crud,edit,delete,bulk,approval,captions,export,schemas,serialize}.py`, and the
`static/{videos,clips,analyze,library}/*.js` set (per this phase's brief file list). Grepped
every `#`/`//` comment, docstring, and 3-line Feature-map header across the scope (~460 hits)
before reading; zero TODO/FIXME/XXX/HACK markers anywhere in scope. Every comment body earns
its place (WHY-focused, no restatement, no obsolete/reactive/apology text) - the one real
category of finding this phase surfaced was Feature-map header drift/gaps, not comment quality.
`yuu-dev test-api` 3486 passed (unchanged from Phase 5's baseline - comment/header-only edits),
`yuu-dev test-js` 642 passed, lint clean, 0 new mypy errors.

### Applied: three Feature-map headers corrected (drifted API-ownership references)
- `static/videos/videos-summary.js` and `static/videos/videos-timeline.js` both claimed
  `API: routes/videos.py` for summarize/regenerate-summary/timeline - those three routes
  actually live in `routes/scoring.py` (moved there by the pre-existing `400f926` module split,
  long before this section's Phase 1-5 work; the drift was already stale coming in, not
  introduced by this section). Corrected both to cite `routes/scoring.py`; `videos-summary.js`
  keeps `routes/videos.py (fields)` since the video-fields endpoint it also calls is genuinely
  there.
- `static/analyze/transcript.js` claimed `API: routes/videos.py, routes/scoring.py` - grepped
  every `fetch()` call in the file and found zero hits on any `routes/scoring.py` endpoint;
  the real surface is `routes/videos.py` (whole-recording transcript),
  `routes/clips/captions.py` (clip transcript, caption-segment edit), and `routes/speakers.py`
  (speaker CRUD/reassign, the majority of the file's fetch calls). Corrected to name all three.

### Applied: `static/clips/clips.js` had no Feature-map header at all
The largest, most central file in scope (1699 lines: clip list/filter/sort, the detail pane,
score override, merge, duplicate-scan, per-clip rescore/frame-analysis) - and the file every
sibling module's own header points back to as "the clip list" (`clipbulk.js`, `clipexport.js`,
`clipcreate.js` all reference it by name in their body comments) - carried no Feature-map header
of its own, unlike every other file this size in scope (`videos.js`, `analyze.js`, `split.js`).
Added one naming its code concept, which concerns live here vs. its three split-out siblings,
its route surface (`routes/clips/{crud,edit,delete}.py`, `routes/dedup.py`,
`routes/scoring.py` for rescore), and its two UI test files.

### Applied: `routes/analyze.py`'s header claimed "+ Import from URL" without listing its routes
The header's own title names Import-from-URL as part of this file's feature scope (the New
Recording panel handles both, and `analyze.py` cross-references import-job state in its busy
checks), but grepped and confirmed zero `/api/import-url/*` routes are actually defined in this
file - they live entirely in `routes/imports.py` (out of this section's scope list, but a real
sibling the header should name). Added it to the Siblings line.

### Verified: `videos.py`'s `_migrate_transcript_to_segments` `extracted_path=None` comment - accurate and load-bearing, no edit
Re-read the comment block (videos.py:1005-1013) against Phase 2's fix and Phase 5's added debug
log. It explicitly says "Deliberately NOT copying extracted_path", names both consumers that
would misbehave if it were copied (`run_retranscribe`, a non-force reanalyze's skip-on-existing-
path check), and states the resulting invariant in the same breath ("the ONLY non-None
extracted_path a segment ever has is the segment-local one" - actually stated at the call site
in `REVIEW_DECISIONS.md`'s own Phase 2 entry, and consistent with the code comment here). This
is exactly the shape of comment that should prevent a future maintainer from "fixing" it back to
inheriting the parent's path. Phase 5's debug log line matches what it describes
(`extracted_path=None (segment-local audio not yet extracted)`). No edit needed.

### Verified: `routes/common.py`'s `require_clip_with_source` (Phase 4 extraction) - docstring is appropriately sized, no edit
The one-paragraph docstring explains what a bare read of the three-check body (`require_clip`,
then a `Video` 404, then an on-disk-existence 404) would not make obvious on its own - which
three routes share it and why (they all re-encode from the clip's original source) - without
restating the checks themselves. `require_clip` right above it (a single check) correctly has no
docstring, consistent with "internal helpers don't need ceremony" and the rest of this same
file's pattern (`json_list`, `sse_response` are similarly undocumented one-liners; only the
multi-step/non-obvious helpers carry a docstring). Not over-documented, nothing missing.

### Terminology sweep - clean
Grepped `clip candidate|demo reel|\bingest\b|\bprobe\b|\bpending\b|RP context|\bslug\b|\bsubtitle\b|\bprofile\b|AI scoring|context id` across every `.py` and `.js` file in scope. Every hit was
either a code-level identifier/log line (module name `probe_video`, CLI flag `--subtitle-source`,
the unrelated package-install `slug` in `analyze.py`'s `/api/install/{slug}`, `req.profile` ->
`--track-layout`) or an internal docstring describing the `ClipCandidate`/status data model
(`dedup.py`'s module docstring, `approval.py`'s route docstrings using the literal
`status == "pending"` value) - never user-facing text. Every genuinely user-facing string found
(`analyze.js`'s `<label>Captions</label>`, all six "Track layout" toasts/labels in
`videos.js`/`analyze.js`/`videos-runmeta.js`) already uses the correct glossary term. No drift.

### Confirmed clean, no findings: everything else in scope
`routes/{videos,analyze,scoring,dedup}.py`, `routes/clips/{crud,edit,delete,approval,captions,
export,schemas,serialize}.py`, and the JS files not called out above (`sessions.js`,
`videos-runmeta.js`, `clipbulk.js`, `clipcreate.js`, `clipexport.js`, `reel.js`, `split.js`,
`hotwords.js`, `sensitive.js`) - every comment explains a non-obvious WHY (SQLite-lock retry
timing, the segment-offset math the Section-8-Phase-2 bug hunt fixed, PII-never-log rules, the
Windows share-delete file-handle release sequencing, the live-ESM-binding cross-module state
pattern, the `init*Listeners()`/no-module-scope-side-effects wiring convention) or documents a
real external/product constraint (RFC-shaped size-cap math mirroring `export/presets.py`,
`test_ui_terminology.py`'s five-list guard). No restatement, no obsolete text, no reactive/
apology comments, no orphaned TODOs.

---

## Phase 5 logging coverage - full-app review section 8, web UI content & analysis (2026-07-26)

Grep-first survey (`logger.`/`log.`/`_log.` calls, then bare `except` blocks) over
`web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py`, `routes/clips/*`,
and the `static/{videos,clips,analyze,library}/*.js` set. Five real gaps fixed, all
Python-side; the JS half of the scope was confirmed already covered by the
project-wide `errorreporter.js` uncaught-error surface plus per-route server-side
logging (see below), so no JS changes were needed. `yuu-dev test-api` 3486 passed
(unchanged - no tests added, only log lines), lint clean, 0 new mypy errors.

### Applied: `hotwords.py` CRUD routes now log create/update/delete
The file had **zero** `logger`/`log` calls anywhere - every create/update/delete of a
hot-word left no trace, unlike its structural sibling `sensitive.py`, which already logs
every CRUD op (id + safe fields). Unlike `sensitive.py`'s `term` (explicitly documented
"user PII by definition - never log"), a hot-word's `phrase` carries no such
restriction, so it's logged directly. Added `_log.info` on create/update (id, phrase,
match_mode, target, boost) and delete (id, phrase). No behavior change.

### Applied: `hotword_rescan` (scoring.py) / `sensitive_rescan_video` (sensitive.py) now log a summary
Both video-scoped rescan routes computed `clips_checked`/`clips_changed` and returned it
to the client but logged nothing, unlike every sibling aggregate route in this scope
(`auto_approve`, `reset_approvals`, `scan_duplicates`, the bulk-status routes, and the
project-wide sensitive-term rescan already triggered from `create/update/delete_sensitive_term`).
A "why did my clip's hot-word boost/sensitive flag change" report had no server-side
trail for these two specific triggers. Added a matching `_log.info` summary to each
(video id, clips checked, clips changed). No behavior change.

### Applied: `clips/bulk.py`'s three bulk routes now log which IDs, not just how many
`bulk_set_clip_status`, `bulk_restore_clip_status`, and `bulk_delete_clips` all logged
only counts (`%d missing`, `%d locked`) - diagnosing "8 of 10 succeeded" required
cross-referencing the client's JSON response (not persisted) since the log alone
couldn't say *which* 2 failed. Extended each summary log to include the actual
missing/locked id lists when non-empty (omitted when empty, so the common
all-succeeded case stays a short line). Bounded by the user's own selection size in
the UI, not a per-item loop - not a spam risk. No behavior change.

### Applied: `videos.py::_migrate_transcript_to_segments` now logs per-track/segment migration detail
Phase 2 (bug hunt) fixed a real, reachable bug in this exact function - a migrated
segment's `AudioTrack.extracted_path` was wrongly copied from the parent, corrupting a
later retranscribe. The fix (`extracted_path=None`) is a one-line, easy-to-silently-
regress decision with no way to see it exercised from the log - `split_video`'s existing
summary log only reports aggregate counts (`migrated_clips=N, migrated_transcript_lines=N`),
not which track went where or what path decision was made. Added a `_log.debug` line per
migrated (parent track -> new segment track) pair naming both track ids, the segment
video id, the transcript-line count, and the `extracted_path=None` decision explicitly -
so a future regression of this exact invariant is diagnosable from the log without a
repro. Debug level: this only fires on a user-initiated split with migrate_clips=True
(rare, not a hot loop), bounded by track-count x segment-count (typically <15 lines).

### Checked, no gap: JS scope (`static/{videos,clips,analyze,library}/*.js`)
Grepped `console\.(error|warn|log|debug)` across all 15 in-scope JS files: zero hits,
matching the project-wide convention (only `core/errorreporter.js`, `core/jobs.js`,
`core/utils.js` call `console.*` anywhere under `static/`). Confirmed this is
deliberate, not a gap: `initGlobalErrorReporter()` (wired once from `boot.js`) catches
every uncaught error and unhandled promise rejection app-wide and surfaces it three
ways (devtools console, the in-app log panel via `appendLog`, and a toast) - individual
modules don't need their own `console.*` calls. Explicit `try/catch` blocks in this
scope's fetch-driven code consistently `showToast` the failure for the user; the
underlying cause is already captured server-side by the corresponding route's own log
line (verified during the Python survey above), so the client-side catch is UX
feedback, not the diagnostic trail. Consistent with every other reviewed section's JS
scope. No changes.

### Checked, no gap: everything else in scope
`videos.py`'s non-split routes (compute_waveform, proxy generation, delete_video),
`analyze.py` (already thoroughly logged - every `except Exception` around a subprocess/
LLM/probe call pairs with `_log.error`/`_log.warning` carrying `exc_info=True`),
`clips/{crud,edit,approval,captions,export}.py` (every real failure path - preview
ffmpeg failure, auto-framing, vision-model start, frame analysis, per-clip export
failure in the SSE loop - already logs with `exc_info=True` and clip/video id context),
and `dedup.py` (single summary log, no failure path to miss - `find_duplicate_candidates`
is pure DB read/compute, no I/O that can fail independently of the route's own
try/finally). No changes.

## Phase 4 refactor - full-app review section 8, web UI content & analysis (2026-07-26)

Refactor pass over `web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py` +
`routes/clips/*` and the `static/{videos,clips,analyze,library}/*.js` set. Resolved the
three test-tier/duplication items `REVIEW_OPEN_ITEMS.md` carried against this section,
extracted one genuine route-level duplication, and left several borderline candidates
as-is with reasons. `yuu-dev test-api` 3486 passed (down 6 from 3492: 8 duplicate
integration tests removed, 2 added, 5 moved net-zero), lint clean, 0 new mypy errors.

### Applied: three flagged test-tier / duplication items resolved
- `TestVideoInfoProperties` - the integration-tier copy in `test_videos.py` was a
  near-literal duplicate of `tests/unit/test_probe.py::TestVideoInfoProperties`, testing
  the same pure `VideoInfo` properties with no DB/fixture. Deleted the integration copy;
  its one unique case (`duration_hms` of a zero-duration video) was folded into the
  canonical unit-tier class as `test_duration_hms_zero`.
- `TestVideoCaptionsSrt` - a pure-logic class (SimpleNamespace fixtures, no `client`/
  `project_dir`) testing `subtitles.video_captions_srt` directly, misplaced in the
  integration tier. Moved verbatim to `tests/unit/test_subtitles.py` (its natural home,
  which already covers sibling `subtitles.py` logic); dropped the per-method inline
  `from yuu_clip.subtitles import ...` in favour of a module-level import.
- `TestVideoSourceFile` + `TestVideoSource` - two classes for `/api/videos/{id}/source`
  with a duplicate missing-file-404 test and overlapping serve assertions. Folded
  `TestVideoSourceFile` into `TestVideoSource`: preserved its unique unknown-video-404
  case, dropped the duplicate missing-file-404 (kept `test_missing_file_is_404`) and the
  redundant serve test (kept the more complete `test_serves_full_file_with_range_support`).

### Applied: `require_clip_with_source` extraction (clip -> parent recording -> on-disk source, or 404)
The three routes that re-encode from a clip's original source - `crud.py::clip_preview`,
`edit.py::suggest_framing`, `edit.py::analyze_frames` - each repeated the same
load-and-validate triple verbatim (`require_clip`, then `db.get(Video)` + "Video not
found" 404, then `Path(video.path).exists()` + "Source video file not found on disk"
404). Rule-of-three met, one unambiguous concept, all sites in-scope. Extracted
`require_clip_with_source(db, clip_id) -> (clip, video)` into `routes/common.py` beside
the existing `require_clip`. `clip_preview` keeps its deliberate structure (validate
inside the `try`, run ffmpeg after `db.close()`); the returned `video`'s columns are
already loaded so they stay readable on the detached instance. Covered by the existing
`test_videos.py` route suites (preview/framing/frames 404 paths).

### Keep as-is: clip-window offset math (`segment_start_s + start_ms/1000 + start_offset`) NOT extracted
Two route sites (`crud.py::clip_preview`, `edit.py::suggest_framing`) compute the clip's
start/end seconds on the parent timeline identically, and a helper was tempting. Left as
duplicated on purpose: a grep of the wider codebase shows this math is deliberately
*divergent*, not a single reusable rule - `export/window.py` and `subtitles.py` work in
ms and clamp to 0, `export/render.py` omits the segment offset entirely (its source is
already segment-local), `analyze/frames.py` and these two routes work in seconds off the
untrimmed parent. A shared `clip_window_seconds` would become a wrong-abstraction
attractor that a future segment-local-source caller reaches for and silently double- or
un-shifts the offset - exactly the class of bug Section 8 Phase 2 fixed. The two
identical sites are only 3 lines each and each carries its own "add segment_start_s
because the source is the untrimmed parent" comment where it applies. Duplication is the
safer call here.

### Keep as-is: `hotwords.py` / `sensitive.py` CRUD structural similarity NOT merged into a generic base
The two config-CRUD route modules share a shape (list/create/update/delete, a
`_*_dict` serializer, a `_validate_*_body` helper, `with_write_retry` wrapping) but
encode different domain rules: different fields (phrase/boost/target vs
term/category), different validation (boost range + hotword dup-check vs
fuzzy-min-length + PII-never-log), and a side-effect only `sensitive.py` has
(`_rescan_all_clips` on every edit). Coincidental structural similarity, not duplicated
knowledge - a generic base would couple two entities that evolve independently and bury
the sensitive-term PII/rescan specifics. Phase 2 already brought the one genuine
behavioural gap (`with_write_retry` parity) into line. No merge.

### Keep as-is: `_compute_time_estimate` (analyze.py) and `_migrate_transcript_to_segments` (videos.py) kept whole
Both are longer than the ~30-line guideline but are single-concern and cohesive.
`_compute_time_estimate` is a cost-model calculator whose repeated "measured rate
overrides the static formula, and flag the estimate as measured-derived" block cannot
cleanly extract - the fallback formulas differ per stage and the `used_measured` flag's
consumed-key set is conditional (speakers only when `diarize`), so a helper would thread
a boolean without reducing complexity. `_migrate_transcript_to_segments` is a data-copy
routine whose length is field-count (a 12-field `AudioTrack` copy), not branching; its
two load-bearing Phase-2 comments (`extracted_path=None`, the per-word offset shift) must
stay co-located with the segment-grouping context that makes them make sense. Splitting
either would scatter shared state and load-bearing comments for no legibility gain.

### Keep as-is: long JS renderers / init-wiring functions NOT decomposed
`clips.js::renderDetail`, `videos.js::renderVideoDetail`, `clipexport.js::confirmExport`,
`analyze.js::initAnalyzeListeners`/`_doStartAnalyze` and their siblings are long
(50-135 lines) but each is a single HTML-template builder or the one-`addEventListener`-
per-control init function the codebase's "no DOM side-effects at module scope; wire in
`init*Listeners()`" hard rule mandates. No duplicated knowledge across siblings (the
`URLSearchParams` builders were already anchored separate, jobs.js `parseProgress`
mirroring already decided). Churning these template/wiring functions carries real UI
behaviour-change risk (bundle rebuild + full `test-ui`) for marginal readability, with no
concrete defect driving it. Left untouched.

## Phase 3 test coverage - full-app review section 8, web UI content & analysis (2026-07-26)

Closed the coverage gaps `REVIEW_OPEN_ITEMS.md` had recorded against Section 8 (Phase 1)
plus a mechanism gap noticed while checking Phase 2's job-blocked fix for a locking test:

- **`videos-timeline.js` zero `tests/js` coverage** - added
  `tests/js/videos/videostimeline.test.js` (11 tests) covering `_renderTimelineHTML`,
  `_timelineEmptyNoteHTML`, `generateTimeline` (config load, modal open, hint scaling),
  `closeTimelineIntervalModal` (focus restore), and `initVideosTimelineListeners`'s
  cancel/background-click wiring. No production behavior changed.
- **`clipcreate.js`'s pure helpers untested and unexported** - exported
  `_ccParseTimeToMs`, `_ccFmt`, `_ccPickLine` (behavior-neutral - they were already
  pure/module-private) and added `tests/js/clips/clipcreate.test.js` (15 tests). Ran
  `yuu-dev bundle` to regenerate the committed ESM bundle after the export change.
- **`TestReelPoolVideoIds` precedence gap** - the existing test only proved `video_ids`
  filtering worked, never that it supersedes a simultaneously-present `video_id` (the
  route's own documented contract, `reel.py:157`). Added
  `test_video_ids_supersedes_video_id_when_both_are_present` in
  `tests/integration/test_api_sessions.py`, which passes both params pointing at
  different recordings and asserts only the `video_ids` scope's clips come back.
- **`applyJobBlockedState`/`data-job-blocked` had zero test coverage anywhere** -
  noticed while checking Phase 2's videos.js job-blocked-button fix for a locking
  test; found the underlying jobs.js mechanism itself (disable-while-active,
  why-tooltip, the 2s post-job hide-delay, and the mid-job re-render re-disable path)
  had never been tested at any tier. Added a `data-job-blocked buttons` describe block
  to `tests/js/core/jobs.test.js` (4 tests) plus a `job-launching buttons carry
  data-job-blocked` describe block to `tests/js/videos/videodetail.test.js` (3 tests)
  pinning that the 4 fixed buttons (Generate Summary, Generate/Regenerate Timeline,
  (Re-)score clips with context, Re-score failed clips) actually carry the tag.

Left alone (already explicitly deferred to a different pass, not coverage gaps):
`clipbulk.js::_doBulkExportClips`'s outcome-blind `onDone` (currently unreachable dead
path per Phase 2), the `test_ui_clipcreate.py` sleep-based timing assertion, and the
three test-tier-placement/duplication notes (`TestVideoInfoProperties`,
`TestVideoCaptionsSrt`, `TestVideoSourceFile`/`TestVideoSource`) - all still recorded
in `REVIEW_OPEN_ITEMS.md`.

## Phase 2 bug hunt - full-app review section 8, web UI content & analysis (2026-07-26)

Bug hunt over `web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py` +
`routes/clips/*` and the `static/{videos,clips,analyze,library}/*.js` set. Four fixes
applied (each with a locking test), several items deferred (recorded in
`REVIEW_OPEN_ITEMS.md`).

### Applied (cross-section, resolves Section 5's carried-forward question): post-split segment audio path
Section 5 flagged a possible `run_retranscribe` offset bug that hinged on the post-split
audio lifecycle in `videos.py` (Section 8's scope). Investigation confirmed it WAS a real,
reachable bug - but the fix belongs on the split side, not in `render.py`:

- `_migrate_transcript_to_segments` (the `migrate_clips=True` split path, the "keep my
  clips/transcript, don't re-analyze" flow) created each segment's `AudioTrack` with
  `extracted_path` **copied verbatim from the parent's track**. The parent's WAV holds the
  FULL recording (parent time-0), but a segment's migrated transcript/clip times are 0-based
  within the segment. So `run_retranscribe` (which reads `track.extracted_path` at
  segment-relative offsets, with no `segment_start_s` added) would transcribe a window off by
  `segment_start_s` - and a non-`force` reanalyze would `skip` re-extraction on the
  existing-but-wrong path (`ingest.py::_extract_audio_and_check_rms_overlap` line 563),
  keeping the full-audio file for a segment.
- Fix: `_migrate_transcript_to_segments` now sets `extracted_path=None` on the migrated
  segment track. Consequences are strictly better: `run_retranscribe`'s existing guard skips
  the track (keeping the already-correct migrated transcript) instead of transcribing the
  wrong window, and a reanalyze re-extracts the trimmed segment-local audio. This preserves
  the invariant the offset-free retranscribe math relies on: the ONLY non-None
  `extracted_path` a segment ever has is the segment-local (re-analyzed) one.
- `run_retranscribe` itself needs NO change - its offset-free math is correct for a properly
  trimmed segment-local audio file. Note it could not simply "add `segment_start_s` like
  `crud.py::clip_preview` does" because retranscribe's source is the track's own WAV (which is
  segment-local when present), whereas `clip_preview`/`suggest_framing` always read the
  untrimmed parent source and so always add the offset.
- Locking test: `tests/integration/test_videos.py::TestSplitVideoTranscriptMigration::test_migrated_segment_track_does_not_inherit_parent_extracted_path`.

### Applied: sensitive.py CRUD routes wrapped in `with_write_retry` (parity with hotwords.py)
`create/update/delete_sensitive_term` did a synchronous DB write + full-project
`_rescan_all_clips` commit with no retry, while the sibling `hotwords.py` CRUD routes wrap the
identical autosave-per-edit pattern in `with_write_retry` (added 2026-07-25 because Settings'
Hot-words/Sensitive lists autosave each edit immediately and can land mid-analysis while the
analyze subprocess holds the single SQLite write lock). Confirmed `static/library/sensitive.js`
POSTs/PUTs/DELETEs each row individually (same autosave shape). Wrapped all three routes;
`with_write_retry` re-raises `HTTPException` so the 404 guards still propagate. The
video-scoped `sensitive_rescan_video` route was deliberately LEFT un-wrapped to match its
sibling `scoring.py::hotword_rescan`, which is also un-wrapped (both are explicit user
rescans, not autosaves). Regression covered by the existing `test_sensitive.py` suite (still
green).

### Applied: videos.js video-detail job buttons carry `data-job-blocked`
`renderVideoDetail`'s Generate Summary, Generate/Regenerate Timeline, (Re)score-clips, and
Re-score-failed-clips buttons launch SSE jobs the backend guards with `reject_if_busy`, but
none carried `data-job-blocked` and `renderVideoDetail` never called `applyJobBlockedState()`
(unlike `clips.js`/`reel.js`). Their only guard was `_blockedByAnalyze()`, which checks for an
ANALYZE job only - so while any NON-analyze SSE job ran (export, another recording's rescore/
timeline), clicking one tore down the live job's progress UI via `_supersedeActiveStream()` and
got a 409. Exactly the foot-gun `data-job-blocked` exists to prevent (CLAUDE.md). Tagged the
four buttons + wired `applyJobBlockedState()` into `renderVideoDetail` so a mid-job background
re-render re-disables them. `open-batch-export` was NOT tagged - it only opens a panel; the
export confirm button inside is already tagged. Covered by the full `test-ui` regression run.

### Applied: analyze.py `_measured_rates` shape-parsing guard
`/api/estimate`'s `_measured_rates` only wrapped `json.loads` + top-level key lookups in its
`try/except`; the type-sensitive follow-on accesses (`device.get`, `settings.get`, iterating
`stages`, `stage.get`) ran outside the guard, so a valid-JSON-but-wrong-shape
`analyze_run_json` (exactly the "legacy run_json" the comment claims to skip) raised
`AttributeError`/`TypeError` and 500'd the endpoint the UI calls on every analyze-config
change. Moved the shape-dependent processing inside the `try` and added `AttributeError` to
the caught tuple, honoring the documented "skip malformed, never raise" contract. Locking
test: `tests/integration/test_analyze.py::TestMeasuredRates::test_wrong_shape_run_json_skipped_not_raised`.

---

## Phase 6 docs and comments - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Docs-and-comments phase over `web/{app,deps,sse,analyze_job,media,file_deletion}.py`,
`log.py`, `console.py`, `hf_cache.py`, `url_import.py`, `project_archive.py`,
`ffmpeg_tools.py`, `track_labels.py`, `recent_projects.py`, `update_check.py`,
`whisper_catalog.py`. Grepped every `#` comment and docstring across the scope
(~180 hits) before reading; zero TODO/FIXME/XXX/HACK markers. One fix applied (the
item Phase 1 carried forward); everything else confirmed accurate and load-bearing on
direct read - this is the cleanest section reviewed so far, consistent with Phases 1/4/5's
own characterization.

### Applied: tests/unit/test_update_check.py's stale "until the repo is flipped public" comment
`test_http_error_returns_error_not_exception` explained the mocked 404 as "what an
unauthenticated request to a private repo returns... until the repo is flipped public" -
the repo flipped public 2026-07-26 (same day, per project history), so the rationale was
already obsolete. Reworded to a still-accurate reason a real GitHub release-tag lookup can
404 regardless of repo visibility (no release published yet, or the repo/tag renamed) - the
test's behavior and mock are unchanged, this was a comment-only fix.

### Verified: project_archive.py's `_verify_restorable`/`_reject_unsafe_member`/`restore_into` comments (Phase 2 fix + Phase 5 logging) - accurate, no edit
Re-read `restore_into` (project_archive.py:309-346) and its two helpers against the current
code. The comments correctly explain the WHY the brief flagged: `_verify_restorable` runs
inside the first `with zipfile.ZipFile(...)` block, entirely BEFORE the overwrite-copy /
old-DB-WAL-drop / second-`with`-extract sequence, and the inline comment at the call site
spells out why ("a corrupt member... or an unsafe path must fail here, cleanly and with the
target untouched, rather than surface... after the live DB was already half-overwritten").
Phase 5's added `_log.error` calls (member name, resolved path/target root for the zip-slip
case) are present and match what's actually raised. No drift, no edit needed.

### Verified: ffmpeg_tools.py's `_format_cmd_for_log`/`run_ffmpeg` (Phase 5's command-args-in-error fix) - accurate; `_MAX_LOGGED_ARG_LEN = 200` needs no added comment
Re-read against the brief's flagged concern (does the truncation-length constant need a WHY
comment). `_format_cmd_for_log`'s docstring already explains the truncation *shape* that
matters (per-arg, not whole-line, "so a single huge path can't hide the rest of the
command") - the specific number 200 is an arbitrary-but-reasonable round threshold (long
enough to show a real path, short enough to keep the line scannable), the same class of
magic number as `_BUFFER_LINES = 2_000` in analyze_job.py or `_KNOWN_PROJECTS_MAX = 20` in
recent_projects.py, neither of which carries a "why this number" comment either. Not adding
one - it would be padding, not information. No edit.

### Terminology sweep - clean
Grepped `clip candidate|demo reel|\bsubtitle\b|\bProfile\b|RP context|\bslug\b|\bIngest\b|Probe`
across the whole scope: zero hits. No user-facing strings in this scope at all, in fact -
every user-facing message (`RestoreError`, `ImportUrlError`, the 409 in
`file_deletion.py::locked_files_error`) was independently re-read for glossary terms while
verifying the comments above and found clean.

### Confirmed clean, no findings: everything else in scope
`web/app.py`, `web/deps.py`, `web/sse.py`, `web/analyze_job.py`, `web/media.py`, `log.py`,
`console.py`, `hf_cache.py`, `url_import.py`, `track_labels.py`, `recent_projects.py`,
`whisper_catalog.py` - every comment explains a non-obvious WHY (SQLite locking, the
identity-keyed cancel-set design, the share-delete media-serving Windows constraint, the
cp1252/UTF-8 console rewrap, credential/path log redaction, the HF-offline-mode gating
rationale) or documents a real external constraint (RFC 7233 range requests, the Restart
Manager API, yt-dlp's progress-hook/URL-cleaning rules). No restatement, no obsolete text,
no reactive/apology comments, no orphaned TODOs. `yuu-dev test-api` 3489 passed (unchanged
count from Phase 3's baseline - this phase touched only a test comment, no test
added/removed), lint clean, 0 new mypy errors (typecheck not re-run since no `.py` type
surface changed, per the "cosmetic change -> lint only" convention; the comment edit is in
a test file with no annotations touched).

---

## Phase 5 logging coverage - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Grep-first survey (`logger.`/`log.`/`_log.` calls, then bare `except` blocks) over
`web/{app,deps,sse,analyze_job,media,file_deletion}.py`, `log.py`, `console.py`,
`hf_cache.py`, `url_import.py`, `project_archive.py`, `ffmpeg_tools.py`,
`track_labels.py`, `recent_projects.py`, `update_check.py`, `whisper_catalog.py`.
Fixed 3 real gaps (see below); confirmed several checked-but-adequate areas that a
future pass should not re-flag without new evidence.

### Fixed: `ffmpeg_tools.py::run_ffmpeg` errors now include the command line
Carried forward from Section 5's bug-hunt phase (deferred there because
`ffmpeg_tools.py` wasn't yet in any reviewed section's scope). The raised
`RuntimeError` on a non-zero exit named only the tool (`ffmpeg`/`ffprobe`) and
stderr, not the argument list, so a failure wasn't reproducible from the log alone.
Added `_format_cmd_for_log` (per-arg truncation at 200 chars, not a whole-line cap,
so one huge path can't hide the rest of the command) and folded it into the error
message. This is the sole choke point every ffmpeg/ffprobe caller in the app routes
through (`render.py`, `reel.py`, `extract.py`, `proxy.py`, `crud.py`, ...), so the
fix is project-wide from one edit. `tests/unit/test_run_ffmpeg.py` covers both the
new repro-line content and the truncation.

### Fixed: `web/media.py`'s streaming generator now logs before re-raising
`media_file_response`'s body generator (`_stream`) runs *after* Starlette has
already sent HTTP headers (`StreamingResponse` sends `http.response.start` before
touching the body iterator), so a failure inside it - e.g. Windows `CreateFileW`
denying the share-delete open - can't become an HTTP error response and bypasses
`app.py`'s global `@app.exception_handler(Exception)` (which guards on
`response_started`). Before this fix such a failure had **no trace anywhere in the
app's own log** - only uvicorn's own "Exception in ASGI application" traceback,
which in a packaged Electron build has no visible console. Added a
try/log.exception/re-raise around the generator body; behavior is unchanged
(same exception still propagates), only now it lands in `yuu-clip.log` too.
`tests/unit/test_media.py` (new file) covers both this failure path and the
existing happy path, which had no prior test.

### Fixed: `project_archive.py`'s restore-integrity rejections now log the specific cause
`_verify_restorable`/`_reject_unsafe_member` (Phase 2's data-loss fix) raise a
deliberately generic `RestoreError` ("this backup is damaged" / "contains an unsafe
file path") so as not to confuse a non-technical user with zip internals - but
that meant the *actual* cause (which member failed CRC, or which member's resolved
path escaped the target dir) was lost entirely; a user's "restore failed" report
gave the maintainer nothing to go on. Added an `_log.error` immediately before each
raise, carrying the member name (and, for the zip-slip case, the resolved
destination and target root). `tests/integration/test_restore.py`'s existing
`test_restore_rejects_zip_slip_member` and
`test_restore_rejects_corrupt_archive_before_touching_target` were extended with
`caplog` assertions rather than adding new tests, since they already construct the
exact archives that trigger each path.

### Checked, no gap: `hf_cache.py`'s cache-check
Prompted check: does a "reported cached but actually wasn't" scenario leave a
trace? `_consumable_models_cached`/`repo_cached` both catch broad `Exception` and
log at `debug` ("scan failed, staying online" / "gate check failed, staying
online") - correct, since a scan failure only forgoes an optimization (never
forces a wrong answer that then breaks a real download) and staying online is
always the safe fallback. A true "said cached, wasn't" mismatch would only surface
where the model is actually loaded (whisper_runner et al.), outside this module's
job. No change.

### Checked, no gap: `app.py`'s lifespan shutdown sequence
Prompted check: loud enough to diagnose a *hung* shutdown, not just a normal one?
Already logs `info` before terminating each subprocess and `warning` before the
5 s-timeout kill escalation (both confirmed exercised and correct in Phase 2). The
one theoretical gap - `proc.kill()` followed by an un-timed `await proc.wait()` that
could itself hang if the kill somehow didn't take - was judged not worth an added
log: OS-level `kill()`/`taskkill /F` essentially always take effect immediately, and
this would be a genuinely novel OS-level failure mode, not a scenario this app has
ever hit. No change.

### Checked, no gap: raw `logging.getLogger(__name__)` vs `yuu_clip.log.get_logger`
`hf_cache.py` and `recent_projects.py` use plain `import logging;
logging.getLogger(__name__)` instead of the project's `yuu_clip.log.get_logger`
wrapper used elsewhere in this section (`app.py`, `sse.py`, `analyze_job.py`,
`file_deletion.py`, `url_import.py`, `project_archive.py`, `update_check.py`).
Verified this is functionally identical, not a coverage gap: Python's logging
hierarchy is keyed by the *name string*, not by which call created the logger
object, and both files' `__name__` already equals `"yuu_clip.<module>"` - the exact
name `get_logger` would produce anyway. It is also the dominant pattern across the
wider codebase (22 files under `yuu_clip/` use the raw form), so this is an
established convention, not a one-off inconsistency in scope here. No change.

## Phase 4 refactor - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Refactor pass over `web/{app,deps,sse,analyze_job,media,file_deletion}.py`, `log.py`,
`console.py`, `hf_cache.py`, `url_import.py`, `project_archive.py`, `ffmpeg_tools.py`,
`track_labels.py`, `recent_projects.py`, `update_check.py`, `whisper_catalog.py`.
Structural survey (function-length + duplication grep) then full reads of every file.
No code changes: the scope is uniformly well-decomposed (functions single-concern and
under the size bar, names reveal intent, tradeoffs already carried in comments), and
Phase 2 already hardened the one complex file (`project_archive.py`'s restore-integrity
path). The only two genuine duplicated-knowledge signals both have the majority of their
call sites in out-of-scope `web/routes/*.py`, so both are deferred to the routes pass
rather than half-migrated here (see below). No behavior changed; test suite unchanged
from the Phase 3 baseline (3485 passed) - no code touched, so not re-run.

### `project_archive.py::restore_into` decomposition after the Phase 2 integrity fix - kept whole
Phase 2 added an up-front `_verify_restorable(archive, target_dir)` call inside
`restore_into`'s first `with zipfile.ZipFile(...)` block, then the overwrite/pre-restore
copy, then a second `with` for `_extract_members`. Reviewed whether the two-open shape and
the extra validation step warrant splitting `restore_into` further. Decision: keep as-is.
The function is ~30 lines of body with the verify -> guard-overwrite -> extract sequence
reading top to bottom; the two zip opens are deliberate (verify before the target is
touched, extract after), and the CRC/zip-slip/DB-member checks are already extracted into
named helpers (`_verify_restorable`, `_reject_unsafe_member`, the `_DB_ARCNAME` guard).
Splitting the orchestration further would scatter the ordering that the comments make
load-bearing. The atomic-write question for `track_labels.py` remains a separate open
human-decision item (untouched, per this phase's scope).

### `web/sse.py` cancelled/counted proc-tracking vs `web/analyze_job.py`'s AnalyzeJob state - deliberately separate, not duplicated
Confirmed the two process-tracking mechanisms are two different designs by intent, not
accidental duplication (CLAUDE.md's "Subprocess cancellation" + the SSE typed-event
migration record). `subprocess_sse` tracks short, stream-tied jobs via identity-keyed
`ctx.cancelled_procs`/`counted_procs` sets (killed on client disconnect); `AnalyzeJob`
is a reattachable broadcast buffer whose lifecycle is decoupled from any single stream
(survives a browser refresh, killed only on explicit cancel/shutdown). They already share
the correct surface - `terminate_process_tree_async`, `new_session_kwargs`, and the
`jobevents` wire helpers. No merge.

### Deferred to the routes pass (Section 8/9): `_pkg_version("yuu-clip")` -> "unknown" block duplicated 4x
The three-line "installed yuu-clip version, or 'unknown'" try/except appears verbatim in
`project_archive.py::_app_version` (in scope), `web/app.py`'s module-level `_PKG_VERSION`
(in scope), `web/routes/updates.py` (OUT of scope), and a variant in `dev/notices.py`.
Genuine duplicated knowledge, but 2 of the 4 sites (the routes helper being a primary
stakeholder) are outside this phase's scope. Extracting a single `app_version()` now would
convert only the two in-scope callers, pre-commit the helper's home, and leave the routes
duplicate in place - the half-migrated state the wide-change convention warns against.
Surfaced for a wholesale extraction when `routes/updates.py` is reviewed, so every call
site converts in one coherent change and the routes pass picks the home.

### Deferred to the routes pass (Section 8/9): "resolve within a base dir, reject traversal" duplicated
`media.py::resolve_within` (raises `HTTPException` 404) and
`project_archive.py::_reject_unsafe_member` (raises `RestoreError`) share the same
resolved-path-not-escaping-base shape, as do several out-of-scope route sites
(`routes/reveal.py::_is_within`, `routes/backup.py`, `routes/projects.py`). Each raises a
domain-specific error (or returns a bool), so any shared primitive would be a pure
`is_within(base, target) -> bool` predicate the callers wrap. Same situation as the version
block: the majority of call sites are in out-of-scope routes, so a complete extraction
belongs to the routes pass rather than a partial in-scope-only conversion. Surfaced, not
extracted.

## Phase 1 test integrity - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Test-integrity pass over `web/{app,deps,sse,analyze_job,media,file_deletion}.py`,
`log.py`, `console.py`, `hf_cache.py`, `url_import.py`, `project_archive.py`,
`ffmpeg_tools.py`, `track_labels.py`, `recent_projects.py`, `update_check.py`, and
`whisper_catalog.py` (the last 5 modules missing from `REVIEW_MAP.md` entirely, folded
in here as cross-cutting utilities). Baseline was green (3464 passed) and stayed green -
no changes made. This is the strongest-tested scope reviewed so far: `test_sse.py` and
`test_url_import.py`'s `TestSubprocessSseCancel` classes exercise the identity-keyed
`ctx.cancelled_procs` design directly (a stale entry from a different job's proc object
must not leak into a new job's `done{cancelled}`); `test_restore.py` covers zip-slip
path-traversal rejection, a pre-restore safety copy of the old DB, and schema-version
rejection - real data-loss-adjacent guards, not happy-path-only; `test_log_redact.py`
asserts the username/secret is actually absent from the formatted output (not just that
logging didn't crash); `test_export.py`'s `TestUnlinkWithRetry` drives a genuinely flaky
mocked `Path.unlink` (fails N times then succeeds) rather than mocking away the retry
loop itself. No vague names, tautologies, order dependence, or fragile snapshot/log-line
assertions found.

### `TestSubprocessSseTracksActiveJob`/`TestSubprocessSseCancel` in test_url_import.py duplicate test_sse.py - surfaced, not fixed
`tests/unit/test_url_import.py`'s two classes re-exercise the same generic
`web/sse.py::subprocess_sse` identity-keyed cancel behavior already covered by
`tests/unit/test_sse.py::TestSubprocessSseTypedWire` (`test_cancelled_proc_yields_done_cancelled`,
`test_stale_cancelled_proc_does_not_leak_into_a_new_job` vs. `test_stale_proc_identity_not_leaked`).
Same shape as the `TestProfiles`/`TestProfileFunctions` precedent from Section 6's phase 1:
left as-is - a test-integrity pass fixes fragility and clarity, not cross-file dedup -
flagged here for a future dedup pass rather than merged unprompted.

### Coverage gaps noted for the Phase 3 pass, not addressed here
- `tests/integration/test_analyze.py::TestGracefulShutdown` covers `ctx.analyze_proc` and
  `ctx.subprocess_procs` termination on server shutdown but never sets `ctx.analyze_job.proc`
  (the `AnalyzeJob`-tracked path `web/app.py`'s `lifespan` also terminates) - a real gap in
  the shutdown test, not a fragility issue.
- `file_deletion.py`'s `_rm_locking_processes` (the actual Restart Manager ctypes call) has
  no unit test - inherently hard to test without mocking ctypes/ WinDLL deeply; the
  surrounding `locking_processes`/`locked_files_error` behavior is tested via monkeypatching
  it out, which is the pragmatic boundary.
- `console.py` (the stdout/stderr UTF-8 rewrap + `BYTES_PER_MB`) has no dedicated test -
  low value given it is a two-line encoding shim executed at import time.

## Phase 6 docs and comments - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Docs-and-comments phase over `db/models.py`, `config.py`, `model_catalog.py`, `contexts.py`,
`content_presets.py`, `sessions.py` (HIGH), the `cli/` adapters (MEDIUM: `analyze`, `export`,
`reel`, `review`, `serve`, `models`, `restore`, `import_url`, `_base`), and a spot-check of
`dev/{chaos,tests,shareddata,fixture}.py` (LOW, per this phase's budget). Grepped every `#`
comment and docstring across the HIGH+MEDIUM scope (~460 hits) before reading; zero
TODO/FIXME/XXX/HACK markers anywhere in scope. One real terminology-drift fix applied; both
of this phase's brief-flagged verification items confirmed clean. `yuu-dev test-api` 3464
passed (unchanged from Phase 5's baseline), lint clean, 0 new mypy errors.

### Applied: cli/export.py's two `--help` strings said "Clip candidate ID", not "Clip ID"
`export` (line 24) and `retranscribe` (line 93) both had `typer.Argument(..., help="Clip
candidate ID...")` - user-facing `--help` text using the code name (`ClipCandidate`) instead
of the glossary term ("Clip" - not "clip candidate" in user-facing text, per `GLOSSARY.md`).
Confirmed the drift against two sibling surfaces already using the correct term: the error
message two lines below each (`"No clip with ID {clip_id}"`) and `cli/reel.py:21`'s
`--clip-id` help ("Specific clip IDs to include..."). Reworded both to "Clip ID to export" /
"Clip ID" - text-only, no behavior change; grepped `tests/` for the old string first, no test
pinned it. `yuu_clip/cli/reel.py:172`'s "Query clip candidates for the demo command" and
`config.py:658`'s "visual moments EXIST as clip candidates" were also checked and left as-is
- both are internal docstrings/comments describing the `ClipCandidate` data model itself
(never shown to a user), not user-facing text, so they're the correct code-level usage per
the glossary's own code/UI split.

### Verified: the two brief-flagged comments from Phase 4 are both correct and load-bearing
1. **config.py's relocated AI-privacy comment** (lines 472-477, heading `AiPermissions`/
   `resolve_ai_permissions`) reads cleanly in its new location - it explicitly says
   "Enforced everywhere a language model could run, via resolve_ai_permissions below" and
   fully explains the none-vs-local_only / discriminative-vs-generative distinction with no
   dangling reference to the deleted `validate_ai_privacy_mode` function it used to sit near.
   Not orphaned. No edit needed.
2. **db/models.py's `_prefer_user_value` helper** (lines 62-67) carries the WHY docstring
   Phase 4 claimed: "Keyed on `is not None` (not truthiness) so a deliberately-blank user
   override ("") still wins over the generated value rather than falling through to it."
   Present, accurate, and clear. No edit needed.

### Terminology sweep - one drift found and fixed (above), everything else clean
Grepped `\bprofile\b|RP context|clip candidate|demo reel|\bsubtitle\b|\bProbe\b|slug` across
the whole HIGH+MEDIUM scope. Findings, all non-issues except the one fixed above:
- `cli/analyze.py`'s `probe` command (CLI name unchanged, `--help` text already correctly
  says "Inspect a recording's audio tracks...") - `GLOSSARY.md` already documents this
  exact exception verbatim ("also available standalone via `yuuclip probe` (CLI name
  unchanged for now)"). Not a new finding - already anchored in the glossary itself.
- `contexts.py:136`'s "routes reject an unknown slug with a 400" - an internal docstring for
  `known_context_ids()` describing route/API validation behavor, immediately following its
  own use of the code identifier `` `context_slug` ``; not user-facing UI text. Left as-is.
- `cli/models.py:18`'s "slug -> friendly description" - a different `slug` concept entirely
  (a Tier-B model catalog key: speaker/audio_event/embeddings/face_detector), unrelated to
  the world-context `context_slug` the glossary's "Context ID" rule targets. Not a drift.
- No `RP context`, `demo reel`, or bare `subtitle` (as opposed to "caption") hits in
  user-facing text anywhere in scope.

### Confirmed clean, no findings: everything else in scope
`db/models.py`, `model_catalog.py`, `content_presets.py`, `sessions.py`, and the remaining
`cli/` adapters (`analyze.py`, `reel.py`, `review.py`, `serve.py`, `models.py`, `restore.py`,
`import_url.py`, `_base.py`) - every comment explains a non-obvious WHY (SQLite locking
tuning, JSON NULL-vs-empty persistence contracts, the additive-migration no-FK pattern,
threshold-tuning history with dates/numbers, licence-rejection rationale) or documents a
real external constraint (OBS filename format, HuggingFace revision pinning steps, the
GitHub update-check's no-telemetry guarantee). No restatement, no obsolete text, no
reactive/apology comments. The `dev/{chaos,tests,shareddata,fixture}.py` spot-check (LOW
tier) showed the same pattern - not exhaustively reviewed beyond these four per the LOW-tier
budget, consistent with Phase 1/4/5's characterization of this whole section as unusually
clean coming in.

---

## Phase 5 logging - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Logging-coverage phase over `db/models.py`, `config.py`, `model_catalog.py`, `contexts.py`,
`content_presets.py`, `sessions.py` (HIGH), the `cli/` adapters (MEDIUM), and a spot-check of
`dev/{bundle,migrate,chaos}.py` (LOW, per this phase's brief). Grep-first survey (every
`logger.`/`log.`/`console.print`/`typer.echo` call plus every bare `except`) then full reads
of the zero/thin-logging files. One real gap found and fixed; one dead-code line removed;
everything else confirmed already correct or deliberately silent. `yuu-dev test-api` 3464
passed after (3463 baseline + 1 new), lint clean, 0 new mypy errors.

### Applied
- **cli/reel.py: `_select_reel_clips` now logs + prints when an explicit `--clip-id` is not
  found.** Previously `[id_map[cid] for cid in clip_ids if cid in id_map]` silently dropped
  any requested ID with no DB row - reachable in practice via `routes/reel.py`'s
  `/api/demo/start` (a race: a clip in the web UI's selection gets deleted, exported-away, or
  mistyped between the route's own pre-check and this subprocess's query, since the route
  passes the raw `req.clip_ids` through to `--clip-id`, not its own filtered `clips` list).
  The only visible symptom before this fix was a smaller-than-expected clip count in
  `_print_reel_plan`'s output line, with no way to tell which ID was dropped or why. Now logs
  `log.warning("Reel: requested clip ID(s) not found in this project, skipping: %s", missing)`
  (reaches `.yuu-clip/yuu-clip.log` since `--project` triggers `configure_logging` via
  `_load_project`, and this command is invoked as an SSE subprocess from the web UI, so the
  console line is also captured per the established `subprocess_sse` convention - see the
  Section-5 Phase-5 entry) plus a `[yellow]` console note naming the missing IDs. Selection
  behavior is unchanged - still skips, doesn't fail the whole reel. Added
  `test_explicit_clip_ids_unknown_id_is_logged_and_printed` in
  `tests/integration/test_cli_reel.py` (asserts both the `caplog` warning and the console
  capture) alongside the existing `test_explicit_clip_ids_skip_unknown_ids` that pins the
  skip behavior itself.
- **cli/_base.py: removed the unused `log = get_logger(__name__)` module-level logger.**
  Grepped `cli._base import.*\blog\b` across the whole repo (including tests): zero
  importers, and no code in `_base.py` itself called `log.*`. `configure_logging`/`console`
  stay (both genuinely used - `configure_logging` wires the sink every `_load_project` call
  needs; `console` re-exports for every CLI command's output). Dead code, not a logging gap
  by itself, but directly in this phase's file (`log.py`'s own `get_logger`) so cleaned up
  in passing rather than left for a future refactor pass to rediscover.

### Confirmed already correct, no change needed
- **config.py's `_sanitize_*` load-path warnings already name the field, the invalid value,
  and the fallback default on every branch** (`_sanitize_title_card_fields`,
  `_sanitize_caption_style_fields`, `_sanitize_vision_fields`,
  `_sanitize_content_preset_field`, `_sanitize_diarization_backend`, plus the unrecognised-key
  and corrupt-file warnings). This directly answers the brief's flagged concern ("verify these
  warnings actually identify WHICH field failed and what the fallback value is") - they all
  do, e.g. `"Config: %s invalid (%r) - using default %s", field_name, merged[field_name],
  _TITLE_CARD_DEFAULTS[field_name]`. `whisper_model`/`whisper_language` are deliberately NOT
  healed on load (no load-time sanitizer calls `validate_whisper_model`/
  `validate_whisper_language`) - a bad hand-edited value instead raises a clear `ValueError`
  (allowed-list + guidance) at the point of actual use (`transcriber.py`, `routes/config.py`,
  `cli/export.py`), which is a legitimate "fail loud where it's used" design already covered
  by tests, not a load-time silent-heal gap. Not a finding.
- **model_catalog.py: the brief's flagged concern ("does an unknown model_id silently fall
  through to a default?") does not reproduce.** `model_by_id` is a pure `dict.get` with two
  real callers in the whole repo: `web/routes/llm.py` (out of this section's scope) and
  `cli/models.py`'s `_resolve_gguf_entry`, which already turns a miss into
  `(None, f"Unknown model id '{model_id}'.")`, and `download_gguf_cmd` already prints that
  reason in red and exits 1 - a clear, CLI-appropriate surface (per this phase's own guidance
  that console output, not a log line, is what matters for this layer). No silent fallback to
  a default model exists anywhere in the lookup path. `model_catalog.py` itself stays
  log-free, matching the existing `content_presets.py`/`describe_basic.py` precedent (pure
  static-data lookup, no I/O, no external call).
- **content_presets.py and sessions.py stay log-free - both pure in-memory logic (no I/O, no
  DB, no external call, no exception path that isn't a programmer error), matching the
  `describe_basic.py` precedent already anchored in this file's Section-4 Phase-5 entry.**
  `content_presets.py`'s `preset_by_id`/`preset_flavor` degrade gracefully on an unknown ID
  (`None`/`""`) with no failure mode to log; `sessions.py` is pure grouping/parsing math over
  in-memory dataclasses. Not a finding.
- **db/models.py has no logging of its own, as expected for an ORM layer** - confirmed per
  this phase's own brief, not re-flagged.
- **dev/{bundle,migrate,chaos}.py spot-check (LOW tier, per this phase's brief) - subprocess
  error handling is already solid.** `bundle.py`'s `build_esm_bundle` captures esbuild's
  stdout/stderr and raises a `RuntimeError` with the captured detail plus a "did you run npm
  install?" hint on non-zero exit - never a silent failure. `migrate.py`'s three commands
  don't wrap Alembic calls in try/except, but this is a dev-only, human-run tool where an
  unhandled exception with a full traceback (Alembic's own, which is already descriptive) is
  itself the diagnosable surface, not a swallowed error. `chaos.py` (an exploratory bug-hunt
  harness, not a gate) already has its own extensive per-phase try/except-and-report
  machinery (`_safe`, `_report`, the bounded-join watchdog for a wedged Playwright driver) -
  this file's entire purpose is surfacing failures clearly, and it already does. No changes
  warranted; `deps.py`'s `lock_deps` (glanced at while spot-checking) also already reports
  pip install failures with an exit-code-preserving message. Not exhaustively reviewed beyond
  these per the LOW-tier budget.

---

## Phase 4 refactor - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Refactor-for-quality phase over `db/models.py`, `config.py`, `model_catalog.py`,
`contexts.py`, `content_presets.py`, `sessions.py` (HIGH), the `cli/` adapters (MEDIUM),
and the `dev/` tooling (LOW spot-check). Structural survey (function-length heat map +
duplication-signature greps) then targeted reads of the two largest files (`db/models.py`
914 lines, `config.py` 939) plus the flagged candidates. Two changes applied; suite
stayed at 3463 passed before and after, lint clean, 0 new mypy errors.

### Applied - two changes
1. **config.py: deleted the dead `validate_ai_privacy_mode` function and its
   `ALLOWED_AI_PRIVACY_MODES` constant** (the Phase-3 flagged dead-code item). Grepped the
   whole repo + tests + `__all__`: zero callers of either symbol anywhere; the constant was
   referenced only inside the dead function. Decisive evidence it is genuine speculative
   symmetry, not an unwired parallel API: it was written to mirror
   `ALLOWED_WHISPER_LANGUAGES`/`validate_whisper_language`, but `web/routes/config.py`
   validates simple set-membership enums through a *generic* `_enum_validator({...}, label)`
   table (14+ fields inline, including `ai_privacy_mode` at line 248) and imports dedicated
   `validate_whisper_*` functions ONLY for the two fields that need normalization *beyond*
   membership (lowercase/auto/None; catalog lookup). `ai_privacy_mode` is plain 2-value
   membership, so the route's generic path is its intended handler and a dedicated validator
   is architecturally unnecessary. The genuinely-useful "none vs local_only, discriminative
   vs generative" explanatory comment was preserved by relocating it to head the
   `AiPermissions`/`resolve_ai_permissions` enforcement block (it already said "via
   resolve_ai_permissions below"). No behavior change - `resolve_ai_permissions` was and
   remains the only enforcement point and fails safe on an unknown mode.
2. **db/models.py: extracted `_prefer_user_value(user_value, generated_value)`** for the
   override-precedence rule (`user if user is not None else (generated or "")`) that was
   duplicated verbatim across all six `effective_*` accessors (Video.effective_title/
   effective_summary, RecordingSession.effective_title/effective_summary,
   ClipCandidate.effective_description/effective_description_long). Six identical sites,
   pure, well-tested - a real duplicated-*knowledge* extraction (the `is not None` vs
   truthiness distinction is a domain rule that could drift if edited in only one place).
   The helper carries a WHY docstring documenting that `is not None` keying is deliberate
   (a blank "" user override still wins). Values byte-identical.

### Section 9 note (not actioned here): routes/config.py's inline ai_privacy enum is CORRECT as-is
The Phase-3 flag suggested `web/routes/config.py`'s inline `_enum_validator({"none",
"local_only"}, "ai_privacy_mode")` was a candidate to fix by importing the config.py
constant. That is now MOOT and should NOT be done: the constant is deleted, and the inline
form is the consistent, correct pattern - every one of the ~14 simple-enum config fields in
that validation table lists its allowed set inline (`whisper_device`, `llm_backend`,
`scorer_laugh_mode`, ...). Importing a constant only for `ai_privacy_mode` would make it the
lone inconsistent row. No Section 9 action needed on this line.

### Keep as-is: db/models.py's ~8 JSON encode/decode `@property`/`@setter` pairs - not collapsed to a descriptor factory
Decision: Keep the explicit per-column JSON accessor pairs (`reasons`/`tags`/`user_tags`/
`hotword_matches`/`hotword_boost`/`sensitive_matches` on ClipCandidate, `words` on
TranscriptSegment, `settings` on ClipExport).
Rationale: the *getters* look uniform, but the *setters* encode genuinely different
empty-value persistence contracts - `words.setter` writes SQL NULL when empty
(`json.dumps(value) if value else None`) while the others always write the empty container
(`"[]"`/`"{}"`), and the getters split three ways (`_decode_json_list` -> `[]`, inline
`... else []`, inline `... else {}`). A single `_json_property(attr, default, nullable)`
descriptor factory abstracting all of them would need enough parameters that it stops being
simpler than the explicit pairs, AND it would risk silently changing the `words_json`
NULL-vs-"[]" representation that callers depend on. This is duplicated *shape*, not
duplicated *knowledge* (each column's empty-persistence rule genuinely differs) - coupling
them would be the wrong abstraction. Do not re-flag as DRY without new evidence.

### Keep as-is: Speaker vs ProjectVoice `display_name`/`display_color` - not merged
Decision: Keep the two classes' `display_*` accessors separate.
Rationale: they encode different domain rules, not the same rule twice. `Speaker.display_name`/
`display_color` resolve through the linked Person (`global_voice`) FIRST (naming/recolouring
a Person flows to every member recording - the whole point of Person linking), then fall
back to the Speaker's own value; `ProjectVoice.display_*` is the simpler base case with no
Person-linking precedence. The one genuinely-shared fragment is the palette-cycling fallback
expression `self.color or SPEAKER_COLOR_PALETTE[(self.display_index - 1) % len(...)]`, which
appears in exactly two places (below the rule-of-three) and is a trivial one-liner. Each
accessor already documents "resolved in ONE place" for its own class. Not a finding.

### Keep as-is: cli/analyze.py's "force default diarization backend on" snippet - not extracted
Decision: Keep the `if config.diarization_backend == "null": config.diarization_backend =
"speechbrain"` flip inline in both `analyze` (per-run `--diarize` override) and `rediarize`
(command whose whole purpose is to diarize).
Rationale: exactly two occurrences (below the rule-of-three), each two lines, and each
carries its own explanatory comment framing why it forces the backend on in that specific
command's context. The `ingest.py` hit for the same string is a different check (skip
diarization when off), not this force-on flip. Extracting a `_force_default_diarization`
helper would name a rule that lives in only two adapter commands for no legibility gain.
Revisit if a third force-on site appears.

### Clean coming in - no change: config.py, model_catalog.py, contexts.py, content_presets.py, sessions.py, the CLI adapters, dev/
`config.py`'s `validate_*`/`_sanitize_*` functions are already a well-decomposed set of small
single-concern helpers. The `cli/` commands are proper thin Typer adapters (parse args ->
build config/opts -> delegate to `analyze_one`/`rediarize_video`/pipeline layer); the bulk of
each command's line count is unavoidable Typer `Option(...)` declarations, not misplaced
business logic. `dev/` (LOW spot-check) showed nothing glaringly wrong. No refactor warranted.

---

## Phase 1 test integrity - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Test-integrity pass over `db/models.py`, `config.py`, `model_catalog.py`, `contexts.py`,
`content_presets.py`, `sessions.py` (HIGH), the `cli/` adapters (MEDIUM), and all 20
`yuu_clip/dev/` tooling modules (LOW). Baseline was green (3436 passed) and stayed green -
no changes made; the suite in this scope is already clear, behavior-named, and free of the
usual failure modes (no tautologies, no swallowed assertions, no order dependence, no
hardcoded-then-stale dates - the `datetime(2026, 7, 4, ...)` literals in
`test_sessions.py`/`test_sessions_timeline.py` are fixed parse-function input/output pairs,
not now-relative clock assertions, so they don't rot).

### `TestProfiles`/`TestProfileFunctions` track-layout duplication - surfaced, not fixed
`tests/unit/test_config.py::TestProfiles` and
`tests/integration/test_profiles_contexts.py::TestProfileFunctions` both cover
`track_labels.py` save/load/delete round-trips end to end (same behaviors, near-identical
bodies, different monkeypatch mechanics: `_global_config_dir` vs `_profiles_path`
directly), and `TestProfileFunctions` needs neither `client` nor `project_dir` so it could
live in the unit tier. Left as-is, matching the precedent at the `TestSafeFilename`
duplication entry above (WS-A move-only decision) - a test-integrity pass fixes fragility
and clarity, not cross-tier dedup; flagged here for a future dedup pass rather than merged
or moved unprompted.

## Phase 6 docs and comments - full-app review section 5, clip generation + export/reel (2026-07-26)

Docs-and-comments phase over `segments/{windower,visual_windower,scene_segmenter,merge}.py`,
`export/{render,naming,presets,paths,window}.py`, and `reel.py`. Grepped every `#` comment
and docstring (~140 hits) before reading full files; no TODO/FIXME/XXX/HACK markers found.
Zero changes made - every comment earns its place per Phases 1/4/5's own read-throughs, which
already tightened this scope (Phase 4's refactor pass rewrote docstrings while extracting
helpers; Phase 5's logging pass added summary logs, not comments). Nothing added, nothing
deleted, nothing rewritten.

### Verified: reel.py's `_segment_start_times`/`_build_xfade_cmd` docstrings are accurate and current
The one comment this section flagged as load-bearing going in. `_segment_start_times`
(reel.py:562) states plainly: "This is the single source of that offset:
`_build_xfade_cmd` feeds these same values to ffmpeg as the xfade offsets, and the
burned-in caption timeline is shifted by them - computing the clamp in two places is
exactly what drifted the captions before." `_build_xfade_cmd`'s inline comment
(reel.py:309-311) points back the same way ("`_segment_start_times` is the single
source of this clamp so the burned-in caption timeline... can never drift from the
video"). Both match the actual code post-Phase-4 (the xfade builder calls the helper,
no duplicated formula remains) - no stale pre-refactor wording survived. No edit needed.

### Terminology check: `scene_segmenter.py`'s "LLM transcript-segmentation generator" is not a glossary violation
`GLOSSARY.md` bans "segmentation" only in **user-facing text** for the "Clip generation"
concept (`generate_candidates()`); this is an internal module docstring describing a
different feature entirely (LLM scene-boundary proposal, `kind='scene'` rows), and the
module's own filename already uses `segmenter` as a code identifier. Not a drift case -
left as-is.

### Confirmed clean, no findings: every other file in scope
`segments/windower.py`, `visual_windower.py`, `merge.py`; `export/naming.py`,
`presets.py`, `paths.py`, `window.py`; the rest of `render.py` and `reel.py`. Every
comment either explains a non-obvious WHY (algorithm choice, ffmpeg pitfall, a
drifted-behavior warning) or documents a real external constraint (libass PlayRes,
ffmpeg timebase mismatches, the concat demuxer's quote-escaping, Windows drive-letter
colons). No restatement-of-code, no reactive/apology comments, no obsolete text. The
top-of-file `# Feature-map - Export: ...` header comments on `paths.py`/`window.py` are
a real, widespread codebase convention (present in ~20+ modules across `web/routes/`
and elsewhere) - not an orphaned annotation style, so left untouched.

---

## Phase 5 logging - full-app review section 5, clip generation + export/reel (2026-07-26)

Logging-coverage phase over `segments/{windower,visual_windower,scene_segmenter,merge}.py`,
`export/{render,naming,presets,paths,window}.py`, and `reel.py`. Grep-first survey (every
`logger.`/`log.`/`print(` call plus every bare `except`) then full reads of the files with
zero or thin logging. Section 1's Phase 5 pass had already spot-checked `render.py` and
explicitly deferred a deeper look here ("will fall under whichever later review section
covers export/") - this phase is that follow-up. `yuu-dev test-api` 3436 passed after
(3427 baseline + 9 new), lint clean, 0 new mypy errors.

### Applied
- **render.py: `_finalize_export`'s `except (RuntimeError, ValueError)` now logs
  `exc_info=True`.** The `try` spans several distinct ffmpeg-touching calls
  (`export_clip`/`export_clip_with_preset`, `_apply_title_card`'s concat, plus
  `_record_clip_export`/`session.commit()`); the message alone couldn't tell a log
  reader which one raised. The traceback now does.
- **render.py: `run_retranscribe`'s per-track loop (ffmpeg segment extraction +
  `transcriber.transcribe`) now has a `try/except Exception: log.error(...,
  exc_info=True); raise` wrapper.** Previously a failure here (a corrupt extracted
  WAV, a `run_ffmpeg` failure, a transcriber crash) propagated as a bare unhandled
  exception with no `log.error` pairing at all - every other failure path in this
  file (and the codebase's established convention per Section 1's Phase 5 entry:
  "every stage that can fail already pairs a user-facing console.print with a
  log.exception/log.error/log.warning carrying context") already does this; this
  path was the one gap. Re-raises unchanged, so this is a pure logging addition,
  not a behavior change.
- **reel.py: `compile_demo`'s `try` now starts before `_resolve_clip_files`, not
  after.** The missing-export `FileNotFoundError` (by far the most common
  real-world reel-build failure - a clip in the pool was never exported) used to
  raise outside the function's own `except Exception: _log.error(...,
  exc_info=True)` block, so only the generic outer `subprocess_sse` layer (exit
  code + last output line) recorded it. Now every reel-build failure mode goes
  through the same structured, clip/output-context-carrying log path.
- **reel.py: swapped `logging.getLogger(__name__)` for the project's
  `yuu_clip.log.get_logger(__name__)`** - functionally identical (the module name
  already starts with `yuu_clip.`) but matches every sibling file in this section
  and the convention documented in `log.py`'s own module docstring.
- **naming.py: `export_base_stem`'s silent `except (KeyError, IndexError,
  ValueError): stem = _default_stem(...)` now logs a `warning`** with the template,
  clip id, and the caught exception before falling back. The fallback behavior
  itself is an intentional, documented contract (a stale/hand-edited template
  must not break an export) - Phase 4's refactor pass explicitly kept this
  function as-is for that reason - but the *silence* was the gap: a user whose
  custom filename template silently stopped applying (every export/lookup
  quietly reverting to the default stem) had no way to find out from the log.
  Since `validate_export_name_template` gates every template on save, this should
  only ever fire for a hand-edited config - not a hot path, not spam.
- **segments/visual_windower.py + segments/merge.py: added the same one-line INFO
  summary `generate_candidates`/`generate_scenes` already use** -
  `generate_visual_candidates` logs motion/scene-cut counts -> candidate count
  (plus an explicit "no motion/scene data" line on the early-empty return);
  `merge_candidates` logs visual-candidate count -> kept count, broken down by
  how many were deduped against transcript clips vs. capped. Both functions only
  run when `visual_candidate_mode` is `gaps`/`parallel` (opt-in, off by default),
  so this cannot spam a default install; it closes an inconsistency where every
  sibling candidate-generation function already summarized its output and these
  two didn't - a real "why did I get 0/too-few visual highlights" question these
  make answerable without a code reread.

### Confirmed and deliberately left as-is - do not re-flag
- **`export/render.py`'s and `reel.py`'s `console.print`/`print()` calls carry no
  parallel `log.info`/`log.debug` call, by design** - both files' own module
  docstrings say the prints ARE the SSE interface the web UI streams
  (`render.py`: "these functions print progress to the shared console - that
  stdout IS the interface the web UI streams over SSE, so the prints stay here
  rather than being lifted into the command layer"). `web/sse.py`'s
  `subprocess_sse` (out of this section's scope) already forwards every stdout
  line to the file log at `debug` and logs the full command + exit code at
  `error` on a non-zero exit, so nothing here is actually unlogged in production -
  it just isn't logged from inside these two files a second time. Do not propose
  converting these prints to `log.*` calls; that would fight a decision already
  written into the code.
- **`export/presets.py`, `export/paths.py`, `export/window.py` carry no logging -
  confirmed not a gap.** These are pure validation/lookup/arithmetic modules; every
  failure path raises a `ValueError`/`HTTPException` with a plain-English message
  straight to the caller (a route or the CLI), which is the correct place for it
  to surface - there is no "silent" failure here to make diagnosable, and adding
  logging would either duplicate the route's own error response or log an
  ordinary user-input-validation rejection at a level that would look like a
  production error. Matches this doc's own guidance elsewhere in this section
  against logging expected-validation failures at `error`.
- **`segments/windower.py` and `segments/scene_segmenter.py` already had adequate
  logging coming in** - both log a one-line INFO summary per call
  (candidates/scenes generated, with the relevant counts) and the LLM-boundary
  per-chunk failure in `scene_segmenter.py` is a `warning` with the chunk skipped,
  not spam (chunks are few per recording). Nothing added.
- **The `run_ffmpeg`/`find_ffmpeg` choke point (`ffmpeg_tools.py`) not logging the
  failing command's args is out of this section's scope, not fixed here.**
  `run_ffmpeg`'s `RuntimeError` carries the tool name and ffmpeg's stderr but not
  the argument list that was run - real for `render.py`'s and `reel.py`'s several
  distinct call sites (title card render, WAV segment extract, concat, xfade), but
  `ffmpeg_tools.py` itself belongs to no section's file list here. The in-scope
  mitigation applied this phase (exc_info=True / widened try blocks) makes the
  *traceback* identify which call site raised even without the args in the
  message; a args-in-the-RuntimeError fix, if wanted, is a `ffmpeg_tools.py`
  change for whichever section (if any) claims that file.

---

## Phase 4 refactor - full-app review section 5, clip generation + export/reel (2026-07-26)

Refactor-for-quality phase over `segments/{windower,visual_windower,scene_segmenter,
merge}.py`, `export/{render,naming,presets,paths,window}.py`, and `reel.py`. Structural
survey (function-length heat map + duplication-signature grep) then full reads of the two
highest-value files (`reel.py`, `render.py`) plus the flagged candidates. Three
behavior-preserving refactors applied; suite stayed at 3427 passed before and after, lint
clean, 0 new mypy errors.

### Applied - three refactors
1. **reel.py: made `_segment_start_times` the single source of the xfade-offset clamp.**
   `_build_xfade_cmd` previously recomputed `max(0, cumulative - (i+1)*trans_dur)` inline
   (its own `cumulative` accumulator), the exact formula `_segment_start_times` computes
   for the caption timeline - and Phase 2's just-fixed bug was these two drifting.
   `_build_xfade_cmd` now calls `_segment_start_times(durations, trans_dur)` and indexes
   `segment_starts[i+1]` per cut, so divergence is now structurally impossible, not merely
   tested against. Values are byte-identical; `test_matches_build_xfade_cmd_offsets` and
   the caption-timeline tests still pass. Docstrings on both functions updated to name the
   single-source relationship.
2. **paths.py: `all_sidecar_paths` now delegates SRT collection to `srt_sidecar_paths`.**
   Both functions inlined the identical glob-escape-stem + merged-`{stem}.srt`-existence
   logic (a real drift risk if sidecar naming ever changed). `all_sidecar_paths` is now
   `[*export_paths(...), *srt_sidecar_paths(...)]`. Same output; paths.py's full Phase-3
   coverage guards it.
3. **render.py: extracted `_export_settings_dict` out of the ~95-line `_finalize_export`.**
   The clip_exports-row settings JSON build (caption-style + preset-encode fields) was a
   pure ~22-line block inside the orchestrator; it is now a pure, directly-testable helper,
   shrinking `_finalize_export` and giving the settings-shape logic a unit seam it lacked
   (the Phase-3 deferred-coverage gap on this function). Pure move, no behavior change.

### Keep as-is: `windower.py::_silence_window` (~83 lines) - not decomposed
Decision: Keep the segment-grouping state machine as one function.
Rationale: it is a single cohesive concern (group merged transcript segments into windows
by silence gaps / hard splits) built around a `_flush` closure that mutates the window
accumulators (`win_start/win_end/win_segs/win_tags/dropped_low_speech`) via `nonlocal`.
The line count is high but the alternative - threading that mutable window state through
extracted helpers - would scatter one algorithm across several functions and args for no
legibility gain. The one subtle invariant (each start computed from the true running
total) lives with the code that needs it. Below the decompose-for-clarity bar despite the
length. Do not re-flag on line count alone.

### Keep as-is: `render.py::_finalize_export`'s cut-dispatch branch - kept inline
Decision: Keep the `preset is not None` -> `export_clip_with_preset` vs `export_clip`
branch (render.py, inside `_finalize_export`'s `try`) inline rather than extracting a
`_run_cut(...)` helper.
Rationale: after the `_export_settings_dict` extraction the function is materially shorter,
and the cut branch's ~10 collaborators (video_path, start/end_ms, clip_dest, preset,
subtitle paths, audio index, caption_style, crop_x, precise/title_card) are all live local
state; extracting it would relocate a wall of kwargs without reducing coupling or improving
legibility. The two encode paths already have their own direct behavior tests
(`test_export_presets.py`'s real encode; `TestRenderExport`'s wiring assertions per the
Phase-1 keep entry below). Not worth a diff; revisit only if a third cut path appears.

### Clean coming in - no change: naming.py, presets.py, merge.py, scene_segmenter.py, visual_windower.py, export/window.py
Read for the 30-line / duplication / one-concern standards; all already conform.
`naming.py::export_base_stem` is long but is a flat placeholder-by-placeholder render with
a documented fallback contract (one concern). `merge.py::_covered_fraction`'s interval-union
sweep and `scene_segmenter`/`visual_windower`'s grouping helpers are each single-concern and
under the size bar. No refactor warranted.

---

## Phase 1 test integrity - full-app review section 5, clip generation + export/reel (2026-07-26)

Test-integrity phase over `segments/{windower,visual_windower,scene_segmenter,merge}.py`
and `export/{render,naming,presets,paths,window}.py` + `reel.py`, and their tests
(`tests/unit/test_{windower,visual_windower,merge,scene_segmenter,segments,export,
export_presets,export_naming,export_sidecar_glob,reel,title_card}.py`,
`tests/integration/test_{segments,clip_create,export_presets}.py`). Baseline was
green (3388 passed) before and after. One real gap found and fixed; one item
resolved (not deferred a second time); everything else was clean coming in.

### Fixed: `tests/unit/test_title_card.py`'s real-ffmpeg tests ran unconditionally in the unit tier
6 tests (`test_title_card_simple` and siblings) plus `test_fontfile_single_quoted_escaped_colon`
called `_make_title_card`/a raw `subprocess.run` against real ffmpeg with no
`skipif(shutil.which("ffmpeg") is None, ...)` guard, unlike the established
`requires_ffmpeg` pattern this codebase already uses for exactly this case
(`tests/integration/test_export_presets.py::TestPresetEncodeIntegration`). Per
CLAUDE.md's tier rule ("tests/unit must pass offline regardless of machine
state... a test that needs real OS state belongs in tests/integration"), these
would fail with a confusing subprocess error (not a clean skip) on any machine
without ffmpeg on PATH. Split the file the same way `test_export_presets.py`
already is: the real-encode tests moved to a new `tests/integration/test_title_card.py`
with the `requires_ffmpeg` guard; `tests/unit/test_title_card.py` keeps only the
pure (`_esc`, `title_card_lines`) and mocked-ffmpeg (`TestMakeTitleCardCommandConstruction`,
`TestApplyTitleCardThreadsConfig`, `TestBuildSegmentListThreadsConfig`) tests. Same
27 tests total, same assertions - a pure re-tiering, not a rewrite. Verified with
`yuu-dev lint` (clean) and running both split files directly (27 passed).

### Resolved (not deferred again): `TestRenderExport`'s call-count-only mocking is the right shape
Section 1 flagged this as a human-decision item pending render.py coming into
scope. Read `render_export` (export/render.py:53-107) directly: it is a pure
7-collaborator orchestrator (retranscribe gate -> path resolve -> caption-style
resolve -> subtitle staging -> finalize/cut -> sidecar emission) whose own
docstring says the CLI "shrinks to arg-parsing plus one call here, so the sequence
has a seam callers and tests can reach without CliRunner+ffmpeg" - i.e. its entire
job IS the wiring, not the ffmpeg work. Decision: keep `TestRenderExport`'s
call-count assertions as-is; this is the correct granularity for an orchestrator,
not over-mocking of a too-coupled unit. Rationale, each checked directly:
1. Every mocked collaborator has its own direct behavior test in the same file or
   nearby: `_write_export_subs` -> `TestWriteExportSubs`, `_resolve_caption_style`
   -> `TestResolveCaptionStyleWordHighlight`, `_build_export_path`'s naming ->
   `TestExportBaseStemPreset`, `run_retranscribe`'s diarization sub-call ->
   `test_diarization.py::TestRetranscribeDiarization` (already reviewed under
   Section 2, since `_maybe_diarize_segment` is a diarization orchestration call
   site per that file's own docstring).
2. The real end-to-end path (real ffmpeg, no mocks) IS exercised: `render_export`
   itself is called for real in `tests/system/conftest.py` (the system tier's
   fixture), and `export_clip_with_preset`'s real encode is covered by
   `tests/integration/test_export_presets.py::TestPresetEncodeIntegration`.
No test change made. Do not re-flag `TestRenderExport`'s mocking as a gap without
new information (e.g. a bug this level of test would have caught but didn't).

### `TestVerifyExportDuration`'s tolerance-boundary coverage gap is out of this section's scope
Confirmed by reading the import: `TestVerifyExportDuration` (`tests/unit/test_export.py:440`)
tests `yuu_clip.analyze.extract._verify_export_duration`, not anything in
`export/render.py` or `export/window.py` - that function lives in `analyze/extract.py`,
Section 1/2's module, not Section 5's. The coverage gap Section 1 flagged (no test
pinning `_DURATION_TOLERANCE_FLOOR_S`/`_DURATION_TOLERANCE_FRACTION`'s exact boundary)
stands as a Phase 3 (coverage-review) item for whichever section owns `extract.py`,
not this one - left untouched here.

### Scope-boundary check: which `tests/unit/test_export.py` classes are this section's vs. Section 1/2's vs. Section 8/9's
`test_export.py` (1013 lines) is genuinely shared three ways by import target, not
just by filename - verified every class's own `from yuu_clip...import` line rather
than guessing from names. In scope here (export/render.py, export/window.py,
export/naming.py, reel.py): `TestWriteExportSubs`, `TestRenderExport`,
`TestResolveCaptionStyleWordHighlight`, `TestComputeExportWindow`,
`TestEmptyTrimWindow`, `TestReelEsc`, `TestBuildXfadeCmd`, `TestResolveClipFiles`,
`TestRefreshCaptionSidecars`, `TestExportBaseStemPreset`. Out of scope (import
`yuu_clip.analyze.extract` - Section 1/2's `_build_clip_cmd`/`_subtitles_filter`/
`_preset_video_filter`/`_verify_export_duration`/`_ffmpeg_path`/`export_clip`, or
`yuu_clip.web.*` - Section 8/9's route/media/file-deletion layer):
`TestBuildClipCmdOrdering`, `TestSubtitlesFilter`, `TestCaptionStyleInExportCmd`,
`TestVerticalCropFilter`, `TestVerifyExportDuration`, `TestFfmpegPath`,
`TestExportClipPublicApiCommand`, `TestShareDeleteMediaServing`, `TestUnlinkWithRetry`,
`TestLockedFilesError`, `TestRunExportSubprocessCleanup`. Recorded so a future pass
over this file doesn't need to re-derive the split from scratch.

---

## Phase 6 docs and comments - full-app review section 4, scoring - LLM backend (2026-07-26)

Docs-and-comments phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`.
Grepped every `#` comment and docstring across the four files (~120 hits) before reading;
the scope came in exemplary per Phases 1/4/5, and this pass agrees - one small accuracy
fix, nothing to delete. Verified the three CLAUDE.md-flagged load-bearing comments below.

### The `build_basic_description` docstring understated its own contract - fixed
Was: "Returns `("", "")` when the excerpt has no usable content and the clip isn't a
textless visual candidate." That describes only the first early-return
(`describe_basic.py`, the `if not excerpt` branch). A second path falls through to the
same `return "", ""` at the end of the function when the excerpt IS non-empty but yields
no speaker names, no keywords, and no dimension clearing `_DIMENSION_FLOOR` - a real,
reachable case (e.g. a short exchange between only anonymous "Speaker N" lines with
sub-threshold scores). Reworded to cover both paths. Pure docstring accuracy fix, no
behavior touched.

### The three CLAUDE.md-flagged load-bearing comments - verified accurate, left untouched
1. `llm_client.py`'s "Never surface the absolute path here" comment (on
   `LlamaCppServerClient.available()`'s missing-model-file branch) - re-read against the
   sibling `resolve_server_binary` branch three lines below it (which Phase 5 flagged as
   NOT following the same path-redaction discipline, `str(exc)` verbatim). The comment
   only describes the branch it sits on and makes no claim about the sibling - it is
   still fully accurate as written. Per this phase's brief, left as-is rather than
   strengthened to call out the gap: the gap itself is the open human-decision item from
   Phase 5 (see that entry), and editing this comment to reference it would be
   documenting a known bug into permanence rather than fixing it. Do not touch this
   comment again until that finding is resolved one way or the other.
2. `llamacpp_server.py:423-424`'s gpu-layers auto-fit comment ("gpu_layers == -1 means
   auto-fit: omit the flag... forcing all layers can OOM a small card") - re-checked
   against the guard it documents (`if gpu_layers >= 0: args += ["--n-gpu-layers", ...]`)
   - still exactly matches the code. Untouched.
3. Local-only/no-remote-backend architecture comments (`llm.py` module docstring: "All
   inference is on-device - nothing the user records leaves their machine";
   `llm_client.py` module docstring: "All inference runs locally - yuu-clip never sends
   transcript data to any external service") - both still accurate; the `_BACKEND_CLIENTS`
   registry has exactly one entry (`llamacpp`). Untouched.

### `find_related_clips`'s docstring is NOT this phase's concern - deliberately left imprecise
Noticed but did not touch: the docstring says only "Raises on LLM failure," while the
function also raises (`KeyError`/`ValueError`) on a malformed candidate item (missing or
non-integer `"id"`), unlike `request_scene_boundaries`'s sibling skip-bad-items loop.
Sharpening the docstring to spell out that asymmetry was considered, but this is exactly
the raise-vs-skip parse-robustness gap Phase 4 pinned as an open human-decision item
(see that entry) - the brief for this section explicitly excludes it from every phase's
scope, docs included, until the owner decides which behavior is correct. Do not fix the
docstring as a shortcut around fixing (or explicitly keeping) the behavior.

### `completion_text`'s one-line docstring is a literal restatement - kept anyway
`llamacpp_server.py`'s `completion_text` docstring ("Pull the assistant message text out
of a chat-completions response body.") says nothing the function name and its one-line
body (`data["choices"][0]["message"]["content"]`) don't already say - a textbook Delete
candidate under the governing rule. Left in place: it is a small, harmless outlier in a
file where every other public (non-`_`-prefixed) function carries a docstring, and
churning it for zero information gain is not worth a diff in a section this clean. Do
not re-flag; a future pass may delete it in passing if editing this function anyway, but
it does not warrant its own change.

### Terminology sweep - clean
Checked every UI-facing string this scope returns (`"Settings -> LLM scoring"` x8,
`"Settings -> AI privacy"` x1 in `_GENERATIVE_OFF_REASON`) against `GLOSSARY.md` and the
live `index.html`/`routes/llm.py` strings. "LLM scoring" matches the glossary term
exactly. The lone `"Settings -> AI privacy"` (no "LLM scoring" prefix, no "mode" suffix)
looked like a one-off drift at first read, but it exactly matches the literal
`<label class="settings-label">AI privacy</label>` UI text (the AI-privacy radio group
lives inside the LLM-scoring settings section, but is rendered as its own labeled
control) and is used identically in `routes/llm.py:169` (out of scope, but confirms this
is a deliberate app-wide phrase, not scope-local drift). Not a finding.

---

## Phase 5 logging - full-app review section 4, scoring - LLM backend (2026-07-26)

Logging-coverage phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`.
Fixed a real gap (privacy-off vs genuine backend failure were indistinguishable in the
log - see git history for `LLMScorer._mark_off_once` and the `_wait_healthy`/`_stop`
exit-code, timeout-duration, and evicted-model additions in `llamacpp_server.py`). The
items below are the deliberate-silence calls to anchor for a future pass.

### `describe_basic.py` has zero logging - deliberate, not a gap
Decision: keep this module log-free.
Rationale: it is pure in-memory template assembly over data already on the `ClipCandidate`
row (regex/dict lookups, no I/O, no external call, no exception path that isn't a
programmer error). There is no failure mode a log line would make diagnosable that a
stack trace from an uncaught `AttributeError` wouldn't already show. Do not re-flag
"no logging" here as a gap.

### `check_llm_available` / `check_vision_available` stay silent by design
Decision: keep these two read-only pre-check functions (llm.py) logging nothing, per
`check_llm_available`'s own docstring ("Return (available, reason) without logging").
Rationale: they are called from routes (out of scope for this section) on cheap,
frequent read paths (status polls, capability checks) purely to gate UI state - logging
every call would be exactly the "info-level logs inside a poll loop" spam pattern this
phase's own checklist warns against. The one-time-per-run WARNING (backend failure) /
INFO (privacy/disabled) logging lives one layer down, in `LLMScorer.is_available()` and
`LlamaCppServerClient.available()`'s callers, which run once per analyze/rescore rather
than once per poll. Do not add logging to the two check_* functions themselves.

### The GPU health-poll loop (`_wait_healthy`) is deliberately silent per-tick
Decision: keep `_wait_healthy`'s `while` loop (llamacpp_server.py) logging nothing per
poll iteration (every `_HEALTH_POLL_S` = 0.5s, for up to `_HEALTH_TIMEOUT_S` = 240s).
Rationale: a per-tick log would be up to ~480 lines of pure noise for one model load;
the loop already logs once on entry ("Starting llama-server: ...") and once on exit
(success -> "ready (model loaded in %.1fs)"; failure -> the exit-code/timeout-duration
error this phase added). That is the right altitude - do not add a per-poll log line.

### Needs a human decision (not fixed this phase): `LlamaCppServerClient.available()`'s
### binary-resolution failure reasons still leak the configured path into UI text
Finding (not applied): `available()` catches `LlamaServerError` from
`resolve_server_binary`/`_binary_in_bundle` and returns `str(exc)` verbatim as the UI-facing
`reason` (llm_client.py `available()`, around the `resolve_server_binary` call). Those two
exception messages interpolate the full configured/bundle path
(`config.llamacpp_server_binary` or the `YUU_CLIP_LLAMA_SERVER_DIR` base), unlike the
sibling branch three lines above it (missing model file) which deliberately keeps the path
out of the UI-facing reason with an explicit "never surface the absolute path" comment. The
log FILE itself is not at risk (the `_SanitizingFormatter` redacts the `\Users\<name>\`
segment before any sink), but the same string is also returned straight through to routes
(out of scope for this section) that render it in the UI, unredacted. Left as a flagged
finding rather than fixed: the right fix (generic UI reason vs. keep the specific path for
diagnosability) is a UX/privacy trade-off call, not a mechanical logging fix, and touches
route-owned rendering this section's brief excludes. Promote-to-fix trigger: either genuinely
fix, at whichever point routes/`llm_client.py` next get reviewed together.

---

## Phase 4 refactor - full-app review section 4, scoring - LLM backend (2026-07-26)

Refactor-for-quality phase over `scoring/{llm,llm_client,llamacpp_server,
describe_basic}.py` - the highest-scrutiny hard AI-backend seam (`LLMClient` ABC +
`make_client` factory, keyed on `llm_backend`). Structural survey (function-length
heat map, repeated-literal grep, a targeted concrete-backend-import grep) then full
reads of all four files. **No code changes were warranted** - this scope is genuinely
clean coming in (Phase 1 called it "exemplary, no bugs found"; Phase 2 traced the
privacy trust boundary intact with 3 defense-in-depth layers; Phase 3 added 12 tests).
Recorded per the close-out convention:

### Seam integrity re-verified at the highest scrutiny level - no violation
Decision: the `LLMClient` seam needs no structural change.
Rationale: grepped `LlamaCppServerClient|NullLLMClient|LlamaServerPool(` in `llm.py`
- zero hits; every client construction in `llm.py` (`_call_client`, `describe_frames`,
`check_llm_available`, `LLMScorer.__init__`) goes through `make_client(config)`. No
caller-side `if backend == ...` dispatch exists anywhere in scope - `_client_class_for`
+ `make_client` own the `_BACKEND_CLIENTS` lookup and the unknown-backend warn+fallback,
and `make_client` is the single AI-privacy enforcement point. `available() -> (ok,
reason)` is called through the interface (`make_client(config).available()` at
`llm.py:682`, `self._client.available()` at `:741`), never duck-typed. This section
does NOT reproduce the Section-2 DiarizationClient finding; the seam is exemplary.

### The three read-side generative-AI pre-checks are deliberate defense-in-depth - NOT DRYed
Decision: keep the `llm_enabled` + `allow_llm` gate duplicated across
`check_llm_available` (llm.py:617-620), `check_vision_available` (:677-680, via the
shared preamble), and `LLMScorer.is_available` (:735-737), each re-checking before it
delegates to the seam's `available()`.
Rationale: this is a privacy trust boundary (`resolve_ai_permissions`). The real
enforcement point is `make_client` (returns `NullLLMClient` when generative AI is off);
these three are independent read-side pre-checks that gate the UI/routes before a call,
and each re-asserting the gate is the intentional layering Phase 2 verified as "3
independent defense-in-depth layers". Extracting them into one shared helper would
collapse independent checks on a trust boundary into a single point of failure - a case
where the duplication is correct (duplicated *check*, not duplicated *knowledge* that
can drift). Also explicitly out of bounds for a routine refactor per this section's
brief ("do NOT touch the privacy-gate logic itself... flag as needs-human-decision").
Do not re-flag as DRY.

### The vision-availability pre-check inlines llamacpp path checks - kept, single-backend
Decision: keep `check_vision_available` (llm.py:611-637) probing
`llm_vision_model_path`/`llm_mmproj_path` existence inline (with its honest "Local
llamacpp backend (the only backend)" comment) rather than delegating to a new
`vision_available()` seam method, even though the sibling `check_llm_available`
delegates its final probe to `make_client(config).available()`.
Rationale: there is exactly one backend, and the vision-availability knowledge already
lives behind the seam as the hard backstop (`LlamaCppServerClient.chat_vision` raises
`VisionNotSupportedError` with the same model/mmproj checks; the "cheap pre-check + hard
backstop" split is documented on `VisionNotSupportedError`). Adding a
`vision_available() -> (bool, reason)` method to the `LLMClient` ABC + both
implementations to remove the asymmetry would be an interface change to a hard seam
serving one backend - speculative generality today ("an interface with one
implementation is usually noise"), and a seam change the brief says to defer rather than
guess on. Promote-to-seam trigger: a second LLM backend whose vision-availability
semantics differ from llamacpp's two-file (model + mmproj) check. Until then, the
inline single-backend pre-check is the right altitude. Do not re-flag as a seam leak.

### `_DEFAULT_MAX_TOKENS = 1024` duplicated across llm_client.py and llamacpp_server.py - kept
Decision: keep the completion-cap default defined in both `llm_client.py:21` (the ABC
signature default) and `llamacpp_server.py:44` (the pool `chat_completion` default),
each carrying a "matches the other" cross-reference comment.
Rationale: both are live defaults on different layers (the client interface vs the
server pool), and unifying them would force either a module-level
`llm_client -> llamacpp_server` import (defeating llm_client's deliberate lazy import of
the pool machinery) or the reverse coupling, to share a single int. The documented
cross-reference is the lighter-weight choice; the value is a tunable both layers
self-document, not a business rule that silently drifts. Below the rule-of-three (two
occurrences). Do not re-flag as a magic-constant duplication without a third occurrence
or a concrete drift bug.

### The two known parse-robustness gaps remain human-decision items - not touched here
Decision: `find_related_clips` (llm.py:441) raising on a malformed item (vs
`request_scene_boundaries`'s skip-bad-items loop), and `summarize_transcript`/
`describe_clip` lacking an `isinstance(dict)` guard on parsed JSON, are left as-is this
phase.
Rationale: these are behavior-contract questions (fail-loud vs skip-and-continue on a
partially-bad model reply) flagged and pinned by Phase 3 tests as deliberate
human-decision items on a correctness-adjacent module, not pure quality cleanups. A
refactor pass must not silently change which inputs raise vs degrade. Applying
`request_scene_boundaries`'s skip pattern to `find_related_clips` is defensible but
changes the failure contract, so it stays a human call. Left for the owner to decide;
do not "fix" under a refactor lens.

---

## Phase 1 test integrity - full-app review section 4, scoring - LLM backend (2026-07-26)

Test-integrity phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`
and their tests (`tests/unit/test_{scoring_llm,llamacpp_server,privacy_modes,
preflight_llm,describe_basic}.py`, `tests/integration/test_{llm,vision}.py`, plus the
LLM-touching classes `TestScanHotwordsSemantic` in `test_hotwords.py` and
`TestSceneScorerPromptSelection`/`TestSceneScorerSparseTranscript`/
`TestSceneScorerJsonRobustness` in `test_scene_scoring.py`). Baseline was green
(3370 passed) before and after - **no code or test changes were warranted**.

Structural survey (grepped every class/function name across ~4867 lines of test code)
then full reads of the two highest-risk files per the phase brief - `llm_client.py`
(the privacy-mode enforcement choke-point) and `llamacpp_server.py` (the process pool,
site of the documented `--n-gpu-layers` OOM landmine) - plus every test file in scope.

### Privacy-mode enforcement tests are exemplary - the spy pattern is the right shape
`test_privacy_modes.py::TestMakeClientEnforcement::test_none_never_constructs_any_client`
patches `LlamaCppServerClient.__init__` with a spy that records construction, then
asserts the spy list is empty under `ai_privacy_mode="none"` - this proves the untrusted
path never even *instantiates* the real client, not just that some Null-typed object came
back. This is the correct test shape for a trust boundary (construction-time proof, not a
type-check that a mock could satisfy accidentally) and should be the template for any
future privacy-gate test in this codebase.

### The gpu-layers OOM landmine is directly and correctly pinned, not encoded as "correct"
`test_llamacpp_server.py::TestBuildArgs::test_autofit_omits_gpu_layers_flag` asserts
`gpu_layers=-1` (autofit) omits `--n-gpu-layers` entirely (with an inline comment naming
"The critical spike lesson"); `test_cpu_passes_zero_layers_and_no_device` pins `0` for
CPU; `test_forced_layer_count_is_passed` uses an arbitrary `20`, never `99`. Cross-checked
`llamacpp_server.py:313-320` directly (not just via the tests) - no hardcoded `99` or
forced-max-layers path exists in the source either. Nothing to fix; recorded so a future
pass doesn't need to re-derive this from scratch.

### Concurrency tests use real threads + `Event.wait(timeout)`, not sleep-based polling - correct pattern
`TestPool::test_shutdown_not_blocked_during_health_wait` and
`test_inflight_request_not_killed_by_concurrent_new_key` spin real `threading.Thread`s
against a monkeypatched blocking call and synchronize via `threading.Event` with a
generous (2-3s) timeout, never a bare `sleep()` race. This is the durable-synchronization
pattern the test-integrity checklist asks for, already in place - not a finding.

### No vestigial remote/hosted-backend references anywhere in scope
Grepped `anthropic|Claude|remote_ai|remote_ok` (case-insensitive) across
`llm.py`/`llm_client.py`/`test_scoring_llm.py`/`test_privacy_modes.py`: zero hits. The
Claude/Anthropic backend removal (2026-07-15) left no dead code or stale test fixture in
this section for a future pass to trip over.

### Minor stylistic nit, not fixed (below the bar for a code change)
`test_scoring_llm.py::TestCallLlmJson::test_max_tokens_threaded_to_client` asserts
`call.call_args.args[3] == 2048` (positional-index into `_call_client`'s 4th arg) rather
than a kwarg-based assertion. It tests real behavior (max_tokens actually reaches the
client call), not a tautology, so it was left as-is - flagged here only so a future pass
doesn't need to re-derive that it was considered and intentionally left alone.

---

## Phase 6 docs and comments - full-app review section 3, scoring (2026-07-26)

Docs-and-comments phase over the same 17 files as the Phase 4 refactor entry below
(`scoring/{energy,prosody,speechrate,churn,lexicon,textmatch,laugh,audio_event,
scenes,visual,wav_access,protocol,scorer_set,engine,dedup,similarity,term_scope}.py`).
Grepped every `#` comment and `"""`/`'''` docstring in scope (0.5 survey), then read
all ~2870 lines in full. **No code changes were warranted** - zero restatement,
obsolete, reactive, or apology comments found anywhere in scope, and no aging
TODO/FIXME/HACK markers. This matches Phase 1's "unusually clean" characterization
and Phase 4's finding that prior refactor passes (WS-A..D) already reshaped this
section; the comment density is uniformly high-value (WHY-explanations of scoring
math constants/thresholds, narrow-except reliability-pattern warnings from Phases
2-3, availability-probe contracts) with nothing to prune.

Specifically verified per this phase's brief:

### `engine.py::_run_scorers`'s laugh special case - comment present and clear
Confirmed the `scorer.name == "laugh"` branch (lines 329-334) already carries the
WHY comment the Phase 4 refactor entry's keep-decision promised ("Store the laugh
scorer's raw, unweighted result as its own attribute so laugh density can be
sorted/displayed apart from its weighted contribution to score_funny..."). No
addition needed.

### Formula/threshold comments distinguish WHY from WHAT throughout
Spot-checked every numeric constant with an adjacent comment for the WHAT-restatement
pattern the brief called out (weighted averages, thresholds, windowing) - all of them
state a rationale, not a restatement: `prosody.py`'s CoV saturation points (why
intensity is weighted above pitch), `speechrate.py`'s CALM/FAST WPS bounds (why
those specific values - "relaxed English speech sits ~2 wps, animated bursts hit
4-6"), `churn.py`'s switches-per-minute saturation, `energy.py`'s downsample-factor
table (why "fast" is only marginally quicker - IO-bound at SSD speeds), `visual.py`'s
`_MAX_INTENSITY` (why peak+mean are blended so one spike can't max the score),
`textmatch.py`'s name-correction cutoff design (already anchored below - kept
inline). None read as a restatement candidate.

### Terminology sweep - clean
Grepped `\bAI\b|RP context|clip candidate|demo reel|subtitle|Probe|profile` (the
recurring code-name-in-user-facing-text drift pattern) across all 17 files: zero
hits. `Visual` appears only in dev-facing comments/identifiers (`Visual axis`,
`VisualActivityScorer`, `VisualActivity` table) consistent with the glossary term -
none of this section's log/comment text is user-facing (no `console.print`; this is
all `log.*`/docstring text reaching only `.yuu-clip/yuu-clip.log`). Spot-checked
`laugh.py`/`audio_event.py`'s module-docstring specifics (model id, ~350 MB size)
against `config.py`'s `scorer_laugh_model_id` default and comment - still accurate.

---

## Phase 4 refactor - full-app review section 3, scoring (2026-07-26)

Refactor-for-quality phase over the signal scorers + aggregation
(`scoring/{energy,prosody,speechrate,churn,lexicon,textmatch,laugh,audio_event,
scenes,visual,wav_access,protocol,scorer_set,engine,dedup,similarity,term_scope}.py`).
Structural survey (function-length heat map + the targeted narrow-except sweep) then
targeted reads of the assembly/aggregation core and the longest real-logic functions.
**No code changes were warranted** - this scope is genuinely clean coming in (Phase 1
called it "unusually clean"; Phases 2-3 fixed the real reliability bugs; prior refactor
passes WS-A..D already reshaped it). Recorded per the close-out convention:

### `scorer_set.py` - single-registration assembly, no per-scorer branches - kept
Decision: Keep as-is.
Rationale: Adding a scorer is one line in `build_clip_scorers`'s returned list; the
four `build_*` variants share that single source and carry no `if scorer == ...`
dispatch. This already matches the "adding a backend = a registration, not a rewrite"
convention. Nothing to decompose (each builder is well under 30 lines, one concern).

### `engine.py::_run_scorers`'s `scorer.name == "laugh"` special case - kept, not generalized
Decision: Keep the single name-keyed branch that stores the laugh scorer's raw,
unweighted density on `clip.score_laugh` separately from its weighted `score_funny`
contribution.
Rationale: laugh is the only scorer whose raw result must be persisted apart from its
weighted aggregation (for sort/display). A generic mechanism - e.g. a `raw_scores`
dict on `ScoreResult` the engine writes polymorphically - would be speculative
generality serving exactly one consumer (YAGNI). The branch is localized, documented
with a WHY comment, and keys on the Protocol's `name` attribute (not `isinstance`), so
it stays backend-agnostic. Revisit only if a second scorer needs a raw side-channel.

### `engine.py::_compute_overall` - already dynamic-weight and well-decomposed - kept
Decision: Keep as-is.
Rationale: Divides by the live dimension-weight sum (not a hardcoded divisor), returns
`None` when all weights are zero (callers guard it), and is a single 15-line concern.
The larger `ScoringEngine` methods (`score_clip`, `_run_scorers`, `_write_dimension_scores`,
`_apply_basic_description`) are each single-concern and under the size bar. No change.

### The two-method scorer availability surface (`is_available()` bool + `available()` tuple) - kept
Decision: Keep both methods where present, and keep energy/scenes/visual with only
`is_available()`.
Rationale: `is_available()` is the `Scorer` Protocol method the engine uses; where a
scorer also exposes `available() -> (bool, reason)` (prosody, speechrate, churn,
lexicon, laugh, audio_event), `is_available()` delegates to `available()[0]` - no
duplicated probe logic. The tuple form exists exactly where a consumer needs the
user-facing reason (`ingest.py`'s laugh/audio-event notices, `routes/llm.py`'s status
surfaces); energy/scenes/visual omit it because nothing reads their reason, so adding
it would be speculative generality. This is an appropriate asymmetry, not drift.

### `similarity.py` backend seam - factory owns all dispatch - kept
Decision: Keep as-is.
Rationale: The three backends (`TfidfBackend`, `EmbeddingsBackend`, `LlmBackend`) each
implement the same interface (`available() -> (bool, reason)`, `rank_similar`,
`match_concepts`); `_construct`/`make_backend` own every `if backend == ...` branch and
the tfidf-fallback + first-use model-load policy; no caller branches on the backend
name. The `isinstance(backend, EmbeddingsBackend)` check inside `make_backend` is the
seam's single cross-cutting-policy point (the fetch-verify-or-fall-back gate), which the
convention explicitly places at the factory - not a caller-side leak.

### `textmatch.py::find_fuzzy_matches`'s inner sliding-window scan - kept inline
Decision: Keep the per-term `while` window-scan inline rather than extracting a
`_scan_windows(...)` helper.
Rationale: The function is ~43 lines but a single cohesive concern (fuzzy-match each
term across the text), and its one subtle invariant - a hit consumes its whole window
so overlapping windows can't double-count - is already documented in the docstring at
the exact spot it matters. Extracting the loop would split that invariant from its
explanation for no legibility gain. Below the rule-of-three (one call site).

### Narrow-except reliability sweep across the rest of the scope - clean
Grepped `except (ImportError|ModuleNotFoundError)` across churn/speechrate/lexicon/
textmatch/visual/dedup/term_scope/protocol/engine/scorer_set.py (the files Phases 2-3
did not primarily target) for the availability-probe crash pattern those phases fixed
7 times. Zero instances - none of these modules import a compiled/optional dependency
inside an `available()`-style probe. `scenes.py::_detect_content`'s narrow
`except ImportError` remains (its sole caller already wraps the compute in a broad
except, per the Phase-3 note), so it is not a live crash risk; left as-is.

---

## Phase 6 docs and comments - full-app review section 2, transcription & diarization (2026-07-26)

Docs-and-comments phase over `yuu_clip/transcribe/{whisper_runner,diarization_client,
transcriber,align,project_voice,speaker_attach}.py` and `yuu_clip/subtitles.py`.
Grepped every `#` comment and docstring in scope, then read each file in full
(~2285 lines). Comment density here was already excellent going in - Phases 1-4
exercised this code hard and it shows in the comments too. No restatement,
obsolete, or apology comments found anywhere in scope; nothing was deleted.

Applied - 3 additions, all comment-only (verified with `yuu-dev test-api`, 3341
passed, and `yuu-dev lint` clean):

- `diarization_client.py::diarize_with_embeddings` - added a 3-line comment
  immediately above the `_consolidate_labels(...)` call clarifying it deliberately
  takes `speaker_match_threshold` (a SIMILARITY), not the `cluster_threshold`
  (a DISTANCE) used one line above for `_cluster_labels(...)`. The distinction was
  already well documented at each definition (config.py's DISTANCE/SIMILARITY
  callouts on `speaker_cluster_threshold`/`speaker_match_threshold`,
  `_consolidate_labels`' own docstring) but not at this call site, where a reader
  scanning just the function body could otherwise read the threshold swap as a
  copy-paste bug.
- `project_voice.py::_best_exemplar_score` - added a comment above the
  `backend is not None and ...` guard explaining the None-backend legacy-data
  tolerance (deliberately skips the cross-backend filter when the caller doesn't
  know the query vector's own backend). Previously this behavior was explained
  only in `tests/unit/test_project_voice.py::test_none_backend_compares_across_all_backends`'s
  comment, not in the source.
  - Same fix, same reasoning, in `speaker_attach.py::_best_voiceprint_match`'s
    equivalent `active_backend is not None and ...` guard (previously explained
    only in `tests/unit/test_diarization.py::test_none_active_backend_compares_across_backend_mismatch`).

Verified and deliberately left as-is - do not re-flag:

### ARCH-3 (align.py's seam-convention exception) - module docstring still reads clearly
Re-read `align.py`'s module docstring (lines 15-26) against the ARCH-3 decision
recorded in this file's Fable-review WS-5 entry (below). Still accurate: no
`alignment_backend` config value, one implementation, the single caller
(`web/routes/common.py`) never gates on availability. No edit needed.

### Multi-line docstrings on internal (`_`-prefixed) functions across this section - kept, not pared to one-liners
Same call as the Phase 6 section-1 entry above (`ingest.py`'s private helpers):
`diarization_client.py`'s clustering helpers (`_consolidate_labels`,
`_prune_small_clusters`, `_densify_labels`, etc.), `project_voice.py`'s matching
functions, and `subtitles.py`'s rendering helpers (`_highlight_shade`,
`strip_baked_speaker_prefix`, etc.) all carry docstrings substantially longer than
a name-restating one-liner, despite CLAUDE.md's "No docstrings on internal
functions" guidance. Every one earns its place under the governing rule: they
document non-obvious algorithm invariants (`_prune_small_clusters`' "monotonic in
the grouping distance" guarantee), numeric-threshold rationale, or a subtle
edge case a name can't carry (`_densify_labels`' hole-filling behavior feeding
user-visible "Speaker N" numbers). Do not re-flag as a docstring-density issue.

### Terminology sweep - clean
Grepped user-facing `console.print`/log-adjacent text in all 7 files against
`docs/dev/llm/GLOSSARY.md`. "Captions" vs "subtitles" is the one term this
section touches directly - confirmed `subtitles.py`'s own docstrings/comments
never claim to be user-facing (the module/variable name split is already
documented in CLAUDE.md as deliberate) and no `console.print`/error string in
scope says "subtitles" where a user would read it. No other code-name leaks
("profile", "AI", "RP context") found.

---

## Phase 5 logging - full-app review section 2, transcription & diarization (2026-07-26)

Logging-coverage phase over `yuu_clip/transcribe/{whisper_runner,diarization_client,
transcriber,align,project_voice,speaker_attach}.py` and `yuu_clip/subtitles.py` - the
speech-to-text and speaker-identity stage of the analyze pipeline, a common source of
confusing "why did my clips have no captions/wrong speaker" reports. Grepped every
`logger.`/`log.` call and every `except` block in scope first (0.5 survey), then read
each file in full.

Applied: `speaker_attach.py::diarize_track`'s entry log ("Running diarization for
track %d [%s]...") now includes `backend=%s` (`config.diarization_backend`), matching
`whisper_runner.transcribe_track`'s entry log, which already names its backend. Low
cost, and the value grows the day a second diarization backend exists (today only
`speechbrain`/`null`) - a user comparing two runs' results can already tell which
transcription backend ran from the log; diarization couldn't.

Confirmed and deliberately left as-is - do not re-flag:

### This section already had exemplary logging coming in - no gaps found
Phases 1-4 of this section (test integrity, bug hunt, coverage, refactor) already
exercised this code hard, and it shows: every model load (Whisper CUDA-to-CPU
fallback, SpeechBrain ECAPA encoder), every backend-unavailable path (`diar_client
.available()` reason surfaced as a `warning` with the actual missing-package reason),
and every catchable failure (`transcribe_track`'s caller in `ingest.py` wraps with
`log.exception`; `diarize_track` catches both `DiarizationError` and bare `Exception`
with `exc_info=True`; `align.py`'s `realign_words`/`realign_segment_words` already log
every failure mode at the correct level) already carries a log line with
`track.id`/`track.label`/`video_id` context. Nothing in scope has a bare `except`
with no log call - the earlier grep-first survey found zero.

### No log spam in any loop
`whisper_runner.py`'s per-segment loop drives a Rich `Progress` bar, not per-segment
logging. `diarization_client.py`'s per-embedding-batch loop (`_embed_windows`) and
per-cluster-merge loops (`_consolidate_labels`/`_prune_small_clusters`) log nothing
per-iteration - only one summary `info` line per `diarize_with_embeddings()` call
(bounded to once per track). `speaker_attach.py`'s `_report_attach_decision` fires
once per resolved speaker *cluster* (bounded by speaker count, typically single
digits), not per turn or per embedding - not spam.

### `subtitles.py` and `project_voice.py` carry no logging at all - confirmed not a gap
Both are pure, deterministic, torch/DB-free transformation modules (no model calls, no
subprocess calls, no network). `subtitles.py` raises `ValueError` for missing
transcript data and lets file-write `OSError`s propagate; `project_voice.py` is pure
cosine-similarity/clustering math. Every real caller of either lives in
`yuu_clip/web/routes/*.py` and `yuu_clip/pipeline/ingest.py` - both out of this
section's scope - so a raised exception is the correct failure signal for the caller
to catch/log with its own request/run context, and adding logging inside these two
pure modules would either duplicate that caller-side log or (for the many
`refresh_export_sidecars` call sites in `web/routes/`) log without the request context
that makes a log line useful. Revisit if a future section's review of those callers
finds an uncaught/unlogged `refresh_export_sidecars`/`export_srt_sidecars` failure.

### Terminology sweep - clean
Confirmed via `web/sse.py`/`web/analyze_job.py` that this section's SSE-visible text
comes from `console.print` (Rich stdout tailed by the subprocess pump), not from
`logger.`/`log.` calls, which only reach `.yuu-clip/yuu-clip.log`. Checked both:
neither the `logger.*` calls nor the `console.print` lines in scope use "subtitles"/
"AI"/"profile"/other banned code-name framing in user-facing text (the one hit for
"subtitle" is `speaker_attach.py`'s docstring referencing the `_import_subtitles`
*function name*, which is a code identifier, not user-facing copy - no fix needed).

### The `diarization_backend != "null"` guard around the skip-log is dead code, not a logging gap
`diarize_track`'s `if not ok: if config.diarization_backend != "null": ...` can never
take the inner branch when `ok` is `False` and the backend is `"null"`, because
`NullDiarizationClient.available()` unconditionally returns `(True, "")` - so `ok`
is never `False` when the backend is `"null"`. The log line itself is correct and
reachable for the one backend where it matters (`speechbrain`); the guard is
vestigial dead code, a bug-hunt/refactor finding, not something to fix under a
logging-coverage lens. Left for a future bug-hunt/refactor pass over this file.

---

## Phase 6 docs and comments - full-app review section 1, analyze pipeline (2026-07-26)

Docs-and-comments phase over the same 12 files as the Phase 5 logging entry below
(`pipeline/{ingest,run_meta}.py` + the 10 `analyze/*.py` stage helpers). Grepped every
`#` comment and `"""` docstring in scope and read each file in full. The comment density
here was already high quality going in (refined across this section's earlier phases and
several prior review passes) - only one restatement comment survived.

Applied: deleted `pipeline/ingest.py::_import_subtitles`'s
`# Attach to the first do_transcribe track (or track 0 as fallback).` immediately above
`target_track = next((t for t in track_objs if t.do_transcribe), track_objs[0] if track_objs else None)`
- the comment translated the one-liner into English without adding any WHY (it didn't say
*why* the first do_transcribe track, just restated the fallback the ternary already
spells out). Comment-only; `yuu-dev test-api` 3331 passed (unchanged), lint clean.

Verified and deliberately left as-is:

### The two CLAUDE.md-flagged load-bearing comments are present, accurate, and survived Phase 4's extraction
- `ingest.py:250-252` - the SpeechBrain-must-be-prewarmed-before-transformers import-order
  comment, paired with `_should_prewarm_transformers`'s docstring. Matches the actual
  prewarm call site and CLAUDE.md's "SpeechBrain poisons transformers.pipeline" section.
- `extract.py:179-184` (`_build_clip_cmd`'s header) + `:216-224` (the softsub branch) - the
  ffmpeg `-ss`/`-t` argument-ordering invariants, including the two-input softsub ordering
  bug this comment guards against. Both read correctly against the current code after
  Phase 4's `_audio_stream_maps()` extraction - the softsub comment's claim that `-t` must
  come after both inputs, and the map-args comment's claim about honouring the
  `audio_stream_index` contract, both still hold.

### The many multi-line docstrings on internal (`_`-prefixed) functions in `ingest.py` - kept, not pared to one-liners
Decision: do not strip `ingest.py`'s docstrings on private helpers (`_resolve_existing_video`,
`_upsert_video_and_tracks`, `_reusable_track_transcript`, `_transcribe_and_check_overlap`,
`_retranscribe_video`, `_clear_existing_clips`, etc.) down to bare one-liners, despite
CLAUDE.md's "No docstrings on internal functions - clear names are enough" guidance.
Rationale: every one of these documents genuinely non-obvious return-value shape or
side-effect behavior a name alone cannot carry - e.g. `_resolve_existing_video`'s "Returns
(video_path, existing) or None when the caller should skip this video (ID not found, or
already done without --force)", or `_reusable_track_transcript`'s explanation of *why* it
also deletes stale rows as a side effect (a truncated transcript from a run that died
mid-track, which reusing would silently pass off as complete). This is the same bar the
governing rule sets ("explains why, or something a careful reader can't tell from the code
itself") and matches precedent already recorded for this exact pattern elsewhere in the
codebase (the "approval.py route docstrings... kept" and "transcribe_track ~76 lines - not
decomposed" entries below). Not a phase-6 finding to fix; do not re-flag.

### Terminology sweep - clean
Grepped every `console.print` line in the 12 in-scope files against `docs/dev/llm/GLOSSARY.md`
for a code-name-in-user-facing-text slip (the recurring pattern class this project has hit
before - "profile" vs "Track layout", "AI" vs "LLM"). `labeler.py` already says "Track
layout" consistently in every user-facing line; no "profile"/"AI"/"RP context" leaks found
in this scope beyond the ones Phase 5 already fixed (`_llm_unavailable_message`/`_notice`).

### `docs/dev/llm/REVIEW_MAP.md`'s Stage 1/Stage 2 file lists - verified accurate
Spot-checked the file list and one-line descriptions for all 12 in-scope files (lines 36-62)
against the current module docstrings and content. No file was renamed or moved this
section (only 2 helper extractions and a few logger calls in earlier phases), and the
descriptions still match. No doc edit needed.

---

## Phase 5 logging - full-app review section 1, analyze pipeline (2026-07-26)

Logging-coverage phase over `yuu_clip/pipeline/{ingest,run_meta}.py` and
`yuu_clip/analyze/{probe,extract,labeler,overlap,proxy,frames,motion,framing,pause,
thermal}.py` - the analyze pipeline's orchestration and every per-stage helper, the
single most operationally critical path in the app. Confirmed via `web/sse.py` and
`web/analyze_job.py`: every `console.print` line these modules emit is tailed as the
child subprocess's stdout and reaches the browser's live log panel over SSE - so
these strings are genuinely user-facing, not just CLI decoration, and glossary
compliance applies to them.

Applied:
- **`run_meta.py`'s `StageRecorder.stage()` now logs stage boundaries to the file
  log** (`log.info` on start/finish, `log.warning` on an unhandled exception
  propagating out of the stage, each carrying the video's filename via a new
  `StageRecorder(label=...)` constructor arg). Previously the *only* narrative of a
  run's progress lived in `console.print` (Rich stdout, piped only to the live SSE
  stream and an in-memory reconnect buffer capped by `_MAX_BUFFER_LINES`) - none of
  it reached `.yuu-clip/yuu-clip.log`. A user who closes the browser (or hits a run
  long enough to overflow the buffer) and later checks the log file per this
  project's own "if it fails, check yuu-clip.log" troubleshooting convention would
  find only the sparse `log.exception`/`log.warning` calls, missing which stage the
  pipeline reached before dying. This is the highest-value fix of the pass.
- `ingest.py`'s `_analyze_one` now logs `Analyze started` / `Analyze finished
  (elapsed_ms=...)` bookends to the file log for the same reason (per-video, not
  per-stage - one line each, no spam).
- `run_meta.py::_resolve_devices`'s bare `except Exception: diar_device = "cpu"`
  (silently swallowing a torch/CUDA probe failure into an unremarkable "cpu"
  device report) now logs at `debug` before falling back.
- **Correlation-id consistency**: the Extract/Transcribe per-track failure logs and
  the subtitle-import failure logs used `video=%s` (bare filename or `Path` object)
  while every other failure log in `ingest.py` keys on `video_id=%s` - a reader
  grepping one video's `video_id` across a run would miss these three lines. Added
  `video_id=%s` alongside the existing filename (kept for human readability) at all
  three sites; `video.id` is always populated by the time these run.
- `extract.py::_probe_duration_s`'s silent `except (ValueError, AttributeError,
  TypeError): return None` (a failed ffprobe duration parse after export, which
  silently skips `_verify_export_duration`'s corrupt-export guard) now logs at
  `debug` with the raw ffprobe output and exit code.
- **Glossary fix**: `ingest.py`'s `_llm_unavailable_message`/`_llm_unavailable_notice`
  said "AI clip ranking and descriptions" / "AI score and descriptions" - these
  strings reach the browser (confirmed above), and the glossary explicitly bans "AI
  scoring"/"AI" framing in favor of "LLM scoring" (`GLOSSARY.md:806-807`). Reworded
  both to "LLM clip ranking and descriptions" / "LLM score and descriptions". No test
  pinned the old wording (`test_preflight_llm.py` mocks the function; `test_run_meta.py`
  appends its own literal warning string, unrelated to this function's output).

Confirmed and deliberately left as-is - do not re-flag:

### The rest of `ingest.py`'s exception handling is already exemplary
Every stage that can fail already pairs a user-facing `console.print` with a
`log.exception`/`log.error`/`log.warning` carrying `video_id` (or `path`/`video=` when
the video row doesn't exist yet - Probe runs before the row is created, so filename is
the only identity available). `_probe_video`, subtitle import, extraction, transcription,
scoring, scene generation, video summary, and run-metadata recording all follow this
pattern. Nothing else needed adding.

### No log spam found in any per-frame/per-track loop
`frames.py`/`framing.py`'s `_extract_frame` (called once per sampled frame, up to ~10)
already logs failures at `debug`, not `info`. `motion.py`'s per-sample decode loop
(`_sample_from_container`) logs nothing per-frame by design - only a single `warning`
if the whole decode fails. `overlap.py`'s per-frame RMS decode failure is `debug`. None
of these needed a level change.

### `extract.py`'s `export_clip`/`export_clip_with_preset`/`_run_ffmpeg` (clip export,
not audio extraction) carry no logging of their own - confirmed not a gap
These raise a bare `RuntimeError` on ffmpeg failure with no log call inside `extract.py`
itself. Left as-is: `extract_audio_track` (the pipeline's own audio-extraction call, used
by `ingest.py`) already logs via its caller; the clip-export functions are called only
from `export/render.py` and `web/routes/analyze.py` (both outside this review section's
scope), and spot-checking `render.py` confirms it already logs the failure with
`clip_id` context before/around the call. Those two call sites are this codebase's
export feature, not the analyze pipeline, and will fall under whichever later review
section covers `export/`/`web/routes/`.

### Thermal auto-pause events are already logged - by the caller, not `thermal.py`
`ThermalTrigger.poll()` returns a typed `ThermalPollResult` with no logging of its own;
its one caller, `web/routes/analyze.py::_thermal_poll_loop` (outside this section's
scope), already logs both `warn_triggered` and `pause_triggered` at `warning` with the
temperature and threshold. Confirmed via grep before concluding this was a gap - it
is not.

### DEFERRED - not fixed this phase (needs a bug-hunt/robustness lens, not a logging one)
`ingest.py::_extract_audio_and_check_rms_overlap` catches only `except RuntimeError` per
track, while the structurally identical transcription loop
(`_transcribe_and_check_overlap`) catches `except Exception`. `extract_audio_track` today
only ever raises `RuntimeError`, so this isn't live, but if `subprocess.run` itself ever
raised (e.g. `OSError`/`PermissionError` from a broken PATH entry resolved after
`find_ffmpeg()` returned), it would propagate uncaught out of `_analyze_one` with no
`log.exception` for that track - a real gap, but *widening a catch clause* is a behavior
change (it changes what aborts the run vs. what a per-track loop swallows and continues
past), not a pure logging addition, so it was left for a bug-hunt/refactor pass to weigh
rather than changed silently here.

---

## Phase 7 UX/UI - full-surface review (2026-07-23, shipped 2026-07-24)

The `UX-REVIEW-2026-07-23.md` fix plan shipped across six stages (commit range
`d5a3618..fd43f3e`): all 11 HIGH, ~24 MEDIUM, and ~29 LOW findings from a full
shqr-ux-ui-review surface walk were fixed or deliberately skipped. Owner decisions:
H9 kept the wizard Launch block and added a Cancel to the CUDA install; M21 unified
both export surfaces on soft (embedded) captions as the default; M22 uses undo-toasts
for library row deletes; M10 renamed the split confirm to "Split recording" with
danger styling; Low 13 removed the bottom Close from About/Controls/Getting Started so
all five info-modals close via the top-right X (Controls gained a top X to match).

**Did not reproduce (skipped, not fixed):** M16 (setup.html inline hex literals) -
the wizard token re-skin had already removed them. Low 16 same. Everything else in
the plan reproduced and was fixed.

**Confirmed-intentional - do NOT re-flag** (verified good during the walk):
- Empty-state onboarding (`videos.js`): mascot + one gold CTA + analyzing-swap state.
- `install-error.js` failure-class mapping (network/disk/antivirus/no-wheel/CUDA) -
  exemplary plain-English error design (the one gap, M17's fallback sentence, is fixed).
- Boot-time modal a11y stamping (`boot.js`) + single document-level focus trap
  (`ui.js`) + showConfirm defaulting focus to Cancel.
- Dirty-state guards funnelling through one "Discard changes?" confirm + beforeunload.
- Undo toast with a visible shrinking countdown bar (`ui.js`).
- Cancel-left / verb-specific-primary-right button order across action modals; gold
  `highlight` reserved for the two Export confirms.
- Toasts mirrored into `#sr-live-polite`/`#sr-live-assertive` (`utils.js`).
- Universal `:focus-visible` ring + `prefers-reduced-motion` block (`app.css`).
- `--visual` sharing `--action`'s hue (bars always labelled).
- Kind-filter chip tooltips teaching clip-vs-scene at point of use.
- Calm "setup state, not failure" no-model copy (`videos.js`, `clips.js`) - the
  reference pattern for capability-missing states.
- Wizard: status-slot re-render never wipes typed values; restore-only-in-initial-mode;
  optional CUDA section hidden when empty on non-NVIDIA; FFmpeg failure row's model
  recovery path.
- Glossary-term compliance clean across the five region partials.
- modelcatalog reconnect-poll behaviours (can't cancel another window's download;
  verifies the file landed before declaring success).
- Per-video computed "Retranscribe before export" default with safe fallback.

### Low 29 - pointer-only resize handles + split-timeline markers (accepted)
Decision: the sidebar/player resize handles and the split-editor timeline markers stay
**pointer-only** - no keyboard path for placing a split marker or dragging a resize
handle. Accepted for a mouse-first desktop tool (single Windows user). The trigger to
revisit: a keyboard-only or AT user actually needs to split a recording or resize a
pane. Do not re-flag as a keyboard-accessibility gap.

---

## Fable-review WS-5 - backend seam hygiene (2026-07-24)

Three deliberate keep/exception calls made while shipping WS-5 (ARCH-1..4 +
ARCH-policy) from `FABLE-REVIEW-PLAN-2026-07-23.md`. ARCH-1 (warn on unknown
backend) and ARCH-2 (unify the seam availability probe on `available()`) were plain
fixes, not keeps, so they are not recorded here.

### align.py (forced alignment) is a documented exception to the seam convention (ARCH-3)
Decision: `transcribe/align.py` stays a pair of module-level functions
(`realign_words` / `realign_segment_words`) - NOT wrapped in the ABC +
`make_*(config)` factory + `available()` convention that the other model-backed
seams follow.
Rationale: none of the convention's machinery has a consumer here. There is no
`alignment_backend` config value, exactly one implementation (torchaudio
WAV2VEC2_ASR_BASE_960H, English-only), and the single caller
(`web/routes/common.py`) never probes availability - it calls
`realign_segment_words` and falls back to a static caption line when it returns
`None` (which the function already does for non-English audio or any failure, never
raising). Adding a factory + Null backend + availability probe for one best-effort
function would be speculative generality with nothing to serve. The trigger to
promote it behind the convention: a second aligner (e.g. non-English) that a caller
must select or gate on. Documented in `align.py`'s module docstring. Do not re-flag
as a seam-convention violation.

### The cancelable out-of-process vision path is llamacpp-server-only by design (ARCH-4)
Decision: the frame-analysis subprocess (`pipeline/frame_analysis.py` ->
`scoring/llm.describe_frames_via_server` -> `post_chat_completion`) POSTs vision
requests straight to the parent web server's warm llama-server instead of going
through the `LLMClient` seam. Left as-is and documented, NOT refactored to route
through `make_client`.
Rationale: the llama-server pool is per-process and warmed once per process.
Constructing an `LLMClient` inside the subprocess (`make_client(config).chat_vision`)
would spawn a second server and re-load the multi-GB vision model - the exact
double-load the out-of-process design exists to avoid. In-process vision
(`describe_frames`) DOES go through the seam and is backend-agnostic; only the
cancelable path bypasses it. Consequence, stated in the seam contract
(`llm_client.py` `vision_payload_messages` docstring): "a second LLM backend is a
registration, not a rewrite" holds for scoring and in-process vision, but a new
backend would need its own out-of-process mechanism to get cancelable frame
analysis. A full routing fix was judged too risky for this pass (it would touch the
per-process warm-server invariant). Do not re-flag as a seam leak without that
context.

### Policy: the setup wizard's scope does not grow toward Settings parity (ARCH-policy)
Decision (locked policy, not just a keep): the Electron setup wizard stays
minimum-viable first-run - pick/download ONE text LLM model and write `config.json`
- and everything else (vision model, Whisper size, scoring weights, hardware, hot
words, etc.) is finished in the in-app Settings. New model-selection or
configuration surfaces are added to Settings, NOT mirrored into the wizard.
Rationale: the wizard and Settings are two parallel model-selection stacks that
CANNOT share runtime code (browser vs Electron main/Node, and the wizard runs before
the Python server exists) - see the CLAUDE.md "Wizard and Settings are parallel
model-selection stacks" section. `yuu-dev shared-data` + the drift guard keep the
shared *data* (`catalog-data.json`) in sync, but they cannot see *behavior*
duplication: the wizard's downloader (`electron/`) and `cli/models.py download-gguf`
are independent implementations with independently-evolved retry/resume/verify.
Every feature the wizard grows doubles that invisible surface. Holding the wizard's
scope down is the mitigation the drift guard can't provide. If the wizard ever must
gain a new config (e.g. vision-model selection), treat it as a deliberate,
separately-reviewed scope expansion - and it must write the correct config key
(`llm_vision_model_path`, never `llm_model_path`; enforced by
`test_shared_data_drift.py`).

---

## Refactor-for-quality WS-D - frontend JS extractions close-out (2026-07-23)

WS-D (9 frontend JS extractions + vitest for zero-coverage modules, D1-D9) shipped one
item at a time (`d3e2718`..`4b83fde`) with a `yuu-dev bundle` + `yuu-dev test-js` gate
between each (410 -> 492 JS tests) plus a full `yuu-dev test-ui` (650 passed, 1 known
xdist-parallelism flake that passes in isolation) and `yuu-dev test-unit` 1777 (bundle/
index/side-effect drift guards) at close. See the refactor-for-quality plan's per-item
ledger and commit SHAs in the planning workspace history (plan doc since archived - all
items shipped). No plan item was dropped or improvised. Recorded here per the close-out
convention:

### The three URLSearchParams query builders are deliberately NOT unified (anchored keep)
Decision: `analyze/reel.js` (`_reelPoolQs`, `confirmBatchExport`), `clips/clipexport.js`,
and `library/exporteditor.js` (`buildExportParams`, D2) each keep their own
`URLSearchParams` assembly; they are not refactored into one shared builder.
Rationale: this was flagged out of scope by the plan's "Deliberately out of scope" list and
pre-recorded in the WS-C close-out entry below. The three build different query shapes for
different endpoints (reel-pool filtering vs batch-export options vs single-clip export with
caption-style fields) over different caller state - same basis as the anchored `routes/llm.py`
capability-tier keep. D2 turned exporteditor's builder into a pure, testable
`buildExportParams({captionMode, preset, titleCard, config})` but kept it editor-specific;
that is intra-module extraction, not the cross-module unification this keep forbids. Do not
re-flag the three as duplication.

### Three extractions expanded the plan's sketch signatures - deliberate, not drift
Decision: D1's `computeReelEstimate` omits the sketch's `transDur` param; D2's
`computeTrimBoundary` ctx adds `effStartMs`/`effEndMs` beyond the sketch's
`{clipStart, clipEnd, minDurationMs}`; D3's `_timelineRowHtml` takes a `memberId` the
sketch's `(row)` omitted.
Rationale: each is what behavior-preservation required, not a redesign. `updateReelEstimate`
read `demo-trans-dur` into a `transDur` local the estimate math never used (a pre-existing
dead read) - threading it through the pure fn would fabricate a used-looking param.
`computeTrimBoundary`'s 1s-minimum guard floors against the opposite edge's *current*
effective position (offset-adjusted), which `clipStart`/`clipEnd` alone cannot express.
`_timelineRowHtml`'s `data-goto-video`/`data-clip-video` nav attrs need the member id, which
`mergeTimelineEntries` deliberately keeps out of its pure rows. Each is noted inline in the
plan's row.

---

## Refactor-for-quality WS-C - Python behavior-preserving extractions close-out (2026-07-23)

WS-C (7 behavior-preserving Python extractions, C1-C7) shipped one item at a time with a
full `yuu-dev test-api` gate between each (all green: 3120 -> 3161 passed) plus a final
`yuu-dev test-system` real-pipeline pass. See the refactor-for-quality plan's per-item
ledger and commit SHAs in the planning workspace history (plan doc since archived - all
items shipped). No plan item was dropped or improvised. Recorded here per the close-out
convention:

### `web/analyze_job.py`'s 2 SSE frames were deliberately NOT converted to `sse_event` (C4)
SUPERSEDED by the SSE typed-event migration (stage 4, 2026-07-24): `sse_event` /
`_done_event` were retired entirely, and `analyze_job.py` now frames its buffered events
through the single `jobevents.frame` entry point. The scope decision below is kept for the
historical record only.

Decision: Leave `analyze_job.py:189,198` as raw `f"data: {json.dumps(...)}\n\n"`.
Rationale: C4's stated scope is exactly the 5 route files
`routes/{videos,scoring,sessions,speakers,clips/export}.py` and its 66-frame count matched
those files exactly. `web/analyze_job.py` (the AnalyzeJob replay buffer) is a separate
module outside that enumerated scope; converting it would be scope creep beyond the plan
item. The new `web/sse.py::sse_event` helper is the single definition of the frame contract
and `analyze_job.py` could adopt it in a future pass - it is not an inconsistency to
re-flag as a bug, just an unconverted call site left by an intentionally-scoped mechanical
substitution. (No circular-import blocker was found; this is a scope decision, not a
technical one.)

### C5's per-caller `error_log_prefix` string is a deliberate tradeoff, not naming drift
Decision: `_score_one_clip` takes a preformatted `error_log_prefix` string from each caller
rather than a structured `(clip_id, video_id)` pair.
Rationale: the two rescore routes logged different formats on failure - the batch route
`"rescore_clips: clip N failed for video M: <exc>"` (with the video id) and the single-clip
route `"rescore_clip: clip N failed: <exc>"` (without). Passing each caller's fully-formatted
prefix keeps both log lines byte-identical to the pre-refactor output; a structured param
would have forced one unified format and silently changed one of the two log lines. The
extraction was behavior-preserving including diagnostic log text, so the string param is the
faithful choice.

---

### The URLSearchParams builders (reel.js/clipexport.js/exporteditor.js) are NOT part of WS-C
Deferred to the WS-D (frontend) session's close-out, since they are JS modules WS-C never
touched. Recorded here only so the pointer is not lost: the plan's "Deliberately out of
scope" list keeps them separate (different callers, different fields), same basis as the
anchored `routes/llm.py` capability-tier keep.

---

## Refactor-for-quality WS-A+B - test-tier rebalance close-out (2026-07-23)

WS-A (10 test-file splits moving pure-by-dependency tests from `tests/integration`
to `tests/unit`) and WS-B (new unit tests on already-pure, previously-untested
logic) both shipped - see the refactor-for-quality plan's full per-item ledger in the
planning workspace history (plan doc since archived - all items shipped). Recorded
here per the close-out convention:

### 4 of WS-B's 8 items were SKIPPED - already covered, not written
Decision: do not write near-duplicate tests for B1, B2, B4, B6.
Rationale: each item's target function turned out to already have thorough
direct unit coverage by the time WS-B started - either freshly relocated by a
WS-A move in the same session (B1's `_apply_name_suggestions`/
`_voiceprint_name_suggestions` and B2's `_build_clip_cmd`/`_preset_video_filter`
moved in A4/A3; B4's `_build_xfade_cmd`/`_segment_start_times` moved in A3+A9),
or pre-existing and simply not surveyed (B6's `_cosine_similarity`/
`serialize_voiceprint`/`deserialize_voiceprint`/`best_voice_match` already had
a dedicated `tests/unit/test_project_voice.py`, whose own module docstring
names it). Each SKIP is recorded inline in the plan file with the specific
test classes/counts that already satisfy it. **Do not re-flag these as
untested** - re-verify against the current test files before assuming a gap.

### A structural pytest fix was required mid-move, not anticipated by the plan
Decision: add empty `tests/unit/__init__.py` + `tests/integration/__init__.py`.
Rationale: pytest's default prepend import mode raises "import file mismatch"
when a same-basename test file exists in both `tests/unit` and
`tests/integration` and both tiers collect in one session (`yuu-dev test-api`)
- which every WS-A move does by construction (same filename, new directory).
Discovered on the very first move (A10) and fixed once for the whole
workstream. `tests/ui` deliberately kept `__init__.py`-free since 36 files rely
on bare `from conftest import ...`, which needs the file's own directory on
`sys.path` (package-qualifying it would break that).

### Two pre-existing cross-file `TestSafeFilename` duplicates surfaced, not fixed
Decision: leave both in place; this was a move-only workstream.
Rationale: `tests/unit/test_export.py::TestSafeFilename` (from A3) and
`tests/unit/test_reel.py::TestSafeFilename` (from A9) both test the same
`web/routes/reel.py::_safe_filename` with different test names/cases - a
pre-existing duplication in the integration tier that predates this refactor,
now just relocated verbatim rather than merged (WS-A's rule: import-path
fixes only, no behavior or dedup changes). Flagged for a future WS-C/dedup
pass, not touched here.

---

## Phase 6 docs and comments - window.X shim-drain slice (2026-07-23)

Docs-and-comments phase over the shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`).
Applied one obsolete-comment fix class: three per-module "Public API" export-block header
comments (`analyze/analyze.js`, `clips/clips.js`, `videos/videos.js`) still described one
consumer type as a "classic (bundle.js) consumer" / "still-classic module". The classic
`bundle.js`/`bundle.manifest` were retired when the ESM migration completed (main.esm.js:3-4,
ARCHITECTURE.md:183-185), so that consumer no longer exists - rewrote each to the accurate
current set (another already-ESM module reading the export off window, an inline handler in
index.html, or a tests/ui page.evaluate). Comment-only; rebundled. This is the obsolete-comment
class Phase 4 corrected inside `main.esm.js` but did not reach in the individual modules.

The following were reviewed and deliberately left as-is:

### `main.esm.js` residual-shim banner + GROUP 1/2 comments - current and accurate
The two-group shim banner (rewritten Phase 3, attributions corrected Phase 4) matches the
live code: GROUP 1 lines each name a live runtime reader, GROUP 2 records per-cluster why each
test-only hook can't be dropped. Nothing stale remains here.

### `core/jobs.js` 9 near-identical "window.* read" comments - kept
The 9 repeated `// window.* read: a direct import here adds a jobs.js <-> videos/clips edge
that ... breaks vitest's vi.mock` comments mark the documented exception (CLAUDE.md:231-234).
Each guards a distinct call site against being "fixed" to an import; the repetition is the
point (a reader editing any one site sees the warning). WHY comment, keep.

### `core/boot.js` + `analyze/split.js` window-bridge WHY comments - kept
`boot.js`'s `window._prereqs`/`_aiPrivacyMode`/`_visionEnabled` comment and `split.js`'s
live get/set accessor-bridge comment both describe mechanisms that still exist; they explain a
non-obvious current coupling (the vitest follow-on bridge), not a retired one. Accurate, keep.

### Project docs (CLAUDE.md frontend section, ARCHITECTURE.md, ROADMAP) - verified current
CLAUDE.md's "shrinking residual window.X = X shim" section and jobs.js "9 window.* reads" count
match the code; ARCHITECTURE.md's shim section explicitly flags the old all-window pattern as
stale-if-cited; ROADMAP's shim-drain entry was fully removed in 9d21aac (plan CLOSED). No doc
edit warranted.

---

## Phase 5 logging - window.X shim-drain slice (2026-07-23)

Logging-coverage phase over the same shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`).
Browser-side "logging" here is `showToast` error surfacing plus `appendLog` to the in-app
log panel - the frontend deliberately carries almost no `console.*` (one documented
`console.warn` in `utils.js`). **No code changes were warranted**; the conversion introduced
no swallowed error. Confirmed and deliberately left as-is:

### The conversion left the SSE/job error paths intact and fully surfaced
`core/jobs.js` `_openSSE`/`streamSSE` remain the exemplar: `_openSSE` handles `!res.ok`
(reads the error body), a stream that ends without a completion signal, a mid-stream
connection loss, and the outer fetch rejection - each routed to `onError`; `streamSSE`'s
`onError` appends the bracketed line to the log, toasts it, plays the error sound, tears the
job UI down, and calls the caller's `onError`. A typed `done{outcome:error}` event (since
the SSE typed-event migration; the old `__DONE__` sentinel forms and `isDoneSentinel`/
`doneError` helpers were retired in stage 4) routes a failure to `onError` via the shared
`decodeEvent`, so no reader reports a failed job as done. `analyze.js`, `videos.js`,
`clips.js`, `settings/projects.js`, `core/utils.js` all surface fetch `!ok`/catch via
`showToast` or an inline error region. Nothing to add.

### Every empty / identifier catch in the arc is a deliberate tolerant fallback
`sessions.js`/`clips.js`/`preview.js` `try { videoEl.currentTime = ... } catch {}` (a
media-element seek that can throw before metadata loads), `clips.js:788` (re-fetch the clip
after analyze-frames; falls back to the cached copy, and the frame job already reported its
own failure), `videos.js:333` `_restoreView` (corrupt/missing saved-view JSON -> ignore),
`videos-timeline.js:67` and `utils.js` `_exportRetranscribeDefault` (populate a modal / a
checkbox default from `/api/config`; a failure keeps the safe built-in default),
`analyze.js:747`/`:766` (preview warm + completion warning, each carrying a WHY comment that
a failure must never surface as an error), `projects.js:27` (switcher stays hidden if the
list can't load). None is an error path a user needs told about; adding a log/toast to any
of them would be noise on a benign, self-healing condition - same basis as the 2026-07-13
`_cardCollapseState` / `copyText` decisions.

### No log spam introduced
The conversion added no per-frame / per-SSE-event / per-render `console.*` or `appendLog`
call. The in-app log panel is still bounded to `_MAX_LOG_LINES` (500) with its documented
reflow-cost WHY, and the full log always remains in `.yuu-clip/yuu-clip.log`.

### BUILT in Phase 9 (owner-approved): top-level `window.onerror` / `unhandledrejection` reporter
The frontend had **no global uncaught-error surface**. This is exactly the Phase-2 bug class:
a bare-identifier `ReferenceError` on a rare path (Escape with nothing open) shipped and failed
silently - nothing logged it and nothing told the user. Built as `core/errorreporter.js`
(`initGlobalErrorReporter()`, wired FIRST from `boot.js` so it catches errors from later boot
steps): every uncaught `error` and `unhandledrejection` is mirrored to `console.error`, appended
to the in-app log panel (`appendLog`, so a non-technical user can open + copy it for a bug
report), and surfaced as a persistent error toast whose "Show log" action calls the existing
`openLog()`. A looping error (same signature within 5 s) is logged every time but toasted at
most once, so a per-render throw can't stack identical toasts. Uses only the existing
`showToast`/`appendLog`/`openLog` surfaces - no new infrastructure, no server round-trip.
Covered by `tests/js/core/errorreporter.test.js` (5 tests). This is the durable closing of the
diagnosability gap that let the Phase-2 bug ship - do not re-flag it as missing.

---

## Phase 4 refactor - window.X shim-drain slice (2026-07-23)

Refactor phase over the shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`) that converted
the frontend off `window.*` globals onto ESM imports and consolidated the residual shim in
`main.esm.js` into two labeled groups. Applied: corrected two stale reader-attributions in
the GROUP 1 shim comments that the Phase-3 comment rewrite missed - `closeNewRecordingPanel`
was labeled "shortcuts.js + analyze.js onclick-string" but Phase 2 converted shortcuts.js to
`import` it (no window read remains), so its only live reader is the analyze.js onclick-string;
`openSettings` was labeled "... onclick-string + bare-global" but every JS caller (clips,
videos, clipexport, settings) now imports it, so the "+ bare-global" clause is dead and the
line survives only via the onclick-strings (added clipexport to the list). Comment-only;
rebundled. Gate: `yuu-dev test-js` 367, `test-unit` 1069, `lint` clean.

The following were reviewed and deliberately left as-is:

### GROUP 1 shim lines all verified alive; GROUP 2 kept whole - not drained
Decision: Keep every current shim entry.
Rationale: Grepped every GROUP 1 name's claimed runtime reader - all confirmed live: jobs.js
reads loadVideos/_clipsListUrl/_updateDemoButton/_syncAnalysisLivePanel/_renderClips/
_renderClipFilterCounts off window (the documented vi.mock exception); format.js reads
window._clipsSortParam; helpmodals.js reads window.closeHamburger; panelnav.js reads
window.showConfirm; sidebar/header/split-editor inline handlers and the `_diarizationNoteHtml`
onclick-strings (evaluated in global scope) keep the rest. `undoLastBulkStatus` is a genuine
clips.js bare-global (clips.js does not import it). No GROUP 1 line is droppable. GROUP 2 is
the deferred vitest follow-on's territory (each cluster's per-name note records why it can't
be reached by a real click yet) - draining it is out of this slice's scope, same basis as the
2026-07-16 "residual shim - kept in full" entry.

### No unused imports, no arc-orphaned dead code, `_diarizationNoteHtml` already shared
Decision: Keep as-is (nothing to fix).
Rationale: A full-tree scan for imports used zero times in their file found none - the 68-read
conversion left no import residue. `_diarizationNoteHtml` (a candidate DRY target, appears in
analyze.js / contexts.js / clipexport.js) is already centralized in `core/utils.js` and
imported by all three consumers - clean, not duplicated. `boot.js` is a long module-scope init
sequence but it is the one CLAUDE.md-exempt side-effect entry point (one concern: first-paint
wiring); its `window._prereqs`/`_aiPrivacyMode`/`_visionEnabled`/`refreshServerState` globals
are the already-documented shared-mutable-state bridge for the vitest follow-on, not drainable
here.

### `const data = await res.json()` idiom kept - not "naming drift"
Decision: Keep `data` for a parsed JSON response body.
Rationale: This appears at ~30 sites across the frontend as the established name for a fetch's
parsed JSON payload; it predates the arc (not introduced by the conversion) and is an idiomatic
local for the immediately-destructured response body. Renaming to a bespoke name per call site
would be churn against a consistent convention for no legibility gain.

---

## Phase 6 docs and comments - pre-public polish (dev-CLI / wizard / whisper-catalog) (2026-07-18)

Docs-and-comments phase over the hand-written new/changed logic since baseline `6848574`
(the `001_PRE-PUBLIC_polish-pass` body). Applied two user-facing glossary fixes (glossary
bans "AI scoring" in favour of "LLM scoring"):
- `videos/videos.js` "scored without a language model" tooltip said "re-score for AI
  scoring and descriptions" while its sibling branch one line up already says "LLM scoring
  failed" - fixed to "LLM scoring" (internal consistency + glossary). Rebundled.
- `partials/modals/about.html` third-party grouping header "AI scoring" -> "Local AI"
  (the row it heads, llama.cpp, does LLM scoring AND vision/image-analysis, so the narrower
  "LLM scoring" would undersell it; "Local AI" is accurate and matches existing wizard
  copy - "Set up local AI"). Re-stitched index.html. No test pinned either string
  (`test_ui_page.py` only asserts the About version); `test-js` 226 + `test-unit` 983 green.

The following were reviewed and deliberately left as-is:

### `whisper_catalog.py`, dev-command modules, `constants.js`/`setup-preload.js`/`whisper-select.js` WHY comments - kept
Every comment in the in-scope dev modules and wizard-data files explains a genuinely
non-obvious constraint, not restatement: `whisper_catalog.py`'s module docstring records
that the size/VRAM strings were the classic hand-copy drift point now single-sourced here;
`constants.js`/`setup-preload.js`/`recommend-model.js`/`setup-renderer.js` document the
generated-from-Python catalog seam (`yuu-dev shared-data`), the packaged-vs-dev binary
provenance, the setup-version re-show rule, and the esbuild-tree-shakes-string-referenced-
functions reason for event delegation; `whisper-select.js` carries the measured VRAM
headroom rationale. All earn their place. The box-drawing `--` section dividers in
`setup-renderer.js` are the codebase-wide comment-only convention (2026-07-10 entry) - a
`.js` comment, never console-bound - not re-flagged.

### `approval.py` route docstrings and `clipcreate.js` picker comments - kept
`approval.py`'s one-line route docstrings and its "pending"/"approved" references are
accurate descriptions of the code's status values (code identifier, not user-facing text -
the UI renders "Unreviewed"). `clipcreate.js`'s inline-preview-not-#player-area rationale
and the clips-vs-scenes kind comment explain real WHYs. No change.

### FLAGGED (needs human decision - a factually-wrong comment entangled with behavior)
`electron/recommend-model.js:36-38` justifies its `gpuVendor !== 'nvidia' => CPU-only`
recommendation with "the bundled llama.cpp build is CUDA, and ... AMD/Intel GPUs run
llama.cpp on CPU here". That rationale is **factually wrong**: the bundled llama-server is
the **Vulkan** build (`constants.js:31-36` - the dir holds `vulkan\`+`cpu\`; Python
`resolve_server_binary` prefers vulkan), and `setup-renderer.js:109-119` tells non-NVIDIA
users "your GPU speeds up LLM scoring" via that Vulkan engine. So the wizard shows a
capable AMD/Intel user "your GPU speeds up LLM scoring" on one screen while the local-model
recommendation (`recommendLocalModel`) treats the same machine as CPU-only ("No CUDA-capable
GPU detected. Runs on CPU..."). The NVIDIA gate was a deliberate commit (`eb997eb`
"treat non-NVIDIA GPUs as CPU-only"), so the *behavior* may be intended - but its stated
reason is false and it contradicts the sibling wizard copy. Fixing the comment alone would
either restate a falsehood or expose that the code under-credits Vulkan GPU accel; fixing
the code is a product/behavior change (VRAM thresholds were tuned for CUDA) beyond this
docs phase. Wizard owner should decide: credit Vulkan GPU accel for non-NVIDIA cards in the
recommendation, or keep the NVIDIA gate but correct the comment's rationale to the real one.

**RESOLVED (same session, owner-approved, commits `8ae92f4` + `44f71c8`):** kept the NVIDIA
gate but made it honest. The gate's real basis is VRAM *measurability*, not acceleration -
only NVIDIA gets the `nvidia-smi` VRAM override in `gpu-detect.js`, so the large model can't
be safely sized for AMD/Intel even though the Vulkan build accelerates them. `8ae92f4` fixed
the code comment; `44f71c8` split `isCpuOnly` into `canSizeGpu` (model sizing / strong-push
gate) + `gpuAccelerates` (copy) so a non-NVIDIA GPU user now reads "Your GPU accelerates local
AI, but its video memory could not be measured, so lightweight is the safer pick" instead of
the false "No CUDA-capable GPU detected. Runs on CPU". Recommendation *behavior* unchanged;
the two tests that encoded the old false assumption were rewritten. This is no longer an open
decision.

---

## Phase 5 logging - pre-public polish (dev-CLI / approval route / setup wizard) (2026-07-18)

Logging-coverage phase over the hand-written new/changed logic since baseline `6848574`
(the `001_PRE-PUBLIC_polish-pass` body). Surveyed every logging/console/error surface in
scope; **no code changes were warranted** - the surfaces are already diagnosable and
cp1252-clean. Verified and deliberately left as-is:

### `web/routes/clips/approval.py` - already logs both routes with context
`auto_approve` logs `Auto-approved %d clips with %s >= %.2f for video %d` and
`reset_approvals` logs `Reset %d clip approvals for video %d` - each carries the count,
the video id, and (for auto-approve) the score field + threshold. That is enough to
reconstruct a mis-approval from `.yuu-clip/yuu-clip.log` without a code reread. Validation
rejects (bad threshold / unknown score_field / missing video) surface as `HTTPException`
to the browser toast, the established pattern; they are expected user-input errors, not
log-worthy failures. No gap.

### New `yuu-dev` dev-command modules (`fixture`, `helpdocs`, `htmlstitch`, `shareddata`, `typecheck`, `tests`, `serve`) - developer console output, not application logging
Same basis as the already-anchored `bundle.py`/`testjs.py` entry (2026-07-16). These are
`yuu-dev` developer-CLI tools; their "logging" surface is Rich `console.print` to the
developer, not the app log file. Each failure path prints a red, ASCII-only, actionable
message and raises `typer.Exit` with a non-zero code (`fixture` --force hint, `typecheck`
propagates mypy's returncode, `tests` the pre-check trio - no server / >1 server /
leftover pytest procs - each exit 3 with the fix, `serve` port-in-use + processing-active
guards). `htmlstitch.stitch` raises `FileNotFoundError` on a missing partial so a typo can
never silently drop a region. Confirmed **zero non-ASCII** in any print/console string
across all in-scope dev modules + `whisper_catalog.py` + `approval.py` (Python scan), so
no cp1252 console-crash risk. Application-style `logging` would be the wrong tool for
one-shot dev ergonomics.

### `electron/setup-renderer.js` - pure display; the diagnosable trace lives in `main.js`
The wizard renderer has no `console.*` calls by design: it is a thin view over the
`setup:*` IPC. Every failure it can show - GGUF download failed, package install failed,
initial status check failed, restore-backup failed - is surfaced to the user in the DOM,
and the operation that actually failed runs in `main.js`, which logs each one via
`logSetup` with the error message and (for installs) the pip stderr tail
(`Wizard install failed`, `GGUF model download failed`, `GGUF model download blocked`).
So a 3am wizard failure is both user-visible AND recorded in the app log. The `…`
ellipses in the renderer's status strings ("Downloading…", "Checking…") are browser/
Chromium DOM text rendered as UTF-8 - the anchored 2026-07-09 browser-DOM ellipsis
decision applies, not the cp1252 console rule. `recommend-model.js` / `whisper-select.js`
are pure data transforms with no error paths. No gap.

### RESOLVED 2026-07-24 - `main.js` `setup:get-status` now logs its failure path too
This entry originally flagged that `setup:get-status` logged a status line via `logSetup`
only on its success path (was line 298, now 332); if it threw before that (e.g. `detectGPU`
raising), the renderer showed "Setup check failed" but nothing was written to the app log.
Fixed by wrapping the handler body in `try/catch` with a `logSetup('Status check failed: ...')`
call on the failure path, matching the sibling `setup:*` handlers in the same file. No longer
open; do not re-flag.

---

## Phase 4 refactor - pre-public polish (fixture/help-docs/wizard-data) (2026-07-18)

Refactor phase over the hand-written new/changed logic since baseline `6848574` (the
`001_PRE-PUBLIC_polish-pass` body): the new `yuu-dev` dev commands (`fixture-project`,
`help-docs`, `shared-data`, `typecheck`, `test-unit`/`test-integration`/`test-all`), the
`whisper_catalog.py` product list, `htmlstitch.py`, the in-app Help viewer
(`markdown.js` + `helpmodals.js`), the merged Clips+Scenes client-side kind filter
(`clips.js`/`videos.js`/`shortcuts.js`/`state.js`/`boot.js`), the centralized
`shared/escapehtml.js` + `shared/whisperlang.js`, and the wizard's catalog-data wiring
(`constants.js`/`recommend-model.js`/`setup-renderer.js`). Applied: deduped
`helpmodals.js`'s standalone `_escText` escaper into the now-canonical shared `escHtml`
(`shared/escapehtml.js`) - the escaper was centralized this same window (format.js now
re-exports it; whisperlang imports it), so the local copy was a leftover third instance.
Gate: `yuu-dev bundle` + `test-js` 226, `test-ui --changed` (help + smoke) 12 - green.
The following were reviewed and deliberately left as-is:

### `markdown.js` `inlineMd` leading `& < >` escape - kept inline, not routed through `escHtml`
Decision: Keep the inline `.replace(/&/g,...).replace(/</g,...).replace(/>/g,...)` at the
head of `inlineMd`.
Rationale: It is the first stage of a chained inline-formatting transform (escape, then
`` `code` ``/`**bold**`/`*italic*`/`[link]()`), not a standalone escaper. The shared
`escHtml` also escapes `"` -> `&quot;`; substituting it would change this function's output
string for any doc text containing a quote (visually identical when rendered, but a real
diff the guides' golden tests could pin). Below rule-of-three now that `_escText` is gone
(canonical `escHtml` + this one pipeline stage), and coupling a markdown parser's escape
step to the attribute-safe escaper buys nothing. Revisit only if a third standalone `& < >`
escaper appears.

### New `yuu-dev` dev-command modules (`fixture.py`, `helpdocs.py`, `htmlstitch.py`, `shareddata.py`, `typecheck.py`) - already well-decomposed
Decision: Keep as-is.
Rationale: Reviewed for the phase's hard rules (function length, one concern, naming, no
duplication). Each is short, single-concern, and factored around the right seam -
`fixture.py`'s `seed_project_db` is deliberately the single seed routine shared with the
integration conftest (the `with_scenes` flag is the documented divergence point, not a
behavior-flag smell); `shareddata.py`/`whisper_catalog.py` follow the established
`model_catalog.py`/`content_presets.py` frozen-dataclass + small-helpers pattern;
`tests.py`'s `_run_tiers_code`/`_run_tiers` already extract the shared tier-runner. No
high-value structural change found - further edits would be churn.

### `setup-renderer.js` `applyDefaults` (~44 lines) and `clips.js` `openClipsActionsMenu` nested ternary - kept whole
Decision: Keep as-is.
Rationale: `applyDefaults` is one concern (fill the wizard form from saved config on first
render) - a flat sequence of DOM assignments that only shares local state; splitting it
would fragment that single first-render pass across helpers for no readability gain (same
basis as the kept `transcribe_track`/`_attach_speakers` calls). `openClipsActionsMenu`'s
three-way create-item ternary (Scenes -> "New scene", Clips -> "New clip", All -> both) is
short and carries a WHY comment explaining the All-view "offer both" choice; a dispatch
table would be more machinery than three literal cases justify.

---

## ESM migration + JS-test rebalance review (2026-07-16)

Full `shqr-code-quality-review` (all 7 phases) over the 64 commits since baseline
`fffa951` - the frontend ESM migration into feature subdirs (`core/videos/clips/analyze/
settings/people/library`), the single committed `bundle.esm.js`, the new vitest
`tests/js/` tier, and the dev-CLI `bundle`/`test-js` commands. Applied changes this pass
(recorded in git, not repeated here): fixed a migration-introduced dead control in
`analyze/split.js` (the suggestion-pin click delegation was dropped in the inline->
delegation conversion; +Playwright regression test); added dev-CLI error-path tests
(`tests/unit/test_dev_cli.py`) and ported the vision cancel-wiring to a real vitest test
(`tests/js/clips/vision.test.js`), retiring the strict-xfail Playwright poke; fixed a
teardown-determinism bug in `tests/unit/test_bundle_drift.py`; hoisted a duplicated
`node_available()` probe into `dev/_base.py`; corrected two stale flat-path doc references
(`CLAUDE.md`, `GLOSSARY.md`) and trimmed two dangling merged-branch comment references.
Gate: `yuu-dev test-js` 158, `test-api` 2714, full `test-ui` 762, `lint` clean - all green.
The following were reviewed and deliberately left as-is:

### `docs/dev/ARCHITECTURE.md` verified accurate - no fixes
The new human on-ramp matches the post-ESM reality: single committed `bundle.esm.js`,
the seven feature buckets (`core/videos/clips/analyze/settings/people/library`), the
retiring residual `window.X` shim described as a shim not the architecture, and the four
test tiers (unit/integration/ui/js). No aspirational or wrong content found.

### Routes feature-map header `#   UI: static/<bucket>/foo.js` paths - verified, not changed
The bulk path update in the 24 `routes/*.py` feature-map headers was spot-checked against
Glob for every referenced module (contexts->library, settings-backup/projects/modelcatalog
->settings, split->analyze, namecorrections/speakers/voices->people, sessions->videos,
etc.). Every bucket is correct. The bare `videos.js`/`clips.js`/`reel.js` that appear
second in a prose list (e.g. `reveal.py`) are unambiguous and left as-is.

### `main.esm.js` residual-shim per-section comments, and Feature-map `·`/arrow glyphs - kept
Already anchored: the shim comments are the deferred vitest follow-on's territory (the
"residual `window.X = X` shim - kept in full" entry below), and the non-ASCII Feature-map
header glyphs are a codebase-wide comment-only convention (2026-07-10 entry below). Neither
reaches the cp1252 console. Not re-flagged.

### New dev-tooling WHY comments (`bundle.py`, `testjs.py`, `build-esm.mjs`, `tests/js/**`) - kept
These explain genuinely non-obvious constraints, not restatement: the drift guard's
byte-identical comparison needing the same output dir, Node-only-for-rebuild, invoking
vitest via `node <entry>` to dodge Windows `.cmd` shim resolution, and each `tests/js`
header's port provenance + why-vitest-not-Playwright. The one `TODO(shim-collapse)` in
`format.test.js` is tagged to the known deferred workstream with its reason, not an
ownerless aging TODO. All earn their place.

### `llm_client.available()` / `_llamacpp_capabilities` genericized their missing-file strings - path deliberately NOT re-added to the file log
Decision: Keep the missing-model strings path-free, in the returned reason **and** in the
log line that carries it (`scoring/llm.py:743` `log.warning("LLM scoring disabled: %s",
reason)`).
Rationale: The reason string renders in the UI (clip descriptions, analyze warnings, and
any screenshot), so it was deliberately changed to say "The set-up local model file is
missing - re-download it under Settings -> LLM scoring." instead of leaking the absolute
`llm_model_path` (the user's home dir). That same string is what the file logger records,
so the log no longer names the path. This is NOT a diagnosability gap and must not be
"fixed" by re-adding the path to the log: the condition itself is logged clearly (LLM scoring
disabled + the missing-file reason), the exact path lives in `config.json`
(`llm_model_path`) one file away on the single-user machine, and re-adding an absolute
home-dir path to `.yuu-clip/yuu-clip.log` would contradict the no-sensitive-paths-in-logs
rule. Verified no other site in `yuu_clip/` logs the model path. Covered by
`tests/unit/test_scoring_llm.py` + `tests/integration/test_llm.py` (which assert the
strings carry no path).

### `dev/bundle.py`, `dev/testjs.py`, `scripts/build-esm.mjs` - developer console output, not application logging
Decision: Keep the Rich `console.print` / esbuild-driver output as-is; do not add a logging
framework.
Rationale: These are `yuu-dev` developer-CLI tools. Their failure surfaces are already
clear and actionable to the developer running the command: missing Node, missing
esbuild/vitest, and a failed esbuild build each print a red, ASCII-only message naming the
fix (`npm install`, install Node), and `build_esm_bundle` embeds esbuild's captured stderr
in its `RuntimeError` so the drift guard can never pass a stale bundle silently. All new
console strings are cp1252-safe (no em-dash/emoji/box-drawing). Application-style logging
(`logging`/`_log`) would be the wrong tool for one-shot dev ergonomics.

### `main.esm.js` residual `window.X = X` shim - kept in full
**Superseded by the "Phase 4 refactor - window.X shim-drain slice (2026-07-23)" entry
above** ("GROUP 1 shim lines all verified alive; GROUP 2 kept whole - not drained"), which
re-verifies this same keep-as-is call against the current GROUP 1/GROUP 2 structure - the
per-section comment structure this entry originally described no longer exists. See that
entry for the current rationale.

### `bundle.py` uses `subprocess.run` while `testjs.py` uses `_base.run_and_tee`
Decision: Keep the two invocation styles.
Rationale: Not duplication - they need different things. `build_esm_bundle` captures
stdout/stderr so it can embed esbuild's failure detail in a `RuntimeError` (the drift
guard must never pass a stale bundle silently); `test-js` streams vitest output live and
tees it to a log via the shared `run_and_tee`. Collapsing them would lose one or the other
behavior.

---

## Post-Claude-removal review - characters / jobs-progress / transcriber seam (2026-07-15)

Scoped `shqr-code-quality-review` over `4d95f3a..HEAD` (the un-reviewed work
since the 2026-07-13 review closed: transcription backend seam, characters
feature, jobs/progress rework, dev-CLI notices/lock-deps, and the remote Claude
backend removal). Keep-as-is calls surfaced:

### `speaker_attach._attach_speakers` (~48 lines) and `whisper_runner.transcribe_track` (~76 lines) - not decomposed

Both exceed the ~30-line guideline but each is a single cohesive concern.
`_attach_speakers`'s label-collection, match/mint loop, and per-segment id
assignment share the matched/minted/without-voiceprint counters that exist only
to feed one summary log line - splitting them would pass those counters across a
seam for no readability gain. `transcribe_track`'s streaming-persist body lives
inside one Rich `Progress` context (persist segments as the backend yields them);
extracting part of it would fragment that context. **Kept whole.**

### `jobs.js` `parseProgress`/`JOB_STAGES` mirroring `pipeline/progress.py` - not deduplicated

The JS progress parser deliberately mirrors the Python `parse_progress` + stage
model across the process boundary (subprocess stdout -> browser). It cannot share
code (different runtimes) and the duplication is already coupling-guarded by
`tests/unit/test_progress_stage_coupling.py`, which greps `jobs.js` for each
Python stage id. **Kept as an intentional, test-guarded mirror**, same rationale
as the Wizard/Settings parallel stacks. (Minor: that guard matches the stage id
wrapped in single quotes; a future double-quoted reference in `jobs.js` would
false-fail. Left as-is - the convention holds today and altering a passing guard
without a reason is churn.)

### `notices.py` `_is_license_file` - tightened via extension blocklist, not a stricter name regex

The Phase 2 hunt flagged the license-name regex as able to over-match a
`license.py`-style source module. Fixed by rejecting source/binary suffixes
(`.py/.pyc/.pyi/.pyd/.so/.dll/.dylib`) rather than anchoring the name pattern
harder. Deliberate: for a licensing-notice artifact an **under-match silently
drops a real license file** (worse than a cosmetic over-match), and no genuine
license text ever carries those extensions, so a suffix blocklist is the
lower-risk guard. Covered by `TestIsLicenseFile`.

### `shared/tokens.css` `--on-warning` token - kept despite losing its last consumer

The Remote LLM badge that used `--on-warning` was deleted with the Claude
backend. The token is now unconsumed, but every theme block must define the full
token set (the theme-invariant test asserts this), so removing it from one block
would require removing it from all and could reopen a contrast pairing later.
**Kept; only its stale "Remote LLM badge" comment was removed.** (The token later moved
from `app.css` into the shared `shared/tokens.css` file - `:root`/dark/light lines
34/90/124 - when the theme tokens were centralized; still zero consumers.)

### analyze-frames job made non-cancellable (SUPERSEDED same day)

Originally resolved a wrong-cancel-copy + stuck-spinner bug by making the frame job
non-cancellable. **Superseded** within the session: the user confirmed a long vision
run on a large model over many frames is a real risk, so image analysis was reworked
to a killable subprocess (pipeline/frame_analysis.py) that POSTs to the warm
llama-server - a genuine mid-inference cancel - and the spinner leak was closed with a
caller-facing `streamSSE` onError hook plus an onCancel cleanup. This entry is kept
only so a future review knows the non-cancellable state was deliberate-then-replaced,
not an oversight.

---

## Theme G glyph sweep - close-out of the 2026-07-13 review (2026-07-14)

P2 tier of the stage-by-stage code-quality review. The review flagged lone non-ASCII
glyphs (`->` arrows, `...` ellipses, `<=`, gear) scattered across Python strings as
outliers of the project's ASCII-console convention. Decision (user-approved): a
**targeted sweep** - ASCII-fix only the glyphs in strings that can reach the cp1252
console, and leave the rest. What was swept and, more importantly, what was deliberately
kept:

### Swept (runtime strings that can reach the console)
`console.print` / `_log.*` / `print()` strings and CLI-reachable labels: the extract /
labeler / windower / whisper_runner / diarization_client / videos log lines, the
`discord-10mb` "<=10 MB" preset label, **and the LLM/diarization readiness-reason
strings** (arrows + gear in `scoring/llm.py`, `scoring/llm_client.py`,
`transcribe/diarization_client.py`). The readiness reasons were swept after confirming
they reach `console.print` via `pipeline/ingest.py:95`, `pipeline/vision_describe.py:60`,
`cli/models.py:230`, and `whisper_runner.py:610` - **not** browser-toast-only as an
earlier framing assumed. ASCII renders correctly in the browser too, so the fix is safe
on both surfaces. Live crash risk was already nil (the file logger is UTF-8 and
`console.py` wraps stdout with `errors="replace"`), so this was convention-alignment,
not a bug fix.

### Kept as-is (do not re-flag)
- **Comments and docstrings** - never reach the console (covered by the earlier
  comment-glyph decisions); includes the module/function docstring arrows and the
  `0-1` / `0.0-1.0` en-dashes in scorer docstrings.
- **LLM prompt strings** - the `<=20 words`, `0.0-1.0`, time-window `-`, and `Speaker 1,
  Speaker 2, ...` text in `scoring/llm.py` is data sent to the model, not console output
  (same basis as the kept `contexts.py` "Pokemon" prompt text).
- **`routes/llm.py` HTTPException detail strings** - browser toasts, rendered as UTF-8
  (the recorded 2026-07-10 keep still stands; these are separate literals from the
  `scoring/llm.py` reasons and are not console-bound).
- **SSE `yield "data: ..."` status strings** (`routes/scoring.py`, `videos.py`,
  `speakers.py`, `sessions.py`) - stream to the browser as JSON, rendered as UTF-8; the
  browser-DOM ellipsis decision applies.
- **`reel.py` title-card ellipsis / middle-dot** - drawn into the video via ffmpeg
  drawtext (the recorded Phase 6 keep).

Not swept this session (out of the P2 scope handed to this pass, deferred not declined):
the Stage 3 `_window_rms_db` vectorization (perf), and Theme F config-JSON tolerance
(`_sanitize_title_card_fields` type-tolerance, `contexts.py` accessor guards). (`dev/procs.py`
`parse_cim_json`'s silent `[]` on bad JSON, also originally on this list, has since been
fixed - it now catches `JSONDecodeError` and logs a warning instead of swallowing silently;
pruned here, do not re-flag.)

---

## Phase 4 refactor - YuuClip retheme + collapsible cards (2026-07-13)

Refactor phase of the code-quality review over the cyan/gold retheme (`169c8b8`) plus the
collapsible-card + declutter follow-ups (`f4377a7`, `43c8857`). Applied: extracted a single
`collapsibleCard(key, title, body, opts)` helper in `utils.js` (all 11 opt-in cards now stamp
the collapse markup contract in one place - net-negative line count); removed the dead
`.transcript-details` / `.transcript-summary` CSS the retheme orphaned when the transcript moved
from `<details>/<summary>` to a collapsible card (`#video-transcript-details` id is distinct and
stays). The following were reviewed and deliberately left as-is:

### Space-key collapse toggle load-order dependency - SUPERSEDED by the Phase 7 a11y fix
This entry originally kept a load-order dependency (the collapse header was a
`div[role="button"]` whose `preventDefault` had to run before `shortcuts.js`'s global Space
handler). The Phase 7 UX/UI follow-up (below, "Collapsible headers reworked to a native button")
replaced that structure with a real `<button class="card-toggle">`, which `shortcuts.js` already
bails on (`tagName === 'BUTTON'`). The dependency and its WHY comment no longer exist - Space is
handled natively. Recorded here so a future reader doesn't reintroduce the div-based pattern.

### Repeated `color-mix(... var(--accent) N%, transparent)` focus-ring/scrim expressions kept inline
Decision: Keep as-is (no new token).
Rationale: The retheme correctly tokenized all border-radii into `--radius`/`--radius-sm` and did
not introduce color literals. The recurring `color-mix` focus-ring/scrim expressions predate this
change set, vary by token and percentage, and each is a single contextual use - not newly
introduced duplication and below the bar for a shared token. The one new zebra
`color-mix(var(--text) 5%, ...)` is single-use.

---

## Phase 5 logging - YuuClip retheme + collapsible cards (2026-07-13)

Logging-coverage phase of the same review. Applied: wrapped the collapse-state
`localStorage.setItem` write in `utils.js` `_toggleCollapsibleCard` in try/catch with a
`console.warn` - the write was unwrapped while the matching read (`_cardCollapseState`) was
defensively wrapped, so a write failure (private mode / quota) threw uncaught out of the toggle
listener *before* the `cardtoggle` dispatch, leaving the full-video transcript card visually
expanded but never loading its body. Now the toggle + lazy-load survive a persistence failure and
it is diagnosable (once per failed toggle - not a hot path). The following were reviewed and left
silent by design:

### `copyText` surfaces clipboard failures via toast, no `execCommand` fallback
Decision: Keep as-is.
Rationale: In an insecure/unsupported context `navigator.clipboard` is undefined, but the property
access sits inside the `try`, so the resulting error is caught and shown as an error toast - no
crash, no silent swallow. The single-user app only runs on localhost / Electron where the async
clipboard API is always available (an existing WHY comment documents this). An `execCommand`
fallback would be machinery for a context this app never hits.

### `_cardCollapseState` silently returns `{}` on corrupt / unavailable stored JSON
Decision: Keep silent (no log).
Rationale: The tolerant-normalize pattern - a corrupt `yuuclip-card-collapsed` value should reset
to defaults, not error. It is read once per card render, so a log there would fire on every render
(spam) for a benign, self-healing condition.

---

## Phase 7 UX/UI - YuuClip retheme + collapsible cards (2026-07-13)

UX/UI phase of the code-quality review over the cyan/gold retheme (`169c8b8`) plus the
working-tree collapsible-card refactor (P3-P5). No code changes applied this phase - the
retheme's execution is strong and the contrast contract is fully covered by
`tests/ui/test_ui_theme.py` (every token pairing checked across the 3 themes x 2 accents).
Two items were escalated to the owner and BOTH were then resolved (see the Phase 7 follow-up
below): the reserved-gold scope (M2) was not drift - `COMPLETED.md` documents gold as
intentionally covering both funnel actions (Analyze + Export), so the stale app.css token
comment was aligned to match; and the collapsible-header nested-interactive a11y pattern (M1)
was fixed by reworking the toggle to a native button. The following were reviewed and
deliberately left as-is:

### Collapsible headers reworked to a native button; the smaller toggle target is accepted
Decision (APPLIED, with a deliberate tradeoff): the collapsible-card header no longer makes the
whole row a `div[role="button"]`. Only the title + chevron are wrapped in a real
`<button class="card-toggle">`; header action controls (Copy, kebab, Suggest names, Fix names,
Generate/Regenerate) are rendered as SIBLINGS of that button via `collapsibleCard`'s `opts.actions`.
Rationale: a `<button>` nested inside a `role="button"` is the axe `nested-interactive` / WCAG
4.1.2 violation. Making the toggle its own button removes it, and a native button also fixes the
Space-key load-order dependency for free (`shortcuts.js` bails on `tagName === 'BUTTON'`), so the
custom keydown handler and its `preventDefault` are gone. The tradeoff: the clickable toggle area
shrank from the full header row to the title+chevron. This is accepted - the title is still a
generous target, and valid ARIA + native keyboard is worth more than the extra row width for a
single-user desktop tool. `test_toggle_has_no_nested_interactive_controls`
(`tests/ui/test_ui_clips2.py`) guards against a future edit re-nesting a control inside the toggle.

### Wordmark gradient's dark end is a brand logotype, exempt from the AA text floor
Decision: Keep the `linear-gradient(100deg, var(--accent2), var(--accent))` text-clip on the
`header h1` "YuuClip" wordmark, even though the gradient's darkest stop (dark-theme `--accent`
`#0a7a9b`) computes ~3.5:1 on `--surface`.
Rationale: This is the product name / logotype, which WCAG 1.4.3 explicitly exempts from the
contrast minimum. It is also large display type, and the rule has a solid-colour fallback -
`color: var(--accent-text)` is set before the clip, so if `background-clip: text` is
unsupported the wordmark renders in `--accent-text` (a token that IS contrast-tested as text
on surface in every theme). A future pass computing the gradient's dark stop should not treat
3.5:1 as a defect here. Only re-open if the gradient is ever reused on non-logotype body text.

### Quiet muted-uppercase section/card titles are an intentional hierarchy choice
Decision: Keep `.detail-card-title` / `.sidebar-section` at `--muted` uppercase 11px.
Rationale: The small muted-caps labels are a deliberate "quiet chrome, loud content" hierarchy
signature, not an oversight - they read as section markers while the clip content and the one
gold action carry the visual weight (Von Restorff). `--muted` on `--surface`/`--bg` is
AA-contrast-tested in every theme, so legibility is guaranteed. Not a characterless-template
tell: the display face (Oxanium) on these labels is a chosen type decision.

---

## Phase 6 docs and comments - YuuClip retheme + collapsible cards (2026-07-13)

Docs-and-comments phase of the code-quality review over the just-shipped cyan/gold
retheme (`169c8b8`) plus the working-tree collapsible-card refactor (P3-P5). Applied:
fixed one CLAUDE.md drift - the color-token rule cited the score-gradient stops as
living in `utils.js`; they are in `format.js` (`_scoreBorderColor`, line ~19), which
`test_ui_theme.py` and `test_ui_globals.py` already reference correctly. The retheme
left no stale indigo/dark-dashboard or old-`<details>`-transcript comments (the dead
`.transcript-details`/`.transcript-summary` CSS and its separator comment were already
removed in P4). The following were reviewed and deliberately left as-is:

### The two glossaries are intentionally different files, not a drift
Decision: Keep both; do not try to reconcile them into one.
Rationale: `docs/dev/llm/GLOSSARY.md` is the authoritative dev superset (with `Code:` names
and dev-only sections); `yuu_clip/web/static/glossary.md` is a hand-written creator-facing
subset served by the in-app Terminology modal. The dev file's header states this split
explicitly. A `diff` of the two is expected to be large - that is by design, not
terminology drift. The static subset was verified rebrand-consistent ("YuuClip"
throughout, no stale "yuu-clip" display name) and free of banned code-name terms
(no "ingest"/"clip candidate"/"probe"/"profile"/"subtitle"/"demo reel"/"pending").

### `format.js` score-gradient hex stops and `_lerpColor` rgb() output kept as literals
Decision: Keep the hardcoded hex/rgb (already sanctioned by the CLAUDE.md color rule).
Rationale: `_scoreBorderColor`'s stop list and `_lerpColor`'s `rgb()` interpolation are a
continuous data encoding (score -> color ramp), not theme chrome, so they cannot be
expressed as discrete `var(--token)`s. This is the exact exception the color-token rule
carves out; the only fix here was pointing that rule at the right file.

### `fonts/OFL.txt` is the correct, complete OFL 1.1 for the bundled Oxanium woff2
Decision: Keep as the single license artifact; no separate NOTICE pointer needed.
Rationale: `OFL.txt` carries the full SIL Open Font License v1.1 with the correct
"Copyright 2019 The Oxanium Project Authors" header, co-located with `oxanium.woff2` in
`web/static/fonts/`. OFL condition 2 (license + copyright must accompany each copy of the
font) is satisfied by that co-location - the license file beside the font is the standard
satisfaction, so no header comment or NOTICE indirection is warranted. The app.css
`@font-face` comment already records the OFL provenance and swap procedure. OBLIGATION to
carry forward: any distribution that ships the woff2 MUST ship `OFL.txt` alongside it -
`pyproject.toml`'s `[tool.setuptools.package-data]` now globs `web/static/fonts/*`
explicitly (fixed 2026-07-13, same window), so this is satisfied in packaged builds too.

---

## Sidebar declutter - width and disclosure calls (2026-07-12)

UX pass that moved rare sidebar controls behind "More filters" `<details>` and into
per-section "..." menus. Two deliberate calls to record:

### `--sidebar-width` raised to 300px to keep the primary filter row on one line
Decision: Keep 300px (was 240px).
Rationale: The primary clip status row (All / Unreviewed / Approved / Rejected, each
with a count badge) wraps to two lines below ~295px. 300px is the measured one-line
threshold plus a small cushion. This was raised deliberately in response to a direct
user request ("keep the filter on one line"); a future pass should not "reclaim" the
width back toward 240px without re-checking that the status row still fits. Chip
padding/font were left at their Stage-0 sizes rather than shrunk, to preserve tap
targets - the width bump was the chosen lever.

### Section action menus reuse `showKebab()`, not a new dropdown
Decision: Reuse the existing `showKebab()`/`.hamburger-menu` scheme.
Rationale: The Clips and Recordings header "..." menus intentionally use the same
`ui.js showKebab()` helper as the existing clip-row and description kebabs, so there is
one dropdown/close/click-away/Escape scheme, not two. The `right:auto` fix in
`showKebab` (the fixed menu had inherited `.hamburger-menu`'s `right:0` and stretched to
the viewport edge) benefits all callers - do not special-case the sidebar menus.

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
Rationale: The `reel.py:78` ellipsis and `reel.py:124` middle-dot are *rendered into the video
title card* (ffmpeg drawtext data), not console output - changing them changes on-screen output,
not a comment. `contexts.py`'s "Pokemon" (with the accented e) is proper-noun content inside an
LLM prompt string, correct as spelled; it is data, not a comment.

### Markdown docs (`CLAUDE.md`, `FEATURES.md`, `GLOSSARY.md`) arrows/en-dashes
Decision: Keep, and match the convention when adding.
Rationale: These are rendered-as-UTF-8 docs, not console output; they use `→`, `–`, `…`
consistently throughout. New copy added this window (the Word highlight bullet) matches the
file's existing arrow style rather than fighting it. The cp1252 rule targets console/log
strings, not rendered markup.

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

**Kept as-is.** "LLM scoring" is the authoritative `docs/dev/llm/GLOSSARY.md` term,
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
`/api/capabilities/tiers` (one per capability: `_similarity_tier`,
`_descriptions_tier`, `_speaker_labels_tier`, `_audio_events_tier`,
`_vertical_framing_tier`; `llm.py:192-305`). They have the same shape - check
availability, report installed/missing, pick a status string - which looks like
a candidate for one generic `_build_tier(...)` helper.

**Kept separate.** The shared shape is coincidental, not shared knowledge: each
tier's availability check is a different backend call, the status strings and
"what this unlocks" copy are capability-specific, and the two are added to
independently (a change to how descriptions reports readiness has no reason to touch
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

**SUPERSEDED 2026-07-17.** The stage-05 no-go call was reversed: `index.html` is now the
htmlstitch build from `index.src.html` + partials (`yuu_clip/dev/htmlstitch.py`,
`tests/unit/test_index_html_drift.py`), so the "no-build SPA" rationale this entry
recorded no longer holds on any point. Kept only as a pointer so a future review does not
mistake the htmlstitch partials build for reintroducing something already rejected - it
isn't; the rejection was reversed by design.
