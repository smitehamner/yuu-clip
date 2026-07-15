# Feature-map - Model readiness + Recommended models (code: model_catalog, capabilities/tiers)
#   UI: static/settings.js (Settings → LLM scoring readiness + catalog) · setup wizard
#   Siblings: model_catalog.py · scoring/llm_client.py · tests/integration/test_llm.py, tests/ui/test_ui_model_catalog.py
"""LLM capability + model-catalog routes.

GET /api/llm/capabilities - what the active backend/model can do right now
    ({backend, model, text, vision, detail}). A cheap static check only: local
    model-file existence for the llamacpp backend. No inference test-call.
    UI features gate on this (a control that needs vision links here rather than
    silently disabling itself).

GET /api/llm/catalog - the curated recommended-model catalog, so Settings and
    the setup wizard render the same vetted list from one source of truth.
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException

from yuu_clip import model_catalog
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import module_findable, register_model_download
from yuu_clip.web.sse import subprocess_sse

# Logical keys for background downloads in ctx.model_downloads (the shared
# "a required model is downloading" registry the download banners and the
# analyze coordination both read). Stage 4 = the local LLM; Stage 6 = the speech
# model (whisper) and the speaker-labeling model (registered by routes/models.py's
# prefetch under this same slug, so download-status can surface it here).
_LLM_DOWNLOAD_KEY = "llm"
_WHISPER_DOWNLOAD_KEY = "whisper"
_SPEAKER_DOWNLOAD_KEY = "speaker"


# Headroom beyond the model's own on-disk size - a .gguf download writes to a
# .part temp file, so it needs more free space than the final weight size.
_PULL_DISK_HEADROOM_GB = 2.0

# Only these catalog ids may be downloaded as a local .gguf - the id becomes a
# subprocess argument, so an allowlist keeps a stray query param from driving the
# download. Recommended, monetization-safe, local models (text or vision) with a
# pinned quant filename; a vision entry also fetches its mmproj projector.
_DOWNLOADABLE_GGUF_IDS = frozenset(
    entry.id
    for entry in model_catalog.recommended_models()
    if entry.gguf_filename
    and model_catalog.BACKEND_LLAMACPP in entry.backends
)


def _existing_ancestor(path: Path) -> Path:
    """Nearest existing ancestor of *path* - disk_usage needs a real path, and
    the models dir may not exist yet before the first pull."""
    for candidate in (path, *path.parents):
        if candidate.exists():
            return candidate
    return Path(path.anchor) if path.anchor else Path.cwd()


def _preflight_gguf_download(entry) -> dict:
    """Free vs needed space for downloading *entry*'s .gguf. Non-raising."""
    from yuu_clip.config import models_dir

    size_gb = float(entry.size_gb) if entry.size_gb else 0.0
    needed_gb = round(size_gb + _PULL_DISK_HEADROOM_GB, 1)
    target = _existing_ancestor(models_dir())
    free_gb = round(shutil.disk_usage(target).free / 1e9, 1)
    return {
        "sufficient": free_gb >= needed_gb,
        "free_gb": free_gb,
        "needed_gb": needed_gb,
        "target": str(target),
    }


# Approximate on-disk sizes (GB) of the allowed whisper models, for the prefetch
# disk precheck. Values match the setup wizard's model-picker size labels.
_WHISPER_SIZE_GB: dict[str, float] = {
    "tiny": 0.075, "tiny.en": 0.075,
    "base": 0.145, "base.en": 0.145,
    "small": 0.465, "small.en": 0.465, "distil-small.en": 0.35,
    "medium": 1.5, "medium.en": 1.5, "distil-medium.en": 0.8,
    "large-v1": 3.0, "large-v2": 3.0, "large-v3": 3.0,
    "distil-large-v2": 1.5, "distil-large-v3": 1.5,
}
# Whisper models are downloaded file-by-file into the HF cache, so the slack a
# .part temp file needs for a .gguf does not apply - a small buffer is enough.
_WHISPER_DISK_HEADROOM_GB = 0.5


def _hf_cache_root() -> Path:
    """Nearest existing ancestor of the HuggingFace hub cache, for the free-space
    measurement. Falls back to the user home before the cache dir first exists."""
    override = os.environ.get("HF_HOME")
    root = Path(override) / "hub" if override else Path.home() / ".cache" / "huggingface" / "hub"
    return _existing_ancestor(root)


