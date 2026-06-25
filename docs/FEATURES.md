# rp-clipper — Implemented Features

## CLI commands

### `rp-clip probe <video>`
Inspects a video without analyzing it. Prints duration, resolution, FPS, and a table of all audio streams with codec, sample rate, channel count, and stream title. Useful for checking track layout before choosing a track layout.

### `rp-clip ingest <path> [options]`
Full end-to-end pipeline from raw video to scored clip candidates.

**Options**

| Flag | Default | Notes |
|------|---------|-------|
| `--model` | `base` | Whisper model: tiny (~40 MB VRAM), base (~75 MB), small (~240 MB), medium (~1.5 GB), large-v3 (~10 GB) |
| `--device` | `auto` | cuda or cpu; auto detects GPU — falls back to CPU if VRAM is insufficient for the chosen model |
| `--profile NAME` | — | Saved track layout to apply |
| `--language CODE` | — | Force Whisper language (e.g. `en`) |
| `--energy-mode` | `fast` | `none` / `fast` (4 kHz) / `full` (16 kHz) |
| `--context SLUG` | — | World context ID to attach; repeatable |
| `--no-transcribe` | — | Skip Whisper step |
| `--no-segment` | — | Skip clip generation |
| `--no-score` | — | Skip Phase 2 scoring |
| `--force` | — | Reprocess even if already analyzed |
| `--no-interact` | — | Never prompt (always set by web UI) |

**Pipeline stages (in order)**
1. **Inspect** — FFprobe extracts video metadata
2. **Label tracks** — Assign each audio stream a role: combined, player_voice, ingame_voicechat, game_sounds, or unlabeled
3. **Extract audio** — FFmpeg → 16-bit mono WAV at 16 kHz per track
4. **Overlap detection** — RMS correlation; suppress specialized tracks that duplicate the combined track
5. **Transcribe** — Whisper on each eligible track; suppress near-duplicate transcripts
6. **Generate clips** — Sliding-window segmentation aligned to transcript word boundaries (30–120 s windows, 15 s stride)
7. **Score** — Audio energy, scene detection, LLM scoring (see Scoring section)

**End-to-end timing — default settings (energy: fast, scene: fast, 2 audio tracks)**

Numbers below assume one transcribed track (combined). The web UI shows a live estimate for your specific file before you start.

| Video length | RTX GPU + `base` | RTX GPU + `medium` | RTX GPU + `large-v3` | CPU-only + `large-v3` |
|---|---|---|---|---|
| 30 min | ~5 min | ~6 min | ~9 min | ~1h 20min |
| 1 hour | ~9 min | ~11 min | ~18 min | ~2h 40min |
| 2.5 hours | ~23 min | ~28 min | ~45 min | ~6h 35min |

Transcription dominates for large-v3; audio extraction dominates for fast models. Approximate breakdown for a 1-hour session on GPU + `large-v3`: extract 6 min, transcribe 10 min, energy 14 s, scene 18 s, LLM scoring 1.5 min.

> **CPU note:** On CPU, `large-v3` is roughly 150× slower than an RTX GPU for transcription. Smaller models (`base`, `small`) are significantly faster on CPU but the in-app estimate uses a single conservative ratio for all models — expect the real time to be faster than shown for small/base on CPU. `medium` or larger on CPU is not practical for sessions over 30 minutes.

### `rp-clip score [<video_id>|--all] [options]`
Re-runs Phase 2 scoring on an already-analyzed recording. Useful after changing world contexts or Ollama model. Options: `--no-energy`, `--no-scenes`, `--no-llm`.

### `rp-clip status`
Table of all analyzed recordings: filename, duration, track count, clip count, analysis status (pending → probed → labeled → extracting → transcribed → done).

### `rp-clip clips [VIDEO_NAME] [--status FILTER] [--limit N]`
Browse clips in the terminal. Filter by partial video name or status (pending, approved, rejected). Shows ID, start time, duration, status, tags, and transcript excerpt.

### `rp-clip export <clip_id> [options]`
Extract a single clip to MKV.

| Flag | Notes |
|------|-------|
| `--reencode` | Frame-accurate cut via libx264 (slower; default is quick export) |
| `--subtitles` / `--no-subtitles` | Write SRT caption sidecar files (default: on) |
| `--burn-subs` | Bake captions into video (forces re-encode) |
| `--output PATH` | Output path; default: `.rp-clipper/exports/` |

Output filename format: `{stem}_clip{id}_{start_hms}.mkv`

