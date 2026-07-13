# yuu-clip - Completed Features

Recent shipped items. For pending work see [ROADMAP.md](ROADMAP.md).
Older entries live in [COMPLETED-archive.md](COMPLETED-archive.md) - see the
"Archived series" index at the bottom of this file.

---

## Sidebar declutter - progressive disclosure + action menus (done 2026-07-12)

A UX pass (`shqr-ux-ui-review`) over the sidebar, which had grown to ~35 persistent
controls stacked in a narrow column - the everyday review loop was visually buried
among rare filters, with no hierarchy or disclosure. Combined progressive disclosure
with relocating rare actions, across both the Recordings and Clips blocks; nothing
was removed, only re-homed. UI-only (`web/static/{index.html,app.css,clips.js,
videos.js,sessions.js,ui.js}` + 8 `tests/ui/test_ui_*.py`). Four stages:

- **Stage 0 - hierarchy.** The four clip status chips (All / Unreviewed / Approved /
  Rejected) now read as the primary controls; warning/export chips recede. Redundant
  Sort/Filter/Type micro-labels dropped (aria-labels kept).
- **Stage 1 - Clips "More filters".** The warning filters (Score error / Flagged /
  Duplicates), export-state filters, and the min-score dropdown moved into a
  `<details>` that auto-opens with a "filtered" dot when one of them is active, so the
  user never loses track of why the list is filtered (`clips.js _syncMoreFilters()`).
- **Stage 2 - section action menus.** A kebab "..." menu on each section header,
  reusing the existing `showKebab()`/`.hamburger-menu` scheme: Clips = New clip +
  Check duplicates; Recordings = Group + Suggest sessions (the standalone session
  toolbar row removed). Also fixed a latent `showKebab` bug - it reused
  `.hamburger-menu`'s `right:0`, so the fixed menu stretched to the viewport edge;
  cleared with `right:auto` (also tidies the pre-existing row/description kebabs).
- **Stage 3 - Recordings "More filters"** mirrors Stage 1 (Unscored + Errors hidden;
  All / Has clips stay visible). `--sidebar-width` raised 240 -> 300px so the primary
  status row stays on one line at default width.

## Clips vs Scenes - a second, longer candidate type (done 2026-07-11)

Added **Scenes** - longer contextual candidates (1-5 min, may include pauses and a
story arc) - alongside the existing punchy **Clips** (15-90s). Both live in the same
`clip_candidates` table under a `kind` discriminator and share all review + export
machinery; only generation and scoring diverge. Shipped as four staged commits, each
green before the next:

- **Stage 0 - storage + kind plumbing** (`dc47158`). Added `kind` (`'clip'` | `'scene'`,
  `NOT NULL DEFAULT 'clip'`) to `ClipCandidate` via `_ADDITIVE_COLUMNS`, so every existing
  row backfills to `'clip'` on next start - no manual migration. Scoped the destructive
  kind-blind paths so a clip re-window can never nuke scenes: `_clear_existing_clips` /
  `_regenerate_clips` filter `kind='clip'` (mirrored by `_clear_existing_scenes`),
  `score_video(kind=...)` only runs a kind's scorers over that kind's rows, `list_clips`
  gained a `kind` query param, and `_clip_dict` carries `kind`. Manual creation accepts an
  optional `kind` so a "New scene" affordance sets `kind='scene'`. Review UI gained a
  Clips/Scenes type toggle above the clip list (defaults to Clips, so existing flows are
  unchanged). Named deliberately clear of the pre-existing `SceneBoundary`/`SceneScorer`
  (a visual scene-cut timecode, unrelated).
- **Stage 1 - scene export guardrail** (`a5eb254`). An inline, advisory-only warning when
  a long scene is squeezed under a small size cap (e.g. a 4-min scene under a Discord 10 MB
  cap) - never blocks export; the preset/size-cap math is untouched.
- **Stage 2 - scene-specific scoring rubric** (`e263821`). A scene-mode LLM prompt distinct
  from the clip Funny/Dramatic/Action prompt, judging "worth watching as a Scene" (narrative
  arc, payoff, context) and populating the same `score_*` columns. `score_video`/rescore route
  scene rows to the scene prompt by `kind`; clip scorers never run over scenes. Tolerates a
  sparse-speech scene and falls back to the basic-description template when the LLM backend is
  off, like clips.
- **Stage 3 - opt-in LLM transcript-segmentation generator** (`bedfb14`). Off by default behind
  `scene_generation_enabled` (Settings toggle) + a `--scenes` analyze flag. New
  `segments/scene_segmenter.py::generate_scenes` asks the local LLM (`llm.request_scene_boundaries`)
  to propose scene boundaries over the transcript timeline, parses robustly, clamps to
  `scene_min_ms`/`scene_max_ms`, caps to `scene_target_count`, and writes `kind='scene'` rows.
  Pipeline pre-flights the backend (skips with a logged, user-visible reason rather than failing
  after a long run), clears scoped scenes on re-run, and scores via the Stage 2 path. Settings-only
  toggle (the wizard does not gain it).

**Stage 4** (scene-as-container: subdivide a scene into child clips via an additive
`parent_scene_id` self-FK) was scoped as explicitly optional - "only build if Stages 0-3
prove out" - and was **not built**: scene generation has not yet been exercised against a real
local LLM, so subdivision is premature. The storage stayed forward-compatible; the column is a
one-line `_ADDITIVE_COLUMNS` add whenever that stage lands.

Tests: full API suite 2362 green, full UI suite 825 green (one known pre-existing hotword
flake). Plan closed and its folder removed per the plans-live-outside-repo convention.

## Prebuilt Python environment - near-instant first-run install (done 2026-07-10)

First launch used to run a single offline `pip install` of the whole scientific-Python
stack (torch, ctranslate2, opencv, transformers, speechbrain, faster-whisper, ...) -
about 12 minutes on a fast laptop, 20+ on a slow VM, and machine-dependent. That work
now happens once at build time and ships as a finished environment; first run just
unpacks it. Measured first-launch on the slow VM dropped from 20+ minutes to under a
minute.

- **Build-time assembly with a relocation gate** - `scripts/build-prebuilt-env.ps1`
  builds the venv from the exact bundled python-build-standalone runtime and the exact
  wheelhouse wheels, smoke-imports the heavy natives, then *proves relocation* (moves
  the venv and its base python to fresh paths, repoints `pyvenv.cfg`, re-imports) before
  archiving. A relocation failure fails the build, not a user's machine. Wired into
  `build-release.ps1`.
- **First-run unpack + relocate** - packaged builds ship only `prebuilt-env.tar.gz`
  (the wheel, wheelhouse, and lock are dropped from the installer). `ensureVenv` extracts
  to a temp sibling, rewrites `pyvenv.cfg` to the bundled runtime's real install path,
  then atomically renames into place, with a disk-space precheck. A crash mid-unpack
  never leaves a half-venv that looks complete. Dev/unpackaged builds keep the
  pip-from-wheelhouse path unchanged.
- **`electron/prebuilt-env.js`** (unit-tested) holds the pure `rewritePyvenvCfg` and
  `decidePrebuiltEnvAction` logic. The real runtime writes `home`/`executable` keys (not
  the `base-prefix` family), which the rewrite targets.
- **Verified end-to-end on a clean VM**: install under a minute, and analyze, LLM scoring,
  and vision all run from the relocated environment; an over-the-top update re-extracts a
  fresh environment on a version change.

## Stale-until-restart UI state fixed as a class (done 2026-07-10)

The analyze panel's prerequisite banner, the per-clip "Basic description" chip, and vision
frames all read app state (`_prereqs`, `_aiPrivacyMode`, `_visionEnabled`) that was loaded
once at boot and never refreshed - so after a local model finished downloading, the "LLM
scoring is not configured" banner stayed until the app was restarted. Fixed the whole class:
a single `refreshServerState()` re-fetches config + prerequisites and re-renders the
dependent surfaces, and it now runs after any completed model download and after a settings
save. `_applyPrereqWarnings` also clears the banner when prerequisites are satisfied
(previously it could only ever show one). Two regression tests guard it.

## Desktop wrapper reliability + log privacy (done 2026-07-11)

Fixed a crash when closing the re-run Setup Wizard, closed the empty-taskbar gap
during startup, and stopped logs from leaking the user's OS username.

- **Setup wizard close crash** - re-running the Setup Wizard and clicking Close
  could take the whole app down. Root cause: the `setup:close` IPC handler called
  `win.close()` on an already-destroyed window (`TypeError: Object has been
  destroyed`), which surfaced as an uncaught exception that killed the backend and
  quit. Fixed by making the wizard single-instance (a second open focuses the
  existing window) and guarding every `win.close()` with `isDestroyed()`.
- **Wizard re-open left Close dead** - `registerWizardIPC` re-registered
  `setup:restore-backup` via `ipcMain.handle()` without first removing the prior
  handler, so a second open threw mid-setup, before the close handlers were wired.
  Added `setup:restore-backup` (and `setup:copy-text`) to the cleanup list.
- **Empty taskbar during startup** - non-wizard launches showed nothing on the
  taskbar for the multi-second backend boot. A "Starting yuu-clip..." window now
  appears on every launch path until the main window is ready.
- **Log path redaction** - the backend log and the Electron install log now
  replace the account-name segment of home paths (`C:\Users\<name>`,
  `/home/<name>`, `/Users/<name>`) with `<user>`, including inside tracebacks, so a
  shared log can't leak the username. A sanitizing formatter covers all backend
  output, including the in-memory buffer the "Download log" button ships.
- **Installer progress note** - the NSIS installer's options page now warns that
  the multi-GB bundle installs in several steps and the progress bar restarting per
  step is normal (electron-builder exposes no hook to label the phases directly).
- **Failure-path logging** - added `unhandledRejection`, renderer-gone, and
  main-window load-failure logging so future "it stopped working" reports are
  diagnosable from the Electron log alone.

## JS module-scoping refactor finished (done 2026-07-10)

Closed out the last of the frontend module-scoping work: every `web/static/*.js`
module is now IIFE-wrapped so it leaks nothing to the global scope beyond its
explicit exports.

- **`analyze.js` and `split.js`** - the two modules deferred at the 2026-06-29
  partial pass - are IIFE-wrapped with an `Object.assign(window, {…})` export list.
  Former top-level constants (`TRACK_LABELS`, `TRACK_LABEL_DISPLAY`,
  `DROP_VIDEO_EXTENSIONS`, the import-progress regexes, the split zoom/suggestion
  constants) are now closure-private.
- **Documented outside-IIFE bindings only:** cross-file live state stays at top
  level on purpose - `analyze.js` keeps `_probedInfo`/`_panelDirty`; `split.js`
  keeps `_splitDurationS`/`_splitPoints`/`_splitNames`/`_splitIgnored`/`_splitZoom`
  plus the test-seeded `_splitEnergyFlat`/`_suggestionPins`. Each carries a comment
  explaining why an `Object.assign` export would snapshot a stale value.
- Modules that export via a namespace (`colorpicker.js` -> `window.ColorPicker`) or
  register only listeners (`shortcuts.js`, no exports) were confirmed leak-free too.
- The "extract inline `display`-toggling style strings to CSS classes" half stays
  rejected (would change JS/CSS override behavior) and was left untouched.

## Custom colour picker + accent-colour theme variants (done 2026-07-09)

Replaced the native `<input type="color">` at all three colour sites with a
shared JS component, then layered alternative accent colours onto the themes.

- **Shared colour picker** (`web/static/colorpicker.js`): `ColorPicker.attach`
  progressive-enhances a hex-valued input into a hidden value-store fronted by a
  swatch trigger. Its popover has direct hex entry (validated `#RGB`/`#RRGGBB`), a
  recently-used strip, starter swatches, and a user-curated **named palette** (add
  with a name / remove). Recently-used and palette persist per user in
  localStorage. Wired into the per-speaker caption colour (`speakers.js`) and the
  title-card background/text colours (Settings -> Export). Chrome is all theme
  tokens; only picked colours are literals.
- **Accent-colour variants** (`app.css`, `settings.js`, `index.html`): a
  `data-accent` attribute on `<html>` orthogonal to the base theme, a new
  Settings -> UI **Accent colour** select (Default / Blue), `applyAccent()`, a
  `yuuclip-accent` localStorage key restored before first paint. Blue accents are
  tuned per base theme so every (theme, accent) pairing clears WCAG AA.
- **Tests:** new `tests/test_ui_colorpicker.py`; `tests/test_ui_theme.py` extended
  to the `(theme, accent)` contrast matrix plus an accent-switcher suite;
  speaker/title-card colour tests updated to the new component.

## Clip deduplication - near-duplicate overlap detection + one-click merge (done 2026-07-09)

Detects when two clip candidates on the same recording capture the same moment via
overlapping windows (e.g. a re-analyze pass producing a second, overlapping candidate
set) and lets the reviewer merge them with the existing merge mechanics.

- **Detection** (`scoring/dedup.py`): `find_duplicate_candidates()` flags live-clip
  pairs whose windows overlap by >= 70% of the shorter clip (pure timestamp overlap,
  no content similarity - this is a segmentation artifact, not cross-clip similarity).
  Rejected clips excluded; deterministic earlier-first ordering.
- **Scan route** (`web/routes/dedup.py`): `POST /api/videos/{id}/scan-duplicates`
  runs detection, writes a `possible_duplicate` system tag (survives reload, stays
  filterable), and clears the tag from clips no longer flagged on re-scan. Mirrors the
  sensitive-rescan route shape.
- **Review UI** (`clips.js`, `index.html`, `app.css`): a "Check duplicates" button
  above the clip list, a `possible_duplicate` sidebar badge + filter chip, and a detail
  notice that names the overlapping partner (computed client-side) with a one-click
  Merge into the current clip. The merge route now clears the stale duplicate flag from
  the survivor.
- **Tests:** `tests/test_dedup.py` (overlap-ratio boundaries, video scoping, rejected
  exclusion), `tests/test_dedup_route.py` (tagging, stale-tag cleanup, merge clears the
  tag, 404), and `tests/test_ui_clips.py::TestDuplicateDetection` (badge, filter,
  detail merge notice); plus an `--accent2` on `--surface` contrast assertion.

## Remove pre-release DB migration code + de-flake two UI tests (done 2026-07-09)

Follow-up to the code-quality review.

- **Removed the forward-only DB migration code** (`db/models.py` `_migrate` and
  `_backfill_clip_exports`, plus their `make_engine` calls). Pre-release there is no
  old on-disk schema to migrate: a fresh DB gets the full current schema from the
  ORM's `create_all`, and the sole dev DB is already migrated. Migration support is
  intentionally deferred until after the first release. `Video.path` carries no
  `unique=True`, so `create_all` already produces the constraint-free schema the old
  UNIQUE(path)-drop migration used to reach. The engine invariants (NullPool +
  busy_timeout) moved to a new `tests/test_db_engine.py`; the migration-specific tests
  and the export-backfill test class were removed.
- **De-flaked two UI tests** that failed intermittently under the 4-worker suite
  (both passed in isolation). The sensitive fuzzy-block test now selects the fuzzy
  mode before the term has a savable value, so the per-row auto-save can't persist a
  short exact term and pollute the shared dev DB; the profile create/delete test uses
  generous (10s) waits after its network round-trips instead of 3s.

Tests: full API suite 2138 green; affected UI files + smoke 82 green; lint clean.

---

## Code-quality review: llama-server bug fixes + transcript-selection unify (done 2026-07-09)

A two-pass code-quality review over the bundled-Vulkan llama.cpp migration (the
31-commit range that replaced the in-process llama-cpp-python wheel with a bundled
llama-server over HTTP and removed the Ollama backend), then a whole-codebase sweep
for subtler issues. Bugs fixed, each with a regression test:

- **Orphaned `llama-server.exe` after CLI analyze runs.** The server pool was reaped
  only by the web server's FastAPI lifespan; the analyze work runs in a separate CLI
  subprocess with no such hook, and on Windows a child is not killed when its parent
  exits - so every local-LLM analyze run leaked a `llama-server.exe` holding RAM/VRAM.
  Added an `atexit` reaper backstop in `scoring/llamacpp_server.py` (idempotent with
  the lifespan path).
- **llama-server pool race could kill an in-flight request.** An in-app frame-analysis
  (vision model) launched via `asyncio.to_thread` could land during an SSE text
  re-score; the vision `_ensure_server` ran `_stop_others` and terminated the text
  server while the re-score thread was mid-POST (which ran outside the lock) -> failed
  scoring + VRAM thrash. Added a `_call_lock` serializing ensure-server + POST as one
  unit; the shutdown path stays lock-free so a live server is still reaped promptly.
- **`--force` clip regeneration crashed on videos with exports.** Clips were cleared
  with a bulk `query(...).delete()` that bypasses the ORM `delete-orphan` cascade;
  with `PRAGMA foreign_keys=ON`, regenerating clips for a video that had any tracked
  export or clip-level retranscript raised `IntegrityError: FOREIGN KEY constraint
  failed`. Now clears via per-clip `session.delete()` (new `_clear_existing_clips`),
  so the cascade removes children. Reachable from the `regenerate-clips` route and
  `analyze --force`.

Also this pass:

- **"Current transcript" selection unified.** ~7 sites picked a track's latest
  transcript using two different sort keys (`id` vs `created_at`); collapsed into one
  `latest_track_transcript(track)` helper (`db/models.py`) keyed on `created_at` (the
  keys cannot disagree in this schema - see `docs/dev/REVIEW_DECISIONS.md`).
- **Local-model picker error state.** A catalog-fetch failure left the recommended-model
  picker blank under "pick one and it downloads in a click"; it now shows a
  plain-English message with a recovery path.
- **Setup-wizard download errors are now plain English.** The wizard surfaced raw Node
  errors (e.g. `getaddrinfo ENOTFOUND huggingface.co`); a new `describeDownloadFailure`
  in `electron/install-error.js` maps common network/disk/permission failures to
  actionable copy (raw message still logged, never shown).
- **Accessible readiness marks.** The Settings LLM readiness line conveyed Ready /
  Not-ready by glyph + color only; it now states the status in words (`Text scoring:
  Ready` / `Image analysis: Not set up`) with the glyph as an aria-hidden accent.
- **Richer llama-server pool logging** (Vulkan->CPU fallback reason, spawn build/
  gpu-layers/device, health-ready timing, kill-after-timeout warning).

Tests: full API suite 2144 green (+10 new), full UI suite 730 green, Electron 126
green (+4 new), lint clean.

---

## Vision-model cleanup + custom-model licensing note (done 2026-07-09)

Live-tested the three catalog vision models on a real game frame and cut the two weak
ones:

- **moondream2 dropped.** Coherent on a single frame but factually unreliable
  (hallucinated a "pool table" for a hot tub, blind to the HUD) and produces malformed
  output when fed multiple frames (its ~2048-token context overflows past ~2 frames).
- **SmolVLM2 dropped.** The pinned `llama-cpp-python` 0.3.18 has no Idefics3/SmolVLM chat
  handler (it falls back to `Llava16ChatHandler`), so the wrong template makes it emit
  EOS immediately - empty output every run. Confirmed live.
- **Qwen2.5-VL 7B is now the sole recommended local vision model** - the only permissive
  (Apache-2.0) option with a reliable in-app handler (`Qwen25VLChatHandler`) *and*
  accurate descriptions (correctly read the hot tub, clothing, camera framing, and HUD).
  Smaller/better options (Granite Vision, Pixtral, Qwen2-VL) have no working path on
  0.3.18 and are deferred to the bundled-Vulkan-llama.cpp effort.

Also this pass:

- **Custom-model licensing note** in Settings -> LLM scoring (`#s-custom-model-licence-note`):
  steers users who load their own model to check its licence before monetizing clips
  (Llama/Gemma restrict commercial use of output). Guarded by
  `test_ui_settings.py::TestLlamaCppTextVisionGroups::test_custom_model_licence_note_warns_about_monetization`.
- **GPU-toggle note corrected.** "Use GPU when available" now says the bundled local
  (llama.cpp) engine is CPU-only, so the toggle only takes effect on the Ollama backend.
  The shipped `llama_cpp_python-0.3.18-cp312-cp312-win_amd64.whl` is a CPU-only build
  (`llama_supports_gpu_offload()` is False), so `llm_use_gpu` was a silent no-op there.
- **Clip-list scoring-error badge** + **live spinner/elapsed-time** on the "Analyze frames"
  button (earlier in the session).

Tests: full API suite (2118) green; UI settings/vision/catalog/smoke (97) green.
`test_model_catalog.py` and `test_gguf_download.py` retargeted off moondream onto the
Qwen2.5-VL entry.

## Per-function local LLM models - text vs vision (done 2026-07-09)

The llamacpp backend used one config field (`llm_model_path`) for both text scoring
and (paired with the mmproj projector) image analysis - downloading or selecting a
vision model silently clobbered whatever text model was configured, which had
previously broken clip re-scoring (a vision model's text tower can't follow a JSON
scoring prompt). Split into two fully independent buckets, mirroring Ollama's
existing `ollama_model` / `ollama_vision_model` split:

- New config field `llm_vision_model_path` (the vision text tower, paired with the
  existing `llm_mmproj_path`). `llm_model_path` is now text-only.
