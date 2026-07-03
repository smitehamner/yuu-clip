# yuu-clip — Completed Features

Recent shipped items. For pending work see [ROADMAP.md](ROADMAP.md).
Older entries live in [COMPLETED-archive.md](COMPLETED-archive.md) — see the
"Archived series" index at the bottom of this file.

---

## URL import — Twitch VOD / YouTube (done, 2026-07-03)

Roadmap plan 08 (`docs/dev/plans/roadmap-2026-07/08-url-import.md`). Paste a
public Twitch VOD or YouTube link instead of picking a local file; yt-dlp
(Unlicense) downloads it, then the New Recording panel opens prefilled so the
creator still confirms track layout and World Contexts before analyzing —
analysis is never auto-started, consistent with the drag-and-drop principle.

- **Data model** — new nullable `videos` columns `source_url`, `source_title`,
  `source_uploader`, `source_upload_date`, `source_category`. Set from a metadata
  JSON sidecar (`yuu_clip/url_import.py`) written next to the downloaded file;
  picked up by `cli/_pipeline.py::_apply_source_metadata` when the Video row is
  first created, which also pre-seeds `title_user` from the scraped title.
- **Backend** (`yuu_clip/url_import.py`, `cli/import_url.py`, `web/routes/imports.py`)
  — `POST /api/import-url/inspect` fetches metadata without downloading (host
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
- **UI** — "Import from a URL instead" toggle in the New Recording panel swaps the
  local-file field for a URL field + "Check link", which renders an inspect card
  (title, channel, duration, category, upload date, estimated size, an
  already-imported warning when the link was seen before) reusing the Plan 01
  processing-time estimate and its long-run warning. "Download" streams progress
  via the standard job UI; on completion the New Recording panel reopens
  prefilled with the downloaded path. The recording detail view shows an
  "Imported from" line (channel, upload date, link to the original) when
  `source_url` is set.
- **Tests** — `tests/test_url_import.py` (URL validation, metadata mapping,
  live/playlist/auth-error handling, progress-line format/parse round trip,
  filename sanitization incl. emoji/unicode/collisions, disk-space guard, sidecar
  → `source_*` columns, the API routes, and `subprocess_sse`'s active-job
  tracking — all with yt-dlp mocked, no network calls) and an added
  `TestImportFromUrl` class in `tests/test_ui_analyze.py` (field visibility,
  stubbed inspect card, stubbed-SSE download-completion prefill).

## Export presets + per-format management (done, 2026-07-03)

Roadmap plan 07 (`docs/dev/plans/roadmap-2026-07/07-export-presets.md`). The
one-export-per-clip model becomes one-row-per-format; built-in presets plus a
custom-preset editor replace the flat container/quality choice at export time.

- **Data model** — new `ClipExport` table (`clip_exports`: `clip_id` FK cascade
  delete, `preset_name`, `path`, `container`, `settings_json`, `size_bytes`,
  `created_at`). One row per (clip, preset_name) — re-exporting the same preset
  replaces the row and overwrites the file ("regenerate"); a different preset adds a
  row ("export another format"). Backfill migration seeds a `default` row for every
  pre-existing `exported_at` clip by globbing the exports dir; legacy columns
  (`exported_at`/`exported_container`/`exported_burn_subs`) stay for the sidebar pill
  until a follow-up retires them. `GET /api/clips/{id}/export-files`, the per-row
  `DELETE /api/clip-exports/{export_id}`, and the bulk/batch export-status
  derivations in `routes/clips.py` all read the new rows.
- **Presets** (`yuu_clip/export_presets.py`) — built-ins `youtube-1080p` (mp4, h264
  CRF 18, scale ≤1080p, aac 192k) and `discord-10mb` (mp4, two-pass size-capped
  encode targeting 10 MB); custom presets are a global-config preference
  (`config.py: export_presets`), validated on save (unique kebab-case name,
  container allowlist, resolution in {720,1080,1440,2160,None}, exactly one of
  CRF/target-size). Size-capped encode fails before encoding with a plain-English
  error when the computed bitrate can't fit the clip's duration. Preset encodes
  always re-encode (no stream-copy path); never upscale past the source resolution.
  CRUD at `/api/export-presets`.
- **UI** — export options modal gains a preset dropdown ("Original quality
  (default)" + built-ins + custom); choosing a preset disables the container select
  and the soft-subtitle caption option since the preset dictates both. The clip
  detail panel's Export card now lists one row per format (preset label, container,
  size, date) with per-row Download / Show in folder / Copy path / Regenerate /
  Delete, plus "Export another format"; the sidebar pill shows a count when a clip
  has more than one format. New `yuu_clip/web/static/exportpresets.js` backs a
  matching custom-preset editor in Settings (label, container, resolution, CRF vs.
  target-size mode) using the same per-row save pattern as hot-words.
- **Glossary** — added **Export preset** and **Format** (`docs/dev/GLOSSARY.md`).

---

## Sensitive content detection (done, 2026-07-03)

Roadmap plan 06 (`docs/dev/plans/roadmap-2026-07/06-sensitive-content.md`), built on
top of Plan 03's shared `yuu_clip/scoring/textmatch.py` — kept entirely separate from
Hot-words: warning/flag only, never touches a clip's score.

- **Fuzzy matching** — `textmatch.find_fuzzy_matches()` adds a "Close spelling" mode:
  rapidfuzz (MIT) `partial_ratio` over a sliding, non-overlapping window of transcript
  words sized to the term's word count, threshold 85, minimum term length 4 (shorter
  terms are too noisy — enforced both client-side and server-side with an explanation).
  `Match.matched_text` records what actually tripped the flag (e.g. "Jonh" for term
  "John") for fuzzy hits; exact/case-insensitive hits just echo the term.
