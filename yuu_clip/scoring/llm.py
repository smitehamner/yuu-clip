"""
LLMScorer — sends the transcript excerpt to an LLM and parses dimension scores.

Supports three backends (config: llm_backend):
  "llamacpp" — llama-cpp-python; local, no API costs.
  "ollama"   — Ollama HTTP API; local, no API costs.
  "claude"   — Anthropic Claude API; REMOTE, billed per token.

Gracefully degrades: if the backend is unreachable or returns bad output,
logs a warning and returns a zero ScoreResult so ingest is never blocked.
"""
from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING

from yuu_clip.scoring.llm_client import make_client
from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)


def _prepend_context(system_prompt: str, context_text: str) -> str:
    return (context_text + "\n\n" + system_prompt) if context_text else system_prompt


# Some models wrap JSON in a markdown fence despite being told not to.
_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


def _strip_json_fence(raw: str) -> str:
    stripped = raw.strip()
    m = _JSON_FENCE_RE.match(stripped)
    return m.group(1).strip() if m else stripped


def _repair_request(bad_raw: str, exc: Exception) -> list[dict]:
    return [
        {"role": "assistant", "content": bad_raw},
        {"role": "user", "content": (
            f"That response was not valid JSON ({exc}). Reply again with ONLY "
            "the corrected JSON — no markdown, no extra text."
        )},
    ]


def _call_llm_json(messages: list[dict], config: "Config", temperature: float = 0.1):
    """Call the LLM expecting JSON. If the response doesn't parse, send it back
    with the parse error and give the model one chance to correct itself."""
    raw = _call_client(messages, config, temperature)
    try:
        return json.loads(_strip_json_fence(raw))
    except json.JSONDecodeError as exc:
        log.warning("LLM returned invalid JSON, asking it to correct itself: %s", exc)
        raw = _call_client(messages + _repair_request(raw, exc), config, temperature)
        return json.loads(_strip_json_fence(raw))


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


_SESSION_SUMMARY_SYSTEM = """\
You summarize a multi-recording play session for a clip extraction tool.
You are given the per-recording titles and summaries of every recording in the
session, in order. Return JSON with exactly two keys:
  "title":   a 5-8 word headline capturing the whole session's arc or defining theme
  "summary": a 3-5 sentence paragraph describing the session across all recordings —
             the overall story, how it developed, standout moments, who was involved.
Treat the recordings as one continuous session, not separate videos.
Return ONLY valid JSON. No markdown, no extra text.\
"""


def summarize_session(
    members: list[tuple[str, str]], config: "Config", context_text: str = ""
) -> tuple[str, str]:
    """Roll up a session title + summary from member recordings' (title, summary).

    Members with no title and no summary are skipped. Returns (title, summary).
    Raises on failure.
    """
    blocks = "\n\n".join(
        f"Recording {i}: {title or '(untitled)'}\n{summary}".strip()
        for i, (title, summary) in enumerate(members, 1)
        if (title or summary)
    )
    system = _prepend_context(_SESSION_SUMMARY_SYSTEM, context_text)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Recordings:\n\"\"\"\n{blocks[:12000]}\n\"\"\"\nJSON:"},
    ]
    data = _call_llm_json(messages, config, temperature=0.2)
    return str(data.get("title", "")), str(data.get("summary", ""))


def _call_client(messages: list[dict], config: "Config", temperature: float = 0.1) -> str:
    return make_client(config).chat(messages, temperature)


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
    data = _call_llm_json(messages, config, temperature=0.2)
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
    return _call_client(messages, config, temperature=0.3).strip()


_RELATED_CLIPS_SYSTEM = """\
You find clips that are thematically or narratively similar to a reference clip.
Given a reference clip description and a list of candidate clip descriptions (each with an ID),
return the top clips most similar in theme, tone, or content.

Return ONLY valid JSON: a list of objects with "id" (integer) and "reason" (≤15 words explaining similarity).
Order by similarity descending. Return at most 5 results. No markdown, no extra text.\
"""


def find_related_clips(
    reference_description: str,
    candidates: list[dict],  # [{"id": int, "description": str}, ...]
    config: "Config",
    context_text: str = "",
) -> list[dict]:
    """Find clips similar to the reference based on description_long.

    Returns a list of {"id": int, "reason": str} dicts ordered by similarity.
    Raises on LLM failure.
    """
    candidate_lines = "\n".join(
        f'{c["id"]}: {c["description"]}' for c in candidates
    )
    system = _prepend_context(_RELATED_CLIPS_SYSTEM, context_text)
    user_msg = (
        f"Reference clip:\n\"\"\"\n{reference_description[:2000]}\n\"\"\"\n\n"
        f"Candidates:\n{candidate_lines[:6000]}\n\nJSON:"
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": user_msg},
    ]
    results = _call_llm_json(messages, config, temperature=0.1)
    if not isinstance(results, list):
        raise ValueError(f"Expected list, got {type(results)}")
    return [{"id": int(r["id"]), "reason": str(r.get("reason", ""))} for r in results]


_SPEAKER_NAME_SYSTEM = """\
You identify who each anonymous speaker is in a transcript, using only how people
address each other by name.

The transcript is labeled with anonymous numbers (Speaker 1, Speaker 2, …). Speakers
often address one another directly ("Hey Yuu, watch out", "Nice shot, Alex") or
identify themselves ("I'm Alex"). Infer each speaker's real name from that evidence.

Rules:
- Suggest a name only when the evidence is clear. Omit any speaker you cannot identify —
  never guess or invent a name.
- A name spoken TO someone is usually the name of a DIFFERENT speaker, not the talker.
- Never assign the same name to two different speaker numbers.

Return ONLY valid JSON: an object mapping the speaker number (as a string) to the
inferred name, e.g. {"1": "Yuu", "3": "Alex"}. Return {} when nothing is clear.
No markdown, no extra text.\
"""


