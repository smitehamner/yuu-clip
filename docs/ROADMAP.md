# yuu-clip — Roadmap

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
- `--bake-captions` for baked-in captions
- CLI: `yuuclip analyze / export / clips / status / probe`

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
- `yuuclip score` standalone re-scoring command; useful after changing world contexts
- `yuuclip reel` highlight reel compiler (FFmpeg xfade transitions + title cards)

---

## Phase 3 — Web UI (In progress)

### Done

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
  - Trim header to: `+ Analyze` · `Highlight Reel` · `≡` (hamburger trigger)
  - **Score All button removed from UI** — CLI-only via `yuuclip score`; add interactive
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

- [x] **Timeline interval picker**
  - "Generate Timeline" opens a mini pre-generation settings modal:
    - Interval: number input + unit selector (seconds / minutes)
    - Video length hint shown: "Video is 45 m — intervals longer than this produce one bucket"
    - Planned future slots: scene boundaries as markers toggle, energy overlay toggle
  - Min 10 s, default 15 min (900 s); no hard max cap (hint only)
  - Persisted in `config.json`: `ui_timeline_interval_seconds` + `ui_timeline_interval_unit`
  - `GET /api/config` / `PATCH /api/config` endpoints for UI config persistence
  - YAML migration deferred to Settings page phase

- [x] **Active-generation indicator** — client-side: buttons disable + show "Generating…" during in-flight calls; per-field spinners deferred (server-side tracking not yet implemented)
  - Extend `/api/status` with `generating: [{"kind": "summary"|"description"|..., "video_id": N}
    | {"kind": "...", "clip_id": N}]`; server tracks active jobs in `ProjectContext`
  - Frontend polls on page load; matches entries to fields and lights up spinners
  - First generation (empty field): "Generating…" text + spinner in the empty slot
  - Regeneration (field has content): existing content stays visible, spinner badge overlaid
  - SSE start/end events set/clear the per-field loading state

- [x] **Export settings** *(ships before batch export)*
  - Single "Export" button opens a pre-export settings modal:
    - ~~Retranscribe: checkbox + model picker~~ — deferred; use the separate Retranscribe button
    - ~~Rescore after retranscribe: checkbox~~ — deferred
    - Output format: container picker (Match source default, MKV, MP4)
    - Burn subtitles: checkbox
  - `--container` flag added to `yuuclip export` CLI command
  - Same modal reused by batch export

- [x] **Batch export** *(requires export settings)*
  - "Export Clips" button in video detail panel → threshold modal:
    - Score threshold: slider + number input
    - Distribution preview: "14 clips above 0.6, 3 already exported → 11 will export"
    - "Re-export already exported clips" checkbox
  - Launches export settings modal before queuing
  - Single SSE progress stream in header: "Exporting 3 of 11…"
  - Collapsible per-clip status panel below the header; click the stream line to expand

- [x] **Auto-approve (simple)**
  - "Approve all above score" button in video detail panel
  - Threshold input + confirmation modal showing clip count
  - Filter + bulk-select in sidebar deferred to the search + filter feature

- [x] **Settings page** *(promoted from medium-term)* — accessible via hamburger ⚙ Settings; auto-saves; sections: Whisper, Ollama, Scoring weights, Analysis defaults, UI, Paths
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

- [ ] **Prebuilt World Contexts**
  - Ship 2–3 starter contexts: "Fantasy RP", "Action Game / FPS", "Variety Stream"
  - Appear pre-populated in the Context Manager with a "Built-in" badge
  - All fields are editable and the user can clone or delete them
  - Avoids the blank-slate problem for first-time users

- [ ] **Context nudge in Analyze modal**
  - If no World Contexts exist when the modal opens: soft callout "No World Contexts set up —
    clip descriptions will be generic. [Add one →]" linking to the Context Manager
  - If contexts exist but none are checked: milder reminder "No context selected"

- [ ] **Per-context score weights**
  - Each World Context gets optional score weight overrides: action, funny, dramatic
  - When a video is rescored using that context, its weights override the global defaults
  - Configured in the Context editor UI alongside the existing fields
  - Allows e.g. an "Action Game" context to set action=0.8, dramatic=0.2 without touching
    global Settings — user sets it once per context and it follows the context everywhere

- [ ] **Post-analysis toast**
  - When an analysis SSE stream completes, fire a persistent toast: "Analysis complete — N clips found"
    with a "Review" link that selects the video in the sidebar
  - Only shown if the user is not already viewing that video's clip list
  - Dismissable with ×

- [ ] **Analysis progress indicator**
  - Stage label + elapsed timer derived from SSE log lines already streamed
    ("Transcribing… 2 m 14 s elapsed")
  - Not a real percentage — reduces "did it crash?" anxiety without requiring Whisper progress hooks

