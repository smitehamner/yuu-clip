"""Unit tests for the pure cross-recording voice-matching core (Stage 2).

Uses synthetic vectors and lightweight stand-ins for ProjectVoice / VoiceExemplar /
Speaker so the module stays offline (no torch, no DB). Exact-match assertions per the
determinism rule.
"""
import types

import pytest

from yuu_clip.transcribe.project_voice import (
    best_voice_match,
    cluster_speakers_into_voices,
    cosine_similarity,
    deserialize_voiceprint,
    serialize_voiceprint,
)


def _exemplar(vector, backend="speechbrain"):
    return types.SimpleNamespace(
        voiceprint=serialize_voiceprint(vector), voiceprint_backend=backend
    )


def _voice(voice_id, exemplars):
    return types.SimpleNamespace(id=voice_id, exemplars=exemplars)


def _speaker(sid, vector=None, backend="speechbrain"):
    return types.SimpleNamespace(
        id=sid,
        voiceprint=serialize_voiceprint(vector) if vector is not None else None,
        voiceprint_backend=backend if vector is not None else None,
    )


class TestSerialization:
    def test_round_trips(self):
        assert deserialize_voiceprint(serialize_voiceprint([1.0, -2.5, 0.0])) == [1.0, -2.5, 0.0]


class TestCosineSimilarity:
    def test_identical_vectors_are_one(self):
        assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)

    def test_orthogonal_vectors_are_zero(self):
        assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_length_mismatch_is_zero(self):
        assert cosine_similarity([1.0, 0.0], [1.0]) == 0.0

    def test_zero_vector_is_zero(self):
        assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0


class TestBestVoiceMatch:
    def test_clean_match_above_threshold(self):
        voices = [_voice(1, [_exemplar([1.0, 0.0])])]
        matched, score, top = best_voice_match([1.0, 0.0], "speechbrain", voices, set(), 0.80)
        assert matched is voices[0]
        assert score == pytest.approx(1.0)
        assert top is voices[0]

    def test_near_threshold_suggests_but_does_not_match(self):
        # cos ~0.78, just under 0.80: top is returned for a suggestion, matched is None.
        voices = [_voice(1, [_exemplar([1.0, 0.8])])]
        matched, score, top = best_voice_match([1.0, 0.0], "speechbrain", voices, set(), 0.80)
        assert matched is None
        assert top is voices[0]
        assert 0.75 < score < 0.80

    def test_backend_mismatch_is_skipped(self):
        voices = [_voice(1, [_exemplar([1.0, 0.0], backend="pyannote")])]
        matched, score, top = best_voice_match([1.0, 0.0], "speechbrain", voices, set(), 0.80)
        assert (matched, top) == (None, None)
        assert score == 0.0

    def test_taken_voice_excluded(self):
        voices = [_voice(1, [_exemplar([1.0, 0.0])]), _voice(2, [_exemplar([0.9, 0.1])])]
        matched, _score, top = best_voice_match(
            [1.0, 0.0], "speechbrain", voices, {1}, 0.80
        )
        assert top is voices[1]
        assert matched is voices[1]

    def test_matches_nearest_of_several_exemplars(self):
        # The far exemplar alone would miss; the near one carries the match ("near ANY").
        voices = [_voice(1, [_exemplar([0.0, 1.0]), _exemplar([1.0, 0.0])])]
        matched, score, _top = best_voice_match([1.0, 0.0], "speechbrain", voices, set(), 0.80)
        assert matched is voices[0]
        assert score == pytest.approx(1.0)

    def test_empty_vector_yields_no_match(self):
        voices = [_voice(1, [_exemplar([1.0, 0.0])])]
        assert best_voice_match([], "speechbrain", voices, set(), 0.80) == (None, 0.0, None)

    def test_no_candidate_voices(self):
        assert best_voice_match([1.0, 0.0], "speechbrain", [], set(), 0.80) == (None, 0.0, None)

    def test_none_backend_compares_across_all_backends(self):
        # Deliberate legacy-data tolerance, not a bug (see the "Every cosine skips
        # cross-backend pairs" module docstring): the skip only applies when the
        # query vector's OWN backend is known. When it is None, the backend filter
        # is not applied at all, so an exemplar from a different backend can still
        # match - unlike test_backend_mismatch_is_skipped, where both sides are known
        # and differ.
        voices = [_voice(1, [_exemplar([1.0, 0.0], backend="pyannote")])]
        matched, score, top = best_voice_match([1.0, 0.0], None, voices, set(), 0.80)
        assert matched is voices[0]
        assert top is voices[0]
        assert score == pytest.approx(1.0)


class TestClusterSpeakersIntoVoices:
    def test_two_similar_one_different(self):
        speakers = [
            _speaker(1, [1.0, 0.0]),
            _speaker(2, [0.99, 0.01]),
            _speaker(3, [0.0, 1.0]),
        ]
        groups = cluster_speakers_into_voices(speakers, 0.90)
        assert [[s.id for s in g] for g in groups] == [[1, 2], [3]]

    def test_speakers_without_voiceprint_are_excluded(self):
        speakers = [_speaker(1, [1.0, 0.0]), _speaker(2, None), _speaker(3, [0.99, 0.01])]
        groups = cluster_speakers_into_voices(speakers, 0.90)
        assert [[s.id for s in g] for g in groups] == [[1, 3]]

    def test_cross_backend_never_grouped(self):
        speakers = [
            _speaker(1, [1.0, 0.0], backend="speechbrain"),
            _speaker(2, [1.0, 0.0], backend="pyannote"),
        ]
        groups = cluster_speakers_into_voices(speakers, 0.90)
        assert [[s.id for s in g] for g in groups] == [[1], [2]]

    def test_single_link_transitive_chain(self):
        # 1~2 and 2~3 but 1 not~ 3 directly: single-link still unites all three.
        speakers = [
            _speaker(1, [1.0, 0.0]),
            _speaker(2, [0.94, 0.34]),
            _speaker(3, [0.77, 0.64]),
        ]
        groups = cluster_speakers_into_voices(speakers, 0.90)
        assert [[s.id for s in g] for g in groups] == [[1, 2, 3]]

    def test_deterministic_group_and_member_ordering(self):
        # Provided out of id order; output is sorted by member id and smallest-member id.
        speakers = [_speaker(3, [0.0, 1.0]), _speaker(1, [1.0, 0.0]), _speaker(2, [0.99, 0.01])]
        groups = cluster_speakers_into_voices(speakers, 0.90)
        assert [[s.id for s in g] for g in groups] == [[1, 2], [3]]

    def test_empty_input(self):
        assert cluster_speakers_into_voices([], 0.90) == []
