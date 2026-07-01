from __future__ import annotations

# ---------------------------------------------------------------------------
# AudioEnergyScorer — boundary test
# ---------------------------------------------------------------------------

class TestEnergyBoundary:
    """AudioEnergyScorer clips window is [start_s, end_s) — end second is excluded."""

    def test_energy_query_excludes_end_second(self):
        """When the only energy row sits at second_offset == end_s (outside the window),
        scorer.score() must return the energy_no_data tag, not count that row."""
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        config = Config()
        scorer = AudioEnergyScorer(config)

        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "test.db"
            session = make_session(db_path)
            try:
                v = Video(
                    path="/fake/session.mkv",
                    filename="session.mkv",
                    status="done",
                    duration_ms=120_000,
                )
                session.add(v)
                session.flush()

                track = AudioTrack(
                    video_id=v.id,
                    stream_index=0,
                    label="combined",
                    do_transcribe=True,
                    do_score=True,
                    relevance_weight=1.0,
                )
                session.add(track)
                session.flush()

                # Place one very loud row at exactly end_s (second_offset == 120).
                # If the scorer uses <= it would be included and produce a non-zero score;
                # with the correct < boundary it is excluded and score returns energy_no_data.
                session.add(AudioEnergy(
                    audio_track_id=track.id,
                    second_offset=120,  # == end_s, must be excluded
                    rms_db=10.0,        # loud — would boost score if incorrectly included
                ))
                session.commit()

                clip = MagicMock()
                clip.start_ms = 60_000   # start_s = 60
                clip.end_ms   = 120_000  # end_s   = 120

                # Reload track via session so the ORM relationship is live
                db_track = session.query(AudioTrack).filter_by(id=track.id).one()
                clip.video.audio_tracks = [db_track]

                result = scorer.score(clip, session)
            finally:
                session.close()

        assert "energy_no_data" in result.tags, (
            "Boundary row at second_offset == end_s was incorrectly included in the clip window"
        )


# ---------------------------------------------------------------------------
# SceneCutScorer unit tests
# ---------------------------------------------------------------------------