- **Backend** — new `SensitiveTerm` table (`term`, `category`: privacy/censor,
  `match_mode`: exact/case_insensitive/fuzzy, `enabled`) and
  `ClipCandidate.sensitive_matches_json`. `apply_sensitive_scan()`
  (`scoring/engine.py`) runs as a `ScoringEngine.score_clip` post-step next to the
  hot-word boost, scanning the transcript excerpt (speaker prefixes stripped) and both
  description fields — each scanned separately so a multi-word term can't spuriously
  match across a field boundary. CRUD at `/api/sensitive-terms`
  (`routes/sensitive.py`) triggers an immediate synchronous project-wide rescan on every
  save/delete (text-only, no LLM call), returning `clips_scanned`/`clips_flagged`; a
  manual per-video `POST /api/videos/{id}/sensitive-rescan` covers the case where a
  clip's transcript changes without a term-list edit (mirrors hot-word-rescan). Term
  text is treated as PII throughout — never logged, only counts/ids.
- **Frontend** — new `yuu_clip/web/static/sensitive.js` (mirrors `hotwords.js`'s
  per-row save model) backing a new "Sensitive Content" Settings section; a warning
  badge on flagged sidebar clip cards; a "Flagged terms" detail-panel card with
  category-colored chips (Privacy/Censor); a `Flagged` filter tab alongside
  All/Unreviewed/Approved/Rejected, with a dedicated empty state pointing to Settings
  when the term list is empty.
- **Glossary** — added **Sensitive Terms**, **Privacy Term**, **Censor Word**, and
  **Flagged** (`docs/dev/GLOSSARY.md` and the in-app `glossary.md` subset).
- **Tests** — `tests/test_sensitive.py` (fuzzy matcher incl. the non-overlapping-window
  regression guard, `apply_sensitive_scan`, no-score-impact and hot-word-independence
  ScoringEngine integration, CRUD validation, save-triggers-rescan, logging-safety via
  `caplog`); `tests/test_ui_sensitive.py` (Settings CRUD, client-side fuzzy-length
  guard, sidebar badge, Flagged tab incl. empty state, detail-panel category chips).

---

## Manual clip creation (done, 2026-07-03)

