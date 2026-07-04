"""
Application logging for yuu-clip.

Writes a rotating log to <project>/.yuu-clip/yuu-clip.log and maintains a
recent-line buffer in memory so the web UI can offer a one-click log download
without reading the file on every request.

Usage:
    configure_logging(project_dir)   # call once at server startup
    log = get_logger(__name__)
    log.info("Starting analysis for %s", filename)
"""
from __future__ import annotations

import logging
import logging.handlers
from collections import deque
from pathlib import Path

_LOG_FILENAME  = "yuu-clip.log"
_MAX_BYTES     = 5 * 1024 * 1024  # rotate at 5 MB
_BACKUP_COUNT  = 3
_BUFFER_LINES  = 2_000            # recent lines kept in memory

_memory_buffer: deque[str] = deque(maxlen=_BUFFER_LINES)

_FORMAT      = "%(asctime)s %(levelname)-8s %(name)s - %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class _MemoryLineHandler(logging.Handler):
    """Appends each formatted record to the module-level deque."""

    def emit(self, record: logging.LogRecord) -> None:
        _memory_buffer.append(self.format(record))


def _make_file_handler(project_dir: Path) -> logging.Handler:
    """Build a rotating file handler for *project_dir*'s log, creating the dir."""
    log_path = project_dir / ".yuu-clip" / _LOG_FILENAME
    log_path.parent.mkdir(parents=True, exist_ok=True)
    handler = logging.handlers.RotatingFileHandler(
        log_path, maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT))
    return handler


def configure_logging(project_dir: Path) -> None:
    """Wire up file and memory log handlers under the yuu_clip namespace.

    Safe to call multiple times — subsequent calls are no-ops so tests that
    call create_app() repeatedly don't accumulate duplicate handlers. To point
    an already-configured logger at a different project (the in-place project
    switch), use redirect_logging.
    """
    root = logging.getLogger("yuu_clip")
    if root.handlers:
        return

    root.setLevel(logging.DEBUG)
    root.addHandler(_make_file_handler(project_dir))

    mem_h = _MemoryLineHandler()
    mem_h.setFormatter(logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT))
    root.addHandler(mem_h)


def redirect_logging(project_dir: Path) -> None:
    """Point the file log at *project_dir* so log output follows the active
    project after an in-place switch.

    The new file handler is added before the old ones are removed and closed, so
    there is never a window with no file sink. The in-memory buffer handler is
    process-global (not per-project) and is left untouched.
    """
    root = logging.getLogger("yuu_clip")
    stale = [h for h in root.handlers if isinstance(h, logging.handlers.RotatingFileHandler)]
    root.addHandler(_make_file_handler(project_dir))
    for handler in stale:
        root.removeHandler(handler)
        handler.close()


def get_logger(name: str) -> logging.Logger:
    """Return a child logger scoped under yuu_clip.*."""
    if not name.startswith("yuu_clip"):
        name = f"yuu_clip.{name}"
    return logging.getLogger(name)


def recent_log_lines() -> list[str]:
    """Return all buffered log lines (oldest first) for in-memory export."""
    return list(_memory_buffer)


def log_path_for(project_dir: Path) -> Path:
    """Resolve the log file path for a given project directory."""
    return project_dir / ".yuu-clip" / _LOG_FILENAME
