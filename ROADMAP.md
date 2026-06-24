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
- **Export Log button**: one-click debug log download for non-technical users

### Near-term (next up)

- [ ] **Hot-word / phrase config** — new `[hotwords]` config section;
  editable list in the Settings page; clips containing a hot-word get a score boost
  and a tag; sidebar search/filter by phrase shows all matching clips

- [ ] **Keyboard shortcuts** — A approve, R reject, space play/pause, ←/→ prev/next clip,
  E export; shown in a tooltip or ? overlay

- [ ] **Auto-approve + batch export** — "Export All Above Score" button;
  configurable threshold; runs export queue in background with SSE progress panel

- [ ] **Re-score individual clip** — button in clip detail; re-runs LLM scorer on
  that clip's transcript excerpt; SSE progress; refreshes scores on completion

- [ ] **Clip deduplication** — merge overlapping candidates (from different tracks or
  overlapping windows) into one; keep highest-scoring source transcript

### Medium-term

- [ ] **Clip trim (in/out adjust)** — drag handles on the player timeline to set new
  start/end before exporting; stores trim offsets on `ClipCandidate`

- [ ] **Merge adjacent clips** — button to combine two consecutive candidates into one;
  useful when a moment spans a silence gap

- [ ] **Settings page** — friendly form UI (not a raw text editor) for config values:
  Ollama model, score weights, Whisper defaults, scene mode, hot-words;
  writes back to `config.toml`

- [ ] **Clip queue / batch export** — checkbox per clip; "Export selected" runs all
  at once in background

- [ ] **Export presets** — saved output profiles: YouTube 1080p, Discord 8 MB cap,
  TikTok 9:16 crop; picker at export time

- [ ] **Subtitle style options** — font, size, colour, position for burned-in subtitles

- [ ] **Search + filter** — text search across descriptions and transcripts;
  filter sidebar by score range, status, tag, or hot-word;
  stretch goal: fuzzy / semantic search via embedded clip descriptions

### Later

- [ ] **Character / speaker tagging** — pyannote.audio diarization; label speaker
  clusters with character names; filter clips by character; score boost per character;
  requires HuggingFace token for model download

- [ ] **Manual score override + scoring refinement** — slider to set a ground-truth
  score; accumulated overrides used to tune LLM prompt or weight vector;
  complex feature, design separately when there's enough override data to be useful

- [ ] **Project switcher in UI** — dropdown to switch between project directories
  without restarting the server

- [ ] **Multi-session grouping** — treat multiple OBS files from one play session
  as a single project with a unified timeline (low priority)

---

## Code quality (ongoing)

### Done
- All API Pydantic models moved to module level (FastAPI 0.100 + Pydantic v2 requirement)
- `web/app.py` split from 401-line monolith into domain route modules under `web/routes/`
- `cli.py` pipeline stages extracted from 200-line `_ingest_one` into named single-responsibility functions
- SSE streaming boilerplate consolidated into `web/sse.py:subprocess_sse()`
- Shared project setup extracted into `_load_project()` helper (removed 4-way duplication)
- `BYTES_PER_MB` constant defined to replace magic number `1_048_576`
- `_require_ffmpeg()` guard extracted (removed 3-way duplication)
- `ProjectContext` dataclass (`web/deps.py`) centralises all derived project paths
- Structured rotating log (`rp_clipper/log.py`) with in-memory buffer for UI export
- 15 API unit tests; all passing after refactor

### Remaining known issues
- `datetime.utcnow()` calls in ORM models — deprecated in Python 3.12; replace with `datetime.now(UTC)`
- `_ingest_one` still has many parameters — consider a dataclass if it grows further
- `ingest/labeler.py:_label_interactive` is ~100 lines mixing UI and logic; candidate for future split
- `scoring/scenes.py:compute_scenes` is 57 lines; acceptable but watch for growth
- JS in `index.html` (659 lines) is not modular — acceptable for a no-build-step SPA but
  consider splitting into ES modules if it grows past ~1000 lines

---

## UX analysis — Laws of UX

