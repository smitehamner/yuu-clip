# yuu-clip — Roadmap

## Status overview

| Phase | Description | Status |
|---|---|---|
| 1 | Core pipeline | Done |
| 2 | Signal enrichment + scoring | Done |
| 3 | Web UI | In progress |
| 4 | Packaging for distribution | In progress |
| 5 | Post-launch polish | Pending |
| 6 | Advanced features | Pending |

---

## Phase 1 — Core pipeline (Done)

ffprobe probing, interactive track labeling, audio extraction, Whisper transcription (faster-whisper/CTranslate2, CUDA), sliding-window clip generation, SRT sidecars, baked captions. CLI: `yuuclip analyze / export / clips / status / probe`.

See [COMPLETED.md](COMPLETED.md) for full details.

---

## Phase 2 — Signal enrichment + scoring (Done)

Audio energy (PyAV RMS), tiered scene detection (transcript gaps / keyframes / PySceneDetect), LLM scoring via Ollama (JSON-structured, funny/dramatic/action sub-scores + clip description), track overlap detection, weighted scoring engine. `yuuclip score` and `yuuclip reel` CLI commands.

See [COMPLETED.md](COMPLETED.md) for full details.

---

## Phase 3 — Web UI (In progress)

Core review workflow, sidebar, export, analyze modal, track layout manager, reel builder, video summary + title, two-level clip descriptions, session timeline, World Contexts, settings panel, keyboard shortcuts, editable LLM fields with diff/compare, batch export, auto-approve, confirmation dialogs, prebuilt contexts, context nudge, post-analysis toast, elapsed timer on job steps, clip preview before export (seekable, LRU-cached temp files from source via FFmpeg), export status pills in sidebar, Save As button, Delete Export vs Delete Clip separation, export metadata display (container/captions/timestamp), and more. See [COMPLETED.md](COMPLETED.md) for the full shipped list.

### Near-term

- [x] **Video sidebar stats** *(done)*
  - Sidebar cards now show: total / approved / exported clip counts, score min–max range bar,
    and processing status badges (∅ summary / ∅ scored / ∅ timeline) when those steps haven't run.

- [x] **Caption / subtitle export** *(done)*
  - Export and batch-export modals now have a three-way Captions picker:
    - **None** — no captions (default)
    - **Embed subtitle track** (softsub) — adds an SRT track to the container; stream copy, fast
    - **Burn in captions** (hardsub) — re-encode with subtitle filter; shows re-encode warning
  - Both single-clip and batch-export paths support all three modes.

- [x] **Per-context score weights** *(done)*
  - Each World Context can now optionally override the global LLM scoring weights (funny / dramatic / action).
  - Set in the Context editor under "LLM scoring weights"; blank = use global defaults.
  - When a video is rescored, weights are averaged across all assigned contexts that have overrides;
    contexts without overrides contribute nothing to the average.

- [x] **New Recording panel (replaces Analyze modal)** *(done)*
  - `+ Analyze` in the header navigates to a "New Recording" panel inside the main area
  - Sidebar stays live while the panel is open; clicking another video closes it with a
    discard prompt if a path has been entered
  - File probe runs inline after file selection (duration/estimate shown)
  - Pre-split flow deferred to *Recording Segments* below

- [ ] **Recording Segments** *(large/complex)*

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

- [ ] **Quick Export vs Full Export** — current export is already "quick" (stream copy, no title card). Full Export (with title card, like reel clips) is a future addition.

- [ ] **SRT import / external subtitle support** — probe now detects embedded subtitle streams and `.srt` sidecars and returns them in the probe response. Using them to skip Whisper requires pipeline changes still TODO.

### Pre-packaging documentation

- [ ] **Performance and storage notes** — document expected install size, per-session disk
  usage (audio extracts, Whisper models, exports), and how quickly disk fills with typical use.
  Include recommended specs (RAM, GPU, storage type). Note the SSD vs. external HDD tradeoff:
  large source files on an external drive is common, but the working project directory
  (DB, extracts, exports) benefits from local SSD. The project folder location picker in the
  first-run wizard should surface this recommendation.

---

## Phase 4 — Packaging + distribution (In progress)

Goal: friends can install and use without knowing Python.

### Shipped (v0.1.1 – v0.1.8)

