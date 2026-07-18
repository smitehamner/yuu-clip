# Installed-app release checklist

The manual release sign-off, walked against the **packaged Electron build** (not
`yuu-dev serve`). It is a derived view of the use-case catalog
[../USE_CASES.md](../USE_CASES.md) - one row per use case, in catalog order, each linking
back to its `UC-` ID. Automated use cases still get a row here so a human confirms them
once on the real installed app; the packaged-only ones are the point of this document.

Run on a **clean machine or VM** (no dev checkout, no Python, no prior install) against a
real installer artifact from `scripts/windows-release/build-release.ps1`. Each row passes
or fails - no partial credit.

Deep packaged-only surface mechanics (install internals, environment bring-up, native
`yuu-media://` protocol, model-download framing, CUDA opt-in) are checked in detail by
[packaged-app-verification.md](packaged-app-verification.md); this checklist references
those sections rather than duplicating them, and focuses on the end-to-end user flows.

**Build under test:** `________`  **Machine (GPU / no GPU):** `________`  **Date:** `________`

**Priority key** (from the catalog): **P0** must pass to ship; **P1** should pass; **P2**
spot-check. If time is short, the P0 rows are the release gate.

---

## Section A - Setup and first run

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-A01](../USE_CASES.md#uc-a01---install-the-packaged-app) | P0 | Installer runs per-user (no UAC), installs under `%LOCALAPPDATA%\Programs\yuu-clip`, creates NO silent desktop shortcut, launches clean. See packaged-app-verification.md section A. | [ ] |
| [UC-A02](../USE_CASES.md#uc-a02---complete-the-first-run-setup-wizard) | P0 | Env bring-up unpacks (~1 min, progress shown); wizard shows in the app palette + Oxanium; Whisper labels match Settings; GPU line matches the machine; Finish writes `config.json` (text model only). See packaged-app-verification.md sections B and C. | [ ] |
| [UC-A03](../USE_CASES.md#uc-a03---create-open-and-switch-projects) | P1 | First-run empty state reads correctly; switch project via the top-left switcher reloads without a restart; switch blocked while a job runs; a new folder starts empty. | [ ] |

## Section B - Core loop: analyze, review, export

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-B01](../USE_CASES.md#uc-b01---analyze-a-recording) | P0 | Analyze a real recording end to end: inspection + estimate; step pills advance with real progress; sidebar entry appears live and survives a refresh; second analyze blocked; clips listed on completion. Bundled FFmpeg + `llama-server` used (packaged-app-verification.md section D). | [ ] |
| [UC-B02](../USE_CASES.md#uc-b02---orient-to-the-results) | P2 | Clip cards show five score icons + SCENE badge; sort and All/Clips/Scenes + status chips work; preference remembered. | [ ] |
| [UC-B03](../USE_CASES.md#uc-b03---review-clips-with-the-keyboard) | P2 | `A`/`R` set status; arrows/`J`/`K` navigate; `Ctrl+Z` undo within 5 s (not after 6 s); `?` opens controls. | [ ] |
| [UC-B04](../USE_CASES.md#uc-b04---inspect-a-clip-in-detail) | P2 | One-liner, long description, score bars, tags, transcript; unscored shows "Not yet scored"; silent clip shows the no-dialogue note. | [ ] |
| [UC-B05](../USE_CASES.md#uc-b05---export-a-clip-and-play-it) | P0 | `E` exports a real MKV + SRT to `.yuu-clip/exports/`; player plays it via `yuu-media://` and shows captions; seek/scrub works; out-of-project path refused. See packaged-app-verification.md section E. | [ ] |
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
| [UC-D02](../USE_CASES.md#uc-d02---diarize-name-speakers-export-with-captions) | P1 | Name speakers + colors; Suggest names accept/dismiss; Fix names applies only on Apply (marks overlaps for re-score); borderline voice match stays unnamed until confirmed; Promote to Person flows a rename to every recording; export carries names into captions. | [ ] |

## Section E - Aggregate views

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-E01](../USE_CASES.md#uc-e01---generate-a-video-summary) | P2 | Generate Summary streams a title + paragraph; inline edit saves and survives reload. | [ ] |
| [UC-E02](../USE_CASES.md#uc-e02---session-timeline-and-multi-recording-sessions) | P2 | Timeline markers map to clips; group 2+ recordings into a Session; Session Summary + Unified Timeline with break labels; ungroup detaches without deleting. | [ ] |
| [UC-E03](../USE_CASES.md#uc-e03---build-a-highlight-reel-and-reel-staleness) | P1 | Build a reel end to end (source/transition/captions/order); unexported clips offered for export first; reel lands in `.yuu-clip/reels/`; re-exporting a member flips the stale flag. | [ ] |

## Section F - Context, configuration, and vision

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-F01](../USE_CASES.md#uc-f01---world-contexts-create-assign-re-score-and-characters) | P1 | Create a context (+ optional Character); assign it; staleness warning shows; re-score (LLM only vs Full) injects it; a linked person's boost applies only where they speak. | [ ] |
| [UC-F02](../USE_CASES.md#uc-f02---track-layouts-create-edit-delete) | P2 | Create/edit/delete a track layout (delete confirms); a new layout is selectable in the analyze dropdown. | [ ] |
| [UC-F03](../USE_CASES.md#uc-f03---scoring-configuration-content-presets-weights-hot-words-sensitive-terms) | P2 | Apply a content preset (confirm dialog spells out the change); Exact hot-word auto-applies + Meaning via Scan; sensitive term rescans instantly and only warns (Flagged chip). | [ ] |
| [UC-F04](../USE_CASES.md#uc-f04---vertical--shorts-export-with-auto-framing) | P1 | 9:16 preset exports 1080x1920; framing choice saved on the clip; narrower sources letterboxed; Auto-frame suggests a crop you confirm. | [ ] |
| [UC-F05](../USE_CASES.md#uc-f05---vision-whats-on-screen-image-analysis) | P2 | Analyze frames (1-10) lands the "What's on screen" card on the right clip after navigating away; never auto-runs during analysis. | [ ] |

## Section G - Housekeeping and desktop lifecycle

| UC | Pri | Check | Pass |
|----|-----|-------|------|
| [UC-G01](../USE_CASES.md#uc-g01---back-up-and-restore-a-project) | P1 | Back up downloads a small `.zip` (no source videos/exports/proxies); restore into a folder rebuilds the project; moved-source relink lets clips play; blank folders stay marked missing. | [ ] |
| [UC-G02](../USE_CASES.md#uc-g02---confirmations-log-download-status-notification-sounds) | P2 | Delete/cancel use the in-app modal; Download Log is non-empty + username-redacted; opted-in notification sound fires on completion. | [ ] |
| [UC-G03](../USE_CASES.md#uc-g03---desktop-shell-lifecycle-packaged) | P0 | Re-run Setup Wizard preserves config; Reveal-in-folder opens Explorer; quit leaves NO orphan `python.exe` / `llama-server.exe` (Task Manager); clean relaunch skips the wizard; schema-advancing update opens the wizard in `update` mode. See packaged-app-verification.md sections H and I. | [ ] |

---

## Dev-only appendix (not part of the installed-app run)

These were in the old dev-server checklist and have no packaged-app equivalent - they
belong to browser-dev mode (`yuu-dev serve`), kept here only so the coverage is not lost:

- Raw `GET /api/status` polling (idle vs during a job) - a dev/API check; the user-facing
  behavior it guards is covered functionally by UC-G02 and the job-blocking check in UC-B01.
- Console-error watch on page load - a dev check; run it in browser-dev mode during
  development, not during the installed-app sign-off.
