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
import re
from collections import deque
from pathlib import Path

# Redact the username segment from home-directory paths so logs a user sends us
# don't leak their Windows/macOS/Linux account name. The segment after
# \Users\ , /Users/ , or /home/ is the account name; everything after it (the
# actual app subpaths) stays intact so the log is still diagnosable.
_HOME_USER_PATTERNS = (
    re.compile(r"([A-Za-z]:[\\/]Users[\\/])([^\\/\s\"'<>|)]+)", re.IGNORECASE),
    re.compile(r"(/(?:home|Users)/)([^/\s\"'<>|)]+)"),
)


def redact_paths(text: str) -> str:
    """Replace the account-name segment of any home path with ``<user>``."""
    for pattern in _HOME_USER_PATTERNS:
        text = pattern.sub(r"\1<user>", text)
    return text


# Defense-in-depth sink-side net for the two live secrets the app holds (the
# Anthropic API key and the Hugging Face token) plus generic bearer/query-string
# credentials. No call site logs a secret today, but the log is one users are
# invited to send us for support, so a future call site - or a third-party lib
# that logs an auth header or a signed URL - should not leak verbatim. Patterns
# require enough length to avoid redacting ordinary prose (e.g. the ``hf_cache``
# module name); this is not generic entropy detection, just known shapes.
# The authorization rule runs before the bearer rule and absorbs an optional
# "Bearer " scheme, so "Authorization: Bearer <tok>" collapses to one <redacted>
# rather than being matched twice.
_SECRET_PATTERNS = (
    (re.compile(r"sk-ant-[A-Za-z0-9_-]{12,}"), "<redacted>"),
    (re.compile(r"\bhf_[A-Za-z0-9]{20,}"), "<redacted>"),
    (re.compile(r"(?i)\b(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+"), r"\1<redacted>"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}"), "Bearer <redacted>"),
    (re.compile(r"(?i)([?&](?:token|key|api_key|access_token|password)=)[^&\s]+"), r"\1<redacted>"),
)


def redact_secrets(text: str) -> str:
    """Mask known credential shapes (API keys, tokens, bearer/query secrets)."""
    for pattern, replacement in _SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact(text: str) -> str:
    """Apply both the home-path and secret redactions to a log line."""
    return redact_secrets(redact_paths(text))


class _SanitizingFormatter(logging.Formatter):
    """Formats a record, then strips usernames and secrets from the final line
    (including tracebacks) before it reaches any sink."""

    def format(self, record: logging.LogRecord) -> str:
        return redact(super().format(record))


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
    handler.setFormatter(_SanitizingFormatter(_FORMAT, datefmt=_DATE_FORMAT))
    return handler


def configure_logging(project_dir: Path) -> None:
    """Wire up file and memory log handlers under the yuu_clip namespace.

    Safe to call multiple times - subsequent calls are no-ops so tests that
    call create_app() repeatedly don't accumulate duplicate handlers. To point
    an already-configured logger at a different project (the in-place project
    switch), use redirect_logging.
    """
    root = logging.getLogger("yuu_clip")
    if root.handlers:
        return

    # Don't propagate to the real root logger: redaction lives in our two
    # handlers' formatters, so a record reaching a foreign root handler
    # (uvicorn/basicConfig) would be emitted un-redacted. We own both sinks here.
    root.propagate = False
    root.setLevel(logging.DEBUG)
    root.addHandler(_make_file_handler(project_dir))

    mem_h = _MemoryLineHandler()
    mem_h.setFormatter(_SanitizingFormatter(_FORMAT, datefmt=_DATE_FORMAT))
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
