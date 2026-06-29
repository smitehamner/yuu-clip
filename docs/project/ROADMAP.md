# yuu-clip — Roadmap

## Status overview

| Phase | Description | Status |
|---|---|---|
| 1 | Core pipeline | Done |
| 2 | Signal enrichment + scoring | Done |
| 3 | Web UI | Done |
| 4 | Packaging for distribution | Done |
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

## Phase 3 — Web UI (Done)

Core review workflow, sidebar, export, analyze modal, track layout manager, reel builder, video summary + title, two-level clip descriptions, session timeline, World Contexts, settings panel, keyboard shortcuts, editable LLM fields with diff/compare, batch export, auto-approve, confirmation dialogs, prebuilt contexts, context nudge, post-analysis toast, elapsed timer on job steps, clip preview before export (seekable, LRU-cached temp files from source via FFmpeg), export status pills in sidebar, Save As button, Delete Export vs Delete Clip separation, export metadata display (container/captions/timestamp), and more. See [COMPLETED.md](COMPLETED.md) for the full shipped list.

All near-term and medium-term items shipped. See [COMPLETED.md](COMPLETED.md).

---

## Phase 4 — Packaging + distribution (Done)

Goal: friends can install and use without knowing Python.

Electron wrapper, NSIS installer, first-run setup wizard, venv setup, backend health check, rolling logs, version in footer, bundled `llama-cpp-python` inference backend, LLM backend picker + Ollama model pull in wizard — shipped. See [COMPLETED.md](COMPLETED.md).

All Phase 4 items shipped. See [COMPLETED.md](COMPLETED.md).

---

## Phase 5 — Post-launch polish (Pending)

Smaller improvements and UX debt that don't block initial distribution but are high-value for
regular users.

- [ ] **Panel navigation UX direction** — multi-step flows take over the main detail panel (not modals); `← Back` breadcrumb; discard prompt on unsaved changes; tabs only for within-view navigation. Migrate incrementally starting with Split Editor.

- [ ] **Pause / resume analysis** — pause a running analysis job between videos (finish the video currently in progress, then hold before starting the next). Two trigger modes: **manual** ("Pause" button in the job header) and **automatic** (triggered by hardware health thermal threshold). On resume, the queue continues from the next unprocessed video. Pause state is in-memory and does not survive a server restart (acceptable for now). Applies to both single-video and batch analysis. Long-term possibilities: mid-video pause (hard; would require restarting that video from scratch), durable pause state across restarts.

- [ ] **Hardware health monitoring** — two-part protective feature for laptop users during long analysis runs:
  - *Pre-import estimate (low risk, high value)*: before analysis starts, calculate estimated GPU-hours from total video duration × per-minute benchmark; show a warning when the estimate is large; suggest batching as a mitigation.
  - *Live thermal monitoring*: poll GPU temp via `pynvml` (NVIDIA only initially); log temps; surface a warning in the UI when temp exceeds threshold for N consecutive samples; pause ingest between videos (finish current, then hold — ties into Pause / resume above); UI options: "Pause now" / "Continue anyway". Sensible defaults (85°C warn, 90°C pause); user-configurable thresholds TBD.

- [x] **Search + filter** — text search across clip descriptions and transcripts; minimum score dropdown; both combine with the existing status tabs. Client-side; no backend changes. Regex and tag filter deferred.

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

- [ ] **Title card customization** — configurable title card for Quick Export: background color or image, font/color/size, content layout (description vs. timecode vs. both). Currently hardcoded style in the reel pipeline.

- [x] **Built-in user manual** — "Getting Started" guide in the hamburger menu covers the four-step
  workflow, score definitions, key concept definitions, and quick tips including search and keyboard navigation.

- [ ] **Multi-session grouping** — treat multiple OBS files from one play session as a single
  project with a unified timeline

- [ ] **Frontend JS maintainability pass** — reduce reliance on the global namespace across the
  static JS modules (`analyze`, `clips`, `contexts`, `reel`, `settings`, `split`, `ui`, `utils`):
  audit functions/state hung off `window`, scope or namespace them, and tighten cross-module
  dependencies. Goal is clearer module boundaries and easier-to-maintain code without introducing
  a build step. *(Tech debt: no behavior change)*

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

