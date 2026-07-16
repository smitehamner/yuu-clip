# Feature-map - People / project-wide speaker identity (code: ProjectVoice, global_voice_id; UI "Person"/"People")
#   UI: static/people/voices.js (People view) · Siblings: transcribe/project_voice.py · routes/speakers.py
#   Tests: tests/integration/test_voices.py, tests/ui/test_ui_voices.py
"""People-view routes - promote per-recording Speakers into project-wide Persons.

A ``ProjectVoice`` (user-facing "Person") ties one name across recordings. Naming a
Person applies everywhere because ``Speaker.display_name`` resolves through the linked
voice (see db/models). Cross-recording matching only ever SUGGESTS
(``suggested_voice_id`` on a Speaker); these routes are where the user applies a match
(confirm-voice), promotes/merges/splits, and renames - the only paths that set
``global_voice_id``. Every path that changes an effective display name rebuilds the
affected clips' excerpts and refreshes export sidecars, exactly like the Speaker-rename
route, so transcripts/captions/exports stay in sync.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from yuu_clip.db.models import Character, ClipCandidate, ProjectVoice, Speaker, Video, VoiceExemplar
from yuu_clip.log import get_logger
from yuu_clip.transcribe.project_voice import cluster_speakers_into_voices
from yuu_clip.web.deps import ProjectContext
from yuu_clip.web.routes.common import rebuild_video_excerpts

_log = get_logger(__name__)

_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class PromoteVoice(BaseModel):
    speaker_id: int


class VoiceUpdate(BaseModel):
    name: Optional[str] = None  # None/"" clears back to "Person N"
    color: Optional[str] = None  # "#RRGGBB"; None/"" clears back to the palette default


class VoiceMerge(BaseModel):
    other_id: int  # the Person to merge INTO {voice_id}, then delete


class VoiceSplit(BaseModel):
    speaker_id: int  # the member Speaker to detach
    mint_new: bool = False  # also give the detached Speaker its own fresh Person


class VoiceCharacter(BaseModel):
    character_id: Optional[int] = None  # None clears the link (default, no-op scoring)


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    @router.get("/api/voices")
    def list_voices():
        db = ctx.get_db()
        try:
            voices = (
                db.query(ProjectVoice)
                .options(joinedload(ProjectVoice.character))
                .order_by(ProjectVoice.display_index)
                .all()
            )
            members = _members_by_voice(db)
            suggestions = _suggestions_by_voice(db)
            return [
                _voice_dict(v, members.get(v.id, []), suggestions.get(v.id, []))
                for v in voices
            ]
        finally:
            db.close()

    @router.post("/api/voices")
    def create_voice(body: PromoteVoice):
        db = ctx.get_db()
        try:
            speaker = db.get(Speaker, body.speaker_id)
            if not speaker:
                raise HTTPException(404, "Speaker not found")
            if speaker.global_voice_id is not None:
                raise HTTPException(400, "This speaker is already part of a Person")
            name = speaker.name if (speaker.name and speaker.confirmed) else None
            voice = _mint_voice(db, name=name, color=speaker.color)
            _seed_exemplar(db, voice, speaker)
            speaker.global_voice_id = voice.id
            speaker.suggested_voice_id = None
            speaker.suggested_voice_score = None
            db.commit()
            _log.info("Promoted speaker %d (video %d) to Person %d",
                      speaker.id, speaker.video_id, voice.id)
            return _voice_dict(voice, _members_of(db, voice.id), [])
        finally:
            db.close()

    @router.put("/api/voices/{voice_id}")
    def update_voice(voice_id: int, body: VoiceUpdate):
        db = ctx.get_db()
        try:
            voice = db.get(ProjectVoice, voice_id)
            if not voice:
                raise HTTPException(404, "Person not found")
            fields = body.model_fields_set
            name_changed = False
            color_changed = False
            if "name" in fields:
                new_name = (body.name or "").strip() or None
                name_changed = new_name != voice.name
                voice.name = new_name
                voice.confirmed = True
            if "color" in fields:
                color = (body.color or "").strip()
                if color and not _HEX_COLOR_RE.match(color):
                    raise HTTPException(400, "Color must be a hex value like #4fc3f7")
                color_changed = (color or None) != voice.color
                voice.color = color or None
            db.flush()
            member_video_ids = _member_video_ids(db, voice_id)
            if name_changed:
                # A Person's name is the "applies everywhere" payoff - propagate it to
                # every member recording's excerpts/captions/exports.
                _propagate_name_change(db, ctx, member_video_ids)
            else:
                db.commit()
                if color_changed:
                    # Members take the Person's colour (Speaker.display_color), so a
                    # recolour must rewrite their on-disk caption sidecars. No excerpt
                    # rebuild / staleness stamp - the transcript text is unchanged.
                    _refresh_member_sidecars(db, ctx, member_video_ids)
            _log.info("Updated Person %d: name=%r color=%r", voice_id, voice.name, voice.color)
            return _voice_dict(voice, _members_of(db, voice_id), _suggestions_of(db, voice_id))
        finally:
            db.close()

    @router.post("/api/voices/{voice_id}/merge")
    def merge_voices(voice_id: int, body: VoiceMerge):
        db = ctx.get_db()
        try:
            target = db.get(ProjectVoice, voice_id)
            source = db.get(ProjectVoice, body.other_id)
            if not target:
                raise HTTPException(404, "Person not found")
            if not source:
                raise HTTPException(404, "The other Person no longer exists")
            if source.id == target.id:
                raise HTTPException(400, "Cannot merge a Person into itself")
            affected_videos = set(_member_video_ids(db, source.id)) | set(_member_video_ids(db, target.id))
            db.query(Speaker).filter_by(global_voice_id=source.id).update(
                {"global_voice_id": target.id}, synchronize_session=False)
            db.query(Speaker).filter_by(suggested_voice_id=source.id).update(
                {"suggested_voice_id": None, "suggested_voice_score": None},
                synchronize_session=False)
            db.query(VoiceExemplar).filter_by(project_voice_id=source.id).update(
                {"project_voice_id": target.id}, synchronize_session=False)
            # Bulk-delete the now-empty source row (its exemplars are already repointed,
            # so this must not go through the ORM delete-orphan cascade). Expunge the
            # stale ORM instance so expire_on_commit doesn't try to refresh a gone row.
            db.query(ProjectVoice).filter_by(id=source.id).delete(synchronize_session=False)
            db.expunge(source)
            db.flush()
            _propagate_name_change(db, ctx, affected_videos)
            _log.info("Merged Person %d into Person %d", source.id, target.id)
            return _voice_dict(target, _members_of(db, target.id), _suggestions_of(db, target.id))
        finally:
            db.close()

    @router.post("/api/voices/{voice_id}/split")
    def split_voice(voice_id: int, body: VoiceSplit):
        db = ctx.get_db()
        try:
            voice = db.get(ProjectVoice, voice_id)
            if not voice:
                raise HTTPException(404, "Person not found")
            speaker = db.get(Speaker, body.speaker_id)
            if not speaker or speaker.global_voice_id != voice_id:
                raise HTTPException(400, "That speaker is not part of this Person")
            db.query(VoiceExemplar).filter_by(
                project_voice_id=voice_id, source_speaker_id=speaker.id
            ).delete(synchronize_session=False)
            new_voice = None
            if body.mint_new:
                new_voice = _mint_voice(db, name=None, color=speaker.color)
                _seed_exemplar(db, new_voice, speaker)
                speaker.global_voice_id = new_voice.id
            else:
                speaker.global_voice_id = None
            db.flush()
            _propagate_name_change(db, ctx, [speaker.video_id])
            _log.info("Split speaker %d out of Person %d (mint_new=%s)",
                      speaker.id, voice_id, body.mint_new)
            return {
                "detached_speaker_id": speaker.id,
                "voice": _voice_dict(voice, _members_of(db, voice_id), _suggestions_of(db, voice_id)),
                "new_voice": (
                    _voice_dict(new_voice, _members_of(db, new_voice.id), [])
                    if new_voice else None
                ),
            }
        finally:
            db.close()

    @router.post("/api/voices/backfill")
    def backfill_voices():
        """One-time bootstrap: cluster existing Speakers-with-voiceprints into Persons.

        Clusters only speakers not already linked to a Person, so re-running never
        duplicates an existing link (idempotent). Each cluster becomes an UNCONFIRMED
        Person (the user reviews/splits it in People) seeded with every member's
        voiceprint as an exemplar. A cluster whose members share ONE confirmed name
        adopts it; a name conflict within a cluster leaves the name unset for review -
        it never guesses. Nothing is renamed silently.
        """
        db = ctx.get_db()
        try:
            speakers = (
                db.query(Speaker)
                .filter(Speaker.global_voice_id.is_(None), Speaker.voiceprint.isnot(None))
                .all()
            )
            groups = cluster_speakers_into_voices(
                speakers, ctx.config.project_voice_match_threshold)
            affected_videos: set[int] = set()
            for members in groups:
                _backfill_voice_from_group(db, members)
                affected_videos.update(s.video_id for s in members)
            db.flush()
            if affected_videos:
                _propagate_name_change(db, ctx, affected_videos)
            else:
                db.commit()
            _log.info("Backfill: %d speaker(s) -> %d Person(s)", len(speakers), len(groups))
            return {"created": len(groups), "speakers_clustered": len(speakers)}
        finally:
            db.close()

    @router.post("/api/speakers/{speaker_id}/confirm-voice")
    def confirm_voice(speaker_id: int):
        db = ctx.get_db()
        try:
            speaker = db.get(Speaker, speaker_id)
            if not speaker or speaker.suggested_voice_id is None:
                raise HTTPException(404, "No pending Person suggestion for this speaker")
            voice = db.get(ProjectVoice, speaker.suggested_voice_id)
            if not voice:
                speaker.suggested_voice_id = None
                speaker.suggested_voice_score = None
                db.commit()
                raise HTTPException(404, "The suggested Person no longer exists")
            speaker.global_voice_id = voice.id
            _seed_exemplar(db, voice, speaker)  # drift accumulation
            speaker.suggested_voice_id = None
            speaker.suggested_voice_score = None
            voice.confirmed = True
            db.flush()
            _propagate_name_change(db, ctx, [speaker.video_id])
            _log.info("Confirmed Person %d for speaker %d (video %d)",
                      voice.id, speaker.id, speaker.video_id)
            return _voice_dict(voice, _members_of(db, voice.id), _suggestions_of(db, voice.id))
        finally:
            db.close()

    @router.post("/api/speakers/{speaker_id}/reject-voice")
    def reject_voice(speaker_id: int):
        db = ctx.get_db()
        try:
            speaker = db.get(Speaker, speaker_id)
            if not speaker or speaker.suggested_voice_id is None:
                raise HTTPException(404, "No pending Person suggestion for this speaker")
            speaker.suggested_voice_id = None
            speaker.suggested_voice_score = None
            db.commit()
            _log.info("Dismissed Person suggestion for speaker %d (video %d)",
                      speaker.id, speaker.video_id)
            return {"speaker_id": speaker.id}
        finally:
            db.close()

    @router.post("/api/voices/{voice_id}/character")
    def set_voice_character(voice_id: int, body: VoiceCharacter):
        """Link this Person to a world-context Character, or clear the link (None).

        A pure overlay: the link feeds the Character's lore + score boost to the scorer
        but never changes the Person's name or voiceprint. Clearing it restores the
        default no-op behavior.
        """
        db = ctx.get_db()
        try:
            voice = db.get(ProjectVoice, voice_id)
            if not voice:
                raise HTTPException(404, "Person not found")
            if body.character_id is not None and not db.get(Character, body.character_id):
                raise HTTPException(404, "Character not found")
            voice.character_id = body.character_id
            db.commit()
            _log.info("Person %d character link set to %s", voice_id, body.character_id)
            return _voice_dict(voice, _members_of(db, voice_id), _suggestions_of(db, voice_id))
        finally:
            db.close()

    return router


def _mint_voice(db, *, name: Optional[str], color: Optional[str]) -> ProjectVoice:
    next_index = (db.query(func.max(ProjectVoice.display_index)).scalar() or 0) + 1
    voice = ProjectVoice(name=name, display_index=next_index, color=color, confirmed=True)
    db.add(voice)
    db.flush()
    return voice


def _backfill_voice_from_group(db, members: list[Speaker]) -> ProjectVoice:
    """Create one UNCONFIRMED Person from a backfill cluster and link every member.

    Adopts the members' single shared confirmed name; leaves the name unset on a
    conflict (or when none is named) so the user resolves it - never guesses.
    """
    confirmed_names = {s.name for s in members if s.name and s.confirmed}
    name = confirmed_names.pop() if len(confirmed_names) == 1 else None
    color = next((s.color for s in members if s.color), None)
    next_index = (db.query(func.max(ProjectVoice.display_index)).scalar() or 0) + 1
    voice = ProjectVoice(name=name, display_index=next_index, color=color, confirmed=False)
    db.add(voice)
    db.flush()
    for speaker in members:
        _seed_exemplar(db, voice, speaker)
        speaker.global_voice_id = voice.id
    return voice


def _seed_exemplar(db, voice: ProjectVoice, speaker: Speaker) -> None:
    """Add *speaker*'s voiceprint to *voice* as an exemplar (no-op without a voiceprint)."""
    if not speaker.voiceprint:
        return
    db.add(VoiceExemplar(
        project_voice_id=voice.id,
        voiceprint=speaker.voiceprint,
        voiceprint_backend=speaker.voiceprint_backend,
        source_speaker_id=speaker.id,
    ))


