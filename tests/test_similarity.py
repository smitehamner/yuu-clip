"""Tiered similarity engine (scoring/similarity.py) - plan non-llm-tiers/01."""
from __future__ import annotations

import sys
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


# ── EmbeddingsBackend (fastembed mocked - no model download) ───────────────────


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
    def test_config_default_is_embeddings(self):
        # packaging-strategy overhaul: fastembed + bge-small are now the default
        # similarity backend (was "tfidf").
        assert Config().similarity_backend == "embeddings"

    def test_falls_back_to_tfidf_when_fastembed_package_missing(self):
        # fastembed is not installed in the test env, so availability() is False
        # and the default-configured "embeddings" backend falls back to tfidf -
        # this is also the real behavior on a machine mid-install.
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        assert isinstance(make_backend(_cfg()), TfidfBackend)
        assert isinstance(make_backend(_cfg(similarity_backend="embeddings")), TfidfBackend)

    def test_falls_back_to_tfidf_when_model_cannot_be_fetched(self):
        # fastembed the package is present (bundled), but the bge-small model
        # itself is a Tier-B download - an offline machine without it cached
        # must still fall back to tfidf rather than fail per-clip later.
        from yuu_clip.scoring import similarity
        from yuu_clip.scoring.similarity import TfidfBackend, make_backend
        with mock.patch.dict(sys.modules, {"fastembed": mock.MagicMock()}):
            with mock.patch.object(
                similarity, "_get_embed_model",
                side_effect=OSError("could not download model (offline)"),
            ):
                backend = make_backend(_cfg(similarity_backend="embeddings"))
        assert isinstance(backend, TfidfBackend)

    def test_selects_embeddings_when_package_and_model_available(self):
        from yuu_clip.scoring import similarity
        from yuu_clip.scoring.similarity import EmbeddingsBackend, make_backend
        with mock.patch.dict(sys.modules, {"fastembed": mock.MagicMock()}):
            with mock.patch.object(similarity, "_get_embed_model", return_value=mock.MagicMock()):
                backend = make_backend(_cfg(similarity_backend="embeddings"))
        assert isinstance(backend, EmbeddingsBackend)

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


# ── embeddings model cache detection + prefetch (packaging-strategy Wave 4) ──


class TestFastembedCacheDir:
    def test_defaults_to_tempdir_fastembed_cache(self, monkeypatch):
        import tempfile
        from pathlib import Path

        from yuu_clip.scoring.similarity import _fastembed_cache_dir
        monkeypatch.delenv("FASTEMBED_CACHE_PATH", raising=False)
        assert _fastembed_cache_dir() == Path(tempfile.gettempdir()) / "fastembed_cache"

    def test_honours_fastembed_cache_path_override(self, monkeypatch):
        from pathlib import Path

        from yuu_clip.scoring.similarity import _fastembed_cache_dir
        monkeypatch.setenv("FASTEMBED_CACHE_PATH", "/custom/cache")
        assert _fastembed_cache_dir() == Path("/custom/cache")


class TestEmbeddingsModelCached:
    def test_delegates_to_repo_cached_with_the_qdrant_onnx_repo(self, monkeypatch):
        from yuu_clip.scoring import similarity

        seen = {}

        def _fake_repo_cached(repo_id, cache_dir=None):
            seen["repo_id"] = repo_id
            seen["cache_dir"] = cache_dir
            return True

        with mock.patch.dict(sys.modules, {"yuu_clip.hf_cache": mock.MagicMock(repo_cached=_fake_repo_cached)}):
            assert similarity.embeddings_model_cached() is True
        assert seen["repo_id"] == "qdrant/bge-small-en-v1.5-onnx-q"
        assert seen["cache_dir"] == similarity._fastembed_cache_dir()


class TestPrefetchEmbeddingsModel:
    def test_prefetch_loads_the_model(self):
        from yuu_clip.scoring import similarity

        with mock.patch.object(similarity, "_get_embed_model") as m:
            similarity.prefetch_embeddings_model()
        m.assert_called_once()
