"""Unit tests - forced alignment of edited caption text (word-highlight captions).

The alignment model is never loaded and no audio is decoded here: _run_alignment
and _get_model are stubbed so the tokenization, span-to-word grouping, language
gate, and failure fallbacks are exercised without torch or the network.
"""
from __future__ import annotations

import types

import pytest

from yuu_clip.transcribe import align

# The real WAV2VEC2_ASR_BASE_960H label tuple - index 0 is blank, index 1 is the
# word-boundary separator. Drives tokenization in the tests below.
_LABELS = (
    "-", "|", "E", "T", "A", "O", "N", "I", "H", "S", "R", "D", "L", "U", "M",
    "W", "C", "F", "G", "Y", "P", "B", "V", "K", "'", "X", "J", "Q", "Z",
)


def _span(start: int, end: int):
    return types.SimpleNamespace(start=start, end=end, token=0, score=1.0)


@pytest.fixture
def stub_model(monkeypatch):
    """Make _get_model return a dummy model + the real labels, without loading torch."""
    monkeypatch.setattr(align, "_model", object())
    monkeypatch.setattr(align, "_labels", _LABELS)
    monkeypatch.setattr(align, "_get_model", lambda: (align._model, _LABELS))


class TestIsEnglish:
    @pytest.mark.parametrize("language", ["en", "EN", "en-US", "en-GB"])
    def test_english_variants(self, language):
        assert align._is_english(language) is True

    @pytest.mark.parametrize("language", [None, "", "es", "fr", "de", "zh"])
    def test_non_english(self, language):
        assert align._is_english(language) is False


class TestRealignWords:
    def test_english_text_produces_word_timings(self, stub_model, monkeypatch, tmp_path):
        # HELLO (5 tokens) | WORLD (5 tokens) = 11 target tokens -> 11 spans.
        spans = [_span(i * 5, i * 5 + 5) for i in range(5)]         # HELLO chars
        spans.append(_span(25, 30))                                 # separator
        spans += [_span(30 + i * 5, 30 + i * 5 + 5) for i in range(5)]  # WORLD chars
        monkeypatch.setattr(align, "_run_alignment", lambda *a: (spans, 320.0))

        result = align.realign_words(tmp_path / "seg.wav", 1000, 100000, "Hello, world!", "en")

        # frame_to_ms = start_ms + frame * 320 / 16000 * 1000 = 1000 + frame * 20
        assert result == [
            {"text": "Hello,", "start_ms": 1000, "end_ms": 1000 + 25 * 20},
            {"text": "world!", "start_ms": 1000 + 30 * 20, "end_ms": 1000 + 55 * 20},
        ]

    def test_non_english_short_circuits_without_loading_model(self, monkeypatch, tmp_path):
        def _boom():
            raise AssertionError("model must not load for a non-English segment")

        monkeypatch.setattr(align, "_get_model", _boom)
        assert align.realign_words(tmp_path / "seg.wav", 0, 5000, "hola mundo", "es") is None

    def test_word_with_no_alignable_chars_returns_none(self, stub_model, monkeypatch, tmp_path):
        def _boom(*_a):
            raise AssertionError("alignment must not run when a word can't be tokenized")

        monkeypatch.setattr(align, "_run_alignment", _boom)
        # "123" normalizes to empty (no letters), so alignment is skipped.
        assert align.realign_words(tmp_path / "seg.wav", 0, 5000, "123 456", "en") is None

    def test_span_count_mismatch_returns_none(self, stub_model, monkeypatch, tmp_path):
        monkeypatch.setattr(align, "_run_alignment", lambda *a: ([_span(0, 5)], 320.0))
        assert align.realign_words(tmp_path / "seg.wav", 0, 5000, "hello world", "en") is None

    def test_alignment_exception_returns_none(self, stub_model, monkeypatch, tmp_path):
        def _raise(*_a):
            raise RuntimeError("boom")

        monkeypatch.setattr(align, "_run_alignment", _raise)
        assert align.realign_words(tmp_path / "seg.wav", 0, 5000, "hello", "en") is None

    def test_end_ms_clamps_word_end(self, stub_model, monkeypatch, tmp_path):
        spans = [_span(0, 500)]  # single-token word "I", end frame 500 -> +10000ms
        monkeypatch.setattr(align, "_run_alignment", lambda *a: (spans, 320.0))
        result = align.realign_words(tmp_path / "seg.wav", 0, 3000, "I", "en")
        assert result == [{"text": "I", "start_ms": 0, "end_ms": 3000}]

    def test_whitespace_only_text_returns_none_without_loading_model(self, monkeypatch, tmp_path):
        def _boom():
            raise AssertionError("model must not load when there are no words to align")

        monkeypatch.setattr(align, "_get_model", _boom)
        assert align.realign_words(tmp_path / "seg.wav", 0, 5000, "   ", "en") is None


