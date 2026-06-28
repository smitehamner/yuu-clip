# yuu-clip — Implemented Features

## Web UI

### Layout

- **Sidebar left pane** — video list with per-video clip count, approved count, exported count, score range bar, clipped time, and processing status badges (∅ summary / ∅ scored / ∅ timeline)
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

Embedded HTML5 player shown in the clip detail panel. Before export, the player streams a preview directly from the source file via FFmpeg (seekable; LRU-cached temp files). After export it plays the exported file and shows WebVTT subtitles if an SRT sidecar exists. Auto-plays on clip selection.

### New Recording panel

Open with the `+ Analyze` button in the header. Replaces the old modal with a full panel that keeps the sidebar live.

1. Browse for a video file (native OS file picker); file is inspected immediately after selection — shows stream table and time estimate
2. Optionally split the recording into segments before analysis (place markers on the waveform)
3. Select a track layout (optional)
4. If an SRT sidecar or embedded subtitle stream is detected, a `--subtitle-source` option appears to skip Whisper and import existing captions instead
5. Check world contexts to assign (optional)
6. Expand **Advanced Options** to change Whisper model, scene mode, or energy mode
7. **Start** button launches the analysis subprocess; progress appears in the header step pills

Time estimate panel breaks down expected wall-clock cost per step and warns if any step exceeds 30 minutes. Clicking another video while the panel is open prompts to discard if a path has been entered.

### Job progress indicator

Step pills in the header: Extract → Transcribe → Generate Clips → Energy → Scenes → Score. Each pill is gray (pending) → blue (active) → green (done). A cancel button is visible during analysis; it terminates the subprocess and marks the job cancelled.

### Track layout manager

Accessible via the Manage Layouts button in the New Recording panel.

- Lists built-in and custom track layouts with track count
- **Layout editor**: name, number of tracks (1–8), and per-track settings (label, transcribe flag, relevance weight)
- Saved track layouts are available in the New Recording panel dropdown

### Recording segments (split editor)

A recording can be split into independent segments before or after analysis.

- **Before analysis**: toggle in New Recording panel after probe; place markers on the waveform; analysis runs sequentially on each segment
- **After analysis**: "Split Recording" button opens the full-panel split editor; existing clips shown as dots on the waveform; confirm redistributes clips by start time and creates separate `Video` rows
- Waveform is generated on demand from per-second RMS energy data
- Segments appear in the sidebar as normal video entries; the parent is hidden once split
- Each segment has its own clips, contexts, title, summary, and timeline

### Highlight reel builder

Accessible from the header. Choose a video filter (all approved clips or a specific video), transition type and duration (including "random"), title card duration, and output filename. Ordered clip list lets you check/uncheck clips and reorder them before building. Saved reels go to `.yuu-clip/reels/` with a timestamp in the filename.

### World contexts manager

Accessible from the header. Create and edit named context bundles:

| Field | Purpose |
|-------|---------|
| Context ID | Short ID used in CLI (`--context una-server`) |
| Display name | Human-readable label shown in the UI |
| Setting | World description injected into LLM prompts |
| Your characters | Character(s) you play |
| Frequent other characters | Common NPCs / other players |
| Notes | Any other lore or context for the LLM |
| LLM scoring weights | Optional per-context overrides for funny / dramatic / action weights |

Contexts are assigned per-video and injected into every LLM call for that video. When a video is rescored, any weight overrides from assigned contexts are averaged together and applied instead of the global Settings weights.

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

## CLI commands

### `yuuclip probe <video>`
Inspects a video without analyzing it. Prints duration, resolution, FPS, and a table of all audio streams with codec, sample rate, channel count, and stream title. Useful for checking track layout before choosing a track layout.

### `yuuclip analyze <path> [options]`
Full end-to-end pipeline from raw video to scored clips.

**Options**

| Flag | Default | Notes |
|------|---------|-------|
| `--model` | `base` | Speech-to-text model: tiny (~40 MB VRAM), base (~75 MB), small (~240 MB), medium (~1.5 GB), large-v3 (~10 GB) |
| `--device` | `auto` | cuda or cpu; auto detects GPU — falls back to CPU if VRAM is insufficient for the chosen model |
| `--track-layout NAME` | — | Saved track layout to apply |
| `--language CODE` | — | Force speech-to-text language (e.g. `en`) |
| `--energy-mode` | `fast` | `none` / `fast` (4 kHz) / `full` (16 kHz) |
| `--context SLUG` | — | World context ID to attach; repeatable |
| `--no-transcribe` | — | Skip transcription step |
| `--no-segment` | — | Skip clip generation |
| `--no-score` | — | Skip scoring step |
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