Roadmap plan 05 (`docs/dev/plans/roadmap-2026-07/05-manual-clip-creation.md`), the second
`PanelNav` consumer after the Split Editor:

- **Backend** — `POST /api/videos/{video_id}/clips` (`routes/clips.py`) creates a
  `ClipCandidate` from a creator-picked `{start_ms, end_ms}` window: validates the video
  exists, `0 ≤ start < end`, duration between 1s and 10 minutes, and `end_ms` within the
  recording's (segment-relative, for a split segment) duration. The new clip is tagged
  `"manual"` and its excerpt is built from overlapping transcript segments via a new public
  `build_excerpt_for_window()` in `segments/windower.py` (also now backing
  `rebuild_clip_excerpt`, replacing its inline duplicate). Scoring is not run inline — the UI
  chains the existing per-clip rescore SSE right after creation, same as any other clip.
- **Frontend** — new `yuu_clip/web/static/clipcreate.js`: a `PanelNav` takeover panel with
  two entry points ("+ New clip" above the clip list; "Create clip" on a recording's full
  transcript card). Click a transcript line to set the start, click a later line (or the
  same line again) to set the end; manual `h:mm:ss`/`m:ss` time inputs cover the no-transcript
  fallback. The panel gets its **own** inline preview video (`setupRecordingPreview`, like
  the Split Editor) rather than reusing `#player-area` — the `PanelNav` takeover visually
  covers the whole app (see note below), so seeking a hidden player would give no feedback.
  Confirm creates the clip, closes the panel, selects the new clip, and calls the existing
  `rescoreClip()` — no separate manual/unscored code path. `renderTranscriptLines()` gained a
  `readOnly` option (suppresses the click-to-edit-caption affordance) and each line now
  carries `data-start-ms`/`data-end-ms` for the picker's click handling.
- **Note on `PanelNav` coverage**: `#panelnav-root` is `position:absolute` but is a DOM
  sibling of `#main-layout` (not a descendant of `.main`), so it resolves against the
  viewport and visually covers the header and sidebar too, not just the detail pane — despite
  `.main`'s `position:relative` and the Plan 04 changelog's claim otherwise. Confirmed by
  measuring `#panelnav-root`'s live bounding box with the Split Editor open. Not fixed here
  (pre-existing, cross-cutting, out of scope for this plan) — flagged for a future pass.
- **Glossary** — added **Manual Clip** (`docs/dev/GLOSSARY.md`).
- **Tests** — `tests/test_clip_create.py` (happy path/excerpt, validation, no-transcript,
  segment-relative bounds, rescore accepts `scored_at IS NULL`); `tests/test_ui_clipcreate.py`
  (both entry points, click-click range picking incl. reset/1-line edge cases, manual time
  inputs, confirm → create → select → rescore, double-submit guard, Back dirty guard,
  keyboard-shortcut suppression while open).

---

## Panel navigation framework + Split Editor migration (done, 2026-07-03)

Roadmap plan 04 (`docs/dev/plans/roadmap-2026-07/04-panel-navigation.md`):

- **Framework** — new `yuu_clip/web/static/panelnav.js`: `PanelNav.open({id, title, render,
  isDirty, onClose})` takes over the main detail panel with a shared `← Back` breadcrumb,
  a stack (each level gets its own content container so nesting won't need to re-render a
  parent), and a dirty-state discard prompt routed through the existing `showConfirm` helper.
  `PanelNav.close()` gates on `isDirty()`; `PanelNav.forceClose()` bypasses it for callers that
  already ran their own differently-worded confirm (e.g. switching recordings). Wired into
  the Escape cascade (`settings.js` `_closeTopmostLayer`) and the global J/K/A/R/E shortcut
  dispatcher, which now no-ops while any panel is open — the panel covers the detail pane but
  not the sidebar clip list beside it.
- **Split Editor migration** — `split.js`'s open/close now routes through `PanelNav.open`/
  `close`; the bespoke dirty check and breadcrumb markup are gone in favor of the shared ones.
  `isSplitEditorOpen()` and `closeSplitEditor()` are kept as thin aliases (other modules still
  call them). `.main` gained `position: relative` so the takeover only covers the player+detail
  area, not the sidebar.