- The CLI download (`download-gguf`) and the Settings model-catalog "Use this model"
  flow write a vision entry's weights to `llm_vision_model_path` (+ mmproj), never
  `llm_model_path`.
- `LlamaCppClient.chat_vision` reads `llm_vision_model_path`; `check_vision_available`
  and `/api/llm/capabilities` gate on it too. No fallback to `llm_model_path` - a
  single VL model doing both needs both paths pointed at the same file.
- Settings -> LLM scoring restructured into "Text model" / "Vision model (image
  analysis)" groups so the two-bucket model is visible in the UI.
- No migration: a config with a vision model still sitting in `llm_model_path` from
  before this change stays broken until the user re-selects it under the new Vision
  model group.

Tests: `test_vision.py` (chat_vision model-path routing, vision-gate no-fallback),
`test_gguf_download.py` (vision download writes vision path not text path),
`test_llm.py` (capabilities + active-badge independence), `test_config.py`
(round-trip), `test_ui_settings.py::TestLlamaCppTextVisionGroups`,
`test_ui_model_catalog.py::TestGgufUseRouting`.

## Speaker over-clustering, log-freeze, background preview, vision-active badge (done 2026-07-08)

Four fixes from a manual-testing pass:

- **Speaker over-clustering.** SpeechBrain diarization was minting a separate speaker
  for nearly every window (200-1700 "speakers" for one recording; many were duplicates
  of the same person). Added a centroid-consolidation pass
  (`diarization_client._consolidate_labels`) that merges clusters whose centroids are
  within the speaker-match threshold - one knob now governs both within-recording
  dedup and cross-video matching. The window-clustering distance is also exposed as a
  tunable setting (`speaker_cluster_threshold`, Settings -> Speaker labels -> "Voice
  grouping", SpeechBrain-only).
- **Log freeze / frozen timer / can't-cancel.** `appendLog` appended DOM nodes
  unbounded; a long run - or a reattach replaying a big buffer - locked the tab (each
  line forced a scroll reflow), which looked like a frozen timer and an unresponsive
  Cancel. The log DOM is now capped at 500 lines (full log still on disk).
- **720p preview off the analyze critical path.** The proxy encode used to run inline
  and block "Analysis complete" until the whole recording re-encoded. It's removed from
  the pipeline and warmed in the background after completion (`analyze._warmPreviewProxy`,
  reusing the existing `proxy/generate` SSE), with the lazy on-first-preview build as
  the fallback.
- **Vision model "Active" badge.** `_entry_active` matched llamacpp entries only on the
  text `gguf_filename`, so no vision model ever showed as active. A vision entry is now
  matched on its projector (`mmproj_filename` vs `llm_mmproj_path`).

Tests: `test_diarization.py` consolidation cases, `test_config.py` cluster-threshold
plumbing, `test_ui_utils.py::TestLogCap`, `test_ui_settings.py::TestSpeakerClusterThreshold`,
`test_llm.py` vision-active cases.

## LLM-unavailable is no longer silent + 720p preview is its own stage (done 2026-07-08)

Clips were falling back to Basic descriptions with no explanation when the language
model wasn't actually usable (in the reported case, `llama-cpp-python` was missing from
the environment even though a `.gguf` was configured). The failure was logged but never
surfaced, and the diagnostic checks were misleading.

- **`/api/prereqs`** now decides `llm_ok` for llamacpp/claude via the authoritative
  `check_llm_available` (which confirms the runtime package imports), not just that the
  model file exists - so a missing package no longer reports "ok" and then dies during
  scoring. It also returns `llm_reason`.
- **Analyze notice** (`_llm_unavailable_notice`) reworded backend-neutral (dropped the
  hardcoded "run Ollama") and tied to descriptions, not just clip ranking.
- **Run metadata** carries `warnings[]` (`StageRecorder.warnings` -> `build_run_json`);
  `_run_scoring` returns them, and the UI shows them as dismissible toasts after a run
  finishes (`_surfaceAnalyzeWarnings`).
- **Basic-description chip** is now three-way: generative-AI-off / a model is available
  now so re-analyze / no model set up (with the reason). No longer always tells a user
  with a configured model to "install a local model".
- **720p preview proxy** now runs inside its own `recorder.stage("Preview")` instead of
  being folded into the "Score" stage timing.

Tests: `TestPrereqs` (delegation + reason), `TestBuildRunJson` warnings, chip-branch UI
tests in `test_ui_clips2.py::TestBasicDescriptionChip`.

## Per-stage re-runs: Re-extract / Re-transcribe / Regenerate Clips (done 2026-07-08)

Filled the gaps in single-stage re-running so a recording no longer needs a full
Re-analyze to redo one step. Previously only Speakers (Re-detect), Score (Re-score),
and Summarize had standalone re-runs; Extract, Transcribe, and Generate Clips only ran
inside the whole pipeline.

- **Re-extract Audio** - rebuilds the WAV tracks from the source (force re-extract),
  preserving the recording's status. Non-destructive; transcripts kept.
- **Re-transcribe Recording** - re-runs speech-to-text for the whole recording with the
  configured model, re-extracting missing audio first. Follows the house mark-stale
  convention rather than cascading: existing clips are stamped `transcript_edited_at` so
  the existing "captions changed since last scoring - Re-score" badge fires.
- **Regenerate Clips** (Danger Zone) - re-windows clips from the existing transcript
  (destructive: replaces all clips + their approvals/edits/scores) and clears the
  video-level `clips_scored_at` marker so the fresh clips read as unscored.

Each is a CLI command (`reextract`, `retranscribe-video`, `regenerate-clips`) fronted by
an SSE route (`GET /api/videos/{id}/{reextract,retranscribe,regenerate-clips}`) and a
button in the recording **Additional Actions** modal, mirroring the existing `rediarize`
pattern. Engine functions `_reextract_video` / `_retranscribe_video` / `_regenerate_clips`
live in `pipeline/ingest.py`. Tests: `TestStageRerunEndpoints` + `TestStageRerunEngine` in
`tests/test_analyze.py`.

---

## Settings reset-to-defaults + Ollama model-picker fix (done 2026-07-08)

- **Reset to defaults** - every config-backed Settings section (Speech-to-text, LLM
  scoring, Speaker labels, Scoring weights, Analysis defaults, Hardware, UI, Export) now
  has a **Reset to defaults** button in its header, plus a **Reset all to defaults** button
  in the Settings header for the whole panel (guarded by a confirm). Reverting fills the
  form with factory defaults and flags it dirty - nothing persists until Save, so it's
  cancelable by closing without saving. Backed by a single source of truth,
  `GET /api/config/defaults` (a fresh `Config`), instead of duplicating defaults in JS.
  `_applySettingsToUI` was split into per-section field appliers reused by both the initial
  load and the reset controls.
- **Ollama vision/text picker fix** - in the Ollama model list, clicking **Use this model**
  on a vision card (e.g. moondream) wrote the *text* scoring model field and vice versa,
  because both cards routed through one handler. The click now targets the field matching
  the card's group, so the two independent Ollama fields (`ollama_model` /
  `ollama_vision_model`) never overwrite each other.

---

## First-run friction reduction + local-model push (done 2026-07-08)

Cut the packaged installer's first ~10 minutes from three separate waits plus one dense
decision screen down to a click-through, and steered non-developer users toward a local
LLM (the impressive path) without making them understand the AI-backend jargon. Seven
stages:

- **Adaptive local-model recommendation** - the wizard reads detected VRAM, GPU vendor,
  and free disk and decides how hard to push the local model (strong / soft / none),
  never recommending a multi-GB download onto a machine that can't hold it or would crawl.
- **Server-owned one-click `.gguf` download** - a resumable, cancelable SSE download
  endpoint (`POST /api/llm/gguf/download`) closes the old gap where the in-app llama.cpp
  catalog only offered a "download page" link. Both the Settings catalog and the
  background handoff use it.
- **Wizard redesign** - the dense "LLM scoring - choose one" block became an opt-out
  choice (**Set up local AI (Recommended)** vs **Lightweight mode**), with backend /
  Ollama / Claude / manual-path controls collapsed into **Advanced AI options**. Opting
  into local AI records intent (`pending_local_model`) rather than blocking on a download.
- **Background download handoff** - the app opens immediately; if a local model is pending
  and missing it auto-downloads in the background behind a dismissible in-app progress
  banner, then points scoring at it and refreshes capabilities with no restart.
- **Determinate venv-setup progress** - the "Setting up yuu-clip" window now shows a real
  progress bar + elapsed timer parsed from pip's `--progress-bar raw` output, so the
  one-time install never looks frozen.
- **Default-on model pre-fetch + analyze coordination** - a single wizard checkbox
  (checked by default) pre-fetches the speech-to-text and speaker-labelling models on
  first launch. If an analysis starts while a required model is still downloading, the app
  warns and waits on the running download instead of starting a duplicate into the shared
  cache. Getting Started / wizard copy was de-duplicated.
- **Settings model management** - recommended models split into **Text scoring** and
  **Image analysis (vision)** groups, one-click **Download now** / **Use this model** with
  an **Active** badge, vision entries fetching both the model and its projector, and a
  native file picker in the packaged app (text-box fallback in browser mode).

Also shipped alongside: a codebase-wide em-dash sweep (2,895 U+2014 -> spaced hyphen
across 267 files) with a `tests/test_no_emdash.py` guard so they can't creep back.

## Analyze pipeline idempotency on `--force` re-run (done 2026-07-07)

Re-running analyze on an already-analyzed recording no longer duplicates transcripts.
`ClipCandidate` generation was already idempotent (force-deletes and regenerates), but
`Transcript` generation had no guard: `analyze --force` on a `"done"` video - or a
resumed partial run - minted a second track-level `Transcript` per track (there is no
unique constraint on `audio_track_id`), and the duplicate segments then fed garbled
input into clip generation.

- `_transcribe_and_check_overlap` (`pipeline/ingest.py`) now checks for an existing
  track-level transcript per track before transcribing: it reuses the existing one on a
  normal re-run and deletes-then-replaces it under `--force`, mirroring the
  `ClipCandidate` force-delete pattern. Clip-specific retranscriptions (`clip_id` set)
  are left untouched.
- Speaker diarization survives the replace cleanly: deleting a transcript cascade-deletes
  its segments but leaves the video-scoped `Speaker` rows intact, so voiceprint re-attach
  lands on the existing named speaker instead of minting a duplicate.

## Project backup / restore (done 2026-07-07)

A single-file backup and a recovery path for a corrupted DB, a reinstall, or a move
to a new machine - without hand-copying folders.

- **Backup** (`Settings > Backup & Restore`, `POST /api/backup`, `project_archive.build_backup`)
  writes a portable `.zip` of the project's own state (DB, config, world contexts, custom
  sounds). Contents are an allowlist of small state, not a skip-list of media - top-level
  state files plus known state subdirs only - so a large derived dir (audio/exports/proxies/
  downloads/reels/preview_cache) or a stray folder can never balloon the archive. The WAL is
  checkpointed first so `project.db` is a self-contained snapshot.
- **Restore** (in-app + `POST /api/restore/*`, `restore_into`) validates the manifest schema,
  refuses to clobber an existing project unless confirmed (keeping a `project.db.pre-restore`
  safety copy), and runs the **re-point engine**: source-video folders that don't resolve on
  the target machine are grouped by parent dir and the user maps each to its new location;
  a file that isn't present at the new location stays missing and is counted, never guessed.
- **First-run wizard** gains a "Restore from a backup instead" choice that unpacks via the
  `yuuclip restore` CLI before the server spawns and launches straight into the restored
  project, keeping its saved settings. Wizard re-point is deferred to the in-app flow.

Four stages shipped 2026-07-07 (backup core, restore + re-point engine, in-app UI, wizard);
the wizard's manual first-run restore is the only unautomated check.

## Packaging-strategy overhaul - batteries-included install (done 2026-07-06/07)

Killed the "installed program that keeps asking to install more things" UX. Every
optional feature that used to be a pip-install-and-a-button is now bundled and on
by default; only genuine hardware/privacy choices (GPU acceleration, remote AI)
still ask. Six waves, each committed separately:

- **Speaker labels** - SpeechBrain (ECAPA-TDNN) moved from an opt-in package into
  the base install and is now the **default diarization backend** (`diarization_backend:
  "speechbrain"`), replacing the old off-by-default/pyannote setup. Pyannote remains
  available as a demoted, collapsed alternative for users who specifically want it.
- **Laugh / audio-event scoring** - the AST (AudioSet) gunshot/explosion/cheer
  detector is bundled and **on by default** (`scorer_audio_event_enabled: true`).
- **Similarity** - local embeddings (fastembed + bge-small-en-v1.5) replaced
  keyword/TF-IDF as the **default similarity backend**.
- **Vertical auto-framing** - MediaPipe face detection is bundled; the "Auto-frame
  on faces" button in vertical export no longer needs a separate install.
- **Vision / image analysis** - bundled and **on by default** (`vision_enabled: true`),
  but stays conservatively inactive until a vision model (moondream2 recommended,
  1.8 GB) is downloaded, so a fresh install never gets a surprise-slow first analyze.
  Never runs automatically during analysis - only the explicit "Analyze frames"
  button or an opt-in re-score checkbox.
- **Unified Settings -> Capabilities view** - replaces the old piecemeal
  install-button sprawl with one place that shows every optional dependency's
  installed/missing state, grouped by the capability it unlocks
  (`/api/capabilities/tiers`). Closes the former ROADMAP "Collected setup /
  dependencies page" item. The setup wizard was simplified to match - the
  speaker-detection step (HuggingFace account/token flow) was dropped entirely
  since SpeechBrain needs neither.
- **Offline-first-run hardening** - a fresh install now pulls the entire default
  feature set from the bundled wheelhouse with `--no-index`; verified in a
  throwaway venv with the network off.

Every model promoted to a default carries a licence that permits monetizing the
output (Apache-2.0, MIT, or BSD-3-Clause - see `docs/dev/PACKAGING-TIERS.md` and
`yuu_clip/model_catalog.py`); Llama- and Gemma-licensed models stay out of
recommendations. Two real bugs were caught and fixed along the way: SpeechBrain
1.x poisons `transformers.pipeline` if imported first (order-of-imports fix in
`_analyze_one`, documented in `CLAUDE.md`), and `opencv-python` /
`opencv-contrib-python` (pulled in by two different bundled packages) could
install in either order - the installer now forces `opencv-contrib-python` last
so its superset build always wins.

Commits: Wave 0 (licensing) `bdd93d1`, Wave 1 (bundle deps) `68dbf7e` +
OpenCV dedupe `c6f42e4`, Wave 2 (flip defaults) `c6519fc`, Wave 3a (Settings
Capabilities view) `be3ee23`, Wave 3b (wizard simplification) `aa42022`, Wave 4
(model-fetch UX) `f8ce2b7`, Wave 5 (offline hardening) `498d3cc`, stale-wheel
guard `65f0b75`, Wave 6 (vision default) `b6868c7`. A follow-up code-quality
review (`0fbbd7b`, `e4fb73b`) fixed a wheelhouse cache-key gap, added tests, and
a test-ui.ps1 preflight guard against contending dev servers. Decisions kept
as-is during the review are recorded in `docs/dev/REVIEW_DECISIONS.md`.

---

## `--on-warning` theme token (done 2026-07-06)

Closed the last grandfathered color literal: the "Remote LLM" billing badge hardcoded
`color:#1a1a1a` for dark text on the amber `var(--warning)` fill. Introduced a per-theme
`--on-warning` token (dark `#1a1a1a`, light `#ffffff`, high-contrast `#000000`) and pointed
the badge at it. `tests/test_ui_theme.py` now requires every theme to define `--on-warning`
(COLOR_TOKENS) and asserts its AA contrast against `--warning`; the `#1a1a1a` grandfather
clause is removed. Closes ROADMAP §1.

---

## Backlog-notes batch - filter counts, Ollama vision model, playback speed (done 2026-07-06)

Three small features from a backlog note dump (the fourth, a collected setup page, went to
ROADMAP.md for a design pass):

- **Count badges on the recording filter chips.** The recording filter bar (All / Has clips /
  Unscored / ⚠ Errors) now shows per-filter counts derived from `AppState.videos`, mirroring
  the clip filter chips (keyed `data-vcount` to keep them distinct from the clip chips'
  `data-count`). `videos.js::_renderVideoFilterCounts`, called from `_renderVideoList`. Errors
  badge blanks at zero. Covered by `test_ui_video.py::TestRecordingFilterCounts`.
- **Separate Ollama vision model.** `chat_vision` and the capability gate used the single
  `ollama_model` for both text and images, so image analysis forced the one model to be
  vision-capable. New `ollama_vision_model` (empty = reuse `ollama_model`) lets a strong
  text model pair with a dedicated vision model. Settings field added. Covered by
  `test_llm.py` (capabilities) and `test_vision.py` (client uses the vision slot).
- **Playback-speed preference.** A global `yuuclip-playback-rate` (Settings → Playback,
  0.5×–2×) applied to every `<video>` via one capture-phase `loadedmetadata` listener plus
  `applyPlaybackRate` for live videos (`ui.js`, wired at boot). Covered by
  `test_ui_settings.py::TestPlaybackSpeed`.

---

## SPA decomposition - settings.js + videos.js carved into modules (done 2026-07-05)

The three large no-build SPA files were surfaced by the 2026-07-05 code-quality review
as staged-plan decomposition candidates. The plan set (`docs/dev/plans/spa-decomposition/`,
now retired) split them in risk order, one commit per stage, each ending green on the full
UI suite + `test_ui_globals.py`:

- **Stage 01** (`72bc3b0`) - help modals → `helpmodals.js`, keyboard shortcuts → `shortcuts.js`.
- **Stage 02** (`ccaeeed`) - model catalog + readiness + capabilities → `modelcatalog.js`.
- **Stage 03** (`0bbf33d`) - export previews + optional-package installs extracted; `settings.js`
  left as the cohesive save/dirty/apply engine.
- **Stage 04** (`f0e25a9`) - `videos.js` timeline / summary / run-metadata sub-features carved out.

`settings.js` (1436 → core engine + 4 modules) and `videos.js` (1191 → list/detail + 3 modules)
are now newcomer-navigable. Behavior and served HTML stayed byte-identical (pure move/re-scope);
the IIFE `Object.assign(window, {…})` export blocks and `// ── section ──` dividers were preserved.

**Stage 05 (index.html → server-side partials) was run as its go/no-go gate and declined - NO-GO**
(`9d2ebdc`). `index.html` stays a single file: the boundaries split cleanly but a bespoke
server-side include layer does not earn its keep for inert, already-well-banded markup in a
deliberately no-build app. Full reasoning in `docs/dev/REVIEW_DECISIONS.md` (2026-07-05 - SPA
decomposition Stage 05).

---

## llama.cpp GPU offload (done 2026-07-06)

The desktop installer already ships a CUDA build of `llama-cpp-python` for NVIDIA
cards, but `LlamaCppClient` constructed `Llama()` with the default `n_gpu_layers=0`,
so scoring always ran on the CPU and the GPU sat idle. `_new_llama()` now offloads
all layers (`n_gpu_layers=-1`) when the new **Use GPU when available** setting
(`llm_use_gpu`, on by default) is on, and retries on CPU if that load fails (e.g.
insufficient VRAM), logging a warning. Both `chat()` and `chat_vision()` route
through the helper. Added a Settings → LLM scoring toggle and corrected the stale
"CPU-only inference" note. Covered by `test_vision.py::TestLlamaCppGpuOffload` and
`test_config.py` (default + persist).

---

## Code-quality review - post-9148305 slice (done 2026-07-05)

A full 7-phase quality pass over everything shipped since the last review (the
non-LLM scoring tiers, the `web/routes/clips/` package, `routes/llm.py`, the new
JS modules, and the legibility refactor). The suite was green throughout; the pass
was mostly confirmation that the new code was already well-decomposed and
well-covered, plus a few concrete fixes.

- **Vision analyze-frames returns 404 instead of a 500 on a mid-analysis delete.**
  `clips/edit.py::analyze_frames` bound `analyzed_at` only inside `if stored:`; a clip
  deleted during the seconds-long vision call left it unbound → `UnboundLocalError` → an
  opaque 500. It now raises a clean 404 when the save-back session finds the clip gone
  (covered by `test_vision.py::TestAnalyzeFramesRoute::test_clip_deleted_mid_analysis_returns_404`).
- **Restart Manager lock-diagnosis failures are no longer silent.**
  `file_deletion.py::locking_processes` swallowed every exception; that helper runs
  precisely while a user is hitting a 409 file-lock, so its own failure was invisible
  when it mattered most. It now logs the path + exception at DEBUG (matching the
  settled degraded-probe philosophy).
- **`wav_access.py` gained direct test coverage** (`test_scoring_wav_access.py`, 12
  tests) for `best_wav_track` selection rules and `WavCache` decode-once / failure-contract
  behavior.
- **README + FEATURES accuracy.** The README predated the lightweight-first direction -
  it described LLM/Ollama scoring as central, listed the wrong default Whisper model
  ("medium" vs. the actual `base`), and used pre-glossary terms. Rewritten to lead with
  lightweight mode, the llamacpp default, the desktop-app path, and current features.
  FEATURES.md's Scoring section gained a "Lightweight signal scorers (no model)"
  subsection documenting the lexicon/speech-rate/prosody/speaker-overlap/audio-event tiers.