### `yuuclip score [<video_id>|--all] [options]`
Re-runs scoring on an already-analyzed recording. Useful after changing world contexts or the AI model. Options: `--no-energy`, `--no-scenes`, `--no-llm`.

### `yuuclip status`
Table of all analyzed recordings: filename, duration, track count, clip count, analysis status (pending → probed → labeled → extracting → transcribed → done).

### `yuuclip clips [VIDEO_NAME] [--status FILTER] [--limit N]`
Browse clips in the terminal. Filter by partial video name or status (unreviewed, approved, rejected). Shows ID, start time, duration, status, tags, and transcript excerpt.

### `yuuclip export <clip_id> [options]`
Extract a single clip to MKV.

| Flag | Notes |
|------|-------|
| `--precise` | Frame-accurate cut via libx264 (slower; default is quick export) |
| `--captions` / `--no-captions` | Write SRT caption sidecar files (default: on) |
| `--bake-captions` | Burn captions into video frames (hardsub; forces re-encode) |
| `--embed-subs` | Add captions as a subtitle track (softsub; stream copy, fast) |
| `--container mkv\|mp4` | Override output container |
| `--output PATH` | Output path; default: `.yuu-clip/exports/` |

Output filename format: `{stem}_clip{id}_{start_hms}.mkv`

### `yuuclip retranscribe <clip_id> [options]`
Re-runs Whisper on just the clip's time window, then re-scores. Default model: large-v3. Options: `--model`, `--language`, `--no-rescore`.

### `yuuclip reel [options]`
Compiles a highlight reel from approved clips with title cards and transitions.

| Flag | Default | Notes |
|------|---------|-------|
| `--video ID` | all | Repeatable; restrict to these video IDs |
| `--top N` | all | Top N clips per video by score |
| `--min-score F` | 0.0 | Minimum overall score |
| `--status` | approved | Clip status filter |
| `--transition TYPE` | fade | fade, dissolve, wipeleft, wiperight, slideleft, slideright, none |
| `--trans-dur S` | 0.5 | Overlap in seconds |
| `--title-dur S` | 3.0 | Title card display time |
| `--output PATH` | auto | Default: `.yuu-clip/reels/reel_<timestamp>.mkv` |

### `yuuclip serve [options]`
Starts the web server and opens the browser. Options: `--host`, `--port` (default 8080), `--open`/`--no-open`, `--reload`. Preferred entry point for day-to-day use.

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

- **Quick export (default)**: keyframe-aligned stream copy; typically completes in 1–5 seconds regardless of clip length
- **Precise export** (`--precise`): frame-accurate using libx264 + AAC; expect ~10–30 s per minute of clip on CPU, or ~3–8 s per minute on a GPU-accelerated ffmpeg build
- **Captions — None** (default): SRT sidecar written alongside the export for later use
- **Captions — Softsub** (`--embed-subs`): SRT added as a subtitle track in the container; stream copy, fast; use MKV for broadest player support
- **Captions — Hardsub** (`--bake-captions`): subtitles burned into video frames; forces re-encode
- **Output**: `.yuu-clip/exports/`

### Highlight reel

- Filters clips by video, status, minimum score, and top-N per video
- Generates ffmpeg title cards with clip descriptions between each clip
- Supports fade, dissolve, wipe, and slide transitions with configurable overlap duration
- Output: MKV, requires ffmpeg ≥ 4.4

---

## Configuration

### Project directory

All state is stored in `.yuu-clip/` next to your video files (or in the directory passed to `--project`):

```
.yuu-clip/
  yuu-clip.db      # SQLite database
  yuu-clip.log     # rolling log
  exports/           # exported clips
  reels/             # compiled highlight reels (timestamp-named MKVs)
  audio/             # extracted WAV files (temporary; reused across runs)
```

### Track layouts

Saved per-project. Each track layout stores: number of tracks, and per-track label, transcribe flag, and relevance weight. Created and edited in the web UI track layout manager or by hand in the database.

### Scoring weights

Global defaults set in Settings (`score_funny_weight`, `score_dramatic_weight`, `score_action_weight`). Overall score = weighted average normalized to [0, 1].

Per-context overrides can be set in the World Context editor. When a video is rescored, the weights from all assigned contexts that have overrides are averaged and used instead of the global defaults. Contexts without overrides are ignored in the average.
