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

See [COMPLETED-archive.md](COMPLETED-archive.md) for full details.

---

## Phase 2 — Signal enrichment + scoring (Done)

Audio energy (PyAV RMS), tiered scene detection (transcript gaps / keyframes / PySceneDetect), LLM scoring via Ollama (JSON-structured, funny/dramatic/action sub-scores + clip description), track overlap detection, weighted scoring engine. `yuuclip score` and `yuuclip reel` CLI commands.

See [COMPLETED-archive.md](COMPLETED-archive.md) for full details.

---

## Phase 3 — Web UI (Done)

Core review workflow, sidebar, export, analyze modal, track layout manager, reel builder, video summary + title, two-level clip descriptions, session timeline, World Contexts, settings panel, keyboard shortcuts, editable LLM fields with diff/compare, batch export, auto-approve, confirmation dialogs, prebuilt contexts, context nudge, post-analysis toast, elapsed timer on job steps, clip preview before export (seekable, LRU-cached temp files from source via FFmpeg), export status pills in sidebar, Save As button, Delete Export vs Delete Clip separation, export metadata display (container/captions/timestamp), and more. See [COMPLETED-archive.md](COMPLETED-archive.md) for the full shipped list.

All near-term and medium-term items shipped.

---

## Phase 4 — Packaging + distribution (Done)

Goal: friends can install and use without knowing Python.

Electron wrapper, NSIS installer, first-run setup wizard, venv setup, backend health check, rolling logs, version in footer, bundled `llama-cpp-python` inference backend, LLM backend picker + Ollama model pull in wizard — shipped. See [COMPLETED-archive.md](COMPLETED-archive.md).

All Phase 4 items shipped. See [COMPLETED-archive.md](COMPLETED-archive.md).

---

## Phase 5 — Post-launch polish (Pending)

Smaller improvements and UX debt that don't block initial distribution but are high-value for
regular users.

- [ ] **Electron native-file-protocol transport swap** — the remaining follow-up from the
  720p preview proxy work (shipped 2026-07-02, see COMPLETED.md): in the packaged app, serve
  local media via Electron's native file protocol instead of the Python byte-pump. Helps
  startup latency, not seeking (the proxy already solved that), and doesn't apply to
  browser-dev mode.

- [x] **Map and end-to-end test expected user paths** (done, 2026-07-03) — 10 journeys enumerated
  in `docs/dev/USER_PATHS.md`, each with a locked per-artifact staleness policy: cheap text
  artifacts (clip transcript excerpt, SRT caption sidecar) auto-refresh on caption edit, speaker
  rename/reassign, and retranscribe; expensive encoded artifacts (the exported clip file, a
  highlight reel) get a "Stale — re-export to update" badge and are never silently rebuilt.
  `ClipCandidate.export_stale`/`export_stale_reasons` computed from new `trim_edited_at` /
  `description_edited_at` / `exported_title_card` / `exported_embed_subs` columns vs.
  `exported_at`; reel staleness computed from the existing `.reel.json` composition manifest vs.
  member clips' `exported_at`. See `docs/dev/plans/roadmap-2026-07/02-user-paths-staleness.md`.

- [x] **Panel navigation UX direction** — multi-step flows take over the main detail panel (not modals); `← Back` breadcrumb; discard prompt on unsaved changes; tabs only for within-view navigation. Framework (`panelnav.js`) + Split Editor migration landed; remaining flows (reel builder, analyze panel, contexts) migrate opportunistically.

- [ ] **Validate the voiceprint re-attach threshold** — `Config.speaker_match_threshold` (default
  0.75) shipped as an untuned conservative guess (see `7fb9155`), and every speaker-naming feature
  built since — voiceprint re-attach, name inference, per-speaker colors — inherits its
  correctness. Decide the validation method first (a one-off manual QA pass re-analyzing a few
  recordings with previously-named speakers and checking matches/no-matches by hand, vs. a small
  labeled benchmark of known-good/known-bad voice pairs wired into a regression test), then run it
  and adjust the default if warranted. See the "Speaker naming" entry in Phase 6 for the full
  re-attach mechanism this threshold gates.

