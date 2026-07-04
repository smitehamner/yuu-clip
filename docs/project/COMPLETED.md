# yuu-clip — Completed Features

Recent shipped items. For pending work see [ROADMAP.md](ROADMAP.md).
Older entries live in [COMPLETED-archive.md](COMPLETED-archive.md) — see the
"Archived series" index at the bottom of this file.

---

## Project switcher (done 2026-07-04)

Closed the Phase 5 "Project switcher in UI" item (plan 03). The server now switches
between project folders **in place** — no process restart, works identically in
browser-dev mode and the packaged desktop app.

- **In-place swap.** `ProjectContext.switch_project` disposes the current SQLite engine
  (and cleans preview-cache temp files), rebinds every path/engine/transient field to the
  new folder via a shared `_bind_project`, and bumps `project_generation`. Routes
  closure-capture the context, so it is mutated, never replaced. `thermal_monitor` is
  kept (project-independent hardware state). `_bind_project` creates `.yuu-clip` before
  `make_engine`, and the per-project bootstrap (output dirs, seed contexts, clear stuck
  `extracting` rows, drop stale pause flag) was extracted to `app.py::prepare_project` and
  re-run on switch — so pointing at a brand-new folder initializes a fresh, empty project.
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
  (AppState is not hot-swapped). No new color tokens — reuses the hamburger-menu chrome.
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
and sorted on its own — with **no change** to existing scores.

- **Model + migration.** Added the nullable `ClipCandidate.score_laugh` column via the guarded
  ADD-COLUMN list. `NULL` means laughter was never computed (pre-existing clips, or the laugh
  scorer disabled) — never backfilled, so the UI hides it rather than showing a misleading 0%.
- **Engine.** `score_clip` resets `score_laugh` to `None` each run and stores the laugh scorer's
  raw `score_funny` (identified by `scorer.name == "laugh"`) before weighted aggregation. "No
  data" laugh results carry only tags, so `score_laugh` stays `None` for them. Funny is unchanged.
- **API.** `score_laugh` is serialized on the clip shape (`null` when unset) and `laugh` is a new
  server-side sort key — SQLite's `DESC` puts the null (never-measured) clips last.
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
  CPU); the highest cosine between two *different* voices across 214 pairs was 0.647 — a
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
`tests/test_ui_speakers.py` (chip render + button POSTs). See
`docs/dev/plans/roadmap-close-2026-07/01-voiceprint-validation.md`.

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
  (first line headline, rest body) instead of description/timecode-specific sizes — this
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
  scene probing called the bare `"ffmpeg"`/`"ffprobe"` string — a missing binary surfaced
  as `[WinError 2]` and processing failures as a stderr-less `CalledProcessError`. All of
  those now route through `run_ffmpeg`, which resolves via `find_ffmpeg` and raises a
  `RuntimeError` carrying either the install instructions or the captured stderr. Migrated
  `reel.py` (5 sites), `web/routes/clips.py` (preview), and `scoring/scenes.py`; `cli/reel.py`
  now reports the `RuntimeError`.
- **Silent scorer degradation surfaced** (`cli/_pipeline.py`, `scoring/laugh.py`). Laughter
  scoring in "model"/"audio" mode was dropped silently when its deps were missing — now a
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
  `parent_video_id` self-FK regardless of future columns — it can never drift again. The
  `PRAGMA foreign_keys=OFF/ON` fence and the two INFO log lines are unchanged.
- **Test**: `tests/test_db_migrations.py::TestDropUniquePathMigration` builds a legacy
  `videos` table (UNIQUE(path) + only the pre-`source_*`/`proxy_*` columns) with real rows,
  runs `_migrate`, and asserts it doesn't raise, rows survive intact, `UNIQUE (path)` is gone,
  a second `_migrate` is a no-op, and post-drop two segments can now share their parent's path.

## Clearer failures for missing services: LLM pre-flight + model-download errors (2026-07-04)

Two "works on my machine" gaps where a missing host dependency failed opaquely:

- **LLM scoring silently skipped when Ollama is down** (`cli/_pipeline.py`,
  `scoring/llm.py`). When the LLM backend was unreachable, `ScoringEngine` dropped the
  LLM scorer with only a `log.warning` — the user got clips ranked without the AI score
  and no visible reason. Now a **pre-flight check runs before transcription starts**
  (`_preflight_llm_check`): if scoring is enabled and the backend isn't reachable, it
  warns immediately so the user can start Ollama *during* the slow transcription and have
  it used this run. A second notice at scoring time covers the case where they didn't.
  Silent when scoring is off or the LLM is intentionally disabled in Settings.
