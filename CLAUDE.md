# yuu-clip - Claude Code context

## What this project is

A desktop tool for a solo user (Windows) that ingests gaming session recordings, runs
Whisper transcription + audio energy + scene detection + LLM scoring, identifies the
best clip candidates, and presents a web UI for review and export.

Single-user tool - no auth, no multi-tenancy, no public network exposure.

## How to start / restart the server

The daily dev-loop commands live in the `yuu-dev` CLI (`yuu_clip/dev/`, a Typer
app), not in PowerShell. `yuu-dev` is a console entry point that works on Windows,
macOS, and Linux.

```powershell
yuu-dev serve
```

`yuu-dev serve` runs the /api/status pre-check (warns + confirms before interrupting
a live job), reaps this repo's stale server / orphaned llama-server, then binds 8080
- or, if a foreign app already holds 8080, the next free port (it prints the real URL).

To watch the log live:
```powershell
yuu-dev logs --follow
```

## MANDATORY: after any Python change

API tests take ~1 minute. Run them selectively - not after every edit.

**Run `yuu-dev test-api` before reporting done when:**
- Fixing a logic bug in a route handler or scoring/analyze pipeline
- Adding or removing a route, or changing its response shape
- Touching DB models, migrations, or config parsing
- Making any change that could silently break existing behavior

**Skip tests when:**
- The change is cosmetic (log wording, comment, rename with no behavior change)
- You're mid-iteration and will run tests at the end before reporting done
- The change is HTML/JS/CSS only (no Python touched)

Before reporting a backend fix complete, do:

1. Run the linter: `yuu-dev lint` (fast - run after every Python change, even cosmetic ones; fix or `--fix` anything it flags)
2. Run tests if the change qualifies above: `yuu-dev test-api`
3. Restart the server: `yuu-dev serve`
4. Confirm the fix works in the browser (or state explicitly that you cannot)

Test script output: both test commands default to quiet output and write
`test-api-last.log` / `test-ui-last.log` (full) plus `test-*-last-summary.log`
(failures + summary only). Read the summary file after a run - only open the full
log when a failure needs more context. Pass `--detailed` for verbose per-test output
on a manual run.

### Before restarting the server

**Always check for active processing first:**

```powershell
yuu-dev status        # exit 1 + a warning if anything is processing
# or the raw endpoint: Invoke-RestMethod http://127.0.0.1:8080/api/status
```

`/api/status` returns `{"any_running": bool, "analyze_running": bool, "active_jobs": int, "version": str}`.
If `any_running` is `True`, **stop and ask the user** whether to wait or cancel before
proceeding. Restarting mid-ingest silently kills the subprocess and loses all progress;
interrupting other SSE jobs (rescore, timeline, summarize) is less catastrophic but
should still be confirmed.

HTML/JS edits do **not** need a server restart. But the browser loads
`static/bundle.js` (one committed concatenation of the `static/*.js` files), **not** the
individual files - after editing any `static/*.js` you must run `yuu-dev bundle` (or keep
`yuu-dev bundle --watch` running) for the change to appear, and the
`tests/unit/test_bundle_drift.py` guard fails if you commit a stale bundle. Editing
`index.html` alone needs no rebundle.

## MANDATORY: after any static file change (*.js, *.html, *.css)

No server restart needed. But before reporting a UI fix as complete:

1. Confirm the fix works in the browser
2. If the server is running, run the UI tests to catch regressions

**Run targeted, not the whole suite every time.** The full suite is ~655 tests
/ ~3.7 min and is server-bound - its wall time is DB/server throughput divided
across workers, so adding workers past 4 does not help and running it on every
edit is the slow part of the loop. Pick the run by scope, using judgment:

- **`yuu-dev test-ui --changed`** - the dev default. Maps your working-tree
  diff to the affected `tests/ui/test_ui_*.py` file(s) via `scripts/select_ui_tests.py`
  and always adds the smoke backstop (`tests/ui/test_ui_smoke.py`). This is what to
  run after most localized edits.
- **`yuu-dev test-ui --smoke`** - just the ~6-test backstop, for a quick
  "is the app fundamentally working?" check.