def _propagate_name_change(db, ctx, video_ids) -> None:
    """Rebuild excerpts + refresh export sidecars for every affected recording, then commit.

    Mirrors the Speaker-rename path: a Person rename/merge/split/confirm changes the
    effective display name of member Speakers, so their recordings' clip excerpts and
    on-disk caption sidecars must be regenerated or they show a stale name.
    """
    from yuu_clip.subtitles import refresh_export_sidecars

    edited_at = datetime.now(timezone.utc)
    affected: list[ClipCandidate] = []
    for video_id in video_ids:
        rebuild_video_excerpts(db, video_id)
        clips = db.query(ClipCandidate).filter_by(video_id=video_id).all()
        for clip in clips:
            clip.transcript_edited_at = edited_at
        affected.extend(clips)
    db.commit()
    for clip in affected:
        refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)


def _refresh_member_sidecars(db, ctx, video_ids) -> None:
    """Rewrite export caption sidecars for every affected recording's clips (colour-only
    change): the captions embed each Speaker's display_color, which now flows from the
    Person. No excerpt rebuild and no transcript_edited_at stamp - the text is unchanged."""
    from yuu_clip.subtitles import refresh_export_sidecars

    for video_id in video_ids:
        for clip in db.query(ClipCandidate).filter_by(video_id=video_id).all():
            refresh_export_sidecars(clip, ctx.export_dir, ctx.config.export_name_template)