These are the UX debt items identified against [lawsofux.com](https://lawsofux.com/).
Each item is tagged with the violated law and a proposed fix.

### Critical (blocks basic usability)

| # | Law | Current violation | Proposed fix |
|---|-----|------------------|--------------|
| 1 | **Doherty Threshold** (< 400ms feels instant) | No feedback when clicking Export Log, Build Reel start, or Score All — button appears unresponsive for ~1s before SSE begins | Disable button + show inline spinner immediately on click; re-enable when done |
| 2 | **Postel's Law** (be liberal in what you accept) | Video path input is a plain text field — any typo gives a cryptic server-side 400 error | OS file picker (already built) should be the *primary* path; text field stays as an override only; validate path client-side and show a helpful inline error |
| 3 | **Mental Model** (design matches user expectations) | Progress log panel uses Rich ANSI escape codes (`[bold]`, `[green]`) — these show as literal brackets in the browser log | Strip ANSI/Rich markup server-side before sending SSE lines, or interpret them as CSS classes |

### High (meaningfully degrades experience)

| # | Law | Current violation | Proposed fix |
|---|-----|------------------|--------------|
| 4 | **Goal-Gradient Effect** (proximity to goal increases motivation) | Ingest has no per-step completion percentage — only a text log | Show step completion bars on the progress pill (already partially built with step chips) |
| 5 | **Fitts's Law** (bigger + closer = faster) | Approve and Reject buttons are the same size as all other buttons | Make Approve/Reject larger (primary action size) with clear visual weight hierarchy |
| 6 | **Peak-End Rule** (judgements based on peak and final moments) | After ingest completes, the log panel closes and nothing celebrates success | Show a brief "✓ Done — N clips found" success banner in the header, auto-dismiss after 4s |
| 7 | **Hick's Law** (more choices = slower decisions) | Ingest modal shows all options at once: path, model, scene mode, profile, estimates | Collapse advanced options (model, scene mode) behind a disclosure arrow; defaults cover 90% of use cases |
| 8 | **Zeigarnik Effect** (open loops are remembered) | Rejected clips disappear from the default view — there's no "undo" or review queue | Add a "Rejected" filter tab to the sidebar; offer a one-click Undo for the last status change |
| 9 | **Jakob's Law** (users expect familiar patterns) | Clip player has no timeline scrubber or timestamp display | Add a standard HTML5 `<video>` controls bar; it's already a native `<video>` element |

### Moderate (friction for regular use)

| # | Law | Current violation | Proposed fix |
|---|-----|------------------|--------------|
| 10 | **Serial Position Effect** (first and last items are best remembered) | Clip list is sorted by score descending — the top clip is always the same | After review, re-sort to float un-reviewed (pending) clips to the top |
| 11 | **Miller's Law** (7 ± 2 items in working memory) | Long clip lists with no pagination or grouping — all clips shown at once | Group clips by session date or add virtual scrolling; show count badge on section headers |
| 12 | **Law of Proximity** (near elements are grouped) | Score bars (F/D/A) in the sidebar have no visual boundary separating them from the clip label | Add a subtle separator or tighten the vertical rhythm so score bars read as belonging to their clip |
| 13 | **Aesthetic-Usability Effect** (pretty = feels more usable) | Export Log button looks identical to functional action buttons — users may not understand what it does | Style it as a secondary/ghost button with a document icon; move it to a help/support section |
| 14 | **Chunking** (break information into digestible groups) | Detail panel shows score bars, description, actions, and transcript in a flat list | Add section dividers or card groupings: Summary → Actions → Transcript |
| 15 | **Von Restorff Effect** (distinctive items are remembered) | High-scoring clips look the same as low-scoring ones in the sidebar | Optionally highlight clips above a score threshold with a subtle coloured left border |

### Low (minor polish)

| # | Law | Current violation | Proposed fix |
|---|-----|------------------|--------------|
| 16 | **Cognitive Load** | Score abbreviations F/D/A are not explained anywhere | Add a legend tooltip on hover, or expand to Funny/Dramatic/Action on wider screens |
| 17 | **Law of Prägnanz** (simplest form is preferred) | Status dots (●) use three colours but no labels | Show status text next to the dot on hover, or in the detail panel header |
| 18 | **Selective Attention** | The "Build Reel" button in the header requires approved clips — clicking it when none exist gives a confusing 400 error | Disable "Build Reel" when there are no approved clips; show a tooltip explaining why |
| 19 | **Paradox of the Active User** (users skip docs) | First-run experience: blank page until you click Ingest | Show an empty-state illustration with a prominent "Get started — click + Ingest" prompt when no videos exist |

### UX items already addressed
- Model dropdown ordered fastest→slowest (Hick's Law)
- Whisper default set to `medium` (good balance; users rarely need to change it)
- OS file picker for video path (Postel's Law, reduces typo errors)
- Sub-score bars in sidebar (progressive disclosure of signal breakdown)
- Clip ID prefix in sidebar (disambiguation for multi-clip sessions)
- SSE progress log (Doherty Threshold, Zeigarnik Effect)

---

## Phase 4 — Packaging + distribution (Pending)

Goal: friends can install and use without knowing Python.

### Options to evaluate

| Option | Pros | Cons |
|---|---|---|
| `pip install rp-clipper` | Simple for Python users | Requires Python + pip knowledge |
| PyInstaller bundle | No Python needed, single exe | ~300 MB binary, slower startup |
| Docker | Fully self-contained | Requires Docker; GPU passthrough is extra setup |
| Electron wrapper | Native desktop feel, auto-update | Adds JS build complexity |

### Prerequisites users need regardless
- **FFmpeg** on PATH
- **Ollama** installed + running (optional; CPU fallback works without it)
- NVIDIA GPU + CUDA drivers (optional; CPU is much slower for large models)

### Refactor targets for Phase 4
- Replace `datetime.utcnow()` deprecation warnings
- First-run wizard: detect FFmpeg, check Ollama, pick project folder
- One-click installer / bundled release

---

## Explicitly out of scope
- Shareable clip links / LAN exposure
