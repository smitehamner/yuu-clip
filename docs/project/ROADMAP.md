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

- [ ] **Map and end-to-end test expected user paths** — enumerate the journeys a non-technical user
  actually takes (analyze → review → edit/retranscribe → export → re-export; diarize → captions; merge/split
  → export; reel build) and verify each does the *expected* thing without a hidden second step. Motivating
  example: **retranscribe doesn't refresh an already-exported caption sidecar by default-of-discovery** — a
  `--refresh-captions` flag (default on) now regenerates the SRT *if one exists*, but the broader question is
  which downstream artifacts (caption sidecars, the exported clip itself, the highlight reel, the clip
  excerpt/description) should auto-update when an upstream transcript/edit changes, vs. require an explicit
  re-export, vs. show a "stale, re-export to update" indicator. Decide the policy per artifact, then add
  Playwright/UI end-to-end coverage for each path so regressions surface. Until then, individual gaps are
  patched ad hoc (see the retranscribe caption refresh and the `_update_clip_excerpt` speaker-grouping fix).

- [ ] **Panel navigation UX direction** — multi-step flows take over the main detail panel (not modals); `← Back` breadcrumb; discard prompt on unsaved changes; tabs only for within-view navigation. Migrate incrementally starting with Split Editor.

- [ ] **Validate the voiceprint re-attach threshold** — `Config.speaker_match_threshold` (default
  0.75) shipped as an untuned conservative guess (see `7fb9155`), and every speaker-naming feature
  built since — voiceprint re-attach, name inference, per-speaker colors — inherits its
  correctness. Decide the validation method first (a one-off manual QA pass re-analyzing a few
  recordings with previously-named speakers and checking matches/no-matches by hand, vs. a small
  labeled benchmark of known-good/known-bad voice pairs wired into a regression test), then run it
  and adjust the default if warranted. See the "Speaker naming" entry in Phase 6 for the full
  re-attach mechanism this threshold gates.

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

- [ ] **Undo for bulk Approve/Reject** — single-clip status changes show an undo toast, but the
  bulk toolbar's Approve/Reject have no undo. Needs a per-clip status snapshot before the bulk
  write so one undo restores each clip's *previous* status (they may differ). Deliberately not a
  confirm dialog — approve/reject is frequent and recoverable, so friction would be worse than undo.

- [ ] **Detail panel chunking** — group the clip detail panel into cards: Summary → Actions →
  Transcript, rather than a flat list *(UX debt: Chunking)*

- [ ] **Project switcher in UI** — dropdown to switch between project directories without
  restarting the server

- [ ] **Title card customization** — configurable title card for Quick Export: background color or image, font/color/size, content layout (description vs. timecode vs. both). Currently hardcoded style in the reel pipeline.

- [x] **Built-in user manual** — "Getting Started" guide in the hamburger menu covers the four-step
  workflow, score definitions, key concept definitions, and quick tips including search and keyboard navigation.

- [ ] **Multi-session grouping** — treat multiple OBS files from one play session as a single
  project with a unified timeline

- [x] **Frontend JS maintainability pass** *(2026-06-29; mostly done — 2 modules deferred)* —
  reduced reliance on the global namespace across the static JS modules without a build step.
  Shipped: shared mutable state moved off bare globals into one `AppState` object; the five
  function-only feature modules (`clips`, `contexts`, `reel`, `settings`, `videos`) IIFE-wrapped
  so internal helpers are private-by-default (~67 functions removed from the global surface),
  exposing only an explicit, exhaustively-computed public API; `tests/test_ui_globals.py` added
  as a deterministic net that fails immediately if an inline-handler function stops being global.
  `utils`/`ui` kept as the intentional shared global foundation. **Deferred:** `analyze` and
  `split` export cross-module *mutable* state and need a per-variable state-ownership decision
  (promote to `AppState` vs. keep private + adjust tests) before they can be cleanly wrapped —
  see `docs/dev/REVIEW_DECISIONS.md`. *(Tech debt: no behavior change)*

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

  Speaker labels also surface in exports: each `TranscriptSegment.speaker_label` becomes a
  `[Speaker NN]` prefix in the SRT sidecars and the in-player VTT captions (`subtitles.py`),
  taking precedence over the track-label prefix; the track label stays the fallback for unlabeled
  segments. Retranscribe's `_update_clip_excerpt` reuses `_build_excerpt`, so a re-diarized clip's
  transcript view keeps the `SPEAKER_XX:` grouping (previously it was flattened to a plain join).

  Remaining downstream features (still pending below): transcript editing, per-speaker subtitle
  *styling* (colour/font — the text labels now ship), score boost per named character, transcript
  name correction.

  **Roadmap backends** (not yet built): SpeechBrain (Apache 2.0, no HF gating — ECAPA-TDNN
  embeddings + sklearn clustering), NeMo TitaNet (Apache 2.0, no token, heavier install).
  Adding a new backend = add a `DiarizationClient` subclass + allowlist entry in `install_package`.

