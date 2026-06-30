from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config


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
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=self._config.huggingface_token,
        )
        diarization = pipeline(audio_path)
        return [
            (turn.start, turn.end, speaker)
            for turn, _, speaker in diarization.itertracks(yield_label=True)
        ]


def make_diarization_client(config: Config) -> DiarizationClient:
    if config.diarization_backend == "pyannote":
        return PyannoteDiarizationClient(config)
    return NullDiarizationClient()
