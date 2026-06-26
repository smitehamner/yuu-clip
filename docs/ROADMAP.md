# rp-clipper — Roadmap

## Status overview

| Phase | Description | Status |
|---|---|---|
| 1 | Core pipeline | Done |
| 2 | Signal enrichment + scoring | Done |
| 3 | Web UI | In progress |
| 4 | Packaging for distribution | Pending |
| 5 | Post-launch polish | Pending |
| 6 | Advanced features | Pending |

---

## Phase 1 — Core pipeline (Done)

- ffprobe video probing (duration, streams, fps, codec info)
- Interactive track labeling + saved track layouts (`profiles.json`)
- Audio extraction per track to 16 kHz mono WAV via FFmpeg
- Whisper transcription via faster-whisper (CTranslate2 backend)
- CUDA auto-detection using `ctranslate2.get_cuda_device_count()` (no PyTorch dep)
- Sliding window clip generation from silence gaps
- SRT caption sidecars (per-track + merged)
- `--burn-subs` for baked-in captions
- CLI: `rp-clip ingest / export / clips / status / probe`

---

## Phase 2 — Signal enrichment + scoring (Done)

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
- `rp-clip score` standalone re-scoring command; useful after changing world contexts
- `rp-clip demo` highlight reel compiler (FFmpeg xfade transitions + title cards)

---

## Phase 3 — Web UI (In progress)

### Done

- FastAPI + uvicorn server (`rp-clip serve`)
- Single-page frontend (vanilla JS, no build step)
- Video list and clip list sidebar with sub-score bars (F/D/A) and clip ID
- Clip detail: video player, score bars, description, transcript excerpt
- Approve / Reject / Reset workflow with status dot
- Export clip via SSE progress stream
- ~~Score All button with SSE progress~~ — removed from UI; CLI-only via `rp-clip score`
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

### Near-term

