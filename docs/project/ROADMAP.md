# yuu-clip - Roadmap

Forward-looking only. Deliberate scope calls (things we chose not to do, and why)
live in [DECISIONS.md](DECISIONS.md); this file tracks just the work that is still
open.

Two tiers:

- **Numbered sections** are prioritized open work - things we intend to do, or have
  scoped and deliberately deferred with a known implementation path.
- **[Possible future ideas](#possible-future-ideas)** is a brainstorm bin - loose,
  unscoped ideas that may never be built (and some that may not belong in yuu-clip at
  all). No commitment implied by their presence here.

---

## 1 - Verification & known-issue debt

Implemented-but-unverified surfaces and latent traps to close before distribution.

### Packaged-app VM run findings (2026-07-19, v0.1.23)

First real clean-VM packaged run. The native-file-protocol surface (previously the
headline unverified item here) was **verified working** and closed. Shipped since:
the immediate/easy subset (reel timebase mismatch + false-success reporting, DB-locked
-> clear 503, CLI log-line leak, Getting-Started modal X/scroll, HF symlink warning,
empty wizard Optional section); retry-on-locked for lightweight writes so
approve/reject and speaker-merge succeed during a long analyze instead of failing;
recovery for the active-but-missing model state; a speaker-clustering re-tune (raised
cluster distance + a distance-gated small-cluster prune); the model-download progress
view now survives a Settings Save/re-render instead of vanishing; analyze progress has
its own dedicated header row and the window has a sane minimum size; and speaker names
are click-to-rename directly from a transcript, with every floating menu (speaker/
kebab/color-picker) now height-capped so a rename field can no longer fall off-screen.
Full triage with repro detail is in the private planning workspace
(`PACKAGED-APP-FINDINGS-2026-07-19.md` + `PACKAGED-APP-FIXES-PLAN.md`, both closed out
except the two items below).

- [ ] **Stale single-job lock falsely blocks export** - after an analyze + reel build,
  export was refused with "another job is running" when none was; a page refresh cleared
  it. Audited (2026-07-19): the job-state flags are correctly balanced, no backend leak
  found - likely a transient busy state or a symptom of the now-fixed false-success bug.
  Re-verify on the next VM/packaged run now that the reel and DB-retry fixes have
  shipped; only chase further if it still reproduces.

- [ ] **Retire the prose-regex progress fallback** - the analyze/score pipeline now emits
  a structured `@@PROGRESS` marker (`pipeline/progress.py`) alongside the human
  `console.print` lines, and the web UI drives the job pills off that marker (see the
  sequential-and-honest processing work). The old prose regexes in `jobs.js`
  (`INGEST_STEPS`/`SCORE_STEPS` `patterns`) are kept one release as a fallback - remove
  them once the marker path is proven in real runs. Still open: the `export/` engine
  emits progress via `console.print` only (no marker channel yet); add one if export
  ever needs a structured progress bar or to run in-process. **Trigger occurred
  (2026-07-19):** Batch Export's progress pill was asked to show the current clip's id +
  description, which a regex-parsed prose line can't carry cleanly - give `export/` a
  real marker channel for this instead of a one-off regex hack. Detail in the private
  planning workspace, `UX-BUG-HUNT-2026-07-19.md` B14.

- [ ] **Full-recording transcript panel still renders every page in the DOM
  (virtualize instead of just paginate)** - a real lag report on a 3+ hour
  recording (~7000 transcript lines) traced to `loadVideoTranscript` in
  `static/analyze/transcript.js` building the *entire* transcript's HTML in one
  `innerHTML` write (tens of thousands of DOM nodes in a single paint). Quick fix
  shipped (2026-07-20): the panel now renders 300-line pages with a "Show more"
  button (`_renderNextTranscriptChunk`), so the *initial* render is fast. Not
  fixed: a user who clicks through to the end of a very long transcript still
  ends up with all pages live in the DOM at once (memory/scroll cost still grows
  unbounded with total length) - true virtualization (only the visible rows are
  ever in the DOM, e.g. windowing by scroll position) would close that, but is a
  bigger lift not justified until someone actually hits it in practice.

- [ ] **Video list (sidebar) has the same unbounded-DOM-rebuild shape** - audited
  2026-07-20 alongside the transcript fix: `videos.js`'s `_renderVideoList` ->
  `_renderGroupedVideoItems` -> `_videoItemLi` rebuilds the *entire* video list from
  `AppState.videos` (unpaginated - `GET /api/videos` returns every non-split-parent
  video in the project, project-wide history, not scoped to one recording) on every
  load, filter, sort, AND search keystroke. For a solo user accumulating hundreds to
  low-thousands of recordings over months, this is the same failure class as the
  transcript bug, and arguably worse since it re-triggers on every keystroke rather
  than once per page load. No fix scoped yet - revisit if a user's sidebar actually
  gets this large (the transcript bug was confirmed via a real 3h+ recording; this one
  is audit-only, not yet confirmed painful in practice).

- [ ] **Drain the last of the `window.X = X` shim (page.evaluate follow-on)** - the module
  testability refactor (2026-07-21) converted 68 cross-module `window.foo` reads to real
  `import`s and took `static/main.esm.js`'s shim from 194 to 155 lines, then a same-day
  follow-on corrected the inventory and dropped 37 more dead lines (118 left). A
  2026-07-22 session corrected the inventory AGAIN (the 118/100/18 split was still off in
  both directions - see the "Phase 2 session" note in the private plan doc for the exact
  false-positive/false-negative bugs and how they were fixed) and landed 3 gated commits:
  8 more dead lines dropped (comment-only or already-fully-migrated survivors), one full
  Playwright-to-vitest port (`openNameCorrections` -> `tests/js/people/namecorrections.test.js`,
  the template for any pure-DOM-render panel), and one poke-to-real-click swap
  (`closeOpenProjectModal` -> a click on the modal's own Cancel button). Shim now **98
  lines** (was 118). Key finding for whoever resumes: a large fraction of the remaining
  names are NOT good vitest candidates - several files sampled this session
  (`test_ui_exporteditor.py`, `test_ui_hotwords.py`, `test_ui_sensitive.py`,
  `test_ui_help.py`) are genuinely Playwright-appropriate throughout (real server/DB CRUD,
  mouse-drag + geometry, external-request blocking, focus/keyboard/escape), so budget this
  as "triage each name, port the pure-DOM ones, click-swap the modal-close ones, leave the
  rest documented as genuine" rather than "convert 90 names to vitest tests" - expect
  well under half to actually be portable.

  **2026-07-22 Phase 2 continuation session landed 2 more gated commits, 109 -> 98:** the
  contexts.js bucket (`test_ui_contexts.py`) was fully triaged - 8 poke-to-real-click swaps
  (`openContextManager`/`closeContextManager`/`openNewContext`/`cancelContextEdit`/
  `duplicateContext`/`openCharacterForm`/`cancelCharacterEdit`/`_updateCharBoostLabel`, all
  onto real buttons/inputs that already existed), `_deriveContextId` left as a genuine poke
  (used only to compute an expected value for comparison; its actual derivation behavior is
  already covered by real `page.fill()` typing in the same file). A cross-file `exportClip`/
  `confirmExport` sweep (`test_ui_clips.py`/`test_ui_clips2.py`/`test_ui_smoke.py`, 10 call
  sites) swapped onto the real Export button and `#export-confirm-btn`. One more genuinely
  dead line found (`revealInFolder` - its only "reader" left was a comment in
  `test_ui_clips2.py` naming it in prose, not a real poke). A `toggleHamburger` swap landed
  2 of 3 sites (`test_ui_clips2.py`) but was reverted for the third
  (`test_ui_keyboard.py::test_hamburger_menu_peels_before_modal`) after a real run showed
  the real button is covered by a modal overlay there by design - same lesson as the
  `toggleGroupSelect` revert in the prior session: verify swaps with an actual run, and
  revert on any real failure rather than fighting the timing. **Regenerate the inventory
  with the corrected 2026-07-22 script before resuming - don't reuse any prior N/dead/
  genuine counts, several were wrong at least once.**

  **2026-07-22 Phase 2 further-continuation session (test_ui_video.py bucket), 98 -> 93,
  1 gated commit:** re-ran the inventory fresh first (confirmed 98, no further script bugs).
  `test_ui_video.py`'s 9 holders triaged one by one rather than assumed from the holder-count
  note alone: `setupRecordingPreview` and `closeActionsModal` were both fully dead (every real
  production consumer already imports them directly - `clipcreate.js`/`videos.js`/`split.js`/
  `exporteditor.js` for the former, `shortcuts.js` for the latter - and their only "reader" in
  `test_ui_video.py` was a stale comment from an earlier migration, not a real poke); dropped
  both, 2 lines. `_buildMediaUrl` was a genuine poke (`TestNativeMediaProtocolUrlBuilder`) but
  a pure function with no DOM/navigation/geometry at all - ported to
  `tests/js/core/preview.test.js` (6 cases), which then made its own shim line dead too, so it
  dropped as a same-commit follow-on (net: the vitest port enables a shim drop, same pattern as
  `openNameCorrections` two sessions ago but for a pure-function file split rather than a whole
  file). `selectVideo` and `deleteVideo` were each real-click-swapped: `selectVideo`'s one poke
  became a click on the first `#video-list li[data-video-id]`; `deleteVideo`'s poke became a
  real path through the Additional Actions modal's "Remove Recording" danger row (mirroring the
  existing `Split Recording` row-click pattern in `TestVideoActionsModal`) - both then dropped
  too since neither had another reader. `AppState` and `_renderVideoList` are synthetic-state
  seeding shortcuts (`TestRecordingFilterCounts._seed` writes hand-built `AppState.videos` no
  fixture combination produces) - LEAVE IT, same class as the `renderDetail` pattern below.
  `regenSummaryAuto` is also LEAVE IT: its confirm-copy and DELETE/SSE request-shape are
  already covered browserless in `tests/js/videos/videos-summary.test.js` (and
  `videosdelete.test.js` for `deleteVideo`'s own request shape) - what's left in Playwright is
  only the real `#confirm-modal` DOM wiring, and `regenSummaryAuto`'s real trigger (a kebab
  item on a video with a generated summary) has no fixture precondition to reach without a live
  LLM call, so the detached-button poke stays as the cheapest way to open that modal. Shim: 98
  -> 93 (5 lines: 2 dead, 1 vitest-port-enabled, 2 real-click-enabled). Gate: bundle, test-js
  356 (350 -> 356, +6 `_buildMediaUrl` cases), test-unit ratchet 5, test-api 2992, targeted
  `test_ui_video.py` 20 passed (26 -> 20, -6 for the migrated class), full test-ui 644 (650 ->
  644), lint clean.

  **`test_ui_keyboard.py` bucket (8 holders) triaged, zero changes:** every name
  (`AppState`, `showAlert`, `toggleHamburger`, `openControlsModal`, `showKebab`,
  `openGlossaryModal`, `openSplitEditor`, `closeSplitEditor`) is a setup poke used to
  construct a specific stacked-modal or synthetic-data state before a keyboard/focus
  assertion runs (a fabricated split-editor video with a controlled `duration_ms`, a
  fabricated kebab menu with test-only callbacks, a modal deliberately opened before an
  unreachable-by-real-click hamburger) - the file's entire point is CC-2/CC-3/CC-4
  Escape/Tab layering, which needs deterministic stacking, not the normal open path. This
  confirms the `toggleHamburger` lesson from the prior session generalizes to the rest of
  the file. Left untouched.

  **`test_ui_reel.py` bucket (6 holders), 93 -> 89, 1 gated commit:** `AppState` is a
  read-only `wait_for_function` poll (`AppState.canReveal === true`), not migratable.
  `openHighlightReelsModal` stays a poke - it is real (`#btn-highlight-reels` opens it) but
  shared with `test_ui_sessions.py`, so converting only this bucket's call sites would not
  drop the shim line; left for whichever session next touches `test_ui_sessions.py`.
  `switchReelTab`, `_reelMove`, `_reelToggle` and `closeHighlightReelsModal` were each the
  SOLE poked reader and each already has a real wired control in `reel.js`
  (`renderReelClipList`'s per-row `onclick`/`onchange`, `#reel-tab-btn-build`/`-view`,
  `#reel-close-btn`) - swapped to `page.click("#reel-tab-btn-view")`, clicking the row's
  "Move down" button and unchecking its include checkbox, and `page.click("#reel-close-btn")`
  respectively. All 4 shim lines dropped. Gate: bundle, test-js 356 (unchanged - no JS test
  touched), targeted `test_ui_reel.py` 19 passed and `test_ui_sessions.py` 9 passed (checked
  since it shares `openHighlightReelsModal`), test-api 2992, full test-ui 644 (unchanged
  count - triggers swapped, no tests added/removed), lint clean.

  Next buckets by holder count (regenerate the inventory before trusting these - numbers shift
  as prior buckets get retriaged): `test_ui_clips.py` (10, mostly `renderDetail`/synthetic-clip
  pokes - likely LEAVE IT, used identically across 6 files, see the flag below - do not attempt
  without asking first), `test_ui_clips2.py` (8, same reason), `test_ui_analyze.py`/
  `test_ui_settings.py`/`test_ui_whisper_prefetch.py` (6 each, not yet inspected).

  **Flag before touching**: `renderDetail` (the single biggest remaining name, reused
  identically via a synthetic `AppState.clips`/`activeClipData` + `renderDetail(...)` pattern
  across 6 files - `test_ui_clips.py`, `test_ui_clips2.py`, `test_ui_hotwords.py`,
  `test_ui_sensitive.py`, `test_ui_transcript.py`, `test_ui_vision.py`) is a cross-file project
  on its own, not a normal bucket pass - ask the owner before attempting it.

- [ ] **In-process LLM/scoring jobs lack progress + a Cancel** - found in the v0.1.27
  manual checks: "Generate timeline" and "Suggest names" show no progress and offer no way
  to cancel, and a sweep found this is one class, not two bugs. Every *subprocess* job
  (analyze, score, reel, export, retranscribe, re-detect, regenerate clips) already has
  pills + a working Cancel; every *event-loop* job (timeline, summarize, regenerate-summary,
  rescore-all, rescore-failed, redescribe-all, hotword-scan, find-similar, infer-speaker-
  names, session summarize) calls `_openSSE` directly, so it gets neither - and can't reuse
  the shared Cancel button, which only kills the subprocess handles. The two batch actions
  whose own dialogs say "several minutes" (rescore-all, redescribe-all) are the worst: long,
  zero feedback, no cancel. Progress is cheap (wire them through `startJobUI`/`updateJobUI`
  like single-clip rescore already does; `rescore-clips` even streams `Scored i/total` lines
  today); Cancel is the real lift (event-loop jobs have no cancel token). Full triage +
  per-site table + two-part fix in the private planning workspace
  (`PROGRESS-CANCEL-GAP-2026-07-20.md`). Fix the whole set together, not timeline alone.
  **Baseline rule (owner, 2026-07-20): every long-running progress/loading indicator must show at
  minimum the elapsed time since the process started** - a bare spinner reads as hung. Two instances
  were fixed on report: the post-analysis "Preparing preview" warm-up now shows the encode % + elapsed
  (it discarded the proxy encoder's SSE lines), and the YouTube/Twitch download percentage now streams
  live (it was block-buffered in the raw-`print` import subprocess). Apply the same elapsed-time-minimum
  when wiring the remaining event-loop jobs above.

- [ ] **Hoist repeated inline `style="..."` in the index.html partials into `app.css`
  classes (opportunistic)** - the WS-E split made `index.html` a stitch of
  `static/partials/*.html`; each partial still carries verbose inline styles (hint text,
  small ghost buttons, modal field rows). This is pure maintainability polish, not a
  correctness or theming issue: the colour-literal guard already covers the partials
  (`tests/unit/test_static_theme_colors.py` globs every static `*.html`), and the most-
  repeated pattern is `style="display:none"` which is JS-toggled and must NOT become a
  class. Extract opportunistically when touching a partial, verifying with full `test-ui`;
  not a public-flip blocker.

---

## 2 - Pre-distribution blockers

Wanted before distributing beyond friends/trusted users.

- [ ] **Verify FFmpeg source-hosting URLs resolve once the repo is public** - the
  GPL-compliance story ships the FFmpeg + libx264 source archives *side-by-side* with each
  installer, and the matching archives are also attached to the `third-party-source_0.1.0`
  GitHub Release as a durable public mirror. That release already exists but its asset URLs
  404 for third parties while the repo is private, so `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md`
  already cites them as live. After flipping the repo to public, confirm both URLs actually
  resolve for a logged-out visitor (and keep shipping the side-by-side archives - the mirror
  is additional, not a replacement). Do not distribute an installer publicly before the flip,
  or those cited URLs are dead links. See `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` and
  `HOW-TO-RELEASE.md § Bundled FFmpeg`.

- [ ] **Enable private vulnerability reporting** (Settings -> Security). `SECURITY.md`
  already points reporters at the "Report a vulnerability" flow, which needs this turned
  on. Verify it is available/enabled once the repo is public.

- [ ] **Confirm branch protection on `main` takes effect once public** - the rule is
  configured but GitHub does not enforce protected-branch rules on a private repo on the
  Free plan; it should start enforcing when the repo goes public. Re-check after flipping.

- [ ] **Verify the in-app Help & Guides links resolve for a logged-out visitor after the
  public flip** - the Help & Guides modal links user docs on GitHub that 404 for anyone but
  the author while the repo is private. The pre-public polish pass (WS-C) bundles those docs
  in-app so help works offline, but the per-doc "View online" GitHub fallback links remain -
  confirm they resolve for a logged-out visitor once the repo is public.

- [ ] **Opportunistic: extract remaining inline styles in the partials into `app.css`
  classes.** The `index.html` build-time stitch (`static/index.src.html` + `partials/*`
  via `yuu-dev bundle`) already shipped; the paired inline-style extraction was deferred as
  opportunistic cleanup (the ~100 remaining inline styles are valid `var(--token)`/layout
  styles, and the color-literal guard already globs the partials, so there is no safety
  gap). Do it when a region is being edited anyway, not as a blind sweep.

- [ ] **Retire the "wipe the DB freely" schema convention and add real migrations.** So far
  every schema change (new column/table) has been handled by telling the sole dev user to
  delete/rebuild `project.db` - fine pre-release when the only affected DB is the author's
  own, but once real users have their own analyzed libraries a schema change must not
  silently 500 (`no such column: ...`) or require them to lose their work. Add a migration
  mechanism (Alembic, or a minimal hand-rolled versioned-migrations table) before the public
  flip, and convert past ad hoc column additions into the first migration set.

---

## 3 - Larger / speculative features

- [ ] **Pyannote speaker-labels backend** *(shelved)* - a neural diarization backend that
  is generally higher quality than the default SpeechBrain (better separation on
  overlapping speech and many-speaker recordings). Removed 2026-07-14 because it required
  a HuggingFace account, a Read token, and manually accepting gated model terms for
  `pyannote/speaker-diarization-community-1` - too much setup friction for a distributed,
  non-developer tool, and it was never on the default path. Shelved to shed the
  second-backend maintenance burden; revisit only if SpeechBrain's quality proves
  insufficient in practice. The generic `voiceprint_backend` isolation (embeddings from
  different backends are never compared) was kept, so a re-add is mostly restoring the
  client class, the config enum value, and the Settings/token UI.

- [ ] **Transcript & speaker editing UX - fuller pass** *(deferred, behavior OK today)* -
  the concrete ask (**name or rename a speaker directly from a clip or video transcript**)
  shipped: the speaker name label in the transcript is now click-to-rename, and every
  floating menu caps its height so the dot menu's rename field can no longer fall off-screen.
  What remains deferred is the broader smoother-editing pass over the transcript/speaker
  surface - scope it fresh when this area is next touched (candidates surfaced during R1:
  per-line menu polish, whole-recording speaker management, bulk line moves, caption fixes).
  **Owner call (2026-07-20): definitely revisit the Speakers card UI/UX as part of this** -
  the current card grew feature-by-feature (per-row merge picker, voice/person match rows,
  Suggest-names, samples) and wants a deliberate layout/interaction rethink, not just the
  incremental fixes already shipped. Fold the "Suggest names" progress+cancel gap (section 1)
  into the same pass since it lives on this card.

- [ ] **Sidebar grouping for split segments** *(speculative)* - a collapsible parent row
  "session.mkv (3 segments)" with indented children, as an alternative to the flat list.
  Deferred until the flat list proves insufficient in practice.

- [ ] **Persistent undo stack for clip status changes** *(speculative)* - today undo is a
  single-step, time-boxed affordance: the approve/reject toast carries an Undo button plus a
  visible ~5s countdown bar (`showUndoToast`, `ui.js`), and Ctrl+Z reverts the most recent
  change until it expires (`undoLastStatus`, `clips.js`). A larger version would keep a
  non-expiring history so Ctrl+Z chains back through several recent status changes, reachable
  from a small history affordance. Deferred - the timed single-step undo covers the common
  "I misclicked" case; only worth building if multi-step regret shows up in real use.

- [ ] **Quality presets** *(on hold)* - named compute bundles ("Fast draft" / "Balanced" /
  "Max quality") that pick a matched set of Whisper model, energy mode, scene mode, and scoring
  weights in one choice. Deferred - no clear preset definitions yet.

- [ ] **Export-time transcript upgrade** *(shelved)* - re-run a higher-quality Whisper pass at
  export time so exported captions can use a bigger model without slowing the initial analyze.
  Shelved - the design wasn't fully worked out (unclear interaction with retranscribe and the
  caption sidecars that already exist).

- [ ] **Parallel job processing** *(speculative)* - the app is deliberately sequential today
  (see the sequential-and-honest processing work): heavy DB-writing jobs (analyze, score,
  retranscribe, summarize, vision-describe) serialize behind the single-writer SQLite lock,
  the UI runs one visible job at a time (single job header + one SSE handle), and a second
  heavy job is rejected with a clear "wait or cancel" message. A larger future feature would
  add a real job manager: multiple concurrent jobs, stacked progress bars, and CPU/GPU
  contention warnings. It stays bounded by single-writer SQLite (the DB-heavy jobs must still
  serialize their writes), so the real win is genuinely independent work (clip export, proxy
  builds) overlapping one DB job. Only worth starting on real demand.

- [ ] **Batch-analyze multiple recordings from the web UI** *(unscoped)* - the New Recording
  panel only ever queues one file (or one URL import) at a time; there is no multi-select or
  queue. The underlying loop-and-pause machinery already exists at the CLI layer
  (`cli/analyze.py`'s `analyze` command accepts multiple video paths/a glob and pauses between
  them via `_wait_while_paused`), but the web UI's `/api/analyze/start` always builds the CLI
  command for exactly one video, so nothing in the app can ever reach that multi-video path.
  Surfaced 2026-07-19 alongside a related bug (UX bug hunt B9): the job header's "Pause after
  current video" toggle was a dead control on a plain single-recording run. That is now fixed
  at the pipeline level - transcription and scoring both poll the pause flag mid-stage, and
  the stage boundaries poll it too - so the toggle does something on every run. Its *label*
  still describes the between-videos behaviour only, and would want revisiting alongside real
  batch-analyze support.

- [ ] **Right-click context menus for videos/clips** *(unscoped, deferred)* - investigated
  2026-07-19: everything a context menu would offer already exists via visible affordances
  (the video-level "Additional Actions" modal, per-field clip kebab buttons, the bulk-select
  toolbar) - nothing is only reachable by a hypothetical right-click, and there is zero
  existing `contextmenu` wiring anywhere in the app today. Building one would be a second,
  hidden path to things already reachable via visible buttons, cutting against the project's
  own discoverability-over-power-user-efficiency principle for a non-developer audience - so
  deferred rather than built for an initial release. Cheaper alternative if the underlying
  itch keeps coming up: sidebar clip-list rows have no per-row quick action today (only a
  bulk-select checkbox, or click-in to open full detail) - a small kebab button per row
  (reusing the existing `kebab-btn`/`data-act` pattern) would close that gap without a whole
  context-menu system.

---

## 5 - Platform reach

- [ ] **AMD / Intel GPU support** - code analysis done; the two GPU paths are in very
  different shape:
  - **LLM scoring already runs on AMD/Intel today.** The bundled `llama-server` uses Vulkan
    (vendor-neutral); `pick_gpu_device` / `_INTEGRATED_MARKERS` in `scoring/llamacpp_server.py`
    already recognise Radeon / Intel (UHD/Iris) devices. No work needed for LLM acceleration.
  - **Whisper transcription + diarization are blocked upstream, not in our code.**
    `whisper_device` accepts only `{cpu, cuda, auto}` (`web/routes/config.py`) and
    `_resolve_device_and_compute` resolves via `ctranslate2.get_cuda_device_count()`. CTranslate2
    has no working ROCm/OpenVINO backend on Windows, so this is not a config toggle - it needs a
    *different* Whisper runtime (whisper.cpp Vulkan/SYCL, or an OpenVINO whisper). Real project,
    deferred until the library reality changes.
  - Thermal monitoring (`analyze/thermal.py`, pynvml) stays NVIDIA-only and degrades gracefully;
    not a blocker, but no AMD/Intel temperature readout until a vendor-neutral source is wired in.
    See the dedicated thermal-sensor-coverage item below.
    (The wizard GPU-line messaging was corrected 2026-07-10 to report LLM scoring running on
    any-vendor GPUs via Vulkan while transcription stays NVIDIA/CUDA-only.)

- [ ] **CPU and non-NVIDIA GPU temperature sources (widen auto-pause coverage)** - the
  auto-pause machinery is now genuinely effective: as of the B9 follow-up, transcription,
  scoring, and every pipeline stage boundary poll the pause flag, so a thermal trip is
  honoured within seconds instead of at the end of the run. What limits it now is the
  *sensor*, not the response. `GpuThermalMonitor` reads pynvml only, so users on AMD/Intel
  graphics get no protection at all, and nobody gets CPU-temperature protection - which
  matters more than it sounds, because two of the heaviest stages are CPU-bound for a large
  share of users (Whisper on `whisper_device=cpu`, and ffmpeg extract/encode always).
  - `GpuThermalMonitor` is already the right seam: `available()` + `read_max_temp_c()`, with
    a `sampler` injection point tests use. Widening this means adding sibling backends behind
    a `make_thermal_monitor(config)` factory keyed on a `thermal_backend` value, per the
    swappable-backends convention - not adding vendor branches inside the existing class.
  - Candidate sources, all needing a licence check before adoption (LibreHardwareMonitor is
    MPL-2.0, fine; several Python wrappers around it are not): LibreHardwareMonitor / OpenHardwareMonitor
    over WMI for both CPU and GPU on Windows, `psutil.sensors_temperatures()` on Linux
    (returns nothing on Windows), AMD ADLX and Intel's Level Zero sysman for vendor GPU
    readings.
  - Design question to settle first: with several sensors live, does the trigger act on the
    hottest single reading or on per-source thresholds? A CPU at 95°C and a GPU at 95°C are
    not equally alarming, so one shared `thermal_pause_c` is probably wrong - likely
    per-source thresholds with per-source defaults.

- [ ] **Linux compatibility** - code analysis done. Python core is close (uses `platformdirs`, not
  raw `%APPDATA%`; `llama-server` binary name and FFmpeg resolution already branch off-Windows;
  platform-specific features guard and fail safe). The remaining work, phased:
  - **Backend-only Linux (small):** one real correctness bug **now fixed** - process-tree kill on
    cancel orphaned ffmpeg grandchildren on POSIX (`web/sse.py` `terminate_process_tree` did a bare
    `terminate()`); now launches the analyze-family subprocesses with `start_new_session=True` and
    `killpg`s the group. Remaining stubs: reveal-in-folder (`web/routes/reveal.py`, hard 501 off-Windows -
    needs `xdg-open`) and the dev-CLI stale-process reap (`dev/procs.py`, no-op off-Windows,
    contributor-facing only). CUDA-from-wheels may need `LD_LIBRARY_PATH` handling
    (`transcribe/whisper_runner.py` `_register_cuda_dll_dirs` is Windows-only) but degrades to CPU.
  - **Full packaged app (large):** the entire Electron packaging pipeline is Windows/NSIS-only
    (`electron/package.json` targets `win`/`nsis`; `electron/constants.js` is saturated with
    `LOCALAPPDATA`/`APPDATA`/`USERPROFILE`/`Scripts/python.exe`; every build/fetch script is `.ps1`).
    Linux needs a parallel packaging path (AppImage/deb, POSIX venv layout, bash build scripts) -
    effectively a second packaging project.
  - Plan (phased - backend-only vs. full packaged app): (internal planning notes).

- [ ] **UI localization (i18n)** - translate the web UI and setup wizard into other languages.
  Distinct from the shipped *transcription language* setting (what Whisper transcribes).
  Requires externalizing the hardcoded UI strings in `index.html` / the JS modules / `setup.html`
  into a string table first - batch it with any larger frontend rework. English-only is fine
  while the user base is friends/trusted users. Scope captured (no existing i18n infra found,
  ~16k lines of JS + 2k-line HTML shell to externalize) but deliberately not staged given the
  low current priority: (internal planning notes).

---

## Possible future ideas

Brainstorm-level, unscoped, no commitment. Some may not belong in yuu-clip at all -
kept here so they're not lost.

- **Session-aligned multi-POV clips** *(idea only)* - when several people record the
  *same* session from different POVs, treat their recordings as POVs onto one shared
  session timeline: a clip found in one POV maps to the same time window in every other
  POV, and review/export lets you pick which POV(s) to render for that window (one at a
  time, or side-by-side/PiP), chosen by hand. This fits yuu-clip's existing session
  model (find the moment, let the human choose how to present it).
  - **Deliberately excluded:** auto-switching the view based on who's speaking. That is
    an NLE/multicam-editor concern, and speaker-driven cutting produces jarring,
    sub-second flips whenever people talk over each other. Out of scope for a clip-finder.
  - **Make-or-break spike:** synchronization. Separate recordings don't start at the same
    instant and can drift (different clocks, dropped/variable frames), so the whole idea
    rests on frame-accurate alignment across recordings - audio cross-correlation on a
    shared sound, or a manual "line these up" nudge. Prototype sync in isolation before
    designing any UI; if alignment isn't reliable, the feature isn't.

- **Score learning loop** *(idea only)* - use accumulated manual score overrides to tune the
  prompt or scoring-weight vector semi-automatically. Requires a meaningful corpus of overrides
  first.

- **Copyright content detection** *(idea only - no implementation path)* - detect music in the
  audio track that might trigger copyright claims. Requires audio fingerprinting against a
  reference database (AcoustID or similar); needs evaluation of fingerprinting libraries,
  database licensing, and accuracy on gaming audio before it can be scoped.

- **Vision auto-describe feeding recording timeline generation** *(idea only)* - vision
  auto-describe (opt-in image-LLM clip descriptions) currently only ever runs against
  individual clip candidates; optionally feed the same descriptions into a recording's
  timeline generation too, not just per-clip descriptions.

- **Per-clip representative thumbnail frame** *(idea only)* - capture a representative frame
  per clip (e.g. partway through, or a scene-detected keyframe) to display as a thumbnail -
  useful in the sidebar clip list (currently text-only rows) and specifically wanted in the
  highlight reel builder, where picking clips by description alone is harder than picking by
  a glance at what's in frame. No thumbnail concept exists in the codebase today - would need
  a capture step, an on-disk storage/cache convention, a DB column, and a serving route.

- **Custom icon art replacing emoji** *(idea only)* - the icons used throughout the app (sort
  dropdown, clip scoring box, Getting Started legend, clip-list badges) are emoji today;
  replace with custom (not AI-generated) icon art.

- **Auto-update (download + install)** *(idea only)* - the notify-only GitHub update check
  (`yuu_clip/update_check.py`, Settings -> Updates) tells the user a newer release exists and
  links to it, but never downloads or installs anything. Actually fetching and running the new
  installer (e.g. via electron-updater, or a signed NSIS silent upgrade) is a materially bigger
  scope - partial-download recovery, signature verification, and a rollback path all need
  design before this is more than an idea.

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
