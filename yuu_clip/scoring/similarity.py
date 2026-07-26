"""
Tiered similarity engine - powers "Find related clips" and "Meaning" hot-words
without requiring a language model.

Three backends, chosen by config.similarity_backend:
  "tfidf"      - pure-Python TF-IDF cosine over the small candidate set. Zero extra
                 dependencies, deterministic. Always available; the fallback.
  "embeddings" - fastembed (ONNX, no PyTorch) + the bge-small model; local
                 paraphrase-aware matching. Default (packaging-strategy overhaul):
                 fastembed is bundled (Tier A), bge-small auto-fetches on first use
                 (Tier B).
  "llm"        - wraps scoring/llm.py's find_related_clips / scan_hotwords_semantic
                 so a user with a language model keeps the LLM path.

Every backend exposes available() -> (bool, reason) (mirroring
LaughScorer.available) and the two operations the routes need:
  rank_similar(query, candidates, top_k)   -> [{"id", "score", "reason"}]
  match_concepts(text, phrases, threshold) -> [phrases]

make_backend() resolves to the requested backend only when it is available and
otherwise falls back to TfidfBackend, so the routes never hard-fail for a missing
optional dependency - the Settings install hint is where a user is nudged to add it.
"""
from __future__ import annotations

import logging
import math
import os
import re
import tempfile
from collections import Counter
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config

log = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9']+")

# Small English stopword set - enough to keep TF-IDF weight on content words without
# pulling a dependency. Not exhaustive by design.
_STOPWORDS = frozenset({
    "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at", "for",
    "by", "with", "as", "is", "it", "its", "be", "was", "were", "are", "am", "been",
    "being", "this", "that", "these", "those", "i", "we", "they", "he", "she", "him",
    "her", "them", "his", "hers", "their", "our", "my", "me", "us", "your", "yours",
    "not", "no", "do", "does", "did", "so", "up", "out", "off", "then", "than", "too",
    "very", "just", "can", "will", "would", "there", "here", "what", "when", "which",
    "who", "how", "all", "get", "got", "had", "has", "have", "from", "about", "into",
    "over", "again", "you", "im", "ive", "gonna",
})

_TFIDF_CONCEPT_THRESHOLD = 0.5
_EMBED_CONCEPT_THRESHOLD = 0.5
_EMBED_MODEL_ID = "BAAI/bge-small-en-v1.5"  # MIT-licensed

# Cosine-score cutoffs for the human-readable similarity label (_similarity_band).
_BAND_VERY_SIMILAR = 0.7
_BAND_SIMILAR = 0.55


def _content_tokens(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOPWORDS]


def top_keywords(text: str, limit: int = 3) -> list[str]:
    """Return the most frequent content words in *text*, most-common first.

    Reuses the TF-IDF token extraction (lowercased word tokens minus stopwords).
    Frequency ties break by first appearance, so the result is deterministic. Used
    by the Basic description template (Stage 02) to name what a clip is about
    without a language model.
    """
    tokens = _content_tokens(text)
    if not tokens:
        return []
    first_index: dict[str, int] = {}
    for i, token in enumerate(tokens):
        first_index.setdefault(token, i)
    counts = Counter(tokens)
    ranked = sorted(counts, key=lambda t: (-counts[t], first_index[t]))
    return ranked[:limit]


# ── TF-IDF (default, zero-dep) ────────────────────────────────────────────────


