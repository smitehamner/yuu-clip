"""Killable subprocess for single-clip vision frame analysis.

The web route (routes/clips/edit.py) ensures the vision llama-server is warm,
hands its base URL here, and launches this module as a subprocess via
``web.sse.subprocess_sse``. Running the vision call out-of-process is what makes
image analysis cancelable: killing the process tree drops the HTTP connection, so
llama-server aborts generation mid-inference. The web server keeps the model warm
(this only POSTs to it), so repeated runs do not pay a cold model load.

Progress is emitted as ``@@PROGRESS`` markers (pipeline/progress.py) plus, on a
handled failure, a bracketed status line the browser surfaces as a toast. stdout is
streamed line-by-line to the browser by subprocess_sse, which translates each line
into a typed job event and appends the terminal ``done`` event itself.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from yuu_clip.config import Config, project_db_path
from yuu_clip.db.models import ClipCandidate, Video, make_session
from yuu_clip.log import configure_logging, get_logger
from yuu_clip.pipeline.progress import Stage, format_progress

_log = get_logger(__name__)


def _emit(text: str) -> None:
    print(text, flush=True)


def _context_names(video: Video) -> list[str]:
    try:
        names = json.loads(video.context_names_json or "[]")
    except (TypeError, ValueError):
        return []
    return names if isinstance(names, list) else []


def _store_summary(project_dir: Path, clip_id: int, summary: str) -> None:
    session = make_session(project_db_path(project_dir))
    try:
        stored = session.get(ClipCandidate, clip_id)
        if stored:  # the clip may have been deleted while the vision call ran
            stored.vision_summary = summary
            stored.vision_analyzed_at = datetime.now(timezone.utc)
            session.commit()
    finally:
        session.close()


def run_frame_analysis(clip_id: int, project_dir: Path, base_url: str) -> int:
    """Sample the clip's frames, describe them via the warm server at *base_url*, and
    store the summary. Returns a process exit code (0 on success or a handled failure
    it has already reported as a bracketed line; nonzero only on an unexpected crash)."""
    from yuu_clip.analyze.frames import (
        clamp_frame_count,
        resolve_frame_window,
        sample_clip_frames,
    )
    from yuu_clip.contexts import format_context_block, load_contexts
    from yuu_clip.scoring.llm import describe_frames_via_server

    config = Config.load(project_dir)
    session = make_session(project_db_path(project_dir))
    try:
        clip = session.get(ClipCandidate, clip_id)
        if not clip:
            _emit("[Clip not found]")
            return 0
        video = session.get(Video, clip.video_id)
        if not video or not Path(video.path).exists():
            _emit("[Source video file not found on disk]")
            return 0
        encode_src, start_s, end_s = resolve_frame_window(
            video, clip, project_dir / ".yuu-clip" / "proxies"
        )
        frame_count = clamp_frame_count(config)
        context_names = _context_names(video)
    finally:
        session.close()

    context_text = format_context_block(load_contexts(project_dir), context_names)
    started = time.monotonic()
    _emit(format_progress(Stage.FRAMES_SAMPLE, done=0, total=frame_count))
    with tempfile.TemporaryDirectory() as tmp_dir:
        frames = sample_clip_frames(encode_src, start_s, end_s, frame_count, Path(tmp_dir))
        if not frames:
            _emit("[Error: could not sample any frames from the clip window]")
            return 0
        _emit(format_progress(Stage.FRAMES_SAMPLE, done=len(frames), total=frame_count))
        _emit(format_progress(Stage.FRAMES_DESCRIBE))
        try:
            summary = describe_frames_via_server(frames, context_text, base_url)
        except Exception as exc:
            _log.error("Frame analysis failed for clip %d: %s", clip_id, exc, exc_info=True)
            _emit("[Image analysis failed - see the log for details]")
            return 0

    if not summary:
        _emit("[The vision model returned an empty description - try again]")
        return 0

    _store_summary(project_dir, clip_id, summary)
    elapsed_s = round(time.monotonic() - started, 1)
    _log.info("Analyzed %d frame(s) for clip %d in %.1fs", len(frames), clip_id, elapsed_s)
    _emit(f"Analyzed {len(frames)} frame(s) in {elapsed_s}s")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Analyze a clip's frames with the vision model.")
    parser.add_argument("--clip-id", type=int, required=True)
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--base-url", required=True, help="Base URL of the warm vision llama-server")
    args = parser.parse_args(argv)
    configure_logging(args.project)
    return run_frame_analysis(args.clip_id, args.project, args.base_url)


if __name__ == "__main__":
    sys.exit(main())