- **`yuu-dev test-ui`** (full suite) - run when the change is
  cross-cutting (`utils.js`, `ui.js`, `boot.js`, the app shell/`index.html`,
  `tests/conftest.py` or `tests/ui/conftest.py`), when `-Changed` prints a cross-cutting/backend advisory,
  before reporting a broad UI change complete, and as the final step of any
  UX/UI review pass (`/code-review` or `shqr-ux-ui-review`). The user has also
  OK'd leaving the full run for review passes rather than every "done".

`--changed` reflects **uncommitted** working-tree changes vs HEAD; if you have
already committed the edit mid-session, run the relevant file(s) or the full
suite explicitly.

## Project layout

```
yuu_clip/
  cli/                     # Thin Typer adapters - analyze, export, reel, review, serve (+ _base). Commands parse args and call into pipeline/ and export/.
  dev/                     # The yuu-dev developer-loop CLI (serve/test-api/test-ui/lint/logs/status/lock-deps/bundle), Typer, cross-platform. _summary.py = pytest-output summary core, procs.py = Windows process reap (no-ops off Windows), deps.py = lock-deps (regenerate requirements.lock), bundle.py = concatenate static/*.js (order in bundle.manifest) into the committed static/bundle.js.
  pipeline/                # The analyze engine: ingest (per-video orchestration + stages), run_meta (per-run timing/settings capture), vision_describe (opt-in auto vision-LLM description of top-N textless/visual clips)
  export/                  # The export feature: render (engine - cut, retranscribe, title card, captions), naming (filename stem), presets (definitions + size-cap math), paths (on-disk export/sidecar path resolution + export-query validation)
  console.py               # Shared Rich console + BYTES_PER_MB (used by cli/ and the engine; lives outside cli/ so the engine never imports cli)
  config.py                # Config + profile management
  db/models.py             # SQLAlchemy ORM (SQLite, NullPool)
  analyze/                 # probe, labeler, extract, overlap, motion (model-free frame-diff on-screen-activity timeline for the Visual axis)
  scoring/                 # energy, scenes, llm, llm_client, laugh, engine, visual (on-screen-activity scorer feeding score_visual)
  segments/                # windower (silence-gap clip generation), visual_windower (silent-but-visual candidate generation), merge (dedup + per-recording cap for visual candidates)
  transcribe/              # whisper_runner, diarization_client
  subtitles.py             # caption (SRT) generation
  contexts.py              # world-context storage + prompt formatting
  web/
    app.py                 # FastAPI factory + lifespan (graceful shutdown)
    deps.py                # ProjectContext - shared server state
    sse.py                 # subprocess → SSE streaming helper
    analyze_job.py         # in-process analyze job tracking (AnalyzeJob)
    media.py               # video/media file streaming helpers
    file_deletion.py       # resilient file deletion + Windows file-lock diagnosis (Restart Manager)
    routes/                # one module per feature (videos, analyze, scoring, speakers, voices, characters, contexts, reel, profiles, sounds, imports, backup, llm, models, config, logs, ...) + common.py (cross-cutting route helpers). clips/ is a subpackage (crud, edit, approval, bulk, captions, delete, export, serialize, schemas)
    static/index.html      # Single-page UI shell (vanilla JS). Loads one <script>: bundle.js
    static/bundle.js       # Committed build artifact: static/*.js concatenated in bundle.manifest order by `yuu-dev bundle`. Do not hand-edit; edit the source files + rebundle.
    static/bundle.manifest # The single ordered load-order list the bundle is built from (replaces the hand-ordered <script> tags)
    static/*.js            # ~40 modules, one per feature/view. Foundational: boot (bootstrap), state (shared UI state), utils, ui, format, jobs (SSE job helpers), panelnav (PanelNav panel-flow stack). The rest are per-feature (videos + videos-*, clips + clip*, analyze, contexts, reel, settings + settings-*, speakers, voices, split, transcript, ...)
    static/app.css         # Stylesheet
electron/                  # Desktop wrapper: main.js (window/menu/IPC + server spawn + wizard + lifecycle), constants.js, logging.js, electron-config.js, install.js (runCmd/download/pip helpers), preload.js, setup wizard (setup.html + setup-preload.js)
tests/                     # unit = state-independent, run anywhere; integration = seeded DB; ui = live server
  conftest.py              # root: only isolate_global_config (autouse, inherited by all tiers)
  unit/
    conftest.py            # deliberately empty of DB/server fixtures - the guardrail
    test_*.py              # pure: no TestClient, no project_dir/client, no live server, no real packages/cache
    test_no_integration_imports.py  # meta-test: unit tier must not import the web app / TestClient
  integration/
    conftest.py            # project_dir + client fixtures (seeded DB, in-process TestClient)
    test_*.py              # route/pipeline tests that need the seeded DB
  ui/
    conftest.py            # Playwright fixtures + select_video_* helpers + teardown watchdogs
    test_ui_*.py           # Playwright against a live server (YUU_TEST_URL, default :8080)
```

