"""
Transcriber interface and the faster-whisper backend.

Mirrors the LLMClient / DiarizationClient pattern: a small ABC plus a
make_transcriber(config) factory keyed on config.transcription_backend, so a future
speech-to-text backend (whisper.cpp, a cloud STT, WhisperX) is a registration rather
than an edit to the transcription core. transcribe() yields backend-agnostic segment
objects; DB persistence and the progress display live in the orchestrator
(whisper_runner.transcribe_track).

faster-whisper runs on CPU (all platforms) and optionally on CUDA (Windows + Linux
with an NVIDIA GPU + CUDA toolkit). The 'auto' device setting lets it pick the best
available. Models download on first use into the shared HuggingFace cache.
"""
from __future__ import annotations

import importlib.util
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

from rich.console import Console

from yuu_clip.config import Config, validate_whisper_model
from yuu_clip.log import get_logger

_log = get_logger(__name__)
console = Console()


@dataclass
class TranscribedWord:
    text: str
    start_ms: int
    end_ms: int


@dataclass
class TranscribedSegment:
    start_ms: int
    end_ms: int
    text: str
    confidence: Optional[float]
    words: Optional[list[TranscribedWord]]


@dataclass
class Transcription:
    """One transcription result: the detected (or echoed) language and a lazy
    segment stream. Segments are an iterator so the orchestrator can show live
    progress on long recordings without buffering the whole transcript."""
    language: Optional[str]
    segments: Iterator[TranscribedSegment]


class TranscriptionModelError(RuntimeError):
    """The speech model could not be loaded - carries an end-user-actionable message."""


class Transcriber(ABC):
    @abstractmethod
    def transcribe(self, audio_path: Path, language: Optional[str]) -> Transcription:
        """Transcribe *audio_path*. *language* is an ISO 639-1 code or None (auto-detect)."""
        ...

    @abstractmethod
    def available(self) -> tuple[bool, str]:
        """(available, reason) - reason is a user-facing explanation when unavailable."""
        ...

    @abstractmethod
    def model_cached(self) -> bool:
        """Whether the configured model is already downloaded (filesystem-only, no network)."""
        ...

    @abstractmethod
    def prefetch(self) -> None:
        """Download the configured model now, sharing the lazy-load cache/lock."""
        ...


def _whisper_repo_id(model: str) -> str:
    """HuggingFace repo id faster-whisper resolves a size name to. Mirrors
    faster_whisper.utils._MODELS' naming (Systran/faster-whisper-<size>, and the
    distil variants under faster-distil-whisper-*) so the cache check needs no
    faster_whisper import."""
    if model.startswith("distil-"):
        return f"Systran/faster-distil-whisper-{model[len('distil-'):]}"
    return f"Systran/faster-whisper-{model}"


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


_model_cache: dict[tuple, object] = {}  # avoids re-loading the same model between tracks


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


def _to_words(raw_words) -> Optional[list[TranscribedWord]]:
    """Convert faster-whisper per-word timings (track-absolute seconds) into
    TranscribedWord (ms). Returns None when the model produced no word data - the
    orchestrator then leaves words_json NULL and captions fall back to a static line."""
    if not raw_words:
        return None
    words = [
        TranscribedWord(text=word.word, start_ms=int(word.start * 1000), end_ms=int(word.end * 1000))
        for word in raw_words
    ]
    return words or None


class FasterWhisperTranscriber(Transcriber):
    """faster-whisper (CTranslate2) backend. Offloads to CUDA when available, else CPU."""

    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        try:
            validate_whisper_model(self._config.whisper_model)
        except ValueError as exc:
            return False, str(exc)
        return True, ""

    def model_cached(self) -> bool:
        from yuu_clip.hf_cache import repo_cached
        return repo_cached(_whisper_repo_id(self._config.whisper_model))

    def prefetch(self) -> None:
        """Download the configured model into the shared HF cache now.

        Uses faster-whisper's own download_model so the background prefetch and the
        lazy analyze-time load share one cache and one huggingface_hub .lock: a
        concurrent analyze never starts a second, cache-corrupting download - it
        blocks on the same lock until this download finishes.
        """
        from faster_whisper import download_model
        download_model(self._config.whisper_model, revision=self._config.whisper_model_revision)

    def transcribe(self, audio_path: Path, language: Optional[str]) -> Transcription:
        model = _get_model(self._config)
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
        detected = language if language is not None else getattr(info, "language", None)
        return Transcription(language=detected, segments=self._segments(segments_iter))

    @staticmethod
    def _segments(raw_segments) -> Iterator[TranscribedSegment]:
        for seg in raw_segments:
            yield TranscribedSegment(
                start_ms=int(seg.start * 1000),
                end_ms=int(seg.end * 1000),
                text=seg.text,
                confidence=getattr(seg, "avg_logprob", None),
                words=_to_words(getattr(seg, "words", None)),
            )


# Backend name -> Transcriber class. Unknown backends fall back to faster-whisper.
_BACKEND_TRANSCRIBERS: dict[str, type[Transcriber]] = {
    "faster_whisper": FasterWhisperTranscriber,
}


def make_transcriber(config: Config) -> Transcriber:
    """The single point where a Transcriber is constructed, keyed on
    config.transcription_backend (default/fallback: faster_whisper)."""
    transcriber_class = _BACKEND_TRANSCRIBERS.get(config.transcription_backend, FasterWhisperTranscriber)
    return transcriber_class(config)
