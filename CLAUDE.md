# yuu-clip - Claude Code context

## What this project is

A desktop tool for a solo user (Windows) that ingests gaming session recordings, runs
Whisper transcription + audio energy + scene detection + LLM scoring, identifies the
best clip candidates, and presents a web UI for review and export.

Single-user tool - no auth, no multi-tenancy, no public network exposure.

## How to start / restart the server

```powershell
.\scripts\serve.ps1
```

To watch the log live:
```powershell
.\scripts\logs.ps1
```

## MANDATORY: after any Python change

API tests take ~1 minute. Run them selectively - not after every edit.

**Run `.\scripts\test-api.ps1` before reporting done when:**
- Fixing a logic bug in a route handler or scoring/analyze pipeline
- Adding or removing a route, or changing its response shape
- Touching DB models, migrations, or config parsing
- Making any change that could silently break existing behavior

**Skip tests when:**
- The change is cosmetic (log wording, comment, rename with no behavior change)
- You're mid-iteration and will run tests at the end before reporting done
- The change is HTML/JS/CSS only (no Python touched)

Before reporting a backend fix complete, do:

1. Run the linter: `.\scripts\lint.ps1` (fast - run after every Python change, even cosmetic ones; fix or `--fix` anything it flags)
2. Run tests if the change qualifies above: `.\scripts\test-api.ps1`
3. Restart the server: `.\scripts\serve.ps1`
4. Confirm the fix works in the browser (or state explicitly that you cannot)

Test script output: both test scripts default to quiet output and write
`test-api-last.log` / `test-ui-last.log` (full) plus `test-*-last-summary.log`
(failures + summary only). Read the summary file after a run - only open the full
log when a failure needs more context. Pass `-Detailed` for verbose per-test output
on a manual run.

### Before restarting the server

