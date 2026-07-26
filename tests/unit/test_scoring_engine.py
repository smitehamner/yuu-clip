"""yuu_clip/scoring/engine.py - scorer orchestration, weights.

Client-bound auto-approve route tests live in
tests/integration/test_scoring_engine.py."""

from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# ScoringEngine unit tests
# ---------------------------------------------------------------------------

class TestScoringEngine:
    """ScoringEngine.score_clip() and score_video() orchestration."""

    def _make_scorer(self, score_funny=0.0, score_dramatic=0.0, score_action=0.0,
                     description="", description_long="", tags=None, weight=1.0, available=True):
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.is_available.return_value = available
        mock.weight = weight
        mock.score.return_value = ScoreResult(
            score_funny=score_funny,
            score_dramatic=score_dramatic,
            score_action=score_action,
            description=description,
            description_long=description_long,
            tags=tags or [],
        )
        return mock

    def _make_clip(self):
        from unittest.mock import MagicMock
        clip = MagicMock()
        clip.tags = []
        clip.transcript_excerpt = None
        clip.score_funny = 0.0
        clip.score_dramatic = 0.0
        clip.score_action = 0.0
        clip.score_overall = 0.0
        clip.description = ""
        clip.description_long = ""
        clip.scored_at = None
        return clip

    def test_no_scorers_returns_without_update(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        engine = ScoringEngine(config, [])
        clip = self._make_clip()
        clip.score_overall = 0.7   # sentinel: must be unchanged if no scorers run
        engine.score_clip(clip, None)
        assert clip.score_overall == 0.7
        assert clip.scored_at is None

    def test_unavailable_scorer_filtered_out(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        unavailable = self._make_scorer(score_action=1.0, available=False)
        engine = ScoringEngine(config, [unavailable])
        clip = self._make_clip()
        clip.score_overall = 0.7   # sentinel: must be unchanged if scorer never ran
        engine.score_clip(clip, None)
        assert clip.score_overall == 0.7
        assert clip.scored_at is None
        unavailable.score.assert_not_called()

    def test_score_clip_sets_scored_at_on_success(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(score_funny=0.8, score_dramatic=0.4, score_action=0.2)
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.scored_at is not None

    def test_score_clip_writes_dimension_scores(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(score_funny=0.8, score_dramatic=0.4, score_action=0.2)
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.8) < 1e-6
        assert abs(clip.score_dramatic - 0.4) < 1e-6
        assert abs(clip.score_action - 0.2) < 1e-6

    def test_score_clip_computes_overall_from_dim_weights(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        config.score_funny_weight = 2.0
        config.score_dramatic_weight = 1.0
        config.score_action_weight = 1.0
        config.score_visual_weight = 0.0   # focus this test on the three narrative axes
        scorer = self._make_scorer(score_funny=1.0, score_dramatic=0.0, score_action=0.0)
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # overall = (2*1 + 1*0 + 1*0) / 4 = 0.5
        assert abs(clip.score_overall - 0.5) < 1e-6

    def test_score_clip_description_set_by_scorer(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(description="A dramatic moment", description_long="Full text here")
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.description == "A dramatic moment"
        assert clip.description_long == "Full text here"

    def test_score_clip_tags_accumulated(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(tags=["energy_scored"])
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert "energy_scored" in clip.tags

    def test_score_clip_stale_scorer_tags_removed(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(tags=["energy_scored"])
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        clip.tags = ["energy_scored", "llm_error", "user_tag"]
        engine.score_clip(clip, None)
        assert "user_tag" in clip.tags           # non-scorer tag preserved
        assert "llm_error" not in clip.tags      # stale scorer tag removed
        assert clip.tags.count("energy_scored") == 1  # fresh tag re-added exactly once

    def test_score_clip_tags_not_duplicated(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        scorer = self._make_scorer(tags=["energy_scored"])
        engine = ScoringEngine(config, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        engine.score_clip(clip, None)
        assert clip.tags.count("energy_scored") == 1

    def test_score_clip_weighted_average_of_two_scorers(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        config = Config()
        s1 = self._make_scorer(score_action=1.0, weight=2.0)
        s2 = self._make_scorer(score_action=0.0, weight=1.0)
        engine = ScoringEngine(config, [s1, s2])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # Weighted: (1.0*2 + 0.0*1) / (2+1) = 2/3
        assert abs(clip.score_action - (2.0 / 3.0)) < 1e-6

    def test_real_lexicon_scorer_contributes_action_with_no_llm(self):
        # Stage 03: the zero-dep lexicon scorer alone (no LLM) lands score_action
        # for a clip full of action markers, through the weighted engine.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.lexicon import LexiconScorer
        clip = self._make_clip()
        clip.start_ms = 0
        clip.end_ms = 60_000
        clip.transcript_excerpt = "Player: go go go push push, reload clutch"
        engine = ScoringEngine(Config(), [LexiconScorer(Config())])
        engine.score_clip(clip, None)
        assert clip.score_action > 0.0
        assert "lexicon_scored" in clip.tags
        assert clip.scored_at is not None

    def test_stage4_speech_rate_scorer_contributes_with_no_llm(self, monkeypatch):
        # Stage 04: the zero-dep speech-rate scorer alone (no LLM) lands funny+action
        # for a fast-talking clip, through the weighted engine, via clip_window_segments.
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.speechrate import SpeechRateScorer

        fast = MagicMock()
        fast.text = "a b c d e f g h i j k l"   # 12 words / 2 s = 6 wps
        fast.start_ms, fast.end_ms = 0, 2000
        monkeypatch.setattr(
            "yuu_clip.segments.windower.clip_window_segments", lambda *a: [fast]
        )
        clip = self._make_clip()
        clip.start_ms, clip.end_ms = 0, 30_000
        engine = ScoringEngine(Config(), [SpeechRateScorer(Config())])
        engine.score_clip(clip, None)
        assert clip.score_funny > 0.0
        assert clip.score_action > 0.0
        assert "speech_rate_scored" in clip.tags
        assert clip.scored_at is not None

    def _make_partial_scorer(self, weight=1.0, **dims):
        """Scorer that emits ONLY the named dimensions (others stay None - no opinion)."""
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.is_available.return_value = True
        mock.weight = weight
        mock.score.return_value = ScoreResult(**dims)
        return mock

    def test_dimension_not_diluted_by_scorer_that_does_not_emit_it(self):
        # An action-only scorer must not drag down funny, and vice-versa.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        action_only = self._make_partial_scorer(score_action=1.0, weight=1.0)
        funny_only  = self._make_partial_scorer(score_funny=1.0,  weight=1.0)
        engine = ScoringEngine(Config(), [action_only, funny_only])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 1.0) < 1e-6   # not 0.5
        assert abs(clip.score_action - 1.0) < 1e-6  # not 0.5
        assert clip.score_dramatic == 0.0           # nobody emitted it

    def test_no_opinion_scorer_does_not_dilute(self):
        # A scorer returning an empty ScoreResult (no data) contributes nothing.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        real  = self._make_partial_scorer(score_action=1.0, weight=1.0)
        empty = self._make_partial_scorer(weight=3.0)  # emits no dimensions
        engine = ScoringEngine(Config(), [real, empty])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert abs(clip.score_action - 1.0) < 1e-6  # empty's weight excluded

    def test_preserve_unscored_dims_keeps_visual_and_laugh_on_partial_rescore(self):
        # An LLM-only rescore (no Visual/laugh scorer) must not zero the axes it does
        # not recompute - that was the Stage 4 cohesion HIGH: rescore silently dropped
        # score_visual to 0 and score_laugh to None.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        llm_like = self._make_partial_scorer(score_funny=0.9, weight=1.0)
        clip = self._make_clip()
        clip.score_visual = 0.7   # produced by a prior full analyze pass
        clip.score_laugh = 0.4
        engine = ScoringEngine(Config(), [llm_like])
        engine.score_clip(clip, None, preserve_unscored_dims=True)
        assert abs(clip.score_funny - 0.9) < 1e-6   # recomputed by the LLM-like scorer
        assert clip.score_visual == 0.7             # preserved, not zeroed
        assert clip.score_laugh == 0.4              # preserved, not reset to None

    def test_default_full_rescore_still_zeroes_unscored_dims(self):
        # Without the flag (the ingest path), an axis no scorer emits lands a clean 0.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        llm_like = self._make_partial_scorer(score_funny=0.9, weight=1.0)
        clip = self._make_clip()
        clip.score_visual = 0.7
        clip.score_laugh = 0.4
        engine = ScoringEngine(Config(), [llm_like])
        engine.score_clip(clip, None)
        assert clip.score_visual == 0.0
        assert clip.score_laugh is None


class TestUnavailableScorerLogging:
    """ScoringEngine.__init__ logs which scorers were filtered out (and why), so a
    "why is my Visual score always 0" report is diagnosable from the log alone
    without reading every scorer's debug output."""

    def _scorer(self, name, available, weight=1.0, reason=None):
        from unittest.mock import MagicMock

        mock = MagicMock()
        mock.name = name
        mock.weight = weight
        mock.is_available.return_value = available
        if reason is not None:
            mock.available.return_value = (available, reason)
        else:
            del mock.available  # no (bool, reason) form on this scorer (e.g. energy/visual)
        return mock

    def test_logs_name_and_reason_for_each_unavailable_scorer(self, caplog):
        import logging

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        laugh = self._scorer("laugh", available=False, reason="its model dependencies aren't installed")
        energy = self._scorer("audio_energy", available=True)
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.engine"):
            ScoringEngine(Config(), [laugh, energy])
        messages = [r.message for r in caplog.records]
        assert any(
            "1 clip scorer(s) unavailable" in m
            and "laugh (its model dependencies aren't installed)" in m
            for m in messages
        )

    def test_scorer_with_no_available_method_logs_name_only(self, caplog):
        import logging

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        visual = self._scorer("visual_activity", available=False)
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.engine"):
            ScoringEngine(Config(), [visual])
        messages = [r.message for r in caplog.records]
        assert any("visual_activity" in m for m in messages if "unavailable" in m)

    def test_all_scorers_available_logs_nothing(self, caplog):
        import logging

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        energy = self._scorer("audio_energy", available=True)
        with caplog.at_level(logging.INFO, logger="yuu_clip.scoring.engine"):
            ScoringEngine(Config(), [energy])
        assert not any("unavailable" in r.message for r in caplog.records)


class TestLaughScoreAttribute:
    """score_laugh mirrors the laugh scorer's raw result without altering score_funny."""

    def _laugh_scorer(self, score_funny=None, tags=None, weight=1.0):
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.name = "laugh"
        mock.is_available.return_value = True
        mock.weight = weight
        mock.score.return_value = ScoreResult(score_funny=score_funny, tags=tags or [])
        return mock

    def _make_clip(self):
        from unittest.mock import MagicMock
        clip = MagicMock()
        clip.tags = []
        clip.transcript_excerpt = None
        clip.score_funny = clip.score_dramatic = clip.score_action = 0.0
        clip.score_overall = 0.0
        clip.score_laugh = 0.42  # stale sentinel: must be reset each run
        clip.description = clip.description_long = ""
        clip.scored_at = None
        return clip

    def test_laugh_result_stored_and_still_feeds_funny(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        laugh = self._laugh_scorer(score_funny=0.8, tags=["laugh_transcript"])
        engine = ScoringEngine(Config(), [laugh])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert abs(clip.score_laugh - 0.8) < 1e-6   # raw laugh result stored
        assert abs(clip.score_funny - 0.8) < 1e-6   # still weighted into funny

    def test_laugh_disabled_leaves_score_laugh_none(self):
        # No laugh scorer in the list at all → the column resets to None.
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.protocol import ScoreResult
        other = MagicMock()
        other.name = "energy"
        other.is_available.return_value = True
        other.weight = 1.0
        other.score.return_value = ScoreResult(score_action=1.0)
        engine = ScoringEngine(Config(), [other])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.score_laugh is None

    def test_laugh_no_data_result_leaves_score_laugh_none(self):
        # A "no data" laugh result carries only tags (score_funny is None) - the
        # column must stay None, not fall to a misleading 0.
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.protocol import ScoreResult
        laugh = self._laugh_scorer(score_funny=None, tags=["laugh_no_wav"])
        other = MagicMock()
        other.name = "energy"
        other.is_available.return_value = True
        other.weight = 1.0
        other.score.return_value = ScoreResult(score_action=1.0)
        engine = ScoringEngine(Config(), [laugh, other])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        assert clip.score_laugh is None


class TestScoringEngineWeightEdgeCases:
    def _make_scorer(self, score_action=0.0, weight=1.0):
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.is_available.return_value = True
        mock.weight = weight
        mock.score.return_value = ScoreResult(score_action=score_action)
        return mock

    def _make_clip(self):
        from unittest.mock import MagicMock
        clip = MagicMock()
        clip.tags = []
        clip.transcript_excerpt = None
        clip.score_funny = clip.score_dramatic = clip.score_action = 0.0
        clip.score_overall = 0.5   # stale value to verify it is not changed
        clip.description = clip.description_long = ""
        return clip

    def test_all_scorer_weights_zero_clears_overall(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        scorer = self._make_scorer(score_action=1.0, weight=0.0)
        engine = ScoringEngine(Config(), [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # weight_sum == 0 → scores can't be computed; overall is reset to 0.0
        assert clip.score_overall == 0.0

    def test_all_dim_weights_zero_clears_overall(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        cfg = Config()
        cfg.score_funny_weight = 0.0
        cfg.score_dramatic_weight = 0.0
        cfg.score_action_weight = 0.0
        cfg.score_visual_weight = 0.0   # all four axes off → no opinion
        scorer = self._make_scorer(score_action=1.0, weight=1.0)
        engine = ScoringEngine(cfg, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # dim_total == 0 → overall can't be computed; must not leave stale value
        assert clip.score_overall == 0.0


# ---------------------------------------------------------------------------
# Visual axis (Stage 0) - SceneCutScorer feeds Visual, not Action, and moving it
# there must not reshuffle a talk-only clip's ranking ("no drowning").
# ---------------------------------------------------------------------------

class TestVisualAxisPipeline:
    def _seed(self, tmp_path, name, start_ms, end_ms, cut_ms=(), excerpt=None):
        from yuu_clip.db.models import ClipCandidate, SceneBoundary, Video, make_session
        session = make_session(tmp_path / name)
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        for ms in cut_ms:
            session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
        clip = ClipCandidate(
            video_id=v.id, start_ms=start_ms, end_ms=end_ms,
            status="pending", transcript_excerpt=excerpt,
        )
        session.add(clip)
        session.flush()
        return session, clip

    def test_scene_heavy_clip_scores_visual_not_action(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.scenes import SceneCutScorer
        cfg = Config()
        session, clip = self._seed(
            tmp_path, "vis.db", 0, 60_000,
            cut_ms=[10_000, 20_000, 30_000, 40_000, 50_000],
        )
        try:
            ScoringEngine(cfg, [SceneCutScorer(cfg)]).score_clip(clip, session)
        finally:
            session.close()
        assert clip.score_visual > 0.0
        assert clip.score_action == 0.0      # scene cuts no longer leak to Action
        assert clip.score_overall > 0.0      # Visual lifts Overall on its own

    def test_talk_only_overall_unaffected_by_scene_scorer(self, tmp_path):
        # A talk-only clip has no scene cuts, so SceneCutScorer contributes
        # visual=0 and nothing to Action. Its Overall must be byte-identical
        # whether or not the scene scorer runs - the guard that moving cuts off
        # Action never drowns a talk-heavy clip.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.lexicon import LexiconScorer
        from yuu_clip.scoring.scenes import SceneCutScorer
        cfg = Config()
        excerpt = "Player: go go go push push, reload clutch, let's go"

        session_a, clip_a = self._seed(tmp_path, "talk_a.db", 0, 60_000, excerpt=excerpt)
        try:
            ScoringEngine(cfg, [LexiconScorer(cfg)]).score_clip(clip_a, session_a)
            overall_without_scene = clip_a.score_overall
        finally:
            session_a.close()

        session_b, clip_b = self._seed(tmp_path, "talk_b.db", 0, 60_000, excerpt=excerpt)
        try:
            ScoringEngine(cfg, [LexiconScorer(cfg), SceneCutScorer(cfg)]).score_clip(clip_b, session_b)
            overall_with_scene = clip_b.score_overall
        finally:
            session_b.close()

        assert clip_b.score_visual == 0.0
        assert overall_with_scene == pytest.approx(overall_without_scene)


# ---------------------------------------------------------------------------
# Basic description fallback (Stage 02) - no-LLM template so clips aren't blank
# ---------------------------------------------------------------------------

class TestBasicDescriptionFallback:
    def _scorer(self, description=""):
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.name = "energy"
        mock.is_available.return_value = True
        mock.weight = 1.0
        mock.score.return_value = ScoreResult(score_action=0.8, description=description)
        return mock

    def _visual_scorer(self, score_visual=0.8):
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.name = "visual_activity"
        mock.is_available.return_value = True
        mock.weight = 1.0
        mock.score.return_value = ScoreResult(score_visual=score_visual)
        return mock

    def _clip(self, **kw):
        from yuu_clip.db.models import ClipCandidate
        return ClipCandidate(video_id=1, start_ms=0, end_ms=1000, **kw)

    def test_fills_description_and_tags_when_no_scorer_describes(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt="Yuu: we pulled off the heist")
        ScoringEngine(Config(), [self._scorer()]).score_clip(clip, None)
        assert clip.description
        assert "heist" in clip.description
        assert "desc_basic" in clip.tags

    def test_llm_description_wins_and_no_basic_tag(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt="Yuu: we pulled off the heist")
        ScoringEngine(Config(), [self._scorer(description="A daring heist")]).score_clip(clip, None)
        assert clip.description == "A daring heist"
        assert "desc_basic" not in clip.tags

    def test_never_overwrites_user_description(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt="Yuu: we pulled off the heist", description_user="my words")
        ScoringEngine(Config(), [self._scorer()]).score_clip(clip, None)
        assert clip.description_user == "my words"
        assert clip.effective_description == "my words"

    def test_no_excerpt_leaves_description_blank(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt=None)
        ScoringEngine(Config(), [self._scorer()]).score_clip(clip, None)
        assert not clip.description
        assert "desc_basic" not in clip.tags

    def test_basic_tag_dropped_once_a_real_description_lands(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt="Yuu: we pulled off the heist")
        ScoringEngine(Config(), [self._scorer()]).score_clip(clip, None)
        assert "desc_basic" in clip.tags
        # A later run with an LLM description supersedes the template and clears the tag.
        ScoringEngine(Config(), [self._scorer(description="A daring heist")]).score_clip(clip, None)
        assert clip.description == "A daring heist"
        assert "desc_basic" not in clip.tags

    def test_textless_visual_clip_gets_silent_moment_template(self):
        # video-heavy-analysis Stage 03: a textless clip tagged "visual" (Stage 02's
        # visual candidate generator) still earns a template one-liner, unlike a
        # plain no-transcript clip which stays blank.
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt="")
        clip.tags = ["visual", "no_speech"]
        ScoringEngine(Config(), [self._visual_scorer(score_visual=0.8)]).score_clip(clip, None)
        assert clip.description == "Silent visual moment - high on-screen activity"
        assert "desc_basic" in clip.tags

    def test_no_excerpt_no_visual_tag_still_leaves_description_blank(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        clip = self._clip(transcript_excerpt="")
        ScoringEngine(Config(), [self._scorer()]).score_clip(clip, None)
        assert not clip.description
        assert "desc_basic" not in clip.tags


# ---------------------------------------------------------------------------
# ScoringEngine.score_video()
# ---------------------------------------------------------------------------

class TestScoringEngineScoreVideo:
    def _make_scorer(self, score=0.5):
        import unittest.mock as mock

        from yuu_clip.scoring.protocol import ScoreResult
        scorer = mock.MagicMock()
        scorer.is_available.return_value = True
        scorer.weight = 1.0
        scorer.score.return_value = ScoreResult(
            score_funny=score, score_dramatic=score, score_action=score
        )
        return scorer

    def test_score_video_returns_clip_count(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.scoring.engine import ScoringEngine
        session = make_session(tmp_path / "sv.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=120_000)
        session.add(v)
        session.flush()
        for i in range(3):
            session.add(ClipCandidate(video_id=v.id, start_ms=i * 30_000, end_ms=(i + 1) * 30_000))
        session.flush()
        scorer = self._make_scorer(0.7)
        engine = ScoringEngine(Config(), [scorer])
        try:
            count = engine.score_video(v, session)
        finally:
            session.close()
        assert count == 3

    def test_score_video_calls_scorer_for_each_clip(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.scoring.engine import ScoringEngine
        session = make_session(tmp_path / "sv2.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        session.add(ClipCandidate(video_id=v.id, start_ms=0, end_ms=30_000))
        session.add(ClipCandidate(video_id=v.id, start_ms=30_000, end_ms=60_000))
        session.flush()
        scorer = self._make_scorer(0.5)
        engine = ScoringEngine(Config(), [scorer])
        try:
            engine.score_video(v, session)
        finally:
            session.close()
        assert scorer.score.call_count == 2

    def test_score_video_calls_progress_cb(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.scoring.engine import ScoringEngine
        session = make_session(tmp_path / "sv3.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        session.add(ClipCandidate(video_id=v.id, start_ms=0, end_ms=30_000))
        session.add(ClipCandidate(video_id=v.id, start_ms=30_000, end_ms=60_000))
        session.flush()
        scorer = self._make_scorer(0.5)
        engine = ScoringEngine(Config(), [scorer])
        calls = []
        try:
            engine.score_video(v, session, progress_cb=lambda i, t: calls.append((i, t)))
        finally:
            session.close()
        assert calls == [(1, 2), (2, 2)]

    def test_score_video_commits_once_per_clip(self, tmp_path):
        # Commits must land per-clip (not once for the whole batch) so the web
        # server - a separate process/connection - can see scores as they finish.
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.scoring.engine import ScoringEngine
        session = make_session(tmp_path / "sv4.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=90_000)
        session.add(v)
        session.flush()
        for i in range(3):
            session.add(ClipCandidate(video_id=v.id, start_ms=i * 30_000, end_ms=(i + 1) * 30_000))
        session.flush()
        scorer = self._make_scorer(0.5)
        engine = ScoringEngine(Config(), [scorer])
        try:
            with mock.patch.object(session, "commit", wraps=session.commit) as commit_spy:
                engine.score_video(v, session)
        finally:
            session.close()
        assert commit_spy.call_count == 3


class TestScoringEnginePauseGate:
    """The mid-video pause point (UX bug hunt B9): scoring is the sustained-GPU
    stage, so it is where a thermal auto-pause has to be honoured - the between-
    videos check alone gives a single-video run no protection at all."""

    def _video_with_clips(self, tmp_path, db_name, clip_count):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        session = make_session(tmp_path / db_name)
        video = Video(
            path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done",
            duration_ms=clip_count * 30_000,
        )
        session.add(video)
        session.flush()
        for i in range(clip_count):
            session.add(ClipCandidate(video_id=video.id, start_ms=i * 30_000, end_ms=(i + 1) * 30_000))
        session.flush()
        return session, video

    def _engine(self):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.protocol import ScoreResult
        scorer = mock.MagicMock()
        scorer.is_available.return_value = True
        scorer.weight = 1.0
        scorer.score.return_value = ScoreResult(score_funny=0.5, score_dramatic=0.5, score_action=0.5)
        return ScoringEngine(Config(), [scorer])

    def test_pause_gate_called_once_per_clip(self, tmp_path):
        session, video = self._video_with_clips(tmp_path, "pg1.db", 3)
        calls = []
        try:
            self._engine().score_video(video, session, pause_gate=lambda: calls.append(1))
        finally:
            session.close()
        assert len(calls) == 3

    def test_pause_gate_runs_after_the_clip_is_committed(self, tmp_path):
        """A pause that blocks must never strand the just-scored clip uncommitted -
        the whole point is that progress already made survives the hold. Read it
        back over a second connection, which only sees committed rows."""
        from yuu_clip.db.models import ClipCandidate, make_session
        session, video = self._video_with_clips(tmp_path, "pg2.db", 2)
        session.commit()
        observer = make_session(tmp_path / "pg2.db")
        scored_at_gate = []

        def _gate():
            observer.expire_all()
            scored_at_gate.append(
                observer.query(ClipCandidate).filter(ClipCandidate.score_funny > 0).count()
            )

        try:
            self._engine().score_video(video, session, pause_gate=_gate)
        finally:
            observer.close()
            session.close()
        assert scored_at_gate == [1, 2]

    def test_no_pause_gate_scores_every_clip(self, tmp_path):
        session, video = self._video_with_clips(tmp_path, "pg3.db", 2)
        try:
            count = self._engine().score_video(video, session)
        finally:
            session.close()
        assert count == 2
