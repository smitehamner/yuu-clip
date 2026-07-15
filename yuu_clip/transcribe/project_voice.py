# Feature-map - Cross-recording speaker identity matching (code: ProjectVoice; UI "Person").
#   Consumers: transcribe/whisper_runner.py (analyze suggestions) · web/routes/voices.py (People view + backfill)
#   Tests: tests/unit/test_project_voice.py
"""Pure voiceprint-matching core for project-wide speaker identity.

Deliberately free of torch / whisper / DB-engine imports so it stays importable in the
offline unit tier. It owns the small pure voiceprint helpers (serialize / deserialize /
cosine) that whisper_runner re-exports, plus the two cross-recording routines:

- ``best_voice_match`` proposes the ProjectVoice a recording's Speaker most resembles
  (multi-exemplar: a voice matches on its NEAREST exemplar). Callers use it during
  analyze to record a SUGGESTION - it never links anything itself.
- ``cluster_speakers_into_voices`` groups existing named Speakers for the one-time
  backfill (Stage 6), deterministically so the same DB clusters the same way each run.

Every cosine skips cross-backend pairs: embeddings from different diarization backends
live in incompatible spaces (and dimensionalities), so comparing them is meaningless.
"""
from __future__ import annotations

import json
import math
from typing import Optional


def serialize_voiceprint(vector: list[float]) -> bytes:
    return json.dumps([float(x) for x in vector]).encode("utf-8")


def deserialize_voiceprint(blob: bytes) -> list[float]:
    return json.loads(blob.decode("utf-8"))


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def _best_exemplar_score(vector: list[float], backend: Optional[str], voice) -> Optional[float]:
    """Highest cosine of *vector* against *voice*'s backend-compatible exemplars.

    Returns None when the voice has no exemplar from the same backend (nothing
    comparable), so the caller can skip it rather than score it 0.
    """
    best: Optional[float] = None
    for exemplar in voice.exemplars:
        if backend is not None and exemplar.voiceprint_backend != backend:
            continue
        score = cosine_similarity(vector, deserialize_voiceprint(exemplar.voiceprint))
        if best is None or score > best:
            best = score
    return best


def best_voice_match(vector, backend, voices, taken_ids, threshold):
    """Propose the ProjectVoice a recording's Speaker voiceprint most resembles.

    Scores *vector* against each candidate voice's NEAREST backend-compatible exemplar
    and returns ``(matched, score, top)`` where *top* is the best-scoring voice overall
    (or None when nothing was comparable), *score* its best-exemplar cosine, and
    *matched* is *top* when ``score >= threshold`` else None. Voices in *taken_ids* are
    skipped: one project voice matches at most one of a recording's Speakers, since the
    recording already separated them - two must not collapse onto one Person.

    Empty / falsy *vector* yields ``(None, 0.0, None)`` (nothing to compare).
    """
    if not vector:
        return None, 0.0, None
    top_voice = None
    top_score = 0.0
    for voice in voices:
        if voice.id in taken_ids:
            continue
        score = _best_exemplar_score(vector, backend, voice)
        if score is None:
            continue
        if top_voice is None or score > top_score:
            top_voice = voice
            top_score = score
    matched = top_voice if (top_voice is not None and top_score >= threshold) else None
    return matched, top_score, top_voice


def cluster_speakers_into_voices(speakers, threshold):
    """Group Speakers-with-voiceprints into project voices for the one-time backfill.

    Greedy single-link agglomeration: two speakers join the same group when their
    voiceprint cosine is ``>= threshold`` (backend-compatible only). Speakers without a
    voiceprint are excluded (nothing to match on). Ordering is fully deterministic -
    speakers are processed by ascending id and groups are returned sorted by their
    smallest member id, with members sorted by id - so the same DB clusters identically
    every run (a flaky backfill would be worse than none).
    """
    usable = sorted(
        (s for s in speakers if s.voiceprint),
        key=lambda s: s.id,
    )
    vectors = {s.id: deserialize_voiceprint(s.voiceprint) for s in usable}
    parent = {s.id: s.id for s in usable}

    def find(node):
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    for i, left in enumerate(usable):
        for right in usable[i + 1:]:
            if left.voiceprint_backend != right.voiceprint_backend:
                continue
            if cosine_similarity(vectors[left.id], vectors[right.id]) >= threshold:
                union(left.id, right.id)

    groups: dict[int, list] = {}
    for speaker in usable:
        groups.setdefault(find(speaker.id), []).append(speaker)
    return [
        sorted(members, key=lambda s: s.id)
        for _root, members in sorted(groups.items())
    ]
