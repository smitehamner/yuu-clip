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
  tiny   ~75 MB     fast, rough - good for scouting
  base   ~150 MB    good speed/quality balance (default)
  small  ~500 MB
  medium ~1.5 GB
  large-v3 ~3 GB    best quality, slower
"""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from yuu_clip.config import Config, validate_whisper_language, validate_whisper_model
from yuu_clip.db.models import AudioTrack, ProjectVoice, Speaker, Transcript, TranscriptSegment
from yuu_clip.log import get_logger
from yuu_clip.transcribe.diarization_client import (
    DiarizationError,
    make_diarization_client,
    speechbrain_model_cached,
)

# The pure voiceprint math lives in project_voice (importable in the offline unit tier
# without torch/whisper). Re-exported under the historical private names so existing
# importers (e.g. speakers._mean_voiceprint) keep working unchanged.
from yuu_clip.transcribe.project_voice import best_voice_match
from yuu_clip.transcribe.project_voice import (
    cosine_similarity as _cosine_similarity,
)
from yuu_clip.transcribe.project_voice import (
    deserialize_voiceprint as _deserialize_voiceprint,
)
from yuu_clip.transcribe.project_voice import (
    serialize_voiceprint as _serialize_voiceprint,
)

_log = get_logger(__name__)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

console = Console()

_model_cache: dict[tuple, object] = {}  # avoids re-loading the same model between tracks


def resolve_transcription_language(explicit: Optional[str], config: Config) -> Optional[str]:
    """Per-run explicit language wins over the configured default; None = auto-detect."""
    return validate_whisper_language(explicit or config.whisper_language)


def _whisper_repo_id(model: str) -> str:
    """HuggingFace repo id faster-whisper resolves a size name to. Mirrors
    faster_whisper.utils._MODELS' naming (Systran/faster-whisper-<size>, and the
    distil variants under faster-distil-whisper-*) so the cache check needs no
    faster_whisper import."""
    if model.startswith("distil-"):
        return f"Systran/faster-distil-whisper-{model[len('distil-'):]}"
    return f"Systran/faster-whisper-{model}"


def whisper_model_cached(config: Config) -> bool:
    """Whether the configured Whisper model is already in the shared HF cache
    (filesystem-only, no network). Lets the analyze pipeline tell "ready" from
    "still downloading / downloads on first use" so it can show a legible status."""
    from yuu_clip.hf_cache import repo_cached
    return repo_cached(_whisper_repo_id(config.whisper_model))


def prefetch_whisper_model(config: Config) -> None:
    """Download the configured Whisper model into the shared HF cache now.

    Uses faster-whisper's own download_model so the background prefetch and the
    lazy analyze-time load share one cache and one huggingface_hub .lock: a
    concurrent analyze never starts a second, cache-corrupting download - it
    blocks on the same lock until this download finishes.
    """
    from faster_whisper import download_model
    download_model(config.whisper_model, revision=config.whisper_model_revision)


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


# Default cosine similarity above which a new diarization cluster is treated as the
# same voice as an existing named Speaker and re-attached to it. Deliberately high:
# the user's requirement is to never mis-remap a name, so when unsure we would rather
# mint a fresh "Speaker N" to re-confirm than attach a name to the wrong voice.
# Overridable per-project via Config.speaker_match_threshold (Settings → Speaker labels).
_VOICEPRINT_MATCH_THRESHOLD = 0.75

# Width of the borderline "confirm this voice" band immediately below the match
# threshold. A cluster whose best similarity lands in [threshold − band, threshold)
# is minted as a fresh Speaker (as before) but also records a suggested match so the
# user can confirm it is the same voice rather than the re-attach silently dropping
# it. Fixed at 0.10 in v1 (plan 01); no Settings field for it yet.
_CONFIRM_BAND_WIDTH = 0.10


def _best_voiceprint_match(vector, candidates, taken_ids, threshold=_VOICEPRINT_MATCH_THRESHOLD,
                           active_backend=None):
    """Score *vector* against each unused candidate Speaker's voiceprint.

    Returns ``(matched, score, top)`` where ``top`` is the single most-similar unused
    candidate that has a voiceprint (or ``None`` when there were none), ``score`` its
    cosine, and ``matched`` is ``top`` when ``score >= threshold`` else ``None``.
    Callers use ``top`` / ``score`` to record a near-threshold suggestion when
    ``matched`` is ``None``.

    Candidates whose voiceprint came from a different diarization backend are
    skipped: embeddings from pyannote and SpeechBrain live in incompatible spaces
    (and dimensionalities), so a cross-backend cosine would be meaningless.
    """
    top_speaker = None
    top_score = 0.0
    for speaker in candidates:
        if speaker.id in taken_ids or not speaker.voiceprint:
            continue
        if active_backend is not None and speaker.voiceprint_backend != active_backend:
            continue
        score = _cosine_similarity(vector, _deserialize_voiceprint(speaker.voiceprint))
        if top_speaker is None or score > top_score:
            top_speaker = speaker
            top_score = score
    matched = top_speaker if (top_speaker is not None and top_score >= threshold) else None
    return matched, top_score, top_speaker


def _report_attach_decision(video_id, speaker, score, threshold, matched,
                            has_candidates, suggested=False) -> None:
    """Log (INFO) and surface via the SSE stream one cluster's re-attach outcome.

    The best similarity is reported even on a miss so the voiceprint threshold can
    be validated against real recordings from the Re-diarize stream without tailing
    the log (plan 01, stage 1). ``console`` output goes to the subprocess stdout the
    web UI streams as SSE.
    """
    if matched:
        _log.info("Voiceprint re-attach: speaker %d (video %d, cosine %.3f)",
                  speaker.id, video_id, score)
        console.print(f"    [dim]Re-attached to Speaker {speaker.display_index} "
                      f"(voice similarity {score:.2f})[/dim]")
    elif suggested:
        _log.info("Voiceprint near-miss: minted speaker %d (video %d, cosine %.3f in "
                  "[%.2f, %.2f)) - suggested match to speaker %d",
                  speaker.id, video_id, score, threshold - _CONFIRM_BAND_WIDTH,
                  threshold, speaker.suggested_match_id)
        console.print(f"    [dim]New Speaker {speaker.display_index} - possible match "
                      f"(voice similarity {score:.2f}, just below {threshold:.2f})[/dim]")
    elif has_candidates:
        _log.info("Voiceprint miss: minted speaker %d (video %d, best cosine %.3f < %.2f)",
                  speaker.id, video_id, score, threshold)
        console.print(f"    [dim]New Speaker {speaker.display_index} "
                      f"(closest existing voice {score:.2f}, below {threshold:.2f})[/dim]")
    else:
        _log.info("New speaker %d minted (video %d, no prior voiceprints)", speaker.id, video_id)
        console.print(f"    [dim]New Speaker {speaker.display_index}[/dim]")


def _match_or_mint_cluster(
    session: "Session",
    video_id: int,
    vector: list[float] | None,
    prior_speakers: list["Speaker"],
    taken_ids: set[int],
    threshold: float,
    active_backend: str | None,
    has_candidates: bool,
    mint_display_index: int,
) -> tuple[int, str]:
    """Resolve one raw cluster to a Speaker id: re-attach to a matching prior
    Speaker or mint a new one. Returns (speaker_id, "matched" | "minted").

    Mutates *taken_ids* on a match so each prior Speaker is claimed at most once.
    The caller owns display numbering: *mint_display_index* is used only when a new
    Speaker is minted.
    """
    match, score, near = (
        _best_voiceprint_match(vector, prior_speakers, taken_ids, threshold, active_backend)
        if vector else (None, 0.0, None)
    )
    if match is not None:
        taken_ids.add(match.id)
        if not match.voiceprint:
            match.voiceprint = _serialize_voiceprint(vector)
            match.voiceprint_backend = active_backend
        _report_attach_decision(video_id, match, score, threshold,
                                matched=True, has_candidates=has_candidates)
        return match.id, "matched"

    in_band = near is not None and score >= threshold - _CONFIRM_BAND_WIDTH
    speaker = Speaker(
        video_id=video_id,
        display_index=mint_display_index,
        source="manual",
        voiceprint=_serialize_voiceprint(vector) if vector else None,
        voiceprint_backend=active_backend if vector else None,
        suggested_match_id=near.id if in_band else None,
        suggested_match_score=score if in_band else None,
    )
    session.add(speaker)
    session.flush()
    if vector:
        _report_attach_decision(video_id, speaker, score, threshold, matched=False,
                                has_candidates=has_candidates, suggested=in_band)
    return speaker.id, "minted"


def _attach_speakers(
    session: "Session",
    video_id: int,
    transcript_id: int,
    embeddings_by_label: dict[str, list[float]] | None = None,
    threshold: float = _VOICEPRINT_MATCH_THRESHOLD,
    active_backend: str | None = None,
) -> None:
    """Attribute this run's segments to durable per-recording Speakers.

    When a raw cluster carries a voiceprint that matches an existing Speaker
    (cosine >= threshold), the segments re-attach to that Speaker so its name
    survives re-diarization. Otherwise a fresh Speaker is minted (storing the
    voiceprint when available). Matches are only made against Speakers that
    existed *before* this run, and each prior Speaker matches at most one current
    cluster - the diarization backend already separated the current clusters, so
    two of them must not collapse onto one identity. display_index continues from
    the recording's current max so "Speaker N" numbering never collides.
    """
    embeddings_by_label = embeddings_by_label or {}
    segs = (
        session.query(TranscriptSegment)
        .filter_by(transcript_id=transcript_id)
        .order_by(TranscriptSegment.start_ms)
        .all()
    )
    labels_in_order: list[str] = []
    for seg in segs:
        if seg.speaker_label and seg.speaker_label not in labels_in_order:
            labels_in_order.append(seg.speaker_label)
    if not labels_in_order:
        return

    prior_speakers = session.query(Speaker).filter_by(video_id=video_id).all()
    has_candidates = any(s.voiceprint for s in prior_speakers)
    next_index = max((s.display_index for s in prior_speakers), default=0)
    taken_ids: set[int] = set()
    label_to_speaker_id: dict[str, int] = {}
    matched = 0
    minted = 0
    without_voiceprint = 0

    for label in labels_in_order:
        vector = embeddings_by_label.get(label)
        if not vector:
            without_voiceprint += 1
        speaker_id, outcome = _match_or_mint_cluster(
            session, video_id, vector, prior_speakers, taken_ids,
            threshold, active_backend, has_candidates, next_index + 1,
        )
        label_to_speaker_id[label] = speaker_id
        if outcome == "matched":
            matched += 1
        else:
            minted += 1
            next_index += 1

    for seg in segs:
        if seg.speaker_label in label_to_speaker_id:
            seg.speaker_id = label_to_speaker_id[seg.speaker_label]
    session.flush()

    _log.info(
        "Speaker attribution (video %d): %d cluster(s) -> %d re-attached, %d minted "
        "(%d had no voiceprint), %d prior speaker(s)",
        video_id, len(labels_in_order), matched, minted,
        without_voiceprint, len(prior_speakers),
    )


def suggest_project_voices(session: "Session", video_id: int, threshold: float) -> None:
    """Propose cross-recording Person matches for this recording's Speakers.

    For each Speaker with a voiceprint that is not already linked to a Person, find the
    most similar existing ProjectVoice (nearest exemplar, same backend) and, at/above
    the strict cross-recording threshold, record it as a SUGGESTION
    (suggested_voice_id / suggested_voice_score). ``global_voice_id`` is NEVER set here:
    a wrong cross-recording merge propagates a name project-wide, so application is a
    People-view confirm action only (locked decision). One Person is suggested to at
    most one Speaker per recording. No project voices yet, no voiceprint, or a backend
    that matches no exemplar all mean "no suggestion" (never an error).
    """
    voices = session.query(ProjectVoice).all()
    if not voices:
        return
    speakers = (
        session.query(Speaker)
        .filter_by(video_id=video_id)
        .order_by(Speaker.display_index)
        .all()
    )
    taken_ids: set[int] = set()
    suggested = 0
    for speaker in speakers:
        if speaker.global_voice_id is not None or not speaker.voiceprint:
            continue
        vector = _deserialize_voiceprint(speaker.voiceprint)
        match, score, _top = best_voice_match(
            vector, speaker.voiceprint_backend, voices, taken_ids, threshold
        )
        if match is None:
            continue
        taken_ids.add(match.id)
        speaker.suggested_voice_id = match.id
        speaker.suggested_voice_score = score
        suggested += 1
        _log.info(
            "Cross-recording suggestion (video %d): speaker %d looks like Person %d '%s' "
            "(cosine %.3f >= %.2f)",
            video_id, speaker.id, match.id, match.display_name, score, threshold,
        )
        console.print(
            f"    [dim]Speaker {speaker.display_index} looks like {match.display_name} "
            f"from another recording (voice match {score:.2f}) - confirm in People[/dim]"
        )
    if suggested:
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


_cuda_dll_dirs_registered = False


def _register_cuda_dll_dirs() -> None:
    """Make CUDA runtime DLLs from the nvidia-*-cu12 wheels loadable on Windows.

    The wheels install cuBLAS/cuDNN into site-packages/nvidia/<lib>/bin, which is
    not on the DLL search path, so CTranslate2 fails with 'cublas64_12.dll not
    found' even after a successful pip install. add_dll_directory (Windows-only)
    registers those dirs before faster_whisper loads the CUDA backend.
    """
    global _cuda_dll_dirs_registered
    if _cuda_dll_dirs_registered or not hasattr(os, "add_dll_directory"):
        return
    for pkg in ("nvidia.cublas", "nvidia.cudnn"):
        try:
            spec = importlib.util.find_spec(pkg)
        except ModuleNotFoundError:
            spec = None
        if not spec or not spec.submodule_search_locations:
            continue
        bin_dir = Path(next(iter(spec.submodule_search_locations))) / "bin"
        if bin_dir.is_dir():
            os.add_dll_directory(str(bin_dir))
            _log.debug("Registered CUDA DLL dir: %s", bin_dir)
    _cuda_dll_dirs_registered = True


class TranscriptionModelError(RuntimeError):
    """Whisper model could not be loaded - carries an end-user-actionable message."""


def _model_key(config: Config, device: str, compute_type: str) -> tuple:
    return (config.whisper_model, device, compute_type, config.whisper_model_revision)


def _model_load_error(config: Config, exc: Exception) -> TranscriptionModelError:
    return TranscriptionModelError(
        f"Couldn't load the transcription model '{config.whisper_model}'. "
        "The first time a model is used it is downloaded from the internet, so if this "
        "is a new model, check your connection and try again. If transcription worked "
        f"before, the downloaded model may be corrupt - retry to re-download. (details: {exc})"
    )


def _load_whisper_model(config: Config, device: str, compute_type: str):
    from faster_whisper import WhisperModel  # imported here so the module loads without it

    if device == "cuda":
        _register_cuda_dll_dirs()

    rev_note = f"  revision={config.whisper_model_revision}" if config.whisper_model_revision else "  revision=latest (not pinned)"
    console.print(
        f"  [dim]Loading Whisper model '[bold]{config.whisper_model}[/bold]' "
        f"on {device} ({compute_type}){rev_note} - "
        f"first run downloads the model...[/dim]"
    )
    return WhisperModel(
        config.whisper_model,
        device=device,
        compute_type=compute_type,
        # revision pins the HuggingFace git commit SHA; None = "main" (latest)
        revision=config.whisper_model_revision,
    )


def _get_model(config: Config):
    """Load (or retrieve from cache) a WhisperModel.

    A machine can report a CUDA device (NVIDIA GPU + driver present) yet lack the
    cuBLAS/cuDNN runtime libraries CTranslate2 links against (e.g. no CUDA toolkit
    and no nvidia-cublas-cu12/nvidia-cudnn-cu12 wheels). Loading then fails with
    'cublas64_12.dll is not found or cannot be loaded'. Rather than abort the whole
    analysis, fall back to CPU so transcription still completes (slower).
    """
    validate_whisper_model(config.whisper_model)

    device, compute_type = _resolve_device_and_compute(config)
    key = _model_key(config, device, compute_type)
    if key in _model_cache:
        return _model_cache[key]

    if device == "cuda":
        try:
            _model_cache[key] = _load_whisper_model(config, device, compute_type)
            return _model_cache[key]
        except Exception as exc:
            _log.warning(
                "Whisper model failed to load on CUDA (%s) - falling back to CPU. "
                "To use the GPU, install the CUDA support libraries from "
                "Settings -> Hardware (Enable GPU acceleration).",
                exc,
            )
            console.print(
                "[yellow]GPU transcription unavailable - the CUDA support libraries "
                "(cuBLAS + cuDNN) are missing, so this run will use the CPU instead "
                "(slower).[/yellow]"
            )
            console.print(
                "  [dim]To enable the GPU, open Settings -> Hardware and click "
                "'Enable GPU acceleration', then re-run analysis.[/dim]"
            )
            device, compute_type = "cpu", "int8"
            key = _model_key(config, device, compute_type)
            if key in _model_cache:
                return _model_cache[key]

    try:
        _model_cache[key] = _load_whisper_model(config, device, compute_type)
    except Exception as exc:
        raise _model_load_error(config, exc) from exc

    return _model_cache[key]


def _serialize_words(words) -> Optional[str]:
    """Serialize faster-whisper per-word timings for a segment into words_json.

    faster-whisper reports word start/end in track-absolute seconds (same frame
    as the segment's own start/end), so we keep that frame and just convert to
    ms. Returns None when the model produced no word data - the caller stores
    NULL and the caption renderer falls back to a static line.
    """
    if not words:
        return None
    serialized = [
        {"text": word.word, "start_ms": int(word.start * 1000), "end_ms": int(word.end * 1000)}
        for word in words
    ]
    return json.dumps(serialized) if serialized else None


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
        raise ValueError(f"Track {track.id} has no extracted_path - extract audio first.")

    audio_path = Path(track.extracted_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Extracted audio not found: {audio_path}")

    language = resolve_transcription_language(language, config)

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
            vad_filter=True,       # built-in silero VAD - skips silent regions
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200,
            },
            word_timestamps=True,
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
                words_json=_serialize_words(getattr(seg, "words", None)),
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

    return transcript


def diarize_track(
    config: Config,
    session: "Session",
    transcript: Transcript,
    audio_path: Path,
    track: AudioTrack,
) -> None:
    """Run diarization and assign speaker labels, if a backend is available.

    Called as its own pipeline stage (see ``_pipeline._run_speaker_diarization``),
    not from ``transcribe_track`` - diarization is slow enough that it needs its
    own visible step rather than hiding inside transcription.
    """
    diar_client = make_diarization_client(config)
    ok, reason = diar_client.available()
    if not ok:
        if config.diarization_backend != "null":
            _log.warning("Diarization skipped for track %d [%s]: %s", track.id, track.label, reason)
            console.print(f"[yellow]Speaker labels skipped for [{track.label}]: {reason}[/yellow]")
        return

    if config.diarization_backend == "speechbrain" and not speechbrain_model_cached():
        console.print(
            f"  [dim]Downloading the speaker model (~80 MB) so speaker labels can run "
            f"for [{track.label}] - this happens once...[/dim]"
        )

    _log.info("Running diarization for track %d [%s]...", track.id, track.label)
    try:
        turns, embeddings = diar_client.diarize_with_embeddings(str(audio_path))
        _assign_speakers(session, transcript.id, turns)
        _attach_speakers(
            session, track.video_id, transcript.id, embeddings,
            threshold=config.speaker_match_threshold,
            active_backend=config.diarization_backend,
        )
        _log.info(
            "Diarization complete: %d turns, %d voiceprint(s) for track %d",
            len(turns), len(embeddings), track.id,
        )
    except DiarizationError as exc:
        _log.warning("Diarization failed for track %d [%s]: %s", track.id, track.label, exc)
        console.print(f"[yellow]Speaker labels skipped for [{track.label}]:[/yellow]")
        console.print(str(exc), markup=False, highlight=False)
    except Exception as exc:
        _log.warning(
            "Diarization failed for track %d [%s], speaker labels skipped: %s",
            track.id, track.label, exc, exc_info=True,
        )
        console.print(
            f"[yellow]Speaker labels skipped for [{track.label}] (unexpected error): {exc}[/yellow]"
        )
