"""
Configuration for rp-clipper.

Two levels:
  - Global config: stored in the OS-appropriate config dir
      Windows: %APPDATA%/rp-clipper/config.json
      Linux:   ~/.config/rp-clipper/config.json
      macOS:   ~/Library/Application Support/rp-clipper/config.json
  - Project config: stored in <project_dir>/.rp-clipper/config.json
    Project config values override global ones.
"""
from __future__ import annotations

import json
import shutil
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

from platformdirs import user_config_dir, user_data_dir

APP_NAME = "rp-clipper"


def _global_config_dir() -> Path:
    return Path(user_config_dir(APP_NAME))


def _profiles_path() -> Path:
    return _global_config_dir() / "profiles.json"


TRACK_LABELS = ["player_voice", "ingame_voicechat", "game_sounds", "combined", "unlabeled"]

LABEL_WEIGHTS: dict[str, float] = {
    "player_voice":    2.0,
    "ingame_voicechat": 1.0,
    "game_sounds":     0.1,
    "combined":        1.5,
    "unlabeled":       1.0,
}

LABEL_DESCRIPTIONS: dict[str, str] = {
    "player_voice":    "Your own microphone — highest relevance",
    "ingame_voicechat": "Other players' in-game voice chat",
    "game_sounds":     "Game audio / ambient / music (usually skip transcription)",
    "combined":        "Mixed track — all sources together",
    "unlabeled":       "Unknown — default weight applied",
}

# ---------------------------------------------------------------------------
# Whisper allowlists — prevent unexpected HuggingFace downloads
# ---------------------------------------------------------------------------

# Only these model identifiers are accepted.  faster-whisper also accepts
# arbitrary HuggingFace repo IDs (e.g. "user/repo"), which could trigger
# unexpected network downloads if someone edits a config file.
# To add a new trusted model, update this set explicitly.
ALLOWED_WHISPER_MODELS: frozenset[str] = frozenset({
    "tiny",
    "tiny.en",
    "base",
    "base.en",
    "small",
    "small.en",
    "medium",
    "medium.en",
    "large-v1",
    "large-v2",
    "large-v3",
    "distil-small.en",
    "distil-medium.en",
    "distil-large-v2",
    "distil-large-v3",
})

# ISO 639-1 codes supported by Whisper, plus None/"auto".
# Source: https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
# Prevents arbitrary strings reaching the Whisper API.
ALLOWED_WHISPER_LANGUAGES: frozenset[str] = frozenset({
    "af","am","ar","as","az","ba","be","bg","bn","bo","br","bs","ca","cs",
    "cy","da","de","el","en","es","et","eu","fa","fi","fo","fr","gl","gu",
    "ha","haw","he","hi","hr","ht","hu","hy","id","is","it","ja","jw","ka",
    "kk","km","kn","ko","la","lb","ln","lo","lt","lv","mg","mi","mk","ml",
    "mn","mr","ms","mt","my","ne","nl","nn","no","oc","pa","pl","ps","pt",
    "ro","ru","sa","sd","si","sk","sl","sn","so","sq","sr","su","sv","sw",
    "ta","te","tg","th","tk","tl","tr","tt","uk","ur","uz","vi","yi","yo",
    "zh",
})


def validate_whisper_model(model: str) -> str:
    """
    Raise ValueError if *model* is not in the known-safe allowlist.
    Returns the model name unchanged if valid.
    """
    if model not in ALLOWED_WHISPER_MODELS:
        raise ValueError(
            f"Unknown Whisper model '{model}'.  "
            f"Allowed: {sorted(ALLOWED_WHISPER_MODELS)}\n"
            "If you need a different model, add it to ALLOWED_WHISPER_MODELS "
            "in config.py after verifying it."
        )
    return model


def validate_whisper_language(lang: Optional[str]) -> Optional[str]:
    """
    Raise ValueError if *lang* is not a recognised ISO 639-1 code.
    None / 'auto' are accepted (auto-detection).
    """
    if lang is None or lang.lower() in ("auto", ""):
        return None
    lang_lower = lang.lower()
    if lang_lower not in ALLOWED_WHISPER_LANGUAGES:
        raise ValueError(
            f"Unrecognised language code '{lang}'.  "
            f"Use an ISO 639-1 code, e.g. 'en', 'fr', 'de', or omit for auto-detection."
        )
    return lang_lower

# Labels for which we skip transcription by default (user can override)
DEFAULT_SKIP_TRANSCRIBE = {"game_sounds"}

# Labels excluded from audio energy scoring by default (user can override during labeling)
DEFAULT_SKIP_SCORE: frozenset[str] = frozenset({"game_sounds"})


