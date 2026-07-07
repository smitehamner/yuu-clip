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
