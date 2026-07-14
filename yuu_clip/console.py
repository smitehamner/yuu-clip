"""Shared console output: the Rich console and the MB size unit.

Force UTF-8 on Windows stdout/stderr *before* creating the Console, so Rich
never falls back to the cp1252 legacy renderer (which crashes on characters
outside Latin-1). The pipeline/export engine prints progress to stdout that the
web UI streams over SSE, so both the CLI commands and the engine share this
console - it lives outside ``cli/`` so the engine never has to import ``cli``.
"""
from __future__ import annotations

import io
import sys

if sys.stdout and hasattr(sys.stdout, "buffer") and (sys.stdout.encoding or "").lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer") and (sys.stderr.encoding or "").lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from rich.console import Console

console = Console()

# Divisor for the "(X.X MB)" size annotations printed during extract and export.
BYTES_PER_MB: int = 1_048_576