def _members_of(db, voice_id: int) -> list[dict]:
    speakers = (
        db.query(Speaker, Video.filename)
        .join(Video, Video.id == Speaker.video_id)
        # eager-load the linked Person so display_name/color resolve without an N+1.
        .options(joinedload(Speaker.global_voice))
        .filter(Speaker.global_voice_id == voice_id)
        .order_by(Speaker.video_id, Speaker.display_index)
        .all()
    )
    return [_member_dict(speaker, filename) for speaker, filename in speakers]


def _members_by_voice(db) -> dict[int, list[dict]]:
    rows = (
        db.query(Speaker, Video.filename)
        .join(Video, Video.id == Speaker.video_id)
        .options(joinedload(Speaker.global_voice))
        .filter(Speaker.global_voice_id.isnot(None))
        .order_by(Speaker.video_id, Speaker.display_index)
        .all()
    )
    by_voice: dict[int, list[dict]] = {}
    for speaker, filename in rows:
        by_voice.setdefault(speaker.global_voice_id, []).append(_member_dict(speaker, filename))
    return by_voice


def _member_dict(speaker: Speaker, filename: str) -> dict:
    return {
        "speaker_id": speaker.id,
        "video_id": speaker.video_id,
        "video_filename": filename,
        "display_name": speaker.display_name,
    }


