# Feature-map - Notification sounds
#   UI: static/library/sounds.js (Settings → Notification sounds; playback state in localStorage)
#   Siblings: tests/integration/test_sounds.py, tests/ui/test_ui_sounds.py
"""
Notification sound routes.

Serves short audio cues the UI can play when a long-running action finishes
(analysis, re-score, reel build, export). Built-in options come from the
Windows system sound folder (%SystemRoot%\\Media); the user can also upload
their own audio file, which is stored under the project's data dir so the
choice survives a reload. All playback and enable/disable state lives on the
client (localStorage) - this router only lists and serves the audio bytes.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from yuu_clip.log import get_logger
from yuu_clip.web.deps import ProjectContext

_log = get_logger(__name__)

# Curated Windows system sounds offered as defaults. Only those actually present
# on this machine are returned, so the list degrades gracefully across editions.
_BUILTIN_CANDIDATES: tuple[tuple[str, str], ...] = (
    ("Windows Notify.wav",                 "Notify"),
    ("Windows Notify System Generic.wav",  "Notify (soft)"),
    ("Windows Ding.wav",                   "Ding"),
    ("Windows Default.wav",                "Default"),
    ("Windows Print complete.wav",         "Print complete"),
    ("Windows Message Nudge.wav",          "Nudge"),
    ("tada.wav",                           "Tada"),
    ("chimes.wav",                         "Chimes"),
    ("chord.wav",                          "Chord"),
    ("Windows Exclamation.wav",            "Exclamation"),
    ("Windows Error.wav",                  "Error"),
    ("Windows Critical Stop.wav",          "Critical Stop"),
)

_AUDIO_MEDIA_TYPES = {
    ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
    ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".aac": "audio/aac",
    ".flac": "audio/flac", ".opus": "audio/opus", ".webm": "audio/webm",
}

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _media_dir() -> Path:
    return Path(os.environ.get("SystemRoot", r"C:\Windows")) / "Media"


def _safe_name(name: str) -> str:
    # Only a bare filename is allowed - reject anything that could escape the dir.
    if not name or name in (".", "..") or "/" in name or "\\" in name:
        raise HTTPException(400, "Invalid file name")
    return name


def _custom_url(name: str) -> str:
    return f"/api/sounds/file?kind=custom&name={quote(name)}"


def _builtin_url(name: str) -> str:
    return f"/api/sounds/file?kind=builtin&name={quote(name)}"


def make_router(ctx: ProjectContext) -> APIRouter:
    router = APIRouter()

    # Derived per-request: switch_project() mutates ctx in place, so a value
    # captured at router-build time would keep pointing at the boot project.
    def _sounds_dir() -> Path:
        return ctx.data_dir / "sounds"

    @router.get("/api/sounds")
    def list_sounds():
        media = _media_dir()
        builtin = [
            {"name": filename, "label": label, "url": _builtin_url(filename)}
            for filename, label in _BUILTIN_CANDIDATES
            if (media / filename).exists()
        ]
        custom = []
        sounds_dir = _sounds_dir()
        if sounds_dir.exists():
            for entry in sorted(sounds_dir.iterdir()):
                if entry.is_file() and entry.suffix.lower() in _AUDIO_MEDIA_TYPES:
                    custom.append({"name": entry.name, "url": _custom_url(entry.name)})
        return {"builtin": builtin, "custom": custom}

    @router.get("/api/sounds/file")
    def get_sound(kind: str, name: str):
        safe = _safe_name(name)
        if kind == "builtin":
            path = _media_dir() / safe
        elif kind == "custom":
            path = _sounds_dir() / safe
        else:
            raise HTTPException(400, "Unknown sound kind")
        if not path.is_file():
            raise HTTPException(404, "Sound not found")
        media_type = _AUDIO_MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream")
        return FileResponse(str(path), media_type=media_type)

    # Raw-body upload (not multipart) so the server needs no python-multipart
    # dependency: the browser POSTs the File object directly as the request body.
    @router.post("/api/sounds/upload")
    async def upload_sound(name: str, request: Request):
        safe = _safe_name(name)
        if Path(safe).suffix.lower() not in _AUDIO_MEDIA_TYPES:
            raise HTTPException(400, f"Unsupported audio type '{Path(safe).suffix}'")
        body = await request.body()
        if not body:
            raise HTTPException(400, "Empty upload")
        if len(body) > _MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Sound file too large (max 25 MB)")
        sounds_dir = _sounds_dir()
        sounds_dir.mkdir(parents=True, exist_ok=True)
        (sounds_dir / safe).write_bytes(body)
        _log.info("Uploaded notification sound %r (%d bytes)", safe, len(body))
        return {"name": safe, "url": _custom_url(safe)}

    @router.delete("/api/sounds/custom")
    def delete_sound(name: str):
        safe = _safe_name(name)
        path = _sounds_dir() / safe
        if path.is_file():
            path.unlink()
            _log.info("Deleted notification sound %r", safe)
        return {"ok": True}

    return router