- [x] **Laugh detection scorer** — `LaughScorer` shipped with three modes: `transcript` (regex on
  Whisper output, default), `audio` (spectral burst-rhythm via PyAV + numpy), and `model`
  (HuggingFace `audio-classification` pipeline; optional `[laugh-model]` extras). Contributes to
  `score_funny`. See [COMPLETED.md](COMPLETED.md).

- [ ] **Laugh / non-speech sound detection: separate attribute** — follow-on to the shipped scorer.
  Add a dedicated `score_laugh` column so laugh density can be sorted and filtered independently
  of the Funny sub-score; surface it in the sidebar score line and sort/filter dropdowns.
  Non-speech event detection (sound effects, reactions) also deferred to this item.

- [ ] **Image-based clip analysis** — optional, clip-only feature: sample frames at a configurable
  interval and send them to a vision model to enrich clip descriptions and scoring. Requires a
  separately downloadable vision model (permissive licence required — clips may be monetized by
  users). Configurable: on/off toggle, frames-per-clip frequency.

- [ ] **Model selection and capability gating** — research and recommend text LLM models that are
  better-tuned for clip description/scoring and carry permissive licences suitable for monetized
  content. Similarly for the vision model (see image-based analysis above). Disabled UI options
  should detect whether the required model is installed and link to the wizard if not.

### Transcript and speaker features

- [x] **Speaker diarization — infrastructure shipped** — `DiarizationClient` ABC with Null (default)
  and Pyannote backends; config-driven factory mirrors `LLMClient`. Post-transcription pass in
  `whisper_runner.py` populates `TranscriptSegment.speaker_label`; `_build_excerpt` in `windower.py`
  formats `transcript_excerpt` with `SPEAKER_XX:` prefixes so downstream LLM scoring and the UI
  transcript view both benefit automatically. Settings UI: backend selector, HF token field,
  one-click `pip install pyannote.audio` button with live pip log.

  Remaining downstream features (still pending below): transcript editing, per-speaker subtitle
  styles, score boost per named character, transcript name correction.

  **Roadmap backends** (not yet built): SpeechBrain (Apache 2.0, no HF gating — ECAPA-TDNN
  embeddings + sklearn clustering), NeMo TitaNet (Apache 2.0, no token, heavier install).
  Adding a new backend = add a `DiarizationClient` subclass + allowlist entry in `install_package`.

- [ ] **Transcript editing** — inline editable text area for `TranscriptSegment.text`; lets the user
  fix character names, misspellings, and game-specific jargon before re-scoring. Now unblocked by
  speaker diarization; speaker-grouped display is the target UX.

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

- [ ] **Clip deduplication** — detect and merge near-duplicate clips (same event captured in overlapping time windows from different segmentation passes). Design unclear; revisit after transcript editing is stable.

- [ ] **Score learning loop** — use accumulated manual score overrides (see Phase 5) to tune the
  prompt or scoring weight vector semi-automatically. Requires a meaningful corpus of overrides
  before it's worthwhile.

- [ ] **AMD / Intel GPU support** — evaluate ROCm (AMD) and OpenVINO (Intel) in CTranslate2; the wizard already detects both and surfaces informational messages. Actual accelerated inference requires library support that doesn't exist on Windows for these vendors yet.

- [ ] **Linux compatibility** — verify the full pipeline on Linux; audit Windows-only assumptions in path handling (`LOCALAPPDATA`/`APPDATA`), `wmic` GPU detection, file pickers, and process management. Electron wrapper is Windows-only; would need a separate packaging path.

- [ ] **Distribution licence** — the preview `LICENSE` (all rights reserved, no redistribution) is intentionally restrictive. Before any public distribution, decide on a looser licence (MIT, GPL-3, source-available, or BSL). Update `LICENSE`, `pyproject.toml`, and the About modal.

- [ ] **Code signing for public distribution** — the installer is currently unsigned; Windows shows
  a SmartScreen "unknown publisher" warning on first run, and some AV tools will flag it. Required
  before distributing outside friends/trusted users. Options: EV code signing certificate (~$300/yr,
  immediate SmartScreen trust) or standard OV cert (cheaper, builds SmartScreen reputation over time
  via volume). electron-builder supports both via `CSC_LINK` / `CSC_KEY_PASSWORD` env vars; remove
  the `CSC_IDENTITY_AUTO_DISCOVERY=false` override in `build-release.ps1` when a cert is in place.

