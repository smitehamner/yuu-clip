# Review decisions - deliberate keep-as-is calls

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` to make that explicit. It exists
> so an automated review does not re-flag something a human already decided to keep.

Organized by area, not by review session - when a future pass revisits a decision
here, update the entry in place (revise the rationale, bump the date) rather than
appending a new one. Only entries a fresh review pass would plausibly re-flag
without this record belong here; a routine "reviewed, it's fine" is not a decision
and does not belong in this file.

---

## Architecture policy (product-level, locked)

### Setup wizard scope stays minimum-viable, never grows toward Settings parity
Decision: Keep as-is.
Rationale: The wizard picks/downloads ONE text LLM model and writes `config.json`,
nothing more - vision model, Whisper size, scoring weights, hot words, etc. are
Settings-only. Wizard and Settings are two parallel model-selection stacks that
cannot share runtime code (browser vs. Electron main/Node; the wizard runs before
the Python server exists). `yuu-dev shared-data` syncs the catalog *data*
(`catalog-data.json`) but can't see *behavior* duplication - the wizard's
downloader and `cli/models.py download-gguf` are independent implementations with
independently-evolved retry/resume/verify, so every wizard feature doubles that
invisible surface. Any wizard scope expansion must be a deliberate, separately
reviewed decision, and must write the correct config key
(`llm_vision_model_path`, never `llm_model_path` - enforced by
`test_shared_data_drift.py`). `electron/gpu-detect.js`/`recommend-model.js`'s
sizing thresholds are wizard-only recommendation heuristics, not a hand-copied
Python literal, so no cross-language drift check applies to them either.
Last confirmed: 2026-07-26.

### `transcribe/align.py` stays plain functions, not the ABC+factory seam pattern (ARCH-3)
Decision: Keep as-is.
Rationale: No `alignment_backend` config value, one implementation
(torchaudio WAV2VEC2_ASR_BASE_960H, English-only), and the single caller
(`web/routes/common.py`) never probes availability - it just falls back to a
static caption line on `None`. A factory + Null backend for one best-effort
function would be speculative generality. Promote to the seam pattern only if a
second aligner needs selecting/gating.
Last confirmed: 2026-07-26.

### Out-of-process vision analysis bypasses the `LLMClient` seam by design (ARCH-4)
Decision: Keep as-is.
Rationale: `pipeline/frame_analysis.py` -> `scoring/llm.describe_frames_via_server`
POSTs straight to the parent web server's already-warm llama-server instead of
constructing an `LLMClient` inside the subprocess. Building a client in-process
would spawn a second server and re-load the multi-GB vision model - the exact
double-load this out-of-process design avoids. In-process vision
(`describe_frames`) does go through the seam. A new backend would need its own
out-of-process mechanism for cancelable frame analysis (documented in
`llm_client.py`'s `vision_payload_messages` docstring).
Last confirmed: 2026-07-24.

---

## AI/model backend seams (scoring, LLM, similarity)

### Three read-side generative-AI pre-checks are deliberate defense-in-depth, not DRY-able
Decision: Keep as-is.
Rationale: `check_llm_available`, `check_vision_available`, and
`LLMScorer.is_available` each independently re-check the `llm_enabled`+`allow_llm`
gate before delegating to `available()`. The real enforcement point is
`make_client` (returns `NullLLMClient` when generative AI is off); each check
re-asserting the gate is intentional layering on a privacy trust boundary.
Collapsing them into one helper would turn independent checks into a single point
of failure. Do not re-flag as DRY.
Last confirmed: 2026-07-26.

### `check_vision_available` inlines its own path checks rather than a `vision_available()` seam method
Decision: Keep as-is.
Rationale: There is exactly one LLM backend, and the same knowledge already lives
behind the seam as the hard backstop (`LlamaCppServerClient.chat_vision` raises
`VisionNotSupportedError` with the same checks - the "cheap pre-check + hard
backstop" split). Adding a seam method for one implementation is speculative
generality. Promote-to-seam trigger: a second LLM backend with different
vision-availability semantics.
Last confirmed: 2026-07-26.

### Scorer availability surface: `is_available() -> bool` plus an optional `available() -> (bool, reason)` - kept asymmetric
Decision: Keep as-is.
Rationale: `is_available()` is the `Scorer` Protocol method the engine calls;
where a scorer also needs a human-readable reason (prosody, speechrate, churn,
lexicon, laugh, audio_event), `is_available()` just delegates to
`available()[0]` - no duplicated probe logic. energy/scenes/visual omit the tuple
form because nothing reads their reason. This is appropriate asymmetry, not
drift.
Last confirmed: 2026-07-26.

### `similarity.py`'s three backends dispatch only through `make_backend` - kept
Decision: Keep as-is.
Rationale: `TfidfBackend`/`EmbeddingsBackend`/`LlmBackend` share one interface;
`make_backend` owns every `if backend == ...` branch plus the
tfidf-fallback-on-first-use-load-failure policy. The
`isinstance(backend, EmbeddingsBackend)` check inside `make_backend` is the
seam's one cross-cutting-policy point (fetch-verify-or-fall-back gate),
correctly placed at the factory, not in a caller.
Last confirmed: 2026-07-26.

### `_DEFAULT_MAX_TOKENS = 1024` duplicated across `llm_client.py` and `llamacpp_server.py`
Decision: Keep as-is.
Rationale: Both are live defaults on different layers (client interface vs.
server pool), each carrying a "matches the other" cross-reference comment.
Unifying would force an unwanted import direction between the two modules.
Below the rule-of-three; revisit only if a third occurrence or a concrete
drift bug appears.
Last confirmed: 2026-07-26.

### `routes/llm.py`'s five capability-tier builder functions kept separate, not one generic `_build_tier(...)`
Decision: Keep as-is.
Rationale: `_similarity_tier`/`_descriptions_tier`/`_speaker_labels_tier`/
`_audio_events_tier`/`_vertical_framing_tier` share a shape (check availability,
report installed/missing, pick a status string) that looks collapsible, but the
shape is coincidental - each tier's availability check hits a different backend
call, and the tiers are added to independently. The response shape is also public
API surface consumed by `settings.js`'s Capabilities section; one function per
capability keeps a change to one from risking an accidental shape change to the
others.
Last confirmed: 2026-07-07.

### `jobs.js`'s `parseProgress`/`JOB_STAGES` mirroring `pipeline/progress.py`'s stage ids - intentional, guarded duplication
Decision: Keep as-is.
Rationale: Code can't be shared across the process boundary (subprocess stdout
-> browser). Guarded by `tests/unit/test_progress_stage_coupling.py`, which greps
`jobs.js` for each Python stage id. Gotcha: the guard matches the stage id
wrapped in single quotes - a future double-quoted reference in `jobs.js` would
false-fail the guard, not silently drift.
Last confirmed: 2026-07-15.

---

## Scoring pipeline internals

### `engine.py::_run_scorers`'s `scorer.name == "laugh"` special case - kept, not generalized
Decision: Keep as-is.
Rationale: Laugh is the only scorer whose raw result must be persisted apart
from its weighted aggregation (`score_laugh` vs. weighted `score_funny`). A
generic "raw scores" side-channel mechanism would serve exactly one consumer
(YAGNI). Keys on the Protocol's `name` attribute, so it stays backend-agnostic.
Revisit only if a second scorer needs a raw side-channel.
Last confirmed: 2026-07-26.

### `audio_event.py` / `laugh.py`'s `_load_failed` load-guard duplication - kept
Decision: Keep as-is.
Rationale: Both scorers cache a "model failed to load, don't retry every clip"
boolean the same way (module-level flag, set on except, logged once). Below the
rule-of-three; each call site is coupled to tests asserting that module's own
`_load_failed` state independently, so a shared helper would need a shared
mutable singleton (risking one scorer clearing the other's failure state) or a
class per instance - more machinery than two five-line guards justify. Revisit
if a third scorer needs the pattern.
Last confirmed: 2026-07-07.

### `textmatch.py::find_fuzzy_matches`'s sliding-window scan (~43 lines) - kept inline
Decision: Keep as-is.
Rationale: One cohesive concern with a subtle invariant (a hit consumes its
whole window so overlapping windows can't double-count), documented in the
docstring at the exact spot it matters. Below the rule-of-three (one call site).
Last confirmed: 2026-07-26.

### `term_scope.py::terms_for_video` silently drops orphaned-slug terms
Decision: Keep as-is.
Rationale: Runs once per clip inside the full-project rescan loop - logging
here would be per-iteration spam. Orphaned terms only arise after a context is
deleted (creation is guarded by `validate_context_slug`). If this ever needs to
be observable, surface it at context-deletion time or a one-shot integrity
check, not this hot filter.
Last confirmed: 2026-07-10.

### `scenes.py::_detect_content`'s narrow `except ImportError` - kept
Decision: Keep as-is.
Rationale: Its sole caller already wraps the compute in a broad `except` per an
earlier reliability fix, so this narrow catch is not a live crash risk. Not the
same pattern as the availability-probe crash bug fixed elsewhere in this file's
history.
Last confirmed: 2026-07-26.

---

## Data model (`db/models.py`)

### ~8 JSON encode/decode `@property`/`@setter` pairs not collapsed to a descriptor factory
Decision: Keep as-is.
Rationale: The getters look uniform but the setters encode genuinely different
empty-value persistence contracts - e.g. `words.setter` writes SQL NULL when
empty (`json.dumps(value) if value else None`) while others always write the
empty container (`"[]"`/`"{}"`), and getters split three ways. A single
descriptor factory would need enough parameters to stop being simpler, and
risks silently changing the `words_json` NULL-vs-`"[]"` representation callers
depend on. Duplicated shape, not duplicated knowledge - do not re-flag as DRY
without new evidence.
Last confirmed: 2026-07-26.

### `Speaker` vs `ProjectVoice`'s `display_name`/`display_color` accessors - not merged
Decision: Keep as-is.
Rationale: Different domain rules, not the same rule twice. `Speaker`'s fields
resolve through the linked Person (`global_voice`) first - renaming/recoloring a
Person flows to every member recording - then fall back to the Speaker's own
value; `ProjectVoice` has no Person-linking precedence. The one genuinely-shared
fragment (the palette-cycling fallback one-liner) appears in exactly two places,
below the rule-of-three.
Last confirmed: 2026-07-26.

### No explicit index on several frequently-joined FKs
Decision: Keep as-is.
Rationale: `Video.session_id`, `Video.parent_video_id`, `ClipCandidate.video_id`,
`TranscriptSegment.transcript_id`/`speaker_id`, `Speaker.video_id` are unindexed.
This is a single-user local SQLite app at a scale (hundreds to low thousands of
rows per table) where a missing index has no observed or plausible practical
impact, and adding one means an Alembic migration touching every existing user's
DB - a much higher blast radius than a purely speculative performance gain.
Revisit only if a real performance complaint ever surfaces.
Last confirmed: 2026-07-26.

### "Current transcript for a track" is selected by `created_at`, not `id`
Decision: Keep as-is - do not flip back to `id` or re-debate without new evidence.
Rationale: `latest_track_transcript(track)` (`db/models.py`) unifies ~7 sites
that used to pick a track's latest transcript with two divergent sort keys. The
two keys cannot disagree under the current schema: force-retranscribe deletes
all prior track-level transcript rows before inserting the new one
(`ingest.py::_transcribe_and_check_overlap`), so each track holds a single
track-level transcript and both keys are monotonic at insert with no ties.
`created_at` was chosen because it directly expresses "most recently created"
and was already the majority convention (5 of 7 sites). Only worth revisiting if
multiple concurrent track-level transcripts per track ever become possible.
Last confirmed: 2026-07-09.

---

## Config, CLI, and backend routes

### `routes/videos.py::generate_video_proxy` has its own Cancel, deliberately not the shared job pill/`streamSSE`
Decision: keep the 720p preview-proxy build on its own badge-scoped progress UI
(`static/core/preview.js`'s Cancel pill, backed by `POST .../proxy/cancel` and
`ctx.proxy_procs`/`proxy_cancel_events`), not `startJobUI`/`streamSSE`.
Rationale: `streamSSE`'s `_supersedeActiveStream()` tears down whatever OTHER
job's pill is currently showing - routing a proxy build through it would let
building a preview for one recording silently end an unrelated live
analyze/score/export progress UI (bug-hunt 2.3, which is why `_buildRecordingProxy`
uses the raw `_openSSE` in the first place). The badge-scoped Cancel gives the
same real abort (kills the FFmpeg child via `terminate_process_tree_async`,
raises `ProxyCancelled` to skip the NVENC->libx264 fallback retry) without that
risk. Also fixed alongside: `generate_video_proxy` never called `reject_if_busy`
on itself, yet counted toward the shared `job_in_flight` gate (`ctx.active_jobs`/
`ctx.proxy_generating`) - so a running proxy build silently 409'd unrelated
actions like "Suggest names" with no job pill to explain why. `job_in_flight`
(`routes/common.py`) no longer looks at `proxy_generating`; a proxy build is
mostly CPU/GPU-bound FFmpeg work with one quick DB commit at the end, not a
sustained writer, so it can safely run alongside another job. The two routes
that rebind the whole `ProjectContext` (`projects.py::switch_project`,
`backup.py`'s restore guard) keep their own separate, still-blocking
`ctx.proxy_generating` check - correct, since those tear down the DB engine a
still-running encode is writing into.
Last confirmed: 2026-07-27.

### `routes/videos.py::_migrate_transcript_to_segments` deliberately does NOT copy the parent's `extracted_path` onto a migrated segment track
Decision: Keep as-is - do not "fix" this back to inheriting the parent's path.
Rationale: A migrated segment's transcript/clip times are 0-based within the
segment, but the parent's `AudioTrack.extracted_path` points at the
full-recording WAV. Setting `extracted_path=None` on the migrated track makes
`run_retranscribe`'s existing guard skip it (keeping the correct migrated
transcript) and makes a reanalyze re-extract segment-local audio instead of
transcribing the wrong window at an unshifted offset. This preserves the
invariant that a segment's only non-`None` `extracted_path` is the segment-local
one.
Last confirmed: 2026-07-26.

### `routes/config.py` validates `ai_privacy_mode` via the generic `_enum_validator` table, not a dedicated `validate_*` function
Decision: Keep as-is.
Rationale: `ai_privacy_mode` is plain 2-value membership with no normalization
needed beyond that, unlike fields with dedicated `validate_whisper_*` functions.
A dedicated validator (the now-deleted `validate_ai_privacy_mode`) was
architecturally unnecessary speculative symmetry - the inline form matches every
other simple-enum field in the same validation table (`whisper_device`,
`llm_backend`, `scorer_laugh_mode`, ...).
Last confirmed: 2026-07-26.

### `cli/analyze.py`'s "force diarization backend on when `--diarize` is passed" snippet - not extracted
Decision: Keep as-is.
Rationale: The `if config.diarization_backend == "null": config.diarization_backend
= "speechbrain"` flip appears in exactly two commands (`analyze --diarize`,
`rediarize`), each with its own explanatory comment - below the rule-of-three.
(The similar-looking `ingest.py` hit is a different check - skip diarization
when off - not this force-on flip.) Revisit if a third force-on site appears.
Last confirmed: 2026-07-26.

### Config-CRUD route modules (`characters`, `content_presets`, `export_presets`, `contexts`, `voices`, `name_corrections`, `hotwords`, `sensitive`) - not merged into a generic CRUD base
Decision: Keep as-is.
Rationale: These share a visible shape (`make_router(ctx)`,
`try/finally: db.close()`, a `_*_dict` serializer, `_log.info` on mutate) but
encode different domain knowledge - e.g. Character's `context_slug`+
`_clamp_boost`+Person-unlink cascade; presets' weight-copy+starter-hotword
insert; export-presets' `_slugify`/`_unique_name` immutable-id rule;
`sensitive.py`'s PII-never-logged term plus its own `_rescan_all_clips` side
effect vs. `hotwords.py`'s freely-logged phrase. The shared shape is the
mandated route pattern, not duplicated rules - a generic base would couple
independently-evolving entities.
Last confirmed: 2026-07-26.

### `voices.py`'s `_members_of`/`_members_by_voice` and `_suggestions_of`/`_suggestions_by_voice` pairs - kept as four small helpers
Decision: Keep as-is.
Rationale: Each pair is a single-voice query and an all-voices grouped query
over the same join. The grouped `_by_voice` variants (with `joinedload`) feed
`list_voices` in one shot to avoid an N+1 across every Person; the single-voice
variants serve the mutation routes. Collapsing them behind a filter/group flag
would reintroduce boolean-blindness and obscure the N+1-avoidance intent.
Last confirmed: 2026-07-26.

### Clip-window offset math (`segment_start_s + start_ms/1000 + start_offset`) - deliberately NOT extracted into a shared helper
Decision: Keep as-is.
Rationale: `crud.py::clip_preview` and `edit.py::suggest_framing` compute this
identically (3 lines each), but the math is deliberately *divergent*
project-wide: `export/window.py`/`subtitles.py` work in ms and clamp to 0,
`export/render.py` omits the segment offset (its source is already
segment-local), and `analyze/frames.py` plus these two routes work in seconds
off the untrimmed parent. A shared helper would be a wrong-abstraction attractor
that a future segment-local caller could double- or un-shift - exactly the
class of bug that has already had to be fixed once in this area. Duplication is
the safer call here.
Last confirmed: 2026-07-26.

### `_compute_time_estimate` (analyze.py) and `_migrate_transcript_to_segments` (videos.py) kept whole despite exceeding the ~30-line guideline
Decision: Keep as-is.
Rationale: Both are single-concern. `_compute_time_estimate`'s
"measured rate overrides the static formula" block can't cleanly extract -
fallback formulas differ per stage and the `used_measured` flag's key set is
conditional (speakers only when `diarize`). `_migrate_transcript_to_segments`'s
length is field-count (a 12-field `AudioTrack` copy), not branching, and its two
load-bearing comments (the `extracted_path=None` decision above, and the
per-word offset shift) must stay co-located with the segment-grouping context.
Last confirmed: 2026-07-26.

### `project_archive.py::restore_into`'s verify -> guard-overwrite -> extract sequence - kept whole
Decision: Keep as-is.
Rationale: Reads top to bottom at ~30 lines; the two `zipfile.ZipFile` opens are
deliberate (verify entirely before touching the target, extract only after),
and the CRC/zip-slip/DB checks are already extracted into named helpers.
Splitting further would scatter load-bearing ordering comments.
Last confirmed: 2026-07-26.

### `web/sse.py`'s cancelled/counted proc-tracking vs. `web/analyze_job.py`'s `AnalyzeJob` state - deliberately separate designs, not duplicated
Decision: Keep as-is.
Rationale: Two designs by intent (see CLAUDE.md's "Subprocess cancellation"):
`subprocess_sse` tracks short stream-tied jobs via identity-keyed
`ctx.cancelled_procs`/`counted_procs` (killed on client disconnect); `AnalyzeJob`
is a reattachable broadcast buffer decoupled from any single stream (survives a
refresh, killed only on explicit cancel/shutdown). They already share the
correct common surface (`terminate_process_tree_async`, `new_session_kwargs`,
the `jobevents` wire helpers).
Last confirmed: 2026-07-26.

### App-version lookup: `dev/notices.py` deliberately keeps its own `_pkg_version` copy
Decision: Keep as-is (partial extraction, not an oversight).
Rationale: The duplicated "get yuu-clip's version, fallback on failure" block
was consolidated into `yuu_clip/appversion.py::app_version` and adopted by
`project_archive.py`, `web/app.py`, and `web/routes/updates.py`. `dev/notices.py`
(a separate `yuu-dev` tool, out of that consolidation's scope) still has its own
copy - a low-value follow-up, left deliberately untouched rather than
half-migrating everything in one pass.
Last confirmed: 2026-07-26.

---

## Frontend architecture (web static JS)

### `main.esm.js`'s residual `window.X = X` shim - kept, being drained incrementally
Decision: Keep as-is (living decision, re-verify against the live file).
Rationale: A name stays on the shim only while (1) another module still reads
it as `window.foo` instead of importing it, or (2) a Playwright `page.evaluate`
pokes it. The shim is organized into two labeled groups in the file itself; as
of the ui-shim-retirement plan's Phase 2 (2026-07-25), the "live runtime reader"
group is empty - the shim is now 100% test-only pokes. Do not treat any
remaining shim entry as automatically drainable; check the live file's own
banner comment for current composition rather than any prior review's count.
Last confirmed: 2026-07-26.

### `core/ui.js` (~675 lines) and `core/jobs.js` (~700 lines) - kept large but not split
Decision: Keep as-is.
Rationale: Both are collections of small single-concern functions around one
cohesive area (`ui.js` = shared modal/menu/kebab/resize/toast primitives;
`jobs.js` = job-pill + SSE state machine). Length comes from breadth of small
helpers, not any one long function - no natural sub-module seam that wouldn't
just scatter tightly-related helpers.
Last confirmed: 2026-07-26.

### `library/colorpicker.js::attach` (~51 lines) - not decomposed
Decision: Keep as-is.
Rationale: One cohesive concern (construct + wire one color-picker widget, read
top-to-bottom); splitting construction from wiring would fragment tightly
coupled setup for no legibility gain.
Last confirmed: 2026-07-26.

### `core/utils.js::netErrMsg` and `core/format.js::formatApiError` are NOT duplication
Decision: Keep as-is.
Rationale: They format different inputs - `netErrMsg` takes a thrown
`Error`/`TypeError` from the fetch/network layer; `formatApiError` takes a
parsed server error body and unpacks its `detail`/`message` shape. No shared
kernel worth extracting.
Last confirmed: 2026-07-26.

### The two full markdown renderers (`markdown.js::renderMarkdown`, `helpmodals.js::_renderGlossaryMd`) are NOT merged
Decision: Keep as-is.
Rationale: They emit structurally different HTML for different surfaces - Help
& Guides needs heading anchors + TOC + relative-link resolution; the glossary
needs `.glossary-section`/`.glossary-term` wrapper divs the filter shows/hides,
with no anchors/TOC/links. Merging would require parameterizing those
differences into one function - the "generic base that buries each caller's
specifics" pattern this codebase repeatedly rejects. (The one genuinely shared
piece - the inline escape+emphasis chain - is already extracted as
`renderInlineMarkdown` in `markdown.js` and imported by both.)
Last confirmed: 2026-07-26.

### Three `URLSearchParams` query builders (`reel.js`, `clipexport.js`, `library/exporteditor.js`) - deliberately NOT unified
Decision: Keep as-is.
Rationale: Each builds a different query shape (reel-pool filtering vs.
batch-export options vs. single-clip export with caption-style fields) over
different caller state. Pre-recorded as out of scope for a shared builder;
do not re-flag as duplication.
Last confirmed: 2026-07-23.

### Long JS renderers / init-wiring functions (50-135 lines) not decomposed
Decision: Keep as-is.
Rationale: `clips.js::renderDetail`, `videos.js::renderVideoDetail`,
`clipexport.js::confirmExport`, and `analyze.js::initAnalyzeListeners`/
`_doStartAnalyze` are each a single HTML-template builder or the one-
`addEventListener`-per-control init function the "no DOM side-effects at
module scope" rule mandates - no duplicated knowledge across siblings.
Churning them risks real UI behavior for marginal readability gain with no
defect driving it.
Last confirmed: 2026-07-26.

### `const data = await res.json()` idiom - kept, not "naming drift"
Decision: Keep as-is.
Rationale: `data` is the established name for a parsed JSON response body at
~30 call sites, predating any recent refactor arc. Renaming per call site would
be churn against a consistent convention for no legibility gain.
Last confirmed: 2026-07-23.

### Two real ESM import cycles are genuine domain coupling, not accidental - and break `vi.mock` in vitest
Decision: Keep as-is (do not attempt to break the cycles structurally).
Rationale: `voices.js <-> speakers.js <-> transcript.js` (People/Speakers/
Transcript cross-navigate and cross-refresh by nature) and `modeldownload.js ->
modelcatalog.js -> settings.js -> analyze.js -> modeldownload.js` (the
model/settings cluster shares capability-tier/dirty-state rendering) are real
cross-module calls inside handler bodies, safe under esbuild (CLAUDE.md:
function-body-only cross-references bundle fine). Breaking either needs an
event-bus/mediator the project explicitly rejects. **Test-writing gotcha**:
`vi.mock`/`importActual` on a module inside a live cycle does not reliably
intercept the binding the cyclic importer sees - the mock's calls stay empty
while the real function silently runs and no-ops, with no exception to signal
the mock never took. Fix for a new test in this cluster: don't mock the cyclic
module - seed the real DOM section and assert on the resulting DOM (route real
fetches and assert on the DOM update), the same pattern used for `core/jobs.js`'s
`refreshhooks.js` seam.
Last confirmed: 2026-07-26.

### `library/contexts.js` owns both World Context CRUD and Characters CRUD in one file
Decision: Keep as-is (file split is a possible future refactor, not urgent).
Rationale: In the UI these are cleanly separated - Characters is a nested
sub-section inside the context editor, gated behind "save the context first";
the flows are detail-panel actions never shown in the context modal. Shared
code file, not a shared UI surface, so there's no user confusion driving a
split. A future split of re-score/retranscribe out of "contexts.js" remains a
plausible refactor, just not one this pass forced.
Last confirmed: 2026-07-26.

---

## Electron desktop wrapper

### `showSetupWizard` (~132 lines, `main.js`'s largest function) - kept inline
Decision: Keep as-is.
Rationale: A Promise executor whose five `ipcMain.once` handlers all share
`resolve`/`reject`/`win`/`mode`/`rerun` through the closure; extracting any
handler would force threading that state out as parameters for a net
legibility loss.
Last confirmed: 2026-07-26.

### The three preload files (`preload.js`, `venv-preload.js`, `setup-preload.js`) - kept separate
Decision: Keep as-is.
Rationale: Each exposes a genuinely distinct bridge (`electronAPI`/`venvAPI`/
`setupAPI`) with different channels for a different window - no shared
knowledge; the single `exposeInMainWorld` line each carries is irreducible.
Last confirmed: 2026-07-26.

### `try { <webContents>.send(...) } catch {}` "safe-send" idiom (~8 sites) - kept, not extracted to a `safeSend()` helper
Decision: Keep as-is.
Rationale: Each site already sits in a locally-named closure with a different
payload/channel; a generic helper would add cross-cutting churn to the boot
path for a one-line-each gain. The one true duplicate pair (the `progress`
closures in `runPrebuiltEnvSetup`/`runPipVenvSetup`) is rule-of-two, left alone.
Last confirmed: 2026-07-26.

### `setup:pick-folder` vs. `project:pick-folder` IPC handlers - kept separate
Decision: Keep as-is.
Rationale: Different target window and IPC-registration lifecycle;
coincidental similarity only.
Last confirmed: 2026-07-26.

---

## Theming and color literals

### Repeated `color-mix(... var(--accent) N%, transparent)` focus-ring/scrim expressions - kept inline
Decision: Keep as-is.
Rationale: Each use varies by token and percentage and is a single contextual
use, not newly introduced or growing duplication - below the bar for a shared
token/mixin.
Last confirmed: 2026-07-13.

### Wordmark gradient's dark end computes below the AA text-contrast floor - exempt as a logotype
Decision: Keep as-is.
Rationale: The `header h1` "YuuClip" wordmark's
`linear-gradient(100deg, var(--accent2), var(--accent))` text-clip is the
product logotype, which WCAG 1.4.3 explicitly exempts from the body-text
contrast requirement. It has a solid-color fallback (`color: var(--accent-text)`,
itself contrast-tested) if `background-clip: text` is unsupported. Only
re-open if the gradient is reused on non-logotype body text.
Last confirmed: 2026-07-13.

### Quiet muted-uppercase section/card titles - intentional hierarchy, not low-contrast oversight
Decision: Keep as-is.
Rationale: `.detail-card-title`/`.sidebar-section` at `--muted` uppercase 11px
is a deliberate "quiet chrome, loud content" signature (clip content and the
one gold action carry the visual weight). `--muted` on `--surface`/`--bg` is
AA-contrast-tested in every theme.
Last confirmed: 2026-07-13.

### `format.js`'s score-gradient hex stops and `_lerpColor`'s rgb() output - kept as literals
Decision: Keep as-is (documented exception to the no-color-literal rule).
Rationale: `_scoreBorderColor`'s stop list and `_lerpColor`'s interpolation are
a continuous data encoding (score -> color ramp), not UI chrome, so they can't
be discrete `var(--token)`s. Same class of exception as the two entries below.
Last confirmed: 2026-07-13.

### `analyze/split.js`'s one hardcoded hex fallback `'#6c8ebf'` for a canvas `fillStyle`
Decision: Keep as-is.
Rationale: Canvas can't consume a CSS `var()`; this is the fallback reached
only if `--accent` resolves empty (never in practice - defensive-only). Same
allowed-exception class as `format.js`'s score-gradient stops.
Last confirmed: 2026-07-26.

### `#000` / `rgba(0,0,0,...)` scrims drawn over video content - documented exception
Decision: Keep as-is.
Rationale: `exporteditor.js`'s over-video letterboxing/scrim colors and the
caption-text data-encoded speaker color are theme-independent by design (drawn
over video pixels, not UI chrome) - the same documented exception class as the
score-gradient stops above.
Last confirmed: 2026-07-26.

