"""The per-video analysis engine (ingest pipeline).

This is where analysis actually happens. The web UI runs it out-of-process via
``python -m yuu_clip.cli analyze``; ``cli/analyze.py`` is a thin adapter that
parses options into an :class:`AnalyzeOptions` and calls :func:`analyze_one`.

The names below are this package's public cross-layer API - the entry points the
CLI (and, via the CLI subprocess, the web routes) call. They are the supported
surface; import them from ``yuu_clip.pipeline``, not from ``pipeline.ingest``
(whose ``_``-prefixed originals are module-internal and may be reordered).

- ``ingest`` - orchestration (:func:`analyze_one`) and every pipeline stage.
- ``run_meta`` - per-run timing/settings/device capture stored on the Video row.
"""
from __future__ import annotations

from yuu_clip.pipeline import ingest as _ingest

# Public cross-layer entry points aliased to their module-internal originals: the
# `_`-prefix in ingest marks them internal, but they are the CLI's supported API,
# so expose stable public names here rather than reaching past the underscore.
AnalyzeOptions = _ingest.AnalyzeOptions
analyze_one = _ingest._analyze_one
rediarize_video = _ingest._rediarize_video
reextract_video = _ingest._reextract_video
regenerate_clips = _ingest._regenerate_clips
retranscribe_video = _ingest._retranscribe_video
run_scoring = _ingest._run_scoring

__all__ = [
    "AnalyzeOptions",
    "analyze_one",
    "rediarize_video",
    "reextract_video",
    "regenerate_clips",
    "retranscribe_video",
    "run_scoring",
]
