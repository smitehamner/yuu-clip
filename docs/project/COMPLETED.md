# yuu-clip — Completed Features

Archive of shipped items. For pending work see [ROADMAP.md](ROADMAP.md).


---

## Phase 1 — Core pipeline

- ffprobe video probing (duration, streams, fps, codec info)
- Interactive track labeling + saved track layouts (`profiles.json`)
- Audio extraction per track to 16 kHz mono WAV via FFmpeg
- Whisper transcription via faster-whisper (CTranslate2 backend)
- CUDA auto-detection using `ctranslate2.get_cuda_device_count()` (no PyTorch dep)
- Sliding window clip generation from silence gaps
- SRT caption sidecars (per-track + merged)
- `--bake-captions` for baked-in captions
- CLI: `yuuclip analyze / export / clips / status / probe`

---

## Phase 2 — Signal enrichment + scoring

- `AudioEnergy` table: per-second RMS energy via PyAV
- `SceneBoundary` table: tiered scene detection
  - Transcript gaps (instant)
  - Keyframe timestamps via ffprobe (seconds)
  - Full ContentDetector via PySceneDetect (slow, opt-in)
- `LLMScorer`: Ollama (local GPU) with JSON-structured output
  - Generates 1-sentence clip description + scores in one call
  - `score_funny`, `score_dramatic`, `score_action`
- `ScoringEngine`: weighted aggregation across all signals
- Track overlap detection: RMS Pearson correlation + post-transcription word overlap
  - Falls back to combined track when specialized tracks duplicate it
- `clip_candidates.description` column with DB migration
- `yuuclip score` standalone re-scoring command; useful after changing world contexts
- `yuuclip reel` highlight reel compiler (FFmpeg xfade transitions + title cards)

---

## Phase 3 — Web UI (shipped features)

### Core UI

- FastAPI + uvicorn server (`yuuclip serve`)
- Single-page frontend (vanilla JS, no build step)
- Video list and clip list sidebar with sub-score bars (F/D/A) and clip ID
- Clip detail: video player, score bars, description, transcript excerpt
- Approve / Reject / Reset workflow with status dot
- Export clip via SSE progress stream
- ~~Score All button with SSE progress~~ — removed from UI; CLI-only via `yuuclip score`
- Analyze modal: native OS file picker, inspect + time estimates, warning threshold
- Step-by-step progress indicator in header during jobs
- Track layout manager modal: create/edit/delete track layouts
- Highlight reel builder modal with transition and duration controls
- Retranscribe individual clips with a different Whisper model
- Export Log button: one-click debug log download
- Video summary — `POST /api/videos/{id}/summarize`; `Video.title` + `Video.summary` columns; user-editable inline
- Two-level clip descriptions — `description` (1-sentence) + `description_long` (paragraph); both LLM-generated; user-editable inline
- Session timeline — `GET /api/videos/{id}/timeline`; `timeline_json` column; visual timeline in video detail panel
- World Contexts — context assignment per-video; `context_names_json` column; world context manager modal
- Re-score individual clip — "Re-score" button in clip detail; SSE; backend `GET /api/clips/{id}/rescore`
- Keyboard shortcuts — A/R/Space/E/←→; `?` key opens About panel
- About / Credits modal — licencing notice, dependency table, keyboard shortcut cheatsheet
- `GET /api/status` — reports `any_running`, `ingest_running`, `active_jobs`, `version` (covers all SSE jobs, not just ingest)
- App footer bar — VS Code-style thin bar at bottom; version string bottom-left from `/api/status`
- Sidebar score icons — emoji + number line replacing sub-score bars: `⭐ 0.74  😂 0.8  🎭 0.4  ⚔️ 0.6`; 4px colored left border per card (gradient on selected sort score; muted on rejected)
- Sort by sub-score — dropdown extended: `⭐ Overall ↓ · 😂 Funny ↓ · 🎭 Dramatic ↓ · ⚔️ Action ↓ · Timeline`; `localStorage` persistence; border color tracks selection
- Filter tabs — `All · Unreviewed · Approved · Rejected` above clip list; resets to All on video switch
- Rejected clip undo — toast + `Ctrl+Z` reverts last status change within 5 s
- Rename "Slug" → "ID" in Context Manager

### Near-term (shipped)

- **Editable LLM fields + regenerate-with-compare**
  - `*_original` + `*_user` column split on all four fields: `title`, `summary`, `description`,
    `description_long`. Display: `*_user ?? *_original`
  - `*_original` updated only when user explicitly accepts a regeneration into it
  - Per-field `...` kebab menu → diff modal: current value left, new LLM output right; user can
    edit the right panel before committing
  - Modal actions: **Accept New** (sets `*_original` = new, clears `*_user`), **Accept as Edit**
    (preserves `*_original`, sets `*_user` = new), **Discard** (no changes)
  - Clip start/end time editable via combo input: offset (±s from detected timestamp), absolute
    seconds, or MM:SS.s — all stored as `start_offset` / `end_offset` floats on `ClipCandidate`;
    original `start_time` / `end_time` are immutable

