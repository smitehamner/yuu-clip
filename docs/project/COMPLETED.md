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

- **Getting Started guide** — hamburger menu item "🚀 Getting Started" opens a modal covering the
  four-step workflow (Analyze → Review → Export → Build Reel), score definitions (Overall / Funny /
  Dramatic / Action), key concept definitions (Track layout, World context), and quick tips including
  search and keyboard navigation. Escape key closes it.

- **Clip search + score filter** — search input and minimum-score dropdown added above the status
  filter tabs in the clip sidebar. Text search matches against description, long description, and
  transcript excerpt (client-side, case-insensitive). Score threshold options: Any / 0.3+ / 0.5+ /
  0.7+ / 0.9+. Both filters compose with the existing status tabs and sort order. Empty state message
  is context-aware ("No clips match the current filters" vs the standard prompt). All filter state
  survives clip list refreshes.

- **Merge adjacent clips** — "Merge ↑ prev" / "Merge ↓ next" buttons in the clip Actions card;
  merged clip spans both time ranges; consumed clip is deleted.

- **Manual score override** — "Set override" button in the Scoring card; prompt accepts 0–1 value;
  override replaces LLM score in sort order; both scores shown with an "override" badge; "Clear
  override" removes it.

### Phase 6 items shipped early

- **Speaker diarization — infrastructure** — `DiarizationClient` ABC with Null (default, off)
  and Pyannote backends; factory pattern mirrors `LLMClient`. Config fields: `diarization_backend`,
  `huggingface_token`. Post-transcription pass in `whisper_runner.py` populates
  `TranscriptSegment.speaker_label`. `_build_excerpt` in `windower.py` formats
  `transcript_excerpt` with `SPEAKER_XX:` prefixes when any segment has a label, so LLM scoring
  and the UI transcript view benefit automatically. Settings UI: Speaker labels section, backend
  selector, HF token field, one-click `pip install pyannote.audio` button with live log.
  Roadmap backends: SpeechBrain (Apache 2.0, no HF gating), NeMo TitaNet (Apache 2.0, no token).

- **Per-analysis speaker-labels toggle** — the New Recording → Advanced options panel has a
  Speaker labels checkbox, pre-set from the global `diarization_backend` default and disabled
  until a HF token is saved. Plumbed through a `--diarize/--no-diarize` CLI override (overrides
  `config.diarization_backend` for the run), `IngestRequest.diarize` (tri-state), and
  `_build_analyze_cmd`. The time estimate gains a "Speaker labels" step (inserted after
  Transcribe) sized by `_DIARIZATION_RT_SPEED` × transcribed tracks when diarization is on.

- **One-click optional dependency install** — generic `POST /api/install/{slug}` endpoint with
  allowlist (`pyannote`, `llamacpp`, `anthropic`); runs pip in a subprocess and streams output via
  SSE using `fetch` + `ReadableStream` (EventSource only supports GET). Install buttons added to:
  speaker labels section (pyannote.audio), llamacpp LLM section, Claude API section. About modal
  dependency table split into Required and Optional sections. A paired `GET /api/install/{slug}`
  reports current install state via `importlib.util.find_spec` (import names mapped separately
  from pip names); Settings refreshes each button to "✓ Installed / Reinstall" on load so an
  already-installed package no longer reverts to "Install" on refresh.

- **Laugh detection scorer** — `LaughScorer` with three configurable modes:
  - `transcript` (default): regex-matches Whisper non-verbal markers (`[laughs]`, `[laughter]`,
    `[chuckles]`, `haha`, `lmao`, etc.) and normalises by clip duration (4+ events/min → 1.0).
    No extra dependencies.
  - `audio`: spectral burst-rhythm analysis of the extracted WAV; FFT of a 50 ms energy envelope
    detects power in the 4–12 Hz laughter-cadence band. Uses PyAV + numpy (existing deps). WAV
    reads cached per-track within a scoring run.
  - `model`: HuggingFace `audio-classification` pipeline searching for "laugh" in top-20 predictions.
    Recommended model: `MIT/ast-finetuned-audioset-10-10-0.4593` (~350 MB, auto-downloads on first
    use). Requires `pip install "yuu-clip[laugh-model]"` (`transformers`, `torch`, `torchaudio`,
    `soundfile`).
  - Contributes to `score_funny`. Configurable weight (default 1.5), mode, and model ID in Settings.
  - New config fields: `scorer_laugh_enabled`, `scorer_laugh_mode`, `scorer_laugh_model_id`,
    `scorer_laugh_weight`. Tags: `laugh_transcript`, `laugh_audio`, `laugh_model`,
    `laugh_no_transcript`, `laugh_no_wav`.

---

## Phase 4 — Packaging + distribution (done)

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
- **Disabled UI linking to wizard** — `/api/prereqs` endpoint checks FFmpeg and LLM config at boot; if FFmpeg is missing, a banner appears in the recording panel with a "Re-run Setup Wizard" link and the analyze button stays disabled; "Re-run Setup Wizard" hamburger button now shown whenever running inside Electron
- **Whisper model licence in wizard** — MIT licence note added to the wizard's Whisper checklist row
- **Live install progress** — venv setup window streams pip output (via `--progress-bar raw`) as a running status line during the long "Install yuu-clip" step, plus a "this can take a few minutes" note, so users see activity instead of a silent spinner
- **Working clipboard** — Edit menu (cut/copy/paste/select-all) added so keyboard shortcuts work in the main app; setup wizard allows selecting command text and adds "Copy" buttons for the `winget` / `ollama pull` commands
- **Glossary ships in releases** — the in-app Terminology Glossary previously read `docs/dev/GLOSSARY.md`, which isn't in the wheel, so it 404'd in built installs. Now a hand-written creator-facing `web/static/glossary.md` (no code names / dev sections) is bundled and served from `/api/glossary`; the dev glossary stays authoritative with a sync note
- Shipped versions: 0.1.1 → 0.1.8

