"""
Configuration for yuu-clip.

Two levels:
  - Global config: stored in the OS-appropriate config dir
      Windows: %APPDATA%/yuu-clip/config.json
      Linux:   ~/.config/yuu-clip/config.json
      macOS:   ~/Library/Application Support/yuu-clip/config.json
  - Project config: stored in <project_dir>/.yuu-clip/config.json
    Project config values override global ones.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from platformdirs import user_config_dir, user_data_dir

from yuu_clip.export.naming import (  # noqa: F401 (re-exported for routes/config.py)
    DEFAULT_EXPORT_NAME_TEMPLATE,
    validate_export_name_template,
)

APP_NAME = "yuu-clip"

_log = logging.getLogger(__name__)


def _global_config_dir() -> Path:
    return Path(user_config_dir(APP_NAME))


def _profiles_path() -> Path:
    return _global_config_dir() / "profiles.json"


def _known_projects_path() -> Path:
    return _global_config_dir() / "projects.json"


# Cap on the recent-projects list so it never grows without bound.
_KNOWN_PROJECTS_MAX = 20


def load_known_projects() -> list[dict]:
    """Load the recent-projects list (most-recent first) from the global config dir.

    Each entry is ``{path, last_opened_at}``. Returns [] on a missing or
    hand-corrupted file rather than raising - the switcher must still open.
    """
    p = _known_projects_path()
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        _log.warning("projects.json is unreadable - ignoring recent-projects list")
        return []
    if not isinstance(data, list):
        return []
    return [e for e in data if isinstance(e, dict) and isinstance(e.get("path"), str)]


def record_known_project(project_dir: Path) -> None:
    """Move *project_dir* to the front of the recent-projects list (dedup by
    resolved path), stamping ``last_opened_at``."""
    resolved = str(Path(project_dir).resolve())
    now = datetime.now(timezone.utc).isoformat()
    projects = [e for e in load_known_projects() if e.get("path") != resolved]
    projects.insert(0, {"path": resolved, "last_opened_at": now})
    del projects[_KNOWN_PROJECTS_MAX:]
    p = _known_projects_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(projects, indent=2), encoding="utf-8")


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

# ---------------------------------------------------------------------------
# Whisper allowlists - prevent unexpected HuggingFace downloads
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


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

TITLE_CARD_PLACEHOLDERS: frozenset[str] = frozenset({"description", "start", "duration"})
TITLE_CARD_TEMPLATE_MAX_LEN = 300
TITLE_CARD_SCALE_RANGE = (0.5, 2.0)
TITLE_CARD_DURATION_RANGE_S = (1.0, 10.0)

_TITLE_CARD_DEFAULTS: dict[str, object] = {
    "title_card_bg_color": "#000000",
    "title_card_font_color": "#ffffff",
    "title_card_scale": 1.0,
    "title_card_template": "{description}\n{start} · {duration}",
    "title_card_duration_s": 3.0,
}

# Burned-in caption styling (Settings -> Export + per-export override). Empty/zero
# values mean "libass renderer default" and emit no force_style - zero behavior
# change until the creator touches a field. font_size 0 = default, else 12-96.
CAPTION_FONT_SIZE_RANGE = (12, 96)
CAPTION_FONT_NAME_MAX_LEN = 64
CAPTION_POSITIONS: frozenset[str] = frozenset({"bottom", "top"})
_CAPTION_STYLE_DEFAULTS: dict[str, object] = {
    "caption_font_name": "",
    "caption_font_size": 0,
    "caption_position": "bottom",
}


def validate_hex_color(value: str, label: str) -> str:
    """
    Raise ValueError unless *value* is a strict #RRGGBB hex color.

    Rejects short (#RGB), alpha (#RRGGBBAA), and named colors ("red") - only
    the 6-digit form is accepted, matching what _make_title_card's ffmpeg
    color= / fontcolor= conversion expects.
    """
    if not _HEX_COLOR_RE.match(value):
        raise ValueError(f"{label} must be a hex color like #RRGGBB (got {value!r})")
    return value


def validate_title_card_template(value: str) -> str:
    """
    Raise ValueError unless *value* is a valid title-card text template.

    A template is free text with {placeholder} tokens drawn from
    TITLE_CARD_PLACEHOLDERS; newlines separate title-card lines. Empty is
    allowed - the renderer falls back to a timecode line so a card is never
    emitted blank (see reel.title_card_lines).
    """
    if not isinstance(value, str):
        raise ValueError("title_card_template must be text")
    if len(value) > TITLE_CARD_TEMPLATE_MAX_LEN:
        raise ValueError(
            f"title_card_template must be {TITLE_CARD_TEMPLATE_MAX_LEN} characters or fewer"
        )
    unknown = sorted({p for p in re.findall(r"\{(\w*)\}", value) if p not in TITLE_CARD_PLACEHOLDERS})
    if unknown:
        raise ValueError(
            "title_card_template has unknown placeholders: "
            + ", ".join("{%s}" % u for u in unknown)
        )
    return value


def _sanitize_title_card_fields(merged: dict) -> None:
    """
    Guard against a hand-edited config.json with garbage title-card values.

    Config.load() must never crash on a bad color/scale/layout/duration - log a
    WARN and fall back to the default instead. PATCH /api/config enforces the
    same rules but rejects the save outright (see web/routes/config.py); this
    function only protects the load path.
    """
    for field_name in ("title_card_bg_color", "title_card_font_color"):
        if field_name in merged:
            try:
                validate_hex_color(merged[field_name], field_name)
            except ValueError:
                _log.warning(
                    "Config: %s invalid (%r) - using default %s",
                    field_name, merged[field_name], _TITLE_CARD_DEFAULTS[field_name],
                )
                merged[field_name] = _TITLE_CARD_DEFAULTS[field_name]

    if "title_card_template" in merged:
        try:
            validate_title_card_template(merged["title_card_template"])
        except ValueError:
            _log.warning(
                "Config: title_card_template invalid (%r) - using default %r",
                merged["title_card_template"], _TITLE_CARD_DEFAULTS["title_card_template"],
            )
            merged["title_card_template"] = _TITLE_CARD_DEFAULTS["title_card_template"]

    scale_min, scale_max = TITLE_CARD_SCALE_RANGE
    if "title_card_scale" in merged and not (scale_min <= merged["title_card_scale"] <= scale_max):
        _log.warning(
            "Config: title_card_scale out of range (%r) - using default %s",
            merged["title_card_scale"], _TITLE_CARD_DEFAULTS["title_card_scale"],
        )
        merged["title_card_scale"] = _TITLE_CARD_DEFAULTS["title_card_scale"]

    dur_min, dur_max = TITLE_CARD_DURATION_RANGE_S
    if "title_card_duration_s" in merged and not (dur_min <= merged["title_card_duration_s"] <= dur_max):
        _log.warning(
            "Config: title_card_duration_s out of range (%r) - using default %s",
            merged["title_card_duration_s"], _TITLE_CARD_DEFAULTS["title_card_duration_s"],
        )
        merged["title_card_duration_s"] = _TITLE_CARD_DEFAULTS["title_card_duration_s"]


def validate_caption_font_name(value: str) -> str:
    """
    Raise ValueError unless *value* is a safe libass FontName.

    Empty is allowed (renderer default). Otherwise it must be printable, at most
    CAPTION_FONT_NAME_MAX_LEN chars, and free of the characters that would break
    the FFmpeg filtergraph quoting of force_style (',' separates fields, '\\'
    escapes, and "'" closes the quoted value). Validation is the escaping
    strategy - we reject rather than escape so the burn-in filter stays simple.
    """
    if not isinstance(value, str):
        raise ValueError("caption_font_name must be text")
    if value == "":
        return value
    if len(value) > CAPTION_FONT_NAME_MAX_LEN:
        raise ValueError(
            f"caption_font_name must be {CAPTION_FONT_NAME_MAX_LEN} characters or fewer"
        )
    if not value.isprintable():
        raise ValueError("caption_font_name must contain only printable characters")
    for bad in ("'", ",", "\\"):
        if bad in value:
            raise ValueError(f"caption_font_name must not contain {bad!r}")
    return value


def validate_caption_font_size(value: int) -> int:
    """Raise ValueError unless *value* is 0 (renderer default) or within CAPTION_FONT_SIZE_RANGE."""
    lo, hi = CAPTION_FONT_SIZE_RANGE
    if value != 0 and not (lo <= value <= hi):
        raise ValueError(f"caption_font_size must be 0 (default) or between {lo} and {hi}")
    return value


def _sanitize_caption_style_fields(merged: dict) -> None:
    """Guard the load path against a hand-edited config with bad caption-style values.

    Mirrors _sanitize_title_card_fields: log a WARN and fall back to the default
    rather than crash. PATCH /api/config enforces the same rules but rejects.
    """
    if "caption_font_name" in merged:
        try:
            validate_caption_font_name(merged["caption_font_name"])
        except ValueError:
            _log.warning(
                "Config: caption_font_name invalid (%r) - using default %r",
                merged["caption_font_name"], _CAPTION_STYLE_DEFAULTS["caption_font_name"],
            )
            merged["caption_font_name"] = _CAPTION_STYLE_DEFAULTS["caption_font_name"]

    if "caption_font_size" in merged:
        try:
            validate_caption_font_size(merged["caption_font_size"])
        except (ValueError, TypeError):
            _log.warning(
                "Config: caption_font_size invalid (%r) - using default %s",
                merged["caption_font_size"], _CAPTION_STYLE_DEFAULTS["caption_font_size"],
            )
            merged["caption_font_size"] = _CAPTION_STYLE_DEFAULTS["caption_font_size"]

    if "caption_position" in merged and merged["caption_position"] not in CAPTION_POSITIONS:
        _log.warning(
            "Config: caption_position invalid (%r) - using default %r",
            merged["caption_position"], _CAPTION_STYLE_DEFAULTS["caption_position"],
        )
        merged["caption_position"] = _CAPTION_STYLE_DEFAULTS["caption_position"]


# Frames sampled per clip for image-based analysis. 1 keeps it cheap; 10 caps the
# cost/latency of a single vision call on long clips.
VISION_FRAMES_RANGE = (1, 10)


def validate_vision_frames_per_clip(value: int) -> int:
    """Raise ValueError unless *value* is an int within VISION_FRAMES_RANGE."""
    lo, hi = VISION_FRAMES_RANGE
    if not isinstance(value, int) or isinstance(value, bool) or not (lo <= value <= hi):
        raise ValueError(f"vision_frames_per_clip must be an integer between {lo} and {hi}")
    return value


def _sanitize_vision_fields(merged: dict) -> None:
    """Guard the load path against a hand-edited config with a bad frame count."""
    if "vision_frames_per_clip" in merged:
        try:
            validate_vision_frames_per_clip(merged["vision_frames_per_clip"])
        except (ValueError, TypeError):
            _log.warning(
                "Config: vision_frames_per_clip invalid (%r) - using default 2",
                merged["vision_frames_per_clip"],
            )
            merged["vision_frames_per_clip"] = 2


def _sanitize_content_preset_field(merged: dict) -> None:
    """Guard the load path against a hand-edited config naming an unknown preset."""
    if "content_preset" in merged:
        from yuu_clip.content_presets import is_valid_preset_id
        if not is_valid_preset_id(merged["content_preset"]):
            _log.warning(
                "Config: content_preset invalid (%r) - using default 'generic'",
                merged["content_preset"],
            )
            merged["content_preset"] = "generic"


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


# AI privacy mode (plan non-llm-tiers/07) - the single trust control over what the app
# may do with a user's transcript. Enforced everywhere a language model could run, via
# resolve_ai_permissions below. "none" = no generative language model runs at all
# (embeddings/lexicon/energy still work - they're discriminative, not generative);
# "local_only" = on-device LLM allowed, remote (Claude) backend blocked, nothing leaves
# the machine; "remote_ok" = the Claude API backend is permitted.
ALLOWED_AI_PRIVACY_MODES: frozenset[str] = frozenset({"none", "local_only", "remote_ok"})


def validate_ai_privacy_mode(mode: str) -> str:
    if mode not in ALLOWED_AI_PRIVACY_MODES:
        raise ValueError(
            f"Unrecognised AI privacy mode '{mode}'. "
            f"Use one of: {sorted(ALLOWED_AI_PRIVACY_MODES)}."
        )
    return mode


@dataclass(frozen=True)
class AiPermissions:
    """What the active AI privacy mode permits. The trust surface: every LLM gate reads
    this, so the mode is a real guarantee, not a UI hint. allow_llm covers any generative
    language model; allow_remote covers off-device/billed backends (Claude)."""
    allow_llm: bool
    allow_remote: bool


def resolve_ai_permissions(config: "Config") -> AiPermissions:
    """The single choke point that turns ai_privacy_mode into concrete permissions.

    Fails safe: an unknown/garbage mode resolves to local_only (blocks the billed,
    off-device remote path) - never to remote_ok.
    """
    mode = (getattr(config, "ai_privacy_mode", "local_only") or "local_only").strip()
    if mode == "none":
        return AiPermissions(allow_llm=False, allow_remote=False)
    if mode == "remote_ok":
        return AiPermissions(allow_llm=True, allow_remote=True)
    return AiPermissions(allow_llm=True, allow_remote=False)


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
    # ISO 639-1 code forced for all transcription; "" = auto-detect per recording.
    # A per-run --language CLI flag still overrides this.
    whisper_language: str = ""

    # HuggingFace model revision (git commit SHA) for reproducible model downloads.
    # When None, HuggingFace downloads the latest "main" branch - fine for development
    # but not reproducible.  Set this to a specific commit SHA to pin the exact model
    # weights and prevent silent updates.
    #
    # How to find the revision:
    #   1. Go to https://huggingface.co/Systran/faster-whisper-<model>
    #   2. Click "Files and versions" → "History" → copy the full commit SHA
    #   3. Paste it here, e.g. "dc0e87e9c32a0b59e0c4b502c45e5b78e3c59a1a"
    #
    # Known good revisions (verify on HF before use - listed for reference only):
    #   base:     check https://huggingface.co/Systran/faster-whisper-base/commits/main
    #   small:    check https://huggingface.co/Systran/faster-whisper-small/commits/main
    #   large-v3: check https://huggingface.co/Systran/faster-whisper-large-v3/commits/main
    whisper_model_revision: Optional[str] = None

    # First-run-friction Stage 6: the analysis models needed for every run (the
    # speech-to-text model and the speaker-labeling model) prefetch in the
    # background on first launch so the first analysis isn't a surprise wait. The
    # setup wizard exposes this as one checkbox that is checked (prefetch on) by
    # default; unchecking it sets this True. When True, no background prefetch runs
    # and each model still downloads lazily the first time its feature is used.
    model_prefetch_disabled: bool = False

    audio_sample_rate: int = 16_000  # Whisper expects 16 kHz
    audio_channels: int = 1           # Whisper expects mono

    silence_threshold_ms: int = 3_000   # gap that marks a clip boundary
    min_clip_ms: int = 15_000           # shortest candidate kept (15 s)
    hard_split_ms: int = 180_000        # force-split continuous speech (3 min)
    # Drop candidates whose transcript text is too sparse for their length -
    # mostly-silence windows (e.g. a Whisper runaway-timestamp segment stamping
    # one hallucinated line across many minutes). Measured in characters of
    # transcript text per second of clip. Real speech is ~10+ cps; 0.2 only
    # removes near-silent windows. Set 0 to keep every window (disable).
    min_clip_speech_cps: float = 0.2

    # AI privacy mode (plan non-llm-tiers/07) - the trust control over transcript use.
    # "none" | "local_only" (default) | "remote_ok"; enforced via resolve_ai_permissions.
    ai_privacy_mode: str = "local_only"

    # LOCAL backends - inference runs on your machine, no API costs
    llm_backend: str = "llamacpp"    # "llamacpp" | "ollama" | "claude"
    llm_model_path: str = ""         # path to .gguf file; required when backend is llamacpp
    # Boot-time handoff flag (first-run-friction): the setup wizard sets this to a
    # catalog model id when the user opts into local AI but has not downloaded a
    # model yet, so the app can fetch it in the background after launch. Empty once
    # a model file exists or the user chose lightweight mode.
    pending_local_model: str = ""
    llm_mmproj_path: str = ""        # path to the vision projector .gguf; enables vision on llamacpp
    # Vision tower, paired with llm_mmproj_path. Text scoring uses llm_model_path and is
    # fully independent - a downloaded vision model must never write to llm_model_path.
    llm_vision_model_path: str = ""
    # The desktop installer ships a CUDA build of llama-cpp-python for NVIDIA cards,
    # but offload is off unless n_gpu_layers is set - so with this False the GPU sits
    # idle. True offloads all layers when the installed build supports it, and the
    # client falls back to CPU if that load fails (e.g. insufficient VRAM).
    llm_use_gpu: bool = True

    # Image-based clip analysis (plan 11): sample frames from a clip, send them to a
    # vision model, and store a short factual "what's on screen" summary that enriches
    # the clip's descriptions and gives the text scorer visual context. Available and
    # conservatively-on by default (packaging-strategy-overhaul Wave 6): the master
    # switch is on and frame count is low, but nothing actually runs unless a
    # vision-capable model is configured (see check_vision_available) - it's still
    # opt in per clip ("Analyze frames") or in the batch Re-score flow, never automatic.
    vision_enabled: bool = True
    vision_frames_per_clip: int = 2  # frames evenly sampled across the clip window (1–10)

    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"  # Apache-2.0 (monetization-safe); see model_catalog.py
    # Optional separate vision model for image analysis - lets a text-only text model
    # (e.g. qwen2.5:7b) pair with a vision model (e.g. qwen2.5-vl). Empty = reuse
    # ollama_model for vision too, matching the previous single-model behaviour.
    ollama_vision_model: str = ""
    ollama_timeout_s: float = 120.0
    ollama_enabled: bool = True

    # REMOTE backend - sends transcript data to Anthropic; billed per token
    claude_api_key: str = ""                         # Anthropic API key
    claude_model: str = "claude-haiku-4-5-20251001"  # model to use
    claude_timeout_s: float = 30.0                   # per-request timeout

    # Speaker diarization - identifies who is speaking within a track
    diarization_backend: str = "speechbrain"  # "null" | "pyannote" | "speechbrain"
    huggingface_token: str = ""        # required for pyannote backend (not speechbrain)
    # Cosine similarity above which a re-diarization cluster is treated as the same
    # voice as an existing named Speaker and re-attached to it (preserving the name).
    # Higher = stricter (fewer wrong re-attaches, more speakers re-minted for
    # re-confirmation); lower = looser. See whisper_runner._attach_speakers.
    speaker_match_threshold: float = 0.75
    # SpeechBrain only: cosine DISTANCE below which two 1.5s audio windows are grouped
    # into the same within-recording speaker cluster (lower = more, smaller clusters =
    # more speakers; higher = fewer). Short-window ECAPA embeddings are noisier than the
    # averaged centroids used for matching, so this is deliberately looser (a distance)
    # than speaker_match_threshold (a similarity). After clustering, fragments of one
    # voice are re-merged by a consolidation pass keyed on speaker_match_threshold.
    speaker_cluster_threshold: float = 0.55

    scorer_energy_enabled: bool = True
    scorer_scenes_enabled: bool = True
    scorer_llm_enabled: bool = True
    scorer_laugh_enabled: bool = True
    # Lexicon scoring (plan non-llm-tiers/03) - curated funny/dramatic/action keyword
    # density, zero-dep. Feeds the standard dimensions so content presets tune it via
    # score_*_weight; None for a dimension with no markers.
    scorer_lexicon_enabled: bool = True
    # Additional lightweight signals (plan non-llm-tiers/04), all feeding the standard
    # dimensions so content presets tune them via score_*_weight:
    #   speech_rate - words-per-sec bursts → funny/action (zero-dep transcript timings)
    #   churn       - rapid speaker turn-taking + cross-talk → funny/action (needs
    #                 diarization; abstains when off)
    #   prosody     - loudness + pitch delivery dynamics → dramatic/action (PyAV+numpy)
    scorer_speech_rate_enabled: bool = True
    scorer_churn_enabled: bool = True
    scorer_prosody_enabled: bool = True
    # Audio-event detection (plan non-llm-tiers/05, promoted to default by the
    # packaging-strategy overhaul) - reuses the AudioSet AST model
    # (scorer_laugh_model_id, transformers+torch, both bundled) to detect action
    # sounds → action and crowd/cheer → funny. The AST model itself is a Tier-B
    # auto-fetched download; degrades gracefully (skip) if it isn't present yet.
    scorer_audio_event_enabled: bool = True
    # "transcript" - regex patterns in Whisper output, no extra deps (default)
    # "audio"      - spectral rhythm analysis via PyAV + numpy
    # "model"      - HuggingFace audio-classification (requires transformers+torch)
    scorer_laugh_mode: str = "transcript"
    # HuggingFace model ID or local path for mode="model".
    # Recommended: MIT/ast-finetuned-audioset-10-10-0.4593 (AudioSet, ~350 MB)
    # Install deps first: pip install transformers torch torchaudio soundfile
    scorer_laugh_model_id: str = "MIT/ast-finetuned-audioset-10-10-0.4593"

    # Similarity engine backend (plan non-llm-tiers/01) - powers "Find related clips"
    # and "Meaning" hot-words without requiring an LLM:
    #   "tfidf"      - pure-Python keyword cosine, zero extra deps (fallback)
    #   "embeddings" - local paraphrase matching via fastembed + bge-small (default;
    #                  fastembed is bundled, bge-small is a Tier-B auto-fetched model)
    #   "llm"        - the language-model path (find_related_clips / scan_hotwords_semantic)
    # Unknown/unavailable values fall back to "tfidf" at make_backend time.
    similarity_backend: str = "embeddings"

    # Scene detection mode: "transcript" | "fast" | "full"
    # transcript = silence gaps only (instant, no extra deps)
    # fast       = keyframes + transcript gaps (seconds, recommended default)
    # full       = ContentDetector on every frame (most accurate, slow on long VODs)
    scene_detection_mode: str = "fast"
    # Minimum silence gap in seconds to register as a transcript-mode scene boundary
    scene_transcript_gap_s: float = 3.0

    # Audio energy analysis mode: "none" | "fast" | "full" (pre-fills the Analyze panel)
    energy_mode: str = "fast"

    scorer_energy_weight: float = 1.0
    scorer_scene_weight: float = 0.5
    scorer_llm_weight: float = 2.0
    scorer_laugh_weight: float = 1.5
    scorer_lexicon_weight: float = 1.0
    scorer_speech_rate_weight: float = 0.5
    scorer_churn_weight: float = 0.5
    scorer_prosody_weight: float = 0.5
    scorer_audio_event_weight: float = 1.0

    score_funny_weight: float = 1.0
    score_dramatic_weight: float = 1.0
    score_action_weight: float = 1.0

    # Content-type preset (plan 12) - records the last-applied preset id. Applying
    # a preset copies its dimension weights + laugh weight into the fields above;
    # this field only records which one, so scoring/summary/timeline prompts can read
    # its flavor paragraph live (see scoring/llm.py). "generic" == today's behavior.
    content_preset: str = "generic"

    ui_timeline_interval_seconds: int = 900
    ui_timeline_interval_unit: str = "minutes"

    # Export filename stem template. Placeholders: {video} source recording stem,
    # {clip_id}, {start}/{end} (h-mm-ss), {score} (1 decimal, "no-score" when
    # unscored), {date} (export date, YYYY-MM-DD), {preset} (Export preset id).
    # See config.validate_export_name_template.
    export_name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE

    # Creator-defined Export presets (raw dicts matching export_presets.ExportPreset's
    # fields) - a user preference, not project data, so this lives in global config
    # even though most other settings here can be overridden per-project. Built-in
    # presets (youtube-1080p, discord-10mb) are not stored here; see export/presets.py.
    export_presets: list[dict] = field(default_factory=list)

    # Title card customization (Settings -> Export). Applies to both the reel's
    # per-clip title cards and a clip export's prepended title card (--title-card).
    # Colors are strict #RRGGBB (validate_hex_color); scale multiplies the existing
    # per-line font sizes (36/24 for clip exports, 52/36/28 for reels) so one knob
    # scales both contexts instead of exposing raw pixel fields.
    title_card_bg_color: str = "#000000"
    title_card_font_color: str = "#ffffff"
    title_card_scale: float = 1.0
    title_card_template: str = "{description}\n{start} · {duration}"
    title_card_duration_s: float = 3.0

    # Burned-in caption styling (Settings -> Export + per-export override). Empty
    # font name / zero size / "bottom" position all mean "libass default" and emit
    # no force_style. Applies to baked-in captions only - sidecar and embedded
    # tracks are styled by the player. See analyze/extract.CaptionStyle.
    caption_font_name: str = ""
    caption_font_size: int = 0
    caption_position: str = "bottom"

    # Pre-import estimate total (hours) above which the Analyze panel shows a
    # long-run warning suggesting the recording be split or analyzed in smaller batches.
    analyze_warn_hours: float = 2.0

    # GPU thermal monitoring (Settings -> Hardware). Silently inert when no NVIDIA
    # GPU is detected (yuu_clip/analyze/thermal.py). thermal_warn_c must stay below
    # thermal_pause_c - enforced in web/routes/config.py on save.
    thermal_warn_c: int = 85
    thermal_pause_c: int = 90
    thermal_autopause_enabled: bool = True

    @classmethod
    def load(cls, project_dir: Path) -> "Config":
        """Load config, merging global defaults with project overrides."""
        merged: dict = {}

        global_cfg = _global_config_dir() / "config.json"
        if global_cfg.exists():
            merged.update(json.loads(global_cfg.read_text(encoding="utf-8")))
            _log.debug("Loaded global config from %s", global_cfg)

        project_cfg = project_dir / ".yuu-clip" / "config.json"
        if project_cfg.exists():
            merged.update(json.loads(project_cfg.read_text(encoding="utf-8")))
            _log.debug("Loaded project config from %s", project_cfg)

        _sanitize_title_card_fields(merged)
        _sanitize_caption_style_fields(merged)
        _sanitize_vision_fields(merged)
        _sanitize_content_preset_field(merged)

        known = {f for f in cls.__dataclass_fields__}
        unknown = set(merged) - known
        if unknown:
            _log.warning("Config: unrecognised keys ignored: %s", sorted(unknown))
        return cls(**{k: v for k, v in merged.items() if k in known})

    def save_project(self, project_dir: Path) -> None:
        cfg_path = project_dir / ".yuu-clip" / "config.json"
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
    d = project_dir / ".yuu-clip" / "audio"
    d.mkdir(parents=True, exist_ok=True)
    return d


def project_exports_dir(project_dir: Path) -> Path:
    d = project_dir / ".yuu-clip" / "exports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def project_proxies_dir(project_dir: Path) -> Path:
    d = project_dir / ".yuu-clip" / "proxies"
    d.mkdir(parents=True, exist_ok=True)
    return d


def project_downloads_dir(project_dir: Path) -> Path:
    """Where Import from URL saves downloaded Twitch VOD / YouTube files."""
    d = project_dir / ".yuu-clip" / "downloads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def project_db_path(project_dir: Path) -> Path:
    d = project_dir / ".yuu-clip"
    d.mkdir(parents=True, exist_ok=True)
    return d / "project.db"


def models_dir() -> Path:
    """Directory for one-click local model (.gguf) downloads.

    Matches the Electron wizard's MODELS_DIR (electron/constants.js:
    %LOCALAPPDATA%/yuu-clip/models) so an in-app download and a wizard download
    share one location and never fetch the same weights twice.
    """
    d = Path(user_data_dir(APP_NAME)) / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def find_ffmpeg() -> tuple[str, str]:
    """
    Return (ffmpeg_exe, ffprobe_exe) paths.

    Packaged (Electron) builds set YUU_CLIP_FFMPEG_DIR to the bundled GPL FFmpeg
    directory (see docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md) and always use it - a
    packaging bug that leaves it unset or pointing at an incomplete directory must
    surface immediately, not silently fall through to whatever happens to be on
    PATH. When unset (dev mode, non-Windows contributors), falls back to PATH via
    shutil.which() as before.
    """
    bundled_dir = os.environ.get("YUU_CLIP_FFMPEG_DIR")
    if bundled_dir:
        ffmpeg = os.path.join(bundled_dir, "ffmpeg.exe")
        ffprobe = os.path.join(bundled_dir, "ffprobe.exe")
        missing = [name for name, path in (("ffmpeg.exe", ffmpeg), ("ffprobe.exe", ffprobe)) if not os.path.isfile(path)]
        if missing:
            raise RuntimeError(
                f"YUU_CLIP_FFMPEG_DIR is set to {bundled_dir!r} but missing: {', '.join(missing)}\n\n"
                "This indicates a broken packaged install, not a missing user dependency - "
                "reinstalling yuu-clip should fix it."
            )
        return ffmpeg, ffprobe

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


def run_ffmpeg(args: list[str], timeout: Optional[float] = None) -> subprocess.CompletedProcess:
    """Run an ffmpeg/ffprobe command with actionable failures.

    args[0] must be "ffmpeg" or "ffprobe"; it is replaced with the resolved binary
    from find_ffmpeg() so a missing install raises the friendly install-instructions
    error instead of a bare FileNotFoundError. stderr is captured and, on a non-zero
    exit, surfaced in the raised RuntimeError - callers (and the user) get the reason
    rather than an opaque "returned non-zero exit status 1".
    """
    ffmpeg, ffprobe = find_ffmpeg()
    tool = args[0]
    exe = ffprobe if tool == "ffprobe" else ffmpeg
    result = subprocess.run([exe, *args[1:]], capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"{tool} failed (exit {result.returncode}):\n{result.stderr.strip()}")
    return result
