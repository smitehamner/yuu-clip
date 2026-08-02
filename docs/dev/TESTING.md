# yuu-clip - testing reference (system/golden/electron tiers + fixture-server internals)

For the unit/integration/ui/js tier overview (what each needs, when to use it, the
`yuu-dev` command per tier) see [ARCHITECTURE.md](ARCHITECTURE.md)'s "Test tiers"
section - this file picks up where that one stops: the system/golden tiers, the
Electron wrapper suite, and the isolated fixture server `yuu-dev test-ui` stands up.

## System tier (`tests/system/`) - full-stack use-case tests

A fifth tier drives the **real** analyze pipeline (`pipeline.analyze_one`, the CLI's
`_analyze_one`/`_run_scoring` path) against a tiny ffmpeg-generated fixture video, then
exercises the rest of a use case through the FastAPI `TestClient` - one test per
automatable use case in `docs/dev/USE_CASES.md`. Only two seams are stubbed
(`transcribe/whisper_runner.transcribe_track` and the `scoring.llm_client` backend);
energy/scenes/laugh/visual scoring, the DB, routes, ffmpeg cut/encode, and SRT sidecars
all run for real. It needs ffmpeg on PATH (guard-skips otherwise) and no live server.

- Run it with `yuu-dev test-system` (writes `.test-logs/test-system-last.log` +
  `-summary.log`, mirroring test-api). It is a **pre-release gate, not a per-edit
  check**, and is deliberately excluded from `test-api`'s default selection (which stays
  ~1 min). `scripts/test-system.ps1` is a thin wrapper over the same command.
- Determinism: no real models/network, generated (not committed) fixture video, fixed
  transcript, exact-match assertions on what we control (durations, file existence, flag
  booleans, sidecar contents). The stubs and fixture live in `tests/system/conftest.py`
  and `tests/system/_stubs.py`.

### Golden path (opt-in, real models)

`tests/system/test_golden_path.py` (marked `golden`) is the one test that runs
**real** faster-whisper `tiny` + a **real** local LLM end to end - the wiring proof
behind UC-B01 / UC-B05 the stubbed tier can't give. It is **excluded from every
default run** (`test-system` runs `-m "not golden"`); run it with `yuu-dev
test-golden` / `scripts/test-golden.ps1`. It is env-gated (`YUU_GOLDEN_CLIP` = a
short spoken clip, `YUU_GOLDEN_LLM_MODEL` = a real text `.gguf`) and **skips - never
fails** - when an input, ffmpeg, the Whisper model, or a runnable local llama-server
is missing. A skip means the real models did NOT run, so `yuu-dev test-golden`
prints a loud banner with the skip reason; do not read a skip as a pass. It asserts
structure only (a clip exists, transcript non-empty, a description is present, an
export file lands), never exact model output.

## Release smoke (`yuu-dev release-smoke`) - live server, real HTTP/SSE

A sixth, distinct tier: it drives a **live** server over the wire (real HTTP/SSE
calls via a stdlib `urllib` client, not the in-process `TestClient`) with **real
models and real ffmpeg** - the whole point is that it can point at a **packaged
install's** bundled `ffmpeg.exe` / `llama-server.exe` / bundled venv, which the
system tier's stubs and the fixture server's isolated config never exercise. It
does not replace any tier above: the system tier stays the fast, deterministic,
stubbed-model gate; release smoke is the slow, real-model, real-server release
gate that walks the actual HTTP API surface end to end.

- Run it against an already-running server: `yuu-dev serve` (dev) or a packaged
  install (see `HOW-TO-RELEASE.md`'s "Test the build" step for the exact packaged
  invocation). It does not start a server itself.
- Media: a cached/downloaded real recording by default (see
  `testing/test-video-matrix.md`'s "Default release-gate recording"), a synthetic
  `testsrc`+`sine` fixture with a matching `.srt` sidecar as the offline fallback
  (loud SKIPPED note when it falls back), or `--media-dir <folder>` to point at any
  local footage.
- `--only <section>` runs one section (`core`, `editing`, `transcription`,
  `aggregate`, `config`, `housekeeping`); `--from <step>` resumes from a step
  number. Both need `--project <scratch dir>` when skipping the (slow) analyze
  step, pointed at a directory a prior `--keep`'d run already analyzed - a
  `bootstrap_state` pass re-derives the video/clip ids from the live server
  instead of replaying steps 1-3.
- What it does **not** cover: no browser (no UI/visual assertions), no installer,
  and none of the packaged-only surfaces a live HTTP client can't reach (the setup
  wizard, the native `yuu-media://` protocol, desktop lifecycle / orphan-process
  checks, notification sounds) - those stay a human walk, tracked in
  `testing/installed-app-checklist.md`.
- Every run writes a full report (every SSE frame captured, PASS/FAIL/SKIP per
  step, ending with the residual manual-only rows) to `.test-logs/` in a dev
  checkout, or the scratch root in a packaged install (`--report-dir` overrides).

## Electron wrapper tests (only when touching `electron/`)