def infer_speaker_names(
    labeled_transcript: str, config: "Config", context_text: str = ""
) -> dict[str, str]:
    """Suggest real names for anonymous speakers from direct address in the transcript.

    *labeled_transcript* is the recording's transcript with each line prefixed by its
    "Speaker N" label. Returns {display_index_str: name}, empty when nothing is clear.
    Truncates to 12 000 chars to stay within the model's context window. Raises on failure.
    """
    system = _prepend_context(_SPEAKER_NAME_SYSTEM, context_text)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Transcript:\n\"\"\"\n{labeled_transcript[:12000]}\n\"\"\"\nJSON:"},
    ]
    data = _call_llm_json(messages, config, temperature=0.1)
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data)}")
    return {str(k): str(v).strip() for k, v in data.items() if str(v).strip()}


def describe_clip(transcript: str, config: "Config", context_text: str = "") -> tuple[str, str]:
    """Generate description and description_long for a clip transcript.

    Returns (description, description_long). Raises on failure.
    """
    system = _prepend_context(_SYSTEM_PROMPT, context_text)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": _USER_TEMPLATE.format(excerpt=transcript)},
    ]
    data = _call_llm_json(messages, config, temperature=0.1)
    return str(data.get("description", "")), str(data.get("description_long", ""))


_HOTWORD_SEMANTIC_SYSTEM = """\
You check whether a clip's transcript expresses the concept behind each of a list of
phrases — not necessarily the literal words, but the same idea, theme, or moment.

Return ONLY valid JSON: a list containing the exact phrases (copied verbatim from the
input list) whose concept is expressed in the transcript. Return [] if none apply.
No markdown, no extra text.\
"""


def scan_hotwords_semantic(transcript: str, phrases: list[str], config: "Config") -> list[str]:
    """Ask the LLM which of *phrases* have their concept expressed in *transcript*.

    Returns the subset of *phrases* (verbatim) the model judged as matching — filtered
    against the input list so a model that invents a phrase not asked about is ignored.
    Truncates the transcript to 4 000 chars. Raises on failure.
    """
    if not phrases:
        return []
    phrase_list = "\n".join(f"- {p}" for p in phrases)
    messages = [
        {"role": "system", "content": _HOTWORD_SEMANTIC_SYSTEM},
        {"role": "user", "content": (
            f"Phrases:\n{phrase_list}\n\nTranscript:\n\"\"\"\n{transcript[:4000]}\n\"\"\"\nJSON:"
        )},
    ]
    data = _call_llm_json(messages, config, temperature=0.1)
    if not isinstance(data, list):
        raise ValueError(f"Expected list, got {type(data)}")
    allowed = set(phrases)
    return [p for p in (str(x) for x in data) if p in allowed]


def check_llm_available(config: "Config") -> tuple[bool, str]:
    """Return (available, reason) without logging.  Used by routes to gate LLM calls."""
    if not config.ollama_enabled:
        return False, "LLM scoring is disabled in Settings"
    return make_client(config).available()


def _active_model_id(config: "Config") -> str | None:
    if config.llm_backend == "claude":
        return config.claude_model
    if config.llm_backend == "llamacpp":
        return config.llm_model_path
    return config.ollama_model


class LLMScorer:
    name = "llm"

    def __init__(self, config: "Config", context_text: str = "") -> None:
        self._config = config
        self._context_text = context_text
        self.weight = config.scorer_llm_weight
        self._client = make_client(config)
        self._available: bool | None = None

    def is_available(self) -> bool:
        if not self._config.ollama_enabled:
            return False
        if self._available is not None:
            return self._available
        ok, reason = self._client.available()
        if not ok:
            log.warning("LLM scoring disabled: %s", reason)
        self._available = ok
        return ok

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        if not clip.transcript_excerpt:
            return ScoreResult(tags=["llm_no_transcript"])

        try:
            raw = self._call_llm(clip.transcript_excerpt)
            try:
                data = self._parse(raw)
            except json.JSONDecodeError as exc:
                log.warning("LLM scoring: invalid JSON for clip %d, asking model to fix: %s", clip.id, exc)
                raw = self._call_llm(clip.transcript_excerpt, repair_of=raw, repair_error=exc)
                data = self._parse(raw)
        except Exception as exc:
            log.warning("LLM scoring failed for clip %d: %s", clip.id, exc, exc_info=True)
            return ScoreResult(tags=["llm_error"])

        return ScoreResult(
            score_funny      = float(data.get("score_funny",      0.0)),
            score_dramatic   = float(data.get("score_dramatic",   0.0)),
            score_action     = float(data.get("score_action",     0.0)),
            description      = str(data.get("description",        "")),
            description_long = str(data.get("description_long",   "")),
            tags=["llm_scored"],
            notes={"model": _active_model_id(self._config)},
        )

    def _call_llm(
        self, excerpt: str, *, repair_of: str | None = None, repair_error: Exception | None = None,
    ) -> str:
        system = _prepend_context(_SYSTEM_PROMPT, self._context_text)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": _USER_TEMPLATE.format(excerpt=excerpt)},
        ]
        if repair_of is not None:
            messages += _repair_request(repair_of, repair_error)
        return self._client.chat(messages, temperature=0.1)

    def _parse(self, raw: str) -> dict:
        data = json.loads(_strip_json_fence(raw))
        for key in ("score_funny", "score_dramatic", "score_action"):
            if key in data:
                data[key] = max(0.0, min(1.0, float(data[key])))
        return data
