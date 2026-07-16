# Feature-map - Tier-B model prefetch (code: yuu_clip.cli.models, hf_cache)
#   UI: static/settings/modelcatalog.js (Capabilities overview → "Download now")
#   Siblings: routes/llm.py (capability tiers + the .gguf model download, which
#   keeps its own separate path and isn't handled here)
"""Model prefetch route - one consistent "download <model> so <feature> works"
flow for the Tier-B models the Capabilities overview surfaces (packaging-
strategy overhaul, Wave 4): the SpeechBrain speaker encoder, the AST audio-
event/laughter model, and the fastembed similarity model. Uses the
subprocess_sse streaming pattern, including Cancel-via-abort.
"""
from __future__ import annotations

import sys

from fastapi import APIRouter, HTTPException

from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import register_model_download
from yuu_clip.web.sse import subprocess_sse

# Only these slugs may be prefetched - becomes a subprocess argument, so an
# allowlist keeps a stray query param from running arbitrary CLI input.
_PREFETCHABLE_SLUGS = frozenset({"speaker", "audio_event", "embeddings"})


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.post("/api/models/prefetch")
    async def prefetch(slug: str):
        if slug not in _PREFETCHABLE_SLUGS:
            raise HTTPException(400, f"Unknown model slug '{slug}' - allowed: {sorted(_PREFETCHABLE_SLUGS)}")
        cmd = [
            sys.executable, "-m", "yuu_clip.cli", "prefetch-model", slug,
            "--project", str(ctx.project_dir),
        ]
        # Register the slug in the shared "a required model is downloading"
        # registry so the analyze-start coordination and the boot prefetch banner
        # (first-run-friction Stage 6, the speaker model) see it in progress.
        ctx.model_downloads[slug] = slug
        try:
            response = await subprocess_sse(cmd, ctx.project_dir)
        except Exception:
            ctx.model_downloads.pop(slug, None)
            raise
        return register_model_download(response, ctx, slug)

    return router
