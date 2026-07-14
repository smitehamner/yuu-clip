"""yuu_clip/scoring/energy.py - audio energy scorer."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# AudioEnergyScorer - boundary test
# ---------------------------------------------------------------------------

class TestEnergyBoundary:
    """AudioEnergyScorer clips window is [start_s, end_s) - end second is excluded."""

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
                    rms_db=10.0,        # loud - would boost score if incorrectly included
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

    def test_sub_second_window_reads_its_whole_second_bucket(self):
        """A window that lives inside a single second (e.g. 1200-1800ms) must still
        read the whole-second bucket that contains it, not query an empty range."""
        import tempfile
        from pathlib import Path
        from unittest.mock import MagicMock

        from yuu_clip.config import Config
        from yuu_clip.db.models import AudioEnergy, AudioTrack, Video, make_session
        from yuu_clip.scoring.energy import AudioEnergyScorer

        scorer = AudioEnergyScorer(Config())
        with tempfile.TemporaryDirectory() as tmp:
            session = make_session(Path(tmp) / "test.db")
            try:
                v = Video(path="/fake/v.mkv", filename="v.mkv", status="done", duration_ms=60_000)
                session.add(v)
                session.flush()
                track = AudioTrack(
                    video_id=v.id, stream_index=0, label="combined",
                    do_transcribe=True, do_score=True, relevance_weight=1.0,
                )
                session.add(track)
                session.flush()
                for second, db in ((0, -30.0), (1, 5.0), (2, -30.0)):
                    session.add(AudioEnergy(audio_track_id=track.id, second_offset=second, rms_db=db))
                session.commit()

                clip = MagicMock()
                clip.start_ms = 1_200   # start_s = 1
                clip.end_ms   = 1_800   # end_ms // 1000 == 1 -> old code queried [1, 1) = empty
                db_track = session.query(AudioTrack).filter_by(id=track.id).one()
                clip.video.audio_tracks = [db_track]

                result = scorer.score(clip, session)
            finally:
                session.close()

        assert "energy_no_data" not in result.tags, (
            "Sub-second window queried an empty range instead of its containing second bucket"
        )

# ---------------------------------------------------------------------------
# AudioEnergyScorer - no-scorable-tracks path
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
# AudioEnergyScorer - happy path
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
        # [loud_start, loud_end) - these are the ones the clip window covers.
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

        # Score should be 0.0 (below baseline) - quiet clip in a loud video
        assert result.score_action == 0.0

# ---------------------------------------------------------------------------
# AudioEnergy - weighted per-second series and baseline
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
