"""Section "editing" - UC-B06, UC-C01 through UC-C06 (plan Stage 2 route map)."""
from __future__ import annotations

from yuu_clip.dev.smoke.client import SmokeHttpError
from yuu_clip.dev.smoke.steps import (
    SmokeContext,
    StepSkip,
    StepSpec,
    assert_outcome_ok,
    drain_sse,
    raw_frames,
)
from yuu_clip.dev.smoke.steps.core import EXPORT_DEADLINE_S


def step_bulk_review_and_export(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    clips = ctx.client.get_json(f"/api/videos/{video_id}/clips")
    ids = [c["id"] for c in clips[:2]]
    original_statuses = {c["id"]: c["status"] for c in clips[:2]}

    set_resp = ctx.client.post_json("/api/clips/bulk-status", {"clip_ids": ids, "status": "approved"})
    if sorted(set_resp["updated"]) != sorted(ids):
        raise AssertionError(f"bulk-status updated={set_resp['updated']!r}, expected {ids!r}")

    restore_updates = [{"id": cid, "status": original_statuses[cid]} for cid in ids]
    restore_resp = ctx.client.post_json("/api/clips/bulk-status-restore", {"updates": restore_updates})
    if sorted(restore_resp["restored"]) != sorted(ids):
        raise AssertionError(f"bulk-status-restore restored={restore_resp['restored']!r}, expected {ids!r}")

    id_list = ",".join(str(cid) for cid in ids)
    frames = drain_sse(ctx, f"/api/clips/bulk-export?clip_ids={id_list}&skip_exported=false", EXPORT_DEADLINE_S)
    assert_outcome_ok(frames)

    if len(clips) >= 3:
        delete_id = clips[-1]["id"]
        delete_resp = ctx.client.post_json("/api/clips/bulk-delete", {"clip_ids": [delete_id]})
        if delete_id not in delete_resp["deleted"]:
            raise AssertionError(f"bulk-delete did not delete clip {delete_id}: {delete_resp!r}")
        delete_detail = f" deleted={delete_id}"
    else:
        delete_detail = " (delete skipped: fewer than 3 clips)"

    return f"bulk status set+restore+export ok on {ids}{delete_detail}", raw_frames(frames)


def step_edit_description(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["approved_clip_id"]
    original = ctx.client.get_json(f"/api/clips/{clip_id}")["description_original"]

    edited_text = "Smoke-test edited one-liner."
    edited = ctx.client.patch_json(
        f"/api/clips/{clip_id}/fields",
        {"action": "accept_edit", "field": "description", "new_description": edited_text},
    )
    if edited["description"] != edited_text or not edited["description_is_edited"]:
        raise AssertionError(f"accept_edit did not take effect: {edited!r}")
    if edited["description_original"] != original:
        raise AssertionError("accept_edit must not touch the original generated description")

    reverted = ctx.client.patch_json(f"/api/clips/{clip_id}/fields", {"action": "revert", "field": "description"})
    if reverted["description_is_edited"] or reverted["description"] != original:
        raise AssertionError(f"revert did not restore the generated description: {reverted!r}")

    return f"clip {clip_id}: accept_edit then revert round-tripped correctly", []


def step_trim_then_export(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["approved_clip_id"]
    before = ctx.client.get_json(f"/api/clips/{clip_id}")
    if before.get("export_stale"):
        raise AssertionError(f"clip {clip_id} already export_stale before trimming: {before.get('export_stale_reasons')!r}")

    timing = ctx.client.patch_json(f"/api/clips/{clip_id}/timing", {"start_offset": 1.0, "end_offset": -1.0})
    if timing["start_offset"] != 1.0 or timing["end_offset"] != -1.0:
        raise AssertionError(f"trim did not echo the requested offsets: {timing!r}")

    trimmed = ctx.client.get_json(f"/api/clips/{clip_id}")
    if not trimmed.get("export_stale"):
        raise AssertionError("export_stale did not flip True after trimming an already-exported clip")
    if "clip window changed" not in trimmed.get("export_stale_reasons", []):
        raise AssertionError(f"unexpected export_stale_reasons after trim: {trimmed.get('export_stale_reasons')!r}")

    frames = drain_sse(ctx, f"/api/clips/{clip_id}/export", EXPORT_DEADLINE_S)
    assert_outcome_ok(frames)
    re_exported = ctx.client.get_json(f"/api/clips/{clip_id}")
    if re_exported.get("export_stale"):
        raise AssertionError(f"export_stale still True after re-export: {re_exported.get('export_stale_reasons')!r}")

    return f"clip {clip_id}: trim flipped export_stale True, re-export flipped it back False", raw_frames(frames)


def step_edit_captions(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["approved_clip_id"]
    transcript = ctx.client.get_json(f"/api/clips/{clip_id}/transcript")
    lines = [line for line in transcript.get("lines", []) if line.get("seg_id") is not None]
    if not lines:
        raise AssertionError(f"clip {clip_id} has no editable caption segment")
    seg_id = lines[0]["seg_id"]

    new_text = "Smoke-test corrected caption."
    edited = ctx.client.put_json(f"/api/caption-segments/{seg_id}", {"text": new_text})
    if edited["text"] != new_text:
        raise AssertionError(f"caption edit echoed text={edited['text']!r}, expected {new_text!r}")
    if clip_id not in edited.get("affected_clip_ids", []):
        raise AssertionError(f"caption edit did not mark clip {clip_id} as affected: {edited!r}")

    updated_clip = ctx.client.get_json(f"/api/clips/{clip_id}")
    if new_text not in updated_clip.get("transcript_excerpt", ""):
        raise AssertionError("clip transcript_excerpt was not rebuilt with the corrected caption")

    status, body = ctx.client.get_bytes(f"/api/clips/{clip_id}/captions.vtt")
    if status != 200:
        raise AssertionError(f"captions.vtt returned {status}, expected 200 (clip should already be exported)")
    if not body.startswith(b"WEBVTT"):
        raise AssertionError("captions.vtt response did not start with a WEBVTT header")

    return f"seg {seg_id} corrected; captions.vtt is {len(body)} bytes", []


def step_split_export_unsplit(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    video = ctx.client.get_json(f"/api/videos/{video_id}")
    split_point_s = (video["duration_ms"] / 1000) / 2

    split = ctx.client.post_json(
        f"/api/videos/{video_id}/split", {"split_points": [split_point_s], "migrate_clips": True}
    )
    segment_ids = split["segment_ids"]
    if len(segment_ids) != 2:
        raise AssertionError(f"split produced {len(segment_ids)} segment(s), expected 2: {split!r}")

    segment_clips = ctx.client.get_json(f"/api/videos/{segment_ids[0]}/clips")
    exported_segment_id = segment_ids[0]
    if not segment_clips:
        segment_clips = ctx.client.get_json(f"/api/videos/{segment_ids[1]}/clips")
        exported_segment_id = segment_ids[1]
    if not segment_clips:
        ctx.client.post_json(f"/api/videos/{video_id}/unsplit")
        raise AssertionError(f"neither split segment {segment_ids} received any migrated clips")

    frames = drain_sse(ctx, f"/api/clips/{segment_clips[0]['id']}/export", EXPORT_DEADLINE_S)
    try:
        assert_outcome_ok(frames)
    finally:
        undo = ctx.client.post_json(f"/api/videos/{video_id}/unsplit")
        if undo["parent_id"] != video_id:
            raise AssertionError(f"unsplit parent_id={undo['parent_id']!r}, expected {video_id!r}")

    return (
        f"split into {segment_ids}, exported clip {segment_clips[0]['id']} from segment {exported_segment_id}, "
        f"merged back ({undo['merged_clips']} clips)",
        raw_frames(frames),
    )


def step_merge_duplicates(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    scan = ctx.client.post_json(f"/api/videos/{video_id}/scan-duplicates")
    if not isinstance(scan.get("pairs"), list):
        raise AssertionError(f"scan-duplicates response missing a 'pairs' list: {scan!r}")

    clips = ctx.client.get_json(f"/api/videos/{video_id}/clips")
    protected = {ctx.state.get("approved_clip_id"), ctx.state.get("exported_clip_id")}
    candidates = [c["id"] for c in clips if c["id"] not in protected]
    if len(candidates) < 2:
        raise StepSkip(
            f"only {len(candidates)} clip(s) available to merge without disturbing state later steps depend on"
        )

    clip_a, clip_b = candidates[0], candidates[1]
    merged = ctx.client.post_json(f"/api/clips/{clip_a}/merge", {"clip_b_id": clip_b})
    if merged["id"] != clip_a:
        raise AssertionError(f"merge response id={merged['id']!r}, expected {clip_a!r}")

    try:
        ctx.client.get_json(f"/api/clips/{clip_b}")
        raise AssertionError(f"clip {clip_b} still exists after being merged into {clip_a}")
    except SmokeHttpError as exc:
        if exc.status != 404:
            raise

    return f"merged clip {clip_b} into {clip_a}; scan-duplicates found {len(scan['pairs'])} pair(s)", []


def step_create_manual_clip(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    video = ctx.client.get_json(f"/api/videos/{video_id}")
    start_ms, end_ms = 0, min(5_000, video["duration_ms"])
    if end_ms - start_ms < 1_000:
        raise AssertionError(f"video {video_id} is too short ({video['duration_ms']}ms) for a 1s+ manual clip")

    created = ctx.client.post_json(f"/api/videos/{video_id}/clips", {"start_ms": start_ms, "end_ms": end_ms})
    if created["start_ms"] != start_ms or created["end_ms"] != end_ms:
        raise AssertionError(f"manual clip window mismatch: {created.get('start_ms')}-{created.get('end_ms')}")
    if "manual" not in created.get("tags", []):
        raise AssertionError(f"manual clip missing the 'manual' tag: {created.get('tags')!r}")

    return f"created manual clip {created['id']} ({start_ms}-{end_ms}ms)", []


STEPS: tuple[StepSpec, ...] = (
    StepSpec(0, "Bulk review and export", ("UC-B06",), step_bulk_review_and_export),
    StepSpec(0, "Edit a clip description", ("UC-C01",), step_edit_description),
    StepSpec(0, "Trim a clip, then export", ("UC-C02",), step_trim_then_export),
    StepSpec(0, "Edit captions, re-export", ("UC-C03",), step_edit_captions),
    StepSpec(0, "Split, export from a segment, undo split", ("UC-C04",), step_split_export_unsplit),
    StepSpec(0, "Merge duplicate clips", ("UC-C05",), step_merge_duplicates),
    StepSpec(0, "Create a clip by hand", ("UC-C06",), step_create_manual_clip),
)
