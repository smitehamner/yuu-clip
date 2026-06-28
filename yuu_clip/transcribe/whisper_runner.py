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

from yuu_clip.config import Config, validate_whisper_language, validate_whisper_model
from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment
from yuu_clip.log import get_logger
from yuu_clip.transcribe.diarization_client import make_diarization_client

_log = get_logger(__name__)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

console = Console()

_model_cache: dict[tuple, object] = {}  # avoids re-loading the same model between tracks


def _assign_speakers(
    session: "Session",
    transcript_id: int,
    turns: list[tuple[float, float, str]],
) -> None:
    """Populate speaker_label on every segment by greatest time overlap with *turns*."""
    if not turns:
        return
    segs = (
        session.query(TranscriptSegment)
        .filter_by(transcript_id=transcript_id)
        .order_by(TranscriptSegment.start_ms)
        .all()
    )
    for seg in segs:
        seg_start = seg.start_ms / 1000
        seg_end   = seg.end_ms   / 1000
        best_label: str | None = None
        best_overlap = 0.0
        for turn_start, turn_end, label in turns:
            overlap = max(0.0, min(seg_end, turn_end) - max(seg_start, turn_start))
            if overlap > best_overlap:
                best_overlap = overlap
                best_label   = label
        seg.speaker_label = best_label
    session.flush()


def _resolve_device_and_compute(config: Config) -> tuple[str, str]:
    """Return (device, compute_type) resolving 'auto' and upgrading int8 on CUDA."""
    device = config.whisper_device
    if device == "auto":
        try:
            import ctranslate2
            device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
        except Exception as exc:
            _log.debug("ctranslate2 device detection failed, defaulting to cpu: %s", exc)
            device = "cpu"

    # int8 is CPU-optimal; upgrade to float16 on CUDA for better quality
    compute_type = config.whisper_compute_type
    if device == "cuda" and compute_type == "int8":
        compute_type = "float16"

    return device, compute_type


def _get_model(config: Config):
    """Load (or retrieve from cache) a WhisperModel."""
    from faster_whisper import WhisperModel  # imported here so the module loads without it

    validate_whisper_model(config.whisper_model)

    device, compute_type = _resolve_device_and_compute(config)

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


# transcribe_track is long because the Progress context, the model call, and the segment
# loop share seg_count, transcript, and progress as live state. Splitting the loop into a
# helper requires threading all three, producing more complexity than the length costs.
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

    language = validate_whisper_language(language)

    model = _get_model(config)
    _log.info(
        "Transcribing track %d [%s] using model=%s device=auto path=%s",
        track.id, track.label, config.whisper_model, audio_path.name,
    )

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
            word_timestamps=False,
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
                speaker_label=None,
            )
            session.add(db_seg)
            progress.update(task, segs=seg_count)

            if seg_count % 200 == 0:  # flush in batches to avoid holding everything in memory
                session.flush()

    session.flush()
    _log.info(
        "Transcription complete: track %d [%s], %d segments, language=%s",
        track.id, track.label, seg_count, transcript.language or "auto",
    )

    diar_client = make_diarization_client(config)
    ok, reason = diar_client.available()
    if ok:
        _log.info("Running diarization for track %d [%s]…", track.id, track.label)
        turns = diar_client.diarize(str(audio_path))
        _assign_speakers(session, transcript.id, turns)
        _log.info("Diarization complete: %d turns for track %d", len(turns), track.id)
    elif config.diarization_backend != "null":
        _log.warning("Diarization skipped for track %d [%s]: %s", track.id, track.label, reason)

    return transcript
