"""Section "housekeeping" - UC-G02, UC-G04, UC-G06, plus the five rows folded in
from plans/MANUAL-CHECKS.md that are API-reachable (plan Stage 2 route map).

Ordered least-disruptive first: the SRT re-import and cancel-audit steps mutate
or interrupt the analyzed video, so they run last and the cancel-audit step
deliberately does not restore ctx.state - nothing after it depends on that state.
"""
from __future__ import annotations

import re
import threading
import time
from typing import Optional

from yuu_clip.dev.smoke.media import DEFAULT_RECORDING_URL
from yuu_clip.dev.smoke.steps import (
    SmokeContext,
    StepSkip,
    StepSpec,
    assert_outcome_ok,
    done_frame,
    drain_sse,
    raw_frames,
)
from yuu_clip.dev.smoke.steps.core import ANALYZE_DEADLINE_S

PROXY_DEADLINE_S = 120.0
IMPORT_DEADLINE_S = 60.0
CANCEL_DEADLINE_S = ANALYZE_DEADLINE_S

_USERNAME_PATH_RE = re.compile(r"C:\\Users\\[^\\<]+\\|/home/[^/<]+/|/Users/[^/<]+/")


def step_download_log(ctx: SmokeContext) -> tuple[str, list[dict]]:
    status, body = ctx.client.get_bytes("/api/logs/export")
    if status != 200:
        raise AssertionError(f"logs/export returned {status}, expected 200")
    if not body:
        raise AssertionError("logs/export returned an empty log")
    text = body.decode("utf-8", errors="replace")
    if _USERNAME_PATH_RE.search(text):
        raise AssertionError("downloaded log still carries an unredacted username in a path")
    return f"log download: {len(body)} bytes, username-redacted", []


def step_update_check(ctx: SmokeContext) -> tuple[str, list[dict]]:
    resp = ctx.client.get_json("/api/updates/check")
    for key in ("current_version", "update_available"):
        if key not in resp:
            raise AssertionError(f"updates/check response missing {key!r}: {resp!r}")
    # Hits GitHub live with no offline override; a network failure degrades to a
    # populated `error` field rather than raising (update_check.py), so this step
    # tolerates being offline instead of requiring GitHub reachability.
    return f"update_available={resp.get('update_available')} error={resp.get('error')!r}", []


def step_loopback_guard(ctx: SmokeContext) -> tuple[str, list[dict]]:
    blocked = ctx.client.get_status("/api/videos", headers={"Sec-Fetch-Site": "cross-site"})
    if blocked != 403:
        raise AssertionError(f"a cross-site request got {blocked}, expected 403")

    normal = ctx.client.get_status("/api/videos")
    if normal != 200:
        raise AssertionError(f"a normal request (no Sec-Fetch-Site) got {normal}, expected 200")

    return "cross-site request rejected (403); a normal request still works (200)", []


def step_preview_generation(ctx: SmokeContext) -> tuple[str, list[dict]]:
    video_id = ctx.state["video_id"]
    frames = drain_sse(ctx, f"/api/videos/{video_id}/proxy/generate", PROXY_DEADLINE_S)
    assert_outcome_ok(frames)

    # No typed `progress` frame here: unlike ingest.py's @@PROGRESS-marker stages,
    # proxy/generate reports its ffmpeg -progress percentage only via throttled log
    # text ("Building 720p preview... N%"), never progress_event() - assert on that
    # text instead of a progress frame the route doesn't emit.
    percent_lines = [f for f in frames if f.get("kind") == "log" and re.search(r"\d+%", f.get("text", ""))]
    if not percent_lines:
        raise AssertionError("proxy/generate produced no log line carrying an encode percentage")

    return f"preview generated; {len(percent_lines)} percentage log line(s) observed", raw_frames(frames)


def step_cpu_only_estimate(ctx: SmokeContext) -> tuple[str, list[dict]]:
    resp = ctx.client.post_json("/api/estimate", {
        "duration_s": 95.0, "model": "large-v3", "audio_tracks": 1, "has_gpu": False,
    })
    if resp.get("transcribe_on_cpu") is not True:
        raise AssertionError(f"estimate with has_gpu=false did not report transcribe_on_cpu=true: {resp!r}")
    if not resp.get("steps"):
        raise AssertionError(f"estimate response has no 'steps': {resp!r}")

    return f"CPU estimate: total={resp.get('total_hms')} transcribe_on_cpu=True", []


