from __future__ import annotations

import importlib.util
import sys
import types
from unittest.mock import MagicMock

import pytest

from yuu_clip.config import Config
from yuu_clip.transcribe.diarization_client import (
    DiarizationError,
    NullDiarizationClient,
    PyannoteDiarizationClient,
    SpeechBrainDiarizationClient,
    _active_window_indices,
    _cluster_centroids,
    _cluster_labels,
    _merge_turns,
    _slice_windows,
    make_diarization_client,
)

# torch/scikit-learn are optional (pyannote/speechbrain deps installed on demand),
# so tests that need them skip cleanly on a lean install rather than erroring.
_HAS_TORCH = importlib.util.find_spec("torch") is not None

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

@pytest.fixture
def pyannote_stub(monkeypatch):
    """A sys.modules stand-in for pyannote.audio.

    Importing the real package costs ~30 s (torch-lightning + speechbrain chain)
    and every test here replaces Pipeline.from_pretrained anyway. The client
    imports pyannote lazily inside _run_pipeline, so the stub is all it sees.
    """
    audio_module = types.ModuleType("pyannote.audio")

    class Pipeline:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            raise AssertionError("test must monkeypatch from_pretrained")

    audio_module.Pipeline = Pipeline
    package = types.ModuleType("pyannote")
    package.audio = audio_module
    monkeypatch.setitem(sys.modules, "pyannote", package)
    monkeypatch.setitem(sys.modules, "pyannote.audio", audio_module)
    return audio_module


