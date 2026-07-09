"""
LLMScorer - sends the transcript excerpt to an LLM and parses dimension scores.

Supports three backends (config: llm_backend):
  "llamacpp" - llama-cpp-python; local, no API costs.
  "ollama"   - Ollama HTTP API; local, no API costs.
  "claude"   - Anthropic Claude API; REMOTE, billed per token.

Gracefully degrades: if the backend is unreachable or returns bad output,
logs a warning and returns a zero ScoreResult so ingest is never blocked.
"""
from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING

from yuu_clip.scoring.llm_client import backend_is_remote, make_client
from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

# User-facing reasons for the two AI-privacy-mode blocks (Stage non-llm-tiers/07).
_GENERATIVE_OFF_REASON = (
    "Generative AI is turned off - change it under Settings → AI privacy"
)
_REMOTE_BLOCKED_REASON = (
    "The remote (Claude) backend is blocked by AI privacy mode - switch to a local model "
    "or allow remote models under Settings → AI privacy"
)


def _prepend_context(system_prompt: str, context_text: str) -> str:
    return (context_text + "\n\n" + system_prompt) if context_text else system_prompt


def _active_flavor(config: "Config") -> str:
    """The active content preset's flavor paragraph (plan 12), '' for generic.

    Read live at prompt-assembly time - the applied preset only stores its id in
    Config.content_preset; the flavor text itself lives in content_presets.py so it
    stays improvable in updates without re-applying a preset.
    """
    from yuu_clip.content_presets import preset_flavor
    return preset_flavor(getattr(config, "content_preset", "generic"))


def _compose_system(base_prompt: str, context_text: str, config: "Config") -> str:
    """Assemble a system prompt as world contexts → preset flavor → base prompt.

    Contexts stay outermost (they're the most specific knowledge), then the
    content-type flavor, then the base task instructions.
    """
    return _prepend_context(_prepend_context(base_prompt, _active_flavor(config)), context_text)


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
            "the corrected JSON - no markdown, no extra text."
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
\"\"\"{visual}
JSON:\
"""


def _visual_block(vision_summary: str) -> str:
    """A 'Visual context' block appended to the scoring/description prompt when a
    clip has been image-analyzed. Empty when it hasn't, so the prompt is unchanged."""
    if not vision_summary:
        return ""
    return (
        '\nVisual context (what is on screen, from analyzing frames of the clip):\n'
        f'\"\"\"\n{vision_summary}\n\"\"\"'
    )


_VIDEO_SUMMARY_SYSTEM = """\
You summarize video session recordings for a clip extraction tool.
Given a session transcript (or excerpt), return JSON with exactly two keys:
  "title":   a 5-8 word headline capturing the session's defining moment or theme
  "summary": a 3-5 sentence paragraph describing what happened - the key moments and
             turning points, memorable or funny incidents, and who was involved.
Return ONLY valid JSON. No markdown, no extra text.\
"""


_SESSION_SUMMARY_SYSTEM = """\
You summarize a multi-recording play session for a clip extraction tool.
You are given the per-recording titles and summaries of every recording in the
session, in order. Return JSON with exactly two keys:
  "title":   a 5-8 word headline capturing the whole session's arc or defining theme
  "summary": a 3-5 sentence paragraph describing the session across all recordings -
             how it developed, standout moments, and who was involved.
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
    system = _compose_system(_SESSION_SUMMARY_SYSTEM, context_text, config)
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
    system = _compose_system(_VIDEO_SUMMARY_SYSTEM, context_text, config)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Transcript:\n\"\"\"\n{excerpt}\n\"\"\"\nJSON:"},
    ]
    data = _call_llm_json(messages, config, temperature=0.2)
    return str(data.get("title", "")), str(data.get("summary", ""))


_TIMELINE_CHUNK_SYSTEM = """\
You are summarizing a 15-minute segment of a video session recording.
Write 2-4 sentences describing what happened in this time window: key events, turning points,
memorable moments, who was involved, and how it flowed. Use names if mentioned in the transcript.
Be specific and grounded in the transcript. Skip filler phrases like "In this segment."
Return ONLY the paragraph - no JSON, no headings, no extra formatting.\
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
    system = _compose_system(_TIMELINE_CHUNK_SYSTEM, context_text, config)
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
- Suggest a name only when the evidence is clear. Omit any speaker you cannot identify -
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


def describe_clip(
    transcript: str, config: "Config", context_text: str = "", vision_summary: str = "",
) -> tuple[str, str]:
    """Generate description and description_long for a clip transcript.

    When *vision_summary* is set, a 'Visual context' block is added so descriptions
    reflect what's on screen. Returns (description, description_long). Raises on failure.
    """
    system = _compose_system(_SYSTEM_PROMPT, context_text, config)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": _USER_TEMPLATE.format(
            excerpt=transcript, visual=_visual_block(vision_summary))},
    ]
    data = _call_llm_json(messages, config, temperature=0.1)
    return str(data.get("description", "")), str(data.get("description_long", ""))


# Image-based clip analysis (plan 11). The instruction goes in the user turn, not a
# system role, and asks for plain prose (not JSON): small local vision models
# (moondream, SmolVLM) reliably follow a plain "describe this" user prompt but return
# coordinates/empty output for a JSON-schema system prompt (verified against real
# moondream via Ollama at implementation time).
_VISION_USER_PROMPT = """\
These images are frames sampled from a single video clip, in time order.
In 2-3 sentences, describe what is visible on screen: the game or scene, any on-screen
action or events, and notable UI, HUD, popups, or text. Describe only what you can see -
do not guess at audio or dialogue. Reply with the description only, no preamble."""

_VISION_SUMMARY_MAX_CHARS = 1500


