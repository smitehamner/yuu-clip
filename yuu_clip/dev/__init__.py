"""The ``yuu-dev`` developer-loop CLI (serve, test, lint, logs, status).

Importable Python port of the daily-loop scripts/*.ps1. The command modules
register with the Typer ``app`` defined in ``_base``; importing them here wires
every subcommand onto ``app``, which the ``yuu-dev`` entry point exposes.
"""
from __future__ import annotations

from yuu_clip.dev import lint, logs, serve, status, tests  # noqa: E402,F401  (registers commands)
from yuu_clip.dev._base import app

__all__ = ["app"]
