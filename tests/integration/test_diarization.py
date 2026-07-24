"""Diarization: the sklearn-gated clustering tests (importorskip guards).

Everything else in the original test_diarization.py (NullDiarizationClient,
retranscribe/diarize_track orchestration, _rediarize_video, voiceprint math,
_match_or_mint_cluster, suggest_project_voices, SpeechBrain availability/
pipeline helpers, the factory, _assign_speakers, _build_excerpt) is offline-safe
and moved to tests/unit/test_diarization.py."""
from __future__ import annotations

import pytest

from yuu_clip.transcribe.diarization_client import _cluster_labels, _consolidate_labels


class TestSpeechBrainPipeline:
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
