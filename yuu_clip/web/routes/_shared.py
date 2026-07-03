"""Cross-cutting helpers shared by two or more route modules."""
from __future__ import annotations

import json as json_lib
import re
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterable, Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.export_naming import DEFAULT_EXPORT_NAME_TEMPLATE, candidate_export_paths, export_base_stem
from yuu_clip.log import get_logger

_log = get_logger(__name__)

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _unlink_with_retry(path: Path, attempts: int = 10, delay_s: float = 0.2) -> None:
    """Delete *path*, retrying briefly on OSError.

    A media stream that just closed can leave the OS file handle open for a short
    window after the browser drops its connection to the StaticFiles mount — on
    Windows the server process itself keeps the export file open while a <video>
    is still streaming it. Retrying absorbs that window so a delete right after
    closing the preview succeeds instead of failing with WinError 32.
    """
    for attempt in range(attempts):
        try:
            path.unlink()
            return
        except FileNotFoundError:
            return
        except OSError:
            if attempt == attempts - 1:
                raise
            time.sleep(delay_s)


def _delete_files(paths: Iterable[Path]) -> list[Path]:
    """Delete each existing path with retry; return the paths that stayed locked.

    Used by every delete that removes a clip's backing files (export, sidecars)
    so a file still held open by the in-page player is retried rather than failing
    on the first attempt.
    """
    locked: list[Path] = []
    for path in paths:
        if not path.exists():
            continue
        try:
            _unlink_with_retry(path)
        except OSError as exc:
            locked.append(path)
            _log.warning("Could not delete file %s: %s", path, exc)
    return locked


def _locking_processes(path: Path) -> list[str]:
    """Best-effort names of processes holding *path* open. Windows only; [] elsewhere.

    Uses the Restart Manager API — the same mechanism Explorer's "file is open in
    <app>" dialog relies on — so the error can name the real culprit (e.g. a backup
    agent) instead of guessing. Any failure falls back to an empty list.
    """
    if sys.platform != "win32":
        return []
    try:
        return _rm_locking_processes(path)
    except Exception:  # ctypes/RM is best-effort diagnostics, never fatal
        return []


def _rm_locking_processes(path: Path) -> list[str]:
    import ctypes
    from ctypes import wintypes

    rstrtmgr = ctypes.WinDLL("rstrtmgr")
    CCH_RM_SESSION_KEY = 32
    CCH_RM_MAX_APP_NAME = 255
    CCH_RM_MAX_SVC_NAME = 63

    class RM_UNIQUE_PROCESS(ctypes.Structure):
        _fields_ = [("dwProcessId", wintypes.DWORD),
                    ("ProcessStartTime", wintypes.FILETIME)]

    class RM_PROCESS_INFO(ctypes.Structure):
        _fields_ = [
            ("Process", RM_UNIQUE_PROCESS),
            ("strAppName", wintypes.WCHAR * (CCH_RM_MAX_APP_NAME + 1)),
            ("strServiceShortName", wintypes.WCHAR * (CCH_RM_MAX_SVC_NAME + 1)),
            ("ApplicationType", ctypes.c_int),
            ("AppStatus", wintypes.ULONG),
            ("TSSessionId", wintypes.DWORD),
            ("bRestartable", wintypes.BOOL),
        ]

    session = wintypes.DWORD()
    session_key = (wintypes.WCHAR * (CCH_RM_SESSION_KEY + 1))()
    if rstrtmgr.RmStartSession(ctypes.byref(session), 0, session_key) != 0:
        return []
    try:
        resources = (wintypes.LPCWSTR * 1)(str(path))
        if rstrtmgr.RmRegisterResources(session, 1, resources, 0, None, 0, None) != 0:
            return []
        needed = wintypes.UINT(0)
        have = wintypes.UINT(0)
        reasons = wintypes.DWORD(0)
        rstrtmgr.RmGetList(session, ctypes.byref(needed), ctypes.byref(have), None, ctypes.byref(reasons))
        if needed.value == 0:
            return []
        infos = (RM_PROCESS_INFO * needed.value)()
        have = wintypes.UINT(needed.value)
        if rstrtmgr.RmGetList(session, ctypes.byref(needed), ctypes.byref(have), infos, ctypes.byref(reasons)) != 0:
            return []
        names: list[str] = []
        for i in range(have.value):
            name = infos[i].strAppName or f"PID {infos[i].Process.dwProcessId}"
            if name not in names:
                names.append(name)
        return names
    finally:
        rstrtmgr.RmEndSession(session)