class TestSceneCutScorer:
    """SceneCutScorer.score() covers 0-duration clip, no cuts, and cuts present."""

    def _make_db_with_video_and_clip(self, tmp_path, start_ms, end_ms):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        db_path = tmp_path / "test.db"
        session = make_session(db_path)
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        clip = ClipCandidate(video_id=v.id, start_ms=start_ms, end_ms=end_ms, status="pending")
        session.add(clip)
        session.flush()
        return session, v, clip

    def test_score_zero_duration_returns_empty(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 0)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action is None   # zero duration → no opinion, not a real zero
        assert result.tags == []

    def test_score_no_scene_boundaries_returns_zero(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action == 0.0
        assert "scenes_scored" not in result.tags
        assert result.notes["cuts_in_clip"] == 0

    def test_score_with_cuts_inside_window(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            # Add 5 scene cuts inside the 1-minute window → 5 cuts/min → score = 0.5
            for ms in [10_000, 20_000, 30_000, 40_000, 50_000]:
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action > 0.0
        assert "scenes_scored" in result.tags
        assert result.notes["cuts_in_clip"] == 5

    def test_score_cut_at_end_ms_excluded(self, tmp_path):
        """A cut at exactly end_ms must not be counted (< end_ms, not <=)."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            session.add(SceneBoundary(video_id=v.id, timecode_ms=60_000))  # at end_ms
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.notes["cuts_in_clip"] == 0

    def test_is_available_true_when_enabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        config.scorer_scenes_enabled = True
        assert SceneCutScorer(config).is_available() is True

    def test_is_available_false_when_disabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        config.scorer_scenes_enabled = False
        assert SceneCutScorer(config).is_available() is False

    def test_score_maxes_at_one(self, tmp_path):
        """score_action must not exceed 1.0 even with very high cut density."""
        from yuu_clip.config import Config
        from yuu_clip.db.models import SceneBoundary
        from yuu_clip.scoring.scenes import SceneCutScorer
        config = Config()
        scorer = SceneCutScorer(config)
        session, v, clip = self._make_db_with_video_and_clip(tmp_path, 0, 60_000)
        try:
            for ms in range(1000, 60_000, 1000):   # 59 cuts in 1 minute
                session.add(SceneBoundary(video_id=v.id, timecode_ms=ms))
            session.flush()
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action <= 1.0


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

    def _make_partial_scorer(self, weight=1.0, **dims):
        """Scorer that emits ONLY the named dimensions (others stay None — no opinion)."""
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


# ---------------------------------------------------------------------------
# AudioEnergyScorer — no-scorable-tracks path
# ---------------------------------------------------------------------------

class TestAudioEnergyScorerNoTracks:
    """AudioEnergyScorer returns energy_no_tracks tag when do_score is False on all tracks."""

    def test_no_scorable_tracks_returns_tag(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        config = Config()
        scorer = AudioEnergyScorer(config)

        with tempfile.TemporaryDirectory() as tmp:
            session = make_session(Path(tmp) / "test.db")
            try:
                v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=60_000)
                session.add(v)
                session.flush()
                track = AudioTrack(
                    video_id=v.id, stream_index=0, label="game_sounds",
                    do_transcribe=False, do_score=False, relevance_weight=0.1
                )
                session.add(track)
                session.flush()

                clip = MagicMock()
                clip.start_ms = 0
                clip.end_ms = 30_000
                db_track = session.query(AudioTrack).filter_by(id=track.id).one()
                clip.video.audio_tracks = [db_track]

                result = scorer.score(clip, session)
            finally:
                session.close()

        assert "energy_no_tracks" in result.tags

    def test_is_available_false_when_disabled(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.energy import AudioEnergyScorer
        config = Config()
        config.scorer_energy_enabled = False
        assert AudioEnergyScorer(config).is_available() is False


# ---------------------------------------------------------------------------
# AudioEnergyScorer — happy path
# ---------------------------------------------------------------------------

class TestAudioEnergyScorerHappyPath:
    """score() with energy rows inside the clip window returns energy_scored tag."""

    def _make_db_with_energy(self, tmp_path, n_rows=30, loud_start=10, loud_end=20,
                              loud_db=10.0, quiet_db=-30.0):
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        session = make_session(tmp_path / "test.db")
        v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=True, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        # Populate the whole track with mostly quiet rows, and louder rows in
        # [loud_start, loud_end) — these are the ones the clip window covers.
        for s in range(n_rows):
            db = loud_db if loud_start <= s < loud_end else quiet_db
            session.add(AudioEnergy(audio_track_id=track.id, second_offset=s, rms_db=db))
        session.flush()

        db_track = session.query(AudioTrack).filter_by(id=track.id).one()

        clip = MagicMock()
        clip.start_ms = loud_start * 1000
        clip.end_ms   = loud_end   * 1000
        clip.video.audio_tracks = [db_track]

        return AudioEnergyScorer(Config()), clip, session

    def test_energy_rows_inside_window_produce_energy_scored_tag(self, tmp_path):
        scorer, clip, session = self._make_db_with_energy(tmp_path)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert "energy_scored" in result.tags

    def test_loud_window_produces_positive_score_action(self, tmp_path):
        scorer, clip, session = self._make_db_with_energy(tmp_path, loud_db=0.0, quiet_db=-60.0)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action > 0.0

    def test_score_action_does_not_exceed_one(self, tmp_path):
        # Clip window is extremely loud; score must be clamped at 1.0
        scorer, clip, session = self._make_db_with_energy(
            tmp_path, loud_db=100.0, quiet_db=-100.0
        )
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert result.score_action <= 1.0

    def test_score_result_includes_notes(self, tmp_path):
        scorer, clip, session = self._make_db_with_energy(tmp_path)
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()
        assert "clip_mean_db" in result.notes
        assert "baseline_db" in result.notes

    def test_quiet_window_in_loud_video_scores_lower(self, tmp_path):
        """A clip at the quiet section of an otherwise loud video scores low."""
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        session = make_session(tmp_path / "test.db")
        v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=True, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        # Most of the video is loud; seconds 0–9 are quiet
        for s in range(30):
            db = -60.0 if s < 10 else 0.0
            session.add(AudioEnergy(audio_track_id=track.id, second_offset=s, rms_db=db))
        session.flush()

        db_track = session.query(AudioTrack).filter_by(id=track.id).one()
        clip = MagicMock()
        clip.start_ms = 0
        clip.end_ms   = 10_000
        clip.video.audio_tracks = [db_track]

        scorer = AudioEnergyScorer(Config())
        try:
            result = scorer.score(clip, session)
        finally:
            session.close()

        # Score should be 0.0 (below baseline) — quiet clip in a loud video
        assert result.score_action == 0.0


# ---------------------------------------------------------------------------
# AudioEnergy — weighted per-second series and baseline
# ---------------------------------------------------------------------------

class TestEnergyWeightedSeries:
    """_weighted_second_series collapses tracks per second using relevance_weight."""

    def _row(self, track_id, second_offset, rms_db):
        from unittest.mock import MagicMock
        row = MagicMock()
        row.audio_track_id = track_id
        row.second_offset = second_offset
        row.rms_db = rms_db
        return row

    def _track(self, track_id, weight):
        from unittest.mock import MagicMock
        track = MagicMock()
        track.id = track_id
        track.relevance_weight = weight
        return track

    def test_weighted_average_per_second(self):
        from yuu_clip.scoring.energy import _weighted_second_series
        track_map = {1: self._track(1, 2.0), 2: self._track(2, 0.5)}
        rows = [self._row(1, 0, 10.0), self._row(2, 0, -10.0)]
        series = _weighted_second_series(rows, track_map)
        # (2.0*10 + 0.5*-10) / 2.5 = 15 / 2.5 = 6.0
        assert series == [6.0]

    def test_one_value_per_second_regardless_of_track_count(self):
        from yuu_clip.scoring.energy import _weighted_second_series
        track_map = {1: self._track(1, 1.0), 2: self._track(2, 1.0)}
        rows = [self._row(1, 0, 4.0), self._row(2, 0, 8.0), self._row(1, 1, 2.0)]
        series = _weighted_second_series(rows, track_map)
        assert series == [6.0, 2.0]   # second 0 averaged, second 1 single track

    def test_unknown_track_defaults_to_weight_one(self):
        from yuu_clip.scoring.energy import _weighted_second_series
        rows = [self._row(99, 0, 5.0)]
        assert _weighted_second_series(rows, {}) == [5.0]


class TestEnergyBaseline:
    def test_baseline_is_mean_plus_std(self):
        from yuu_clip.scoring.energy import _compute_baseline
        assert _compute_baseline([0.0, 0.0, 2.0, 2.0]) == (1.0, 2.0)

    def test_baseline_none_for_constant_series(self):
        from yuu_clip.scoring.energy import _compute_baseline
        assert _compute_baseline([3.0, 3.0, 3.0]) is None

    def test_baseline_none_for_under_two_values(self):
        from yuu_clip.scoring.energy import _compute_baseline
        assert _compute_baseline([5.0]) is None


# ---------------------------------------------------------------------------
# LaughScorer
# ---------------------------------------------------------------------------

class TestLaughScorerTranscript:
    """_score_transcript_text and transcript mode score() behaviour."""

    def _score(self, text, duration_s=30.0):
        from yuu_clip.scoring.laugh import _score_transcript_text
        return _score_transcript_text(text, duration_s)

    def test_no_laugh_markers_returns_zero(self):
        assert self._score("this is a normal sentence") == 0.0

    def test_empty_text_returns_zero(self):
        assert self._score("") == 0.0

    def test_zero_duration_returns_zero(self):
        assert self._score("[laughs]", duration_s=0.0) == 0.0

    def test_whisper_bracket_marker_detected(self):
        assert self._score("[laughs]") > 0.0

    def test_laughter_marker_detected(self):
        assert self._score("[laughter]") > 0.0

    def test_chuckles_marker_detected(self):
        assert self._score("[chuckles]") > 0.0

    def test_haha_detected(self):
        assert self._score("haha that was amazing") > 0.0

    def test_hahaha_detected(self):
        assert self._score("hahaha") > 0.0

    def test_lmao_detected(self):
        assert self._score("lmao did you see that") > 0.0

    def test_score_bounded_at_one(self):
        many_laughs = "[laughs] " * 50
        assert self._score(many_laughs, duration_s=10.0) == 1.0

    def test_higher_density_produces_higher_score(self):
        dense = "[laughs] [laughs] [laughs] [laughs]"
        sparse = "[laughs]"
        assert self._score(dense, 30.0) > self._score(sparse, 30.0)

    def test_same_count_shorter_clip_scores_higher(self):
        assert self._score("[laughs]", 15.0) > self._score("[laughs]", 60.0)

    def _make_scorer(self, mode="transcript", enabled=True, weight=1.5):
        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = enabled
        cfg.scorer_laugh_mode    = mode
        cfg.scorer_laugh_weight  = weight
        return LaughScorer(cfg)

    def _make_clip(self, excerpt=""):
        from unittest.mock import MagicMock
        c = MagicMock()
        c.id = 1
        c.start_ms = 0
        c.end_ms   = 30_000
        c.transcript_excerpt = excerpt
        return c

    def test_is_available_true_in_transcript_mode(self):
        assert self._make_scorer(mode="transcript").is_available() is True

    def test_is_available_false_when_disabled(self):
        assert self._make_scorer(enabled=False).is_available() is False

    def test_no_transcript_returns_no_transcript_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt=None), None)
        assert "laugh_no_transcript" in result.tags

    def test_empty_transcript_returns_no_transcript_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt=""), None)
        assert "laugh_no_transcript" in result.tags

    def test_laugh_in_transcript_returns_laugh_transcript_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="[laughs] that was funny"), None)
        assert "laugh_transcript" in result.tags

    def test_laugh_boosts_score_funny(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="[laughs] [laughs] [laughs]"), None)
        assert result.score_funny > 0.0

    def test_notes_include_laugh_count(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="[laughs] [chuckles] haha"), None)
        assert result.notes["laugh_count"] == 3

    def test_no_laugh_markers_score_is_zero(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip(excerpt="nothing funny happened"), None)
        assert result.score_funny == 0.0


class TestLaughScorerAudio:
    """audio mode: no WAV path → laugh_no_wav tag."""

    def _make_scorer(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        return LaughScorer(cfg)

    def _make_clip_no_wav(self):
        from unittest.mock import MagicMock
        track = MagicMock()
        track.id               = 1
        track.do_score         = True
        track.relevance_weight = 1.0
        track.extracted_path   = "/nonexistent/track.wav"

        clip = MagicMock()
        clip.id        = 1
        clip.start_ms  = 0
        clip.end_ms    = 30_000
        clip.video.audio_tracks = [track]
        return clip

    def test_missing_wav_returns_no_wav_tag(self):
        scorer = self._make_scorer()
        result = scorer.score(self._make_clip_no_wav(), None)
        assert "laugh_no_wav" in result.tags

    def test_no_scored_tracks_returns_no_wav_tag(self):
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        scorer = LaughScorer(cfg)

        track = MagicMock()
        track.do_score = False
        clip = MagicMock()
        clip.id = 1
        clip.video.audio_tracks = [track]
        result = scorer.score(clip, None)
        assert "laugh_no_wav" in result.tags

    def test_is_available_audio_mode_when_av_present(self):
        import sys
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        scorer = LaughScorer(cfg)
        fake_av = mock.MagicMock()
        fake_np = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"av": fake_av, "numpy": fake_np}):
            assert scorer.is_available() is True

    def test_is_available_audio_mode_missing_deps_returns_false(self):
        import sys
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled = True
        cfg.scorer_laugh_mode    = "audio"
        scorer = LaughScorer(cfg)
        with mock.patch.dict(sys.modules, {"av": None, "numpy": None}):
            assert scorer.is_available() is False


class TestLaughScorerModel:
    """model mode: availability checks and missing deps path."""

    def _make_scorer(self, model_id="MIT/ast-finetuned-audioset-10-10-0.4593"):
        from yuu_clip.config import Config
        from yuu_clip.scoring.laugh import LaughScorer
        cfg = Config()
        cfg.scorer_laugh_enabled  = True
        cfg.scorer_laugh_mode     = "model"
        cfg.scorer_laugh_model_id = model_id
        return LaughScorer(cfg)

    def test_no_model_id_returns_false(self):
        scorer = self._make_scorer(model_id="")
        assert scorer.is_available() is False

    def test_missing_transformers_returns_false(self):
        import sys
        import unittest.mock as mock
        scorer = self._make_scorer()
        with mock.patch.dict(sys.modules, {"transformers": None, "torch": None}):
            assert scorer.is_available() is False

    def test_deps_present_returns_true(self):
        import sys
        import unittest.mock as mock
        scorer = self._make_scorer()
        fake_tr = mock.MagicMock()
        fake_th = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"transformers": fake_tr, "torch": fake_th}):
            assert scorer.is_available() is True


class TestDetectLaughRhythm:
    """_detect_laugh_rhythm pure function unit tests."""

    def _rhythm(self, samples, sr, start_ms=0, end_ms=None):
        import numpy as np

        from yuu_clip.scoring.laugh import _detect_laugh_rhythm
        arr = np.array(samples, dtype=np.float32)
        if end_ms is None:
            end_ms = len(arr) * 1000 // sr
        return _detect_laugh_rhythm(arr, sr, start_ms, end_ms)

    def test_too_short_returns_zero(self):
        # < 1 s of audio (sr=16000, 0.5 s)
        import numpy as np
        samples = np.zeros(8000, dtype=np.float32)
        assert self._rhythm(samples, 16000, 0, 500) == 0.0

    def test_silent_audio_returns_low_score(self):
        import numpy as np
        # 30 s of silence: no meaningful spectral content
        samples = np.zeros(16000 * 30, dtype=np.float32)
        result = self._rhythm(samples, 16000, 0, 30_000)
        assert result <= 0.5   # may be nonzero due to FFT noise floor

    def test_score_bounded_at_one(self):
        import numpy as np
        # Loud 8 Hz burst signal: pure sinusoid in the laugh band
        t = np.linspace(0, 30, 16000 * 30, endpoint=False)
        samples = np.sin(2 * np.pi * 8 * t).astype(np.float32)
        result = self._rhythm(samples, 16000, 0, 30_000)
        assert result <= 1.0


# ---------------------------------------------------------------------------
# Pearson correlation
# ---------------------------------------------------------------------------

class TestPearsonCorrelation:
    """_pearson correlation helper covers edge cases used in overlap detection."""

    def _pearson(self, a, b):
        from yuu_clip.analyze.overlap import _pearson
        return _pearson(a, b)

    def test_identical_sequences_returns_one(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert abs(self._pearson(a, a) - 1.0) < 1e-9

    def test_perfectly_anticorrelated_returns_minus_one(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        b = [5.0, 4.0, 3.0, 2.0, 1.0]
        assert abs(self._pearson(a, b) - (-1.0)) < 1e-9

    def test_short_sequence_returns_zero(self):
        assert self._pearson([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == 0.0

    def test_constant_sequences_returns_one(self):
        # Both all-same: da == 0 and db == 0 → returns 1.0
        a = [0.5, 0.5, 0.5, 0.5, 0.5]
        assert self._pearson(a, a) == 1.0

    def test_one_constant_other_varying_returns_zero(self):
        a = [0.5, 0.5, 0.5, 0.5, 0.5]
        b = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert self._pearson(a, b) == 0.0

    def test_unequal_lengths_uses_shorter(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        b = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = self._pearson(a, b)
        assert abs(result - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# LLMScorer — is_available() branches
# ---------------------------------------------------------------------------

class TestLLMScorerIsAvailable:
    """LLMScorer.is_available() covers ollama_enabled gate, llamacpp checks, ollama checks."""

    def _make_config(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def _scorer(self, **config_overrides):
        from yuu_clip.scoring.llm import LLMScorer
        return LLMScorer(self._make_config(**config_overrides))

    def test_ollama_enabled_false_returns_false_immediately(self):
        scorer = self._scorer(ollama_enabled=False, llm_backend="llamacpp")
        assert scorer.is_available() is False

    def test_llamacpp_empty_model_path_returns_false(self):
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path="")
        assert scorer.is_available() is False

    def test_llamacpp_nonexistent_path_returns_false(self, tmp_path):
        scorer = self._scorer(
            llm_backend="llamacpp",
            llm_model_path=str(tmp_path / "nonexistent.gguf"),
        )
        assert scorer.is_available() is False

    def test_llamacpp_path_exists_but_import_fails_returns_false(self, tmp_path):
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        import unittest.mock as mock
        with mock.patch.dict("sys.modules", {"llama_cpp": None}):
            assert scorer.is_available() is False

    def test_llamacpp_all_checks_pass_returns_true(self, tmp_path):
        import sys
        import unittest.mock as mock
        gguf = tmp_path / "model.gguf"
        gguf.write_bytes(b"fake")
        scorer = self._scorer(llm_backend="llamacpp", llm_model_path=str(gguf))
        fake_module = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"llama_cpp": fake_module}):
            scorer._available = None
            result = scorer.is_available()
        assert result is True

    def test_ollama_backend_unreachable_returns_false(self):
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="ollama")
        with mock.patch("yuu_clip.scoring.llm_client.OllamaClient.available",
                        return_value=(False, "connection refused")):
            scorer._available = None
            result = scorer.is_available()
        assert result is False

    def test_ollama_backend_reachable_returns_true(self):
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="ollama")
        with mock.patch("yuu_clip.scoring.llm_client.OllamaClient.available",
                        return_value=(True, "")):
            scorer._available = None
            result = scorer.is_available()
        assert result is True

    def test_is_available_caches_result(self, tmp_path):
        """Second call to is_available() must not redo the availability check."""
        import unittest.mock as mock
        scorer = self._scorer(llm_backend="ollama")
        call_count = 0
        def counting_list():
            nonlocal call_count
            call_count += 1
            return []
        with mock.patch("ollama.Client") as mock_client:
            mock_client.return_value.list.side_effect = counting_list
            scorer.is_available()
            scorer.is_available()
        assert call_count == 1


# ---------------------------------------------------------------------------
# LLMScorer — _parse() score clamping
# ---------------------------------------------------------------------------

class TestLLMScorerParse:
    """_parse() clamps scores to [0, 1] and passes through other keys."""

    def _parse(self, data: dict) -> dict:
        import json

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        return scorer._parse(json.dumps(data))

    def test_scores_within_range_unchanged(self):
        result = self._parse({"score_funny": 0.5, "score_dramatic": 0.3, "score_action": 0.8})
        assert abs(result["score_funny"] - 0.5) < 1e-9
        assert abs(result["score_dramatic"] - 0.3) < 1e-9
        assert abs(result["score_action"] - 0.8) < 1e-9

    def test_score_above_one_clamped_to_one(self):
        result = self._parse({"score_funny": 1.5, "score_dramatic": 2.0, "score_action": 99.0})
        assert result["score_funny"] == 1.0
        assert result["score_dramatic"] == 1.0
        assert result["score_action"] == 1.0

    def test_score_below_zero_clamped_to_zero(self):
        result = self._parse({"score_funny": -0.5, "score_dramatic": -1.0, "score_action": -99.0})
        assert result["score_funny"] == 0.0
        assert result["score_dramatic"] == 0.0
        assert result["score_action"] == 0.0

    def test_missing_score_keys_not_added(self):
        result = self._parse({"description": "test"})
        assert "score_funny" not in result
        assert result["description"] == "test"

    def test_description_keys_preserved(self):
        result = self._parse({
            "score_funny": 0.5, "score_dramatic": 0.5, "score_action": 0.5,
            "description": "A moment", "description_long": "Longer text here",
        })
        assert result["description"] == "A moment"
        assert result["description_long"] == "Longer text here"


# ---------------------------------------------------------------------------
# LLMScorer — score() result paths
# ---------------------------------------------------------------------------

class TestLLMScorerScore:
    """score() — no-transcript, error, and success paths."""

    def _make_scorer(self, backend_response=None):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        if backend_response is not None:
            scorer._call_llm = mock.MagicMock(return_value=backend_response)
        return scorer

    def _make_clip(self, excerpt=""):
        import unittest.mock as mock
        clip = mock.MagicMock()
        clip.id = 1
        clip.transcript_excerpt = excerpt
        return clip

    def test_no_transcript_returns_llm_no_transcript_tag(self):
        scorer = self._make_scorer()
        clip = self._make_clip(excerpt="")
        result = scorer.score(clip, None)
        assert "llm_no_transcript" in result.tags
        assert result.score_funny is None   # no transcript → no opinion, not a real zero

    def test_none_transcript_returns_llm_no_transcript_tag(self):
        scorer = self._make_scorer()
        clip = self._make_clip(excerpt=None)
        result = scorer.score(clip, None)
        assert "llm_no_transcript" in result.tags

    def test_backend_exception_returns_llm_error_tag(self):
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        scorer = LLMScorer(Config())
        scorer._call_llm = mock.MagicMock(side_effect=RuntimeError("backend down"))
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags
        assert result.score_funny is None   # backend error → no opinion, not a real zero

    def test_invalid_json_returns_llm_error_tag(self):
        scorer = self._make_scorer(backend_response="not json {{{{")
        clip = self._make_clip(excerpt="some transcript text")
        result = scorer.score(clip, None)
        assert "llm_error" in result.tags

    def test_successful_score_populates_all_fields(self):
        import json
        payload = {
            "score_funny": 0.7, "score_dramatic": 0.4, "score_action": 0.2,
            "description": "A funny moment", "description_long": "Very detailed text",
        }
        scorer = self._make_scorer(backend_response=json.dumps(payload))
        clip = self._make_clip(excerpt="transcript here")
        result = scorer.score(clip, None)
        assert "llm_scored" in result.tags
        assert abs(result.score_funny - 0.7) < 1e-6
        assert abs(result.score_dramatic - 0.4) < 1e-6
        assert abs(result.score_action - 0.2) < 1e-6
        assert result.description == "A funny moment"
        assert result.description_long == "Very detailed text"

    def test_out_of_range_scores_clamped(self):
        import json
        payload = {"score_funny": 2.0, "score_dramatic": -1.0, "score_action": 0.5}
        scorer = self._make_scorer(backend_response=json.dumps(payload))
        clip = self._make_clip(excerpt="transcript here")
        result = scorer.score(clip, None)
        assert result.score_funny == 1.0
        assert result.score_dramatic == 0.0

    def test_success_notes_include_model_id_for_llamacpp(self):
        import json
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        cfg = Config()
        cfg.llm_backend = "llamacpp"
        cfg.llm_model_path = "/models/llama3.gguf"
        scorer = LLMScorer(cfg)
        scorer._call_llm = mock.MagicMock(return_value=json.dumps({"score_funny": 0.5}))
        clip = self._make_clip(excerpt="text")
        result = scorer.score(clip, None)
        assert result.notes.get("model") == "/models/llama3.gguf"

    def test_success_notes_include_model_id_for_ollama(self):
        import json
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.llm import LLMScorer
        cfg = Config()
        cfg.llm_backend = "ollama"
        cfg.ollama_model = "llama3.1:8b"
        scorer = LLMScorer(cfg)
        scorer._call_llm = mock.MagicMock(return_value=json.dumps({"score_funny": 0.5}))
        clip = self._make_clip(excerpt="text")
        result = scorer.score(clip, None)
        assert result.notes.get("model") == "llama3.1:8b"


# ---------------------------------------------------------------------------
# Coverage gaps — pure-function and edge-case paths
# ---------------------------------------------------------------------------

class TestPrependContext:
    def _pp(self, system, context):
        from yuu_clip.scoring.llm import _prepend_context
        return _prepend_context(system, context)

    def test_with_context_prepends_and_separates(self):
        result = self._pp("SYSTEM", "CONTEXT")
        assert result == "CONTEXT\n\nSYSTEM"

    def test_empty_context_returns_system_unchanged(self):
        assert self._pp("SYSTEM", "") == "SYSTEM"

    def test_none_context_not_prepended(self):
        # context_text="" is the expected sentinel; None is not a valid call, but
        # the falsy branch must still return just the system prompt.
        assert self._pp("SYSTEM", None) == "SYSTEM"


class TestAudioEnergyScorerIsAvailable:
    def test_is_available_false_when_av_missing(self):
        import sys
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.energy import AudioEnergyScorer
        cfg = Config()
        cfg.scorer_energy_enabled = True
        scorer = AudioEnergyScorer(cfg)
        with mock.patch.dict(sys.modules, {"av": None, "numpy": None}):
            assert scorer.is_available() is False

    def test_is_available_true_when_deps_present(self):
        import sys
        import unittest.mock as mock

        from yuu_clip.config import Config
        from yuu_clip.scoring.energy import AudioEnergyScorer
        cfg = Config()
        cfg.scorer_energy_enabled = True
        scorer = AudioEnergyScorer(cfg)
        fake_av = mock.MagicMock()
        fake_np = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"av": fake_av, "numpy": fake_np}):
            assert scorer.is_available() is True


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
        scorer = self._make_scorer(score_action=1.0, weight=1.0)
        engine = ScoringEngine(cfg, [scorer])
        clip = self._make_clip()
        engine.score_clip(clip, None)
        # dim_total == 0 → overall can't be computed; must not leave stale value
        assert clip.score_overall == 0.0


class TestComputeScenesIdempotent:
    def test_skips_if_boundaries_already_exist(self, tmp_path):
        from yuu_clip.db.models import SceneBoundary, Video, make_session
        from yuu_clip.scoring.scenes import compute_scenes
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        session.add(SceneBoundary(video_id=v.id, timecode_ms=5_000))
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript")
        finally:
            session.close()
        assert result == 0


# ---------------------------------------------------------------------------
# Auto-approve endpoint
# ---------------------------------------------------------------------------

class TestAutoApprove:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_approves_pending_clips_above_threshold(self, client):
        vid_id = self._vid_id(client)
        # conftest seeds one pending clip with score 0.85
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.8})
        assert r.status_code == 200
        assert r.json()["approved"] == 1

    def test_does_not_approve_below_threshold(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99})
        assert r.status_code == 200
        assert r.json()["approved"] == 0

    def test_does_not_re_approve_already_approved(self, client):
        vid_id = self._vid_id(client)
        # conftest seeds one approved clip (score 0.60) — threshold 0.5 would match it
        # but it's already approved, not pending, so it should be ignored
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 200
        # only the pending clip with score 0.85 qualifies; rejected/approved are skipped
        assert r.json()["approved"] == 1

    def test_invalid_threshold_above_one(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 1.5})
        assert r.status_code == 400

    def test_invalid_threshold_below_zero(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": -0.1})
        assert r.status_code == 400

    def test_invalid_score_field(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.5, "score_field": "nonexistent"})
        assert r.status_code == 400

    def test_valid_sub_score_fields(self, client):
        vid_id = self._vid_id(client)
        for field in ("funny", "dramatic", "action"):
            r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99, "score_field": field})
            assert r.status_code == 200

    def test_video_not_found(self, client):
        r = client.post("/api/videos/99999/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Windower (_silence_window) unit tests
# ---------------------------------------------------------------------------

class TestSilenceWindow:
    """_silence_window boundary conditions and split logic."""

    def _seg(self, start_ms, end_ms, text="x"):
        from unittest.mock import MagicMock
        s = MagicMock()
        s.start_ms = start_ms
        s.end_ms = end_ms
        s.text = text
        return s

    def _window(self, segments, silence_ms=3000, min_ms=5000, hard_ms=180_000):
        from yuu_clip.segments.windower import _silence_window
        return _silence_window(segments, silence_ms, min_ms, hard_ms)

    def test_empty_segments_returns_empty(self):
        assert self._window([]) == []

    def test_single_segment_too_short_dropped(self):
        segs = [self._seg(0, 2000)]  # 2 s < min_ms=5000
        assert self._window(segs) == []

    def test_single_segment_long_enough_kept(self):
        segs = [self._seg(0, 10_000)]  # 10 s > min_ms=5000
        result = self._window(segs)
        assert len(result) == 1
        assert result[0][0] == 0
        assert result[0][1] == 10_000

    def test_silence_gap_creates_two_windows(self):
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(15_000, 25_000, "second"),  # 5 s gap >= silence_ms=3000
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert result[0][1] == 10_000
        assert result[1][0] == 15_000

    def test_small_gap_merges_into_one_window(self):
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(11_000, 21_000, "second"),  # 1 s gap < silence_ms=3000
        ]
        result = self._window(segs)
        assert len(result) == 1
        assert result[0][1] == 21_000

    def test_hard_split_breaks_long_window(self):
        # Two segments forming a 200 s window — exceeds hard_split_ms=180_000
        segs = [
            self._seg(0, 100_000, "long first part"),
            self._seg(101_000, 201_000, "long second part"),
        ]
        result = self._window(segs, hard_ms=180_000)
        # hard_split fires during the second segment, creating two candidates
        assert len(result) == 2
        assert "hard_split" in result[0][3]

    def test_long_silence_tag_added(self):
        """A silence >= 10 s adds 'long_silence_before' tag to the new window."""
        segs = [
            self._seg(0, 10_000, "before"),
            self._seg(25_000, 35_000, "after"),  # 15 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert "long_silence_before" in result[1][3]

    def test_window_texts_collected(self):
        segs = [
            self._seg(0, 5_000, "hello"),
            self._seg(5_500, 10_500, "world"),
        ]
        result = self._window(segs, silence_ms=3000)
        assert len(result) == 1
        seg_texts = [s.text for s in result[0][2]]
        assert "hello" in seg_texts
        assert "world" in seg_texts

    def test_overlapping_segment_does_not_shrink_win_end(self):
        # Segment B overlaps and ends before segment A — win_end must not go backwards.
        # Without the fix, win_end drops to 4000 and the subsequent gap becomes
        # 6000-4000=2000 ms which is below silence_ms=3000, merging what should split.
        segs = [
            self._seg(0, 10_000, "A"),       # win_end → 10000
            self._seg(3_000, 4_000, "B"),    # overlaps A; must not drop win_end to 4000
            self._seg(14_000, 24_000, "C"),  # 4 s gap from real win_end (10000) → split
        ]
        result = self._window(segs, silence_ms=3000, min_ms=5000)
        assert len(result) == 2, "overlapping inner segment must not suppress a later silence split"
        assert result[0][1] == 10_000
        assert result[1][0] == 14_000


# ---------------------------------------------------------------------------
# windower.generate_candidates — public API with a real DB session
# ---------------------------------------------------------------------------

class TestGenerateCandidates:
    """generate_candidates produces ClipCandidates from Transcript + TranscriptSegments."""

    def _setup_db(self, tmp_path, do_transcribe=True):
        from yuu_clip.db.models import (
            AudioTrack,
            Transcript,
            Video,
            make_session,
        )
        db_path = tmp_path / "test.db"
        session = make_session(db_path)

        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv",
                  status="done", duration_ms=600_000)
        session.add(v)
        session.flush()

        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=do_transcribe, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()

        return session, v, tx

    def _add_seg(self, session, tx_id, start_ms, end_ms, text="x"):
        from yuu_clip.db.models import TranscriptSegment
        session.add(TranscriptSegment(
            transcript_id=tx_id, start_ms=start_ms, end_ms=end_ms, text=text,
        ))

    def test_empty_transcripts_returns_empty_list(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        try:
            result = generate_candidates(v, [], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_non_transcribable_track_ignored(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path, do_transcribe=False)
        # Add segments — they should be ignored because do_transcribe=False
        self._add_seg(session, tx.id, 0, 10_000)
        session.flush()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_segments_shorter_than_min_clip_dropped(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # 2-second segment, default min_clip_ms = 5000
        self._add_seg(session, tx.id, 0, 2_000, "short")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert result == []

    def test_long_segment_produces_one_candidate(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 30_000, "hello world")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) == 1
        assert result[0].start_ms == 0
        assert result[0].end_ms == 30_000
        assert result[0].video_id == v.id
        assert result[0].status == "pending"

    def test_silence_gap_produces_two_candidates(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # Two clusters each > min_clip_ms (15 s), separated by > silence_threshold_ms (3 s)
        # Cluster A: 0 – 20 000 ms  (4 × 5 s segments)
        for i in range(4):
            self._add_seg(session, tx.id, i * 5_000, (i + 1) * 5_000, f"a{i}")
        # Cluster B: 30 000 – 50 000 ms
        for i in range(4):
            offset = 30_000 + i * 5_000
            self._add_seg(session, tx.id, offset, offset + 5_000, f"b{i}")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) == 2
        assert result[0].end_ms < result[1].start_ms

    def test_transcript_excerpt_joins_segment_texts(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 10_000, "hello")
        self._add_seg(session, tx.id, 11_000, 20_000, "world")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) >= 1
        # Both words should appear in at least one excerpt
        all_text = " ".join(c.transcript_excerpt or "" for c in result)
        assert "hello" in all_text
        assert "world" in all_text

    def test_candidates_added_to_session(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 30_000, "content")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
            session.commit()
            count = session.query(ClipCandidate).count()
        finally:
            session.close()
        assert count == len(result)
        assert count >= 1


# ---------------------------------------------------------------------------
# Clip timing
# ---------------------------------------------------------------------------

class TestClipTiming:
    """PATCH /api/clips/{id}/timing — stores start_offset and end_offset."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_timing_offsets_returned_in_response(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": 2.5, "end_offset": -1.0,
        })
        assert r.status_code == 200
        d = r.json()
        assert abs(d["start_offset"] - 2.5) < 1e-6
        assert abs(d["end_offset"] - (-1.0)) < 1e-6

    def test_timing_offsets_persisted(self, client):
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 3.0, "end_offset": 0.0})
        d = client.get(f"/api/clips/{clip_id}").json()
        assert abs(d["start_offset"] - 3.0) < 1e-6
        assert d["end_offset"] == 0.0

    def test_clip_detail_includes_offset_fields(self, client):
        clip_id = self._first_clip_id(client)
        d = client.get(f"/api/clips/{clip_id}").json()
        assert "start_offset" in d
        assert "end_offset" in d

    def test_timing_patch_404(self, client):
        r = client.patch("/api/clips/99999/timing", json={"start_offset": 0.0, "end_offset": 0.0})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# overlap.detect_transcript_overlap
