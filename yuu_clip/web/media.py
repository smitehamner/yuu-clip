"""Serve media files with a share-delete handle so they can be deleted while open.

Starlette's StaticFiles/FileResponse opens files with a plain ``open()`` and holds
the handle for the full streaming response. A <video> element keeps that response
suspended (backpressure) for as long as it is loaded, so on Windows the export
file stays locked the entire time it is previewed and a delete fails with
WinError 32. Opening with FILE_SHARE_DELETE lets the OS remove the file even while
we are still streaming it, which is exactly what the delete-export flow needs.
"""
from __future__ import annotations

import os
import sys
from mimetypes import guess_type
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, Request
from starlette.responses import Response, StreamingResponse

_CHUNK = 1024 * 1024


def _share_delete_opener(path, flags):
    if sys.platform != "win32":
        return os.open(path, flags)

    import ctypes
    import msvcrt
    from ctypes import wintypes

    GENERIC_READ = 0x80000000
    FILE_SHARE_READ_WRITE_DELETE = 0x01 | 0x02 | 0x04
    OPEN_EXISTING = 3
    FILE_ATTRIBUTE_NORMAL = 0x80
    INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value

    create_file = ctypes.windll.kernel32.CreateFileW
    create_file.restype = wintypes.HANDLE
    create_file.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
    ]
    handle = create_file(
        str(path), GENERIC_READ, FILE_SHARE_READ_WRITE_DELETE, None,
        OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, None,
    )
    if not handle or handle == INVALID_HANDLE_VALUE:
        raise ctypes.WinError(ctypes.get_last_error())
    return msvcrt.open_osfhandle(handle, os.O_RDONLY)


def _open_shared(path: Path):
    return open(path, "rb", opener=_share_delete_opener)


def media_file_response(path: Path, request: Request, media_type: Optional[str] = None) -> Response:
    """Stream *path* with HTTP range support, opened so it can still be deleted."""
    if not path.is_file():
        raise HTTPException(404, "File not found")

    file_size = path.stat().st_size
    media_type = media_type or guess_type(path.name)[0] or "application/octet-stream"
    headers = {"accept-ranges": "bytes", "content-type": media_type}

    start, end, status = 0, file_size - 1, 200
    range_header = request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        first, _, last = range_header[len("bytes="):].partition("-")
        try:
            if first:
                start = int(first)
                end = int(last) if last else file_size - 1
            else:
                # RFC 7233 suffix form "bytes=-N": the LAST N bytes of the file.
                suffix_len = int(last)
                if suffix_len <= 0:
                    return Response(status_code=416, headers={"content-range": f"bytes */{file_size}"})
                start = max(0, file_size - suffix_len)
                end = file_size - 1
        except ValueError:
            raise HTTPException(416, "Invalid range header")
        if start > end or start >= file_size:
            return Response(status_code=416, headers={"content-range": f"bytes */{file_size}"})
        end = min(end, file_size - 1)
        status = 206
        headers["content-range"] = f"bytes {start}-{end}/{file_size}"

    length = end - start + 1
    headers["content-length"] = str(length)

    def _stream():
        remaining = length
        with _open_shared(path) as handle:
            handle.seek(start)
            while remaining > 0:
                chunk = handle.read(min(_CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(_stream(), status_code=status, headers=headers, media_type=media_type)


def resolve_within(base_dir: Path, filename: str) -> Path:
    """Resolve *filename* under *base_dir*, rejecting path traversal."""
    target = (base_dir / filename).resolve()
    base = base_dir.resolve()
    if base != target and base not in target.parents:
        raise HTTPException(404, "File not found")
    return target