The desktop wrapper has its own Node test suite, separate from the pytest suites
above (they don't cover `electron/`, and this doesn't cover them):

```powershell
cd electron; npm test        # node --test, no dependencies, ~0.2s
```

Run it only after changing files under `electron/` (e.g. `main.js`,
`gpu-detect.js`) - skip it for pure Python/web-UI changes.

Almost all of these are pure-unit (import a module, assert its logic). The one
exception is **`electron/test/smoke.test.js`** (e2e-use-cases Stage 5 / UC-G03): it
boots the **real** desktop shell (`electron main.js`) against a throwaway userData,
waits for the embedded server on `/api/status`, confirms the UI document loads with a
known root control, then asks the app to quit and asserts it leaves **no orphan
`python.exe`** - the packaging failure mode the pytest suites can't see. It is heavy
(a real Electron + Python boot, ~10 s) and **opt-in**: it skips unless `YUU_SMOKE=1`,
so plain `npm test` stays ~0.2 s. When enabled it also skips (with a clear reason) off
Windows, without the Electron runtime, without a python that can import `yuu_clip`, or
when port 8080 is already busy (stop any dev server first). It relies on main.js's
`YUU_SMOKE_BACKEND_PYTHON` seam: with that env var set, `ensureVenv()` is skipped and
the backend spawns with the supplied interpreter - the only way to boot the shell from
an unpackaged dev checkout (and handy for running the desktop shell against a dev venv
without building an installer). Run it with `YUU_SMOKE=1 npm test` (ensure
`ELECTRON_RUN_AS_NODE` is not set in your shell).

## Isolated fixture server (determinism)

`yuu-dev test-ui` stands up its own disposable server for the run: a freshly-seeded
fixture project (`build_fixture_project`, force-rebuilt each run) served on a free
port with an isolated global config (`YUU_CONFIG_DIR` -> a temp dir, so pure
`Config` defaults), then torn down (`yuu_clip/dev/uiserver.py`). It never touches -
or requires - the interactive `yuu-dev serve` :8080 server, so the suite is
deterministic regardless of your real project's data/config. Consequences for
writing ui tests: never assert a value that comes from your personal config - derive
it from `/api/config` or the known fixture seed (3 clips / 2 scenes with fixed
scores + statuses); and resolve on-disk project paths (reels, exports) via
`served_project_dir(page)` (conftest), never the repo root.

### Ad-hoc browser scripts against the live server

A bare one-off script (`python -c "from playwright.sync_api import sync_playwright; ..."`)
driving your interactive `:8080` server hangs on exit, not launch - the process never
returns to the shell even after its own last `print` has run. This is the same
upstream driver-teardown bug `_close_browser_unhang` below works around (landmine #9
in [ARCHITECTURE.md](ARCHITECTURE.md)), just without pytest's watchdog to unstick it.
Reproduces under both Git Bash and PowerShell - it is not shell-specific.

For a one-off script, apply the same close-then-kill pattern instead of a bare
`browser.close()`:

```python
import threading, subprocess
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    driver_pid = browser._impl_obj._connection._transport._proc.pid
    ...  # drive the page

    close_finished = threading.Event()
    def kill_if_stuck():
        if not close_finished.wait(2):
            subprocess.run(["taskkill", "/F", "/PID", str(driver_pid)],
                            capture_output=True, check=False, timeout=10)
    threading.Thread(target=kill_if_stuck, daemon=True).start()
    try:
        browser.close()
    except Exception:
        pass  # expected: "Connection closed while reading from the driver"
    finally:
        close_finished.set()
```

`browser.close()` raising that exact exception is expected, not a new failure - it
means the watchdog had to step in. Don't skip straight to `os._exit()` instead: `close()`
is what tells Chromium to exit; killing the driver before giving it that chance can
orphan the Chromium subprocess.

`yuu-dev test-ui` (full) runs 4 pytest-xdist workers by default (~711 tests, ~2.7
min, plus a few seconds to build + warm the fixture server); targeted runs scale
workers down to the selected file count (a single file runs in-process). Pass
`--sequential` only when debugging suspected worker-parallelism flakes.
`--changed` calls `scripts/select_ui_tests.py`, which maps changed source files to
their test files (fuzzy stem match, e.g. `videos.js` -> `test_ui_video`) and always
includes `tests/ui/test_ui_smoke.py`. The session `browser` fixture override in
`tests/ui/conftest.py` guards the Playwright teardown hang - see the comment there
before touching the teardown watchdogs. If the suite (or the app) feels slow, check
the server isn't degraded first: `curl` `/api/status` should answer in ~3ms, and the
serve process should sit near 0% CPU when idle.

## Tier boundaries (directory, not markers)

The tiers are split by **directory**, not markers. `pytest.ini` registers no custom
markers. A test that needs real installed packages / HF cache / OS state belongs in
`tests/integration`, never `tests/unit`. A unit test that references
`project_dir`/`client` fails at collection (no such fixture in the unit tier) - move
it to `tests/integration`, splitting the file if it mixes pure and seeded tests.
`tests/unit` must pass offline regardless of machine state.