- Keep-as-is rulings for the slice (decomposition, logging, docs, UX) recorded in
  `docs/dev/REVIEW_DECISIONS.md`, including a re-assessment of `electron/main.js`
  (grown to 1168 lines but pure logic already extracted to 15 tested modules - keep-as-is
  stands). Large SPA files (`index.html`, `settings.js`, `videos.js`) were surfaced as
  staged-plan decomposition candidates rather than split as drive-bys.

## First-run reliability + wizard defaults - E2E UX review stages 01–02 (done 2026-07-05)

The install→daily-use UX review was performed by actually building
`yuu-clip Setup 0.1.15.exe` from the working tree, silent-installing it, and
launching as a first-run user - which surfaced two blockers that no automated
suite covered (both were "worked when built, broke when the environment moved").

- **First-run venv setup died on every fresh install (Blocker).** `pip.exe install
  --upgrade pip` cannot replace itself on Windows - it exits 1 the moment PyPI has a
  newer pip than the bundled runtime's. 0.1.13/0.1.14 testing passed only because pip
  was current then; pip 26 shipping broke every fresh install with a raw "Startup
  error / Exited with code 1" dialog. Fixed by routing the upgrade through
  `python -m pip` (`electron/venv-setup.js`, extracted so it is regression-tested),
  verified end-to-end with a rebuilt installer.
- **LLM-engine install failed on every machine without a C++ toolchain (Blocker).**
  The wizard's "Install llama.cpp" built `llama-cpp-python` from source (no MSVC/CMake
  → compile error, observed on the RTX 4050 laptop). It now always installs a prebuilt
  `win_amd64` wheel - a CUDA build matched to the detected CUDA version (or the lowest
  pinned tag when `nvidia-smi`'s version is unparseable), else the plain CPU wheel
  (`selectLlamaWheelUrl`/`buildCpuWheelUrl` in `llamacpp-cuda.js`, unit-tested for all
  four machine shapes).
- **Humane failure copy + non-dead-end dialogs.** Install-failure copy no longer blames
  the internet for every error (`install-error.js` classifies pip stderr - network
  failures get the connection hint, build/resolution failures get an honest next step);
  a shared `showFatalDialog` offers Try again / Open log folder / Quit and drops
  developer terms (venv, wheel, exit code).
- **Encoding corruption fixed.** The setup log gets a UTF-8 BOM on first write, the
  `/api/status` version string uses ASCII separators, and `logs.ps1` reads the app log
  as UTF-8 - so em-dashes and "·" stop mojibaking under PowerShell 5.1 / cp1252.
- **llamacpp is the new default LLM backend** (locked user decision 2026-07-05,
  superseding the wizard-revamp Ollama default): `main.js` `defaultBackend`, the wizard
  + Settings lists ("Local model file" first, tagged *recommended*; Ollama reframed as
  "if you already use Ollama"), and the `claude→local` privacy fallback all point at it,
  locked by guard tests in `config.py` and the wizard.
- **Wizard WCAG AA contrast pass** (nothing enforced this before): muted grays
  `#555`/`#666` → `#87879f`/`#9090a8`, all now ≥ 4.5:1 on the `#12121e` wizard
  background, with a new static `tests/test_wizard_theme.py` checking every wizard text
  color. Plus live-seen wizard state/copy bugs: saved Whisper model no longer reset on
  re-run, recommended-model tag can't overflow the 620px window, "CUDA detected" (not
  "unknown") when the version parse misses, "no model file chosen" warning hidden while
  the download runs.
- Tests: `electron/test/{venv-setup,install-error,llamacpp-cuda}.test.js` (38 electron
  tests green), `tests/test_wizard_theme.py`, `tests/test_model_catalog.py` default-lock
  additions.

## Clip-review ergonomics - E2E UX review stage 04 (done 2026-07-05)

Four design-fork decisions from the install→daily-use UX review, resolved by
user interview then implemented
(`docs/dev/plans/ux-e2e-review-2026-07/04-review-ergonomics-decisions.md`):

- **Approve/Reject/Export above the fold** - the Scoring + Actions two-card row now
  renders directly under the clip header, before the Description card, so decision
  info and decision actions are visible without scrolling every clip.
- **One filter chip row, not two** - the redundant status-summary block (a second
  row of look-alike filter pills) is gone; per-status counts are folded into the
  filter chips themselves ("Unreviewed 30"). Counts reflect the whole recording and
  blank out when no recording is selected.
- **Real sort-direction toggle** - the decorative 🔽 emoji (rendered as a stray blue
  square on Windows) next to the Recordings/Clips sort dropdowns is replaced by an
  asc/desc arrow button (↑/↓, `aria-pressed`, self-describing `aria-label`) that
  reverses the sort. Direction persists per-list in localStorage.
- **Split-segment range labelled** - a segment row's parent-window range now reads
  "from 41:53 to 2:10:05" (with an explanatory tooltip) instead of a bare
  "41:53 – 2:10:05" that looked like a contradictory second duration.

## Web-UI quick fixes - E2E UX review stage 03 (done 2026-07-05)

Seven Medium-severity fixes from the install→daily-use UX review
(`docs/dev/plans/ux-e2e-review-2026-07/03-web-ui-quick-fixes.md`), all reproduced live:

- **Clip stats "0 sec total"** - `_renderClipStatsLine` summed `end_s - start_s`, but
  clips carry `start_ms`/`end_ms`; every term was `NaN`. Now `(end_ms - start_ms) / 1000`.
- **Project switcher ignored Escape / floated over panels** - added the menu to the global
  `_closeTopmostLayer` cascade (Escape closes + refocuses the trigger) and a `focusout`
  close so a panel/modal that grabs focus can't leave it floating.
- **URL toggle falsely dirtied the New Recording panel** - `scheduleProbe` set `_panelDirty`
  before the empty-path early return, so opening the URL import (which clears the path)
  triggered a false "Discard new recording?" prompt. Dirty is now set only for a non-empty
  path.
- **Clip search placeholder truncated** → "Search clips…" (full field list kept in
  title/aria-label).
- **Settings speech-to-text select clipped its option** - `.settings-select` max-width
  260 → 320px (matches the LLM path input beside it).
- **Main-panel empty state pointed at the wrong first action** - `clearDetail` is now
  state-aware: no active recording → "Select a recording on the left".
- **Reel builder Build button below the fold** - the Build-tab action row is now a sticky
  footer pinned to the modal's bottom edge; the clip list remains the scrolling region.

Tests: new UI cases in `test_ui_clips.py` (nonzero total duration), `test_ui_projects.py`
(Escape closes + refocuses), `test_ui_analyze.py` (URL toggle leaves panel clean),
`test_ui_reel.py` (Build button within a 1280×900 viewport with 8 clips). Full UI suite
(637) green; no Python source touched.

---

## Streamlined local-model install - disk precheck + cancel (done 2026-07-05)

Non-LLM-tiers plan, **Stage 08** (`docs/dev/plans/non-llm-tiers/08-model-install.md`) - the
**final stage; plan set closed**. Most of the stage's scope (curated catalog, one-click
Ollama pull + `.gguf` download, progress UI) had already shipped via plan 10 and the
FFmpeg-bundling onboarding follow-up (`7892b05`). This stage closed the two safety gaps
that were in **neither** surface, so a non-developer never hits a cryptic late failure or
an un-stoppable multi-GB download.

- **Disk-space precheck.** Backend `_preflight_ollama_pull(tag)` (`web/routes/llm.py`)
  compares free space on the Ollama models drive against the catalog `size_gb` + 2 GB
  headroom; `POST /api/llm/ollama/pull` now returns **507** with an actionable message
  *before* spawning `ollama pull`. Electron wizard mirrors it via a new pure
  `electron/disk-space.js` (`fs.statfsSync`) guarding both the Ollama pull and the `.gguf`
  download.
- **Cancel.** Web Settings pull runs under an `AbortController` with a **Cancel download**
  button - closing the SSE stream makes `subprocess_sse`'s `finally` terminate the pull
  subprocess. Wizard gets Cancel buttons on both rows: `setup:cancel-gguf-download` aborts
  the download (and cleans up its `.part` file); `setup:cancel-pull` destroys the `/api/pull`
  request so the Ollama daemon aborts.
- **Stage-07 tie preserved:** under `local_only`/`none` the installer still offers local
  models only - no change needed, verified.
- Tests: `test_llm.py::TestOllamaPullDiskPrecheck` (preflight + 507-before-spawn),
  `test_ui_model_catalog.py::TestOllamaPullUI` (mocked 507 message + successful-pull done
  state + cancel control), `electron/test/disk-space.test.js` (pure size math), and the
  `test_model_catalog.py` cross-check extended to keep the wizard's `sizeGb` in sync with
  the catalog. Full API (1904) + UI (637) + electron (26) suites green.

---

## AI privacy modes - 3-level trust setting (done 2026-07-05)

Non-LLM-tiers plan, **Stage 07** (`docs/dev/plans/non-llm-tiers/07-privacy-modes.md`).
One setting decides what yuu-clip may do with a recording's transcript, enforced at a single
resolver consulted everywhere a language model could run - a **provable guarantee, not a UI hint**.

- **`ai_privacy_mode`** = `none` (No generative AI) / `local_only` (Local models only - default)
  / `remote_ok` (Allow remote models). One choke point `resolve_ai_permissions(config) ->
  AiPermissions(allow_llm, allow_remote)` in `config.py`; fails safe (unknown value → local_only,
  never remote).
- **Enforcement keyed off `LLMClient.is_remote` as a *class* attribute**: `make_client` maps
  backend→class and reads `client_cls.is_remote` **before** constructing, so a blocked remote
  backend is never instantiated (`ClaudeClient` is never constructed under `local_only`). Wired
  into `check_llm_available`, `check_vision_available` / `describe_frames` (Null backstop raises
  `VisionNotSupportedError`), `LLMScorer.is_available`, and transitively the Stage 01 similarity
  `llm` backend (falls back to TF-IDF). `_capabilities` and the Stage 02 install-CTA hook
  (`_install_ctas_ok`) both honor the mode.
- **Settings UI** (`index.html` + `settings.js`): AI privacy radios atop LLM scoring - Local-only
  hides the Claude backend option + shows a "blocked" notice on a saved remote backend; No-generative-AI
  collapses the whole generative block to a neutral summary with a "Turn on local models" re-enable;
  the header remote badge and basic-description chip respect the mode. **First-run** (Electron setup
  wizard) asks the question, defaulting to Local models only.
- **Fixed a latent bug found in passing**: `similarity_backend` (Stage 01) and the Stage 03/04
  scorer weight/enable fields were sent by `settings.js` but silently dropped by `PATCH /api/config`
  (absent from `ConfigPatch`); they now persist.
- GLOSSARY: **AI privacy mode** + the three level names. Tests: `test_privacy_modes.py` (resolver,
  make_client never constructs a blocked/remote client - spy-verified, gates, vision backstop,
  similarity fallback), `test_config.py` (persist + reject + similarity regression),
  `test_ui_settings.py::TestAiPrivacyMode`, plus updated claude-backend expectations in
  `test_scoring_llm`/`test_vision`/`test_llm`. Full API (1899) + UI (637) + electron (21) suites green.

---

## Capabilities panel + "lightweight mode" framing (done 2026-07-05)

Non-LLM-tiers plan, **Stage 06** (`docs/dev/plans/non-llm-tiers/06-capabilities-panel.md`).
Makes the tiered "lightweight-by-default, upgrade anytime" design discoverable - a read-only
overview of every non-LLM upgrade tier plus first-run framing, without building a parallel
capability system (plan 10 already shipped `/api/llm/capabilities` + the model catalog).

- **`GET /api/capabilities/tiers`** (`web/routes/llm.py`) composes one row per non-LLM
  upgrade tier from the *same* `availability()` functions the features use, so the panel can
  never drift: **Similarity engine** (Fast keyword → Smart embeddings, from
  `EmbeddingsBackend.availability()`), **Descriptions & summaries** (Basic template → AI
  model, from the static `_capabilities()` readiness), **Audio-event detection** (Off → On,
  from `AudioEventScorer.availability()`). Each row reports the *resolved* active tier
  (honestly falling back like `make_backend` - a configured-but-uninstalled Smart/LLM tier
  reads as Fast), what the upgrade adds, the backend's guidance string, and an install slug /
  jump target. Static checks only (no live probe), and a `lightweight` flag = LLM text tier
  not active.
- **Settings → Capabilities** (`index.html` `settings-sec-capabilities`, first section + jump
  link): `_renderCapabilityTiers()` renders the rows read-only - "Set up →" links jump to the
  section holding the real install/enable control rather than duplicating install buttons (no
  `install-status-*` id collisions). Refreshed on panel open and after Save.
- **First-run note**: a lightweight-mode callout atop the Getting Started modal
  ("everything works now; install a local model anytime"). GLOSSARY: **Lightweight mode**.
- Tests: `test_llm.py::TestCapabilityTiers` (lightweight/basic-descriptions with no model,
  Fast default, honest LLM→Fast fallback, audio-events off by default, a real llamacpp model
  flips Descriptions ready / clears lightweight); `test_ui_settings.py::TestCapabilitiesSection`
  (three rows + intro render, jump link scrolls). Full API (1879) + UI (637) suites green.

---

## Audio-event detection - heavy opt-in scoring tier (done 2026-07-05)

Non-LLM-tiers plan, **Stage 05** (`docs/dev/plans/non-llm-tiers/05-audio-event.md`).
Adds the set's one heavy tier: a `Scorer` that reuses the same AudioSet Audio-Spectrogram-
Transformer already wired for laugh **Model** mode to detect *sound events* and nudge the
standard dimensions.

- **`scoring/audio_event.py` - `AudioEventScorer`**: runs the AST classifier
  (`MIT/ast-finetuned-audioset-10-10-0.4593`, reusing `scorer_laugh_model_id`) over the
  clip's best scored-track WAV, then maps AudioSet classes to two curated, editable groups -
  **action sounds** (gunshot / gunfire / machine gun / explosion / artillery / cannon /
  screaming) → **Action**, and **crowd/reaction** (cheering / applause / crowd / clapping) →
  **Funny**. Emits `0.0` for an absent group (real "no such sound" info, like laugh's
  `default=0.0`); `None`/`audio_event_no_wav` when there's no usable audio; inference failure
  is logged and degrades - never raises.
- **Off by default** (`scorer_audio_event_enabled = False`, weight `1.0`): the lightweight
  install never downloads the ~350 MB model or pays torch load time. Availability mirrors the
  laugh model tier (needs `transformers` + `torch` and a model id) with a user-facing reason.
- pyproject extra `laugh-model` **renamed → `audio-model`** (the deps now serve two scorers),
  with `laugh-model` kept as a self-referencing alias. New `audio-model` install slug in the
  on-demand installer (same deps as `laugh-deps`).
- Registered in `_run_scoring` (with an availability notice when enabled-but-unavailable),
  two new tags in `ScoringEngine._SCORER_TAGS`; a Settings weight slider + opt-in checkbox +
  Install-deps block. GLOSSARY: **Audio-event scoring**.
- Tests: new `test_scoring_audio_event.py` (classifier fully mocked - no download: group
  mapping, availability across disabled/no-model/missing-deps/present, gunshot→action,
  cheer→funny, never-raises on missing WAV / classifier error). Full API (1874) + UI (637)
  suites green.

---

## Additional lightweight scoring signals (done 2026-07-05)

Non-LLM-tiers plan, **Stage 04** (`docs/dev/plans/non-llm-tiers/04-lightweight-signals.md`).
Deepens the no-LLM baseline with three new scorers from the researched signal menu, each
feeding the standard funny/dramatic/action dimensions (so content presets tune them for
free) and each returning `None` for dimensions it has no opinion on.

- **`scoring/speechrate.py` - `SpeechRateScorer`** (zero-dep): words-per-second from the
  clip's transcript segments; blends mean rate with the fastest "burst" segment and ramps a
  calm→fast band to 0–1. Feeds Funny + Action; abstains on calm speech so it only nudges up.
- **`scoring/churn.py` - `SpeakerChurnScorer`** (zero-dep, needs diarization): speaker-switch
  rate along the window plus cross-talk overlap fraction. Feeds Funny + Action; abstains
  (graceful skip) when fewer than two speakers are attributed (diarization off / solo stretch).
- **`scoring/prosody.py` - `ProsodyScorer`** (numpy/av): energy-envelope coefficient-of-variation
  (loudness swings) + spectral-centroid CoV (pitch movement), extending
  `laugh._detect_laugh_rhythm`'s FFT. Feeds Dramatic + Action; a *continuous* measure that
  emits on any non-silent clip, giving Dramatic a real non-LLM baseline signal.
- New **`scoring/wav_access.py`** (`read_full_audio` / `best_wav_track` / `WavCache`) removes
  the WAV-reading duplication between laugh and prosody; `windower._clip_window_segments`
  promoted to public **`clip_window_segments`** as the shared transcript-segment accessor.
- Config `scorer_{speech_rate,churn,prosody}_{enabled,weight}` (default on, weight 0.5),
  registered in `_run_scoring`, nine new tags in `ScoringEngine._SCORER_TAGS`; three Settings
  sliders (Speech rate / Speaker overlap / Prosody). GLOSSARY: three new terms.
- VADER sentiment + punctuation-density left as documented candidates (not shipped).
- Tests: new `test_scoring_{speechrate,churn,prosody}.py` (pure-function + scorer paths) and
  an engine integration test; extended the UI reset-weights test. Full API (1860) + UI (637)
  suites green.

---

## No-LLM scoring baseline + Lexicon signal (done 2026-07-05)

Non-LLM-tiers plan, **Stage 03** (`docs/dev/plans/non-llm-tiers/03-lexicon-scoring.md`).
Confirms clips score sensibly with **no language model** (energy + scene + laugh already
run and the engine normalises over present scorers - no rebalancing needed) and adds a
zero-dependency lexical signal so a model-less install isn't scoring on audio/scene alone.

- New `scoring/lexicon.py`: **`LexiconScorer`** follows the `Scorer` protocol and the
  laugh tiered style. Genre-neutral, editable marker lists per dimension (laughter/absurdity
  → Funny, confrontation/emotion → Dramatic, urgency/combat/profanity intensity → Action),
  matched via `textmatch.find_matches` after `strip_speaker_prefixes`. Per-minute marker
  density → 0–1 (saturating at 6/min, mirroring laugh); **`None`** for a dimension with no
  markers so it never dilutes that dimension's average.
- Config `scorer_lexicon_enabled` / `scorer_lexicon_weight` (default 1.0), mirroring
  `scorer_laugh_*`; registered in `cli/_pipeline.py::_run_scoring`; new lexicon tags added
  to `ScoringEngine._SCORER_TAGS`. Feeds the standard dimensions, so **content presets tune
  it** through `score_*_weight` - no per-preset lexicon weight, no auto-rebalancing.
- Settings: a "Lexicon" signal-weight slider (`index.html`, `settings.js` `_weightFields` /
  `_settingsFieldIds` / apply payload). GLOSSARY: new **Lexicon scoring** term + table row.
- Tests: new `test_scoring_lexicon.py` (availability, per-dimension scoring, speaker-prefix
  self-trip guard, density bounds/determinism); engine integration test (lexicon-only, no
  LLM → `score_action`). Full API (1817) + UI (637) suites green.

---

## Basic descriptions + no-model summary/timeline empty states (done 2026-07-05)

Non-LLM-tiers plan, **Stage 02** (`docs/dev/plans/non-llm-tiers/02-basic-descriptions.md`).
Makes a model-less install genuinely usable: clips are **never blank** without a
language model, and the Session Summary / Session Timeline features stop hard-failing
with a 503.