- [~] **Speaker naming (Phase 1 — manual, per-recording)** — a durable `Speaker` row per recording
  (`db/models.py`) that segments point at via `TranscriptSegment.speaker_id`; created at diarize time
  by `_attach_speakers` (`whisper_runner.py`). A "Speakers" card in the recording detail
  (`speakers.js`, `GET/PUT /api/speakers`) lets the user name each detected voice; names resolve into
  clip excerpts (`_build_excerpt`) and captions (`subtitles.py`), and renaming rebuilds affected clip
  excerpts. Default display is "Speaker N" (`display_index`); raw `SPEAKER_00` never reaches the UI.
  **Still pending:**
  - *Phase 2 — voiceprint re-attach: SHIPPED (2026-06-30).* pyannote.audio 4.0.7's community-1
    pipeline returns per-speaker centroids on `DiarizeOutput.speaker_embeddings` (rows aligned with
    `annotation.labels()`); `PyannoteDiarizationClient.diarize_with_embeddings` surfaces them,
    `_attach_speakers` stores each centroid on `Speaker.voiceprint` (JSON) and cosine-matches new
    clusters against Speakers from prior runs — above `_VOICEPRINT_MATCH_THRESHOLD` the segments
    re-attach to the existing (named) Speaker, so a name survives re-diarization; below it a fresh
    "Speaker N" is minted. Matches are only against pre-run Speakers, and each prior Speaker matches
    at most one current cluster (no collapse). The threshold is configurable
    (`Config.speaker_match_threshold`, Settings → Speaker labels, default 0.75 — **untuned;
    validation tracked in Phase 5**), and the clip-scoped retranscribe path re-attaches voiceprints
    too (`_maybe_diarize_segment` → `diarize_with_embeddings` + `_attach_speakers`, SHIPPED
    2026-07-01). *Not yet done:* a borderline-match confirmation band in the UI.
  - *Phase 3 — sample playback:* a ▶ button to hear a few seconds of each voice (reuse the FFmpeg
    clip-preview infra in `routes/clips.py`).
  - *Phase 4 — name inference: SHIPPED (2026-07-01).* `infer_speaker_names` (`scoring/llm.py`) reads
    the speaker-labeled transcript and suggests names from direct address; `GET
    /api/videos/{id}/infer-speaker-names` (SSE) writes each as an unconfirmed inferred name
    (`source='inferred'`, `confirmed=False`), guarding against two speakers sharing a name and never
    overwriting a confirmed name. `Speaker.display_name` hides unconfirmed names so nothing reaches
    captions/excerpts until the user accepts it in the Speakers card ("Suggest names" button +
    Accept/Dismiss). Feeds "Transcript name correction" below.
  - *Deferred alternatives (weighed, not chosen for v1):* **project-wide speaker identity** — promote
    per-recording Speakers to a project-level voice by matching voiceprints across all recordings so a
    name applies everywhere (needs a merge/split UX, higher threshold, handles voice drift; hook: a
    nullable `global_voice_id` / `ProjectVoice` table). **Link name → world-context character** —
    replace free text with a reference to a context character (`Speaker.character_id`) to feed "score
    boost per named character" and per-speaker lore in scoring; deferred to avoid coupling naming to
    the contexts model in v1.

