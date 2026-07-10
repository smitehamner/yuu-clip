"""Context-scoping filter for hot-words and sensitive terms (WS3).

A term is either global (``context_slug is None`` -> always applies) or scoped to a
world context (applies only to recordings whose ``context_names_json`` includes that
context ID). This is the single seam every consumer (scoring engine, rescan routes)
filters through, so the merge rule lives in exactly one place.
"""
from __future__ import annotations

import json


def video_context_ids(video) -> set[str]:
    """The set of world-context IDs a recording is tagged with (empty set if none).

    Tolerant of a missing/None video and of malformed JSON - callers pass this
    straight from ``terms_for_video``, where "no contexts" must mean "global only",
    never a crash.
    """
    raw = getattr(video, "context_names_json", None)
    if not raw:
        return set()
    try:
        loaded = json.loads(raw)
    except (ValueError, TypeError):
        return set()
    return {str(cid) for cid in loaded} if isinstance(loaded, list) else set()


def terms_for_video(all_terms, video) -> list:
    """Global terms + terms whose ``context_slug`` is in *video*'s contexts.

    A term scoped to a context the video is not tagged with is excluded; so is an
    orphaned term whose context was deleted (its slug matches no live video context).
    Both stay inert rather than leaking or crashing.
    """
    context_ids = video_context_ids(video)
    return [
        term for term in all_terms
        if getattr(term, "context_slug", None) is None or term.context_slug in context_ids
    ]
