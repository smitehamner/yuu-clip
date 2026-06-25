# rp-clipper — Claude Code context

## What this project is

A desktop tool for a solo user (Windows) that ingests gaming session recordings, runs
Whisper transcription + audio energy + scene detection + LLM scoring, identifies the
best clip candidates, and presents a web UI for review and export.

Single-user tool — no auth, no multi-tenancy, no public network exposure.

## How to start / restart the server

```powershell
.\scripts\serve.ps1
```

To watch the log live:
```powershell
.\scripts\logs.ps1
```

## MANDATORY: after any Python change

Do all three steps before reporting a backend fix as complete:

1. Run tests: `.\scripts\test-api.ps1`
2. Restart the server: `.\scripts\serve.ps1`
3. Confirm the fix works in the browser (or state explicitly that you cannot)

### Before restarting the server

**Always check for an active ingest first:**

```powershell
(Invoke-RestMethod http://127.0.0.1:8080/api/ingest/status).running
```

If `True`, **stop and ask the user** whether to wait or forcibly cancel before
proceeding. Restarting mid-ingest silently kills the subprocess and loses all progress.

HTML/JS edits to `rp_clipper/web/static/index.html` do **not** need a server restart.

## Project layout

```
rp_clipper/
  cli.py                   # Typer CLI — ingest / serve / score / export / demo
  config.py                # Config + profile management
  db/models.py             # SQLAlchemy ORM (SQLite, NullPool)
  ingest/                  # probe, labeler, extract, transcribe, segment
  scoring/                 # energy, scene, llm, engine
  web/
    app.py                 # FastAPI factory + lifespan (graceful shutdown)
    deps.py                # ProjectContext — shared server state
    sse.py                 # subprocess → SSE streaming helper
    routes/                # videos, ingest, profiles, demo, logs
    static/index.html      # Single-page UI (vanilla JS, no build step)
tests/
  conftest.py              # project_dir + client fixtures
  test_api.py              # API unit tests (TestClient, no live server)
  test_ui.py               # UI tests (Playwright against live server on :8080)
```

## Running tests

```powershell
.\scripts\test-api.ps1        # fast, no live server needed
.\scripts\test-ui.ps1         # requires live server at http://127.0.0.1:8080
```

Run at least `test-api.ps1` before reporting a backend fix as done.

## Current focus

**Phase 3 web UI — manual testing and bugfixing.** The pipeline is complete; the
goal is to get the web UI stable enough for regular use. Approach:

1. Try an action in the browser
2. If it fails, check `.rp-clipper\rp-clipper.log`
3. Fix the bug, restart the server, reproduce to confirm

## Code standards

### General
- No comments unless the WHY is genuinely non-obvious (hidden constraint, workaround, subtle invariant)
- No docstrings on internal functions — clear names are enough
- No error handling for things that can't happen; trust framework guarantees
- Don't add features beyond what the immediate task requires

### Python / backend
- SQLAlchemy sessions must be explicitly closed in route handlers — always use `try/finally: db.close()`
- All SQLite engines use `NullPool` (set in `make_engine`) — never change this; pooled connections block the ingest subprocess
- Ingest subprocess is always launched with `--no-interact` from the web UI
- `ctx.ingest_proc` tracks the running subprocess for cancellation and shutdown
- The FastAPI `lifespan` in `app.py` terminates `ingest_proc` on server exit (5 s grace then kill)
- For new route handlers that read the DB: follow the existing pattern in `routes/videos.py`

### JavaScript / frontend
- `escHtml(s)` must escape `"` → `&quot;` (used for `data-*` attributes in onclick delegation)
- Dynamic button lists must use event delegation (`el.onclick = e => { ... }`) not inline `onclick=` attributes with JS values — inline attributes break when names contain quotes
- SSE streams are tracked in `_activeES`; call `_activeES.close()` before starting a new one
- `startJobUI` / `endJobUI` / `streamSSE` are the canonical helpers for long-running jobs

## Known patterns and pitfalls

### SQLite locking
SQLite allows only one concurrent writer. The web server and the ingest subprocess are
separate processes. Fixes already in place:
- `NullPool` on all engines — connections close immediately
- `PRAGMA busy_timeout=30000` — subprocess waits 30 s before giving up
- Explicit `db.close()` in every route handler via `try/finally`

If you see `OperationalError: database is locked`:
- Most likely: a zombie ingest subprocess is still running. Check with
  `Get-WmiObject Win32_Process -Filter "name='python.exe'"` and kill any stale
  ingest processes before restarting the server.
- Less likely: a route handler is leaking a session (missing `try/finally: db.close()`).
- Also check: the server was not restarted after a Python change.

### Interactive labeling
`label_tracks()` must never be called interactively from the web UI. The CLI ingest
command always receives `--no-interact`; this causes `_label_non_interactive()` to
use track 0 as combined and mark the rest unlabeled without prompting.

### Subprocess cancellation
`POST /api/ingest/cancel` sets `ctx.ingest_cancelled = True` and calls
`proc.terminate()`. The SSE generator checks the flag after the process exits and
yields a `[Ingest cancelled]` message before the `__DONE__` sentinel.

### HTML safety
`escHtml` in `index.html` escapes `& < > "`. Always run profile names and filenames
through it before embedding in HTML attributes.
