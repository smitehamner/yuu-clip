from __future__ import annotations

from unittest.mock import MagicMock

from yuu_clip.config import Config
from yuu_clip.transcribe.diarization_client import (
    NullDiarizationClient,
    PyannoteDiarizationClient,
    make_diarization_client,
)


# ---------------------------------------------------------------------------
# NullDiarizationClient
# ---------------------------------------------------------------------------

class TestNullClient:
    def test_available(self):
        ok, reason = NullDiarizationClient().available()
        assert ok is True
        assert reason == ""

    def test_diarize_returns_empty(self):
        assert NullDiarizationClient().diarize("/any/path.wav") == []


# ---------------------------------------------------------------------------
# PyannoteDiarizationClient.available()
# ---------------------------------------------------------------------------

class TestPyannoteAvailable:
    def test_no_token(self):
        cfg = Config(diarization_backend="pyannote", huggingface_token="")
        ok, reason = PyannoteDiarizationClient(cfg).available()
        assert ok is False
        assert "HuggingFace token" in reason

    def test_missing_library(self, monkeypatch):
        import builtins
        real_import = builtins.__import__

        def _block(name, *args, **kwargs):
            if name == "pyannote.audio":
                raise ImportError("no module")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", _block)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        ok, reason = PyannoteDiarizationClient(cfg).available()
        assert ok is False
        assert "pip install" in reason


# ---------------------------------------------------------------------------
# make_diarization_client factory
# ---------------------------------------------------------------------------

class TestFactory:
    def test_null_default(self):
        cfg = Config()
        assert isinstance(make_diarization_client(cfg), NullDiarizationClient)

    def test_null_explicit(self):
        cfg = Config(diarization_backend="null")
        assert isinstance(make_diarization_client(cfg), NullDiarizationClient)

    def test_pyannote(self):
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        assert isinstance(make_diarization_client(cfg), PyannoteDiarizationClient)


# ---------------------------------------------------------------------------
# _assign_speakers (private helper — test via whisper_runner import)
# ---------------------------------------------------------------------------

class TestAssignSpeakers:
    def _make_seg(self, start_ms: int, end_ms: int) -> MagicMock:
        seg = MagicMock()
        seg.start_ms = start_ms
        seg.end_ms = end_ms
        seg.speaker_label = None
        return seg

    def test_assigns_by_overlap(self):
        from yuu_clip.transcribe.whisper_runner import _assign_speakers

        seg_a = self._make_seg(0, 5000)    # 0–5 s
        seg_b = self._make_seg(6000, 10000) # 6–10 s

        session = MagicMock()
        session.query.return_value.filter_by.return_value.order_by.return_value.all.return_value = [seg_a, seg_b]

        turns = [
            (0.0, 5.5, "SPEAKER_00"),   # covers seg_a fully
            (5.5, 11.0, "SPEAKER_01"),  # covers seg_b fully
        ]
        _assign_speakers(session, transcript_id=1, turns=turns)

        assert seg_a.speaker_label == "SPEAKER_00"
        assert seg_b.speaker_label == "SPEAKER_01"

    def test_no_turns_leaves_labels_none(self):
        from yuu_clip.transcribe.whisper_runner import _assign_speakers

        seg = self._make_seg(0, 5000)
        session = MagicMock()
        session.query.return_value.filter_by.return_value.order_by.return_value.all.return_value = [seg]

        _assign_speakers(session, transcript_id=1, turns=[])

        assert seg.speaker_label is None
        session.flush.assert_not_called()

    def test_partial_overlap_picks_best(self):
        from yuu_clip.transcribe.whisper_runner import _assign_speakers

        seg = self._make_seg(3000, 7000)  # 3–7 s

        session = MagicMock()
        session.query.return_value.filter_by.return_value.order_by.return_value.all.return_value = [seg]

        turns = [
            (0.0, 4.0, "SPEAKER_00"),   # 1 s overlap (3–4)
            (4.0, 8.0, "SPEAKER_01"),   # 3 s overlap (4–7)
        ]
        _assign_speakers(session, transcript_id=1, turns=turns)

        assert seg.speaker_label == "SPEAKER_01"


# ---------------------------------------------------------------------------
# _build_excerpt (windower helper)
# ---------------------------------------------------------------------------

class TestBuildExcerpt:
    def _seg(self, text: str, speaker: str | None = None) -> MagicMock:
        s = MagicMock()
        s.text = text
        s.speaker_label = speaker
        return s

    def test_no_labels_plain_join(self):
        from yuu_clip.segments.windower import _build_excerpt
        segs = [self._seg("Hello"), self._seg("world")]
        assert _build_excerpt(segs) == "Hello world"

    def test_with_labels_grouped(self):
        from yuu_clip.segments.windower import _build_excerpt
        segs = [
            self._seg("Hello", "SPEAKER_00"),
            self._seg("there", "SPEAKER_00"),
            self._seg("Hi back", "SPEAKER_01"),
        ]
        result = _build_excerpt(segs)
        assert "SPEAKER_00: Hello there" in result
        assert "SPEAKER_01: Hi back" in result

    def test_mixed_labeled_and_none(self):
        from yuu_clip.segments.windower import _build_excerpt
        segs = [
            self._seg("unclear", None),
            self._seg("clear bit", "SPEAKER_00"),
        ]
        result = _build_excerpt(segs)
        # Some segments labelled → speaker-prefix format
        assert "SPEAKER_00:" in result
