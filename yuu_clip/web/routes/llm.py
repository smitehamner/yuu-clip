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
from pathlib import Path

from fastapi import APIRouter, HTTPException

from yuu_clip import model_catalog
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.sse import subprocess_sse

# Only tags from the curated catalog may be pulled — the tag becomes a
# subprocess argument, so an allowlist keeps a stray query param from running
# an arbitrary `ollama pull`.
_PULLABLE_OLLAMA_TAGS = frozenset(
    entry.ollama_tag
    for entry in model_catalog.recommended_models()
    if entry.ollama_tag and model_catalog.BACKEND_OLLAMA in entry.backends
)

# Headroom beyond the model's own on-disk size — Ollama writes temporary blobs
# and a manifest during a pull, so a pull needs more than the final weight size.
_PULL_DISK_HEADROOM_GB = 2.0


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
    text_ok = bool(model)
    vision_ok = text_ok and _ollama_tag_base(model) in _OLLAMA_VISION_BASES
    if not text_ok:
        detail = "No Ollama model set — choose one under Settings → LLM scoring."
    elif vision_ok:
        detail = "A vision-capable Ollama model is set — image analysis is available."
    else:
        detail = "Text scoring is ready; pick a vision model to enable image analysis."
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


def _audio_model_deps_installed() -> bool:
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
        return True
    except ImportError:
        return False


def _similarity_tier(cfg, text_ok: bool) -> dict:
    from yuu_clip.scoring.similarity import EmbeddingsBackend

    embed_ok, embed_reason = EmbeddingsBackend(cfg).availability()
    configured = (getattr(cfg, "similarity_backend", "tfidf") or "tfidf").strip()
    if configured == "embeddings" and embed_ok:
        active = "embeddings"
    elif configured == "llm" and text_ok:
        active = "llm"
    else:
        active = "tfidf"
    return {
        "id": "similarity",
        "name": "Similarity engine",
        "purpose": 'Powers Find related clips and "Meaning" hot-words.',
        "active": _SIMILARITY_LABELS.get(active, active),
        "upgrade": "Smart (embeddings) adds paraphrase-aware matching with a small on-device model.",
        "ready": embed_ok,
        "detail": "The Smart (embeddings) engine is installed and ready." if embed_ok else _sentence(embed_reason),
        "install_slug": None if embed_ok else "embeddings",
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
        "section": "settings-sec-llm",
    }


def _audio_events_tier(cfg) -> dict:
    from yuu_clip.scoring.audio_event import AudioEventScorer

    available, reason = AudioEventScorer(cfg).availability()
    deps_ok = _audio_model_deps_installed()
    return {
        "id": "audio_events",
        "name": "Audio-event detection",
        "purpose": "Boosts Action on gunshots and explosions, Funny on crowd cheers.",
        "active": "On" if available else "Off",
        "upgrade": "Install the audio model to score sound events (heaviest tier, opt-in).",
        "ready": available,
        "detail": "Audio-event detection is on and ready." if available else _sentence(reason),
        "install_slug": None if deps_ok else "audio-model",
        "section": "settings-sec-weights",
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
                _audio_events_tier(cfg),
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

    return router
