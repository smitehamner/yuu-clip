# Review decisions - deliberate keep-as-is calls

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` to make that explicit. It exists
> so an automated review does not re-flag something a human already decided to keep.

Code-quality reviews (`shqr-code-quality-review`) sometimes flag something that
looks like duplication or an inconsistency, and the right call is to leave it
alone. This file is the record of *why*, so a future review doesn't re-flag the
same thing without the context. Most recent first.

---

## Follow-up fixes - full-app review punch list resolved (2026-07-26)

A same-day follow-up pass worked through `REVIEW_OPEN_ITEMS.md`'s punch list from the
11-section full-app review above: fixed every genuinely low-risk/clear-cut item, got
owner decisions on the explicit human-decision items, and moved every settled
deferral out of `REVIEW_OPEN_ITEMS.md` into this file. This same pass also read this
entire file end-to-end (chunked across parallel audits, each verifying its claims
against the live repo), compressed ~4367 lines to roughly 2600 while preserving every
distinct decision, fixed a few since-resolved entries in place (marked `RESOLVED`/
`SUPERSEDED` inline where you see them below), and fixed `REVIEW_MAP.md` drift
(`scorer_set.py`, `web/jobevents.py`, `web/security.py` were reviewed but never added
to the stage partition). `yuu-dev lint`/`typecheck`(`new: 0`)/`test-api` (3536 passed)/
`test-js` (730 passed)/electron `npm test` (206 passed, 1 opt-in skip) all green.

### Fixed
- **`pipeline/ingest.py::_parse_srt`** - a non-3-digit SRT fraction group (malformed/
  non-standard input) was treated as literal milliseconds regardless of digit count;
  now scaled correctly (pad/truncate to 3 digits).
- **`pipeline/ingest.py`'s transcribe progress pill** - a `do_transcribe` track with no
  `extracted_path` was counted in `transcribe_total` but never in `transcribe_done`, so
  the pill could stall short of "N/N"; now counted on both sides.
- **`analyze/labeler.py::_apply_profile`** - an out-of-range `stream_position` in a
  hand-corrupted `profiles.json` (matching `num_tracks` but not a valid index) raised
  `IndexError`; now falls back to `None` like every other corrupt-profile case.
- **`transcribe/speaker_attach.py::diarize_track`** - removed the dead-code
  `config.diarization_backend != "null"` guard around the skip-log
  (`NullDiarizationClient.available()` always returns `ok=True`, so the guard was
  always true whenever reached).
- **`scoring/llm.py`** - `describe_clip`/`summarize_transcript`/`summarize_session`
  now validate `isinstance(dict)` before calling `.get()` on the parsed reply (a
  wrong-shape response now raises a clean `ValueError`, not `AttributeError`).
  `find_related_clips` now skips a malformed individual item and keeps the rest,
  matching sibling parsers `request_scene_boundaries`/`scan_hotwords_semantic`,
  instead of discarding the whole batch on one bad item - **owner decision**, resolves
  the "two known parse-robustness gaps remain human-decision items" note below.
- **`export/render.py::_write_subtitle_tmp`** / **`reel.py::compile_demo`** - both now
  clean up their partial output (temp file / reel destination) if the write/encode step
  raises mid-way, instead of leaking a temp file or leaving a truncated file at the
  final path. Added an exact-boundary test pinning `extract.py::_verify_export_duration`'s
  tolerance cutoff (previously only tested comfortably inside/outside the boundary).
- **`project_archive.py::build_backup`** - was writing the zip directly to `dest_path`;
  now builds to a sibling `.tmp` file and swaps it in with `os.replace`, so an
  interrupted backup can't leave a corrupt/partial archive at the final path.
- **`cli/models.py::_verify_complete`** - skipped size verification entirely when the
  server sent no `Content-Length` (`total=0`), so a truncated zero-byte download could
  be promoted to the final path. Now rejects an empty file even without a known total;
  a nonempty file with no `Content-Length` still passes (can't verify size without one).
- **`web/static/clips/clipbulk.js::_doBulkExportClips`** - its `onDone` ignored the
  `outcome` and always showed the success toast; now branches on `outcome`, matching
  the ~9 other job-starter call sites (was a latent risk, not currently reachable since
  this job runs non-cancellable).
- **Owner decision - atomic writes for the small JSON config files.** Extracted
  `yuu_clip/atomicwrite.py` (`atomic_write_text` via temp-file + `os.replace`;
  `read_json_object_or_backup_corrupt` to preserve a hand-broken file's bytes before an
  overlay-write overwrites it) and wired it into `config.py`'s `_overlay_layer`,
  `contexts.py`'s `save_contexts`, and `track_labels.py`'s `_write_profiles` - extends
  `project_archive.py`'s restore-path integrity guarantee (never leave a half-written
  file) to these frequently-rewritten files too. Resolves the "atomic-write question
  for track_labels.py" note left open below.
- **Owner decision - `electron/main.js` single-instance lock.** Added
  `app.requestSingleInstanceLock()` (quits immediately on failure, before any startup
  work) plus a `second-instance` handler that focuses the existing window - resolves
  the Phase 2 bug-hunt deferral below (two near-simultaneous first-run launches could
  race the venv extraction into `VENV_DIR/.incoming`).

### Corrected while auditing this file (facts that had gone stale)
- **`settings-installs.js`'s "no `tests/js/` counterpart" claim (Section 9 Phase 6)
  was simply wrong when written**, not stale-since: `tests/js/settings/settingsinstalls.test.js`
  was added in commit `bc94c23` (2026-07-19), a week *before* that Phase 6 pass. It
  covers install/uninstall success/failure via `_refreshInstallStatus`/
  `installPackage`/`uninstallPackage`. No further doc-gap action needed - flagged here
  so the correction has a record.
- Several `##`/`###` entries below cite line numbers that have since drifted by a few
  lines (normal file growth) without the underlying claim changing - not individually
  re-flagged; the file/function/behavior itself was re-verified current in every case.

### Deferred (Low) - moved here from `REVIEW_OPEN_ITEMS.md`, settled with a revisit trigger
- **`web/static/videos/sessions.js::_promptText`/`_showSuggestionModal`** sit outside
  the boot-time modal-a11y stamping + single document-level focus trap (Tab can reach
  background controls; focus isn't returned to the opener). Usable (`role="dialog"`/
  `aria-modal`, labelled input, autofocus, Enter/Escape). Deferred: mouse-first
  single-user desktop tool, and a clean fix wants a shared runtime-modal-trap helper
  rather than a per-modal patch. Revisit trigger: a keyboard-only/AT user needs to
  create/rename a session, or a shared runtime-modal helper lands for another reason.
- **`web/static/analyze/split.js::_doSplitAndReanalyze`**'s per-segment clip-clear
  failure toast names a raw internal segment id (unmappable to a visible label) on a
  rare DB-write failure mid-split. Deferred as Low. Revisit: copy sibling
  `_segmentChainAbortMessage`'s 1-based-index pattern if this is ever revisited.
- **`web/static/analyze/analyze.js::_streamAnalyzeEvents`**'s `onDone` ignores the
  typed `outcome` and always shows the success toast + sound, unlike its ~8 sibling
  job starters. Left as-is: not currently reachable (a frontend analyze-cancel aborts
  the fetch via `_supersedeActiveStream()` before `onDone` fires with `cancelled`).
  Latent false-success risk flagged if the analyze-cancel path ever changes to keep the
  stream open.
- **`web/static/analyze/split.js`**'s one hardcoded hex fallback `'#6c8ebf'` for a
  canvas `fillStyle` (canvas can't consume a CSS `var()`), reached only if `--accent`
  resolves empty (never in practice). Same class of allowed exception as `format.js`'s
  score-gradient stops. Left as-is - defensive-only, changing it risks nothing
  meaningful.
- **Project-switcher menu / Backup / Restore buttons** aren't tagged
  `data-job-blocked` (the busy case IS handled - backend 409 + clear error toast - but
  the project's convention prefers a disabled control with a why-tooltip over a
  click-then-409). Deferred: rare deliberate actions, uses a manual busy-check rather
  than the `reject_if_busy` machinery the attribute keys off. Revisit trigger: a user
  reports mid-analysis switch confusion.
- **`<select>`-triggered merge confirm** (voices/speakers "Merge in.../Merge into..."
  dropdowns) - selecting a value immediately triggers a merge confirm dialog (a WCAG
  3.2.2 "change of context on select" nuance). Mitigated by a placeholder + aria-label
  and gated behind a confirm dialog; settled app-wide pattern on a pointer-first
  single-user desktop tool. Note-only, not a real defect.
- **Tab-bar view switchers** (Highlight Reels Build/View tabs and a few in-modal view
  switchers) signal the active view with a `.active` CSS class only, not
  `role=tab`/`aria-selected`, unlike the sidebar filter chips (`aria-pressed`). Minor
  a11y polish, not a defect - visible active state is clear. Revisit trigger: a broader
  tablist a11y pass, or an AT user reporting confusion.
- **Frameless boot/setup windows' minimize control** is a `<div>`+onclick, not a
  focusable `<button>` (no keyboard minimize). Consistent with the accepted
  pointer-only-input call for a mouse-first desktop tool; these are transient windows.
- **The in-wizard GGUF download** (Advanced-disclosure "download now" path) has no
  stall watchdog or speed/ETA, unlike the venv-setup window's watchdog - still shows a
  moving %/GB bar + Cancel. Adding a watchdog/ETA would be a feature addition, not a
  bug fix.
- **Cosmetic:** `working...` / `elapsed 0:00` micro-labels are lowercase where the rest
  of the app title-cases. Not worth the churn on its own.

### Deferred (engineering call, not a product/UX decision)
- **`db/models.py`** - no explicit index on several frequently-joined FKs
  (`Video.session_id`, `Video.parent_video_id`, `ClipCandidate.video_id`,
  `TranscriptSegment.transcript_id`/`speaker_id`, `Speaker.video_id`). Left unfixed:
  this is a real single-user local SQLite app at a scale (hundreds to low thousands of
  rows per table) where a missing index has no observed or plausible practical impact,
  and adding one means an Alembic migration touching every existing user's DB - a much
  higher blast radius than the other fixes in this pass for a purely speculative
  performance gain. Revisit only if a real performance complaint ever surfaces.
- **`yuu_clip/sessions.py::suggest_session_groups`** - a group's running end uses the
  last-added recording's end rather than the max end so far; only misbehaves if two
  recordings overlap in wall-clock time, which doesn't happen in this app's
  single-user sequential-OBS domain. Not a real bug in practice; fixing it would be
  speculative.

### Still open - needs an explicit human/product decision (see `REVIEW_OPEN_ITEMS.md`)
Left in `REVIEW_OPEN_ITEMS.md`, not here, because nobody has decided yet:
`thermal.py`'s pause-streak re-arm edge case, `scoring/routes.py::_rescore_video_clips`
stamping provenance on a 100%-failed batch, `core/utils.js::appendLog`'s bare-substring
`'error'` styling heuristic, and whether `TestThermalPollLoopIntegration`'s wall-clock
timing tests should become clock-injectable.

---

## Phase 7 UX/UI - full-app review section 11, Electron wrapper first-run surface (2026-07-26)

First UX/UI walk of the desktop-native first-run surface: setup wizard (`setup.html` +
`setup-renderer.js`), the venv/prebuilt-env setup window and "Starting YuuClip" loading
window (`main.js` boot HTML), the native install/error/fatal dialogs, and `install-error.js`'s
plain-English failure mapping. Prior UX passes (2026-07-08/23) never walked the
install/loading/boot screens.

### Applied
Added `lang="en"` to `main.js`'s two generated boot-window HTML docs (`loadingScreenUrl`,
`showVenvSetupWindow`) - a WCAG 3.1.1 gap on the first windows a new user sees. (Unrelated
to the anchored "boot HTML colour literals are out of scope" call - that's about colour.)

### Verified good, do NOT re-flag - this surface is exemplary first-run UX
- **Progress feedback**: venv window has a determinate pip bar with high-water-mark
  (never regresses) + a 3.5s stall watchdog that falls back to indeterminate, live elapsed
  timer, antivirus-scan-slowdown copy; GGUF download shows determinate `X% (Y.Y of Z GB)`.
- **Error quality**: every install/download failure routes through `install-error.js`'s
  `describeInstallFailure`/`describeDownloadFailure` (plain-English by failure class); raw
  stderr is logged, never shown. Fatal dialog is a dead-end-free "Try again / Open log
  folder / Quit". No-GPU degrades to a calm CPU-mode line.
- **Informed consent for the multi-GB download**: recommended path downloads in the
  background after launch; the in-wizard manual download is under an Advanced disclosure
  with a size heads-up. Lightweight mode is a first-class alternative, not confirmshamed.
- **Recoverability**: quit-mid-download confirms first; failed restore resets the button;
  "Check again"/"Restart app" recover from out-of-band installs.
- **Colour-not-alone + contrast**: wizard status rows pair icon + colour + text. Boot
  windows' hardcoded palette (`#9090a8`/`#87879f` text on `#12121e`, accent `#5b8ef0`) all
  clear WCAG AA (>=5:1) despite being out of scope for the colour-token rule.

### Low, deferred (note only)
- Frameless boot/setup windows' minimize control is a `<div>` onclick, not a focusable
  `<button>` - no keyboard path. Consistent with the anchored "pointer-only OK for a
  mouse-first single-user desktop tool" call (Low 29, 2026-07-23); do not re-flag without
  an actual AT-user need.
- In-wizard GGUF download has no stall watchdog/ETA like the venv window (it does have a
  moving bar + Cancel, clearing the "active indicator" floor) - feature-add, deferred.
- Venv window's lowercase `working...`/`elapsed 0:00` micro-labels vs. the app's usual
  title-case - cosmetic, not worth a churn edit.

### Wizard scope is LOCKED minimum-viable - not a UX finding
Per the ARCH-policy entry below + CLAUDE.md, the wizard deliberately configures ONE text
model + writes config.json, nothing more. This pass judged execution quality of that
minimal flow (good), not whether it should do more - do not raise "should also configure X".

---

## Phase 6 docs and comments - full-app review section 11, Electron wrapper (2026-07-26)

Read every comment across all 25 in-scope files (main.js + every split-out helper) against
the governing rule. No restatement/obsolete/reactive comments, no aging TODO/FIXME/HACK.
Zero changes - Phase 4's "already exemplary" call holds through the docs lens too. Spot
verified: `logging.js` `redactPaths()`'s WHY comment (Phase 2 fix) already covers the fix
rationale in full; `main.js` `wireVenvMinimize()` (Phase 4 extraction) has its own WHY
comment (the non-obvious single-global-IPC-channel invariant); Phase 5's two new log lines
correctly carry no comment (self-explanatory, or the WHY already sits alongside).

### Terminology check (first pass over electron/ vs GLOSSARY.md)
Clean - no drift in any user-facing string this scope builds (wizard status text, dialog
titles/messages, `install-error.js` sentences). No banned term (`ingest`/`probe`/`profile`/
`RP context`/`clip candidate`/`demo reel`/`subtitle`/`segmentation`/`provenance`) appears as
user-facing text; textual hits are code identifiers or non-user-facing prose.

### Reviewed and deliberately left as-is (do NOT re-flag without new evidence)
- **Curly apostrophes/real ellipsis throughout Electron-rendered text**: extends the
  2026-07-09 "ellipsis in browser DOM text is fine" decision - every string here renders
  inside a Chromium `BrowserWindow` or a native OS dialog, never the legacy Windows console
  (the actual crash mode), so the cp1252 rule doesn't apply.
- **`main.js`'s two literal `working...` strings** (~lines 789/810, venv-setup loading
  screen): the one stray ASCII-dots outlier vs. the real-ellipsis convention used
  elsewhere in scope - same "harmless, not worth a one-off style fix" category as the
  precedent's `modelcatalog.js` call.

## Phase 5 logging coverage - full-app review section 11, Electron wrapper (2026-07-26)

Surveyed logging across all 25 files. Architecture: the 23 pure helper modules never call
`logSetup` themselves - `main.js` alone catches and logs each helper's thrown
error/rejection. Both gaps found were at that main.js boundary.

### Fixed
- `main.js` `runRestore()` logged only the exit code on failure, never `parseRestoreExit`'s
  actual detail (the Python restore CLI's stderr - exactly what the dialog shows the user),
  so a "restore failed" bug report carried nothing diagnostic. Now logs the parsed error
  (last 3 stderr lines), distinguishes the `project_exists` retry code from a genuine
  failure, and logs the previously-silent `proc.on('error', ...)` spawn-failure path (e.g.
  a moved/missing venv python.exe). Covered by `electron/test/restore-backup.test.js`.
- `main.js` `killBackendTree()` (every shutdown path incl. `process.on('exit')`) silently
  dropped the case where BOTH `taskkill /T` and the `pyProc.kill()` fallback throw - exactly
  the orphaned-`python.exe` scenario the 2026-07-25 VM finding that added this function was
  chasing. The common case (taskkill exits non-zero, tree already gone) stays silent by
  design; only the genuine double-failure now logs. Covered by
  `electron/test/kill-backend-tree.test.js`.

### Reviewed and deliberately left as-is (do NOT re-flag without new evidence)
- **`pip-progress.js`/`install.js`'s pip line handlers**: no spam risk - per-line callback
  only sends deduped IPC status, never logs; caller logs the full stdout/stderr once on
  failure. Right tradeoff already in place.
- **`electron-config.js` `loadElectronConfig()`'s corrupt-JSON-to-`{}` fallback**: left
  unlogged. The module is deliberately Electron-free pure I/O; the corruption path needs a
  crash mid-write with no atomic write (a separate bug-hunt-shaped concern); `main.js`
  already logs the resulting `Project dir: ${projectDir}` unconditionally, so the *effect*
  is traceable even though the *cause* isn't. Revisit only on a real corrupted-config report.
- **`registry-path.js`'s per-hive `try/catch` around `reg query`**: left silent - a missing
  `HKCU`/`HKLM` `Path` value is the common case, not an error; logging it would spam the
  setup log on every "Check again"/restart.
- **Python-subprocess-crash logging**: already sufficient - every `pyProc` stdout/stderr
  line streams to the log continuously (`[backend]` prefix), so the exit line always has
  the real stderr immediately above it; no separate "stderr tail" needed.

## Phase 4 refactor for quality - full-app review section 11, Electron wrapper (2026-07-26)

Structural survey of all 25 files. Directory already exemplary: 23 small single-concern
helpers + one orchestrator (`main.js`, 1563 lines at the time). One genuine refactor landed.

### Refactored
- `main.js`: extracted `wireVenvMinimize(win)` - the identical 4-line frameless-window
  minimize wiring was duplicated verbatim in `showStartupLoadingWindow` and
  `showVenvSetupWindow`. Encodes one non-obvious invariant (single global channel rebound
  to the current window, torn down on close), so a helper is the right home. The
  `ipcMain.on('venv:minimize'` literal was preserved so `venv-preload.test.js`'s
  source-text assertion still passes.

### Reviewed and deliberately left as-is (do NOT re-flag without new evidence)
- **`showSetupWizard` (~132 lines, largest function)**: kept inline - a Promise executor
  whose five `ipcMain.once` handlers all share `resolve`/`reject`/`win`/`mode`/`rerun`
  through the closure; extracting any handler would force threading that state out as
  parameters for a net legibility loss.
- **The three preload files**: kept separate - each exposes a genuinely distinct bridge
  (`electronAPI`/`venvAPI`/`setupAPI`) with different channels for a different window; no
  shared knowledge, the single `exposeInMainWorld` line each is irreducible.
- **`try { <webContents>.send(...) } catch {}` "safe-send" idiom (~8 sites)**: kept - each
  already sits in a locally-named closure with a different payload/channel; a generic
  `safeSend()` would add cross-cutting churn to the boot path for a one-line-each gain. The
  one true duplicate pair (`progress` closures in `runPrebuiltEnvSetup`/`runPipVenvSetup`)
  is rule-of-two, left alone.
- **`setup:pick-folder` vs `project:pick-folder`**: kept separate - different target window
  and IPC-registration lifecycle; coincidental similarity only.
- **`gpu-detect.js`/`recommend-model.js` thresholds vs the Python side**: no cross-language
  drift - these are wizard-only recommendation heuristics; the recommended *model* comes
  from the generated `shared/catalog-data.json` anti-drift seam, not a hand-copied literal.
- **Inline boot-splash HTML colour literals**: out of scope for the no-hardcoded-colour
  rule, which is scoped to `static/*` and the wizard `<style>` (enforced by
  `test_static_theme_colors.py`); these are throwaway main-process data:-URL splashes.

## Phase 3 test coverage - full-app review section 11, Electron wrapper (2026-07-26)

Closed the Phase 1 gap: `electron-config.js`, `preload.js`, `venv-preload.js` had no
dedicated test file. Added 4 new test files.

- `electron-config.js` is plain `fs`/`path`, no Electron import - directly `require`-able.
  `test/electron-config.test.js`: real fs I/O against a temp `APPDATA` dir, covering
  `loadElectronConfig` (missing file, corrupt JSON -> `{}`), `saveElectronConfig`
  (create/merge/overwrite), `writeProjectConfig` (create/merge/overwrite/corrupt-restart).
- `preload.js`/`venv-preload.js` need a live Electron process for `require('electron')` to
  resolve, so can't be `require`-d under `node --test` (confirmed by reading them - both are
  zero-logic `contextBridge.exposeInMainWorld` forwarders). Followed the project's existing
  `restore-backup.test.js` pattern: `test/preload.test.js`/`test/venv-preload.test.js`
  regex-assert against the preload source AND cross-check `main.js`'s source for the
  matching `ipcMain.on`/`.handle`/`webContents.send`, so a dropped/renamed IPC channel on
  either side breaks a test.
- Given the Phase 2 `redactPaths()` bug, audited the rest of `logging.js`/`install-error.js`
  for other privacy-sensitive logic. None in `install-error.js` (classifies stderr text into
  hints, no redaction; raw message is logged by the caller only). `logging.js`'s
  `rotateLogs`/`logSetup` had no test file (only `redactPaths` was covered) - added
  `test/logging.test.js`: ring-buffer rotation, BOM-on-fresh-log, append-not-overwrite, and
  an integration test pinning that `logSetup` actually runs messages through `redactPaths`.

## Phase 2 bug hunt - full-app review section 11, Electron wrapper (2026-07-26)

Read all 25 files with the bug-hunt categories in mind. Process-management/path-safety code
is already hardened (atomic `.incoming` extract + version-marker gating, `taskkill /T`
tree-kill, AbortController download-cancel, http/https-guarded `openExternal`,
contextIsolation preloads, `--n-gpu-layers` never hardcoded).

### Fixed
- `logging.js` `redactPaths()` excluded whitespace from the username char class, so a
  Windows profile folder with a space (`C:\Users\John Doe\...`) redacted only to
  `C:\Users\<user> Doe\...`, leaking the surname. Changed the segment to run to the next
  path separator (still terminated by `\r\n` so it can't swallow a following log line).
  Locked in by three new cases in `test/log-redact.test.js`.

### RESOLVED (was: deferred, needs human decision)
No `app.requestSingleInstanceLock()` in `main.js` was originally flagged here as a
lifecycle-design call needing a human decision (two rapid first-run launches could race
`ensureVenv()`'s `.incoming` extraction). **Since implemented** (`main.js` line ~9,
commit `001c6f5`, "feat: add app.requestSingleInstanceLock() to electron/main.js"): a
failed lock quits immediately before any startup work; the `second-instance` handler
focuses the existing window instead of racing a duplicate launch. Locked in by
`electron/test/single-instance-lock.test.js`. Do not re-flag.

### Verified good, do NOT re-flag
- `media-serve.js` path-traversal guard (`isPathInside` via `path.relative`) + main.js's
  allowlist is the intended two-tier check; `parseRange` returning 416 for an
  over-large suffix range is a deliberate, low-stakes deviation (`<video>` never emits it).
- `restore-backup.js` validates via the Python restore CLI's exit codes (2 = project exists
  -> "Replace" with a pre-restore DB safety copy) before any live overwrite; it never itself
  mutates the install, so the validate-before-mutate bug class doesn't apply.
- `install.js` `downloadFileWithProgress` closes the write stream before unlinking `.part`
  on every failure path (Windows EPERM landmine), caps redirects, checks content-length
  truncation - resource-leak-clean on the exception path.

## Phase 1 test integrity - full-app review section 11, Electron wrapper (2026-07-26)

### Verified good, do NOT re-flag - `electron/test/*.js` suite is clean, no changes made
All test names read as behavior sentences, boundary conditions are tested explicitly
(VRAM/disk thresholds, range-header edges), stubs are minimal (swap only the real OS/process
call), no snapshot testing/sleep-based timing/hidden coupling/tautological mocks.

