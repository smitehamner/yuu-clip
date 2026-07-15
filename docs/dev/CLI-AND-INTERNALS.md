# YuuClip - CLI and internals reference

Power-user / developer reference: the `yuuclip` command-line interface, the scoring
engine internals, and the on-disk project layout and config keys. Most people never
need this - the desktop app and web UI cover everything here.

- Plain-English intro: [../user/OVERVIEW.md](../user/OVERVIEW.md)
- User feature guide: [../user/FEATURES.md](../user/FEATURES.md)
- Timing, hardware, and storage: [../user/PERFORMANCE.md](../user/PERFORMANCE.md)

---

## CLI commands

For day-to-day use, `yuuclip serve` (below) starts the web UI and is the preferred
entry point. The rest are for scripting and headless runs.

### `yuuclip probe <video>`
Inspects a video without analyzing it. Prints duration, resolution, FPS, and a table of all audio streams with codec, sample rate, channel count, and stream title. Useful for checking tracks before choosing a track layout.

### `yuuclip analyze <path> [options]`
Full end-to-end pipeline from raw video to scored clips.

**Options**

| Flag | Default | Notes |
|------|---------|-------|
| `--model` | `base` | Speech-to-text model: tiny (~40 MB VRAM), base (~75 MB), small (~240 MB), medium (~1.5 GB), large-v3 (~10 GB) |
| `--device` | `auto` | cuda or cpu; auto detects GPU - falls back to CPU if VRAM is insufficient for the chosen model |
| `--track-layout NAME` | - | Saved track layout to apply |
| `--language CODE` | - | Force speech-to-text language (e.g. `en`) |
| `--energy-mode` | `fast` | `none` / `fast` (4 kHz) / `full` (16 kHz) |
| `--context SLUG` | - | World context ID to attach; repeatable |
| `--no-transcribe` | - | Skip transcription step |
| `--no-segment` | - | Skip clip generation |
| `--no-score` | - | Skip scoring step |
| `--force` | - | Reprocess even if already analyzed |
| `--no-interact` | - | Never prompt (always set by web UI) |

**Pipeline stages (in order)**
1. **Inspect** - FFprobe extracts video metadata
2. **Label tracks** - Assign each audio stream a role: combined, player_voice, ingame_voicechat, game_sounds, or unlabeled
3. **Extract audio** - FFmpeg -> 16-bit mono WAV at 16 kHz per track
4. **Overlap detection** - RMS correlation; suppress specialized tracks that duplicate the combined track
5. **Transcribe** - Whisper on each eligible track; suppress near-duplicate transcripts
6. **Generate clips** - Sliding-window segmentation aligned to transcript word boundaries (30-120 s windows, 15 s stride)
7. **Score** - Audio energy, scene detection, LLM scoring (see Scoring internals below)