**Always check for active processing first:**

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/status
```

This returns `{"any_running": bool, "analyze_running": bool, "active_jobs": int, "version": str}`.
If `any_running` is `True`, **stop and ask the user** whether to wait or cancel before
proceeding. Restarting mid-ingest silently kills the subprocess and loses all progress;
interrupting other SSE jobs (rescore, timeline, summarize) is less catastrophic but
should still be confirmed.

HTML/JS edits to `yuu_clip/web/static/index.html` do **not** need a server restart.

## MANDATORY: after any static file change (*.js, *.html, *.css)

No server restart needed. But before reporting a UI fix as complete:

1. Confirm the fix works in the browser
2. If the server is running, run the UI tests to catch regressions

**Run targeted, not the whole suite every time.** The full suite is ~655 tests
/ ~3.7 min and is server-bound - its wall time is DB/server throughput divided
across workers, so adding workers past 4 does not help and running it on every
edit is the slow part of the loop. Pick the run by scope, using judgment:

- **`.\scripts\test-ui.ps1 -Changed`** - the dev default. Maps your working-tree
  diff to the affected `test_ui_*.py` file(s) via `scripts/select_ui_tests.py`
  and always adds the smoke backstop (`tests/test_ui_smoke.py`). This is what to
  run after most localized edits.
- **`.\scripts\test-ui.ps1 -Smoke`** - just the ~6-test backstop, for a quick
  "is the app fundamentally working?" check.
- **`.\scripts\test-ui.ps1`** (full suite) - run when the change is
  cross-cutting (`utils.js`, `ui.js`, `boot.js`, the app shell/`index.html`,
  `tests/conftest.py`), when `-Changed` prints a cross-cutting/backend advisory,
  before reporting a broad UI change complete, and as the final step of any
  UX/UI review pass (`/code-review` or `shqr-ux-ui-review`). The user has also
  OK'd leaving the full run for review passes rather than every "done".

`-Changed` reflects **uncommitted** working-tree changes vs HEAD; if you have
already committed the edit mid-session, run the relevant file(s) or the full
suite explicitly.

## Project layout

```
yuu_clip/
  cli/                     # Thin Typer adapters - analyze, export, reel, review, serve (+ _base). Commands parse args and call into pipeline/ and export/.
  pipeline/                # The analyze engine: ingest (per-video orchestration + stages), run_meta (per-run timing/settings capture)
  export/                  # The export feature: render (engine - cut, retranscribe, title card, captions), naming (filename stem), presets (definitions + size-cap math), paths (on-disk export/sidecar path resolution + export-query validation)
  console.py               # Shared Rich console + BYTES_PER_MB (used by cli/ and the engine; lives outside cli/ so the engine never imports cli)
  config.py                # Config + profile management
  db/models.py             # SQLAlchemy ORM (SQLite, NullPool)
  analyze/                 # probe, labeler, extract, overlap
  scoring/                 # energy, scenes, llm, llm_client, laugh, engine
  segments/                # windower (sliding-window clip generation)
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
    routes/                # videos, clips, analyze, scoring, speakers, sounds, profiles, reel, contexts, config, logs, common (small cross-cutting route helpers)
    static/index.html      # Single-page UI shell (vanilla JS, no build step)
    static/*.js            # Feature modules: analyze, boot, clips, contexts, reel, settings, sounds, speakers, split, transcript, ui, utils, videos
    static/app.css         # Stylesheet
electron/                  # Desktop wrapper: main.js (window/menu/IPC + server spawn + wizard + lifecycle), constants.js, logging.js, electron-config.js, install.js (runCmd/download/pip helpers), preload.js, setup wizard (setup.html + setup-preload.js)
tests/
  conftest.py              # project_dir + client fixtures; UI test session helpers
  test_*.py                # API unit tests (TestClient, no live server)
  test_ui_*.py             # UI tests (Playwright against live server on :8080)
```

## Running tests

```powershell
.\scripts\test-api.ps1          # fast, no live server needed
.\scripts\test-ui.ps1 -Changed  # dev default: tests around the diff + smoke
.\scripts\test-ui.ps1 -Smoke    # ~6-test backstop only, quickest sanity check
.\scripts\test-ui.ps1           # full suite (all test_ui_*.py) - see cadence above
```

`test-ui.ps1` (full) runs 4 pytest-xdist workers by default (~3.7 min); targeted
runs scale workers down to the selected file count (a single file runs
in-process). Pass `-Sequential` only when debugging suspected worker-parallelism
flakes. `-Changed` calls `scripts/select_ui_tests.py`, which maps changed source
files to their test files (fuzzy stem match, e.g. `videos.js` -> `test_ui_video`)
and always includes `tests/test_ui_smoke.py`. The session `browser` fixture
override in `tests/conftest.py` guards the Playwright teardown hang - see the
comment there before touching the teardown watchdogs. If the suite (or the app)
feels slow, check the server isn't degraded first: `curl` `/api/status` should
answer in ~3ms, and the serve process should sit near 0% CPU when idle.

Run at least `test-api.ps1` before reporting a backend fix as done.

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

The authoritative term list is in `docs/dev/GLOSSARY.md`. Read it before introducing any
new concept, and follow these rules:

- **User-facing text** (UI labels, button text, toast messages, error messages, CLI
  help text, docs) must use the glossary term - not the code name.
- **Code names** (Python identifiers, JS variable names, API route paths, DB column
  names) may differ from the user-facing term. The glossary records both under
  "Code:" and "Also called in codebase:".
- **When you add a new concept**: define it in the glossary first, then use that
  term everywhere from the start. Don't name it one thing in code and something
  else in the UI without documenting the split.
- **When a concept is renamed**: update `docs/dev/GLOSSARY.md`, then update all
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
- Always use approved project scripts (`.\scripts\*.ps1`) - never raw python calls outside the venv
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
- Run `.\scripts\test-api.ps1` before reporting any backend fix as done
- If stuck in a circular codegen loop, write a minimal test first instead of iterating further on the implementation

## Code standards

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
  are enforced by `tests/test_model_catalog.py`. Licences vary by parameter size (Qwen2.5 **7B**
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
- **Never hardcode colors** - no hex/rgba literals in CSS rules, inline styles, or JS-built HTML. Every color must be `var(--token)` or `color-mix(in srgb, var(--token) N%, transparent)` using the theme tokens defined at the top of `app.css`. Literals are only allowed inside the theme definition blocks themselves (`:root` and `html[data-theme=...]`), which must each override the full token set. Exceptions: `#000` video letterboxing and `rgba(0,0,0,…)` scrims drawn *over video content* (theme-independent by design), and the score-gradient stops in `utils.js` (data encoding, not UI chrome). `tests/test_ui_theme.py` enforces this for `app.css` and checks WCAG AA contrast per theme - when adding a new color pairing, add its contrast assertion there.
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
tool does not add a BOM; prepend `EF BB BF` after writing. `tests/test_ps1_bom.py`
enforces this for `scripts/*.ps1` (ASCII-only scripts don't need a BOM).