def _clean_vision_summary(raw: str) -> str:
    """Normalize a vision model's reply into a plain-text summary. Tolerates a model
    that ignored the plain-text ask and returned JSON (pulls vision_summary), strips
    fences, and caps the length so a runaway response can't bloat the clip row."""
    text = _strip_json_fence(raw).strip()
    if text.startswith("{"):
        try:
            data = json.loads(text)
            if isinstance(data, dict) and data.get("vision_summary"):
                text = str(data["vision_summary"]).strip()
        except json.JSONDecodeError:
            pass
    return text[:_VISION_SUMMARY_MAX_CHARS].strip()


def describe_frames(image_paths, config: "Config", context_text: str = "") -> str:
    """Send sampled clip frames to the vision model and return a short on-screen summary.

    Raises VisionNotSupportedError if the active backend/model can't do vision, or any
    other exception on a failed call. *image_paths* is a list of Path to JPEG frames.
    """
    prompt = _prepend_context(_VISION_USER_PROMPT, context_text)
    raw = make_client(config).chat_vision(
        [{"role": "user", "content": prompt}], list(image_paths), temperature=0.2,
    )
    return _clean_vision_summary(raw)


def check_vision_available(config: "Config") -> tuple[bool, str]:
    """Return (available, reason) for image analysis on the active backend - the cheap
    pre-check routes gate on, mirroring check_llm_available. The backstop is the
    client's chat_vision raising VisionNotSupportedError."""
    from yuu_clip.config import resolve_ai_permissions

    if not config.ollama_enabled:
        return False, "LLM scoring is disabled in Settings"
    permissions = resolve_ai_permissions(config)
    if not permissions.allow_llm:
        return False, _GENERATIVE_OFF_REASON
    if not config.vision_enabled:
        return False, "Image analysis is turned off - enable it under Settings → LLM scoring"
    backend = config.llm_backend
    if backend == "claude":
        if not permissions.allow_remote:
            return False, _REMOTE_BLOCKED_REASON
        ok = bool(config.claude_api_key)
        return ok, "" if ok else "No Claude API key set - add one under Settings → LLM scoring"
    if backend == "llamacpp":
        from pathlib import Path
        vision_model_ok = bool(config.llm_vision_model_path) and Path(config.llm_vision_model_path).exists()
        mmproj_ok = bool(config.llm_mmproj_path) and Path(config.llm_mmproj_path).exists()
        if vision_model_ok and mmproj_ok:
            return True, ""
        if not vision_model_ok and not mmproj_ok:
            return False, (
                "llama.cpp image analysis needs a vision model and a vision projector "
                "(.gguf) - set both under Settings → LLM scoring"
            )
        if not vision_model_ok:
            return False, "llama.cpp image analysis needs a vision model - set it under Settings → LLM scoring"
        return False, "llama.cpp image analysis needs a vision projector (.gguf) - set it under Settings → LLM scoring"
    from yuu_clip.model_catalog import ollama_vision_tag_bases
    model = (config.ollama_model or "").strip()
    ok = bool(model) and model.split(":", 1)[0].strip().lower() in ollama_vision_tag_bases()
    return ok, "" if ok else (
        "The current Ollama model can't analyze images - pick a vision model "
        "under Settings → LLM scoring"
    )


_HOTWORD_SEMANTIC_SYSTEM = """\
You check whether a clip's transcript expresses the concept behind each of a list of
phrases - not necessarily the literal words, but the same idea, theme, or moment.

Return ONLY valid JSON: a list containing the exact phrases (copied verbatim from the
input list) whose concept is expressed in the transcript. Return [] if none apply.
No markdown, no extra text.\
"""


def scan_hotwords_semantic(transcript: str, phrases: list[str], config: "Config") -> list[str]:
    """Ask the LLM which of *phrases* have their concept expressed in *transcript*.

    Returns the subset of *phrases* (verbatim) the model judged as matching - filtered
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
    from yuu_clip.config import resolve_ai_permissions

    if not config.ollama_enabled:
        return False, "LLM scoring is disabled in Settings"
    permissions = resolve_ai_permissions(config)
    if not permissions.allow_llm:
        return False, _GENERATIVE_OFF_REASON
    if backend_is_remote(config) and not permissions.allow_remote:
        return False, _REMOTE_BLOCKED_REASON
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
        # Plain-English reason the last score() call failed, so callers can show the
        # user why (e.g. an incompatible CPU) instead of a generic "see the log".
        self.last_error: str | None = None

    def is_available(self) -> bool:
        from yuu_clip.config import resolve_ai_permissions

        if not self._config.ollama_enabled:
            return False
        if not resolve_ai_permissions(self._config).allow_llm:
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

        vision_summary = clip.vision_summary or ""
        try:
            raw = self._call_llm(clip.transcript_excerpt, vision_summary=vision_summary)
            try:
                data = self._parse(raw)
            except json.JSONDecodeError as exc:
                log.warning("LLM scoring: invalid JSON for clip %d, asking model to fix: %s", clip.id, exc)
                raw = self._call_llm(
                    clip.transcript_excerpt, vision_summary=vision_summary,
                    repair_of=raw, repair_error=exc,
                )
                data = self._parse(raw)
        except Exception as exc:
            log.warning("LLM scoring failed for clip %d: %s", clip.id, exc, exc_info=True)
            self.last_error = str(exc)
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
        self, excerpt: str, *, vision_summary: str = "",
        repair_of: str | None = None, repair_error: Exception | None = None,
    ) -> str:
        system = _compose_system(_SYSTEM_PROMPT, self._context_text, self._config)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": _USER_TEMPLATE.format(
                excerpt=excerpt, visual=_visual_block(vision_summary))},
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
