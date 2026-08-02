# YuuClip - project layout (the file-by-file map)

The authoritative "where does X live" map. [ARCHITECTURE.md](ARCHITECTURE.md) gives
the mental model; this file gives the directory tree. When the two disagree, fix
whichever is stale - this map is maintained alongside the code.

```
yuu_clip/
  cli/                     # Thin Typer adapters - analyze, export, import_url, models, reel, restore, review, serve (+ _base, __main__). Commands parse args and call into pipeline/ and export/.
  dev/                     # The yuu-dev developer-loop CLI (Typer, cross-platform): serve, status, logs, lint (lint.py), typecheck (typecheck.py, mypy + frozen baseline), the test runners (tests.py = test-unit/-integration/-api/-system/-golden/-ui/-all, testjs.py = test-js), bundle (bundle.py -> esbuild + the index.html stitch in htmlstitch.py), shared-data (shareddata.py), fixture-project (fixture.py), uiserver.py (the disposable fixture server test-ui stands up), help-docs (helpdocs.py), notices (notices.py), lock-deps (deps.py), _summary.py (pytest-output summary core), procs.py (Windows process reap; no-ops off Windows)
    smoke/                 # release-smoke: client.py (stdlib urllib HTTP/SSE client), media.py (source resolution: real recording / synthetic / --media-dir), report.py (StepResult + console/report rendering), steps/ (the step registry, split by section: core, editing, transcription, aggregate, config, housekeeping), __init__.py (the Typer command, option parsing, the try/finally shell)
  pipeline/                # The analyze engine: ingest.py (per-video orchestration + every stage helper), progress.py (the structured @@PROGRESS marker channel the browser's job bar parses), run_meta.py (per-run timing/settings capture), frame_analysis.py (killable subprocess for single-clip vision frame analysis), vision_describe.py (opt-in auto vision-LLM description of top textless/visual clips)
  export/                  # The export feature: render.py (engine - cut, retranscribe, title card, captions), window.py (where trim offsets land on the source file), naming.py (filename stem), presets.py (definitions + size-cap math), paths.py (on-disk export/sidecar path resolution + export-query validation)
  analyze/                 # Per-recording media analysis: probe.py (inspect metadata), labeler.py (track roles), extract.py (track -> WAV), overlap.py (duplicate-track RMS check), motion.py (model-free frame-diff activity feeding the Visual axis), frames.py (frame sampling for image analysis), framing.py (9:16 auto-framing suggestion via face detection), proxy.py (720p preview proxy), pause.py (analysis pause points), thermal.py (GPU temperature monitor + auto-pause)
  scoring/                 # engine.py (ScoringEngine) + scorer_set.py (canonical scorer-set construction) + protocol.py (the Scorer Protocol). Signal scorers: energy.py, scenes.py, laugh.py, lexicon.py, prosody.py, speechrate.py, churn.py, audio_event.py, visual.py. LLM seam: llm.py, llm_client.py (LLMClient ABC + make_client), llamacpp_server.py (managed llama-server pool). Also similarity.py (related clips + Meaning hot-words), textmatch.py + term_scope.py (hot-word/sensitive matching + context scoping), dedup.py (duplicate-clip scan), describe_basic.py (non-LLM one-liner), wav_access.py (shared WAV decode for audio scorers)
  segments/                # Clip generation: windower.py (silence-gap speech clips), visual_windower.py (silent-but-visual candidates), scene_segmenter.py (opt-in LLM scene generation), merge.py (dedup + per-recording cap for visual candidates)
  transcribe/              # transcriber.py (Transcriber ABC + make_transcriber, faster-whisper backend), whisper_runner.py (persistence + progress around the seam), diarization_client.py (DiarizationClient seam), speaker_attach.py (diarization output -> durable Speakers), project_voice.py (cross-recording Person matching core), align.py (forced alignment of edited caption text, for word-highlight captions)
  db/models.py             # SQLAlchemy ORM (SQLite, NullPool) - the ONLY schema source (see the Data model section of ARCHITECTURE.md)
  console.py               # Shared Rich console + BYTES_PER_MB (used by cli/ and the engine; lives outside cli/ so the engine never imports cli)
  config.py                # Config dataclass + load/save (+ resolve_ai_permissions, the AI-privacy choke point)
  ffmpeg_tools.py           # find_ffmpeg (bundled/PATH binary discovery) + run_ffmpeg (the ffmpeg/ffprobe choke point)
  recent_projects.py       # Recently-opened-projects MRU list (project switcher)
  track_labels.py          # TRACK_LABELS/LABEL_WEIGHTS/LABEL_DESCRIPTIONS + saved track-layout profile CRUD
  contexts.py              # World-context storage + prompt formatting
  sessions.py              # Session auto-grouping suggestions (pure logic; routes/sessions.py drives it)
  reel.py                  # Highlight-reel assembly (select + concatenate top clips into one reel)
  subtitles.py             # Caption (SRT) generation
  url_import.py            # Import from URL (yt-dlp download + metadata sidecar)
  project_archive.py       # Backup / Restore (build_backup, restore_into, source-media re-point)
  model_catalog.py         # Recommended/allowed model catalog + licence policy (single source of truth; enforced by tests/unit/test_model_catalog.py)
  whisper_catalog.py       # User-facing catalog of selectable speech-to-text models
  content_presets.py       # Content-type presets (weights + prompt flavor per streaming style)
  update_check.py          # GitHub release update check (notify-only)
  hf_cache.py              # Network-free "is this HF model already downloaded" check
  log.py                   # Rotating project log (<project>/.yuu-clip/yuu-clip.log)
  web/
    app.py                 # FastAPI factory + lifespan (graceful shutdown)
    deps.py                # ProjectContext - shared server state
    sse.py                 # subprocess -> SSE streaming helper
    analyze_job.py         # In-process analyze job tracking (AnalyzeJob)
    media.py               # Video/media file streaming helpers
    file_deletion.py       # Resilient file deletion + Windows file-lock diagnosis (Restart Manager)
    routes/                # One module per feature (videos, analyze, scoring, speakers, voices, characters, contexts, sessions, reel, profiles, sounds, imports, backup, llm, models, config, logs, hotwords, sensitive, dedup, name_corrections, content_presets, export_presets, projects, updates, reveal, ...) + common.py (cross-cutting route helpers). clips/ is a subpackage (crud, edit, approval, bulk, captions, delete, export, serialize, schemas)
    static/index.html      # COMMITTED BUILD ARTIFACT - stitched from index.src.html + partials/ by `yuu-dev bundle`. Do not hand-edit. Single-page UI shell; loads one <script>: bundle.esm.js
    static/index.src.html  # Source for index.html: the page shell + <!-- @@include ... --> markers (readable region table-of-contents). Edit this, not index.html.
    static/partials/       # One HTML file per modal/region (regions/*.html + modals/*.html), stitched into index.html. Edit these, not index.html.
    static/main.esm.js     # ESM entry point (esbuild). Imports the whole module graph (boot.js last) and holds a shrinking residual window.X = X shim for names still read as window.* by other modules or poked by page.evaluate tests.
    static/bundle.esm.js   # Committed esbuild artifact: the whole ESM graph from main.esm.js, IIFE + inline sourcemap. Do not hand-edit; edit the source *.js + rebundle.
    static/<bucket>/*.js   # ~45 real ESM modules (import/export), grouped into feature subdirectories, all reachable from main.esm.js. Buckets: core/ (boot [first-paint, imported last], state [AppState], utils, ui, format, jobs [SSE], panelnav, preview, helpmodals, shortcuts, errorreporter, gpustatus, markdown, updatecheck), videos/ (videos + videos-*, sessions), clips/ (clips, clipbulk, clipcreate, clipexport), analyze/ (analyze, reel, split, transcript), settings/ (settings + settings-*, projects, modelcatalog, modeldownload), people/ (speakers, voices, namecorrections), library/ (contexts, sounds, hotwords, sensitive, exportpresets, exporteditor, colorpicker). Imports are relative, so a module's bucket is part of its path (e.g. import from '../core/utils.js').
    static/app.css         # Stylesheet (rules only; theme tokens live in static/shared/tokens.css, linked before it)
    static/shared/         # Cross-runtime shared assets: tokens.css (theme tokens), escapehtml.js + whisperlang.js (ESM, imported by BOTH the web bundle and the wizard bundle), catalog-data.json. Mirrored into electron/shared/ by `yuu-dev shared-data`.
    static/help/           # Committed copies of the user guides the in-app Help modal renders (`yuu-dev help-docs` mirrors them from docs/user/)
electron/                  # Desktop wrapper: main.js (window/menu/IPC + server spawn + wizard + lifecycle), constants.js, logging.js, electron-config.js, install.js (runCmd/download/pip helpers), preload.js, setup wizard (setup.html markup + setup-renderer.js -> committed setup.bundle.js + setup-preload.js), shared/catalog-data.json (generated by `yuu-dev shared-data`), plus focused helpers (gpu-detect, ffmpeg-detect, disk-space, prebuilt-env, venv-setup, recommend-model, ...) and test/ (node --test suite)
tests/                     # unit = state-independent, run anywhere; integration = seeded DB; system = full-stack pipeline; ui = live server; js = vitest
  conftest.py              # root: only isolate_global_config (autouse, inherited by all tiers)
  unit/
    conftest.py            # deliberately empty of DB/server fixtures - the guardrail
    test_*.py              # pure: no TestClient, no project_dir/client, no live server, no real packages/cache
    test_no_integration_imports.py  # meta-test: unit tier must not import the web app / TestClient
  integration/
    conftest.py            # project_dir + client fixtures (seeded DB, in-process TestClient)
    test_*.py              # route/pipeline tests that need the seeded DB
  system/
    conftest.py + _stubs.py # real-pipeline fixtures (generated video; Whisper + LLM stubbed); one test per automatable use case, plus the opt-in golden real-models path
  ui/
    conftest.py            # Playwright fixtures + select_video_* helpers + teardown watchdogs
    test_ui_*.py           # Playwright against the isolated fixture server test-ui spawns (YUU_TEST_URL)
  js/                      # JS unit layer (vitest + happy-dom, no browser/server). Run via `yuu-dev test-js`.
    setup.js               # seeds index.html's <body> before module imports (load-time getElementById wiring)
    <bucket>/*.test.js     # pure module logic imported directly (formatters, filters, parse/score helpers, job-pill state)
```
