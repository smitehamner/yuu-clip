"""The per-video analysis engine (ingest pipeline).

This is where analysis actually happens. The web UI runs it out-of-process via
``python -m yuu_clip.cli analyze``; ``cli/analyze.py`` is a thin adapter that
parses options into an :class:`AnalyzeOptions` and calls :func:`_analyze_one`.

- ``ingest`` - orchestration (:func:`_analyze_one`) and every pipeline stage.
- ``run_meta`` - per-run timing/settings/device capture stored on the Video row.
"""
from __future__ import annotations

from yuu_clip.pipeline.ingest import (  # noqa: F401  (re-exported entry points)
    AnalyzeOptions,
    _analyze_one,
    _rediarize_video,
    _run_scoring,
)
