from __future__ import annotations

from unittest.mock import MagicMock

from yuu_clip.config import Config
import pytest

from yuu_clip.transcribe.diarization_client import (
    DiarizationError,
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
# PyannoteDiarizationClient.diarize() — regression guard for the from_pretrained
# keyword. pyannote.audio 4.x renamed `use_auth_token` to `token`; passing the
# old name raised TypeError and silently disabled speaker labels for every run.
# ---------------------------------------------------------------------------

class TestPyannoteDiarize:
    def test_uses_token_kwarg_not_use_auth_token(self, monkeypatch):
        import pyannote.audio

        turn = MagicMock(start=0.0, end=1.5)
        diar_result = MagicMock()
        diar_result.itertracks.return_value = [(turn, None, "SPEAKER_00")]
        pipeline_obj = MagicMock(return_value=diar_result)
        from_pretrained = MagicMock(return_value=pipeline_obj)
        monkeypatch.setattr(pyannote.audio.Pipeline, "from_pretrained", from_pretrained)

        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        turns = PyannoteDiarizationClient(cfg).diarize("/tmp/clip.wav")

        assert turns == [(0.0, 1.5, "SPEAKER_00")]
        args, kwargs = from_pretrained.call_args
        assert args[0] == "pyannote/speaker-diarization-community-1"
        assert kwargs.get("token") == "hf_abc"
        assert "use_auth_token" not in kwargs

    # pyannote returns None from from_pretrained (rather than raising) when the
    # token can't access the gated repos / hasn't accepted the model terms. The
    # old code then crashed with 'NoneType' object is not callable, buried in
    # the log. It must instead surface an actionable error.
    def test_none_pipeline_raises_actionable_error(self, monkeypatch):
        import pyannote.audio

        monkeypatch.setattr(
            pyannote.audio.Pipeline, "from_pretrained", MagicMock(return_value=None)
        )
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        with pytest.raises(DiarizationError) as excinfo:
            PyannoteDiarizationClient(cfg).diarize("/tmp/clip.wav")
        message = str(excinfo.value)
        assert "hf.co/pyannote/speaker-diarization-community-1" in message
        assert "hf.co/settings/tokens" in message

    # A real pyannote 4.x access error names a repo our static list might not
    # know about (speaker-diarization-community-1). The translated error must
    # preserve that exact repo name and append the account/token guidance.
    def test_access_error_preserves_repo_and_adds_hint(self, monkeypatch):
        import pyannote.audio

        def _raise_gated(*args, **kwargs):
            raise RuntimeError(
                "403 Client Error. Access to model "
                "pyannote/speaker-diarization-community-1 is restricted. "
                "Visit https://hf.co/pyannote/speaker-diarization-community-1"
            )

        monkeypatch.setattr(pyannote.audio.Pipeline, "from_pretrained", _raise_gated)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        with pytest.raises(DiarizationError) as excinfo:
            PyannoteDiarizationClient(cfg).diarize("/tmp/clip.wav")
        message = str(excinfo.value)
        assert "speaker-diarization-community-1" in message
        assert "hf.co/settings/tokens" in message

    def test_unrelated_error_is_not_masked(self, monkeypatch):
        import pyannote.audio

        def _raise_disk(*args, **kwargs):
            raise OSError("No space left on device")

        monkeypatch.setattr(pyannote.audio.Pipeline, "from_pretrained", _raise_disk)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        with pytest.raises(OSError):
            PyannoteDiarizationClient(cfg).diarize("/tmp/clip.wav")


# ---------------------------------------------------------------------------
# Retranscribe diarization — clip-window turns must be shifted to absolute time
# ---------------------------------------------------------------------------

class TestRetranscribeDiarization:
    def test_shifts_turns_by_clip_offset(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.cli import export as export_cli

        class FakeClient:
            def available(self):
                return True, ""

            def diarize(self, path):
                return [(1.0, 2.0, "SPEAKER_00"), (3.0, 4.0, "SPEAKER_01")]

        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client.make_diarization_client",
            lambda config: FakeClient(),
        )
        captured = {}
        monkeypatch.setattr(
            "yuu_clip.transcribe.whisper_runner._assign_speakers",
            lambda session, transcript_id, turns: captured.update(turns=turns, tx=transcript_id),
        )

        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        export_cli._maybe_diarize_segment(
            session=None, config=cfg, transcript_id=7,
            segment_wav=Path("seg.wav"), offset_s=86.7, track_label="combined",
        )
        assert captured["tx"] == 7
        assert captured["turns"] == [(87.7, 88.7, "SPEAKER_00"), (89.7, 90.7, "SPEAKER_01")]

    def test_noop_when_diarization_unavailable(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.cli import export as export_cli

        class FakeClient:
            def available(self):
                return False, "no token"

            def diarize(self, path):
                raise AssertionError("diarize must not run when unavailable")

        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client.make_diarization_client",
            lambda config: FakeClient(),
        )
        cfg = Config(diarization_backend="pyannote", huggingface_token="")
        export_cli._maybe_diarize_segment(None, cfg, 7, Path("seg.wav"), 0.0, "combined")


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
