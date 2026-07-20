"""The two stubbed seams for the system tier, in a normally-imported module.

Kept out of ``conftest.py`` on purpose: pytest loads a package's ``conftest.py``
as a plugin, which can be a *different* module object than the one a test gets
via ``from tests.system.conftest import ...``. Mutable shared state (the active
transcript the transcribe stub returns) must live in a single, normally-imported
module so the fixture that installs the stub and the test that overrides the
transcript touch the same globals.
"""
from __future__ import annotations

import json

CONTEXT_MARKER = "SYSTEMTESTCONTEXTMARKER"

# Canned transcript: two speech blocks separated by a > silence_threshold_ms
# (3 s) gap, each long enough (>= 15 s) to survive the windower. Deterministic
# text/timestamps so clip windows, excerpts, and caption sidecars are exact.
CANNED_SEGMENTS: tuple[tuple[int, int, str], ...] = (
    (0, 2500, "Welcome to the deterministic system test recording."),
    (2600, 5000, "This first block is a funny moment with chaotic banter."),
    (5200, 8000, "Everyone laughs as the plan completely falls apart."),
    (8200, 11000, "We keep talking through the whole opening block."),
    (11200, 14000, "Still going here so the window is comfortably long."),
    (14200, 17500, "That wraps the first clip candidate block cleanly."),
    # >= 3 s silence gap here (17.5 s -> 22 s) marks a clip boundary.
    (22000, 25000, "Now the second block begins after a clear silence gap."),
    (25200, 28000, "A dramatic confrontation unfolds between the players."),
    (28200, 31000, "The tension builds toward a decisive revelation."),
    (31200, 34000, "They resolve the argument and move on together."),
    (34200, 37500, "This block is also long enough to form a clip."),
)

# The segments the transcribe stub currently returns. A test can point this at a
# different transcript (via ``use_transcript``) to prove a re-transcribe actually
# refreshes excerpts/sidecars; ``reset_transcript`` restores the default.
_ACTIVE_SEGMENTS: list[tuple[int, int, str]] = list(CANNED_SEGMENTS)


def use_transcript(segments: list[tuple[int, int, str]]) -> None:
    """Make the transcribe stub return *segments* on its next call (for retranscribe)."""
    _ACTIVE_SEGMENTS[:] = segments


def reset_transcript() -> None:
    _ACTIVE_SEGMENTS[:] = CANNED_SEGMENTS


def fake_transcribe_track(track, config, session, language=None, pause_gate=None):
    """Stand in for whisper_runner.transcribe_track: persist canned segments.

    Mirrors the real function's DB writes (a Transcript row + its
    TranscriptSegments) so every downstream stage - windowing, excerpts,
    summaries, captions - sees a real, deterministic transcript. That includes
    ``completed_at``: without it the next run reads this transcript as a truncated
    leftover and re-transcribes.
    """
    from datetime import datetime, timezone

    from yuu_clip.db.models import Transcript, TranscriptSegment

    transcript = Transcript(
        audio_track_id=track.id,
        model_name=config.whisper_model,
        language="en",
        completed_at=datetime.now(timezone.utc),
    )
    session.add(transcript)
    session.flush()
    for start_ms, end_ms, text in _ACTIVE_SEGMENTS:
        session.add(TranscriptSegment(
            transcript_id=transcript.id,
            start_ms=start_ms,
            end_ms=end_ms,
            text=text,
            confidence=-0.1,
            speaker_label=None,
        ))
    session.flush()
    return transcript


class FakeLLMClient:
    """Deterministic in-memory LLM. Returns canned, shape-correct replies keyed on
    the request so every LLM-backed feature (scoring, descriptions, summary,
    timeline) works headless. Echoes whether a world-context reached the prompt so
    the context-rescore test can prove the context was injected."""

    def __init__(self, config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        return True, ""

    def chat(self, messages, temperature: float = 0.1, max_tokens: int = 1024) -> str:
        blob = "\n".join(str(m.get("content", "")) for m in messages)
        if "Return ONLY the paragraph" in blob:  # timeline chunk - plain prose
            return "A deterministic timeline entry describing this window."
        if "self-contained SCENES" in blob:  # scene-boundary segmentation
            return "[]"
        if "anonymous speaker" in blob:  # speaker-name inference
            return "{}"
        if "expresses the concept" in blob:  # semantic hot-word scan
            return "[]"
        if "thematically" in blob:  # related-clip search
            return "[]"
        if '"title"' in blob and '"summary"' in blob:  # video/session summary
            return json.dumps({
                "title": "Deterministic System Test Session",
                "summary": "A deterministic three-to-five sentence summary of the session.",
            })
        # Default: clip/scene scoring + description.
        marker = CONTEXT_MARKER if CONTEXT_MARKER in blob else "none"
        return json.dumps({
            "description": f"Deterministic clip description. ctx={marker}",
            "description_long": (
                "A deterministic longer description covering what happens, why it "
                f"stands out, and who is involved. ctx={marker}"
            ),
            "score_funny": 0.8,
            "score_dramatic": 0.4,
            "score_action": 0.2,
        })

    def chat_vision(self, messages, images, temperature: float = 0.1) -> str:
        return "A deterministic on-screen description of the sampled frames."
