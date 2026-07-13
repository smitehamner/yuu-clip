# Feature-map - Settings / configuration (code: Config)
#   UI: static/settings.js (whole Settings panel)
#   Siblings: config.py (load/save_project) · tests/integration/test_config.py, tests/ui/test_ui_settings.py
"""Config get/patch routes - GET /api/config, PATCH /api/config."""
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
    # AI privacy mode (plan non-llm-tiers/07) - none | local_only | remote_ok
    ai_privacy_mode:              Optional[str]   = None
    # LLM backend
    llm_backend:                  Optional[str]   = None
    llm_model_path:               Optional[str]   = None
    llm_mmproj_path:              Optional[str]   = None
    llm_vision_model_path:        Optional[str]   = None
    llm_use_gpu:                  Optional[bool]  = None
    # Image-based clip analysis (plan 11)
    vision_enabled:               Optional[bool]  = None
    vision_frames_per_clip:       Optional[int]   = None
    # Master switch for all generative-AI features.
    llm_enabled:               Optional[bool]  = None
    # Claude API (remote - billed per token)
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
    # Lightweight scorer weights + toggles (plans non-llm-tiers/03-05) and the similarity
    # engine (plan 01). Previously sent by settings.js but dropped here, so they never
    # persisted - wired through in Stage 07.
    scorer_lexicon_weight:        Optional[float] = None
    scorer_speech_rate_weight:    Optional[float] = None
    scorer_churn_weight:          Optional[float] = None
    scorer_prosody_weight:        Optional[float] = None
    scorer_audio_event_weight:    Optional[float] = None
    scorer_audio_event_enabled:   Optional[bool]  = None
    similarity_backend:           Optional[str]   = None
    score_funny_weight:           Optional[float] = None
    score_dramatic_weight:        Optional[float] = None
    score_action_weight:          Optional[float] = None
    score_visual_weight:          Optional[float] = None
    content_preset:               Optional[str]   = None
    # Analysis defaults
    scene_detection_mode:         Optional[str]   = None
    energy_mode:                  Optional[str]   = None
    silence_threshold_ms:         Optional[int]   = None
    min_clip_ms:                  Optional[int]   = None
    # Opt-in LLM scene generation (Clips-vs-Scenes Stage 3) - Settings-only toggle.
    scene_generation_enabled:     Optional[bool]  = None
    # Visual candidate generation (video-heavy analysis Stage 2)
    visual_candidate_mode:        Optional[str]   = None
    visual_dedup_overlap:         Optional[float] = None
    visual_candidate_cap:         Optional[int]   = None
    visual_peak_threshold:        Optional[float] = None
    # Speaker labels
    diarization_backend:          Optional[str]   = None
    huggingface_token:            Optional[str]   = None
    speaker_match_threshold:      Optional[float] = None
    speaker_cluster_threshold:    Optional[float] = None
    project_voice_match_threshold: Optional[float] = None
    # Export
    export_name_template:         Optional[str]   = None
    # Title card (Settings -> Export)
    title_card_bg_color:          Optional[str]   = None
    title_card_font_color:        Optional[str]   = None
    title_card_scale:             Optional[float] = None
    title_card_template:          Optional[str]   = None
    title_card_duration_s:        Optional[float] = None
    # Caption style (Settings -> Export) - burned-in captions only
    caption_font_name:            Optional[str]   = None
    caption_font_size:            Optional[int]   = None
    caption_position:             Optional[str]   = None
    caption_word_highlight:       Optional[bool]  = None
    caption_word_chunk_size:      Optional[int]   = None
    # Hardware - GPU thermal monitoring
    thermal_warn_c:                Optional[int]   = None
    thermal_pause_c:               Optional[int]   = None
    thermal_autopause_enabled:     Optional[bool]  = None


