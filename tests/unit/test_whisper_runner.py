"""Unit tests - per-word timestamp capture (word-highlight captions, Stage 1).

The faster-whisper backend converts the model's per-word timings (track-absolute
seconds) into TranscribedWord (ms) via transcriber._to_words; transcribe_track then
persists them through TranscriptSegment.words. A segment with no word data yields
None so the caption renderer can fall back to a static line.
"""
from __future__ import annotations

import json
import types
from dataclasses import asdict

from yuu_clip.db.models import TranscriptSegment
from yuu_clip.transcribe import transcriber


def _word(text: str, start: float, end: float):
    return types.SimpleNamespace(word=text, start=start, end=end)


class TestToWords:
    def test_words_round_trip_to_ms(self):
        words = transcriber._to_words(
            [_word(" Hello", 1.0, 1.5), _word(" world", 1.5, 2.25)]
        )
        assert [asdict(w) for w in words] == [
            {"text": " Hello", "start_ms": 1000, "end_ms": 1500},
            {"text": " world", "start_ms": 1500, "end_ms": 2250},
        ]

    def test_none_words_return_none(self):
        assert transcriber._to_words(None) is None

    def test_empty_words_return_none(self):
        assert transcriber._to_words([]) is None


class TestSegmentWordsProperty:
    def test_words_property_reads_json(self):
        seg = TranscriptSegment(
            transcript_id=1, start_ms=0, end_ms=1000, text="hi",
            words_json=json.dumps([{"text": "hi", "start_ms": 0, "end_ms": 500}]),
        )
        assert seg.words == [{"text": "hi", "start_ms": 0, "end_ms": 500}]

    def test_words_property_defaults_empty_when_null(self):
        seg = TranscriptSegment(transcript_id=1, start_ms=0, end_ms=1000, text="hi")
        assert seg.words == []

    def test_words_setter_writes_json(self):
        seg = TranscriptSegment(transcript_id=1, start_ms=0, end_ms=1000, text="hi")
        seg.words = [{"text": "hi", "start_ms": 0, "end_ms": 500}]
        assert json.loads(seg.words_json) == [{"text": "hi", "start_ms": 0, "end_ms": 500}]

    def test_words_setter_clears_to_null_on_empty(self):
        seg = TranscriptSegment(
            transcript_id=1, start_ms=0, end_ms=1000, text="hi",
            words_json=json.dumps([{"text": "hi", "start_ms": 0, "end_ms": 500}]),
        )
        seg.words = None
        assert seg.words_json is None