def _preflight_whisper_prefetch(model: str) -> dict:
    """Free vs needed space for prefetching the *model* whisper weights. Non-raising."""
    size_gb = _WHISPER_SIZE_GB.get(model, 3.0)
    needed_gb = round(size_gb + _WHISPER_DISK_HEADROOM_GB, 1)
    target = _hf_cache_root()
    free_gb = round(shutil.disk_usage(target).free / 1e9, 1)
    return {
        "sufficient": free_gb >= needed_gb,
        "free_gb": free_gb,
        "needed_gb": needed_gb,
        "target": str(target),
    }


def _llamacpp_capabilities(cfg, backend: str) -> dict:
    """Readiness of the local llamacpp backend, whose text and vision models are set
    independently (llm_model_path vs llm_vision_model_path + llm_mmproj_path)."""
    model_path = cfg.llm_model_path
    text_ok = bool(model_path) and Path(model_path).exists()
    vision_model_path = cfg.llm_vision_model_path
    mmproj = cfg.llm_mmproj_path
    vision_model_ok = bool(vision_model_path) and Path(vision_model_path).exists()
    mmproj_ok = bool(mmproj) and Path(mmproj).exists()
    vision_ok = vision_model_ok and mmproj_ok
    # Detail strings render in Settings and clip descriptions, so they must never
    # contain an absolute model path - it would leak the user's home dir into any
    # screenshot (and read as broken). Describe the state, not the path.
    if not model_path and not vision_model_path:
        detail = "No model file set - choose a .gguf under Settings → LLM scoring."
    elif not text_ok and model_path:
        detail = "The set-up model file is missing - re-download it under Settings → LLM scoring."
    elif vision_ok:
        detail = "Text and vision models are set - image analysis is available."
    elif not vision_model_path and not mmproj:
        detail = (
            "Text scoring is ready; set a vision model to enable image analysis."
            if text_ok else
            "No model file set - choose a .gguf under Settings → LLM scoring."
        )
    elif not vision_model_ok:
        detail = "The set-up vision model file is missing - re-download it under Settings → LLM scoring." if vision_model_path else \
            "Vision projector is set but the vision model is missing - set a vision model under Settings → LLM scoring."
    else:
        detail = "The set-up vision projector file is missing - re-download it under Settings → LLM scoring."
    return {
        "backend": backend, "model": model_path or None,
        "text": text_ok, "vision": vision_ok, "detail": detail,
    }


def _capabilities(cfg) -> dict:
    from yuu_clip.config import resolve_ai_permissions

    backend = cfg.llm_backend
    if not cfg.llm_enabled:
        return {
            "backend": backend, "model": None, "text": False, "vision": False,
            "detail": "LLM scoring is turned off in Settings.",
        }
    permissions = resolve_ai_permissions(cfg)
    if not permissions.allow_llm:
        return {
            "backend": backend, "model": None, "text": False, "vision": False,
            "detail": "Generative AI is turned off - change it under Settings → AI privacy.",
        }
    return _llamacpp_capabilities(cfg, backend)


# ── Capabilities overview (non-LLM upgrade tiers) ────────────────────────────
# A read-only map of the tiered "lightweight-by-default" design (Stage 06). Each
# tier sources its active state + install guidance from the same availability()
# functions the features use, so the panel can never drift from reality. Static
# checks only, mirroring _capabilities - no live backend probe.

_SIMILARITY_LABELS = {
    "tfidf": "Fast (keyword)",
    "embeddings": "Smart (embeddings)",
    "llm": "LLM",
}


def _sentence(reason: str) -> str:
    """Capitalise a lower-case availability() reason for display as a sentence."""
    return reason[:1].upper() + reason[1:] if reason else ""


def _similarity_tier(cfg, text_ok: bool) -> dict:
    from yuu_clip.scoring.similarity import EmbeddingsBackend, embeddings_model_cached

    embed_ok, embed_reason = EmbeddingsBackend(cfg).availability()
    model_ready = embed_ok and embeddings_model_cached()
    configured = (getattr(cfg, "similarity_backend", "tfidf") or "tfidf").strip()
    if configured == "embeddings" and embed_ok:
        active = "embeddings"
    elif configured == "llm" and text_ok:
        active = "llm"
    else:
        active = "tfidf"
    if not embed_ok:
        detail = _sentence(embed_reason)
    elif model_ready:
        detail = "The Smart (embeddings) engine is ready."
    else:
        detail = (
            "The embeddings model (~130 MB) downloads automatically the first "
            "time you use Find related clips or a Meaning hot-word."
        )
    return {
        "id": "similarity",
        "name": "Similarity engine",
        "purpose": 'Powers Find related clips and "Meaning" hot-words.',
        "active": _SIMILARITY_LABELS.get(active, active),
        "upgrade": "Smart (embeddings) adds paraphrase-aware matching with a small on-device model, bundled by default.",
        "ready": model_ready,
        "detail": detail,
        # fastembed is bundled (Tier A) - nothing to install from here anymore.
        "install_slug": None,
        "prefetch_slug": "embeddings" if embed_ok and not model_ready else None,
        "section": "settings-sec-llm",
    }


