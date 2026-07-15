# YuuClip - architecture and landmines (human on-ramp)

Read this once before you touch the code. It gives you the mental model - how the
pieces fit and where the traps are - so you can add a feature or fix a bug without
stepping on the sharp edges that are otherwise only documented for the in-repo
assistant.

Where this sits in the docs:

- **[CONTRIBUTING.md](../../CONTRIBUTING.md)** - setup, the `yuu-dev` CLI, and the PR
  process. Start there to get a working checkout.
- **This file** - the mental model plus the top landmines, in prose you read once.
- **[CLAUDE.md](../../CLAUDE.md)** - the exhaustive assistant-context file. It carries
  the full `Project layout` file-by-file map and every convention. When this doc says
  "see the layout map", it means the `Project layout` section there. Do not expect to
  read all 26KB of it to get oriented - that is what this file is for.

---

## The mental model

### Pipeline flow

A recording moves through five stages. The first four are the analyze pipeline; the
last is a separate user action.

```
analyze  ->  transcribe  ->  score  ->  review  ->  export
```

- **Analyze** (code: `ingest`) orchestrates one recording end to end: inspect the file,
  label audio tracks, extract per-track WAV, detect overlapping tracks, transcribe,
  generate clip candidates, and score them. The orchestration lives in
  [pipeline/ingest.py](../../yuu_clip/pipeline/ingest.py).
- **Transcribe** runs speech-to-text per eligible track (Whisper by default) and stores
  segments.
- **Score** ranks each clip candidate on four axes - Funny, Dramatic, Action, Visual.
  Most of the signal is model-free (laughter, keyword lexicon, prosody, speech-rate,
  energy, scene cuts, on-screen motion); a local LLM *adds* a semantic read plus the
  written descriptions on top. The app is useful with no model installed - the LLM is
  additive, not load-bearing for ranking.
- **Review** is the web UI: a human approves, rejects, edits, and splits clips.
- **Export** cuts approved clips (and optional highlight reels) with captions and title
  cards.

The stage-by-stage mechanics live in
[docs/dev/CLI-AND-INTERNALS.md](CLI-AND-INTERNALS.md); the user-facing meaning of each
score is in the user feature guide.

### Process model: two processes, one SQLite file

This is the single most important thing to internalize.

- The **web server** (FastAPI, [web/app.py](../../yuu_clip/web/app.py)) serves the UI
  and the API. It is long-lived.
- **Analyze runs in a separate subprocess**, launched by the server with
  `--no-interact`. It is the thing doing the heavy CPU/GPU work. The server tracks it
  through `ctx.analyze_job` (an `AnalyzeJob`, [web/analyze_job.py](../../yuu_clip/web/analyze_job.py))
  for cancellation, reconnection, and clean shutdown.

Both processes open the **same SQLite database**. SQLite allows only one writer at a
time, so the two processes contend. Everything in the "SQLite discipline" landmine below
exists to keep that contention from turning into `database is locked` errors.

Progress from the subprocess reaches the browser over **SSE** (server-sent events); the
plumbing is in [web/sse.py](../../yuu_clip/web/sse.py). Long-running jobs on the frontend
go through the `startJobUI` / `endJobUI` / `streamSSE` helpers, not ad-hoc fetches.

### The swappable-backend seam

Every model-backed capability sits behind the same shape, so a backend can be swapped or
added without touching callers. This is a hard convention - keep it even where there is
only one implementation today.

The shape is always:

- an **ABC** (or `Protocol`) defining the capability, exposing an availability probe
  `available() -> (ok, reason)`;
- a single **`make_*(config)` factory** keyed on a `*_backend` config value, with a
  `_BACKEND_*` lookup table;
- callers go **only** through the factory. They never import a concrete backend class,
  and there is no caller-side `if backend == ...`.