- New `scoring/describe_basic.py`: `build_basic_description(clip)` assembles a template
  one-liner from data already on the clip - speaker names in the transcript excerpt, top
  keywords (new `similarity.top_keywords`, reusing Stage 01's token extraction), and the
  leading score dimension (e.g. `"Yuu & Alex - heist, getaway · high action"`).
- Wired into `ScoringEngine.score_clip`: when no scorer emitted a description (i.e. no
  LLM), it fills `clip.description` and tags the clip **`desc_basic`**. Never overwrites
  `description_user`; the tag is dropped the moment a real LLM description supersedes it.
- Summary + timeline routes (`web/routes/scoring.py`) now return a structured
  **`needs_model`** empty state (200) instead of a 503 - `summarize` (POST) in its JSON
  body, `timeline` / `regenerate-summary` (SSE) as one event before `__DONE__`. A
  `_install_ctas_ok()` hook (always `True` today) is left for the Stage 07 privacy mode.
- UI: a "Basic description - install a local model…" chip under `desc_basic` clips
  (`clips.js`); friendly install-CTA empty states for summary/timeline (`videos.js`,
  `_needsModelCtaHTML`). GLOSSARY: new **Basic description** term.
- Tests: new `test_describe_basic.py`; engine fallback + `needs_model` route tests; 2
  UI chip tests. Full API (1802) + UI (637) suites green.

---

## Tiered similarity engine - related clips + "Meaning" hot-words without an LLM (done 2026-07-05)

Non-LLM-tiers plan, **Stage 01** (`docs/dev/plans/non-llm-tiers/01-similarity-engine.md`).
Replaced the two LLM uses that were the wrong tool for an LLM - related-clip ranking
and semantic ("Meaning") hot-word matching - with a tiered similarity engine, so both
now work with **no language model installed**.

- New `scoring/similarity.py` with three backends dispatched by `config.similarity_backend`:
  **`tfidf`** (default, pure-Python keyword cosine, zero deps, always available) →
  **`embeddings`** (opt-in `fastembed` ONNX, no PyTorch; `pyproject` extra + on-demand
  installer slug `embeddings`) → **`llm`** (wraps the existing `find_related_clips` /
  `scan_hotwords_semantic`). `make_backend()` falls back to `tfidf` when the requested
  tier is unavailable, so the routes never hard-fail.
- Rewired `GET /api/clips/{id}/related-clips` and `GET /api/videos/{id}/hotword-scan`
  onto the engine - the LLM 503 gates are gone. Related-clips `reason` is now the top
  shared terms (tfidf) / a similarity band (embeddings) / LLM prose (llm).
- Renamed the hot-word mode **"Meaning (LLM)" → "Meaning"** everywhere; added a Settings
  "Similarity engine" selector (Fast / Smart / LLM) with a fastembed install hint.
- GLOSSARY: new **Similarity engine** term; Hot-word entry updated. Tests: new
  `test_similarity.py`; the related-clips / hotword-scan route tests flipped from
  "503 without LLM" to "succeeds without LLM"; +2 Settings UI tests.

---

## Bundled GPL FFmpeg + streamlined first-run model setup (done 2026-07-05)

Two packaging plans landed together in `7892b05` (`ffmpeg-gpl-bundling.md` +
`installer-onboarding-automation.md`), removing the manual, technical first-run steps a
non-developer would otherwise have to do by hand.

- **Bundled GPL FFmpeg.** The installer now ships a pinned GPL Windows FFmpeg build
  (`scripts/fetch-ffmpeg-runtime.ps1`, SHA256-verified + cached) so end users never
  install FFmpeg themselves; `find_ffmpeg()` resolves the bundled copy via
  `YUU_CLIP_FFMPEG_DIR` in packaged builds, PATH otherwise. GPL obligations are met
  properly: matching FFmpeg + libx264 **source archives** ship alongside the installer,
  a `THIRD-PARTY-NOTICES-FFMPEG.md` compliance record, and a drift-guard
  (`tests/test_ffmpeg_licensing.py`) that fails if the notices and fetch script disagree.
  The `av`/PyAV LGPL constraint is unchanged - this only governs the `ffmpeg.exe`
  encoder binary. (Licensing memory rule 2 flipped accordingly; the version-bump process
  is documented in `HOW-TO-RELEASE.md § Bundled FFmpeg`.)
- **One-click GGUF download.** The setup wizard's llama.cpp path gets a "Download
  recommended model" button that streams the exact Q4_K_M quant (per-entry
  `gguf_filename` in `model_catalog.py`, `bartowski` convention) to a fixed
  `%LOCALAPPDATA%\yuu-clip\models\` folder with byte-counted progress, `Content-Length`
  verification, and `.part`→rename so a half-finished download is never mistaken for a
  model. The manual "browse for a .gguf" path stays.
- **Transparent CUDA llama-cpp-python.** New pure `electron/llamacpp-cuda.js`
  (`pickCudaWheelTag`/`buildCudaWheelUrl`) makes the wizard's existing Install button pick
  the matching prebuilt CUDA wheel (GitHub Release asset `v<ver>-cu<tag>`) when a supported
  NVIDIA GPU is detected - no separate toggle. Replaces the stale/broken CUDA-wheel command
  the docs used to hand out.
- **Silent Whisper pre-fetch** after the wizard closes (only on a real first-run/updated
  setup), using the VRAM-based recommended model size; best-effort, logged and ignored on
  failure, never blocks backend start.
- Tests: `test_ffmpeg_licensing.py`, `electron/test/llamacpp-cuda.test.js`,
  `test_model_catalog.py` `gguf_filename`/`DEFAULT_LLAMACPP_MODEL` cross-checks; manual
  wizard/CUDA verification steps added to `HOW-TO-RELEASE.md`.

---

## Generalise for any video content - de-RP pass (done 2026-07-05)

Plan 13 (roadmap-close-2026-07) - **the final plan in the set**. An audit-and-copy
pass to make the tool read naturally for competitive, casual, speedrun, and podcast
creators, not just RP streamers. The app rename (rp-clipper → yuu-clip) shipped
earlier; this closed out the remaining roleplay-specific assumptions.

Approach was **de-RP, not de-gaming**: the tool is gaming-first by design, so
"players / NPCs / squad" language stayed; only *roleplay*-specific copy changed. RP
remains one flavor among several (its content preset and two prebuilt contexts are
kept), not scrubbed.

- **LLM prompts: already neutral.** Re-auditing every system prompt (scoring, video
  summary, session summary, timeline, related-clips, speaker-name inference, hot-word
  semantic scan) confirmed none assume roleplay - plan 12 already moved the RP flavor
  into the live `rp-narrative` preset via `_compose_system`. Nothing needed moving;
  this half of the plan was a verified no-op.
- **Two new prebuilt world contexts** in `contexts.py::BUILTIN_CONTEXTS`: **Podcast /
  Talk Show** and **Just Chatting / IRL** - the content types from the preset list
  with no matching seeded context (the set was already 8/10 non-RP). Seeding stays
  idempotent; the seed test asserts a subset so no count literal changed.
- **Copy neutralised**: index.html Getting-Started and World-Contexts tooltips
  ("who's in your recordings" / "people, setting, and notes"), `docs/user/OVERVIEW.md`
  world-contexts section (gaming-general with RP as one example), `FEATURES.md` context
  field table + score-dimension wording, the end-to-end walkthrough, two code comments
  (`extract.py`, `windower.py`), and the dev `GLOSSARY.md` World Context definition. The
  `rp_context` code-name aliases were kept (glossary rule requires recording them).
- **Setup wizard**: new "Content type" dropdown (`electron/setup.html`) defaulting to
  Generic, written as `content_preset` into the project config the wizard already
  persists (`main.js`); `SETUP_SCHEMA_VERSION` bumped 2 → 3 so existing users see it
  once. A dropdown (not the plan's "preset cards") to match the wizard's row-based idiom.

Tests: 1755 API, 636 UI, 9 electron - all green; lint clean. This **closes the
roadmap-close-2026-07 series** (13/13 shipped); only copyright content detection stays
deferred (no implementation path).

---

## Content-type presets (done 2026-07-05)

Plan 12 (roadmap-close-2026-07). One-choice tuning for different streaming styles so
non-RP creators get sensible behavior without touching individual settings. Six
built-in presets - **Generic** (default, a true no-op), **RP / narrative**,
**Competitive gaming**, **Casual / let's play**, **Speedrun**, and **Podcast /
conversation** - each bundling recommended scoring weights, an LLM prompt flavor, and
starter hot-words.

- **`yuu_clip/content_presets.py`**: frozen `ContentPreset` + `HotWordSpec` dataclasses,
  a static `PRESETS` tuple, and lookup helpers (`all_presets`, `preset_by_id`,
  `preset_flavor`, `is_valid_preset_id`). Pattern mirrors `export_presets.py` /
  `model_catalog.py`.
- **Apply = one-shot copy with confirmation** (`POST /api/content-presets/apply`
  `{id, add_hotwords}`): copies the preset's dimension weights + laugh weight into
  config (project-level save), records the id in the new `Config.content_preset` field,
  and - opt-in (checkbox, default on) - inserts ~5 starter hot-words (case-insensitive,
  boosts ≤ 0.2), skipping any phrase that already exists so a re-apply is idempotent.
  Users tune everything afterwards.
- **Prompt flavor is live, not copied**: `scoring/llm.py::_compose_system(base,
  context, config)` assembles every content prompt as *world context → preset flavor →
  base* and is applied at the scoring, describe, video-summary, session-summary, and
  timeline sites. The flavor text lives in `content_presets.py` and is read from the
  active preset at call time, so it stays improvable in updates without a re-apply.
  Summary/timeline base prompts were reworded to be flavor-compatible (no more baked-in
  "story beats").
- **Config**: `content_preset: str = "generic"` - load-sanitized (unknown → generic)
  and PATCH-validated against the preset ids; config-only, no migration.
- **UI**: a "Content type" card at the top of Settings → Scoring weights - a preset
  select with one-line descriptions, an "Add starter hot-words" checkbox, an Apply
  button with a confirm dialog listing exactly what changes, and a "Currently active"
  line. Applying updates the weight sliders in place and rebaselines the panel's
  dirty-tracking so it doesn't falsely prompt "discard changes?".
- **Deviations flagged** (see the plan file): route path is the plural
  `/api/content-presets*` collection, not the plan's singular `/api/content-preset/apply`;
  a real UI bug was caught - a range input normalizes `"1.0"`→`"1"` on read-back, so the
  applied-weight baseline is re-read from the element.
- Glossary "Content type" (dev + in-app). Tests: `test_content_presets.py`,
  `test_ui_content_presets.py`, `test_config.py` additions. 1755 API / 639 UI green.

---

## Bundled Python runtime for the Electron installer (done 2026-07-04)

`electron/main.js`'s `findPython()` used to search PATH for a system Python (3.11+),
which on a machine running Python 3.14 (no cp314 wheel for `llama-cpp-python`) meant
the "Install llama.cpp" button always failed with a source-build error (no C++
toolchain). The installer now bundles a pinned CPython 3.12.13
([python-build-standalone](https://github.com/astral-sh/python-build-standalone))
so end users never need a system Python at all, and the compiled optional backends
(llama.cpp, pyannote, CUDA libs) install from prebuilt wheels.

- **`scripts/fetch-python-runtime.ps1`**: downloads the pinned build (SHA256-verified,
  cached in `build/python-runtime-cache/`), extracts to `build/python-runtime/`.
  Wired into `build-release.ps1` as a build step.
- **`electron/package.json`**: new `extraResources` entry ships `build/python-runtime/`
  as `resources/python/` in the packaged app.
- **`electron/main.js`**: `findPython()` returns the bundled interpreter directly in
  packaged builds; dev mode (unpackaged) is unchanged (searches PATH). The "Python not
  found" dialog only fires in dev mode now; packaged builds show a "damaged install"
  dialog if the bundled runtime is somehow missing.
- **`pyproject.toml`**: `requires-python` capped at `<3.14` as a belt-and-suspenders,
  since `llama-cpp-python` has no cp314 wheel yet.
- Verified: fetch script downloads + verifies + extracts correctly, the bundled
  interpreter creates a working venv with pip. **Not yet verified on a clean machine
  with no system Python** - do that before the next release build.

## Image-based clip analysis (done 2026-07-04)

Closed the Phase 6 "Image-based clip analysis" item (plan 11). Optional, off-by-default,
clip-only: sample frames from a clip, send them to a vision model, and store a short
"what's on screen" summary that enriches descriptions and gives the text scorer visual
context - it never scores directly.

- **`yuu_clip/analyze/frames.py`**: `frame_timestamps` (evenly-spaced, midpoint for one
  frame), `sample_clip_frames` (ffmpeg JPEG extraction, ≤1280px), `resolve_frame_window`
  (fresh 720p proxy preferred, parent segment offset added for split segments - same maths
  as preview/auto-framing), and `sample_and_describe` / `analyze_clip_frames` orchestrators.
- **Vision clients** (`scoring/llm_client.py`): `LLMClient.chat_vision(messages, images)`
  with a base implementation that raises the new typed `VisionNotSupportedError`; overrides
  for **Ollama** (base64 images on the user turn), **Claude** (native image content blocks),
  and **llama.cpp** (mmproj chat handler chosen per model family). The Ollama path scales
  `num_ctx` with frame count and **degrades to fewer frames on a context overflow** (moondream
  is hard-capped at ~2048 tokens ≈ 2 frames and ignores `num_ctx`).
- **Prompt** (`scoring/llm.py`): `describe_frames` sends a **plain-text** "describe what's on
  screen" instruction in the *user* turn (not a JSON system prompt - verified that small vision
  models return coordinates/empty for JSON schemas but follow a plain ask). `_clean_vision_summary`
  tolerates a stray JSON reply and caps length. `check_vision_available` is the per-backend gate
  (master switch + model capability). Scoring/description prompts gain a *Visual context* block
  (`_visual_block`) when a clip has a summary.
- **Storage + routes**: `clip_candidates.vision_summary` / `vision_analyzed_at` (guarded
  ADD-COLUMN); serialized in `_clip_dict`. `POST /api/clips/{id}/analyze-frames` (in-process via
  `asyncio.to_thread`, 503 when unavailable, returns elapsed) and `?include_frames=1` on
  `rescore-clips` (per-clip analysis folded into the batch loop, vision failure never blocks scoring).
- **Config**: `vision_enabled` (off by default - the master switch) + `vision_frames_per_clip`
  (1–10, load-sanitized + PATCH-validated). Catalog: `model_catalog.ollama_vision_tag_bases()`
  centralizes the Ollama vision-tag set (reused by `/api/llm/capabilities`).
- **UI**: a "What's on screen" clip-detail card with the **Analyze frames** button (gated via
  plan-10's `gateOnCapability`, hidden entirely unless the master switch is on); an "Include frame
  analysis" checkbox in the Re-score dialog (shown only when vision is enabled + capable); Settings
  → LLM scoring toggle + frames field. `window._visionEnabled` is seeded at boot and refreshed on
  settings save.
- **Verified end-to-end** against a real recording (video 13, clip 167) through Ollama + moondream:
  frames sampled from the proxy, summary generated, stored, and serialized. Glossary "Image analysis"
  (dev + in-app); FEATURES "What's on screen". Tests: `test_frames.py`, `test_vision.py`,
  `test_ui_vision.py`, plus catalog + config additions (1733 api / 632 ui pass).
- **Deviations flagged**: plain-text prompt instead of the plan's JSON `{"vision_summary"}`
  (small models fail JSON); Ollama frame-degradation fallback (moondream's hard 2048 context);
  `vision_enabled` made a real client+server master switch (the plan didn't wire it to anything).
  **llama.cpp vision is implemented but untested on this machine** - no cp314 wheel and no C++
  toolchain to build `llama-cpp-python` from source (`CMAKE_C_COMPILER not set`).

## Model selection + capability gating (done 2026-07-04)

Closed the Phase 6 "Model selection and capability gating" item (plan 10). A curated
catalog of recommended text + vision models, surfaced in Settings and the wizard, plus a
uniform way for UI features to detect "the model this needs isn't installed" and link to
the fix.

- **`yuu_clip/model_catalog.py`** (pattern: `export_presets.py`): a frozen `ModelEntry`
  dataclass + static `CATALOG` tuple + helpers (`recommended_models`, `text_models`,
  `vision_models`, `catalog_for_backend`, `model_by_id`). Each entry records id, display
  name, kinds (`text`/`vision`), licence, one-line "why", backends, size, and the backend
  path (ollama tag / GGUF url + mmproj url / Claude api id). **Licence policy is enforced by
  a test**: every *recommended* entry must permit monetized output
  (`MONETIZATION_OK_LICENCES` = Apache-2.0 / MIT / BSD-3 / Anthropic commercial). Licences
  web-verified against the HF model cards at implementation time (Qwen2.5-7B & VL-7B,
  Mistral-7B-v0.3, moondream2, SmolVLM2 = Apache-2.0; Phi-4 = MIT). **Llama 3.1 and Gemma 3
  are recorded as rejected** (`recommended=False` + `rejected_reason`) so the next session
  doesn't re-litigate - they stay out of the pickers but still work if configured by hand.
- **Deviation from the plan (flagged):** the plan's `kind` (singular `text`/`vision`) is a
  `kinds: frozenset` instead, because Claude models are multimodal and belong in *both*
  `text_models()` and `vision_models()`; local models carry a single kind.
- **Routes** (`web/routes/llm.py`): `GET /api/llm/capabilities` →
  `{backend, model, text, vision, detail}` (cheap static check - file-exists for llamacpp,
  model-name for ollama, key-present for claude; no test inference). `GET /api/llm/catalog`
  → recommended entries. `POST /api/llm/ollama/pull?tag=` streams `ollama pull` via
  `subprocess_sse`, **allowlisted to catalog tags** (the tag is a subprocess arg).
- **New config field** `llm_mmproj_path` (config-only, no migration): the vision-projector
  `.gguf` that enables image analysis on the local llamacpp backend - makes the capabilities
  endpoint's llamacpp `vision` flag meaningful and gives plan 11 its config seam.
- **Settings UI** (`settings.js` + `index.html`): the Claude model dropdown is now
  catalog-driven (fixes a stale `claude-sonnet-4-6` option → Haiku 4.5 / Sonnet 5 / Opus
  4.8); per-backend "recommended models" lists (Ollama: **Use this model** + one-click
  **Pull with Ollama**; llamacpp: download-page links + mmproj input); a **Model readiness**
  line (text ✓/○ · image ✓/○ + reason). New shared `gateOnCapability(el, "vision", message)`
  helper disables a control and appends a linked explanation when the capability is missing -
  the pattern plan 11's image-analysis controls consume.
- **Wizard** (`setup.html`): Claude dropdown refreshed to current models; the recommended
  `.gguf` download changed from Llama 3.2 (licence-excluded) to **Qwen2.5 7B (Apache-2.0)**.
- **Default Ollama model** changed `llama3.2` → **`qwen2.5:7b`** (Apache-2.0) across
  `config.py`, the Electron wizard (`main.js` `DEFAULT_OLLAMA_MODEL`, `setup.html` fallback),
  the Settings placeholder, and the README pull command - so the out-of-box default is also
  monetization-safe, not just the recommendations.
- **Claude de-emphasized (kept)**: local backends are labelled "free" and Claude's option
  now reads "paid · sends transcript to Anthropic" in both Settings and the wizard, with a
  "most people should pick a local backend" note. The backend stays fully functional and in
  the catalog - this is a clarity change for non-developer end users, not a removal (Claude is
  monetization-safe; the concern was the paid/remote/third-party tradeoff being under-stated).
- **Drift guard** (`TestDefaultsMatchCatalog` in `test_model_catalog.py`): the config
  `ollama_model`/`claude_model` defaults and the Electron `DEFAULT_OLLAMA_MODEL` constant must
  each be a *recommended* catalog entry - so a default can't silently lag the licence policy
  again (the root cause of the llama3.2 default outliving the policy). Plus a `CLAUDE.md`
  Licensing subsection extending the guardrail from code dependencies to **model weights and
  runtime-downloaded assets** (which are bespoke-licensed, not GPL/AGPL, so they slipped the
  dependency check).
- **Docs:** GLOSSARY "Recommended models" + "Model readiness" (dev + in-app glossary.md);
  FEATURES.md monetization-licence section.
- **Tests:** `test_model_catalog.py` (catalog integrity + licence policy), `test_llm.py`
  (capabilities per backend/config permutation + pull-guard), `test_ui_model_catalog.py`
  (catalog-driven dropdown/lists + `gateOnCapability` via route-mocked capabilities). 1688
  api / 629 ui pass; updated the wizard UI test's Llama→Qwen2.5 assertion.

---

## Transcript name correction (done 2026-07-04)

Closed the Phase 6 "Transcript name correction" item (plan 09) - Whisper mis-hears
spoken names ("You" for "Yuu"); this scans the transcript, groups the likely
mis-transcriptions of **known** names, and applies only the ones the creator approves.
No LLM in v1 - pure fuzzy string matching.

- **Matcher** (`find_name_corrections` / `LexiconName` / `NameCorrection` in
  `scoring/textmatch.py`, pure + fully unit-tested): rapidfuzz `ratio`, one correction
  per token (its best lexicon match). **Lexicon** = confirmed Speaker Names (owned by
  that voice) + capitalized ≥3-char character tokens extracted from the recording's
  attached world contexts' `your_characters`/`other_characters` free text.
- **Cutoff design deviates from the plan (flagged):** the plan's "ratio ≥ 90 common /
  ≥ 80 normal" is wrong for the marquee case - `ratio("you","yuu")` is only **66.7**, so
  a 90 floor would never fire. Instead ordinary tokens need ratio ≥ 80, while short/common
  tokens use a **lower** floor (≥ 65) gated by **capitalization-in-context** - capitalization
  is the precision lever a bare similarity score can't give for 3-letter words. Plus a
  length-difference guard on common tokens (kills "All"→"Sally"), a stop-word skip (function
  words never match a character name), and the plan's own precision rules: known-names-only,
  and own-name exclusion (a speaker's own lines are skipped for their own name).
- **Known limitation:** short homophone-only pairs like "All"/"Lil" score identically to the
  real "You"/"Yuu" (both 66.7) and are inseparable by edit distance - separating them needs
  phonetics, which the plan defers. The grouped-review UI is the mitigation: an obviously-wrong
  pattern group is rejected in one uncheck. Verified on real project data: 91 true "You"→"Yuu"
  surfaced on one recording alongside a couple of trivially-rejected false groups.
- **Routes** (`web/routes/name_corrections.py`, in-process - matching is fast):
  `POST /api/videos/{id}/name-corrections/scan` returns corrections grouped by
  `(token → suggested)` with per-instance ±1-line context and speaker labels; nothing
  stored. `POST …/apply` takes `[{segment_id, token_start, token_end, token, replacement}]`,
  applies each segment's spans right-to-left, and validates the span still holds the expected
  token - a drifted item is reported per-item (`error: "text_changed"`) rather than failing
  the batch (a pragmatic read of the plan's "409 for that item only").
- **Shared caption-edit path:** applying reuses the same bookkeeping as a manual caption edit
  via a new `stage_segment_text_edit` helper (extracted from the caption-edit route into
  `_shared.py`) - overlapping clips are re-excerpted, `transcript_edited_at` is stamped, and
  export sidecars refresh, so staleness badges behave identically.
- **UI** (`namecorrections.js`, PanelNav takeover from a "Fix names" button in the transcript
  card): grouped list, each group a `<details>` with a select-all checkbox and per-instance
  checkboxes (all checked by default), matched token highlighted, "speaker unknown" chip on
  unattributed lines. Apply shows a count, toasts the result (with a skipped count on drift),
  reloads the open transcript, and re-scans.
- **Tests:** `test_name_corrections.py` (20 unit + API - matcher rules, lexicon extraction,
  scan grouping, apply drift/idempotency/staleness); `test_ui_namecorrections.py` (6 Playwright
  - panel open, highlight, chips, group select-all, apply-only-checked, empty state). Glossary
  "Name Corrections" (dev + in-app "Fix names").

---

## SpeechBrain diarization backend (done 2026-07-04)

Closed the Phase 6 "Additional diarization backends" item (plan 08) - a second
real speaker-labels backend that needs **no HuggingFace account or token**:
SpeechBrain ECAPA-TDNN embeddings (Apache-2.0) + agglomerative clustering. Removes
the pyannote gating friction for distributed users. NeMo TitaNet stays a deferred
stretch backend.

- **Client** (`SpeechBrainDiarizationClient`, `transcribe/diarization_client.py`):
  energy-VAD windows (1.5 s / 0.75 s hop) over the extracted 16 kHz mono WAV →
  ECAPA embeddings (192-dim) → `AgglomerativeClustering(distance_threshold=0.55,
  metric="cosine")` → adjacent-same-cluster windows merged into turns, per-cluster
  L2-normalized centroids become `Speaker.voiceprint`. Steps VAD→cluster→merge→
  centroid are pure module functions so they test without importing SpeechBrain.
  Moves the encoder to CUDA when available.
- **Windows symlink fix (not in the plan):** `EncoderClassifier.from_hparams`
  defaults to symlinking the HF cache into `savedir`, which raises WinError 1314
  without Developer Mode/admin - so we pass `local_strategy=LocalStrategy.COPY`.
  Caught by running the real encode path during implementation.
- **Backend-specific voiceprints:** new `speakers.voiceprint_backend` column
  (guarded `_migrate` ADD-COLUMN, backfilled to `"pyannote"` where a voiceprint
  exists). `_best_voiceprint_match` skips candidates whose backend differs from the
  active run - pyannote and SpeechBrain embeddings live in incompatible spaces, so
  a cross-backend cosine would mis-match. `_attach_speakers` stamps the backend on
  minted/backfilled voiceprints.
- **CLI backend-override fix (not in the plan):** `analyze --diarize` and
  `rediarize` hardcoded `"pyannote"`, which would force pyannote even for a
  speechbrain-configured project. Now they only default to pyannote when the
  configured backend is `"null"`, otherwise they respect the configured backend.
- **Install + config:** `"speechbrain": ["speechbrain", "scikit-learn"]` in the
  Settings optional-install allowlist (`_INSTALLABLE`/`_IMPORT_NAMES`, import names
  `["speechbrain", "sklearn"]`); config PATCH enum accepts `"speechbrain"`. All
  deps verified permissive (Apache-2.0/BSD/MPL; no GPL/AGPL) incl. the ECAPA model
  (`speechbrain/spkrec-ecapa-voxceleb`, Apache-2.0), which auto-downloads (~80 MB)
  to the platformdirs user cache on first use.
- **UI:** Settings → Speaker labels gains a "SpeechBrain - no account or token
  needed" backend with its own install row; the match-threshold + readiness status
  moved to a shared block shown for any backend. `_diarizationReadiness` /
  `_diarizationReason` are now backend-aware (SpeechBrain needs no token) so the
  analyze/export checkboxes gate correctly. Switching backends can't auto-match
  names across engines - surfaced in FEATURES + glossary.
- **Tests:** pure-pipeline units (slice/VAD/cluster/merge/centroid) +
  `available()` find_spec-mocked (no SpeechBrain import needed) in
  `test_diarization.py`; cross-backend match-skip + same-backend re-attach + column
  existence in `test_speakers.py`; config-accepts-speechbrain +
  install-status-slug in `test_config.py`/`test_analyze.py`; backend-aware
  `_diarizationReason` in `test_ui_utils.py`. Real end-to-end encode verified
  during implementation.

---

## Clip export editor (done 2026-07-04)

Closed the Phase 6 "Clip export editor" item (plan 07) - a PanelNav takeover
launched from "Edit & export" on a clip that ties **Trim** (plan 05-era
`start_offset`/`end_offset`), **Vertical framing** (plan 06 `crop_x`), and
**Caption style** (plan 05) together over one live preview. Adds no new encode
path: Export writes the same clip fields and runs the same single-clip export SSE
as the plain Export dialog, which stays for quick exports.

- **Context endpoint** (`GET /api/clips/{id}/context-transcript?pad_s=30`):
  returns the parent recording's transcript clipped to the clip's current
  (offset-adjusted) window ± the pad, each line flagged `in_clip`, timed
  recording-relative (segment-relative for a split segment) with `seek_offset_s`
  for parent-player seeking. Backed by `subtitles.clip_context_transcript_lines`
  (reuses `video_transcript_lines`); unit-tested for pad clipping + in_clip flags
  + offset-shifted windows. No DB columns - reuses `start_offset`/`end_offset`/`crop_x`.
- **Editor module** (`yuu_clip/web/static/exporteditor.js`, own IIFE): inline
  proxy-preferred preview `<video>` (never relies on `#player-area`, which the
  panel covers), transcript-driven trim (per-line ⇤/⇥ boundary buttons + ±0.5 s
  nudge + reset, 1 s floor guard, live duration readout), a drag-to-position 9:16
  crop box drawn over the real frame (shown only for a vertical preset; reuses the
  plan-06 `suggest-framing` route for Auto-frame), a live caption overlay labelled
  "preview approximation" (JS overlay styled from the config caption style, not
  libass-exact), and a footer (preset / captions / title-card) whose Export runs
  the existing SSE after PATCHing timing + framing.
