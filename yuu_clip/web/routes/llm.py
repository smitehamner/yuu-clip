# Feature-map — Model readiness + Recommended models (code: model_catalog, capabilities/tiers)
#   UI: static/settings.js (Settings → LLM scoring readiness + catalog) · setup wizard
#   Siblings: model_catalog.py · scoring/llm_client.py · tests/test_llm.py, tests/test_ui_model_catalog.py
"""LLM capability + model-catalog routes.

GET /api/llm/capabilities — what the active backend/model can do right now
    ({backend, model, text, vision, detail}). A cheap static check only: file
    existence for llamacpp, model-name/tag presence for ollama, API-key presence
    for claude. No inference test-call. UI features gate on this (a control that
    needs vision links here rather than silently disabling itself).

GET /api/llm/catalog — the curated recommended-model catalog, so Settings and
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
from yuu_clip.web.routes.common import module_findable
from yuu_clip.web.sse import subprocess_sse

# Only tags from the curated catalog may be pulled — the tag becomes a
# subprocess argument, so an allowlist keeps a stray query param from running
# an arbitrary `ollama pull`.
_PULLABLE_OLLAMA_TAGS = frozenset(
    entry.ollama_tag
    for entry in model_catalog.recommended_models()
    if entry.ollama_tag and model_catalog.BACKEND_OLLAMA in entry.backends
)

# Logical key for the background local-LLM download in ctx.model_downloads (the
# shared "a required model is downloading" registry). Stage 6 adds "whisper".
_LLM_DOWNLOAD_KEY = "llm"


def _deregister_when_done(inner, ctx):
    """Wrap the download stream so the shared in-progress flag is cleared when the
    stream ends — on normal completion, on subprocess exit, or on client
    disconnect (StreamingResponse cancels the iterator, running the finally)."""

    async def _gen():
        try:
            async for chunk in inner:
                yield chunk
        finally:
            ctx.model_downloads.pop(_LLM_DOWNLOAD_KEY, None)

    return _gen()


# Headroom beyond the model's own on-disk size — Ollama writes temporary blobs
# and a manifest during a pull, so a pull needs more than the final weight size.
# The .gguf download reuses it (a .part temp file needs the same slack).
_PULL_DISK_HEADROOM_GB = 2.0

# Only these catalog ids may be downloaded as a local .gguf — the id becomes a
# subprocess argument, so an allowlist keeps a stray query param from driving the
# download. Recommended, monetization-safe, local text models with a pinned quant
# filename only (vision-only entries carry a gguf_url page but no gguf_filename).
_DOWNLOADABLE_GGUF_IDS = frozenset(
    entry.id
    for entry in model_catalog.recommended_models()
    if entry.gguf_filename
    and model_catalog.BACKEND_LLAMACPP in entry.backends
    and "text" in entry.kinds
)


def _ollama_models_dir() -> Path:
    """Where Ollama stores pulled models (its default, or an OLLAMA_MODELS
    override). The precheck measures free space on this location's drive."""
    override = os.environ.get("OLLAMA_MODELS")
    return Path(override) if override else Path.home() / ".ollama" / "models"


def _existing_ancestor(path: Path) -> Path:
    """Nearest existing ancestor of *path* — disk_usage needs a real path, and
    the models dir may not exist yet before the first pull."""
    for candidate in (path, *path.parents):
        if candidate.exists():
            return candidate
    return Path(path.anchor) if path.anchor else Path.cwd()


def _preflight_ollama_pull(tag: str) -> dict:
    """Free vs needed space for pulling *tag*. Non-raising — callers decide."""
    entry = next(
        (e for e in model_catalog.recommended_models() if e.ollama_tag == tag), None
    )
    size_gb = float(entry.size_gb) if entry and entry.size_gb else 0.0
    needed_gb = round(size_gb + _PULL_DISK_HEADROOM_GB, 1)
    target = _existing_ancestor(_ollama_models_dir())
    free_gb = round(shutil.disk_usage(target).free / 1e9, 1)
    return {
        "sufficient": free_gb >= needed_gb,
        "free_gb": free_gb,
        "needed_gb": needed_gb,
        "size_gb": size_gb,
        "target": str(target),
    }


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


