"""yuu_clip/scoring/wav_access.py - audio-track selection + per-run decode cache.

Every audio scorer (laugh 'audio', prosody, audio_event) reaches its samples
through these two helpers, but their own tests mock the helpers away - so the
track-selection rules and the cache's decode-once / read-failure contract are
exercised here directly.
"""

from __future__ import annotations


class _FakeTrack:
    def __init__(self, track_id, do_score, extracted_path, relevance_weight):
        self.id = track_id
        self.do_score = do_score
        self.extracted_path = extracted_path
        self.relevance_weight = relevance_weight


class _FakeClip:
    def __init__(self, tracks):
        self.video = type("_V", (), {"audio_tracks": tracks})()


def _existing_wav(tmp_path, name):
    path = tmp_path / name
    path.write_bytes(b"RIFF")
    return str(path)


class TestBestWavTrack:
    def test_picks_highest_relevance_among_eligible(self, tmp_path):
        from yuu_clip.scoring.wav_access import best_wav_track
        low = _FakeTrack(1, True, _existing_wav(tmp_path, "a.wav"), 0.2)
        high = _FakeTrack(2, True, _existing_wav(tmp_path, "b.wav"), 0.9)
        assert best_wav_track(_FakeClip([low, high])) is high

    def test_excludes_non_scored_track(self, tmp_path):
        from yuu_clip.scoring.wav_access import best_wav_track
        # The higher-weight track is not marked for scoring, so it must be skipped
        # even though its weight would otherwise win.
        scored = _FakeTrack(1, True, _existing_wav(tmp_path, "a.wav"), 0.3)
        unscored = _FakeTrack(2, False, _existing_wav(tmp_path, "b.wav"), 0.9)
        assert best_wav_track(_FakeClip([scored, unscored])) is scored

    def test_excludes_track_with_missing_file(self, tmp_path):
        from yuu_clip.scoring.wav_access import best_wav_track
        present = _FakeTrack(1, True, _existing_wav(tmp_path, "a.wav"), 0.3)
        absent = _FakeTrack(2, True, str(tmp_path / "gone.wav"), 0.9)
        assert best_wav_track(_FakeClip([present, absent])) is present

    def test_excludes_track_with_no_path(self, tmp_path):
        from yuu_clip.scoring.wav_access import best_wav_track
        present = _FakeTrack(1, True, _existing_wav(tmp_path, "a.wav"), 0.3)
        unextracted = _FakeTrack(2, True, None, 0.9)
        assert best_wav_track(_FakeClip([present, unextracted])) is present

    def test_none_when_no_eligible_tracks(self, tmp_path):
        from yuu_clip.scoring.wav_access import best_wav_track
        unscored = _FakeTrack(1, False, _existing_wav(tmp_path, "a.wav"), 0.9)
        assert best_wav_track(_FakeClip([unscored])) is None

    def test_none_when_no_tracks(self):
        from yuu_clip.scoring.wav_access import best_wav_track
        assert best_wav_track(_FakeClip([])) is None


class TestWavCache:
    def test_decodes_once_and_reuses(self, monkeypatch):
        import yuu_clip.scoring.wav_access as wav_access
        calls = []

        def _fake_read(path):
            calls.append(path)
            return ("samples", 16000)

        monkeypatch.setattr(wav_access, "read_full_audio", _fake_read)
        cache = wav_access.WavCache()
        track = _FakeTrack(7, True, "/tmp/track.wav", 1.0)

        assert cache.load(track) == ("samples", 16000)
        assert cache.load(track) == ("samples", 16000)
        assert len(calls) == 1  # decoded once, second load served from cache

    def test_distinct_tracks_decoded_separately(self, monkeypatch):
        import yuu_clip.scoring.wav_access as wav_access
        calls = []

        def _fake_read(path):
            calls.append(str(path))
            return (str(path), 16000)

        monkeypatch.setattr(wav_access, "read_full_audio", _fake_read)
        cache = wav_access.WavCache()

        cache.load(_FakeTrack(1, True, "/tmp/one.wav", 1.0))
        cache.load(_FakeTrack(2, True, "/tmp/two.wav", 1.0))
        assert len(calls) == 2

    def test_read_failure_returns_none_pair(self, monkeypatch):
        import yuu_clip.scoring.wav_access as wav_access

        def _boom(path):
            raise OSError("unreadable wav")

        monkeypatch.setattr(wav_access, "read_full_audio", _boom)
        cache = wav_access.WavCache()
        track = _FakeTrack(3, True, "/tmp/bad.wav", 1.0)

        assert cache.load(track) == (None, None)

    def test_read_failure_is_not_cached(self, monkeypatch):
        import yuu_clip.scoring.wav_access as wav_access
        attempts = []

        def _read(path):
            attempts.append(path)
            if len(attempts) == 1:
                raise OSError("transient read glitch")
            return ("recovered", 16000)

        monkeypatch.setattr(wav_access, "read_full_audio", _read)
        cache = wav_access.WavCache()
        track = _FakeTrack(4, True, "/tmp/flaky.wav", 1.0)

        assert cache.load(track) == (None, None)
        # A failed decode is not stored, so a later load retries rather than
        # returning the (None, None) permanently.
        assert cache.load(track) == ("recovered", 16000)
