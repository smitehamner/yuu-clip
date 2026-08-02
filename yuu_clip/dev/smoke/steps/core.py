"""Section "core" - the 11-step release-gate flow (plan Stage 1)."""
from __future__ import annotations

import shutil
import urllib.parse
import zipfile
from pathlib import Path
from typing import Any

from yuu_clip.dev.smoke.media import MIN_CANDIDATE_DURATION_S
from yuu_clip.dev.smoke.steps import SmokeContext, StepSkip, StepSpec, assert_outcome_ok, drain_sse, raw_frames

EXPORT_DEADLINE_S = 300.0
ANALYZE_DEADLINE_S = 1800.0
DEMO_DEADLINE_S = 300.0
BACKUP_DEADLINE_S = 120.0

FORBIDDEN_BACKUP_PREFIXES = ("exports/", "proxies/", "audio/")


# --- step: switch project -------------------------------------------------

def step_switch_project(ctx: SmokeContext) -> tuple[str, list[dict]]:
    response = ctx.client.post_json("/api/projects/switch", {"path": str(ctx.scratch_dir)})
    if response["current"] != str(ctx.scratch_dir):
        raise AssertionError(f"current={response['current']!r}, expected {str(ctx.scratch_dir)!r}")
    if response["created"] is not True:
        raise AssertionError(f"created={response['created']!r}, expected True")
    ctx.state["project_generation"] = response["project_generation"]
    return f"current={response['current']} created=True", []


# --- step: probe the source recording ------------------------------------

def step_probe_source(ctx: SmokeContext) -> tuple[str, list[dict]]:
    dest = ctx.scratch_dir / ctx.source.video_path.name
    shutil.copy2(ctx.source.video_path, dest)
    if ctx.source.srt_path is not None:
        shutil.copy2(ctx.source.srt_path, dest.with_suffix(".srt"))
    ctx.state["source_path"] = dest

    probe = ctx.client.post_json("/api/probe", {"path": str(dest)})
    duration_s = probe["duration_s"]
    if duration_s < MIN_CANDIDATE_DURATION_S:
        raise AssertionError(f"{dest.name} probed at {duration_s:.1f}s, need >= {MIN_CANDIDATE_DURATION_S:.0f}s")
    return f"{dest.name}: {duration_s:.1f}s, srt_sidecar={probe.get('srt_sidecar')}", []


# --- step: analyze the recording ------------------------------------------

def step_analyze(ctx: SmokeContext) -> tuple[str, list[dict]]:
    source_path = ctx.state["source_path"]
    payload: dict[str, Any] = {"path": str(source_path), "force": True, "no_score": ctx.no_llm}
    if ctx.source.is_synthetic:
        payload["subtitle_source"] = str(source_path.with_suffix(".srt"))
    ctx.client.post_json("/api/analyze/start", payload)

    frames = drain_sse(ctx, "/api/analyze/events", ANALYZE_DEADLINE_S)
    final = assert_outcome_ok(frames)
    if not any(f.get("kind") == "progress" for f in frames):
        raise AssertionError("no progress frames observed during analyze")

    videos = ctx.client.get_json("/api/videos")
    matching = [v for v in videos if v["filename"] == source_path.name]
    if not matching:
        raise AssertionError(f"no video row found for {source_path.name} after analyze")
    ctx.state["video_id"] = matching[0]["id"]
    return f"outcome={final['outcome']} video_id={ctx.state['video_id']}", raw_frames(frames)


# --- step: review clip list and detail ------------------------------------

