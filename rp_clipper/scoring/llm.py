"""
LLMScorer — sends the transcript excerpt to a local Ollama instance and parses
the returned dimension scores.

Requires Ollama running on ollama_host with ollama_model pulled.
Gracefully degrades: if Ollama is unreachable or returns bad output,
logs a warning and returns a zero ScoreResult so ingest is never blocked.
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from rp_clipper.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from rp_clipper.config import Config
    from rp_clipper.db.models import ClipCandidate

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You analyze clips from an RP (roleplay) gaming session for highlight potential.
Given a transcript excerpt, do the following in a single JSON response:

1. Write a "description": one punchy sentence (≤20 words) capturing what actually happens.
2. Rate 0.0–1.0 on three dimensions using the description to inform your scores:
   "score_funny":    jokes, absurdist RP, unexpected reactions, chaotic banter
   "score_dramatic": confrontations, revelations, emotional moments, story beats
   "score_action":   physical chaos, combat, chase, high-stakes tension

Return ONLY valid JSON with exactly these four keys. No markdown, no extra text.\
"""

_USER_TEMPLATE = """\
Transcript:
\"\"\"
{excerpt}
\"\"\"
JSON:\
"""


class LLMScorer:
    name = "llm"

    def __init__(self, config: "Config") -> None:
        self._config = config
        self.weight  = config.scorer_llm_weight
        self._available: bool | None = None  # cached after first check

    def is_available(self) -> bool:
        if not self._config.ollama_enabled:
            return False
        if self._available is not None:
            return self._available
        try:
            import ollama
            # Quick connectivity check — list models
            ollama.Client(host=self._config.ollama_host).list()
            self._available = True
        except Exception as exc:
            log.warning("Ollama not reachable at %s: %s — LLM scoring disabled",
                        self._config.ollama_host, exc)
            self._available = False
        return self._available

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        if not clip.transcript_excerpt:
            return ScoreResult(tags=["llm_no_transcript"])

        try:
            raw = self._call_ollama(clip.transcript_excerpt)
            data = self._parse(raw)
        except Exception as exc:
            log.warning("LLM scoring failed for clip %d: %s", clip.id, exc)
            return ScoreResult(tags=["llm_error"])

        return ScoreResult(
            score_funny    = float(data.get("score_funny",    0.0)),
            score_dramatic = float(data.get("score_dramatic", 0.0)),
            score_action   = float(data.get("score_action",   0.0)),
            description    = str(data.get("description", "")),
            tags=["llm_scored"],
            notes={"model": self._config.ollama_model},
        )

    # ------------------------------------------------------------------

    def _call_ollama(self, excerpt: str) -> str:
        import ollama
        client = ollama.Client(
            host=self._config.ollama_host,
            timeout=self._config.ollama_timeout_s,
        )
        response = client.chat(
            model=self._config.ollama_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": _USER_TEMPLATE.format(excerpt=excerpt)},
            ],
            format="json",
            options={"temperature": 0.1},
        )
        return response.message.content

    def _parse(self, raw: str) -> dict:
        data = json.loads(raw)
        # Clamp all score values to [0, 1]
        for key in ("score_funny", "score_dramatic", "score_action"):
            if key in data:
                data[key] = max(0.0, min(1.0, float(data[key])))
        return data
