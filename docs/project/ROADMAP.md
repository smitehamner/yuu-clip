# yuu-clip - Roadmap

Forward-looking only. Everything already shipped is recorded in
[COMPLETED.md](COMPLETED.md) and [COMPLETED-archive.md](COMPLETED-archive.md) -
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

## Recommended working order (2026-07-07)

The sections below (§1-§6) group items **by theme**, not by priority - this
list gives the actual recommended sequence. Items with a staged implementation
plan link to it; items still needing a scope decision or blocked on something
external say so instead. Full detail/rationale for each is kept in
internal planning notes (not part of this repo).

1. ~~**Colour-picker component + accent-colour themes** (§4)~~ - **done
   2026-07-09** (see COMPLETED.md).
2. **Clips vs Scenes** (§5) - now unblocked but needs a scope Q&A session
   before staging (storage design has wide blast radius). Plan (captured, not
   staged): (internal planning notes).
3. **FFmpeg source-hosting once public** (§2) - short checklist, but blocked
   on the repo going public. Plan: (internal planning notes).
4. **Linux compatibility** (§6) - large; split into a smaller "backend runs
   on Linux" phase and a much larger "packaged Electron app" phase that's
   only worth starting given real user demand. Plan:
   (internal planning notes).
5. **UI localization (i18n)** (§6) - large, and the roadmap already says
   English-only is fine for now; scope captured but deliberately not staged.
   Plan: (internal planning notes).

(Done 2026-07-07: **analyze pipeline idempotency** - the reachable `--force`
`Transcript`-duplication bug is fixed. Done 2026-07-09: **distribution licence**
- Apache-2.0 chosen and rolled out; **JS module-scoping refactor** -
`analyze.js`/`split.js` IIFE-wrapped; **clip deduplication** - overlap scan +
one-click merge. See COMPLETED.md.)

Not re-ranked (already blocked on something outside this roadmap, or
deliberately deferred/on-hold/shelved - see their entries below for why):
Electron native-file-protocol verification, engine `console.print` design,
code signing (needs a purchased cert), video-heavy/quiet-moment analysis
(needs its own scope Q&A), speaker identity beyond one recording (needs its
own scope Q&A), score learning loop (needs a corpus first), copyright
detection (no implementation path), sidebar grouping for split segments,
quality presets, export-time transcript upgrade, AMD/Intel GPU support.

---

## 0 - Positioning note

Context for §3: yuu-clip today is a **talk-heavy
analyzer** (transcript-driven candidate generation + scoring). That is its real sweet
spot - RP/VC/podcast/narrative content - and it is a weakness for silent, visual
gaming highlights. Marketing and onboarding copy should lean into the talk-heavy
strength honestly rather than claim general "gaming highlights"; the visual case is
tracked in §3 below.

---

## 1 - Verification & known-issue debt

Implemented-but-unverified surfaces and latent traps to close before distribution.

- [ ] **Electron native-file-protocol packaged-app verification** - the packaged app
  serves local media via Electron's native file protocol instead of the Python
  byte-pump (implemented 2026-07-03, roadmap plan 10). It is unticked only because
  the packaged-app verification checklist has never been run - it can't be exercised
  from browser-dev mode.

- [ ] **Engine still speaks in `console.print` (Rich markup)** - the `pipeline/` and
  `export/` engines emit progress by printing Rich-markup strings to stdout, which the
  web UI streams verbatim over SSE (stdout *is* the progress interface). Left as-is in
  repo-legibility stage 05 (deliberate - "printing is the interface, don't redesign").
  If the engine ever needs to run in-process (no subprocess) or emit structured
  progress, replace the `console.print` calls with a progress-callback/event seam.

---

## 2 - Pre-distribution blockers

Wanted before distributing beyond friends/trusted users.

- [x] **Distribution licence** - chose **Apache-2.0** (2026-07-08). `LICENSE` now carries
  the full Apache-2.0 text, `pyproject.toml` declares `license = {text = "Apache-2.0"}`,
  and the About modal reflects it. Replaced the old preview "all rights reserved,
  no redistribution" text. Plan: (internal planning notes).

- [ ] **FFmpeg source-hosting once the repo is public** - the GPL-compliance story today
  ships the FFmpeg + libx264 source archives *side-by-side* with each installer. Once the
  yuu-clip GitHub repo goes public, attach the source archives to GitHub Releases as the
  canonical long-term host (in addition to, or instead of, the shipped zip). See
  `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` and `HOW-TO-RELEASE.md § Bundled FFmpeg`.
  Plan (checklist, blocked on repo going public): (internal planning notes).

- [ ] **Code signing for public distribution** - the installer is unsigned; Windows shows
  a SmartScreen "unknown publisher" warning on first run and some AV tools flag it. Options:
  EV code-signing cert (~$300/yr, immediate SmartScreen trust) or standard OV cert (cheaper,
  builds reputation over time). electron-builder supports both via `CSC_LINK` /
  `CSC_KEY_PASSWORD`; remove the `CSC_IDENTITY_AUTO_DISCOVERY=false` override in
  `build-release.ps1` when a cert is in place.

- [x] **Project backup / restore** - Settings > Backup & Restore backs a project's own state
  (SQLite DB, config, world contexts, custom sounds) into a single portable `.zip`; large
  regenerable media (audio/exports/proxies/downloads/reels/preview_cache) and the source videos
  are excluded. Restore is available both in-app and as a first-run wizard choice, and re-points
  source-video folders that don't resolve on the target machine so restored clips still play.
  Shipped 2026-07-07 (in-app + wizard + re-point engine); the wizard's manual first-run gate is
  the only unautomated check.

