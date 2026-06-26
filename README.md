# rp-clipper

An RP gaming session clip extraction pipeline. Ingests OBS recordings, transcribes all audio tracks with Whisper, scores clip candidates with a local LLM, and surfaces the best moments through a web review UI.

Everything runs locally — no cloud APIs, no internet required after first model download.

---

## What it does

- Probes video files and detects multiple OBS audio tracks
- Labels tracks interactively (mic, voice chat, game sounds, combined) with saved profiles
- Extracts audio tracks to 16 kHz mono WAV
- Transcribes with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (GPU accelerated via CTranslate2)
- Detects when specialized tracks duplicate a combined track and falls back automatically
- Groups transcript segments into clip candidates using silence gaps
- Scores clips via audio energy, scene-cut density, and a local LLM (Ollama)
- Generates a one-sentence description of each clip
- Web UI to review clips, approve/reject, and export
- Exports clips via FFmpeg with optional SRT subtitle sidecars
- `rp-clip reel` command to compile approved clips into a highlight reel with transitions

---

## Requirements

### FFmpeg
Must be on PATH.
```
winget install Gyan.FFmpeg        # Windows
brew install ffmpeg               # macOS
sudo apt install ffmpeg           # Ubuntu/Debian
```

### Python 3.11+
```
winget install Python.Python.3.12   # Windows
```

### Ollama (optional — for LLM scoring)
Download from [ollama.ai](https://ollama.ai). After installing, pull the model:
```
ollama pull llama3.1:8b
```
Ollama must be running (`ollama serve`) when you ingest or score.

---

## Install

```bash
git clone https://github.com/you/rp-clipper
cd rp-clipper
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

pip install -e .
```

---

## Quick start

### Start the web UI (recommended)
```bash
cd my-recordings-folder
rp-clip serve
```
Then navigate to `http://127.0.0.1:8080`. Use the **+ Analyze** button to add a video.

### CLI usage

```bash
# Analyze a video (auto-assigns tracks via a saved track layout)
rp-clip analyze session.mkv --track-layout my_obs_setup

# Re-score all clips (useful after changing the AI model or world contexts)
rp-clip score --all

# Export a clip by ID
rp-clip export 42 --captions

# Compile approved clips into a highlight reel
rp-clip reel --output highlights.mkv --transition fade

# Start the web UI for a specific project folder
rp-clip serve --project /path/to/recordings
```

---

## GPU acceleration

faster-whisper uses CTranslate2, which detects CUDA automatically. No PyTorch needed.

For best results, install CUDA drivers for your GPU. The tool will automatically use `float16` compute on CUDA and fall back to CPU `int8` otherwise.

```bash
# Check which device is being used — shown in analyze output
rp-clip analyze session.mkv
```

---

## Whisper models

| Model    | VRAM   | Speed (GPU) | Notes                        |
|----------|--------|-------------|------------------------------|
| tiny     | ~0.5 GB | Very fast  | Rough — good for scouting    |
| base     | ~1 GB   | Fast       | Decent quality               |
| small    | ~2 GB   | Fast       | Good balance                 |
| medium   | ~5 GB   | Moderate   | Default — great for noisy audio |
| large-v3 | ~10 GB  | Moderate   | Best quality                 |

Models are downloaded from HuggingFace on first use and cached locally (`~/.cache/huggingface`).

---

## Project layout

```
recordings-folder/
└── .rp-clipper/
    ├── project.db        ← SQLite (all metadata, transcripts, candidates, scores)
    ├── config.toml       ← project config (overrides global defaults)
    ├── audio/
    │   ├── session_stream0.wav
    │   └── session_stream1.wav
    └── exports/
        └── session_clip42_0-23-15.mkv
```

Global config and profiles:
- **Windows:** `%APPDATA%\rp-clipper\`
- **Linux:**   `~/.config/rp-clipper/`
- **macOS:**   `~/Library/Application Support/rp-clipper/`

---

## Offline use

After the initial model downloads (Whisper via HuggingFace, LLM via `ollama pull`), the entire pipeline runs with no internet connection.

---

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's in progress and what's planned.
