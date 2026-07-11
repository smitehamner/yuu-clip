"""
Clips-vs-Scenes Stage 2: scene-mode LLM scoring.

Covers the scene rubric selection in LLMScorer (scene_mode) and the kind-aware
scorer routing in ScoringEngine - a kind='scene' row must be scored by the scene
scorer set (the scene prompt), never the clip Funny/Dramatic/Action scorers, and
must not fall through to llm_no_transcript on a quiet arc. Pure mocks, no DB.
"""
from __future__ import annotations

import json
import unittest.mock as mock

from yuu_clip.config import Config
from yuu_clip.scoring.engine import ScoringEngine
from yuu_clip.scoring.llm import LLMScorer
from yuu_clip.scoring.protocol import ScoreResult

_CLIP_MARKER = "You analyze video clips for highlight potential"
_SCENE_MARKER = "You analyze longer video scenes"

_SCENE_PAYLOAD = json.dumps({
    "score_funny": 0.2, "score_dramatic": 0.7, "score_action": 0.1,
    "description": "A tense standoff", "description_long": "It builds and pays off.",
})


def _clip(excerpt="some transcript text", vision=""):
    clip = mock.MagicMock()
    clip.id = 1
    clip.transcript_excerpt = excerpt
    clip.vision_summary = vision
    return clip


# ---------------------------------------------------------------------------
# LLMScorer scene mode - prompt selection + sparse-transcript tolerance
# ---------------------------------------------------------------------------

class TestSceneScorerPromptSelection:
    def _capture_system(self, scene_mode, clip):
        scorer = LLMScorer(Config(), scene_mode=scene_mode)
        captured = {}

        def fake_chat(messages, temperature=0.1):
            captured["system"] = messages[0]["content"]
            captured["user"] = messages[1]["content"]
            return _SCENE_PAYLOAD

        scorer._client = mock.MagicMock()
        scorer._client.chat.side_effect = fake_chat
        result = scorer.score(clip, None)
        return captured, result

    def test_scene_mode_uses_scene_prompt(self):
        captured, result = self._capture_system(True, _clip())
        assert _SCENE_MARKER in captured["system"]
        assert _CLIP_MARKER not in captured["system"]
        assert "llm_scored" in result.tags

    def test_clip_mode_uses_clip_prompt(self):
        captured, result = self._capture_system(False, _clip())
        assert _CLIP_MARKER in captured["system"]
        assert _SCENE_MARKER not in captured["system"]

    def test_scene_scores_populate_all_dimensions(self):
        _, result = self._capture_system(True, _clip())
        assert abs(result.score_funny - 0.2) < 1e-6
        assert abs(result.score_dramatic - 0.7) < 1e-6
        assert abs(result.score_action - 0.1) < 1e-6
        assert result.description == "A tense standoff"


class TestSceneScorerSparseTranscript:
    def test_no_transcript_no_vision_returns_no_transcript_tag_absent(self):
        # A quiet scene with nothing to judge must NOT be tagged llm_no_transcript
        # (that clip-only tag would read as a failure); it returns empty tags so the
        # engine's basic-description fallback handles it.
        scorer = LLMScorer(Config(), scene_mode=True)
        scorer._call_llm = mock.MagicMock()
        result = scorer.score(_clip(excerpt="", vision=""), None)
        assert result.tags == []
        assert "llm_no_transcript" not in result.tags
        scorer._call_llm.assert_not_called()

    def test_no_transcript_but_vision_still_scores(self):
        scorer = LLMScorer(Config(), scene_mode=True)
        captured = {}

        def fake_chat(messages, temperature=0.1):
            captured["user"] = messages[1]["content"]
            return _SCENE_PAYLOAD

        scorer._client = mock.MagicMock()
        scorer._client.chat.side_effect = fake_chat
        result = scorer.score(_clip(excerpt="", vision="on-screen a tense standoff"), None)
        assert "llm_scored" in result.tags
        assert "on-screen a tense standoff" in captured["user"]  # vision block sent

    def test_clip_mode_no_transcript_still_tags_llm_no_transcript(self):
        # The clip path is unchanged: an empty clip bails with llm_no_transcript.
        scorer = LLMScorer(Config(), scene_mode=False)
        result = scorer.score(_clip(excerpt="", vision=""), None)
        assert "llm_no_transcript" in result.tags


class TestSceneScorerJsonRobustness:
    def _scorer(self, *responses):
        scorer = LLMScorer(Config(), scene_mode=True)
        scorer._call_llm = mock.MagicMock(side_effect=list(responses))
        return scorer

    def test_fenced_json_parsed_without_repair(self):
        scorer = self._scorer(f"```json\n{_SCENE_PAYLOAD}\n```")
        result = scorer.score(_clip(), None)
        assert "llm_scored" in result.tags
        assert abs(result.score_dramatic - 0.7) < 1e-6
        assert scorer._call_llm.call_count == 1

    def test_prefixed_prose_triggers_repair_then_succeeds(self):
        scorer = self._scorer("Sure, here is the JSON: not valid {{{{", _SCENE_PAYLOAD)
        result = scorer.score(_clip(), None)
        assert "llm_scored" in result.tags
        assert scorer._call_llm.call_count == 2
        assert scorer._call_llm.call_args_list[1].kwargs["repair_of"] == "Sure, here is the JSON: not valid {{{{"

    def test_malformed_twice_returns_llm_error(self):
        scorer = self._scorer("nope {{{{", "still nope")
        result = scorer.score(_clip(), None)
        assert "llm_error" in result.tags
        assert scorer._call_llm.call_count == 2


# ---------------------------------------------------------------------------
# ScoringEngine kind routing - scenes to scene scorers, clips to clip scorers
# ---------------------------------------------------------------------------

def _mock_scorer(weight=1.0, available=True, **dims):
    scorer = mock.MagicMock()
    scorer.is_available.return_value = available
    scorer.weight = weight
    scorer.score.return_value = ScoreResult(**dims)
    return scorer


def _row(kind):
    row = mock.MagicMock()
    row.kind = kind
    row.tags = []
    row.transcript_excerpt = None
    row.score_funny = row.score_dramatic = row.score_action = 0.0
    row.score_overall = 0.0
    row.description = row.description_long = ""
    row.scored_at = None
    return row


class TestEngineKindRouting:
    def _engine(self):
        clip_scorer = _mock_scorer(score_action=1.0)
        scene_scorer = _mock_scorer(score_dramatic=0.8)
        engine = ScoringEngine(Config(), [clip_scorer], scene_scorers=[scene_scorer])
        return engine, clip_scorer, scene_scorer

    def test_scene_row_uses_scene_scorers_only(self):
        engine, clip_scorer, scene_scorer = self._engine()
        scene = _row("scene")
        engine.score_clip(scene, None)
        clip_scorer.score.assert_not_called()
        scene_scorer.score.assert_called_once()
        assert abs(scene.score_dramatic - 0.8) < 1e-6
        assert scene.scored_at is not None

    def test_clip_row_uses_clip_scorers_only(self):
        engine, clip_scorer, scene_scorer = self._engine()
        clip = _row("clip")
        engine.score_clip(clip, None)
        scene_scorer.score.assert_not_called()
        clip_scorer.score.assert_called_once()
        assert abs(clip.score_action - 1.0) < 1e-6

    def test_missing_kind_defaults_to_clip_path(self):
        engine, clip_scorer, scene_scorer = self._engine()
        row = _row("clip")
        del row.kind  # no kind attribute -> getattr(clip, "kind", "clip") falls back
        engine.score_clip(row, None)
        scene_scorer.score.assert_not_called()
        clip_scorer.score.assert_called_once()