def _ollama_tag_base(name: str) -> str:
    return name.split(":", 1)[0].strip().lower()


_OLLAMA_VISION_BASES = model_catalog.ollama_vision_tag_bases()


def _capabilities(cfg) -> dict:
    from yuu_clip.config import resolve_ai_permissions

    backend = cfg.llm_backend
    if not cfg.ollama_enabled:
        return {
            "backend": backend, "model": None, "text": False, "vision": False,
            "detail": "LLM scoring is turned off in Settings.",
        }
    permissions = resolve_ai_permissions(cfg)
    if not permissions.allow_llm:
        return {
            "backend": backend, "model": None, "text": False, "vision": False,
            "detail": "Generative AI is turned off — change it under Settings → AI privacy.",
        }
    if backend == "claude" and not permissions.allow_remote:
        return {
            "backend": backend, "model": cfg.claude_model or None, "text": False, "vision": False,
            "detail": (
                "The remote (Claude) backend is blocked by AI privacy mode — switch to a "
                "local model or allow remote models under Settings → AI privacy."
            ),
        }
    if backend == "claude":
        has_key = bool(cfg.claude_api_key)
        detail = (
            "Claude API key set — text and image analysis are available."
            if has_key else
            "No Claude API key set — add one under Settings → LLM scoring."
        )
        return {
            "backend": backend, "model": cfg.claude_model or None,
            "text": has_key, "vision": has_key, "detail": detail,
        }
    if backend == "llamacpp":
        model_path = cfg.llm_model_path
        text_ok = bool(model_path) and Path(model_path).exists()
        mmproj = cfg.llm_mmproj_path
        vision_ok = text_ok and bool(mmproj) and Path(mmproj).exists()
        if not model_path:
            detail = "No model file set — choose a .gguf under Settings → LLM scoring."
        elif not text_ok:
            detail = f"Model file not found: {model_path}"
        elif vision_ok:
            detail = "Model and vision projector are set — image analysis is available."
        elif mmproj:
            detail = f"Vision projector file not found: {mmproj}"
        else:
            detail = "Text scoring is ready; add a vision projector (.gguf) to enable image analysis."
        return {
            "backend": backend, "model": model_path or None,
            "text": text_ok, "vision": vision_ok, "detail": detail,
        }
    # ollama
    model = (cfg.ollama_model or "").strip()
    vision_model = (cfg.ollama_vision_model or "").strip() or model
    text_ok = bool(model)
    vision_ok = text_ok and _ollama_tag_base(vision_model) in _OLLAMA_VISION_BASES
    if not text_ok:
        detail = "No Ollama model set — choose one under Settings → LLM scoring."
    elif vision_ok:
        detail = "A vision-capable Ollama model is set — image analysis is available."
    else:
        detail = "Text scoring is ready; set a vision model to enable image analysis."
    return {
        "backend": backend, "model": model or None,
        "text": text_ok, "vision": vision_ok, "detail": detail,
    }


