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

## Lightweight setups (you may not need the full install)

The full install below pulls a multi-GB machine-learning stack (torch, transformers,
mediapipe, faster-whisper) because the analyze pipeline depends on it. Two common kinds
of contribution skip it entirely:

- **Docs only** - editing Markdown under `docs/`, this file, or the README needs nothing
  but a text editor and `git`. There is no build step for docs; open a PR.
- **Web UI (JS / CSS) only** - the browser modules under `yuu_clip/web/static/` have a
  pure-logic test tier that runs with **Node alone, no Python**:

  ```bash
  npm install
  npm run test:js        # vitest (browser-less), ~10s
  npm run build:esm      # rebuild the committed bundles after editing any static/*.js
  ```

  The committed bundles (`bundle.esm.js`, `electron/setup.bundle.js`) and the stitched
  `index.html` are drift-guarded, so rebuild and commit them alongside your change. (If
  you have also done the full Python install below, `yuu-dev test-js` and `yuu-dev
  bundle` are the same thing wrapped.)

Only **pipeline, API, or web-server** work - anything that runs the app or its tests -
needs the full install below.

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
| `yuu-dev test-js` | JS unit layer (vitest); no browser, ~6s |
| `yuu-dev test-unit` | Python unit tier only (`tests/unit`); the fast inner loop |
| `yuu-dev test-integration` | Integration tier only (`tests/integration`, seeded DB) |
| `yuu-dev test-api` | Unit + integration together (combo of the two above); no live server needed |
| `yuu-dev test-all` | Every server-free tier in one go: js + unit + integration (not ui) |
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
- **`yuu-dev test-unit`** - the Python unit tier only (`tests/unit`); no DB seeding.
  This is the fast inner-loop check to run frequently while iterating.
- **`yuu-dev test-api`** - the full unit + integration tiers (a convenience combo of
  `test-unit` + `test-integration`). Required before submitting any backend change
  (route handler, pipeline, DB model, config parsing); the fast loop is not a
  substitute for it. ~1 minute.

Frontend / UI:

- **`yuu-dev test-ui`** runs the Playwright suite against a live server. You do **not**
  need a personal recording - build a seeded throwaway project and serve that instead:

  ```bash
  playwright install chromium                 # one-time browser download
  yuu-dev fixture-project                      # seeds build/fixture-project (clips + scenes)
  yuu-dev serve --project build/fixture-project
  yuu-dev test-ui --smoke                       # or --changed / the full suite
  ```

  The fixture uses an ffmpeg-generated few-second clip (and still seeds a usable DB if
  ffmpeg is absent - the smoke tier passes either way). `--smoke` runs a quick backstop;
  `--changed` runs the tests around your working-tree diff. If you already have your own
  analyzed project, plain `yuu-dev serve` (no `--project`) serves that instead.

Desktop wrapper (only when you touch `electron/`):

```bash
cd electron
npm test
```

CI runs `lint`, `typecheck`, `test-api`, and `test-js` on every pull request; keep them
all green. The ui (Playwright) tier is not run in CI - it needs a live server + seeded
project, so run it locally against a fixture project (above) before a frontend change.

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

## Changing the database schema

The project DB (`<project>/.yuu-clip/project.db`) is a user's library - it must survive an
app update that changes the schema, so schema changes go through **Alembic** migrations,
never a wipe-and-recreate. The app auto-migrates to the latest revision on startup after
a timestamped backup (`yuu_clip/db/migrate.py`); a user never runs a command. Migrations
are forward-only - recovery from a bad upgrade is restoring the `.pre-migration-*.bak`
file, not a downgrade.

The loop when you change `yuu_clip/db/models.py`:

1. Edit the model.
2. `yuu-dev migrate-new "short description"` - autogenerates a revision under
   `yuu_clip/db/migrations/versions/` from the models-vs-DB diff.
3. **Review the generated script.** SQLite cannot `ALTER`/`DROP` a column in place, so
   anything beyond an add-column must use Alembic batch operations (the env already sets
   `render_as_batch=True`); autogenerate output is a draft, not gospel.
4. Commit `models.py` and the new revision **together**.
5. `yuu-dev test-unit` runs the schema-drift guard (`tests/unit/test_migration_drift.py`),
   which fails until `alembic upgrade head` and the models agree - so a model change
   without a migration cannot land.

`yuu-dev migrate-status` shows the current vs latest revision; `yuu-dev migrate` applies
pending migrations by hand (the same thing the server does on boot). Every release must
also verify the upgrade path from the previous release's DB (see the release checklist).

## Terminology

`docs/dev/llm/GLOSSARY.md` is the authoritative term list. User-facing text (UI labels,
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

New to the codebase? Read [docs/dev/ARCHITECTURE.md](docs/dev/ARCHITECTURE.md) first -
it is the human on-ramp: the pipeline flow, the two-process model, the swappable-backend
seam, and the top landmines to avoid. The exhaustive file-by-file map lives under
"Project layout" in [CLAUDE.md](CLAUDE.md).
