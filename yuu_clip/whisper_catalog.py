"""
User-facing catalog of the selectable speech-to-text (Whisper) models.

`config.ALLOWED_WHISPER_MODELS` is the security allow-list (every model faster-whisper
may load); this module is the much shorter *product* list - the handful of models the
UI actually offers, with the display copy (blurb + download size + VRAM) shown next to
each `<option>`. Those size/VRAM strings were the classic drift point: they lived only
in HTML, hand-copied across five web `<select>`s and the setup wizard. This module is
now their single Python source of truth - `yuu-dev shared-data` bakes them into
`catalog-data.json`, and `tests/unit/test_static_ui_contract.py` binds the web option
copy to `option_text()` here.

Download sizes are the on-disk float16 weights; VRAM figures are measured peak during a
float16/CUDA transcription (see the plan's B1-hardware-facts). tiny/base run comfortably
on CPU, so they carry no VRAM figure.

Pattern mirrors model_catalog.py / content_presets.py: a frozen dataclass, a static
tuple, and small lookup helpers.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class WhisperUIModel:
    id: str                       # matches an entry in config.ALLOWED_WHISPER_MODELS
    blurb: str                    # "fastest, lowest quality" - the quality/speed trade-off
    download: str                 # on-disk size, e.g. "~75 MB"
    vram: Optional[str] = None    # measured peak float16/CUDA VRAM, e.g. "~1 GB"; None => CPU-friendly

    def option_text(self) -> str:
        """The full `<option>` label, e.g.
        'small - fast, decent quality (~465 MB download, needs a ~1 GB graphics card)'."""
        paren = f"{self.download} download"
        if self.vram:
            paren += f", needs a {self.vram} graphics card"
        return f"{self.id} - {self.blurb} ({paren})"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "blurb": self.blurb,
            "download": self.download,
            "vram": self.vram,
            "option_text": self.option_text(),
        }


# Order = the order the UI renders the <option>s in (fastest first).
WHISPER_UI_MODELS: tuple[WhisperUIModel, ...] = (
    WhisperUIModel("tiny", "fastest, lowest quality", "~75 MB"),
    WhisperUIModel("base", "fast, lower quality", "~140 MB"),
    WhisperUIModel("small", "fast, decent quality", "~465 MB", "~1 GB"),
    WhisperUIModel("medium", "good balance", "~1.5 GB", "~2.8 GB"),
    WhisperUIModel("large-v3", "best quality", "~2.9 GB", "~4.2 GB"),
)


def ui_models() -> list[WhisperUIModel]:
    return list(WHISPER_UI_MODELS)


def option_text(model_id: str) -> Optional[str]:
    for model in WHISPER_UI_MODELS:
        if model.id == model_id:
            return model.option_text()
    return None