def step_live_url_import(ctx: SmokeContext) -> tuple[str, list[dict]]:
    if not ctx.online:
        raise StepSkip("--online not passed - live URL import needs network access")

    frames = drain_sse(
        ctx, "/api/import-url/inspect", IMPORT_DEADLINE_S, method="POST", payload={"url": DEFAULT_RECORDING_URL}
    )
    assert_outcome_ok(frames)
    result = next((f for f in frames if f.get("kind") == "result"), None)
    if result is None or "already_imported" not in result.get("data", {}):
        raise AssertionError(f"import-url/inspect produced no usable result frame: {frames!r}")

    return f"import-url/inspect ok: already_imported={result['data']['already_imported']}", raw_frames(frames)


def step_srt_reimport_no_double_tag(ctx: SmokeContext) -> tuple[str, list[dict]]:
    clip_id = ctx.state["approved_clip_id"]
    files = ctx.client.get_json(f"/api/clips/{clip_id}/export-files")
    srt_files = [f for f in files.get("files", []) if f.endswith(".srt")]
    if not srt_files:
        raise StepSkip("no exported SRT sidecar available to re-import")
    srt_path = ctx.scratch_dir / ".yuu-clip" / "exports" / srt_files[0]

    ctx.client.post_json("/api/analyze/start", {
        "path": str(ctx.state["source_path"]), "force": True,
        "subtitle_source": str(srt_path), "diarize": True,
    })
    frames = drain_sse(ctx, "/api/analyze/events", ANALYZE_DEADLINE_S)
    assert_outcome_ok(frames)

    video_id = ctx.state["video_id"]
    clips = ctx.client.get_json(f"/api/videos/{video_id}/clips")
    doubled = [
        c["id"] for c in clips
        if re.search(r"\[[^\]]+\]\s*\[[^\]]+\]", ctx.client.get_json(f"/api/clips/{c['id']}").get("transcript_excerpt") or "")
    ]
    if doubled:
        raise AssertionError(f"clips with a doubled [Speaker N] tag after SRT re-import: {doubled}")

    return f"re-analyzed with SRT re-import; no doubled speaker tags across {len(clips)} clips", raw_frames(frames)


def step_cancel_audit(ctx: SmokeContext) -> tuple[str, list[dict]]:
    """Start a real analyze job, cancel it mid-run, and confirm the terminal SSE
    frame is outcome=="cancelled" - never "ok". This is the last step in the whole
    run by design: it interrupts the video's analysis, so nothing after it may
    depend on ctx.state being valid."""
    ctx.client.post_json("/api/analyze/start", {"path": str(ctx.state["source_path"]), "force": True, "no_score": True})

    frames_holder: list[list[dict]] = [[]]
    error_holder: list[Optional[BaseException]] = [None]

    def _drain() -> None:
        try:
            frames_holder[0] = drain_sse(ctx, "/api/analyze/events", CANCEL_DEADLINE_S)
        except BaseException as exc:  # noqa: BLE001 - surfaced on the main thread below
            error_holder[0] = exc

    thread = threading.Thread(target=_drain, daemon=True)
    thread.start()
    time.sleep(2.0)  # let the subprocess actually launch before cancelling it
    ctx.client.post_json("/api/analyze/cancel")
    thread.join(timeout=CANCEL_DEADLINE_S)

    if error_holder[0] is not None:
        raise error_holder[0]
    final = done_frame(frames_holder[0])
    if final is None:
        raise AssertionError("cancelled analyze produced no 'done' frame")
    if final["outcome"] != "cancelled":
        raise AssertionError(f"cancelled analyze reported outcome={final['outcome']!r}, expected 'cancelled'")

    return f"analyze started then cancelled mid-run; terminal outcome={final['outcome']!r}", raw_frames(frames_holder[0])


STEPS: tuple[StepSpec, ...] = (
    StepSpec(0, "Download log (redacted)", ("UC-G02",), step_download_log),
    StepSpec(0, "Check for updates", ("UC-G04",), step_update_check),
    StepSpec(0, "Loopback-only guard", ("UC-G06",), step_loopback_guard),
    StepSpec(0, "Preview-generation shows an encode percentage", (), step_preview_generation),
    StepSpec(0, "CPU-only estimate reads correctly", (), step_cpu_only_estimate),
    StepSpec(0, "Live URL import (--online)", (), step_live_url_import),
    StepSpec(0, "SRT re-import does not double-tag speakers", (), step_srt_reimport_no_double_tag),
    StepSpec(0, "Cancel audit: no false success", (), step_cancel_audit),
)