### Inline boot-splash HTML color literals (Electron `main.js` data-URL splash windows) - out of scope for the no-literal rule
Decision: Keep as-is.
Rationale: The no-hardcoded-color rule is scoped to `static/*` and the wizard
`<style>` (enforced by `test_static_theme_colors.py`); these are throwaway
main-process splash screens rendered before the themed app UI exists. Both
palettes independently clear WCAG AA (>=5:1) despite being out of the token
system.
Last confirmed: 2026-07-26.

---

## Accessibility - pointer-first, single-user desktop tool

This project's user is a solo, mouse-first desktop user. Several controls are
deliberately pointer-only with no keyboard path; each was accepted for that
reason, not overlooked. Revisit any of these only on an actual keyboard-only/AT
user report, not preemptively.

- **Sidebar/player resize handles and split-editor timeline markers** (Low 29,
  2026-07-23): no keyboard path, accepted for a mouse-first desktop tool.
- **`videos/sessions.js::_promptText`/`_showSuggestionModal`** (runtime-built
  modals): sit outside the boot-time modal-a11y stamping + single
  document-level focus trap (Tab can reach background controls; focus isn't
  returned to the opener). They are otherwise usable (`role="dialog"`/
  `aria-modal`, labelled input, autofocus, Enter/Escape). A clean fix wants a
  shared "trap a runtime-built modal" helper rather than a per-modal patch.
  Revisit trigger: a keyboard-only/AT user needs to create/rename a session, or
  a shared runtime-modal-trap helper lands for another reason.
