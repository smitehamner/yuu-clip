"""The ``yuu-dev`` developer-loop CLI (serve, test, lint, typecheck, logs, status, lock-deps).

The command modules register with the Typer ``app`` defined in ``_base``; importing
them here wires every subcommand onto ``app``, which the ``yuu-dev`` entry point exposes.
"""
from __future__ import annotations

from yuu_clip.dev import (  # noqa: E402,F401  (registers commands)
    bundle,
    deps,
    helpdocs,
    lint,
    logs,
    notices,
    serve,
    shareddata,
    status,
    testjs,
    tests,
    typecheck,
)
from yuu_clip.dev._base import app

__all__ = ["app"]