---

## 3 - Speaker & scoring depth

- [ ] **Video-heavy / quiet-moment analysis** *(captured - needs a scope Q&A session)* -
  candidate generation (`segments/windower.py`, silence-gap based) and scoring are both
  transcript-driven, so silent/visual gaming highlights never become candidates and
  score low. Extend toward the quiet, visual case without breaking the talk-heavy core,
  reusing existing seams (PySceneDetect content cuts, frame extraction, the `ScoreResult`
  scorer protocol, opt-in vision-LLM).

- [ ] **Speaker identity beyond one recording** - the remaining Speaker-naming pieces, both
  weighed but deferred for v1:
  - **Project-wide speaker identity** - promote per-recording Speakers to a project-level
    voice by matching voiceprints across all recordings so a name applies everywhere. Needs a
    merge/split UX, a higher threshold, and voice-drift handling; hook: a nullable
    `global_voice_id` / `ProjectVoice` table.
  - **Link name → world-context character** - replace free-text names with a reference to a
    context character (`Speaker.character_id`) to feed "score boost per named character" and
    per-speaker lore into scoring; deferred to avoid coupling naming to the contexts model.

- [ ] **Score learning loop** - use accumulated manual score overrides to tune the prompt or
  scoring-weight vector semi-automatically. Requires a meaningful corpus of overrides first.

- [ ] **Copyright content detection** *(deferred - no implementation path)* - detect music in
  the audio track that might trigger copyright claims. Requires audio fingerprinting against a
  reference database (AcoustID or similar); needs evaluation of fingerprinting libraries,
  database licensing, and accuracy on gaming audio before it can be scoped.

---

## 4 - Frontend polish

- [ ] **Finish the JS module-scoping refactor** *(partially done 2026-06-29)* - shared mutable
  state is encapsulated in `AppState` and five feature modules are IIFE-scoped. **Remaining:**
  module-scope the deferred `analyze`/`split` modules and their global constants. The
  "extract inline `display`-toggling style strings to CSS classes" half was reviewed and
  rejected (`REVIEW_DECISIONS.md` 2026-06-29 - would change JS/CSS override behavior) - not
  part of the remaining work. Plan (staged, ready to implement, per-variable design decision
  already made): (internal planning notes).

- [x] **Custom colour-picker component + accent-colour theme variants** (done 2026-07-09) -
  shipped the shared `colorpicker.js` (hex entry, recently-used strip, user-curated named
  palette; localStorage persistence) replacing the native `<input type="color">` at all three
  sites, plus a Blue accent variant layered on the three themes via an orthogonal `data-accent`
  attribute and a `#s-accent` select, contrast-verified across the full (theme, accent) matrix.
  See COMPLETED.md.

- [ ] **Sidebar grouping for split segments** - a collapsible parent row
  "session.mkv (3 segments)" with indented children, as an alternative to the flat list.
  Deferred until the flat list proves insufficient in practice.

---

## 5 - Larger / speculative features

- [ ] **Clips vs Scenes** - a second candidate type: "Scenes" are longer contextual moments
  (1–5 min, may include pauses and story arc) vs. "clips" (15–90 s punchy bits). Design first:
  separate pipeline? flag on `ClipCandidate`? separate table? separate review UI?
  Transcript editing is now stable (dependency satisfied) but this still needs its own
  scope Q&A before staging. Plan (captured, not staged): (internal planning notes).

- [x] **Clip deduplication** - detect and merge near-duplicate clips (the same event captured in
  overlapping windows from different segmentation passes), surfaced via the existing
  `merge_clips` route. Shipped 2026-07-09 (`scoring/dedup.py` + `POST /api/videos/{id}/scan-duplicates`
  + review-UI badge/filter/merge notice). See COMPLETED.md.

- [ ] **Quality presets** *(on hold)* - named compute bundles ("Fast draft" / "Balanced" /
  "Max quality") that pick a matched set of Whisper model, energy mode, scene mode, and scoring
  weights in one choice. Deferred - no clear preset definitions yet.

- [ ] **Export-time transcript upgrade** *(shelved)* - re-run a higher-quality Whisper pass at
  export time so exported captions can use a bigger model without slowing the initial analyze.
  Shelved - the design wasn't fully worked out (unclear interaction with retranscribe and the
  caption sidecars that already exist).

---

## 6 - Platform reach

- [ ] **AMD / Intel GPU support** - evaluate ROCm (AMD) and OpenVINO (Intel) in CTranslate2; the
  wizard already detects both and surfaces informational messages. Accelerated inference needs
  library support that doesn't exist on Windows for these vendors yet.

- [ ] **Linux compatibility** - verify the full pipeline on Linux; audit Windows-only assumptions
  in path handling (`LOCALAPPDATA`/`APPDATA`), GPU detection, file pickers, and process
  management. The Electron wrapper is Windows-only; Linux would need a separate packaging path.
  Full inventory done - larger than it looks (real gaps in process-tree kill on cancel, the
  reveal-in-folder feature, and the entire packaging pipeline). Plan (phased - backend-only
  vs. full packaged app): (internal planning notes).

- [ ] **UI localization (i18n)** - translate the web UI and setup wizard into other languages.
  Distinct from the shipped *transcription language* setting (what Whisper transcribes).
  Requires externalizing the hardcoded UI strings in `index.html` / the JS modules / `setup.html`
  into a string table first - batch it with any larger frontend rework. English-only is fine
  while the user base is friends/trusted users. Scope captured (no existing i18n infra found,
  ~16k lines of JS + 2k-line HTML shell to externalize) but deliberately not staged given the
  low current priority: (internal planning notes).

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
