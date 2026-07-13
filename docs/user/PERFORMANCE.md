# YuuClip - Performance and Storage

## Recommended specs

| Component | Minimum | Recommended |
|---|---|---|
| CPU | Any modern x64 | 8+ cores (speeds up audio extraction) |
| RAM | 8 GB | 16 GB+ (large-v3 Whisper keeps ~3 GB in VRAM; RAM mostly not the bottleneck) |
| GPU | None (CPU fallback) | NVIDIA GPU with 4 GB+ VRAM for GPU-accelerated Whisper |
| Storage - project folder | HDD | **SSD strongly recommended** (see below) |
| Storage - source files | HDD/external OK | HDD or external drive is fine |
| OS | Windows 10 (updated) | Windows 11 |

## Storage - what takes space

### Install footprint

| Item | Size |
|---|---|
| YuuClip app (Electron + Python venv) | ~600 MB |
| Whisper model weights (downloaded on first analysis) | 75 MB (tiny) – 3 GB (large-v3) |
| Local LLM model file (.gguf, if using local LLM) | 2–8 GB typical (depends on model) |

Whisper weights are cached in the faster-whisper model cache (default: `%USERPROFILE%\.cache\huggingface\hub`). They are shared across projects and only downloaded once per model size.

### Per-session disk usage

| Item | Size per hour of source video |
|---|---|
| Extracted audio WAVs (16 kHz mono, kept in `.yuu-clip/audio/`) | ~115 MB/hr per track |
| SQLite database (`.yuu-clip/project.db`) | Negligible (<5 MB for typical sessions) |
| Exported clips (`.yuu-clip/exports/`) | Depends on source bitrate; stream-copy exports match source |
| Highlight reels (`.yuu-clip/reels/`) | Same as above |

A 2-hour session with 2 audio tracks produces roughly 460 MB of audio extracts. These are reused across re-analysis runs and can be deleted manually if disk space is tight (they will be re-extracted on next analysis).

### Cleanup

YuuClip does not auto-delete any files. To reclaim space:
- **Audio extracts**: delete `.yuu-clip/audio/` - will be regenerated on next analysis
- **Exports / reels**: delete individual files from `.yuu-clip/exports/` and `.yuu-clip/reels/` via the UI (Delete Export button) or directly from disk
- **Whisper models**: remove from the model cache to free 75 MB–3 GB per size

## SSD vs. external drive

**Source video files** can live on an external drive or HDD - they are read sequentially during audio extraction, which is not latency-sensitive.

**The project folder** (`.yuu-clip/` containing the database, audio extracts, and exports) benefits from an SSD:
- The SQLite database has many small random reads/writes during analysis and UI interaction; HDD latency can cause noticeable lag
- Audio extraction writes large WAV files; SSD write speeds reduce extract time noticeably on fast GPUs where extraction can become the bottleneck

If your source files are on an external drive, use the project folder picker in the setup wizard to point `.yuu-clip/` at a local SSD path.

## Analysis time estimates

The web UI shows a live estimate per step before you start. Reference numbers:

| Video length | RTX GPU + base | RTX GPU + large-v3 | CPU + large-v3 |
|---|---|---|---|
| 30 min | ~5 min | ~9 min | ~1h 20min |
| 1 hour | ~9 min | ~18 min | ~2h 40min |
| 2.5 hours | ~23 min | ~45 min | ~6h 35min |

Transcription dominates for large-v3. For a 1-hour session on GPU + large-v3: extract ~6 min, transcribe ~10 min, energy ~14 s, scene ~18 s, LLM scoring ~1.5 min.

**CPU note**: On CPU, large-v3 is roughly 150× slower than an RTX GPU for transcription. Smaller models (base, small) are significantly faster on CPU but produce lower accuracy. medium or larger on CPU is not practical for sessions over 30 minutes.

## Thermal considerations (laptops)

Long analysis runs keep the GPU at sustained load. For safety:
- Make sure your laptop has adequate airflow and is on a hard surface
- Monitor GPU temperature if you're running large-v3 on multi-hour sessions
- Consider batching: analyze one file at a time rather than a large folder drop
- The hardware health monitor watches GPU temperature during analysis: it warns at the configurable
  warn threshold and can auto-pause before the next video if the GPU stays hot (NVIDIA only; tune the
  thresholds in Settings → Hardware)
