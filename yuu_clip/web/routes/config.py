"""Config get/patch routes — GET /api/config, PATCH /api/config."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)


class ConfigPatch(BaseModel):
    # UI
    ui_timeline_interval_seconds: Optional[int]   = None
    ui_timeline_interval_unit:    Optional[str]   = None
    # Whisper
    whisper_model:                Optional[str]   = None
    whisper_device:               Optional[str]   = None
    whisper_compute_type:         Optional[str]   = None
    whisper_language:             Optional[str]   = None
    # LLM backend
    llm_backend:                  Optional[str]   = None
    llm_model_path:               Optional[str]   = None
    # Ollama (local)
    ollama_host:                  Optional[str]   = None
    ollama_model:                 Optional[str]   = None
    ollama_timeout_s:             Optional[float] = None
    ollama_enabled:               Optional[bool]  = None
    # Claude API (remote — billed per token)
    claude_api_key:               Optional[str]   = None
    claude_model:                 Optional[str]   = None
    claude_timeout_s:             Optional[float] = None
    # Scoring weights
    scorer_energy_weight:         Optional[float] = None
    scorer_scene_weight:          Optional[float] = None
    scorer_llm_weight:            Optional[float] = None
    scorer_laugh_weight:          Optional[float] = None
    scorer_laugh_mode:            Optional[str]   = None
    scorer_laugh_model_id:        Optional[str]   = None
    score_funny_weight:           Optional[float] = None
    score_dramatic_weight:        Optional[float] = None
    score_action_weight:          Optional[float] = None
    # Analysis defaults
    scene_detection_mode:         Optional[str]   = None
    energy_mode:                  Optional[str]   = None
    silence_threshold_ms:         Optional[int]   = None
    min_clip_ms:                  Optional[int]   = None
    # Speaker labels
    diarization_backend:          Optional[str]   = None
    huggingface_token:            Optional[str]   = None
    speaker_match_threshold:      Optional[float] = None


_CONFIG_FIELDS = (
    "ui_timeline_interval_seconds", "ui_timeline_interval_unit",
    "whisper_model", "whisper_device", "whisper_compute_type", "whisper_language",
    "llm_backend", "llm_model_path",
    "ollama_host", "ollama_model", "ollama_timeout_s", "ollama_enabled",
    "claude_api_key", "claude_model", "claude_timeout_s",
    "scorer_energy_weight", "scorer_scene_weight", "scorer_llm_weight",
    "scorer_laugh_weight", "scorer_laugh_mode", "scorer_laugh_model_id",
    "score_funny_weight", "score_dramatic_weight", "score_action_weight",
    "scene_detection_mode", "energy_mode", "silence_threshold_ms", "min_clip_ms",
    "diarization_backend", "huggingface_token", "speaker_match_threshold",
)


def _enum_validator(allowed: set, label: str):
    def _v(v):
        if v not in allowed:
            raise HTTPException(400, f"{label} must be one of: {sorted(allowed)}")
        return v
    return _v


def _min_validator(minimum, label: str):
    def _v(v):
        if v < minimum:
            raise HTTPException(400, f"{label} must be >= {minimum}")
        return v
    return _v


def _range_validator(minimum, maximum, label: str):
    def _v(v):
        if v < minimum or v > maximum:
            raise HTTPException(400, f"{label} must be between {minimum} and {maximum}")
        return v
    return _v


def _whisper_model_validator(v: str) -> str:
    from yuu_clip.config import validate_whisper_model
    try:
        validate_whisper_model(v)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return v


def _whisper_language_validator(v: str) -> str:
    from yuu_clip.config import validate_whisper_language
    try:
        # None means auto-detect; the config field stores that as "".
        return validate_whisper_language(v) or ""
    except ValueError as e:
        raise HTTPException(400, str(e))


_CONFIG_PATCH_RULES: list[tuple[str, object]] = [
    ("ui_timeline_interval_seconds", _min_validator(10,   "interval")),
    ("ui_timeline_interval_unit",    _enum_validator({"seconds", "minutes"}, "unit")),
    ("whisper_model",                _whisper_model_validator),
    ("whisper_device",               _enum_validator({"cpu", "cuda", "auto"}, "whisper_device")),
    ("whisper_compute_type",         _enum_validator({"int8", "float16", "float32", "int8_float16"}, "whisper_compute_type")),
    ("whisper_language",             _whisper_language_validator),
    ("llm_backend",                  _enum_validator({"llamacpp", "ollama", "claude"}, "llm_backend")),
    ("llm_model_path",               lambda v: v),
    ("ollama_host",                  lambda v: v.strip()),
    ("ollama_model",                 lambda v: v.strip()),
    ("ollama_timeout_s",             _min_validator(1,    "ollama_timeout_s")),
    ("ollama_enabled",               lambda v: v),
    ("claude_api_key",               lambda v: v.strip()),
    ("claude_model",                 lambda v: v.strip()),
    ("claude_timeout_s",             _min_validator(1, "claude_timeout_s")),
    ("scorer_energy_weight",         lambda v: max(0.0, v)),
    ("scorer_scene_weight",          lambda v: max(0.0, v)),
    ("scorer_llm_weight",            lambda v: max(0.0, v)),
    ("scorer_laugh_weight",          lambda v: max(0.0, v)),
    ("scorer_laugh_mode",            _enum_validator({"transcript", "audio", "model"}, "scorer_laugh_mode")),
    ("scorer_laugh_model_id",        lambda v: v.strip()),
    ("score_funny_weight",           lambda v: max(0.0, v)),
    ("score_dramatic_weight",        lambda v: max(0.0, v)),
    ("score_action_weight",          lambda v: max(0.0, v)),
    ("scene_detection_mode",         _enum_validator({"transcript", "fast", "full"}, "scene_detection_mode")),
    ("energy_mode",                  _enum_validator({"none", "fast", "full"}, "energy_mode")),
    ("silence_threshold_ms",         _min_validator(500,  "silence_threshold_ms")),
    ("min_clip_ms",                  _min_validator(1000, "min_clip_ms")),
    ("diarization_backend",          _enum_validator({"null", "pyannote"}, "diarization_backend")),
    ("huggingface_token",            lambda v: v.strip()),
    ("speaker_match_threshold",      _range_validator(0.0, 1.0, "speaker_match_threshold")),
]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/config")
    def get_config():
        c = ctx.config
        return {k: getattr(c, k) for k in _CONFIG_FIELDS}

    @router.get("/api/config/whisper-languages")
    def whisper_languages():
        from yuu_clip.config import ALLOWED_WHISPER_LANGUAGES
        return {"languages": sorted(ALLOWED_WHISPER_LANGUAGES)}

    @router.patch("/api/config")
    def patch_config(body: ConfigPatch):
        cfg = ctx.config
        for field_name, transform in _CONFIG_PATCH_RULES:
            val = getattr(body, field_name)
            if val is not None:
                setattr(cfg, field_name, transform(val))
        cfg.save_project(ctx.project_dir)
        _REDACT = {"claude_api_key", "huggingface_token"}
        _log.info("Config updated: %s", {
            k: ("***" if k in _REDACT else v)
            for k, v in body.model_dump().items() if v is not None
        })
        return get_config()

    return router