---

## Notification sounds

- **Per-event completion sounds** — play a sound when Analysis, Re-score, Highlight reel, or Export finishes, plus a distinct error cue for any failed job. All events off by default; opt in per event from a new **Notification sounds** section in Settings.
- **Built-in Windows sounds** — served from `%SystemRoot%\Media` via `/api/sounds`; only sounds present on the machine are offered.
- **Custom audio upload** — raw-body `POST /api/sounds/upload` (no `python-multipart` dependency) stores the file under `.yuu-clip/sounds/`, path-traversal guarded, 25 MB cap; appears in every event dropdown and survives reloads.
- **Playback controls** — global volume slider, per-event Preview, and a floating **Stop sound** button so a long clip / full song can always be silenced. State persists in `localStorage`, applied immediately.
- New route `web/routes/sounds.py`; client module `static/sounds.js` (`SoundFx.play(event)`); triggers wired into analyze / rescore / reel / export / SSE-error paths. Covered by `tests/test_sounds.py`.

---

## Pipeline progress + analysis run history (Stage 1)

- **Stage estimate tooltips** — each progress pill shows its pre-run time estimate on hover, mapped from `/api/estimate` step names to `INGEST_STEPS` via an `estMatch` list; estimate steps saved on `AppState.lastEstimateSteps` in `renderEstimate`.
- **Immediate sidebar** — a recording appears in the sidebar the instant analysis starts: a client-side "Analyzing…" placeholder (`_analyzingPlaceholderLi`) shown until the DB row exists, then the real row with a live stage + spinner. Sidebar refreshes on stage transitions via a debounced `loadVideos()` in `updateJobUI`.
- **Run metadata capture** — `cli/_run_meta.py` (`StageRecorder` + `build_run_json`) times each pipeline stage and records effective settings and the CPU/GPU device each ML stage used; stored as JSON on new `Video.analyze_run_json` / `analyze_started_at` columns (guarded auto-migration, no DB wipe). Capture is best-effort — a metadata failure never aborts the analyze run.
- **Run metadata card** — `renderVideoDetail` shows a collapsible "Last analysis" card (`_renderRunMetaCard`): total time, GPU/CPU badge + per-stage device, settings, and per-stage timing bars. Exposed via `analyze_run` in `_video_dict`.
- Covered by `tests/test_run_meta.py` (StageRecorder, `build_run_json`, settings, serializer round-trip). Full API suite 878 passed; UI suite green.
- Deferred to Stage 2: analysis surviving a page refresh (subprocess-lifecycle decoupling + server progress buffer) and the live in-detail progress panel driven by that server state.

## Analysis survives a page refresh (Stage 2)

- **Decoupled subprocess lifecycle** — the analyze subprocess is now owned by a reattachable `AnalyzeJob` (`web/analyze_job.py`) instead of `subprocess_sse`. It is launched once (by `/api/analyze/start` queuing the command, `/api/analyze/events` launching it), its stdout is pumped into an in-memory broadcast buffer, and it is terminated **only** on explicit cancel or server shutdown — never when an SSE client disconnects. Closing the browser tab no longer kills the run. (`subprocess_sse` is unchanged and still owns the short score/export/retranscribe/install jobs, which stay tied to their stream.)
- **Replay-then-live reconnect** — `/api/analyze/events` reattaches: a reconnecting client atomically snapshots the buffer and subscribes, replays everything emitted so far, then continues live to the `__DONE__` sentinel. A finished job is replayed too, so a refresh landing right after completion still shows the final state. Multiple concurrent subscribers each receive every line exactly once.
- **Page-load reattach** — `/api/status` now reports `analyze_filename` / `analyze_video_id` for the running job; `boot.js` calls `reattachAnalysis()` when it sees one, rebuilding the sidebar row, header progress bar, and the in-detail progress panel purely by replaying the job's output through the normal `streamSSE` path.
- **In-detail live panel** — `renderVideoDetail` shows an `analysis-live` card while a recording is being analyzed (`_isVideoBeingAnalyzed`), mirroring the header stage pills and showing elapsed time from the server's `analyze_started_at` (so it stays accurate across a refresh). Kept in sync from `updateJobUI` / `_tickJobTimer` via `_syncAnalysisLivePanel`.
- **Interrupted-run reconciliation** — on server start, `_fail_interrupted_analyses` flips any `Video` stuck at `status='extracting'` (a subprocess killed mid extract/transcribe) to `failed`, so the UI stops showing an eternal spinner and the user can re-run. New `failed` → "Analysis interrupted" status label.
- Covered by `tests/test_reattach.py` (AnalyzeJob broadcast/replay/concurrent-subscribers/cancel, `/api/status` identity, startup fail-reconciliation) plus updated `test_analyze.py` reattach/replay cases. Full API suite 886 passed; UI suite 133 green.
