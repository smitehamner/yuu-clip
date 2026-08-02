"""The release-smoke step registry: shared plumbing plus the assembled step list.

Split into one module per section (plan Stage 2) so a section's steps live next
to each other instead of one growing file: ``core`` (Stage 1's 11-step flow),
``editing``, ``transcription``, ``aggregate``, ``config``, ``housekeeping``. Each
section module exports a ``STEPS: tuple[StepSpec, ...]``; this module concatenates
them into ``STEP_SPECS`` (renumbered sequentially) and ``SECTIONS`` (name -> specs,
for ``--only``).

Every step function takes the shared SmokeContext, does its HTTP/SSE work, raises
AssertionError/SmokeHttpError/TimeoutError on failure (or StepSkip when the step is
legitimately not applicable this run), and returns ``(detail, frames)`` on success.
yuu_clip/dev/smoke/__init__.py turns that into a timed StepResult and stops at the
first failure.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from yuu_clip.dev.smoke.client import SmokeClient
from yuu_clip.dev.smoke.media import ResolvedSource


class StepSkip(Exception):
    """A step is legitimately not applicable this run (not a failure)."""


@dataclass
class SmokeContext:
    client: SmokeClient
    scratch_dir: Path
    restore_dir: Path
    source: ResolvedSource
    no_llm: bool
    online: bool = False
    state: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class StepSpec:
    step_no: int
    name: str
    uc_ids: tuple[str, ...]
    run: Callable[[SmokeContext], tuple[str, list[dict]]]
    section: str = "core"


# --- shared plumbing --------------------------------------------------------

def drain_sse(
    ctx: SmokeContext, path: str, deadline_s: float, method: str = "GET", payload: Any = None
) -> list[dict]:
    """Consume an SSE stream, also stashing its raw frames on ctx so a step that
    fails after draining still leaves useful debugging context - the orchestrator
    reports on the exception message alone otherwise, dropping exactly the frames
    a human needs to diagnose e.g. an unexpected outcome."""
    frames = list(ctx.client.stream_sse(path, deadline_s, method=method, payload=payload))
    ctx.state["_last_frames"] = raw_frames(frames)
    return frames


def done_frame(frames: list[dict]) -> Optional[dict]:
    for frame in reversed(frames):
        if frame.get("kind") == "done":
            return frame
    return None


def assert_outcome_ok(frames: list[dict]) -> dict:
    final = done_frame(frames)
    if final is None:
        raise AssertionError("stream ended with no 'done' frame")
    if final["outcome"] != "ok":
        raise AssertionError(f"outcome={final['outcome']!r} error={final.get('error', '')!r}")
    return final


def assert_outcome_ok_allow_no_llm_skip(ctx: SmokeContext, frames: list[dict], what: str) -> dict:
    """Like assert_outcome_ok, but under --no-llm a plain error outcome (rather than
    a route-specific needs_model short-circuit) downgrades to StepSkip instead of a
    hard failure - preflight only requires LLM availability when --no-llm is absent,
    so a route with no needs_model branch of its own may legitimately error here."""
    final = done_frame(frames)
    if final is not None and final["outcome"] == "error" and ctx.no_llm:
        raise StepSkip(f"--no-llm: {what} failed, likely no LLM configured: {final.get('error', '')}")
    return assert_outcome_ok(frames)


def raw_frames(frames: list[dict]) -> list[dict]:
    return [f["_raw"] for f in frames]


def bootstrap_state(ctx: SmokeContext) -> None:
    """Re-derive the state a from-step-1 run would have built up, by reading it
    back from the live server. Needed by ``--from``/``--only`` so a resumed run
    (against a scratch project a prior run already analyzed - pass ``--project``
    pointing at it) doesn't have to re-run the slow analyze step just to populate
    ctx.state. Best-effort: a field the server has no data for yet (e.g. no export
    exists) is simply left unset, same as if the run were still at step 1.
    """
    source_path = ctx.scratch_dir / ctx.source.video_path.name
    if source_path.is_file():
        ctx.state.setdefault("source_path", source_path)

    videos = ctx.client.get_json("/api/videos")
    video = next((v for v in videos if v["filename"] == ctx.source.video_path.name), None)
    if video is None:
        return
    ctx.state.setdefault("video_id", video["id"])

    clips = ctx.client.get_json(f"/api/videos/{video['id']}/clips")
    if not clips:
        return
    approved = next((c for c in clips if c["status"] == "approved"), clips[0])
    ctx.state.setdefault("approved_clip_id", approved["id"])
    exported = next((c for c in clips if c.get("has_export")), None)
    if exported is not None:
        ctx.state.setdefault("exported_clip_id", exported["id"])

    reels = ctx.client.get_json("/api/demo/list")
    if reels:
        ctx.state.setdefault("reel_filename", reels[0]["filename"])


# --- assembled registry ------------------------------------------------------

def _load_sections() -> dict[str, tuple[StepSpec, ...]]:
    from yuu_clip.dev.smoke.steps import aggregate, config, core, editing, housekeeping, transcription
    return {
        "core": core.STEPS,
        "editing": editing.STEPS,
        "transcription": transcription.STEPS,
        "aggregate": aggregate.STEPS,
        "config": config.STEPS,
        "housekeeping": housekeeping.STEPS,
    }


def _renumber(sections: dict[str, tuple[StepSpec, ...]]) -> tuple[StepSpec, ...]:
    specs = []
    step_no = 1
    for name, section_specs in sections.items():
        for spec in section_specs:
            specs.append(StepSpec(step_no, spec.name, spec.uc_ids, spec.run, section=name))
            step_no += 1
    return tuple(specs)


SECTION_ORDER: tuple[str, ...] = ("core", "editing", "transcription", "aggregate", "config", "housekeeping")
_SECTIONS_RAW = _load_sections()
STEP_SPECS: tuple[StepSpec, ...] = _renumber(_SECTIONS_RAW)
SECTIONS: dict[str, tuple[StepSpec, ...]] = {
    name: tuple(spec for spec in STEP_SPECS if spec.section == name) for name in SECTION_ORDER
}
