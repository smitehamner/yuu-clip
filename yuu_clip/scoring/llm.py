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

from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)


def _prepend_context(system_prompt: str, context_text: str) -> str:
    """Prepend world-context text to a system prompt when context is available."""
    return (context_text + "\n\n" + system_prompt) if context_text else system_prompt


_SYSTEM_PROMPT = """\
You analyze video clips for highlight potential.
Given a transcript excerpt, do the following in a single JSON response:

1. Write a "description": one punchy sentence (≤20 words) capturing what actually happens.
2. Write a "description_long": a paragraph (3-5 sentences) covering:
   - What happens and why it stands out as a highlight
   - Why it is funny, dramatic, or otherwise notable
   - Who is involved (use names if mentioned in the transcript)
   - Any other interesting context, callbacks, or recurring bits
3. Rate 0.0–1.0 on three dimensions:
   "score_funny":    jokes, unexpected reactions, absurd moments, chaotic banter
   "score_dramatic": confrontations, revelations, emotional moments, story beats
   "score_action":   physical chaos, combat, chase, high-stakes tension

Return ONLY valid JSON with exactly these five keys. No markdown, no extra text.\
"""

_USER_TEMPLATE = """\
Transcript:
\"\"\"
{excerpt}
\"\"\"
JSON:\
"""


_VIDEO_SUMMARY_SYSTEM = """\
You summarize video session recordings for a clip extraction tool.
Given a session transcript (or excerpt), return JSON with exactly two keys:
  "title":   a 5-8 word headline capturing the session's defining moment or theme
  "summary": a 3-5 sentence paragraph describing what happened — key story beats,
             memorable moments, funny incidents, who was involved.
Return ONLY valid JSON. No markdown, no extra text.\
"""


def _call_backend(messages: list[dict], config: "Config", temperature: float = 0.1) -> str:
    if config.llm_backend == "llamacpp":
        from llama_cpp import Llama
        llm = Llama(model_path=config.llm_model_path)
        response = llm.create_chat_completion(messages=messages, temperature=temperature)
        return response["choices"][0]["message"]["content"]
    else:
        import ollama
        client = ollama.Client(host=config.ollama_host, timeout=config.ollama_timeout_s)
        response = client.chat(
            model=config.ollama_model,
            messages=messages,
            options={"temperature": temperature},
        )
        return response.message.content


def summarize_transcript(text: str, config: "Config", context_text: str = "") -> tuple[str, str]:
    """Generate a title and summary for a video's transcript.

    Truncates to 12 000 chars to stay within the model's context window.
    Returns (title, summary). Raises on failure.
    """
    excerpt = text[:12000]
    system = _prepend_context(_VIDEO_SUMMARY_SYSTEM, context_text)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Transcript:\n\"\"\"\n{excerpt}\n\"\"\"\nJSON:"},
    ]
    raw = _call_backend(messages, config, temperature=0.2)
    data = json.loads(raw)
    return str(data.get("title", "")), str(data.get("summary", ""))


_TIMELINE_CHUNK_SYSTEM = """\
You are summarizing a 15-minute segment of a video session recording.
Write 2-4 sentences describing what happened in this time window: key events, story beats,
memorable moments, who was involved, and narrative flow. Use names if mentioned in the transcript.
Be specific and grounded in the transcript. Skip filler phrases like "In this segment."
Return ONLY the paragraph — no JSON, no headings, no extra formatting.\
"""


def generate_timeline_chunk(
    transcript: str,
    start_hms: str,
    end_hms: str,
    clip_descriptions: list[str],
    config: "Config",
    context_text: str = "",
) -> str:
    """Generate one timeline entry paragraph for a transcript time window.

    Truncates transcript to 4 000 chars. Raises on failure.
    """
    system = _prepend_context(_TIMELINE_CHUNK_SYSTEM, context_text)
    clips_ctx = (
        "\n\nNotable clips in this window:\n" + "\n".join(f"- {d}" for d in clip_descriptions)
        if clip_descriptions else ""
    )
    user_msg = (
        f"Time window: {start_hms} – {end_hms}\n\n"
        f"Transcript:\n\"\"\"\n{transcript[:4000]}\n\"\"\""
        f"{clips_ctx}"
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": user_msg},
    ]
    return _call_backend(messages, config, temperature=0.3).strip()


class LLMScorer:
    name = "llm"

    def __init__(self, config: "Config", context_text: str = "") -> None:
        self._config = config
        self._context_text = context_text
        self.weight  = config.scorer_llm_weight
        self._available: bool | None = None  # cached after first check

    def is_available(self) -> bool:
        if not self._config.ollama_enabled:
            return False
        if self._available is not None:
            return self._available
        if self._config.llm_backend == "llamacpp":
            self._available = self._check_llamacpp()
        else:
            self._available = self._check_ollama()
        return self._available

    def _check_llamacpp(self) -> bool:
        path = self._config.llm_model_path
        if not path:
            log.warning("LLM scoring disabled: set llm_model_path in Settings to a .gguf file to enable LLM scoring")
            return False
        from pathlib import Path
        if not Path(path).exists():
            log.warning("LLM scoring disabled: llm_model_path %r does not exist", path)
            return False
        try:
            import llama_cpp  # noqa: F401
        except ImportError:
            log.warning("LLM scoring disabled: llama-cpp-python is not installed")
            return False
        return True

    def _check_ollama(self) -> bool:
        try:
            import ollama
            ollama.Client(host=self._config.ollama_host).list()
            return True
        except Exception as exc:
            log.warning("Ollama not reachable at %s: %s — LLM scoring disabled",
                        self._config.ollama_host, exc)
            return False

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        if not clip.transcript_excerpt:
            return ScoreResult(tags=["llm_no_transcript"])

        try:
            raw = self._call_llm(clip.transcript_excerpt)
            data = self._parse(raw)
        except Exception as exc:
            log.warning("LLM scoring failed for clip %d: %s", clip.id, exc)
            return ScoreResult(tags=["llm_error"])

        model_id = (
            self._config.llm_model_path
            if self._config.llm_backend == "llamacpp"
            else self._config.ollama_model
        )
        return ScoreResult(
            score_funny      = float(data.get("score_funny",      0.0)),
            score_dramatic   = float(data.get("score_dramatic",   0.0)),
            score_action     = float(data.get("score_action",     0.0)),
            description      = str(data.get("description",        "")),
            description_long = str(data.get("description_long",   "")),
            tags=["llm_scored"],
            notes={"model": model_id},
        )

    def _call_llm(self, excerpt: str) -> str:
        system = _prepend_context(_SYSTEM_PROMPT, self._context_text)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": _USER_TEMPLATE.format(excerpt=excerpt)},
        ]
        return _call_backend(messages, self._config, temperature=0.1)

    def _parse(self, raw: str) -> dict:
        data = json.loads(raw)
        for key in ("score_funny", "score_dramatic", "score_action"):  # clamp to [0, 1]
            if key in data:
                data[key] = max(0.0, min(1.0, float(data[key])))
        return data
