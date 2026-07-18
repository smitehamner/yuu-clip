# Packaged-app verification checklist

The surfaces that ONLY the packaged Electron installer exercises - none of these can
be reached from `yuu-dev serve` / browser-dev mode, which is why they are tracked
separately from `manual-regression.md` (that one covers in-app functional behavior and
should also be run against the packaged build once it is up).

Run this on a **clean machine or VM** (no dev checkout, no Python, no prior yuu-clip
install) against a real installer artifact from
`.\scripts\windows-release\build-release.ps1`. Each row passes or fails - no partial
credit. Record the build version and the machine (GPU / no GPU) at the top of the run.

**Build under test:** `________`  **Machine:** `________`  **Date:** `________`

---

## A. Install

| # | Step | Expected |
|---|------|----------|
| A1 | Run the installer `.exe` on a clean machine | Installs without an admin/UAC prompt (per-user NSIS install) |
| A2 | Watch the install-location behavior | Installs under `%LOCALAPPDATA%\Programs\yuu-clip` (per-user), not `Program Files` |
| A3 | Desktop-shortcut behavior | A desktop shortcut is NOT created silently - it is opt-in (checkbox) or absent. A Start-menu shortcut is fine |
| A4 | Launch the app for the first time | Window opens; no unhandled-error dialog |

## B. First-run environment bring-up

| # | Step | Expected |
|---|------|----------|
| B1 | First launch unpacks the Python environment | Prebuilt venv unpacks (tar.gz), NOT a live pip install - completes in ~1 min, not ~20 min |
| B2 | Progress is shown during bring-up | A plain-English progress UI is visible; the window is not a frozen blank |
| B3 | Bring-up survives with no network | If offline, base features still come up; only Tier-B model downloads defer (see F) |
| B4 | Inspect the created data dirs | Config in `%APPDATA%\yuu-clip`; runtime/env under `%LOCALAPPDATA%\yuu-clip`; project dir defaults under `Videos\yuu-clip` (or the wizard's chosen folder) |

## C. Setup wizard (first-run) - WS-F re-skin visual verify

This is the WS-F owner-side item folded into WS-I: the re-skinned wizard was never
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

## D. Bundled binaries resolve (no system installs)

| # | Step | Expected |
|---|------|----------|
| D1 | Run an analyze on a real recording | Bundled FFmpeg is used - extract/transcode works with NO system ffmpeg on PATH |
| D2 | LLM scoring during analyze | Bundled `llama-server` (Vulkan + CPU) starts and scores; on a GPU machine it uses the GPU, on a GPU-less machine it falls back to CPU without erroring |
| D3 | Export a clip | Export renders (cut + captions) using bundled FFmpeg; output file plays |

## E. Native media protocol (`yuu-media://`) - the headline unverified surface

The packaged app serves local video via Electron's `yuu-media://` protocol instead of
the Python byte-pump (ROADMAP item 1). This path does not exist in browser-dev mode.

| # | Step | Expected |
|---|------|----------|
| E1 | Open a clip that has an exported media file | Video loads and plays in the clip detail panel |
| E2 | Seek/scrub the video | Seeking works (HTTP Range -> 206 partial content via `rangeResponseInit`) |
| E3 | Play a clip whose source is outside the project dir | Only in-project paths serve; a path-traversal attempt is refused (`isPathInside`) |
| E4 | Highlight reel / summary media playback | Any other in-app media surface plays through the same protocol |

## F. Tier-B model downloads (framed, graceful)

| # | Step | Expected |
|---|------|----------|
| F1 | Trigger the local LLM download (wizard or Settings) | Progress UI with a "downloading X so Y works" message; not a bare button |
| F2 | Auto-fetched feature models (speaker/laugh/similarity) on first use | Download with progress, then the feature runs |
| F3 | Go offline mid-app | Features that need an un-fetched model wait or skip with a clear message; the app never hard-breaks |

## G. Tier-C GPU opt-in (Whisper CUDA)

| # | Step | Expected |
|---|------|----------|
| G1 | On an NVIDIA machine, the wizard "cuda-libs" opt-in | Selecting it fetches the CUDA libs; Whisper then runs on GPU |
| G2 | On a non-NVIDIA / no-GPU machine | Whisper stays on CPU; no crash, no dangling CUDA prompt |

## H. Desktop-shell lifecycle

| # | Step | Expected |
|---|------|----------|
| H1 | Hamburger menu in the packaged app | Includes "Re-run Setup Wizard" (packaged-only entry) alongside the shared items |
| H2 | Re-run Setup Wizard | Wizard reopens in a re-run flow; existing config is preserved unless changed |
| H3 | Reveal-in-folder on an export | Opens the OS file explorer at the file (Windows) |
| H4 | Download Log from the menu | A non-empty log file downloads |
| H5 | Quit while a job is running | App confirms / cancels cleanly; no orphaned `python.exe` / `llama-server.exe` left behind (check Task Manager) |
| H6 | Relaunch after a clean quit | Opens straight to the main UI (no wizard - not first-run) |

## I. Update path

| # | Step | Expected |
|---|------|----------|
| I1 | Install a newer build over an older one where the setup schema advanced | Wizard opens in `update` mode (not `initial`), preserving the project/config |
| I2 | Normal version bump, same schema | No wizard; straight to the app |

---

## Known drift to fix in `manual-regression.md` before running it packaged

`manual-regression.md` predates the four-axis + Clips/Scenes work and is stale in a few
rows (surfaced during WS-I, not yet fixed there):

- Row 14 / 22 list score icons as `star / funny / dramatic / action` only - missing the
  **Visual** axis (glyph 🎬). Should read four axes.
- No coverage of the merged **Clips + Scenes** sidebar (SCENE badge, All/Clips/Scenes
  kind chips, per-kind counts) added in WS-D.

Fold these into `manual-regression.md` when it is next revised so the packaged run
checks the current UI.
