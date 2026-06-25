"""
Application logging for rp-clipper.

Writes a rotating log to <project>/.rp-clipper/rp-clipper.log and maintains a
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

_LOG_FILENAME  = "rp-clipper.log"
_MAX_BYTES     = 5 * 1024 * 1024  # rotate at 5 MB
_BACKUP_COUNT  = 3
_BUFFER_LINES  = 2_000            # recent lines kept in memory

_memory_buffer: deque[str] = deque(maxlen=_BUFFER_LINES)

_FORMAT      = "%(asctime)s %(levelname)-8s %(name)s — %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class _MemoryLineHandler(logging.Handler):
    """Appends each formatted record to the module-level deque."""

    def emit(self, record: logging.LogRecord) -> None:
        _memory_buffer.append(self.format(record))


def configure_logging(project_dir: Path) -> None:
    """Wire up file and memory log handlers under the rp_clipper namespace.

    Safe to call multiple times — subsequent calls are no-ops so tests that
    call create_app() repeatedly don't accumulate duplicate handlers.
    """
    root = logging.getLogger("rp_clipper")
    if root.handlers:
        return

    root.setLevel(logging.DEBUG)
    fmt = logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT)

    log_path = project_dir / ".rp-clipper" / _LOG_FILENAME
    log_path.parent.mkdir(parents=True, exist_ok=True)

    file_h = logging.handlers.RotatingFileHandler(
        log_path, maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT, encoding="utf-8"
    )
    file_h.setFormatter(fmt)
    root.addHandler(file_h)

    mem_h = _MemoryLineHandler()
    mem_h.setFormatter(fmt)
    root.addHandler(mem_h)


def get_logger(name: str) -> logging.Logger:
    """Return a child logger scoped under rp_clipper.*."""
    if not name.startswith("rp_clipper"):
        name = f"rp_clipper.{name}"
    return logging.getLogger(name)


def recent_log_lines() -> list[str]:
    """Return all buffered log lines (oldest first) for in-memory export."""
    return list(_memory_buffer)


def log_path_for(project_dir: Path) -> Path:
    """Resolve the log file path for a given project directory."""
    return project_dir / ".rp-clipper" / _LOG_FILENAME