## Running tests

The suite has three tiers by directory: **unit** (state-independent, runs
anywhere), **integration** (seeded DB / in-process TestClient), and **ui** (live
Playwright server). `yuu-dev test-api` runs unit + integration; `yuu-dev test-ui` runs ui.

```powershell
yuu-dev test-api            # unit + integration (tests/unit tests/integration); no live server
yuu-dev test-ui --changed   # dev default: tests around the diff + smoke
yuu-dev test-ui --smoke     # ~6-test backstop only, quickest sanity check
yuu-dev test-ui             # full suite (all tests/ui/test_ui_*.py) - see cadence above
```

`yuu-dev test-ui` (full) runs 4 pytest-xdist workers by default (~3.7 min); targeted
runs scale workers down to the selected file count (a single file runs
in-process). Pass `--sequential` only when debugging suspected worker-parallelism
flakes. `--changed` calls `scripts/select_ui_tests.py`, which maps changed source
files to their test files (fuzzy stem match, e.g. `videos.js` -> `test_ui_video`)
and always includes `tests/ui/test_ui_smoke.py`. The session `browser` fixture
override in `tests/ui/conftest.py` guards the Playwright teardown hang - see the
comment there before touching the teardown watchdogs. If the suite (or the app)
feels slow, check the server isn't degraded first: `curl` `/api/status` should
answer in ~3ms, and the serve process should sit near 0% CPU when idle.

The tiers are split by **directory**, not markers. `pytest.ini` registers no
custom markers. A test that needs real installed packages / HF cache /
OS state belongs in `tests/integration`, never `tests/unit`. A unit test that
references `project_dir`/`client` fails at collection (no such fixture in the
unit tier) - move it to `tests/integration`, splitting the file if it mixes pure
and seeded tests. `tests/unit` must pass offline regardless of machine state.

Run at least `yuu-dev test-api` before reporting a backend fix as done.

### Electron wrapper tests (only when touching `electron/`)

The desktop wrapper has its own Node test suite, separate from the pytest
suites above (they don't cover `electron/`, and this doesn't cover them):

```powershell
cd electron; npm test        # node --test, no dependencies, ~0.2s
```

Run it only after changing files under `electron/` (e.g. `main.js`,
`gpu-detect.js`) - skip it for pure Python/web-UI changes.

## Current focus

**Phase 3 web UI - manual testing and bugfixing.** The pipeline is complete; the
goal is to get the web UI stable enough for regular use. Approach:

1. Try an action in the browser
2. If it fails, check `.yuu-clip\yuu-clip.log`
3. Fix the bug, restart the server, reproduce to confirm

## Terminology

The authoritative term list is in `docs/dev/llm/GLOSSARY.md` (the exhaustive dev
superset; the human-facing subset is the in-app glossary at
`yuu_clip/web/static/glossary.md`). Read it before introducing any new concept, and
follow these rules:

- **User-facing text** (UI labels, button text, toast messages, error messages, CLI
  help text, docs) must use the glossary term - not the code name.
- **Code names** (Python identifiers, JS variable names, API route paths, DB column
  names) may differ from the user-facing term. The glossary records both under
  "Code:" and "Also called in codebase:".
- **When you add a new concept**: define it in the glossary first, then use that
  term everywhere from the start. Don't name it one thing in code and something
  else in the UI without documenting the split.
- **When a concept is renamed**: update `docs/dev/llm/GLOSSARY.md`, then update all
  user-facing strings. Code identifiers can be left for a separate refactor pass -
  but the glossary entry must note the divergence under "Also called in codebase:".

