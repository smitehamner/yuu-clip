"""
Transcription orchestration - backend-agnostic.

Resolves the per-run language, drives the configured Transcriber (see
transcribe.transcriber.make_transcriber), and persists the result to the DB with a
live Rich progress bar. The speech-to-text backend itself is swappable; this module
never imports faster-whisper directly. Speaker attribution lives in
transcribe.speaker_attach; the raw ASR backend lives in transcribe.transcriber.
"""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from yuu_clip.config import Config, validate_whisper_language
from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment
from yuu_clip.log import get_logger
from yuu_clip.transcribe.transcriber import make_transcriber

_log = get_logger(__name__)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

console = Console()


def resolve_transcription_language(explicit: Optional[str], config: Config) -> Optional[str]:
    """Per-run explicit language wins over the configured default; None = auto-detect."""
    return validate_whisper_language(explicit or config.whisper_language)


# transcribe_track is long because the Progress context and the segment loop share
# seg_count, transcript, and progress as live state. Splitting the loop into a helper
# requires threading all three, producing more complexity than the length costs.
def transcribe_track(
    track: AudioTrack,
    config: Config,
    session: "Session",
    language: Optional[str] = None,
) -> Transcript:
    """
    Transcribe *track.extracted_path* and persist the result to the DB.

    Returns the newly created Transcript ORM object. Streams the backend's segment
    iterator so progress shows live even on long recordings.
    """
    if not track.extracted_path:
        raise ValueError(f"Track {track.id} has no extracted_path - extract audio first.")

    audio_path = Path(track.extracted_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Extracted audio not found: {audio_path}")

    language = resolve_transcription_language(language, config)

    _log.info(
        "Transcribing track %d [%s] using backend=%s model=%s path=%s",
        track.id, track.label, config.transcription_backend, config.whisper_model, audio_path.name,
    )
    result = make_transcriber(config).transcribe(audio_path, language)

    transcript = Transcript(
        audio_track_id=track.id,
        model_name=config.whisper_model,
        language=result.language,
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

        for seg in result.segments:
            seg_count += 1
            db_seg = TranscriptSegment(
                transcript_id=transcript.id,
                start_ms=seg.start_ms,
                end_ms=seg.end_ms,
                text=seg.text,
                confidence=seg.confidence,
                speaker_label=None,
            )
            if seg.words:
                db_seg.words = [asdict(word) for word in seg.words]
            session.add(db_seg)
            progress.update(task, segs=seg_count)

            if seg_count % 200 == 0:  # flush in batches to avoid holding everything in memory
                session.flush()

    session.flush()
    _log.info(
        "Transcription complete: track %d [%s], %d segments, language=%s",
        track.id, track.label, seg_count, transcript.language or "auto",
    )

    return transcript
