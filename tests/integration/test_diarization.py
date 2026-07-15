from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from yuu_clip.config import Config
from yuu_clip.transcribe.diarization_client import (
    DiarizationError,
    NullDiarizationClient,
    SpeechBrainDiarizationClient,
    _active_window_indices,
    _cluster_centroids,
    _cluster_labels,
    _consolidate_labels,
    _merge_turns,
    _slice_windows,
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
# Retranscribe diarization - clip-window turns must be shifted to absolute time
# ---------------------------------------------------------------------------

class TestRetranscribeDiarization:
    def _patch(self, monkeypatch, client):
        """Patch the diarization client and capture _assign/_attach calls."""
        from yuu_clip.transcribe import speaker_attach

        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client.make_diarization_client",
            lambda config: client,
        )
        captured = {}
        monkeypatch.setattr(
            speaker_attach, "_assign_speakers",
            lambda session, transcript_id, turns: captured.update(turns=turns, tx=transcript_id),
        )
        monkeypatch.setattr(
            speaker_attach, "_attach_speakers",
            lambda session, video_id, transcript_id, embeddings, threshold=None, active_backend=None:
                captured.update(attach=(video_id, transcript_id, embeddings, threshold, active_backend)),
        )
        return captured

    def test_shifts_turns_by_clip_offset(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.export import render as export_cli

        class FakeClient:
            def available(self):
                return True, ""

            def diarize_with_embeddings(self, path):
                return [(1.0, 2.0, "SPEAKER_00"), (3.0, 4.0, "SPEAKER_01")], {}

        captured = self._patch(monkeypatch, FakeClient())
        cfg = Config(diarization_backend="speechbrain")
        export_cli._maybe_diarize_segment(
            session=None, config=cfg, video_id=4, transcript_id=7,
            segment_wav=Path("seg.wav"), offset_s=86.7, track_label="combined",
        )
        assert captured["tx"] == 7
        assert captured["turns"] == [(87.7, 88.7, "SPEAKER_00"), (89.7, 90.7, "SPEAKER_01")]

    def test_attaches_voiceprints_with_configured_threshold(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.export import render as export_cli

        embeddings = {"SPEAKER_00": [1.0, 0.0]}

        class FakeClient:
            def available(self):
                return True, ""

            def diarize_with_embeddings(self, path):
                return [(1.0, 2.0, "SPEAKER_00")], embeddings

        captured = self._patch(monkeypatch, FakeClient())
        cfg = Config(diarization_backend="speechbrain",
                     speaker_match_threshold=0.62)
        export_cli._maybe_diarize_segment(
            session=None, config=cfg, video_id=4, transcript_id=7,
            segment_wav=Path("seg.wav"), offset_s=0.0, track_label="combined",
        )
        # video_id, the configured threshold, and the active backend must reach
        # _attach_speakers so a named voice re-attaches during a per-clip retranscribe.
        assert captured["attach"] == (4, 7, embeddings, 0.62, "speechbrain")

    def test_noop_when_diarization_unavailable(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.export import render as export_cli

        class FakeClient:
            def available(self):
                return False, "no token"

            def diarize_with_embeddings(self, path):
                raise AssertionError("diarize must not run when unavailable")

        captured = self._patch(monkeypatch, FakeClient())
        cfg = Config(diarization_backend="speechbrain")
        export_cli._maybe_diarize_segment(None, cfg, 4, 7, Path("seg.wav"), 0.0, "combined")
        assert captured == {}


# ---------------------------------------------------------------------------
# diarize_track - pipeline-stage orchestration + error paths
# ---------------------------------------------------------------------------

class TestDiarizeTrack:
    def _wire(self, monkeypatch, client, *, available=(True, ""),
              embeddings_result=None, diarize_side_effect=None):
        """Patch make_diarization_client and capture _assign/_attach calls."""
        from yuu_clip.transcribe import speaker_attach

        class FakeClient:
            def available(self_inner):
                return available

            def diarize_with_embeddings(self_inner, path):
                if diarize_side_effect is not None:
                    raise diarize_side_effect
                return embeddings_result

        monkeypatch.setattr(speaker_attach, "make_diarization_client", lambda config: FakeClient())
        captured = {}
        monkeypatch.setattr(
            speaker_attach, "_assign_speakers",
            lambda session, transcript_id, turns: captured.setdefault("assign", []).append((transcript_id, turns)),
        )
        monkeypatch.setattr(
            speaker_attach, "_attach_speakers",
            lambda session, video_id, transcript_id, embeddings, threshold=None, active_backend=None: captured.setdefault("attach", []).append((video_id, transcript_id, embeddings, threshold, active_backend)),
        )
        return captured

    def _fake_track(self):
        return MagicMock(id=3, label="combined", video_id=9, stream_index=1)

    def _fake_transcript(self):
        return MagicMock(id=7)

    def test_assigns_and_attaches_on_success(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.speaker_attach import diarize_track

        turns = [(0.0, 1.0, "SPEAKER_00")]
        embeddings = {"SPEAKER_00": [1.0, 0.0]}
        captured = self._wire(monkeypatch, None, embeddings_result=(turns, embeddings))

        cfg = Config(diarization_backend="speechbrain",
                     speaker_match_threshold=0.6)
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert captured["assign"] == [(7, turns)]
        # The configured threshold and active backend must be forwarded to _attach_speakers.
        assert captured["attach"] == [(9, 7, embeddings, 0.6, "speechbrain")]
        # Cross-recording suggestion is NOT per-track - it runs once per recording from
        # _run_speaker_diarization (see TestRunSpeakerDiarizationSuggests), not here.
        assert "suggest" not in captured

    def test_noop_when_backend_unavailable(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.speaker_attach import diarize_track

        captured = self._wire(monkeypatch, None, available=(False, "no token"))
        cfg = Config(diarization_backend="speechbrain")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured
        assert "attach" not in captured

    def test_diarization_error_is_swallowed(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.speaker_attach import diarize_track

        captured = self._wire(
            monkeypatch, None,
            diarize_side_effect=DiarizationError("accept model terms at hf.co/..."),
        )
        cfg = Config(diarization_backend="speechbrain")
        # Must not raise - a diarization failure never aborts the run.
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured  # failure occurred before assignment

    def test_unexpected_error_is_swallowed(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.transcribe.speaker_attach import diarize_track

        captured = self._wire(
            monkeypatch, None, diarize_side_effect=RuntimeError("gpu exploded"),
        )
        cfg = Config(diarization_backend="speechbrain")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured

    def test_speechbrain_model_load_failure_is_swallowed(self, monkeypatch):
        """The now-default backend: an offline machine without the ECAPA model
        cached must skip speaker labels for the track, not abort the analyze."""
        from pathlib import Path

        from yuu_clip.transcribe.speaker_attach import diarize_track

        captured = self._wire(
            monkeypatch, None,
            diarize_side_effect=OSError("could not download model (offline)"),
        )
        cfg = Config(diarization_backend="speechbrain")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        assert "assign" not in captured
        assert "attach" not in captured

    def test_downloading_notice_shown_when_model_not_cached(self, monkeypatch, capsys):
        """A first-time speechbrain run must say *why* it's slow instead of
        looking hung (packaging-strategy Wave 4's analyze-log surfacing)."""
        from pathlib import Path

        from yuu_clip.transcribe import speaker_attach
        from yuu_clip.transcribe.speaker_attach import diarize_track

        monkeypatch.setattr(speaker_attach, "speechbrain_model_cached", lambda: False)
        self._wire(monkeypatch, None, embeddings_result=([], {}))
        cfg = Config(diarization_backend="speechbrain")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        out = capsys.readouterr().out
        assert "Downloading the speaker model" in out

    def test_downloading_notice_omitted_when_model_cached(self, monkeypatch, capsys):
        from pathlib import Path

        from yuu_clip.transcribe import speaker_attach
        from yuu_clip.transcribe.speaker_attach import diarize_track

        monkeypatch.setattr(speaker_attach, "speechbrain_model_cached", lambda: True)
        self._wire(monkeypatch, None, embeddings_result=([], {}))
        cfg = Config(diarization_backend="speechbrain")
        diarize_track(cfg, None, self._fake_transcript(), Path("a.wav"), self._fake_track())

        out = capsys.readouterr().out
        assert "Downloading the speaker model" not in out


# ---------------------------------------------------------------------------
# _rediarize_video - non-destructive re-run of the diarization stage
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

    def _add_transcript(self, session, track, created_at=None):
        from yuu_clip.db.models import Transcript
        tx = Transcript(audio_track_id=track.id, model_name="m")
        # Windows datetime.now() resolution (~15ms) lets two rapid inserts share
        # a created_at, and latest_track_transcript picks by max(created_at) - so
        # callers that care which one wins pass explicit, distinct timestamps.
        if created_at is not None:
            tx.created_at = created_at
        session.add(tx)
        session.flush()
        return tx

    def test_rediarizes_latest_transcript_and_skips_non_transcribed(self, tmp_path, monkeypatch):
        from yuu_clip.pipeline.ingest import _rediarize_video
        from yuu_clip.transcribe import speaker_attach

        wav = tmp_path / "t.wav"
        wav.write_bytes(b"x")
        from datetime import datetime, timedelta, timezone
        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        session, video = self._project(tmp_path)
        track = self._add_track(session, video, 1, do_transcribe=True, extracted_path=str(wav))
        self._add_transcript(session, track, created_at=base)                       # older transcript
        latest = self._add_transcript(session, track, created_at=base + timedelta(seconds=1))  # newer - must win
        self._add_track(session, video, 2, do_transcribe=False, extracted_path=str(wav))  # must be skipped
        session.commit()

        diarized = []
        monkeypatch.setattr(
            speaker_attach, "diarize_track",
            lambda config, session, transcript, audio_path, track: diarized.append(transcript.id),
        )
        n = _rediarize_video(session, Config(diarization_backend="speechbrain"), video)

        assert n == 1
        assert diarized == [latest.id]
        session.close()

    def test_rediarize_no_transcripts_returns_zero(self, tmp_path, monkeypatch):
        from yuu_clip.pipeline.ingest import _rediarize_video
        from yuu_clip.transcribe import speaker_attach

        wav = tmp_path / "t.wav"
        wav.write_bytes(b"x")
        session, video = self._project(tmp_path)
        self._add_track(session, video, 1, do_transcribe=True, extracted_path=str(wav))  # no transcript
        session.commit()

        monkeypatch.setattr(
            speaker_attach, "diarize_track",
            lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not diarize without transcripts")),
        )
        assert _rediarize_video(session, Config(diarization_backend="speechbrain"), video) == 0
        session.close()


# ---------------------------------------------------------------------------
# _cosine_similarity - voiceprint comparison edge cases
# ---------------------------------------------------------------------------

class TestCosineSimilarity:
    def _cos(self, a, b):
        from yuu_clip.transcribe.speaker_attach import _cosine_similarity
        return _cosine_similarity(a, b)

    def test_identical_vectors_is_one(self):
        assert self._cos([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == pytest.approx(1.0)

    def test_orthogonal_vectors_is_zero(self):
        assert self._cos([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_mismatched_lengths_returns_zero(self):
        # A dimension mismatch (e.g. a stored voiceprint from a different model)
        # must never raise or partially compare - it means "not the same voice".
        assert self._cos([1.0, 0.0], [1.0, 0.0, 0.0]) == 0.0

    def test_zero_vector_returns_zero(self):
        # A zero-norm vector would divide by zero; guarded to return 0.0.
        assert self._cos([0.0, 0.0], [1.0, 1.0]) == 0.0


# ---------------------------------------------------------------------------
# _best_voiceprint_match - threshold boundary + candidate filtering
# ---------------------------------------------------------------------------

class TestBestVoiceprintMatch:
    def _speaker(self, sid, vector):
        from yuu_clip.transcribe.speaker_attach import _serialize_voiceprint
        return MagicMock(id=sid, voiceprint=_serialize_voiceprint(vector) if vector else None)

    def test_returns_none_below_threshold(self):
        from yuu_clip.transcribe.speaker_attach import _best_voiceprint_match
        # Cosine of [1,0] vs [0.5, 0.87] ≈ 0.5 < 0.75 threshold.
        cand = self._speaker(1, [0.5, 0.87])
        assert _best_voiceprint_match([1.0, 0.0], [cand], set())[0] is None

    def test_returns_best_above_threshold(self):
        from yuu_clip.transcribe.speaker_attach import _best_voiceprint_match
        near = self._speaker(1, [0.99, 0.01])
        far = self._speaker(2, [0.5, 0.87])
        assert _best_voiceprint_match([1.0, 0.0], [near, far], set())[0].id == 1

    def test_skips_already_taken_candidate(self):
        from yuu_clip.transcribe.speaker_attach import _best_voiceprint_match
        exact = self._speaker(1, [1.0, 0.0])
        assert _best_voiceprint_match([1.0, 0.0], [exact], {1})[0] is None

    def test_skips_candidate_without_voiceprint(self):
        from yuu_clip.transcribe.speaker_attach import _best_voiceprint_match
        no_print = self._speaker(1, None)
        assert _best_voiceprint_match([1.0, 0.0], [no_print], set())[0] is None

    def test_lower_threshold_matches_what_default_rejects(self):
        from yuu_clip.transcribe.speaker_attach import _best_voiceprint_match
        # Cosine of [1,0] vs [0.5, 0.87] ≈ 0.5: rejected at the 0.75 default,
        # accepted once the threshold is lowered below it.
        cand = self._speaker(1, [0.5, 0.87])
        assert _best_voiceprint_match([1.0, 0.0], [cand], set())[0] is None
        assert _best_voiceprint_match([1.0, 0.0], [cand], set(), threshold=0.4)[0].id == 1


# ---------------------------------------------------------------------------
# _match_or_mint_cluster - re-attach vs mint, and the near-miss "confirm" band
# ---------------------------------------------------------------------------

class TestMatchOrMintCluster:
    """The re-attach boundary: at/above threshold a cluster re-attaches to a prior
    named Speaker (name survives); just below it a fresh Speaker is minted but records
    a suggested match to confirm; well below it a fresh Speaker is minted with no
    suggestion. A prior Speaker already claimed this run must never be re-used."""

    def _session(self, tmp_path):
        from yuu_clip.db.models import make_session
        return make_session(tmp_path / "project.db")

    def _video(self, session):
        from yuu_clip.db.models import Video
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        return video

    def _prior(self, session, video, vector, *, backend="speechbrain", display_index=1):
        from yuu_clip.db.models import Speaker
        from yuu_clip.transcribe.project_voice import serialize_voiceprint
        speaker = Speaker(
            video_id=video.id, display_index=display_index, source="manual",
            voiceprint=serialize_voiceprint(vector), voiceprint_backend=backend,
        )
        session.add(speaker)
        session.flush()
        return speaker

    def _call(self, session, video, vector, prior_speakers, taken_ids, *, mint_index=5):
        from yuu_clip.transcribe.speaker_attach import _match_or_mint_cluster
        return _match_or_mint_cluster(
            session, video.id, vector, prior_speakers, taken_ids,
            threshold=0.75, active_backend="speechbrain", has_candidates=True,
            mint_display_index=mint_index,
        )

    def test_reattaches_to_prior_named_speaker_at_threshold(self, tmp_path):
        session = self._session(tmp_path)
        try:
            video = self._video(session)
            prior = self._prior(session, video, [1.0, 0.0])
            taken: set[int] = set()
            speaker_id, outcome = self._call(session, video, [1.0, 0.0], [prior], taken)
            assert (speaker_id, outcome) == (prior.id, "matched")
            assert taken == {prior.id}
        finally:
            session.close()

    def test_near_miss_in_band_mints_with_suggested_match(self, tmp_path):
        from yuu_clip.db.models import Speaker
        session = self._session(tmp_path)
        try:
            video = self._video(session)
            # Cosine([1,0], [0.70, 0.714]) ~= 0.70: inside [0.65, 0.75) confirm band.
            prior = self._prior(session, video, [1.0, 0.0])
            speaker_id, outcome = self._call(
                session, video, [0.70, 0.714], [prior], set(), mint_index=5)
            assert outcome == "minted"
            minted = session.get(Speaker, speaker_id)
            assert minted.id != prior.id
            assert minted.display_index == 5
            assert minted.suggested_match_id == prior.id
            assert minted.suggested_match_score == pytest.approx(0.70, abs=0.01)
        finally:
            session.close()

    def test_clear_miss_mints_without_suggestion(self, tmp_path):
        from yuu_clip.db.models import Speaker
        session = self._session(tmp_path)
        try:
            video = self._video(session)
            # Cosine([1,0], [0.5, 0.866]) ~= 0.50: below the 0.65 band floor.
            prior = self._prior(session, video, [1.0, 0.0])
            speaker_id, outcome = self._call(
                session, video, [0.5, 0.866], [prior], set())
            assert outcome == "minted"
            minted = session.get(Speaker, speaker_id)
            assert minted.suggested_match_id is None
            assert minted.suggested_match_score is None
        finally:
            session.close()

    def test_already_claimed_prior_is_not_reused(self, tmp_path):
        session = self._session(tmp_path)
        try:
            video = self._video(session)
            # An identical voiceprint would match, but the only prior is already taken
            # this run, so the cluster must mint rather than collapse onto it.
            prior = self._prior(session, video, [1.0, 0.0])
            speaker_id, outcome = self._call(
                session, video, [1.0, 0.0], [prior], {prior.id})
            assert outcome == "minted"
            assert speaker_id != prior.id
        finally:
            session.close()


# ---------------------------------------------------------------------------
# suggest_project_voices - cross-recording Person suggestions (propose, never apply)
# ---------------------------------------------------------------------------

class TestSuggestProjectVoices:
    def _session(self, tmp_path):
        from yuu_clip.db.models import make_session
        return make_session(tmp_path / "project.db")

    def _video(self, session):
        from yuu_clip.db.models import Video
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        return video

    def _voice(self, session, vector, *, name="Alex", backend="speechbrain"):
        from yuu_clip.db.models import ProjectVoice, VoiceExemplar
        from yuu_clip.transcribe.project_voice import serialize_voiceprint
        voice = ProjectVoice(name=name, display_index=1, confirmed=True)
        session.add(voice)
        session.flush()
        session.add(VoiceExemplar(
            project_voice_id=voice.id,
            voiceprint=serialize_voiceprint(vector),
            voiceprint_backend=backend,
        ))
        session.flush()
        return voice

    def _speaker(self, session, video, vector, *, backend="speechbrain", display_index=1):
        from yuu_clip.db.models import Speaker
        from yuu_clip.transcribe.project_voice import serialize_voiceprint
        speaker = Speaker(
            video_id=video.id, display_index=display_index,
            voiceprint=serialize_voiceprint(vector) if vector else None,
            voiceprint_backend=backend if vector else None,
        )
        session.add(speaker)
        session.flush()
        return speaker

    def test_known_voice_gets_suggestion_not_link(self, tmp_path):
        from yuu_clip.transcribe.speaker_attach import suggest_project_voices

        session = self._session(tmp_path)
        try:
            voice = self._voice(session, [1.0, 0.0])
            video = self._video(session)
            speaker = self._speaker(session, video, [1.0, 0.0])

            suggest_project_voices(session, video.id, 0.80)

            assert speaker.suggested_voice_id == voice.id
            assert speaker.suggested_voice_score == pytest.approx(1.0)
            # The strict rule: matching only SUGGESTS - it never links automatically.
            assert speaker.global_voice_id is None
        finally:
            session.close()

    def test_no_project_voices_is_noop(self, tmp_path):
        from yuu_clip.transcribe.speaker_attach import suggest_project_voices

        session = self._session(tmp_path)
        try:
            video = self._video(session)
            speaker = self._speaker(session, video, [1.0, 0.0])
            suggest_project_voices(session, video.id, 0.80)
            assert speaker.suggested_voice_id is None
        finally:
            session.close()

    def test_already_linked_speaker_is_skipped(self, tmp_path):
        from yuu_clip.transcribe.speaker_attach import suggest_project_voices

        session = self._session(tmp_path)
        try:
            voice = self._voice(session, [1.0, 0.0])
            video = self._video(session)
            speaker = self._speaker(session, video, [1.0, 0.0])
            speaker.global_voice_id = voice.id
            session.flush()
            suggest_project_voices(session, video.id, 0.80)
            assert speaker.suggested_voice_id is None
        finally:
            session.close()

    def test_backend_mismatch_no_suggestion(self, tmp_path):
        from yuu_clip.transcribe.speaker_attach import suggest_project_voices

        session = self._session(tmp_path)
        try:
            # A voiceprint from a different (hypothetical) backend must never be
            # compared against the active speechbrain speaker - incompatible spaces.
            self._voice(session, [1.0, 0.0], backend="other-backend")
            video = self._video(session)
            speaker = self._speaker(session, video, [1.0, 0.0], backend="speechbrain")
            suggest_project_voices(session, video.id, 0.80)
            assert speaker.suggested_voice_id is None
        finally:
            session.close()

    def test_one_person_suggested_to_at_most_one_speaker(self, tmp_path):
        from yuu_clip.transcribe.speaker_attach import suggest_project_voices

        session = self._session(tmp_path)
        try:
            voice = self._voice(session, [1.0, 0.0])
            video = self._video(session)
            first = self._speaker(session, video, [1.0, 0.0], display_index=1)
            second = self._speaker(session, video, [0.99, 0.01], display_index=2)
            suggest_project_voices(session, video.id, 0.80)
            # Both resemble the Person, but the recording already separated them:
            # only one may claim it.
            claimed = [s for s in (first, second) if s.suggested_voice_id == voice.id]
            assert len(claimed) == 1
        finally:
            session.close()


class TestRunSpeakerDiarizationSuggests:
    """suggest_project_voices runs ONCE per recording from _run_speaker_diarization,
    not once per track (efficiency: all a video's tracks share its Speaker set)."""

    def test_suggest_called_once_for_two_tracks(self, tmp_path, monkeypatch):
        from yuu_clip.db.models import AudioTrack, Transcript, Video, make_session
        from yuu_clip.pipeline import ingest
        from yuu_clip.transcribe import speaker_attach

        wav = tmp_path / "a.wav"
        wav.write_bytes(b"x")
        session = make_session(tmp_path / "p.db")
        video = Video(path="s.mkv", filename="s.mkv", status="done", duration_ms=1000)
        session.add(video)
        session.flush()
        transcripts = []
        for stream_index in (1, 2):
            track = AudioTrack(video_id=video.id, stream_index=stream_index,
                               do_transcribe=True, extracted_path=str(wav))
            session.add(track)
            session.flush()
            tx = Transcript(audio_track_id=track.id, model_name="m")
            session.add(tx)
            session.flush()
            transcripts.append(tx)
        session.commit()

        monkeypatch.setattr(speaker_attach, "diarize_track", lambda *a, **k: None)
        calls = []
        monkeypatch.setattr(
            speaker_attach, "suggest_project_voices",
            lambda sess, video_id, threshold: calls.append((video_id, threshold)),
        )
        ingest._run_speaker_diarization(Config(diarization_backend="speechbrain"), session, transcripts)

        assert calls == [(video.id, Config().project_voice_match_threshold)]
        session.close()


# ---------------------------------------------------------------------------
# SpeechBrainDiarizationClient - availability + pure pipeline helpers
# (steps d–e are factored out so they test without importing SpeechBrain)
# ---------------------------------------------------------------------------

class TestSpeechBrainAvailable:
    def test_missing_reports_reinstall_hint(self, monkeypatch):
        # SpeechBrain is bundled by default (packaging-strategy overhaul) - this
        # branch means a broken/partial install, not a missing optional package,
        # so the reason points at reinstalling rather than a Settings button.
        import importlib.util
        real = importlib.util.find_spec

        def _absent(name, *args, **kwargs):
            if name in ("speechbrain", "sklearn"):
                return None
            return real(name, *args, **kwargs)

        monkeypatch.setattr(importlib.util, "find_spec", _absent)
        ok, reason = SpeechBrainDiarizationClient(Config(diarization_backend="speechbrain")).available()
        assert ok is False
        assert "reinstalling" in reason

    def test_present_when_both_installed(self, monkeypatch):
        import importlib.util
        monkeypatch.setattr(
            importlib.util, "find_spec",
            lambda name, *a, **k: object(),  # every module resolves
        )
        ok, reason = SpeechBrainDiarizationClient(Config(diarization_backend="speechbrain")).available()
        assert ok is True
        assert reason == ""


class TestSpeechBrainModelLoadFailure:
    """A model that can't be fetched (offline, not cached) must propagate a plain
    exception rather than hang or silently return empty - diarize_track (the
    caller) is what actually swallows it and skips speaker labels for the track."""

    def test_load_encoder_failure_propagates_from_diarize_with_embeddings(self, monkeypatch):
        import numpy as np

        client = SpeechBrainDiarizationClient(Config(diarization_backend="speechbrain"))
        monkeypatch.setattr(
            "yuu_clip.transcribe.diarization_client._load_mono_waveform",
            lambda audio_path: (np.ones(16000 * 3, dtype=np.float32), 16000),
        )

        def _boom():
            raise OSError("could not download model (offline)")

        monkeypatch.setattr(client, "_load_encoder", _boom)

        with pytest.raises(OSError):
            client.diarize_with_embeddings("a.wav")


class TestPrefetchSpeechbrainModel:
    """The Settings "Download now" prefetch flow (packaging-strategy Wave 4)
    triggers the same encoder load diarization would on first use."""

    def test_prefetch_loads_the_encoder(self, monkeypatch):
        from yuu_clip.transcribe.diarization_client import prefetch_speechbrain_model

        calls = []
        monkeypatch.setattr(SpeechBrainDiarizationClient, "_load_encoder", lambda self: calls.append(1))
        prefetch_speechbrain_model(Config(diarization_backend="speechbrain"))
        assert calls == [1]


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

    def test_consolidate_merges_duplicate_speaker_clusters(self):
        pytest.importorskip("sklearn", reason="scikit-learn not installed (speechbrain optional dep)")
        import numpy as np
        # raw clusters 0 and 1 are the SAME voice (over-fragmented); cluster 2 is a
        # different voice. Consolidation should collapse 0+1 but keep 2 separate.
        embeddings = np.array([
            [1.0, 0.0], [0.99, 0.01],
            [0.98, 0.02], [0.97, 0.03],
            [0.0, 1.0], [0.01, 0.99],
        ])
        raw = np.array([0, 0, 1, 1, 2, 2])
        merged = _consolidate_labels(embeddings, raw, 0.75)
        assert len(set(merged.tolist())) == 2
        assert merged[0] == merged[1] == merged[2] == merged[3]
        assert merged[4] == merged[5]
        assert merged[0] != merged[4]

    def test_consolidate_keeps_distinct_voices(self):
        pytest.importorskip("sklearn", reason="scikit-learn not installed (speechbrain optional dep)")
        import numpy as np
        # Orthogonal centroids (cosine similarity 0) stay separate at any sane threshold.
        merged = _consolidate_labels(np.array([[1.0, 0.0], [0.0, 1.0]]), np.array([0, 1]), 0.75)
        assert len(set(merged.tolist())) == 2

    def test_consolidate_single_cluster_is_noop(self):
        import numpy as np
        merged = _consolidate_labels(np.array([[1.0, 0.0], [0.9, 0.1]]), np.array([0, 0]), 0.75)
        assert list(merged) == [0, 0]

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
    def test_speechbrain_is_default(self):
        # packaging-strategy overhaul: the tokenless speechbrain backend is now
        # the out-of-the-box default (was "null").
        cfg = Config()
        assert cfg.diarization_backend == "speechbrain"
        assert isinstance(make_diarization_client(cfg), SpeechBrainDiarizationClient)

    def test_null_explicit(self):
        cfg = Config(diarization_backend="null")
        assert isinstance(make_diarization_client(cfg), NullDiarizationClient)

    def test_speechbrain(self):
        cfg = Config(diarization_backend="speechbrain")
        assert isinstance(make_diarization_client(cfg), SpeechBrainDiarizationClient)


# ---------------------------------------------------------------------------
# _assign_speakers (private helper - test via speaker_attach import)
# ---------------------------------------------------------------------------

class TestAssignSpeakers:
    def _make_seg(self, start_ms: int, end_ms: int) -> MagicMock:
        seg = MagicMock()
        seg.start_ms = start_ms
        seg.end_ms = end_ms
        seg.speaker_label = None
        return seg

    def test_assigns_by_overlap(self):
        from yuu_clip.transcribe.speaker_attach import _assign_speakers

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
        from yuu_clip.transcribe.speaker_attach import _assign_speakers

        seg = self._make_seg(0, 5000)
        session = MagicMock()
        session.query.return_value.filter_by.return_value.order_by.return_value.all.return_value = [seg]

        _assign_speakers(session, transcript_id=1, turns=[])

        assert seg.speaker_label is None
        session.flush.assert_not_called()

    def test_partial_overlap_picks_best(self):
        from yuu_clip.transcribe.speaker_attach import _assign_speakers

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