Two things worth recording so a later pass doesn't re-decide them:
- `main.js` cannot be `require()`d directly (needs the Electron runtime), so
  `restore-backup.test.js`, `rerun-reload.test.js`, `startup-loading-status.test.js` assert
  against `main.js`'s source text instead of calling exported functions - a deliberate,
  consistently-applied pattern for this one file, keep it.
- `electron-config.js`, `preload.js`, `venv-preload.js` had no dedicated test file at the
  time - a coverage gap (not a test-integrity defect), closed by Phase 3 above.

---

## Phase 7 UX/UI - full-app review section 10, app shell & core plumbing (2026-07-26)

[Note: this section header is missing/malformed in the source doc at this point - the
content below sits between "Phase 1 test integrity - section 11" and "Phase 6 docs -
section 10" with no `##` header of its own. Inferred and inserted here for structural
consistency; verify against source history if the original title differs.]

UX/UI walk over the shared app chrome every screen renders inside: header/nav, sidebar, all
22 modals + shared confirm/alert pattern, toast/job-pill feedback, keyboard shortcuts,
getting-started onboarding, help/glossary/about, theming, and core JS plumbing (`boot.js`
a11y stamping, `ui.js` `showConfirm`/`showAlert`, `shortcuts.js`). Anchored against the
2026-07-23/24 full-surface UX review (11 HIGH/~24 MEDIUM/~29 LOW all settled) and the
YuuClip-retheme Phase 7 - looked for genuine drift/gaps those didn't cover, not
re-derivation. Shared chrome is high quality: single document-level focus trap + boot-time
`role=dialog`/`aria-modal`/`aria-labelledby` stamping, Cancel-left/verb-primary-right order,
universal `:focus-visible` + `prefers-reduced-motion`, `#sr-live-*` mirrors. Two fixes
applied; rest verified good or Low/note-only.

### Applied: `auto-approve.html` used raw emoji where every other partial uses numeric entities
The score-type `<select>` rendered its five axis glyphs as literal emoji - the ONLY partial
doing so (verified by grep over `partials/`), drifting from CLAUDE.md's "plain ASCII in
authored text" convention. Aligned to the same numeric entities the sidebar `clips-sort`
list uses (`&#128514;`/`&#127917;`/`&#9876;&#65039;`/`&#127916;`/`&#129315;`).

### Applied: `field-edit.html` `<textarea>` had no accessible name (WCAG 4.1.2)
The Field Edit modal's free-text field had no `<label>`/`aria-label`/placeholder - a screen
reader announced just "edit, multi-line, blank". Added
`aria-labelledby="field-edit-title"` so the field carries the modal's dynamic title as its
name.

### Verified good, do NOT re-flag - getting-started is a strong non-dev first-run surface
Auto-opens once (localStorage gate), focuses the top-right X (deliberate - focusing a
bottom control scrolled the tall modal open at the bottom), top banner is state-driven off
`/api/capabilities/tiers` + `/api/llm/download-status` so a user who's already set up isn't
told to again. No bottom Close/CTA is by design (2026-07-23 Low 13 removed it from all five
info modals).

### Verified good, do NOT re-flag - help/glossary modals are clear and offline-safe
Help & Guides always lands on Overview (fixed 2026-07-25, no longer reopens on last-viewed),
renders bundled `static/help/*.md` in-app (offline-safe), per-doc "View online" escape
hatch, plain-English load-failure state. Glossary has a live filter with an empty state and
`aria-label`led search. Both close via X/Escape/background-click with focus-return.

### Verified good, do NOT re-flag - modal form copy is exemplary plain-English for a non-dev
Spot-checked export-settings/batch-export/context-manager/retranscribe/highlight-reels/
profile-manager: caption options explain the tradeoff in plain English, destructive actions
sit under a labelled "Danger zone", inline validation uses `role="alert"` +
`aria-describedby`, job-launching confirms all carry `data-job-blocked`. Nothing to add.

### Low, note-only - view-switch tab buttons use `.active` class, not `role=tab`/`aria-selected`
The Highlight Reels Build/View tab bar and similar in-modal switchers signal active state
via CSS class only, unlike the sidebar filter chips' `aria-pressed`. Minor a11y polish, not
a defect - visible state is clear and these are pointer-first controls. Deferred; revisit on
a broader tablist a11y pass or an actual AT-user report.

---

## Phase 6 docs and comments - full-app review section 10, app shell & core plumbing (2026-07-26)

Grep-first survey of every comment + Feature-map header across HIGH scope (`static/core/*.js`,
`static/shared/{escapehtml,whisperlang}.js`, `main.esm.js`) plus MEDIUM `library/colorpicker.js`,
`routes/common.py`, `app.css`, `shared/tokens.css`, plus a lighter LOW HTML/glossary pass. Zero
TODO/FIXME/XXX/HACK in scope; comment quality itself already clean (per Phases 1-5). Real
findings were factual drift: one stale CLAUDE.md paragraph, two Feature-map `API:` omissions,
and two "AI scoring"/"AI scorer" self-contradictions inside GLOSSARY.md's own no-that-phrase rule.

### Fixed: `CLAUDE.md`'s jobs.js/format.js "9 `window.*` reads" paragraph was stale
The frontend-build section (added 2026-07-21) claimed `core/jobs.js` "keeps 9 `window.*`
reads" as the one exception to direct cross-module imports (breaking vitest's
`vi.mock`/`importActual`). But the ui-shim-retirement plan's Phase 2 (2026-07-25, `67a106b`)
replaced that mechanism: `jobs.js` now has zero `window.*` reads and instead imports
`refreshHooks` from `core/refreshhooks.js`'s registry. Rewrote the CLAUDE.md paragraph to
name that registry seam instead. NOTE: the Phase 4 refactor entry below ("jobs.js's 9
window.* reads are the documented vi.mock exception") repeats the same now-corrected claim -
left as a historical record; this entry supersedes it.

### Fixed: two Feature-map header `API:` lines were incomplete/wrong (same drift class as Sections 8/9)
`core/helpmodals.js`'s header cited only "routes/config.py (glossary)" - `/api/glossary` is
actually served by `routes/logs.py`, and `routes/llm.py` (capability tiers, download status)
was omitted entirely despite being fetched by `_renderGettingStartedBanner`. Fixed to
"routes/logs.py (glossary), routes/llm.py (capability tiers, download status)".
`core/utils.js`'s header cited only "routes/config.py, routes/logs.py (indirectly)" but also
fetches `/api/install/{slug}` (routes/analyze.py) and `/api/reveal` (its own routes/reveal.py,
backing the file's own "reveal in folder" feature). Added both.

### Fixed: `GLOSSARY.md` contradicted its own "do not call it AI scoring" rule in two spots
The `LLM Scoring` entry bans "AI scoring" as a term, but the file's own `World Context` entry
described "the AI scorer" and the Disambiguation `Model` row glossed the LLM model as "AI
scoring model (LLM)" - both are the banned phrase inside the file that owns the ban. Fixed to
"LLM scorer" / "LLM scoring model (LLM)" / "LLM model", plus a third instance at
`Speech-to-Text Model`'s "Do not call it" line. Left `Session Summary`/`Session Timeline`'s
"AI-generated" phrasing alone - describes a generation feature, not the scoring feature the
ban targets.

### Verified clean, no drift found - GLOSSARY.md vs static/glossary.md term-by-term
Spot-checked every shared term (Recording Segment/Split, Track Layout, World Context, Clip,
Clip Status, Highlight Reel, LLM Scoring) post the Section 1-9 terminology fixes. All current
and matching; the 2026-07-13 "intentionally different files" decision still holds (differ in
scope/depth by design, not terminology). `static/glossary.md` re-verified free of every
banned code-name term.

### Verified clean, no fix needed
- `renderInlineMarkdown()`'s doc comment already states the WHY (shared knowledge between the
  doc viewer and glossary renderer) concisely.
- Phase 5's four new `console.error`/`console.warn` calls (jobs.js/boot.js) are
  self-explanatory one-liners matching the file's existing convention - no comment needed.
- `partials/modals/profile-manager.html`'s "Profile" naming (filename/DOM ids) vs. its
  rendered "Track Layouts"/"Track Layout" UI text is the documented Code/UI-label split
  (glossary: `Code: profile`), not drift.

---

## Phase 5 logging coverage - full-app review section 10, app shell & core plumbing (2026-07-26)

Grepped every `console.`/`try`/`catch` in the HIGH scope (`static/core/*.js`,
`static/shared/*.js`, `main.esm.js`) plus MEDIUM `library/colorpicker.js`/`routes/common.py`,
read each catch site for whether a swallowed exception would ever reach a developer (console
or `errorreporter.js`'s global `window.onerror`/`unhandledrejection`). Two real gaps fixed;
rest confirmed deliberate/already-visible.

### Fixed: `core/jobs.js::_openSSE`'s two catch blocks swallowed the real error
The SSE read-loop catch reported every failure - malformed JSON, a `decodeEvent` bug, or an
exception in a consumer-supplied callback - as the same generic "Connection lost", with zero
trace of `err`. Since the exception is caught here it never reaches `errorreporter.js`'s
global handler either, so a genuine JS bug mid-stream looked like a network blip with no way
to find the real cause. Same issue on the outer `fetch()` `.catch`. Added `console.error(err)`
in both before calling `onError` - user-facing behavior unchanged.

### Fixed: `core/boot.js`'s three `refreshServerState()` catches + the initial `/api/status` fetch's silent catch
These had comments explaining the fallback but no `console.warn` - a real backend bug would
be invisible, and for the initial fetch specifically, a failure means an in-progress analysis
silently fails to reattach after a refresh with no signal. Not hot-loop polls (fires ~6x
across the app, user-action/boot-triggered only), so a warn per failure isn't spam - added
one to each of the four catches, matching the existing `utils.js::_toggleCollapsibleCard`
convention.

### Not a gap (confirmed): `core/panelnav.js`'s `render(container)` call has no try/catch
Traced the call chain (`panelNavOpen` -> `closeSettings` -> `_doPanelNavOpen` -> `render`):
always a synchronous DOM-event call chain, never deferred through an unguarded promise. A
throw propagates to the browser's dispatch and fires `window.onerror`, already caught by
`errorreporter.js` (wired first in `boot.js`). No try/catch needed - matches the
"global handler is the backstop" pattern already confirmed in Sections 8/9.

### Not a gap (confirmed): periodic-poll/low-stakes silent catches
`jobs.js`'s `_pollThermalStatus`/`_waitWhileAnalyzePaused` and `utils.js::_diarizationReadiness`
are 3-5s polls or a low-stakes checkbox default - logging every failed poll would itself be
log spam, and the next tick self-heals. Matches the project's established pattern
(`helpmodals.js`/`preview.js`/`colorpicker.js` catches - all either show a visible fallback
or guard a self-correcting best-effort path).

### Not a gap (confirmed): `routes/common.py` has adequate logging
`reject_if_busy`/`with_write_retry` already log at `info`; every other function either has no
failure path worth logging or propagates for the caller/route to handle.

---

## Phase 4 refactor - full-app review section 10, app shell & core plumbing (2026-07-26)

Structural survey (line counts/function-length/duplication heat map) over
`static/core/*.js`, `static/shared/*.js`, `main.esm.js`, `library/colorpicker.js`,
`routes/common.py` - the last web-layer section, so also swept for cross-cutting duplication
now visible across this file's full history. Two changes applied; rest reviewed and left as-is.

### Applied (assigned Phase-2 carry-forward): `core/ui.js::_applyPrereqWarnings` inline `onclick=` -> `addEventListener`
The FFmpeg/LLM prerequisite banner built its "Re-run Setup Wizard" link with an inline
`onclick=` string (constant-only, no injection risk, but a deviation from the project's hard
"event delegation, never inline onclick=" rule). Converted via a new
`_showPrereqBanner(banner, html)` helper that wires the click via `addEventListener`. Pinned
by `tests/js/core/ui.test.js`. The `style="color:var(--warning)"` stays (a theme token).

### Applied (cross-section DRY): inline-markdown escaper extracted from `helpmodals.js` into `markdown.js`
`markdown.js`'s `inlineMd` and `helpmodals.js`'s `_renderGlossaryMd` each carried the
byte-identical escape+emphasis chain - shared *knowledge* (the inline-markdown subset the
app supports), not coincidence. Extracted `renderInlineMarkdown(text)` (exported from
`markdown.js`); `inlineMd` layers only its link pass on top; `helpmodals.js` imports it.
Byte-exact output. Only the tiny inline primitive was shared - see below for why the two
*full* renderers stay forked.

### Keep as-is: the two full markdown renderers NOT merged
`markdown.js::renderMarkdown` (Help & Guides: heading anchors + TOC + relative-link
resolution) and `helpmodals.js::_renderGlossaryMd` (glossary: `.glossary-section`/
`.glossary-term` wrapper divs the filter shows/hides, no anchors/TOC/links) emit
structurally different HTML for different surfaces. Merging would require parameterizing
those differences into one function - the "generic base that buries each caller's specifics"
the codebase repeatedly rejects.

### Keep as-is: `core/utils.js::netErrMsg` and `core/format.js::formatApiError` are NOT duplication
They format different inputs: `netErrMsg` takes a thrown `Error`/`TypeError` from the
fetch/network layer; `formatApiError` takes a parsed server error body and unpacks its
`detail`/`message` shape. No shared kernel worth extracting.

### Keep as-is: `library/colorpicker.js::attach` (~51 lines) not decomposed
Over the ~30-line guideline but one cohesive concern (construct + wire one color-picker
widget, read top-to-bottom); splitting construction from wiring would fragment tightly
coupled setup for no legibility gain - same class as other keep-whole calls in this file.

### Keep as-is: `core/ui.js` (~675-680 lines) and `core/jobs.js` (~698-700 lines) large-but-cohesive
Both are collections of small single-concern functions around one cohesive area (`ui.js` =
shared modal/menu/kebab/resize/toast primitives; `jobs.js` = job-pill + SSE state machine).
Length comes from breadth of small helpers, not any one long function. No natural sub-module
seam that wouldn't just scatter tightly-related helpers. (`jobs.js`'s former "9 window.*
reads" characterization is corrected by the Phase 6 entry above - jobs.js has since moved
to the `refreshhooks.js` registry seam.)

### Keep as-is (re-confirmed, already anchored): `main.esm.js` residual `window.X = X` shim
Not shrunk this pass - already anchored by the 2026-07-23 shim-drain slice entry. Further
draining is the deferred vitest follow-on's territory. `test_main_esm_shim_ratchet.py`
stayed green; no change.

---

## Phase 3 test coverage - full-app review section 10, app shell & core plumbing (2026-07-26)

Closed the coverage gap Phase 1/2 recorded for `core/boot.js`, `core/refreshhooks.js`, and
`core/helpmodals.js` having no dedicated `tests/js/` file, plus checked `routes/common.py`'s
`require_clip`/`require_clip_with_source` (added in Section 8) for direct coverage.

### Fixed: `core/refreshhooks.js` had zero `tests/js/` coverage of its own contract
Its registration/dispatch/no-op-fallback guarantees (additive registration, override on
re-register, "unregistered hook is a safe no-op, never a ReferenceError") were only ever
exercised incidentally as fixture setup inside `jobs.test.js`/`format.test.js`. Added
`tests/js/core/refreshhooks.test.js` (pure registry logic, no DOM needed).

### Fixed: `core/helpmodals.js` had zero `tests/js/` coverage of its parsing/state logic
Open/close flows are covered end to end via Playwright, but two pieces of non-trivial logic
had no case-by-case coverage: the hand-rolled `_renderGlossaryMd` markdown parser
(section/term open-close state machine that could silently mis-nest) and
`_renderGettingStartedBanner`'s 4-branch state machine (tiers-fetch failure / full model
active / lightweight+downloading / lightweight+none), driven off two chained fetches
Playwright never exercises branch-by-branch. Exported both (previously module-private,
matching the existing underscore-prefixed test-only export convention). Added
`tests/js/core/helpmodals.test.js`.

### Not a gap (checked, ruled out): `core/boot.js` has no dedicated `tests/js/` file
`boot.js` is the project's one deliberately-exempt module (CLAUDE.md: "the side-effect entry
point") - importing it re-runs the entire app's first-paint wiring against a bare DOM, and
per-case re-import would need `vi.resetModules()` plus re-seeding the whole graph, new test
infra out of this phase's scope. Its practically-testable behaviors are already exercised end
to end via Playwright across the files boot logic feeds (version tag/about modal, sort
restore-from-localStorage, getting-started first-run open, GPU/LLM setup-warning chip). Same
pattern Section 9 confirmed for `library/{contexts,exporteditor,sounds}.js`.

### Fixed: `routes/common.py`'s `require_clip`/`require_clip_with_source` had no direct unit test
Both are shared cross-cutting helpers (clip preview, auto-framing, frame analysis routes)
with real branching (404; three outcomes: clip missing / recording row missing / source file
missing on disk), but `test_routes_common.py` only exercised them indirectly through calling
routes. Added `TestRequireClip`/`TestRequireClipWithSource` using a small `_FakeDb` stub +
`tmp_path`, no real DB/TestClient - consistent with the file's existing scope.
`missing_ids`/`json_list`/`srt_to_vtt` checked too: the latter two already have direct unit
tests; `missing_ids` is exercised only indirectly but is a two-line order-preserving filter
with no branching worth a dedicated case - left as adequate indirect coverage.

---

## Phase 7 UX/UI - full-app review section 9, people/settings/project ops (2026-07-26)

UX/UI walk over Section 9 static JS (`people/{namecorrections,speakers,voices}.js`,
`settings/{modelcatalog,modeldownload,projects,settings-backup,settings-installs,
settings-previews,settings}.js`, `library/{contexts,exporteditor,exportpresets,sounds}.js`),
anchored against Section 8's Phase 7 and the 2026-07-23/24 full-surface UX review (both found
high UX quality already). **No code changes** - no clear-cut defect; findings below are Low
and anchored or deferred. No tests re-run (doc-only edit).

### Verified good, do NOT re-flag - Phase 2 path-leak message reads clearly to a non-dev
`modelcatalog.js`'s `_updateLlmCapabilities` renders `cap.detail` from `/api/llm/capabilities`
(`llm.py::_llamacpp_capabilities`, which does its own path-existence checks and never calls
`resolve_server_binary`, so it never carried the leak) - plain-English strings. The generic
reason from Phase 2's fix only surfaces via `check_llm_available` in scoring/speakers routes:
"The local AI engine (llama-server) could not be started - reinstall yuu-clip, or set its path
under Settings -> LLM scoring." Reads fine for a non-developer. No change.

### Verified good, do NOT re-flag - Settings information architecture is discoverable
Phase 6 found `settings.js`'s code/comment scope claims had drifted (fixed there); the UI IA
itself has not: Capabilities overview, jump-nav, per-section + whole-panel reset, dirty-state
Save gate, discard-on-close guard, chunked sections. Good IA - not a finding.

### Verified good, do NOT re-flag - contexts.js dual scope is well-separated in the UI
Phase 6 flagged `contexts.js` owning World Context CRUD + Characters CRUD + re-score/
retranscribe/auto-approve in one file. In the UI these are cleanly separated: Characters is a
nested sub-section inside the context editor (`#ce-characters-section`, gated behind "save the
context first"); the flows are detail-panel actions never shown in the context modal. Shared
code file, not a shared UI surface - no user confusion. Confirms Phase 6's call.

### Verified good, do NOT re-flag - People merge/detach reversibility reads honestly
Merge/detach/promote/character-link all confirm proportionally to their reversibility: detach
says "you can link it again later"; merge honestly says the other person is removed (not
one-click-undoable, gated behind a confirm); character-link is unconfirmed because "No
character" trivially unlinks. Speaker-side mirrors this. Empty states double as onboarding.

### Verified good, do NOT re-flag - model-download & backup/restore feedback is exemplary
`modeldownload.js` gives per-kind progress/failure/offline/cancel states with stacking
banners; `modelcatalog.js` survives a Settings re-render mid-download and confirms success
only after verifying the file landed; `settings-backup.js` restore previews contents + missing
media folders and states the pre-restore safety copy is kept. Nothing to add.

### Deferred (Low) - project-switcher / backup / restore controls aren't tagged `data-job-blocked`
`/api/projects/switch` and `/api/restore/apply` are backend-guarded (409, surfaced as a clear
error toast) but not proactively disabled per the project's `data-job-blocked` convention.
Deferred: these use a manual busy-check (not the `reject_if_busy` job machinery the attribute
keys off), are rare deliberate actions, and the reactive toast is clear; tagging the
runtime-built switcher menu is partly Section-10 HTML scope. Trigger to revisit: a user
reports confusion switching projects mid-analysis, or `applyJobBlockedState` coverage is
extended to these controls anyway.

### Deferred (Low, WCAG 3.2.2 nuance, anchored) - the "Merge in.../Merge into..." select triggers an action on change
The per-Person/per-speaker merge `<select>`'s `change` opens a merge confirm (WCAG 3.2.2
prefers this advised beforehand) - but it IS advised: the placeholder and aria-label name the
action, and it opens a confirm rather than acting immediately. Anchored as an established,
settled app-wide pattern (identical in `speakers.js`), pointer-first single-user desktop tool.
Not worth reworking into a button+picker.

### Low, note-only - first-run banner copy says "the AI model" where Settings says "local model"
`modeldownload.js` uses friendlier "the AI model" on first-run/handoff banners while
`modelcatalog.js`/`settings.js` say "local model"/"LLM scoring". Not a glossary violation (no
"AI scoring" anywhere); the friendlier first-run phrasing is a defensible non-developer choice.
Recorded so a future terminology sweep doesn't treat it as drift.

### Confirmed clean - no hardcoded-color / theme violations in scope
`test_static_theme_colors.py` passes; only literals are `exporteditor.js`'s over-video
`#000`/`rgba(0,0,0,.x)` (documented exception) and the caption-text data-encoded speaker
colour (same class as the score-gradient exception). No finding.

---

## Phase 6 docs and comments - full-app review section 9, people/settings/project ops (2026-07-26)

Grep-first survey (comments/docstrings/Feature-map headers) over the 20 route files + 14
static JS files in Section 9 plus `appversion.py`/`pathsafety.py`. Zero TODO/FIXME/XXX/HACK
anywhere. Comment quality is clean throughout (as in Phases 1-5); the real finding category
was Feature-map header drift - several headers named a UI/API owner that had moved in a prior
extraction, one cited a shipped UI as "not yet built". `yuu-dev bundle`, lint, `test-api`
(3510 passed, unchanged), `test-js` (698 passed, unchanged), typecheck `new: 0`.

### Applied: `routes/backup.py`'s header called its own shipped UI "Stage 3, not yet built"
`settings-backup.js` is fully built and tested (backup download + review-before-commit
restore, `tests/ui/test_ui_backup.py`) - not a stub. Dropped the stale parenthetical.

### Applied: `routes/llm.py` and `static/settings/modelcatalog.js` headers both named the wrong owner for `/api/capabilities/tiers`
`modelcatalog.js`'s header claimed `routes/config.py`; the endpoint (and every other one the
file calls) is actually defined in `llm.py`, never `config.py`. Also added `routes/models.py`
(the file's `/api/models/prefetch` call, previously uncited). Corrected both headers.

### Applied: `routes/llm.py`'s own header claimed the setup wizard as a live UI consumer of this route file
Grepped `electron/` for `api/llm/catalog` - zero hits. Per the locked wizard/Settings
architecture (CLAUDE.md), the wizard runs before the Python server exists and reads the
generated `catalog-data.json` instead, never a live route. Removed the wizard from the "UI:"
line; reworded the docstring to state the real relationship (shared source module, two
different consumption paths).

### Applied: `routes/profiles.py`'s header pointed at the wrong UI file entirely
Claimed `static/settings/settings.js`. The Profile Manager modal, its handlers, and every
`/api/profiles*` fetch all live in `static/analyze/analyze.js` (New Recording panel);
`settings.js` has zero references to either. Corrected the UI line.

### Applied: `static/settings/settings.js`'s own header cited two routes it doesn't call
Claimed `llm.py, profiles.py` among its API surface - both absent (the LLM-catalog surface was
extracted to `modelcatalog.js`, which `settings.js` doesn't import; Profile Manager was always
`analyze.js`). Corrected to its real surface: `config.py`, `content_presets.py`,
`export_presets.py` (via `exportpresets.js`), `routes/analyze.py` (`/api/status`,
`/api/install/speechbrain`).

### Applied: `static/library/contexts.js`'s header undercounted its own scope by a wide margin
Claimed `routes/contexts.py` only, but the file also owns Characters CRUD, batch/individual
re-score, reset-approvals, auto-approve, and retranscribe - traced to `routes/characters.py`,
`routes/scoring.py`, `routes/analyze.py`, `routes/videos.py`, none of which the header named.
Same shape of drift Section 8 Phase 6 fixed for `transcript.js`. Rewrote the header; left the
file's content untouched (a possible future split of re-score/retranscribe out of
"contexts.js" is a Phase-4-style refactor call, noted here for a later pass).

