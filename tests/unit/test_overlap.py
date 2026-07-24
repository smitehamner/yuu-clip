from __future__ import annotations

# ---------------------------------------------------------------------------
# analyze/overlap.py - detect_transcript_overlap (unit, no DB)
# ---------------------------------------------------------------------------

class TestDetectTranscriptOverlapUnit:
    _next_id = 100

    def _make_track(self, label, do_score, words):
        """Build a minimal track-like object whose transcript returns *words*."""
        import types
        TestDetectTranscriptOverlapUnit._next_id += 1
        return types.SimpleNamespace(
            id=TestDetectTranscriptOverlapUnit._next_id,
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