Key terms to get right (common sources of drift):
- "Analyze" / "Analysis" - not "Ingest" in user-facing text (code: `ingest`)
- "Inspect" - not "Probe" in user-facing text (code: `probe()`)
- "Track layout" - not "Profile" in user-facing text (code: `profile`)
- "World context" - not "RP context" in user-facing text (code: `world_context`)
- "LLM scoring" - not "AI scoring"
- "Clip" - not "clip candidate" in user-facing text (code: `ClipCandidate`)
- "Unreviewed" - not "Pending" in user-facing text (code: `status = 'pending'`)
- "Highlight reel" - not "demo reel" in user-facing text (code: `demo_reel`)
- "Context ID" - not "slug" in user-facing text (code: `context_slug`)
- "Captions" - not "subtitles" in user-facing text (code: `subtitles`, SRT)
- "Clip generation" - not "segmentation" in user-facing text
- "Track role" - not "label" in user-facing text (code: `track.label`)
- "Last scored with" - not "provenance" in user-facing text

Use these glossary terms in **conversation** too, not just in code. If discussing a concept with the user, use the user-facing term (e.g. say "track layout" not "profile", "world context" not "RP context").

## Behavior
- Never cd into the current working directory before running a command
- Always use the approved dev CLI (`yuu-dev <cmd>`) - never raw python calls outside the venv
- Ask before touching files outside the current task scope
- If uncertain about approach, stop and ask rather than proceeding with assumptions
- Be concise in responses - no preamble, no "I've completed..." summaries
- State what changed and why, nothing else
- Make easy, low-risk fixes autonomously then report what remains - don't ask for approval on obvious fixes
- Prefer user-level config (`~/.claude/settings.json`) over project-level for personal preferences

## Testing
- Tests before or alongside implementation, never after
- Test behavior, not implementation
- If you change existing code, verify existing tests still make sense
- Run `yuu-dev test-api` before reporting any backend fix as done
- If stuck in a circular codegen loop, write a minimal test first instead of iterating further on the implementation

## Code standards

### AI/model backends must sit behind a swappable interface
Every model-backed capability is exposed through a generic interface so a backend can
be swapped (or added) without touching the callers - this is a hard convention, keep it
even when there is only one implementation today. Each seam is: an ABC (or `Protocol`) +
a single `make_*(config)` factory keyed on a `*_backend` config value, and the interface
exposes `available() -> (ok, reason)`. Callers only ever go through the factory; they
never import a concrete backend class. The existing seams:

- **LLM text + vision** - `LLMClient` + `make_client` (`scoring/llm_client.py`), keyed on
  `llm_backend`. Backends: `llamacpp` (local, the only real backend) and the `NullLLMClient`
  fallback. yuu-clip is local-only - there is no remote/hosted backend. `make_client` is
  also the single AI-privacy-mode enforcement point (returns `NullLLMClient` when generative
  AI is off).
- **Diarization** - `DiarizationClient` + `make_diarization_client`
  (`transcribe/diarization_client.py`), keyed on `diarization_backend`.
- **Transcription** - `Transcriber` + `make_transcriber` (`transcribe/transcriber.py`),
  keyed on `transcription_backend`. `transcribe()` yields backend-agnostic
  `TranscribedSegment`s; persistence + progress live in `whisper_runner.transcribe_track`;
  `model_cached()` / `prefetch()` are interface methods so each backend owns its caching.
- **Similarity / embeddings** - backend classes + `make_backend` (`scoring/similarity.py`),
  keyed on `similarity_backend`.
- **Scorers** - the `Scorer` `Protocol` (`scoring/protocol.py`), assembled by
  `scoring/scorer_set.py`. Adding a scoring dimension/model = a new `Scorer`.

To add a backend: implement the interface, register it in that module's `_BACKEND_*`
dict, add the `*_backend` value. Do NOT add a caller-side `if backend == ...`. Keep the
backend's own tunables under a backend-specific config prefix (e.g. `whisper_*` for
faster-whisper, `speaker_*` for diarization) rather than renaming them generic.

### General
- No comments unless the WHY is genuinely non-obvious (hidden constraint, workaround, subtle invariant)
- No docstrings on internal functions - clear names are enough
- No error handling for things that can't happen; trust framework guarantees
- Don't add features beyond what the immediate task requires
- Methods/functions under 30 lines - decompose and flag if longer
- No duplication - if similar logic appears twice, extract it
- Names must be descriptive - no `x`, `tmp`, `data`, `result`, `val`
- Error paths must be handled explicitly, not silently swallowed
- One concern per function