- **Entry point**: "Edit & export" button in the clip detail's Export card
  (`renderDetail`, clips.js).
- **Colors**: the caption overlay and the outside-crop scrim use the documented
  over-video exemption (inline `rgba(0,0,0,…)` scrim + `#fff` caption text, same
  class as `#000` letterboxing) - no app.css literals, so `test_ui_theme.py` is
  untouched.
- **Tests**: `tests/test_ui_exporteditor.py` (13 Playwright tests - open/dirty
  guard, line-click + nudge + reset + too-short reject, caption overlay
  show/hide/off, crop-box appears-for-vertical + drag-persists-crop_x, export
  saves trim & closes) and the context-transcript unit tests in test_captions.py.
  Real `tiktok-9x16` export smoke-verified end to end (crop_x from the drag box
  lands in a 1080×1920 output).

## Vertical crop / Shorts export - Stage 2: MediaPipe auto-framing (done 2026-07-04)

Completes plan 06 - an optional "Auto-frame on faces" button that suggests the
vertical crop position from face detection, on top of Stage 1's manual framing.

- **Detector** (`yuu_clip/analyze/framing.py`): samples 5 evenly-spaced frames
  across the clip window (from the 720p proxy when fresh, else the source), runs
  MediaPipe face detection, takes the median face-center x, and converts it to a
  `crop_x` that centers the 9:16 column on the face (`crop_x_from_face_center`,
  aspect-aware; returns None when no face is found in any frame). Pure pieces
  (`_center_x_from_result`, `_median`, `_sample_timestamps`, the conversion) are
  unit-tested without MediaPipe.
- **Route** (`POST /api/clips/{id}/suggest-framing`): 503 when MediaPipe isn't
  installed (with a Settings install hint), 404 guards, else runs the detector
  off the event loop via `asyncio.to_thread` and returns `{crop_x: float|null}`.
- **Install gating**: `mediapipe` added to `_INSTALLABLE`/`_IMPORT_NAMES`; a
  "Vertical framing (auto-frame)" install row in Settings → Export uses the
  shared `installPackage`/`_refreshInstallStatus` plumbing.
- **UI**: an "Auto-frame on faces" button in the export dialog's Vertical framing
  group fills the slider on success; the creator still confirms by exporting.
  Absent-package (503) links to the Settings install; no-face leaves the manual
  position untouched.
- **Deviations from the plan (flagged).** The plan assumed MediaPipe's legacy
  `mp.solutions.face_detection` API, but the only `mediapipe` wheel that installs
  on this Python (3.14) is the Tasks-only build (`mediapipe.tasks.python.vision.
  FaceDetector`), which needs a model asset. So the detector uses the Tasks API
  and downloads the ~230 KB BlazeFace model (Apache-2.0) to the user cache on
  first use (same "downloads on first use" pattern as the laugh model) rather
  than requiring the legacy solutions API. Verified end-to-end: MediaPipe 0.10.35
  imports on Python 3.14, the model downloads, and the full
  ffmpeg→detect→median pipeline runs (returns None cleanly on a no-face source).

## Vertical crop / Shorts export - Stage 1 (done 2026-07-04)

Closed the Phase 6 "Vertical crop / Shorts export" item (plan 06), Stage 1 - manual 9:16
framing. Stage 2 (MediaPipe auto-framing suggestion) is deferred; see the plan file.

- **Preset model.** `ExportPreset` gains a `vertical: bool` field. New built-in preset
  `tiktok-9x16` ("TikTok / Shorts (9:16)", mp4, 1080×1920, CRF 20). Custom presets can be
  vertical too (`validate_preset_dict` + the `/api/export-presets` body + a "Vertical 9:16"
  checkbox in Settings → Export).
- **Filter chain.** New `_vertical_crop_filters()` in `analyze/extract.py`: for a vertical
  preset it prepends `crop=min(iw\,ih*9/16):ih:<x>:0` (comma escaped for libavfilter) →
  `scale=1080:1920:force_original_aspect_ratio=decrease` → `pad=1080:1920:…`, with any
  burned-in captions appended **after** so they're sized for the 9:16 frame. The `min()`
  crop width + decrease/pad means a source already narrower than 9:16 is letterboxed, never
  cropped past its own width - a vertical export never fails on aspect ratio (verified with a
  real 480×1080 ffmpeg smoke test). `crop_x` threads through
  `_preset_video_filter`/`export_clip_with_preset`/`cli/export.py`.
- **Vertical framing (crop position).** New nullable `ClipCandidate.crop_x` REAL column
  (0=left, 0.5=center, 1=right; NULL=center), added via `_migrate`. `PATCH /api/clips/{id}/
  framing` clamps 0–1 and stamps `trim_edited_at` (crop moves pixels like a trim), serialized
  into `_clip_dict`, and recorded in `ClipExport.settings` for a vertical export.
