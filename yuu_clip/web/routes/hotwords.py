# Feature-map - Hot-word (code: hot_words / HotWord)
#   UI: static/library/hotwords.js (Settings → Hot-words)
#   Siblings: scoring/engine.py · scoring/textmatch.py · tests/integration/test_hotwords.py, tests/ui/test_ui_hotwords.py
"""Hot-word / phrase config CRUD routes."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.db.models import HotWord
from yuu_clip.scoring.engine import HOTWORD_BOOST_MAX, HOTWORD_BOOST_MIN
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import normalize_context_slug, validate_context_slug, with_write_retry

_VALID_MODES = ("exact", "case_insensitive", "semantic")
_VALID_TARGETS = ("overall", "funny", "dramatic", "action")
_PHRASE_MAX_LEN = 200


class HotWordBody(BaseModel):
    phrase: str
    match_mode: str
    boost: float
    target: str
    enabled: bool = True
    # NULL / "" / omitted = global. A context ID scopes the hot-word to recordings
    # tagged with that world context.
    context_slug: Optional[str] = None


def _hotword_dict(hw: HotWord) -> dict:
    return {
        "id": hw.id,
        "phrase": hw.phrase,
        "match_mode": hw.match_mode,
        "boost": hw.boost,
        "target": hw.target,
        "enabled": hw.enabled,
        "context_slug": hw.context_slug,
        "created_at": hw.created_at.isoformat() if hw.created_at else None,
    }


def _validate_hotword_body(
    body: HotWordBody, phrase: str, context_slug: Optional[str], db, project_dir,
    current_slug: Optional[str] = None, exclude_id: Optional[int] = None,
) -> None:
    if not phrase:
        raise HTTPException(400, "Phrase cannot be empty")
    if len(phrase) > _PHRASE_MAX_LEN:
        raise HTTPException(400, f"Phrase must be {_PHRASE_MAX_LEN} characters or fewer")
    if body.match_mode not in _VALID_MODES:
        raise HTTPException(400, f"Match mode must be one of {', '.join(_VALID_MODES)}")
    if body.target not in _VALID_TARGETS:
        raise HTTPException(400, f"Target must be one of {', '.join(_VALID_TARGETS)}")
    if not (HOTWORD_BOOST_MIN <= body.boost <= HOTWORD_BOOST_MAX):
        raise HTTPException(400, f"Boost must be between {HOTWORD_BOOST_MIN} and {HOTWORD_BOOST_MAX}")
    validate_context_slug(context_slug, project_dir, current_slug)
    existing = (
        db.query(HotWord)
        .filter(
            HotWord.phrase == phrase,
            HotWord.match_mode == body.match_mode,
            HotWord.context_slug == context_slug,
        )
    )
    if exclude_id is not None:
        existing = existing.filter(HotWord.id != exclude_id)
    if existing.first():
        raise HTTPException(400, "A hot-word with this phrase and match mode already exists")


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/hotwords")
    def list_hotwords():
        db = ctx.get_db()
        try:
            rows = db.query(HotWord).order_by(HotWord.created_at).all()
            return [_hotword_dict(hw) for hw in rows]
        finally:
            db.close()

    @router.post("/api/hotwords")
    def create_hotword(body: HotWordBody):
        # Settings' Hot-words list autosaves each add/edit/delete immediately (unlike
        # the rest of Settings' batched Save button), so it can land mid-analysis
        # while the analyze subprocess holds the SQLite write lock - with_write_retry
        # gives it a few quick retries before falling back to the graceful 503
        # (found 2026-07-25: adding a hot-word during an analysis failed outright).
        def _op():
            db = ctx.get_db()
            try:
                phrase = body.phrase.strip()
                context_slug = normalize_context_slug(body.context_slug)
                _validate_hotword_body(body, phrase, context_slug, db, ctx.project_dir)
                hw = HotWord(
                    phrase=phrase, match_mode=body.match_mode, boost=body.boost,
                    target=body.target, enabled=body.enabled, context_slug=context_slug,
                )
                db.add(hw)
                db.commit()
                db.refresh(hw)
                return _hotword_dict(hw)
            finally:
                db.close()

        return with_write_retry(_op)

    @router.put("/api/hotwords/{hotword_id}")
    def update_hotword(hotword_id: int, body: HotWordBody):
        def _op():
            db = ctx.get_db()
            try:
                hw = db.get(HotWord, hotword_id)
                if not hw:
                    raise HTTPException(404, "Hot-word not found")
                phrase = body.phrase.strip()
                context_slug = normalize_context_slug(body.context_slug)
                _validate_hotword_body(
                    body, phrase, context_slug, db, ctx.project_dir,
                    current_slug=hw.context_slug, exclude_id=hotword_id,
                )
                hw.phrase = phrase
                hw.match_mode = body.match_mode
                hw.boost = body.boost
                hw.target = body.target
                hw.enabled = body.enabled
                hw.context_slug = context_slug
                db.commit()
                db.refresh(hw)
                return _hotword_dict(hw)
            finally:
                db.close()

        return with_write_retry(_op)

    @router.delete("/api/hotwords/{hotword_id}")
    def delete_hotword(hotword_id: int):
        def _op():
            db = ctx.get_db()
            try:
                hw = db.get(HotWord, hotword_id)
                if not hw:
                    raise HTTPException(404, "Hot-word not found")
                db.delete(hw)
                db.commit()
                return {"deleted": hotword_id}
            finally:
                db.close()

        return with_write_retry(_op)

    return router
