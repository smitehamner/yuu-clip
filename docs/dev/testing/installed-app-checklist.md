# Installed-app release checklist

The single manual QA document, walked against the **packaged Electron build** (not
`yuu-dev serve`). It is a derived view of the use-case catalog
[../USE_CASES.md](../USE_CASES.md) - one row per use case, in catalog order, each linking
back to its `UC-` ID. Automated use cases still get a row here so a human confirms them
once on the real installed app; the packaged-only ones are the point of this document.

Packaged-only surface mechanics (install internals, environment bring-up, the wizard
re-skin, bundled binaries, the native `yuu-media://` protocol, desktop lifecycle, the
update path) are inline step tables directly under their matching UC row - none of these
can be reached from browser-dev mode. The lettered step IDs (A1-E4, H1-I2, plus F1-F3 /
G1-G2 in the final section) are retained from the retired `packaged-app-verification.md`
so older run records keep their meaning.

Run on a **clean machine or VM** (no dev checkout, no Python, no prior install) against a
real installer artifact from `scripts/windows-release/build-release.ps1`. Each row passes
or fails - no partial credit.

**Build under test:** `________`  **Machine (GPU / no GPU):** `________`  **Date:** `________`

**Do not commit a filled-in copy.** Work from an untracked local copy (or `git stash`
your fill-ins before committing anything else) and keep the tracked version of this
file blank - it's a template to check against, not a run log.

**Priority key** (from the catalog): **P0** must pass to ship; **P1** should pass; **P2**
spot-check. If time is short, the P0 rows are the release gate.

---

## How to size a run (read this before walking the whole document)

Walking all 68 items every build costs 2-3 hours of attention and re-checks the same
surfaces release after release. Do that only for a milestone build. The routine gate is
Tier 1 below; Tiers 2 and 3 exist so the rest is skipped on purpose rather than by
fatigue.

**Audience assumption, and it expires:** the **first public release** is the only build
whose entire audience is fresh installs - nobody has a prior version to upgrade from.
That is the whole reason Tier 3 can be parked, and it applies to that build only. From
the **next** release onward the audience is permanently mixed (some upgrade, some install
fresh), so Tier 3 is mandatory from then on. This is not a condition to re-evaluate each
time; it flips once, on the release after the first public one, and stays flipped.

### Tier 1 - every build (about 30 minutes attended)

The subset where a failure is **silent and terminal for a new user** - nobody files a
bug for an app that never opened.

| # | Step | Covers |
|---|------|--------|
| 1 | Install the `.exe` on a clean machine with no system Python; launch it. | A1-A4 |
| 2 | Watch first-run bring-up, then finish the wizard. Default prefetch pulls Whisper + speaker + face-detector + audio-event/laugh with no extra opt-in; the LLM step's "Download recommended model" completes and auto-fills. | B1-B4, C1-C8, F1 |
| 3 | Add a test recording, Analyze, watch it finish, clips appear. | UC-B01, D1-D2 |
| 4 | Approve a clip, export it, play it in the app with captions, scrub it. | UC-B05, D3, E1-E2 |
| 5 | Build a highlight reel from the approved clips. | UC-E03 |
| 6 | Quit while a job is running. Task Manager shows no orphan `python.exe` / `llama-server.exe` / `ffmpeg.exe`. | UC-G03, H5 |

That is every P0 row that applies to a fresh install. Test-recording guidance, including
the default source and its known characteristics, is in
[test-video-matrix.md](test-video-matrix.md).

### Tier 2 - only when the diff touches it