@dataclass
class Config:
    whisper_model: str = "base"
    # "cpu" works everywhere; "cuda" needs NVIDIA GPU + CUDA toolkit on Windows/Linux
    # "auto" lets faster-whisper pick (cuda if available, else cpu)
    whisper_device: str = "auto"
    # int8 is fast and fine for base/small; use float16 on GPU for large models
    whisper_compute_type: str = "int8"

    # HuggingFace model revision (git commit SHA) for reproducible model downloads.
    # When None, HuggingFace downloads the latest "main" branch — fine for development
    # but not reproducible.  Set this to a specific commit SHA to pin the exact model
    # weights and prevent silent updates.
    #
    # How to find the revision:
    #   1. Go to https://huggingface.co/Systran/faster-whisper-<model>
    #   2. Click "Files and versions" → "History" → copy the full commit SHA
    #   3. Paste it here, e.g. "dc0e87e9c32a0b59e0c4b502c45e5b78e3c59a1a"
    #
    # Known good revisions (verify on HF before use — listed for reference only):
    #   base:     check https://huggingface.co/Systran/faster-whisper-base/commits/main
    #   small:    check https://huggingface.co/Systran/faster-whisper-small/commits/main
    #   large-v3: check https://huggingface.co/Systran/faster-whisper-large-v3/commits/main
    whisper_model_revision: Optional[str] = None

    audio_sample_rate: int = 16_000  # Whisper expects 16 kHz
    audio_channels: int = 1           # Whisper expects mono

    silence_threshold_ms: int = 3_000   # gap that marks a clip boundary
    min_clip_ms: int = 15_000           # shortest candidate kept (15 s)
    hard_split_ms: int = 180_000        # force-split continuous speech (3 min)

    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_s: float = 120.0
    ollama_enabled: bool = True

    scorer_energy_enabled: bool = True
    scorer_scenes_enabled: bool = True
    scorer_llm_enabled: bool = True

    # Scene detection mode: "transcript" | "fast" | "full"
    # transcript = silence gaps only (instant, no extra deps)
    # fast       = keyframes + transcript gaps (seconds, recommended default)
    # full       = ContentDetector on every frame (most accurate, slow on long VODs)
    scene_detection_mode: str = "fast"
    # Minimum silence gap in seconds to register as a transcript-mode scene boundary
    scene_transcript_gap_s: float = 3.0

    scorer_energy_weight: float = 1.0
    scorer_scene_weight: float = 0.5
    scorer_llm_weight: float = 2.0

    score_funny_weight: float = 1.0
    score_dramatic_weight: float = 1.0
    score_action_weight: float = 1.0

    ui_timeline_interval_seconds: int = 900
    ui_timeline_interval_unit: str = "minutes"

    @classmethod
    def load(cls, project_dir: Path) -> "Config":
        """Load config, merging global defaults with project overrides."""
        import logging
        _cfg_log = logging.getLogger(__name__)

        merged: dict = {}

        global_cfg = _global_config_dir() / "config.json"
        if global_cfg.exists():
            merged.update(json.loads(global_cfg.read_text(encoding="utf-8")))
            _cfg_log.debug("Loaded global config from %s", global_cfg)

        project_cfg = project_dir / ".rp-clipper" / "config.json"
        if project_cfg.exists():
            merged.update(json.loads(project_cfg.read_text(encoding="utf-8")))
            _cfg_log.debug("Loaded project config from %s", project_cfg)

        known = {f for f in cls.__dataclass_fields__}
        unknown = set(merged) - known
        if unknown:
            _cfg_log.warning("Config: unrecognised keys ignored: %s", sorted(unknown))
        return cls(**{k: v for k, v in merged.items() if k in known})

    def save_project(self, project_dir: Path) -> None:
        cfg_path = project_dir / ".rp-clipper" / "config.json"
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        cfg_path.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")

    def save_global(self) -> None:
        cfg_dir = _global_config_dir()
        cfg_dir.mkdir(parents=True, exist_ok=True)
        (cfg_dir / "config.json").write_text(
            json.dumps(asdict(self), indent=2), encoding="utf-8"
        )


def load_profiles() -> dict:
    """Load saved track-label profiles from the global config dir."""
    p = _profiles_path()
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def _write_profiles(profiles: dict) -> None:
    p = _profiles_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(profiles, indent=2), encoding="utf-8")


def save_profile(name: str, assignments: list[dict]) -> None:
    """
    Save a track-label profile.

    assignments: list of dicts with keys:
        stream_position (int) - 0-based index among audio streams
        label (str)
        transcribe (bool)
    """
    profiles = load_profiles()
    profiles[name] = {
        "num_tracks": len(assignments),
        "assignments": assignments,
    }
    _write_profiles(profiles)


def delete_profile(name: str) -> None:
    profiles = load_profiles()
    profiles.pop(name, None)
    _write_profiles(profiles)


def project_audio_dir(project_dir: Path) -> Path:
    d = project_dir / ".rp-clipper" / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


def project_exports_dir(project_dir: Path) -> Path:
    d = project_dir / ".rp-clipper" / "exports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def project_db_path(project_dir: Path) -> Path:
    d = project_dir / ".rp-clipper"
    d.mkdir(parents=True, exist_ok=True)
    return d / "project.db"


def find_ffmpeg() -> tuple[str, str]:
    """
    Return (ffmpeg_exe, ffprobe_exe) paths.

    On Windows, shutil.which() finds .exe files in PATH automatically.
    Raises RuntimeError with install instructions if not found.
    """
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")

    missing = []
    if not ffmpeg:
        missing.append("ffmpeg")
    if not ffprobe:
        missing.append("ffprobe")

    if missing:
        if sys.platform == "win32":
            hint = (
                "Install FFmpeg on Windows via:\n"
                "  winget install Gyan.FFmpeg\n"
                "  or: choco install ffmpeg\n"
                "  or: scoop install ffmpeg\n"
                "Then restart your terminal so PATH is updated."
            )
        else:
            hint = (
                "Install FFmpeg via your package manager:\n"
                "  Ubuntu/Debian: sudo apt install ffmpeg\n"
                "  Arch:          sudo pacman -S ffmpeg\n"
                "  macOS:         brew install ffmpeg"
            )
        raise RuntimeError(
            f"Required tools not found in PATH: {', '.join(missing)}\n\n{hint}"
        )

    return ffmpeg, ffprobe
