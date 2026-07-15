# Contributing to YuuClip

Thanks for your interest. YuuClip is a local-first desktop tool for finding the best
moments in long talk-heavy recordings. It is maintained by one person, so please open
an issue to discuss anything non-trivial before sending a large PR - it saves us both
time if the direction needs a conversation first.

By contributing you agree that your contribution is licensed under the project's
[Apache License 2.0](LICENSE).

## Platform notes (read this first)

The **core** (the Python pipeline, web server, and the `yuu-dev` developer CLI) is
cross-platform and runs on Windows, macOS, and Linux. Two areas are Windows-oriented
and only fully exercised there:

- **Packaging / release** - the desktop build and the `scripts/*.ps1` helpers target
  Windows.
- **UI tests** - the Playwright suite is primarily validated on Windows.

You do not need Windows to work on the pipeline, API, or web UI. FFmpeg-driven and
API-level tests run anywhere.

## Prerequisites

- **Python 3.11 - 3.13**
- **FFmpeg** on your `PATH` (`ffmpeg -version` should work)
- **git**
- **Node 18+** - only if you touch `electron/`

## Setup

```bash
git clone https://github.com/smitehamner/yuu-clip
cd yuu-clip
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -e ".[dev]"
```

That installs the app plus the test and lint tooling and puts two commands on your
path: `yuuclip` (the app) and `yuu-dev` (the developer CLI).

## The `yuu-dev` developer CLI

`yuu-dev` is the canonical, cross-platform entry point for every dev-loop task. Use it
directly on any OS:

| Command | What it does |
| --- | --- |
| `yuu-dev serve` | Start the dev web server (defaults to http://127.0.0.1:8080) |
| `yuu-dev status` | Report whether a job is processing (query before restarting) |
| `yuu-dev lint` | Run ruff over `yuu_clip` and `tests` (`--fix` to auto-fix) |
| `yuu-dev test-api` | Unit + integration tests (no live server needed) |
| `yuu-dev test-ui` | Playwright UI suite against a running dev server |
| `yuu-dev logs --follow` | Tail the server log |

The `scripts/*.ps1` files are thin **Windows-only aliases** to these commands, kept for
muscle memory. On macOS/Linux, call `yuu-dev` directly.

## Running the app

```bash
yuu-dev serve
```

Then open http://127.0.0.1:8080 and use **+ Analyze** to add a recording.

## Tests and linting

Run these before opening a PR:

- **`yuu-dev lint`** - fast; run it after any Python change (even cosmetic ones).
- **`yuu-dev test-api`** - the unit + integration tiers. Required before submitting any
  backend change (route handler, pipeline, DB model, config parsing). ~1 minute.

Frontend / UI:

- **`yuu-dev test-ui`** runs the Playwright suite. It needs a live server, so first run
  `yuu-dev serve` (with at least one analyzed video in the dev project), install the
  browser once with `playwright install chromium`, then run the tests. `--smoke` runs a
  quick backstop; `--changed` runs the tests around your working-tree diff.

Desktop wrapper (only when you touch `electron/`):

```bash
cd electron
npm test
```

CI runs `lint` and `test-api` on every pull request; keep both green.

## Code standards

Full details live in [CLAUDE.md](CLAUDE.md) (which doubles as the architecture map and
the assistant-context file). The essentials:

- Comments only when the *why* is genuinely non-obvious. No docstrings on internal
  functions - clear names instead.
- Functions under ~30 lines, one concern each. No duplication - extract shared logic.
- Descriptive names; handle error paths explicitly; add no features beyond the task.
- **Frontend:** never hardcode colors. Every color is a `var(--token)` theme token (see
  the top of `yuu_clip/web/static/app.css`).
- **ASCII only in authored text, console output, and commit messages.** The legacy
  Windows console encodes stdout as cp1252, so non-ASCII glyphs crash it. No em-dashes
  anywhere - use a spaced hyphen ( - ).
- `.ps1` files that contain any non-ASCII must be saved with a UTF-8 BOM (enforced by
  `tests/unit/test_ps1_bom.py`).

## Terminology

`docs/dev/GLOSSARY.md` is the authoritative term list. User-facing text (UI labels,
messages, docs) must use the glossary term, even where the code identifier differs
(for example the UI says "Analyze", the code says `ingest`). Define a new concept in
the glossary before introducing it.

## Dependency and model licensing

- No GPL/AGPL dependencies (including transitive ones). LGPL, MPL, and permissive
  licenses are fine. Check a dependency's license before adding it.
- Any model YuuClip **recommends or defaults to** must carry a license that lets users
  monetize the output - Apache-2.0 / MIT / BSD. Llama- and Gemma-licensed models are
  out of the defaults and recommendations (they keep working if a user configures one
  by hand). The authoritative list is `yuu_clip/model_catalog.py`, enforced by
  `tests/unit/test_model_catalog.py`.

## Pull requests

1. Branch from `main` and keep each PR focused on one change.
2. Make sure `yuu-dev lint` and `yuu-dev test-api` are green; add or update tests
   alongside the change, not after.
3. Fill out the PR template.

Where things live is mapped under "Project layout" in [CLAUDE.md](CLAUDE.md).