- **UI.** Export dialog shows a "Vertical framing" control (Left/Center/Right + slider over a
  schematic 16:9 frame with a movable 9:16 box, theme-token styled) only when a vertical
  preset is selected; `confirmExport` PATCHes `crop_x` before running. Framing preview is a
  schematic box, not a real video frame - there is no poster/thumbnail endpoint yet (a real
  frame + drag box is plan 07's scope).
- **Tests.** Filter-chain strings (center/left/right/clamp/captions/narrow), preset `vertical`
  round-trip, `tiktok-9x16` built-in, and `crop_x` PATCH validation. 1610 API tests pass.

## Caption style options (done 2026-07-04)

Closed the Phase 6 "Subtitle style options" item (plan 05). Font, size, and position for
**burned-in** captions, on top of the per-speaker colour that shipped earlier.

- **Config.** New `caption_font_name` (`""` = renderer default), `caption_font_size`
  (`0` = default, else 12–96), `caption_position` (`bottom`/`top`) on `Config`, sanitized
  on load (`_sanitize_caption_style_fields`, WARN + fall back) and strict-validated in the
  `PATCH /api/config` route. `validate_caption_font_name` rejects `'`, `,`, `\` - validation
  is the filtergraph-escaping strategy.
- **Filter builder.** New frozen `CaptionStyle` dataclass + shared `_subtitles_filter()`
  helper in `analyze/extract.py`, refactored into both burn-in sites (the plain
  `_build_clip_cmd` re-encode path and `_preset_video_filter`). Non-default fields become a
  libass `force_style='FontName=…,FontSize=…,Alignment=…'`; empty/default fields emit no
  `force_style` at all (zero change for existing exports). **`PrimaryColour` is never set** -
  per-speaker `<font color>` tags in the SRT keep winning. Windows drive-colon escaping
  preserved.
- **Plumbing.** `cli/export.py` gains `--caption-font/--caption-size/--caption-position`
  (default to config; validated), builds a `CaptionStyle`, threads it to
  `export_clip`/`export_clip_with_preset`, and records non-default style into
  `ClipExport.settings` when captions are baked in. The single-clip export SSE route
  (`web/routes/analyze.py`) forwards per-export overrides from the dialog; batch/bulk exports
  inherit the config default via the CLI.
- **UI.** Global defaults under **Settings → Export** (Caption font / size / position, with a
  "burned-in only" note); a collapsed **Caption style** group in the Export dialog prefilled
  from config, sent only when "Burn in captions" is chosen.
- **Verified.** Reel does **not** burn captions (only a `.srt` sidecar via
  `build_reel_caption_srt`) - no style plumbing needed there. Caption *colour* was
  deliberately left out (speaker colours own it). No new DB columns; no migration.
- **Tests.** `_subtitles_filter`/`CaptionStyle` unit tests + both-export-path assertions
  (`tests/test_export.py`); config PATCH accept/reject + load-sanitize
  (`tests/test_config.py`); settings render + dirty-marking (`tests/test_ui_settings.py`).

### Follow-up: highlight-reel caption burn-in (done 2026-07-04)

Extended caption burn-in to the highlight reel (previously the reel could only write an
SRT sidecar). `reel.burn_reel_captions()` re-encodes the finished reel with the stitched
`<reel>.srt` (built by the existing `build_reel_caption_srt`, which already offsets each
clip's lines onto the reel timeline accounting for title cards + transition overlaps) using
the same `_subtitles_filter`/`CaptionStyle` as clip export - audio stream-copied, per-speaker
colours preserved. `reel` CLI gained `--bake-captions` (uses the configured Caption style,
also writes the sidecar); the `/api/demo/start` route gained `bake_captions`; the reel
builder's captions checkbox became a **None / Caption file / Burn into video** dropdown.
Empty-transcript reels skip the burn (no wasteful re-encode). Tests: `burn_reel_captions`
command shape (`tests/test_reel.py`), route flag mapping, and the dropdown options
(`tests/test_ui_reel.py`).

---

## Multi-session grouping + unified timeline (done 2026-07-04)

Closed the Phase 5 "Multi-session grouping" item (plan 04). Multiple OBS files from one
sitting can be grouped into a single **Session** with a shared name, a rolled-up summary,
a continuous cross-recording timeline, and session-scoped reel building. Auto-suggested
from timestamps or grouped by hand; grouping never mutates recordings.

- **Schema.** New `RecordingSession` ORM model (table `sessions` - named to avoid
  colliding with SQLAlchemy's `orm.Session`) with rollup `title/title_user/summary/
  summary_user/summarized_at/summary_context_json`. New nullable `videos.session_id` FK
  (guarded ADD-COLUMN in `_migrate`; the table itself comes free via `create_all`). Only
  top-level recordings carry `session_id`; split segments belong via their parent.
  Dissolving a session nulls members' `session_id` explicitly - no cascade, recordings
  never deleted.
- **Auto-suggest.** Pure, unit-tested `yuu_clip/sessions.py`: parses OBS-style stems
  (`YYYY-MM-DD HH-MM-SS`, space or underscore), falls back to `mtime − duration`, and
  groups recordings whose consecutive gap (prev end → next start) is under a hard **30-min**
  constant. Singleton groups are never suggested. `GET /api/sessions/suggestions` only
  considers ungrouped recordings, so an accepted suggestion is never re-proposed.
- **Routes** (`web/routes/sessions.py`): CRUD (create with member ids, rename, add/remove
  member, dissolve), `GET /api/sessions/{id}` detail (members ordered by real start time
  with cumulative offsets + real-world gaps + re-offset timeline entries and clip markers),
  `PATCH /{id}/fields` (user title/summary override, mirroring the video pattern), and
  `GET /{id}/summarize` (SSE, in-process `summarize_session` LLM rollup, auto-commit).
  Mixed/unknown/segment member ids → 400.
- **Reel scope.** `/api/demo/approved-clips` gained a plural `video_ids` filter (supersedes
  `video_id`); the reel builder's "Clips from" picker lists sessions under a **Sessions**
  optgroup, and the session detail view has a **Build Highlight Reel from Session** button.
  The reel composer already handled clips from multiple source files, so no compositor
  change was needed.
- **UI** (`sessions.js`, new IIFE module): collapsible session headers in the Recordings
  sidebar (collapse state in localStorage), a manual **Group** selection mode + grouping
  bar, a **Suggest sessions** prompt with per-group accept/dismiss (dismissals remembered),
  and the session detail view (rollup summary card + unified timeline with labelled breaks,
  entries/clips navigating to the source recording). No hardcoded colors (theme tokens only).

New tests: `tests/test_sessions.py` (grouping rule, filename parse, mtime fallback,
threshold, singletons), `tests/test_api_sessions.py` (CRUD, dissolve nulls FK, suggestions,
detail offsets/gaps/markers, rollup commit, `video_ids` pool filter, 400s), and
`tests/test_ui_sessions.py` (grouped/collapse render, selection mode, suggestion
dismissal memory, unified-timeline detail, reel scope option). Glossary + in-app glossary:
**Session** expanded to cover the grouping; `RecordingSession`/`session_id` added to the
dev-only term table.

Terminology note flagged during implementation: the plan specified code name `Session`, but
`models.py` already imports SQLAlchemy's `Session`; used `RecordingSession` to avoid the
shadow (recorded under GLOSSARY "Code:").

Out of scope (deferred, per plan): cross-file seamless playback, a session-level LLM
re-timeline pass (the unified view stitches existing per-recording timelines), and sidebar
grouping for split segments.

---

## Project switcher (done 2026-07-04)

Closed the Phase 5 "Project switcher in UI" item (plan 03). The server now switches
between project folders **in place** - no process restart, works identically in
browser-dev mode and the packaged desktop app.

- **In-place swap.** `ProjectContext.switch_project` disposes the current SQLite engine
  (and cleans preview-cache temp files), rebinds every path/engine/transient field to the
  new folder via a shared `_bind_project`, and bumps `project_generation`. Routes
  closure-capture the context, so it is mutated, never replaced. `thermal_monitor` is
  kept (project-independent hardware state). `_bind_project` creates `.yuu-clip` before
  `make_engine`, and the per-project bootstrap (output dirs, seed contexts, clear stuck
  `extracting` rows, drop stale pause flag) was extracted to `app.py::prepare_project` and
  re-run on switch - so pointing at a brand-new folder initializes a fresh, empty project.
  The file log follows the active project: `log.redirect_logging` swaps the rotating file
  handler to the new project's `.yuu-clip/yuu-clip.log` (new handler added before the old is
  closed; the in-memory buffer handler is left intact).
- **Endpoints.** `GET /api/projects` → `{current, known:[{path, last_opened_at, exists}]}`;
  `POST /api/projects/switch {path}` → **409** while any job runs (analyze/SSE/`proxy_generating`),
  **400** on a non-folder path, else rebuild + return the new `current`. `/api/status` gained
  `project_generation` (already had `project_dir`) so clients/tests can detect a swap.
- **Recent-projects registry.** `config.load_known_projects` / `record_known_project` maintain
  `<global config dir>/projects.json` (sibling of `profiles.json`), most-recent-first, deduped
  by resolved path, capped at 20, tolerant of a corrupt file. Boot records the startup project.
- **UI.** A header dropdown (left of the job status) shows the current project's folder name;
  the menu lists recent projects (missing folders disabled) and "Open another project…", which
  opens a path-input dialog. A successful switch toasts and does a full `location.reload()`
  (AppState is not hot-swapped). No new color tokens - reuses the hamburger-menu chrome.
- **Electron sync.** `preload.js` exposes `projectChanged(dir)` and `pickProjectFolder()`;
  `main.js` updates its in-memory `projectDir` (media-proxy serving + next-launch persistence
  via `saveElectronConfig`) and provides the native Browse dialog. Browser mode falls back to
  the text input.

New tests: `tests/test_projects.py` (registry dedup/corruption; list; switch round-trip reflecting
the second DB; generation bump; fresh-dir init; idempotent re-switch; 400/409 guards) and
`tests/test_ui_projects.py` (render + menu + modal, deliberately no live switch). Glossary +
in-app glossary: **Project**.

Out of scope (deferred): creating projects from the switcher (wizard/CLI already do), display
names / renaming, and backup/restore (separate future item, now unblocked).

---

## Laugh score as a separate attribute (2026-07-04)

Closed the Phase 6 "Laugh / non-speech sound detection: separate attribute" item (plan 02).
The `LaughScorer` (transcript/audio/model modes) already fed `score_funny`; it now also
stores its raw, unweighted 0–1 result in a new `score_laugh` so laugh density can be read
and sorted on its own - with **no change** to existing scores.

- **Model + migration.** Added the nullable `ClipCandidate.score_laugh` column via the guarded
  ADD-COLUMN list. `NULL` means laughter was never computed (pre-existing clips, or the laugh
  scorer disabled) - never backfilled, so the UI hides it rather than showing a misleading 0%.
- **Engine.** `score_clip` resets `score_laugh` to `None` each run and stores the laugh scorer's
  raw `score_funny` (identified by `scorer.name == "laugh"`) before weighted aggregation. "No
  data" laugh results carry only tags, so `score_laugh` stays `None` for them. Funny is unchanged.
- **API.** `score_laugh` is serialized on the clip shape (`null` when unset) and `laugh` is a new
  server-side sort key - SQLite's `DESC` puts the null (never-measured) clips last.
- **UI.** Sidebar score line and detail panel gain a **Laughs** bar/percentage (only when the
  value is present); the sort dropdown gains a **Laughs** option. A dedicated `--laugh` theme
  token (rose) was added across all three themes with a `.bar-laugh` rule.

New tests: engine unit tests (`tests/test_scoring_engine.py::TestLaughScoreAttribute`), API
serialization + null-last sort (`tests/test_videos.py`), UI render/sort (`tests/test_ui_clips.py::TestLaughScore`),
and `--laugh` added to the theme-token contract in `tests/test_ui_theme.py`. Glossary: **Laughs**.

Out of scope (deferred): filtering chips by laugh density, and non-speech/sound-effect detection.

---

## Voiceprint threshold validation + borderline voice-match confirmation (2026-07-04)

Closed both Phase 5 "validate the re-attach threshold" and the Phase 6
"borderline-match confirmation band" (plan 01).

- **Threshold validated.** Instrumented `_attach_speakers` to emit each cluster's best
  voiceprint similarity (INFO log + Re-diarize SSE stream), then ran a QA pass over three
  real recordings. A voice's own print re-attaches at ~1.00 (device-stable across GPU and
  CPU); the highest cosine between two *different* voices across 214 pairs was 0.647 - a
  wide clean gap. No false matches, no missed re-attaches, so **the 0.75 default stands**
  (this project overrides to 0.80) and no benchmark corpus was needed. Results tabulated in
  the plan file.
- **Borderline confirmation band.** A cluster whose best similarity lands in
  `[threshold − 0.10, threshold)` is minted as a fresh Speaker as before, but now records
  the near miss (`Speaker.suggested_match_id` / `suggested_match_score`). The Speakers card
  shows "Might be **{name}** (NN% voice match)" with **Same voice** / **Different voice**.
  `POST /api/speakers/{id}/confirm-match` moves the new Speaker's segments to the suggested
  prior (preserving `speaker_edited`), averages the two voiceprints, deletes the new row,
  and refreshes clip excerpts + export sidecars; `/reject-match` clears the suggestion.
  Caption/export surfaces are unaffected until confirmed.

Covered by new tests in `tests/test_speakers.py` (band mint/suggestion + both routes) and
`tests/test_ui_speakers.py` (chip render + button POSTs).

## Title-card text template + UI polish pass (2026-07-04)

Four review-noted items from a walkthrough of the app:

- **Title-card text is now a free-text template** (issue: "let the user customize what
  text gets displayed"). The old Settings → Export "Content" dropdown
  (Description / Timecode / Both) is replaced by a template field with `{description}`,
  `{start}`, and `{duration}` placeholders and a live preview. Each newline becomes a
  card line; a placeholder that renders empty drops its line so the card is never blank;
  an empty/all-blank template falls back to the timecode line. Config field
  `title_card_layout` → `title_card_template` (validated on load and on PATCH; unknown
  placeholders rejected). `reel.title_card_lines()` now takes `primary_size`/`secondary_size`
  (first line headline, rest body) instead of description/timecode-specific sizes - this
  also makes the reel's per-clip card show the description as the prominent line (previously
  the timecode was larger), matching the clip-export card.
- **Export filename placeholder hints** moved from a cramped column beside the input to a
  full-width row below it that wraps horizontally (was overlapping the textbox).
- **New Recording form spacing**: `.new-recording-inner` had `gap: 0`, so fields touched
  (most visibly the Advanced options box against World Contexts). Now a consistent 16px gap.
- **Hamburger menu icons** wrapped in a fixed-width span so the varying-width emoji no longer
  push the labels out of alignment.

Covered by updated `tests/test_config.py`, `tests/test_title_card.py`, and
`tests/test_ui_settings.py`.

## Actionable failures for missing tools/services: FFmpeg, scorers, Claude key (2026-07-04)

A second sweep over the same "missing host dependency → opaque failure / silent
degradation" class that produced the CUDA + LLM-preflight work below.

- **Single FFmpeg choke-point** (`config.py:run_ffmpeg`). The analyze pipeline resolved
  FFmpeg via `find_ffmpeg` (friendly install error), but reel export, clip preview, and
  scene probing called the bare `"ffmpeg"`/`"ffprobe"` string - a missing binary surfaced
  as `[WinError 2]` and processing failures as a stderr-less `CalledProcessError`. All of
  those now route through `run_ffmpeg`, which resolves via `find_ffmpeg` and raises a
  `RuntimeError` carrying either the install instructions or the captured stderr. Migrated
  `reel.py` (5 sites), `web/routes/clips.py` (preview), and `scoring/scenes.py`; `cli/reel.py`
  now reports the `RuntimeError`.
- **Silent scorer degradation surfaced** (`cli/_pipeline.py`, `scoring/laugh.py`). Laughter
  scoring in "model"/"audio" mode was dropped silently when its deps were missing - now a
  notice names the reason (`LaughScorer.availability()` returns a user-facing string), and a
  guard warns when *no* scoring signal is available (clips created but unscored).
- **Claude API key validated, not just present** (`scoring/llm_client.py`). `ClaudeClient.available()`
  now makes a free `models.list()` call so a wrong/expired key is caught in the pre-flight
  ("key was rejected") instead of failing silently on every clip; network errors and pre-Models-API
  SDKs are handled distinctly.
- Covered by `tests/test_run_ffmpeg.py`, new `ClaudeClient.available()` cases in
  `tests/test_scoring_llm.py`, and updated `tests/test_title_card.py`.

## Legacy UNIQUE(path) videos-table migration crash fixed (2026-07-04)

Pre-distribution robustness fix. `db/models.py::_migrate()` drops the legacy
`UNIQUE (path)` constraint (segments share their parent's path) by recreating the
`videos` table. The recreation used a **hardcoded** `CREATE TABLE videos (...)` column
list, but the row-copy `INSERT INTO videos ({all_cols}) SELECT {all_cols}` reads
`all_cols` live from `PRAGMA table_info`. On an old DB the ADD-COLUMN loop above the
block had already added the roadmap `source_*`/`proxy_*`/`analyze_*` columns, so
`all_cols` included columns the hardcoded schema omitted → `table videos has no column
named source_url` → **the server wouldn't start**. Unreachable on fresh/already-migrated
DBs, but a shipped user can't wipe fresh.

- **Fix**: derive the new DDL from the live `videos` DDL (already fetched for the
  `"UNIQUE (path)" in ...` guard) by stripping just the `UNIQUE (path)` fragment (both
  comma forms) via regex. This preserves the exact current column set, types, PK, and the
  `parent_video_id` self-FK regardless of future columns - it can never drift again. The
  `PRAGMA foreign_keys=OFF/ON` fence and the two INFO log lines are unchanged.
- **Test**: `tests/test_db_migrations.py::TestDropUniquePathMigration` builds a legacy
  `videos` table (UNIQUE(path) + only the pre-`source_*`/`proxy_*` columns) with real rows,
  runs `_migrate`, and asserts it doesn't raise, rows survive intact, `UNIQUE (path)` is gone,
  a second `_migrate` is a no-op, and post-drop two segments can now share their parent's path.

## Clearer failures for missing services: LLM pre-flight + model-download errors (2026-07-04)

Two "works on my machine" gaps where a missing host dependency failed opaquely:

- **LLM scoring silently skipped when Ollama is down** (`cli/_pipeline.py`,
  `scoring/llm.py`). When the LLM backend was unreachable, `ScoringEngine` dropped the
  LLM scorer with only a `log.warning` - the user got clips ranked without the AI score
  and no visible reason. Now a **pre-flight check runs before transcription starts**
  (`_preflight_llm_check`): if scoring is enabled and the backend isn't reachable, it
  warns immediately so the user can start Ollama *during* the slow transcription and have
  it used this run. A second notice at scoring time covers the case where they didn't.
  Silent when scoring is off or the LLM is intentionally disabled in Settings.
- **Whisper model-download failure was an opaque traceback** (`transcribe/whisper_runner.py`).
  A failed first-run model download (offline / HF unreachable) surfaced as a raw
  `FAIL transcription: <network error>`. Load failures now raise `TranscriptionModelError`
  with an actionable message ("check your connection and try again … or the model may be
  corrupt - retry to re-download"), preserving the original detail.
- Covered by `tests/test_preflight_llm.py` and additions to `tests/test_whisper_fallback.py`;
  `tests/test_analyze.py` scoring-isolation test updated to pass a real `Config`.

## GPU transcription: graceful CPU fallback + one-click CUDA libraries (2026-07-04)

On a machine with an NVIDIA GPU + driver but no CUDA runtime libraries, Whisper
loading crashed the whole analysis with `cublas64_12.dll is not found or cannot be
loaded` (CTranslate2 needs cuBLAS/cuDNN, which the CUDA toolkit or the
`nvidia-cublas-cu12` / `nvidia-cudnn-cu12` wheels provide). Now handled end to end:

- **Graceful fallback** (`transcribe/whisper_runner.py`). When CUDA model load fails,
  the run falls back to CPU (int8) with a plain-English notice instead of aborting.
- **DLL wiring** (`_register_cuda_dll_dirs`). The nvidia wheels install DLLs under
  `site-packages/nvidia/<lib>/bin`, which isn't on the Windows DLL search path - so pip
  alone wouldn't fix the crash. We now `os.add_dll_directory()` those dirs before loading
  the CUDA backend (idempotent, Windows-only).
- **One-click install.** New `cuda-libs` slug in `web/routes/analyze.py` `_INSTALLABLE`;
  an "Enable GPU acceleration" button in Settings → Hardware and in the first-run wizard
  (offered, not auto-installed, only when an NVIDIA GPU is detected and neither the
  system toolkit nor the wheels are present). The wizard previously pointed users at the
  ~3 GB CUDA Toolkit; it now installs the ~1 GB wheels, the lighter correct path.
- **About page** lists the two nvidia wheels (NVIDIA proprietary, redistributable -
  policy-compatible; pulled from PyPI, not bundled).
- Covered by `tests/test_whisper_fallback.py` (fallback, DLL registration, no-retry).

## Quality-review follow-ups: URL-import cancel, actionable thermal toast, NaN guard (2026-07-04)

Closing out the actionable follow-ups surfaced by the review pass below.

- **URL-import download cancel** (`web/routes/imports.py`, `web/sse.py`, `web/deps.py`,
  `static/analyze.js`, `static/utils.js`). The Import-from-URL download now has a Stop
  button. `POST /api/import-url/cancel` terminates the yt-dlp subprocess tree
  (`terminate_process_tree`) and sets `ctx.import_cancelled`; the SSE stream emits
  `[Import cancelled]` instead of a generic error. `subprocess_sse`'s old analyze-only
  `is_analyze` cancel flag was generalized to `cancel_flag_attr`/`cancel_message` (no
  caller passed `is_analyze=True` - the real analyze cancel runs through `AnalyzeJob`).
  The single job-header Cancel button now dispatches per-job: `setJobCancel({url, title,
  body, confirm, logMsg})` sets the active cancel config; `startJobUI` resets it to the
  analyze default. Covered by new tests in `tests/test_url_import.py` (cancel route,
  cancel-message emission, stale-flag-not-leaked).
- **Actionable "GPU running hot" warn toast** (`web/routes/analyze.py`, `static/utils.js`).
  `/api/status` now returns `thermal_autopause_enabled` + `thermal_pause_c`; the warn toast
  tells the user what happens next (auto-pause at N°C, or that auto-pause is off and to pause
  manually) instead of just stating the temperature.
- **"NaN sec total" guard + standard non-finite formatting** (`static/clips.js`,
  `static/utils.js`). A clip missing `start_s`/`end_s` poisoned the summed clip-stats
  duration into `NaN sec total`. New shared helpers `finiteOr(value, fallback)` and
  `fmtDuration(seconds, fallback)` are the standard way to render a computed number -
  non-finite values (NaN/Infinity from partial data) now degrade to a plain-English
  placeholder (` - ` / `unknown`) rather than surfacing raw. The clip-stats sum also skips
  non-finite per-clip lengths. Covered by `tests/test_ui_utils.py`.
- **Concurrent-UI-test guard** (`scripts/test-ui.ps1`). The UI suite shares the single dev
  server on :8080, so two runs at once (e.g. two Claude sessions) corrupted each other's
  DB state and produced spurious failures. The script now takes an atomic lock file
  (`test-ui.lock`, gitignored); a second run refuses with a clear message, and a lock older
  than 15 min is reclaimed as stale.

## Code-quality review of the roadmap-2026-07 slice (2026-07-04)

A full multi-phase quality pass (test integrity → bug hunt → coverage → refactor →
logging → docs → UX/UI → regression) over Plans 01–10. Suite green throughout:
API 1484 passed, UI 573 passed, lint clean.

- **Bug fix - malformed export filename template crash** (`yuu_clip/export_naming.py`).
  A stray/unbalanced brace (e.g. `clip_{video}}`) passed `validate_export_name_template`
  (its `{(\w*)}` regex only caught unknown placeholders) and then raised an uncaught
  `ValueError` in `export_base_stem` - which broke every export for the recording *and*
  500'd the clip-list has-export badge endpoints that call it in a loop, effectively
  bricking the recording detail view from one bad character. Validation now trial-formats
  the template and rejects unbalanced braces with a plain-English message; `export_base_stem`
  also catches `ValueError` as a fallback for any already-saved bad template. Covered by
  new tests in `tests/test_export_naming.py`.
- **Diagnosability - URL import logging** (`yuu_clip/url_import.py`, `yuu_clip/cli/import_url.py`).
  The raw yt-dlp `DownloadError` cause (auth wall vs 404 vs network vs stale yt-dlp) was
  discarded before the friendly message; it's now logged at WARNING with the URL, plus
  download start/complete/size and a "reported success but file missing" ERROR. The
  `import-url` subprocess also never wired up `configure_logging`, so none of its logging
  reached `yuu-clip.log` - now fixed.
- **Diagnosability - thermal auto-pause + sensitive-term rescans** (`web/routes/analyze.py`,
  `web/routes/sensitive.py`). "Why did analysis pause?" now logs the temp + configured
  threshold; sensitive-term create/update/delete log the rescanned/flagged clip counts
  (never the term text).
- **Refactor** - `scoring/engine.py:apply_hotword_boosts` decomposed into two pure helpers
  (behavior byte-identical).
- **UX** - Enter now submits the Import-from-URL field (`index.html`).
- **Tests** - 2 pre-existing flaky UI tests fixed (settings preview race, hotwords
  double-save); coverage added for reel export-format selection and subtitle sidecar refresh.
- Keep-as-is decisions and review-discovered follow-ups recorded in
  [REVIEW_DECISIONS.md](../dev/REVIEW_DECISIONS.md) and [ROADMAP.md](ROADMAP.md).

## Electron native-file-protocol media transport (implemented, manual packaged-app verification pending, 2026-07-03)

Roadmap plan 10 (`docs/dev/plans/roadmap-2026-07/10-electron-file-protocol.md`), the
last and lowest-value plan of the set. **Code and automated tests are done; the
plan's own 5-item manual packaged-app checklist has not been run** - this entry is
intentionally not "done" until someone builds the app and runs it. No user-facing
change (plain browser-dev mode is unaffected either way).

- **Electron main** (`electron/main.js`) - registers a privileged `yuu-media://`
  scheme before `app.ready` and a `protocol.handle` request handler wired up in
  `app.whenReady()`. Range requests (required for `<video>` seeking) are handled
  **manually** - `fs.createReadStream(start, end)` + 206/`Content-Range` - rather
  than trusting `net.fetch(pathToFileURL(...))` to cover it: the pinned Electron
  version (33.2.1, `electron/package.json`) falls inside the span of a still-open
  upstream bug (electron/electron#38749) where that pattern breaks video seeking;
  reports of the same failure exist as recently as Electron 34/35. Manual Range
  handling sidesteps the bug regardless of Electron version.
- **Path validation** - a requested path is served only if it resolves inside the
  project's `.yuu-clip/proxies` dir, or exactly matches a source/proxy path the
  backend has reported for a known video (a cached whitelist refreshed from
  `GET /api/videos`, rate-limited to once per 2s). This is a deliberate deviation
  from the plan's literal "allowed root directories" wording: recordings are
  ingested from wherever the creator originally pointed `analyze` at, which is
  frequently outside the project directory entirely, so a directory-prefix check
  alone would reject every real source file. The exact-path whitelist covers that
  case correctly without weakening the security intent.
- **Server** (`yuu_clip/web/routes/videos.py`) - `_video_dict` now includes the
  recording's absolute `source_path`; `GET /api/videos/{id}/proxy-status` includes
  the proxy's absolute `proxy_path` (null until a fresh proxy exists). No behavior
  change to the existing HTTP source/proxy routes.
- **Renderer** (`yuu_clip/web/static/utils.js`) - new `_buildMediaUrl(videoId, kind,
  absPath)` is the single point that picks the transport: `yuu-media://media/<url-
  encoded path>` when `window.electronAPI.mediaProtocol` is set (packaged app) and
  an absolute path is known, otherwise the unchanged `/api/videos/{id}/{source,
  proxy}` HTTP URL. `setupRecordingPreview`/`_useRecordingProxy` (shared by the
  recording detail player, Split Editor, and the manual clip-create picker) now
  thread `sourcePath`/`proxy_path` through to it.
- **Tests**: `tests/test_ui_video.py::TestNativeMediaProtocolUrlBuilder` covers the
  URL builder with a stubbed `electronAPI.mediaProtocol` (drive-letter path, spaces,
  unicode, backslash normalization, no-stub HTTP fallback, stub-but-no-path
  fallback). `tests/test_videos.py` covers the new `source_path`/`proxy_path`
  response fields. `electron/main.js`'s protocol handler itself has no automated
  coverage - Playwright cannot exercise a real Electron process.

**What's still needed before this can be marked fully done** - the plan's own
manual packaged-app checklist, none of which is possible from an automated/headless
session:
  1. Build the packaged app and open a recording - confirm playback starts.
  2. Confirm seeking works (Range requests).
  3. Confirm a split segment plays back at the correct offset.
  4. Confirm DevTools' Network tab shows no `/api/videos/.../source` byte traffic
     (i.e. the native protocol is actually being used, not a silent HTTP fallback).
  5. Confirm a doctored/malicious path outside the allowed set is refused (403).

## Title card customization (done, 2026-07-03)

Roadmap plan 09 (`docs/dev/plans/roadmap-2026-07/09-title-card.md`). Background
color, text color, text size, content layout, and duration for the title card
shown between highlight reel clips and prepended to a clip export with "Add
title card" enabled - previously hardcoded (black background, white text,
fixed sizes).

- **Config** (`config.py`) - `title_card_bg_color`/`title_card_font_color`
  (strict `#RRGGBB`, `validate_hex_color`), `title_card_scale` (0.5–2.0,
  multiplies the existing per-line font sizes so one knob scales both the reel
  and clip-export contexts), `title_card_layout` (`description` / `timecode` /
  `both`), `title_card_duration_s` (1–10). `PATCH /api/config` rejects bad
  values outright; a hand-edited config file with garbage instead falls back
  to defaults with a WARN log (`Config.load()` never crashes on it).
- **Backend** (`yuu_clip/reel.py`) - `_make_title_card` takes `bg_color`/
  `font_color` params, converted to ffmpeg's `0xRRGGBB` form. New shared
  `title_card_lines(cand, config, *, description_size, timecode_size)` helper
  replaces the duplicated "which lines go on the card" logic at both call
  sites (`cli/export.py::_apply_title_card`, `reel.py::_build_segment_list`):
  it honors layout + scale, reads `cand.effective_description` (the clip
  export path previously read the raw un-edited description, ignoring user
  edits - fixed here), caps the description at ~90 chars with an ellipsis
  (previously unbounded), and falls back to the timecode line when
  `layout=description` and the clip has no description so a card is never
  emitted empty.
