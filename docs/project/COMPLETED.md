# yuu-clip — Completed Features

Recent shipped items. For pending work see [ROADMAP.md](ROADMAP.md).
Older entries live in [COMPLETED-archive.md](COMPLETED-archive.md) — see the
"Archived series" index at the bottom of this file.

---

## Quick wins Stage 5 — reel pool from rejected/unreviewed (done, 2026-07-03)

Closes the ROADMAP "Demo reel: add clips from rejected/unrated pool" item.

`GET /api/demo/approved-clips` gains a `statuses` query param (comma-separated
subset of `approved|pending|rejected`, default `approved` — existing behavior
unchanged, 400 on an invalid/empty value); response rows now include `status`.

Reel Build tab gets Approved/Unreviewed/Rejected pool chips
(`_toggleReelPoolStatus`, `reel.js`) above the clip-order list. Toggling
refetches and merges into the existing curation: clips still in the pool
keep their order/inclusion, newly-added clips default to **excluded**
unless approved (so a stray chip toggle can't silently stuff the reel), and
clips that fall out of the pool are dropped. At least one status chip must
stay active — toggling off the last one is a no-op.

+4 API tests (`test_reel.py`), +3 UI tests (`test_ui_reel.py`).

---

## Quick wins Stage 4 — show in folder (done, 2026-07-03)

New `POST /api/reveal` (`routes/reveal.py`, Windows-only — 501 elsewhere):
resolves the given path, requires it inside a project-owned directory
(exports, reels, proxies, or a tracked recording's own directory — 400
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

+7 tests: `test_reveal.py` (API — path allow/deny, 404, 501, `can_reveal`)
and UI tests across `test_ui_clips.py`, `test_ui_video.py`, `test_ui_reel.py`
(request interception, not real Explorer windows).

---

## Quick wins Stage 3 — copy-to-clipboard (done, 2026-07-03)

Shared `copyText(text, label)` helper (`utils.js`) wraps
`navigator.clipboard.writeText` with a success/error toast. Copy buttons
(📋, event-delegated on `#detail`'s existing click handler, `data-copy`
attribute selects the field):

- Clip **description** (detail panel Description card).
- Clip **transcript excerpt** (detail panel Transcript card) — copies the
  plain-text excerpt, not the rendered speaker-chip markup.
- **Exported file path(s)** — new "Copy File Path(s)" row in the Additional
  Actions "Files" group, joining `AppState.exportDir` (populated from
  `/api/status`) with each filename from `GET /api/clips/{id}/export-files`.

Renamed the shared icon-button style to `.kebab-btn, .copy-icon-btn` so the
new copy buttons don't collide with `.kebab-btn` selectors that pick the
description's edit/regenerate kebab.

+3 UI tests in `test_ui_clips.py` (clipboard stubbed via `add_init_script`
for determinism under parallel workers).

---

## Quick wins Stage 2 — playback options (done, 2026-07-03)

Settings → UI: two checkboxes alongside Autoplay, mutually exclusive (checking
one unchecks the other, both live in `settings.js` and reflected in the panel):

- **Play next clip when finished** — on the preview video's `ended` event,
  advances to the next clip in the current list order (same path arrow-key
  navigation uses); stops silently at the end of the list.
- **Loop clip** — sets `loop` on the preview `<video>` element.

+3 UI tests in `test_ui_clips.py`.

---

## Quick wins Stage 1 — micro wins (done, 2026-07-03)

Four small JS/HTML-only items from `docs/dev/plans/QUICK-WINS-2026-07.md`:

- **J/K navigation aliases** — `j`/`J` and `k`/`K` alias the existing
  arrow-key prev/next clip navigation; added to the `?` controls modal.
- **Clip stats line** — muted summary between the filter chips and the clip
  list (`14 shown · 6 unreviewed · 5 approved · 3 rejected · 22 min total`),
  recomputed on every `_renderClips()`; hidden when no recording is selected.
- **Hamburger Refresh item** — `⟳ Refresh` → `location.reload()`,
  Electron-only visibility (same toggle as `#btn-setup-wizard`).
- **Shortcut hint** — one muted line under the clip list pointing at J/K/A/R/?.

+8 UI tests in `test_ui_clips.py`.

---

## Theme selector + design-token hardening (done, 2026-07-03)

Settings → UI → **Theme**: Dark (default) / Light / High contrast, applied
instantly (pre-paint inline script avoids a flash of the wrong theme),
persisted in localStorage (`yuuclip-theme`).

- **Token cleanup** — every hardcoded hex/rgba literal in `app.css` (and the
  split-editor overlays in `split.js`) replaced with theme tokens or
  `color-mix()` derivations; new tokens `--bg-deep`, `--surface-raised`,
  `--selection`, `--on-accent`, `--on-green`, `--on-red`, `--accent-text`,
  `--warn-hot`, shadow/backdrop vars. Only `#000` video letterboxing stays
  literal (intentional — letterbox black is theme-independent).
- **Contrast fixes** — reject-button/red-dot text (`--on-red`) and
  accent-as-text (`--accent-text`: header title, settings section titles,
  context chips, transcript speaker names) now meet AA in the dark theme too
  (previously ~3.6:1 / ~3.9:1).
- **Enforcement** — `tests/test_ui_theme.py` runs the WCAG AA token contract
  per theme, requires each theme block to override the full token set, and
  fails on any color literal outside theme blocks. CLAUDE.md + GLOSSARY.md
  ("Theme" entry) document the no-hardcoded-colors rule.

## Pre-release polish batch 2 (done, 2026-07-03)

Second small-fix pass ahead of the next friend release:

- **Split/unsplit no longer orphans exported clip files** — export/sidecar
  filenames embed the clip's start time (`_clip_stem`), and clip migration on
  split/unsplit shifts `start_ms`, so an exported clip's files became
  undiscoverable after "Split only" (exported badge went false, Download 404'd,
  delete left orphans, the reel builder skipped the clip). `_shift_clip_times`
  (`web/routes/videos.py`) now renames the on-disk export + SRT sidecars to the
  new stem whenever a migration shifts a clip's times, in both directions
  (split → segment-relative, unsplit → absolute). A failed rename (locked file)
  is logged, never fatal.
- **Split/unsplit blocked while the recording is being analyzed** — the
  `delete_video` mid-analysis guard is now shared (`_reject_if_video_analyzing`)
  and applied to split and unsplit too: mutating a recording that the ingest
  subprocess is writing to would re-parent rows under it. Same matching rule
  (job video id, or filename for a fresh analysis; segments share the parent's
  filename, so they're covered).
- **UI-test harness: track-layout debris can't flake the next run** — the
  `track_layout_cleanup` fixture (`test_ui_analyze.py`) now deletes the known
  test-layout names in setup as well as teardown, so a hard-killed prior run
  (watchdog force-exit skips teardown) no longer leaves a layout that makes the
  next run's create step fail. Closes the second half of the "UI-test harness
  hygiene" known issue; the first half (os._exit truncating pytest's summary)
  was already resolved by the delayed-watchdog rework that shipped with test
  parallelization.
- **ROADMAP.md staleness fixes** — the `_pearson` flat-curve and torchcodec
  known-issue entries still read as unresolved after batch 1 fixed them; both
  are now struck through with their resolutions.

---

## Pre-release polish batch (done, 2026-07-03)

Small fixes/wins identified while reviewing state ahead of the next friend release:

- **Undo for bulk Approve/Reject** — `bulk_set_clip_status` (`web/routes/clips.py`) now returns
  a `previous` map of `{clip_id: prior_status}`; a new `POST /api/clips/bulk-status-restore`
  reverts each clip to its own prior status in one call (clips may have had different statuses
  before the bulk write). The bulk toolbar shows the same undo toast pattern as single-clip
  status changes. `AppState.lastStatusChange` / `lastBulkStatusChange` are mutually exclusive —
  setting either clears the other — so `Ctrl/Cmd+Z` always resolves to the single most recent
  action without needing to compare timestamps.
- **`_pearson` flat-curve fix** (`analyze/overlap.py`) — two constant (silent) RMS curves used to
  return correlation `1.0` ("identical"), which could wrongly suppress a specialized audio track
  that just happened to be silent during the 30 s sample window. Now returns `0.0`
  (undetermined/no-correlation) for any flat-curve case, matching the existing asymmetric
  (one-flat-one-not) behavior. Was a documented "Known issue" in ROADMAP.md.
- **Torchcodec import warning suppressed** — `pyannote.audio.core.io` emits a `UserWarning` with
  the full libtorchcodec load traceback inlined as text whenever FFmpeg's shared libs aren't on
  PATH (the default on Windows) — harmless since diarization decodes WAVs itself and never uses
  torchcodec, but alarming to see on a friend's first run. `diarization_client.py` now scopes a
  `warnings.catch_warnings()` filter narrowly to that one message/module around the
  `from pyannote.audio import Pipeline` import, so unrelated warnings still surface normally.
- **ROADMAP.md staleness fix** — "random transition" for the highlight reel builder had already
  shipped (`reel.py` + `index.html`) but was still listed as pending; split that roadmap item into
  the shipped part and the one genuinely remaining piece (adding clips from the rejected/unrated
  pool to the reel builder).

---

## Split: clip/transcript migration + Undo Split (done, 2026-07-03)

"Split only — keep all existing clips" never actually migrated anything —
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
  "Split only" action is selected — it only ever affected which segments get
  reanalyzed, so it was a silent no-op for a plain partition and was mistaken for
  something that mattered.
- Fixed a related bug: a segment's recording-preview player always streamed the
  parent file from `0:00` instead of seeking to the segment's own start (and
  never stopped at its end) — `setupRecordingPreview` (`utils.js`) now accepts
  `startS`/`endS` and bounds playback accordingly, including the 720p-proxy
  swap path (which previously had a race that could resume at `0:00` if the
  proxy-status check won the race against the initial seek).

## Preview proxy for fast multi-hour scrubbing (done, 2026-07-02)

Full-video preview was unusably slow on multi-hour `.mkv` recordings — Chromium
can't seek MKV, so it linear-scans. Fixed by generating a downscaled **720p
H.264** proxy per recording and pointing in-app playback at it.

- `analyze/proxy.py` — `generate_proxy` prefers NVIDIA **NVENC**, falls back to
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
  (`utils.js`) drives the recording detail player *and* the split editor — both
  prefer the proxy and always show the badge. The split editor auto-builds on open
  (deliberate scrubbing surface); the recording detail player offers a click-to-
  build badge instead of auto-encoding on every casual selection (avoids surprise
  GPU load). The badge is a `role="status"` live region, or a keyboard-focusable
  `role="button"` when it invites a build.
- Left on source deliberately: the pre-analysis pre-split editor (waveform-only,
  no `<video>`, no Video row to key a proxy — and analysis will build one shortly).
- Disk hygiene: split segments inherit the parent's proxy pointer (no needless
  rebuild), and deleting the last Video row for a source file removes its orphaned
  proxy (best-effort — a locked mid-preview file is logged, never fatal).

## Recordings-list + split-timeline usability pass (done, 2026-07-02)

Three small usability fixes from direct-use feedback:

- **Sort recordings by filename** — new "Filename" option in the recordings
  sidebar sort (`videos-sort`), numeric-aware (`localeCompare(..., {numeric:true})`)
  so date/number-stamped OBS filenames order correctly. Distinct from the existing
  "Title" sort (which falls back to filename).
- **Easier-to-click suggested splits** — the energy-valley suggestion pins in the
  split editor went from a 1px line to a 14px transparent hitbox (`.split-suggestion-pin`)
  around the dashed line, and now brighten to the accent color on hover.
- **Timeline zoom** — the main split editor timeline gained zoom in/out/Fit
  controls plus Ctrl/⌘+scroll (zoom-to-cursor), inside a horizontal-scroll
  wrapper. All %-positioned overlay layers scale for free; the waveform canvas
  redraws at the new pixel width (clamped to 16000px). Zoom resets on open.
  +3 UI tests; the M6-4 flex-shrink test now checks the scroll wrapper.
- **Media streaming chunk** 64KB → 1MB (minor throughput help; not the fix for
  multi-hour MKV scrubbing — see the ROADMAP preview-proxy item).

---

## Archived series (full entries in [COMPLETED-archive.md](COMPLETED-archive.md))

- **2026-07 UX review passes** (prompts 2–13 of `UX_REVIEW_PLAN.md`; closed
  2026-07-02) — keyboard/focus/Escape, toast standards, terminology (Recording,
  percentages, `plural()`), header job pill, sidebar, video-detail cards,
  clip-detail cards, New Recording + track layouts, Split Editor, Settings
  panel, Highlight Reels, info/management modals.
- **Server/test infrastructure (2026-07-02)** — video streams outliving their
  viewer (idle-CPU degradation fix) and the UI-suite xdist parallelization
  (7.6 min → 2.8 min).
- **Usage-feedback cleanup batches 1–7 (2026-07-01/02)** — branding/icon,
  analysis lifecycle correctness, progress & estimation, clip-generation
  quality (speech-density filter), user tags, sort/filter/search, SRT sidecar
  downloads, highlight-reel exports + captions, speaker power features.
- **Phase 4 — Packaging + distribution** — Electron wrapper, NSIS installer,
  setup wizard, venv bootstrap, bundled llama.cpp backend, glossary bundling.
- **Feature blocks (2026-06/07)** — notification sounds, pipeline progress +
  run history (Stages 1–2), re-analyze/re-detect speakers, voiceprint
  threshold + name inference, per-speaker colours, bulk clip actions,
  "not yet scored" indicator, split-segment window fix, setup wizard revamp +
  transcription language, 2026-07-01 bug-hunt and full code-quality passes.
- **Phases 1–3** — core pipeline, signal enrichment + scoring, and the full
  Phase 3 web UI feature list.

