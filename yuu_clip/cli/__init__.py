"""
yuuclip  —  YuuClip — video session clip extraction CLI.

The Typer app and shared helpers live in ``_base``; each command group is a
submodule that registers its commands on the shared ``app`` at import time.
"""
from __future__ import annotations

from yuu_clip.cli._base import (  # noqa: F401  (re-exported for the entry point and tests)
    AnalyzeOptions,
    _resolve_videos,
    app,
    console,
)

# Importing these modules registers their @app.command() handlers on ``app``.
from yuu_clip.cli import analyze, export, reel, review, serve  # noqa: E402,F401


def main():
    app()
