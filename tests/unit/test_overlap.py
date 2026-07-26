from __future__ import annotations

import itertools
import types

# ---------------------------------------------------------------------------
# detect_and_apply_overlap_fallback - the RMS-curve audio fallback (before
# transcription). _rms_curve is monkeypatched so the test controls the
# correlation directly instead of decoding a real WAV.
# ---------------------------------------------------------------------------

class TestDetectAndApplyOverlapFallback:
    def setup_method(self):
        self._ids = itertools.count(200)

    def _make_track(self, tmp_path, label, *, extracted=True, weight=1.0):
        path = tmp_path / f"{label}_{next(self._ids)}.wav"
        if extracted:
            path.write_bytes(b"fake")
        return types.SimpleNamespace(
            id=next(self._ids),
            label=label,
            extracted_path=str(path) if extracted else None,
            do_transcribe=(label == "combined"),
            do_score=(label == "combined"),
            relevance_weight=weight,
        )

    def test_no_combined_track_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_and_apply_overlap_fallback
        tracks = [self._make_track(tmp_path, "player_voice")]
        assert detect_and_apply_overlap_fallback(tracks) is False

    def test_no_specialized_track_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_and_apply_overlap_fallback
        tracks = [self._make_track(tmp_path, "combined")]
        assert detect_and_apply_overlap_fallback(tracks) is False

    def test_tracks_with_no_extracted_audio_are_ignored(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_and_apply_overlap_fallback
        tracks = [
            self._make_track(tmp_path, "combined", extracted=False),
            self._make_track(tmp_path, "player_voice", extracted=False),
        ]
        assert detect_and_apply_overlap_fallback(tracks) is False

    def test_correlated_curve_disables_specialized_and_boosts_combined(self, tmp_path, monkeypatch):
        import yuu_clip.analyze.overlap as overlap_mod

        combined = self._make_track(tmp_path, "combined")
        specialized = self._make_track(tmp_path, "player_voice")
        # Same (non-constant) ramp for every track -> perfect correlation.
        monkeypatch.setattr(overlap_mod, "_rms_curve", lambda path, max_seconds=30: [1.0, 2.0, 3.0, 4.0, 5.0])

        result = overlap_mod.detect_and_apply_overlap_fallback([combined, specialized])

        assert result is True
        assert specialized.do_transcribe is False
        assert specialized.do_score is False
        assert combined.do_transcribe is True
        assert combined.do_score is True
        assert combined.relevance_weight == 1.5

    def test_uncorrelated_curves_leave_tracks_unchanged(self, tmp_path, monkeypatch):
        import yuu_clip.analyze.overlap as overlap_mod

        combined = self._make_track(tmp_path, "combined")
        specialized = self._make_track(tmp_path, "player_voice")
        specialized.do_transcribe = False
        curves = iter([[1.0, 2.0, 3.0, 4.0, 5.0], [5.0, 4.0, 3.0, 2.0, 1.0]])  # perfectly anti-correlated
        monkeypatch.setattr(overlap_mod, "_rms_curve", lambda path, max_seconds=30: next(curves))

        result = overlap_mod.detect_and_apply_overlap_fallback([combined, specialized])

        assert result is False
        assert specialized.do_transcribe is False  # untouched

    def test_existing_combined_weight_above_boost_floor_is_kept(self, tmp_path, monkeypatch):
        import yuu_clip.analyze.overlap as overlap_mod

        combined = self._make_track(tmp_path, "combined", weight=2.0)
        specialized = self._make_track(tmp_path, "player_voice")
        monkeypatch.setattr(overlap_mod, "_rms_curve", lambda path, max_seconds=30: [1.0, 2.0, 3.0, 4.0, 5.0])

        overlap_mod.detect_and_apply_overlap_fallback([combined, specialized])

        assert combined.relevance_weight == 2.0  # max(2.0, 1.5) - never lowered


# ---------------------------------------------------------------------------
# analyze/overlap.py - detect_transcript_overlap (unit, no DB)
# ---------------------------------------------------------------------------

class TestDetectTranscriptOverlapUnit:
    def setup_method(self):
        import itertools
        self._ids = itertools.count(100)

    def _make_track(self, label, do_score, words):
        """Build a minimal track-like object whose transcript returns *words*."""
        import types
        return types.SimpleNamespace(
            id=next(self._ids),
            label=label,
            do_score=do_score,
            relevance_weight=1.0,
            do_transcribe=False,
            _words=words,
        )

    def _run(self, tracks, threshold=0.75):
        from yuu_clip.analyze.overlap import detect_transcript_overlap

        track_text_map = {t.id: t._words for t in tracks}

        class FakeTx:
            def __init__(self, text):
                self._text = text
            def full_text(self):
                return self._text

        class FakeOrderBy:
            def __init__(self, text):
                self._text = text
            def order_by(self, *a):
                return self
            def first(self):
                return FakeTx(self._text)

        class FakeQuery:
            def filter_by(self, **kw):
                tid = kw.get("audio_track_id")
                return FakeOrderBy(track_text_map.get(tid, ""))

        class FakeSession:
            def query(self, model):
                return FakeQuery()

        return detect_transcript_overlap(tracks, FakeSession(), threshold=threshold)

    def test_no_combined_returns_false(self):
        tracks = [self._make_track("player_voice", True, "hello world foo bar")]
        result = self._run(tracks)
        assert result is False

    def test_no_specialized_returns_false(self):
        long_text = " ".join(["word"] * 25)
        tracks = [self._make_track("combined", True, long_text)]
        result = self._run(tracks)
        assert result is False

    def test_combined_too_short_returns_false(self):
        tracks = [
            self._make_track("combined", True, "short text"),
            self._make_track("player_voice", True, "short text"),
        ]
        result = self._run(tracks)
        assert result is False

    def test_high_overlap_disables_specialized_scoring(self):
        # _word_set uses [a-z']+ so words must be purely alphabetic
        import string
        # 26 unique single-letter words a-z as combined; specialized uses a-x (24)
        alpha = list(string.ascii_lowercase)        # 26 unique words
        combined_words = " ".join(alpha)            # a b c ... z
        specialized_words = " ".join(alpha[:24])    # a b c ... x  (24/24 = 100% overlap)
        combined = self._make_track("combined", True, combined_words)
        combined.id = 10
        specialized = self._make_track("player_voice", True, specialized_words)
        specialized.id = 11
        tracks = [combined, specialized]
        result = self._run(tracks, threshold=0.75)
        assert result is True
        assert specialized.do_score is False
        assert combined.do_transcribe is True
        assert combined.do_score is True

    def test_low_overlap_leaves_specialized_unchanged(self):
        import string
        alpha = list(string.ascii_lowercase)        # 26 unique words
        # combined has a-z; specialized has entirely different words
        combined_words = " ".join(alpha)
        # build 20 words not in alpha by repeating suffixes
        specialized_words = " ".join([f"zz{c}" for c in alpha[:20]])
        combined = self._make_track("combined", True, combined_words)
        combined.id = 10
        specialized = self._make_track("player_voice", True, specialized_words)
        specialized.id = 11
        tracks = [combined, specialized]
        result = self._run(tracks, threshold=0.75)
        assert result is False
        assert specialized.do_score is True


# ---------------------------------------------------------------------------
# _word_set (overlap detection helper)
# ---------------------------------------------------------------------------

class TestWordSet:
    def _ws(self, text):
        from yuu_clip.analyze.overlap import _word_set
        return _word_set(text)

    def test_empty_string_returns_empty_set(self):
        assert self._ws("") == set()

    def test_lowercases_words(self):
        assert "hello" in self._ws("Hello World")
        assert "world" in self._ws("Hello World")

    def test_strips_punctuation(self):
        result = self._ws("hello, world!")
        assert "hello" in result
        assert "world" in result
        assert "," not in result
        assert "!" not in result

    def test_apostrophes_preserved(self):
        result = self._ws("can't won't")
        assert "can't" in result

    def test_numbers_excluded(self):
        result = self._ws("123 hello")
        assert "hello" in result
        assert "123" not in result
