"""
yuuclip  —  YuuClip — video session clip extraction CLI.

The Typer app and shared helpers live in ``_base``; each command group is a
submodule that registers its commands on the shared ``app`` at import time.
"""
from __future__ import annotations

# Importing these modules registers their @app.command() handlers on ``app``.
from yuu_clip.cli import analyze, export, import_url, reel, review, serve  # noqa: E402,F401
from yuu_clip.cli._base import _resolve_videos, app, console  # noqa: F401  (re-exported for the entry point and tests)
from yuu_clip.pipeline import AnalyzeOptions  # noqa: F401  (re-exported for back-compat)


def main():
    app()
