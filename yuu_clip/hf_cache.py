"""Cheap, network-free "has this model already been downloaded?" check.

Shared by the Tier-B capability tiles that fetch models straight from
HuggingFace Hub without a dedicated per-feature cache dir (audio-event's AST
checkpoint, similarity's bge-small ONNX model) -- so their "ready" vs "fetches
on first use" status never needs a network probe. speaker-labels (SpeechBrain)
and vertical-framing (BlazeFace) already have their own simple existence checks
(they download to a fixed, single-file/dir location) and don't need this.

Uses huggingface_hub's cache-scan API, which only reads the local cache index
on disk and never touches the network. Any scan failure (missing cache dir,
corrupted entry, a huggingface_hub internals change) degrades to "not cached"
rather than raising -- the caller's job is a status hint, not a hard guarantee.
"""
from __future__ import annotations

import logging
from pathlib import Path

log = logging.getLogger(__name__)


def hf_offline_env(config) -> dict[str, str]:
    """Extra env for a model-CONSUMING subprocess: force HuggingFace offline mode
    once every model such a run could load is already cached.

    huggingface_hub/transformers otherwise make a Hub round-trip on every model load
    even when the weights are cached, which costs time and prints "You are sending
    unauthenticated requests to the HF Hub. Please set a HF_TOKEN..." straight into
    the analyze/score UI log. Offline mode uses the cached files and skips both.

    Gated on the models actually being present so a first-run download is never
    forced offline. The download/prefetch flows launch their subprocess WITHOUT a
    ProjectContext (see routes/models.py, routes/llm.py) and so never reach here -
    a new download route must keep doing that, or it would be forced offline and
    could not fetch anything.

    Returns the vars to overlay; ``{}`` when anything is still missing. Must be
    applied at spawn - the subprocess reads it when it first imports huggingface_hub.
    """
    if not _consumable_models_cached(config):
        return {}
    return {"HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"}


def _consumable_models_cached(config) -> bool:
    """Whether every HuggingFace-backed model an analyze/score run may load is cached.

    Deliberately conservative - it requires all of them, not just the ones this
    particular run will touch, because the per-run set depends on request flags the
    launcher doesn't have. Staying online is the safe fallback (it only forgoes the
    optimization), whereas going offline too early breaks a genuine first download.
    """
    try:
        from yuu_clip.scoring.audio_event import audio_event_model_cached
        from yuu_clip.transcribe.diarization_client import speechbrain_model_cached
        from yuu_clip.transcribe.transcriber import make_transcriber

        if not make_transcriber(config).model_cached():
            return False  # Whisper is the one hard failure offline - never risk it
        if not speechbrain_model_cached():
            return False
        laugh_model_id = getattr(config, "scorer_laugh_model_id", "")
        return not laugh_model_id or audio_event_model_cached(laugh_model_id)
    except Exception:
        log.debug("HF offline gate check failed - staying online", exc_info=True)
        return False


def repo_cached(repo_id: str, cache_dir: str | Path | None = None) -> bool:
    """Whether *repo_id* has at least one fully-cached model revision under
    *cache_dir* (or HuggingFace's default hub cache when omitted)."""
    from huggingface_hub import scan_cache_dir

    try:
        info = scan_cache_dir(cache_dir=str(cache_dir) if cache_dir else None)
    except Exception:
        log.debug("HF cache scan failed for %s (cache_dir=%s)", repo_id, cache_dir, exc_info=True)
        return False
    return any(
        repo.repo_id == repo_id and repo.repo_type == "model" and repo.revisions
        for repo in info.repos
    )