- **Frameless boot/setup windows' minimize control**: a `<div>`+onclick, not a
  focusable `<button>` - these are transient windows.
- **Tab-bar view switchers** (Highlight Reels Build/View tabs and a few
  in-modal switchers): signal the active view via a `.active` CSS class only,
  not `role=tab`/`aria-selected`, unlike the sidebar filter chips'
  `aria-pressed`. Visible active state is clear; minor polish gap, not a
  defect. Revisit trigger: a broader tablist a11y pass, or an AT-user report.
- **The per-Person/per-speaker "Merge in.../Merge into..." `<select>`**:
  triggers the merge confirm on `change` (a WCAG 3.2.2 "change of context on
  select" nuance) - mitigated by a placeholder + `aria-label` naming the
  action, and it opens a confirm dialog rather than acting immediately.
  Settled, identical pattern in both `speakers.js` and the People view; not
  worth reworking into a button+picker.

Decision for all of the above: Keep as-is.
Last confirmed: 2026-07-26.

### Collapsible card headers: only title+chevron is a real `<button>`; toggle target is smaller than the full header row
Decision: Keep as-is (deliberate tradeoff, applied fix).
Rationale: A `<button>` nested inside a `role="button"` header was an axe
`nested-interactive`/WCAG 4.1.2 violation. Wrapping only the title+chevron in a
native `<button class="card-toggle">` removes the violation and gives correct
native keyboard support; header actions (Copy, kebab, Suggest/Fix names,
Generate) render as siblings. The clickable toggle area shrank from the full
header row to title+chevron - valid ARIA + native keyboard beats extra row
width for a single-user desktop tool.
`test_toggle_has_no_nested_interactive_controls` (`tests/ui/test_ui_clips2.py`)
guards against re-nesting a control inside the toggle.
Last confirmed: 2026-07-13.

---

## Console / text-encoding conventions (ASCII vs. non-ASCII)

### U+2026 ellipsis (and U+2192 arrows) in browser DOM text is fine - not a cp1252 violation
Decision: Keep as-is - do not sweep to ASCII.
Rationale: The project's hard ASCII/no-em-dash rule targets the legacy Windows
console (cp1252-encoded stdout), not browser markup, which is served and
rendered as UTF-8. The web UI uses the real ellipsis glyph consistently across
~80 sites, and the right-arrow (e.g. "Settings -> LLM scoring") appears ~30
times, both established typographic conventions. This also covers Electron-
rendered text (wizard/boot windows, native dialogs) - it renders inside a
Chromium `BrowserWindow` or a native OS dialog, never the legacy console, so
the same reasoning applies there too. Any string reaching a `print()`/
`console.print`/log line still must be ASCII-only.
Last confirmed: 2026-07-26.

### Feature-map header `·`/`->` glyphs and `# -- ... --` box-drawing section dividers
Decision: Keep as-is.
Rationale: Established codebase-wide convention across 20+ route files and
several dev modules; comment-only, so it never reaches the cp1252 console.
Match the convention when adding new headers rather than sweeping existing
ones.
Last confirmed: 2026-07-10.

### `reel.py`'s title-card text (ellipsis, `·` separator) and `contexts.py`'s "Pokemon" proper noun
Decision: Keep as-is.
Rationale: Rendered into the video itself via ffmpeg `drawtext` (title card) or
sent as an LLM prompt string (correctly-spelled proper-noun content) - neither
is a comment or console output, so the ASCII-console rule doesn't apply.
Last confirmed: 2026-07-10.

### Markdown docs (`CLAUDE.md`, `FEATURES.md`, `GLOSSARY.md`) may use `->`/`...`
Decision: Keep as-is.
Rationale: These render as UTF-8 documents, not console output. They already
use `->`/`-`/`...` consistently - match that convention when adding new copy
(never a real em-dash, per the project-wide ban).
Last confirmed: 2026-07-10.

---

## Terminology / glossary

### `docs/dev/llm/GLOSSARY.md` and `yuu_clip/web/static/glossary.md` are intentionally different files
Decision: Keep as-is - a large diff between them is expected, not drift.
Rationale: `GLOSSARY.md` is the authoritative dev superset (`Code:` names,
dev-only sections); `static/glossary.md` is a hand-written creator-facing
subset served by the in-app Terminology modal. The dev file's own header states
this split.
Last confirmed: 2026-07-13.

### First-run banner copy says "the AI model" where Settings says "local model" / "LLM scoring"
Decision: Keep as-is.
Rationale: Not a glossary violation - "AI scoring" never appears. The friendlier
first-run phrasing (`modeldownload.js`) is a defensible non-developer choice
distinct from the more precise Settings/`modelcatalog.js` wording. Recorded so a
future terminology sweep doesn't treat this as drift.
Last confirmed: 2026-07-26.

### "LLM scoring" kept as the term despite reading as jargon
Decision: Keep as-is.
Rationale: It is the authoritative `GLOSSARY.md` term, explicitly "not AI
scoring," consistent across UI/CLI help/docs. Renaming would desync this
surface from the glossary or require a glossary-wide sweep. Revisit only as a
deliberate glossary change, never a one-off relabel.
Last confirmed: 2026-07-08.

---

## Test-suite conventions

### `electron/main.js` can't be `require()`'d directly, so its tests assert against source text
Decision: Keep as-is.
Rationale: `main.js` needs the Electron runtime to load. `restore-backup.test.js`,
`rerun-reload.test.js`, and `startup-loading-status.test.js` deliberately assert
against `main.js`'s source text instead of calling exported functions - a
consistently-applied pattern for this one file specifically (every other
Electron module is directly `require`-able and tested by calling exports).
Last confirmed: 2026-07-26.

### `TestSubprocessSseTracksActiveJob`/`TestSubprocessSseCancel` (`test_url_import.py`) duplicate `test_sse.py` coverage
Decision: Surfaced, not fixed - leave for a future dedup pass.
Rationale: Both re-exercise the same generic `web/sse.py::subprocess_sse`
identity-keyed cancel behavior already covered by
`test_sse.py::TestSubprocessSseTypedWire`. A test-integrity pass fixes
fragility, not cross-tier dedup, so this was flagged rather than merged
unprompted.
Last confirmed: 2026-07-26.

### `tests/unit/test_config.py::TestProfiles` and `tests/integration/test_profiles_contexts.py::TestProfileFunctions` both cover the same track-layout round-trip
Decision: Surfaced, not fixed - leave for a future dedup pass.
Rationale: Near-identical bodies with different monkeypatch mechanics;
`TestProfileFunctions` needs neither `client` nor `project_dir` so could live in
the unit tier. Left as-is on the same basis as the SSE duplicate above.
Last confirmed: 2026-07-26.

### `TestRenderExport`'s call-count-only mocking is the correct granularity, not under-tested
Decision: Keep as-is - do not re-flag without new information.
Rationale: `render_export` (`export/render.py`) is a pure 7-collaborator
orchestrator whose own docstring says its entire job IS the wiring. Every
mocked collaborator already has its own direct test elsewhere
(`_write_export_subs`, `_resolve_caption_style`, `_build_export_path`'s naming,
`run_retranscribe`'s diarization sub-call), and the real end-to-end path runs
for real in `tests/system/` and `test_export_presets.py::TestPresetEncodeIntegration`.
Last confirmed: 2026-07-26.

---

## Logging conventions (deliberate silences, not gaps)

Several modules and code paths carry no logging, or log at a level lower than a
naive review might expect. Each was checked and is deliberate:

- **Pure, deterministic, I/O-free modules carry no logging at all**:
  `describe_basic.py`, `content_presets.py`, `sessions.py`, `subtitles.py`,
  `project_voice.py`, `export/presets.py`, `export/paths.py`,
  `export/window.py`, `db/models.py` (the ORM layer). Every real failure path
  in these either raises a `ValueError`/`HTTPException` straight to the caller
  (the right surfacing point) or has no exception path that isn't a programmer
  error.
- **Poll loops stay silent per-tick by design**: `check_llm_available`/
  `check_vision_available` (cheap, frequent poll paths - logging every call
  would be spam; the one-time-per-run warning lives one layer down in
  `LLMScorer.is_available()`/`LlamaCppServerClient.available()`'s callers),
  the GPU health-poll loop `_wait_healthy` (already logs once on entry/exit),
  and the JS-side `jobs.js::_pollThermalStatus`/`_waitWhileAnalyzePaused` and
  `utils.js::_diarizationReadiness` (3-5s polls or a low-stakes default; the
  next tick self-heals).
- **`export/render.py` and `reel.py`'s `console.print`/`print()` calls have no
  parallel `log.*` call, by design**: both modules' docstrings say the prints
  ARE the SSE interface; `web/sse.py::subprocess_sse` already forwards every
  stdout line to the file log at `debug` and logs command+exit code at `error`
  on failure. Do not propose converting these prints to `log.*`.
- **`yuu-dev` dev-CLI modules use Rich `console.print`, not application
  logging**: `bundle.py`, `testjs.py`, `fixture.py`, `helpdocs.py`,
  `htmlstitch.py`, `shareddata.py`, `typecheck.py`, `tests.py`, `serve.py`, and
  `scripts/build-esm.mjs` are one-shot developer tools whose failures are
  already actionable printed messages, not something `.yuu-clip/yuu-clip.log`
  needs to capture. `electron/setup-renderer.js` is the Electron-side
  equivalent: pure display with no `console.*`, because every failure it can
  show is also logged in `main.js` via `logSetup`.
- **JS-wide: zero `console.*` outside `core/errorreporter.js`, `core/jobs.js`,
  `core/utils.js`**: deliberate. `initGlobalErrorReporter()`
  (`core/errorreporter.js`, wired first from `boot.js`) catches every uncaught
  error/rejection app-wide and mirrors it to `console.error`, the in-app log
  panel, and a persistent error toast - the durable backstop. Client-side
  catches elsewhere are UX feedback (toasts/inline errors), not the diagnostic
  trail; the underlying cause is already captured server-side by the
  corresponding route's own log line. `core/panelnav.js::render(container)`
  needs no try/catch for the same reason - it's always a synchronous
  DOM-event call chain, so a throw reaches `window.onerror` on its own.
- **`hf_cache.py`'s cache-check catches broad `Exception` and logs at `debug`**:
  correct, since a scan failure only forgoes an optimization and never forces
  a wrong answer.
- **Raw `logging.getLogger(__name__)` vs. `yuu_clip.log.get_logger`**: both
  forms appear in the codebase (`hf_cache.py`/`recent_projects.py` use the raw
  form). Functionally identical - Python's logging hierarchy keys by name
  string, and both files' `__name__` already equals what `get_logger` would
  produce. The raw form is actually the dominant pattern across the wider
  codebase (22+ files) - not a one-off inconsistency to "fix" toward the
  wrapper.
- **`electron/registry-path.js`'s per-hive `try/catch` around `reg query`
  stays silent**: a missing `HKCU`/`HKLM` `Path` value is the common case, not
  an error; logging it would spam the setup log on every "Check again"/restart.
- **`electron/pip-progress.js`/`install.js`'s per-line pip handlers stay
  silent**: no spam risk - the per-line callback only sends deduped IPC
  status, never logs; the caller logs the full stdout/stderr once on failure.
- **`electron-config.js::loadElectronConfig`'s corrupt-JSON-to-`{}` fallback
  stays unlogged**: the module is deliberately Electron-free pure I/O; the
  corruption path needs a crash mid-write with no atomic write (a separate,
  already-tracked concern), and `main.js` already logs the resulting
  `Project dir: ${projectDir}` unconditionally, so the *effect* is traceable
  even though the *cause* isn't.

### `LlamaCppServerClient.available()`'s reason string is kept path-free in the log too, not just the UI
Decision: Keep as-is.
Rationale: The reason string renders in the UI (clip descriptions, analyze
warnings, screenshots), so it's genericized ("The set-up local model file is
missing - re-download it under Settings -> LLM scoring") rather than leaking
the absolute `llm_model_path` (the user's home directory). Re-adding the path
to the log line that carries this reason would violate the no-sensitive-paths
rule; the underlying condition (LLM scoring disabled + reason) is still fully
logged, and the exact path is one file away in `config.json`.
Last confirmed: 2026-07-16.

---

## Licensing

### `dev/notices.py::_is_license_file` uses an extension blocklist, not a stricter filename regex
Decision: Keep as-is.
Rationale: A stricter license-name regex could over-match a `license.py`-style
source module. Rejecting source/binary suffixes
(`.py/.pyc/.pyi/.pyd/.so/.dll/.dylib`) instead avoids that. For a
licensing-notice artifact, an under-match (silently dropping a real license
file) is worse than a cosmetic over-match, and no genuine license text carries
those extensions.
Last confirmed: 2026-07-15.

### `web/static/fonts/OFL.txt` is the correct, complete OFL 1.1 text for the bundled Oxanium woff2
Decision: Keep as-is.
Rationale: Co-located with `oxanium.woff2`, satisfying OFL condition 2 (license
+ copyright must accompany each copy) - no separate NOTICE pointer needed.
**Obligation to carry forward**: any distribution shipping the woff2 must ship
`OFL.txt` alongside it; `pyproject.toml`'s
`[tool.setuptools.package-data]` already globs `web/static/fonts/*` for
packaged builds.
Last confirmed: 2026-07-13.

---

## Deferred findings - Low priority, not yet fixed, with a revisit trigger

### `web/static/analyze/analyze.js::_streamAnalyzeEvents`'s `onDone` ignores the typed `outcome`
Rationale for leaving open: always shows the success toast + sound on completion,
unlike its ~8 sibling job starters (which all branch on `outcome` before
toasting). Not currently reachable as a bug - a frontend analyze-cancel aborts
the fetch via `_supersedeActiveStream()` before `onDone` fires with `cancelled`.
Revisit trigger: if the analyze-cancel path ever changes to keep the stream
open, this becomes a live false-success risk and should be fixed to match its
siblings.
Last confirmed: 2026-07-26.

### `web/static/analyze/split.js::_doSplitAndReanalyze`'s per-segment clip-clear failure toast names a raw internal segment id
Rationale for leaving open: on a rare DB-write failure mid-split, the toast
shows the raw DB row id (unmappable to a visible label) instead of a position.
The loop has no position handy, so a clean fix wants the segment's 1-based
index/name threaded through - low value for a rarely-hit path. Revisit: copy
sibling `_abortReanalyzeChain`'s "segments N-M" 1-based-index pattern if this
is ever revisited.
Last confirmed: 2026-07-26.

### Project-switcher menu / Backup / Restore buttons aren't tagged `data-job-blocked`
Rationale for leaving open: the busy case IS handled (backend 409 + a clear
error toast), but the project's convention prefers a disabled control with a
why-tooltip over a click-then-409. These use a manual busy-check rather than
the `reject_if_busy` machinery the attribute keys off, and are rare deliberate
actions. Revisit trigger: a user reports mid-analysis switch confusion, or
`applyJobBlockedState` coverage is extended to these controls anyway.
Last confirmed: 2026-07-26.

### In-wizard GGUF download has no stall watchdog or speed/ETA
Rationale for leaving open: unlike the venv-setup window's watchdog, the
Advanced-disclosure "download now" path only shows a moving %/GB bar + Cancel.
Adding a watchdog/ETA would be a feature addition, not a bug fix - not pursued
in a review pass.
Last confirmed: 2026-07-26.

### Cosmetic: `working...` / `elapsed 0:00` micro-labels are lowercase where the rest of the app title-cases
Rationale for leaving open: not worth the churn on its own; noted so a future
copy sweep doesn't "fix" it as an isolated one-off without knowing it was seen
and deliberately skipped.
Last confirmed: 2026-07-26.

### `pipeline/ingest.py::_extract_audio_and_check_rms_overlap` catches only `except RuntimeError`, unlike its sibling `_transcribe_and_check_overlap`'s `except Exception`
Rationale for leaving open: not live today (`extract_audio_track` only ever
raises `RuntimeError`), but if `subprocess.run` itself raised (e.g. `OSError`
from a broken PATH entry), it would propagate uncaught with no `log.exception`
for that track. Widening the catch clause is a behavior change (changes what
aborts the run vs. what a per-track loop swallows), not a pure logging
addition - left for a future bug-hunt/refactor pass rather than fixed under a
logging lens.
Last confirmed: 2026-07-26.

### `sessions.py::suggest_session_groups`'s running-end uses the last-added recording's end, not the max end so far
Rationale for leaving open: only misbehaves if two recordings overlap in
wall-clock time, which doesn't happen in this app's single-user sequential-OBS
domain. Not a real bug in practice; fixing it would be speculative.
Last confirmed: 2026-07-26.