- Only Split Editor migrated in this pass — reel builder, analyze panel ("New Recording"),
  and contexts keep their existing bespoke takeover/modal patterns and migrate opportunistically
  later (plan 05's manual-clip picker is the next `PanelNav` consumer).
- **Tests** — `tests/test_ui_panelnav.py` (breadcrumb, dirty/clean Back and Escape paths,
  Escape-layering with a modal on top of a panel, keyboard-shortcut suppression); one selector
  update in `tests/test_ui_split.py` where the Back button's DOM location moved.

---

## Hot-word / phrase config (done, 2026-07-03)

Roadmap plan 03 (`docs/dev/plans/roadmap-2026-07/03-hot-words.md`), both stages:

- **Data model** — new project-wide `hot_words` table (phrase, match mode, boost, boost
  target, enabled); new `ClipCandidate.hotword_matches_json` / `hotword_boost_json` columns.
  Boosts are stored per target so re-applying is idempotent (recompute subtracts the old
  boost, adds the new one, clamps) — a rescan never compounds. Score scale matches the
  codebase's existing 0–1 internal representation (boost ±0.5, per-target clamp ±0.3), not
  the plan doc's literal 0–10 numbers, which didn't match how scores are actually stored.
- **Matcher** — `yuu_clip/scoring/textmatch.py`, shared with the future sensitive-content
  plan (06): word-boundary-aware exact/case-insensitive phrase matching (regex-escaped,
  multi-word phrases match across punctuation gaps), with speaker-prefix stripping so a
  speaker named after a hot-word phrase doesn't spuriously match.
- **Stage 1** — exact/case-insensitive matching applied automatically in `ScoringEngine`
  (analyze, rescore) via `apply_hotword_boosts()`; a cheap text-only `POST
  /api/videos/{id}/hotword-rescan` for applying hot-word edits without a full re-score.
  Full CRUD (`/api/hotwords`) plus a live-saving table editor in Settings. Clip sidebar
  shows phrase pills (≤3) or a `🔥 N` count pill; clip detail lists phrase/mode/count/boost.
- **Stage 2** — "Meaning (LLM)" match mode: one LLM call per clip checks a batch of
  semantic phrases against the transcript (`scan_hotwords_semantic`, reusing the JSON
  repair helpers in `scoring/llm.py`). Runs via `GET /api/videos/{id}/hotword-scan`
  (in-process SSE, matching the existing rescore/redescribe routes' pattern rather than
  the plan's suggested CLI-subprocess approach) from a "Scan for Hot-words" action in the
  recording's Additional Actions modal, gated on ≥1 enabled semantic entry. A later
  text-only rescan preserves semantic matches instead of wiping them.
- **Tests** — 56 in `tests/test_hotwords.py` (matcher, boost math incl. idempotency and
  clamp edge cases, CRUD validation, scan route with a stubbed LLM), 24 Playwright tests
  in `tests/test_ui_hotwords.py` (Settings CRUD against the live project with cleanup,
  sidebar/detail rendering via client-state injection, Scan-action gating).

---

## Map user paths end-to-end + artifact staleness policy (done, 2026-07-03)

Roadmap plan 02 (`docs/dev/plans/roadmap-2026-07/02-user-paths-staleness.md`), three stages:

- **Journey inventory + policy table** — `docs/dev/USER_PATHS.md` enumerates 10 user journeys,
  the upstream events that can invalidate a downstream artifact, and the locked policy: cheap
  text artifacts auto-refresh; expensive encoded artifacts (exported clip file, highlight reel)
  get a "Stale — re-export to update" badge and are never silently rebuilt. New glossary term:
  **Stale Export**.
- **Staleness plumbing** — new `ClipCandidate` columns `trim_edited_at`,
  `description_edited_at`, `exported_title_card`, `exported_embed_subs`; computed
  `export_stale`/`export_stale_reasons` in the clip API, comparing those against `exported_at`
  (a plain-cut export isn't staled by a caption edit alone; burned/embedded captions, a trim
  change, or a title-card export's description change are). `refresh_export_sidecars()`
  (`yuu_clip/subtitles.py`) extracted so caption-edit, speaker-rename, and reassign-speaker
  routes reuse the CLI retranscribe path's sidecar-refresh logic in-process; speaker rename now
  also sets `transcript_edited_at` (previously only reassign did). `GET /api/demo/list` gains a
  `stale` flag per reel, computed from the existing `.reel.json` composition manifest vs. member
  clips' `exported_at` (`null` for reels built before the manifest existed).
- **Playwright end-to-end coverage** — badge rendering (sidebar pill + detail panel) via
  client-state injection matching the existing `transcript_stale` pattern; reel staleness tested
  fully end-to-end against the live project (real manifest + real clip data, no stubbing);
  stubbed-SSE retranscribe-refresh test; a merge-confirm-cancel smoke test (merge itself stays
  API-only — it's destructive and the live dev project's DB isn't disposable).

+40 tests across `tests/test_export.py`, `tests/test_videos.py`, `tests/test_speakers.py`,
`tests/test_transcript_edit.py`, `tests/test_reel.py`; +9 new Playwright tests in
`tests/test_ui_clips.py` and `tests/test_ui_reel.py`.

---

## Pause/resume analysis + hardware health monitoring (done, 2026-07-03)

Roadmap plan 01 (`docs/dev/plans/roadmap-2026-07/01-pause-hardware-health.md`), three stages:

- **Pause/resume** — a cross-process pause flag (`yuu_clip/analyze/pause.py`)
  the CLI batch loop polls between videos; `POST /api/analyze/pause|resume`;
  `/api/status` gains `analyze_paused`/`pause_flag_set`; "Pause after current
  video" control in the job header (swaps to "Resume" when paused). The JS
  sequential-segment runners (pre-split, re-split re-analyze) honor the same
  flag between segments. The video in progress always finishes; single-video
  runs simply never trigger it. Not durable across a server restart.
- **Measured processing-time estimate** — `/api/estimate` uses medians from
  the creator's last 10 runs (keyed by whisper model + device) once ≥2
  matching samples exist, falling back to the static formula otherwise
  (`"source": "measured"|"estimated"`). A long-run warning block
  (`analyze_warn_hours`, default 2h) suggests splitting the recording or
  analyzing fewer files at once.
- **GPU thermal monitoring** — `yuu_clip/analyze/thermal.py` (`GpuThermalMonitor`
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

## Quick wins Stage 9 — drag-and-drop analyze (done, 2026-07-03)

Dragging a video file over the window (Electron only) shows a full-window
drop overlay ("Drop to analyze this recording"); dropping opens the New
Recording panel with the file path prefilled and triggers the existing
probe — the user still confirms track layout and world context before
starting. Never auto-starts analysis.

- `electron/preload.js` gains `getPathForFile(file)` via Electron's
  `webUtils.getPathForFile` (≥ Electron 32; this app ships 33.2.1) — the
  only way to recover a real filesystem path from a dropped `File` under
  `contextIsolation`.
- Plain browser: no overlay affordance (nothing to drop onto that would
  work); a drop shows a toast pointing at manual path entry instead.
- Only `VIDEO_EXTENSIONS`-equivalent files accepted (mirrored in JS);
  multiple files drops the first and toasts that one-at-a-time is
  supported; non-file drags (e.g. text) are ignored entirely.

+6 UI tests in `test_ui_analyze.py` (synthetic `DragEvent`/`DataTransfer`
dispatch — no real OS drag needed).

---

## Quick wins Stage 8 — export filename template (done, 2026-07-03)

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
independent copies of the same naming logic — the two in `cli/export.py`,
plus `web/routes/_shared.py::_clip_stem` (backs ~16 call sites across
`clips.py`/`videos.py` that locate already-exported files: has_export
badges, downloads, playback, delete, merge-rename), plus one each in
`web/routes/reel.py` (reel-builder pool `has_export`) and `yuu_clip/reel.py`
(`_resolve_clip_files`, the highlight-reel compiler). Fixing only the CLI
pair would have made a custom template silently break has-export detection
and reel compilation. All five now go through one shared module:

- **New `yuu_clip/export_naming.py`** — `export_base_stem(cand, template,
  video_filename=...)`, `validate_export_name_template`,
  `DEFAULT_EXPORT_NAME_TEMPLATE`. Duck-types on a ClipCandidate-shaped
  object; only computes the placeholder values the template actually
  references (so a default-template caller never needs `end_ms`/
  `score_overall` populated — this was a real bug caught by the existing
  `test_export.py` fixtures using minimal fakes). No `cli/`↔`web/` import
  needed — both sides import this new leaf module instead.
- `Config.export_name_template` (`config.py`), validated in the
  `PATCH /api/config` route like every other config field.
- `_clip_stem` and its downstream helpers (`_export_paths`, `_srt_path`,
  `_srt_sidecar_paths`, `_all_sidecar_paths`) in `_shared.py` gained a
  `name_template` parameter (defaulted for safety, but threaded explicitly
  from `ctx.config.export_name_template` at every call site).

Known limitation (not fixed — out of scope): changing the template after a
clip is already exported orphans the old sidecar-refresh/has-export lookup
for that clip, since the stem is re-derived from the *current* template
each time rather than stored. Documented in `_refresh_caption_sidecars`'s
docstring.

+12 tests in new `tests/test_export_naming.py`, +3 in `test_config.py`,
+1 integration test in `test_export.py` confirming the web-route lookup
path (not just the CLI creation path) honors a custom template, +3 UI tests.
Full suite: 1122 API + 462 UI, all green.

---

## Quick wins Stage 7 — detail panel chunking (done, 2026-07-03)

Closes the ROADMAP "Detail panel chunking" item. Clip detail (`renderDetail`,
`clips.js`) regrouped, layout only:

- **Summary card** — Description, Full Description, and Tags merged into one
  `.detail-card` with `.detail-card-divider` separators between sub-sections
  (each keeps its own mini-header, e.g. Description's copy/edit-kebab pair).
- **Scoring + Actions row** — kept side by side (the existing L4-3
  narrow-layout wrap design, protected by `test_detail_cards_row_wraps`, was
  deliberately not disturbed); Actions now has its own "Actions" card title.
- **Export card** — new: the Trim/Exported-file info block extracted out of
  the Actions card into its own card.
- **Transcript / Related Clips** — unchanged, already their own cards.

Full `test-ui.ps1` run: 459/459 passed with zero test edits — event
delegation (`#detail` click/keydown, tag remove/copy) and every selector the
plan flagged as a risk (`.detail-card:has(#clip-user-tags)`, transcript/
related-clips card titles) survived the move untouched.

---

## Quick wins Stage 6 — batch processing status panel (done, 2026-07-03)

Closes the ROADMAP "Batch processing status panel" item, scoped down from
its original "active/queued/completed job counts with per-job detail"
wording (no job-queue/history infrastructure exists to back that) to a
simpler counts-plus-indicator panel, per user decision when the plan's
"roadmap wins on drift" instruction hit that mismatch.

Collapsible bar above the clip filter chips (`#batch-status-panel`,
`_renderBatchStatusPanel()` in `clips.js`): unreviewed/approved/rejected +
scoring-error counts for the selected recording, plus an in-flight job
indicator (reads the existing `#job-status` pill visibility — `startJobUI`/
`endJobUI` now call back into it, guarded via `window._renderBatchStatusPanel`
so `utils.js` doesn't hard-depend on `clips.js`). Clicking a count applies
the matching filter chip; collapsed state persists in localStorage
(`yuuclip-batch-panel`). No new endpoints — everything derives from
`AppState.clips` and existing job-UI state.

+4 UI tests in `test_ui_clips.py`.

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