@pytest.mark.skipif(not _HAS_TORCH, reason="torch not installed (pyannote optional dep)")
class TestPyannoteDiarize:
    def _write_wav(self, path, sample_rate=16000, n_frames=1600):
        import struct
        import wave

        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(struct.pack("<" + "h" * n_frames, *([0] * n_frames)))

    def test_uses_token_kwarg_not_use_auth_token(self, monkeypatch, tmp_path, pyannote_stub):
        turn = MagicMock(start=0.0, end=1.5)
        diar_result = MagicMock()
        diar_result.speaker_diarization.itertracks.return_value = [(turn, None, "SPEAKER_00")]
        pipeline_obj = MagicMock(return_value=diar_result)
        from_pretrained = MagicMock(return_value=pipeline_obj)
        monkeypatch.setattr(pyannote_stub.Pipeline, "from_pretrained", from_pretrained)

        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        turns = PyannoteDiarizationClient(cfg).diarize(str(wav_path))

        assert turns == [(0.0, 1.5, "SPEAKER_00")]
        args, kwargs = from_pretrained.call_args
        assert args[0] == "pyannote/speaker-diarization-community-1"
        assert kwargs.get("token") == "hf_abc"
        assert "use_auth_token" not in kwargs

    # The pipeline must receive an in-memory {waveform, sample_rate} dict, not the
    # file path: passing the path makes pyannote 4.x decode via torchcodec, which
    # fails on machines without FFmpeg shared libraries ("torchcodec is not
    # available") and silently disables speaker labels.
    def test_passes_waveform_dict_not_path(self, monkeypatch, tmp_path, pyannote_stub):
        import torch

        diar_result = MagicMock()
        diar_result.speaker_diarization.itertracks.return_value = []
        pipeline_obj = MagicMock(return_value=diar_result)
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained",
            MagicMock(return_value=pipeline_obj),
        )

        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path, sample_rate=16000, n_frames=1600)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        PyannoteDiarizationClient(cfg).diarize(str(wav_path))

        (passed,), _ = pipeline_obj.call_args
        assert isinstance(passed, dict)
        assert passed["sample_rate"] == 16000
        assert isinstance(passed["waveform"], torch.Tensor)
        assert passed["waveform"].shape == (1, 1600)

    # community-1's pipeline returns a DiarizeOutput dataclass whose Annotation lives
    # under `.speaker_diarization`; calling `.itertracks` on the wrapper itself raises
    # "'DiarizeOutput' object has no attribute 'itertracks'". diarize() must unwrap it.
    def test_unwraps_diarizeoutput_speaker_diarization(self, monkeypatch, tmp_path, pyannote_stub):
        class FakeAnnotation:
            def itertracks(self, yield_label=False):
                turn = MagicMock(start=2.0, end=3.0)
                return [(turn, None, "SPEAKER_01")]

        class FakeDiarizeOutput:
            speaker_diarization = FakeAnnotation()

        pipeline_obj = MagicMock(return_value=FakeDiarizeOutput())
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained",
            MagicMock(return_value=pipeline_obj),
        )

        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        turns = PyannoteDiarizationClient(cfg).diarize(str(wav_path))

        assert turns == [(2.0, 3.0, "SPEAKER_01")]

    # pyannote returns None from from_pretrained (rather than raising) when the
    # token can't access the gated repos / hasn't accepted the model terms. The
    # old code then crashed with 'NoneType' object is not callable, buried in
    # the log. It must instead surface an actionable error.
    def test_none_pipeline_raises_actionable_error(self, monkeypatch, pyannote_stub):
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained", MagicMock(return_value=None)
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
    def test_access_error_preserves_repo_and_adds_hint(self, monkeypatch, pyannote_stub):
        def _raise_gated(*args, **kwargs):
            raise RuntimeError(
                "403 Client Error. Access to model "
                "pyannote/speaker-diarization-community-1 is restricted. "
                "Visit https://hf.co/pyannote/speaker-diarization-community-1"
            )

        monkeypatch.setattr(pyannote_stub.Pipeline, "from_pretrained", _raise_gated)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        with pytest.raises(DiarizationError) as excinfo:
            PyannoteDiarizationClient(cfg).diarize("/tmp/clip.wav")
        message = str(excinfo.value)
        assert "speaker-diarization-community-1" in message
        assert "hf.co/settings/tokens" in message

    def test_diarize_with_embeddings_maps_labels_to_centroids(self, monkeypatch, tmp_path, pyannote_stub):
        turn_a = MagicMock(start=0.0, end=1.0)
        turn_b = MagicMock(start=1.0, end=2.0)
        diar_result = MagicMock()
        diar_result.speaker_diarization.itertracks.return_value = [
            (turn_a, None, "SPEAKER_00"), (turn_b, None, "SPEAKER_01"),
        ]
        diar_result.speaker_diarization.labels.return_value = ["SPEAKER_00", "SPEAKER_01"]
        diar_result.speaker_embeddings = [[0.1, 0.2], [0.3, 0.4]]
        pipeline_obj = MagicMock(return_value=diar_result)
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained", MagicMock(return_value=pipeline_obj)
        )

        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        turns, embeddings = PyannoteDiarizationClient(cfg).diarize_with_embeddings(str(wav_path))

        assert turns == [(0.0, 1.0, "SPEAKER_00"), (1.0, 2.0, "SPEAKER_01")]
        assert embeddings == {"SPEAKER_00": [0.1, 0.2], "SPEAKER_01": [0.3, 0.4]}

    def test_diarize_with_embeddings_tolerates_no_embeddings(self, monkeypatch, tmp_path, pyannote_stub):
        # A bare Annotation (older pipeline): result is the annotation itself,
        # so there is no separate speaker_embeddings attribute to read.
        class FakeAnnotation:
            def itertracks(self, yield_label=False):
                return [(MagicMock(start=2.0, end=3.0), None, "SPEAKER_00")]
            def labels(self):
                return ["SPEAKER_00"]

        pipeline_obj = MagicMock(return_value=FakeAnnotation())
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained", MagicMock(return_value=pipeline_obj)
        )
        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        turns, embeddings = PyannoteDiarizationClient(cfg).diarize_with_embeddings(str(wav_path))

        assert turns == [(2.0, 3.0, "SPEAKER_00")]
        assert embeddings == {}

    def test_moves_pipeline_to_cuda_when_available(self, monkeypatch, tmp_path, pyannote_stub):
        import torch

        monkeypatch.setattr(torch.cuda, "is_available", lambda: True)
        diar_result = MagicMock()
        diar_result.speaker_diarization.itertracks.return_value = []
        pipeline_obj = MagicMock(return_value=diar_result)
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained", MagicMock(return_value=pipeline_obj)
        )
        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        PyannoteDiarizationClient(cfg).diarize(str(wav_path))

        assert pipeline_obj.to.called
        (device,), _ = pipeline_obj.to.call_args
        assert device.type == "cuda"

    def test_stays_on_cpu_when_cuda_unavailable(self, monkeypatch, tmp_path, pyannote_stub):
        import torch

        monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
        diar_result = MagicMock()
        diar_result.speaker_diarization.itertracks.return_value = []
        pipeline_obj = MagicMock(return_value=diar_result)
        monkeypatch.setattr(
            pyannote_stub.Pipeline, "from_pretrained", MagicMock(return_value=pipeline_obj)
        )
        wav_path = tmp_path / "clip.wav"
        self._write_wav(wav_path)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        PyannoteDiarizationClient(cfg).diarize(str(wav_path))

        assert not pipeline_obj.to.called

    def test_unrelated_error_is_not_masked(self, monkeypatch, pyannote_stub):
        def _raise_disk(*args, **kwargs):
            raise OSError("No space left on device")

        monkeypatch.setattr(pyannote_stub.Pipeline, "from_pretrained", _raise_disk)
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        with pytest.raises(OSError):
            PyannoteDiarizationClient(cfg).diarize("/tmp/clip.wav")


