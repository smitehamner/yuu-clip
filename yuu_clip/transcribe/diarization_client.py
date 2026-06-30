from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config


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
        diarization = pipeline(audio_path)
        return [
            (turn.start, turn.end, speaker)
            for turn, _, speaker in diarization.itertracks(yield_label=True)
        ]


def make_diarization_client(config: Config) -> DiarizationClient:
    if config.diarization_backend == "pyannote":
        return PyannoteDiarizationClient(config)
    return NullDiarizationClient()