- **Settings UI** (`index.html` + `settings.js`, Settings → Export) - two
  native color inputs, a Text size dropdown (Small/Normal/Large/Extra large →
  0.75/1.0/1.25/1.5), a Content dropdown, a duration number input, a pure-CSS
  live preview ("Preview (approximate)"), and a WCAG contrast-ratio check
  (below 3:1) that shows an inline warning without blocking save.
- **Tests** - `tests/test_title_card.py` (command construction via mocked
  `subprocess.run`, `title_card_lines` layout/scale/truncation/
  effective_description coverage, both call sites' wiring, a real tiny encode
  with non-default colors) and `tests/test_config.py`
  (`TestTitleCardConfigDefaults`/`TestValidateHexColor`/
  `TestTitleCardConfigLoadSanitization`/`TestTitleCardConfigApi`); UI coverage
  in `tests/test_ui_settings.py::TestTitleCardSettings` (fields render/persist,
  preview reflects color/layout, contrast warning appears/hides).

## URL import - Twitch VOD / YouTube (done, 2026-07-03)

Roadmap plan 08 (`docs/dev/plans/roadmap-2026-07/08-url-import.md`). Paste a
public Twitch VOD or YouTube link instead of picking a local file; yt-dlp
(Unlicense) downloads it, then the New Recording panel opens prefilled so the
creator still confirms track layout and World Contexts before analyzing -
analysis is never auto-started, consistent with the drag-and-drop principle.

- **Data model** - new nullable `videos` columns `source_url`, `source_title`,
  `source_uploader`, `source_upload_date`, `source_category`. Set from a metadata
  JSON sidecar (`yuu_clip/url_import.py`) written next to the downloaded file;
  picked up by `cli/_pipeline.py::_apply_source_metadata` when the Video row is
  first created, which also pre-seeds `title_user` from the scraped title.
- **Backend** (`yuu_clip/url_import.py`, `cli/import_url.py`, `web/routes/imports.py`)
  - `POST /api/import-url/inspect` fetches metadata without downloading (host
  allowlist: youtube.com/youtu.be/twitch.tv; rejects live streams, playlists/
  channels, and auth-walled videos with plain-English errors); `POST
  /api/import-url/start` + `GET /api/import-url/events` follow the same
  start→events SSE pattern as the highlight reel, running the new `yuuclip
  import-url` CLI command. Downloads are capped at 1080p
  (`bestvideo[height<=1080]+bestaudio/best[height<=1080]`, merged to mkv), land in
  a new `<project>/.yuu-clip/downloads/` dir, get a disk-space check before
  starting, and a sanitized filename (collision-safe via a video-id suffix).
  `/api/status` gains `import_running`; `subprocess_sse` gained an opt-in
  `track_active_job` flag so this (and any future job that wants it) is correctly
  folded into `any_running`.
- **UI** - "Import from a URL instead" toggle in the New Recording panel swaps the
  local-file field for a URL field + "Check link", which renders an inspect card
  (title, channel, duration, category, upload date, estimated size, an
  already-imported warning when the link was seen before) reusing the Plan 01
  processing-time estimate and its long-run warning. "Download" streams progress
  via the standard job UI; on completion the New Recording panel reopens
  prefilled with the downloaded path. The recording detail view shows an
  "Imported from" line (channel, upload date, link to the original) when
  `source_url` is set.
- **Tests** - `tests/test_url_import.py` (URL validation, metadata mapping,
  live/playlist/auth-error handling, progress-line format/parse round trip,
  filename sanitization incl. emoji/unicode/collisions, disk-space guard, sidecar
  → `source_*` columns, the API routes, and `subprocess_sse`'s active-job
  tracking - all with yt-dlp mocked, no network calls) and an added
  `TestImportFromUrl` class in `tests/test_ui_analyze.py` (field visibility,
  stubbed inspect card, stubbed-SSE download-completion prefill).

## Export presets + per-format management (done, 2026-07-03)

Roadmap plan 07 (`docs/dev/plans/roadmap-2026-07/07-export-presets.md`). The
one-export-per-clip model becomes one-row-per-format; built-in presets plus a
custom-preset editor replace the flat container/quality choice at export time.

- **Data model** - new `ClipExport` table (`clip_exports`: `clip_id` FK cascade
  delete, `preset_name`, `path`, `container`, `settings_json`, `size_bytes`,
  `created_at`). One row per (clip, preset_name) - re-exporting the same preset
  replaces the row and overwrites the file ("regenerate"); a different preset adds a
  row ("export another format"). Backfill migration seeds a `default` row for every
  pre-existing `exported_at` clip by globbing the exports dir; legacy columns
  (`exported_at`/`exported_container`/`exported_burn_subs`) stay for the sidebar pill
  until a follow-up retires them. `GET /api/clips/{id}/export-files`, the per-row
  `DELETE /api/clip-exports/{export_id}`, and the bulk/batch export-status
  derivations in `routes/clips.py` all read the new rows.
- **Presets** (`yuu_clip/export_presets.py`) - built-ins `youtube-1080p` (mp4, h264
  CRF 18, scale ≤1080p, aac 192k) and `discord-10mb` (mp4, two-pass size-capped
  encode targeting 10 MB); custom presets are a global-config preference
  (`config.py: export_presets`), validated on save (unique kebab-case name,
  container allowlist, resolution in {720,1080,1440,2160,None}, exactly one of
  CRF/target-size). Size-capped encode fails before encoding with a plain-English
  error when the computed bitrate can't fit the clip's duration. Preset encodes
  always re-encode (no stream-copy path); never upscale past the source resolution.
  CRUD at `/api/export-presets`.
- **UI** - export options modal gains a preset dropdown ("Original quality
  (default)" + built-ins + custom); choosing a preset disables the container select
  and the soft-subtitle caption option since the preset dictates both. The clip
  detail panel's Export card now lists one row per format (preset label, container,
  size, date) with per-row Download / Show in folder / Copy path / Regenerate /
  Delete, plus "Export another format"; the sidebar pill shows a count when a clip
  has more than one format. New `yuu_clip/web/static/exportpresets.js` backs a
  matching custom-preset editor in Settings (label, container, resolution, CRF vs.
  target-size mode) using the same per-row save pattern as hot-words.
- **Glossary** - added **Export preset** and **Format** (`docs/dev/GLOSSARY.md`).

---

## Sensitive content detection (done, 2026-07-03)

Roadmap plan 06 (`docs/dev/plans/roadmap-2026-07/06-sensitive-content.md`), built on
top of Plan 03's shared `yuu_clip/scoring/textmatch.py` - kept entirely separate from
Hot-words: warning/flag only, never touches a clip's score.

- **Fuzzy matching** - `textmatch.find_fuzzy_matches()` adds a "Close spelling" mode:
  rapidfuzz (MIT) `partial_ratio` over a sliding, non-overlapping window of transcript
  words sized to the term's word count, threshold 85, minimum term length 4 (shorter
  terms are too noisy - enforced both client-side and server-side with an explanation).
  `Match.matched_text` records what actually tripped the flag (e.g. "Jonh" for term
  "John") for fuzzy hits; exact/case-insensitive hits just echo the term.
- **Backend** - new `SensitiveTerm` table (`term`, `category`: privacy/censor,
  `match_mode`: exact/case_insensitive/fuzzy, `enabled`) and
  `ClipCandidate.sensitive_matches_json`. `apply_sensitive_scan()`
  (`scoring/engine.py`) runs as a `ScoringEngine.score_clip` post-step next to the
  hot-word boost, scanning the transcript excerpt (speaker prefixes stripped) and both
  description fields - each scanned separately so a multi-word term can't spuriously
  match across a field boundary. CRUD at `/api/sensitive-terms`
  (`routes/sensitive.py`) triggers an immediate synchronous project-wide rescan on every
  save/delete (text-only, no LLM call), returning `clips_scanned`/`clips_flagged`; a
  manual per-video `POST /api/videos/{id}/sensitive-rescan` covers the case where a
  clip's transcript changes without a term-list edit (mirrors hot-word-rescan). Term
  text is treated as PII throughout - never logged, only counts/ids.
- **Frontend** - new `yuu_clip/web/static/sensitive.js` (mirrors `hotwords.js`'s
  per-row save model) backing a new "Sensitive Content" Settings section; a warning
  badge on flagged sidebar clip cards; a "Flagged terms" detail-panel card with
  category-colored chips (Privacy/Censor); a `Flagged` filter tab alongside
  All/Unreviewed/Approved/Rejected, with a dedicated empty state pointing to Settings
  when the term list is empty.
- **Glossary** - added **Sensitive Terms**, **Privacy Term**, **Censor Word**, and
  **Flagged** (`docs/dev/GLOSSARY.md` and the in-app `glossary.md` subset).
- **Tests** - `tests/test_sensitive.py` (fuzzy matcher incl. the non-overlapping-window
  regression guard, `apply_sensitive_scan`, no-score-impact and hot-word-independence
  ScoringEngine integration, CRUD validation, save-triggers-rescan, logging-safety via
  `caplog`); `tests/test_ui_sensitive.py` (Settings CRUD, client-side fuzzy-length
  guard, sidebar badge, Flagged tab incl. empty state, detail-panel category chips).

---

## Manual clip creation (done, 2026-07-03)

Roadmap plan 05 (`docs/dev/plans/roadmap-2026-07/05-manual-clip-creation.md`), the second
`PanelNav` consumer after the Split Editor:

- **Backend** - `POST /api/videos/{video_id}/clips` (`routes/clips.py`) creates a
  `ClipCandidate` from a creator-picked `{start_ms, end_ms}` window: validates the video
  exists, `0 ≤ start < end`, duration between 1s and 10 minutes, and `end_ms` within the
  recording's (segment-relative, for a split segment) duration. The new clip is tagged
  `"manual"` and its excerpt is built from overlapping transcript segments via a new public
  `build_excerpt_for_window()` in `segments/windower.py` (also now backing
  `rebuild_clip_excerpt`, replacing its inline duplicate). Scoring is not run inline - the UI
  chains the existing per-clip rescore SSE right after creation, same as any other clip.
- **Frontend** - new `yuu_clip/web/static/clipcreate.js`: a `PanelNav` takeover panel with
  two entry points ("+ New clip" above the clip list; "Create clip" on a recording's full
  transcript card). Click a transcript line to set the start, click a later line (or the
  same line again) to set the end; manual `h:mm:ss`/`m:ss` time inputs cover the no-transcript
  fallback. The panel gets its **own** inline preview video (`setupRecordingPreview`, like
  the Split Editor) rather than reusing `#player-area` - the `PanelNav` takeover visually
  covers the whole app (see note below), so seeking a hidden player would give no feedback.
  Confirm creates the clip, closes the panel, selects the new clip, and calls the existing
  `rescoreClip()` - no separate manual/unscored code path. `renderTranscriptLines()` gained a
  `readOnly` option (suppresses the click-to-edit-caption affordance) and each line now
  carries `data-start-ms`/`data-end-ms` for the picker's click handling.
- **Note on `PanelNav` coverage**: `#panelnav-root` is `position:absolute` but is a DOM
  sibling of `#main-layout` (not a descendant of `.main`), so it resolves against the
  viewport and visually covers the header and sidebar too, not just the detail pane - despite
  `.main`'s `position:relative` and the Plan 04 changelog's claim otherwise. Confirmed by
  measuring `#panelnav-root`'s live bounding box with the Split Editor open. Not fixed here
  (pre-existing, cross-cutting, out of scope for this plan) - flagged for a future pass.
- **Glossary** - added **Manual Clip** (`docs/dev/GLOSSARY.md`).
- **Tests** - `tests/test_clip_create.py` (happy path/excerpt, validation, no-transcript,
  segment-relative bounds, rescore accepts `scored_at IS NULL`); `tests/test_ui_clipcreate.py`
  (both entry points, click-click range picking incl. reset/1-line edge cases, manual time
  inputs, confirm → create → select → rescore, double-submit guard, Back dirty guard,
  keyboard-shortcut suppression while open).

---

## Panel navigation framework + Split Editor migration (done, 2026-07-03)

Roadmap plan 04 (`docs/dev/plans/roadmap-2026-07/04-panel-navigation.md`):

- **Framework** - new `yuu_clip/web/static/panelnav.js`: `PanelNav.open({id, title, render,
  isDirty, onClose})` takes over the main detail panel with a shared `← Back` breadcrumb,
  a stack (each level gets its own content container so nesting won't need to re-render a
  parent), and a dirty-state discard prompt routed through the existing `showConfirm` helper.
  `PanelNav.close()` gates on `isDirty()`; `PanelNav.forceClose()` bypasses it for callers that
  already ran their own differently-worded confirm (e.g. switching recordings). Wired into
  the Escape cascade (`settings.js` `_closeTopmostLayer`) and the global J/K/A/R/E shortcut
  dispatcher, which now no-ops while any panel is open - the panel covers the detail pane but
  not the sidebar clip list beside it.
- **Split Editor migration** - `split.js`'s open/close now routes through `PanelNav.open`/
  `close`; the bespoke dirty check and breadcrumb markup are gone in favor of the shared ones.
  `isSplitEditorOpen()` and `closeSplitEditor()` are kept as thin aliases (other modules still
  call them). `.main` gained `position: relative` so the takeover only covers the player+detail
  area, not the sidebar.
