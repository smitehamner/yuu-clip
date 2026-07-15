# yuu-clip - Roadmap

Forward-looking only. Everything already shipped is recorded in
[COMPLETED.md](COMPLETED.md) and [COMPLETED-archive.md](COMPLETED-archive.md), and
deliberate scope calls (things we chose not to do, and why) live in
[DECISIONS.md](DECISIONS.md) - this file tracks just the work that is still open,
grouped by priority.

---

## 1 - Verification & known-issue debt

Implemented-but-unverified surfaces and latent traps to close before distribution.

- [ ] **Electron native-file-protocol packaged-app verification** - the packaged app
  serves local media via Electron's native file protocol instead of the Python
  byte-pump (implemented 2026-07-03, roadmap plan 10). It is unticked only because
  the packaged-app verification checklist has never been run - it can't be exercised
  from browser-dev mode.

- [ ] **Retire the prose-regex progress fallback** - the analyze/score pipeline now emits
  a structured `@@PROGRESS` marker (`pipeline/progress.py`) alongside the human
  `console.print` lines, and the web UI drives the job pills off that marker (see the
  sequential-and-honest processing work). The old prose regexes in `jobs.js`
  (`INGEST_STEPS`/`SCORE_STEPS` `patterns`) are kept one release as a fallback - remove
  them once the marker path is proven in real runs. Still open: the `export/` engine
  emits progress via `console.print` only (no marker channel yet); add one if export
  ever needs a structured progress bar or to run in-process.

---

## 2 - Pre-distribution blockers

Wanted before distributing beyond friends/trusted users.

- [ ] **FFmpeg source-hosting once the repo is public** - the GPL-compliance story today
  ships the FFmpeg + libx264 source archives *side-by-side* with each installer. Once the
  yuu-clip GitHub repo goes public, attach the source archives to GitHub Releases as the
  canonical long-term host (in addition to, or instead of, the shipped zip). See
  `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` and `HOW-TO-RELEASE.md § Bundled FFmpeg`.
  Plan (checklist, blocked on repo going public): (internal planning notes).

- [ ] **Enable private vulnerability reporting** (Settings -> Security). `SECURITY.md`
  already points reporters at the "Report a vulnerability" flow, which needs this turned
  on. Verify it is available/enabled once the repo is public.

- [ ] **Confirm branch protection on `main` takes effect once public** - the rule is
  configured but GitHub does not enforce protected-branch rules on a private repo on the
  Free plan; it should start enforcing when the repo goes public. Re-check after flipping.

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

- [ ] **Sidebar grouping for split segments** *(speculative)* - a collapsible parent row
  "session.mkv (3 segments)" with indented children, as an alternative to the flat list.
  Deferred until the flat list proves insufficient in practice.

- [ ] **Score learning loop** *(speculative)* - use accumulated manual score overrides to tune
  the prompt or scoring-weight vector semi-automatically. Requires a meaningful corpus of
  overrides first.

- [ ] **Copyright content detection** *(speculative - no implementation path)* - detect music in
  the audio track that might trigger copyright claims. Requires audio fingerprinting against a
  reference database (AcoustID or similar); needs evaluation of fingerprinting libraries,
  database licensing, and accuracy on gaming audio before it can be scoped.

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