### `rp-clip retranscribe <clip_id> [options]`
Re-runs Whisper on just the clip's time window, then re-scores. Default model: large-v3. Options: `--model`, `--language`, `--no-rescore`.

### `rp-clip demo [options]`
Compiles a highlight reel from clips with title cards and transitions.

| Flag | Default | Notes |
|------|---------|-------|
| `--video ID` | all | Repeatable; restrict to these video IDs |
| `--top N` | all | Top N clips per video by score |
| `--min-score F` | 0.0 | Minimum overall score |
| `--status` | approved | Clip status filter |
| `--transition TYPE` | fade | fade, dissolve, wipeleft, wiperight, slideleft, slideright, none |
| `--trans-dur S` | 0.5 | Overlap in seconds |
| `--title-dur S` | 3.0 | Title card display time |
| `--output PATH` | auto | Default: `.rp-clipper/exports/demo_<timestamp>.mkv` |

### `rp-clip serve [options]`
Starts the web server and opens the browser. Options: `--host`, `--port` (default 8080), `--open`/`--no-open`, `--reload`. Preferred entry point for day-to-day use.

---

## Web UI

### Layout

- **Sidebar left pane** — video list with per-video clip count, total clipped time, approval count, and pipeline status
- **Sidebar right pane** — clip list for the selected video; sortable by score (highest first) or timeline (chronological)
- **Main panel** — detail view for the selected video or clip, plus video player
- **Header** — global action buttons and live job status (step pills + cancel button)
- **Log panel** — collapsible; streams live job output; download button for the full log file

### Video management

- **Select a video** — click in the sidebar to load its detail view
- **Delete a video** — X button removes the database record; the source file is untouched
- **Video detail view** shows: title, duration, clip/approval counts, total clipped time, and assigned world contexts

### Contexts on a video

- **Add / remove context chips** directly on the video detail view
- A warning appears if clips were last scored with different contexts than currently assigned
- **Re-score with context** button triggers LLM re-scoring using current contexts

### Video-level LLM features

- **Generate Summary** — sends the full transcript to Ollama; returns a title and a paragraph summary of the session
- **Generate Timeline** — streams an LLM-generated timeline in 15-minute chunks, describing key events in each window

### Clip review

Each clip detail view shows:

- **Score bars** (0–1 scale): Overall, Funny, Dramatic, Action
- **One-liner description** and **long description** (paragraph)
- **Tags**: auto-generated labels such as `llm_scored`, `energy_scored`, `long_silence_after`
- **Transcript excerpt** in a monospace box
- **Status buttons**: Approve / Reject / Reset (unreviewed)

Actions available per clip:

| Button | What it does |
|--------|-------------|
| Retranscribe | Re-runs Whisper on this clip's time window; shows model selector |
| Re-score | Sends clip to Ollama with current context |
| Export | Extracts the clip to MKV (shows options modal) |
| Delete | Removes the clip record and any exported files |

### Video player

Embedded HTML5 player appears once a clip has been exported. Plays the exported MKV, shows WebVTT subtitles if an SRT sidecar exists, and auto-plays on clip selection. Before export, an "Export Clip" button is shown instead.

### Analyze modal

1. Type or browse for a video file path (native file picker via tkinter)
2. Inspects the file immediately after selection; shows stream table and time estimates
3. Select a track layout (optional)
4. Check world contexts to assign (optional)
5. Expand **Advanced Options** to change Whisper model, scene mode, or energy mode
6. **Start** button launches the analysis subprocess; progress appears in the header step pills

Time estimate panel breaks down expected wall-clock cost per step and warns if any step exceeds 30 minutes.

### Job progress indicator

Step pills in the header: Extract → Transcribe → Generate Clips → Energy → Scenes → Score. Each pill is gray (pending) → blue (active) → green (done). A cancel button is visible during analysis; it terminates the subprocess and marks the job cancelled.

### Track layout manager

Accessible via the Manage Layouts button in the analyze modal.

- Lists built-in and custom track layouts with track count
- **Layout editor**: name, number of tracks (1–8), and per-track settings (label, transcribe flag, relevance weight)
- Saved track layouts are available in the analyze modal dropdown

### Highlight reel builder

Accessible from the header. Choose a video filter (all approved clips or a specific video), transition type and duration, title card duration, and output filename. Shows a preview list of clips to be compiled before building.

### World contexts manager

Accessible from the header. Create and edit named context bundles:

