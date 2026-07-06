# yuu-clip — Roadmap

Forward-looking only. Everything already shipped is recorded in
[COMPLETED.md](COMPLETED.md) and [COMPLETED-archive.md](COMPLETED-archive.md) —
this file tracks just the work that is still open, grouped by priority.

## Where things stand

| Phase | Description | Status |
|---|---|---|
| 1 | Core pipeline | Done |
| 2 | Signal enrichment + scoring | Done |
| 3 | Web UI | Done |
| 4 | Packaging for distribution | Done |
| 5 | Post-launch polish | Shipped (one packaged-app verification outstanding) |
| 6 | Advanced features | Shipped except copyright detection (deferred) |

The 13-plan `roadmap-close-2026-07` set (voiceprint confirmation, laugh score,
project switcher, multi-session grouping, caption styles, vertical crop, clip
export editor, SpeechBrain diarization, name correction, model selection, image
analysis, content presets, de-RP generalisation) all shipped 2026-07-04/05. The
remaining open work below is what did **not** have a plan in that set.

---

## 1 — Verification & known-issue debt

Implemented-but-unverified surfaces and latent traps to close before distribution.

- [ ] **Electron native-file-protocol packaged-app verification** — the packaged app
  serves local media via Electron's native file protocol instead of the Python
  byte-pump (implemented 2026-07-03, roadmap plan 10). It is unticked only because
  the packaged-app verification checklist has never been run — it can't be exercised
  from browser-dev mode. Steps and expected results live in
  [docs/dev/plans/consolidation-2026-07-05-manual-verification.md](../dev/plans/consolidation-2026-07-05-manual-verification.md).

- [ ] **Analyze pipeline is not idempotent on a no-`--force` re-run** — `transcribe_track`
  (`whisper_runner.py`) always creates a *new* `Transcript`, and `generate_candidates`
  (`segments/windower.py`) always *appends* new `ClipCandidate` rows; neither skips or
  replaces existing output. Nothing duplicates today because the `status == "done"` skip
  in `pipeline.ingest._resolve_existing_video` short-circuits any completed video on re-run.
  It is a latent trap: any future change that loosens that skip (stage-level resume, or
  marking `"done"` only after scoring) would silently duplicate transcripts and clips.
  Proper fix when stage-level resume is wanted: make transcription and clip-generation
  skip-if-already-present (gated on `not force`).

- [ ] **Modal keyboard trap** — Escape closes all open modals simultaneously instead of
  only the topmost one. Fixing properly requires a modal stack so Escape pops one layer
  at a time. Low UX impact for a single-user tool. *(Partially addressed 2026-07-01: the
  confirm modal — the only layer that actually stacks on other modals today — is popped
  alone by Escape; the flat close-all cascade remains for the rest, and the dirty-editor
  modals now confirm before discarding.)*

- [ ] **`--on-warning` theme token** — the "Remote LLM" billing badge still hardcodes
  `color:#1a1a1a` for dark text on `var(--warning)` (grandfathered in
  `tests/test_ui_theme.py`). Introduce an `--on-warning` token defined per theme, with a
  contrast assertion, and drop the literal. Surfaced by the 2026-07-05 guard-rail pass.

- [ ] **Engine still speaks in `console.print` (Rich markup)** — the `pipeline/` and
  `export/` engines emit progress by printing Rich-markup strings to stdout, which the
  web UI streams verbatim over SSE (stdout *is* the progress interface). Left as-is in
  repo-legibility stage 05 (deliberate — "printing is the interface, don't redesign").
  If the engine ever needs to run in-process (no subprocess) or emit structured
  progress, replace the `console.print` calls with a progress-callback/event seam.

---

## 2 — Pre-distribution blockers

Wanted before distributing beyond friends/trusted users.

- [ ] **Distribution licence** — the preview `LICENSE` (all rights reserved, no
  redistribution) is intentionally restrictive. Before any public distribution, decide on
  a looser licence (MIT, GPL-3, source-available, or BSL). Update `LICENSE`,
  `pyproject.toml`, and the About modal.

- [ ] **FFmpeg source-hosting once the repo is public** — the GPL-compliance story today
  ships the FFmpeg + libx264 source archives *side-by-side* with each installer. Once the
  yuu-clip GitHub repo goes public, attach the source archives to GitHub Releases as the
  canonical long-term host (in addition to, or instead of, the shipped zip). See
  `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` and `HOW-TO-RELEASE.md § Bundled FFmpeg`.

- [ ] **Code signing for public distribution** — the installer is unsigned; Windows shows
  a SmartScreen "unknown publisher" warning on first run and some AV tools flag it. Options:
  EV code-signing cert (~$300/yr, immediate SmartScreen trust) or standard OV cert (cheaper,
  builds reputation over time). electron-builder supports both via `CSC_LINK` /
  `CSC_KEY_PASSWORD`; remove the `CSC_IDENTITY_AUTO_DISCOVERY=false` override in
  `build-release.ps1` when a cert is in place.

- [ ] **Project backup / restore** — there is no way today to back up or move a project short
  of manually copying folders. As distribution grows, a corrupted DB or a reinstalled machine
  with no recovery path is a bad first impression. Scope: a "Backup project" action that
  archives the SQLite DB plus configured media roots (source videos excluded by default — too
  large; exports/audio cache included) into a single file, and a "Restore from backup" path in
  the setup wizard. Now unblocked — the Project switcher settled how project directories are
  addressed.