- [x] **Pause / resume analysis** (done, 2026-07-03) — pause a running analysis job between videos (finish the video currently in progress, then hold before starting the next). Two trigger modes: **manual** ("Pause after current video" button in the job header) and **automatic** (triggered by hardware health thermal threshold). On resume, the queue continues from the next unprocessed video. Pause state is in-memory / flag-file only and does not survive a server restart. Applies to both single-video and batch analysis (and the JS sequential-segment runners for pre-split/re-split). See `docs/dev/plans/roadmap-2026-07/01-pause-hardware-health.md`.

- [x] **Hardware health monitoring** (done, 2026-07-03) — two-part protective feature for laptop users during long analysis runs:
  - *Pre-import estimate*: `/api/estimate` uses medians from the creator's own last 10 runs (keyed by model + device) once at least 2 matching samples exist, falling back to the static formula otherwise (`"source": "measured"|"estimated"`); shows a warning block (`analyze_warn_hours`, default 2h) suggesting the recording be split or fewer files analyzed at once.
  - *Live thermal monitoring*: `yuu_clip/analyze/thermal.py` polls GPU temp via `pynvml` (NVIDIA only; silently inert otherwise) every ~10s during an analysis; warns after 3 consecutive samples at/above the warn threshold, auto-pauses after 3 consecutive samples at/above the pause threshold (same pause-flag mechanism as manual pause), with hysteresis after resume so a still-hot GPU doesn't immediately re-pause. Configurable in Settings → Hardware: `thermal_warn_c` (default 85), `thermal_pause_c` (default 90), `thermal_autopause_enabled` (default on).

- [x] **Demo reel: add clips from rejected/unrated pool** (done, 2026-07-03) — `statuses` query
  param on `/api/demo/approved-clips` (default `approved`, unchanged) plus Approved/Unreviewed/
  Rejected pool chips in the reel Build tab; clips pulled in from a non-approved pool default to
  excluded.

- [x] **Batch processing status panel** (done, 2026-07-03) — collapsible summary bar above the clip
  filter chips: status counts (unreviewed/approved/rejected/scoring-errors) for the selected
  recording plus an in-flight job indicator, derived from `AppState.clips` and the existing
  job-status pill (no new endpoints). Clicking a count applies the matching filter chip; collapsed
  state persists in localStorage. Scoped down from the original "active/queued/completed job
  counts with per-job detail" wording — the app has no job-queue/history infrastructure to back
  that; see `docs/dev/plans/QUICK-WINS-2026-07.md` Stage 6. Deferred: moving the raw log view
  behind a "Developer" toggle.

- [x] **Detail panel chunking** (done, 2026-07-03) — clip detail panel regrouped into
  Summary (description/full description/tags, merged into one card with dividers) → Scoring +
  Actions (kept side by side per the existing L4-3 wrap design) → Export (trim/exported-file info,
  split out of the Actions card) → Transcript, instead of a flatter list of single-purpose cards.
  Layout-only — no behavior changes; event delegation and all existing selectors verified intact
  via the full UI suite (459/459, zero test edits needed).

- [ ] **Project switcher in UI** — dropdown to switch between project directories without
  restarting the server

- [ ] **Title card customization** — configurable title card for Quick Export: background color or image, font/color/size, content layout (description vs. timecode vs. both). Currently hardcoded style in the reel pipeline.

- [ ] **Multi-session grouping** — treat multiple OBS files from one play session as a single
  project with a unified timeline

---

## Phase 6 — Advanced features (Pending)

Complex, specialized, or AI-heavy features that are valuable but don't need to block distribution.

### Scoring and signal enrichment