| Field | Purpose |
|-------|---------|
| Context ID | Short ID used in CLI (`--context una-server`) |
| Display name | Human-readable label shown in the UI |
| Setting | RP world description injected into LLM prompts |
| Your characters | Character(s) you play |
| Frequent other characters | Common NPCs / other players |
| Notes | Any other lore or context for the LLM |

Contexts are assigned per-video and injected into every LLM call for that video.

### About / help panel

Keyboard shortcuts, dependency versions table, and licensing notes. Open with `?`.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `A` | Approve current clip |
| `R` | Reject current clip |
| `Space` | Play / pause video |
| `E` | Export current clip |
| `←` / `↑` | Previous clip |
| `→` / `↓` | Next clip |
| `?` | Open about panel |

---

## Scoring

### Audio energy scorer

Computes per-second RMS loudness (dB) for each extracted audio track. Two resolution modes:

- **fast** — 4 kHz downsampled; low CPU cost
- **full** — full 16 kHz; more accurate but slower

Track relevance weights (set in the labeling profile) reduce the contribution of game_sounds tracks relative to player_voice. Energy peaks contribute primarily to `score_action`.

### Scene cut scorer

Three modes:

- **transcript-only** — uses gaps > 5 s in the transcript as scene boundaries; effectively free
- **fast** — keyframe cut detection (low FPS threshold) + transcript gaps; adds ~10–45 s regardless of hardware
- **full** — scans every frame with PySceneDetect; costs roughly 60% of the video's duration

| Video length | fast | full |
|---|---|---|
| 30 min | ~10 s | ~18 min |
| 1 hour | ~18 s | ~36 min |
| 2.5 hours | ~45 s | ~1.5 hours |

`full` mode is only worth using if you want precise visual cut boundaries — `fast` is sufficient for most RP sessions where cuts align naturally with transcript silences.

Scene cuts are stored as database records and influence candidate boundaries.

### LLM scorer (Ollama)

Sends each candidate's transcript excerpt to a locally running Ollama instance. Returns a JSON object with:

| Field | Description |
|-------|-------------|
| `description` | One-liner (< 20 words) |
| `description_long` | 3–5 sentence paragraph: what happened, who was involved, why it matters |
| `score_funny` | 0–1; jokes, absurdist RP, chaotic banter |
| `score_dramatic` | 0–1; confrontations, revelations, emotional beats |
| `score_action` | 0–1; combat, chaos, high-stakes tension |

World context text is injected into the system prompt so the LLM understands character relationships and setting. If Ollama is unreachable the ingest continues with zero scores and a warning in the log.

LLM scoring speed depends entirely on your Ollama setup and model. Rough estimates at ~4 s/clip:

| Video length | Estimated clips | Time |
|---|---|---|
| 30 min | ~10 clips | ~40 s |
| 1 hour | ~20 clips | ~1.5 min |
| 2.5 hours | ~50 clips | ~3.5 min |

A larger or slower Ollama model multiplies these times proportionally. Running Ollama on the same GPU as Whisper is fine — they run sequentially, not simultaneously.

### Overall score

Weighted average of the three dimension scores. Default weight: equal. Configurable in project config.

---

## Export

### Single clip

- **Quick export (default)**: keyframe-aligned; typically completes in 1–5 seconds regardless of clip length
- **Precise export** (`--reencode` or checkbox in UI): frame-accurate using libx264 + AAC; expect ~10–30 s per minute of clip on CPU, or ~3–8 s per minute on a GPU-accelerated ffmpeg build
- **Captions**: SRT caption sidecar files written by default (one per transcript track); optionally baked into video
- **Output**: MKV in `.rp-clipper/exports/`

### Highlight reel

- Filters clips by video, status, minimum score, and top-N per video
- Generates ffmpeg title cards with clip descriptions between each clip
- Supports fade, dissolve, wipe, and slide transitions with configurable overlap duration
- Output: MKV, requires ffmpeg ≥ 4.4

---

## Configuration

### Project directory

All state is stored in `.rp-clipper/` next to your video files (or in the directory passed to `--project`):

```
.rp-clipper/
  rp-clipper.db      # SQLite database
  rp-clipper.log     # rolling log
  exports/           # exported clips and demo reels
  audio/             # extracted WAV files (temporary; reused across runs)
```

### Track layouts

Saved per-project. Each track layout stores: number of tracks, and per-track label, transcribe flag, and relevance weight. Created and edited in the web UI track layout manager or by hand in the database.

### Scoring weights

Set in the project config: `score_funny_weight`, `score_dramatic_weight`, `score_action_weight`. Overall score = weighted average normalized to [0, 1].