def _descriptions_tier(text_ok: bool, detail: str) -> dict:
    return {
        "id": "descriptions",
        "name": "Descriptions & summaries",
        "purpose": "Clip descriptions, session summaries, and the session timeline.",
        "active": "AI (language model)" if text_ok else "Basic (template)",
        "upgrade": "A local language model writes richer descriptions and unlocks summaries and the timeline.",
        "ready": text_ok,
        "detail": detail,
        "install_slug": None,
        # The local .gguf model has its own download flow (the recommended-models
        # catalog's one-click download / download-page link) - not this button.
        "prefetch_slug": None,
        "section": "settings-sec-llm",
    }


def _speaker_labels_tier(cfg) -> dict:
    from yuu_clip.transcribe.diarization_client import speechbrain_model_cached

    backend = (getattr(cfg, "diarization_backend", "speechbrain") or "speechbrain").strip()
    purpose = "Identifies who is speaking and prefixes transcripts accordingly."
    if backend == "null":
        return {
            "id": "speaker_labels", "name": "Speaker labels", "purpose": purpose,
            "active": "Off",
            "upgrade": "Turn on Speaker labels below to identify who is speaking in transcripts.",
            "ready": True, "detail": "Speaker labels are turned off.",
            "install_slug": None, "prefetch_slug": None, "section": "settings-sec-speakers",
        }
    # speechbrain (default) - bundled package; the ECAPA model is Tier B.
    model_ready = speechbrain_model_cached()
    return {
        "id": "speaker_labels", "name": "Speaker labels", "purpose": purpose,
        "active": "SpeechBrain",
        "upgrade": "Bundled by default - no HuggingFace account or token needed.",
        "ready": model_ready,
        "detail": (
            "Ready." if model_ready else
            "The ECAPA speaker model (~80 MB) downloads automatically the first "
            "time you run Detect Speakers."
        ),
        "install_slug": None,
        "prefetch_slug": None if model_ready else "speaker",
        "section": "settings-sec-speakers",
    }


def _audio_events_tier(cfg) -> dict:
    from yuu_clip.scoring.audio_event import AudioEventScorer, audio_event_model_cached

    available, reason = AudioEventScorer(cfg).availability()
    model_ready = available and audio_event_model_cached(cfg.scorer_laugh_model_id)
    if not available:
        detail = _sentence(reason)
    elif model_ready:
        detail = "Audio-event detection is on and ready."
    else:
        detail = (
            "The audio-event model (~350 MB) downloads automatically the first "
            "time you analyze."
        )
    return {
        "id": "audio_events",
        "name": "Audio-event detection",
        "purpose": "Boosts Action on gunshots and explosions, Funny on crowd cheers.",
        "active": "On" if available else "Off",
        "upgrade": "Bundled and on by default - the audio model downloads automatically the first time you analyze.",
        "ready": model_ready,
        "detail": detail,
        # transformers/torch are bundled (Tier A) - nothing to install from here.
        "install_slug": None,
        "prefetch_slug": "audio_event" if available and not model_ready else None,
        "section": "settings-sec-weights",
    }


def _vertical_framing_tier() -> dict:
    from yuu_clip.analyze.framing import face_model_cached

    installed = module_findable("mediapipe")
    model_ready = installed and face_model_cached()
    if not installed:
        detail = "MediaPipe isn't available - this should be bundled with yuu-clip, so try reinstalling if this persists."
    elif model_ready:
        detail = "Ready."
    else:
        detail = (
            "The face-detector model (~230 KB) downloads automatically the first "
            "time you use Auto-frame on faces."
        )
    return {
        "id": "vertical_framing",
        "name": "Auto-frame on faces",
        "purpose": "Suggests where to place the Vertical framing crop on vertical exports by finding faces.",
        "active": "Available" if installed else "Unavailable",
        "upgrade": "Bundled by default - used only when you export with a vertical preset.",
        "ready": model_ready,
        "detail": detail,
        "install_slug": None,
        # The BlazeFace asset is ~230 KB - effectively instant, no progress UI needed.
        "prefetch_slug": None,
        "section": "settings-sec-export",
    }


