"""Tiered similarity engine (scoring/similarity.py) — plan non-llm-tiers/01."""
from __future__ import annotations

import unittest.mock as mock

from yuu_clip.config import Config


def _cfg(**overrides) -> Config:
    return Config(**overrides)


# ── TfidfBackend ──────────────────────────────────────────────────────────────


class TestTfidfRankSimilar:
    def _backend(self):
        from yuu_clip.scoring.similarity import TfidfBackend
        return TfidfBackend(_cfg())

    def test_related_candidate_ranks_first_and_unrelated_dropped(self):
        candidates = [
            {"id": 1, "description": "the crew pulls off a daring bank heist and a getaway car chase"},
            {"id": 2, "description": "a quiet evening cooking dinner at home"},
        ]
        results = self._backend().rank_similar("bank heist getaway car", candidates)
        assert results[0]["id"] == 1
        assert all(r["id"] != 2 for r in results)

    def test_reason_lists_shared_terms(self):
        candidates = [{"id": 5, "description": "epic bank heist getaway"}]
        results = self._backend().rank_similar("bank heist getaway", candidates)
        assert results[0]["reason"].startswith("shared:")
        assert "heist" in results[0]["reason"]

    def test_empty_query_returns_empty(self):
        results = self._backend().rank_similar("", [{"id": 1, "description": "anything"}])
        assert results == []

    def test_top_k_limits_results(self):
        candidates = [{"id": i, "description": "shared word token here"} for i in range(10)]
        results = self._backend().rank_similar("shared word token", candidates, top_k=3)
        assert len(results) == 3


class TestTfidfMatchConcepts:
    def _backend(self):
        from yuu_clip.scoring.similarity import TfidfBackend
        return TfidfBackend(_cfg())

    def test_lexical_paraphrase_matches_unrelated_rejected(self):
        text = "we just pulled off an amazing bank robbery downtown"
        matched = self._backend().match_concepts(text, ["bank robbery", "baking cookies"])
        assert matched == ["bank robbery"]

    def test_empty_phrases_returns_empty(self):
        assert self._backend().match_concepts("some text", []) == []

    def test_threshold_gates_partial_overlap(self):
        # Only one of the two content tokens present → 0.5 overlap. A 0.9 cutoff rejects it.
        text = "the bank was closed"
        assert self._backend().match_concepts(text, ["bank robbery"], threshold=0.9) == []
        assert self._backend().match_concepts(text, ["bank robbery"], threshold=0.5) == ["bank robbery"]


# ── EmbeddingsBackend (fastembed mocked — no model download) ───────────────────


class _FakeEmbedModel:
    """Maps known strings to hand-picked vectors so cosine is deterministic."""
    _VECTORS = {
        "we hit the jackpot and won it all": [1.0, 0.0, 0.0],
        "won the huge prize": [0.95, 0.05, 0.0],       # paraphrase → near-parallel
        "repairing a bicycle tire": [0.0, 1.0, 0.0],   # unrelated → orthogonal
    }

    def embed(self, texts):
        for text in texts:
            yield self._VECTORS[text]


class TestEmbeddingsMatchConcepts:
    def _backend(self):
        from yuu_clip.scoring.similarity import EmbeddingsBackend
        return EmbeddingsBackend(_cfg())

    def test_paraphrase_matches_but_threshold_rejects_unrelated(self):
        from yuu_clip.scoring import similarity
        with mock.patch.object(similarity, "_get_embed_model", return_value=_FakeEmbedModel()):
            matched = self._backend().match_concepts(
                "we hit the jackpot and won it all",
                ["won the huge prize", "repairing a bicycle tire"],
                threshold=0.5,
            )
        assert matched == ["won the huge prize"]


# ── LlmBackend routes to the existing LLM path ────────────────────────────────


class TestLlmBackend:
    def _backend(self):
        from yuu_clip.scoring.similarity import LlmBackend
        return LlmBackend(_cfg(), context_text="CTX")

    def test_rank_similar_delegates_to_find_related_clips(self):
        with mock.patch("yuu_clip.scoring.llm.find_related_clips",
                        return_value=[{"id": 3, "reason": "both chaotic"}]) as m:
            results = self._backend().rank_similar("ref", [{"id": 3, "description": "d"}])
        m.assert_called_once()
        assert results == [{"id": 3, "score": None, "reason": "both chaotic"}]

    def test_match_concepts_delegates_to_scan_hotwords_semantic(self):
        with mock.patch("yuu_clip.scoring.llm.scan_hotwords_semantic",
                        return_value=["a phrase"]) as m:
            matched = self._backend().match_concepts("text", ["a phrase", "other"])
        m.assert_called_once()
        assert matched == ["a phrase"]


# ── make_backend dispatch + fallback ──────────────────────────────────────────


class TestMakeBackend:
    def test_default_is_tfidf(self):
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        assert isinstance(make_backend(_cfg()), TfidfBackend)

    def test_unavailable_embeddings_falls_back_to_tfidf(self):
        # fastembed is not installed in the test env, so availability() is False.
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        assert isinstance(make_backend(_cfg(similarity_backend="embeddings")), TfidfBackend)

    def test_llm_backend_used_when_available(self):
        from yuu_clip.scoring.similarity import LlmBackend, make_backend
        with mock.patch("yuu_clip.scoring.llm.check_llm_available", return_value=(True, "")):
            backend = make_backend(_cfg(similarity_backend="llm"))
        assert isinstance(backend, LlmBackend)

    def test_llm_unavailable_falls_back_to_tfidf(self):
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        with mock.patch("yuu_clip.scoring.llm.check_llm_available", return_value=(False, "off")):
            backend = make_backend(_cfg(similarity_backend="llm"))
        assert isinstance(backend, TfidfBackend)

    def test_unknown_backend_falls_back_to_tfidf(self):
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        assert isinstance(make_backend(_cfg(similarity_backend="nonsense")), TfidfBackend)
