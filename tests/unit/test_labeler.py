from __future__ import annotations

# ---------------------------------------------------------------------------
# analyze/labeler.py - label_tracks single-track auto-label
# ---------------------------------------------------------------------------

class TestLabelTracksSingleTrack:
    def _make_video_info(self, n_streams, title_tags=None):
        from pathlib import Path

        from yuu_clip.analyze.probe import AudioStreamInfo, VideoInfo
        streams = [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None,
                title_tag=(title_tags[i] if title_tags else None),
            )
            for i in range(n_streams)
        ]
        return VideoInfo(
            path=Path("fake.mkv"), duration_ms=60_000,
            fps=30.0, width=1920, height=1080, audio_streams=streams,
        )

    def test_single_track_auto_labeled_combined(self):
        from yuu_clip.analyze.labeler import label_tracks
        vi = self._make_video_info(1)
        result = label_tracks(vi, non_interactive=True)
        assert len(result) == 1
        assert result[0]["label"] == "combined"
        assert result[0]["do_transcribe"] is True
        assert result[0]["do_score"] is True

    def test_multi_track_non_interactive_no_profile_uses_track0(self):
        from yuu_clip.analyze.labeler import label_tracks
        vi = self._make_video_info(3)
        result = label_tracks(vi, non_interactive=True)
        assert len(result) == 3
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"
        assert result[2]["label"] == "unlabeled"
        assert result[1]["do_transcribe"] is False
        assert result[2]["do_score"] is False


# ---------------------------------------------------------------------------
# analyze/labeler.py - _label_non_interactive
# ---------------------------------------------------------------------------

class TestLabelNonInteractive:
    def _make_streams(self, n, title_tags=None):
        from yuu_clip.analyze.probe import AudioStreamInfo
        return [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None,
                title_tag=(title_tags[i] if title_tags else None),
            )
            for i in range(n)
        ]

    def test_single_stream_returns_primary_only(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(1)
        result = _label_non_interactive(streams, None)
        assert len(result) == 1
        assert result[0]["label"] == "combined"

    def test_two_streams_second_is_unlabeled(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, None)
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"
        assert result[1]["do_transcribe"] is False

    def test_stream_index_preserved(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, None)
        assert result[0]["stream_index"] == 0
        assert result[1]["stream_index"] == 1

    def test_default_profile_name_skipped(self):
        """__default__ profile name should not attempt a profile lookup."""
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, "__default__")
        assert result[0]["label"] == "combined"


# ---------------------------------------------------------------------------
# analyze/labeler.py - _guess_label_index
# ---------------------------------------------------------------------------

class TestGuessLabelIndex:
    def _make_stream(self, title):
        from yuu_clip.analyze.probe import AudioStreamInfo
        return AudioStreamInfo(
            stream_index=0, codec_name="aac", sample_rate=48000,
            channels=2, channel_layout="stereo", duration_ms=None, title_tag=title,
        )

    def _guess(self, title):
        from yuu_clip.analyze.labeler import _guess_label_index
        from yuu_clip.track_labels import TRACK_LABELS
        return TRACK_LABELS[_guess_label_index(self._make_stream(title)) - 1]

    def test_mic_in_title_returns_player_voice(self):
        assert self._guess("Mic (Clean)") == "player_voice"

    def test_voice_in_title_returns_player_voice(self):
        assert self._guess("My Voice") == "player_voice"

    def test_desktop_in_title_returns_combined(self):
        assert self._guess("Desktop Audio") == "combined"

    def test_game_in_title_returns_combined(self):
        assert self._guess("Game Capture") == "combined"

    def test_unknown_title_returns_unlabeled(self):
        assert self._guess("Track 1") == "unlabeled"

    def test_none_title_returns_unlabeled(self):
        assert self._guess(None) == "unlabeled"