- [x] **Transcript editing** — inline editable caption text for `TranscriptSegment.text`; lets the
  user fix character names, misspellings, and game-specific jargon before re-scoring. Speaker-grouped
  timed view, click-to-edit per line, excerpt rebuild + re-score staleness flag. Shipped — see
  COMPLETED.md.

- [ ] **Transcript name correction** — after speaker diarization maps clusters to character names,
  auto-suggest replacements for mis-transcribed names that *other* speakers say (e.g. Whisper
  hears "You" when someone is saying the name "Yuu"). Must be speaker-scoped and confidence-gated;
  surfaced as a reviewable diff before committing. *Fed by* the speaker→name map from Speaker naming
  above (which provides the reliable speaker scoping) — not subsumed by it.

- [ ] **Subtitle style options** — font, size, position for burned-in subtitles. Per-speaker
  *colour* has shipped (`Speaker.display_color`, auto-assigned palette + user override, rendered
  in burned captions via `<font color>` and in the on-screen transcript) — see COMPLETED.md. Font,
  size, and position remain.

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
  transcript-driven trim handles (click a transcript line to set the clip's start/end — the clip's
  own transcript plus ~30s of the neighboring clip's transcript shown as *extendable* context, so
  the boundary can be dragged past the original window into that region; resulting overlap between
  adjacent ClipCandidates is allowed, same as sliding-window generation already produces today),
  drag-to-position 9:16 crop box for Shorts/TikTok framing, and a live preview of burned-in
  captions if caption export is enabled. Reference UX: Twitch clip editor. Natural dependency
  order: Vertical crop and Auto captions should land first, then the editor ties them together.

- [ ] **Manual clip creation** — create a new `ClipCandidate` from scratch by picking start/end
  timestamps directly from a video's transcript, for moments the automatic pipeline missed. Shares
  the transcript-driven timestamp-picking UI with the Clip export editor above. The resulting clip
  goes through the normal scoring/review pipeline (LLM scoring, description, approve/reject) like
  any pipeline-generated clip — no separate "manual, unscored" path.

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

- [ ] **JS code quality refactor** *(partially done 2026-06-29)* — the no-build SPA accumulated
  debt from global constants, implicit shared state, and inline styles. **Shipped:** shared
  mutable state (`_clips`, `activeVideoId`, etc.) encapsulated into `AppState`; module-private
  helpers in 5 feature modules now scoped via IIFE (see "Frontend JS maintainability pass" above).
  **Remaining:** finish module-scoping the deferred `analyze`/`split` modules and their global
  constants; extract the remaining inline style strings to CSS classes (only the static
  `.col-head` table-header case was done — the bulk is `display`-toggling styles that can't move
  to a class without a behavior change, plus class-merge cases; a proper utility/token layer
  belongs with the Themes / CSS-variable-layer work below). See `docs/dev/REVIEW_DECISIONS.md`.

- [ ] **Themes** — the app ships with a single dark theme. Future options:
  - **Light mode** — full light-background theme matching the dark palette's contrast ratios
  - **Colour variants** — alternative accent colours for both light and dark themes (e.g.
    blue-accent vs current amber/green), picked via the custom colour picker component below
  - Theme picker in Settings (persisted to localStorage); system `prefers-color-scheme` as the
    default when no preference is saved. Design the CSS variable layer first so themes are pure
    token swaps.

- [ ] **Custom colour picker component** — replace the native `<input type="color">` (currently
  used for per-speaker subtitle colours in `speakers.js`) with a JS-built picker that supports
  direct hex-code entry. Build it as a shared, reusable component from the start — not
  speaker-specific — so the Themes accent-colour picker above and any future colour selection can
  reuse it without rework. Saves two things: an automatic recently-used strip, and a user-curated
  named palette (add/remove/name swatches, e.g. per speaker or per project). Decide palette
  persistence (localStorage vs. per-project DB) as part of the design.

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

- [ ] **UI localization (i18n)** — translate the web UI and setup wizard themselves into other
  languages. Distinct from the shipped *transcription language* setting (which controls what
  Whisper transcribes, not what the UI displays). Requires externalizing the hardcoded UI strings
  in `index.html` / the JS modules / `setup.html` into a string table first — expensive to
  retrofit, so batch it with any larger frontend rework. English-only is fine while the user base
  is friends/trusted users.