# ---------------------------------------------------------------------------

class TestDetectTranscriptOverlapIntegration:
    def _setup(self, tmp_path):
        from yuu_clip.db.models import (
            Video,
            make_session,
        )
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        return session, v

    def _add_track(self, session, video_id, label, do_score=True):
        from yuu_clip.db.models import AudioTrack
        t = AudioTrack(
            video_id=video_id, stream_index=len(label), label=label,
            do_transcribe=True, do_score=do_score, relevance_weight=1.0,
        )
        session.add(t)
        session.flush()
        return t

    def _add_transcript(self, session, track_id, words):
        from yuu_clip.db.models import Transcript, TranscriptSegment
        tx = Transcript(audio_track_id=track_id, model_name="base")
        session.add(tx)
        session.flush()
        # One segment per word group — space out timestamps
        for i, word in enumerate(words):
            session.add(TranscriptSegment(
                transcript_id=tx.id,
                start_ms=i * 1000, end_ms=(i + 1) * 1000,
                text=word,
            ))
        session.flush()
        return tx

    def test_no_combined_track_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        spec = self._add_track(session, v.id, "player_voice")
        self._add_transcript(session, spec.id, ["hello"] * 25)
        try:
            result = detect_transcript_overlap([spec], session)
        finally:
            session.close()
        assert result is False

    def test_not_enough_combined_words_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        spec = self._add_track(session, v.id, "player_voice")
        # Only 5 unique words in combined — below the 20-word threshold
        self._add_transcript(session, comb.id, ["one", "two", "three", "four", "five"])
        self._add_transcript(session, spec.id, ["one", "two", "three"] * 10)
        try:
            result = detect_transcript_overlap([comb, spec], session)
        finally:
            session.close()
        assert result is False

    def test_high_overlap_disables_specialized_track(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        spec = self._add_track(session, v.id, "player_voice")
        # 25 purely alphabetic unique words — _word_set only keeps [a-z'] tokens
        combined_words = [chr(ord('a') + i) * 4 for i in range(25)]  # aaaa, bbbb, ...
        self._add_transcript(session, comb.id, combined_words)
        # Specialized transcript is 100% contained in combined
        self._add_transcript(session, spec.id, combined_words[:10])
        try:
            result = detect_transcript_overlap([comb, spec], session)
            assert result is True
            assert spec.do_score is False
            assert comb.do_transcribe is True
            assert comb.do_score is True
        finally:
            session.close()

    def test_no_overlap_leaves_specialized_track_enabled(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        spec = self._add_track(session, v.id, "player_voice")
        # Disjoint vocabularies: "ca" prefix vs "sb" prefix — zero word overlap
        combined_words = ["ca" + chr(ord('a') + i) for i in range(25)]
        spec_words     = ["sb" + chr(ord('a') + i) for i in range(25)]
        self._add_transcript(session, comb.id, combined_words)
        self._add_transcript(session, spec.id, spec_words)
        try:
            result = detect_transcript_overlap([comb, spec], session)
        finally:
            session.close()
        assert result is False
        assert spec.do_score is True

    def test_no_specialized_tracks_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        self._add_transcript(session, comb.id, [f"w{i}" for i in range(25)])
        try:
            result = detect_transcript_overlap([comb], session)
        finally:
            session.close()
        assert result is False


# ---------------------------------------------------------------------------
# _silence_window — tag content
# ---------------------------------------------------------------------------

class TestSilenceWindowTags:
    def _seg(self, start_ms, end_ms, text="x"):
        from unittest.mock import MagicMock
        s = MagicMock()
        s.start_ms = start_ms
        s.end_ms = end_ms
        s.text = text
        return s

    def _window(self, segments, silence_ms=3000, min_ms=5000, hard_ms=180_000):
        from yuu_clip.segments.windower import _silence_window
        return _silence_window(segments, silence_ms, min_ms, hard_ms)

    def test_flushed_window_carries_silence_gap_tag(self):
        """The first window closed by a silence gap should carry a silence_Xs tag."""
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(18_000, 28_000, "second"),  # 8 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        # First window flushed with e.g. "silence_8s"
        assert any("silence_" in t for t in result[0][3])

    def test_new_window_after_silence_carries_after_silence_tag(self):
        """The second window opened after a silence gap should carry an after_silence_Xs tag."""
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(18_000, 28_000, "second"),  # 8 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert any("after_silence_" in t for t in result[1][3])

    def test_second_window_after_hard_split_carries_after_hard_split_tag(self):
        """The window opened after a hard split must carry the after_hard_split tag."""
        segs = [
            self._seg(0, 100_000, "part A"),
            self._seg(101_000, 201_000, "part B"),
        ]
        result = self._window(segs, hard_ms=180_000)
        assert len(result) == 2
        assert "after_hard_split" in result[1][3]


# ---------------------------------------------------------------------------
# LLMClient factory — make_client() routing
# ---------------------------------------------------------------------------

class TestMakeClient:
    def _cfg(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_ollama_disabled_returns_null_client(self):
        from yuu_clip.scoring.llm_client import NullLLMClient, make_client
        client = make_client(self._cfg(ollama_enabled=False))
        assert isinstance(client, NullLLMClient)

    def test_llamacpp_backend_returns_llamacpp_client(self):
        from yuu_clip.scoring.llm_client import LlamaCppClient, make_client
        client = make_client(self._cfg(ollama_enabled=True, llm_backend="llamacpp"))
        assert isinstance(client, LlamaCppClient)

    def test_claude_backend_returns_claude_client(self):
        from yuu_clip.scoring.llm_client import ClaudeClient, make_client
        client = make_client(self._cfg(ollama_enabled=True, llm_backend="claude"))
        assert isinstance(client, ClaudeClient)

    def test_ollama_backend_returns_ollama_client(self):
        from yuu_clip.scoring.llm_client import OllamaClient, make_client
        client = make_client(self._cfg(ollama_enabled=True, llm_backend="ollama"))
        assert isinstance(client, OllamaClient)

    def test_unknown_backend_falls_back_to_ollama(self):
        from yuu_clip.scoring.llm_client import OllamaClient, make_client
        client = make_client(self._cfg(ollama_enabled=True, llm_backend="unknown"))
        assert isinstance(client, OllamaClient)


# ---------------------------------------------------------------------------
# ClaudeClient.available()
# ---------------------------------------------------------------------------

class TestClaudeClientAvailable:
    def _client(self, **overrides):
        from yuu_clip.config import Config
        from yuu_clip.scoring.llm_client import ClaudeClient
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return ClaudeClient(cfg)

    def test_no_api_key_returns_false(self):
        c = self._client(claude_api_key="")
        ok, reason = c.available()
        assert ok is False
        assert "API key" in reason

    def test_missing_anthropic_package_returns_false(self):
        import sys
        import unittest.mock as mock
        c = self._client(claude_api_key="sk-test")
        with mock.patch.dict(sys.modules, {"anthropic": None}):
            ok, reason = c.available()
        assert ok is False
        assert "anthropic" in reason

    def test_api_key_and_package_present_returns_true(self):
        import sys
        import unittest.mock as mock
        c = self._client(claude_api_key="sk-test")
        fake_anthropic = mock.MagicMock()
        with mock.patch.dict(sys.modules, {"anthropic": fake_anthropic}):
            ok, reason = c.available()
        assert ok is True
        assert reason == ""

    def test_null_client_available_returns_false(self):
        from yuu_clip.scoring.llm_client import NullLLMClient
        ok, reason = NullLLMClient().available()
        assert ok is False

    def test_null_client_chat_raises(self):
        import pytest

        from yuu_clip.scoring.llm_client import NullLLMClient
        with pytest.raises(RuntimeError):
            NullLLMClient().chat([{"role": "user", "content": "hi"}])


# ---------------------------------------------------------------------------
# check_llm_available()
# ---------------------------------------------------------------------------

class TestCheckLlmAvailable:
    def _cfg(self, **overrides):
        from yuu_clip.config import Config
        cfg = Config()
        for k, v in overrides.items():
            setattr(cfg, k, v)
        return cfg

    def test_ollama_disabled_returns_false(self):
        from yuu_clip.scoring.llm import check_llm_available
        ok, reason = check_llm_available(self._cfg(ollama_enabled=False))
        assert ok is False
        assert "disabled" in reason

    def test_delegates_to_client_available(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import check_llm_available
        cfg = self._cfg(ollama_enabled=True, llm_backend="ollama")
        with mock.patch("yuu_clip.scoring.llm_client.OllamaClient.available",
                        return_value=(True, "")):
            ok, reason = check_llm_available(cfg)
        assert ok is True


# ---------------------------------------------------------------------------
# LLM module-level functions: summarize_transcript, generate_timeline_chunk,
# find_related_clips — tested with a mocked _call_client
# ---------------------------------------------------------------------------

class TestSummarizeTranscript:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_title_and_summary(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        payload = json.dumps({"title": "Epic session", "summary": "Things happened."})
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            title, summary = summarize_transcript("some transcript text", self._cfg())
        assert title == "Epic session"
        assert summary == "Things happened."

    def test_truncates_to_12000_chars(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        long_text = "x" * 20_000
        captured = {}
        def fake_call(messages, config, temperature=0.1):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_transcript(long_text, self._cfg())
        user_content = captured["messages"][1]["content"]
        assert len(user_content) < 14_000

    def test_context_prepended_to_system(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        captured = {}
        def fake_call(messages, config, temperature=0.1):
            captured["messages"] = messages
            return json.dumps({"title": "T", "summary": "S"})
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            summarize_transcript("text", self._cfg(), context_text="WORLD CONTEXT")
        system_content = captured["messages"][0]["content"]
        assert system_content.startswith("WORLD CONTEXT")

    def test_missing_keys_return_empty_strings(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import summarize_transcript
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps({})):
            title, summary = summarize_transcript("text", self._cfg())
        assert title == ""
        assert summary == ""


class TestGenerateTimelineChunk:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_stripped_string(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value="  paragraph text  "):
            result = generate_timeline_chunk("transcript", "0:00", "15:00", [], self._cfg())
        assert result == "paragraph text"

    def test_clip_descriptions_included_in_user_message(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        captured = {}
        def fake_call(messages, config, temperature=0.1):
            captured["messages"] = messages
            return "result"
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            generate_timeline_chunk("text", "0:00", "15:00", ["Clip A", "Clip B"], self._cfg())
        user_content = captured["messages"][1]["content"]
        assert "Clip A" in user_content
        assert "Clip B" in user_content

    def test_no_clip_descriptions_omits_notable_clips_section(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        captured = {}
        def fake_call(messages, config, temperature=0.1):
            captured["messages"] = messages
            return "result"
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            generate_timeline_chunk("text", "0:00", "15:00", [], self._cfg())
        user_content = captured["messages"][1]["content"]
        assert "Notable clips" not in user_content

    def test_context_prepended_to_system(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import generate_timeline_chunk
        captured = {}
        def fake_call(messages, config, temperature=0.1):
            captured["messages"] = messages
            return "result"
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call):
            generate_timeline_chunk("text", "0:00", "15:00", [], self._cfg(), context_text="CTX")
        system_content = captured["messages"][0]["content"]
        assert system_content.startswith("CTX")


class TestFindRelatedClips:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_returns_list_of_id_reason_dicts(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": 7, "reason": "both chaotic"}, {"id": 3, "reason": "same tone"}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref desc", [{"id": 7, "description": "d1"}], self._cfg())
        assert result == [{"id": 7, "reason": "both chaotic"}, {"id": 3, "reason": "same tone"}]

    def test_non_list_response_raises_value_error(self):
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import find_related_clips
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps({"error": "bad"})):
            with pytest.raises(ValueError):
                find_related_clips("ref", [], self._cfg())

    def test_id_coerced_to_int(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": "42", "reason": "similar"}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref", [{"id": 42, "description": "d"}], self._cfg())
        assert result[0]["id"] == 42
        assert isinstance(result[0]["id"], int)

    def test_missing_reason_defaults_to_empty_string(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        payload = json.dumps([{"id": 1}])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = find_related_clips("ref", [{"id": 1, "description": "d"}], self._cfg())
        assert result[0]["reason"] == ""

    def test_empty_candidates_returns_empty_list(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import find_related_clips
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps([])):
            result = find_related_clips("ref", [], self._cfg())
        assert result == []


# ---------------------------------------------------------------------------
# compute_scenes — transcript mode writes SceneBoundary rows
# ---------------------------------------------------------------------------

class TestComputeScenesTranscriptMode:
    def _make_db(self, tmp_path):
        from yuu_clip.db.models import (
            AudioTrack,
            Transcript,
            Video,
            make_session,
        )
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=120_000)
        session.add(v)
        session.flush()
        track = AudioTrack(video_id=v.id, stream_index=0, label="combined", do_transcribe=True, do_score=True)
        session.add(track)
        session.flush()
        transcript = Transcript(audio_track_id=track.id, model_name="base")
        session.add(transcript)
        session.flush()
        return session, v, transcript

    def test_transcript_mode_no_gap_returns_zero_cuts(self, tmp_path):
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.scoring.scenes import compute_scenes
        session, v, transcript = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=0, end_ms=10_000, text="a"))
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=10_500, end_ms=20_000, text="b"))
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript", transcript_gap_s=3.0)
        finally:
            session.close()
        assert result == 0

    def test_transcript_mode_gap_exceeds_threshold_creates_boundary(self, tmp_path):
        from yuu_clip.db.models import SceneBoundary, TranscriptSegment
        from yuu_clip.scoring.scenes import compute_scenes
        session, v, transcript = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=0, end_ms=10_000, text="a"))
        session.add(TranscriptSegment(transcript_id=transcript.id, start_ms=15_000, end_ms=25_000, text="b"))
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript", transcript_gap_s=3.0)
            boundaries = session.query(SceneBoundary).filter_by(video_id=v.id).all()
        finally:
            session.close()
        assert result == 1
        assert boundaries[0].timecode_ms == 15_000

    def test_transcript_mode_no_transcribed_tracks_returns_zero(self, tmp_path):
        from yuu_clip.db.models import AudioTrack, Video, make_session
        from yuu_clip.scoring.scenes import compute_scenes
        session = make_session(tmp_path / "t2.db")
        v = Video(path=str(tmp_path / "v2.mkv"), filename="v2.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        track = AudioTrack(video_id=v.id, stream_index=0, label="combined", do_transcribe=False, do_score=True)
        session.add(track)
        session.flush()
        try:
            result = compute_scenes(v, session, mode="transcript")
        finally:
            session.close()
        assert result == 0


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
        # server — a separate process/connection — can see scores as they finish.
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
