# YuuClip - running from source (power users & developers)

This guide covers running YuuClip from source, the command-line interface, and the
technical reference material. Most people should use the desktop app instead - see the
[README](README.md).

If you want to modify the code and open a pull request, read
[CONTRIBUTING.md](.github/CONTRIBUTING.md) as well - it covers the dev CLI, tests, and code
standards.

---

## Requirements

### FFmpeg
Must be on PATH.
```
winget install Gyan.FFmpeg        # Windows
brew install ffmpeg               # macOS
sudo apt install ffmpeg           # Ubuntu/Debian
```

### Python 3.11 - 3.13
```
winget install Python.Python.3.12   # Windows
```

### A language model - optional
LLM scoring and written clip descriptions are optional. Without a model, YuuClip still
finds and scores clips using its no-model signals. To enable LLM scoring, pick a local
`.gguf` model in the setup wizard or Settings - run via the bundled, GPU-accelerated
llama.cpp engine. YuuClip can download a recommended, monetization-safe model for you.
All inference is on-device; nothing you record leaves your machine.

---

## Install

```bash
git clone https://github.com/smitehamner/yuu-clip
cd yuu-clip
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

pip install -e .        # contributors: use  pip install -e ".[dev]"  (adds test + lint tools)
```

---

## Quick start

### Start the web UI (recommended)
```bash
cd my-recordings-folder
yuuclip serve
```
Then navigate to `http://127.0.0.1:8080`. Use the **+ New Recording** button to add a video.

### CLI usage

```bash
# Analyze a video (auto-assigns tracks via a saved track layout)
yuuclip analyze session.mkv --track-layout my_obs_setup

# Analyze a video downloaded from a URL
yuuclip import-url https://example.com/vod

# Re-score all clips (useful after changing the model or world contexts)
yuuclip score --all

# Export a clip by ID
yuuclip export 42 --captions

# Compile approved clips into a highlight reel
yuuclip reel --output highlights.mkv --transition fade

# Start the web UI for a specific project folder
yuuclip serve --project /path/to/recordings
```

---

## GPU acceleration

faster-whisper uses CTranslate2, which detects CUDA automatically. No PyTorch is needed
for transcription.

For best results, install CUDA drivers for your GPU. The tool automatically uses
`float16` compute on CUDA and falls back to CPU `int8` otherwise. The device in use is
shown in the analyze output.

---

## Whisper models

Download size and VRAM are different numbers - do not conflate them. VRAM is the
measured peak footprint at analyze-time settings (float16 on CUDA, beam 5, word
timestamps) on a 6 GB laptop GPU.

| Model    | Download | VRAM (float16/GPU) | Speed (GPU) | Notes                     |
|----------|----------|--------------------|-------------|---------------------------|
| tiny     | ~75 MB   | ~0.2 GB            | Very fast   | Rough - good for scouting |
| base     | ~140 MB  | ~0.4 GB            | Fast        | Default - decent quality  |
| small    | ~465 MB  | ~1 GB              | Fast        | Good balance              |
| medium   | ~1.5 GB  | ~2.8 GB            | Moderate    | Great for noisy audio     |
| large-v3 | ~2.9 GB  | ~4.2 GB            | Moderate    | Best quality              |

Models are downloaded from HuggingFace on first use and cached locally
(`~/.cache/huggingface`). On CPU the default compute type is `int8` (lower memory);
CUDA auto-upgrades to `float16`.

---

## Project layout

```
recordings-folder/
└── .yuu-clip/
    ├── project.db        ← SQLite (all metadata, transcripts, clips, scores)
    ├── config.json       ← project config (overrides global defaults)
    ├── audio/
    │   ├── session_stream0.wav
    │   └── session_stream1.wav
    └── exports/
        └── session_clip42_0-23-15.mkv
```

Global config and track layouts:
- **Windows:** `%APPDATA%\yuu-clip\`
- **Linux:**   `~/.config/yuu-clip/`
- **macOS:**   `~/Library/Application Support/yuu-clip/`

---

## Offline use

After the initial model downloads (Whisper via HuggingFace, and a scoring model if you
choose one), the entire pipeline runs with no internet connection. In lightweight mode
there is nothing extra to download at all.

---

See [docs/user/FEATURES.md](docs/user/FEATURES.md) for the full feature reference and
[docs/project/ROADMAP.md](docs/project/ROADMAP.md) for what's in progress and planned.
