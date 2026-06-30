from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config


class DiarizationError(RuntimeError):
    """A diarization failure the user can act on (e.g. accept model terms)."""


# pyannote/speaker-diarization-3.1 pulls in pyannote/segmentation-3.0; both are
# gated. A token that hasn't accepted *both* sets of conditions can't download
# the weights — pyannote returns None from from_pretrained (or raises a 401/403)
# rather than a readable error, so we translate it into something actionable.
_ACCEPT_TERMS_HELP = (
    "Speaker labels need access to two gated HuggingFace models. Sign in to "
    "HuggingFace with the same account as your token, accept the user "
    "conditions on BOTH pages, then run again:\n"
    "  - https://hf.co/pyannote/speaker-diarization-3.1\n"
    "  - https://hf.co/pyannote/segmentation-3.0\n"
    "The token also needs 'Read' access to gated repos — create one at "
    "https://hf.co/settings/tokens"
)


def _looks_like_access_error(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".lower()
    return any(
        needle in text
        for needle in (
            "401", "403", "gated", "unauthorized", "forbidden",
            "authenticate", "access", "awaiting", "permission",
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
        from pyannote.audio import Pipeline
        try:
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=self._config.huggingface_token,
            )
        except Exception as exc:
            if _looks_like_access_error(exc):
                raise DiarizationError(_ACCEPT_TERMS_HELP) from exc
            raise
        if pipeline is None:
            raise DiarizationError(_ACCEPT_TERMS_HELP)
        diarization = pipeline(audio_path)
        return [
            (turn.start, turn.end, speaker)
            for turn, _, speaker in diarization.itertracks(yield_label=True)
        ]


def make_diarization_client(config: Config) -> DiarizationClient:
    if config.diarization_backend == "pyannote":
        return PyannoteDiarizationClient(config)
    return NullDiarizationClient()