- **Header hamburger menu**
  - Trim header to: `+ Analyze` · `Highlight Reel` · `≡` (hamburger trigger)
  - **Score All button removed from UI** — CLI-only via `yuuclip score`
  - Hamburger dropdown: `🎭 Contexts` · `⌨ Controls` · `ℹ About` · `⬇ Download Log` · `⚙ Settings`
  - Controls modal: keyboard shortcut cheatsheet (replaces "?" button)

- **Confirmation dialogs on destructive actions**
  - All five existing `confirm()` calls converted to modals: delete video, delete clip,
    cancel analysis, delete track layout, delete context
  - New confirmation modals for: re-score clips per video (expensive), reset approvals per video
  - Reset approvals: new button in video detail header; modal shows "will reset N clips to unreviewed"
  - `confirm()` / `alert()` banned going forward — always use the app modal pattern

- **Timeline interval picker**
  - "Generate Timeline" opens a mini pre-generation settings modal (interval + unit selector, video
    length hint)
  - Min 10 s, default 15 min (900 s)
  - Persisted in `config.json`: `ui_timeline_interval_seconds` + `ui_timeline_interval_unit`
  - `GET /api/config` / `PATCH /api/config` endpoints for UI config persistence

- **Active-generation indicator** — client-side: buttons disable + show "Generating…" during
  in-flight calls

- **Export settings** — single "Export" button opens a pre-export settings modal: container picker
  (Match source / MKV / MP4), burn subtitles checkbox; `--container` flag added to CLI

- **Batch export** — "Export Clips" button → threshold modal with score slider, distribution preview
  ("14 clips above 0.6, 3 already exported → 11 will export"), re-export checkbox; single SSE
  progress stream in header

- **Auto-approve (simple)** — "Approve all above score" button with threshold input + confirmation
  modal showing clip count

- **Settings page** — accessible via hamburger ⚙ Settings; auto-saves; sections: UI · Scoring ·
  Whisper · Ollama · Export · Hot-words (placeholder) · Paths

- **Highlight reel editor** — ordered clip list (check/uncheck, ↑↓ reorder), "Random" transition
  option, encode time estimate, "Preview" plays exported clips as a playlist; `--clip-ids` added to
  CLI `reel` command

- **Prebuilt World Contexts** — 3 starter contexts seeded on server start: "Fantasy RP",
  "Action / FPS", "Variety Stream"; "Built-in" badge in Context Manager; `builtin` flag on
  `GET /api/contexts`

