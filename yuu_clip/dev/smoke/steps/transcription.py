"""Section "transcription" - UC-D01, UC-D02 (plan Stage 2 route map)."""
from __future__ import annotations

from yuu_clip.dev.smoke.steps import SmokeContext, StepSpec, assert_outcome_ok, drain_sse, raw_frames

RETRANSCRIBE_DEADLINE_S = 300.0
INFER_NAMES_DEADLINE_S = 120.0


def step_retranscribe_clip(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["approved_clip_id"]
    frames = drain_sse(ctx, f"/api/clips/{clip_id}/retranscribe?model=tiny&speaker_labels=false", RETRANSCRIBE_DEADLINE_S)
    final = assert_outcome_ok(frames)
    return f"clip {clip_id} retranscribed (model=tiny): outcome={final['outcome']}", raw_frames(frames)


def step_speakers(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    speakers = ctx.client.get_json(f"/api/videos/{video_id}/speakers")
    if not speakers:
        raise AssertionError(f"video {video_id} has no detected speakers")
    speaker_id = speakers[0]["id"]

    renamed = ctx.client.put_json(f"/api/speakers/{speaker_id}", {"name": "Smoke Speaker", "color": "#4fc3f7"})
    if renamed["name"] != "Smoke Speaker" or renamed["color"] != "#4fc3f7":
        raise AssertionError(f"speaker rename/recolor did not take effect: {renamed!r}")

    frames = drain_sse(ctx, f"/api/videos/{video_id}/infer-speaker-names", INFER_NAMES_DEADLINE_S)
    assert_outcome_ok(frames)
    result = next((f for f in frames if f.get("kind") == "result"), None)
    if result is None or "suggested" not in result.get("data", {}):
        raise AssertionError(f"infer-speaker-names produced no result frame with 'suggested': {frames!r}")

    # Per the plan and test-video-matrix.md: our source (synthetic or the real
    # default recording) never has speakers introduce themselves by name, so
    # zero suggestions is the CORRECT outcome - never assert suggested > 0.
    return (
        f"renamed speaker {speaker_id}; infer-speaker-names suggested={result['data']['suggested']}",
        raw_frames(frames),
    )


STEPS: tuple[StepSpec, ...] = (
    StepSpec(0, "Retranscribe a clip", ("UC-D01",), step_retranscribe_clip),
    StepSpec(0, "Rename a speaker; suggest names", ("UC-D02",), step_speakers),
)