### Licensing
- The global "no GPL/AGPL dependencies" rule covers *code* - it does **not** cover the
  thing that actually ships to users' machines here: **model weights and other assets the
  app downloads or recommends at runtime** (LLM/vision `.gguf` files, HF
  models). Those are governed by their *own* licences, which are often bespoke (Meta's
  Llama Community License, Google's Gemma Terms) rather than GPL/AGPL, so they slip past the
  dependency check.
- **Any model this project recommends or defaults to must carry a licence that permits the
  user to monetize the output** - because we distribute this and steer non-developer users.
  Apache-2.0 / MIT / BSD are in; Llama- and Gemma-licensed models are **out of recommendations
  and defaults** (they keep working if a user configures them by hand). The authoritative list
  is `yuu_clip/model_catalog.py`; its licence policy and the "defaults match the catalog" rule
  are enforced by `tests/unit/test_model_catalog.py`. Licences vary by parameter size (Qwen2.5 **7B**
  is Apache-2.0 but the 3B/72B are not) - re-verify against the HF model card before adding an
  entry, and if you change a default model, change it to a *recommended* catalog entry.

### Python / backend
- SQLAlchemy sessions must be explicitly closed in route handlers - always use `try/finally: db.close()`
- All SQLite engines use `NullPool` (set in `make_engine`) - never change this; pooled connections block the ingest subprocess
- Ingest subprocess is always launched with `--no-interact` from the web UI
- `ctx.analyze_job` (an `AnalyzeJob`, `web/analyze_job.py`) tracks the running analyze subprocess for cancellation, reconnection, and shutdown; `ctx.analyze_proc` remains as the legacy subprocess handle
- The FastAPI `lifespan` in `app.py` terminates the `analyze_job` subprocess (and any `analyze_proc`) on server exit (5 s grace then kill)
- For new route handlers that read the DB: follow the existing pattern in `routes/videos.py`

### JavaScript / frontend
- **Never hardcode colors** - no hex/rgba literals in CSS rules, inline styles, or JS-built HTML. Every color must be `var(--token)` or `color-mix(in srgb, var(--token) N%, transparent)` using the theme tokens defined at the top of `app.css`. Literals are only allowed inside the theme definition blocks themselves (`:root` and `html[data-theme=...]`), which must each override the full token set. Exceptions: `#000` video letterboxing and `rgba(0,0,0,…)` scrims drawn *over video content* (theme-independent by design), and the score-gradient stops in `format.js` (data encoding, not UI chrome). `tests/ui/test_ui_theme.py` enforces this for `app.css` and checks WCAG AA contrast per theme - when adding a new color pairing, add its contrast assertion there.
- `escHtml(s)` must escape `"` → `&quot;` (used for `data-*` attributes in onclick delegation)
- Dynamic button lists must use event delegation (`el.onclick = e => { ... }`) not inline `onclick=` attributes with JS values - inline attributes break when names contain quotes
- SSE streams are tracked in `_activeES`; call `_activeES.close()` before starting a new one
- `startJobUI` / `endJobUI` / `streamSSE` are the canonical helpers for long-running jobs
- **Panel flows**: a multi-step flow (Split Editor, manual-clip picker, etc.) must take
  over the main detail panel via `PanelNav.open()` (`panelnav.js`), not a modal. Tabs are only
  for navigation *within* a single view. `PanelNav.open({id, title, render, isDirty, onClose})`
  handles the `← Back` breadcrumb, the stack (for future nesting), and the shared discard
  prompt; `PanelNav.close()` gates on `isDirty()`, `PanelNav.forceClose()` bypasses it for
  callers that already ran their own confirm. Guard global keyboard shortcuts and any
  background re-render (SSE completions) with `PanelNav.isOpen()` - the panel covers the
  detail pane but not the sidebar clip list beside it.

## Known patterns and pitfalls

### SQLite locking
SQLite allows only one concurrent writer. The web server and the ingest subprocess are
separate processes. Fixes already in place:
- `NullPool` on all engines - connections close immediately
- `PRAGMA busy_timeout=30000` - subprocess waits 30 s before giving up
- Explicit `db.close()` in every route handler via `try/finally`

If you see `OperationalError: database is locked`:
- Most likely: a zombie ingest subprocess is still running. Check with
  `Get-WmiObject Win32_Process -Filter "name='python.exe'"` and kill any stale
  ingest processes before restarting the server.
- Less likely: a route handler is leaking a session (missing `try/finally: db.close()`).
- Also check: the server was not restarted after a Python change.

### Interactive labeling
`label_tracks()` must never be called interactively from the web UI. The CLI analyze
command always receives `--no-interact`; this causes `_label_non_interactive()` to
use track 0 as combined and mark the rest unlabeled without prompting.

### Subprocess cancellation
`POST /api/analyze/cancel` calls `job.cancel()` on `ctx.analyze_job`, which sets
`job.cancelled = True` and terminates the process tree; the job's pump emits a
`[Analysis cancelled]` message to SSE subscribers after the process exits. The
legacy `ctx.analyze_proc` path (flag: `ctx.analyze_cancelled`) is also covered.

### SpeechBrain poisons transformers.pipeline (import order)
Importing `speechbrain` before `transformers.pipeline` is first resolved makes that
resolution force-load speechbrain's k2_fsa integration, which hard-imports the
unbundled `k2` package → `ModuleNotFoundError: k2`. In the analyze subprocess
diarization (speechbrain) runs before scoring (transformers), so audio-event/laugh
scoring would silently die. `_analyze_one` pre-warms via
`prewarm_transformers_pipeline()` (audio_event.py) before diarization; keep that call
ahead of any speechbrain import if you reorder the pipeline. Only surfaces with the
real packages installed - the pytest venv mocks both, so re-verify against a real
offline install (see the packaging-strategy overhaul Wave 5).

### HTML safety
`escHtml` in `utils.js` escapes `& < > "`. Always run track layout names, context
names, and filenames through it before embedding in HTML attributes.

### Local-only: no remote/hosted AI backend (Claude removed)
yuu-clip runs all inference on-device; there is no remote/hosted LLM backend and no
"send my transcript to an API" path. The Claude/Anthropic backend, its distribution
gate (`remote_ai_enabled` / `YUU_REMOTE_AI`), the `remote_ok` AI-privacy mode, and the
`anthropic` dependency were all removed (see `docs/project/DECISIONS.md`). A local-only
surface is a deliberate positioning choice - do NOT re-add a remote backend without an
explicit product decision.

- `ai_privacy_mode` is now just `none` (no generative AI) | `local_only` (default);
  `resolve_ai_permissions` is the single choke point. The `LLMClient` seam keeps its ABC
  + `make_client` factory (one real backend, `llamacpp`, plus the `NullLLMClient`
  fallback) so a future *local* backend stays a registration, not a rewrite.

### Wizard and Settings are parallel model-selection stacks (keep in sync, no shared code)
Model selection lives in two separate stacks that CANNOT share code, so a change to one
must be mirrored in the other by hand:
- **Settings** (in-app): browser JS (`web/static/settings.js`, `modelcatalog.js`,
  `index.html`) -> HTTP -> Python `model_catalog.py` + `cli/models.py download-gguf`.
- **Setup wizard** (Electron): renderer (`electron/setup.html`) -> IPC -> `electron/main.js`
  `setup:download-gguf-model`, which downloads the hardcoded `DEFAULT_LLAMACPP_MODEL`
  (`electron/constants.js`) with Node and writes `config.json` directly.

They can't be DRY-ed into one JS file: different runtimes (browser vs Electron main/Node),
and the wizard runs BEFORE the Python server exists, so it can't use the server endpoints
Settings depends on. Consequences to respect:
- The wizard's `DEFAULT_LLAMACPP_MODEL` duplicates a `model_catalog.py` entry - keep the id
  and filename matching a recommended catalog entry so the two catalogs don't drift.
- LLM model config is split by function: text scoring uses `llm_model_path`; image analysis
  uses `llm_vision_model_path` + `llm_mmproj_path` (see the per-function-llm-models plan).
  The wizard only ever sets the TEXT model, so `DEFAULT_LLAMACPP_MODEL` must stay a text
  (non-vision) model. If the wizard ever gains vision-model selection, it must write
  `llm_vision_model_path`, never `llm_model_path`.

### PowerShell script encoding
Any `.ps1` file containing non-ASCII (em-dash, box-drawing `─`, smart quotes)
**must** be saved with a UTF-8 BOM. Without one, Windows PowerShell 5.1 decodes the
file as cp1252, turning those bytes into a `”` that it treats as a string delimiter -
producing "missing terminator" parse errors far from the actual character. The `Write`
tool does not add a BOM; prepend `EF BB BF` after writing. `tests/unit/test_ps1_bom.py`
enforces this for `scripts/*.ps1` (ASCII-only scripts don't need a BOM).