End-to-end timing estimates by video length, model, and device are in
[../user/PERFORMANCE.md](../user/PERFORMANCE.md#analysis-time-estimates).

### `yuuclip score [<video_id>|--all] [options]`
Re-runs scoring on an already-analyzed recording. Useful after changing world contexts or the model. Options: `--no-energy`, `--no-scenes`, `--no-llm`.

### `yuuclip status`
Table of all analyzed recordings: filename, duration, track count, clip count, analysis status (pending -> probed -> labeled -> extracting -> transcribed -> done).

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
| `--caption-font NAME` | Burned-in caption font (must be installed; default from config) |
| `--caption-size N` | Burned-in caption size, 12-96 (0 = renderer default) |
| `--caption-position bottom\|top` | Burned-in caption position (default from config) |
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
| `--captions` | off | Also write a stitched `<reel>.srt` caption sidecar |
| `--bake-captions` | off | Burn captions into the reel video (also writes the sidecar); uses the configured Caption style |

### `yuuclip serve [options]`
Starts the web server and opens the browser. Options: `--host`, `--port` (default 8080), `--open`/`--no-open`, `--reload`. Preferred entry point for day-to-day use.

### `yuuclip restore --archive <backup.zip> --project <folder>`
Unpacks a backup `.zip` into a project folder. Add `--overwrite` to replace a project that already exists there (a `project.db.pre-restore` safety copy is kept). This is the command the setup wizard runs for its "Restore from a backup" choice; for day-to-day restores use Settings > Backup & Restore in the web UI, which also handles re-pointing moved source videos.

---

## Scoring internals

The user-facing explanation of what each score and signal means is in
[../user/FEATURES.md](../user/FEATURES.md). This section covers the mechanics.

### Audio energy scorer

Computes per-second RMS loudness (dB) for each extracted audio track. Two resolution modes:

- **fast** - 4 kHz downsampled; low CPU cost
- **full** - full 16 kHz; more accurate but slower

Track relevance weights (set in the track layout) reduce the contribution of game_sounds tracks relative to player_voice. Energy peaks contribute primarily to `score_action`.

### Scene cut scorer

Three modes:

- **transcript-only** - uses gaps > 5 s in the transcript as scene boundaries; effectively free
- **fast** - keyframe cut detection (low FPS threshold) + transcript gaps; adds ~10-45 s regardless of hardware
- **full** - scans every frame with PySceneDetect; costs roughly 60% of the video's duration

| Video length | fast | full |
|---|---|---|
| 30 min | ~10 s | ~18 min |
| 1 hour | ~18 s | ~36 min |
| 2.5 hours | ~45 s | ~1.5 hours |

`full` mode is only worth using if you want precise visual cut boundaries - `fast` is sufficient for most sessions where cuts align naturally with transcript silences. Scene cuts are stored as database records and influence candidate boundaries.

### Visual axis

The **Visual** axis is derived from a model-free frame-diff pass (downscaled, sampled a
few times a second) plus scene-cut density, stored in the `VisualActivity` table and
fed to `score_visual`. It runs on every analysis with no extra download. The
user-facing behavior it drives (silent visual clips, the "No dialogue" state, optional
vision-model auto-describe) is documented in the user feature guide.

### Lightweight signal scorers

These run with zero extra downloads and are what makes clip scoring work in lightweight mode. Each nudges the funny / dramatic / action scores; their weights are set in Settings -> Scoring weights.

- **Laughter** - detects laughter in the audio; nudges funny.
- **Lexicon** - curated keyword-density matching; nudges funny / dramatic / action.
- **Speech-rate** - words-per-second bursts; nudges funny / action.
- **Prosody** - loudness and pitch delivery dynamics; nudges dramatic / action.
- **Speaker-overlap** - rapid speaker turn-taking and cross-talk; nudges funny / action. Requires speaker detection.
- **Audio-event** *(heavy, on by default)* - gunshot / explosion / cheer detection via an AudioSet model; nudges action / funny.

Without a language model installed, these signals plus audio energy and scene cuts still rank clips; the LLM scorer only adds written descriptions and a semantic score on top.

### LLM scorer output schema

Sends each candidate's transcript excerpt to the local LLM backend (a local `.gguf`
model via the bundled llama.cpp engine - all inference is on-device). When speaker labels are
enabled the excerpt is formatted with `SPEAKER_XX:` prefixes. World context text is
injected into the system prompt. Returns a JSON object:

| Field | Description |
|-------|-------------|
| `description` | One-liner (< 20 words) |
| `description_long` | 3-5 sentence paragraph: what happened, who was involved, why it matters |
| `score_funny` | 0-1; jokes, absurd moments, chaotic banter |
| `score_dramatic` | 0-1; confrontations, revelations, emotional beats |
| `score_action` | 0-1; combat, chaos, high-stakes tension |

If the LLM backend is unreachable the analysis continues with zero scores and a warning in the log. LLM scoring speed is roughly ~4 s/clip on the local backend; a larger or slower model multiplies that proportionally.

---

## On-disk layout and config keys

### Project directory

All state is stored in `.yuu-clip/` next to your video files (or in the directory passed to `--project`):

```
.yuu-clip/
  project.db         # SQLite database          (in a backup)
  config.json        # project settings          (in a backup)
  contexts.json      # world contexts            (in a backup)
  sounds/            # custom notification sounds (in a backup)
  yuu-clip.log       # rolling log               (not backed up)
  exports/           # exported clips            (not backed up; regenerable)
  reels/             # compiled highlight reels  (not backed up; regenerable)
  audio/             # extracted WAV files       (not backed up; reused across runs)
  proxies/           # cached 720p preview copies (not backed up; rebuilt on demand)
  downloads/         # Import-from-URL downloads  (not backed up)
  preview_cache/     # cached clip preview frames (not backed up; rebuilt on demand)
```

What a backup includes and why is covered under "Backing up a project" in the user feature guide.

### Track layout storage

Saved per-project. Each track layout stores: number of tracks, and per-track label, transcribe flag, and relevance weight. Created and edited in the web UI track layout manager, or by hand in the database.

### Scoring weight keys

Global defaults live in config as `score_funny_weight`, `score_dramatic_weight`, and `score_action_weight`. Overall score = weighted average normalized to [0, 1].

Per-context overrides are set in the World Context editor. When a video is rescored, the weights from all assigned contexts that have overrides are averaged and used instead of the global defaults; contexts without overrides are ignored in the average.
