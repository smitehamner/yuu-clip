# Review map - the codebase in review-sized sections

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` to make that explicit. Humans
> do not need to read or maintain this; it is navigation scaffolding for automated
> review passes.

A stage-by-stage partition of the code so a dedicated review can walk it one
cohesive section at a time, the same way the web UI is already sectioned for
review. Each stage is a self-contained concern with its own files and tests;
review one, tick it off, move on.

## What is already sectioned (the web / UI layer)

The browser-facing layer does not need a stage here - it carries its own
in-source review map:

- **`web/static/index.html`** opens with a `PAGE TABLE OF CONTENTS` banner and
  per-region `<!-- ==== -->` banners marking each major UI region (header,
  settings, sidebar, main panel, panel-nav, modals). Review the page region by
  region from that banner.
- **Every `web/routes/*.py` and `web/static/*.js`** starts with a 3-line
  `Feature-map` header mapping the file to its UI, sibling files, and tests
  (e.g. `web/routes/videos.py:1`). Review a feature by following one header.

So the stages below cover **the rest of the code** - the engine, data, and
tooling modules that have no such per-file map yet. Stages are ordered along the
analyze -> score -> segment -> export data flow, then the supporting layers.

---

## Stage 1 - Analyze pipeline orchestration

The per-video engine that drives every other stage in order.

- `pipeline/ingest.py` - per-video orchestration + stage sequencing (the
  import-order pitfall for SpeechBrain vs transformers lives here)
- `pipeline/run_meta.py` - per-run timing / settings capture

Tests: `tests/integration/test_videos.py`, `test_run_meta.py`, `test_reattach.py`

---

## Stage 2 - Media inspection & extraction (`analyze/`)

Everything that reads the raw video/audio before scoring. Several pieces are
optional/lazy-imported feature gates - review each for its "package absent" path.

- `analyze/probe.py` - inspect (ffprobe) the source
- `analyze/extract.py` - audio extraction
- `analyze/labeler.py` - track role labeling (never interactive from the web -
  `--no-interact` path)
- `analyze/overlap.py` - track overlap detection
- `analyze/proxy.py` - preview proxy generation
- `analyze/frames.py` - frame sampling
- `analyze/motion.py` - model-free frame-diff visual-activity pass (Visual axis)
- `analyze/framing.py` - vertical (9:16) auto-crop via MediaPipe (optional dep)
- `analyze/pause.py` - cross-process pause/resume flag file for the batch loop
- `analyze/thermal.py` - GPU thermal monitor / auto-pause

Tests: `tests/unit/test_frames.py`, `test_framing.py`, `test_proxy.py`,
`test_thermal.py`, `tests/integration/test_pause.py`, `tests/unit/test_run_ffmpeg.py`

---

## Stage 3 - Transcription & diarization (`transcribe/` + captions)

- `transcribe/whisper_runner.py` - Whisper transcription
- `transcribe/diarization_client.py` - speaker diarization (SpeechBrain)
- `transcribe/align.py` - forced word alignment (WAV2VEC2) for word-highlight captions
- `transcribe/project_voice.py` - project-wide voice identity ("People")
- `subtitles.py` - SRT / caption generation

Tests: `tests/unit/test_whisper_runner.py`, `test_whisper_fallback.py`,
`test_align.py`, `test_subtitles.py`, `tests/integration/test_whisper_prefetch.py`,
`test_captions.py`, `test_transcript_edit.py`

---

## Stage 4 - Scoring (`scoring/`)

The largest area - review in three sub-passes.

### 4a - Signal scorers (zero/low dependency)
- `scoring/energy.py`, `prosody.py`, `speechrate.py`, `churn.py` - audio/delivery signals
- `scoring/lexicon.py`, `textmatch.py` - keyword / hot-word / sensitive-term matching
- `scoring/laugh.py`, `audio_event.py` - laughter / audio-event detection (optional deps)
- `scoring/scenes.py` - scene-cut counting
- `scoring/visual.py` - VisualActivityScorer feeding the Visual axis
- `scoring/wav_access.py` - shared WAV access helper
- `scoring/protocol.py` - Scorer protocol + ScoreResult dataclass

### 4b - LLM scoring
- `scoring/llm.py` - the LLM scorer
- `scoring/llm_client.py` - client factory + NullLLMClient (local llamacpp backend; AI-privacy-mode gate lives here)
- `scoring/llamacpp_server.py` - bundled Vulkan llama-server pool (gpu-layers auto-fit)
- `scoring/describe_basic.py` - template one-liner fallback when no LLM

### 4c - Aggregation & post-scoring
- `scoring/engine.py` - combines scorer results into overall (Visual axis / 3.5 denom)
- `scoring/dedup.py` - duplicate-clip detection
- `scoring/similarity.py` - embedding similarity (bge-small)
- `scoring/term_scope.py` - context-scoped term filtering

Tests: `tests/unit/test_scoring_*.py`, `test_scoring_llm.py`, `test_llamacpp_server.py`,
`test_dedup.py`, `test_similarity.py`, `test_term_scope.py`, `test_describe_basic.py`,
`test_privacy_modes.py`, `test_preflight_llm.py`, `tests/integration/test_llm.py`,
`test_vision.py`, `test_scoring_routes.py`, `test_dedup_route.py`

---

## Stage 5 - Clip generation (`segments/`)

- `segments/windower.py` - sliding-window clip generation
- `segments/visual_windower.py` - visual-activity-driven candidate windows
- `segments/scene_segmenter.py` - scene-boundary segmentation
- `segments/merge.py` - candidate merging

Tests: `tests/integration/test_segments.py`, `test_clip_create.py`

---

## Stage 6 - Export & highlight reel (`export/`, `reel.py`)

- `export/render.py` - render engine (cut, retranscribe, title card, captions)
- `export/naming.py` - filename stem
- `export/presets.py` - preset definitions + size-cap math
- `export/paths.py` - on-disk export/sidecar path resolution + query validation
- `reel.py` - highlight-reel assembly

Tests: `tests/integration/test_export.py`, `test_reel.py`, `tests/unit/test_export_naming.py`,
`test_title_card.py`

---

## Stage 7 - Data model, config & catalogs

- `db/models.py` - SQLAlchemy ORM (SQLite, NullPool; `latest_track_transcript` helper)
- `config.py` - config + profile (track-layout) management, `resolve_ai_permissions`
- `model_catalog.py` - authoritative model list + licence policy
- `contexts.py` - world-context storage + prompt formatting
- `content_presets.py` - content-type preset bundles
- `sessions.py` - session auto-grouping (pure logic)

Tests: `tests/integration/test_config.py`, `test_content_presets.py`,
`test_profiles_contexts.py`, `tests/unit/test_model_catalog.py`, `test_sessions.py`

---

## Stage 8 - CLI (`cli/`)

Thin Typer adapters over the pipeline/export layers.

- `cli/analyze.py`, `export.py`, `reel.py`, `review.py`, `serve.py`, `models.py`,
  `restore.py`, `import_url.py`, `_base.py`

Tests: `tests/integration/test_cli.py`

---

## Stage 9 - Dev-loop CLI (`dev/`)

The `yuu-dev` developer tooling (not shipped to users).

- `dev/serve.py`, `tests.py`, `lint.py`, `logs.py`, `status.py`, `procs.py`,
  `_summary.py`, `_base.py`

Tests: `tests/unit/test_dev_cli.py`, `test_dev_summary.py`

---

## Stage 10 - Web plumbing (non-route)

The server scaffolding beneath the already-mapped routes.

- `web/app.py` - FastAPI factory + lifespan (graceful shutdown)
- `web/deps.py` - `ProjectContext` shared state
- `web/sse.py` - subprocess -> SSE streaming
- `web/analyze_job.py` - in-process analyze-job tracking (`AnalyzeJob`)
- `web/media.py` - video/media streaming helpers
- `web/file_deletion.py` - resilient deletion + Windows file-lock diagnosis

Tests: `tests/ui/test_ui_sse.py`, `tests/unit/test_route_db_hygiene.py`

---

## Stage 11 - Cross-cutting utilities

- `log.py` - logging setup + secret redaction
- `console.py` - shared Rich console + `BYTES_PER_MB`
- `hf_cache.py` - network-free "model already downloaded?" check
- `url_import.py` - Twitch/YouTube import (yt-dlp wrapper)
- `project_archive.py` - backup / restore + path re-point engine

Tests: `tests/unit/test_log_redact.py`, `test_hf_cache.py`, `test_url_import.py`,
`tests/integration/test_url_import_routes.py`, `test_backup.py`, `test_restore.py`

---

## Guard / meta tests (not a stage - policy enforcement)

These assert repo invariants rather than a feature; check them when a review
touches the thing they guard:

- `tests/unit/test_no_emdash.py` - ASCII-copy rule
- `tests/unit/test_ps1_bom.py` - PowerShell BOM encoding
- `tests/unit/test_route_db_hygiene.py` - `db.close()` in every route
- `tests/unit/test_no_integration_imports.py` - unit tier stays pure
- `tests/unit/test_ffmpeg_licensing.py` - bundled-FFmpeg licence guard
- `tests/unit/test_model_catalog.py` - catalog licence policy + defaults match
- `tests/unit/test_check_wheel_deps.py` - packaged-wheel dependency check