---

## Known issues (code quality)

- **`_ingest_one` has many parameters** — consider a dataclass if it grows further
- **`analyze/labeler.py:_label_interactive`** — ~100 lines mixing UI and logic; candidate for split
- **JS in `index.html` (~1800 lines)** — no-build-step SPA; consider ES modules if it grows further
- **No integration test for `reel_events` SSE** — `reel.py:reel_events` passes `ctx` to `subprocess_sse` (needed for graceful shutdown and `/api/status`); this path has no test coverage and was silently broken before the Phase 3 bug-hunt pass
- **`_video_dict`/`_clip_dict` user-override pattern** — `field_user if field_user is not None else (field or "")` repeated across both serializers; the right fix is `@property` on the model class (`Video.effective_title`, `Video.effective_summary`, etc.) so the display logic lives once, on the model. Deferred because it touches the model layer and serialization contract.
- **SSE batch export error reporting** — non-zero subprocess exits now log to file, but the SSE stream sends `[error]` without the exit code or stderr. Improving the stream message would make export failures diagnosable without opening the log.
- **Timeline interval minimum validation** — the 10 s minimum in `saveTimelineInterval` (Settings panel) silently no-ops when the value is below threshold. A toast or inline hint would surface the constraint.
- **`saveTimelineInterval` / `confirmGenerateTimeline` validation drift** — both paths send `ui_timeline_interval_seconds` to the API but have separate validation logic. If the minimum ever changes, both must be updated. Extracting a shared `_parseIntervalS(value, unit)` validator would prevent drift.
- **Modal keyboard trap** — Escape closes all open modals simultaneously instead of only the topmost one. Fixing properly requires a modal stack. Low UX impact for a single-user tool; deferred.
- **Modal focus management** — most modals (`openAboutModal`, `openAutoApproveModal`, etc.) do not move focus into the modal on open; only `openFieldEditModal` and `openNewContext` do. Extending to all ~13 remaining open-functions is mechanical. Deferred; no reported keyboard-navigation issues.
- **Sidebar video list keyboard support** — `<li>` items in `#video-list` are mouse-only; no `tabindex` or `onkeydown` handler. Clip navigation works via A/R/←/→ shortcuts, but selecting a video requires a mouse. Fix: add `tabindex="0"` and Enter/Space handler to each `<li>`, or put a `<button>` inside.
- **Clip filter tabs ARIA roles** — `.clip-tab` buttons have no `role="tab"`, no `role="tablist"` on the container, and no `aria-selected`. Adding these enables arrow-key tab switching and correct screen reader announcement.
- **Preview cache test isolation** — the module-level `_preview_cache` dict in `routes/videos.py` is shared across all `create_app()` calls in tests. Not a bug today, but if any test directly manipulates cache state the lack of isolation will cause ordering-dependent failures.
- **`analyze/overlap.py:_pearson` flat-curve correlation** — when both RMS curves are perfectly constant (`da == db == 0`, e.g. two tracks silent over the first 30 s) the function returns `1.0`, which reads as "identical" and disables the specialized track. The asymmetric cases (one flat, one not) correctly return `0.0`, so a false positive needs *both* tracks fully silent for 30 s — unlikely. Deferred from the 2026-06-29 scoring bug-hunt; revisit if tracks are ever wrongly suppressed. A spread/variance floor or an explicit "undetermined" return would be the proper fix.
- **Analyze pipeline is not idempotent on a no-`--force` re-run** — `transcribe_track` (`whisper_runner.py`) always creates a *new* `Transcript`, and `generate_candidates` (`segments/windower.py`) always *appends* new `ClipCandidate` rows; neither skips or replaces existing output. Today nothing duplicates because the `status == "done"` skip in `_pipeline._resolve_existing_video` short-circuits any completed video on re-run. Not a bug today, but it's a latent trap: any future change that loosens that skip (e.g. stage-level resume, or marking `"done"` only after scoring) would silently duplicate transcripts and clips. Proper fix when stage-level resume is wanted: make transcription and clip-generation skip-if-already-present (gated on `not force`). Surfaced in the 2026-06-29 ingest/analyze bug-hunt while fixing the crashed-scoring case (which was instead fixed by isolating scoring, leaving this untouched).

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
