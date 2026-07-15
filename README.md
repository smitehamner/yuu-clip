# YuuClip

A local-first tool for finding the best moments in long talk-heavy recordings - RP, voice chat, streaming to chat, podcasts, and commentary - and turning them into shareable clips. It analyzes a recording - transcribes every audio track with Whisper, measures audio energy and scene cuts, and scores each clip - then surfaces the best moments in a web review UI for approve/reject and export. Silent, action-only gameplay is supported too as a secondary pass, but talk-driven content is where it is strongest.

Everything runs locally. It works out of the box with **no language model at all** (lightweight mode); installing a local model adds richer LLM scoring and descriptions. No cloud APIs are required.

---

## What it does

- Inspects video files and detects multiple OBS audio tracks
- Assigns each track a role (mic, voice chat, game sounds, combined) with saved track layouts
- Extracts audio tracks to 16 kHz mono WAV
- Transcribes with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (GPU accelerated via CTranslate2)
- Optionally labels who is speaking (speaker detection) with no account or token required
- Groups transcript segments into clips using silence gaps
- Scores clips with a stack of signals that need **no model** - audio energy, scene-cut density, laughter, a curated keyword lexicon, speech-rate bursts, speaker-overlap, and prosody - plus optional heavier tiers (audio-event detection) and, if a model is installed, LLM scoring with a written description
- Web UI to review clips, approve/reject, edit captions, and export
- Exports clips via FFmpeg with optional caption (SRT) sidecars or baked-in captions
- Compiles approved clips into a highlight reel with transitions
- Extra tools: import from a URL, world contexts, hot-words, sensitive-term flagging, name correction, and image-based (vision) analysis

---

## Two ways to run it

**Desktop app (recommended for most people).** A packaged Windows build bundles a pinned Python runtime and FFmpeg, walks you through a first-run setup wizard, and offers a one-click download of a recommended local scoring model. No manual Python or FFmpeg install needed.

**From source (developers).** Clone and `pip install` as below. This path expects FFmpeg and Python on your machine.

### Installing the desktop app on Windows

The installer isn't code-signed yet, so Windows SmartScreen will show a blue
**"Windows protected your PC"** box that says the publisher is unknown. This is
expected for a small indie app that hasn't paid for a signing certificate - it is
not a virus warning. To continue:

1. Click **More info**.
2. Click **Run anyway**.

If your antivirus quarantines the installer or a file during setup, allow/restore it
and run again - the app bundles Python, FFmpeg, and (on first launch) installs its
dependencies from files inside the installer, which some antivirus tools flag by
reputation. Everything runs locally; nothing is uploaded.

If the first-run setup ever fails, the setup log is at
`%APPDATA%\yuu-clip\yuu-clip_install.log` - send it along when reporting a problem.

---

## Requirements (from source)

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

### A language model - optional
LLM scoring and written clip descriptions are optional. Without a model, YuuClip still finds and scores clips using the no-model signals above. To enable LLM scoring, pick a backend in the setup wizard or Settings:

- **Local model file (default)** - a local `.gguf` run via the bundled, GPU-accelerated llama.cpp engine. The desktop app can download a recommended, monetization-safe model for you.
- **Claude API** - remote, billed per token.

---

## Install (from source)

```bash
git clone https://github.com/you/yuu-clip
cd yuu-clip
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
yuuclip serve
```
Then navigate to `http://127.0.0.1:8080`. Use the **+ Analyze** button to add a video.

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

faster-whisper uses CTranslate2, which detects CUDA automatically. No PyTorch is needed for transcription.

For best results, install CUDA drivers for your GPU. The tool automatically uses `float16` compute on CUDA and falls back to CPU `int8` otherwise. The device in use is shown in the analyze output.

---

## Whisper models

| Model    | VRAM   | Speed (GPU) | Notes                        |
|----------|--------|-------------|------------------------------|
| tiny     | ~0.5 GB | Very fast  | Rough - good for scouting    |
| base     | ~1 GB   | Fast       | Default - decent quality     |
| small    | ~2 GB   | Fast       | Good balance                 |
| medium   | ~5 GB   | Moderate   | Great for noisy audio        |
| large-v3 | ~10 GB  | Moderate   | Best quality                 |

Models are downloaded from HuggingFace on first use and cached locally (`~/.cache/huggingface`).

---

## Project layout

```
recordings-folder/
└── .yuu-clip/
    ├── project.db        ← SQLite (all metadata, transcripts, clips, scores)
    ├── config.toml       ← project config (overrides global defaults)
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

After the initial model downloads (Whisper via HuggingFace, and a scoring model if you choose one), the entire pipeline runs with no internet connection. In lightweight mode there is nothing extra to download at all.

---

## License

YuuClip is licensed under the [Apache License 2.0](LICENSE) - you are free to use, modify, and distribute it, including commercially, under that licence's terms.

The Windows installer bundles a prebuilt FFmpeg binary that is separately licensed under the GPLv3; see [docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md](docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md) for the full third-party compliance record.

---

See [docs/user/FEATURES.md](docs/user/FEATURES.md) for the full feature reference and [docs/project/ROADMAP.md](docs/project/ROADMAP.md) for what's in progress and planned.
