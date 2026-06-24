# rp-clipper

Phase 1 of an RP gaming session clip extraction pipeline.

**What it does right now:**
- Probes video files and detects multiple audio tracks
- Lets you label each track (your mic, in-game voice chat, game sounds, etc.)
- Saves and reapplies track-label profiles for future recordings
- Extracts each audio track to a clean 16 kHz mono WAV
- Transcribes with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (fully local, no API)
- Groups transcript segments into clip candidates using natural silence gaps
- Exports any candidate to a video clip via FFmpeg

---

## Requirements

### FFmpeg

FFmpeg must be installed and on your PATH.

**Windows:**
```
winget install Gyan.FFmpeg
# or: choco install ffmpeg
# or: scoop install ffmpeg
```
Restart your terminal after installing so PATH is updated.

**Linux (Ubuntu/Debian):**
```
sudo apt install ffmpeg
```

**macOS:**
```
brew install ffmpeg
```

### Python 3.11+

**Windows:** Download from [python.org](https://www.python.org/downloads/) or `winget install Python.Python.3.12`.
Make sure "Add to PATH" is checked during install.

**Linux:** `sudo apt install python3.11 python3.11-venv` (or your distro equivalent)

---

## Install

```bash
# Clone the repo
git clone https://github.com/you/rp-clipper
cd rp-clipper

# Create a virtual environment (recommended)
# Windows:
python -m venv .venv
.venv\Scripts\activate

# Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate

# Install
pip install -e .
```

### GPU acceleration (optional)

If you have an NVIDIA GPU with CUDA toolkit installed:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

Then use `--device cuda` when ingesting.  On CPU, the `base` model
transcribes roughly 10–15× real-time; `large-v3` is much slower but
more accurate.

---

## Usage

### Probe a video (see its tracks without ingesting)
```bash
rp-clip probe session1.mp4
```

### Ingest a single video
```bash
cd my-recordings-folder
rp-clip ingest session1.mp4
```

You'll be prompted to label each audio track interactively.
Profiles can be saved so future recordings with the same setup
are labeled automatically.

### Ingest a whole folder
```bash
rp-clip ingest .
```

### Use a saved profile (skip interactive labeling)
```bash
rp-clip ingest session2.mp4 --profile obs_mic_desktop
```

### Use a larger / faster Whisper model
```bash
rp-clip ingest session1.mp4 --model small
rp-clip ingest session1.mp4 --model large-v3 --device cuda
```

### Check project status
```bash
rp-clip status
```

### List clip candidates
```bash
rp-clip clips                          # all
rp-clip clips session1                 # filter by filename
rp-clip clips --status pending         # filter by status
```

### Export a clip
```bash
rp-clip export 42                      # lossless stream-copy (fast)
rp-clip export 42 --reencode           # re-encode for frame-accurate cut
rp-clip export 42 --output clip.mp4    # custom output path
```

---

## Project layout

When you run `rp-clip ingest` in a directory, it creates:

```
your-folder/
└── .rp-clipper/
    ├── project.db       ← SQLite database (all metadata, transcripts, candidates)
    ├── config.json      ← project config (overrides global config)
    └── audio/
        ├── session1_stream0.wav
        └── session1_stream1.wav
    └── exports/
        └── session1_clip42_0-23.mp4
```

Global config and profiles are stored at:
- **Windows:** `%APPDATA%\rp-clipper\`
- **Linux:**   `~/.config/rp-clipper/`
- **macOS:**   `~/Library/Application Support/rp-clipper/`

---

## Whisper models

| Model    | Size   | Speed (CPU) | Notes                        |
|----------|--------|-------------|------------------------------|
| tiny     | ~75 MB | Very fast   | Rough — good for scouting    |
| base     | 150 MB | Fast        | Default — good balance       |
| small    | 500 MB | Moderate    | Noticeably better accuracy   |
| medium   | 1.5 GB | Slow        | Great for noisy audio        |
| large-v3 | 3 GB   | Very slow   | Best quality (use with GPU)  |

Models are downloaded from HuggingFace on first use and cached locally.

---

## What's coming (see BACKLOG.md)

- Phase 2: LLM scoring (Ollama, fully local), scene detection, audio energy
- Phase 3: Web review UI, auto mode, manual timeline scrubber
- Phase 4: Story editor, subtitle burn-in, export presets
- Speaker diarization + character name labeling (pyannote.audio)
