# rp-clipper — Roadmap

## Status overview

| Phase | Description | Status |
|---|---|---|
| 1 | Core pipeline | Done |
| 2 | Signal enrichment + scoring | Done |
| 3 | Web UI | In progress |
| 4 | Packaging for distribution | Pending |

---

## Phase 1 — Core pipeline (Done)

- ffprobe video probing (duration, streams, fps, codec info)
- Interactive track labeling + saved profiles (`profiles.json`)
- Audio extraction per track to 16 kHz mono WAV via FFmpeg
- Whisper transcription via faster-whisper (CTranslate2 backend)
- CUDA auto-detection using `ctranslate2.get_cuda_device_count()` (no PyTorch dep)
- Sliding window candidate generation from silence gaps
- SRT subtitle sidecars (per-track + merged)
- `--burn-subs` for hardcoded subtitles
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
- `rp-clip score` standalone re-scoring command
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
- Score All button with SSE progress
- Ingest modal: native OS file picker, probe + time estimates, warning threshold
- Step-by-step progress indicator in header during jobs
- Profile manager modal: create/edit/delete profiles
- Demo reel builder modal with transition and duration controls
- Retranscribe individual clips with a different Whisper model
- Export Log button: one-click debug log download
- Video summary — `POST /api/videos/{id}/summarize`; `Video.title` + `Video.summary` columns; user-editable inline
- Two-level clip descriptions — `description` (1-sentence) + `description_long` (paragraph); both LLM-generated; user-editable inline
- Session timeline — `GET /api/videos/{id}/timeline`; `timeline_json` column; visual timeline in video detail panel
- RP Contexts — context assignment per-video; `context_names_json` column; context manager modal
- Re-score individual clip — "Re-score" button in clip detail; SSE; backend `GET /api/clips/{id}/rescore`
- Keyboard shortcuts — A/R/Space/E/←→; `?` key opens About panel
- About / Credits modal — licencing notice, dependency table, keyboard shortcut cheatsheet
- `GET /api/status` — reports `any_running`, `ingest_running`, `active_jobs` (covers all SSE jobs, not just ingest)

### Near-term