_CONFIG_FIELDS = (
    "ui_timeline_interval_seconds", "ui_timeline_interval_unit",
    "whisper_model", "whisper_device", "whisper_compute_type", "whisper_language",
    "model_prefetch_disabled",
    "ai_privacy_mode",
    "llm_backend", "llm_model_path", "llm_mmproj_path", "llm_vision_model_path", "llm_use_gpu",
    "vision_enabled", "vision_frames_per_clip", "llm_enabled",
    "claude_api_key", "claude_model", "claude_timeout_s",
    # Read-exposed but not patchable (a distribution gate, like model_prefetch_disabled):
    # get_config overrides this key with the EFFECTIVE value (field OR YUU_REMOTE_AI env).
    "remote_ai_enabled",
    "scorer_energy_weight", "scorer_scene_weight", "scorer_llm_weight",
    "scorer_laugh_weight", "scorer_laugh_mode", "scorer_laugh_model_id",
    "scorer_lexicon_weight", "scorer_speech_rate_weight", "scorer_churn_weight",
    "scorer_prosody_weight", "scorer_audio_event_weight", "scorer_audio_event_enabled",
    "similarity_backend",
    "score_funny_weight", "score_dramatic_weight", "score_action_weight",
    "score_visual_weight",
    "content_preset",
    "scene_detection_mode", "energy_mode", "silence_threshold_ms", "min_clip_ms",
    "scene_generation_enabled",
    "visual_candidate_mode", "visual_dedup_overlap", "visual_candidate_cap",
    "visual_peak_threshold",
    "diarization_backend", "huggingface_token", "speaker_match_threshold",
    "speaker_cluster_threshold", "project_voice_match_threshold",
    "export_name_template",
    "title_card_bg_color", "title_card_font_color", "title_card_scale",
    "title_card_template", "title_card_duration_s",
    "caption_font_name", "caption_font_size", "caption_position",
    "caption_word_highlight", "caption_word_chunk_size",
    "thermal_warn_c", "thermal_pause_c", "thermal_autopause_enabled",
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


def _export_name_template_validator(v: str) -> str:
    from yuu_clip.export.naming import validate_export_name_template
    try:
        return validate_export_name_template(v)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _content_preset_validator(v: str) -> str:
    from yuu_clip.content_presets import is_valid_preset_id
    if not is_valid_preset_id(v):
        raise HTTPException(400, f"Unknown content type '{v}'")
    return v


def _title_card_template_validator(v: str) -> str:
    from yuu_clip.config import validate_title_card_template
    try:
        return validate_title_card_template(v)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _caption_font_name_validator(v: str) -> str:
    from yuu_clip.config import validate_caption_font_name
    try:
        return validate_caption_font_name(v)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _caption_font_size_validator(v: int) -> int:
    from yuu_clip.config import validate_caption_font_size
    try:
        return validate_caption_font_size(v)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _caption_word_chunk_size_validator(v: int) -> int:
    from yuu_clip.config import validate_caption_word_chunk_size
    try:
        return validate_caption_word_chunk_size(v)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _hex_color_validator(label: str):
    from yuu_clip.config import validate_hex_color

    def _v(v: str) -> str:
        try:
            return validate_hex_color(v, label)
        except ValueError as e:
            raise HTTPException(400, str(e))
    return _v


_CONFIG_PATCH_RULES: list[tuple[str, object]] = [
    ("ui_timeline_interval_seconds", _min_validator(10,   "interval")),
    ("ui_timeline_interval_unit",    _enum_validator({"seconds", "minutes"}, "unit")),
    ("whisper_model",                _whisper_model_validator),
    ("whisper_device",               _enum_validator({"cpu", "cuda", "auto"}, "whisper_device")),
    ("whisper_compute_type",         _enum_validator({"int8", "float16", "float32", "int8_float16"}, "whisper_compute_type")),
    ("whisper_language",             _whisper_language_validator),
    ("ai_privacy_mode",              _enum_validator({"none", "local_only", "remote_ok"}, "ai_privacy_mode")),
    ("llm_backend",                  _enum_validator({"llamacpp", "claude"}, "llm_backend")),
    ("llm_model_path",               lambda v: v),
    ("llm_mmproj_path",              lambda v: v),
    ("llm_vision_model_path",        lambda v: v),
    ("llm_use_gpu",                  lambda v: v),
    ("vision_enabled",               lambda v: v),
    ("vision_frames_per_clip",       _range_validator(1, 10, "vision_frames_per_clip")),
    ("llm_enabled",               lambda v: v),
    ("claude_api_key",               lambda v: v.strip()),
    ("claude_model",                 lambda v: v.strip()),
    ("claude_timeout_s",             _min_validator(1, "claude_timeout_s")),
    ("scorer_energy_weight",         lambda v: max(0.0, v)),
    ("scorer_scene_weight",          lambda v: max(0.0, v)),
    ("scorer_llm_weight",            lambda v: max(0.0, v)),
    ("scorer_laugh_weight",          lambda v: max(0.0, v)),
    ("scorer_laugh_mode",            _enum_validator({"transcript", "audio", "model"}, "scorer_laugh_mode")),
    ("scorer_laugh_model_id",        lambda v: v.strip()),
    ("scorer_lexicon_weight",        lambda v: max(0.0, v)),
    ("scorer_speech_rate_weight",    lambda v: max(0.0, v)),
    ("scorer_churn_weight",          lambda v: max(0.0, v)),
    ("scorer_prosody_weight",        lambda v: max(0.0, v)),
    ("scorer_audio_event_weight",    lambda v: max(0.0, v)),
    ("scorer_audio_event_enabled",   lambda v: v),
    ("similarity_backend",           _enum_validator({"tfidf", "embeddings", "llm"}, "similarity_backend")),
    ("score_funny_weight",           lambda v: max(0.0, v)),
    ("score_dramatic_weight",        lambda v: max(0.0, v)),
    ("score_action_weight",          lambda v: max(0.0, v)),
    ("score_visual_weight",          lambda v: max(0.0, v)),
    ("content_preset",               _content_preset_validator),
    ("scene_detection_mode",         _enum_validator({"transcript", "fast", "full"}, "scene_detection_mode")),
    ("energy_mode",                  _enum_validator({"none", "fast", "full"}, "energy_mode")),
    ("silence_threshold_ms",         _min_validator(500,  "silence_threshold_ms")),
    ("min_clip_ms",                  _min_validator(1000, "min_clip_ms")),
    ("scene_generation_enabled",     lambda v: bool(v)),
    ("visual_candidate_mode",        _enum_validator({"off", "relax", "gaps", "parallel"}, "visual_candidate_mode")),
    ("visual_dedup_overlap",         _range_validator(0.0, 1.0, "visual_dedup_overlap")),
    ("visual_candidate_cap",         _min_validator(1, "visual_candidate_cap")),
    ("visual_peak_threshold",        _min_validator(0.0, "visual_peak_threshold")),
    ("diarization_backend",          _enum_validator({"null", "pyannote", "speechbrain"}, "diarization_backend")),
    ("huggingface_token",            lambda v: v.strip()),
    ("speaker_match_threshold",      _range_validator(0.0, 1.0, "speaker_match_threshold")),
    ("speaker_cluster_threshold",    _range_validator(0.0, 1.0, "speaker_cluster_threshold")),
    ("project_voice_match_threshold", _range_validator(0.0, 1.0, "project_voice_match_threshold")),
    ("export_name_template",         _export_name_template_validator),
    ("title_card_bg_color",          _hex_color_validator("title_card_bg_color")),
    ("title_card_font_color",        _hex_color_validator("title_card_font_color")),
    ("title_card_scale",             _range_validator(0.5, 2.0, "title_card_scale")),
    ("title_card_template",          _title_card_template_validator),
    ("title_card_duration_s",        _range_validator(1.0, 10.0, "title_card_duration_s")),
    ("caption_font_name",            _caption_font_name_validator),
    ("caption_font_size",            _caption_font_size_validator),
    ("caption_position",             _enum_validator({"bottom", "top"}, "caption_position")),
    ("caption_word_highlight",       lambda v: bool(v)),
    ("caption_word_chunk_size",      _caption_word_chunk_size_validator),
    ("thermal_warn_c",               _range_validator(40, 110, "thermal_warn_c")),
    ("thermal_pause_c",              _range_validator(40, 110, "thermal_pause_c")),
    ("thermal_autopause_enabled",    lambda v: v),
]


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/config")
    def get_config():
        from yuu_clip.config import remote_ai_allowed
        c = ctx.config
        payload = {k: getattr(c, k) for k in _CONFIG_FIELDS}
        # Override the raw field with the EFFECTIVE gate (config field OR YUU_REMOTE_AI
        # env) so the Settings UI hides the Claude backend + remote privacy mode when
        # off. It stays out of _CONFIG_PATCH_RULES - a distribution gate, never PATCH-able.
        payload["remote_ai_enabled"] = remote_ai_allowed(c)
        return payload

    @router.get("/api/config/defaults")
    def config_defaults():
        # Factory defaults from a fresh Config, so the Settings "Reset to
        # defaults" controls have one source of truth instead of duplicating
        # every default value in the frontend.
        from yuu_clip.config import Config, remote_ai_allowed
        defaults = Config()
        payload = {k: getattr(defaults, k) for k in _CONFIG_FIELDS}
        # Reset-to-defaults must not flip the gate the browser sees: report the same
        # effective value as GET /api/config, not the raw factory False.
        payload["remote_ai_enabled"] = remote_ai_allowed(defaults)
        return payload

    @router.get("/api/config/whisper-languages")
    def whisper_languages():
        from yuu_clip.config import ALLOWED_WHISPER_LANGUAGES
        return {"languages": sorted(ALLOWED_WHISPER_LANGUAGES)}

    @router.patch("/api/config")
    def patch_config(body: ConfigPatch):
        cfg = ctx.config
        # Transform first, apply after the cross-field check passes - a failed
        # validation must leave cfg (the live in-memory config) untouched, not
        # partially mutated with fields that were processed before the failure.
        transformed: dict[str, object] = {}
        for field_name, transform in _CONFIG_PATCH_RULES:
            val = getattr(body, field_name)
            if val is not None:
                transformed[field_name] = transform(val)
        new_warn_c = transformed.get("thermal_warn_c", cfg.thermal_warn_c)
        new_pause_c = transformed.get("thermal_pause_c", cfg.thermal_pause_c)
        if new_warn_c >= new_pause_c:
            raise HTTPException(400, "thermal_warn_c must be less than thermal_pause_c")
        for field_name, value in transformed.items():
            setattr(cfg, field_name, value)
        cfg.save_project(ctx.project_dir)
        _REDACT = {"claude_api_key", "huggingface_token"}
        _log.info("Config updated: %s", {
            k: ("***" if k in _REDACT else v)
            for k, v in body.model_dump().items() if v is not None
        })
        return get_config()

    return router