- **Whisper model-download failure was an opaque traceback** (`transcribe/whisper_runner.py`).
  A failed first-run model download (offline / HF unreachable) surfaced as a raw
  `FAIL transcription: <network error>`. Load failures now raise `TranscriptionModelError`
  with an actionable message ("check your connection and try again … or the model may be
  corrupt — retry to re-download"), preserving the original detail.
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
  `site-packages/nvidia/<lib>/bin`, which isn't on the Windows DLL search path — so pip
  alone wouldn't fix the crash. We now `os.add_dll_directory()` those dirs before loading
  the CUDA backend (idempotent, Windows-only).
- **One-click install.** New `cuda-libs` slug in `web/routes/analyze.py` `_INSTALLABLE`;
  an "Enable GPU acceleration" button in Settings → Hardware and in the first-run wizard
  (offered, not auto-installed, only when an NVIDIA GPU is detected and neither the
  system toolkit nor the wheels are present). The wizard previously pointed users at the
  ~3 GB CUDA Toolkit; it now installs the ~1 GB wheels, the lighter correct path.
- **About page** lists the two nvidia wheels (NVIDIA proprietary, redistributable —
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
  caller passed `is_analyze=True` — the real analyze cancel runs through `AnalyzeJob`).
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
  `fmtDuration(seconds, fallback)` are the standard way to render a computed number —
  non-finite values (NaN/Infinity from partial data) now degrade to a plain-English
  placeholder (`—` / `unknown`) rather than surfacing raw. The clip-stats sum also skips
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

- **Bug fix — malformed export filename template crash** (`yuu_clip/export_naming.py`).
  A stray/unbalanced brace (e.g. `clip_{video}}`) passed `validate_export_name_template`
  (its `{(\w*)}` regex only caught unknown placeholders) and then raised an uncaught
  `ValueError` in `export_base_stem` — which broke every export for the recording *and*
  500'd the clip-list has-export badge endpoints that call it in a loop, effectively
  bricking the recording detail view from one bad character. Validation now trial-formats
  the template and rejects unbalanced braces with a plain-English message; `export_base_stem`
  also catches `ValueError` as a fallback for any already-saved bad template. Covered by
  new tests in `tests/test_export_naming.py`.
- **Diagnosability — URL import logging** (`yuu_clip/url_import.py`, `yuu_clip/cli/import_url.py`).
  The raw yt-dlp `DownloadError` cause (auth wall vs 404 vs network vs stale yt-dlp) was
  discarded before the friendly message; it's now logged at WARNING with the URL, plus
  download start/complete/size and a "reported success but file missing" ERROR. The
  `import-url` subprocess also never wired up `configure_logging`, so none of its logging
  reached `yuu-clip.log` — now fixed.
- **Diagnosability — thermal auto-pause + sensitive-term rescans** (`web/routes/analyze.py`,
  `web/routes/sensitive.py`). "Why did analysis pause?" now logs the temp + configured
  threshold; sensitive-term create/update/delete log the rescanned/flagged clip counts
  (never the term text).
- **Refactor** — `scoring/engine.py:apply_hotword_boosts` decomposed into two pure helpers
  (behavior byte-identical).
- **UX** — Enter now submits the Import-from-URL field (`index.html`).
- **Tests** — 2 pre-existing flaky UI tests fixed (settings preview race, hotwords
  double-save); coverage added for reel export-format selection and subtitle sidecar refresh.
- Keep-as-is decisions and review-discovered follow-ups recorded in
  [REVIEW_DECISIONS.md](../dev/REVIEW_DECISIONS.md) and [ROADMAP.md](ROADMAP.md).

## Electron native-file-protocol media transport (implemented, manual packaged-app verification pending, 2026-07-03)

Roadmap plan 10 (`docs/dev/plans/roadmap-2026-07/10-electron-file-protocol.md`), the
last and lowest-value plan of the set. **Code and automated tests are done; the
plan's own 5-item manual packaged-app checklist has not been run** — this entry is
intentionally not "done" until someone builds the app and runs it. No user-facing
change (plain browser-dev mode is unaffected either way).

- **Electron main** (`electron/main.js`) — registers a privileged `yuu-media://`
  scheme before `app.ready` and a `protocol.handle` request handler wired up in
  `app.whenReady()`. Range requests (required for `<video>` seeking) are handled
  **manually** — `fs.createReadStream(start, end)` + 206/`Content-Range` — rather
  than trusting `net.fetch(pathToFileURL(...))` to cover it: the pinned Electron
  version (33.2.1, `electron/package.json`) falls inside the span of a still-open
  upstream bug (electron/electron#38749) where that pattern breaks video seeking;
  reports of the same failure exist as recently as Electron 34/35. Manual Range
  handling sidesteps the bug regardless of Electron version.
- **Path validation** — a requested path is served only if it resolves inside the
  project's `.yuu-clip/proxies` dir, or exactly matches a source/proxy path the
  backend has reported for a known video (a cached whitelist refreshed from
  `GET /api/videos`, rate-limited to once per 2s). This is a deliberate deviation
  from the plan's literal "allowed root directories" wording: recordings are
  ingested from wherever the creator originally pointed `analyze` at, which is
  frequently outside the project directory entirely, so a directory-prefix check
  alone would reject every real source file. The exact-path whitelist covers that
  case correctly without weakening the security intent.
- **Server** (`yuu_clip/web/routes/videos.py`) — `_video_dict` now includes the
  recording's absolute `source_path`; `GET /api/videos/{id}/proxy-status` includes
  the proxy's absolute `proxy_path` (null until a fresh proxy exists). No behavior
  change to the existing HTTP source/proxy routes.
- **Renderer** (`yuu_clip/web/static/utils.js`) — new `_buildMediaUrl(videoId, kind,
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
  coverage — Playwright cannot exercise a real Electron process.

**What's still needed before this can be marked fully done** — the plan's own
manual packaged-app checklist, none of which is possible from an automated/headless
session:
  1. Build the packaged app and open a recording — confirm playback starts.
  2. Confirm seeking works (Range requests).
  3. Confirm a split segment plays back at the correct offset.
  4. Confirm DevTools' Network tab shows no `/api/videos/.../source` byte traffic
     (i.e. the native protocol is actually being used, not a silent HTTP fallback).
  5. Confirm a doctored/malicious path outside the allowed set is refused (403).

## Title card customization (done, 2026-07-03)

Roadmap plan 09 (`docs/dev/plans/roadmap-2026-07/09-title-card.md`). Background
color, text color, text size, content layout, and duration for the title card
shown between highlight reel clips and prepended to a clip export with "Add
title card" enabled — previously hardcoded (black background, white text,
fixed sizes).

- **Config** (`config.py`) — `title_card_bg_color`/`title_card_font_color`
  (strict `#RRGGBB`, `validate_hex_color`), `title_card_scale` (0.5–2.0,
  multiplies the existing per-line font sizes so one knob scales both the reel
  and clip-export contexts), `title_card_layout` (`description` / `timecode` /
  `both`), `title_card_duration_s` (1–10). `PATCH /api/config` rejects bad
  values outright; a hand-edited config file with garbage instead falls back
  to defaults with a WARN log (`Config.load()` never crashes on it).
- **Backend** (`yuu_clip/reel.py`) — `_make_title_card` takes `bg_color`/
  `font_color` params, converted to ffmpeg's `0xRRGGBB` form. New shared
  `title_card_lines(cand, config, *, description_size, timecode_size)` helper
  replaces the duplicated "which lines go on the card" logic at both call
  sites (`cli/export.py::_apply_title_card`, `reel.py::_build_segment_list`):
  it honors layout + scale, reads `cand.effective_description` (the clip
  export path previously read the raw un-edited description, ignoring user
  edits — fixed here), caps the description at ~90 chars with an ellipsis
  (previously unbounded), and falls back to the timecode line when
  `layout=description` and the clip has no description so a card is never
  emitted empty.
- **Settings UI** (`index.html` + `settings.js`, Settings → Export) — two
  native color inputs, a Text size dropdown (Small/Normal/Large/Extra large →
  0.75/1.0/1.25/1.5), a Content dropdown, a duration number input, a pure-CSS
  live preview ("Preview (approximate)"), and a WCAG contrast-ratio check
  (below 3:1) that shows an inline warning without blocking save.
- **Tests** — `tests/test_title_card.py` (command construction via mocked
  `subprocess.run`, `title_card_lines` layout/scale/truncation/
  effective_description coverage, both call sites' wiring, a real tiny encode
  with non-default colors) and `tests/test_config.py`
  (`TestTitleCardConfigDefaults`/`TestValidateHexColor`/
  `TestTitleCardConfigLoadSanitization`/`TestTitleCardConfigApi`); UI coverage
  in `tests/test_ui_settings.py::TestTitleCardSettings` (fields render/persist,
  preview reflects color/layout, contrast warning appears/hides).

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

