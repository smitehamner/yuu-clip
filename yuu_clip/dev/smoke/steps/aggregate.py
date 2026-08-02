"""Section "aggregate" - UC-E01, UC-E02 (plan Stage 2 route map).

UC-E03 (highlight reel) stays in the "core" section - it's part of Stage 1's
11-step flow, not an addition here.
"""
from __future__ import annotations

from yuu_clip.dev.smoke.steps import SmokeContext, StepSkip, StepSpec, assert_outcome_ok, drain_sse, raw_frames

SUMMARIZE_DEADLINE_S = 300.0
TIMELINE_DEADLINE_S = 300.0


def step_video_summary(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    frames = drain_sse(ctx, f"/api/videos/{video_id}/summarize", SUMMARIZE_DEADLINE_S)
    assert_outcome_ok(frames)
    result = next((f for f in frames if f.get("kind") == "result"), None)
    if result is None:
        raise AssertionError("summarize produced no result frame")

    data = result["data"]
    if "needs_model" in data:
        # Preflight already required LLM availability unless --no-llm was passed,
        # so this branch is only legitimate under --no-llm.
        if not ctx.no_llm:
            raise AssertionError(f"summarize reported needs_model despite LLM being available: {data!r}")
        raise StepSkip("--no-llm: summary generation needs a local model")

    for key in ("title_new", "summary_new"):
        if not data.get(key):
            raise AssertionError(f"summarize result missing non-empty {key!r}: {data!r}")

    # summarize does not persist - the caller commits via PATCH .../fields.
    ctx.client.patch_json(f"/api/videos/{video_id}/fields", {
        "action": "accept_new", "field": "both",
        "new_title": data["title_new"], "new_summary": data["summary_new"],
    })
    video = ctx.client.get_json(f"/api/videos/{video_id}")
    if video["title"] != data["title_new"] or video["summary"] != data["summary_new"]:
        raise AssertionError(f"summary was not committed via PATCH .../fields: {video!r}")

    return f"summary generated and committed: {data['title_new'][:40]!r}", raw_frames(frames)


def step_timeline_and_sessions(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    frames = drain_sse(ctx, f"/api/videos/{video_id}/timeline", TIMELINE_DEADLINE_S)
    assert_outcome_ok(frames)
    result_frames = [f for f in frames if f.get("kind") == "result"]
    if not result_frames:
        raise AssertionError("timeline produced no result frames")

    needs_model = "needs_model" in result_frames[0]["data"]
    if needs_model and not ctx.no_llm:
        raise AssertionError(f"timeline reported needs_model despite LLM being available: {result_frames[0]}")
    if needs_model:
        raise StepSkip("--no-llm: timeline generation needs a local model")

    video = ctx.client.get_json(f"/api/videos/{video_id}")
    if not video.get("has_timeline"):
        raise AssertionError("video has_timeline is still False after generating a timeline")

    session = ctx.client.post_json("/api/sessions", {"name": "Smoke session", "video_ids": [video_id]})
    if video_id not in session.get("member_ids", []):
        raise AssertionError(f"session creation did not include video {video_id}: {session!r}")
    session_id = session["id"]

    detail = ctx.client.get_json(f"/api/sessions/{session_id}")
    if len(detail.get("members", [])) != 1:
        raise AssertionError(f"session detail has unexpected member count: {detail!r}")

    dissolved = ctx.client.delete_json(f"/api/sessions/{session_id}")
    if dissolved.get("dissolved") != session_id:
        raise AssertionError(f"session dissolve response unexpected: {dissolved!r}")

    return f"timeline generated ({len(result_frames)} chunks); session {session_id} created and dissolved", raw_frames(frames)


STEPS: tuple[StepSpec, ...] = (
    StepSpec(0, "Generate a video summary", ("UC-E01",), step_video_summary),
    StepSpec(0, "Generate a timeline; group and dissolve a session", ("UC-E02",), step_timeline_and_sessions),
)