def _member_video_ids(db, voice_id: int) -> list[int]:
    return [
        vid for (vid,) in db.query(Speaker.video_id)
        .filter(Speaker.global_voice_id == voice_id).distinct().all()
    ]


def _suggestions_by_voice(db) -> dict[int, list[dict]]:
    rows = (
        db.query(Speaker, Video.filename)
        .join(Video, Video.id == Speaker.video_id)
        .filter(Speaker.suggested_voice_id.isnot(None))
        .order_by(Speaker.video_id, Speaker.display_index)
        .all()
    )
    by_voice: dict[int, list[dict]] = {}
    for speaker, filename in rows:
        by_voice.setdefault(speaker.suggested_voice_id, []).append(
            _suggestion_dict(speaker, filename))
    return by_voice


def _suggestions_of(db, voice_id: int) -> list[dict]:
    rows = (
        db.query(Speaker, Video.filename)
        .join(Video, Video.id == Speaker.video_id)
        .filter(Speaker.suggested_voice_id == voice_id)
        .order_by(Speaker.video_id, Speaker.display_index)
        .all()
    )
    return [_suggestion_dict(speaker, filename) for speaker, filename in rows]


def _suggestion_dict(speaker: Speaker, filename: str) -> dict:
    return {
        "speaker_id": speaker.id,
        "video_id": speaker.video_id,
        "video_filename": filename,
        "display_name": speaker.display_name,
        "score": speaker.suggested_voice_score,
    }


def _voice_dict(voice: ProjectVoice, members: list[dict], suggestions: list[dict]) -> dict:
    return {
        "id": voice.id,
        "name": voice.name,
        "display_name": voice.display_name,
        "display_index": voice.display_index,
        "is_named": voice.name is not None,
        "color": voice.display_color,
        "confirmed": voice.confirmed,
        "member_count": len(members),
        "members": members,
        "suggestion_count": len(suggestions),
        "suggestions": suggestions,
        "character": _character_link(voice.character),
    }


def _character_link(character: Optional[Character]) -> Optional[dict]:
    """Compact view of a Person's linked Character for the People-view picker. The UI
    resolves the context's display name from its own loaded contexts by context_slug."""
    if character is None:
        return None
    return {"id": character.id, "name": character.name, "context_slug": character.context_slug}
