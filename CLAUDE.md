# yuu-clip — Claude Code context

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

## Project layout

```
yuu_clip/
  cli.py                   # Typer CLI — ingest / serve / score / export / demo
  config.py                # Config + profile management
  db/models.py             # SQLAlchemy ORM (SQLite, NullPool)
  analyze/                 # probe, labeler, extract, overlap
  scoring/                 # energy, scene, llm, engine
  segments/                # windower (sliding-window clip generation)
  transcribe/              # whisper_runner
  web/
    app.py                 # FastAPI factory + lifespan (graceful shutdown)
    deps.py                # ProjectContext — shared server state
    sse.py                 # subprocess → SSE streaming helper
    routes/                # videos, analyze, profiles, reel, contexts, logs
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
2. If it fails, check `.yuu-clip\yuu-clip.log`
3. Fix the bug, restart the server, reproduce to confirm

## Terminology

The authoritative term list is in `docs/GLOSSARY.md`. Read it before introducing any
new concept, and follow these rules:

- **User-facing text** (UI labels, button text, toast messages, error messages, CLI
  help text, docs) must use the glossary term — not the code name.
- **Code names** (Python identifiers, JS variable names, API route paths, DB column
  names) may differ from the user-facing term. The glossary records both under
  "Code:" and "Also called in codebase:".
- **When you add a new concept**: define it in the glossary first, then use that
  term everywhere from the start. Don't name it one thing in code and something
  else in the UI without documenting the split.
- **When a concept is renamed**: update `docs/GLOSSARY.md`, then update all
  user-facing strings. Code identifiers can be left for a separate refactor pass —
  but the glossary entry must note the divergence under "Also called in codebase:".

Key terms to get right (common sources of drift):
- "Analyze" / "Analysis" — not "Ingest" in user-facing text (code: `ingest`)
- "Inspect" — not "Probe" in user-facing text (code: `probe()`)
- "Track layout" — not "Profile" in user-facing text (code: `profile`)
- "World context" — not "RP context" in user-facing text (code: `world_context`)
- "LLM scoring" — not "AI scoring"
- "Clip" — not "clip candidate" in user-facing text (code: `ClipCandidate`)
- "Unreviewed" — not "Pending" in user-facing text (code: `status = 'pending'`)
- "Highlight reel" — not "demo reel" in user-facing text (code: `demo_reel`)

## Behavior
- Never cd into the current working directory before running a command
- Always use approved project scripts (`.\scripts\*.ps1`) — never raw python calls outside the venv
- Ask before touching files outside the current task scope
- If uncertain about approach, stop and ask rather than proceeding with assumptions
- Be concise in responses — no preamble, no "I've completed..." summaries
- State what changed and why, nothing else

## Testing
- Tests before or alongside implementation, never after
- Test behavior, not implementation
- If you change existing code, verify existing tests still make sense
- Run `.\scripts\test-api.ps1` before reporting any backend fix as done

## Code standards

### General
- No comments unless the WHY is genuinely non-obvious (hidden constraint, workaround, subtle invariant)
- No docstrings on internal functions — clear names are enough
- No error handling for things that can't happen; trust framework guarantees
- Don't add features beyond what the immediate task requires
- Methods/functions under 30 lines — decompose and flag if longer
- No duplication — if similar logic appears twice, extract it
- Names must be descriptive — no `x`, `tmp`, `data`, `result`, `val`
- Error paths must be handled explicitly, not silently swallowed
- One concern per function

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
`label_tracks()` must never be called interactively from the web UI. The CLI analyze
command always receives `--no-interact`; this causes `_label_non_interactive()` to
use track 0 as combined and mark the rest unlabeled without prompting.

### Subprocess cancellation
`POST /api/analyze/cancel` sets `ctx.ingest_cancelled = True` and calls
`proc.terminate()`. The SSE generator checks the flag after the process exits and
yields a `[Analysis cancelled]` message before the `__DONE__` sentinel.

### HTML safety
`escHtml` in `index.html` escapes `& < > "`. Always run track layout names, context
names, and filenames through it before embedding in HTML attributes.
