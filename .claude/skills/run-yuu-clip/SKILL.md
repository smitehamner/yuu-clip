---
name: run-yuu-clip
description: Build, run, and visually verify yuu-clip's web UI. Use when asked to start yuu-clip, take a screenshot of its UI, or check that a frontend change actually renders/behaves correctly - not just that tests pass.
---

yuu-clip is a Python FastAPI backend + vanilla-ESM web UI, normally launched
via the `yuu-dev` CLI and driven headlessly with Playwright (no `chromium-cli`
or tmux available in this environment - `.claude/skills/run-yuu-clip/driver.py`
is the harness). Everything below was run for real in this environment while
building this skill; the Gotchas section is the reason the driver looks the
way it does.

All paths below are relative to the repo root.

## Prerequisites

Already set up in this repo's `.venv` - nothing to install. Verify if in doubt:

```
.venv\Scripts\python.exe -c "import playwright; print('ok')"
```

If that fails: `.venv\Scripts\python.exe -m pip install playwright && .venv\Scripts\python.exe -m playwright install chromium`.

## Build (only if you edited frontend JS/HTML)

The committed `yuu_clip/web/static/bundle.esm.js`, `electron/setup.bundle.js`,
and `yuu_clip/web/static/index.html` are generated artifacts - a UI change
under `yuu_clip/web/static/**/*.js` or `partials/**/*.html` will not appear in
the running app (or in `tests/unit/test_bundle_drift.py` /
`test_index_html_drift.py`) until you regenerate them:

```
.venv\Scripts\yuu-dev.exe bundle
```

## Run (agent path)

Start the dev server (detaches; prints its URL and exits, does not block):

```
.venv\Scripts\yuu-dev.exe serve --no-open
```

Poll instead of a fixed sleep:

```
curl -sf http://127.0.0.1:8080/api/status
```

Then drive it:

```
.venv\Scripts\python.exe .claude\skills\run-yuu-clip\driver.py
```

This launches Chromium, loads the app, dismisses the first-run Getting
Started modal, opens the New Recording panel, checks the disabled Start
Analysis button's hint text, and screenshots the panel to
`.claude/skills/run-yuu-clip/screenshots/new_recording_panel.png`. It prints
each step (`page loaded`, `new-recording panel open`, ...) and `DONE` on
success, or `FAILED: <reason>` with a non-zero exit code.

For a different flow, `import` from `driver.py` rather than writing a fresh
script from scratch:

| function | what it does |
|---|---|
| `open_page(playwright, url, timeout_ms)` | Launches Chromium, navigates, waits for the app shell (`#btn-analyze`) to exist. Returns `(browser, page)`. |
| `dismiss_getting_started(page)` | Closes the first-run modal if it's open (call this first - it intercepts every other click while open). |
| `finish(exit_code)` | Call this instead of `browser.close()` to end the process - see Gotchas. |

Stop the server when done:

```
.venv\Scripts\yuu-dev.exe serve --stop
```

## Run (human path)

```
.venv\Scripts\yuu-dev.exe serve
```

Opens a browser window against `http://127.0.0.1:8080`. Ctrl-C the terminal
or `yuu-dev serve --stop` to stop it; useless in a headless container.

## Test

```
.venv\Scripts\yuu-dev.exe test-unit
npm run test:js
npm --prefix electron test
```

`test-unit` is the Python unit tier (fast inner loop; ~2100 tests, ~2 min).
`test:js` is the vitest suite for `yuu_clip/web/static/**`. The electron
`npm test` covers `electron/*.js` (main process, wizard, packaging logic).
None of these render the page - they do not replace actually running the
driver above for a UI change.

---

## Gotchas

- **Never `wait_until="networkidle"`.** This app polls status/job state
  periodically, so the network never goes fully idle - `page.goto(url,
  wait_until="networkidle")` was observed to hang past Playwright's own 30s
  goto timeout with the process still "running" and zero output. Use
  `wait_until="load"` plus an explicit `page.wait_for_selector(...)` for a
  known element (`open_page()` does this) - that is the real "ready" signal.
- **`browser.close()` can hang outright on Windows** - not raise, just block
  forever - even after every real step (navigation, clicks, the screenshot
  write) already succeeded and the PNG was already on disk. `try/except`
  does not help against a hang, only a raise. `driver.py`'s `finish()` calls
  `os._exit()` instead of a clean `with sync_playwright()` teardown once the
  real work is done - use it rather than `browser.close()` directly.
- **Don't guess selectors.** `#btn-new-recording` looks like the obvious
  guess for the "+ New Recording" button; the real id is `#btn-analyze`
  (`yuu_clip/web/static/partials/regions/header.html`). A wrong guess doesn't
  fail fast - `.click()` sits in Playwright's actionability-retry loop for
  the full default timeout instead. Grep
  `yuu_clip/web/static/partials/**/*.html` and the relevant `*.js` for the
  real id before writing a selector, and always set an explicit short
  timeout (`page.set_default_timeout(...)`, 5-10s) so a wrong guess fails in
  seconds, not minutes.
- **The Getting Started modal auto-opens on first run** (`#getting-started-modal`,
  toggled via a `visible` class) and intercepts clicks on everything behind
  it. Call `dismiss_getting_started(page)` immediately after `open_page()`,
  before any other interaction. Close button: `#getting-started-x-btn`.
- **Flush every print.** Python's stdout to a piped/redirected output (which
  is what you get running this under `run_in_background` or similar) is
  block-buffered, not line-buffered - a script that's genuinely still
  running but hasn't hit a flush point yet looks byte-for-byte identical to
  a script that's dead. `print(..., flush=True)` after every real step is
  what makes a hang diagnosable instead of a silent black box.

## Troubleshooting

- **A `run_in_background` driver run shows an empty output file and never
  completes**: almost always the `browser.close()` hang above, not a real
  problem - check whether the expected screenshot file already exists on
  disk (it usually does) before assuming the run failed. Stop the task and
  re-run with the `finish()`-based driver rather than waiting it out.
- **`.click()` times out on a selector you were confident about**: the
  element probably has a different real id/class than assumed - re-grep the
  partial/JS source rather than guessing a second name.
