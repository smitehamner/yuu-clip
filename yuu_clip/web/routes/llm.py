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


def _ollama_tag_base(name: str) -> str:
    return name.split(":", 1)[0].strip().lower()


_OLLAMA_VISION_BASES = frozenset(
    _ollama_tag_base(entry.ollama_tag)
    for entry in model_catalog.vision_models()
    if entry.ollama_tag
)


def _capabilities(cfg) -> dict:
    backend = cfg.llm_backend
    if not cfg.ollama_enabled:
        return {
            "backend": backend, "model": None, "text": False, "vision": False,
            "detail": "LLM scoring is turned off in Settings.",
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


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/llm/capabilities")
    def capabilities():
        return _capabilities(ctx.config)

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
        return await subprocess_sse(["ollama", "pull", tag], ctx.project_dir)

    return router