- [x] **Editable LLM fields + regenerate-with-compare** *(priority #1)*
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

- [x] **Header hamburger menu** *(absorbs "Controls UI polish")*
  - Trim header to: `+ Analyze` · `Build Reel` · `≡` (hamburger trigger)
  - **Score All button removed from UI** — CLI-only via `rp-clip score`; add interactive
    confirmation + GPU time warning to the CLI command
  - Hamburger dropdown (icon + text per item):
    `🎭 Contexts` · `⌨ Controls` · `ℹ About` · `⬇ Download Log` · `⚙ Settings`
  - Controls modal: keyboard shortcut cheatsheet (replaces "?" button)
  - About modal: licensing + credits (unchanged content, new entry point)

- [x] **Confirmation dialogs on destructive actions**
  - All five existing `confirm()` calls converted to modals: delete video, delete clip,
    cancel analysis, delete track layout, delete context
  - New confirmation modals for: re-score clips per video (expensive), reset approvals per video
  - Reset approvals: new button in video detail header; modal shows "will reset N clips to unreviewed"
  - `confirm()` / `alert()` banned going forward — always use the app modal pattern

- [ ] **Timeline interval picker**
  - "Generate Timeline" opens a mini pre-generation settings modal:
    - Interval: number input + unit selector (seconds / minutes)
    - Video length hint shown: "Video is 45 m — intervals longer than this produce one bucket"
    - Planned future slots: scene boundaries as markers toggle, energy overlay toggle
  - Min 10 s, default 15 min (900 s); no hard max cap (hint only)
  - Persisted in `config.json`: `ui_timeline_interval_seconds` + `ui_timeline_interval_unit`
  - YAML migration deferred to Settings page phase

- [ ] **Active-generation indicator**
  - Extend `/api/status` with `generating: [{"kind": "summary"|"description"|..., "video_id": N}
    | {"kind": "...", "clip_id": N}]`; server tracks active jobs in `ProjectContext`
  - Frontend polls on page load; matches entries to fields and lights up spinners
  - First generation (empty field): "Generating…" text + spinner in the empty slot
  - Regeneration (field has content): existing content stays visible, spinner badge overlaid
  - SSE start/end events set/clear the per-field loading state

- [ ] **Export settings** *(ships before batch export)*
  - Single "Export" button opens a pre-export settings modal:
    - Retranscribe: checkbox + model picker (reuses existing retranscribe options)
    - Rescore after retranscribe: checkbox
    - Output format: container picker (MKV default, MP4, etc.)
    - Burn subtitles: checkbox
  - Same modal reused by batch export

- [ ] **Batch export** *(requires export settings)*
  - "Export Clips" button in video detail panel → threshold modal:
    - Score threshold: slider + number input
    - Distribution preview: "14 clips above 0.6, 3 already exported → 11 will export"
    - "Re-export already exported clips" checkbox
  - Launches export settings modal before queuing
  - Single SSE progress stream in header: "Exporting 3 of 11…"
  - Collapsible per-clip status panel below the header; click the stream line to expand

- [ ] **Auto-approve (simple)**
  - "Approve all above score" button in video detail panel
  - Threshold input + confirmation modal showing clip count
  - Filter + bulk-select in sidebar deferred to the search + filter feature

- [ ] **Settings page** *(promoted from medium-term)*
  - Accessible via `⚙ Settings` in hamburger menu — replaces the main content area (not a modal)
  - Auto-save on change; inline consequence notes where needed:
    "Takes effect on next rescore" / "Takes effect on next ingest"
  - Sections: `UI` · `Scoring` · `Whisper` · `Ollama` · `Export` · `Hot-words` · `Paths`
  - Covers: timeline interval, score weights, scene mode, Whisper defaults,
    Ollama model/host/timeout, export format default
  - `Hot-words` and `Sensitive Content` sections reserved as placeholders (features are Phase 6)
  - `Paths` section: project folder, exports folder, scratch/working directory — key for
    non-default setups (different drives, external storage, shared network paths)
  - Config format stays JSON for now; YAML with nested sections deferred

- [ ] **Related clips**
  - "Find Similar" button in clip detail opens a scope-selection modal:
    current video pre-checked; other processed videos listed as individual checkboxes (no select-all)
  - Fires Ollama call with `description_long` + selected clips' descriptions
  - Results stored on `ClipCandidate`: `related_clips_json` + `related_clips_at` timestamp
  - "Related Clips" section in detail panel: ranked clickable links; stale indicator if older
    than last rescore
  - Top-N configured in Settings

- ~~**Clip deduplication**~~ — **On hold**: design unclear; revisit after transcript editing is stable

### Medium-term

- [x] **Demo reel: separate reels folder + timestamp-based output filename** — reels saved to a
  dedicated `reels/` subfolder; default filename includes a timestamp
  (e.g. `highlights_20260625_143022.mkv`) to avoid silently overwriting previous reels; encode
  ETA shown during generation.

- [x] **Clip trim (in/out adjust)** — implemented as part of *Editable LLM fields*: combo input
  (±offset / absolute seconds / MM:SS.s) stores `start_offset` / `end_offset` on `ClipCandidate`;
  original `start_time` / `end_time` are immutable. Drag handles on the player timeline are still
  a future enhancement (see Phase 6).

- [ ] **Export: match source format by default** — when exporting a clip, default the container and
  codec to match the source video instead of always writing MKV. User overrides are a future option.

- [ ] **Quick Export vs Full Export** — "Quick Export" re-encodes just the clip segment with no
  title card or transcript overlay; expected to be fast enough to use as an in-app preview.
  "Full Export" is the existing behavior. No disk-filling auto-preview cache — the user must
  explicitly trigger an export. Option to save to a custom path (user's choice about removable
  drives and access implications).

- [ ] **SRT import / external subtitle support** — detect embedded subtitle tracks and `.srt`
  sidecars adjacent to the source file; offer them as alternatives to running Whisper.
  Also allow the user to point to an external `.srt` file. Eliminates Whisper CPU time for
  users who already have subtitles from another source.

- [ ] **Analysis time estimate fix** — inspection preview counts all audio tracks instead of only the ones
  the selected track layout will actually transcribe; resolve the track layout selection before
  computing the estimate

### Pre-packaging documentation

- [ ] **Performance and storage notes** — document expected install size, per-session disk
  usage (audio extracts, Whisper models, exports), and how quickly disk fills with typical use.
  Include recommended specs (RAM, GPU, storage type). Note the SSD vs. external HDD tradeoff:
  large source files on an external drive is common, but the working project directory
  (DB, extracts, exports) benefits from local SSD. The project folder location picker in the
  first-run wizard should surface this recommendation.

---

## Phase 4 — Packaging + distribution (Pending)

Goal: friends can install and use without knowing Python.

### Distribution approach

Electron wrapper is the likely target — it embeds Chromium and presents the app in its own window
rather than opening in the user's browser, which makes it feel like a native desktop app. The
Python backend would run as a bundled subprocess.

| Option | Pros | Cons |
|---|---|---|
| Electron wrapper | Native desktop feel, auto-update, self-contained window | Adds JS build step; large bundle |
| PyInstaller bundle | No Python needed, simpler build | ~300 MB binary; no auto-update |
| `pip install rp-clipper` | Simple for Python users | Requires Python + pip knowledge |
| Docker | Fully self-contained | Requires Docker; GPU passthrough is extra setup |

### Bundling AI dependencies

- **Ollama**: investigate `llama.cpp` (or `ollama-python` with an embedded server) to avoid
  requiring a separate Ollama install — a bundled inference backend would be a much smoother
  first-run experience
- **Whisper**: already bundled via `faster-whisper` / CTranslate2; weights download on first use

### GPU support

- **NVIDIA CUDA**: already supported via CTranslate2's CUDA backend
- **AMD / Intel**: investigate ROCm (AMD) and OpenVINO (Intel) support in CTranslate2 — most
  people are likely on NVIDIA but worth evaluating for the packaging phase
- First-run wizard should detect GPU, CUDA version, and Ollama and give specific guidance when
  something is missing or in the wrong order (e.g. Ollama installed before CUDA drivers leads to
  CPU-only inference even after adding CUDA later)

### Refactor targets for Phase 4

- First-run wizard: detect FFmpeg, check GPU / CUDA, check Ollama, pick project folder; option in
  main UI to re-run the wizard
- Wizard assists with selecting and downloading Whisper models, text LLM models, and (optionally)
  vision models — with licence and hardware guidance for each
- Disabled UI options must clearly indicate which prerequisite is missing and link to the wizard
- One-click installer / bundled release
- **Choose a licence** — currently unlicensed (all rights reserved, smitehamner). Options:
  MIT (permissive), GPL-3 (copyleft), or source-available. Decide before any public release.
  Update `LICENSE`, `pyproject.toml`, and the About modal once chosen.
- **Linux compatibility testing** — verify the full pipeline works on a Linux host; identify any
  Windows-only assumptions in path handling, file pickers, or process management.

---

## Phase 5 — Post-launch polish (Pending)

Smaller improvements and UX debt that don't block initial distribution but are high-value for
regular users.

- [ ] **Search + filter** — text search across descriptions and transcripts; filter sidebar by score
  range, status, or tag. Advanced users can use regex.

- [ ] **Merge adjacent clips** — button to combine two consecutive candidates into one; useful when a
  moment spans a silence gap. Options: include the gap from the source video (seamless), or insert a
  scene transition to keep it compact — let the user choose at merge time.

- [ ] **Demo reel: random transition + advanced editor** — add "random" as a transition option in
  the demo reel builder. Separately, add an advanced clip list editor: reorder approved clips via
  drag-and-drop, add clips from rejected or unrated pool, remove individual clips before compiling.

- [ ] **Batch processing status panel** — collapsible status summary bar at the top of the clips
  view showing active/queued/completed job counts; clicking expands per-job detail. Long-term: move
  the raw log view behind a "Developer" toggle.

- [ ] **Per-step analysis progress percentage** — step chips in the header already advance through
  stages; add a completion % within each step *(UX debt: Goal-Gradient Effect)*

- [ ] **Detail panel chunking** — group the clip detail panel into cards: Summary → Actions →
  Transcript, rather than a flat list *(UX debt: Chunking)*

- [ ] **Project switcher in UI** — dropdown to switch between project directories without
  restarting the server

- [ ] **Manual score override** — let the user set a ground-truth score per clip via a slider.
  Display the user score prominently with a distinct indicator (not replacing the LLM score —
  show both).

- [ ] **Built-in user manual** — in-app help: what each score means, contexts workflow, ingest
  walkthrough, keyboard shortcuts, export options. Low priority until the UI is more stable.

- [ ] **Multi-session grouping** — treat multiple OBS files from one play session as a single
  project with a unified timeline

---

## Phase 6 — Advanced features (Pending)

Complex, specialized, or AI-heavy features that are valuable but don't need to block distribution.

### Scoring and signal enrichment

- [ ] **Hot-word / phrase config** — each entry: phrase, match mode (exact / case-insensitive /
  LLM-semantic), score boost (float), boost target (overall or a specific sub-score).
  LLM-semantic is opt-in per entry with a visible GPU time warning. Exact + case-insensitive
  matching runs at ingest and rescore time; LLM-semantic runs via explicit per-video "Scan" button.
  Tags on sidebar card: pills if ≤3 matches, count pill `🔥 4` if more; full list in detail panel.
  Lives in Settings page under the `Hot-words` section.

- [ ] **Related clips** — "Find Similar" button in clip detail opens a scope-selection modal:
  current video pre-checked; other processed videos listed as individual checkboxes (no select-all).
  Fires Ollama call with `description_long` + selected clips' descriptions. Results stored on
  `ClipCandidate`: `related_clips_json` + `related_clips_at` timestamp. "Related Clips" section
  in detail panel: ranked clickable links; stale indicator if older than last rescore. Top-N
  configured in Settings.

- [ ] **Laugh / non-speech sound detection** — detect laughter and notable non-speech audio events
  (sound effects, reactions) as a separate scoring signal from the Funny sub-score, not a modifier
  to it. Surfaced as its own attribute so users can filter/sort by it independently.

- [ ] **Image-based clip analysis** — optional, clip-only feature: sample frames at a configurable
  interval and send them to a vision model to enrich clip descriptions and scoring. Requires a
  separately downloadable vision model (permissive licence required — clips may be monetized by
  users). Configurable: on/off toggle, frames-per-clip frequency.

- [ ] **Model selection and capability gating** — research and recommend text LLM models that are
  better-tuned for clip description/scoring and carry permissive licences suitable for monetized
  content. Similarly for the vision model (see image-based analysis above). Disabled UI options
  should detect whether the required model is installed and link to the wizard if not.

### Transcript and speaker features

- [ ] **Speaker diarization** — identify who is speaking and when; assign speaker labels to
  transcript segments. Unlocks: transcript editing (speaker-grouped), per-speaker subtitle styles,
  score boost per named character.

  pyannote.audio 3.x (the most accurate option) requires a HuggingFace account token and
  accepting model terms — an extra step for non-technical users. Token-free alternatives worth
  evaluating: **NVIDIA NeMo** (`msdd_multiscale_diarizer` — no token, competitive accuracy, heavier
  install) and **SpeechBrain** (MIT licence, no token, lighter). whisperX uses pyannote under the
  hood so has the same token requirement.

  Preferred path: evaluate NeMo and SpeechBrain first; fall back to pyannote only if they're
  clearly inferior. Whichever is chosen, the token setup (if any) should be part of the first-run
  wizard.

- [ ] **Transcript editing** — inline editable text area for `TranscriptSegment.text`; lets the user
  fix character names, misspellings, and game-specific jargon before re-scoring. Requires speaker
  diarization first so the transcript has per-speaker grouping.

- [ ] **Transcript name correction** — after speaker diarization maps clusters to character names,
  auto-suggest replacements for mis-transcribed names that *other* speakers say (e.g. Whisper
  hears "You" when someone is saying the name "Yuu"). Must be speaker-scoped and confidence-gated;
  surfaced as a reviewable diff before committing.

- [ ] **Subtitle style options** — font, size, colour, position for burned-in subtitles. With
  speaker diarization: per-speaker colour/style so different characters are visually distinct.

### Export and delivery

- [ ] **Export presets + per-format management** — saved output profiles (YouTube 1080p, Discord
  8 MB cap, TikTok 9:16 crop) with a picker at export time; support exporting a clip in multiple
  formats; track each format as a separate file with individual delete; distinguish "regenerate this
  format" from "export a new format"

- [ ] **Auto captions on clip export** — Whisper-generated captions burned into exported clips.
  Relatively straightforward addition; prerequisite for the clip export editor's captions preview.

- [ ] **Clip export editor** — in-browser editor launched before final export. Full scope:
  trim handles (adjust clip start/end), drag-to-position 9:16 crop box for Shorts/TikTok
  framing, and a live preview of burned-in captions if caption export is enabled.
  Reference UX: Twitch clip editor. Natural dependency order: Vertical crop and Auto captions
  should land first, then the editor ties them together.

- [ ] **Vertical crop / Shorts export** — 9:16 output for TikTok / YouTube Shorts; requires
  face/webcam tracking (YOLO or MediaPipe) to auto-frame the crop region.

### Content safety and moderation

- [ ] **Sensitive content detection** — a "Sensitive Terms" list, kept entirely separate from
  Hot-words (which affects score). Two categories:
  - **Privacy Terms** — real names, identifying info the user doesn't want surfacing in shared
    clips (e.g. a family member calling their name from off-screen, home address)
  - **Censor Words** — profanity and platform-restricted language; useful for flagging clips
    before posting to kid-friendly platforms
  Per-term match modes: exact, case-insensitive, or fuzzy/phonetic. No score impact — warning/flag
  only. Clips with matches get a warning badge on the sidebar card and a flagged-terms section in
  the detail panel. `Flagged` filter tab added alongside `All · Unreviewed · Approved · Rejected`.
  Lives in Settings page under a `Sensitive Content` section.

- [ ] **Copyright content detection** — detect music in the audio track that might trigger
  copyright claims or content strikes on platforms like YouTube. Requires audio fingerprinting
  against a reference database (e.g. AcoustID or similar). No clear implementation path yet —
  needs evaluation of fingerprinting libraries, database licensing terms, and accuracy on gaming
  audio. Deferred until sensitive content detection is stable.

### Generalisation

- [ ] **Content-type presets** — configurable specialization for different streaming styles so the
  LLM prompts and scoring weights are tuned without manual config editing:
  - RP / narrative (character names, dramatic moments, lore drops)
  - Competitive gaming (clutch plays, comebacks, callouts)
  - Casual / let's play (funny moments, reactions, commentary)
  - Speedrun (split times, PB attempts, mistakes)
  - Podcast / conversation (topic changes, memorable quotes)
  Minimal/generic default for users who don't match a preset. Each preset ships with recommended
  score weights, hot-words, and LLM prompt language. Prerequisite for the rename/generalisation work.

- [ ] **Generalise for any video content** — remove RP-specific assumptions from the tool name,
  CLI, config paths, and LLM prompts. Replace hard-coded RP context prompt with a free-text
  "session context" field; character vocabulary becomes a user-supplied list; rename app and CLI;
  audit remaining RP-specific language in UI and prompts.
  *Design the rename before touching code — it's a wide change.*
  Content-type presets (above) should be designed first so the rename ships with a clear value
  proposition for non-RP users.

- [ ] **URL import (Twitch VOD / YouTube)** — let the user paste a URL instead of a local file path.
  Scope: download via `yt-dlp` with a live progress bar in the UI before analysis starts; store
  source URL, scraped title, upload date, game/category, and streamer name as new columns on
  `Video`; hand off to the normal ingest pipeline automatically after download completes.

---

## Future considerations (no phase yet)

Items wanted long-term but not yet assigned to a phase.

- [ ] **Clips vs Scenes** — introduce a second candidate type: "Scenes" are longer contextual
  moments (1–5 min, may include pauses and story arc) vs. "clips" (15–90 s punchy bits). Design
  first: separate pipeline? flag on `ClipCandidate`? separate table? separate review UI?
  Depends on transcript editing being stable.

- [ ] **Score learning loop** — use accumulated manual score overrides (see Phase 5) to tune the
  prompt or scoring weight vector semi-automatically. Requires a meaningful corpus of overrides
  before it's worthwhile.

---

## Known issues (fixed)

- **`_probe_duration` returns `'N/A'`** — `ffprobe stream=duration` returns the literal string
  `N/A` for some containers (e.g. MKV exports); the fallback to `format=duration` was skipped
  because the empty-string check didn't catch `'N/A'`. Fixed in `demo.py` — both the stream and
  format probes now treat `N/A` as missing, with a clear error if both fail.

## Known issues (code quality)

- **Analysis time estimate counts all tracks** — tracked as a Phase 3 medium-term item above
- **`_ingest_one` has many parameters** — consider a dataclass if it grows further
- **`ingest/labeler.py:_label_interactive`** — ~100 lines mixing UI and logic; candidate for split
- **JS in `index.html` (~1737 lines)** — no-build-step SPA; consider ES modules if it grows further
- **No integration test for `demo_events` SSE** — `demo.py:demo_events` passes `ctx` to `subprocess_sse` (needed for graceful shutdown and `/api/status`); this path has no test coverage and was silently broken before the Phase 3 bug-hunt pass
- **Ollama scoring errors are silent** — `LLMScorer.score()` degrades gracefully by returning `tags=["llm_error"]` with no log emission; a failure during `score_all` is only detectable by inspecting clip tags, not the server log; add a `WARNING` log in `LLMScorer.score()` when Ollama returns an error

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
