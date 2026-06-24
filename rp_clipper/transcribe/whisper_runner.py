"""
Transcription via faster-whisper (CTranslate2 backend).

faster-whisper runs on CPU (all platforms) and optionally on CUDA
(Windows + Linux with NVIDIA GPU + CUDA toolkit installed).
The 'auto' device setting lets it pick the best available.

Model storage:
  Models are downloaded on first use and cached in the OS default
  Hugging Face cache dir:
    Windows: %USERPROFILE%\\.cache\\huggingface\\hub
    Linux:   ~/.cache/huggingface/hub

Approximate VRAM / RAM usage:
  tiny   ~75 MB     fast, rough — good for scouting
  base   ~150 MB    good speed/quality balance (default)
  small  ~500 MB
  medium ~1.5 GB
  large-v3 ~3 GB    best quality, slower
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Optional

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from rp_clipper.config import Config, validate_whisper_language, validate_whisper_model
from rp_clipper.db.models import AudioTrack, Transcript, TranscriptSegment

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

console = Console()

# Module-level model cache so the same model isn't re-loaded between tracks
_model_cache: dict[tuple, object] = {}


def _get_model(config: Config):
    """Load (or retrieve from cache) a WhisperModel."""
    from faster_whisper import WhisperModel  # imported here so the module loads without it

    # Validate before any network activity happens inside faster-whisper.
    # validate_whisper_model raises ValueError for unknown identifiers,
    # preventing arbitrary HuggingFace repo IDs from triggering downloads.
    validate_whisper_model(config.whisper_model)

    device = config.whisper_device
    if device == "auto":
        try:
            import ctranslate2
            device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
        except Exception:
            device = "cpu"

    # int8 is CPU-optimal; upgrade to float16 on CUDA for better quality
    compute_type = config.whisper_compute_type
    if device == "cuda" and compute_type == "int8":
        compute_type = "float16"

    key = (config.whisper_model, device, compute_type, config.whisper_model_revision)
    if key not in _model_cache:
        rev_note = f"  revision={config.whisper_model_revision}" if config.whisper_model_revision else "  revision=latest (not pinned)"
        console.print(
            f"  [dim]Loading Whisper model '[bold]{config.whisper_model}[/bold]' "
            f"on {device} ({compute_type}){rev_note} — "
            f"first run downloads the model…[/dim]"
        )
        _model_cache[key] = WhisperModel(
            config.whisper_model,
            device=device,
            compute_type=compute_type,
            # revision pins the HuggingFace git commit SHA; None = "main" (latest)
            revision=config.whisper_model_revision,
        )

    return _model_cache[key]


def transcribe_track(
    track: AudioTrack,
    config: Config,
    session: "Session",
    language: Optional[str] = None,
) -> Transcript:
    """
    Transcribe *track.extracted_path* and persist the result to the DB.

    Returns the newly created Transcript ORM object.
    Uses faster-whisper's streaming segment iterator so we can show
    live progress even on long recordings.
    """
    if not track.extracted_path:
        raise ValueError(f"Track {track.id} has no extracted_path — extract audio first.")

    audio_path = Path(track.extracted_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Extracted audio not found: {audio_path}")

    # Validate language before touching the model — raises ValueError for bad codes.
    language = validate_whisper_language(language)

    model = _get_model(config)

    transcript = Transcript(
        audio_track_id=track.id,
        model_name=config.whisper_model,
        language=language,
    )
    session.add(transcript)
    session.flush()  # get transcript.id before adding segments

    seg_count = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=30),
        TextColumn("{task.fields[segs]} segs"),
        TimeElapsedColumn(),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task(
            f"  Transcribing [{track.label}]",
            total=None,
            segs=0,
        )

        segments_iter, info = model.transcribe(
            str(audio_path),  # faster-whisper expects a string path
            language=language,
            beam_size=5,
            vad_filter=True,       # built-in silero VAD — skips silent regions
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200,
            },
            word_timestamps=False,  # FUTURE[diarization]: set True when adding pyannote
        )

        if language is None and hasattr(info, "language"):
            transcript.language = info.language

        for seg in segments_iter:
            seg_count += 1
            db_seg = TranscriptSegment(
                transcript_id=transcript.id,
                start_ms=int(seg.start * 1000),
                end_ms=int(seg.end * 1000),
                text=seg.text,
                confidence=getattr(seg, "avg_logprob", None),
                speaker_label=None,  # FUTURE[diarization]: populated by pyannote pass
            )
            session.add(db_seg)
            progress.update(task, segs=seg_count)

            # Flush in batches to avoid holding everything in memory
            if seg_count % 200 == 0:
                session.flush()

    session.flush()
    return transcript