class TestRealignSegmentWords:
    def _seg(self, language, path="C:/missing.mp4", segment_start_s=None):
        video = types.SimpleNamespace(path=path, segment_start_s=segment_start_s)
        track = types.SimpleNamespace(video=video, stream_index=1)
        transcript = types.SimpleNamespace(audio_track=track, language=language)
        return types.SimpleNamespace(
            id=1, transcript=transcript, start_ms=1000, end_ms=3000, text="hello",
        )

    def test_non_english_segment_returns_none_without_extract(self, monkeypatch):
        def _boom(*_a, **_k):
            raise AssertionError("must not extract audio for a non-English segment")

        monkeypatch.setattr("yuu_clip.analyze.extract.extract_audio_track", _boom)
        assert align.realign_segment_words(self._seg("es")) is None

    def test_missing_source_returns_none(self, monkeypatch):
        seg = self._seg("en", path="C:/does/not/exist.mp4")
        assert align.realign_segment_words(seg) is None

    def test_missing_video_returns_none_without_extract(self, monkeypatch):
        def _boom(*_a, **_k):
            raise AssertionError("must not extract audio when the track has no video")

        monkeypatch.setattr("yuu_clip.analyze.extract.extract_audio_track", _boom)
        track = types.SimpleNamespace(video=None, stream_index=1)
        transcript = types.SimpleNamespace(audio_track=track, language="en")
        seg = types.SimpleNamespace(id=1, transcript=transcript, start_ms=0, end_ms=3000, text="hello")
        assert align.realign_segment_words(seg) is None

    def test_split_segment_extraction_rebased_by_parent_offset(self, monkeypatch, tmp_path):
        # A split segment's transcript times are segment-relative but video.path
        # is the shared parent media - the extraction window must add
        # segment_start_s, while realign_words keeps segment-relative anchors.
        source = tmp_path / "parent.mp4"
        source.write_bytes(b"stub")
        windows: list[dict] = []

        def _capture(*_a, **kwargs):
            windows.append(kwargs)

        monkeypatch.setattr("yuu_clip.analyze.extract.extract_audio_track", _capture)
        monkeypatch.setattr(
            align, "realign_words",
            lambda _wav, start_ms, end_ms, _text, _lang: [
                {"text": "hello", "start_ms": start_ms, "end_ms": end_ms}
            ],
        )
        seg = self._seg("en", path=str(source), segment_start_s=600.0)

        result = align.realign_segment_words(seg)

        assert windows == [{"start_s": 601.0, "end_s": 603.0}]
        assert result == [{"text": "hello", "start_ms": 1000, "end_ms": 3000}]

    def test_unsplit_recording_extraction_uses_raw_times(self, monkeypatch, tmp_path):
        source = tmp_path / "recording.mp4"
        source.write_bytes(b"stub")
        windows: list[dict] = []

        def _capture(*_a, **kwargs):
            windows.append(kwargs)

        monkeypatch.setattr("yuu_clip.analyze.extract.extract_audio_track", _capture)
        monkeypatch.setattr(align, "realign_words", lambda *_a: None)
        seg = self._seg("en", path=str(source))

        align.realign_segment_words(seg)

        assert windows == [{"start_s": 1.0, "end_s": 3.0}]

    def test_extraction_failure_returns_none(self, monkeypatch, tmp_path):
        # Source exists but the ffmpeg extract raises: realign must swallow it and
        # return None (caller clears words_json) rather than break the caption edit.
        source = tmp_path / "recording.mp4"
        source.write_bytes(b"stub")

        def _raise(*_a, **_k):
            raise RuntimeError("ffmpeg boom")

        monkeypatch.setattr("yuu_clip.analyze.extract.extract_audio_track", _raise)
        seg = self._seg("en", path=str(source))
        assert align.realign_segment_words(seg) is None
