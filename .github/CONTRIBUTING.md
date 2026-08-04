# Contributing to YuuClip

Thanks for your interest. YuuClip is a local-first desktop tool for finding the best
moments in long talk-heavy recordings. It is maintained by one person, so please open
an issue to discuss anything non-trivial before sending a large PR - it saves us both
time if the direction needs a conversation first.

By contributing you agree that your contribution is licensed under the project's
[Apache License 2.0](../LICENSE).

## Development approach

Most of this codebase was written through AI-assisted development (Claude Code): the
maintainer directs architecture, writes the plans, and reviews every change, but an AI
agent authors most of the code itself. This isn't vibe coding - nothing lands without
review - but it's worth knowing going in, since it shapes how consistent the code style
is and how much is documented in `docs/dev/`. The code standards below apply to every
contribution regardless of how it was authored.

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

| Command | What it does | Run when |
| --- | --- | --- |
| `yuu-dev serve` | Start the dev web server (defaults to http://127.0.0.1:8080) | Working on the app interactively |
| `yuu-dev status` | Report whether a job is processing | Before restarting the server |
| `yuu-dev lint` | Run ruff over `yuu_clip` and `tests` (`--fix` to auto-fix) | After any Python change, even cosmetic |
| `yuu-dev typecheck` | Mypy gate that fails only on NEW type errors (existing ones are frozen in `mypy-baseline.txt`) | Before submitting any Python change |
| `yuu-dev test-js` | JS unit layer (vitest); no browser, ~6s | After editing any `static/*.js` |
| `yuu-dev test-unit` | Python unit tier only (`tests/unit`); the fast inner loop | Frequently while iterating on Python |
| `yuu-dev test-integration` | Integration tier only (`tests/integration`, seeded DB) | When isolating an integration failure |
| `yuu-dev test-api` | Unit + integration together; no live server needed | Before submitting any backend change |
| `yuu-dev test-all` | Every server-free tier in one go: js + unit + integration (not ui) | A broad pre-PR sweep |
| `yuu-dev test-ui` | Playwright UI suite; stands up its own disposable fixture server (nothing else needs to be running) | Before submitting a frontend change |
| `yuu-dev bundle` | Rebuild the committed frontend artifacts: `bundle.esm.js`, the wizard's `setup.bundle.js`, and the stitched `index.html`; also regenerates `shared-data` first | After editing any `static/*.js`, a partial under `static/partials/`, `index.src.html`, or one of the shared-data source modules below |
| `yuu-dev shared-data` | Regenerate the `catalog-data.json` that both the web Settings and the setup wizard read (two committed copies) | Rarely needed directly - `yuu-dev bundle` already runs it; use this only for a data-only edit to `model_catalog.py` / `config.py` / `content_presets.py` / `whisper_catalog.py` where nothing else needs rebundling |
| `yuu-dev fixture-project` | Build a seeded throwaway project under `build/fixture-project` | To browse a seeded project interactively: `yuu-dev serve --project build/fixture-project` |
| `yuu-dev logs --follow` | Tail the server log | Debugging a running server |

On the typecheck gate: annotate as you touch. When your change surfaces a new mypy
error, fix the code (or add the missing annotation) - do not just re-freeze the
baseline (`yuu-dev typecheck --sync` is only for genuinely accepted pre-existing gaps,
and the regenerated `mypy-baseline.txt` is committed).

The `scripts/*.ps1` files are thin **Windows-only aliases** to these commands, kept for
muscle memory. On macOS/Linux, call `yuu-dev` directly.

## Running the app

```bash
yuu-dev serve
```

Then open http://127.0.0.1:8080 and use **+ New Recording** to add a recording.

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

- **`yuu-dev test-ui`** is fully self-contained: each run builds a freshly-seeded
  fixture project, serves it on a free port with an isolated config, points Playwright
  at it, and tears everything down afterwards. You do **not** need a personal
  recording, a running dev server, or anything on `:8080`. The only one-time setup is
  the browser download:

  ```bash
  playwright install chromium                 # one-time browser download
  yuu-dev test-ui --smoke                     # or --changed / the full suite
  ```

  The fixture uses an ffmpeg-generated few-second clip (and still seeds a usable DB if
  ffmpeg is absent - the smoke tier passes either way). `--smoke` runs a quick backstop;
  `--changed` runs the tests around your working-tree diff plus the smoke backstop.

  To poke at the same seeded project interactively (not needed for the tests), build
  one by hand: `yuu-dev fixture-project`, then
  `yuu-dev serve --project build/fixture-project`.

Desktop wrapper (only when you touch `electron/`):

```bash
cd electron
npm test
```

CI runs `lint`, `typecheck`, `test-api`, and `test-js` on every pull request; keep them
all green. The ui (Playwright) tier is not run in CI - it drives a real browser against
a live server, so run it locally (it self-hosts everything, above) before a frontend
change.

## If your change touches user-visible behavior

Two registries keep the docs and tests honest about what the app does. When your
change alters user-visible behavior, a default, a recommended model, the scoring
axes, or a documented number:

- **[docs/dev/llm/DOC-CLAIMS.md](../docs/dev/llm/DOC-CLAIMS.md)** - the fact registry.
  Find the affected fact's row and update the code AND **every surface listed in that
  row** in the same change (README, user guides, UI copy, wizard, ...). Fact guards in
  `tests/unit/test_doc_claims.py` fail when a listed surface drifts.
- **[docs/dev/USE_CASES.md](../docs/dev/USE_CASES.md)** - the end-to-end use-case
  catalog. Adding or materially changing a user-facing flow means adding/updating its
  `UC-` entry there and its matching row in
  [docs/dev/testing/installed-app-checklist.md](../docs/dev/testing/installed-app-checklist.md)
  (structure enforced by `tests/unit/test_use_case_catalog.py`).

## Code standards

Full details live in [CLAUDE.md](../CLAUDE.md) (which doubles as the architecture map and
the assistant-context file). The essentials:

- Comments only when the *why* is genuinely non-obvious. No docstrings on internal
  functions - clear names instead.
- Functions under ~30 lines, one concern each. No duplication - extract shared logic.
- Descriptive names; handle error paths explicitly; add no features beyond the task.
- **Frontend:** never hardcode colors. Every color is a `var(--token)` theme token
  defined in `yuu_clip/web/static/shared/tokens.css`.
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

`main` is protected: it is always releasable, every change reaches it through a pull
request, and CI must be green before merge. This applies to the maintainer too - there
are no direct pushes to `main`. Branches are short-lived; delete yours after the merge.

1. Branch from `main` and keep each PR focused on one change. Name it for the change
   (`fix/export-progress-stall`, `docs/contributing-links`) - the prefix is a
   convention, not enforced.
2. Make sure `yuu-dev lint` and `yuu-dev test-api` are green; add or update tests
   alongside the change, not after.
3. Fill out the PR template.
4. Merge once CI passes. Prefer **squash merge** so `main` keeps one commit per change.

New to the codebase? Read [docs/dev/ARCHITECTURE.md](../docs/dev/ARCHITECTURE.md) first -
it is the human on-ramp: the pipeline flow, the two-process model, the data model, the
swappable-backend seam, and the top landmines to avoid. The exhaustive file-by-file map
is [docs/dev/LAYOUT.md](../docs/dev/LAYOUT.md).