def step_review_clips(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    clips = ctx.client.get_json(f"/api/videos/{video_id}/clips")
    if len(clips) < 2:
        raise AssertionError(f"video {video_id} produced only {len(clips)} clip(s); need >= 2 for later steps")
    detail = ctx.client.get_json(f"/api/clips/{clips[0]['id']}")

    if ctx.no_llm:
        raise StepSkip("--no-llm: score/description assertions skipped (no_score analyze)")

    for key in ("description", "tags", "transcript_excerpt"):
        if not detail.get(key):
            raise AssertionError(f"clip {detail['id']} missing non-empty {key!r}")
    if not isinstance(detail.get("score_overall"), (int, float)):
        raise AssertionError(f"clip {detail['id']} score_overall is not numeric: {detail.get('score_overall')!r}")
    return f"{len(clips)} clips; clip {detail['id']} description={detail['description'][:60]!r}", []


# --- step: approve and reject clips ---------------------------------------

def step_review_status(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    clips = ctx.client.get_json(f"/api/videos/{video_id}/clips")
    approve_id, reject_id = clips[0]["id"], clips[1]["id"]
    ctx.client.post_json(f"/api/clips/{approve_id}/status", {"status": "approved"})
    ctx.client.post_json(f"/api/clips/{reject_id}/status", {"status": "rejected"})

    approved = ctx.client.get_json(f"/api/clips/{approve_id}")
    rejected = ctx.client.get_json(f"/api/clips/{reject_id}")
    if approved["status"] != "approved":
        raise AssertionError(f"clip {approve_id} status={approved['status']!r}, expected 'approved'")
    if rejected["status"] != "rejected":
        raise AssertionError(f"clip {reject_id} status={rejected['status']!r}, expected 'rejected'")

    ctx.state["approved_clip_id"] = approve_id
    return f"approved={approve_id} rejected={reject_id}", []


# --- step: export a clip ---------------------------------------------------

def step_export_clip(ctx: SmokeContext) -> tuple[str, list[dict]]:
    # No progress-frame assertion here: unlike the analyze pipeline (ingest.py) and
    # the batch-export route (clips/export.py's per-clip-in-a-batch marker), the
    # single-clip `python -m yuu_clip.cli export` subprocess never calls
    # emit_progress/prints an @@PROGRESS marker - render.py has no progress-marker
    # emission at all, for any combination of export options. Only log + done frames
    # are real for this endpoint; asserting a numeric progress frame here would be
    # asserting behavior the route doesn't have.
    clip_id = ctx.state["approved_clip_id"]
    frames = drain_sse(ctx, f"/api/clips/{clip_id}/export", EXPORT_DEADLINE_S)
    final = assert_outcome_ok(frames)

    files = ctx.client.get_json(f"/api/clips/{clip_id}/export-files")
    if not files.get("files"):
        raise AssertionError(f"clip {clip_id} has no export files after export")

    ctx.state["exported_clip_id"] = clip_id
    return f"outcome={final['outcome']} files={files['files']}", raw_frames(frames)


# --- step: build a highlight reel ------------------------------------------

def step_build_reel(ctx: SmokeContext) -> tuple[str, list[dict]]:
    start = ctx.client.post_json("/api/demo/start", {})
    if not start.get("clip_count", 0) > 0:
        raise AssertionError(f"demo/start reported clip_count={start.get('clip_count')!r}")

    frames = drain_sse(ctx, "/api/demo/events", DEMO_DEADLINE_S)
    assert_outcome_ok(frames)

    reels = ctx.client.get_json("/api/demo/list")
    if not reels:
        raise AssertionError("no reels found in /api/demo/list after building one")
    reel = reels[0]
    if reel["stale"] is not False:
        raise AssertionError(f"reel {reel['filename']} stale={reel['stale']!r}, expected exactly False")

    ctx.state["reel_filename"] = reel["filename"]
    return f"clip_count={start['clip_count']} reel={reel['filename']}", raw_frames(frames)


# --- step: reel goes stale on member re-export -----------------------------

def step_reel_staleness(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["exported_clip_id"]
    frames = drain_sse(ctx, f"/api/clips/{clip_id}/export", EXPORT_DEADLINE_S)
    assert_outcome_ok(frames)

    reels = ctx.client.get_json("/api/demo/list")
    reel = next((r for r in reels if r["filename"] == ctx.state["reel_filename"]), None)
    if reel is None:
        raise AssertionError(f"reel {ctx.state['reel_filename']} disappeared from /api/demo/list")
    if reel["stale"] is not True:
        raise AssertionError(f"reel {reel['filename']} stale={reel['stale']!r}, expected exactly True")

    return f"reel={reel['filename']} stale=True", raw_frames(frames)


# --- step: back up the project ---------------------------------------------

def _assert_backup_membership(archive_path: Path, source_basename: str) -> None:
    with zipfile.ZipFile(archive_path) as zf:
        names = zf.namelist()
    offenders = [n for n in names if n.startswith(FORBIDDEN_BACKUP_PREFIXES) or Path(n).name == source_basename]
    if offenders:
        raise AssertionError(f"backup zip carries forbidden members: {offenders}")


def step_backup(ctx: SmokeContext) -> tuple[str, list[dict]]:
    frames = drain_sse(ctx, "/api/backup/events", BACKUP_DEADLINE_S)
    assert_outcome_ok(frames)
    result = next((f for f in frames if f.get("kind") == "result"), None)
    if result is None:
        raise AssertionError("backup stream produced no result frame")

    token, filename = result["data"]["token"], result["data"]["filename"]
    status, body = ctx.client.get_bytes(f"/api/backup/download/{token}")
    if status != 200:
        raise AssertionError(f"backup download returned {status}")

    # "smoke-" prefixed and never the bare server filename: the server's own temp
    # copy lives at Path(tempfile.gettempdir()) / filename, and ctx.scratch_dir's
    # parent IS that same temp dir by default (--scratch-root defaults there too) -
    # writing under the identical name races the server's post-download cleanup.
    archive_path = ctx.scratch_dir.parent / f"smoke-{filename}"
    archive_path.write_bytes(body)
    _assert_backup_membership(archive_path, ctx.state["source_path"].name)

    ctx.state["backup_archive_path"] = archive_path
    return f"token={token} filename={filename} size={len(body)}", raw_frames(frames)


# --- step: restore into a second project -----------------------------------

def step_restore(ctx: SmokeContext) -> tuple[str, list[dict]]:
    archive_path = ctx.state["backup_archive_path"]
    quoted = urllib.parse.quote(str(archive_path))
    inspect = ctx.client.post_json(f"/api/restore/inspect?archive_path={quoted}")
    staging_path = inspect["staging_path"]

    original_clips = ctx.client.get_json(f"/api/videos/{ctx.state['video_id']}/clips")
    ctx.client.post_json("/api/restore/apply", {
        "archive_path": staging_path, "target_dir": str(ctx.restore_dir),
        "mapping": {}, "overwrite": True,
    })

    videos = ctx.client.get_json("/api/videos")
    restored_video = next((v for v in videos if v["filename"] == ctx.state["source_path"].name), None)
    if restored_video is None:
        raise AssertionError("restored project has no matching video row")
    restored_clips = ctx.client.get_json(f"/api/videos/{restored_video['id']}/clips")
    if len(restored_clips) != len(original_clips):
        raise AssertionError(f"restored clip count {len(restored_clips)} != original {len(original_clips)}")

    switch_back = ctx.client.post_json("/api/projects/switch", {"path": str(ctx.scratch_dir)})
    if switch_back["current"] != str(ctx.scratch_dir):
        raise AssertionError(f"failed to switch back to the scratch project: {switch_back['current']!r}")

    return f"restored {len(restored_clips)} clips into {ctx.restore_dir}", []


# --- step: source file guard (move-aside + ranged read) --------------------

def step_source_file_guard(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    source_path = ctx.state["source_path"]
    moved_path = source_path.with_name(f"{source_path.name}.moved-aside")

    source_path.rename(moved_path)
    try:
        videos = ctx.client.get_json("/api/videos")
        target = next(v for v in videos if v["id"] == video_id)
        if target["source_exists"] is not False:
            raise AssertionError(f"source_exists={target['source_exists']!r} while moved aside, expected False")
    finally:
        moved_path.rename(source_path)

    videos = ctx.client.get_json("/api/videos")
    target = next(v for v in videos if v["id"] == video_id)
    if target["source_exists"] is not True:
        raise AssertionError(f"source_exists={target['source_exists']!r} after moving back, expected True")

    status, body = ctx.client.get_bytes(f"/api/videos/{video_id}/source", range_header="bytes=0-1023")
    if status not in (200, 206):
        raise AssertionError(f"ranged source GET returned {status}, expected 200 or 206")
    if len(body) > 1024:
        raise AssertionError(f"ranged source GET returned {len(body)} bytes, expected <= 1024")

    return f"source_exists toggled correctly; ranged GET returned {len(body)} bytes", []


STEPS: tuple[StepSpec, ...] = (
    StepSpec(1, "Switch to scratch project", ("UC-A03",), step_switch_project),
    StepSpec(2, "Probe source recording", ("UC-B01",), step_probe_source),
    StepSpec(3, "Analyze the recording", ("UC-B01",), step_analyze),
    StepSpec(4, "Review clip list and detail", ("UC-B02", "UC-B04"), step_review_clips),
    StepSpec(5, "Approve and reject clips", ("UC-B03",), step_review_status),
    StepSpec(6, "Export a clip", ("UC-B05",), step_export_clip),
    StepSpec(7, "Build a highlight reel", ("UC-E03",), step_build_reel),
    StepSpec(8, "Reel goes stale on member re-export", ("UC-E03",), step_reel_staleness),
    StepSpec(9, "Back up the project", ("UC-G01",), step_backup),
    StepSpec(10, "Restore into a second project", ("UC-G01",), step_restore),
    StepSpec(11, "Source file guard: move-aside and ranged read", ("UC-G01", "UC-B05"), step_source_file_guard),
)