def _locked_files_error(locked: list[Path]) -> HTTPException:
    """Build the 409 for files that could not be deleted, naming the holder if known."""
    holders: list[str] = []
    for path in locked:
        for name in _locking_processes(path):
            if name not in holders:
                holders.append(name)
    count = len(locked)
    if holders:
        detail = (f"Could not delete {count} file(s) — open in: {', '.join(holders)}. "
                  f"Close it and try again.")
    else:
        detail = (f"Could not delete {count} file(s) — they may still be open in the video "
                  f"player or another program. Close it and try again.")
    return HTTPException(409, detail)


def _analyze_in_flight(ctx) -> bool:
    """Whether an analyze operation is currently running, across both the
    reattachable AnalyzeJob (ctx.analyze_job) and the legacy bare-subprocess
    tracking (ctx.analyze_proc)."""
    job = ctx.analyze_job
    if job is not None and not job.done:
        return True
    proc = ctx.analyze_proc
    return proc is not None and proc.returncode is None


def _reject_if_analyzing(ctx) -> None:
    """Guard heavy DB-writing jobs (score/rescore/redescribe/rediarize) from
    running while an analysis is in flight — two writers on the same SQLite file
    would contend on the single-writer lock and stall each other."""
    if _analyze_in_flight(ctx):
        raise HTTPException(
            409,
            "An analysis is still running — wait for it to finish or cancel it "
            "before starting another job.",
        )


@asynccontextmanager
async def _active_job(ctx):
    ctx.active_jobs += 1
    try:
        yield
    finally:
        ctx.active_jobs -= 1


def _sse_response(generator) -> StreamingResponse:
    return StreamingResponse(generator, media_type="text/event-stream", headers=_SSE_HEADERS)


def _srt_to_vtt(srt: str) -> str:
    """Convert SRT text to WebVTT (comma→dot in timestamps, WEBVTT header) for
    <track> use in the browser."""
    return "WEBVTT\n\n" + re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)


def _json_list(s: Optional[str]) -> list:
    """Decode a JSON-encoded list column, returning [] for NULL/missing values."""
    return json_lib.loads(s) if s else []


def _require_clip(db, clip_id: int) -> ClipCandidate:
    clip = db.get(ClipCandidate, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


def _missing_ids(requested: Iterable[int], found_ids: set[int]) -> list[int]:
    """Requested IDs not present in *found_ids*, in the caller's original order."""
    return [cid for cid in requested if cid not in found_ids]


def _clip_stem(clip: ClipCandidate, video: Video, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE) -> str:
    return export_base_stem(clip, name_template, video_filename=video.filename)


def _export_paths(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> list[Path]:
    """All candidate export file paths for a clip's *default* (presetless) export."""
    stem = _clip_stem(clip, video, name_template)
    return candidate_export_paths(export_dir, stem)


def _srt_path(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> Optional[Path]:
    p = export_dir / f"{_clip_stem(clip, video, name_template)}.srt"
    return p if p.exists() else None


def _srt_sidecar_paths(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> list[Path]:
    """Existing SRT sidecars for a clip: per-label ({stem}.player_voice.srt) plus
    the merged {stem}.srt. Video files are excluded — this is captions only."""
    stem = _clip_stem(clip, video, name_template)
    files = list(export_dir.glob(f"{stem}.*.srt"))
    merged = export_dir / f"{stem}.srt"
    if merged.exists():
        files.append(merged)
    return files


def _clip_export_row_files(clip: ClipCandidate) -> list[Path]:
    """Existing on-disk files referenced by this clip's clip_exports rows (every
    tracked Export preset format) — the per-format counterpart to _export_paths'
    single-file, glob-based "default" lookup."""
    return [p for p in (Path(row.path) for row in clip.exports) if p.exists()]


def _all_sidecar_paths(
    clip: ClipCandidate, video: Video, export_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE,
) -> list[Path]:
    """All on-disk sidecar paths for a clip: video exports + all SRT sidecars.

    Includes per-label sidecars (e.g. {stem}.player_voice.srt) produced by
    export_srt_sidecars when multiple audio tracks are transcribed.
    """
    stem = _clip_stem(clip, video, name_template)
    srt_files = list(export_dir.glob(f"{stem}.*.srt"))
    merged_srt = export_dir / f"{stem}.srt"
    if merged_srt.exists():
        srt_files.append(merged_srt)
    return [*_export_paths(clip, video, export_dir, name_template), *srt_files]