# ── Capabilities overview (non-LLM upgrade tiers) ────────────────────────────
# A read-only map of the tiered "lightweight-by-default" design (Stage 06). Each
# tier sources its active state + install guidance from the same availability()
# functions the features use, so the panel can never drift from reality. Static
# checks only, mirroring _capabilities — no live backend probe.

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
        # fastembed is bundled (Tier A) — nothing to install from here anymore.
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
        # The GGUF/Ollama model has its own download flow (the recommended-models
        # catalog's "Pull with Ollama" / download-page link) — not this button.
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
    if backend == "pyannote":
        installed = module_findable("pyannote.audio")
        has_token = bool(getattr(cfg, "huggingface_token", "") or "")
        ready = installed and has_token
        if not installed:
            detail = "Pyannote (advanced) isn't installed yet."
        elif not has_token:
            detail = "Pyannote is installed — add a HuggingFace token to finish setup."
        else:
            detail = "Pyannote is installed and ready."
        return {
            "id": "speaker_labels", "name": "Speaker labels", "purpose": purpose,
            "active": "Pyannote (advanced)",
            "upgrade": "SpeechBrain is the default, token-free backend — Pyannote is an advanced, optional alternative.",
            "ready": ready, "detail": detail,
            "install_slug": None if installed else "pyannote",
            "prefetch_slug": None,
            "section": "settings-sec-speakers",
        }
    # speechbrain (default) — bundled package; the ECAPA model is Tier B.
    model_ready = speechbrain_model_cached()
    return {
        "id": "speaker_labels", "name": "Speaker labels", "purpose": purpose,
        "active": "SpeechBrain",
        "upgrade": "Bundled by default — no HuggingFace account or token needed.",
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
        "upgrade": "Bundled and on by default — the audio model downloads automatically the first time you analyze.",
        "ready": model_ready,
        "detail": detail,
        # transformers/torch are bundled (Tier A) — nothing to install from here.
        "install_slug": None,
        "prefetch_slug": "audio_event" if available and not model_ready else None,
        "section": "settings-sec-weights",
    }


def _vertical_framing_tier() -> dict:
    from yuu_clip.analyze.framing import face_model_cached

    installed = module_findable("mediapipe")
    model_ready = installed and face_model_cached()
    if not installed:
        detail = "MediaPipe isn't available — this should be bundled with yuu-clip, so try reinstalling if this persists."
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
        "upgrade": "Bundled by default — used only when you export with a vertical preset.",
        "ready": model_ready,
        "detail": detail,
        "install_slug": None,
        # The BlazeFace asset is ~230 KB — effectively instant, no progress UI needed.
        "prefetch_slug": None,
        "section": "settings-sec-export",
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
        return {
            "backend": ctx.config.llm_backend,
            "models": [entry.to_dict() for entry in model_catalog.recommended_models()],
        }

    @router.post("/api/llm/ollama/pull")
    async def ollama_pull(tag: str):
        if tag not in _PULLABLE_OLLAMA_TAGS:
            raise HTTPException(400, f"Unknown model tag '{tag}' — allowed: {sorted(_PULLABLE_OLLAMA_TAGS)}")
        disk = _preflight_ollama_pull(tag)
        if not disk["sufficient"]:
            raise HTTPException(
                507,
                f"Not enough disk space: about {disk['needed_gb']} GB is needed on "
                f"{disk['target']} but only {disk['free_gb']} GB is free. "
                "Free up space and try again.",
            )
        return await subprocess_sse(["ollama", "pull", tag], ctx.project_dir)

    @router.post("/api/llm/gguf/download")
    async def gguf_download(model_id: str):
        entry = model_catalog.model_by_id(model_id)
        if model_id not in _DOWNLOADABLE_GGUF_IDS or entry is None:
            raise HTTPException(
                400,
                f"Unknown model id '{model_id}' — allowed: {sorted(_DOWNLOADABLE_GGUF_IDS)}",
            )
        # Reject a duplicate before the disk precheck — a second trigger (another
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
        iterator = getattr(response, "body_iterator", None)
        if iterator is not None:
            response.body_iterator = _deregister_when_done(iterator, ctx)
        else:
            ctx.model_downloads.pop(_LLM_DOWNLOAD_KEY, None)
        return response

    @router.get("/api/llm/download-status")
    def download_status():
        return {
            "pending_model_id": ctx.config.pending_local_model or "",
            "downloading": _LLM_DOWNLOAD_KEY in ctx.model_downloads,
            "downloading_model_id": ctx.model_downloads.get(_LLM_DOWNLOAD_KEY),
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