class TfidfBackend:
    name = "tfidf"

    def __init__(self, config: "Config" | None = None) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        return True, ""

    def rank_similar(self, query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
        query_tokens = _content_tokens(query)
        if not query_tokens or not candidates:
            return []

        docs = [query_tokens] + [_content_tokens(c.get("description", "")) for c in candidates]
        idf = _compute_idf(docs)
        query_vec = _tfidf_vector(query_tokens, idf)
        query_norm = _norm(query_vec)
        if query_norm == 0:
            return []

        scored = []
        for candidate, tokens in zip(candidates, docs[1:]):
            cand_vec = _tfidf_vector(tokens, idf)
            cand_norm = _norm(cand_vec)
            if cand_norm == 0:
                continue
            dot = sum(weight * cand_vec.get(term, 0.0) for term, weight in query_vec.items())
            score = dot / (query_norm * cand_norm)
            if score <= 0:
                continue
            scored.append({
                "id": candidate["id"],
                "score": round(score, 4),
                "reason": _shared_terms_reason(query_vec, cand_vec),
            })

        scored.sort(key=lambda r: r["score"], reverse=True)
        return scored[:top_k]

    def match_concepts(
        self, text: str, phrases: list[str], threshold: float | None = None,
    ) -> list[str]:
        if not phrases:
            return []
        cutoff = _TFIDF_CONCEPT_THRESHOLD if threshold is None else threshold
        text_tokens = set(_content_tokens(text))
        if not text_tokens:
            return []
        matched = []
        for phrase in phrases:
            phrase_tokens = _content_tokens(phrase)
            if not phrase_tokens:
                continue
            overlap = sum(1 for t in phrase_tokens if t in text_tokens) / len(phrase_tokens)
            if overlap >= cutoff:
                matched.append(phrase)
        return matched


def _compute_idf(docs: list[list[str]]) -> dict[str, float]:
    doc_count = len(docs)
    doc_freq: Counter = Counter()
    for tokens in docs:
        for term in set(tokens):
            doc_freq[term] += 1
    # Smoothed IDF, always positive so a term shared by every doc still carries a
    # little weight (the candidate sets are tiny - a hard zero would discard signal).
    return {term: math.log((doc_count + 1) / (freq + 1)) + 1.0 for term, freq in doc_freq.items()}


def _tfidf_vector(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    if not tokens:
        return {}
    counts = Counter(tokens)
    total = len(tokens)
    return {term: (count / total) * idf.get(term, 0.0) for term, count in counts.items()}


def _norm(vec: dict[str, float]) -> float:
    return math.sqrt(sum(weight * weight for weight in vec.values()))


def _shared_terms_reason(query_vec: dict[str, float], cand_vec: dict[str, float]) -> str:
    shared = [
        (term, query_vec[term] * cand_vec[term])
        for term in query_vec
        if term in cand_vec
    ]
    shared.sort(key=lambda pair: pair[1], reverse=True)
    top = [term for term, _ in shared[:3]]
    return "shared: " + ", ".join(top) if top else "similar wording"


# ── Embeddings (default, fastembed) ───────────────────────────────────────────

_embed_model = None

# fastembed's own registry (pinned fastembed==0.8.0) resolves the friendly name
# "BAAI/bge-small-en-v1.5" to this pre-quantized ONNX repo -- the actual thing it
# downloads from HuggingFace Hub, and the id the cache-scan check below must
# match. Re-verify against fastembed's `onnx_embedding.py` registry if the
# fastembed pin ever moves.
_EMBED_HF_SOURCE_REPO = "qdrant/bge-small-en-v1.5-onnx-q"


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from fastembed import TextEmbedding
        _embed_model = TextEmbedding(model_name=_EMBED_MODEL_ID)
    return _embed_model


def _fastembed_cache_dir() -> Path:
    """Where fastembed downloads its ONNX models by default.

    Mirrors fastembed.common.utils.define_cache_dir(None) without importing
    fastembed, so the cache check stays side-effect-free (that function also
    creates the directory as a side effect of merely computing the path).
    """
    default = Path(tempfile.gettempdir()) / "fastembed_cache"
    return Path(os.environ.get("FASTEMBED_CACHE_PATH", str(default)))


def embeddings_model_cached() -> bool:
    """Whether bge-small has already been downloaded (filesystem-only, no
    network) -- lets the Settings capabilities overview distinguish "ready"
    from "downloads on first use"."""
    from yuu_clip.hf_cache import repo_cached
    return repo_cached(_EMBED_HF_SOURCE_REPO, cache_dir=_fastembed_cache_dir())


def prefetch_embeddings_model() -> None:
    """Download bge-small now, for the Settings "Download now" prefetch flow --
    the same load EmbeddingsBackend triggers lazily on first use."""
    _get_embed_model()


class EmbeddingsBackend:
    name = "embeddings"

    def __init__(self, config: "Config" | None = None) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        # Cheap, side-effect-free: only checks that fastembed (Tier A, bundled) is
        # importable. It must NOT load or download the bge-small model - the
        # Settings status UI calls this on every render, and probing the model here
        # would trigger a ~130 MB download just to report availability. The actual
        # model-load probe (with tfidf fallback) lives in make_backend(), the
        # scoring path where a first-use fetch is expected.
        try:
            import fastembed  # noqa: F401
        except Exception as exc:
            # fastembed wraps onnxruntime, a compiled dependency, so a broken or
            # partial install can raise OSError (Windows DLL load failure) or
            # RuntimeError (version mismatch), not only ImportError. This probe is
            # called directly from route handlers (routes/llm.py, make_backend()'s
            # callers in routes/scoring.py) with no surrounding try/except, so it
            # must report unavailable rather than let the failure 500 the route.
            log.warning("EmbeddingsBackend: fastembed import failed (%s)", exc)
            return False, (
                "the embeddings engine needs the fastembed package - this should be "
                "bundled with yuu-clip, so try reinstalling if this persists"
            )
        return True, ""

    def rank_similar(self, query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
        described = [c for c in candidates if (c.get("description") or "").strip()]
        if not query.strip() or not described:
            return []
        vectors = self._embed([query] + [c["description"] for c in described])
        query_vec = vectors[0]
        scored = []
        for candidate, vec in zip(described, vectors[1:]):
            score = _cosine(query_vec, vec)
            if score <= 0:
                continue
            scored.append({
                "id": candidate["id"],
                "score": round(score, 4),
                "reason": _similarity_band(score),
            })
        scored.sort(key=lambda r: r["score"], reverse=True)
        return scored[:top_k]

    def match_concepts(
        self, text: str, phrases: list[str], threshold: float | None = None,
    ) -> list[str]:
        real_phrases = [p for p in phrases if (p or "").strip()]
        if not real_phrases or not (text or "").strip():
            return []
        cutoff = _EMBED_CONCEPT_THRESHOLD if threshold is None else threshold
        vectors = self._embed([text] + real_phrases)
        text_vec = vectors[0]
        return [
            phrase for phrase, vec in zip(real_phrases, vectors[1:])
            if _cosine(text_vec, vec) >= cutoff
        ]

    def _embed(self, texts: list[str]) -> list[list[float]]:
        return [list(vec) for vec in _get_embed_model().embed(texts)]


def _cosine(a, b) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _similarity_band(score: float) -> str:
    if score >= _BAND_VERY_SIMILAR:
        return "very similar"
    if score >= _BAND_SIMILAR:
        return "similar"
    return "somewhat similar"


# ── LLM (opt-in, wraps the existing path) ─────────────────────────────────────


class LlmBackend:
    name = "llm"

    def __init__(self, config: "Config", context_text: str = "") -> None:
        self._config = config
        self._context_text = context_text

    def available(self) -> tuple[bool, str]:
        from yuu_clip.scoring.llm import check_llm_available
        return check_llm_available(self._config)

    def rank_similar(self, query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
        from yuu_clip.scoring.llm import find_related_clips
        results = find_related_clips(query, candidates, self._config, self._context_text)
        return [{"id": r["id"], "score": None, "reason": r["reason"]} for r in results[:top_k]]

    def match_concepts(
        self, text: str, phrases: list[str], threshold: float | None = None,
    ) -> list[str]:
        from yuu_clip.scoring.llm import scan_hotwords_semantic
        return scan_hotwords_semantic(text, phrases, self._config)


# ── dispatch ──────────────────────────────────────────────────────────────────


def _construct(backend: str, config: "Config", context_text: str):
    if backend == "embeddings":
        return EmbeddingsBackend(config)
    if backend == "llm":
        return LlmBackend(config, context_text)
    return TfidfBackend(config)


def make_backend(config: "Config", context_text: str = ""):
    """Return the configured similarity backend, or TfidfBackend if it's unavailable.

    Falling back (rather than raising) keeps related-clips and hot-word scans working
    with no optional deps installed - the default tier is zero-dep and always available.
    """
    requested = (getattr(config, "similarity_backend", "tfidf") or "tfidf").strip()
    backend = _construct(requested, config, context_text)
    available, reason = backend.available()
    if available and isinstance(backend, EmbeddingsBackend):
        # bge-small is a Tier-B model fetched on first use. Verify it actually
        # loads now so an offline/uncached machine falls back to keyword matching
        # here, rather than throwing per-clip during scoring. (available() stays
        # cheap so the Settings status UI never triggers this fetch.)
        try:
            _get_embed_model()
        except Exception as exc:
            log.warning("Embeddings model unavailable (%s)", exc)
            available, reason = False, "the embeddings model isn't downloaded yet"
    if available:
        return backend
    if requested != "tfidf":
        log.warning(
            "Similarity backend %r unavailable (%s) - falling back to keyword matching",
            requested, reason,
        )
    return TfidfBackend(config)
