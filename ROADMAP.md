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

| # | Law | Status | Current violation | Fix applied |
|---|-----|--------|------------------|-------------|
| 1 | **Doherty Threshold** | ✅ Done | No feedback when clicking Build Reel start or Score All — button appears unresponsive for ~1s before SSE begins | `startJobUI()` disables ingest/score/demo buttons synchronously; `showToast()` announces completion; Ingest start button disabled + relabelled "Starting…" until SSE opens |
| 2 | **Postel's Law** | Open | Video path input typo gives cryptic 400 error | OS file picker is the primary entry (prominent Browse button); probe response shows inline red error text next to the field |
| 3 | **Mental Model** | ✅ Done | Progress log panel shows Rich markup `[bold]`, `[green]` as literal brackets | `stripRichMarkup()` in `appendLog()` strips ANSI escape codes and Rich `[tag]`/`[/tag]` patterns before display |

### High (meaningfully degrades experience)

| # | Law | Status | Current violation | Fix / plan |
|---|-----|--------|------------------|------------|
| 4 | **Goal-Gradient Effect** | Open | Ingest has no per-step completion percentage | Step chips in header pill already change active → done; percentage within a step remains future work |
| 5 | **Fitts's Law** | ✅ Done | Approve and Reject buttons same size as all others | `.btn.approve` / `.btn.reject` now `padding: 9px 22px; font-size: 14px; font-weight: 600` |
| 6 | **Peak-End Rule** | ✅ Done | After ingest completes, nothing celebrates success | `showToast()` appears after ingest, score, export, retranscribe, and demo complete; auto-dismisses after 4 s |
| 7 | **Hick's Law** | ✅ Done | Ingest modal shows all options at once | Whisper model + scene detection collapsed into `<details class="advanced">` disclosure; collapsed by default |
| 8 | **Zeigarnik Effect** | Open | Rejected clips disappear from default view — no undo | Add a "Rejected" filter tab; one-click Undo for last status change |
| 9 | **Jakob's Law** | ✅ Done | Clip player had no timeline scrubber | `<video controls autoplay>` already provides full native browser controls |

### Moderate (friction for regular use)

| # | Law | Status | Current violation | Fix / plan |
|---|-----|--------|------------------|------------|
| 10 | **Serial Position Effect** | Open | Clip list sorted score-descending; pending clips not surfaced | Re-sort to float pending clips to the top after reviewing |
| 11 | **Miller's Law** | Open | All clips shown at once with no grouping | Group by session or add virtual scrolling; count badge on section headers |
| 12 | **Law of Proximity** | Open | F/D/A bars have no visual boundary from clip label | Tighten vertical rhythm; subtle separator above mini bars |
| 13 | **Aesthetic-Usability Effect** | ✅ Done | Export Log button looked like an action button | Restyled as `.btn.ghost` with muted colour and `↓ Log` label |
| 14 | **Chunking** | Open | Detail panel is a flat list | Add card groupings: Summary → Actions → Transcript |
| 15 | **Von Restorff Effect** | Open | High-scoring clips look identical to low-scoring ones | Coloured left border for clips above a score threshold |

### Low (minor polish)

| # | Law | Status | Current violation | Fix / plan |
|---|-----|--------|------------------|------------|
| 16 | **Cognitive Load** | ✅ Done | Score abbreviations F/D/A unexplained | `miniBar()` now passes `title="Funny: 82%"` etc. — full name + percent visible on hover |
| 17 | **Law of Prägnanz** | Open | Status dots use three colours but no labels | Show status text in detail panel header |
| 18 | **Selective Attention** | ✅ Done | "Build Reel" clickable when no approved clips → confusing 400 | `_updateDemoButton()` disables `#btn-demo` with tooltip when `approvedCount === 0`; `openDemoModal()` also guards and shows an info toast |
| 19 | **Paradox of the Active User** | ✅ Done | First-run: blank main panel until Ingest | `_showEmptyState()` renders a welcome card with "Ingest your first video" CTA when `_videos` is empty |

### UX items already addressed
- Model dropdown ordered fastest→slowest (Hick's Law)
- Whisper default set to `medium` (good balance; users rarely need to change it)
- OS file picker as primary video path entry (Postel's Law)
- Sub-score bars in sidebar (progressive disclosure of signal breakdown)
- Clip ID prefix in sidebar (disambiguation for multi-clip sessions)
- SSE progress log (Doherty Threshold, Zeigarnik Effect)
- `<video controls autoplay>` player (Jakob's Law)

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