| Trigger | Walk |
|---|---|
| Installer / electron-builder / NSIS config changed | Full A1-A4 plus the uninstall check |
| Setup wizard or the setup schema changed | Full C1-C8 and F1-F3 |
| Export / ffmpeg / preset code changed | Vertical 9:16 preset, caption defaults, Batch Export, the cancel audit |
| Whisper / diarization / speaker code changed | The speaker rows in UC-D02 |
| A dependency was added or bumped | Offline wheelhouse + lock verification, F2/F3 on a slow or absent network |
| Update-check code changed | UC-G04 |
| A migration was added | UC-G05 (see Tier 3 - with no user holding a prior install this only runs against the maintainer's own projects) |

### Tier 3 - parked for the FIRST public release only

Not applicable to that one build, not "skipped". Every row here needs a user who already
has an earlier build installed, and for the first public release nobody does.

**From the second public release onward, this tier is mandatory on every build.** The
audience is mixed from then on - some users upgrade, some install fresh - and the upgrade
half is the half that can lose data. Do not treat this as a judgement call per release.

- UC-G05 library upgrade / schema migration on an existing project.
- I1/I2 update-mode wizard (installing a newer build over an older one).
- G3 CUDA libs surviving an app upgrade.
- The `.gguf` and venv survival check across an install-over.

Note for whoever ships release two: the migration-adoption path is the sharpest edge
here. It runs before `create_all` on every project open, so an upgrade that stamps a DB
at the wrong revision surfaces as a crash later rather than at upgrade time. Walk UC-G05
against a project created by the *previous* release, not a freshly-made one.

### What this gate cannot reduce

The largest remaining release risk is **hardware variance** - whether the bundled Vulkan
`llama-server` falls back to CPU correctly on a machine the maintainer does not own
(D2, G1-G2). Re-walking the gate on the same hardware does not move it. There is also no
crash-report or telemetry path, so a fresh install that dies is invisible. Both point the
same way: make it easy for early users to send a log rather than self-testing further.

---

## Section A - Setup and first run

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-A01](../USE_CASES.md#uc-a01---install-the-packaged-app) | P0 | Installer runs per-user (no UAC), installs under `%LOCALAPPDATA%\Programs\yuu-clip`, creates NO silent desktop shortcut, launches clean. Step detail: A1-A4 below. | [ ] |

#### UC-A01 detail: Install (A1-A4)

| # | Step | Expected |
|---|------|----------|
| A1 | Run the installer `.exe` on a clean machine | Installs without an admin/UAC prompt (per-user NSIS install) |
| A2 | Watch the install-location behavior | Installs under `%LOCALAPPDATA%\Programs\yuu-clip` (per-user), not `Program Files` |
| A3 | Desktop-shortcut behavior | A desktop shortcut is NOT created silently - it is opt-in (checkbox) or absent. A Start-menu shortcut is fine |
| A4 | Launch the app for the first time | Window opens; no unhandled-error dialog |

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-A02](../USE_CASES.md#uc-a02---complete-the-first-run-setup-wizard) | P0 | Env bring-up unpacks (~1 min, progress shown); wizard shows in the app palette + Oxanium; Whisper labels match Settings; GPU line matches the machine; Finish writes `config.json` (text model only). Step detail: B1-B4 and C1-C8 below. | [ ] |

#### UC-A02 detail: First-run environment bring-up (B1-B4)

| # | Step | Expected |
|---|------|----------|
| B1 | First launch unpacks the Python environment | Prebuilt venv unpacks (tar.gz), NOT a live pip install - completes in ~1 min, not ~20 min |
| B2 | Progress is shown during bring-up | A plain-English progress UI is visible; the window is not a frozen blank |
| B3 | Bring-up survives with no network | If offline, base features still come up; only Tier-B model downloads defer (see F1-F3) |
| B4 | Inspect the created data dirs | Config in `%APPDATA%\yuu-clip`; runtime/env under `%LOCALAPPDATA%\yuu-clip`; project dir defaults under `Videos\yuu-clip` (or the wizard's chosen folder) |

#### UC-A02 detail: Setup wizard re-skin (C1-C8)

The WS-F owner-side visual verify folded into WS-I: the re-skinned wizard was never
eyeballed live (pytest cannot drive the pre-server Electron surface). Watch it here.

| # | Step | Expected |
|---|------|----------|
| C1 | Wizard appears on first run | Setup wizard shows (first-run branch of `decideSetupMode`) |
| C2 | Look at the palette / typography | Wizard renders in the APP's palette (shared `tokens.css`) and Oxanium header - it looks and reads like the app, not a stock white form |
| C3 | Check section order | Required -> Basics (project folder) -> LLM scoring -> Content type -> Optional (WS-A reorder) |
| C4 | LLM-setup radio copy | "Set up local AI (Recommended)" discloses the one-time download size (~5 GB) at the decision point, without opening Advanced |
| C5 | Whisper model dropdown | Options + their size/VRAM strings come from the shared catalog (match Settings exactly); no stale hand-typed labels |
| C6 | GPU line messaging | States LLM scoring runs on any-vendor GPU via Vulkan while Whisper transcription is NVIDIA/CUDA-only; matches the machine (GPU vs no GPU) |
| C7 | Finish the wizard | Writes `config.json` (text model only, never `llm_vision_model_path`); app proceeds to the main UI |
| C8 | Contrast / readability | No unreadable low-contrast text in either theme; WCAG-AA pairings hold (mirrors `test_wizard_theme`) |

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-A03](../USE_CASES.md#uc-a03---create-open-and-switch-projects) | P1 | First-run empty state reads correctly; switch project via the top-left switcher reloads without a restart; switch blocked while a job runs; a new folder starts empty. | [ ] |

## Section B - Core loop: analyze, review, export

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-B01](../USE_CASES.md#uc-b01---analyze-a-recording) | P0 | Analyze a real recording end to end: inspection + estimate; step pills advance with real progress; sidebar entry appears live and survives a refresh; second analyze blocked; clips listed on completion. Bundled FFmpeg + `llama-server` used - step detail: D1-D3 below. | [ ] |

#### UC-B01 detail: Bundled binaries resolve, no system installs (D1-D3)

| # | Step | Expected |
|---|------|----------|
| D1 | Run an analyze on a real recording | Bundled FFmpeg is used - extract/transcode works with NO system ffmpeg on PATH |
| D2 | LLM scoring during analyze | Bundled `llama-server` (Vulkan + CPU) starts and scores; on a GPU machine it uses the GPU, on a GPU-less machine it falls back to CPU without erroring |
| D3 | Export a clip | Export renders (cut + captions) using bundled FFmpeg; output file plays |

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-B02](../USE_CASES.md#uc-b02---orient-to-the-results) | P2 | Clip cards show five score icons + SCENE badge; sort and All/Clips/Scenes + status chips work; preference remembered. | [ ] |
| [UC-B03](../USE_CASES.md#uc-b03---review-clips-with-the-keyboard) | P2 | `A`/`R` set status; arrows/`J`/`K` navigate; `Ctrl+Z` undo within 5 s (not after 6 s); `?` opens controls. | [ ] |
| [UC-B04](../USE_CASES.md#uc-b04---inspect-a-clip-in-detail) | P2 | One-liner, long description, score bars, tags, transcript; unscored shows "Not yet scored"; silent clip shows the no-dialogue note. | [ ] |
| [UC-B05](../USE_CASES.md#uc-b05---export-a-clip-and-play-it) | P0 | `E` exports a real MKV + SRT to `.yuu-clip/exports/`; player plays it via `yuu-media://` and shows captions; seek/scrub works; out-of-project path refused. Step detail: E1-E4 below. | [ ] |

#### UC-B05 detail: Native media protocol (E1-E4)

The packaged app serves local video via Electron's `yuu-media://` protocol instead of
the Python byte-pump. This path does not exist in browser-dev mode.

| # | Step | Expected |
|---|------|----------|
| E1 | Open a clip that has an exported media file | Video loads and plays in the clip detail panel |
| E2 | Seek/scrub the video | Seeking works (HTTP Range -> 206 partial content via `rangeResponseInit`) |
| E3 | Play a clip whose source is outside the project dir | Only in-project paths serve; a path-traversal attempt is refused (`isPathInside`) |
| E4 | Highlight reel / summary media playback | Any other in-app media surface plays through the same protocol |

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-B06](../USE_CASES.md#uc-b06---bulk-review-and-export) | P1 | Bulk toolbar acts only on checked + visible clips; bulk delete confirms; bulk export warns on stale captions; bulk undo reverts each to its own prior status. | [ ] |

## Section C - Editing a clip

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-C01](../USE_CASES.md#uc-c01---edit-a-clip-description) | P2 | Inline-edit the one-liner/long description; saves and persists across reload; user edit kept separate from a later LLM regen. | [ ] |
| [UC-C02](../USE_CASES.md#uc-c02---trim-a-clip-then-export) | P1 | Edit & export: trim changes output duration; `trim_edited_at` set; stale badge flips; exported file matches the trimmed range. | [ ] |
| [UC-C03](../USE_CASES.md#uc-c03---edit-captions-then-re-export) | P1 | Caption edit rebuilds overlapping-clip excerpts + shows the re-score notice; re-export refreshes the SRT with the corrected text. | [ ] |
| [UC-C04](../USE_CASES.md#uc-c04---split-a-recording-then-export-from-a-segment) | P1 | Split only redistributes clips/transcript by start time; destructive choices confirm first; segment-relative timing survives export; Undo Split restores the parent with absolute timing. | [ ] |
| [UC-C05](../USE_CASES.md#uc-c05---merge-duplicate-or-adjacent-clips-then-export) | P1 | Check duplicates flags overlaps; merge clears the flag + resets export metadata; merged range exports as one file. | [ ] |
| [UC-C06](../USE_CASES.md#uc-c06---create-a-clip-or-scene-by-hand) | P2 | Manual picker creates a clip/scene from transcript lines or time inputs; it is scored immediately; a longer range saves as a Scene. | [ ] |

## Section D - Transcription and speakers

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-D01](../USE_CASES.md#uc-d01---retranscribe-captions-refresh) | P2 | Retranscribe (clip/recording) with a chosen model refreshes the excerpt + SRT; recording-level flags clips for re-score; speaker labels reused. | [ ] |
| [UC-D02](../USE_CASES.md#uc-d02---diarize-name-speakers-export-with-captions) | P1 | Name speakers + colors; rename a speaker inline by clicking its name label in the transcript; Suggest names accept/dismiss; Fix names applies only on Apply (marks overlaps for re-score); borderline voice match stays unnamed until confirmed; Promote to Person flows a rename to every recording; export carries names into captions. | [ ] |

## Section E - Aggregate views

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-E01](../USE_CASES.md#uc-e01---generate-a-video-summary) | P2 | Generate Summary streams a title + paragraph; inline edit saves and survives reload. | [ ] |
| [UC-E02](../USE_CASES.md#uc-e02---session-timeline-and-multi-recording-sessions) | P2 | Timeline markers map to clips; group 2+ recordings into a Session; Session Summary + Unified Timeline with break labels; ungroup detaches without deleting. | [ ] |
| [UC-E03](../USE_CASES.md#uc-e03---build-a-highlight-reel-and-reel-staleness) | P1 | Build a reel end to end (source/transition/captions/order); unexported clips offered for export first; reel lands in `.yuu-clip/reels/`; re-exporting a member flips the stale flag. | [ ] |

## Section F - Context, configuration, and vision

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-F01](../USE_CASES.md#uc-f01---world-contexts-create-assign-re-score-and-characters) | P1 | Create a context (+ optional Character); assign it; staleness warning shows; re-score (LLM only vs Full) injects it; a linked person's boost applies only where they speak AND the recording is tagged with that character's context (a different context's alias for the same person does not leak in). | [ ] |
| [UC-F02](../USE_CASES.md#uc-f02---track-layouts-create-edit-delete) | P2 | Create/edit/delete a track layout (delete confirms); a new layout is selectable in the analyze dropdown. | [ ] |
| [UC-F03](../USE_CASES.md#uc-f03---scoring-configuration-content-presets-weights-hot-words-sensitive-terms) | P2 | Apply a content preset (confirm dialog spells out the change); Exact hot-word auto-applies + Meaning via Scan; sensitive term rescans instantly and only warns (Flagged chip). | [ ] |
| [UC-F04](../USE_CASES.md#uc-f04---vertical--shorts-export-with-auto-framing) | P1 | 9:16 preset exports 1080x1920; framing choice saved on the clip; narrower sources letterboxed; Auto-frame suggests a crop you confirm. | [ ] |
| [UC-F05](../USE_CASES.md#uc-f05---vision-whats-on-screen-image-analysis) | P2 | Analyze frames (1-10) lands the "What's on screen" card on the right clip after navigating away; never auto-runs during analysis. | [ ] |

## Section G - Housekeeping and desktop lifecycle

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-G01](../USE_CASES.md#uc-g01---back-up-and-restore-a-project) | P1 | Back up downloads a small `.zip` (no source videos/exports/proxies); restore into a folder rebuilds the project; moved-source relink lets clips play; blank folders stay marked missing. | [ ] |
| [UC-G02](../USE_CASES.md#uc-g02---confirmations-log-download-status-notification-sounds) | P2 | Delete/cancel use the in-app modal; Download Log is non-empty + username-redacted; opted-in notification sound fires on completion. | [ ] |
| [UC-G03](../USE_CASES.md#uc-g03---desktop-shell-lifecycle-packaged) | P0 | Re-run Setup Wizard preserves config; Reveal-in-folder opens Explorer; quit leaves NO orphan `python.exe` / `llama-server.exe` / `ffmpeg.exe` (Task Manager); clean relaunch skips the wizard; schema-advancing update opens the wizard in `update` mode. Step detail: H1-H6 and I1-I2 below. | [ ] |

#### UC-G03 detail: Desktop-shell lifecycle (H1-H6)

| # | Step | Expected |
|---|------|----------|
| H1 | Hamburger menu in the packaged app | Includes "Re-run Setup Wizard" (packaged-only entry) alongside the shared items |
| H2 | Re-run Setup Wizard | Wizard reopens in a re-run flow; existing config is preserved unless changed |
| H3 | Reveal-in-folder on an export | Opens the OS file explorer at the file (Windows) |
| H4 | Download Log from the menu | A non-empty log file downloads |
| H5 | Quit while a job is running (incl. mid preview-generation) | App confirms / cancels cleanly; no orphaned `python.exe` / `llama-server.exe` / `ffmpeg.exe` left behind (the quit path tree-kills the backend so its ffmpeg children die too) (check Task Manager) |
| H6 | Relaunch after a clean quit | Opens straight to the main UI (no wizard - not first-run) |

#### UC-G03 detail: Update path (I1-I2)

| # | Step | Expected |
|---|------|----------|
| I1 | Install a newer build over an older one where the setup schema advanced | Wizard opens in `update` mode (not `initial`), preserving the project/config |
| I2 | Normal version bump, same schema | No wizard; straight to the app |

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-G04](../USE_CASES.md#uc-g04---check-for-available-updates) | P2 | Update banner/status show a newer release with a working link; nothing downloads/installs automatically; turning the toggle off stops the launch check but not the manual button; offline shows a plain failure message. | [ ] |
| [UC-G05](../USE_CASES.md#uc-g05---library-upgrades-cleanly-on-an-app-update-schema-migration--backup) | P0 | Open a project made by the prior release after updating; library opens with all data intact; a `project.db.pre-migration-<timestamp>.bak` appears in `.yuu-clip/`; a broken upgrade refuses to serve with a clear message and keeps the backup (forward-only, no downgrade). | [ ] |
| [UC-G06](../USE_CASES.md#uc-g06---loopback-only-by-default-warned-before-exposing-to-the-network) | P1 | Default bind is `127.0.0.1` and works; `yuu-dev serve --host 0.0.0.0` prints a loud "NO password" network-exposure warning; the app rejects cross-site / non-loopback-Host browser requests (403) while the desktop shell and CLI keep working. | [ ] |

## Packaged mechanics with no single use case

These two step groups cut across several use cases (wizard, Settings, first feature
use), so they keep their own tables rather than sitting under one UC row. Walk them
during the same run.

#### Tier-B model downloads, framed and graceful (F1-F3)

| # | Step | Expected |
|---|------|----------|
| F1 | Trigger the local LLM download (wizard or Settings) | Progress UI with a "downloading X so Y works" message; not a bare button |
| F2 | Auto-fetched feature models (speaker/laugh/similarity) on first use | Download with progress, then the feature runs |
| F3 | Go offline mid-app | Features that need an un-fetched model wait or skip with a clear message; the app never hard-breaks |

#### Tier-C GPU opt-in, Whisper CUDA (G1-G2)

| # | Step | Expected |
|---|------|----------|
| G1 | On an NVIDIA machine, the wizard "cuda-libs" opt-in | Selecting it fetches the CUDA libs; Whisper then runs on GPU |
| G2 | On a non-NVIDIA / no-GPU machine | Whisper stays on CPU; no crash, no dangling CUDA prompt |
| G3 | Install a newer build over one that had cuda-libs enabled | The venv-setup window shows "Restoring GPU acceleration for transcription..."; the Setup Warnings chip stays clear afterward (the opt-in libs are reinstalled into the fresh venv, not silently wiped). Offline: falls back to the chip's one-click reinstall rather than blocking launch |

---

## Dev-only appendix (not part of the installed-app run)

These were in the old dev-server checklist and have no packaged-app equivalent - they
belong to browser-dev mode (`yuu-dev serve`), kept here only so the coverage is not lost:

- Raw `GET /api/status` polling (idle vs during a job) - a dev/API check; the user-facing
  behavior it guards is covered functionally by UC-G02 and the job-blocking check in UC-B01.
- Console-error watch on page load - a dev check; run it in browser-dev mode during
  development, not during the installed-app sign-off.
