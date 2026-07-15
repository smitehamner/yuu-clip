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


def _seed_clip(db, *, link_character: bool, boost: float = 0.4) -> int:
    video = Video(path="/x/a.mkv", filename="a.mkv", status="done", duration_ms=60_000)
    db.add(video)
    db.flush()
    track = AudioTrack(video_id=video.id, stream_index=1, label="combined", do_transcribe=True)
    db.add(track)
    db.flush()

    character_id = None
    if link_character:
        char = Character(context_slug="fantasy-rp", name="Alara",
                         lore="A rogue elf, party leader.", score_boost=boost)
        db.add(char)
        db.flush()
        character_id = char.id

    voice = ProjectVoice(name="Alex", display_index=1, confirmed=True, character_id=character_id)
    db.add(voice)
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
            clip_id = _seed_clip(db, link_character=True, boost=0.4)
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
            clip_id = _seed_clip(db, link_character=True, boost=0.0)
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
            clip_id = _seed_clip(db, link_character=False)
            system = _run_scorer(db, clip_id, context_text="WORLD-CTX-SENTINEL")
        finally:
            db.close()
        expected = _compose_system(_SYSTEM_PROMPT, "WORLD-CTX-SENTINEL", Config())
        assert system == expected
        assert "CHARACTERS SPEAKING" not in system

    def test_no_context_no_character_is_plain_baseline(self, project_dir):
        db = self._db(project_dir)
        try:
            clip_id = _seed_clip(db, link_character=False)
            system = _run_scorer(db, clip_id, context_text="")
        finally:
            db.close()
        assert system == _compose_system(_SYSTEM_PROMPT, "", Config())