# ── Recommended-model card state (Settings model manager, first-run-friction
# Stage 7) ───────────────────────────────────────────────────────────────────
# The catalog route enriches each entry with where its file would live, whether
# that file is already downloaded, and whether the active backend is pointed at
# it - so the UI can show an "Active"/"Downloaded" badge and a "Use this model"
# shortcut without the browser reverse-engineering it from a path string.


def _entry_dest_paths(entry, models_dir: Path) -> dict:
    """Absolute on-disk paths a one-click download would write for a llamacpp
    entry (weights, and the mmproj projector for a vision entry)."""
    if model_catalog.BACKEND_LLAMACPP not in entry.backends or not entry.gguf_filename:
        return {"gguf_path": None, "mmproj_path": None}
    gguf = models_dir / entry.gguf_filename
    mmproj = models_dir / entry.mmproj_filename if entry.mmproj_filename else None
    return {"gguf_path": str(gguf), "mmproj_path": str(mmproj) if mmproj else None}


def _entry_installed(entry, models_dir: Path) -> bool:
    """True when every file the llamacpp entry needs is present in the models dir."""
    if model_catalog.BACKEND_LLAMACPP not in entry.backends or not entry.gguf_filename:
        return False
    if not (models_dir / entry.gguf_filename).exists():
        return False
    if entry.mmproj_filename and not (models_dir / entry.mmproj_filename).exists():
        return False
    return True


def _entry_active(entry, cfg) -> bool:
    """True when the active backend is configured to use this entry - scoped to
    the current backend so a saved-but-inactive backend's models aren't flagged."""
    backend = cfg.llm_backend
    if backend == "llamacpp":
        # A llamacpp vision setup is defined by its projector (mmproj) - the base
        # model can be shared with, or differ from, the text scoring model. Match a
        # vision entry on the configured projector so it's flagged active even when
        # the text base differs (otherwise no vision model ever shows as active).
        if "vision" in entry.kinds and entry.mmproj_filename:
            mmproj_path = (cfg.llm_mmproj_path or "").strip()
            vision_model_path = (cfg.llm_vision_model_path or "").strip()
            return (
                bool(mmproj_path) and Path(mmproj_path).name == entry.mmproj_filename
                and bool(vision_model_path) and Path(vision_model_path).name == entry.gguf_filename
            )
        model_path = (cfg.llm_model_path or "").strip()
        if not model_path or not entry.gguf_filename:
            return False
        return Path(model_path).name == entry.gguf_filename
    return False