- **Electron wrapper** — app runs in its own window (not the browser); Python backend is a bundled subprocess
- **First-run setup wizard** — `setup.html` page detects GPU, Ollama, FFmpeg; guides user through prerequisites with specific install instructions; skips on subsequent launches
- **NSIS installer** — one-click install via `electron-builder`; creates desktop + Start Menu shortcuts; `build-release.ps1` script produces the installer
- **Venv setup** — Electron creates a `.venv` and installs the bundled wheel on first run; non-blocking so the wizard window stays responsive; upgrade detection reruns install when wheel version changes
- **Loading screen** — shown between wizard completion and main window load
- **Backend health check** — 60 s startup timeout; detects early crash and shows error in UI; crash-safe shutdown on window close
- **Rolling logs** — startup errors logged to `venv-setup.log`; server output to rotating `yuu-clip.log`
- **Version in footer** — dev mode shows version + server start time; production shows version + build date
- **`-Version` flag** on build script for automating version bumps

### Still pending

- [ ] **Bundled inference backend** — investigate `llama.cpp` to avoid requiring a separate Ollama install; smoother first-run experience
- [ ] **Disabled UI linking to wizard** — when a prerequisite is missing, disabled UI options should indicate which prereq and link to re-run the wizard
- [ ] **Whisper + LLM model downloader in wizard** — guided download of Whisper weights and Ollama models with licence and hardware notes
- [ ] **AMD / Intel GPU support** — evaluate ROCm (AMD) and OpenVINO (Intel) support in CTranslate2
- [ ] **Choose a licence** — currently unlicensed (all rights reserved, smitehamner). Decide before any public release (MIT, GPL-3, or source-available). Update `LICENSE`, `pyproject.toml`, and About modal.
- [ ] **Linux compatibility testing** — verify the full pipeline on Linux; identify Windows-only assumptions in path handling, file pickers, or process management.
- [ ] **Performance and storage notes** — document expected install size, per-session disk usage, recommended specs (RAM, GPU, storage type). Surface SSD recommendation in the project folder picker.

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
  formats and tracking each as a separate file with individual delete; distinguish "regenerate this
  format" from "export a new format". Current model (one export file per clip) will need to be
  extended — multiple rows or a JSON list — before this ships.

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

- [ ] **JS code quality refactor** — the single-file SPA (`index.html` + separate `.js` modules,
  currently ~1800+ lines across all files) has grown to where global constants, implicit shared
  state, and inline styles are accumulating debt. Future pass: eliminate global constants in favour
  of module-scoped values, audit shared mutable state (`_clips`, `activeVideoId`, etc.) for
  encapsulation, extract inline style strings to CSS classes, and apply consistent naming
  conventions. Pre-condition: the UI must be stable enough that a refactor won't chase moving
  targets; defer until Phase 4 or later.

- [ ] **Themes** — the app ships with a single dark theme. Future options:
  - **Light mode** — full light-background theme matching the dark palette's contrast ratios
  - **Colour variants** — alternative accent colours for both light and dark themes (e.g.
    blue-accent vs current amber/green)
  - Theme picker in Settings (persisted to localStorage); system `prefers-color-scheme` as the
    default when no preference is saved. Design the CSS variable layer first so themes are pure
    token swaps.

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

- [ ] **Code signing for public distribution** — the installer is currently unsigned; Windows shows
  a SmartScreen "unknown publisher" warning on first run, and some AV tools will flag it. Required
  before distributing outside friends/trusted users. Options: EV code signing certificate (~$300/yr,
  immediate SmartScreen trust) or standard OV cert (cheaper, builds SmartScreen reputation over time
  via volume). electron-builder supports both via `CSC_LINK` / `CSC_KEY_PASSWORD` env vars; remove
  the `CSC_IDENTITY_AUTO_DISCOVERY=false` override in `build-release.ps1` when a cert is in place.

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
- **JS in `index.html` (~1800 lines)** — no-build-step SPA; consider ES modules if it grows further
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
- **`_video_dict`/`_clip_dict` effective-field properties** — move the `field_user if field_user is not None else (field or "")` display logic to `@property` on the model (`Video.effective_title`, `Video.effective_summary`, etc.) so it lives once. Pre-condition for cleaner serialization if the model grows. Already tracked above under `_video_dict`/`_clip_dict` user-override pattern.
- **Preview cache test isolation** — the module-level `_preview_cache` dict in `routes/videos.py` is shared across all `create_app()` calls in tests. Not a bug today, but if any test directly manipulates cache state the lack of isolation will cause ordering-dependent failures.

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
