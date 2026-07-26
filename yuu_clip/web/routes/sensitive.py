# Feature-map - Sensitive Terms (code: sensitive_terms / SensitiveTerm; Privacy Terms + Censor Words)
#   UI: static/library/sensitive.js (Settings → Sensitive Content) · "Flagged" clip filter
#   Siblings: scoring/textmatch.py · scoring/engine.py (apply_sensitive_scan) · tests/integration/test_sensitive.py, tests/ui/test_ui_sensitive.py
"""Sensitive-content (Privacy Terms / Censor Words) CRUD + rescan routes
(roadmap plan 06). Term text is user PII by definition - never log a `term`
value anywhere in this module; log only counts and ids.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from yuu_clip.db.models import ClipCandidate, SensitiveTerm, Video
from yuu_clip.log import get_logger
from yuu_clip.scoring.engine import apply_sensitive_scan
from yuu_clip.scoring.term_scope import terms_for_video
from yuu_clip.scoring.textmatch import FUZZY_MIN_TERM_LENGTH
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import (
    normalize_context_slug,
    validate_context_slug,
    with_write_retry,
)

_log = get_logger(__name__)

_VALID_CATEGORIES = ("privacy", "censor")
_VALID_MODES = ("exact", "case_insensitive", "fuzzy")
_TERM_MAX_LEN = 200


class SensitiveTermBody(BaseModel):
    term: str
    category: str
    match_mode: str
    enabled: bool = True
    # NULL / "" / omitted = global. A context ID scopes the term to recordings
    # tagged with that world context.
    context_slug: Optional[str] = None


def _sensitive_term_dict(term_row: SensitiveTerm) -> dict:
    return {
        "id": term_row.id,
        "term": term_row.term,
        "category": term_row.category,
        "match_mode": term_row.match_mode,
        "enabled": term_row.enabled,
        "context_slug": term_row.context_slug,
        "created_at": term_row.created_at.isoformat() if term_row.created_at else None,
    }


def _validate_sensitive_term_body(
    body: SensitiveTermBody, term: str, context_slug: Optional[str], project_dir,
    current_slug: Optional[str] = None,
) -> None:
    if not term:
        raise HTTPException(400, "Term cannot be empty")
    if len(term) > _TERM_MAX_LEN:
        raise HTTPException(400, f"Term must be {_TERM_MAX_LEN} characters or fewer")
    if body.category not in _VALID_CATEGORIES:
        raise HTTPException(400, f"Category must be one of {', '.join(_VALID_CATEGORIES)}")
    if body.match_mode not in _VALID_MODES:
        raise HTTPException(400, f"Match mode must be one of {', '.join(_VALID_MODES)}")
    if body.match_mode == "fuzzy" and len(term) < FUZZY_MIN_TERM_LENGTH:
        raise HTTPException(
            400,
            f"Close spelling matching needs a term of at least {FUZZY_MIN_TERM_LENGTH} characters - "
            "shorter terms match too many unrelated words. Use Exact or Ignore case instead.",
        )
    validate_context_slug(context_slug, project_dir, current_slug)


def _rescan_all_clips(db) -> tuple[int, int]:
    """Full project rescan: re-derive sensitive_matches for every clip in the
    project from its already-stored transcript/descriptions. Synchronous and
    text-only (no LLM call), so it's cheap enough to run inline whenever the
    term list changes - a saved edit is reflected everywhere immediately, not
    just on whichever recording happens to be open."""
    sensitive_terms = db.query(SensitiveTerm).all()
    clips = db.query(ClipCandidate).all()
    videos_by_id = {v.id: v for v in db.query(Video).all()}
    flagged = 0
    for clip in clips:
        terms = terms_for_video(sensitive_terms, videos_by_id.get(clip.video_id))
        apply_sensitive_scan(clip, terms)
        if clip.sensitive_matches:
            flagged += 1
    db.commit()
    return len(clips), flagged


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/sensitive-terms")
    def list_sensitive_terms():
        db = ctx.get_db()
        try:
            rows = db.query(SensitiveTerm).order_by(SensitiveTerm.created_at).all()
            return [_sensitive_term_dict(row) for row in rows]
        finally:
            db.close()

    @router.post("/api/sensitive-terms")
    def create_sensitive_term(body: SensitiveTermBody):
        # The Sensitive Content list autosaves each add/edit/delete immediately
        # (like Hot-words - see hotwords.py), so a save can land mid-analysis while
        # the analyze subprocess holds the SQLite write lock; with_write_retry gives
        # it a few quick retries before the graceful 503 rather than failing outright.
        def _op():
            db = ctx.get_db()
            try:
                term = body.term.strip()
                context_slug = normalize_context_slug(body.context_slug)
                _validate_sensitive_term_body(body, term, context_slug, ctx.project_dir)
                row = SensitiveTerm(
                    term=term, category=body.category, match_mode=body.match_mode,
                    enabled=body.enabled, context_slug=context_slug,
                )
                db.add(row)
                db.commit()
                db.refresh(row)
                clips_scanned, clips_flagged = _rescan_all_clips(db)
                _log.info(
                    "Sensitive term %d created (category=%s mode=%s) - rescanned %d clips, %d flagged",
                    row.id, row.category, row.match_mode, clips_scanned, clips_flagged,
                )
                result = _sensitive_term_dict(row)
                result.update(clips_scanned=clips_scanned, clips_flagged=clips_flagged)
                return result
            finally:
                db.close()

        return with_write_retry(_op)

    @router.put("/api/sensitive-terms/{term_id}")
    def update_sensitive_term(term_id: int, body: SensitiveTermBody):
        def _op():
            db = ctx.get_db()
            try:
                row = db.get(SensitiveTerm, term_id)
                if not row:
                    raise HTTPException(404, "Sensitive term not found")
                term = body.term.strip()
                context_slug = normalize_context_slug(body.context_slug)
                _validate_sensitive_term_body(
                    body, term, context_slug, ctx.project_dir, current_slug=row.context_slug,
                )
                row.term = term
                row.category = body.category
                row.match_mode = body.match_mode
                row.enabled = body.enabled
                row.context_slug = context_slug
                db.commit()
                db.refresh(row)
                clips_scanned, clips_flagged = _rescan_all_clips(db)
                _log.info(
                    "Sensitive term %d updated (category=%s mode=%s) - rescanned %d clips, %d flagged",
                    row.id, row.category, row.match_mode, clips_scanned, clips_flagged,
                )
                result = _sensitive_term_dict(row)
                result.update(clips_scanned=clips_scanned, clips_flagged=clips_flagged)
                return result
            finally:
                db.close()

        return with_write_retry(_op)

    @router.delete("/api/sensitive-terms/{term_id}")
    def delete_sensitive_term(term_id: int):
        def _op():
            db = ctx.get_db()
            try:
                row = db.get(SensitiveTerm, term_id)
                if not row:
                    raise HTTPException(404, "Sensitive term not found")
                category = row.category
                db.delete(row)
                db.commit()
                clips_scanned, clips_flagged = _rescan_all_clips(db)
                _log.info(
                    "Sensitive term %d deleted (category=%s) - rescanned %d clips, %d flagged",
                    term_id, category, clips_scanned, clips_flagged,
                )
                return {"deleted": term_id, "clips_scanned": clips_scanned, "clips_flagged": clips_flagged}
            finally:
                db.close()

        return with_write_retry(_op)

    @router.post("/api/videos/{video_id}/sensitive-rescan")
    def sensitive_rescan_video(video_id: int):
        """Recompute sensitive-term matches for every clip of *video_id* from
        their already-stored transcript/descriptions - no LLM call, synchronous.
        Symmetric with POST /api/videos/{video_id}/hotword-rescan."""
        db = ctx.get_db()
        try:
            video = db.get(Video, video_id)
            if not video:
                raise HTTPException(404, "Video not found")
            sensitive_terms = terms_for_video(db.query(SensitiveTerm).all(), video)
            clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
            changed = 0
            for clip in clips:
                before = clip.sensitive_matches
                apply_sensitive_scan(clip, sensitive_terms)
                if clip.sensitive_matches != before:
                    changed += 1
            db.commit()
            _log.info(
                "Sensitive-term rescan on video %d: %d clip(s) checked, %d changed",
                video_id, len(clips), changed,
            )
            return {"clips_checked": len(clips), "clips_changed": changed}
        finally:
            db.close()

    return router