- [ ] **Project backup / restore** — there is no way today to back up or move a project short of
  manually copying the right folders and hoping the paths are correct. As distribution moves
  beyond solo use, a corrupted DB or a reinstalled machine with no recovery path is a bad first
  impression for a new user. Scope: a "Backup project" action that archives the SQLite DB plus
  configured media roots (source videos likely excluded by default — too large; exports/audio
  cache included) into a single file, and a "Restore from backup" path in the setup wizard.
  Depends on the Project switcher (Phase 5) settling how project directories are addressed.

- [ ] **Distribution licence** — the preview `LICENSE` (all rights reserved, no redistribution) is intentionally restrictive. Before any public distribution, decide on a looser licence (MIT, GPL-3, source-available, or BSL). Update `LICENSE`, `pyproject.toml`, and the About modal.

- [ ] **Code signing for public distribution** — the installer is currently unsigned; Windows shows
  a SmartScreen "unknown publisher" warning on first run, and some AV tools will flag it. Required
  before distributing outside friends/trusted users. Options: EV code signing certificate (~$300/yr,
  immediate SmartScreen trust) or standard OV cert (cheaper, builds SmartScreen reputation over time
  via volume). electron-builder supports both via `CSC_LINK` / `CSC_KEY_PASSWORD` env vars; remove
  the `CSC_IDENTITY_AUTO_DISCOVERY=false` override in `build-release.ps1` when a cert is in place.

- [ ] **Modal keyboard trap** — Escape closes all open modals simultaneously instead of only the
  topmost one. Fixing properly requires a modal stack so Escape pops one layer at a time. Low UX
  impact for a single-user tool; look into later when modal nesting becomes common.
  *(Partially addressed 2026-07-01: the confirm modal — the only layer that actually stacks on
  other modals today — is now popped alone by Escape; the flat close-all cascade remains for the
  rest, and the dirty-editor modals now confirm before discarding.)*

- [ ] **Quality presets** *(on hold)* — named compute bundles (e.g. "Fast draft" / "Balanced" /
  "Max quality") that pick a matched set of Whisper model, energy mode, scene mode, and scoring
  weights in one choice instead of configuring each independently. Deferred — no clear preset
  definitions yet.

- [ ] **Export-time transcript upgrade** *(shelved)* — re-run a higher-quality Whisper pass at
  export time (vs. the ingest-time transcript) so exported captions can use a bigger model without
  slowing down the initial analyze pass. Shelved — the design wasn't fully thought through (unclear
  how it interacts with retranscribe and caption sidecars that already exist).

---

## Known issues (code quality)