- **Context nudge in Analyze modal** — callout when no contexts exist ("No World Contexts set up
  — clip descriptions will be generic. Add one →"); inline "No context selected" note when contexts
  exist but none are checked, hidden when any box is ticked

- **Post-analysis toast** — "Analysis complete — N clips found" with a "Review" button (only shown
  when not already viewing that video); × to dismiss early; 8 s auto-dismiss

- **Analysis progress indicator** — active step pill ticks elapsed time from job start
  (e.g. "Transcribe · 2m 14s"), resetting to clean label on completion

### Medium-term (shipped)

- **Demo reel: separate reels folder + timestamp-based output filename** — reels saved to a
  dedicated `reels/` subfolder; default filename includes a timestamp
  (e.g. `highlights_20260625_143022.mkv`) to avoid silently overwriting previous reels; encode
  ETA shown during generation

- **Clip trim (in/out adjust)** — combo input (±offset / absolute seconds / MM:SS.s) stores
  `start_offset` / `end_offset` on `ClipCandidate`; original `start_time` / `end_time` are
  immutable. (Drag handles on the player timeline are a future enhancement — Phase 6.)

- **Export: match source format by default** — export modal defaults to "Match source"; CLI
  `--container` override added; stream copy (no re-encode) is the default

- **Analysis time estimate fix** — frontend passes `transcribe_tracks` from the selected track
  layout; backend uses it when provided

### Near-term (shipped)

- **Score All progress + starting log** — `[Starting LLM scoring for N clips…]` emitted at job
  start; per-clip `Scored i/N clips` messages streamed.

- **Regenerate All Summaries** — "Regenerate (auto-save)" button in video detail panel;
  `GET /api/videos/{id}/regenerate-summary` SSE endpoint auto-commits title+summary without a
  diff modal. Button only appears when a summary already exists.

- **Related clips** — "Find Similar" button in clip detail (visible when clip has a description)
  opens a scope-selection modal: current video pre-checked, other processed videos listed as
  individual checkboxes. Fires an Ollama call with `description_long` + candidate descriptions;
  returns up to 5 ranked results. Results stored on `ClipCandidate` as `related_clips_json` +
  `related_clips_at`. "Related Clips" section in the detail panel shows ranked clickable links
  (clicking navigates to that clip); stale indicator shown when `related_clips_at` predates the
  video's last rescore (`clips_scored_at`).

- **Video sidebar stats** — sidebar cards now show: total / approved / exported clip counts, a
  score min–max range bar (with numeric labels), and processing status badges (∅ summary / ∅ scored
  / ∅ timeline) when those steps haven't run yet for a video.

- **Caption / subtitle export** — export and batch-export modals replaced the "Bake captions"
  checkbox with a three-way Captions picker: **None** (default) / **Embed subtitle track** (softsub
  — stream-copy + SRT mux, fast) / **Burn in captions** (hardsub — re-encode, shows warning). Both
  single-clip and batch-export paths support all three modes. Softsub uses `mov_text` for MP4
  containers and `srt` for MKV/others.

- **Per-context score weights** — each World Context can now optionally override the global LLM
  scoring weights (funny / dramatic / action). Set in the Context editor under "LLM scoring weights"
  (blank = use global defaults). During rescore, weights are averaged across all assigned contexts
  that have overrides; contexts without overrides are ignored in the average.

- **New Recording panel** — `+ Analyze` navigates to a "New Recording" panel in the main area
  (replaces the Analyze modal). Sidebar stays live while the panel is open; clicking another video
  closes it with a discard prompt if a path has been entered. File probe runs inline after file
  selection (duration/estimate shown). SRT sidecar + embedded subtitle stream detection surfaces
  in the panel as a `--subtitle-source` option to skip Whisper.

- **SRT import / external subtitle support** — probe detects SRT sidecars and embedded subtitle
  streams; surfaced as options in the New Recording panel; selecting one skips Whisper and imports
  subtitles as transcript segments via `--subtitle-source`.

- **Quick Export / Full Export** — export modal has a "Prepend title card" checkbox; when checked
  the clip is re-encoded and a 3-second title card (description + timecode) is prepended using the
  reel pipeline.

- **Recording Segments** — a single recording file can be split into multiple independent segments,
  each processed as its own `Video` row with its own clips, contexts, title, summary, and timeline.
  - `Video` gains `parent_video_id` (FK, nullable), `segment_start_s`, `segment_end_s`; sidebar
    hides parent videos once split; segments appear as normal entries, auto-named "file — Part N".
  - **Split editor**: full-panel UI (not a modal); energy waveform rendered from per-second RMS data;
    click to place markers, drag to reposition, × to remove; video preview with seek-to-marker
    buttons; navigation guard (discard prompt when leaving with unsaved markers).
  - **Waveform generation**: `GET /api/videos/{id}/compute-waveform` SSE endpoint probes the video,
    creates `AudioTrack` rows if missing, extracts WAVs, and computes per-second RMS energy on demand.
  - **After-analysis split**: "Split Recording" action opens the editor; existing clips shown as dots
    on timeline; confirm creates segments and redistributes clips by `start_time` (partition only).
  - **Before-analysis split**: toggle in New Recording panel after probe; markers placed before
    analysis; sequential ingest jobs per segment via `_analyzeSegmentsSequentially`; FFmpeg `-ss`/`-to`
    trims audio extraction to each segment's time window.
  - **Reanalyze by video ID**: `--video-id` flag lets the ingest pipeline target an existing `Video`
    row; used by the reanalyze-after-split path.

### Phase 5 items shipped early

- **Merge adjacent clips** — "Merge ↑ prev" / "Merge ↓ next" buttons in the clip Actions card;
  merged clip spans both time ranges; consumed clip is deleted.

- **Manual score override** — "Set override" button in the Scoring card; prompt accepts 0–1 value;
  override replaces LLM score in sort order; both scores shown with an "override" badge; "Clear
  override" removes it.

---

## Phase 4 — Packaging + distribution (in progress; partial)

- **Electron wrapper** — app runs in its own Chromium window; Python backend launched as a child process
- **First-run setup wizard** (`setup.html`) — detects GPU, Ollama, FFmpeg; gives specific install guidance; skips on subsequent launches
- **NSIS installer** — built via `electron-builder`; creates desktop + Start Menu shortcuts; produced by `scripts/build-release.ps1`
- **Venv setup** — creates `.venv` and installs bundled wheel on first run; non-blocking so wizard stays responsive; detects version upgrades and reruns install
- **Loading screen** — shown between wizard and main window
- **Backend health check** — 60 s startup timeout; detects early crash; crash-safe shutdown on close
- **Rolling logs** — `venv-setup.log` for startup; rotating `yuu-clip.log` for server output
- **Version in footer** — dev: version + server start time; production: version + build date
- **Clean uninstall** — NSIS `deleteAppDataOnUninstall` removes `Roaming\yuu-clip`; custom macro in `installer.nsh` wipes `Local\yuu-clip` (venv) and `Local\yuu-clip-updater` on uninstall.
- **Bundled llama.cpp inference backend** — `llama-cpp-python` bundled in the wheel; `scoring/llm.py` supports both `llamacpp` (`.gguf` model file) and `ollama` backends; `llm_backend` / `llm_model_path` config fields; wizard LLM picker with `.gguf` file browser and Ollama model pull with progress bar. Ollama is now optional.
- Shipped versions: 0.1.1 → 0.1.8