The canonical example is the LLM seam:
[scoring/llm_client.py](../../yuu_clip/scoring/llm_client.py) - `LLMClient` (ABC),
`make_client` ([llm_client.py:167](../../yuu_clip/scoring/llm_client.py#L167)) keyed on
`llm_backend`, `_BACKEND_CLIENTS` ([llm_client.py:158](../../yuu_clip/scoring/llm_client.py#L158)),
with `LlamaCppServerClient` (local) and `NullLLMClient`
([llm_client.py:112](../../yuu_clip/scoring/llm_client.py#L112)) as the fallback.
`make_client` is also the single point that enforces AI-privacy policy - it returns
`NullLLMClient` when generative AI is off. YuuClip is local-only by design; there is no
remote/hosted backend and no "send my transcript to an API" path.

The other seams follow the same pattern: transcription (`Transcriber` +
`make_transcriber`), diarization (`DiarizationClient` + `make_diarization_client`),
similarity/embeddings (`make_backend`), and scorers (the `Scorer` `Protocol` in
[scoring/protocol.py](../../yuu_clip/scoring/protocol.py), assembled by
[scoring/scorer_set.py](../../yuu_clip/scoring/scorer_set.py)). To add a backend:
implement the interface, register it in that module's `_BACKEND_*` dict, add the
`*_backend` value. The full seam list is in CLAUDE.md.

---

## The landmines

These are the traps that bite people who have only read CONTRIBUTING.md. Each is real
and each has bitten before.

### 1. Frontend: the `window` export-list contract (current state, changing)

**Time-sensitive - this contract is being retired by WS5 of the distribution-polish
plan (the frontend build step). If you are reading this after WS5 has landed real ESM
`import`/`export` modules, this section is stale; update or delete it.**

The web UI has no build step yet. It is ~45 hand-authored modules under
[web/static/](../../yuu_clip/web/static/) loaded as plain `<script>` tags, coordinating
through the global `window` object. A function is only visible to another module if it
is explicitly published onto `window`.

Most modules wrap their code in an IIFE closure and publish their public symbols with a
single `Object.assign(window, {...})` block at the bottom. [videos.js](../../yuu_clip/web/static/videos.js)
is the clearest example: the whole file is `(function () { ... })()`
([videos.js:1](../../yuu_clip/web/static/videos.js#L1)), and its public API is the
`Object.assign(window, {...})` list at
[videos.js:930](../../yuu_clip/web/static/videos.js#L930).

**The gotcha:** if you write a new function inside an IIFE-wrapped module and another
module (or an inline `onclick`, or a test) calls it, it will be `undefined` at the call
site unless you add its name to that module's `Object.assign(window, {...})` export
list. There is no compile-time check - you find out at runtime, in the browser. When you
add a cross-module function, add it to the export list in the same edit.

(This entire pattern is exactly why WS5 introduces a bundler and real modules - a
forgotten export becomes a build error instead of a silent runtime `undefined`.)

### 2. Two parallel model-selection stacks - hand-sync them

Model selection exists in **two separate stacks that cannot share code**. A change to
one must be mirrored in the other by hand.

- **In-app Settings** - browser JS (`web/static/settings.js`, `modelcatalog.js`) ->
  HTTP -> Python [model_catalog.py](../../yuu_clip/model_catalog.py) + the `download-gguf`
  CLI.
- **Electron setup wizard** - renderer (`electron/setup.html`) -> IPC ->
  [electron/main.js](../../electron/main.js) handler `setup:download-gguf-model`
  ([main.js:341](../../electron/main.js#L341)), which downloads the hardcoded
  `DEFAULT_LLAMACPP_MODEL` ([electron/constants.js:43](../../electron/constants.js#L43))
  with Node and writes `config.json` directly.

They genuinely cannot be DRY-ed: different runtimes (browser vs Electron/Node), and the
wizard runs **before the Python server exists**, so it cannot call the endpoints Settings
depends on. Consequences:

- The wizard's `DEFAULT_LLAMACPP_MODEL` duplicates a `model_catalog.py` entry. Keep its
  id and filename matching a *recommended* catalog entry so the two catalogs do not
  drift.
- The wizard only ever sets the **text** model (`llm_model_path`). If it ever gains
  vision-model selection it must write `llm_vision_model_path`, never `llm_model_path` -
  a vision download must not clobber the text scorer.

### 3. SpeechBrain must not be imported before `transformers.pipeline` resolves

Importing `speechbrain` before `transformers.pipeline` is first resolved forces that
resolution to load speechbrain's k2 integration, which hard-imports the unbundled `k2`
package and dies with `ModuleNotFoundError: k2`. In the analyze subprocess, diarization
(speechbrain) runs before scoring (transformers), so audio-event and laugh scoring would
silently die for the whole run.

The fix is a pre-warm: `ingest.py` resolves `transformers.pipeline` via
`prewarm_transformers_pipeline()` ([ingest.py:238-240](../../yuu_clip/pipeline/ingest.py#L238-L240))
*before* diarization imports speechbrain. If you reorder the analyze pipeline, keep that
call ahead of any speechbrain import.

This only surfaces with the real packages installed - the pytest venv mocks both, so it
passes tests and fails in a real offline install. Re-verify against a real install when
you touch pipeline ordering.

### 4. SQLite single-writer discipline

Because the server and the analyze subprocess share one SQLite file (see the process
model above), three rules are non-negotiable:

- **`NullPool` on every engine.** Set in `make_engine`
  ([db/models.py:69](../../yuu_clip/db/models.py#L69)). Connections close immediately so
  a pooled server connection cannot hold a lock and block the subprocess's INSERT. Never
  change this to a pooled class. A 30 s `busy_timeout` PRAGMA
  ([db/models.py:75-77](../../yuu_clip/db/models.py#L75-L77)) gives a blocked writer time
  to wait rather than fail instantly.
- **Every route handler that opens a session must close it in `try/finally`.** See the
  pattern in [routes/videos.py:83-95](../../yuu_clip/web/routes/videos.py#L83-L95). A
  leaked session is a held connection is a lock.
- **If you see `OperationalError: database is locked`:** the usual cause is a zombie
  analyze subprocess still holding the file (kill it and restart the server), or a route
  handler leaking a session, or the server not being restarted after a Python change.

---

## Where do I change X?

| Task | Go to |
| --- | --- |
| **Add a scoring axis / signal** | Implement the `Scorer` `Protocol` ([scoring/protocol.py](../../yuu_clip/scoring/protocol.py)) and wire it into `build_clip_scorers` ([scoring/scorer_set.py:19](../../yuu_clip/scoring/scorer_set.py#L19)) so full-rescore picks it up. |
| **Add an API route** | Add a module under [web/routes/](../../yuu_clip/web/routes/) and follow the `try/finally: db.close()` pattern in [routes/videos.py](../../yuu_clip/web/routes/videos.py). |
| **Add a Settings control** | Both the browser JS (`web/static/settings.js`) and the Python config/catalog side. If it selects a model, remember landmine #2 - mirror it in the Electron wizard by hand. |
| **Add a model backend** (LLM, transcription, diarization, similarity) | Implement the seam's ABC/Protocol, register it in that module's `_BACKEND_*` dict, add the `*_backend` config value. Never add a caller-side `if backend == ...`. Start from the LLM seam in [scoring/llm_client.py](../../yuu_clip/scoring/llm_client.py). |
| **Add a cross-module frontend function** | Add it to the module's `Object.assign(window, {...})` export list in the same edit (landmine #1). |
| **Change the analyze pipeline order** | [pipeline/ingest.py](../../yuu_clip/pipeline/ingest.py) - keep the `prewarm_transformers_pipeline()` call ahead of any speechbrain import (landmine #3). |
| **Find any other file** | The full file-by-file map is the `Project layout` section of [CLAUDE.md](../../CLAUDE.md). |

---

## Terminology

User-facing text uses the glossary terms in
[docs/dev/llm/GLOSSARY.md](llm/GLOSSARY.md), even where the code identifier differs (the
UI says "Analyze", the code says `ingest`; the UI says "World context", the code says
`world_context`). Define a concept in the glossary before introducing it, and use the
user-facing term in conversation too.