- [x] **Hot-word / phrase config** (done, 2026-07-03) — see
  [COMPLETED.md](COMPLETED.md#hot-word--phrase-config-done-2026-07-03).

- [ ] **Laugh / non-speech sound detection: separate attribute** — follow-on to the shipped
  `LaughScorer` (transcript/audio/model modes, contributes to `score_funny` — see COMPLETED-archive.md).
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

- [ ] **Additional diarization backends** — the shipped `DiarizationClient` infrastructure
  (Null + Pyannote backends; speaker labels flow through excerpts, captions, and exports — see
  COMPLETED-archive.md) was designed for more: **SpeechBrain** (Apache 2.0, no HF gating — ECAPA-TDNN
  embeddings + sklearn clustering) and **NeMo TitaNet** (Apache 2.0, no token, heavier install).
  Adding a new backend = a `DiarizationClient` subclass + allowlist entry in `install_package`.

- [ ] **Speaker naming — remaining pieces** — Phases 1–4 shipped (manual naming, voiceprint
  re-attach, sample playback, LLM name inference — see COMPLETED-archive.md; the re-attach threshold's
  validation is tracked in Phase 5). Still open:
  - *Borderline-match confirmation band* — a near-threshold voiceprint match should ask the user
    instead of silently re-attaching or minting a fresh "Speaker N".
  - *Deferred alternatives (weighed, not chosen for v1):* **project-wide speaker identity** — promote
    per-recording Speakers to a project-level voice by matching voiceprints across all recordings so a
    name applies everywhere (needs a merge/split UX, higher threshold, handles voice drift; hook: a
    nullable `global_voice_id` / `ProjectVoice` table). **Link name → world-context character** —
    replace free text with a reference to a context character (`Speaker.character_id`) to feed "score
    boost per named character" and per-speaker lore in scoring; deferred to avoid coupling naming to
    the contexts model in v1.

- [ ] **Transcript name correction** — after speaker diarization maps clusters to character names,
  auto-suggest replacements for mis-transcribed names that *other* speakers say (e.g. Whisper
  hears "You" when someone is saying the name "Yuu"). Must be speaker-scoped and confidence-gated;
  surfaced as a reviewable diff before committing. *Fed by* the speaker→name map from Speaker naming
  above (which provides the reliable speaker scoping) — not subsumed by it.

- [ ] **Subtitle style options** — font, size, position for burned-in subtitles. Per-speaker
  *colour* has shipped (`Speaker.display_color`, auto-assigned palette + user override, rendered
  in burned captions via `<font color>` and in the on-screen transcript) — see COMPLETED-archive.md. Font,
  size, and position remain.

### Export and delivery

- [x] **Export presets + per-format management** — saved output profiles (YouTube 1080p, Discord
  ≤10 MB cap; TikTok 9:16 crop deferred until vertical crop exists) with a picker at export time;
  exporting a clip in multiple formats, each tracked as a separate `clip_exports` row with
  individual delete; "Regenerate" (same preset) distinguished from "Export another format".
  Done 2026-07-03 — see roadmap-2026-07/07-export-presets.md.

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

- [x] **Manual clip creation** — done, 2026-07-03. See [COMPLETED.md](COMPLETED.md).

- [ ] **Vertical crop / Shorts export** — 9:16 output for TikTok / YouTube Shorts; requires
  face/webcam tracking (YOLO or MediaPipe) to auto-frame the crop region.

### Content safety and moderation

- [x] **Sensitive content detection** (done, 2026-07-03) — see
  [COMPLETED.md](COMPLETED.md#sensitive-content-detection-done-2026-07-03).

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

- [x] **URL import (Twitch VOD / YouTube)** — done, 2026-07-03. See [COMPLETED.md](COMPLETED.md).

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

Resolved entries are removed once fixed (the fix is recorded in COMPLETED.md /
COMPLETED-archive.md); only genuinely open issues live here.

- **Analyze pipeline is not idempotent on a no-`--force` re-run** — `transcribe_track` (`whisper_runner.py`) always creates a *new* `Transcript`, and `generate_candidates` (`segments/windower.py`) always *appends* new `ClipCandidate` rows; neither skips or replaces existing output. Today nothing duplicates because the `status == "done"` skip in `_pipeline._resolve_existing_video` short-circuits any completed video on re-run. Not a bug today, but it's a latent trap: any future change that loosens that skip (e.g. stage-level resume, or marking `"done"` only after scoring) would silently duplicate transcripts and clips. Proper fix when stage-level resume is wanted: make transcription and clip-generation skip-if-already-present (gated on `not force`). Surfaced in the 2026-06-29 ingest/analyze bug-hunt while fixing the crashed-scoring case (which was instead fixed by isolating scoring, leaving this untouched).

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