### Applied: `routes/name_corrections.py` and its JS counterpart both cited a nonexistent test file
Both claimed `tests/ui/test_ui_namecorrections.py` (doesn't exist); real coverage is
`tests/js/people/namecorrections.test.js`. Corrected both. Also closed the same
missing-`tests/js/`-citation gap across every other file in scope that has one:
`voices.py`/`voices.js`, `speakers.js`, `logs.py` (had no Tests line at all despite Phase 3
adding `tests/integration/test_logs.py` - added it), `modeldownload.js`, `settings-backup.js`,
`settings-previews.js`, `modelcatalog.js`, `exporteditor.js`, `exportpresets.js`, `sounds.js`,
`projects.js`, `settings.js`. **`settings-installs.js` was also listed here as having "no
`tests/js/` counterpart (verified) - left as-is" - that claim was simply wrong at the time:
`tests/js/settings/settingsinstalls.test.js` already existed (added commit `bc94c23`,
2026-07-19, a week before this pass). Corrected 2026-07-26 in the same follow-up pass that
compressed this file - see the "Follow-up fixes" section at the top.**

### Verified, no change: `routes/sounds.py::_safe_name`'s drive-colon rejection comment
Already states the WHY, not just the what - names the Windows drive-relative mechanism and the
concrete escape it prevents. Exactly the shape the governing rule asks for.

### Verified, no change: `appversion.py` / `pathsafety.py` docstrings
Both already state genuinely non-obvious semantics (`is_within`'s "paths should already be
resolved by the caller" + case-insensitive-on-Windows; `app_version`'s parameterized-default
rationale) without restating trivial calls. Already covered by Phase 4's structural review;
this pass adds the comment-content confirmation.

### Terminology sweep - clean
Grepped the standard glossary-drift term list across every file in scope. Every hit was a
code-level identifier or accurate internal docstring, never user-facing text using the wrong
term. Consistent with every prior section's sweep.

### Confirmed clean, no findings: everything else in scope
`routes/{characters,voices,contexts,content_presets,export_presets,models,imports,updates,
projects,sessions,reveal,reel,config}.py` and the JS files not called out above
(`settings-installs.js`) - every comment explains a non-obvious WHY or documents a real
external/product constraint. No restatement, obsolete text, reactive/apology comments, or
orphaned TODOs.

---

## Phase 5 logging coverage - full-app review section 9, people/settings/project ops (2026-07-26)

Grep-first survey (`logger.`/`_log.` calls, bare `except` blocks, imported-but-unused-logger
sweep) over the 20 route files + 14 static JS files in Section 9 plus
`appversion.py`/`pathsafety.py`. Two real gaps fixed in Python routes; several apparent gaps
confirmed already covered by an upstream callee (below); JS half needed no changes (covered by
the project-wide `errorreporter.js` surface, as Section 8 Phase 5 found). `test-api` 3510
passed (unchanged), lint clean, typecheck `new: 0`.

### Applied: `routes/backup.py`'s restore-rejection catches now log before converting to HTTPException
`restore_inspect`'s `except RestoreError` and `restore_apply`'s `except ProjectExistsError`/
`except RestoreError` returned the real reason to the UI but logged nothing server-side -
`project_archive.py` logs ERROR for the security-relevant raises but not every `RestoreError`,
so trace visibility depended on which internal check fired. Added `_log.warning` in both
`RestoreError` catches and `_log.info` in the `ProjectExistsError` catch (routine "needs
overwrite confirmation", not a failure). No behavior change.

### Applied: `routes/reveal.py` had a `_log = get_logger(__name__)` that was never called
The only file in scope where the logger was imported but never called - a rejected "Show in
Folder" (`_path_allowed` returning False, the same shape of security-boundary check
`project_archive.py::_reject_unsafe_member` already logs at ERROR for) or a missing target
file left no trace. Added `_log.warning` on both the rejection and the missing-file 404.

### Confirmed already covered, no changes needed: model/whisper download failures (`models.py`, `llm.py`)
Both delegate to `web/sse.py::subprocess_sse`, which logs every subprocess stdout/stderr line
at DEBUG (root logger is DEBUG) and the exit failure at ERROR; the CLI's own
`console.print(f"[red]Download failed: {exc}[/red]")` lands in that captured stdout. A failed
download is diagnosable from the log without a code re-read - route-level logging would only
duplicate it.

### Confirmed already covered, no changes needed: `routes/speakers.py::infer_names` passing through `check_llm_available`'s reason
Traced `check_llm_available` (docstring says "without logging") through to
`LlamaCppServerClient.available()`: every branch's reason is either self-explanatory or, for
the one redacting branch (binary-resolution failure), the full unredacted detail is already
logged at WARNING inside `available()` before the generic reason returns. No route-level log
needed on top.

### Confirmed already covered, no changes needed: config-save and project-switch unhandled failures (`config.py`, `projects.py`)
Neither wraps its OS calls in try/except, but `web/app.py`'s
`@app.exception_handler(Exception)` (`_unhandled_error`) logs every otherwise-unhandled
exception at ERROR with method+path+full traceback before returning a 500 - the same
"route + traceback" pair a dedicated catch would add. Confirmed the same for `restore_apply`'s
target-directory operations before the newly-added catches take over for the typed failures.

### Confirmed already covered, no changes needed: validation-rejection 400s across the section
Every plain `raise HTTPException(400, ...)` swept across config/sounds/reel/sessions/
content-preset/export-preset routes already states the reason in full in the response body -
logging it server-side would be a duplicate, not new information. Matches the section's
existing no-log-on-validation pattern.

---

## Phase 4 refactor - full-app review section 9, people/settings/project ops (2026-07-26)

Structural survey (function-length + duplication heat map) then targeted reads over the 20
route files + 14 static JS files plus the two new Phase 2 modules
(`appversion.py`, `pathsafety.py`). One genuine extraction applied; everything else reviewed
and deliberately left as-is. `test-api` 3510 passed (unchanged), lint clean, typecheck
`new: 0`. No static JS touched.

### Applied: `llm.py` disk-preflight payload shape extracted to `_disk_preflight(needed_gb, target)`
`_preflight_gguf_download` and `_preflight_whisper_prefetch` each computed the identical 4-key
`{sufficient, free_gb, needed_gb, target}` dict feeding the 507 "not enough disk space" error.
The duplicated knowledge is the payload shape + comparison, not the domain-specific bits (size
source, headroom, target dir), which stay per-caller. Rule-of-two, but the shape is exact and
consumed identically twice - removes a real drift risk. Covered end-to-end by
`test_gguf_download.py`/`test_whisper_prefetch.py`, still green.

### Confirmed necessary - do NOT re-flag: the two ESM import cycles are genuine domain coupling
Phase 3 flagged `voices.js <-> speakers.js <-> transcript.js` and `modeldownload.js ->
modelcatalog.js -> settings.js -> analyze.js -> modeldownload.js` as a testing gotcha. Traced
every edge: each is a real cross-module call inside a handler body (People/Speakers/Transcript
cross-navigate and cross-refresh by nature; the model/settings cluster shares
capability-tier/dirty-state rendering). Breaking either needs an event-bus/mediator the project
explicitly rejects (CLAUDE.md: function-body-only cross-references are safe under esbuild). No
refactor - the testing gotcha is inherent and already documented.

### Keep as-is: config-CRUD route modules (characters/content_presets/export_presets/contexts) NOT merged
These (and voices/name_corrections/speakers) share a visible shape (`make_router(ctx)`,
`try/finally: db.close()`, a `_*_dict` serializer, `_log.info` on mutate) but encode different
domain knowledge (Character's `context_slug`+`_clamp_boost`+Person-unlink cascade; presets'
weight-copy+starter-hotword insert; export-presets' `_slugify`/`_unique_name` immutable-id
rule). The shared shape is the mandated route pattern, not duplicated rules - a generic CRUD
base would couple independently-evolving entities. No merge.

### Keep as-is: `voices.py` `_members_of`/`_members_by_voice` and `_suggestions_of`/`_suggestions_by_voice` pairs
Each pair is a single-voice query and an all-voices grouped query over the same join. The
grouped `_by_voice` variants (with `joinedload`) feed `list_voices` in one shot to avoid an
N+1 across every Person; the single-voice variants serve the mutation routes. Collapsing them
behind a filter/group flag would reintroduce boolean-blindness and obscure the N+1-avoidance
intent. Left as two small focused helpers.

### Verified clean, no change: `appversion.py` / `pathsafety.py` placement + call sites
Both sit at the package root (correct - cross-cutting kernels used by both `yuu_clip/` core
and `web/`). Grepped every call site (`app_version`: 3 sites; `is_within`: 3 sites) - each
delegates with no leftover inline copy. `dev/notices.py`'s own version copy is deliberately
out of scope (Section 6). Nothing to refactor.

## Phase 3 test coverage - full-app review section 9, people/settings/project ops (2026-07-26)

Closed the five coverage gaps Phase 1 recorded in `REVIEW_OPEN_ITEMS.md`. `test-api` 3510
passed (3497 baseline + 13 new), `test-js` 698 passed (54 files, +4 new), lint clean,
typecheck `new: 0`.

### Fixed: `people/voices.js` had zero `tests/js/` coverage (~46 top-level functions)
Added `tests/js/people/voices.test.js` (21 tests) driving the real `openPeopleView` ->
`PanelNav.open` -> fetch -> render chain, mirroring `namecorrections.test.js`'s pattern
(render/gating, every card action's request shape, error toasts). Found and fixed a real bug
mid-test: `_backfillPeople`'s success toast called `plural(data.created, 'person')` with no
plural form, producing "Found 3 persons to review" instead of "people" - added the third
argument.

**Gotcha for a future test in this cluster:** `voices.js <-> speakers.js <-> transcript.js`
form a real ESM import cycle. `vi.mock`+`importActual` on a module inside a live cycle does not
reliably intercept the binding the cyclic importer sees - the mock's calls stayed empty while
the real function silently ran and no-opped, with no exception to signal the mock never took
(same class of limitation as `core/jobs.js`'s 9 `window.*` reads). Fix: don't mock the cyclic
module - seed the real DOM section and assert on the resulting DOM. Confirmed via
`console.log` instrumentation, not guesswork. Reappeared testing `modeldownload.js` (a 4-node
cycle) - same fix: route its real `/api/llm/capabilities`/`/api/capabilities/tiers` fetches and
assert on the real DOM update.

### Fixed: `name_corrections.py::_apply_spans`'s multi-correction-per-segment path was untested
Added `tests/unit/test_name_corrections_apply_spans.py` (8 tests, pure function) covering the
rightmost-first replacement order, the reverse-back-to-ascending-order result contract, and a
drifted item not blocking its siblings.

### Fixed: `routes/logs.py` had no dedicated test file anywhere
Added `tests/integration/test_logs.py` (5 tests): `/api/logs/export`'s two branches (real
per-project log file vs. in-memory buffer fallback), the dated filename, and
`/api/glossary`'s 200/404 paths.

### Fixed: `settings/{modeldownload,settings-backup,settings-previews}.js` had zero `tests/js/` coverage
Added three files (26 tests total): `settings-previews.test.js` (12, export-filename/title-card
previews incl. contrast-warning threshold), `settings-backup.test.js` (9, backup download +
restore review-before-commit flow incl. the 409 `project_exists` branch), and
`modeldownload.test.js` (13, boot-time LLM-handoff/analysis-model-prefetch banners: per-kind
gating, SSE progress/failure/offline/cancel, `getWhisperDownloadPct`'s reset-on-completion).

### Not a gap (already covered, review's list was stale): `contexts.py::_delete_context_characters` cascade
`REVIEW_OPEN_ITEMS.md` listed this as untested, but
`tests/integration/test_characters.py::TestContextDeleteCascade::test_deleting_context_deletes_characters_and_unlinks`
(commit `578b84a`, predates this review pass) already covers both halves of the cascade. Phase
1's gap listing was simply incorrect for this item; no test change made.

---

## Phase 2 bug hunt - full-app review section 9, people/settings/project ops (2026-07-26)

Bug hunt over Section 9 (20 route files + 14 static JS). Four items fixed (three carried
forward from Sections 4 and 7, plus one new bug). `test-api` 3497 passed (3486 baseline + 11
new), lint clean, typecheck `new: 0`.

### Fixed (carried from Section 4): `LlamaCppServerClient.available()` no longer leaks the binary path
`scoring/llm_client.py::available()` returned `str(exc)` verbatim on a `LlamaServerError` from
`resolve_server_binary` - two of its three raises embed an absolute path, and that reason flows
unredacted into UI-facing surfaces (`routes/scoring.py`, `routes/speakers.py`
`infer-speaker-names`, `routes/analyze.py` warnings), risking a home-dir leak in a screenshot.
Matched the sibling "missing model file" branch's precedent: catch `LlamaServerError`, log the
full detail at WARNING (the log file is redacted by `_SanitizingFormatter`), return a fixed
generic UI reason. Confirmed no test pinned the old leaky behavior. Pinned by
`test_scoring_llm.py::TestClientAvailableReasonNoPathLeak::test_binary_resolution_failure_reason_has_no_path`.
`routes/llm.py::_llamacpp_capabilities` was already safe (own path-existence checks, never
calls `resolve_server_binary`).

### Fixed (carried from Section 7): app-version lookup extracted to `yuu_clip/appversion.py`
The `_pkg_version("yuu-clip")` -> fallback try/except was duplicated across four sites.
Extracted `app_version(default="unknown")` (parameterized default - the update check needs a
parseable `"0.0.0"` fallback, others want `"unknown"`). Converted `project_archive.py`,
`web/app.py`, `web/routes/updates.py`. `dev/notices.py` (Section 6, out of scope) still has its
own copy - a low-value follow-up, left untouched deliberately. Pinned by
`tests/unit/test_appversion.py`.

### Fixed (carried from Section 7): path-containment predicate extracted to `yuu_clip/pathsafety.py`
The "does target resolve inside base?" check existed as three subtly-worded copies
(`media.py::resolve_within`/`project_archive.py::_reject_unsafe_member` used
`base not in target.parents`; `reveal.py::_is_within` used `relative_to`) - verified
semantically equivalent (both treat `target == base` as within, both case-insensitive on
Windows). Extracted `is_within(target, base) -> bool`; each caller keeps its own resolve step
and error type. Pinned by `tests/unit/test_pathsafety.py`. `routes/backup.py` and
`routes/projects.py` turned out NOT to need it - backup delegates to `project_archive`, the
project switcher intentionally has no base to contain within.

### Fixed (new, found here): `routes/sounds.py::_safe_name` allowed a Windows drive-relative escape
Rejected `/`, `\`, `.`, `..`, empty - but not `C:evil.wav`, which is drive-relative on Windows
(`sounds_dir / "C:evil.wav"` resolves to C:'s cwd, escaping the sounds dir). Reachable from
upload/file/custom-delete. Low severity in a single-user loopback app, but a one-line fix
(also reject `":"`). Verified the escape empirically before fixing. Pinned by
`test_sounds.py::test_upload_rejects_drive_relative_name` +
`test_file_rejects_drive_relative_name`.

---

## Phase 7 UX/UI - full-app review section 8, web UI content & analysis (2026-07-26)

UX/UI walk over Section 8 (`static/videos/{sessions,videos-runmeta,videos-summary,
videos-timeline,videos}.js`, `static/clips/{clipbulk,clipcreate,clipexport,clips}.js`,
`static/analyze/{analyze,reel,split,transcript}.js`,
`static/library/{hotwords,sensitive}.js`). Anchored against the 2026-07-23/24 full-surface UX
review - most core UX was already settled there; this pass looked for Section-8-specific
drift/gaps. One copy fix applied; three Low findings (two deferred). Scope is exceptionally
polished (complete state coverage, focus capture/restore, job pills with typed-outcome-aware
`onDone`, specific confirm copy, plain-English errors throughout). `test-js` 642 passed,
`test-unit` 2023 passed, `test-ui --changed` 205 passed, lint clean.

### Applied: "database"/"record" implementation jargon removed from three delete confirmations
`clips.js::deleteClip`, `clipbulk.js::bulkDeleteClips`, and `videos.js::deleteVideo` all leaked
implementation terms ("removed from the database") into user-facing confirm copy, against the
plain-English-for-non-developers convention; `deleteVideo` was also internally inconsistent
(title/toast said "YuuClip", body said "the database"). Reworded to "This clip will be
permanently deleted.", "N clips will be permanently deleted." (dropping `'clip record'` ->
`'clip'`), and "...are permanently removed from YuuClip." No test pinned the old strings.
Rebuilt `bundle.esm.js`; drift guard + `test-ui --changed` green.

### Deferred (Low): dynamically-built session modals lack a focus trap / focus-return
`sessions.js::_promptText` and `_showSuggestionModal` build their `.modal-bg` at runtime and
`appendChild` it, so they sit outside the boot-time modal-a11y stamping + single
document-level focus trap that covers the static index.html modals - Tab can reach background
controls, and closing doesn't restore focus to the opener. They do have
`role="dialog" aria-modal="true"`, a labelled input, autofocus, and Enter/Escape handling, so
they're usable. Deferred as Low: mouse-first single-user desktop tool (same rationale as the
review's Low 29 for pointer-only split/resize), and a proper fix wants a shared
"trap a runtime-built modal" helper, not a per-modal patch. Trigger to revisit: a
keyboard-only/AT user needs this flow, or a shared runtime-modal helper lands anyway.

### Deferred (Low): split re-analyze clip-clear error names a raw internal segment id
`split.js::_doSplitAndReanalyze`'s per-segment clip-clear loop shows
`Failed to clear clips on segment ${segId}` (segId is the raw DB row id, unmappable to a
visible label) on a rare DB-write failure mid-split. Deferred: the loop has no position handy,
so a clean fix wants the segment's 1-based index/name threaded through; low value for a rarely-
hit path. `_abortReanalyzeChain` already does this right ("segments N-M") if it's ever worth
copying.

### Confirmed-intentional - do NOT re-flag (verified good during this walk, scope-specific)
- Clip review/approval flow (`clips.js`): A/R/U shortcuts + tooltips, disabled-during-retry
  buttons, undo toast on every status change. Solid.
- Bulk partial-failure surfacing (`clipbulk.js::_doBulkDeleteClips`): "Deleted N - M could not
  (file in use)" gives count + reason; failed clips stay visible for inspection. Adequate;
  Phase 5 added the server-side which-ids log for the maintainer.
- Split feature clarity (`split.js`): exact-consequence confirm copy, disabled-reason title,
  danger-vs-primary styling, Undo Split. The Section-8-Phase-2 correctness fix is invisible to
  the user by design.
- Hot-words vs Sensitive Terms distinction (`hotwords.js`/`sensitive.js`): clear row
  labels/empty states; `_sensitiveFuzzyGuardTripped`'s client-side fuzzy guard pre-empts the
  server 400 with matching wording - exemplary error prevention.
- `reel.js` status-chip trap guard (never leaves zero statuses) and `mergeReelPool` (new
  non-approved clips default excluded) - deliberate anti-foot-gun choices.
- `analyze.js` estimate/first-run copy and the drag-and-drop Electron-only affordance with a
  browser-drop toast fallback - correct capability-gating, not a gap.

---

## Phase 6 docs and comments - full-app review section 8, web UI content & analysis (2026-07-26)

Docs-and-comments phase over `web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py`,
`routes/clips/{crud,edit,delete,bulk,approval,captions,export,schemas,serialize}.py`, and the
`static/{videos,clips,analyze,library}/*.js` set. Grepped ~460 comment/docstring/header hits
before reading; zero TODO/FIXME/XXX/HACK. Comment quality throughout is clean - the one real
finding category was Feature-map header drift/gaps. `test-api` 3486 passed (unchanged),
`test-js` 642 passed, lint clean, 0 new mypy errors.

### Applied: three Feature-map headers corrected (drifted API-ownership references)
- `videos-summary.js`/`videos-timeline.js` both claimed `routes/videos.py` for
  summarize/regenerate-summary/timeline - those actually live in `routes/scoring.py` (moved by
  the pre-existing `400f926` module split, already stale coming into this section). Corrected
  both; `videos-summary.js` keeps `routes/videos.py (fields)` since that endpoint is genuinely
  there.
- `transcript.js` claimed `routes/videos.py, routes/scoring.py` - zero fetch calls hit
  `scoring.py`; the real surface is `routes/videos.py`, `routes/clips/captions.py`, and
  `routes/speakers.py` (the majority of the file's calls). Corrected to name all three.

### Applied: `static/clips/clips.js` had no Feature-map header at all
The largest, most central file in scope (1699 lines at the time) - the file every sibling
module points back to as "the clip list" - carried no header, unlike every other file this
size in scope. Added one naming its code concept, its split-out siblings, its route surface
(`routes/clips/{crud,edit,delete}.py`, `routes/dedup.py`, `routes/scoring.py` for rescore), and
its two UI test files.

### Applied: `routes/analyze.py`'s header claimed "+ Import from URL" without listing its routes
The header's title names Import-from-URL as in scope, but zero `/api/import-url/*` routes are
actually defined in this file - they live entirely in `routes/imports.py` (a real sibling the
header should name). Added it to the Siblings line.

### Verified: `videos.py`'s `_migrate_transcript_to_segments` `extracted_path=None` comment - accurate and load-bearing, no edit
Re-read against Phase 2's fix and Phase 5's added debug log. Explicitly says "Deliberately NOT
copying extracted_path", names both consumers that would misbehave otherwise
(`run_retranscribe`, a non-force reanalyze's skip-on-existing-path check), and states the
resulting invariant in the same breath. Exactly the shape that should prevent a future
"fix" back to inheriting the parent's path. Phase 5's debug log line matches. No edit needed.

### Verified: `routes/common.py`'s `require_clip_with_source` (Phase 4 extraction) - docstring is appropriately sized, no edit
Explains what a bare read of the three-check body would not make obvious (which three routes
share it and why) without restating the checks. `require_clip` right above (a single check)
correctly has no docstring, consistent with the rest of the file's pattern. Not
over-documented, nothing missing.

### Terminology sweep - clean
Grepped the standard glossary-drift term list across every `.py`/`.js` file in scope. Every hit
was a code-level identifier/log line or an internal docstring describing the data model - never
user-facing text. Every genuinely user-facing string found already uses the correct glossary
term. No drift.

### Confirmed clean, no findings: everything else in scope
`routes/{videos,analyze,scoring,dedup}.py`, `routes/clips/{crud,edit,delete,approval,captions,
export,schemas,serialize}.py`, and the JS files not called out above (`sessions.js`,
`videos-runmeta.js`, `clipbulk.js`, `clipcreate.js`, `clipexport.js`, `reel.js`, `split.js`,
`hotwords.js`, `sensitive.js`) - every comment explains a non-obvious WHY or documents a real
external/product constraint. No restatement, obsolete text, reactive/apology comments, or
orphaned TODOs.

---

## Phase 5 logging coverage - full-app review section 8, web UI content & analysis (2026-07-26)

Grep-first survey (`logger.`/`log.`/`_log.` calls, bare `except` blocks) over
`web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py`, `routes/clips/*`, and the
`static/{videos,clips,analyze,library}/*.js` set. Five real gaps fixed, all Python-side; JS
half confirmed already covered by the project-wide `errorreporter.js` surface plus per-route
server-side logging. `test-api` 3486 passed (unchanged), lint clean, 0 new mypy errors.

### Applied: `hotwords.py` CRUD routes now log create/update/delete
The file had zero `logger`/`log` calls anywhere, unlike its structural sibling `sensitive.py`.
Unlike `sensitive.py`'s `term` (documented PII, never logged), a hot-word's `phrase` carries no
such restriction, so it's logged directly. Added `_log.info` on create/update (id, phrase,
match_mode, target, boost) and delete (id, phrase).

### Applied: `hotword_rescan` (scoring.py) / `sensitive_rescan_video` (sensitive.py) now log a summary
Both video-scoped rescan routes computed `clips_checked`/`clips_changed` and returned it to the
client but logged nothing, unlike every sibling aggregate route in scope. Added a matching
`_log.info` summary (video id, clips checked, clips changed) to each.

### Applied: `clips/bulk.py`'s three bulk routes now log which IDs, not just how many
`bulk_set_clip_status`, `bulk_restore_clip_status`, and `bulk_delete_clips` all logged only
counts - diagnosing "8 of 10 succeeded" required the client's (non-persisted) JSON response.
Extended each summary log to include the actual missing/locked id lists when non-empty. Bounded
by the user's own selection size, not a per-item loop - not a spam risk.

### Applied: `videos.py::_migrate_transcript_to_segments` now logs per-track/segment migration detail
Phase 2 fixed a real bug here (a migrated segment's `AudioTrack.extracted_path` was wrongly
copied from the parent, corrupting a later retranscribe) - a one-line, easy-to-silently-regress
decision with no way to see it exercised from the log (the existing summary log only reports
aggregate counts). Added a `_log.debug` line per migrated pair naming both track ids, the
segment video id, transcript-line count, and the `extracted_path=None` decision explicitly.
Debug level: only fires on a user-initiated split with `migrate_clips=True` (rare, bounded).

### Checked, no gap: JS scope (`static/{videos,clips,analyze,library}/*.js`)
Zero `console.*` calls across all 15 files, matching the project-wide convention (only
`core/errorreporter.js`, `core/jobs.js`, `core/utils.js` call `console.*` under `static/`).
Deliberate: `initGlobalErrorReporter()` catches every uncaught error/rejection app-wide
(devtools, in-app log panel, toast); the underlying cause is already captured server-side by
the corresponding route's own log line. Client-side catches are UX feedback, not the
diagnostic trail. No changes.

### Checked, no gap: everything else in scope
`videos.py`'s non-split routes, `analyze.py` (already thoroughly logged with `exc_info=True`),
`clips/{crud,edit,approval,captions,export}.py` (every real failure path already logs with
`exc_info=True` and clip/video id context), and `dedup.py` (single summary log, no independent
failure path to miss). No changes.

---

## Phase 4 refactor - full-app review section 8, web UI content & analysis (2026-07-26)

Refactor pass over `web/routes/{videos,analyze,scoring,dedup,hotwords,sensitive}.py` +
`routes/clips/*` and the `static/{videos,clips,analyze,library}/*.js` set. Resolved the
three test-tier/duplication items `REVIEW_OPEN_ITEMS.md` carried, extracted one genuine
route-level duplication, left several borderline candidates as-is. `yuu-dev test-api`
3486 passed (net -6: 8 duplicate integration tests removed, 2 added, 5 moved), lint
clean, 0 new mypy errors.

### Applied: three flagged test-tier / duplication items resolved
- `TestVideoInfoProperties` (integration) was a near-literal duplicate of
  `tests/unit/test_probe.py::TestVideoInfoProperties`. Deleted; its unique
  `duration_hms`-of-zero case folded into the unit-tier class as `test_duration_hms_zero`.
- `TestVideoCaptionsSrt` was pure-logic (no `client`/`project_dir`), misplaced in the
  integration tier. Moved verbatim to `tests/unit/test_subtitles.py`.
- `TestVideoSourceFile` + `TestVideoSource` had a duplicate missing-file-404 test.
  Folded `TestVideoSourceFile` into `TestVideoSource`, keeping its unique
  unknown-video-404 case and dropping the two redundant tests.

### Applied: `require_clip_with_source` extraction (clip -> parent recording -> on-disk source, or 404)
`crud.py::clip_preview`, `edit.py::suggest_framing`, `edit.py::analyze_frames` each
repeated the same load-and-validate triple (`require_clip` + `db.get(Video)` 404 +
`Path(video.path).exists()` 404). Extracted `require_clip_with_source(db, clip_id) ->
(clip, video)` into `routes/common.py` beside `require_clip`. `clip_preview` keeps its
deliberate try/`db.close()` ordering. Covered by existing `test_videos.py` 404 suites.

### Keep as-is: clip-window offset math (`segment_start_s + start_ms/1000 + start_offset`) NOT extracted
`crud.py::clip_preview` and `edit.py::suggest_framing` compute this identically (3 lines
each), but the math is deliberately *divergent* project-wide - `export/window.py`/
`subtitles.py` work in ms and clamp to 0, `export/render.py` omits the segment offset
(source already segment-local), `analyze/frames.py` and these two routes work in seconds
off the untrimmed parent. A shared helper would be a wrong-abstraction attractor a future
segment-local caller could double- or un-shift (the exact class of bug Section 8 Phase 2
fixed). Duplication is the safer call.

### Keep as-is: `hotwords.py` / `sensitive.py` CRUD structural similarity NOT merged into a generic base
Same shape (list/create/update/delete, `_*_dict` serializer, `_validate_*_body`,
`with_write_retry`) but different domain rules (fields, validation, and a
`sensitive.py`-only `_rescan_all_clips` side effect). Coincidental structural
similarity, not duplicated knowledge; a generic base would bury the sensitive-term
PII/rescan specifics. Phase 2 already brought the one real behavioral gap
(`with_write_retry` parity) into line. No merge.

### Keep as-is: `_compute_time_estimate` (analyze.py) and `_migrate_transcript_to_segments` (videos.py) kept whole
Both exceed the ~30-line guideline but are single-concern. `_compute_time_estimate`'s
"measured rate overrides the static formula" block can't cleanly extract - fallback
formulas differ per stage and the `used_measured` flag's key set is conditional
(speakers only when `diarize`). `_migrate_transcript_to_segments`'s length is
field-count (12-field `AudioTrack` copy), not branching; its two load-bearing comments
(`extracted_path=None`, per-word offset shift) must stay co-located with the
segment-grouping context. Splitting either scatters shared state/comments for no gain.

### Keep as-is: long JS renderers / init-wiring functions NOT decomposed
`clips.js::renderDetail`, `videos.js::renderVideoDetail`, `clipexport.js::confirmExport`,
`analyze.js::initAnalyzeListeners`/`_doStartAnalyze` (50-135 lines) are each a single
HTML-template builder or the one-`addEventListener`-per-control init function the
codebase's "no DOM side-effects at module scope" rule mandates - no duplicated knowledge
across siblings. Churning them risks real UI behavior for marginal readability gain with
no defect driving it. Untouched.

## Phase 3 test coverage - full-app review section 8, web UI content & analysis (2026-07-26)

Closed the coverage gaps `REVIEW_OPEN_ITEMS.md` recorded against Section 8 Phase 1, plus
one mechanism gap noticed while checking Phase 2's job-blocked fix:

- **`videos-timeline.js` zero `tests/js` coverage** - added
  `tests/js/videos/videostimeline.test.js` (11 tests): `_renderTimelineHTML`,
  `_timelineEmptyNoteHTML`, `generateTimeline`, `closeTimelineIntervalModal`,
  `initVideosTimelineListeners`'s cancel/background-click wiring. No behavior changed.
- **`clipcreate.js`'s pure helpers untested and unexported** - exported
  `_ccParseTimeToMs`, `_ccFmt`, `_ccPickLine` (behavior-neutral) and added
  `tests/js/clips/clipcreate.test.js` (15 tests); reran `yuu-dev bundle`.
- **`TestReelPoolVideoIds` precedence gap** - only proved `video_ids` filtering worked,
  never that it supersedes a simultaneous `video_id` (reel.py:157's documented contract).
  Added `test_video_ids_supersedes_video_id_when_both_are_present` in
  `tests/integration/test_api_sessions.py`.
- **`applyJobBlockedState`/`data-job-blocked` had zero test coverage anywhere** - the
  underlying jobs.js mechanism (disable-while-active, why-tooltip, 2s post-job
  hide-delay, mid-job re-render re-disable) had never been tested at any tier. Added a
  `data-job-blocked buttons` block to `tests/js/core/jobs.test.js` (4 tests) and a
  `job-launching buttons carry data-job-blocked` block to
  `tests/js/videos/videodetail.test.js` (3 tests) pinning the 4 fixed buttons (Generate
  Summary, Generate/Regenerate Timeline, (Re-)score clips, Re-score failed clips).

Left alone (already deferred elsewhere, still in `REVIEW_OPEN_ITEMS.md`):
`clipbulk.js::_doBulkExportClips`'s outcome-blind `onDone` (unreachable dead path per
Phase 2), `test_ui_clipcreate.py`'s sleep-based timing assertion, and the three
test-tier-placement notes fixed above (were still open when this phase started).

## Phase 2 bug hunt - full-app review section 8, web UI content & analysis (2026-07-26)

Four fixes applied (each with a locking test); several items deferred to
`REVIEW_OPEN_ITEMS.md`.

### Applied (cross-section, resolves Section 5's carried-forward question): post-split segment audio path
`_migrate_transcript_to_segments` (the `migrate_clips=True` split path) created each
segment's `AudioTrack` with `extracted_path` copied verbatim from the parent's
full-recording WAV, while the segment's migrated transcript/clip times are 0-based
within the segment. `run_retranscribe` reads `track.extracted_path` at segment-relative
offsets with no `segment_start_s` added, so it would transcribe a window off by
`segment_start_s`, and a non-`force` reanalyze would `skip` re-extraction on the
existing-but-wrong path (`ingest.py::_extract_audio_and_check_rms_overlap` line 563).
Fix: set `extracted_path=None` on the migrated segment track, so `run_retranscribe`'s
existing guard skips it (keeping the correct migrated transcript) and a reanalyze
re-extracts segment-local audio. Preserves the invariant that a segment's only non-None
`extracted_path` is the segment-local one. `run_retranscribe` itself needs no change -
its offset-free math is correct once the audio is properly segment-local (unlike
`clip_preview`/`suggest_framing`, which always read the untrimmed parent and so always
add the offset). Locking test:
`tests/integration/test_videos.py::TestSplitVideoTranscriptMigration::test_migrated_segment_track_does_not_inherit_parent_extracted_path`.

### Applied: sensitive.py CRUD routes wrapped in `with_write_retry` (parity with hotwords.py)
`create/update/delete_sensitive_term` did a synchronous DB write + full-project
`_rescan_all_clips` commit with no retry, unlike the sibling `hotwords.py` CRUD routes
(wrapped 2026-07-25 because Settings' autosave-per-edit can land mid-analysis while the
subprocess holds the SQLite write lock). `static/library/sensitive.js` confirmed to
autosave the same way. Wrapped all three routes (`with_write_retry` re-raises
`HTTPException` so 404s still propagate). `sensitive_rescan_video` deliberately left
un-wrapped, matching un-wrapped sibling `scoring.py::hotword_rescan` (both explicit user
rescans, not autosaves). `test_sensitive.py` stayed green.

### Applied: videos.js video-detail job buttons carry `data-job-blocked`
`renderVideoDetail`'s Generate Summary, Generate/Regenerate Timeline, (Re)score-clips,
and Re-score-failed-clips buttons launch `reject_if_busy`-guarded SSE jobs but carried no
`data-job-blocked` and `renderVideoDetail` never called `applyJobBlockedState()` (unlike
`clips.js`/`reel.js`) - guarded only by `_blockedByAnalyze()`, which checks for an
ANALYZE job only, so any other running SSE job (export, another recording's
rescore/timeline) let a click tear down the live progress UI via
`_supersedeActiveStream()` and hit a 409. Tagged the four buttons + wired
`applyJobBlockedState()` into `renderVideoDetail`. `open-batch-export` NOT tagged - it
only opens a panel; the export confirm button inside is already tagged. Covered by full
`test-ui`.

### Applied: analyze.py `_measured_rates` shape-parsing guard
`/api/estimate`'s `_measured_rates` wrapped only `json.loads` + top-level key lookups in
`try/except`; the type-sensitive follow-on accesses (`device.get`, `settings.get`,
iterating `stages`) ran outside the guard, so a valid-JSON-but-wrong-shape
`analyze_run_json` raised `AttributeError`/`TypeError` and 500'd an endpoint the UI hits
on every analyze-config change. Moved the shape-dependent processing inside the `try`
and added `AttributeError` to the caught tuple. Locking test:
`tests/integration/test_analyze.py::TestMeasuredRates::test_wrong_shape_run_json_skipped_not_raised`.

---

## Phase 6 docs and comments - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Scope: `web/{app,deps,sse,analyze_job,media,file_deletion}.py`, `log.py`, `console.py`,
`hf_cache.py`, `url_import.py`, `project_archive.py`, `ffmpeg_tools.py`,
`track_labels.py`, `recent_projects.py`, `update_check.py`, `whisper_catalog.py`.
Grepped ~180 comment/docstring hits before reading; zero TODO/FIXME/XXX/HACK. One fix
applied (Phase 1's carried-forward item); everything else confirmed accurate and
load-bearing - the cleanest section reviewed so far, consistent with Phases 1/4/5.

### Applied: tests/unit/test_update_check.py's stale "until the repo is flipped public" comment
`test_http_error_returns_error_not_exception` explained a mocked 404 via "what an
unauthenticated request to a private repo returns... until the repo is flipped public" -
the repo flipped public 2026-07-26, same day, so already obsolete. Reworded to a
still-accurate reason a real GitHub release-tag lookup can 404 regardless of visibility
(no release published, or repo/tag renamed). Comment-only; test unchanged.

### Verified: project_archive.py's `_verify_restorable`/`_reject_unsafe_member`/`restore_into` comments (Phase 2 fix + Phase 5 logging) - accurate, no edit
`_verify_restorable` runs inside the first `zipfile.ZipFile` `with` block, entirely
before the overwrite-copy / old-DB-WAL-drop / second-`with`-extract sequence, matching
the inline comment's claim that an unsafe member must fail "cleanly and with the target
untouched." Phase 5's `_log.error` calls (member name, resolved path/target root for
zip-slip) are present and match what's raised. No drift.

### Verified: ffmpeg_tools.py's `_format_cmd_for_log`/`run_ffmpeg` (Phase 5's fix) - accurate; `_MAX_LOGGED_ARG_LEN = 200` needs no added comment
The docstring already explains the truncation *shape* (per-arg, not whole-line, "so a
single huge path can't hide the rest of the command"); the number itself is an
arbitrary-but-reasonable round threshold, same class of magic number as
`analyze_job.py`'s buffer-line cap or `recent_projects.py`'s `_KNOWN_PROJECTS_MAX = 20`,
neither of which carries a "why this number" comment either. Not adding one - padding,
not information.

### Terminology sweep - clean
Grepped `clip candidate|demo reel|\bsubtitle\b|\bProfile\b|RP context|\bslug\b|\bIngest\b|Probe`
across the whole scope: zero hits, and no user-facing strings in scope at all (every
user-facing message - `RestoreError`, `ImportUrlError`, `file_deletion.py::locked_files_error`'s
409 - independently re-checked while verifying the comments above).

### Confirmed clean, no findings: everything else in scope
`web/app.py`, `web/deps.py`, `web/sse.py`, `web/analyze_job.py`, `web/media.py`,
`log.py`, `console.py`, `hf_cache.py`, `url_import.py`, `track_labels.py`,
`recent_projects.py`, `whisper_catalog.py` - every comment explains a non-obvious WHY
(SQLite locking, the identity-keyed cancel-set design, share-delete media-serving
Windows constraint, cp1252/UTF-8 console rewrap, credential/path log redaction, HF-offline
gating) or a real external constraint (RFC 7233 range requests, Restart Manager API,
yt-dlp's progress-hook/URL-cleaning rules). `yuu-dev test-api` 3489 passed (unchanged
count - only a test comment touched), lint clean, 0 new mypy errors (typecheck not
re-run, no `.py` type surface changed).

---

## Phase 5 logging coverage - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Grep-first survey (`logger.`/`log.`/`_log.` calls, then bare `except`) over the same
scope as Phase 6/4/1. Fixed 3 real gaps; confirmed several checked-but-adequate areas a
future pass should not re-flag without new evidence.

### Fixed: `ffmpeg_tools.py::run_ffmpeg` errors now include the command line
Carried forward from Section 5's bug-hunt (deferred there since `ffmpeg_tools.py` wasn't
yet in scope). The raised `RuntimeError` on non-zero exit named only the tool and
stderr, not the argument list - not reproducible from the log alone. Added
`_format_cmd_for_log` (per-arg truncation at 200 chars, not a whole-line cap) folded
into the error message. Sole choke point every ffmpeg/ffprobe caller routes through
(`render.py`, `reel.py`, `extract.py`, `proxy.py`, `crud.py`, ...), so project-wide from
one edit. `tests/unit/test_run_ffmpeg.py` covers the repro-line content and truncation.

### Fixed: `web/media.py`'s streaming generator now logs before re-raising
`media_file_response`'s body generator (`_stream`) runs *after* Starlette has already
sent HTTP headers, so a failure inside it (e.g. Windows `CreateFileW` denying the
share-delete open) can't become an HTTP error response and bypasses `app.py`'s global
exception handler (guards on `response_started`). Before this fix such a failure had no
trace in the app's own log - only uvicorn's own ASGI traceback, invisible in a packaged
Electron build. Added try/log.exception/re-raise around the generator body; same
exception still propagates, now also lands in `yuu-clip.log`. `tests/unit/test_media.py`
(new) covers both this failure path and the previously-untested happy path.

### Fixed: `project_archive.py`'s restore-integrity rejections now log the specific cause
`_verify_restorable`/`_reject_unsafe_member` (Phase 2's data-loss fix) raise a
deliberately generic `RestoreError` for non-technical users, but that meant the actual
cause (which member failed CRC, or whose resolved path escaped the target dir) was lost
entirely. Added `_log.error` immediately before each raise, carrying the member name
(and, for zip-slip, the resolved destination + target root). Extended
`tests/integration/test_restore.py`'s existing `test_restore_rejects_zip_slip_member`
and `test_restore_rejects_corrupt_archive_before_touching_target` with `caplog`
assertions rather than adding new tests.

### Checked, no gap: `hf_cache.py`'s cache-check
`_consumable_models_cached`/`repo_cached` catch broad `Exception` and log at `debug`
("staying online") - correct, since a scan failure only forgoes an optimization and
never forces a wrong answer; a true "said cached, wasn't" mismatch would only surface
where the model is actually loaded, outside this module's job.

### Checked, no gap: `app.py`'s lifespan shutdown sequence
Already logs `info` before terminating each subprocess and `warning` before the 5s-kill
escalation (confirmed exercised in Phase 2). The one theoretical gap - `proc.kill()`
followed by an un-timed `await proc.wait()` - not worth a log: OS-level kill essentially
always takes effect immediately, and this would be a genuinely novel failure mode never
hit by this app.

### Checked, no gap: raw `logging.getLogger(__name__)` vs `yuu_clip.log.get_logger`
`hf_cache.py` and `recent_projects.py` use plain `logging.getLogger(__name__)` instead of
the wrapper used elsewhere in this section. Functionally identical - Python's logging
hierarchy keys by name string, and both files' `__name__` already equals what
`get_logger` would produce. Also the dominant pattern across the wider codebase (22
files under `yuu_clip/` use the raw form) - an established convention, not a one-off
inconsistency.

## Phase 4 refactor - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Structural survey (function-length + duplication grep) then full reads of every file in
the same section-7 scope. No code changes: uniformly well-decomposed, and Phase 2
already hardened the one complex file (`project_archive.py`'s restore-integrity path).
Two genuine duplicated-knowledge signals both have most call sites in out-of-scope
`web/routes/*.py`, deferred rather than half-migrated (see below). Test suite unchanged
from Phase 3's baseline (3485 passed) - no code touched, not re-run.

### `project_archive.py::restore_into` decomposition after the Phase 2 integrity fix - kept whole
The verify -> guard-overwrite -> extract sequence (Phase 2's `_verify_restorable` call
inside the first `zipfile.ZipFile` block, then overwrite/pre-restore copy, then a second
`with` for `_extract_members`) reads top to bottom at ~30 lines; the two zip opens are
deliberate (verify before touching the target, extract after) and the CRC/zip-slip/DB
checks are already extracted into named helpers. Splitting further would scatter
load-bearing ordering comments. **The atomic-write question for `track_labels.py`
(and `config.py`/`contexts.py`) was resolved in the 2026-07-26 follow-up pass - see the
"Follow-up fixes" section at the top of this file** (was: "remains a separate open item,
untouched here").

### `web/sse.py` cancelled/counted proc-tracking vs `web/analyze_job.py`'s AnalyzeJob state - deliberately separate, not duplicated
Two designs by intent (CLAUDE.md's "Subprocess cancellation" + the SSE typed-event
migration record): `subprocess_sse` tracks short stream-tied jobs via identity-keyed
`ctx.cancelled_procs`/`counted_procs` (killed on client disconnect); `AnalyzeJob` is a
reattachable broadcast buffer decoupled from any single stream (survives a refresh,
killed only on explicit cancel/shutdown). They already share the correct surface
(`terminate_process_tree_async`, `new_session_kwargs`, the `jobevents` wire helpers). No
merge.

### Deferred to the routes pass (Section 8/9): `_pkg_version("yuu-clip")` -> "unknown" block duplicated 4x
Verbatim in `project_archive.py::_app_version` (in scope), `web/app.py`'s module-level
`_PKG_VERSION` (in scope), `web/routes/updates.py` (out of scope), and a variant in
`dev/notices.py`. Genuine duplicated knowledge, but 2 of 4 sites are out of this phase's
scope - extracting now would half-migrate. Surfaced for a wholesale extraction when
`routes/updates.py` is reviewed, so every site converts and the routes pass picks the
home.

### Deferred to the routes pass (Section 8/9): "resolve within a base dir, reject traversal" duplicated
`media.py::resolve_within` (raises `HTTPException` 404) and
`project_archive.py::_reject_unsafe_member` (raises `RestoreError`) share the same
resolved-path-not-escaping-base shape, as do out-of-scope route sites
(`routes/reveal.py::_is_within`, `routes/backup.py`, `routes/projects.py`). Each raises a
domain-specific error (or returns a bool), so a shared primitive would be a pure
`is_within(base, target) -> bool` predicate the callers wrap. Same majority-out-of-scope
situation as the version block - deferred to the routes pass, not extracted here.

## Phase 1 test integrity - full-app review section 7, web plumbing + cross-cutting utilities (2026-07-26)

Scope: section-7 files above plus `whisper_catalog.py` (5 modules missing from
`REVIEW_MAP.md` entirely, folded in as cross-cutting utilities). Baseline green (3464
passed), stayed green - no changes. Strongest-tested scope so far: `test_sse.py`/
`test_url_import.py`'s cancel classes exercise the identity-keyed `ctx.cancelled_procs`
design directly (a stale entry from a different job's proc must not leak into a new
job's `done{cancelled}`); `test_restore.py` covers zip-slip rejection, a pre-restore
safety copy of the old DB, and schema-version rejection; `test_log_redact.py` asserts
the secret is actually absent from formatted output; `test_export.py`'s
`TestUnlinkWithRetry` drives a genuinely flaky mocked `Path.unlink` rather than mocking
away the retry loop. No vague names, tautologies, order dependence, or fragile
snapshot/log-line assertions found.

### `TestSubprocessSseTracksActiveJob`/`TestSubprocessSseCancel` in test_url_import.py duplicate test_sse.py - surfaced, not fixed
Re-exercised the same generic `web/sse.py::subprocess_sse` identity-keyed cancel
behavior already covered by `test_sse.py::TestSubprocessSseTypedWire`. Same shape as the
`TestProfiles`/`TestProfileFunctions` precedent below (and the `TestSafeFilename`
precedent from Section 6): a test-integrity pass fixes fragility, not cross-tier dedup -
flagged for a future dedup pass rather than merged unprompted.

### Coverage gaps noted for the Phase 3 pass, not addressed here
- `tests/integration/test_analyze.py::TestGracefulShutdown` covers `ctx.analyze_proc`/
  `ctx.subprocess_procs` termination on shutdown but never sets `ctx.analyze_job.proc`
  (the `AnalyzeJob`-tracked path `web/app.py`'s `lifespan` also terminates) - a real test
  gap, not fragility.
- `file_deletion.py`'s `_rm_locking_processes` (the Restart Manager ctypes call) has no
  unit test - inherently hard without deeply mocking ctypes/WinDLL; the surrounding
  `locking_processes`/`locked_files_error` behavior is tested via monkeypatching it out,
  a pragmatic boundary.
- `console.py` (stdout/stderr UTF-8 rewrap + `BYTES_PER_MB`) has no dedicated test - low
  value for a two-line import-time encoding shim.

## Phase 6 docs and comments - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Scope: `db/models.py`, `config.py`, `model_catalog.py`, `contexts.py`,
`content_presets.py`, `sessions.py` (HIGH), the `cli/` adapters (MEDIUM), spot-check of
`dev/{chaos,tests,shareddata,fixture}.py` (LOW). ~460 comment/docstring hits grepped
first; zero TODO/FIXME/XXX/HACK anywhere in scope. One terminology-drift fix applied;
both brief-flagged verification items confirmed clean. `yuu-dev test-api` 3464 passed
(unchanged), lint clean, 0 new mypy errors.

### Applied: cli/export.py's two `--help` strings said "Clip candidate ID", not "Clip ID"
`export` (line 24) and `retranscribe` (line 93) used the code name (`ClipCandidate`)
instead of the glossary term ("Clip" - see GLOSSARY.md), while the error message two
lines below each and `cli/reel.py:21`'s `--clip-id` help already used the correct term.
Reworded both to "Clip ID to export" / "Clip ID" - text-only, no test pinned the old
string. `cli/reel.py:172` and `config.py:658`'s internal "clip candidates" usages left
as-is - correct code-level usage per the glossary's own code/UI split, never shown to a
user.

### Verified: the two brief-flagged comments from Phase 4 are both correct and load-bearing
1. config.py's relocated AI-privacy comment (lines 472-477, heading
   `AiPermissions`/`resolve_ai_permissions`) reads cleanly in its new spot, explicitly
   says "Enforced everywhere a language model could run, via resolve_ai_permissions
   below," no dangling reference to the deleted `validate_ai_privacy_mode`.
2. db/models.py's `_prefer_user_value` helper (lines 62-67) carries the claimed WHY
   docstring ("keyed on `is not None`... so a deliberately-blank user override still
   wins"), present and accurate.

### Terminology sweep - one drift found and fixed (above), everything else clean
Grepped `\bprofile\b|RP context|clip candidate|demo reel|\bsubtitle\b|\bProbe\b|slug`
across the whole scope. All other hits are non-issues: `cli/analyze.py`'s `probe`
command (CLI name unchanged, already anchored verbatim in GLOSSARY.md);
`contexts.py:136`'s internal docstring use of "slug"; `cli/models.py:18`'s unrelated
Tier-B model-catalog "slug" concept. No `RP context`/`demo reel`/bare-`subtitle` hits in
user-facing text.

### Confirmed clean, no findings: everything else in scope
`db/models.py`, `model_catalog.py`, `content_presets.py`, `sessions.py`, and the
remaining `cli/` adapters - every comment explains a non-obvious WHY (SQLite locking
tuning, JSON NULL-vs-empty persistence contracts, additive-migration no-FK pattern,
threshold-tuning history, licence-rejection rationale) or a real external constraint
(OBS filename format, HF revision pinning, the update-check's no-telemetry guarantee).
The `dev/` LOW-tier spot-check showed the same pattern - consistent with Phase 1/4/5's
characterization of this whole section as unusually clean coming in.

---

## Phase 5 logging - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Grep-first survey then full reads of the zero/thin-logging files across the section-6
scope plus a LOW spot-check of `dev/{bundle,migrate,chaos}.py`. One real gap fixed, one
dead-code line removed, everything else confirmed correct or deliberately silent.
`yuu-dev test-api` 3464 passed (3463 baseline + 1 new), lint clean, 0 new mypy errors.

### Applied
- **cli/reel.py: `_select_reel_clips` now logs + prints when an explicit `--clip-id` is
  not found.** Previously silently dropped any requested ID with no DB row - reachable
  via `routes/reel.py`'s `/api/demo/start` (a race: a clip gets deleted/exported/mistyped
  between the route's pre-check and this subprocess's query, since the route passes the
  raw `req.clip_ids` through, not its own filtered list). Now logs
  `log.warning("Reel: requested clip ID(s) not found in this project, skipping: %s",
  missing)` plus a console note. Behavior unchanged (still skips, doesn't fail the reel).
  Added `test_explicit_clip_ids_unknown_id_is_logged_and_printed` in
  `tests/integration/test_cli_reel.py`.
- **cli/_base.py: removed the unused `log = get_logger(__name__)` module-level logger.**
  Zero importers repo-wide, no `log.*` calls in the file itself. `configure_logging`/
  `console` stay (both genuinely used). Dead code, cleaned up in passing since it's this
  phase's own file (`log.py`'s `get_logger`).

### Confirmed already correct, no change needed
- **config.py's `_sanitize_*` load-path warnings already name the field, the invalid
  value, and the fallback default on every branch.** `whisper_model`/`whisper_language`
  are deliberately NOT healed on load - a bad hand-edited value raises a clear
  `ValueError` at point of use instead, a legitimate "fail loud where it's used" design
  already covered by tests.
- **model_catalog.py: an unknown `model_id` does not silently fall through to a
  default.** `model_by_id` is a pure `dict.get` with exactly two real callers
  (`web/routes/llm.py`, out of scope; `cli/models.py::_resolve_gguf_entry`), which
  already turns a miss into a clear error message printed in red with exit 1.
- **content_presets.py and sessions.py stay log-free** - both pure in-memory logic with
  no failure mode to log, matching the `describe_basic.py` precedent.
- **db/models.py has no logging of its own, as expected for an ORM layer.**
- **dev/{bundle,migrate,chaos}.py spot-check - subprocess error handling already
  solid.** `bundle.py` raises `RuntimeError` with captured esbuild output + an "npm
  install?" hint on failure; `migrate.py`'s unhandled Alembic tracebacks are themselves
  diagnosable in a dev-only human-run tool; `chaos.py` already has its own extensive
  per-phase try/except-and-report machinery. `deps.py::lock_deps` also already reports
  pip failures with an exit-code-preserving message.

---

## Phase 4 refactor - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Structural survey (function-length heat map + duplication-signature greps) then targeted
reads of `db/models.py` (914 lines), `config.py` (939), plus flagged candidates across
the section-6 scope. Two changes applied; suite stayed at 3463 passed before and after,
lint clean, 0 new mypy errors.

### Applied - two changes
1. **config.py: deleted the dead `validate_ai_privacy_mode` function and
   `ALLOWED_AI_PRIVACY_MODES` constant** (Phase 3's flagged dead-code item). Zero
   callers anywhere (repo, tests, `__all__`); the constant was referenced only inside
   the dead function. It mirrored `ALLOWED_WHISPER_LANGUAGES`/`validate_whisper_language`,
   but `web/routes/config.py` validates simple enums through a generic
   `_enum_validator({...}, label)` table (`ai_privacy_mode` at line 248) and imports
   dedicated `validate_whisper_*` functions only for fields needing normalization beyond
   membership - `ai_privacy_mode` is plain 2-value membership, so a dedicated validator
   was architecturally unnecessary speculative symmetry. The useful "none vs
   local_only, discriminative vs generative" comment was preserved by relocating it to
   head the `AiPermissions`/`resolve_ai_permissions` block. No behavior change.
2. **db/models.py: extracted `_prefer_user_value(user_value, generated_value)`** for the
   override-precedence rule (`user if user is not None else (generated or "")`)
   duplicated verbatim across six `effective_*` accessors (Video/RecordingSession
   title+summary, ClipCandidate description+description_long). Real duplicated
   knowledge (the `is not None` vs truthiness distinction is a domain rule). Carries a
   WHY docstring. Values byte-identical.

### Section 9 note (not actioned here): routes/config.py's inline ai_privacy enum is CORRECT as-is
Phase 3 suggested importing a config.py constant for this - now MOOT since the constant
is deleted, and the inline form matches every other simple-enum field in that validation
table (`whisper_device`, `llm_backend`, `scorer_laugh_mode`, ...). No Section 9 action
needed.

### Keep as-is: db/models.py's ~8 JSON encode/decode `@property`/`@setter` pairs - not collapsed to a descriptor factory
The getters look uniform but the setters encode genuinely different empty-value
persistence contracts - `words.setter` writes SQL NULL when empty
(`json.dumps(value) if value else None`) while others always write the empty container
(`"[]"`/`"{}"`), and getters split three ways. A single descriptor factory would need
enough parameters to stop being simpler, and would risk silently changing the
`words_json` NULL-vs-"[]" representation callers depend on. Duplicated shape, not
duplicated knowledge. Do not re-flag as DRY without new evidence.

### Keep as-is: Speaker vs ProjectVoice `display_name`/`display_color` - not merged
Different domain rules, not the same rule twice: `Speaker.display_name`/`display_color`
resolve through the linked Person (`global_voice`) first (naming/recolouring a Person
flows to every member recording), then fall back to the Speaker's own value;
`ProjectVoice.display_*` has no Person-linking precedence. The one genuinely-shared
fragment (the palette-cycling fallback one-liner) appears in exactly two places, below
the rule-of-three. Not a finding.

### Keep as-is: cli/analyze.py's "force default diarization backend on" snippet - not extracted
The `if config.diarization_backend == "null": config.diarization_backend =
"speechbrain"` flip appears in exactly two commands (`analyze`'s `--diarize` override,
`rediarize`), below the rule-of-three, each with its own explanatory comment. The
`ingest.py` hit for the same string is a different check (skip diarization when off),
not this force-on flip. Revisit if a third force-on site appears.

### Clean coming in - no change: config.py, model_catalog.py, contexts.py, content_presets.py, sessions.py, the CLI adapters, dev/
`config.py`'s `validate_*`/`_sanitize_*` functions are already well-decomposed. The
`cli/` commands are thin Typer adapters (parse args -> build config -> delegate); most
line count is unavoidable `Option(...)` declarations, not misplaced logic. `dev/` LOW
spot-check showed nothing glaringly wrong.

---

## Phase 1 test integrity - full-app review section 6, data model/config/catalogs/CLI (2026-07-26)

Scope: section-6 files (HIGH+MEDIUM) plus all 20 `yuu_clip/dev/` tooling modules (LOW).
Baseline green (3436 passed), stayed green - no changes. Already clear, behavior-named,
free of the usual failure modes (no tautologies, swallowed assertions, order dependence;
the `datetime(2026, 7, 4, ...)` literals in `test_sessions.py`/`test_sessions_timeline.py`
are fixed parse-function input/output pairs, not now-relative clock assertions).

### `TestProfiles`/`TestProfileFunctions` track-layout duplication - surfaced, not fixed
`tests/unit/test_config.py::TestProfiles` and
`tests/integration/test_profiles_contexts.py::TestProfileFunctions` both cover
`track_labels.py` save/load/delete round-trips end to end (near-identical bodies,
different monkeypatch mechanics), and `TestProfileFunctions` needs neither `client` nor
`project_dir` so could live in the unit tier. Left as-is, matching the `TestSafeFilename`
precedent - a test-integrity pass fixes fragility, not cross-tier dedup; flagged for a
future dedup pass.

## Phase 6 docs and comments - full-app review section 5, clip generation + export/reel (2026-07-26)

Scope: `segments/{windower,visual_windower,scene_segmenter,merge}.py`,
`export/{render,naming,presets,paths,window}.py`, `reel.py`. ~140 comment/docstring hits
grepped before reading full files; no TODO/FIXME/XXX/HACK. Zero changes made - every
comment earns its place per Phases 1/4/5's own read-throughs (Phase 4's refactor already
rewrote docstrings while extracting helpers; Phase 5's logging pass added summary logs,
not comments).

### Verified: reel.py's `_segment_start_times`/`_build_xfade_cmd` docstrings are accurate and current
The one comment this section flagged going in. `_segment_start_times` (reel.py:~562)
states: "This is the single source of that offset: `_build_xfade_cmd` feeds these same
values to ffmpeg as the xfade offsets, and the burned-in caption timeline is shifted by
them - computing the clamp in two places is exactly what drifted the captions before."
`_build_xfade_cmd`'s inline comment (reel.py:~310) points back the same way. Both match
the actual code post-Phase-4 (the xfade builder calls the helper, no duplicated formula
remains). No edit needed.

### Terminology check: `scene_segmenter.py`'s "LLM transcript-segmentation generator" is not a glossary violation
GLOSSARY.md bans "segmentation" only in user-facing text for "Clip generation"
(`generate_candidates()`); this is an internal module docstring for a different feature
(LLM scene-boundary proposal, `kind='scene'` rows), and the filename itself uses
`segmenter` as a code identifier. Not a drift case.

### Confirmed clean, no findings: every other file in scope
`segments/windower.py`, `visual_windower.py`, `merge.py`; `export/naming.py`,
`presets.py`, `paths.py`, `window.py`; the rest of `render.py` and `reel.py`. Every
comment explains a non-obvious WHY (algorithm choice, ffmpeg pitfall, a
drifted-behavior warning) or a real external constraint (libass PlayRes, ffmpeg
timebase mismatches, concat demuxer quote-escaping, Windows drive-letter colons). The
top-of-file `# Feature-map - Export: ...` headers on `paths.py`/`window.py` match a
widespread codebase convention (~20+ modules), not an orphaned style.

---

## Phase 5 logging - full-app review section 5, clip generation + export/reel (2026-07-26)

Logging-coverage phase over `segments/{windower,visual_windower,scene_segmenter,merge}.py`,
`export/{render,naming,presets,paths,window}.py`, `reel.py`. `yuu-dev test-api` 3436 passed
(3427 baseline + 9 new), lint clean, 0 new mypy errors.

### Applied
- `render.py::_finalize_export`'s `except (RuntimeError, ValueError)` now logs `exc_info=True`
  - the `try` spans several distinct ffmpeg-touching calls; the traceback now identifies which
  one raised.
- `render.py::run_retranscribe`'s per-track loop (ffmpeg extraction + `transcriber.transcribe`)
  now wraps in `try/except Exception: log.error(..., exc_info=True); raise` - previously the
  only unpaired failure path in the file. Re-raises unchanged, pure logging addition.
- `reel.py::compile_demo`'s `try` now starts before `_resolve_clip_files`, not after - the
  missing-export `FileNotFoundError` (the most common real-world reel-build failure) used to
  escape the function's own `except Exception: _log.error(..., exc_info=True)` block.
- `reel.py`: swapped `logging.getLogger(__name__)` for `yuu_clip.log.get_logger(__name__)` -
  matches sibling files' convention.
- `naming.py::export_base_stem`'s silent `except (KeyError, IndexError, ValueError): stem =
  _default_stem(...)` now logs a `warning` with template/clip id/exception before falling
  back. The fallback itself stays intentional (Phase 4 kept it so a stale/hand-edited template
  won't break export) - only the silence was the gap.
- `segments/visual_windower.py::generate_visual_candidates` + `segments/merge.py::merge_candidates`
  gained the same one-line INFO summary every sibling candidate-generator already had
  (motion/scene-cut counts -> candidate count; visual-candidate count -> kept count broken down
  by transcript-dedup vs cap). Both only run under opt-in `visual_candidate_mode`
  (gaps/parallel), so no default-install spam.

### Confirmed and deliberately left as-is - do not re-flag
- `export/render.py` and `reel.py`'s `console.print`/`print()` calls carry no parallel `log.*`
  call, by design - both modules' docstrings say the prints ARE the SSE interface; `web/sse.py`'s
  `subprocess_sse` already forwards every stdout line to the file log at `debug` and logs
  command+exit code at `error` on failure. Do not propose converting these prints to `log.*`.
- `export/presets.py`, `export/paths.py`, `export/window.py` carry no logging - correct: pure
  validation/lookup modules whose every failure raises a `ValueError`/`HTTPException` straight
  to the caller, the right surfacing point.
- `segments/windower.py` and `segments/scene_segmenter.py` already had adequate logging
  (one-line INFO summary per call; the LLM-chunk failure in `scene_segmenter.py` is a bounded,
  non-spammy `warning`). Nothing added.
- The `run_ffmpeg`/`find_ffmpeg` choke point (`ffmpeg_tools.py`) not logging the failing
  command's args is out of this section's scope - `run_ffmpeg`'s `RuntimeError` carries the
  tool name and ffmpeg stderr but not the arg list; this phase's exc_info=True/widened-try
  mitigations make the traceback identify the call site even without it. An args-in-the-error
  fix belongs to whichever section owns `ffmpeg_tools.py`.

---

## Phase 4 refactor - full-app review section 5, clip generation + export/reel (2026-07-26)

Refactor-for-quality phase over the same files. Three behavior-preserving refactors applied;
3427 passed before and after, lint clean, 0 new mypy errors.

### Applied - three refactors
1. `reel.py`: `_build_xfade_cmd` now calls `_segment_start_times(durations, trans_dur)` instead
   of recomputing the xfade-offset clamp inline with its own `cumulative` accumulator - the
   exact formula `_segment_start_times` already computes for the caption timeline, and the two
   had just drifted (Phase 2). Values byte-identical; docstrings on both updated to name the
   single-source relationship.
2. `paths.py`: `all_sidecar_paths` now delegates SRT collection to `srt_sidecar_paths` instead
   of inlining the identical glob-escape-stem + merged-`{stem}.srt` logic - now
   `[*export_paths(...), *srt_sidecar_paths(...)]`. Same output.
3. `render.py`: extracted `_export_settings_dict` out of the ~95-line `_finalize_export` - the
   clip_exports settings-JSON build (caption-style + preset-encode fields) is now a pure,
   directly-testable helper, closing the Phase-3 coverage gap on that block. Pure move.

### Keep as-is: `windower.py::_silence_window` (~83 lines) - not decomposed
A single cohesive concern (group merged transcript segments into windows by silence
gaps/hard splits) built around a `_flush` closure mutating window accumulators via
`nonlocal`; extracting would scatter one algorithm across helpers/args for no legibility
gain. High line count alone is not a re-flag trigger here.

### Keep as-is: `render.py::_finalize_export`'s cut-dispatch branch - kept inline
The `preset is not None` -> `export_clip_with_preset` vs `export_clip` branch stays inline
rather than becoming a `_run_cut(...)` helper: its ~10 collaborators (video_path, start/end_ms,
clip_dest, preset, subtitle paths, audio index, caption_style, crop_x, precise/title_card) are
all live local state, so extracting would relocate a wall of kwargs without reducing coupling.
Both encode paths already have direct behavior tests. Revisit only if a third cut path appears.

### Clean coming in - no change: naming.py, presets.py, merge.py, scene_segmenter.py, visual_windower.py, export/window.py
All conform to the 30-line/duplication/one-concern standards already. `naming.py::export_base_stem`
is long but a flat placeholder-by-placeholder render with a documented fallback contract (one concern).

---

## Phase 1 test integrity - full-app review section 5, clip generation + export/reel (2026-07-26)

Baseline green (3388 passed) before and after. One real gap fixed; one item resolved; rest
clean coming in.

### Fixed: `tests/unit/test_title_card.py`'s real-ffmpeg tests ran unconditionally in the unit tier
6 tests (`test_title_card_simple` + siblings, plus `test_fontfile_single_quoted_escaped_colon`)
called real ffmpeg with no `skipif(shutil.which("ffmpeg") is None, ...)` guard, unlike the
established `requires_ffmpeg` pattern (`tests/integration/test_export_presets.py::TestPresetEncodeIntegration`)
- would fail with a confusing subprocess error, not a clean skip, on a machine without ffmpeg.
Split the file the same way: real-encode tests moved to new `tests/integration/test_title_card.py`
(`requires_ffmpeg`-guarded); `tests/unit/test_title_card.py` keeps only pure/mocked-ffmpeg
tests. Same 27 tests total.

### Resolved (not deferred again): `TestRenderExport`'s call-count-only mocking is the right shape
`render_export` (export/render.py) is a pure 7-collaborator orchestrator (retranscribe gate ->
path resolve -> caption-style resolve -> subtitle staging -> finalize/cut -> sidecar emission)
whose own docstring says its entire job IS the wiring. Decision: keep the call-count
assertions - correct granularity for an orchestrator. Every mocked collaborator has its own
direct test elsewhere (`_write_export_subs`->`TestWriteExportSubs`, `_resolve_caption_style`->
`TestResolveCaptionStyleWordHighlight`, `_build_export_path` naming->`TestExportBaseStemPreset`,
`run_retranscribe`'s diarization sub-call->`test_diarization.py::TestRetranscribeDiarization`),
and the real end-to-end path runs for real in `tests/system/conftest.py` +
`tests/integration/test_export_presets.py::TestPresetEncodeIntegration`. Do not re-flag
without new information.

### `TestVerifyExportDuration`'s tolerance-boundary gap is out of this section's scope
`TestVerifyExportDuration` (`tests/unit/test_export.py`) tests `analyze/extract.py::_verify_export_duration`,
not anything in `export/`. That coverage gap is a Phase-3 item for whichever section owns
`extract.py`, not Section 5. **Closed 2026-07-26 (follow-up pass): an exact-boundary test was
added - see the "Follow-up fixes" section at the top of this file.**

### Scope-boundary check: which `tests/unit/test_export.py` classes belong to which section
`test_export.py` is shared three ways by import target (verified each class's actual import,
not filename). In scope here (export/render.py, export/window.py, export/naming.py, reel.py):
`TestWriteExportSubs`, `TestRenderExport`, `TestResolveCaptionStyleWordHighlight`,
`TestComputeExportWindow`, `TestEmptyTrimWindow`, `TestReelEsc`, `TestBuildXfadeCmd`,
`TestResolveClipFiles`, `TestRefreshCaptionSidecars`, `TestExportBaseStemPreset`. Out of scope
(import `analyze.extract` - Section 1/2's, or `web.*` - Section 8/9's): `TestBuildClipCmdOrdering`,
`TestSubtitlesFilter`, `TestCaptionStyleInExportCmd`, `TestVerticalCropFilter`,
`TestVerifyExportDuration`, `TestFfmpegPath`, `TestExportClipPublicApiCommand`,
`TestShareDeleteMediaServing`, `TestUnlinkWithRetry`, `TestLockedFilesError`,
`TestRunExportSubprocessCleanup`. Recorded so a future pass doesn't re-derive the split.

---

## Phase 6 docs and comments - full-app review section 4, scoring - LLM backend (2026-07-26)

Docs-and-comments phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`. One
accuracy fix; nothing to delete - scope came in exemplary, consistent with Phases 1/4/5.

### The `build_basic_description` docstring understated its own contract - fixed
Was: "Returns `("", "")` when the excerpt has no usable content and the clip isn't a textless
visual candidate" - describes only the first early-return. A second path (`describe_basic.py`)
falls through to the same `return "", ""` when the excerpt IS non-empty but yields no speaker
names, no keywords, and no dimension clearing `_DIMENSION_FLOOR` (e.g. a short
anonymous-speaker exchange with sub-threshold scores). Reworded to cover both. Pure docstring fix.

### The three CLAUDE.md-flagged load-bearing comments - verified accurate, left untouched
1. `llm_client.py`'s "Never surface the absolute path here" comment on
   `LlamaCppServerClient.available()`'s missing-model-file branch, re-checked against the
   sibling `resolve_server_binary` branch, which at the time of this phase did NOT follow the
   same redaction discipline (see Phase 5's finding below). **RESOLVED elsewhere, verified
   against current code**: the asymmetry is gone - `LlamaCppServerClient.available()`'s
   `except LlamaServerError as exc` branch now carries a matching "Match the missing-model
   branch above" comment, logs `log.warning(...)`, and returns a generic UI string instead of
   `str(exc)`. Both branches now follow the same discipline.
2. `llamacpp_server.py`'s gpu-layers auto-fit comment ("gpu_layers == -1 means auto-fit...
   forcing all layers can OOM a small card") still exactly matches its guard
   (`if gpu_layers >= 0: args += ["--n-gpu-layers", ...]`). Untouched.
3. Local-only/no-remote-backend module docstrings (`llm.py`, `llm_client.py`) still accurate;
   `_BACKEND_CLIENTS` has exactly one entry (`llamacpp`).

### `find_related_clips`'s docstring - RESOLVED (was: deliberately left imprecise)
Docstring said only "Raises on LLM failure," omitting that it also raised (`KeyError`/`ValueError`)
on a malformed candidate item, unlike `request_scene_boundaries`'s skip-bad-items loop. **Fixed
2026-07-26 (follow-up pass, owner decision):** `find_related_clips` now skips a malformed item
and keeps the rest, matching its siblings, and its docstring says so - see the "Follow-up
fixes" section at the top of this file. No longer an open parse-robustness gap.

### `completion_text`'s one-line docstring is a literal restatement - kept anyway
Says nothing the function name/one-line body (`data["choices"][0]["message"]["content"]`)
doesn't already say. Left in place as a harmless outlier in an otherwise fully-docstringed
file; not worth its own diff. A future pass may delete it in passing.

### Terminology sweep - clean
"LLM scoring" matches glossary. The lone `"Settings -> AI privacy"` string (no "LLM scoring"
prefix/"mode" suffix) matches the literal `<label class="settings-label">AI privacy</label>`
UI text and `routes/llm.py`'s identical usage - a deliberate app-wide phrase, not drift.

---

## Phase 5 logging - full-app review section 4, scoring - LLM backend (2026-07-26)

Fixed a real gap (privacy-off vs genuine backend failure were indistinguishable in the log -
`LLMScorer._mark_off_once` and `_wait_healthy`/`_stop` exit-code/timeout/evicted-model
additions in `llamacpp_server.py`). Remaining items are deliberate-silence anchors.

### `describe_basic.py` has zero logging - deliberate, not a gap
Pure in-memory template assembly over an already-loaded `ClipCandidate` row, no I/O, no
external call, no exception path that isn't a programmer error. Do not re-flag.

### `check_llm_available` / `check_vision_available` stay silent by design
Both are read-only pre-checks (llm.py) called from routes on cheap/frequent poll paths -
logging every call would be poll-loop spam. The one-time-per-run WARNING/INFO logging lives
one layer down, in `LLMScorer.is_available()` and `LlamaCppServerClient.available()`'s callers
(once per analyze/rescore, not per poll). Do not add logging to the two check_* functions.

### The GPU health-poll loop (`_wait_healthy`) is deliberately silent per-tick
Logging every 0.5s tick for up to 240s would be ~480 lines of noise; it already logs once on
entry and once on exit (success/failure, the latter carrying this phase's new
exit-code/timeout detail). Right altitude - do not add a per-poll line.

### RESOLVED elsewhere (was: needs a human decision): `LlamaCppServerClient.available()`'s binary-resolution reasons leaked the configured path into UI text
Original finding: `available()` caught `LlamaServerError` from `resolve_server_binary`/
`_binary_in_bundle` and returned `str(exc)` verbatim as the UI-facing `reason`, interpolating
the full configured/bundle path - unlike the sibling missing-model-file branch, which
deliberately keeps the path out of the reason. The log file itself was never at risk
(`_SanitizingFormatter` redacts `\Users\<name>\`), but the same string also reached routes
that render it in the UI, unredacted. Flagged as a UX/privacy trade-off needing a human call.
**Verified against current code: fixed.** The `except LlamaServerError as exc` branch now logs
the raw exception via `log.warning(...)` and returns a generic reason ("The local AI engine
(llama-server) could not be started - reinstall yuu-clip, or set its path under
Settings -> LLM scoring."), with a comment explicitly matching the missing-model branch's
discipline. No further action needed; do not re-flag.

---

## Phase 4 refactor - full-app review section 4, scoring - LLM backend (2026-07-26)

The highest-scrutiny hard AI-backend seam (`LLMClient` ABC + `make_client` factory). No code
changes warranted - clean coming in (Phase 1: "exemplary"; Phase 2: privacy trust boundary
intact with 3 defense-in-depth layers; Phase 3: 12 tests added).

### Seam integrity re-verified at the highest scrutiny level - no violation
Grepped `LlamaCppServerClient|NullLLMClient|LlamaServerPool(` in `llm.py` - zero hits; every
client construction goes through `make_client(config)`. No caller-side `if backend == ...`
dispatch anywhere in scope; `available() -> (ok, reason)` is called only through the interface.
Does not reproduce the Section-2 DiarizationClient finding - exemplary.

### The three read-side generative-AI pre-checks are deliberate defense-in-depth - NOT DRYed
`check_llm_available`, `check_vision_available` (shared preamble), and `LLMScorer.is_available`
each re-check the `llm_enabled`+`allow_llm` gate before delegating to the seam's `available()`.
This is a privacy trust boundary (`resolve_ai_permissions`); the real enforcement point is
`make_client` (returns `NullLLMClient` when generative AI is off). Each independently
re-asserting the gate is intentional layering (Phase 2's "3 independent defense-in-depth
layers") - collapsing them into one helper would turn independent checks on a trust boundary
into a single point of failure. Explicitly out of bounds for a routine refactor per this
section's brief. Do not re-flag as DRY.

### The vision-availability pre-check inlines llamacpp path checks - kept, single-backend
`check_vision_available` probes `llm_vision_model_path`/`llm_mmproj_path` existence inline
rather than delegating to a new `vision_available()` seam method. There is exactly one
backend, and the knowledge already lives behind the seam as the hard backstop
(`LlamaCppServerClient.chat_vision` raises `VisionNotSupportedError` with the same checks -
the documented "cheap pre-check + hard backstop" split). Adding a seam method for one
implementation is speculative generality. Promote-to-seam trigger: a second LLM backend with
different vision-availability semantics.

### `_DEFAULT_MAX_TOKENS = 1024` duplicated across llm_client.py and llamacpp_server.py - kept
Both are live defaults on different layers (client interface vs server pool) carrying
"matches the other" cross-reference comments; unifying would force an unwanted import
direction between the two. Below the rule-of-three; not a magic-constant drift risk without a
third occurrence or concrete bug.

### The two known parse-robustness gaps - RESOLVED (were: human-decision items, not touched here)
`find_related_clips` (raised on a malformed item, unlike `request_scene_boundaries`'s
skip-bad-items) and `summarize_transcript`/`describe_clip` (lacked an `isinstance(dict)` guard
on parsed JSON) were both pinned as human-decision items - a refactor pass must not silently
change which inputs raise vs degrade without a decision. **Both resolved 2026-07-26 (follow-up
pass, owner decision):** `find_related_clips` now skips bad items and keeps the rest;
`describe_clip`/`summarize_transcript`/`summarize_session` now validate `isinstance(dict)`
before `.get()`. See the "Follow-up fixes" section at the top of this file.

---

## Phase 1 test integrity - full-app review section 4, scoring - LLM backend (2026-07-26)

Baseline green (3370 passed) before and after - no code or test changes warranted. Full reads
of `llm_client.py` (privacy-mode choke-point) and `llamacpp_server.py` (process pool, the
`--n-gpu-layers` OOM landmine site) plus every test file in scope.

### Privacy-mode enforcement tests are exemplary - the spy pattern is the right shape
`test_privacy_modes.py::TestMakeClientEnforcement::test_none_never_constructs_any_client`
patches `LlamaCppServerClient.__init__` with a spy and asserts it's never called under
`ai_privacy_mode="none"` - proves the untrusted path never even instantiates the real client
(construction-time proof, not a type-check a mock could satisfy accidentally). Template for
any future privacy-gate test.

### The gpu-layers OOM landmine is directly and correctly pinned, not encoded as "correct"
`test_llamacpp_server.py::TestBuildArgs` pins `gpu_layers=-1` (autofit) omits
`--n-gpu-layers` entirely, CPU passes `0`, forced layer count uses an arbitrary `20` (never
`99`). Cross-checked `llamacpp_server.py` source directly - no hardcoded `99`/forced-max-layers
path exists.

### Concurrency tests use real threads + `Event.wait(timeout)`, not sleep-based polling - correct pattern
`TestPool::test_shutdown_not_blocked_during_health_wait` /
`test_inflight_request_not_killed_by_concurrent_new_key` synchronize via `threading.Event`
with a generous timeout, never a bare `sleep()` race. Already in place, not a finding.

### No vestigial remote/hosted-backend references anywhere in scope
Grepped `anthropic|Claude|remote_ai|remote_ok` across `llm.py`/`llm_client.py`/
`test_scoring_llm.py`/`test_privacy_modes.py` - zero hits. The 2026-07-15 Claude/Anthropic
removal left no dead code or stale fixture here.

### Minor stylistic nit, not fixed
`test_scoring_llm.py::TestCallLlmJson::test_max_tokens_threaded_to_client` asserts a
positional arg index (`call.call_args.args[3] == 2048`) rather than kwarg-based - tests real
behavior, left as-is, recorded so a future pass doesn't re-derive that it was considered.

---

## Phase 6 docs and comments - full-app review section 3, scoring (2026-07-26)

Docs-and-comments phase over the 17 signal-scorer/aggregation files
(`scoring/{energy,prosody,speechrate,churn,lexicon,textmatch,laugh,audio_event,scenes,visual,
wav_access,protocol,scorer_set,engine,dedup,similarity,term_scope}.py`). No code changes
warranted - zero restatement/obsolete/reactive/apology comments and no aging TODO/FIXME/HACK
found anywhere; matches Phase 1's "unusually clean" call and Phase 4's note that prior
WS-A..D refactors already reshaped this section.

### `engine.py::_run_scorers`'s laugh special case - comment present and clear
The `scorer.name == "laugh"` branch already carries the WHY comment Phase 4's keep-decision
promised. No addition needed.

### Formula/threshold comments distinguish WHY from WHAT throughout
Spot-checked every numeric constant with an adjacent comment (prosody.py's CoV saturation
points, speechrate.py's CALM/FAST WPS bounds, churn.py's switches-per-minute saturation,
energy.py's downsample-factor table, visual.py's `_MAX_INTENSITY` peak+mean blend,
textmatch.py's name-correction cutoff) - all state a rationale, none restate the code.

### Terminology sweep - clean
Grepped `\bAI\b|RP context|clip candidate|demo reel|subtitle|Probe|profile` across all 17
files - zero hits. `Visual` only appears in dev-facing identifiers, consistent with the
glossary term; none of this section's log/comment text is user-facing. `laugh.py`/
`audio_event.py`'s model-id/size specifics still match `config.py`'s `scorer_laugh_model_id`
default.

---

## Phase 4 refactor - full-app review section 3, scoring (2026-07-26)

Same 17-file scope. No code changes warranted - clean coming in (Phase 1: "unusually clean";
Phases 2-3 fixed the real reliability bugs; WS-A..D already reshaped it).

### `scorer_set.py` - single-registration assembly, no per-scorer branches - kept
Adding a scorer is one line in `build_clip_scorers`'s returned list; the four `build_*`
variants share that source with no `if scorer == ...` dispatch - matches the
registration-not-rewrite convention.

### `engine.py::_run_scorers`'s `scorer.name == "laugh"` special case - kept, not generalized
Laugh is the only scorer whose raw result must be persisted apart from its weighted
aggregation (`score_laugh` vs weighted `score_funny`). A generic `raw_scores` mechanism would
serve exactly one consumer (YAGNI). Keys on the Protocol's `name` attribute, stays
backend-agnostic. Revisit only if a second scorer needs a raw side-channel.

### `engine.py::_compute_overall` - already dynamic-weight and well-decomposed - kept
Divides by the live dimension-weight sum, returns `None` when all weights are zero, single
15-line concern. No change.

### The two-method scorer availability surface (`is_available()` bool + `available()` tuple) - kept
`is_available()` is the `Scorer` Protocol method the engine uses; where a scorer also exposes
`available() -> (bool, reason)` (prosody, speechrate, churn, lexicon, laugh, audio_event),
`is_available()` delegates to `available()[0]` - no duplicated probe logic. energy/scenes/visual
omit the tuple form because nothing reads their reason. Appropriate asymmetry, not drift.

### `similarity.py` backend seam - factory owns all dispatch - kept
The three backends (`TfidfBackend`, `EmbeddingsBackend`, `LlmBackend`) share one interface;
`_construct`/`make_backend` own every `if backend == ...` branch plus the tfidf-fallback +
first-use model-load policy. The `isinstance(backend, EmbeddingsBackend)` check inside
`make_backend` is the seam's single cross-cutting-policy point (fetch-verify-or-fall-back
gate), correctly placed at the factory.

### `textmatch.py::find_fuzzy_matches`'s inner sliding-window scan - kept inline
~43 lines but one cohesive concern; its subtle invariant (a hit consumes its whole window so
overlapping windows can't double-count) is documented in the docstring at the exact spot it
matters. Below the rule-of-three (one call site).

### Narrow-except reliability sweep across the rest of the scope - clean
Grepped `except (ImportError|ModuleNotFoundError)` across the files Phases 2-3 didn't
primarily target - zero instances of the availability-probe crash pattern those phases fixed 7
times elsewhere. `scenes.py::_detect_content`'s narrow `except ImportError` remains (its sole
caller already wraps the compute in a broad except per the Phase-3 note) - not a live crash
risk, left as-is.

---

## Phase 6 docs and comments - full-app review section 2, transcription & diarization (2026-07-26)

Docs-and-comments phase over `transcribe/{whisper_runner,diarization_client,transcriber,align,
project_voice,speaker_attach}.py` and `subtitles.py`. Comment density already excellent going
in; no restatement/obsolete/apology comments found; nothing deleted.

Applied - 3 comment-only additions (verified `yuu-dev test-api` 3341 passed unchanged, lint clean):
- `diarization_client.py::diarize_with_embeddings` - added a comment above the
  `_consolidate_labels(...)` call clarifying it deliberately takes `speaker_match_threshold`
  (a SIMILARITY), not the `cluster_threshold` (a DISTANCE) used one line above for
  `_cluster_labels(...)` - the distinction was documented at each definition but not at this
  call site, where it could read as a copy-paste bug.
- `project_voice.py::_best_exemplar_score` - added a comment above the `backend is not None
  and ...` guard explaining the None-backend legacy-data tolerance (deliberately skips the
  cross-backend filter when the caller doesn't know the query vector's own backend);
  previously explained only in a test comment.
- Same fix/reasoning in `speaker_attach.py::_best_voiceprint_match`'s equivalent
  `active_backend is not None and ...` guard (previously explained only in a test comment).

Verified and deliberately left as-is - do not re-flag:

### ARCH-3 (align.py's seam-convention exception) - module docstring still reads clearly
No `alignment_backend` config value, one implementation, the single caller
(`web/routes/common.py`) never gates on availability. No edit needed.

### Multi-line docstrings on internal (`_`-prefixed) functions across this section - kept, not pared to one-liners
Same call as the Phase-6-section-1 entry below (`ingest.py`'s private helpers - see that entry
for the shared rationale): `diarization_client.py`'s clustering helpers (`_consolidate_labels`,
`_prune_small_clusters`, `_densify_labels`), `project_voice.py`'s matching functions, and
`subtitles.py`'s rendering helpers (`_highlight_shade`, `strip_baked_speaker_prefix`) all
document non-obvious algorithm invariants or numeric-threshold rationale a name can't carry.

### Terminology sweep - clean
"Captions" vs "subtitles" is the one term this section touches - `subtitles.py`'s
docstrings/comments never claim to be user-facing (the name-split is documented in CLAUDE.md
as deliberate) and no `console.print`/error string in scope leaks "subtitles" to a user. No
other code-name leaks found.

---

## Phase 5 logging - full-app review section 2, transcription & diarization (2026-07-26)

Same file scope - the speech-to-text/speaker-identity pipeline stage, a common source of
"why no captions/wrong speaker" reports.

Applied: `speaker_attach.py::diarize_track`'s entry log now includes `backend=%s`
(`config.diarization_backend`), matching `whisper_runner.transcribe_track`'s entry log which
already names its backend.

Confirmed and deliberately left as-is - do not re-flag:

### This section already had exemplary logging coming in - no gaps found
Every model load, every backend-unavailable path, and every catchable failure already carried
a log line with `track.id`/`track.label`/`video_id` context before this phase. Zero bare
`except` with no log call anywhere in scope.

### No log spam in any loop
`whisper_runner.py`'s per-segment loop drives a Rich progress bar, not per-segment logging.
`diarization_client.py`'s per-batch/per-cluster-merge loops log nothing per-iteration (one
summary `info` per `diarize_with_embeddings()` call). `speaker_attach.py`'s
`_report_attach_decision` fires once per resolved speaker cluster, not per turn/embedding.

### `subtitles.py` and `project_voice.py` carry no logging at all - confirmed not a gap
Both pure, deterministic, torch/DB-free transformation modules (no model/subprocess/network
calls). `subtitles.py` raises `ValueError`/propagates `OSError`; `project_voice.py` is pure
math. Every real caller lives in `web/routes/*.py` / `pipeline/ingest.py` (out of scope) - the
right place to log with request/run context. Revisit if a future review of those callers finds
an uncaught/unlogged sidecar-refresh failure.

### Terminology sweep - clean
This section's SSE-visible text comes from `console.print` (out of `logger.*` scope, only
reaches the file log). Neither channel uses "subtitles"/"AI"/"profile" in user-facing text;
the one "subtitle" hit is a code-identifier reference in a docstring, not user copy.

### RESOLVED elsewhere (was: dead-code finding, not a logging gap): the `diarization_backend != "null"` guard around the skip-log
Original finding: `diarize_track`'s `if not ok: if config.diarization_backend != "null": ...`
could never take the inner branch when `ok` is `False` and the backend is `"null"`, because
`NullDiarizationClient.available()` unconditionally returns `(True, "")` - vestigial dead code,
flagged for a future bug-hunt/refactor pass, not fixed under a logging lens.
**Verified against current code: fixed.** `speaker_attach.py::diarize_track` no longer has the
nested `diarization_backend != "null"` guard - the `if not ok:` branch now unconditionally logs
the warning and returns. No further action needed; do not re-flag.

---

## Phase 6 docs and comments - full-app review section 1, analyze pipeline (2026-07-26)

Docs-and-comments phase over `pipeline/{ingest,run_meta}.py` + the 10 `analyze/*.py` stage
helpers. Comment density already high quality; only one restatement comment survived.

Applied: deleted `pipeline/ingest.py::_import_subtitles`'s `# Attach to the first
do_transcribe track (or track 0 as fallback).` comment immediately above the ternary that
already spells out that fallback - translated the one-liner into English without adding any
WHY. Comment-only; `yuu-dev test-api` 3331 passed unchanged, lint clean.

Verified and deliberately left as-is:

### The two CLAUDE.md-flagged load-bearing comments are present, accurate, and survived Phase 4's extraction
- `ingest.py`'s SpeechBrain-must-be-prewarmed-before-transformers import-order comment (paired
  with `_should_prewarm_transformers`'s docstring) - matches the actual prewarm call site and
  CLAUDE.md's "SpeechBrain poisons transformers.pipeline" section.
- `extract.py::_build_clip_cmd`'s header comment + the softsub-branch comment - the ffmpeg
  `-ss`/`-t` argument-ordering invariants, including the two-input softsub ordering bug this
  comment guards against. Both still read correctly against the current code after Phase 4's
  `_audio_stream_maps()` extraction.

### The many multi-line docstrings on internal (`_`-prefixed) functions in `ingest.py` - kept, not pared to one-liners
`_resolve_existing_video`, `_upsert_video_and_tracks`, `_reusable_track_transcript`,
`_transcribe_and_check_overlap`, `_retranscribe_video`, `_clear_existing_clips`, etc. each
document genuinely non-obvious return-value shape or side-effect behavior a name can't carry
(e.g. `_reusable_track_transcript`'s explanation of why it also deletes stale rows - a
truncated transcript from a run that died mid-track would otherwise silently pass as
complete). Matches the governing rule and prior precedent elsewhere in the codebase. Not a
phase-6 finding; do not re-flag.

### Terminology sweep - clean
`labeler.py` already says "Track layout" consistently everywhere user-facing; no
"profile"/"AI"/"RP context" leaks found beyond what Phase 5 already fixed.

### `docs/dev/llm/REVIEW_MAP.md`'s Stage 1/Stage 2 file lists - verified accurate
No file was renamed or moved this section; descriptions still match current module
docstrings/content. No doc edit needed.

---

## Phase 5 logging - full-app review section 1, analyze pipeline (2026-07-26)

Logging-coverage phase over `yuu_clip/pipeline/{ingest,run_meta}.py` and
`yuu_clip/analyze/{probe,extract,labeler,overlap,proxy,frames,motion,framing,pause,
thermal}.py` - the analyze pipeline's orchestration and every per-stage helper.
Confirmed via `web/sse.py`/`web/analyze_job.py`: every `console.print` these modules
emit is tailed as the subprocess's stdout and reaches the browser's live log panel
over SSE, so these strings are user-facing and glossary compliance applies.

Applied:
- `run_meta.py`'s `StageRecorder.stage()` now logs stage boundaries to the file log
  (`log.info` start/finish, `log.warning` on an unhandled exception), each carrying
  the video's filename via a new `StageRecorder(label=...)` arg. Previously the only
  narrative of a run's progress was `console.print` (SSE-only, capped by
  `_MAX_BUFFER_LINES`) - none reached `.yuu-clip/yuu-clip.log`. Highest-value fix of
  the pass.
- `ingest.py`'s `_analyze_one` now logs `Analyze started` / `Analyze finished
  (elapsed_ms=...)` bookends to the file log, one line each per video.
- `run_meta.py::_resolve_devices`'s bare `except Exception: diar_device = "cpu"` now
  logs at `debug` before falling back.
- **Correlation-id consistency**: the Extract/Transcribe per-track failure logs and
  the subtitle-import failure log used `video=%s` only, unlike every other
  `ingest.py` failure log (`video_id=%s`). Added `video_id=%s` alongside the
  filename at all three sites.
- `extract.py::_probe_duration_s`'s silent `except (ValueError, AttributeError,
  TypeError): return None` (a failed post-export ffprobe duration parse, skipping
  `_verify_export_duration`'s corrupt-export guard) now logs at `debug` with the raw
  ffprobe output and exit code.
- **Glossary fix**: `ingest.py`'s `_llm_unavailable_message`/`_llm_unavailable_notice`
  said "AI clip ranking and descriptions" / "AI score and descriptions" - these reach
  the browser and the glossary bans "AI scoring" (`GLOSSARY.md:806-807`). Reworded to
  "LLM clip ranking and descriptions" / "LLM score and descriptions". No test pinned
  the old wording.

Confirmed and deliberately left as-is - do not re-flag:

### The rest of `ingest.py`'s exception handling is already exemplary
Every stage that can fail already pairs a user-facing `console.print` with
`log.exception`/`log.error`/`log.warning` carrying `video_id` (or `path`/`video=`
pre-row-creation, e.g. Probe). Nothing else needed adding.

### No log spam found in any per-frame/per-track loop
`frames.py`/`framing.py`'s `_extract_frame` (up to ~10 calls) already logs at
`debug`. `motion.py`'s per-sample decode loop logs nothing per-frame by design -
only one `warning` if the whole decode fails. `overlap.py`'s per-frame RMS decode
failure is `debug`. No level changes needed.

### `extract.py`'s clip-export functions carry no logging of their own - confirmed not a gap
`export_clip`/`export_clip_with_preset`/`_run_ffmpeg` raise a bare `RuntimeError` on
ffmpeg failure with no internal log call. Left as-is: both call sites
(`export/render.py`, `web/routes/analyze.py`) are outside this section's scope
(export feature, not the analyze pipeline) and already log the failure with
`clip_id` context.

### Thermal auto-pause events are already logged - by the caller, not `thermal.py`
`ThermalTrigger.poll()` returns a typed `ThermalPollResult` with no logging of its
own; its only caller, `web/routes/analyze.py::_thermal_poll_loop` (out of scope
here), already logs both `warn_triggered` and `pause_triggered` at `warning` with
temperature and threshold.

### DEFERRED - not fixed this phase (needs a bug-hunt/robustness lens, not a logging one)
`ingest.py::_extract_audio_and_check_rms_overlap` catches only `except RuntimeError`
per track, while the structurally identical `_transcribe_and_check_overlap` catches
`except Exception`. Not live today (`extract_audio_track` only ever raises
`RuntimeError`), but if `subprocess.run` itself raised (e.g. `OSError` from a broken
PATH entry), it would propagate uncaught with no `log.exception` for that track.
Widening the catch clause is a behavior change (changes what aborts the run vs. what
a per-track loop swallows), not a pure logging addition, so left for a future
bug-hunt/refactor pass.

---

## Phase 7 UX/UI - full-surface review (2026-07-23, shipped 2026-07-24)

The `UX-REVIEW-2026-07-23.md` fix plan shipped across six stages (`d5a3618..fd43f3e`):
all 11 HIGH, ~24 MEDIUM, and ~29 LOW findings from a full shqr-ux-ui-review surface
walk were fixed or deliberately skipped. Owner decisions: H9 kept the wizard Launch
block and added a Cancel to the CUDA install; M21 unified both export surfaces on
soft (embedded) captions as the default (**note: the quick-export modal this refers
to was later retired 2026-07-26, panel-layout-v2 stage 2b - the editor is now the
only export door, so "both surfaces" is historical**); M22 uses undo-toasts for
library row deletes; M10 renamed the split confirm to "Split recording" with danger
styling; Low 13 removed the bottom Close from About/Controls/Getting Started so all
five info-modals close via the top-right X.

**Did not reproduce (skipped, not fixed):** M16/Low 16 (setup.html inline hex
literals) - the wizard token re-skin had already removed them. Everything else in
the plan reproduced and was fixed.

**Confirmed-intentional - do NOT re-flag** (verified good during the walk):
Empty-state onboarding (`videos.js`: mascot + gold CTA + analyzing-swap);
`install-error.js` failure-class mapping (network/disk/antivirus/no-wheel/CUDA -
exemplary plain-English design, its one gap M17 fixed); boot-time modal a11y
stamping + single document-level focus trap + showConfirm defaulting focus to
Cancel; dirty-state guards funnelling through one "Discard changes?" confirm +
beforeunload; undo toast with a shrinking countdown bar; Cancel-left /
verb-specific-primary-right button order, gold `highlight` reserved for the two
Export confirms; toasts mirrored into `#sr-live-polite`/`#sr-live-assertive`;
universal `:focus-visible` ring + `prefers-reduced-motion`; `--visual` sharing
`--action`'s hue (bars always labelled); kind-filter chip tooltips; calm
"setup state, not failure" no-model copy (the reference pattern for
capability-missing states); wizard status-slot/restore/CUDA-section/FFmpeg-recovery
behaviors; glossary-term compliance across the five region partials; modelcatalog
reconnect-poll behaviors; per-video "Retranscribe before export" smart default.

### Low 29 - pointer-only resize handles + split-timeline markers (accepted)
Decision: sidebar/player resize handles and split-editor timeline markers stay
**pointer-only** - no keyboard path. Accepted for a mouse-first single-user desktop
tool. Revisit trigger: a keyboard-only/AT user actually needs to split a recording
or resize a pane. Do not re-flag as a keyboard-accessibility gap.

---

## Fable-review WS-5 - backend seam hygiene (2026-07-24)

Three deliberate keep/exception calls from `FABLE-REVIEW-PLAN-2026-07-23.md`'s WS-5
(ARCH-1/2 were plain fixes, not recorded here).

### align.py (forced alignment) is a documented exception to the seam convention (ARCH-3)
Decision: `transcribe/align.py` stays plain module-level functions
(`realign_words`/`realign_segment_words`) - not wrapped in the ABC + `make_*(config)`
+ `available()` convention.
Rationale: no consumer for that machinery - no `alignment_backend` config value, one
implementation (torchaudio WAV2VEC2_ASR_BASE_960H, English-only), and the single
caller (`web/routes/common.py`) never probes availability, just falls back to a
static caption line on `None`. A factory + Null backend for one best-effort function
would be speculative generality. Promote only if a second aligner needs
selecting/gating. Documented in `align.py`'s module docstring.

### The cancelable out-of-process vision path is llamacpp-server-only by design (ARCH-4)
Decision: `pipeline/frame_analysis.py` -> `scoring/llm.describe_frames_via_server` ->
`post_chat_completion` POSTs straight to the parent web server's warm llama-server,
bypassing the `LLMClient` seam - left as-is, documented, not refactored.
Rationale: llama-server is warmed once per process; constructing an `LLMClient`
inside the subprocess would spawn a second server and re-load the multi-GB vision
model - the exact double-load the out-of-process design avoids. In-process vision
(`describe_frames`) does go through the seam. Consequence (stated in
`llm_client.py`'s `vision_payload_messages` docstring): a new backend would need its
own out-of-process mechanism for cancelable frame analysis. Full routing fix judged
too risky (touches the per-process warm-server invariant) - do not re-flag as a seam
leak without this context.

### Policy: the setup wizard's scope does not grow toward Settings parity (ARCH-policy)
Locked decision: the Electron wizard stays minimum-viable first-run (pick/download
ONE text LLM model, write `config.json`) - everything else (vision model, Whisper
size, scoring weights, hardware, hot words) is finished in Settings. New
model-selection/config surfaces go in Settings, never mirrored into the wizard.
Rationale: wizard and Settings are two parallel model-selection stacks that cannot
share runtime code (browser vs Electron main/Node; wizard runs before the Python
server exists). `yuu-dev shared-data` keeps the *data* (`catalog-data.json`) synced
but can't see *behavior* duplication - the wizard's downloader and
`cli/models.py download-gguf` are independent implementations with independently-
evolved retry/resume/verify; every wizard feature doubles that invisible surface.
If the wizard must ever gain a new config, treat it as a deliberate,
separately-reviewed scope expansion, and it must write the correct key
(`llm_vision_model_path`, never `llm_model_path`; enforced by
`test_shared_data_drift.py`).

---

## Refactor-for-quality WS-D - frontend JS extractions close-out (2026-07-23)

WS-D (9 frontend JS extractions + vitest for zero-coverage modules, D1-D9) shipped
one item at a time (`d3e2718`..`4b83fde`) with a bundle+`test-js` gate between each
(410 -> 492 JS tests) plus a full `test-ui` (650 passed, 1 known xdist flake) and
`test-unit` 1777 at close. Full per-item ledger + SHAs in the archived plan doc.
Recorded here per the close-out convention:

### The three URLSearchParams query builders are deliberately NOT unified (anchored keep)
Decision: `analyze/reel.js` (`_reelPoolQs`, `confirmBatchExport`), `clips/clipexport.js`,
and `library/exporteditor.js` (`buildExportParams`, D2) each keep their own
`URLSearchParams` assembly - not refactored into one shared builder. (Merged here
with the identical pointer entry originally duplicated under the WS-C section below.)
Rationale: pre-recorded as out of scope by the plan's "Deliberately out of scope"
list; the three build different query shapes (reel-pool filtering vs batch-export
options vs single-clip export with caption-style fields) over different caller
state - same basis as the anchored `routes/llm.py` capability-tier keep. D2 made
exporteditor's builder pure/testable but kept it editor-specific (intra-module
extraction, not the cross-module unification this keep forbids). Do not re-flag the
three as duplication.

### Three extractions expanded the plan's sketch signatures - deliberate, not drift
D1's `computeReelEstimate` omits the sketch's `transDur` param (the pre-existing
`updateReelEstimate` read `demo-trans-dur` into a `transDur` local the estimate math
never used - threading it through would fabricate a used-looking param). D2's
`computeTrimBoundary` ctx adds `effStartMs`/`effEndMs` beyond the sketch's
`{clipStart, clipEnd, minDurationMs}` (the 1s-minimum guard floors against the
opposite edge's *current* effective position, which the sketch's params can't
express). D3's `_timelineRowHtml` takes a `memberId` the sketch omitted (its
`data-goto-video`/`data-clip-video` nav attrs need the member id, which
`mergeTimelineEntries` deliberately keeps out of its pure rows). Each behavior-
preservation reason is noted inline in the plan's row.

---

## Refactor-for-quality WS-C - Python behavior-preserving extractions close-out (2026-07-23)

WS-C (7 behavior-preserving Python extractions, C1-C7) shipped one item at a time
with a full `test-api` gate between each (3120 -> 3161 passed) plus a final
`test-system` pass. Full ledger + SHAs in the archived plan doc. Recorded here per
the close-out convention:

### `web/analyze_job.py`'s 2 SSE frames were deliberately NOT converted to `sse_event` (C4)
SUPERSEDED by the SSE typed-event migration (stage 4, 2026-07-24): `sse_event`/
`_done_event` were retired entirely and `analyze_job.py` now frames its buffered
events through `jobevents.frame`. Kept for the historical record only: the original
decision was to leave `analyze_job.py:189,198` as raw `f"data: ..."` because C4's
scope was exactly the 5 enumerated route files, and this module was outside it - a
scope decision, not a technical blocker (no circular-import issue was found).

### C5's per-caller `error_log_prefix` string is a deliberate tradeoff, not naming drift
Decision: `_score_one_clip` takes a preformatted `error_log_prefix` string per
caller rather than a structured `(clip_id, video_id)` pair.
Rationale: the two rescore routes logged different formats on failure - batch
(`"rescore_clips: clip N failed for video M: <exc>"`, with video id) vs single-clip
(`"rescore_clip: clip N failed: <exc>"`, without). A structured param would force
one unified format and silently change one log line; the extraction was
behavior-preserving including diagnostic text, so the string param is faithful.

---

## Refactor-for-quality WS-A+B - test-tier rebalance close-out (2026-07-23)

WS-A (10 test-file splits moving pure-by-dependency tests from `tests/integration`
to `tests/unit`) and WS-B (new unit tests on already-pure, previously-untested
logic) both shipped - full per-item ledger in the archived plan doc. Recorded here
per the close-out convention:

### 4 of WS-B's 8 items were SKIPPED - already covered, not written
Decision: no near-duplicate tests written for B1, B2, B4, B6 - each target already
had thorough direct unit coverage by the time WS-B started, either freshly relocated
by a same-session WS-A move (B1's `_apply_name_suggestions`/
`_voiceprint_name_suggestions`, B2's `_build_clip_cmd`/`_preset_video_filter`, B4's
`_build_xfade_cmd`/`_segment_start_times`) or pre-existing (B6's
`_cosine_similarity`/`serialize_voiceprint`/`deserialize_voiceprint`/
`best_voice_match`, already in `tests/unit/test_project_voice.py`). Each SKIP is
recorded inline in the plan file with the specific classes/counts. Re-verify against
current test files before assuming a gap.

### A structural pytest fix was required mid-move, not anticipated by the plan
Added empty `tests/unit/__init__.py` + `tests/integration/__init__.py`: pytest's
prepend import mode raises "import file mismatch" when a same-basename test file
exists in both tiers and both collect in one session (`test-api`) - true for every
WS-A move by construction. Discovered on the first move (A10), fixed once for the
workstream. `tests/ui` deliberately stayed `__init__.py`-free (36 files rely on bare
`from conftest import ...`, needing the file's own directory on `sys.path`).

### A pre-existing cross-file `TestSafeFilename` duplicate surfaced, not fixed at the time - since resolved
At WS-A time, `tests/unit/test_export.py::TestSafeFilename` (from A3) and
`tests/unit/test_reel.py::TestSafeFilename` (from A9) both tested
`web/routes/reel.py::_safe_filename` with different cases - left in place since
WS-A was move-only (import-path fixes, no dedup). **Current state: only
`tests/unit/test_reel.py::TestSafeFilename` remains** - the `test_export.py` copy
has since been removed, so the flagged future dedup pass is now moot. Do not
re-flag.

---

## Phase 6 docs and comments - window.X shim-drain slice (2026-07-23)

Docs-and-comments phase over the shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`).
Applied: rewrote three per-module "Public API" export-block header comments
(`analyze/analyze.js`, `clips/clips.js`, `videos/videos.js`) that still described a
"classic (bundle.js) consumer" - retired when the ESM migration completed - to the
accurate current consumer set (another ESM module reading off `window`, an inline
`index.html` handler, or a `tests/ui` `page.evaluate`). Comment-only; rebundled.

The following were reviewed and deliberately left as-is at the time - **since
superseded, see notes**:

### `main.esm.js` residual-shim banner + GROUP 1/2 comments - current and accurate (SUPERSEDED)
At the time, the two-group banner matched the live code (GROUP 1 = live runtime
readers, GROUP 2 = test-only hooks). **Since superseded**: the ui-shim-retirement
plan's Phase 2 (2026-07-25) drained GROUP 1 to empty - every remaining
runtime-coupled name moved to a real import or the `core/refreshhooks.js`
registration seam. Current `main.esm.js` states this in its own banner. Do not cite
this entry for GROUP 1's composition; check the live file instead.

### `core/jobs.js` 9 near-identical "window.* read" comments - kept (SUPERSEDED)
At the time, 9 repeated `// window.* read: ...` comments marked a documented
vi.mock exception (CLAUDE.md). **Since superseded**: Phase 2 (2026-07-25) moved
these reads behind `core/refreshhooks.js`'s registry; zero such comments remain in
`jobs.js` today.

### `core/boot.js` + `analyze/split.js` window-bridge WHY comments - kept
`boot.js`'s `window._prereqs`/`_aiPrivacyMode`/`_visionEnabled` comment and
`split.js`'s live get/set accessor-bridge comment both describe mechanisms that
still exist (verified current) - non-obvious current coupling, not retired. Keep.

### Project docs (CLAUDE.md frontend section, ARCHITECTURE.md, ROADMAP) - verified current at the time
CLAUDE.md's shim section and jobs.js's window-read count matched the code then;
ARCHITECTURE.md flags the old all-window pattern as stale-if-cited; ROADMAP's
shim-drain entry was removed in `9d21aac` (plan CLOSED). No longer worth citing for
current counts given the Phase 2 changes above - re-derive from the live files.

---

## Phase 5 logging - window.X shim-drain slice (2026-07-23)

Logging-coverage phase over the same shim-drain arc. Browser-side "logging" is
`showToast` + `appendLog` to the in-app log panel - the frontend deliberately carries
almost no `console.*`. **No code changes were warranted**; the conversion introduced
no swallowed error. Confirmed and left as-is:

### The conversion left the SSE/job error paths intact and fully surfaced
`core/jobs.js`'s `_openSSE`/`streamSSE` handle `!res.ok`, a stream ending without a
completion signal, mid-stream connection loss, and the outer fetch rejection, each
routed to `onError`, which logs, toasts, plays the error sound, and tears the job UI
down. A typed `done{outcome:error}` event (post SSE typed-event migration; old
`__DONE__` sentinel/`isDoneSentinel`/`doneError` retired in stage 4) routes failures
via `decodeEvent` so nothing reports a failed job as done. `analyze.js`, `videos.js`,
`clips.js`, `settings/projects.js`, `core/utils.js` all surface fetch failures via
`showToast` or an inline error region. Nothing to add.

### Every empty / identifier catch in the arc is a deliberate tolerant fallback
`sessions.js`/`clips.js`/`preview.js` seek-before-metadata `catch {}`; `clips.js:788`
(re-fetch after analyze-frames, falls back to cached copy); `videos.js:333`
`_restoreView` (corrupt saved-view JSON -> ignore); `videos-timeline.js:67` and
`utils.js`'s `_exportRetranscribeDefault` (config-populated default, keeps safe
built-in on failure); `analyze.js:747`/`:766` (preview warm/completion warnings,
WHY-commented as must-never-surface); `projects.js:27` (switcher stays hidden if the
list can't load). None needs a user-facing error - same basis as the 2026-07-13
`_cardCollapseState`/`copyText` decisions.

### No log spam introduced
No per-frame/per-SSE-event/per-render `console.*` or `appendLog` call was added. The
in-app log panel stays bounded to `_MAX_LOG_LINES` (500); the full log always
remains in `.yuu-clip/yuu-clip.log`.

### BUILT in Phase 9 (owner-approved): top-level `window.onerror` / `unhandledrejection` reporter
The frontend had no global uncaught-error surface - the exact Phase-2 bug class (a
bare-identifier `ReferenceError` on a rare path shipping silent). Built
`core/errorreporter.js` (`initGlobalErrorReporter()`, wired first from `boot.js`):
every uncaught error/rejection is mirrored to `console.error`, appended to the
in-app log panel, and surfaced as a persistent error toast whose "Show log" action
opens the log. A looping error (same signature within 5s) logs every time but
toasts at most once. No new infrastructure - reuses `showToast`/`appendLog`/
`openLog`. Covered by `tests/js/core/errorreporter.test.js` (5 tests). This is the
durable close of the diagnosability gap that let the Phase-2 bug ship - do not
re-flag as missing.

---

## Phase 4 refactor - window.X shim-drain slice (2026-07-23)

Refactor phase over the shim-drain arc that converted the frontend off `window.*`
globals onto ESM imports and consolidated the residual shim in `main.esm.js` into
two labeled groups. Applied: corrected two stale reader-attributions the Phase-3
comment rewrite missed - `closeNewRecordingPanel` (Phase 2 had converted shortcuts.js
to import it, leaving only the analyze.js onclick-string as reader) and
`openSettings` (every JS caller now imports it; survived only via onclick-strings,
clipexport.js added to the list). Comment-only; rebundled. Gate: `test-js` 367,
`test-unit` 1069, lint clean. **Note: both fixed comment lines have since been
superseded** - Phase 2 (2026-07-25) moved `closeNewRecordingPanel`/`openSettings`
into the GROUP 2 test-only block entirely, so neither exists in the GROUP 1 form
this fix produced.

### GROUP 1 shim lines all verified alive; GROUP 2 kept whole - not drained (SUPERSEDED)
At the time: every GROUP 1 name's claimed runtime reader was grepped and confirmed
live (jobs.js reading loadVideos/_clipsListUrl/_updateDemoButton/
_syncAnalysisLivePanel/_renderClips/_renderClipFilterCounts; format.js reading
`window._clipsSortParam`; helpmodals.js reading `window.closeHamburger`; panelnav.js
reading `window.showConfirm`; `undoLastBulkStatus` as a genuine clips.js
bare-global). **Since superseded**: Phase 2 (2026-07-25) converted every one of
these to a real import or the `core/refreshhooks.js` seam - `jobs.js` now imports
`refreshHooks`, `helpmodals.js` imports `closeHamburger`, `panelnav.js` imports
`showConfirm`, `clips.js` imports `undoLastBulkStatus` from `clipbulk.js`. GROUP 1 is
now empty; do not cite this entry for current shim composition.

### No unused imports, no arc-orphaned dead code, `_diarizationNoteHtml` already shared
Decision: kept as-is. A full-tree scan for zero-use imports found none.
`_diarizationNoteHtml` (candidate DRY target across analyze.js/contexts.js/
clipexport.js) is already centralized in `core/utils.js` and imported by all three.
`boot.js`'s long module-scope init sequence is the one CLAUDE.md-exempt side-effect
entry point; its `window._prereqs`/`_aiPrivacyMode`/`_visionEnabled`/
`refreshServerState` globals are the documented shared-mutable-state bridge for the
vitest follow-on, not drainable here.

### `const data = await res.json()` idiom kept - not "naming drift"
Decision: keep `data` for a parsed JSON response body - the established name at
~30 sites, predating this arc; renaming per call site would be churn against a
consistent convention for no legibility gain.

---

## Phase 6 docs and comments - pre-public polish (dev-CLI / wizard / whisper-catalog) (2026-07-18)

Docs-and-comments phase over new/changed logic since baseline `6848574`. Applied two
user-facing glossary fixes (glossary bans "AI scoring" in favour of "LLM scoring"):
`videos/videos.js`'s "re-score for AI scoring and descriptions" tooltip -> "LLM
scoring" (matches its sibling branch); `partials/modals/about.html`'s "AI scoring"
grouping header -> "Local AI" (the llama.cpp row it heads also does vision/image
analysis, so the narrower term would undersell it; matches wizard copy). Rebundled/
re-stitched; no test pinned either string; `test-js` 226 + `test-unit` 983 green.

The following were reviewed and deliberately left as-is:

### `whisper_catalog.py`, dev-command modules, `constants.js`/`setup-preload.js`/`whisper-select.js` WHY comments - kept
Every comment explains a genuinely non-obvious constraint (the size/VRAM
hand-copy-drift point, the generated-from-Python catalog seam, packaged-vs-dev
binary provenance, the setup-version re-show rule, esbuild's string-referenced-
function tree-shaking, measured VRAM headroom). All earn their place. The
box-drawing `--` section dividers in `setup-renderer.js` are the codebase-wide
comment-only convention (2026-07-10) - not re-flagged.

### `approval.py` route docstrings and `clipcreate.js` picker comments - kept
`approval.py`'s docstrings and "pending"/"approved" references accurately describe
code identifiers (the UI itself renders "Unreviewed"). `clipcreate.js`'s
inline-preview rationale and clips-vs-scenes kind comment explain real WHYs. No
change.

### RESOLVED (owner-approved, `8ae92f4` + `44f71c8`): `electron/recommend-model.js`'s NVIDIA-only gate comment was factually wrong, now fixed
Originally flagged: the comment justified `gpuVendor !== 'nvidia' => CPU-only` by
claiming the bundled llama.cpp is CUDA-only - false, it's the Vulkan build
(`constants.js:31-36`), and `setup-renderer.js` tells non-NVIDIA users their GPU
speeds up LLM scoring, contradicting the recommendation's stated reason. Resolved by
keeping the NVIDIA gate (its real basis is VRAM *measurability* via `nvidia-smi`,
not acceleration) but fixing the rationale: `44f71c8` split `isCpuOnly` into
`canSizeGpu` (model-sizing gate) + `gpuAccelerates` (copy), so a non-NVIDIA user now
reads "Your GPU accelerates local AI, but its video memory could not be measured, so
lightweight is the safer pick." Recommendation behavior unchanged; the two tests
encoding the old false assumption were rewritten. No longer open.

---

## Phase 5 logging - pre-public polish (dev-CLI / approval route / setup wizard) (2026-07-18)

Logging-coverage phase over the same baseline. **No code changes were warranted** -
already diagnosable and cp1252-clean. Verified and left as-is:

### `web/routes/clips/approval.py` - already logs both routes with context
`auto_approve` logs count + score field + threshold + video id; `reset_approvals`
logs count + video id - enough to reconstruct a mis-approval from the log file.
Validation rejects surface as `HTTPException` toasts (expected user-input errors,
not log-worthy). No gap.

### New `yuu-dev` dev-command modules - developer console output, not application logging
Same basis as the already-anchored `bundle.py`/`testjs.py` entry (2026-07-16):
`fixture`/`helpdocs`/`htmlstitch`/`shareddata`/`typecheck`/`tests`/`serve` are
`yuu-dev` developer-CLI tools whose "logging" is Rich `console.print` to the
developer, not the app log. Each failure path prints a red, ASCII-only, actionable
message and raises `typer.Exit` non-zero. Confirmed zero non-ASCII across all
in-scope dev modules + `whisper_catalog.py` + `approval.py`. Application-style
`logging` would be the wrong tool here.

### `electron/setup-renderer.js` - pure display; the diagnosable trace lives in `main.js`
The wizard renderer has no `console.*` by design (a thin view over `setup:*` IPC);
every failure it can show is also logged in `main.js` via `logSetup` (with pip
stderr tail for installs), so a wizard failure is both user-visible and recorded.
The `...` ellipses in renderer status strings are Chromium DOM text (UTF-8) - the
anchored 2026-07-09 browser-DOM ellipsis decision applies, not the cp1252 console
rule. `recommend-model.js`/`whisper-select.js` are pure data transforms with no
error paths. No gap.

### RESOLVED 2026-07-24 - `main.js` `setup:get-status` now logs its failure path too
Originally flagged: `setup:get-status` only logged via `logSetup` on success; a
pre-success throw (e.g. `detectGPU`) showed "Setup check failed" in the UI but wrote
nothing to the app log. Fixed by wrapping the handler in `try/catch` with a
`logSetup('Status check failed: ...')` call, matching sibling `setup:*` handlers. No
longer open.

---

## Phase 4 refactor - pre-public polish (fixture/help-docs/wizard-data) (2026-07-18)

Refactor phase over new/changed logic since baseline `6848574`: the new `yuu-dev`
dev commands, `whisper_catalog.py`, `htmlstitch.py`, the in-app Help viewer
(`markdown.js`+`helpmodals.js`), the merged Clips+Scenes client-side kind filter,
the centralized `shared/escapehtml.js`+`shared/whisperlang.js`, and the wizard's
catalog-data wiring. Applied: deduped `helpmodals.js`'s standalone `_escText`
escaper into the now-canonical shared `escHtml` (`shared/escapehtml.js`) - a
leftover third instance once `format.js`/`whisperlang` had already centralized on
it. Gate: bundle + `test-js` 226, `test-ui --changed` 12 - green.

The following were reviewed and deliberately left as-is:

### `markdown.js` `inlineMd` leading `& < >` escape - kept inline, not routed through `escHtml`
It's the first stage of a chained inline-formatting transform (escape, then
`` `code` ``/`**bold**`/`*italic*`/`[link]()`), not a standalone escaper. `escHtml`
also escapes `"` -> `&quot;`; substituting it would change output for doc text
containing a quote (a real diff the guides' golden tests could pin). Below
rule-of-three now that `_escText` is gone. Revisit only if a third standalone
`& < >` escaper appears.

### New `yuu-dev` dev-command modules - already well-decomposed
Each is short, single-concern, factored around the right seam: `fixture.py`'s
`seed_project_db` is the single seed routine shared with the integration conftest
(`with_scenes` is a documented divergence point, not a smell); `shareddata.py`/
`whisper_catalog.py` follow the established frozen-dataclass + small-helpers
pattern; `tests.py`'s `_run_tiers_code`/`_run_tiers` already extract the shared
tier-runner. No high-value structural change found.

### `setup-renderer.js` `applyDefaults` (~44 lines) and `clips.js` `openClipsActionsMenu` nested ternary - kept whole
`applyDefaults` is one concern (fill the wizard form from saved config on first
render) - a flat DOM-assignment sequence; splitting it would fragment a single
first-render pass for no readability gain. `openClipsActionsMenu`'s three-way
create-item ternary (Scenes/Clips/All) is short and WHY-commented; a dispatch table
would be more machinery than three literal cases justify.

---

## ESM migration + JS-test rebalance review (2026-07-16)

Full `shqr-code-quality-review` over the 64 commits since baseline `fffa951` (the
frontend ESM migration into feature subdirs, the committed `bundle.esm.js`, the vitest
`tests/js/` tier, and the dev-CLI `bundle`/`test-js` commands). Fixes applied that pass
(recorded in git, not repeated here): a migration-introduced dead control in
`analyze/split.js` (suggestion-pin click delegation dropped in the inline->delegation
conversion); dev-CLI error-path tests (`tests/unit/test_dev_cli.py`); ported the vision
cancel-wiring to `tests/js/clips/vision.test.js`, retiring a strict-xfail Playwright poke;
a teardown-determinism bug in `tests/unit/test_bundle_drift.py`; hoisted a duplicated
`node_available()` probe into `dev/_base.py`; corrected stale flat-path doc references
(`CLAUDE.md`, `GLOSSARY.md`). Gate green (`test-js`/`test-api`/`test-ui`/`lint`). The
following were reviewed and deliberately left as-is:

### `docs/dev/ARCHITECTURE.md`, routes feature-map `# UI:` path headers - verified accurate
Both match the post-ESM reality (single `bundle.esm.js`, the seven feature buckets,
unit/integration/ui/js tiers). The bulk path update across the 24 `routes/*.py`
feature-map headers was spot-checked against every referenced module via Glob - all
correct, including bare `videos.js`/`clips.js`/`reel.js` names in prose lists.

### `main.esm.js` residual-shim comments, non-ASCII Feature-map glyphs - not re-flagged
Both already anchored elsewhere: the shim comments are the deferred vitest follow-on's
territory (see the window.X shim-drain entries), and the Feature-map glyphs are the
codebase-wide comment-only convention (2026-07-10 entry below). Neither reaches the
cp1252 console.

### Dev-tooling WHY comments (`bundle.py`, `testjs.py`, `build-esm.mjs`, `tests/js/**`) - kept
Each explains a genuinely non-obvious constraint (drift guard needs a byte-identical
output dir, Node-only-for-rebuild, invoking vitest via `node <entry>` to dodge Windows
`.cmd` shim resolution, each `tests/js` header's port provenance). Not restatement.

### `llm_client.available()` reason strings kept path-free in the log too
Decision: the missing-model reason string is genericized in both the UI-facing text
and the log line that carries it (`scoring/llm.py:759` `log.warning("LLM scoring
disabled: %s", reason)`; line drifted from 743 at time of writing, same call).
Rationale: the reason renders in the UI (clip descriptions, analyze warnings,
screenshots), so it says "The set-up local model file is missing - re-download it
under Settings -> LLM scoring" instead of leaking the absolute `llm_model_path` (the
user's home dir). Re-adding the path to the log would violate the no-sensitive-paths
rule; the condition itself (LLM scoring disabled + reason) is still fully logged, and
the exact path is one file away in `config.json`. Covered by
`tests/unit/test_scoring_llm.py` + `tests/integration/test_llm.py`.

### `dev/bundle.py` / `dev/testjs.py` / `scripts/build-esm.mjs` console output - not application logging
Kept as Rich `console.print` / esbuild-driver output, not a logging framework - these
are one-shot `yuu-dev` developer tools whose failures are already actionable (named
fix: `npm install`, install Node; `build_esm_bundle` embeds esbuild's stderr in its
`RuntimeError` so the drift guard can't pass a stale bundle silently).

### `main.esm.js` residual `window.X = X` shim - superseded pointer
**Superseded by the "Phase 4 refactor - window.X shim-drain slice (2026-07-23)" entry**
(elsewhere in this file), which re-verifies this keep-as-is call against the current
GROUP 1/GROUP 2 structure. Kept only as a pointer.

### `bundle.py` (`subprocess.run`) vs `testjs.py` (`_base.run_and_tee`) - different invocation styles kept
Not duplication - different needs. `build_esm_bundle` captures stdout/stderr to embed
esbuild's failure detail in a `RuntimeError`; `test-js` streams vitest output live via
the shared `run_and_tee`. Collapsing them loses one behavior or the other.

---

## Post-Claude-removal review - characters / jobs-progress / transcriber seam (2026-07-15)

Scoped review over `4d95f3a..HEAD` (transcription backend seam, characters feature,
jobs/progress rework, dev-CLI notices/lock-deps, remote Claude backend removal).
Keep-as-is calls:

### `speaker_attach._attach_speakers` (~48 lines) and `whisper_runner.transcribe_track` (~76 lines) - kept whole
Both exceed the ~30-line guideline but are single cohesive concerns.
`_attach_speakers`'s label-collection, match/mint loop, and per-segment id assignment
share counters that exist only to feed one summary log line - splitting would pass
those counters across a seam for no gain. `transcribe_track`'s streaming-persist body
lives inside one Rich `Progress` context; extracting part of it would fragment that
context.

### `jobs.js` `parseProgress`/`JOB_STAGES` mirroring `pipeline/progress.py` - kept as intentional, guarded duplication
Cannot share code across the process boundary (subprocess stdout -> browser); guarded
by `tests/unit/test_progress_stage_coupling.py`, which greps `jobs.js` for each Python
stage id. Same rationale as the Wizard/Settings parallel stacks. Minor gotcha: the
guard matches the stage id wrapped in single quotes - a future double-quoted reference
in `jobs.js` would false-fail. Left as-is.

### `notices.py` `_is_license_file` - tightened via extension blocklist, not a stricter name regex
The license-name regex could over-match a `license.py`-style source module; fixed by
rejecting source/binary suffixes (`.py/.pyc/.pyi/.pyd/.so/.dll/.dylib`) instead. For a
licensing-notice artifact an under-match (silently dropping a real license file) is
worse than a cosmetic over-match, and no genuine license text carries those
extensions, so a suffix blocklist is the lower-risk guard.

### `shared/tokens.css` `--on-warning` token - kept despite losing its last consumer
The Remote LLM badge that used it was deleted with the Claude backend, but every theme
block must define the full token set (theme-invariant test asserts this), so removing
it from one block would require removing it from all and could reopen a contrast
pairing later. Kept (now at `:root`/dark/light lines 34/90/124 in `shared/tokens.css`
since tokens were centralized); zero consumers, only its stale comment was removed.

### Analyze-frames job made non-cancellable - SUPERSEDED same day
Originally fixed a wrong-cancel-copy + stuck-spinner bug by making the frame job
non-cancellable. Superseded within the session: image analysis was reworked to a
killable subprocess (`pipeline/frame_analysis.py`) POSTing to the warm llama-server (a
genuine mid-inference cancel), and the spinner leak was closed via a `streamSSE`
onError hook plus onCancel cleanup. Kept only so a future review knows the
non-cancellable state was deliberate-then-replaced, not an oversight.

---

## Theme G glyph sweep - close-out of the 2026-07-13 review (2026-07-14)

P2 tier flagged lone non-ASCII glyphs (`->` arrows, `...`, `<=`, gear) in Python
strings as outliers of the ASCII-console convention. Decision (user-approved): a
**targeted sweep** - ASCII-fix only strings that can reach the cp1252 console, leave
the rest.

### Swept (runtime strings reaching the console)
`console.print`/`_log.*`/`print()` strings and CLI-reachable labels (extract/labeler/
windower/whisper_runner/diarization_client/videos log lines, the `discord-10mb`
"<=10 MB" label), and the LLM/diarization readiness-reason strings (`scoring/llm.py`,
`scoring/llm_client.py`, `transcribe/diarization_client.py`) - confirmed reaching
`console.print` via `pipeline/ingest.py`, `pipeline/vision_describe.py`,
`cli/models.py`, `whisper_runner.py` (not browser-toast-only as earlier assumed).
Convention-alignment, not a bug fix (live crash risk was already nil: file logger is
UTF-8, `console.py` wraps stdout with `errors="replace"`).

### Kept as-is (do not re-flag)
Comments/docstrings (never reach the console); LLM prompt strings (`<=20 words`,
`0.0-1.0`, `Speaker 1, Speaker 2, ...` - data sent to the model, not console output);
`routes/llm.py` `HTTPException` detail strings (browser toasts, UTF-8-rendered); SSE
`yield "data: ..."` status strings (`scoring.py`/`videos.py`/`speakers.py`/
`sessions.py` - stream to browser as JSON); `reel.py` title-card ellipsis/middle-dot
(drawn into video via ffmpeg drawtext).

Deferred, not declined: Stage 3 `_window_rms_db` vectorization (perf), Theme F
config-JSON tolerance (`_sanitize_title_card_fields`, `contexts.py` accessor guards).
(`dev/procs.py` `parse_cim_json`'s silent `[]` on bad JSON, also originally on this
list, has since been fixed - it now catches `JSONDecodeError` and logs a warning;
pruned here, confirmed fixed, do not re-flag.)

---

## Phase 4 refactor - YuuClip retheme + collapsible cards (2026-07-13)

Applied: extracted a single `collapsibleCard(key, title, body, opts)` helper in
`utils.js` (all 11 opt-in cards stamp the collapse markup contract in one place);
removed the dead `.transcript-details`/`.transcript-summary` CSS orphaned when the
transcript moved off `<details>/<summary>` (`#video-transcript-details` id is
distinct and stays). Left as-is:

### Space-key collapse toggle load-order dependency - SUPERSEDED by the Phase 7 a11y fix
Originally a `div[role="button"]` whose `preventDefault` had to run before
`shortcuts.js`'s global Space handler. Replaced by the Phase 7 fix below (a real
`<button class="card-toggle">`, which `shortcuts.js` already bails on for `BUTTON`
tags) - the dependency no longer exists. Recorded so a future reader doesn't
reintroduce the div-based pattern.

### Repeated `color-mix(... var(--accent) N%, transparent)` focus-ring/scrim expressions kept inline
Predate this change set, vary by token and percentage, and each is a single
contextual use - not newly introduced duplication and below the bar for a shared
token.

---

## Phase 5 logging - YuuClip retheme + collapsible cards (2026-07-13)

Applied: wrapped the collapse-state `localStorage.setItem` write in `utils.js`
`_toggleCollapsibleCard` in try/catch with `console.warn` - it was unwrapped while the
matching read was defensive, so a write failure (private mode/quota) threw uncaught
*before* the `cardtoggle` dispatch, leaving the transcript card expanded but never
loading its body. Left silent by design:

### `copyText` clipboard failures surface via toast, no `execCommand` fallback
`navigator.clipboard` access sits inside the `try`, so an insecure/unsupported context
is caught and shown as an error toast - no crash, no silent swallow. The single-user
app only runs on localhost/Electron where the async clipboard API is always
available. An `execCommand` fallback is machinery for a context this app never hits.

### `_cardCollapseState` silently returns `{}` on corrupt/unavailable stored JSON
Tolerant-normalize by design - read once per card render, so logging would spam on
every render for a benign, self-healing condition.

---

## Phase 7 UX/UI - YuuClip retheme + collapsible cards (2026-07-13)

No code changes applied initially - the retheme's contrast contract is fully covered
by `tests/ui/test_ui_theme.py`. Two items were escalated to the owner and both
resolved: the reserved-gold scope (M2) was not drift (`COMPLETED.md` documents gold as
intentionally covering both Analyze + Export, stale `app.css` comment aligned); the
collapsible-header nested-interactive a11y pattern (M1) was fixed per below.

### Collapsible headers reworked to a native button; smaller toggle target accepted
Decision (applied, deliberate tradeoff): only the title+chevron are wrapped in a real
`<button class="card-toggle">`; header actions (Copy, kebab, Suggest/Fix names,
Generate) render as siblings via `collapsibleCard`'s `opts.actions`. A `<button>`
nested inside a `role="button"` is the axe `nested-interactive`/WCAG 4.1.2 violation;
a native button removes it and incidentally fixes the Space-key load-order dependency
(`shortcuts.js` bails on `tagName === 'BUTTON'`). Tradeoff accepted: clickable area
shrank from the full header row to title+chevron - valid ARIA + native keyboard beats
extra row width for a single-user desktop tool.
`test_toggle_has_no_nested_interactive_controls` (`tests/ui/test_ui_clips2.py`) guards
against re-nesting a control inside the toggle.

### Wordmark gradient's dark end is a brand logotype, exempt from the AA text floor
Keep the `linear-gradient(100deg, var(--accent2), var(--accent))` text-clip on the
`header h1` "YuuClip" wordmark even though the gradient's darkest stop computes
~3.5:1 on `--surface`. This is the product logotype, which WCAG 1.4.3 explicitly
exempts, and it has a solid-colour fallback (`color: var(--accent-text)` set before
the clip, contrast-tested as text-on-surface in every theme) if `background-clip:
text` is unsupported. Only re-open if the gradient is reused on non-logotype body
text.

### Quiet muted-uppercase section/card titles are an intentional hierarchy choice
`.detail-card-title`/`.sidebar-section` at `--muted` uppercase 11px is a deliberate
"quiet chrome, loud content" signature (Von Restorff: clip content + the one gold
action carry the weight), not an oversight. `--muted` on `--surface`/`--bg` is
AA-contrast-tested in every theme.

---

## Phase 6 docs and comments - YuuClip retheme + collapsible cards (2026-07-13)

Applied: fixed a CLAUDE.md drift (score-gradient stops cited as living in `utils.js`;
actually in `format.js`). Left as-is:

### The two glossaries are intentionally different files, not a drift
`docs/dev/llm/GLOSSARY.md` is the authoritative dev superset (`Code:` names, dev-only
sections); `yuu_clip/web/static/glossary.md` is a hand-written creator-facing subset
served by the in-app Terminology modal - the dev file's header states this split. A
large diff between them is expected, not drift. The static subset was verified
rebrand-consistent and free of banned code-name terms.

### `format.js` score-gradient hex stops and `_lerpColor` rgb() output kept as literals
Sanctioned by the CLAUDE.md color rule: `_scoreBorderColor`'s stop list and
`_lerpColor`'s interpolation are a continuous data encoding (score -> color ramp), not
theme chrome, so they can't be discrete `var(--token)`s. (Now at
`core/format.js:32` post-ESM-migration; was cited as `format.js` line ~19 at time of
writing - path/line drifted with the feature-subdir migration, decision unchanged.)

### `fonts/OFL.txt` is the correct, complete OFL 1.1 for the bundled Oxanium woff2
Co-located with `oxanium.woff2` in `web/static/fonts/`, satisfying OFL condition 2
(license + copyright must accompany each copy) - no separate NOTICE pointer needed.
**Obligation to carry forward:** any distribution shipping the woff2 must ship
`OFL.txt` alongside it; `pyproject.toml`'s `[tool.setuptools.package-data]` globs
`web/static/fonts/*` explicitly for packaged builds.

---

## Sidebar declutter - width and disclosure calls (2026-07-12)

UX pass moving rare sidebar controls behind "More filters" `<details>` and per-section
"..." menus.

### `--sidebar-width` raised to 300px to keep the primary filter row on one line
Keep 300px (was 240px) - the clip-status row (All/Unreviewed/Approved/Rejected with
count badges) wraps to two lines below ~295px; 300px is the measured threshold plus a
cushion, raised on direct user request. **Do not reclaim the width back toward 240px**
without re-checking the status row still fits. Chip padding/font stayed at Stage-0
sizes to preserve tap targets - width was the chosen lever.

### Section action menus reuse `showKebab()`, not a new dropdown
The Clips and Recordings "..." menus intentionally reuse `ui.js showKebab()` (one
dropdown/close/click-away/Escape scheme, not two). The `right:auto` fix in
`showKebab` (menu had inherited `.hamburger-menu`'s `right:0`, stretching to the
viewport edge) benefits all callers - don't special-case the sidebar menus.

---

## Phase 7 UX/UI (dedup, word-highlight captions, colour picker, context-scoped terms) (2026-07-10)

Applied: `aria-label="Colour picker"` on the colour-picker popover; fixed a lone curly
apostrophe in `hotwords.js`; added an in-flight "Checking..." state to "Check
duplicates" (`clips.js scanDuplicates`). Left as-is:

### Export dialog word-highlight controls are always editable (not hidden when captions != burn-in)
They live inside the "Caption style" `<details>`, whose header already states
"Applies to burned-in captions only" - the same rule governing the always-editable
Font/Size/Position controls beside them. The reel modal instead hides its
word-highlight row until burn-in is chosen, a different but internally-consistent
pattern for a smaller control set. Revisit only if the whole section is reworked to
gate on caption mode.

### "Settings -> LLM scoring" and other browser-DOM arrow glyphs kept as U+2192
The right-arrow appears ~30 times across served `.js`/`.html`, an established
browser-DOM typographic convention (same basis as the 2026-07-09 ellipsis decision).
Browser markup renders as UTF-8 - no cp1252 risk.

### Merge (dedup) confirmation is sufficient; no undo
The merge action deletes clip B irreversibly but is gated by a
`showConfirm(..., danger=true)` stating "This cannot be undone.", defaulting focus to
Cancel, with a red destructive button - proportional for a single-user tool. A full
undo stack is a feature, not a review fix.

---

## Phase 6 docs and comments (2026-07-10)

Applied: ASCII-fied non-ASCII glyphs in Python comments/docstrings/console strings
(`db/models.py`, `subtitles.py`, `common.py`, `reel.py` - the last a real cp1252
console-crash risk via `print()`/`_log.info`; `config.py`); fixed the stale
`pytest.ini` markers paragraph in CLAUDE.md (only `live_remote` remains; tiers split
by directory); fixed stale flat test paths in five route files' Feature-map headers;
added a **Duplicate Clips** glossary entry and a **Word highlight** captions bullet to
`docs/user/FEATURES.md` (both still present). Left as-is:

### Feature-map header `·`/`->` glyphs, and `# -- ... --` section dividers
Established codebase-wide convention (`·`/`->` in 21 route files, box-drawing dividers
in 8+ modules), comment-only so never reaches the cp1252 console. Sweeping only
touched files would desync from ~15 untouched ones for no gain.

### `web/routes/llm.py` "Settings -> LLM scoring" `HTTPException` detail strings
Pre-date baseline `16a30fa`, render in browser toasts as UTF-8, not console/log-bound
- browser-rendered non-ASCII is allowed per the 2026-07-09 ellipsis decision.

### `reel.py` title-card text (ellipsis, `·` separator) and `contexts.py` "Pokemon"
Rendered into the video title card (ffmpeg drawtext data) or an LLM prompt string
(proper-noun content, correctly spelled) - not comments, not console output.

### Markdown docs (`CLAUDE.md`, `FEATURES.md`, `GLOSSARY.md`) arrows/en-dashes
Rendered-as-UTF-8 docs, not console output; use `->`/`-`/`...` consistently. Match the
convention when adding new copy.

---

## Phase 5 logging (align / dedup / term_scope / captions) (2026-07-10)

Added: two silent-fallback logs in `transcribe/align.py` `realign_words` (a word with
no model-alignable characters -> debug; a span/token count mismatch -> warning), so a
caption edit silently losing word-highlighting is diagnosable. Cleanup: replaced 9
mojibake em-dashes in `export/render.py` with spaced hyphens (three were
`console.print` strings streamed over SSE, rendering as garbage). Left as-is:

### `scoring/term_scope.py` `terms_for_video` silently drops orphaned-slug terms
`terms_for_video` runs once per clip inside the full-project rescan loop - a log there
would be per-iteration spam. Orphaned terms only arise after a context is deleted
(creation is guarded by `validate_context_slug`); if this ever needs to be observable,
surface it at context-deletion time or a one-shot integrity check, not this hot
filter. `video_context_ids`'s malformed-JSON `except` is the same tolerant-normalize
pattern.

### `align.py` non-English / empty-text gates are silent by design
Expected normal paths, not failures - logging them would be noise on every edit. The
genuine failure paths (missing source, ffmpeg-extract failure, alignment exception,
plus the two added above) all log with the segment id or a bounded text preview.

---

## Phase 4 refactor (context_slug + dedup + dev CLI review) (2026-07-10)

Applied: shared `normalize_context_slug`/`validate_context_slug` in
`web/routes/common.py` (was duplicated in `hotwords.py`+`sensitive.py`); merge buttons
in `clips.js` moved from inline `onclick` to `#detail` event delegation; removed three
never-applied pytest markers. Left as-is:

### `clips.js` `_duplicatePartners` recomputes overlap as `end_ms - start_ms`
The server's `dedup._overlap_ratio` divides by `ClipCandidate.duration_ms`, a computed
property (`db/models.py`) returning `end_ms - start_ms`, not a stored column - so the
client's recompute and the server's field are the same expression and cannot diverge.
Revisit only if `duration_ms` ever becomes an independently-stored column.

### `dev/` CLI, `transcribe/align.py`, `subtitles.py`, `colorpicker.js`, `config.py` rules table
Reviewed for function length/one-concern/naming/no-hardcoded-colours/DB-session
hygiene - all already cohesive with shared helpers in the right place. No high-value
structural change found.

---

## "Current transcript" selection keyed on created_at, not id (2026-07-09)

Unified ~7 sites that pick a track's latest transcript (two divergent sort keys,
`t.id` vs `t.created_at`) into one helper, `latest_track_transcript(track)` in
`db/models.py`, keyed on `created_at`.

**Keep the `created_at` key; do not flip it back to `id` or re-debate without new
evidence.** The two keys cannot disagree in the current schema: force-retranscribe
deletes all prior track-level transcript rows before inserting the new one
(`ingest.py` `_transcribe_and_check_overlap`), so each track holds a single
track-level transcript and both keys are monotonic at insert with no ties.
`created_at` was chosen because it directly expresses "most recently created" and was
already the majority (5 of 7 sites). Only worth revisiting if multiple concurrent
track-level transcripts per track ever become possible.

---

## U+2026 ellipsis in browser DOM text is fine (not a cp1252 violation) (2026-07-09)

The web UI uses the real ellipsis glyph `...` (U+2026) consistently across ~80 sites
in the `.js`/`.html` served to the browser.

**Kept as-is - do not sweep.** The cp1252 hard-rule targets console/log output (the
legacy Windows console encodes stdout as cp1252), not browser markup, which is served
and rendered as UTF-8 where the glyph displays correctly. Sweeping ~80 consistent UI
strings would fight an established typographic convention for no correctness gain.
This applies only to browser DOM text - any ellipsis reaching a
`print()`/`console.print`/log string still must be ASCII. (This is the anchor decision
cited by later reviews' arrow/glyph calls.)

---

## Logging review of the llama-server pool - deliberate silences (2026-07-09)

Two paths in `scoring/llamacpp_server.py` left intentionally silent: `_post` (per chat
request) and `_pump_logs` (per stdout line) are not logged per-call - `_post` runs
once per clip during a re-score of hundreds, `_pump_logs` once per output line, so
either would be spam; a failed `_post` propagates to the scorer, which logs it once
with `exc_info` and the clip id. Startup failures are raised, not logged in the pool -
`_raise_startup_error` embeds the last 15 lines of child stdout/stderr in the
`LlamaServerError`; the caller that owns the operation logs it, avoiding a double-log.
The one exception logged in-place is the Vulkan->CPU fallback, because there the
exception is swallowed (we recover) so its detail would otherwise be lost.

---

## UX review of LLM model selection - "LLM scoring" term kept (2026-07-08)

The Settings model manager and setup wizard restructure led with the model picker and
hid the privacy guarantee/engine choice/manual paths under "Advanced AI options."

**"LLM scoring" reads as jargon but was kept as-is** - it is the authoritative
`docs/dev/llm/GLOSSARY.md` term, explicitly "not AI scoring," consistent across UI/CLI
help/docs. Renaming would desync this surface from the glossary or require a
glossary-wide sweep, out of scope for a UX pass. Revisit only as a deliberate glossary
change, not a one-off relabel.

---

## Packaging-overhaul review - two keep-as-is calls (2026-07-07)

### `routes/llm.py` capability-tier builder functions kept separate
Five functions (`_similarity_tier`, `_descriptions_tier`, `_speaker_labels_tier`,
`_audio_events_tier`, `_vertical_framing_tier`; `llm.py:193-306`) share a shape (check
availability, report installed/missing, pick a status string) that looks
collapsible into one generic `_build_tier(...)`. Kept separate: the shared shape is
coincidental, not shared knowledge - each tier's availability check is a different
backend call, and the two are added to independently. Collapsing would trade five
readable functions for one longer function with a branch per capability. The response
shape is also public API surface consumed by `settings.js`'s Capabilities section -
one function per capability keeps a change to one from risking an accidental shape
change to the others.

### `audio_event.py` / `laugh.py` `_load_failed` load-guard duplication kept
Both scorers cache a "model failed to load, don't retry every clip" boolean the same
way (module-level flag, set on except, logged once). Below the rule-of-three (two
instances); the two call sites are coupled to tests asserting each module's own
`_load_failed` state independently - a shared helper would need a shared mutable
singleton (risking the two scorers clearing each other's failure state) or a class per
instance, more machinery than two five-line guards justify. Revisit if a third scorer
needs the pattern.

---

## SPA decomposition Stage 05 - `index.html` to server-side partials: NO-GO (2026-07-05)

**SUPERSEDED 2026-07-17.** The stage-05 no-go call was reversed: `index.html` is now
the htmlstitch build from `index.src.html` + partials (`yuu_clip/dev/htmlstitch.py`,
`tests/unit/test_index_html_drift.py`), so the "no-build SPA" rationale no longer
holds. Kept only as a pointer so a future review doesn't mistake the htmlstitch
partials build for reintroducing something already rejected - it isn't; the rejection
was reversed by design.
