"""
Track-role labels and saved track-layout profiles.

A "profile" is a named, saved set of per-track-position label assignments
(analyze/labeler.py's _apply_profile matches a new recording's track count
against one), stored in the global config dir alongside config.json.
"""
from __future__ import annotations

import json
from pathlib import Path

from yuu_clip import config as _config

TRACK_LABELS = ["player_voice", "ingame_voicechat", "game_sounds", "combined", "unlabeled"]

LABEL_WEIGHTS: dict[str, float] = {
    "player_voice":    2.0,
    "ingame_voicechat": 1.0,
    "game_sounds":     0.1,
    "combined":        1.5,
    "unlabeled":       1.0,
}

LABEL_DESCRIPTIONS: dict[str, str] = {
    "player_voice":    "Your own microphone - highest relevance",
    "ingame_voicechat": "Other players' in-game voice chat",
    "game_sounds":     "Game audio / ambient / music (usually skip transcription)",
    "combined":        "Mixed track - all sources together",
    "unlabeled":       "Unknown - default weight applied",
}

# Labels for which we skip transcription by default (user can override)
DEFAULT_SKIP_TRANSCRIBE = {"game_sounds"}

# Labels excluded from audio energy scoring by default (user can override during labeling)
DEFAULT_SKIP_SCORE: frozenset[str] = frozenset({"game_sounds"})


def _profiles_path() -> Path:
    return _config._global_config_dir() / "profiles.json"


def load_profiles() -> dict:
    """Load saved track-label profiles from the global config dir.

    Tolerates a corrupt profiles.json (same class as Config.load): a hand-edited
    file must not crash the track-layout list - fall back to empty.
    """
    p = _profiles_path()
    if p.exists():
        return _config._read_config_file(p)
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