- [ ] **Caption / subtitle export**
  - Export modal gains two new options:
    - **Embed subtitle track** (softsub) — adds an SRT track to the container; stream copy,
      no re-encode; fast
    - **Burn in captions** (hardsub) — renders captions onto the video frames; requires re-encode;
      UI shows a re-encode warning
  - SRT generated from existing `TranscriptSegment` rows (already available per clip)
  - Both options ship together; softsub is the default when captions are enabled

- [ ] **New Recording panel (replaces Analyze modal)**
  - `+ Analyze` in the header navigates to a "New Recording" panel that takes over the detail area
    instead of opening a modal
  - Sidebar stays live while the panel is open; clicking another video away cancels with a
    discard prompt if configuration has been started
  - File probe runs inline after file selection (already happens today — duration/estimate shown);
    result feeds into split marker UI if the user wants to pre-split before analysis
  - See *Recording Segments* below for the pre-split flow

- [ ] **Recording Segments**

  A single recording file can be split into multiple independent segments, each processed as its
  own video entry with its own clips, contexts, title, summary, and timeline.

  **Data model**
  - `Video` gains: `parent_video_id` (FK → `Video`, nullable), `segment_start_s` (float, nullable),
    `segment_end_s` (float, nullable)
  - Original (unsplit) video: hidden from sidebar after split, kept in DB as the source record
  - Each segment is a full `Video` row — same source file path, its own time range, its own data
  - Segments can be re-split recursively (a segment is just a Video with a range)

  **Sidebar display**
  - Segments appear as normal video entries in the flat sidebar list
  - Auto-named on creation ("session.mkv — Part 1"); user can rename at any time (same as video title)
  - Original hidden; segments replace it

  **Split editor**
  - Takes over the main detail panel (not a modal); `← Back` breadcrumb in header to exit
  - Sidebar stays live while editor is open; clicking away triggers a discard prompt if markers
    have been placed
  - Timeline visualisation: energy waveform + scene boundary markers as a visual layer
  - Suggestion pins from energy valleys and scene gaps; click a pin to promote it to a real marker
  - Click anywhere on timeline to place a marker; drag to reposition; × to remove
  - Each resulting segment between markers shows: auto-generated title (editable inline), context
    picker, per-segment analysis settings (Whisper model, etc.) with "use same settings for all"
    toggle

  **Before-analysis split**
  - Accessed from the New Recording panel after file probe returns duration
  - User places markers and configures each segment before starting analysis
  - Analysis runs as separate ingest jobs per segment (FFmpeg trims audio to a temp slice per range)

  **After-analysis split**
  - "Split Recording" action on an analyzed video opens the split editor
  - Existing clips shown as dots on the timeline to help the user see where activity is
  - After placing markers and confirming, user chooses one of three options:
    - **Partition only** — redistribute existing clips to segments by `start_time`; no reanalysis
    - **Reanalyze — replace all** — clean-slate ingest per segment; replaces all existing clips
    - **Reanalyze — keep exported** *(suggested default)* — preserves clips already exported;
      replaces all others; reruns ingest on each segment

- [x] **Highlight reel editor** — "Highlight Reel" modal redesigned: ordered clip list (check/uncheck, ↑↓ reorder), "Random" transition option, encode time estimate, "Preview" plays exported clips as a playlist in the main player; `--clip-ids` added to CLI `reel` command

- ~~**Clip deduplication**~~ — **On hold**: design unclear; revisit after transcript editing is stable

### Medium-term

- [ ] **Panel navigation UX direction**
  - Modals remain for quick confirmations and simple pickers
  - Multi-step flows (New Recording, Split Editor, eventually Reel Builder and Context Manager)
    take over the main detail panel instead of opening modals
  - Navigation: `← Back` breadcrumb in the panel header; clicking a sidebar video also navigates
    away with a discard prompt if there are unsaved changes
  - Tabs are appropriate for *within-view* navigation (e.g. Clips / Transcript / Timeline tabs
    on a video detail page) — not for top-level navigation between major views
  - Migrate existing modals to panel views incrementally; start with New Recording and Split Editor

- [x] **Demo reel: separate reels folder + timestamp-based output filename** — reels saved to a
  dedicated `reels/` subfolder; default filename includes a timestamp
  (e.g. `highlights_20260625_143022.mkv`) to avoid silently overwriting previous reels; encode
  ETA shown during generation.

- [x] **Clip trim (in/out adjust)** — implemented as part of *Editable LLM fields*: combo input
  (±offset / absolute seconds / MM:SS.s) stores `start_offset` / `end_offset` on `ClipCandidate`;
  original `start_time` / `end_time` are immutable. Drag handles on the player timeline are still
  a future enhancement (see Phase 6).

