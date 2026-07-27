"""analyze/labeler.py::_apply_profile - track-layout profile matching against a
saved profile. TestLabelTracksSingleTrack/TestLabelNonInteractive/
TestGuessLabelIndex (tests/unit/test_labeler.py, moved in A2) cover the rest
of labeler.py's heuristics; _apply_profile itself had zero coverage."""
from __future__ import annotations


def _stream(stream_index, title=None):
    from yuu_clip.analyze.probe import AudioStreamInfo
    return AudioStreamInfo(
        stream_index=stream_index, codec_name="aac", sample_rate=48000,
        channels=2, channel_layout="stereo", duration_ms=None, title_tag=title,
    )


class TestApplyProfile:
    def _save(self, monkeypatch, tmp_path, name, assignments):
        import yuu_clip.config as cfg_mod
        from yuu_clip.track_labels import save_profile
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "cfg")
        save_profile(name, assignments)

    def _apply(self, monkeypatch, tmp_path, name, streams):
        import yuu_clip.config as cfg_mod
        from yuu_clip.analyze.labeler import _apply_profile
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "cfg")
        return _apply_profile(name, streams)

    def test_unknown_profile_returns_none(self, tmp_path, monkeypatch):
        import yuu_clip.config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "cfg")
        result = self._apply(monkeypatch, tmp_path, "does-not-exist", [_stream(0)])
        assert result is None

    def test_track_count_mismatch_returns_none(self, tmp_path, monkeypatch):
        self._save(monkeypatch, tmp_path, "2track", [
            {"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True},
            {"stream_position": 1, "label": "unlabeled", "do_transcribe": False, "do_score": False},
        ])
        # Profile expects 2 streams; only 1 is offered.
        result = self._apply(monkeypatch, tmp_path, "2track", [_stream(0)])
        assert result is None

    def test_matching_profile_applies_label_by_position(self, tmp_path, monkeypatch):
        from yuu_clip.track_labels import LABEL_WEIGHTS
        self._save(monkeypatch, tmp_path, "2track", [
            {"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True},
            {"stream_position": 1, "label": "player_voice", "do_transcribe": True, "do_score": True},
        ])
        streams = [_stream(5), _stream(9)]  # stream_index values distinct from position
        result = self._apply(monkeypatch, tmp_path, "2track", streams)
        assert result[0] == {
            "stream_index": 5, "label": "combined", "weight": LABEL_WEIGHTS["combined"],
            "do_transcribe": True, "do_score": True,
        }
        assert result[1]["stream_index"] == 9
        assert result[1]["label"] == "player_voice"

    def test_weight_resolved_from_label_weights_table(self, tmp_path, monkeypatch):
        from yuu_clip.track_labels import LABEL_WEIGHTS
        self._save(monkeypatch, tmp_path, "p", [
            {"stream_position": 0, "label": "player_voice", "do_transcribe": True, "do_score": True},
        ])
        result = self._apply(monkeypatch, tmp_path, "p", [_stream(0)])
        assert result[0]["weight"] == LABEL_WEIGHTS["player_voice"]

    def test_do_score_defaults_false_for_skip_score_label(self, tmp_path, monkeypatch):
        # Stored assignment omits do_score entirely - must default per DEFAULT_SKIP_SCORE.
        self._save(monkeypatch, tmp_path, "p", [
            {"stream_position": 0, "label": "game_sounds", "do_transcribe": False},
        ])
        result = self._apply(monkeypatch, tmp_path, "p", [_stream(0)])
        assert result[0]["do_score"] is False

    def test_do_score_defaults_true_for_non_skip_label(self, tmp_path, monkeypatch):
        self._save(monkeypatch, tmp_path, "p", [
            {"stream_position": 0, "label": "combined", "do_transcribe": True},
        ])
        result = self._apply(monkeypatch, tmp_path, "p", [_stream(0)])
        assert result[0]["do_score"] is True

    def test_do_transcribe_defaults_true_when_absent(self, tmp_path, monkeypatch):
        self._save(monkeypatch, tmp_path, "p", [
            {"stream_position": 0, "label": "combined"},
        ])
        result = self._apply(monkeypatch, tmp_path, "p", [_stream(0)])
        assert result[0]["do_transcribe"] is True

    def test_explicit_do_transcribe_false_preserved(self, tmp_path, monkeypatch):
        self._save(monkeypatch, tmp_path, "p", [
            {"stream_position": 0, "label": "unlabeled", "do_transcribe": False, "do_score": False},
        ])
        result = self._apply(monkeypatch, tmp_path, "p", [_stream(0)])
        assert result[0]["do_transcribe"] is False

    def test_out_of_range_stream_position_returns_none(self, tmp_path, monkeypatch):
        # A hand-corrupted profiles.json can carry a stream_position that no longer
        # fits the (matching-count) streams list - must fall back, not IndexError.
        self._save(monkeypatch, tmp_path, "p", [
            {"stream_position": 5, "label": "combined", "do_transcribe": True, "do_score": True},
        ])
        result = self._apply(monkeypatch, tmp_path, "p", [_stream(0)])
        assert result is None
