from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config

_log = logging.getLogger(__name__)


class DiarizationError(RuntimeError):
    """A diarization failure the user can act on (e.g. accept model terms)."""


# pyannote.audio 4.x's recommended pipeline. Unlike speaker-diarization-3.1 (which
# chained in segmentation-3.0 plus a PLDA from community-1), this one is
# self-contained: accepting the single repo's user conditions is enough. We still
# don't assume the failing repo when access is denied — HF's own error names the
# exact repo and accept URL, so we pass that text through and append the account /
# token guidance. The None branch covers older pyannote returning None instead of
# raising.
_PIPELINE_ID = "pyannote/speaker-diarization-community-1"

_ACCEPT_TERMS_HINT = (
    "To fix: sign in to HuggingFace with the SAME account as your token, open "
    "the gated model page named above, and accept its user conditions. The "
    "token also needs 'Read' access — create one at https://hf.co/settings/tokens"
)

_ACCEPT_TERMS_HELP = (
    "Speaker labels need access to a gated HuggingFace model. While signed in "
    "with your token's account, accept the user conditions at:\n"
    f"  - https://hf.co/{_PIPELINE_ID}\n"
    + _ACCEPT_TERMS_HINT
)


def _load_waveform(audio_path: str) -> dict:
    """Decode a PCM WAV into pyannote's in-memory input dict.

    pyannote 4.x's community-1 pipeline decodes file paths through torchcodec, which
    needs the FFmpeg shared libraries on the system PATH — frequently absent on
    Windows, where it fails with "torchcodec is not available". We always feed it our
    own 16 kHz mono PCM WAVs, so we decode them with the stdlib `wave` module and hand
    pyannote a {waveform, sample_rate} dict, sidestepping torchcodec entirely.
    """
    import wave

    import numpy as np
    import torch

    with wave.open(audio_path, "rb") as wav:
        sample_rate = wav.getframerate()
        n_channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        frames = wav.readframes(wav.getnframes())

    dtype = {1: np.uint8, 2: np.int16, 4: np.int32}.get(sample_width)
    if dtype is None:
        raise DiarizationError(
            f"Unsupported WAV sample width ({sample_width} bytes) for {audio_path}"
        )
    samples = np.frombuffer(frames, dtype=dtype).astype(np.float32)
    if dtype is np.uint8:  # 8-bit PCM is unsigned, centred at 128
        samples = (samples - 128.0) / 128.0
    else:
        samples /= float(np.iinfo(dtype).max + 1)
    waveform = torch.from_numpy(samples.reshape(-1, n_channels).T.copy())
    return {"waveform": waveform, "sample_rate": sample_rate}


def _looks_like_access_error(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".lower()
    return any(
        needle in text
        for needle in (
            "401", "403", "gated", "unauthorized", "forbidden",
            "authenticate", "restricted", "awaiting", "permission",
        )
    )


class DiarizationClient(ABC):
    @abstractmethod
    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        """Return (start_s, end_s, speaker_label) speaker turns for *audio_path*."""
        ...

    @abstractmethod
    def available(self) -> tuple[bool, str]: ...


class NullDiarizationClient(DiarizationClient):
    """Returned when diarization is disabled (backend = "null")."""

    def available(self) -> tuple[bool, str]:
        return True, ""

    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        return []


class PyannoteDiarizationClient(DiarizationClient):
    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        if not self._config.huggingface_token:
            return False, (
                "No HuggingFace token set — open Settings (⚙) and enter your token "
                "under Speaker labels"
            )
        try:
            import pyannote.audio  # noqa: F401
        except ImportError:
            return False, "pyannote.audio is not installed (pip install pyannote.audio)"
        return True, ""

    def diarize(self, audio_path: str) -> list[tuple[float, float, str]]:
        # Importing pyannote pulls in torchcodec, which logs a noisy "Could not load
        # libtorchcodec" traceback when FFmpeg's shared libs aren't on PATH (common on
        # Windows). It's expected and harmless here: we decode the WAV ourselves in
        # _load_waveform and never use torchcodec. Tracked as a ROADMAP follow-up to
        # silence the warning. If diarization itself fails, that surfaces separately below.
        _log.info("Loading diarization pipeline (any torchcodec load warning below is expected)")
        from pyannote.audio import Pipeline
        try:
            pipeline = Pipeline.from_pretrained(
                _PIPELINE_ID,
                token=self._config.huggingface_token,
            )
        except Exception as exc:
            if _looks_like_access_error(exc):
                raise DiarizationError(f"{exc}\n\n{_ACCEPT_TERMS_HINT}") from exc
            raise
        if pipeline is None:
            raise DiarizationError(_ACCEPT_TERMS_HELP)
        result = pipeline(_load_waveform(audio_path))
        # community-1 returns a DiarizeOutput dataclass whose `speaker_diarization`
        # field holds the Annotation; older pipelines return the Annotation directly.
        annotation = getattr(result, "speaker_diarization", result)
        return [
            (turn.start, turn.end, speaker)
            for turn, _, speaker in annotation.itertracks(yield_label=True)
        ]


def make_diarization_client(config: Config) -> DiarizationClient:
    if config.diarization_backend == "pyannote":
        return PyannoteDiarizationClient(config)
    return NullDiarizationClient()