- ~~**JS in `index.html` (~1800 lines)**~~ — *Resolved:* all JS now lives in per-feature module files (`utils/ui/videos/clips/analyze/reel/contexts/settings/split/boot.js`) loaded via `<script src>`; `index.html` is a 1231-line HTML/CSS shell with **zero** inline JS. The frontend maintainability pass also wrapped the feature modules in IIFEs and centralized shared globals in `AppState`.
- ~~**No integration test for `reel_events` SSE**~~ — *Resolved:* `tests/test_reel_sse.py` drives the `demo_events` route end-to-end, asserting the SSE stream completes with `__DONE__` and that the `ctx`-passing path clears `demo_cmd` and resets `analyze_proc`.
- ~~**No Playwright coverage for SSE happy paths**~~ — *Resolved:* `tests/test_ui_sse.py` drives the real `streamSSE → startJobUI → endJobUI` lifecycle against a mocked SSE stream, asserting the job pill shows, the completion callback fires, steps mark done, and the UI returns to idle (buttons re-enabled, pill hidden) after `__DONE__` — the exact teardown the Phase 3 stuck-job-UI bug skipped.
- ~~**Filter-override pattern after clip-list mutations**~~ — *Resolved:* `_renderClips()` (`clips.js`) is now the canonical re-render entry point — it always routes through `_applyFilters()` before calling the private `_renderClipItems()`, so no caller can bypass the active search/status/score filters. Every clip-list mutation site in `clips.js`, `contexts.js`, and `videos.js` calls `_renderClips()`; the only direct `_renderClipItems()` call is inside the wrapper itself.
- ~~**SSE batch export error reporting**~~ — *Resolved:* the per-clip failure message in `batch_export` (`routes/clips.py`) now includes the subprocess exit code alongside the last stderr line (`[Error clip N (exit C): …]`), so export failures are diagnosable from the stream without opening the log.
- ~~**Timeline interval minimum validation**~~ — *Resolved:* `saveSettings` (Settings panel) now shows a `'Timeline interval must be at least 10 seconds.'` error toast and re-focuses the field instead of silently dropping the value when `_parseIntervalS` rejects it. The per-video timeline-interval modal already surfaces the constraint inline.
- ~~**`saveTimelineInterval` / `confirmGenerateTimeline` validation drift**~~ — *Resolved:* both paths now call the shared `_parseIntervalS(value, unit)` validator (`utils.js`), which owns the `_TIMELINE_MIN_INTERVAL_S = 10` minimum in one place. `saveSettings` (`settings.js`) and the per-video timeline generator (`videos.js`) can no longer drift apart.
- ~~**Modal focus management**~~ — *Resolved:* every modal open-function now moves focus into the modal on open (first input or primary button via `setTimeout(… .focus(), 50)`) and restores focus to the opener on close. Verified across `ui.js`, `settings.js`, `reel.js`, `contexts.js`, `clips.js`, `analyze.js`, and the timeline-interval modal.
- ~~**Sidebar video list keyboard support**~~ — *Resolved:* `#video-list` `<li>` items now get `tabIndex = 0` and the list has an `onkeydown` handler that activates the focused item on Enter/Space (`videos.js`), mirroring the clip-list keyboard handler.
- ~~**Clip filter tabs ARIA roles**~~ — *Resolved:* the `.clip-filter-tabs` container has `role="tablist"` and each `.clip-tab` has `role="tab"` + `aria-selected`, kept in sync by `setClipFilter` / `_clearClipFilters` / the video-load reset (`index.html`, `clips.js`, `videos.js`).
- **`analyze/overlap.py:_pearson` flat-curve correlation** — when both RMS curves are perfectly constant (`da == db == 0`, e.g. two tracks silent over the first 30 s) the function returns `1.0`, which reads as "identical" and disables the specialized track. The asymmetric cases (one flat, one not) correctly return `0.0`, so a false positive needs *both* tracks fully silent for 30 s — unlikely. Deferred from the 2026-06-29 scoring bug-hunt; revisit if tracks are ever wrongly suppressed. A spread/variance floor or an explicit "undetermined" return would be the proper fix.
- **Noisy torchcodec load traceback during diarization** — importing `pyannote.audio` pulls in torchcodec, which logs a multi-line "Could not load libtorchcodec" traceback (FFmpeg version 4–8) whenever FFmpeg's shared libraries aren't on the system PATH — the default on Windows. It is cosmetic: `diarization_client._load_waveform` decodes our 16 kHz mono WAVs with the stdlib `wave` module and hands pyannote an in-memory `{waveform, sample_rate}` dict, so torchcodec is never used for decoding (the original "torchcodec is not available" failure that silently dropped speaker labels is fixed). An `_log.info` breadcrumb is emitted just before the import so the traceback reads as expected. Follow-up: suppress the specific torchcodec import warning (narrowly — don't blanket-filter warnings) so the log stays clean.
- **Analyze pipeline is not idempotent on a no-`--force` re-run** — `transcribe_track` (`whisper_runner.py`) always creates a *new* `Transcript`, and `generate_candidates` (`segments/windower.py`) always *appends* new `ClipCandidate` rows; neither skips or replaces existing output. Today nothing duplicates because the `status == "done"` skip in `_pipeline._resolve_existing_video` short-circuits any completed video on re-run. Not a bug today, but it's a latent trap: any future change that loosens that skip (e.g. stage-level resume, or marking `"done"` only after scoring) would silently duplicate transcripts and clips. Proper fix when stage-level resume is wanted: make transcription and clip-generation skip-if-already-present (gated on `not force`). Surfaced in the 2026-06-29 ingest/analyze bug-hunt while fixing the crashed-scoring case (which was instead fixed by isolating scoring, leaving this untouched).

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