- [ ] **Editable LLM fields + regenerate-with-compare** *(next up — confirmed priority #1)*
  - All LLM-generated text fields (video title, video summary, clip description short/long) are
    inline-editable; user clicks to edit, saves explicitly
  - DB stores `*_original` (first LLM output, never overwritten) and `*_user` (current value;
    starts null, falls back to original for display)
  - "Regenerate" re-runs the LLM and shows a side-by-side diff — current on left, new suggestion
    on right; user picks one or keeps editing; nothing overwrites until confirmed
  - Clip start/end time is also editable as a numeric field (or drag handles once Clip trim lands)

- [ ] **Controls UI polish** — split the current "?" About button into two separate header buttons:
  a "Controls" button (keyboard shortcut cheatsheet only) and an "About" button (licencing +
  credits). "Controls" label is clearer than "?".

- [ ] **Auto-approve + batch export** — "Export All Above Score" button; configurable score
  threshold; runs export queue in background with SSE progress panel

- [ ] **Hot-word / phrase config** — new `[hotwords]` config section; editable list in the
  Settings page; clips containing a match get a score boost and a tag; sidebar filter by phrase.
  Each entry specifies its own match mode: exact, case-insensitive, or LLM-semantic (ask Ollama
  whether the clip relates to the phrase)

- [ ] **Related clips** — "Find Similar" button in clip detail; sends `description_long` to Ollama
  with all other clip descriptions and returns a ranked list. Store top-N results on
  `ClipCandidate` with a `related_clips_json` column and a `related_clips_at` timestamp, so the
  user can see at a glance whether results are stale. User controls N and can trigger a re-search.

- [ ] **Clip deduplication** — merge overlapping candidates (from different tracks or overlapping
  windows) into one; keep highest-scoring source transcript

- [ ] **Rejected clip undo / filter tab** — one-click undo for last status change; "Rejected" filter
  tab in sidebar so rejected clips don't vanish permanently *(UX debt: Zeigarnik Effect)*

### Medium-term

- [ ] **Transcript editing** — inline editable text area for `TranscriptSegment.text`; lets the user
  fix character names, misspellings, and game-specific jargon before re-scoring. Deferred from
  near-term because it needs per-speaker segment grouping first (see Speaker diarization below) —
  without that, the transcript is one undifferentiated wall of text and editing is awkward.

- [ ] **Settings page** — friendly form UI (not a raw text editor) for config values: Ollama model,
  score weights, Whisper defaults, scene mode, hot-words; writes back to `config.toml`

- [ ] **Clip trim (in/out adjust)** — drag handles on the player timeline to set new start/end before
  exporting; stores trim offsets on `ClipCandidate`

- [ ] **Merge adjacent clips** — button to combine two consecutive candidates into one; useful when a
  moment spans a silence gap. Options: include the gap from the source video (seamless), or insert a
  scene transition to keep it compact — let the user choose at merge time.

- [ ] **Clip queue / batch export** — checkbox per clip; "Export selected" runs all at once in
  background

- [ ] **Export presets + per-format management** — saved output profiles (YouTube 1080p, Discord
  8 MB cap, TikTok 9:16 crop) with a picker at export time; support exporting a clip in multiple
  formats; track each format as a separate file with individual delete; distinguish "regenerate this
  format" from "export a new format"

- [ ] **Subtitle style options** — font, size, colour, position for burned-in subtitles. Once
  speaker diarization is available, support per-speaker colour/style so different characters are
  visually distinct.

- [ ] **Search + filter** — text search across descriptions and transcripts; filter sidebar by score
  range, status, tag, or hot-word. Advanced users can use regex. Match-mode reuses the same
  exact / case-insensitive / LLM-semantic options as hot-words.

- [ ] **Ingest time estimate fix** — probe preview counts all audio tracks instead of only the ones
  the selected profile will actually transcribe; resolve the profile's track selection before
  computing the estimate

- [ ] **Per-step ingest progress percentage** — step chips in the header already advance through
  stages; add a completion % within each step *(UX debt: Goal-Gradient Effect)*

- [ ] **Detail panel chunking** — group the clip detail panel into cards: Summary → Actions →
  Transcript, rather than a flat list *(UX debt: Chunking)*

- [ ] **Clip score visual distinction** — coloured left border on sidebar items for clips above a
  configurable score threshold *(UX debt: Von Restorff Effect)*

- [ ] **Status label in detail panel** — show "Approved / Rejected / Pending" as text alongside the
  status dot *(UX debt: Law of Prägnanz)*

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
- One-click installer / bundled release

---

## Future considerations (no phase yet)

Items that are wanted long-term but not yet assigned to a phase. Roughly ordered by how much they
unlock downstream.

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

- [ ] **Transcript name correction** — after speaker diarization maps clusters to character names,
  auto-suggest replacements for mis-transcribed names that *other* speakers say (e.g. Whisper
  hears "You" when someone is saying the name "Yuu"). Must be speaker-scoped and confidence-gated
  to avoid false positives; surfaced as a reviewable diff before committing.

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
  CLI, config paths, and LLM prompts:
  - Replace hard-coded RP context prompt with a free-text "session context" field
  - Character/name vocabulary becomes a user-supplied list
  - Rename app and CLI; update `~/.rp-clipper`, log file, DB paths
  - Audit remaining RP-specific language in UI and prompts
  *Design the rename before touching code — it's a wide change.*
  Content-type presets (above) should be designed first so the rename ships with a clear value
  proposition for non-RP users.

- [ ] **Manual score override** — let the user set a ground-truth score per clip via a slider.
  Display the user score prominently with a distinct indicator (not replacing the LLM score —
  show both). Accumulated overrides can eventually be used to tune the prompt or weight vector,
  but that refinement loop is separate.

- [ ] **Project switcher in UI** — dropdown to switch between project directories without
  restarting the server

- [ ] **Multi-session grouping** — treat multiple OBS files from one play session as a single
  project with a unified timeline

- [ ] **Clips vs Scenes** — introduce a second candidate type: "Scenes" are longer contextual
  moments (1–5 min, may include pauses and story arc) vs. "clips" (15–90 s punchy bits). Design
  first: separate pipeline? flag on `ClipCandidate`? separate table? separate review UI?
  Depends on transcript editing being stable.

- [ ] **Choose a licence** — currently unlicensed (all rights reserved, smitehamner). Options:
  MIT (permissive), GPL-3 (copyleft), or source-available. Decide before any public release or
  packaging. Update `LICENSE`, `pyproject.toml`, and the About modal once chosen.

- [ ] **Built-in user manual** — in-app help: what each score means, contexts workflow, ingest
  walkthrough, keyboard shortcuts, export options. Low priority until the UI is more stable.

---

## Known issues (code quality)

- **Ingest time estimate counts all tracks** — tracked as a medium-term near-term item above
- **`_ingest_one` has many parameters** — consider a dataclass if it grows further
- **`ingest/labeler.py:_label_interactive`** — ~100 lines mixing UI and logic; candidate for split
- **JS in `index.html` (~1737 lines)** — no-build-step SPA; consider ES modules if it grows further

---

## Explicitly out of scope

- Shareable clip links / LAN exposure
