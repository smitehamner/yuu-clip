"""Section "config" - UC-F01 through UC-F05 (plan Stage 2 route map)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Optional

from yuu_clip.dev.smoke.steps import (
    SmokeContext,
    StepSkip,
    StepSpec,
    assert_outcome_ok,
    assert_outcome_ok_allow_no_llm_skip,
    drain_sse,
    raw_frames,
)
from yuu_clip.dev.smoke.steps.core import EXPORT_DEADLINE_S

RESCORE_DEADLINE_S = 300.0
SUGGEST_FRAMING_DEADLINE_S = 120.0
ANALYZE_FRAMES_DEADLINE_S = 300.0


def step_world_contexts(ctx: SmokeContext) -> tuple[str, list[dict]]:
    context_id = "smoke-test-context"
    created = ctx.client.post_json("/api/contexts", {
        "context_id": context_id, "display_name": "Smoke Test Context", "setting": "A test setting",
    })
    if created["context_id"] != context_id:
        raise AssertionError(f"context creation echoed context_id={created['context_id']!r}, expected {context_id!r}")

    character = ctx.client.post_json(
        f"/api/contexts/{context_id}/characters",
        {"name": "Smoke Character", "lore": "A test character.", "score_boost": 0.1},
    )
    if character["name"] != "Smoke Character":
        raise AssertionError(f"character creation did not take: {character!r}")

    video_id = ctx.state["video_id"]
    frames = drain_sse(ctx, f"/api/videos/{video_id}/rescore-clips", RESCORE_DEADLINE_S)
    assert_outcome_ok_allow_no_llm_skip(ctx, frames, "context re-score")

    deleted = ctx.client.delete_json(f"/api/contexts/{context_id}")
    if deleted.get("deleted") != context_id:
        raise AssertionError(f"context delete response unexpected: {deleted!r}")

    return f"context {context_id!r} + character created, rescore-clips ok, context cleaned up", raw_frames(frames)


def step_track_layouts(ctx: SmokeContext) -> tuple[str, list[dict]]:
    name = "smoke-layout"
    ctx.client.post_json("/api/profiles", {
        "name": name,
        "assignments": [{"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True}],
    })
    profiles = ctx.client.get_json("/api/profiles")
    if not any(p["name"] == name for p in profiles):
        raise AssertionError(f"new track layout {name!r} not present in /api/profiles: {profiles!r}")

    ctx.client.delete_json(f"/api/profiles/{name}")
    profiles_after = ctx.client.get_json("/api/profiles")
    if any(p["name"] == name for p in profiles_after):
        raise AssertionError(f"track layout {name!r} still listed after delete")

    return f"track layout {name!r} created, listed, deleted", []


def step_scoring_config(ctx: SmokeContext) -> tuple[str, list[dict]]:
    applied = ctx.client.post_json("/api/content-presets/apply", {"id": "podcast", "add_hotwords": True})
    if applied["applied"] != "podcast":
        raise AssertionError(f"content-preset apply echoed applied={applied.get('applied')!r}, expected 'podcast'")

    hotword = ctx.client.post_json(
        "/api/hotwords", {"phrase": "smoke test phrase", "match_mode": "exact", "boost": 0.1, "target": "overall"}
    )
    video_id = ctx.state["video_id"]
    hotword_rescan = ctx.client.post_json(f"/api/videos/{video_id}/hotword-rescan")
    if "clips_checked" not in hotword_rescan:
        raise AssertionError(f"hotword-rescan response missing 'clips_checked': {hotword_rescan!r}")

    sensitive = ctx.client.post_json(
        "/api/sensitive-terms", {"term": "smoketestword", "category": "censor", "match_mode": "exact"}
    )
    sensitive_rescan = ctx.client.post_json(f"/api/videos/{video_id}/sensitive-rescan")
    if "clips_checked" not in sensitive_rescan:
        raise AssertionError(f"sensitive-rescan response missing 'clips_checked': {sensitive_rescan!r}")

    ctx.client.delete_json(f"/api/hotwords/{hotword['id']}")
    ctx.client.delete_json(f"/api/sensitive-terms/{sensitive['id']}")

    return (
        f"podcast preset applied; hotword {hotword['id']} + sensitive term {sensitive['id']} rescanned and cleaned up",
        [],
    )


def _ffprobe_dimensions(path: Path) -> Optional[tuple[int, int]]:
    ffprobe = shutil.which("ffprobe")
    if ffprobe is None:
        return None
    cmd = [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
           "-of", "csv=s=x:p=0", str(path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    try:
        width, height = result.stdout.strip().split("x")
        return int(width), int(height)
    except ValueError:
        return None


def step_vertical_export(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["approved_clip_id"]
    frames = drain_sse(ctx, f"/api/clips/{clip_id}/suggest-framing", SUGGEST_FRAMING_DEADLINE_S, method="POST")
    assert_outcome_ok(frames)
    result = next((f for f in frames if f.get("kind") == "result"), None)
    if result is None or "crop_x" not in result.get("data", {}):
        raise AssertionError(f"suggest-framing produced no crop_x result: {frames!r}")

    export_frames = drain_sse(ctx, f"/api/clips/{clip_id}/export?preset=tiktok-9x16", EXPORT_DEADLINE_S)
    assert_outcome_ok(export_frames)

    files = ctx.client.get_json(f"/api/clips/{clip_id}/export-files")
    video_files = [f for f in files.get("files", []) if not f.endswith(".srt")]
    if not video_files:
        raise AssertionError(f"vertical export produced no video file: {files!r}")
    exported_path = ctx.scratch_dir / ".yuu-clip" / "exports" / video_files[-1]
    dims = _ffprobe_dimensions(exported_path)
    if dims != (1080, 1920):
        raise AssertionError(f"vertical export dimensions={dims!r}, expected (1080, 1920)")

    return (
        f"suggest-framing crop_x={result['data']['crop_x']!r}; vertical export {dims[0]}x{dims[1]}",
        raw_frames(export_frames),
    )


def step_analyze_frames(ctx: SmokeContext) -> tuple[str, list[dict]]:
    capabilities = ctx.client.get_json("/api/llm/capabilities")
    if not capabilities.get("vision"):
        raise StepSkip(f"vision model unavailable: {capabilities.get('detail')}")

    clip_id = ctx.state["approved_clip_id"]
    frames = drain_sse(ctx, f"/api/clips/{clip_id}/analyze-frames", ANALYZE_FRAMES_DEADLINE_S, method="POST")
    assert_outcome_ok(frames)
    if not any(f.get("kind") == "progress" for f in frames):
        raise AssertionError("analyze-frames produced no progress frames (expected sampling/describing stages)")

    clip = ctx.client.get_json(f"/api/clips/{clip_id}")
    if not clip.get("vision_summary"):
        raise AssertionError(f"clip {clip_id} has no vision_summary after analyze-frames: {clip!r}")

    return f"vision_summary set: {clip['vision_summary'][:60]!r}", raw_frames(frames)


STEPS: tuple[StepSpec, ...] = (
    StepSpec(0, "World contexts + characters; re-score with context", ("UC-F01",), step_world_contexts),
    StepSpec(0, "Track layouts: create, list, delete", ("UC-F02",), step_track_layouts),
    StepSpec(0, "Scoring config: preset, hot-words, sensitive terms", ("UC-F03",), step_scoring_config),
    StepSpec(0, "Vertical/Shorts export with auto-framing", ("UC-F04",), step_vertical_export),
    StepSpec(0, "Vision: analyze frames", ("UC-F05",), step_analyze_frames),
)