---

## 3 — Speaker & scoring depth

- [ ] **Speaker identity beyond one recording** — the remaining Speaker-naming pieces, both
  weighed but deferred for v1:
  - **Project-wide speaker identity** — promote per-recording Speakers to a project-level
    voice by matching voiceprints across all recordings so a name applies everywhere. Needs a
    merge/split UX, a higher threshold, and voice-drift handling; hook: a nullable
    `global_voice_id` / `ProjectVoice` table.
  - **Link name → world-context character** — replace free-text names with a reference to a
    context character (`Speaker.character_id`) to feed "score boost per named character" and
    per-speaker lore into scoring; deferred to avoid coupling naming to the contexts model.

- [ ] **Score learning loop** — use accumulated manual score overrides to tune the prompt or
  scoring-weight vector semi-automatically. Requires a meaningful corpus of overrides first.

- [ ] **Copyright content detection** *(deferred — no implementation path)* — detect music in
  the audio track that might trigger copyright claims. Requires audio fingerprinting against a
  reference database (AcoustID or similar); needs evaluation of fingerprinting libraries,
  database licensing, and accuracy on gaming audio before it can be scoped.

---

## 4 — Frontend polish

- [ ] **Finish the JS module-scoping refactor** *(partially done 2026-06-29)* — shared mutable
  state is encapsulated in `AppState` and five feature modules are IIFE-scoped. **Remaining:**
  module-scope the deferred `analyze`/`split` modules and their global constants; extract the
  remaining inline `display`-toggling style strings to CSS classes where it won't change
  behavior. See `docs/dev/REVIEW_DECISIONS.md`.

- [ ] **Custom colour-picker component + accent-colour theme variants** — replace the native
  `<input type="color">` (per-speaker caption colours in `speakers.js`) with a shared JS-built
  picker that supports direct hex entry, a recently-used strip, and a user-curated named
  palette. Build it reusable from the start so the accent-colour theme variants below reuse it:
  alternative accent colours (e.g. blue vs the current amber/green) layered on the existing
  Dark / Light / High-contrast themes, since those themes are already pure token swaps. Decide
  palette persistence (localStorage vs per-project DB) as part of the design.

- [ ] **Decompose the large SPA files** *(staged plan, not started)* — `settings.js` (~1436),
  `videos.js` (~1191), and `index.html` (~2057) are each a mini-project to split, not a
  drive-by. Full plan set at
  [`docs/dev/plans/spa-decomposition/INDEX.md`](../dev/plans/spa-decomposition/INDEX.md):
  five risk-ordered stages (settings help-modals/shortcuts → model-catalog → previews/installs
  → videos.js carve → index.html server-side partials, the last a go/no-go). Each split keeps
  the IIFE `Object.assign(window, {...})` export lists intact (guarded by
  `tests/test_ui_globals.py`) and re-runs the full UI suite. Run in a fresh session, one stage
  per commit.

- [ ] **Sidebar grouping for split segments** — a collapsible parent row
  "session.mkv (3 segments)" with indented children, as an alternative to the flat list.
  Deferred until the flat list proves insufficient in practice.

---

## 5 — Larger / speculative features

- [ ] **Clips vs Scenes** — a second candidate type: "Scenes" are longer contextual moments
  (1–5 min, may include pauses and story arc) vs. "clips" (15–90 s punchy bits). Design first:
  separate pipeline? flag on `ClipCandidate`? separate table? separate review UI? Depends on
  transcript editing being stable.

- [ ] **Clip deduplication** — detect and merge near-duplicate clips (the same event captured in
  overlapping windows from different segmentation passes). Design unclear; revisit after
  transcript editing is stable.

- [ ] **Quality presets** *(on hold)* — named compute bundles ("Fast draft" / "Balanced" /
  "Max quality") that pick a matched set of Whisper model, energy mode, scene mode, and scoring
  weights in one choice. Deferred — no clear preset definitions yet.

- [ ] **Export-time transcript upgrade** *(shelved)* — re-run a higher-quality Whisper pass at
  export time so exported captions can use a bigger model without slowing the initial analyze.
  Shelved — the design wasn't fully worked out (unclear interaction with retranscribe and the
  caption sidecars that already exist).

---

## 6 — Platform reach

- [ ] **AMD / Intel GPU support** — evaluate ROCm (AMD) and OpenVINO (Intel) in CTranslate2; the
  wizard already detects both and surfaces informational messages. Accelerated inference needs
  library support that doesn't exist on Windows for these vendors yet.

- [ ] **Linux compatibility** — verify the full pipeline on Linux; audit Windows-only assumptions
  in path handling (`LOCALAPPDATA`/`APPDATA`), `wmic` GPU detection, file pickers, and process
  management. The Electron wrapper is Windows-only; Linux would need a separate packaging path.

- [ ] **UI localization (i18n)** — translate the web UI and setup wizard into other languages.
  Distinct from the shipped *transcription language* setting (what Whisper transcribes).
  Requires externalizing the hardcoded UI strings in `index.html` / the JS modules / `setup.html`
  into a string table first — batch it with any larger frontend rework. English-only is fine
  while the user base is friends/trusted users.

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
