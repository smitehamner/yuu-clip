"""
Export preset definitions, validation, and the size-cap bitrate math.

Built-in presets ("youtube-1080p", "discord-10mb") are always available and
not editable. Custom presets are user preferences, stored in global config
(Config.export_presets) rather than project data - see web/routes/export_presets.py
for the CRUD routes and export/render.py for how a preset drives the actual encode.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Optional

ALLOWED_CONTAINERS: frozenset[str] = frozenset({"mp4", "mkv"})
ALLOWED_HEIGHTS: frozenset[int] = frozenset({720, 1080, 1440, 2160})
MIN_CRF = 0
MAX_CRF = 51
MIN_AUDIO_KBPS = 32
MAX_AUDIO_KBPS = 320

# Below this, a two-pass size-capped encode would have essentially no video
# bitrate left after subtracting audio - reject before wasting an encode on it.
MIN_VIDEO_KBPS = 150

# Reserve 5% of the byte budget as headroom: two-pass targets an *average* bitrate,
# and container overhead (mp4 moov/index) plus x264 rate-control slop routinely push
# the actual file slightly over an exact-budget target - the exact overshoot the hard
# cap exists to prevent. Aiming at 95% of the cap keeps the produced file under it.
SIZE_CAP_HEADROOM = 0.95

_NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


@dataclass
class ExportPreset:
    name: str                              # id, kebab-case
    label: str                             # user-facing
    container: str                         # mp4 | mkv
    height: Optional[int] = None           # scale target (never upscales); None = source
    crf: Optional[int] = None              # quality mode (mutually exclusive with target_size_mb)
    target_size_mb: Optional[float] = None  # size mode (two-pass)
    audio_kbps: int = 128
    # Vertical (9:16) output for TikTok / Shorts: the source is cropped to 9:16 at
    # the clip's crop_x position and scaled to 1080x1920. When True, `height` is
    # informational only - the vertical filter owns the scale (see extract.py).
    vertical: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


BUILTIN_PRESETS: tuple[ExportPreset, ...] = (
    ExportPreset(
        name="youtube-1080p", label="YouTube 1080p", container="mp4",
        height=1080, crf=18, target_size_mb=None, audio_kbps=192,
    ),
    ExportPreset(
        name="discord-10mb", label="Discord (<=10 MB)", container="mp4",
        height=None, crf=None, target_size_mb=10.0, audio_kbps=128,
    ),
    ExportPreset(
        name="tiktok-9x16", label="TikTok / Shorts (9:16)", container="mp4",
        height=1920, crf=20, target_size_mb=None, audio_kbps=160, vertical=True,
    ),
)
BUILTIN_PRESET_NAMES: frozenset[str] = frozenset(p.name for p in BUILTIN_PRESETS)


def builtin_preset_by_name(name: str) -> Optional[ExportPreset]:
    return next((p for p in BUILTIN_PRESETS if p.name == name), None)


def resolve_preset(name: Optional[str], custom_presets: list[dict]) -> Optional[ExportPreset]:
    """Look up an Export preset by name across built-ins and *custom_presets*
    (raw dicts as stored in Config.export_presets). Returns None for "default"/
    empty/unknown - callers treat that as "original quality, no preset"."""
    if not name or name == "default":
        return None
    builtin = builtin_preset_by_name(name)
    if builtin is not None:
        return builtin
    for raw in custom_presets or []:
        if raw.get("name") == name:
            return ExportPreset(**raw)
    return None


def validate_preset_dict(data: dict, existing_names: set[str]) -> ExportPreset:
    """Validate a custom preset submission and return the ExportPreset it
    describes. Raises ValueError with a plain-English message on the first
    problem found. *existing_names* excludes the preset being edited, so a
    save-in-place doesn't collide with itself."""
    name = str(data.get("name") or "").strip().lower()
    if not name or not _NAME_RE.match(name):
        raise ValueError(
            "Preset name must be lowercase letters, numbers, and hyphens only (e.g. 'twitch-clip')"
        )
    if name in BUILTIN_PRESET_NAMES:
        raise ValueError(f"'{name}' is a built-in preset name - choose a different name")
    if name in existing_names:
        raise ValueError(f"A custom preset named '{name}' already exists")

    label = str(data.get("label") or "").strip()
    if not label:
        raise ValueError("Preset label is required")

    container = data.get("container")
    if container not in ALLOWED_CONTAINERS:
        raise ValueError(f"Container must be one of: {', '.join(sorted(ALLOWED_CONTAINERS))}")

    height = data.get("height")
    if height is not None and height not in ALLOWED_HEIGHTS:
        raise ValueError(
            f"Resolution must be one of {sorted(ALLOWED_HEIGHTS)} or unset (source resolution)"
        )

    crf = data.get("crf")
    target_size_mb = data.get("target_size_mb")
    if (crf is None) == (target_size_mb is None):
        raise ValueError("Set exactly one of quality (CRF) or target size (MB), not both or neither")
    if crf is not None and not (MIN_CRF <= crf <= MAX_CRF):
        raise ValueError(f"CRF must be between {MIN_CRF} and {MAX_CRF}")
    if target_size_mb is not None and target_size_mb <= 0:
        raise ValueError("Target size must be a positive number of MB")

    audio_kbps = data.get("audio_kbps", 128)
    if not (MIN_AUDIO_KBPS <= audio_kbps <= MAX_AUDIO_KBPS):
        raise ValueError(f"Audio bitrate must be between {MIN_AUDIO_KBPS} and {MAX_AUDIO_KBPS} kbps")

    return ExportPreset(
        name=name, label=label, container=container, height=height,
        crf=crf, target_size_mb=target_size_mb, audio_kbps=audio_kbps,
        vertical=bool(data.get("vertical", False)),
    )


class ClipTooLongForPresetError(ValueError):
    """Raised when a size-capped preset can't fit the clip above MIN_VIDEO_KBPS."""


def compute_target_video_kbps(target_size_mb: float, duration_s: float, audio_kbps: int) -> float:
    """Video bitrate (kbps) that fills *target_size_mb* over *duration_s* after
    reserving *audio_kbps* for audio and SIZE_CAP_HEADROOM for container/rate-control
    overhead. 8192 = 1024 KiB/MiB * 8 bits/byte."""
    total_kbps = target_size_mb * SIZE_CAP_HEADROOM * 8192 / duration_s
    return total_kbps - audio_kbps


def resolve_video_kbps(preset: ExportPreset, duration_s: float) -> float:
    """Video bitrate for a size-capped (target_size_mb) preset, or raise
    ClipTooLongForPresetError with a plain-English message when the clip is too
    long to fit the target above MIN_VIDEO_KBPS."""
    video_kbps = compute_target_video_kbps(preset.target_size_mb, duration_s, preset.audio_kbps)
    if video_kbps < MIN_VIDEO_KBPS:
        size_label = f"{preset.target_size_mb:g} MB"
        raise ClipTooLongForPresetError(
            f"This clip is too long to fit under {size_label} - shorten the clip or pick another preset."
        )
    return video_kbps
