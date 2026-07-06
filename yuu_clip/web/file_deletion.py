# Feature-map — NOT a feature: the Windows file-lock deletion story.
#   Deleting a clip's backing files (exports, caption sidecars) can race the OS
#   still holding a handle open after a <video> stops streaming; these helpers
#   retry, and when a delete truly fails they name the process holding the lock.
"""Resilient file deletion with Windows file-lock diagnosis."""
from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Iterable

from fastapi import HTTPException

from yuu_clip.log import get_logger

_log = get_logger(__name__)


def unlink_with_retry(path: Path, attempts: int = 10, delay_s: float = 0.2) -> None:
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


def delete_files(paths: Iterable[Path]) -> list[Path]:
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
            unlink_with_retry(path)
        except OSError as exc:
            locked.append(path)
            _log.warning("Could not delete file %s: %s", path, exc)
    return locked


def locking_processes(path: Path) -> list[str]:
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


def locked_files_error(locked: list[Path]) -> HTTPException:
    """Build the 409 for files that could not be deleted, naming the holder if known."""
    holders: list[str] = []
    for path in locked:
        for name in locking_processes(path):
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
