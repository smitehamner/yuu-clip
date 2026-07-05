# Feature-map — Hot-word (code: hot_words / HotWord)
#   UI: static/hotwords.js (Settings → Hot-words)
#   Siblings: scoring/engine.py · scoring/textmatch.py · tests/test_hotwords.py, tests/test_ui_hotwords.py
"""Hot-word / phrase config CRUD routes."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.db.models import HotWord
from yuu_clip.scoring.engine import HOTWORD_BOOST_MAX, HOTWORD_BOOST_MIN
from yuu_clip.web.deps import ProjectContext

_VALID_MODES = ("exact", "case_insensitive", "semantic")
_VALID_TARGETS = ("overall", "funny", "dramatic", "action")
_PHRASE_MAX_LEN = 200


class HotWordBody(BaseModel):
    phrase: str
    match_mode: str
    boost: float
    target: str
    enabled: bool = True


def _hotword_dict(hw: HotWord) -> dict:
    return {
        "id": hw.id,
        "phrase": hw.phrase,
        "match_mode": hw.match_mode,
        "boost": hw.boost,
        "target": hw.target,
        "enabled": hw.enabled,
        "created_at": hw.created_at.isoformat() if hw.created_at else None,
    }


def _validate_hotword_body(body: HotWordBody, phrase: str, db, exclude_id: Optional[int] = None) -> None:
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
    existing = (
        db.query(HotWord)
        .filter(HotWord.phrase == phrase, HotWord.match_mode == body.match_mode)
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
        db = ctx.get_db()
        try:
            phrase = body.phrase.strip()
            _validate_hotword_body(body, phrase, db)
            hw = HotWord(
                phrase=phrase, match_mode=body.match_mode, boost=body.boost,
                target=body.target, enabled=body.enabled,
            )
            db.add(hw)
            db.commit()
            db.refresh(hw)
            return _hotword_dict(hw)
        finally:
            db.close()

    @router.put("/api/hotwords/{hotword_id}")
    def update_hotword(hotword_id: int, body: HotWordBody):
        db = ctx.get_db()
        try:
            hw = db.get(HotWord, hotword_id)
            if not hw:
                raise HTTPException(404, "Hot-word not found")
            phrase = body.phrase.strip()
            _validate_hotword_body(body, phrase, db, exclude_id=hotword_id)
            hw.phrase = phrase
            hw.match_mode = body.match_mode
            hw.boost = body.boost
            hw.target = body.target
            hw.enabled = body.enabled
            db.commit()
            db.refresh(hw)
            return _hotword_dict(hw)
        finally:
            db.close()

    @router.delete("/api/hotwords/{hotword_id}")
    def delete_hotword(hotword_id: int):
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

    return router
