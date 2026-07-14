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

1. **FFmpeg source-hosting once public** (§2) - short checklist, but blocked
   on the repo going public. Plan: (internal planning notes).
2. **Linux compatibility** (§6) - large; split into a smaller "backend runs
   on Linux" phase and a much larger "packaged Electron app" phase that's
   only worth starting given real user demand. Plan:
   (internal planning notes).
3. **UI localization (i18n)** (§6) - large, and the roadmap already says
   English-only is fine for now; scope captured but deliberately not staged.
   Plan: (internal planning notes).

Not re-ranked (already blocked on something outside this roadmap, or
deliberately deferred/on-hold/shelved - see their entries below for why):
Electron native-file-protocol verification, engine `console.print` design,
code signing (needs a purchased cert), speaker identity beyond one recording
(needs its own scope Q&A), score learning loop (needs a corpus first), copyright
detection (no implementation path), sidebar grouping for split segments,
quality presets, export-time transcript upgrade, AMD/Intel GPU support.

---

## 0 - Positioning note

yuu-clip is at heart a **talk-heavy analyzer** (transcript-driven candidate generation
+ scoring). That is its real sweet spot - RP/VC/podcast/narrative content. The silent,
visual gaming highlight now has a first-pass path too: the video-heavy / quiet-moment
work shipped 2026-07-13 (Visual scoring axis, model-free on-screen-activity detection,
opt-in visual clip generation, textless-clip UX, opt-in vision-LLM descriptions - see
COMPLETED.md). Marketing and onboarding copy should still lead with the talk-heavy
strength honestly rather than claim general "gaming highlights"; the visual support is
a complement, not yet a match for a dedicated gameplay-clip tool.

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

---

## 3 - Speaker & scoring depth

- [ ] **Link a Person to a world-context character** - the companion to the shipped
  project-wide **Person** identity: replace free-text names with a reference to a context
  character (`ProjectVoice.character_id`) to feed "score boost per named character" and
  per-speaker lore into scoring; deferred to avoid coupling naming to the contexts model.
  Plan of record: `plans/speaker-identity/character-linking.md`.

- [ ] **Score learning loop** - use accumulated manual score overrides to tune the prompt or
  scoring-weight vector semi-automatically. Requires a meaningful corpus of overrides first.

- [ ] **Copyright content detection** *(deferred - no implementation path)* - detect music in
  the audio track that might trigger copyright claims. Requires audio fingerprinting against a
  reference database (AcoustID or similar); needs evaluation of fingerprinting libraries,
  database licensing, and accuracy on gaming audio before it can be scoped.

---

## 4 - Frontend polish

- [ ] **Sidebar grouping for split segments** - a collapsible parent row
  "session.mkv (3 segments)" with indented children, as an alternative to the flat list.
  Deferred until the flat list proves insufficient in practice.

---

## 5 - Larger / speculative features

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

---

## 6 - Platform reach

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
    (The wizard GPU-line messaging was corrected 2026-07-10 to report LLM scoring running on
    any-vendor GPUs via Vulkan while transcription stays NVIDIA/CUDA-only.)

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

## Explicitly out of scope

- Shareable clip links / LAN exposure