def _catalog_payload(cfg) -> dict:
    from yuu_clip.config import models_dir

    md = models_dir()
    free_gb = round(shutil.disk_usage(_existing_ancestor(md)).free / 1e9, 1)
    entries = []
    for entry in model_catalog.recommended_models():
        data = entry.to_dict()
        data.update(_entry_dest_paths(entry, md))
        data["installed"] = _entry_installed(entry, md)
        data["active"] = _entry_active(entry, cfg)
        entries.append(data)
    return {
        "backend": cfg.llm_backend,
        "models_dir": str(md),
        "free_gb": free_gb,
        "models": entries,
    }


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/llm/capabilities")
    def capabilities():
        return _capabilities(ctx.config)

    @router.get("/api/capabilities/tiers")
    def capability_tiers():
        cfg = ctx.config
        llm = _capabilities(cfg)
        text_ok = bool(llm["text"])
        return {
            "lightweight": not text_ok,
            "tiers": [
                _similarity_tier(cfg, text_ok),
                _descriptions_tier(text_ok, llm["detail"]),
                _speaker_labels_tier(cfg),
                _audio_events_tier(cfg),
                _vertical_framing_tier(),
            ],
        }

    @router.get("/api/llm/catalog")
    def catalog():
        return _catalog_payload(ctx.config)

    @router.post("/api/llm/gguf/download")
    async def gguf_download(model_id: str):
        entry = model_catalog.model_by_id(model_id)
        if model_id not in _DOWNLOADABLE_GGUF_IDS or entry is None:
            raise HTTPException(
                400,
                f"Unknown model id '{model_id}' - allowed: {sorted(_DOWNLOADABLE_GGUF_IDS)}",
            )
        # Reject a duplicate before the disk precheck - a second trigger (another
        # tab, a double boot) must never spawn a second download into the same file.
        if _LLM_DOWNLOAD_KEY in ctx.model_downloads:
            raise HTTPException(409, "A local model download is already in progress.")
        disk = _preflight_gguf_download(entry)
        if not disk["sufficient"]:
            raise HTTPException(
                507,
                f"Not enough disk space: about {disk['needed_gb']} GB is needed on "
                f"{disk['target']} but only {disk['free_gb']} GB is free. "
                "Free up space and try again.",
            )
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "download-gguf",
            "--model-id", model_id, "--project", str(ctx.project_dir),
        ]
        ctx.model_downloads[_LLM_DOWNLOAD_KEY] = model_id
        try:
            response = await subprocess_sse(cmd, ctx.project_dir)
        except Exception:
            ctx.model_downloads.pop(_LLM_DOWNLOAD_KEY, None)
            raise
        return register_model_download(response, ctx, _LLM_DOWNLOAD_KEY)

    @router.post("/api/whisper/prefetch")
    async def whisper_prefetch():
        from yuu_clip.transcribe.transcriber import make_transcriber

        if make_transcriber(ctx.config).model_cached():
            return {"status": "already-cached"}
        # Reject a duplicate before spawning - a second trigger (another tab, a
        # second boot) must never launch a second download into the shared HF
        # cache while one is already running.
        if _WHISPER_DOWNLOAD_KEY in ctx.model_downloads:
            raise HTTPException(409, "The speech model is already downloading.")
        disk = _preflight_whisper_prefetch(ctx.config.whisper_model)
        if not disk["sufficient"]:
            raise HTTPException(
                507,
                f"Not enough disk space: about {disk['needed_gb']} GB is needed on "
                f"{disk['target']} but only {disk['free_gb']} GB is free. "
                "Free up space and try again.",
            )
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "prefetch-whisper",
            "--project", str(ctx.project_dir),
        ]
        ctx.model_downloads[_WHISPER_DOWNLOAD_KEY] = ctx.config.whisper_model
        try:
            response = await subprocess_sse(cmd, ctx.project_dir)
        except Exception:
            ctx.model_downloads.pop(_WHISPER_DOWNLOAD_KEY, None)
            raise
        return register_model_download(response, ctx, _WHISPER_DOWNLOAD_KEY)

    @router.get("/api/llm/download-status")
    def download_status():
        # One read surface for every in-flight required-model download, so the
        # download banners (llm + speech + speaker) and the analyze-start
        # coordination read from the same place, not a second overlapping endpoint.
        from yuu_clip.transcribe.diarization_client import (
            make_diarization_client,
            speechbrain_model_cached,
        )
        from yuu_clip.transcribe.transcriber import make_transcriber

        # Only prefetch the speaker model when its backend can actually run (the
        # package is installed and speaker labels aren't turned off) - otherwise the
        # boot prefetch would kick off a download for a feature that can't use it.
        speaker_available = make_diarization_client(ctx.config).available()[0]
        return {
            "pending_model_id": ctx.config.pending_local_model or "",
            "downloading": _LLM_DOWNLOAD_KEY in ctx.model_downloads,
            "downloading_model_id": ctx.model_downloads.get(_LLM_DOWNLOAD_KEY),
            "whisper_downloading": _WHISPER_DOWNLOAD_KEY in ctx.model_downloads,
            "whisper_model_id": ctx.model_downloads.get(_WHISPER_DOWNLOAD_KEY),
            "whisper_cached": make_transcriber(ctx.config).model_cached(),
            "speaker_downloading": _SPEAKER_DOWNLOAD_KEY in ctx.model_downloads,
            "speaker_cached": speechbrain_model_cached(),
            "speaker_available": speaker_available,
            "model_prefetch_disabled": bool(ctx.config.model_prefetch_disabled),
        }

    @router.post("/api/llm/download-status/clear")
    def clear_download_status():
        # Reload first so a just-finished download's llm_model_path (written to
        # config.json by the subprocess) survives, then drop the pending flag.
        ctx.reload_config()
        ctx.config.pending_local_model = ""
        ctx.config.save_project(ctx.project_dir)
        return {
            "pending_model_id": "",
            "downloading": _LLM_DOWNLOAD_KEY in ctx.model_downloads,
        }

    return router
