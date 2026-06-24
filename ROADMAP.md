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
- Video list and clip list sidebar with sub-score bars (F/D/A)
- Clip detail: video player, score bars, description, transcript excerpt
- Approve / Reject / Reset workflow with status dot
- Export clip via SSE progress stream
- Score All button with SSE progress
- Ingest modal: native OS file picker, probe + time estimates, warning threshold
- Step-by-step progress indicator in header during jobs

### Remaining
- [ ] Settings page (edit config.toml from the UI)
- [ ] Profile management (create/edit/delete profiles from the UI)
- [ ] Timeline scrubber: full video timeline with energy heatmap + scene markers
- [ ] Clip trim / adjust in-out points
- [ ] Auto-approve mode (threshold-based batch export)
- [ ] `rp-clip demo` integration in the UI (build reel from approved clips)

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
- Config file UI (edit config.toml from the web UI)
- Profile management in the web UI
- First-run wizard: detect FFmpeg, check Ollama, pick project folder
- Export format options (mp4 vs mkv, resolution scaling)

---

## Deferred ideas (from original backlog)

- **Speaker diarization** — pyannote.audio; segment transcripts by speaker cluster, label per character
- **Voice fingerprinting** — assign character names to speaker clusters; boost score by character
- **Hot-word detection** — flag clips containing user-defined phrases (character names, server catchphrases)
- **Noise reduction preprocessing** — RNNoise/noisereduce on combined/game_sounds before Whisper
- **Confidence filtering** — drop low-logprob Whisper segments before LLM scoring
- **Multi-session grouping** — treat multiple OBS files as one session with a unified timeline
- **Clip deduplication** — merge overlapping candidates generated from different tracks
- **Language detection per track** — surface auto-detected language; allow per-track override
- **Export presets** — YouTube 1080p, TikTok 9:16, Discord 8 MB