# ---------------------------------------------------------------------------
# Retranscribe diarization — clip-window turns must be shifted to absolute time
# ---------------------------------------------------------------------------

class TestRetranscribeDiarization:
    def _patch(self, monkeypatch, client):
        """Patch the diarization client and capture _assign/_attach calls."""
        from yuu_clip.transcribe import whisper_runner

        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client.make_diarization_client",
            lambda config: client,
        )
        captured = {}
        monkeypatch.setattr(
            whisper_runner, "_assign_speakers",
            lambda session, transcript_id, turns: captured.update(turns=turns, tx=transcript_id),
        )
        monkeypatch.setattr(
            whisper_runner, "_attach_speakers",
            lambda session, video_id, transcript_id, embeddings, threshold=None, active_backend=None:
                captured.update(attach=(video_id, transcript_id, embeddings, threshold, active_backend)),
        )
        return captured

    def test_shifts_turns_by_clip_offset(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.cli import export as export_cli

        class FakeClient:
            def available(self):
                return True, ""

            def diarize_with_embeddings(self, path):
                return [(1.0, 2.0, "SPEAKER_00"), (3.0, 4.0, "SPEAKER_01")], {}

        captured = self._patch(monkeypatch, FakeClient())
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        export_cli._maybe_diarize_segment(
            session=None, config=cfg, video_id=4, transcript_id=7,
            segment_wav=Path("seg.wav"), offset_s=86.7, track_label="combined",
        )
        assert captured["tx"] == 7
        assert captured["turns"] == [(87.7, 88.7, "SPEAKER_00"), (89.7, 90.7, "SPEAKER_01")]

    def test_attaches_voiceprints_with_configured_threshold(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.cli import export as export_cli

        embeddings = {"SPEAKER_00": [1.0, 0.0]}

        class FakeClient:
            def available(self):
                return True, ""

            def diarize_with_embeddings(self, path):
                return [(1.0, 2.0, "SPEAKER_00")], embeddings

        captured = self._patch(monkeypatch, FakeClient())
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc",
                     speaker_match_threshold=0.62)
        export_cli._maybe_diarize_segment(
            session=None, config=cfg, video_id=4, transcript_id=7,
            segment_wav=Path("seg.wav"), offset_s=0.0, track_label="combined",
        )
        # video_id, the configured threshold, and the active backend must reach
        # _attach_speakers so a named voice re-attaches during a per-clip retranscribe.
        assert captured["attach"] == (4, 7, embeddings, 0.62, "pyannote")

    def test_noop_when_diarization_unavailable(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.cli import export as export_cli

        class FakeClient:
            def available(self):
                return False, "no token"

            def diarize_with_embeddings(self, path):
                raise AssertionError("diarize must not run when unavailable")

        captured = self._patch(monkeypatch, FakeClient())
        cfg = Config(diarization_backend="pyannote", huggingface_token="")
        export_cli._maybe_diarize_segment(None, cfg, 4, 7, Path("seg.wav"), 0.0, "combined")
        assert captured == {}


# ---------------------------------------------------------------------------
# diarize_track — pipeline-stage orchestration + error paths
# ---------------------------------------------------------------------------

class TestDiarizeTrack:
    def _wire(self, monkeypatch, client, *, available=(True, ""),
              embeddings_result=None, diarize_side_effect=None):
        """Patch make_diarization_client and capture _assign/_attach calls."""
        from yuu_clip.transcribe import whisper_runner

        class FakeClient:
            def available(self_inner):
                return available

            def diarize_with_embeddings(self_inner, path):
                if diarize_side_effect is not None:
                    raise diarize_side_effect
                return embeddings_result

        monkeypatch.setattr(whisper_runner, "make_diarization_client", lambda config: FakeClient())
        captured = {}
        monkeypatch.setattr(
            whisper_runner, "_assign_speakers",
            lambda session, transcript_id, turns: captured.setdefault("assign", []).append((transcript_id, turns)),
        )
        monkeypatch.setattr(
            whisper_runner, "_attach_speakers",
            lambda session, video_id, transcript_id, embeddings, threshold=None, active_backend=None: captured.setdefault("attach", []).append((video_id, transcript_id, embeddings, threshold, active_backend)),
        )
        return captured

    def _fake_track(self):
        return MagicMock(id=3, label="combined", video_id=9, stream_index=1)

    def _fake_transcript(self):
        return MagicMock(id=7)

    def test_assigns_and_attaches_on_success(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.whisper_runner import diarize_track

        turns = [(0.0, 1.0, "SPEAKER_00")]
        embeddings = {"SPEAKER_00": [1.0, 0.0]}
        captured = self._wire(monkeypatch, None, embeddings_result=(turns, embeddings))

        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc",
                     speaker_match_threshold=0.6)
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert captured["assign"] == [(7, turns)]
        # The configured threshold and active backend must be forwarded to _attach_speakers.
        assert captured["attach"] == [(9, 7, embeddings, 0.6, "pyannote")]

    def test_noop_when_backend_unavailable(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.whisper_runner import diarize_track

        captured = self._wire(monkeypatch, None, available=(False, "no token"))
        cfg = Config(diarization_backend="pyannote", huggingface_token="")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured
        assert "attach" not in captured

    def test_diarization_error_is_swallowed(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.whisper_runner import diarize_track

        captured = self._wire(
            monkeypatch, None,
            diarize_side_effect=DiarizationError("accept model terms at hf.co/..."),
        )
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        # Must not raise — a diarization failure never aborts the run.
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured  # failure occurred before assignment

    def test_unexpected_error_is_swallowed(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.whisper_runner import diarize_track

        captured = self._wire(
            monkeypatch, None, diarize_side_effect=RuntimeError("gpu exploded"),
        )
        cfg = Config(diarization_backend="pyannote", huggingface_token="hf_abc")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured


# ---------------------------------------------------------------------------
# _rediarize_video — non-destructive re-run of the diarization stage
# ---------------------------------------------------------------------------

class TestRediarizeVideo:
    def _project(self, tmp_path):
        from yuu_clip.db.models import Video, make_session
        session = make_session(tmp_path / "project.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="done", duration_ms=60_000)
        session.add(video)
        session.flush()
        return session, video

    def _add_track(self, session, video, stream_index, *, do_transcribe, extracted_path):
        from yuu_clip.db.models import AudioTrack
        track = AudioTrack(
            video_id=video.id, stream_index=stream_index,
            do_transcribe=do_transcribe, extracted_path=extracted_path,
        )
        session.add(track)
        session.flush()
        return track

    def _add_transcript(self, session, track):
        from yuu_clip.db.models import Transcript
        tx = Transcript(audio_track_id=track.id, model_name="m")
        session.add(tx)
        session.flush()
        return tx

    def test_rediarizes_latest_transcript_and_skips_non_transcribed(self, tmp_path, monkeypatch):
        from yuu_clip.cli._pipeline import _rediarize_video
        from yuu_clip.transcribe import whisper_runner

        wav = tmp_path / "t.wav"
        wav.write_bytes(b"x")
        session, video = self._project(tmp_path)
        track = self._add_track(session, video, 1, do_transcribe=True, extracted_path=str(wav))
        self._add_transcript(session, track)            # older transcript
        latest = self._add_transcript(session, track)   # newer — must win
        self._add_track(session, video, 2, do_transcribe=False, extracted_path=str(wav))  # must be skipped
        session.commit()

        diarized = []
        monkeypatch.setattr(
            whisper_runner, "diarize_track",
            lambda config, session, transcript, audio_path, track: diarized.append(transcript.id),
        )
        n = _rediarize_video(session, Config(diarization_backend="pyannote"), video)

        assert n == 1
        assert diarized == [latest.id]
        session.close()

    def test_rediarize_no_transcripts_returns_zero(self, tmp_path, monkeypatch):
        from yuu_clip.cli._pipeline import _rediarize_video
        from yuu_clip.transcribe import whisper_runner

        wav = tmp_path / "t.wav"
        wav.write_bytes(b"x")
        session, video = self._project(tmp_path)
        self._add_track(session, video, 1, do_transcribe=True, extracted_path=str(wav))  # no transcript
        session.commit()

        monkeypatch.setattr(
            whisper_runner, "diarize_track",
            lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not diarize without transcripts")),
        )
        assert _rediarize_video(session, Config(diarization_backend="pyannote"), video) == 0
        session.close()


# ---------------------------------------------------------------------------
# _cosine_similarity — voiceprint comparison edge cases
# ---------------------------------------------------------------------------

class TestCosineSimilarity:
    def _cos(self, a, b):
        from yuu_clip.transcribe.whisper_runner import _cosine_similarity
        return _cosine_similarity(a, b)

    def test_identical_vectors_is_one(self):
        assert self._cos([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == pytest.approx(1.0)

    def test_orthogonal_vectors_is_zero(self):
        assert self._cos([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_mismatched_lengths_returns_zero(self):
        # A dimension mismatch (e.g. a stored voiceprint from a different model)
        # must never raise or partially compare — it means "not the same voice".
        assert self._cos([1.0, 0.0], [1.0, 0.0, 0.0]) == 0.0

    def test_zero_vector_returns_zero(self):
        # A zero-norm vector would divide by zero; guarded to return 0.0.
        assert self._cos([0.0, 0.0], [1.0, 1.0]) == 0.0


# ---------------------------------------------------------------------------
# _best_voiceprint_match — threshold boundary + candidate filtering
# ---------------------------------------------------------------------------

class TestBestVoiceprintMatch:
    def _speaker(self, sid, vector):
        from yuu_clip.transcribe.whisper_runner import _serialize_voiceprint
        return MagicMock(id=sid, voiceprint=_serialize_voiceprint(vector) if vector else None)

    def test_returns_none_below_threshold(self):
        from yuu_clip.transcribe.whisper_runner import _best_voiceprint_match
        # Cosine of [1,0] vs [0.5, 0.87] ≈ 0.5 < 0.75 threshold.
        cand = self._speaker(1, [0.5, 0.87])
        assert _best_voiceprint_match([1.0, 0.0], [cand], set())[0] is None

    def test_returns_best_above_threshold(self):
        from yuu_clip.transcribe.whisper_runner import _best_voiceprint_match
        near = self._speaker(1, [0.99, 0.01])
        far = self._speaker(2, [0.5, 0.87])
        assert _best_voiceprint_match([1.0, 0.0], [near, far], set())[0].id == 1

    def test_skips_already_taken_candidate(self):
        from yuu_clip.transcribe.whisper_runner import _best_voiceprint_match
        exact = self._speaker(1, [1.0, 0.0])
        assert _best_voiceprint_match([1.0, 0.0], [exact], {1})[0] is None

    def test_skips_candidate_without_voiceprint(self):
        from yuu_clip.transcribe.whisper_runner import _best_voiceprint_match
        no_print = self._speaker(1, None)
        assert _best_voiceprint_match([1.0, 0.0], [no_print], set())[0] is None

    def test_lower_threshold_matches_what_default_rejects(self):
        from yuu_clip.transcribe.whisper_runner import _best_voiceprint_match
        # Cosine of [1,0] vs [0.5, 0.87] ≈ 0.5: rejected at the 0.75 default,
        # accepted once the threshold is lowered below it.
        cand = self._speaker(1, [0.5, 0.87])
        assert _best_voiceprint_match([1.0, 0.0], [cand], set())[0] is None
        assert _best_voiceprint_match([1.0, 0.0], [cand], set(), threshold=0.4)[0].id == 1


# ---------------------------------------------------------------------------
# SpeechBrainDiarizationClient — availability + pure pipeline helpers
# (steps d–e are factored out so they test without importing SpeechBrain)
# ---------------------------------------------------------------------------

class TestSpeechBrainAvailable:
    def test_missing_reports_install_hint(self, monkeypatch):
        import importlib.util
        real = importlib.util.find_spec

        def _absent(name, *args, **kwargs):
            if name in ("speechbrain", "sklearn"):
                return None
            return real(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", _absent)
        ok, reason = SpeechBrainDiarizationClient(Config(diarization_backend="speechbrain")).available()
        assert ok is False
        assert "Settings" in reason

    def test_present_when_both_installed(self, monkeypatch):
        import importlib.util
        monkeypatch.setattr(
            importlib.util, "find_spec",
            lambda name, *a, **k: object(),  # every module resolves
        )
        ok, reason = SpeechBrainDiarizationClient(Config(diarization_backend="speechbrain")).available()
        assert ok is True
        assert reason == ""


class TestSpeechBrainPipeline:
    def test_slice_windows_only_full_length(self):
        # 3.0 s at 16 kHz, 1.5 s window, 0.75 s hop → starts at 0, 0.75, 1.5 s.
        bounds = _slice_windows(48_000, 16_000)
        assert bounds == [(0, 24_000), (12_000, 36_000), (24_000, 48_000)]

    def test_slice_windows_too_short_returns_empty(self):
        assert _slice_windows(8_000, 16_000) == []

    def test_active_windows_drop_silence(self):
        import numpy as np
        # Three loud windows around -10 dB, one silent at -90 dB → silent dropped.
        rms_db = np.array([-10.0, -90.0, -12.0, -11.0], dtype=np.float32)
        assert _active_window_indices(rms_db) == [0, 2, 3]

    def test_active_windows_empty(self):
        import numpy as np
        assert _active_window_indices(np.array([], dtype=np.float32)) == []

    def test_cluster_labels_separates_two_voices(self):
        pytest.importorskip("sklearn", reason="scikit-learn not installed (speechbrain optional dep)")
        import numpy as np
        # Two tight clusters of orthogonal embeddings → two labels.
        embeddings = np.array([
            [1.0, 0.0], [0.99, 0.01], [0.98, 0.02],
            [0.0, 1.0], [0.01, 0.99], [0.02, 0.98],
        ])
        labels = _cluster_labels(embeddings)
        assert len(set(labels)) == 2
        assert labels[0] == labels[1] == labels[2]
        assert labels[3] == labels[4] == labels[5]
        assert labels[0] != labels[3]

    def test_cluster_labels_single_window(self):
        assert list(_cluster_labels([[1.0, 0.0]])) == [0]

    def test_merge_turns_collapses_adjacent_same_label(self):
        times = [(0.0, 1.5), (0.75, 2.25), (2.25, 3.75)]
        turns = _merge_turns(times, [0, 0, 1])
        assert turns == [(0.0, 2.25, "SPEAKER_00"), (2.25, 3.75, "SPEAKER_01")]

    def test_merge_turns_splits_non_adjacent(self):
        # A gap (window 1 ends before window 2 starts) keeps them separate even
        # with the same label.
        times = [(0.0, 1.5), (10.0, 11.5)]
        turns = _merge_turns(times, [0, 0])
        assert turns == [(0.0, 1.5, "SPEAKER_00"), (10.0, 11.5, "SPEAKER_00")]

    def test_centroids_are_l2_normalized_and_keyed_by_speaker(self):
        import numpy as np
        embeddings = np.array([[3.0, 4.0], [3.0, 4.0], [0.0, 5.0]])
        centroids = _cluster_centroids(embeddings, [0, 0, 1])
        assert set(centroids) == {"SPEAKER_00", "SPEAKER_01"}
        for vector in centroids.values():
            assert np.isclose(np.linalg.norm(vector), 1.0)
        assert np.allclose(centroids["SPEAKER_00"], [0.6, 0.8])


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

    def test_speechbrain(self):
        cfg = Config(diarization_backend="speechbrain")
        assert isinstance(make_diarization_client(cfg), SpeechBrainDiarizationClient)


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
    def _seg(self, text: str, speaker: str | None = None, display_name: str | None = None) -> MagicMock:
        """A segment stub. *speaker* is the raw label; pass *display_name* to
        simulate a durable Speaker attached (via speaker_id/speaker)."""
        s = MagicMock()
        s.text = text
        s.speaker_label = speaker
        if display_name is not None:
            s.speaker_id = 1
            s.speaker.display_name = display_name
        else:
            s.speaker_id = None
            s.speaker = None
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

    def test_resolves_attached_speaker_name(self):
        from yuu_clip.segments.windower import _build_excerpt
        segs = [
            self._seg("hey", "SPEAKER_00", display_name="Yuu"),
            self._seg("there", "SPEAKER_00", display_name="Yuu"),
            self._seg("hi", "SPEAKER_01", display_name="Speaker 2"),
        ]
        result = _build_excerpt(segs)
        assert "Yuu: hey there" in result
        assert "Speaker 2: hi" in result
        assert "SPEAKER_00" not in result  # raw label never leaks once attached