- [x] **Export: match source format by default** — export modal defaults to "Match source"; CLI `--container` override added; stream copy (no re-encode) is the default.

- [ ] **Quick Export vs Full Export** — current export is already "quick" (stream copy, no title card). Full Export (with title card, like reel clips) is a future addition.

- [ ] **SRT import / external subtitle support** — probe now detects embedded subtitle streams and `.srt` sidecars and returns them in the probe response. Using them to skip Whisper requires pipeline changes still TODO.

- [x] **Analysis time estimate fix** — frontend passes `transcribe_tracks` from the selected track layout; backend uses it when provided

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
| `pip install yuu-clip` | Simple for Python users | Requires Python + pip knowledge |
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

- [ ] **Auto captions on clip export** — pulled forward to Phase 3 Near-term as *Caption / subtitle
  export* (softsub + hardsub). See Near-term section. Full caption styling (font, colour,
  per-speaker) is still Phase 6.

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

- [ ] **Sidebar grouping for segments** — once Recording Segments ships (Phase 3), consider a
  collapsible parent row "session.mkv (3 segments)" with indented children as an alternative to
  the flat list. Deferred until the flat list proves insufficient in practice.

- [ ] **Score learning loop** — use accumulated manual score overrides (see Phase 5) to tune the
  prompt or scoring weight vector semi-automatically. Requires a meaningful corpus of overrides
  before it's worthwhile.

---

## Known issues (fixed)

- **`_probe_duration` returns `'N/A'`** — `ffprobe stream=duration` returns the literal string
  `N/A` for some containers (e.g. MKV exports); the fallback to `format=duration` was skipped
  because the empty-string check didn't catch `'N/A'`. Fixed in `reel.py` — both the stream and
  format probes now treat `N/A` as missing, with a clear error if both fail.

## Known issues (code quality)

- ~~**Analysis time estimate counts all tracks**~~ — fixed: frontend passes `transcribe_tracks` from the selected track layout's `do_transcribe` assignments
- **`_ingest_one` has many parameters** — consider a dataclass if it grows further
- **`analyze/labeler.py:_label_interactive`** — ~100 lines mixing UI and logic; candidate for split
- **JS in `index.html` (~1737 lines)** — no-build-step SPA; consider ES modules if it grows further
- **No integration test for `reel_events` SSE** — `reel.py:reel_events` passes `ctx` to `subprocess_sse` (needed for graceful shutdown and `/api/status`); this path has no test coverage and was silently broken before the Phase 3 bug-hunt pass
- ~~**Ollama scoring errors are silent**~~ — fixed: `LLMScorer.score()` now emits `log.warning("LLM scoring failed for clip %d: %s", ...)` on any exception
- **`_video_dict`/`_clip_dict` user-override pattern** — `field_user if field_user is not None else (field or "")` repeated across both serializers; the right fix is `@property` on the model class (`Video.effective_title`, `Video.effective_summary`, etc.) so the display logic lives once, on the model. Deferred because it touches the model layer and serialization contract.
- **SSE batch export error reporting** — non-zero subprocess exits now log to file, but the SSE stream sends `[error]` without the exit code or stderr. Improving the stream message would make export failures diagnosable without opening the log.
- **Timeline interval minimum validation** — the 10 s minimum in `saveTimelineInterval` (Settings panel) silently no-ops when the value is below threshold. A toast or inline hint would surface the constraint.
- **`saveTimelineInterval` / `confirmGenerateTimeline` validation drift** — both paths send `ui_timeline_interval_seconds` to the API but have separate validation logic. If the minimum ever changes, both must be updated. Extracting a shared `_parseIntervalS(value, unit)` validator would prevent drift.
- **Modal keyboard trap** — Escape closes all open modals simultaneously instead of only the topmost one. Fixing properly requires a modal stack. Low UX impact for a single-user tool; deferred.
- **Modal focus management** — most modals (`openAboutModal`, `openAutoApproveModal`, etc.) do not move focus into the modal on open; only `openFieldEditModal` and `openNewContext` do. Extending to all ~13 remaining open-functions is mechanical. Deferred; no reported keyboard-navigation issues.
- **Sidebar video list keyboard support** — `<li>` items in `#video-list` are mouse-only; no `tabindex` or `onkeydown` handler. Clip navigation works via A/R/←/→ shortcuts, but selecting a video requires a mouse. Fix: add `tabindex="0"` and Enter/Space handler to each `<li>`, or put a `<button>` inside.
- **Clip filter tabs ARIA roles** — `.clip-tab` buttons have no `role="tab"`, no `role="tablist"` on the container, and no `aria-selected`. Adding these enables arrow-key tab switching and correct screen reader announcement.

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
