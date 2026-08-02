"""
LLMScorer - sends the transcript excerpt to an LLM and parses dimension scores.

Backend (config: llm_backend):
  "llamacpp" - bundled llama.cpp llama-server over HTTP; local, GPU-accelerated, no API
  costs. All inference is on-device - nothing the user records leaves their machine.

Gracefully degrades: if the backend is unreachable or returns bad output,
logs a warning and returns a zero ScoreResult so ingest is never blocked.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from typing import TYPE_CHECKING

from yuu_clip.contexts import format_character_block
from yuu_clip.scoring.llm_client import make_client
from yuu_clip.scoring.protocol import ScoreResult

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.config import Config
    from yuu_clip.db.models import ClipCandidate

log = logging.getLogger(__name__)

# User-facing reason for the AI-privacy-mode "none" block.
_GENERATIVE_OFF_REASON = (
    "Generative AI is turned off - change it under Settings -> AI privacy"
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


# Scene-boundary segmentation returns a JSON *list* of {start_ms,end_ms,reason} objects,
# which for a long transcript chunk (up to _CHUNK_CHAR_BUDGET of input) can exceed the
# default completion cap. Give it more room so the list is not truncated mid-array. Other
# calls use the backend default (llm_client._DEFAULT_MAX_TOKENS, aligned across backends).
_SCENE_BOUNDARY_MAX_TOKENS = 2048

# Some models wrap JSON in a markdown fence despite being told not to. The search is not
# anchored to the whole message, so a fenced block amid surrounding prose is still found.
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _strip_json_fence(raw: str) -> str:
    """Return the content of a ```json fenced block if present (even amid surrounding
    prose), else the stripped whole. Fence-only on purpose: prose-embedded bare JSON is
    handled by _loads_lenient, so a vision summary that happens to contain a stray brace
    is left intact."""
    stripped = raw.strip()
    match = _JSON_FENCE_RE.search(stripped)
    return match.group(1).strip() if match else stripped


def _first_json_span(text: str) -> str | None:
    """The first balanced {...} or [...] span in *text*, for pulling JSON out of a
    prose-wrapped reply ("The scores are {...}"). Returns None when neither opener has a
    matching close (e.g. output truncated mid-array), so the caller falls back to the
    repair retry rather than parsing a partial object."""
    openers = [(pos, opener, closer) for pos, opener, closer in (
        (text.find("{"), "{", "}"), (text.find("["), "[", "]"),
    ) if pos != -1]
    if not openers:
        return None
    start, opener, closer = min(openers)
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
    return None


def _loads_lenient(raw: str):
    """json.loads a model reply, tolerating a markdown fence or surrounding prose. Raises
    JSONDecodeError (fail loud -> one repair retry upstream) if no JSON parses."""
    text = _strip_json_fence(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        span = _first_json_span(text)
        if span is not None and span != text:
            return json.loads(span)
        raise


def _repair_request(bad_raw: str, exc: Exception) -> list[dict]:
    return [
        {"role": "assistant", "content": bad_raw},
        {"role": "user", "content": (
            f"That response was not valid JSON ({exc}). Reply again with ONLY "
            "the corrected JSON - no markdown, no extra text."
        )},
    ]


def _call_and_parse_json(
    call_fn: Callable[[str | None, Exception | None], str],
    parse_fn: Callable[[str], object],
    *,
    log_context: str = "",
):
    """Shared call + parse + one-repair loop for LLM JSON responses. call_fn(repair_of,
    repair_error) sends the request (as a repair when repair_of is set); parse_fn turns
    the raw reply into data (and may clamp/validate). On a parse error the model gets one
    chance to correct itself; a second failure propagates."""
    raw = call_fn(None, None)
    try:
        return parse_fn(raw)
    except json.JSONDecodeError as exc:
        where = f" for {log_context}" if log_context else ""
        log.warning("LLM returned invalid JSON%s, asking it to correct itself: %s", where, exc)
        raw = call_fn(raw, exc)
        return parse_fn(raw)


def _call_llm_json(
    messages: list[dict], config: "Config", temperature: float = 0.1,
    max_tokens: int | None = None,
):
    """Call the LLM expecting JSON, with one repair retry on a parse failure."""
    def _call(repair_of: str | None, repair_error: Exception | None) -> str:
        payload = messages if repair_of is None else messages + _repair_request(repair_of, repair_error)
        return _call_client(payload, config, temperature, max_tokens)
    return _call_and_parse_json(_call, _loads_lenient)


_SYSTEM_PROMPT = """\
You analyze video clips for highlight potential.
Given a transcript excerpt, do the following in a single JSON response:

1. Write a "description": one punchy sentence (≤20 words) capturing what actually happens.
2. Write a "description_long": a paragraph (3-5 sentences) covering:
   - What happens and why it stands out as a highlight
   - Why it is funny, dramatic, or otherwise notable
   - Who is involved (use names if mentioned in the transcript)
   - Any other interesting context, callbacks, or recurring bits
3. Rate 0.0-1.0 on three dimensions:
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


# Scene-mode rubric (Clips-vs-Scenes Stage 2). A Scene is a longer contextual
# candidate (1-5 min, may include pauses and a story arc), so it is judged on
# whether it is worth watching AS A SCENE - narrative arc, payoff, context - not
# on whether it is a punchy clip. It populates the same score_* columns and the
# same overall math (_compute_overall), so downstream review/export is unchanged;
# only the prompt differs. Sparse or quiet transcripts are expected and must not
# be treated as "nothing to score".
_SCENE_SYSTEM_PROMPT = """\
You analyze longer video scenes (roughly 1-5 minutes) for how worth watching they are
as a complete moment. A scene is NOT a punchy clip - it can include pauses, build-up,
and a story arc, and its transcript may be sparse or have quiet stretches (that is
normal). Judge the scene as a whole: does it have a narrative arc, a payoff, and enough
context to stand on its own?

Given a transcript excerpt, do the following in a single JSON response:

1. Write a "description": one sentence (≤20 words) capturing what the scene is about.
2. Write a "description_long": a paragraph (3-5 sentences) covering:
   - What happens across the scene and how it develops
   - What makes it worth watching as a longer moment (arc, payoff, stakes, or context)
   - Who is involved (use names if mentioned in the transcript)
   - Any callbacks, running bits, or context that pays off
3. Rate 0.0-1.0 on three dimensions, judged over the WHOLE scene:
   "score_funny":    sustained humor, running gags, comedic build-up and payoff
   "score_dramatic": tension that builds and resolves, confrontations, revelations, emotional arcs
   "score_action":   escalating stakes, sustained high-tension sequences, physical chaos

Return ONLY valid JSON with exactly these five keys. No markdown, no extra text.\
"""


# Scene-boundary segmentation (Clips-vs-Scenes Stage 3). Asks the LLM to split a
# recording's transcript into longer self-contained scenes (start_ms/end_ms + reason).
# The geometry (clamp to video range + min/max bounds, drop overlaps, cap the count,
# chunk long transcripts) lives in segments/scene_segmenter.py; this only prompts and
# parses. Distinct from _SCENE_SYSTEM_PROMPT above, which SCORES an existing scene.
_SCENE_BOUNDARY_SYSTEM = """\
You split a longer recording's transcript into self-contained SCENES - contextual
moments of roughly 1-5 minutes, each with a beginning, middle, and end (a story arc, a
bit that builds and pays off, a conversation, an encounter). A scene is NOT a punchy
one-liner; it is a longer moment worth watching as a whole.

The transcript is given as lines, each prefixed with its start time in milliseconds:
[start_ms] text

Choose boundaries that fall on natural breaks in the conversation or action. For each
scene, return its "start_ms" and "end_ms" as integers in the SAME millisecond scale as
the prefixes, plus a short "reason" (<=15 words) for why it is a coherent scene.

Return ONLY valid JSON: a list of objects with keys "start_ms", "end_ms", "reason".
Order by start_ms ascending. Do not overlap scenes. No markdown, no extra text.\
"""


def request_scene_boundaries(
    transcript_block: str, config: "Config", context_text: str = "",
) -> list[dict]:
    """Ask the LLM to propose scene boundaries over *transcript_block*.

    *transcript_block* is the transcript formatted one line per segment, each prefixed
    with its start_ms. Returns a list of {"start_ms": int, "end_ms": int, "reason": str}
    in the transcript's millisecond scale. Malformed individual items are skipped;
    raises (fail loud) if the whole response can't be parsed as a JSON list even after
    the one repair retry in _call_llm_json.
    """
    system = _compose_system(_SCENE_BOUNDARY_SYSTEM, context_text, config)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Transcript:\n\"\"\"\n{transcript_block}\n\"\"\"\nJSON:"},
    ]
    data = _call_llm_json(messages, config, temperature=0.2, max_tokens=_SCENE_BOUNDARY_MAX_TOKENS)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list of scene boundaries, got {type(data).__name__}")
    boundaries: list[dict] = []
    for item in data:
        if not isinstance(item, dict) or "start_ms" not in item or "end_ms" not in item:
            continue
        try:
            boundaries.append({
                "start_ms": int(item["start_ms"]),
                "end_ms":   int(item["end_ms"]),
                "reason":   str(item.get("reason", "")),
            })
        except (TypeError, ValueError):
            continue
    return boundaries


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
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data).__name__}")
    return str(data.get("title", "")), str(data.get("summary", ""))


def _call_client(
    messages: list[dict], config: "Config", temperature: float = 0.1,
    max_tokens: int | None = None,
) -> str:
    client = make_client(config)
    if max_tokens is None:
        return client.chat(messages, temperature)
    return client.chat(messages, temperature, max_tokens)


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
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data).__name__}")
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
        f"Time window: {start_hms} - {end_hms}\n\n"
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
    Malformed individual items are skipped, matching request_scene_boundaries and
    scan_hotwords_semantic; raises (fail loud) only if the whole response can't be
    parsed as a JSON list.
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
    related: list[dict] = []
    for r in results:
        if not isinstance(r, dict) or "id" not in r:
            continue
        try:
            related.append({"id": int(r["id"]), "reason": str(r.get("reason", ""))})
        except (TypeError, ValueError):
            continue
    return related


_SPEAKER_NAME_SYSTEM = """\
You identify who each anonymous speaker is in a transcript, using every naming clue
available - not just how people address each other.

The transcript is labeled with anonymous numbers (Speaker 1, Speaker 2, …). Look for:
- Direct address ("Hey Yuu, watch out", "Nice shot, Alex") - the name usually belongs to
  a DIFFERENT speaker, the one being spoken to.
- Self-identification ("I'm Alex", "This is Alex speaking").
- Third-person introduction by someone else, common in interviews, panels, and press
  conferences ("Please welcome astronaut Alex", "Joining us today is Dr. Alex", "Our
  next question is from Alex") - the name usually belongs to whichever speaker takes
  the next turn after the introduction.

Rules:
- Suggest a name only when the evidence is clear. Omit any speaker you cannot identify -
  never guess or invent a name.
- Never assign the same name to two different speaker numbers.

Return ONLY valid JSON: an object mapping the speaker number (as a string) to the
inferred name, e.g. {"1": "Yuu", "3": "Alex"}. Return {} when nothing is clear.
No markdown, no extra text.\
"""

_SPEAKER_NAME_TRANSCRIPT_MAX_CHARS = 12000
_SPEAKER_NAME_TRANSCRIPT_WINDOWS = 5


def _sample_transcript_for_speaker_names(
    labeled_transcript: str,
    max_chars: int = _SPEAKER_NAME_TRANSCRIPT_MAX_CHARS,
    windows: int = _SPEAKER_NAME_TRANSCRIPT_WINDOWS,
) -> str:
    """Fit *labeled_transcript* within *max_chars* by sampling lines spread across the
    whole recording - including the very end - rather than just the opening minutes.

    A flat head-only truncation never sees introductions or self-identification that
    happen later in a long recording (e.g. a 60-minute press conference). Instead this
    splits the budget into *windows* evenly spaced starting points (the first anchored
    at the head, the last anchored at the tail so it always reaches the true end) and
    keeps lines from each, in original order, until that window's share of the budget
    is spent. Returns the transcript unchanged when it already fits.
    """
    if len(labeled_transcript) <= max_chars:
        return labeled_transcript
    lines = labeled_transcript.split("\n")
    if not lines:
        return labeled_transcript[:max_chars]
    window_budget = max_chars // windows
    kept_indices: set[int] = set()
    for window in range(windows):
        if window == windows - 1:
            chars_used = 0
            idx = len(lines)
            while idx > 0 and chars_used < window_budget:
                idx -= 1
                chars_used += len(lines[idx]) + 1
            kept_indices.update(range(idx, len(lines)))
        else:
            chars_used = 0
            idx = round(window * len(lines) / windows)
            while idx < len(lines) and chars_used < window_budget:
                kept_indices.add(idx)
                chars_used += len(lines[idx]) + 1
                idx += 1
    return "\n".join(lines[i] for i in sorted(kept_indices))


def infer_speaker_names(
    labeled_transcript: str, config: "Config", context_text: str = ""
) -> dict[str, str]:
    """Suggest real names for anonymous speakers from naming evidence in the transcript.

    *labeled_transcript* is the recording's transcript with each line prefixed by its
    "Speaker N" label. Returns {display_index_str: name}, empty when nothing is clear.
    Long transcripts are sampled across the whole recording (see
    `_sample_transcript_for_speaker_names`) to stay within the model's context window
    without losing introductions that happen after the opening minutes. Raises on failure.
    """
    system = _prepend_context(_SPEAKER_NAME_SYSTEM, context_text)
    sampled = _sample_transcript_for_speaker_names(labeled_transcript)
    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": f"Transcript:\n\"\"\"\n{sampled}\n\"\"\"\nJSON:"},
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
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data).__name__}")
    return str(data.get("description", "")), str(data.get("description_long", ""))


# Image-based clip analysis (plan 11). The instruction goes in the user turn, not a
# system role, and asks for plain prose (not JSON): small local vision models
# reliably follow a plain "describe this" user prompt but return coordinates/empty
# output for a JSON-schema system prompt.
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
            pass  # a plain-prose reply that merely opens with "{" - keep it verbatim
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


def describe_frames_via_server(image_paths, context_text: str, base_url: str) -> str:
    """Like describe_frames, but POST directly to an already-running llama-server at
    *base_url* (bypassing the pool). Used by the killable frame-analysis subprocess so
    the web server keeps the vision model warm while the subprocess owns the cancelable
    HTTP call."""
    from yuu_clip.scoring.llamacpp_server import completion_text, post_chat_completion
    from yuu_clip.scoring.llm_client import vision_payload_messages

    prompt = _prepend_context(_VISION_USER_PROMPT, context_text)
    payload = {
        "messages": vision_payload_messages(
            [{"role": "user", "content": prompt}], list(image_paths)
        ),
        "temperature": 0.2,
    }
    return _clean_vision_summary(completion_text(post_chat_completion(base_url, payload)))


def check_vision_available(config: "Config") -> tuple[bool, str]:
    """Return (available, reason) for image analysis on the active backend - the cheap
    pre-check routes gate on, mirroring check_llm_available. The backstop is the
    client's chat_vision raising VisionNotSupportedError."""
    from yuu_clip.config import resolve_ai_permissions

    if not config.llm_enabled:
        return False, "LLM scoring is disabled in Settings"
    permissions = resolve_ai_permissions(config)
    if not permissions.allow_llm:
        return False, _GENERATIVE_OFF_REASON
    if not config.vision_enabled:
        return False, "Image analysis is turned off - enable it under Settings -> LLM scoring"
    # Local llamacpp backend (the only backend).
    from pathlib import Path
    vision_model_ok = bool(config.llm_vision_model_path) and Path(config.llm_vision_model_path).exists()
    mmproj_ok = bool(config.llm_mmproj_path) and Path(config.llm_mmproj_path).exists()
    if vision_model_ok and mmproj_ok:
        return True, ""
    if not vision_model_ok and not mmproj_ok:
        return False, (
            "llama.cpp image analysis needs a vision model and a vision projector "
            "(.gguf) - set both under Settings -> LLM scoring"
        )
    if not vision_model_ok:
        return False, "llama.cpp image analysis needs a vision model - set it under Settings -> LLM scoring"
    return False, "llama.cpp image analysis needs a vision projector (.gguf) - set it under Settings -> LLM scoring"


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

    if not config.llm_enabled:
        return False, "LLM scoring is disabled in Settings"
    permissions = resolve_ai_permissions(config)
    if not permissions.allow_llm:
        return False, _GENERATIVE_OFF_REASON
    return make_client(config).available()


def _active_model_id(config: "Config") -> str | None:
    return config.llm_model_path


def _characters_in_clip(clip: "ClipCandidate") -> list[dict]:
    """The DISTINCT world-context Characters that speak in this clip.

    Resolves segment -> Speaker -> Person (global_voice) -> Character alias over the
    clip's window, deduped by character. A Person may hold an alias per world context (the
    same voice playing a different character in a different context); only the alias whose
    context is active for THIS clip's recording is surfaced, so a Person's alias from an
    unrelated context never leaks into this prompt. Returns [] when no speaking Person has
    a matching alias - the common case, which keeps the scoring prompt unchanged. Reuses
    clip_window_segments so it reads the same segments the excerpt was built from.
    """
    from yuu_clip.scoring.term_scope import video_context_ids
    from yuu_clip.segments.windower import clip_window_segments

    active_contexts = video_context_ids(clip.video)
    by_character: dict[int, dict] = {}
    for seg in clip_window_segments(clip.video, clip.start_ms, clip.end_ms):
        speaker = seg.speaker
        voice = speaker.global_voice if speaker is not None else None
        if voice is None:
            continue
        for link in voice.character_links:
            character = link.character
            if character.id in by_character or character.context_slug not in active_contexts:
                continue
            by_character[character.id] = {
                "name": character.name,
                "lore": character.lore or "",
                "score_boost": character.score_boost or 0.0,
            }
    return list(by_character.values())


class LLMScorer:
    name = "llm"

    def __init__(self, config: "Config", context_text: str = "", scene_mode: bool = False) -> None:
        self._config = config
        self._context_text = context_text
        # Scene mode swaps the clip Funny/Dramatic/Action prompt for the scene rubric
        # (_SCENE_SYSTEM_PROMPT) and tolerates a sparse/quiet transcript instead of
        # bailing with llm_no_transcript. Everything else (parse, repair, weights,
        # notes) is shared - see the Clips-vs-Scenes plan Stage 2.
        self._scene_mode = scene_mode
        self.weight = config.scorer_llm_weight
        self._client = make_client(config)
        self._available: bool | None = None
        # Plain-English reason the last score() call failed, so callers can show the
        # user why (e.g. an incompatible CPU) instead of a generic "see the log".
        self.last_error: str | None = None

    def is_available(self) -> bool:
        from yuu_clip.config import resolve_ai_permissions

        if not self._config.llm_enabled:
            return self._mark_off_once("LLM scoring is off this run: disabled in Settings -> LLM scoring")
        if not resolve_ai_permissions(self._config).allow_llm:
            return self._mark_off_once(f"LLM scoring is off this run: {_GENERATIVE_OFF_REASON}")
        if self._available is not None:
            return self._available
        ok, reason = self._client.available()
        if not ok:
            log.warning("LLM scoring disabled: %s", reason)
        self._available = ok
        return ok

    def _mark_off_once(self, message: str) -> bool:
        # INFO, not WARNING, and worded distinctly from the backend-failure branch
        # above: a deliberate config/privacy choice is not a failure, but a silent
        # "no LLM scores" in the log is indistinguishable from one without this line.
        if self._available is None:
            log.info(message)
            self._available = False
        return False

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        vision_summary = clip.vision_summary or ""
        if not clip.transcript_excerpt:
            # A quiet scene (long arc, little speech) is legitimate - never tag it
            # llm_no_transcript. If it has on-screen context, score it from that;
            # otherwise there is genuinely nothing to judge, so return empty tags and
            # let the basic-description fallback handle it (as clips do with no LLM).
            if self._scene_mode:
                if not vision_summary:
                    return ScoreResult()
            else:
                return ScoreResult(tags=["llm_no_transcript"])

        excerpt = clip.transcript_excerpt or ""
        character_text = format_character_block(_characters_in_clip(clip))
        try:
            data = _call_and_parse_json(
                lambda repair_of, repair_error: self._call_llm(
                    excerpt, vision_summary=vision_summary, character_text=character_text,
                    repair_of=repair_of, repair_error=repair_error,
                ),
                self._parse,
                log_context=f"clip {clip.id}",
            )
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
        self, excerpt: str, *, vision_summary: str = "", character_text: str = "",
        repair_of: str | None = None, repair_error: Exception | None = None,
    ) -> str:
        base_prompt = _SCENE_SYSTEM_PROMPT if self._scene_mode else _SYSTEM_PROMPT
        # The per-clip character block rides alongside the (static) world-context text:
        # general world first, then who is actually speaking in this clip. Both empty ->
        # the composed prompt is identical to a project with no contexts or characters.
        context_text = self._context_text
        if character_text:
            context_text = f"{context_text}\n\n{character_text}" if context_text else character_text
        system = _compose_system(base_prompt, context_text, self._config)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": _USER_TEMPLATE.format(
                excerpt=excerpt, visual=_visual_block(vision_summary))},
        ]
        if repair_of is not None:
            messages += _repair_request(repair_of, repair_error)
        return self._client.chat(messages, temperature=0.1)

    def _parse(self, raw: str) -> dict:
        data = _loads_lenient(raw)
        for key in ("score_funny", "score_dramatic", "score_action"):
            if key in data:
                data[key] = max(0.0, min(1.0, float(data[key])))
        return data
