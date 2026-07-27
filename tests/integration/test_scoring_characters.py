"""Character lore + boost reach the LLM scoring prompt (offline, prompt-only).

Stage 4 feeds each speaking Character's lore and numeric boost into the scoring prompt
via the contexts formatting seam. These tests assert on the BUILT system prompt with a
recording stub client - never a live model call - and pin the no-op guarantee: a clip
with no linked Character produces a prompt byte-identical to the no-character baseline.
"""
from __future__ import annotations

import json
from pathlib import Path

from yuu_clip.config import Config
from yuu_clip.db.models import (
    AudioTrack,
    Character,
    ClipCandidate,
    PersonCharacterLink,
    ProjectVoice,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
    make_session,
)
from yuu_clip.scoring.llm import _SYSTEM_PROMPT, LLMScorer, _compose_system


class _RecordingClient:
    """Captures the system prompt and returns a valid score payload."""

    def __init__(self):
        self.system = None

    def chat(self, messages, temperature=0.1):
        self.system = messages[0]["content"]
        return json.dumps({
            "score_funny": 0.5, "score_dramatic": 0.0, "score_action": 0.0,
            "description": "d", "description_long": "dl",
        })


def _seed_clip(db, *, characters: list[tuple[str, str, str, float]] | None = None,
               video_contexts: list[str] | None = None) -> int:
    """characters: (context_slug, name, lore, score_boost) tuples to create and alias
    the speaking Person to, one alias per world context. video_contexts: the world
    contexts active on the video (defaults to every character's own context, so a
    single-alias test doesn't need to state it twice)."""
    if video_contexts is None:
        video_contexts = [c[0] for c in (characters or [])]

    video = Video(path="/x/a.mkv", filename="a.mkv", status="done", duration_ms=60_000,
                  context_names_json=json.dumps(video_contexts))
    db.add(video)
    db.flush()
    track = AudioTrack(video_id=video.id, stream_index=1, label="combined", do_transcribe=True)
    db.add(track)
    db.flush()

    voice = ProjectVoice(name="Alex", display_index=1, confirmed=True)
    db.add(voice)
    db.flush()
    for context_slug, name, lore, boost in (characters or []):
        char = Character(context_slug=context_slug, name=name, lore=lore, score_boost=boost)
        db.add(char)
        db.flush()
        db.add(PersonCharacterLink(project_voice_id=voice.id, character_id=char.id))
    db.flush()

    speaker = Speaker(video_id=video.id, display_index=1, name="Alex", confirmed=True,
                      global_voice_id=voice.id)
    db.add(speaker)
    db.flush()

    tx = Transcript(audio_track_id=track.id, model_name="base")  # track-level (clip_id NULL)
    db.add(tx)
    db.flush()
    db.add(TranscriptSegment(
        transcript_id=tx.id, start_ms=0, end_ms=3000,
        text="clutch play", speaker_label="SPEAKER_00", speaker_id=speaker.id,
    ))
    clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=3000,
                         transcript_excerpt="Alex: clutch play", score_overall=0.0)
    db.add(clip)
    db.commit()
    return clip.id


def _run_scorer(db, clip_id: int, context_text: str = "") -> str:
    scorer = LLMScorer(Config(), context_text=context_text)
    stub = _RecordingClient()
    scorer._client = stub
    clip = db.get(ClipCandidate, clip_id)
    scorer.score(clip, db)
    return stub.system


class TestCharacterPrompt:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def test_linked_boosted_character_injects_lore_and_boost(self, project_dir):
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(db, characters=[
                ("fantasy-rp", "Alara", "A rogue elf, party leader.", 0.4),
            ])
            system = _run_scorer(db, clip_id, context_text="WORLD-CTX-SENTINEL")
        finally:
            db.close()
        assert "A rogue elf, party leader." in system
        assert "[boost 0.40]" in system
        assert "CHARACTERS SPEAKING IN THIS CLIP" in system
        # The static world context still precedes the per-clip character block.
        assert "WORLD-CTX-SENTINEL" in system
        assert system.index("WORLD-CTX-SENTINEL") < system.index("CHARACTERS SPEAKING")

    def test_zero_boost_character_injects_lore_only(self, project_dir):
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(db, characters=[
                ("fantasy-rp", "Alara", "A rogue elf, party leader.", 0.0),
            ])
            system = _run_scorer(db, clip_id)
        finally:
            db.close()
        assert "A rogue elf, party leader." in system
        assert "boost" not in system

    def test_no_linked_character_is_byte_identical_baseline(self, project_dir):
        """The explicit no-op guarantee: a Person with a name/voice but no Character
        produces exactly the prompt a project that never defined a character would."""
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(db)
            system = _run_scorer(db, clip_id, context_text="WORLD-CTX-SENTINEL")
        finally:
            db.close()
        expected = _compose_system(_SYSTEM_PROMPT, "WORLD-CTX-SENTINEL", Config())
        assert system == expected
        assert "CHARACTERS SPEAKING" not in system

    def test_no_context_no_character_is_plain_baseline(self, project_dir):
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(db)
            system = _run_scorer(db, clip_id, context_text="")
        finally:
            db.close()
        assert system == _compose_system(_SYSTEM_PROMPT, "", Config())

    def test_alias_from_an_inactive_context_does_not_leak_in(self, project_dir):
        """The bug this alias mechanism fixes: a Person aliased to Character A in
        context "fantasy-rp" and Character B in context "scifi-rp" - scoring a clip on a
        video tagged only with "scifi-rp" must surface only B, never A."""
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(
                db,
                characters=[
                    ("fantasy-rp", "Aldric", "A stoic paladin.", 0.0),
                    ("scifi-rp", "Vex", "A rogue starship captain.", 0.0),
                ],
                video_contexts=["scifi-rp"],
            )
            system = _run_scorer(db, clip_id)
        finally:
            db.close()
        assert "Vex" in system
        assert "rogue starship captain" in system
        assert "Aldric" not in system
        assert "stoic paladin" not in system

    def test_video_tagged_with_both_contexts_surfaces_both_aliases(self, project_dir):
        """A crossover session tagged with both world contexts (already supported for
        hot words/sensitive terms) surfaces both of the Person's aliases for that clip."""
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(
                db,
                characters=[
                    ("fantasy-rp", "Aldric", "A stoic paladin.", 0.0),
                    ("scifi-rp", "Vex", "A rogue starship captain.", 0.0),
                ],
                video_contexts=["fantasy-rp", "scifi-rp"],
            )
            system = _run_scorer(db, clip_id)
        finally:
            db.close()
        assert "Aldric" in system
        assert "Vex" in system