- Only Split Editor migrated in this pass - reel builder, analyze panel ("New Recording"),
  and contexts keep their existing bespoke takeover/modal patterns and migrate opportunistically
  later (plan 05's manual-clip picker is the next `PanelNav` consumer).
- **Tests** - `tests/test_ui_panelnav.py` (breadcrumb, dirty/clean Back and Escape paths,
  Escape-layering with a modal on top of a panel, keyboard-shortcut suppression); one selector
  update in `tests/test_ui_split.py` where the Back button's DOM location moved.

---

## Hot-word / phrase config (done, 2026-07-03)

Roadmap plan 03 (`docs/dev/plans/roadmap-2026-07/03-hot-words.md`), both stages:

- **Data model** - new project-wide `hot_words` table (phrase, match mode, boost, boost
  target, enabled); new `ClipCandidate.hotword_matches_json` / `hotword_boost_json` columns.
  Boosts are stored per target so re-applying is idempotent (recompute subtracts the old
  boost, adds the new one, clamps) - a rescan never compounds. Score scale matches the
  codebase's existing 0–1 internal representation (boost ±0.5, per-target clamp ±0.3), not
  the plan doc's literal 0–10 numbers, which didn't match how scores are actually stored.
- **Matcher** - `yuu_clip/scoring/textmatch.py`, shared with the future sensitive-content
  plan (06): word-boundary-aware exact/case-insensitive phrase matching (regex-escaped,
  multi-word phrases match across punctuation gaps), with speaker-prefix stripping so a
  speaker named after a hot-word phrase doesn't spuriously match.
- **Stage 1** - exact/case-insensitive matching applied automatically in `ScoringEngine`
  (analyze, rescore) via `apply_hotword_boosts()`; a cheap text-only `POST
  /api/videos/{id}/hotword-rescan` for applying hot-word edits without a full re-score.
  Full CRUD (`/api/hotwords`) plus a live-saving table editor in Settings. Clip sidebar
  shows phrase pills (≤3) or a `🔥 N` count pill; clip detail lists phrase/mode/count/boost.
- **Stage 2** - "Meaning (LLM)" match mode: one LLM call per clip checks a batch of
  semantic phrases against the transcript (`scan_hotwords_semantic`, reusing the JSON
  repair helpers in `scoring/llm.py`). Runs via `GET /api/videos/{id}/hotword-scan`
  (in-process SSE, matching the existing rescore/redescribe routes' pattern rather than
  the plan's suggested CLI-subprocess approach) from a "Scan for Hot-words" action in the
  recording's Additional Actions modal, gated on ≥1 enabled semantic entry. A later
  text-only rescan preserves semantic matches instead of wiping them.
- **Tests** - 56 in `tests/test_hotwords.py` (matcher, boost math incl. idempotency and
  clamp edge cases, CRUD validation, scan route with a stubbed LLM), 24 Playwright tests
  in `tests/test_ui_hotwords.py` (Settings CRUD against the live project with cleanup,
  sidebar/detail rendering via client-state injection, Scan-action gating).

---

## Map user paths end-to-end + artifact staleness policy (done, 2026-07-03)

Roadmap plan 02 (`docs/dev/plans/roadmap-2026-07/02-user-paths-staleness.md`), three stages:

- **Journey inventory + policy table** - `docs/dev/USER_PATHS.md` enumerates 10 user journeys,
  the upstream events that can invalidate a downstream artifact, and the locked policy: cheap
  text artifacts auto-refresh; expensive encoded artifacts (exported clip file, highlight reel)
  get a "Stale - re-export to update" badge and are never silently rebuilt. New glossary term:
  **Stale Export**.
- **Staleness plumbing** - new `ClipCandidate` columns `trim_edited_at`,
  `description_edited_at`, `exported_title_card`, `exported_embed_subs`; computed
  `export_stale`/`export_stale_reasons` in the clip API, comparing those against `exported_at`
  (a plain-cut export isn't staled by a caption edit alone; burned/embedded captions, a trim
  change, or a title-card export's description change are). `refresh_export_sidecars()`
  (`yuu_clip/subtitles.py`) extracted so caption-edit, speaker-rename, and reassign-speaker
  routes reuse the CLI retranscribe path's sidecar-refresh logic in-process; speaker rename now
  also sets `transcript_edited_at` (previously only reassign did). `GET /api/demo/list` gains a
  `stale` flag per reel, computed from the existing `.reel.json` composition manifest vs. member
  clips' `exported_at` (`null` for reels built before the manifest existed).
- **Playwright end-to-end coverage** - badge rendering (sidebar pill + detail panel) via
  client-state injection matching the existing `transcript_stale` pattern; reel staleness tested
  fully end-to-end against the live project (real manifest + real clip data, no stubbing);
  stubbed-SSE retranscribe-refresh test; a merge-confirm-cancel smoke test (merge itself stays
  API-only - it's destructive and the live dev project's DB isn't disposable).

+40 tests across `tests/test_export.py`, `tests/test_videos.py`, `tests/test_speakers.py`,
`tests/test_transcript_edit.py`, `tests/test_reel.py`; +9 new Playwright tests in
`tests/test_ui_clips.py` and `tests/test_ui_reel.py`.

---

## Pause/resume analysis + hardware health monitoring (done, 2026-07-03)

Roadmap plan 01 (`docs/dev/plans/roadmap-2026-07/01-pause-hardware-health.md`), three stages:

- **Pause/resume** - a cross-process pause flag (`yuu_clip/analyze/pause.py`)
  the CLI batch loop polls between videos; `POST /api/analyze/pause|resume`;
  `/api/status` gains `analyze_paused`/`pause_flag_set`; "Pause after current
  video" control in the job header (swaps to "Resume" when paused). The JS
  sequential-segment runners (pre-split, re-split re-analyze) honor the same
  flag between segments. The video in progress always finishes; single-video
  runs simply never trigger it. Not durable across a server restart.
- **Measured processing-time estimate** - `/api/estimate` uses medians from
  the creator's last 10 runs (keyed by whisper model + device) once ≥2
  matching samples exist, falling back to the static formula otherwise
  (`"source": "measured"|"estimated"`). A long-run warning block
  (`analyze_warn_hours`, default 2h) suggests splitting the recording or
  analyzing fewer files at once.
- **GPU thermal monitoring** - `yuu_clip/analyze/thermal.py` (`GpuThermalMonitor`
  wraps `pynvml`, silently inert on non-NVIDIA hardware; `ThermalTrigger` is
  the per-run consecutive-sample debounce/hysteresis state machine) polls
  every ~10s during analysis; warns after 3 consecutive samples at/above the
  warn threshold, auto-pauses after 3 consecutive samples at/above the pause
  threshold (reusing the pause-flag mechanism), with hysteresis so a
  still-hot GPU doesn't immediately re-pause after Resume. Configurable in
  Settings → Hardware: warn/pause °C thresholds (defaults 85/90, must satisfy
  warn < pause) and an auto-pause on/off toggle.

+21 tests in `tests/test_pause.py`, +18 in `tests/test_thermal.py`, plus
measured-estimate and thermal-status/config coverage added to
`tests/test_analyze.py` and `tests/test_config.py`; UI coverage in
`tests/test_ui_analyze.py` and `tests/test_ui_settings.py`.

---

## Quick wins Stage 9 - drag-and-drop analyze (done, 2026-07-03)

Dragging a video file over the window (Electron only) shows a full-window
drop overlay ("Drop to analyze this recording"); dropping opens the New
Recording panel with the file path prefilled and triggers the existing
probe - the user still confirms track layout and world context before
starting. Never auto-starts analysis.

- `electron/preload.js` gains `getPathForFile(file)` via Electron's
  `webUtils.getPathForFile` (≥ Electron 32; this app ships 33.2.1) - the
  only way to recover a real filesystem path from a dropped `File` under
  `contextIsolation`.
- Plain browser: no overlay affordance (nothing to drop onto that would
  work); a drop shows a toast pointing at manual path entry instead.
- Only `VIDEO_EXTENSIONS`-equivalent files accepted (mirrored in JS);
  multiple files drops the first and toasts that one-at-a-time is
  supported; non-file drags (e.g. text) are ignored entirely.

+6 UI tests in `test_ui_analyze.py` (synthetic `DragEvent`/`DataTransfer`
dispatch - no real OS drag needed).

---

## Quick wins Stage 8 - export filename template (done, 2026-07-03)

New Settings → Export → **Export file name** field: a template controlling
exported clip/reel filenames, default `{video}_clip{clip_id}_{start}`
(byte-for-byte the previous hardcoded naming). Placeholders: `{video}`,
`{clip_id}`, `{start}`/`{end}` (h-mm-ss), `{score}` (1 decimal or
`no-score`), `{date}` (export date). Live preview line, no save needed to
see it. Unknown placeholders rejected with a clear 400 at `PATCH
/api/config` time.

**Scope grew beyond the original plan** (flagged to and confirmed by the
user mid-stage): the plan only described extracting one helper for the two
duplicate stem-builders in `cli/export.py`. Investigation found **five**
independent copies of the same naming logic - the two in `cli/export.py`,
plus `web/routes/_shared.py::_clip_stem` (backs ~16 call sites across
`clips.py`/`videos.py` that locate already-exported files: has_export
badges, downloads, playback, delete, merge-rename), plus one each in
`web/routes/reel.py` (reel-builder pool `has_export`) and `yuu_clip/reel.py`
(`_resolve_clip_files`, the highlight-reel compiler). Fixing only the CLI
pair would have made a custom template silently break has-export detection
and reel compilation. All five now go through one shared module:

- **New `yuu_clip/export_naming.py`** - `export_base_stem(cand, template,
  video_filename=...)`, `validate_export_name_template`,
  `DEFAULT_EXPORT_NAME_TEMPLATE`. Duck-types on a ClipCandidate-shaped
  object; only computes the placeholder values the template actually
  references (so a default-template caller never needs `end_ms`/
  `score_overall` populated - this was a real bug caught by the existing
  `test_export.py` fixtures using minimal fakes). No `cli/`↔`web/` import
  needed - both sides import this new leaf module instead.
- `Config.export_name_template` (`config.py`), validated in the
  `PATCH /api/config` route like every other config field.
- `_clip_stem` and its downstream helpers (`_export_paths`, `_srt_path`,
  `_srt_sidecar_paths`, `_all_sidecar_paths`) in `_shared.py` gained a
  `name_template` parameter (defaulted for safety, but threaded explicitly
  from `ctx.config.export_name_template` at every call site).

Known limitation (not fixed - out of scope): changing the template after a
clip is already exported orphans the old sidecar-refresh/has-export lookup
for that clip, since the stem is re-derived from the *current* template
each time rather than stored. Documented in `_refresh_caption_sidecars`'s
docstring.

+12 tests in new `tests/test_export_naming.py`, +3 in `test_config.py`,
+1 integration test in `test_export.py` confirming the web-route lookup
path (not just the CLI creation path) honors a custom template, +3 UI tests.
Full suite: 1122 API + 462 UI, all green.

---

## Quick wins Stage 7 - detail panel chunking (done, 2026-07-03)

Closes the ROADMAP "Detail panel chunking" item. Clip detail (`renderDetail`,
`clips.js`) regrouped, layout only:

- **Summary card** - Description, Full Description, and Tags merged into one
  `.detail-card` with `.detail-card-divider` separators between sub-sections
  (each keeps its own mini-header, e.g. Description's copy/edit-kebab pair).
- **Scoring + Actions row** - kept side by side (the existing L4-3
  narrow-layout wrap design, protected by `test_detail_cards_row_wraps`, was
  deliberately not disturbed); Actions now has its own "Actions" card title.
- **Export card** - new: the Trim/Exported-file info block extracted out of
  the Actions card into its own card.
- **Transcript / Related Clips** - unchanged, already their own cards.

Full `test-ui.ps1` run: 459/459 passed with zero test edits - event
delegation (`#detail` click/keydown, tag remove/copy) and every selector the
plan flagged as a risk (`.detail-card:has(#clip-user-tags)`, transcript/
related-clips card titles) survived the move untouched.

---

## Quick wins Stage 6 - batch processing status panel (done, 2026-07-03)

Closes the ROADMAP "Batch processing status panel" item, scoped down from
its original "active/queued/completed job counts with per-job detail"
wording (no job-queue/history infrastructure exists to back that) to a
simpler counts-plus-indicator panel, per user decision when the plan's
"roadmap wins on drift" instruction hit that mismatch.

Collapsible bar above the clip filter chips (`#batch-status-panel`,
`_renderBatchStatusPanel()` in `clips.js`): unreviewed/approved/rejected +
scoring-error counts for the selected recording, plus an in-flight job
indicator (reads the existing `#job-status` pill visibility - `startJobUI`/
`endJobUI` now call back into it, guarded via `window._renderBatchStatusPanel`
so `utils.js` doesn't hard-depend on `clips.js`). Clicking a count applies
the matching filter chip; collapsed state persists in localStorage
(`yuuclip-batch-panel`). No new endpoints - everything derives from
`AppState.clips` and existing job-UI state.

+4 UI tests in `test_ui_clips.py`.

---

## Quick wins Stage 5 - reel pool from rejected/unreviewed (done, 2026-07-03)

Closes the ROADMAP "Demo reel: add clips from rejected/unrated pool" item.

`GET /api/demo/approved-clips` gains a `statuses` query param (comma-separated
subset of `approved|pending|rejected`, default `approved` - existing behavior
unchanged, 400 on an invalid/empty value); response rows now include `status`.

Reel Build tab gets Approved/Unreviewed/Rejected pool chips
(`_toggleReelPoolStatus`, `reel.js`) above the clip-order list. Toggling
refetches and merges into the existing curation: clips still in the pool
keep their order/inclusion, newly-added clips default to **excluded**
unless approved (so a stray chip toggle can't silently stuff the reel), and
clips that fall out of the pool are dropped. At least one status chip must
stay active - toggling off the last one is a no-op.

+4 API tests (`test_reel.py`), +3 UI tests (`test_ui_reel.py`).

---

## Quick wins Stage 4 - show in folder (done, 2026-07-03)

New `POST /api/reveal` (`routes/reveal.py`, Windows-only - 501 elsewhere):
resolves the given path, requires it inside a project-owned directory
(exports, reels, proxies, or a tracked recording's own directory - 400
otherwise), 404s if the file is missing, then launches
`explorer /select,<path>` via `subprocess.Popen` (argument list, no shell).
`/api/status` gained `can_reveal` (+ `reels_dir`, alongside the existing
`export_dir`) so the frontend gates buttons on Windows only.

"Show in Folder" buttons (`revealInFolder()` helper in `utils.js`), each
gated on `AppState.canReveal`:

- Clip detail → Additional Actions → Files group.
- Highlight reel View tab, per reel row.
- Recording detail, next to the duration/clip-count line (`video.path` is now
  included in the video API response).

+7 tests: `test_reveal.py` (API - path allow/deny, 404, 501, `can_reveal`)
and UI tests across `test_ui_clips.py`, `test_ui_video.py`, `test_ui_reel.py`
(request interception, not real Explorer windows).

---

## Quick wins Stage 3 - copy-to-clipboard (done, 2026-07-03)

Shared `copyText(text, label)` helper (`utils.js`) wraps
`navigator.clipboard.writeText` with a success/error toast. Copy buttons
(📋, event-delegated on `#detail`'s existing click handler, `data-copy`
attribute selects the field):

- Clip **description** (detail panel Description card).
- Clip **transcript excerpt** (detail panel Transcript card) - copies the
  plain-text excerpt, not the rendered speaker-chip markup.
- **Exported file path(s)** - new "Copy File Path(s)" row in the Additional
  Actions "Files" group, joining `AppState.exportDir` (populated from
  `/api/status`) with each filename from `GET /api/clips/{id}/export-files`.

Renamed the shared icon-button style to `.kebab-btn, .copy-icon-btn` so the
new copy buttons don't collide with `.kebab-btn` selectors that pick the
description's edit/regenerate kebab.

+3 UI tests in `test_ui_clips.py` (clipboard stubbed via `add_init_script`
for determinism under parallel workers).

---

## Quick wins Stage 2 - playback options (done, 2026-07-03)

Settings → UI: two checkboxes alongside Autoplay, mutually exclusive (checking
one unchecks the other, both live in `settings.js` and reflected in the panel):

- **Play next clip when finished** - on the preview video's `ended` event,
  advances to the next clip in the current list order (same path arrow-key
  navigation uses); stops silently at the end of the list.
- **Loop clip** - sets `loop` on the preview `<video>` element.

+3 UI tests in `test_ui_clips.py`.

---

## Quick wins Stage 1 - micro wins (done, 2026-07-03)

Four small JS/HTML-only items from `docs/dev/plans/QUICK-WINS-2026-07.md`:

- **J/K navigation aliases** - `j`/`J` and `k`/`K` alias the existing
  arrow-key prev/next clip navigation; added to the `?` controls modal.
- **Clip stats line** - muted summary between the filter chips and the clip
  list (`14 shown · 6 unreviewed · 5 approved · 3 rejected · 22 min total`),
  recomputed on every `_renderClips()`; hidden when no recording is selected.
- **Hamburger Refresh item** - `⟳ Refresh` → `location.reload()`,
  Electron-only visibility (same toggle as `#btn-setup-wizard`).
- **Shortcut hint** - one muted line under the clip list pointing at J/K/A/R/?.

+8 UI tests in `test_ui_clips.py`.

---

## Theme selector + design-token hardening (done, 2026-07-03)

Settings → UI → **Theme**: Dark (default) / Light / High contrast, applied
instantly (pre-paint inline script avoids a flash of the wrong theme),
persisted in localStorage (`yuuclip-theme`).

- **Token cleanup** - every hardcoded hex/rgba literal in `app.css` (and the
  split-editor overlays in `split.js`) replaced with theme tokens or
  `color-mix()` derivations; new tokens `--bg-deep`, `--surface-raised`,
  `--selection`, `--on-accent`, `--on-green`, `--on-red`, `--accent-text`,
  `--warn-hot`, shadow/backdrop vars. Only `#000` video letterboxing stays
  literal (intentional - letterbox black is theme-independent).
- **Contrast fixes** - reject-button/red-dot text (`--on-red`) and
  accent-as-text (`--accent-text`: header title, settings section titles,
  context chips, transcript speaker names) now meet AA in the dark theme too
  (previously ~3.6:1 / ~3.9:1).
- **Enforcement** - `tests/test_ui_theme.py` runs the WCAG AA token contract
  per theme, requires each theme block to override the full token set, and
  fails on any color literal outside theme blocks. CLAUDE.md + GLOSSARY.md
  ("Theme" entry) document the no-hardcoded-colors rule.

## Pre-release polish batch 2 (done, 2026-07-03)

Second small-fix pass ahead of the next friend release:

- **Split/unsplit no longer orphans exported clip files** - export/sidecar
  filenames embed the clip's start time (`_clip_stem`), and clip migration on
  split/unsplit shifts `start_ms`, so an exported clip's files became
  undiscoverable after "Split only" (exported badge went false, Download 404'd,
  delete left orphans, the reel builder skipped the clip). `_shift_clip_times`
  (`web/routes/videos.py`) now renames the on-disk export + SRT sidecars to the
  new stem whenever a migration shifts a clip's times, in both directions
  (split → segment-relative, unsplit → absolute). A failed rename (locked file)
  is logged, never fatal.
- **Split/unsplit blocked while the recording is being analyzed** - the
  `delete_video` mid-analysis guard is now shared (`_reject_if_video_analyzing`)
  and applied to split and unsplit too: mutating a recording that the ingest
  subprocess is writing to would re-parent rows under it. Same matching rule
  (job video id, or filename for a fresh analysis; segments share the parent's
  filename, so they're covered).
- **UI-test harness: track-layout debris can't flake the next run** - the
  `track_layout_cleanup` fixture (`test_ui_analyze.py`) now deletes the known
  test-layout names in setup as well as teardown, so a hard-killed prior run
  (watchdog force-exit skips teardown) no longer leaves a layout that makes the
  next run's create step fail. Closes the second half of the "UI-test harness
  hygiene" known issue; the first half (os._exit truncating pytest's summary)
  was already resolved by the delayed-watchdog rework that shipped with test
  parallelization.
- **ROADMAP.md staleness fixes** - the `_pearson` flat-curve and torchcodec
  known-issue entries still read as unresolved after batch 1 fixed them; both
  are now struck through with their resolutions.

---

## Pre-release polish batch (done, 2026-07-03)

Small fixes/wins identified while reviewing state ahead of the next friend release:

- **Undo for bulk Approve/Reject** - `bulk_set_clip_status` (`web/routes/clips.py`) now returns
  a `previous` map of `{clip_id: prior_status}`; a new `POST /api/clips/bulk-status-restore`
  reverts each clip to its own prior status in one call (clips may have had different statuses
  before the bulk write). The bulk toolbar shows the same undo toast pattern as single-clip
  status changes. `AppState.lastStatusChange` / `lastBulkStatusChange` are mutually exclusive -
  setting either clears the other - so `Ctrl/Cmd+Z` always resolves to the single most recent
  action without needing to compare timestamps.
- **`_pearson` flat-curve fix** (`analyze/overlap.py`) - two constant (silent) RMS curves used to
  return correlation `1.0` ("identical"), which could wrongly suppress a specialized audio track
  that just happened to be silent during the 30 s sample window. Now returns `0.0`
  (undetermined/no-correlation) for any flat-curve case, matching the existing asymmetric
  (one-flat-one-not) behavior. Was a documented "Known issue" in ROADMAP.md.
- **Torchcodec import warning suppressed** - `pyannote.audio.core.io` emits a `UserWarning` with
  the full libtorchcodec load traceback inlined as text whenever FFmpeg's shared libs aren't on
  PATH (the default on Windows) - harmless since diarization decodes WAVs itself and never uses
  torchcodec, but alarming to see on a friend's first run. `diarization_client.py` now scopes a
  `warnings.catch_warnings()` filter narrowly to that one message/module around the
  `from pyannote.audio import Pipeline` import, so unrelated warnings still surface normally.
- **ROADMAP.md staleness fix** - "random transition" for the highlight reel builder had already
  shipped (`reel.py` + `index.html`) but was still listed as pending; split that roadmap item into
  the shipped part and the one genuinely remaining piece (adding clips from the rejected/unrated
  pool to the reel builder).

---

## Split: clip/transcript migration + Undo Split (done, 2026-07-03)

"Split only - keep all existing clips" never actually migrated anything -
`split_video` created the new segment `Video` rows but left every `ClipCandidate`
sitting on the now-hidden parent, silently orphaned. Fixed:

- `split_video` (`web/routes/videos.py`) takes `migrate_clips: bool`. When set, every
  parent clip is reassigned to whichever segment contains its **start time**
  (`_migrate_clips_to_segments`), with `start_ms`/`end_ms` shifted to be
  segment-relative. A clip straddling a split point keeps its full length and is
  owned by the segment it starts in.
- `_migrate_transcript_to_segments` does the same for each transcribable audio
  track's transcript: copies a fresh `AudioTrack`/`Transcript`/`TranscriptSegment`
  set onto every segment it overlaps (segment-relative timing), so the Full
  Transcript section is populated after a plain split, not just after re-analyze.
  The parent's own track/transcript rows are left untouched.
- New `POST /api/videos/{id}/unsplit` (accepts the parent or any one segment):
  merges every segment's current clips back onto the parent (restoring absolute
  timing) and deletes the segments, so the parent becomes visible again. Exposed
  as **Undo Split** in a segment's Additional Actions menu.
- The Ignore checkbox in the split editor's segment list is hidden when the
  "Split only" action is selected - it only ever affected which segments get
  reanalyzed, so it was a silent no-op for a plain partition and was mistaken for
  something that mattered.
- Fixed a related bug: a segment's recording-preview player always streamed the
  parent file from `0:00` instead of seeking to the segment's own start (and
  never stopped at its end) - `setupRecordingPreview` (`utils.js`) now accepts
  `startS`/`endS` and bounds playback accordingly, including the 720p-proxy
  swap path (which previously had a race that could resume at `0:00` if the
  proxy-status check won the race against the initial seek).

## Preview proxy for fast multi-hour scrubbing (done, 2026-07-02)

Full-video preview was unusably slow on multi-hour `.mkv` recordings - Chromium
can't seek MKV, so it linear-scans. Fixed by generating a downscaled **720p
H.264** proxy per recording and pointing in-app playback at it.

- `analyze/proxy.py` - `generate_proxy` prefers NVIDIA **NVENC**, falls back to
  CPU **libx264**, and surfaces a clear error when FFmpeg is missing. Output is a
  `+faststart` MP4 (seekable). `build_proxy_cmd` is split out and unit-tested.
- Proxy file is keyed by source path under `.yuu-clip/proxies/`, so a split
  recording and all its segments share one file. DB columns on `videos`
  (`proxy_path`, `proxy_generated_at`, `proxy_source_mtime`, `proxy_source_size`)
  record it and invalidate when the source is re-recorded to the same path.
- Routes: `GET /api/videos/{id}/proxy` (serve, 404 when absent),
  `/proxy-status`, and `/proxy/generate` (SSE progress; the encode runs in a
  worker thread that records its own metadata and clears the in-flight guard even
  if the browser disconnects mid-encode).
- Built opportunistically at the end of `_analyze_one` (best-effort, never fails
  analysis) and on demand: the split editor auto-builds on open, keeps the source
  playable meanwhile, and swaps to the proxy when ready.
- **Hard requirement met:** a "Preview quality (720p)" badge shows whenever the
  proxy is playing (vs "Original quality" on the source); the clip preview badge
  gains a "720p" marker when served from the proxy. Exports always use the
  full-quality original.
- **All full-recording players are consistent:** one shared `setupRecordingPreview`
  (`utils.js`) drives the recording detail player *and* the split editor - both
  prefer the proxy and always show the badge. The split editor auto-builds on open
  (deliberate scrubbing surface); the recording detail player offers a click-to-
  build badge instead of auto-encoding on every casual selection (avoids surprise
  GPU load). The badge is a `role="status"` live region, or a keyboard-focusable
  `role="button"` when it invites a build.
- Left on source deliberately: the pre-analysis pre-split editor (waveform-only,
  no `<video>`, no Video row to key a proxy - and analysis will build one shortly).
- Disk hygiene: split segments inherit the parent's proxy pointer (no needless
  rebuild), and deleting the last Video row for a source file removes its orphaned
  proxy (best-effort - a locked mid-preview file is logged, never fatal).

## Recordings-list + split-timeline usability pass (done, 2026-07-02)

Three small usability fixes from direct-use feedback:

- **Sort recordings by filename** - new "Filename" option in the recordings
  sidebar sort (`videos-sort`), numeric-aware (`localeCompare(..., {numeric:true})`)
  so date/number-stamped OBS filenames order correctly. Distinct from the existing
  "Title" sort (which falls back to filename).
- **Easier-to-click suggested splits** - the energy-valley suggestion pins in the
  split editor went from a 1px line to a 14px transparent hitbox (`.split-suggestion-pin`)
  around the dashed line, and now brighten to the accent color on hover.
- **Timeline zoom** - the main split editor timeline gained zoom in/out/Fit
  controls plus Ctrl/⌘+scroll (zoom-to-cursor), inside a horizontal-scroll
  wrapper. All %-positioned overlay layers scale for free; the waveform canvas
  redraws at the new pixel width (clamped to 16000px). Zoom resets on open.
  +3 UI tests; the M6-4 flex-shrink test now checks the scroll wrapper.
- **Media streaming chunk** 64KB → 1MB (minor throughput help; not the fix for
  multi-hour MKV scrubbing - see the ROADMAP preview-proxy item).

---

## Archived series (full entries in [COMPLETED-archive.md](COMPLETED-archive.md))

- **2026-07 UX review passes** (prompts 2–13 of `UX_REVIEW_PLAN.md`; closed
  2026-07-02) - keyboard/focus/Escape, toast standards, terminology (Recording,
  percentages, `plural()`), header job pill, sidebar, video-detail cards,
  clip-detail cards, New Recording + track layouts, Split Editor, Settings
  panel, Highlight Reels, info/management modals.
- **Server/test infrastructure (2026-07-02)** - video streams outliving their
  viewer (idle-CPU degradation fix) and the UI-suite xdist parallelization
  (7.6 min → 2.8 min).
- **Usage-feedback cleanup batches 1–7 (2026-07-01/02)** - branding/icon,
  analysis lifecycle correctness, progress & estimation, clip-generation
  quality (speech-density filter), user tags, sort/filter/search, SRT sidecar
  downloads, highlight-reel exports + captions, speaker power features.
- **Phase 4 - Packaging + distribution** - Electron wrapper, NSIS installer,
  setup wizard, venv bootstrap, bundled llama.cpp backend, glossary bundling.
- **Feature blocks (2026-06/07)** - notification sounds, pipeline progress +
  run history (Stages 1–2), re-analyze/re-detect speakers, voiceprint
  threshold + name inference, per-speaker colours, bulk clip actions,
  "not yet scored" indicator, split-segment window fix, setup wizard revamp +
  transcription language, 2026-07-01 bug-hunt and full code-quality passes.
- **Phases 1–3** - core pipeline, signal enrichment + scoring, and the full
  Phase 3 web UI feature list.

