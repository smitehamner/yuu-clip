"""Unit tests for the post-consolidation small-cluster prune (W2).

Pure numpy - no sklearn, no models - so this lives in the unit tier. The prune drops
noise/overlap fragments that survive consolidation by folding their windows into the
nearest surviving voice, but only when that voice is within the grouping distance; a
tiny fragment far from every survivor is a distinct brief voice and is kept. Keyed on an
absolute-seconds floor.
"""
import numpy as np

from yuu_clip.transcribe.diarization_client import _prune_small_clusters


def _emb(rows):
    return np.array(rows, dtype=np.float64)


class TestPruneSmallClusters:
    def test_small_cluster_folds_into_nearest_close_voice(self):
        # Voice A ~ [1,0] (label 0), voice B ~ [0,1] (label 1), plus a 1-window fragment
        # (label 2) that sits close to A (small cosine distance).
        emb = _emb([
            [1, 0], [1, 0], [0.99, 0.01],
            [0, 1], [0, 1], [0.01, 0.99],
            [0.95, 0.05],
        ])
        labels = np.array([0, 0, 0, 1, 1, 1, 2])
        pruned = _prune_small_clusters(emb, labels, min_seconds=3, max_merge_distance=0.5, hop_s=1.0)
        assert set(pruned.tolist()) == {0, 1}
        assert pruned[6] == 0  # folded into A, the nearest close voice

    def test_distant_small_cluster_is_kept_not_forced_into_crowd(self):
        # The footgun guard: a tiny fragment (label 2) that is NOT within the grouping
        # distance of any survivor stays as its own speaker rather than collapsing in.
        # [0.7,0.7] is ~0.29 cosine distance from both A and B; gate 0.15 keeps it.
        emb = _emb([
            [1, 0], [1, 0], [1, 0],
            [0, 1], [0, 1], [0, 1],
            [0.707, 0.707],
        ])
        labels = np.array([0, 0, 0, 1, 1, 1, 2])
        pruned = _prune_small_clusters(emb, labels, min_seconds=3, max_merge_distance=0.15, hop_s=1.0)
        assert set(pruned.tolist()) == {0, 1, 2}
        # A looser gate DOES fold it in (behaviour is monotonic in the distance).
        loose = _prune_small_clusters(emb, labels, min_seconds=3, max_merge_distance=0.5, hop_s=1.0)
        assert set(loose.tolist()) == {0, 1}

    def test_all_large_clusters_are_kept_unchanged(self):
        emb = _emb([[1, 0], [1, 0], [1, 0], [0, 1], [0, 1], [0, 1]])
        labels = np.array([0, 0, 0, 1, 1, 1])
        pruned = _prune_small_clusters(emb, labels, min_seconds=2, max_merge_distance=1.0, hop_s=1.0)
        assert pruned.tolist() == labels.tolist()

    def test_zero_floor_disables_prune(self):
        emb = _emb([[1, 0], [0, 1], [0.9, 0.1]])
        labels = np.array([0, 1, 2])
        pruned = _prune_small_clusters(emb, labels, min_seconds=0, max_merge_distance=1.0, hop_s=1.0)
        assert pruned.tolist() == [0, 1, 2]

    def test_never_removes_the_last_cluster(self):
        # Every cluster is below the floor: return unchanged rather than empty.
        emb = _emb([[1, 0], [0, 1], [0.5, 0.5]])
        labels = np.array([0, 1, 2])
        pruned = _prune_small_clusters(emb, labels, min_seconds=100, max_merge_distance=1.0, hop_s=1.0)
        assert set(pruned.tolist()) == {0, 1, 2}

    def test_surviving_labels_are_renumbered_without_gaps(self):
        """Pruning a MIDDLE cluster must not leave a hole in the numbering.

        Labels become speaker names downstream (_merge_turns / _cluster_centroids format
        them as SPEAKER_NN), so surviving {0, 2} would surface to the user as
        "Speaker 1, Speaker 3" with Speaker 2 missing.
        """
        # Three clusters; the middle one (label 1) is a single window close to A, so it
        # is pruned and folded into 0, leaving raw survivors {0, 2}.
        emb = _emb([
            [1, 0], [1, 0], [1, 0],
            [0.99, 0.01],
            [0, 1], [0, 1], [0, 1],
        ])
        labels = np.array([0, 0, 0, 1, 2, 2, 2])
        pruned = _prune_small_clusters(emb, labels, min_seconds=3, max_merge_distance=0.5, hop_s=1.0)
        assert sorted(set(pruned.tolist())) == [0, 1]
        # Order is preserved: the old-0 windows keep the lower number, old-2 the higher.
        assert pruned[0] == 0
        assert pruned[3] == 0  # the folded fragment went to A
        assert pruned[4] == 1

    def test_renumbering_keeps_a_kept_distant_fragment_distinct(self):
        """Densifying must not merge anything - a gap-filling renumber only."""
        emb = _emb([
            [1, 0], [1, 0], [1, 0],
            [0.707, 0.707],
            [0, 1], [0, 1], [0, 1],
        ])
        labels = np.array([0, 0, 0, 1, 2, 2, 2])
        pruned = _prune_small_clusters(emb, labels, min_seconds=3, max_merge_distance=0.15, hop_s=1.0)
        assert sorted(set(pruned.tolist())) == [0, 1, 2]
        assert len(set(pruned.tolist())) == 3  # still three distinct voices

    def test_speech_time_uses_hop_not_window_count(self):
        # Cluster B has 2 windows. At hop 0.75 that is 1.5 s (< 2 s floor) so it is
        # pruned; at hop 2.0 it is 4 s (>= floor) so it survives. B ~ A so the gate lets
        # it fold when pruned.
        emb = _emb([[1, 0], [1, 0], [1, 0], [1, 0], [0.98, 0.02], [0.98, 0.02]])
        labels = np.array([0, 0, 0, 0, 1, 1])
        assert set(_prune_small_clusters(emb, labels, 2.0, 0.5, hop_s=0.75).tolist()) == {0}
        assert set(_prune_small_clusters(emb, labels, 2.0, 0.5, hop_s=2.0).tolist()) == {0, 1}
