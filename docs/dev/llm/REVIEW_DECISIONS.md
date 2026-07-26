# Review decisions - deliberate keep-as-is calls

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` to make that explicit. It exists
> so an automated review does not re-flag something a human already decided to keep.

Code-quality reviews (`shqr-code-quality-review`) sometimes flag something that
looks like duplication or an inconsistency, and the right call is to leave it
alone. This file is the record of *why*, so a future review doesn't re-flag the
same thing without the context. Most recent first.

---

## Phase 6 docs and comments - full-app review section 4, scoring - LLM backend (2026-07-26)

Docs-and-comments phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`.
Grepped every `#` comment and docstring across the four files (~120 hits) before reading;
the scope came in exemplary per Phases 1/4/5, and this pass agrees - one small accuracy
fix, nothing to delete. Verified the three CLAUDE.md-flagged load-bearing comments below.

### The `build_basic_description` docstring understated its own contract - fixed
Was: "Returns `("", "")` when the excerpt has no usable content and the clip isn't a
textless visual candidate." That describes only the first early-return
(`describe_basic.py`, the `if not excerpt` branch). A second path falls through to the
same `return "", ""` at the end of the function when the excerpt IS non-empty but yields
no speaker names, no keywords, and no dimension clearing `_DIMENSION_FLOOR` - a real,
reachable case (e.g. a short exchange between only anonymous "Speaker N" lines with
sub-threshold scores). Reworded to cover both paths. Pure docstring accuracy fix, no
behavior touched.

### The three CLAUDE.md-flagged load-bearing comments - verified accurate, left untouched
1. `llm_client.py`'s "Never surface the absolute path here" comment (on
   `LlamaCppServerClient.available()`'s missing-model-file branch) - re-read against the
   sibling `resolve_server_binary` branch three lines below it (which Phase 5 flagged as
   NOT following the same path-redaction discipline, `str(exc)` verbatim). The comment
   only describes the branch it sits on and makes no claim about the sibling - it is
   still fully accurate as written. Per this phase's brief, left as-is rather than
   strengthened to call out the gap: the gap itself is the open human-decision item from
   Phase 5 (see that entry), and editing this comment to reference it would be
   documenting a known bug into permanence rather than fixing it. Do not touch this
   comment again until that finding is resolved one way or the other.
2. `llamacpp_server.py:423-424`'s gpu-layers auto-fit comment ("gpu_layers == -1 means
   auto-fit: omit the flag... forcing all layers can OOM a small card") - re-checked
   against the guard it documents (`if gpu_layers >= 0: args += ["--n-gpu-layers", ...]`)
   - still exactly matches the code. Untouched.
3. Local-only/no-remote-backend architecture comments (`llm.py` module docstring: "All
   inference is on-device - nothing the user records leaves their machine";
   `llm_client.py` module docstring: "All inference runs locally - yuu-clip never sends
   transcript data to any external service") - both still accurate; the `_BACKEND_CLIENTS`
   registry has exactly one entry (`llamacpp`). Untouched.

### `find_related_clips`'s docstring is NOT this phase's concern - deliberately left imprecise
Noticed but did not touch: the docstring says only "Raises on LLM failure," while the
function also raises (`KeyError`/`ValueError`) on a malformed candidate item (missing or
non-integer `"id"`), unlike `request_scene_boundaries`'s sibling skip-bad-items loop.
Sharpening the docstring to spell out that asymmetry was considered, but this is exactly
the raise-vs-skip parse-robustness gap Phase 4 pinned as an open human-decision item
(see that entry) - the brief for this section explicitly excludes it from every phase's
scope, docs included, until the owner decides which behavior is correct. Do not fix the
docstring as a shortcut around fixing (or explicitly keeping) the behavior.

### `completion_text`'s one-line docstring is a literal restatement - kept anyway
`llamacpp_server.py`'s `completion_text` docstring ("Pull the assistant message text out
of a chat-completions response body.") says nothing the function name and its one-line
body (`data["choices"][0]["message"]["content"]`) don't already say - a textbook Delete
candidate under the governing rule. Left in place: it is a small, harmless outlier in a
file where every other public (non-`_`-prefixed) function carries a docstring, and
churning it for zero information gain is not worth a diff in a section this clean. Do
not re-flag; a future pass may delete it in passing if editing this function anyway, but
it does not warrant its own change.

### Terminology sweep - clean
Checked every UI-facing string this scope returns (`"Settings -> LLM scoring"` x8,
`"Settings -> AI privacy"` x1 in `_GENERATIVE_OFF_REASON`) against `GLOSSARY.md` and the
live `index.html`/`routes/llm.py` strings. "LLM scoring" matches the glossary term
exactly. The lone `"Settings -> AI privacy"` (no "LLM scoring" prefix, no "mode" suffix)
looked like a one-off drift at first read, but it exactly matches the literal
`<label class="settings-label">AI privacy</label>` UI text (the AI-privacy radio group
lives inside the LLM-scoring settings section, but is rendered as its own labeled
control) and is used identically in `routes/llm.py:169` (out of scope, but confirms this
is a deliberate app-wide phrase, not scope-local drift). Not a finding.

---

## Phase 5 logging - full-app review section 4, scoring - LLM backend (2026-07-26)

Logging-coverage phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`.
Fixed a real gap (privacy-off vs genuine backend failure were indistinguishable in the
log - see git history for `LLMScorer._mark_off_once` and the `_wait_healthy`/`_stop`
exit-code, timeout-duration, and evicted-model additions in `llamacpp_server.py`). The
items below are the deliberate-silence calls to anchor for a future pass.

### `describe_basic.py` has zero logging - deliberate, not a gap
Decision: keep this module log-free.
Rationale: it is pure in-memory template assembly over data already on the `ClipCandidate`
row (regex/dict lookups, no I/O, no external call, no exception path that isn't a
programmer error). There is no failure mode a log line would make diagnosable that a
stack trace from an uncaught `AttributeError` wouldn't already show. Do not re-flag
"no logging" here as a gap.

### `check_llm_available` / `check_vision_available` stay silent by design
Decision: keep these two read-only pre-check functions (llm.py) logging nothing, per
`check_llm_available`'s own docstring ("Return (available, reason) without logging").
Rationale: they are called from routes (out of scope for this section) on cheap,
frequent read paths (status polls, capability checks) purely to gate UI state - logging
every call would be exactly the "info-level logs inside a poll loop" spam pattern this
phase's own checklist warns against. The one-time-per-run WARNING (backend failure) /
INFO (privacy/disabled) logging lives one layer down, in `LLMScorer.is_available()` and
`LlamaCppServerClient.available()`'s callers, which run once per analyze/rescore rather
than once per poll. Do not add logging to the two check_* functions themselves.

### The GPU health-poll loop (`_wait_healthy`) is deliberately silent per-tick
Decision: keep `_wait_healthy`'s `while` loop (llamacpp_server.py) logging nothing per
poll iteration (every `_HEALTH_POLL_S` = 0.5s, for up to `_HEALTH_TIMEOUT_S` = 240s).
Rationale: a per-tick log would be up to ~480 lines of pure noise for one model load;
the loop already logs once on entry ("Starting llama-server: ...") and once on exit
(success -> "ready (model loaded in %.1fs)"; failure -> the exit-code/timeout-duration
error this phase added). That is the right altitude - do not add a per-poll log line.

### Needs a human decision (not fixed this phase): `LlamaCppServerClient.available()`'s
### binary-resolution failure reasons still leak the configured path into UI text
Finding (not applied): `available()` catches `LlamaServerError` from
`resolve_server_binary`/`_binary_in_bundle` and returns `str(exc)` verbatim as the UI-facing
`reason` (llm_client.py `available()`, around the `resolve_server_binary` call). Those two
exception messages interpolate the full configured/bundle path
(`config.llamacpp_server_binary` or the `YUU_CLIP_LLAMA_SERVER_DIR` base), unlike the
sibling branch three lines above it (missing model file) which deliberately keeps the path
out of the UI-facing reason with an explicit "never surface the absolute path" comment. The
log FILE itself is not at risk (the `_SanitizingFormatter` redacts the `\Users\<name>\`
segment before any sink), but the same string is also returned straight through to routes
(out of scope for this section) that render it in the UI, unredacted. Left as a flagged
finding rather than fixed: the right fix (generic UI reason vs. keep the specific path for
diagnosability) is a UX/privacy trade-off call, not a mechanical logging fix, and touches
route-owned rendering this section's brief excludes. Promote-to-fix trigger: either genuinely
fix, at whichever point routes/`llm_client.py` next get reviewed together.

---

## Phase 4 refactor - full-app review section 4, scoring - LLM backend (2026-07-26)

Refactor-for-quality phase over `scoring/{llm,llm_client,llamacpp_server,
describe_basic}.py` - the highest-scrutiny hard AI-backend seam (`LLMClient` ABC +
`make_client` factory, keyed on `llm_backend`). Structural survey (function-length
heat map, repeated-literal grep, a targeted concrete-backend-import grep) then full
reads of all four files. **No code changes were warranted** - this scope is genuinely
clean coming in (Phase 1 called it "exemplary, no bugs found"; Phase 2 traced the
privacy trust boundary intact with 3 defense-in-depth layers; Phase 3 added 12 tests).
Recorded per the close-out convention:

### Seam integrity re-verified at the highest scrutiny level - no violation
Decision: the `LLMClient` seam needs no structural change.
Rationale: grepped `LlamaCppServerClient|NullLLMClient|LlamaServerPool(` in `llm.py`
- zero hits; every client construction in `llm.py` (`_call_client`, `describe_frames`,
`check_llm_available`, `LLMScorer.__init__`) goes through `make_client(config)`. No
caller-side `if backend == ...` dispatch exists anywhere in scope - `_client_class_for`
+ `make_client` own the `_BACKEND_CLIENTS` lookup and the unknown-backend warn+fallback,
and `make_client` is the single AI-privacy enforcement point. `available() -> (ok,
reason)` is called through the interface (`make_client(config).available()` at
`llm.py:682`, `self._client.available()` at `:741`), never duck-typed. This section
does NOT reproduce the Section-2 DiarizationClient finding; the seam is exemplary.

### The three read-side generative-AI pre-checks are deliberate defense-in-depth - NOT DRYed
Decision: keep the `llm_enabled` + `allow_llm` gate duplicated across
`check_llm_available` (llm.py:617-620), `check_vision_available` (:677-680, via the
shared preamble), and `LLMScorer.is_available` (:735-737), each re-checking before it
delegates to the seam's `available()`.
Rationale: this is a privacy trust boundary (`resolve_ai_permissions`). The real
enforcement point is `make_client` (returns `NullLLMClient` when generative AI is off);
these three are independent read-side pre-checks that gate the UI/routes before a call,
and each re-asserting the gate is the intentional layering Phase 2 verified as "3
independent defense-in-depth layers". Extracting them into one shared helper would
collapse independent checks on a trust boundary into a single point of failure - a case
where the duplication is correct (duplicated *check*, not duplicated *knowledge* that
can drift). Also explicitly out of bounds for a routine refactor per this section's
brief ("do NOT touch the privacy-gate logic itself... flag as needs-human-decision").
Do not re-flag as DRY.

### The vision-availability pre-check inlines llamacpp path checks - kept, single-backend
Decision: keep `check_vision_available` (llm.py:611-637) probing
`llm_vision_model_path`/`llm_mmproj_path` existence inline (with its honest "Local
llamacpp backend (the only backend)" comment) rather than delegating to a new
`vision_available()` seam method, even though the sibling `check_llm_available`
delegates its final probe to `make_client(config).available()`.
Rationale: there is exactly one backend, and the vision-availability knowledge already
lives behind the seam as the hard backstop (`LlamaCppServerClient.chat_vision` raises
`VisionNotSupportedError` with the same model/mmproj checks; the "cheap pre-check + hard
backstop" split is documented on `VisionNotSupportedError`). Adding a
`vision_available() -> (bool, reason)` method to the `LLMClient` ABC + both
implementations to remove the asymmetry would be an interface change to a hard seam
serving one backend - speculative generality today ("an interface with one
implementation is usually noise"), and a seam change the brief says to defer rather than
guess on. Promote-to-seam trigger: a second LLM backend whose vision-availability
semantics differ from llamacpp's two-file (model + mmproj) check. Until then, the
inline single-backend pre-check is the right altitude. Do not re-flag as a seam leak.

### `_DEFAULT_MAX_TOKENS = 1024` duplicated across llm_client.py and llamacpp_server.py - kept
Decision: keep the completion-cap default defined in both `llm_client.py:21` (the ABC
signature default) and `llamacpp_server.py:44` (the pool `chat_completion` default),
each carrying a "matches the other" cross-reference comment.
Rationale: both are live defaults on different layers (the client interface vs the
server pool), and unifying them would force either a module-level
`llm_client -> llamacpp_server` import (defeating llm_client's deliberate lazy import of
the pool machinery) or the reverse coupling, to share a single int. The documented
cross-reference is the lighter-weight choice; the value is a tunable both layers
self-document, not a business rule that silently drifts. Below the rule-of-three (two
occurrences). Do not re-flag as a magic-constant duplication without a third occurrence
or a concrete drift bug.

### The two known parse-robustness gaps remain human-decision items - not touched here
Decision: `find_related_clips` (llm.py:441) raising on a malformed item (vs
`request_scene_boundaries`'s skip-bad-items loop), and `summarize_transcript`/
`describe_clip` lacking an `isinstance(dict)` guard on parsed JSON, are left as-is this
phase.
Rationale: these are behavior-contract questions (fail-loud vs skip-and-continue on a
partially-bad model reply) flagged and pinned by Phase 3 tests as deliberate
human-decision items on a correctness-adjacent module, not pure quality cleanups. A
refactor pass must not silently change which inputs raise vs degrade. Applying
`request_scene_boundaries`'s skip pattern to `find_related_clips` is defensible but
changes the failure contract, so it stays a human call. Left for the owner to decide;
do not "fix" under a refactor lens.

---

## Phase 1 test integrity - full-app review section 4, scoring - LLM backend (2026-07-26)

Test-integrity phase over `scoring/{llm,llm_client,llamacpp_server,describe_basic}.py`
and their tests (`tests/unit/test_{scoring_llm,llamacpp_server,privacy_modes,
preflight_llm,describe_basic}.py`, `tests/integration/test_{llm,vision}.py`, plus the
LLM-touching classes `TestScanHotwordsSemantic` in `test_hotwords.py` and
`TestSceneScorerPromptSelection`/`TestSceneScorerSparseTranscript`/
`TestSceneScorerJsonRobustness` in `test_scene_scoring.py`). Baseline was green
(3370 passed) before and after - **no code or test changes were warranted**.

Structural survey (grepped every class/function name across ~4867 lines of test code)
then full reads of the two highest-risk files per the phase brief - `llm_client.py`
(the privacy-mode enforcement choke-point) and `llamacpp_server.py` (the process pool,
site of the documented `--n-gpu-layers` OOM landmine) - plus every test file in scope.

### Privacy-mode enforcement tests are exemplary - the spy pattern is the right shape
`test_privacy_modes.py::TestMakeClientEnforcement::test_none_never_constructs_any_client`
patches `LlamaCppServerClient.__init__` with a spy that records construction, then
asserts the spy list is empty under `ai_privacy_mode="none"` - this proves the untrusted
path never even *instantiates* the real client, not just that some Null-typed object came
back. This is the correct test shape for a trust boundary (construction-time proof, not a
type-check that a mock could satisfy accidentally) and should be the template for any
future privacy-gate test in this codebase.

### The gpu-layers OOM landmine is directly and correctly pinned, not encoded as "correct"
`test_llamacpp_server.py::TestBuildArgs::test_autofit_omits_gpu_layers_flag` asserts
`gpu_layers=-1` (autofit) omits `--n-gpu-layers` entirely (with an inline comment naming
"The critical spike lesson"); `test_cpu_passes_zero_layers_and_no_device` pins `0` for
CPU; `test_forced_layer_count_is_passed` uses an arbitrary `20`, never `99`. Cross-checked
`llamacpp_server.py:313-320` directly (not just via the tests) - no hardcoded `99` or
forced-max-layers path exists in the source either. Nothing to fix; recorded so a future
pass doesn't need to re-derive this from scratch.

### Concurrency tests use real threads + `Event.wait(timeout)`, not sleep-based polling - correct pattern
`TestPool::test_shutdown_not_blocked_during_health_wait` and
`test_inflight_request_not_killed_by_concurrent_new_key` spin real `threading.Thread`s
against a monkeypatched blocking call and synchronize via `threading.Event` with a
generous (2-3s) timeout, never a bare `sleep()` race. This is the durable-synchronization
pattern the test-integrity checklist asks for, already in place - not a finding.

### No vestigial remote/hosted-backend references anywhere in scope
Grepped `anthropic|Claude|remote_ai|remote_ok` (case-insensitive) across
`llm.py`/`llm_client.py`/`test_scoring_llm.py`/`test_privacy_modes.py`: zero hits. The
Claude/Anthropic backend removal (2026-07-15) left no dead code or stale test fixture in
this section for a future pass to trip over.

### Minor stylistic nit, not fixed (below the bar for a code change)
`test_scoring_llm.py::TestCallLlmJson::test_max_tokens_threaded_to_client` asserts
`call.call_args.args[3] == 2048` (positional-index into `_call_client`'s 4th arg) rather
than a kwarg-based assertion. It tests real behavior (max_tokens actually reaches the
client call), not a tautology, so it was left as-is - flagged here only so a future pass
doesn't need to re-derive that it was considered and intentionally left alone.

---

## Phase 6 docs and comments - full-app review section 3, scoring (2026-07-26)

Docs-and-comments phase over the same 17 files as the Phase 4 refactor entry below
(`scoring/{energy,prosody,speechrate,churn,lexicon,textmatch,laugh,audio_event,
scenes,visual,wav_access,protocol,scorer_set,engine,dedup,similarity,term_scope}.py`).
Grepped every `#` comment and `"""`/`'''` docstring in scope (0.5 survey), then read
all ~2870 lines in full. **No code changes were warranted** - zero restatement,
obsolete, reactive, or apology comments found anywhere in scope, and no aging
TODO/FIXME/HACK markers. This matches Phase 1's "unusually clean" characterization
and Phase 4's finding that prior refactor passes (WS-A..D) already reshaped this
section; the comment density is uniformly high-value (WHY-explanations of scoring
math constants/thresholds, narrow-except reliability-pattern warnings from Phases
2-3, availability-probe contracts) with nothing to prune.

Specifically verified per this phase's brief:

### `engine.py::_run_scorers`'s laugh special case - comment present and clear
Confirmed the `scorer.name == "laugh"` branch (lines 329-334) already carries the
WHY comment the Phase 4 refactor entry's keep-decision promised ("Store the laugh
scorer's raw, unweighted result as its own attribute so laugh density can be
sorted/displayed apart from its weighted contribution to score_funny..."). No
addition needed.

### Formula/threshold comments distinguish WHY from WHAT throughout
Spot-checked every numeric constant with an adjacent comment for the WHAT-restatement
pattern the brief called out (weighted averages, thresholds, windowing) - all of them
state a rationale, not a restatement: `prosody.py`'s CoV saturation points (why
intensity is weighted above pitch), `speechrate.py`'s CALM/FAST WPS bounds (why
those specific values - "relaxed English speech sits ~2 wps, animated bursts hit
4-6"), `churn.py`'s switches-per-minute saturation, `energy.py`'s downsample-factor
table (why "fast" is only marginally quicker - IO-bound at SSD speeds), `visual.py`'s
`_MAX_INTENSITY` (why peak+mean are blended so one spike can't max the score),
`textmatch.py`'s name-correction cutoff design (already anchored below - kept
inline). None read as a restatement candidate.

### Terminology sweep - clean
Grepped `\bAI\b|RP context|clip candidate|demo reel|subtitle|Probe|profile` (the
recurring code-name-in-user-facing-text drift pattern) across all 17 files: zero
hits. `Visual` appears only in dev-facing comments/identifiers (`Visual axis`,
`VisualActivityScorer`, `VisualActivity` table) consistent with the glossary term -
none of this section's log/comment text is user-facing (no `console.print`; this is
all `log.*`/docstring text reaching only `.yuu-clip/yuu-clip.log`). Spot-checked
`laugh.py`/`audio_event.py`'s module-docstring specifics (model id, ~350 MB size)
against `config.py`'s `scorer_laugh_model_id` default and comment - still accurate.

---

## Phase 4 refactor - full-app review section 3, scoring (2026-07-26)

Refactor-for-quality phase over the signal scorers + aggregation
(`scoring/{energy,prosody,speechrate,churn,lexicon,textmatch,laugh,audio_event,
scenes,visual,wav_access,protocol,scorer_set,engine,dedup,similarity,term_scope}.py`).
Structural survey (function-length heat map + the targeted narrow-except sweep) then
targeted reads of the assembly/aggregation core and the longest real-logic functions.
**No code changes were warranted** - this scope is genuinely clean coming in (Phase 1
called it "unusually clean"; Phases 2-3 fixed the real reliability bugs; prior refactor
passes WS-A..D already reshaped it). Recorded per the close-out convention:

### `scorer_set.py` - single-registration assembly, no per-scorer branches - kept
Decision: Keep as-is.
Rationale: Adding a scorer is one line in `build_clip_scorers`'s returned list; the
four `build_*` variants share that single source and carry no `if scorer == ...`
dispatch. This already matches the "adding a backend = a registration, not a rewrite"
convention. Nothing to decompose (each builder is well under 30 lines, one concern).

### `engine.py::_run_scorers`'s `scorer.name == "laugh"` special case - kept, not generalized
Decision: Keep the single name-keyed branch that stores the laugh scorer's raw,
unweighted density on `clip.score_laugh` separately from its weighted `score_funny`
contribution.
Rationale: laugh is the only scorer whose raw result must be persisted apart from its
weighted aggregation (for sort/display). A generic mechanism - e.g. a `raw_scores`
dict on `ScoreResult` the engine writes polymorphically - would be speculative
generality serving exactly one consumer (YAGNI). The branch is localized, documented
with a WHY comment, and keys on the Protocol's `name` attribute (not `isinstance`), so
it stays backend-agnostic. Revisit only if a second scorer needs a raw side-channel.

### `engine.py::_compute_overall` - already dynamic-weight and well-decomposed - kept
Decision: Keep as-is.
Rationale: Divides by the live dimension-weight sum (not a hardcoded divisor), returns
`None` when all weights are zero (callers guard it), and is a single 15-line concern.
The larger `ScoringEngine` methods (`score_clip`, `_run_scorers`, `_write_dimension_scores`,
`_apply_basic_description`) are each single-concern and under the size bar. No change.

### The two-method scorer availability surface (`is_available()` bool + `available()` tuple) - kept
Decision: Keep both methods where present, and keep energy/scenes/visual with only
`is_available()`.
Rationale: `is_available()` is the `Scorer` Protocol method the engine uses; where a
scorer also exposes `available() -> (bool, reason)` (prosody, speechrate, churn,
lexicon, laugh, audio_event), `is_available()` delegates to `available()[0]` - no
duplicated probe logic. The tuple form exists exactly where a consumer needs the
user-facing reason (`ingest.py`'s laugh/audio-event notices, `routes/llm.py`'s status
surfaces); energy/scenes/visual omit it because nothing reads their reason, so adding
it would be speculative generality. This is an appropriate asymmetry, not drift.

### `similarity.py` backend seam - factory owns all dispatch - kept
Decision: Keep as-is.
Rationale: The three backends (`TfidfBackend`, `EmbeddingsBackend`, `LlmBackend`) each
implement the same interface (`available() -> (bool, reason)`, `rank_similar`,
`match_concepts`); `_construct`/`make_backend` own every `if backend == ...` branch and
the tfidf-fallback + first-use model-load policy; no caller branches on the backend
name. The `isinstance(backend, EmbeddingsBackend)` check inside `make_backend` is the
seam's single cross-cutting-policy point (the fetch-verify-or-fall-back gate), which the
convention explicitly places at the factory - not a caller-side leak.

### `textmatch.py::find_fuzzy_matches`'s inner sliding-window scan - kept inline
Decision: Keep the per-term `while` window-scan inline rather than extracting a
`_scan_windows(...)` helper.
Rationale: The function is ~43 lines but a single cohesive concern (fuzzy-match each
term across the text), and its one subtle invariant - a hit consumes its whole window
so overlapping windows can't double-count - is already documented in the docstring at
the exact spot it matters. Extracting the loop would split that invariant from its
explanation for no legibility gain. Below the rule-of-three (one call site).

### Narrow-except reliability sweep across the rest of the scope - clean
Grepped `except (ImportError|ModuleNotFoundError)` across churn/speechrate/lexicon/
textmatch/visual/dedup/term_scope/protocol/engine/scorer_set.py (the files Phases 2-3
did not primarily target) for the availability-probe crash pattern those phases fixed
7 times. Zero instances - none of these modules import a compiled/optional dependency
inside an `available()`-style probe. `scenes.py::_detect_content`'s narrow
`except ImportError` remains (its sole caller already wraps the compute in a broad
except, per the Phase-3 note), so it is not a live crash risk; left as-is.

---

## Phase 6 docs and comments - full-app review section 2, transcription & diarization (2026-07-26)

Docs-and-comments phase over `yuu_clip/transcribe/{whisper_runner,diarization_client,
transcriber,align,project_voice,speaker_attach}.py` and `yuu_clip/subtitles.py`.
Grepped every `#` comment and docstring in scope, then read each file in full
(~2285 lines). Comment density here was already excellent going in - Phases 1-4
exercised this code hard and it shows in the comments too. No restatement,
obsolete, or apology comments found anywhere in scope; nothing was deleted.

Applied - 3 additions, all comment-only (verified with `yuu-dev test-api`, 3341
passed, and `yuu-dev lint` clean):

- `diarization_client.py::diarize_with_embeddings` - added a 3-line comment
  immediately above the `_consolidate_labels(...)` call clarifying it deliberately
  takes `speaker_match_threshold` (a SIMILARITY), not the `cluster_threshold`
  (a DISTANCE) used one line above for `_cluster_labels(...)`. The distinction was
  already well documented at each definition (config.py's DISTANCE/SIMILARITY
  callouts on `speaker_cluster_threshold`/`speaker_match_threshold`,
  `_consolidate_labels`' own docstring) but not at this call site, where a reader
  scanning just the function body could otherwise read the threshold swap as a
  copy-paste bug.
- `project_voice.py::_best_exemplar_score` - added a comment above the
  `backend is not None and ...` guard explaining the None-backend legacy-data
  tolerance (deliberately skips the cross-backend filter when the caller doesn't
  know the query vector's own backend). Previously this behavior was explained
  only in `tests/unit/test_project_voice.py::test_none_backend_compares_across_all_backends`'s
  comment, not in the source.
  - Same fix, same reasoning, in `speaker_attach.py::_best_voiceprint_match`'s
    equivalent `active_backend is not None and ...` guard (previously explained
    only in `tests/unit/test_diarization.py::test_none_active_backend_compares_across_backend_mismatch`).

Verified and deliberately left as-is - do not re-flag:

### ARCH-3 (align.py's seam-convention exception) - module docstring still reads clearly
Re-read `align.py`'s module docstring (lines 15-26) against the ARCH-3 decision
recorded in this file's Fable-review WS-5 entry (below). Still accurate: no
`alignment_backend` config value, one implementation, the single caller
(`web/routes/common.py`) never gates on availability. No edit needed.

### Multi-line docstrings on internal (`_`-prefixed) functions across this section - kept, not pared to one-liners
Same call as the Phase 6 section-1 entry above (`ingest.py`'s private helpers):
`diarization_client.py`'s clustering helpers (`_consolidate_labels`,
`_prune_small_clusters`, `_densify_labels`, etc.), `project_voice.py`'s matching
functions, and `subtitles.py`'s rendering helpers (`_highlight_shade`,
`strip_baked_speaker_prefix`, etc.) all carry docstrings substantially longer than
a name-restating one-liner, despite CLAUDE.md's "No docstrings on internal
functions" guidance. Every one earns its place under the governing rule: they
document non-obvious algorithm invariants (`_prune_small_clusters`' "monotonic in
the grouping distance" guarantee), numeric-threshold rationale, or a subtle
edge case a name can't carry (`_densify_labels`' hole-filling behavior feeding
user-visible "Speaker N" numbers). Do not re-flag as a docstring-density issue.

### Terminology sweep - clean
Grepped user-facing `console.print`/log-adjacent text in all 7 files against
`docs/dev/llm/GLOSSARY.md`. "Captions" vs "subtitles" is the one term this
section touches directly - confirmed `subtitles.py`'s own docstrings/comments
never claim to be user-facing (the module/variable name split is already
documented in CLAUDE.md as deliberate) and no `console.print`/error string in
scope says "subtitles" where a user would read it. No other code-name leaks
("profile", "AI", "RP context") found.

---

## Phase 5 logging - full-app review section 2, transcription & diarization (2026-07-26)

Logging-coverage phase over `yuu_clip/transcribe/{whisper_runner,diarization_client,
transcriber,align,project_voice,speaker_attach}.py` and `yuu_clip/subtitles.py` - the
speech-to-text and speaker-identity stage of the analyze pipeline, a common source of
confusing "why did my clips have no captions/wrong speaker" reports. Grepped every
`logger.`/`log.` call and every `except` block in scope first (0.5 survey), then read
each file in full.

Applied: `speaker_attach.py::diarize_track`'s entry log ("Running diarization for
track %d [%s]...") now includes `backend=%s` (`config.diarization_backend`), matching
`whisper_runner.transcribe_track`'s entry log, which already names its backend. Low
cost, and the value grows the day a second diarization backend exists (today only
`speechbrain`/`null`) - a user comparing two runs' results can already tell which
transcription backend ran from the log; diarization couldn't.

Confirmed and deliberately left as-is - do not re-flag:

### This section already had exemplary logging coming in - no gaps found
Phases 1-4 of this section (test integrity, bug hunt, coverage, refactor) already
exercised this code hard, and it shows: every model load (Whisper CUDA-to-CPU
fallback, SpeechBrain ECAPA encoder), every backend-unavailable path (`diar_client
.available()` reason surfaced as a `warning` with the actual missing-package reason),
and every catchable failure (`transcribe_track`'s caller in `ingest.py` wraps with
`log.exception`; `diarize_track` catches both `DiarizationError` and bare `Exception`
with `exc_info=True`; `align.py`'s `realign_words`/`realign_segment_words` already log
every failure mode at the correct level) already carries a log line with
`track.id`/`track.label`/`video_id` context. Nothing in scope has a bare `except`
with no log call - the earlier grep-first survey found zero.

### No log spam in any loop
`whisper_runner.py`'s per-segment loop drives a Rich `Progress` bar, not per-segment
logging. `diarization_client.py`'s per-embedding-batch loop (`_embed_windows`) and
per-cluster-merge loops (`_consolidate_labels`/`_prune_small_clusters`) log nothing
per-iteration - only one summary `info` line per `diarize_with_embeddings()` call
(bounded to once per track). `speaker_attach.py`'s `_report_attach_decision` fires
once per resolved speaker *cluster* (bounded by speaker count, typically single
digits), not per turn or per embedding - not spam.

### `subtitles.py` and `project_voice.py` carry no logging at all - confirmed not a gap
Both are pure, deterministic, torch/DB-free transformation modules (no model calls, no
subprocess calls, no network). `subtitles.py` raises `ValueError` for missing
transcript data and lets file-write `OSError`s propagate; `project_voice.py` is pure
cosine-similarity/clustering math. Every real caller of either lives in
`yuu_clip/web/routes/*.py` and `yuu_clip/pipeline/ingest.py` - both out of this
section's scope - so a raised exception is the correct failure signal for the caller
to catch/log with its own request/run context, and adding logging inside these two
pure modules would either duplicate that caller-side log or (for the many
`refresh_export_sidecars` call sites in `web/routes/`) log without the request context
that makes a log line useful. Revisit if a future section's review of those callers
finds an uncaught/unlogged `refresh_export_sidecars`/`export_srt_sidecars` failure.

### Terminology sweep - clean
Confirmed via `web/sse.py`/`web/analyze_job.py` that this section's SSE-visible text
comes from `console.print` (Rich stdout tailed by the subprocess pump), not from
`logger.`/`log.` calls, which only reach `.yuu-clip/yuu-clip.log`. Checked both:
neither the `logger.*` calls nor the `console.print` lines in scope use "subtitles"/
"AI"/"profile"/other banned code-name framing in user-facing text (the one hit for
"subtitle" is `speaker_attach.py`'s docstring referencing the `_import_subtitles`
*function name*, which is a code identifier, not user-facing copy - no fix needed).

### The `diarization_backend != "null"` guard around the skip-log is dead code, not a logging gap
`diarize_track`'s `if not ok: if config.diarization_backend != "null": ...` can never
take the inner branch when `ok` is `False` and the backend is `"null"`, because
`NullDiarizationClient.available()` unconditionally returns `(True, "")` - so `ok`
is never `False` when the backend is `"null"`. The log line itself is correct and
reachable for the one backend where it matters (`speechbrain`); the guard is
vestigial dead code, a bug-hunt/refactor finding, not something to fix under a
logging-coverage lens. Left for a future bug-hunt/refactor pass over this file.

---

## Phase 6 docs and comments - full-app review section 1, analyze pipeline (2026-07-26)

Docs-and-comments phase over the same 12 files as the Phase 5 logging entry below
(`pipeline/{ingest,run_meta}.py` + the 10 `analyze/*.py` stage helpers). Grepped every
`#` comment and `"""` docstring in scope and read each file in full. The comment density
here was already high quality going in (refined across this section's earlier phases and
several prior review passes) - only one restatement comment survived.

Applied: deleted `pipeline/ingest.py::_import_subtitles`'s
`# Attach to the first do_transcribe track (or track 0 as fallback).` immediately above
`target_track = next((t for t in track_objs if t.do_transcribe), track_objs[0] if track_objs else None)`
- the comment translated the one-liner into English without adding any WHY (it didn't say
*why* the first do_transcribe track, just restated the fallback the ternary already
spells out). Comment-only; `yuu-dev test-api` 3331 passed (unchanged), lint clean.

Verified and deliberately left as-is:

### The two CLAUDE.md-flagged load-bearing comments are present, accurate, and survived Phase 4's extraction
- `ingest.py:250-252` - the SpeechBrain-must-be-prewarmed-before-transformers import-order
  comment, paired with `_should_prewarm_transformers`'s docstring. Matches the actual
  prewarm call site and CLAUDE.md's "SpeechBrain poisons transformers.pipeline" section.
- `extract.py:179-184` (`_build_clip_cmd`'s header) + `:216-224` (the softsub branch) - the
  ffmpeg `-ss`/`-t` argument-ordering invariants, including the two-input softsub ordering
  bug this comment guards against. Both read correctly against the current code after
  Phase 4's `_audio_stream_maps()` extraction - the softsub comment's claim that `-t` must
  come after both inputs, and the map-args comment's claim about honouring the
  `audio_stream_index` contract, both still hold.

### The many multi-line docstrings on internal (`_`-prefixed) functions in `ingest.py` - kept, not pared to one-liners
Decision: do not strip `ingest.py`'s docstrings on private helpers (`_resolve_existing_video`,
`_upsert_video_and_tracks`, `_reusable_track_transcript`, `_transcribe_and_check_overlap`,
`_retranscribe_video`, `_clear_existing_clips`, etc.) down to bare one-liners, despite
CLAUDE.md's "No docstrings on internal functions - clear names are enough" guidance.
Rationale: every one of these documents genuinely non-obvious return-value shape or
side-effect behavior a name alone cannot carry - e.g. `_resolve_existing_video`'s "Returns
(video_path, existing) or None when the caller should skip this video (ID not found, or
already done without --force)", or `_reusable_track_transcript`'s explanation of *why* it
also deletes stale rows as a side effect (a truncated transcript from a run that died
mid-track, which reusing would silently pass off as complete). This is the same bar the
governing rule sets ("explains why, or something a careful reader can't tell from the code
itself") and matches precedent already recorded for this exact pattern elsewhere in the
codebase (the "approval.py route docstrings... kept" and "transcribe_track ~76 lines - not
decomposed" entries below). Not a phase-6 finding to fix; do not re-flag.

### Terminology sweep - clean
Grepped every `console.print` line in the 12 in-scope files against `docs/dev/llm/GLOSSARY.md`
for a code-name-in-user-facing-text slip (the recurring pattern class this project has hit
before - "profile" vs "Track layout", "AI" vs "LLM"). `labeler.py` already says "Track
layout" consistently in every user-facing line; no "profile"/"AI"/"RP context" leaks found
in this scope beyond the ones Phase 5 already fixed (`_llm_unavailable_message`/`_notice`).

### `docs/dev/llm/REVIEW_MAP.md`'s Stage 1/Stage 2 file lists - verified accurate
Spot-checked the file list and one-line descriptions for all 12 in-scope files (lines 36-62)
against the current module docstrings and content. No file was renamed or moved this
section (only 2 helper extractions and a few logger calls in earlier phases), and the
descriptions still match. No doc edit needed.

---

## Phase 5 logging - full-app review section 1, analyze pipeline (2026-07-26)

Logging-coverage phase over `yuu_clip/pipeline/{ingest,run_meta}.py` and
`yuu_clip/analyze/{probe,extract,labeler,overlap,proxy,frames,motion,framing,pause,
thermal}.py` - the analyze pipeline's orchestration and every per-stage helper, the
single most operationally critical path in the app. Confirmed via `web/sse.py` and
`web/analyze_job.py`: every `console.print` line these modules emit is tailed as the
child subprocess's stdout and reaches the browser's live log panel over SSE - so
these strings are genuinely user-facing, not just CLI decoration, and glossary
compliance applies to them.

Applied:
- **`run_meta.py`'s `StageRecorder.stage()` now logs stage boundaries to the file
  log** (`log.info` on start/finish, `log.warning` on an unhandled exception
  propagating out of the stage, each carrying the video's filename via a new
  `StageRecorder(label=...)` constructor arg). Previously the *only* narrative of a
  run's progress lived in `console.print` (Rich stdout, piped only to the live SSE
  stream and an in-memory reconnect buffer capped by `_MAX_BUFFER_LINES`) - none of
  it reached `.yuu-clip/yuu-clip.log`. A user who closes the browser (or hits a run
  long enough to overflow the buffer) and later checks the log file per this
  project's own "if it fails, check yuu-clip.log" troubleshooting convention would
  find only the sparse `log.exception`/`log.warning` calls, missing which stage the
  pipeline reached before dying. This is the highest-value fix of the pass.
- `ingest.py`'s `_analyze_one` now logs `Analyze started` / `Analyze finished
  (elapsed_ms=...)` bookends to the file log for the same reason (per-video, not
  per-stage - one line each, no spam).
- `run_meta.py::_resolve_devices`'s bare `except Exception: diar_device = "cpu"`
  (silently swallowing a torch/CUDA probe failure into an unremarkable "cpu"
  device report) now logs at `debug` before falling back.
- **Correlation-id consistency**: the Extract/Transcribe per-track failure logs and
  the subtitle-import failure logs used `video=%s` (bare filename or `Path` object)
  while every other failure log in `ingest.py` keys on `video_id=%s` - a reader
  grepping one video's `video_id` across a run would miss these three lines. Added
  `video_id=%s` alongside the existing filename (kept for human readability) at all
  three sites; `video.id` is always populated by the time these run.
- `extract.py::_probe_duration_s`'s silent `except (ValueError, AttributeError,
  TypeError): return None` (a failed ffprobe duration parse after export, which
  silently skips `_verify_export_duration`'s corrupt-export guard) now logs at
  `debug` with the raw ffprobe output and exit code.
- **Glossary fix**: `ingest.py`'s `_llm_unavailable_message`/`_llm_unavailable_notice`
  said "AI clip ranking and descriptions" / "AI score and descriptions" - these
  strings reach the browser (confirmed above), and the glossary explicitly bans "AI
  scoring"/"AI" framing in favor of "LLM scoring" (`GLOSSARY.md:806-807`). Reworded
  both to "LLM clip ranking and descriptions" / "LLM score and descriptions". No test
  pinned the old wording (`test_preflight_llm.py` mocks the function; `test_run_meta.py`
  appends its own literal warning string, unrelated to this function's output).

Confirmed and deliberately left as-is - do not re-flag:

### The rest of `ingest.py`'s exception handling is already exemplary
Every stage that can fail already pairs a user-facing `console.print` with a
`log.exception`/`log.error`/`log.warning` carrying `video_id` (or `path`/`video=` when
the video row doesn't exist yet - Probe runs before the row is created, so filename is
the only identity available). `_probe_video`, subtitle import, extraction, transcription,
scoring, scene generation, video summary, and run-metadata recording all follow this
pattern. Nothing else needed adding.

### No log spam found in any per-frame/per-track loop
`frames.py`/`framing.py`'s `_extract_frame` (called once per sampled frame, up to ~10)
already logs failures at `debug`, not `info`. `motion.py`'s per-sample decode loop
(`_sample_from_container`) logs nothing per-frame by design - only a single `warning`
if the whole decode fails. `overlap.py`'s per-frame RMS decode failure is `debug`. None
of these needed a level change.

### `extract.py`'s `export_clip`/`export_clip_with_preset`/`_run_ffmpeg` (clip export,
not audio extraction) carry no logging of their own - confirmed not a gap
These raise a bare `RuntimeError` on ffmpeg failure with no log call inside `extract.py`
itself. Left as-is: `extract_audio_track` (the pipeline's own audio-extraction call, used
by `ingest.py`) already logs via its caller; the clip-export functions are called only
from `export/render.py` and `web/routes/analyze.py` (both outside this review section's
scope), and spot-checking `render.py` confirms it already logs the failure with
`clip_id` context before/around the call. Those two call sites are this codebase's
export feature, not the analyze pipeline, and will fall under whichever later review
section covers `export/`/`web/routes/`.

### Thermal auto-pause events are already logged - by the caller, not `thermal.py`
`ThermalTrigger.poll()` returns a typed `ThermalPollResult` with no logging of its own;
its one caller, `web/routes/analyze.py::_thermal_poll_loop` (outside this section's
scope), already logs both `warn_triggered` and `pause_triggered` at `warning` with the
temperature and threshold. Confirmed via grep before concluding this was a gap - it
is not.

### DEFERRED - not fixed this phase (needs a bug-hunt/robustness lens, not a logging one)
`ingest.py::_extract_audio_and_check_rms_overlap` catches only `except RuntimeError` per
track, while the structurally identical transcription loop
(`_transcribe_and_check_overlap`) catches `except Exception`. `extract_audio_track` today
only ever raises `RuntimeError`, so this isn't live, but if `subprocess.run` itself ever
raised (e.g. `OSError`/`PermissionError` from a broken PATH entry resolved after
`find_ffmpeg()` returned), it would propagate uncaught out of `_analyze_one` with no
`log.exception` for that track - a real gap, but *widening a catch clause* is a behavior
change (it changes what aborts the run vs. what a per-track loop swallows and continues
past), not a pure logging addition, so it was left for a bug-hunt/refactor pass to weigh
rather than changed silently here.

---

## Phase 7 UX/UI - full-surface review (2026-07-23, shipped 2026-07-24)

The `UX-REVIEW-2026-07-23.md` fix plan shipped across six stages (commit range
`d5a3618..fd43f3e`): all 11 HIGH, ~24 MEDIUM, and ~29 LOW findings from a full
shqr-ux-ui-review surface walk were fixed or deliberately skipped. Owner decisions:
H9 kept the wizard Launch block and added a Cancel to the CUDA install; M21 unified
both export surfaces on soft (embedded) captions as the default; M22 uses undo-toasts
for library row deletes; M10 renamed the split confirm to "Split recording" with
danger styling; Low 13 removed the bottom Close from About/Controls/Getting Started so
all five info-modals close via the top-right X (Controls gained a top X to match).

**Did not reproduce (skipped, not fixed):** M16 (setup.html inline hex literals) -
the wizard token re-skin had already removed them. Low 16 same. Everything else in
the plan reproduced and was fixed.

**Confirmed-intentional - do NOT re-flag** (verified good during the walk):
- Empty-state onboarding (`videos.js`): mascot + one gold CTA + analyzing-swap state.
- `install-error.js` failure-class mapping (network/disk/antivirus/no-wheel/CUDA) -
  exemplary plain-English error design (the one gap, M17's fallback sentence, is fixed).
- Boot-time modal a11y stamping (`boot.js`) + single document-level focus trap
  (`ui.js`) + showConfirm defaulting focus to Cancel.
- Dirty-state guards funnelling through one "Discard changes?" confirm + beforeunload.
- Undo toast with a visible shrinking countdown bar (`ui.js`).
- Cancel-left / verb-specific-primary-right button order across action modals; gold
  `highlight` reserved for the two Export confirms.
- Toasts mirrored into `#sr-live-polite`/`#sr-live-assertive` (`utils.js`).
- Universal `:focus-visible` ring + `prefers-reduced-motion` block (`app.css`).
- `--visual` sharing `--action`'s hue (bars always labelled).
- Kind-filter chip tooltips teaching clip-vs-scene at point of use.
- Calm "setup state, not failure" no-model copy (`videos.js`, `clips.js`) - the
  reference pattern for capability-missing states.
- Wizard: status-slot re-render never wipes typed values; restore-only-in-initial-mode;
  optional CUDA section hidden when empty on non-NVIDIA; FFmpeg failure row's model
  recovery path.
- Glossary-term compliance clean across the five region partials.
- modelcatalog reconnect-poll behaviours (can't cancel another window's download;
  verifies the file landed before declaring success).
- Per-video computed "Retranscribe before export" default with safe fallback.

### Low 29 - pointer-only resize handles + split-timeline markers (accepted)
Decision: the sidebar/player resize handles and the split-editor timeline markers stay
**pointer-only** - no keyboard path for placing a split marker or dragging a resize
handle. Accepted for a mouse-first desktop tool (single Windows user). The trigger to
revisit: a keyboard-only or AT user actually needs to split a recording or resize a
pane. Do not re-flag as a keyboard-accessibility gap.

---

## Fable-review WS-5 - backend seam hygiene (2026-07-24)

Three deliberate keep/exception calls made while shipping WS-5 (ARCH-1..4 +
ARCH-policy) from `FABLE-REVIEW-PLAN-2026-07-23.md`. ARCH-1 (warn on unknown
backend) and ARCH-2 (unify the seam availability probe on `available()`) were plain
fixes, not keeps, so they are not recorded here.

### align.py (forced alignment) is a documented exception to the seam convention (ARCH-3)
Decision: `transcribe/align.py` stays a pair of module-level functions
(`realign_words` / `realign_segment_words`) - NOT wrapped in the ABC +
`make_*(config)` factory + `available()` convention that the other model-backed
seams follow.
Rationale: none of the convention's machinery has a consumer here. There is no
`alignment_backend` config value, exactly one implementation (torchaudio
WAV2VEC2_ASR_BASE_960H, English-only), and the single caller
(`web/routes/common.py`) never probes availability - it calls
`realign_segment_words` and falls back to a static caption line when it returns
`None` (which the function already does for non-English audio or any failure, never
raising). Adding a factory + Null backend + availability probe for one best-effort
function would be speculative generality with nothing to serve. The trigger to
promote it behind the convention: a second aligner (e.g. non-English) that a caller
must select or gate on. Documented in `align.py`'s module docstring. Do not re-flag
as a seam-convention violation.

### The cancelable out-of-process vision path is llamacpp-server-only by design (ARCH-4)
Decision: the frame-analysis subprocess (`pipeline/frame_analysis.py` ->
`scoring/llm.describe_frames_via_server` -> `post_chat_completion`) POSTs vision
requests straight to the parent web server's warm llama-server instead of going
through the `LLMClient` seam. Left as-is and documented, NOT refactored to route
through `make_client`.
Rationale: the llama-server pool is per-process and warmed once per process.
Constructing an `LLMClient` inside the subprocess (`make_client(config).chat_vision`)
would spawn a second server and re-load the multi-GB vision model - the exact
double-load the out-of-process design exists to avoid. In-process vision
(`describe_frames`) DOES go through the seam and is backend-agnostic; only the
cancelable path bypasses it. Consequence, stated in the seam contract
(`llm_client.py` `vision_payload_messages` docstring): "a second LLM backend is a
registration, not a rewrite" holds for scoring and in-process vision, but a new
backend would need its own out-of-process mechanism to get cancelable frame
analysis. A full routing fix was judged too risky for this pass (it would touch the
per-process warm-server invariant). Do not re-flag as a seam leak without that
context.

### Policy: the setup wizard's scope does not grow toward Settings parity (ARCH-policy)
Decision (locked policy, not just a keep): the Electron setup wizard stays
minimum-viable first-run - pick/download ONE text LLM model and write `config.json`
- and everything else (vision model, Whisper size, scoring weights, hardware, hot
words, etc.) is finished in the in-app Settings. New model-selection or
configuration surfaces are added to Settings, NOT mirrored into the wizard.
Rationale: the wizard and Settings are two parallel model-selection stacks that
CANNOT share runtime code (browser vs Electron main/Node, and the wizard runs before
the Python server exists) - see the CLAUDE.md "Wizard and Settings are parallel
model-selection stacks" section. `yuu-dev shared-data` + the drift guard keep the
shared *data* (`catalog-data.json`) in sync, but they cannot see *behavior*
duplication: the wizard's downloader (`electron/`) and `cli/models.py download-gguf`
are independent implementations with independently-evolved retry/resume/verify.
Every feature the wizard grows doubles that invisible surface. Holding the wizard's
scope down is the mitigation the drift guard can't provide. If the wizard ever must
gain a new config (e.g. vision-model selection), treat it as a deliberate,
separately-reviewed scope expansion - and it must write the correct config key
(`llm_vision_model_path`, never `llm_model_path`; enforced by
`test_shared_data_drift.py`).

---

## Refactor-for-quality WS-D - frontend JS extractions close-out (2026-07-23)

WS-D (9 frontend JS extractions + vitest for zero-coverage modules, D1-D9) shipped one
item at a time (`d3e2718`..`4b83fde`) with a `yuu-dev bundle` + `yuu-dev test-js` gate
between each (410 -> 492 JS tests) plus a full `yuu-dev test-ui` (650 passed, 1 known
xdist-parallelism flake that passes in isolation) and `yuu-dev test-unit` 1777 (bundle/
index/side-effect drift guards) at close. See the refactor-for-quality plan's per-item
ledger and commit SHAs in the planning workspace history (plan doc since archived - all
items shipped). No plan item was dropped or improvised. Recorded here per the close-out
convention:

### The three URLSearchParams query builders are deliberately NOT unified (anchored keep)
Decision: `analyze/reel.js` (`_reelPoolQs`, `confirmBatchExport`), `clips/clipexport.js`,
and `library/exporteditor.js` (`buildExportParams`, D2) each keep their own
`URLSearchParams` assembly; they are not refactored into one shared builder.
Rationale: this was flagged out of scope by the plan's "Deliberately out of scope" list and
pre-recorded in the WS-C close-out entry below. The three build different query shapes for
different endpoints (reel-pool filtering vs batch-export options vs single-clip export with
caption-style fields) over different caller state - same basis as the anchored `routes/llm.py`
capability-tier keep. D2 turned exporteditor's builder into a pure, testable
`buildExportParams({captionMode, preset, titleCard, config})` but kept it editor-specific;
that is intra-module extraction, not the cross-module unification this keep forbids. Do not
re-flag the three as duplication.

### Three extractions expanded the plan's sketch signatures - deliberate, not drift
Decision: D1's `computeReelEstimate` omits the sketch's `transDur` param; D2's
`computeTrimBoundary` ctx adds `effStartMs`/`effEndMs` beyond the sketch's
`{clipStart, clipEnd, minDurationMs}`; D3's `_timelineRowHtml` takes a `memberId` the
sketch's `(row)` omitted.
Rationale: each is what behavior-preservation required, not a redesign. `updateReelEstimate`
read `demo-trans-dur` into a `transDur` local the estimate math never used (a pre-existing
dead read) - threading it through the pure fn would fabricate a used-looking param.
`computeTrimBoundary`'s 1s-minimum guard floors against the opposite edge's *current*
effective position (offset-adjusted), which `clipStart`/`clipEnd` alone cannot express.
`_timelineRowHtml`'s `data-goto-video`/`data-clip-video` nav attrs need the member id, which
`mergeTimelineEntries` deliberately keeps out of its pure rows. Each is noted inline in the
plan's row.

---

## Refactor-for-quality WS-C - Python behavior-preserving extractions close-out (2026-07-23)

WS-C (7 behavior-preserving Python extractions, C1-C7) shipped one item at a time with a
full `yuu-dev test-api` gate between each (all green: 3120 -> 3161 passed) plus a final
`yuu-dev test-system` real-pipeline pass. See the refactor-for-quality plan's per-item
ledger and commit SHAs in the planning workspace history (plan doc since archived - all
items shipped). No plan item was dropped or improvised. Recorded here per the close-out
convention:

### `web/analyze_job.py`'s 2 SSE frames were deliberately NOT converted to `sse_event` (C4)
SUPERSEDED by the SSE typed-event migration (stage 4, 2026-07-24): `sse_event` /
`_done_event` were retired entirely, and `analyze_job.py` now frames its buffered events
through the single `jobevents.frame` entry point. The scope decision below is kept for the
historical record only.

Decision: Leave `analyze_job.py:189,198` as raw `f"data: {json.dumps(...)}\n\n"`.
Rationale: C4's stated scope is exactly the 5 route files
`routes/{videos,scoring,sessions,speakers,clips/export}.py` and its 66-frame count matched
those files exactly. `web/analyze_job.py` (the AnalyzeJob replay buffer) is a separate
module outside that enumerated scope; converting it would be scope creep beyond the plan
item. The new `web/sse.py::sse_event` helper is the single definition of the frame contract
and `analyze_job.py` could adopt it in a future pass - it is not an inconsistency to
re-flag as a bug, just an unconverted call site left by an intentionally-scoped mechanical
substitution. (No circular-import blocker was found; this is a scope decision, not a
technical one.)

### C5's per-caller `error_log_prefix` string is a deliberate tradeoff, not naming drift
Decision: `_score_one_clip` takes a preformatted `error_log_prefix` string from each caller
rather than a structured `(clip_id, video_id)` pair.
Rationale: the two rescore routes logged different formats on failure - the batch route
`"rescore_clips: clip N failed for video M: <exc>"` (with the video id) and the single-clip
route `"rescore_clip: clip N failed: <exc>"` (without). Passing each caller's fully-formatted
prefix keeps both log lines byte-identical to the pre-refactor output; a structured param
would have forced one unified format and silently changed one of the two log lines. The
extraction was behavior-preserving including diagnostic log text, so the string param is the
faithful choice.

---

### The URLSearchParams builders (reel.js/clipexport.js/exporteditor.js) are NOT part of WS-C
Deferred to the WS-D (frontend) session's close-out, since they are JS modules WS-C never
touched. Recorded here only so the pointer is not lost: the plan's "Deliberately out of
scope" list keeps them separate (different callers, different fields), same basis as the
anchored `routes/llm.py` capability-tier keep.

---

## Refactor-for-quality WS-A+B - test-tier rebalance close-out (2026-07-23)

WS-A (10 test-file splits moving pure-by-dependency tests from `tests/integration`
to `tests/unit`) and WS-B (new unit tests on already-pure, previously-untested
logic) both shipped - see the refactor-for-quality plan's full per-item ledger in the
planning workspace history (plan doc since archived - all items shipped). Recorded
here per the close-out convention:

### 4 of WS-B's 8 items were SKIPPED - already covered, not written
Decision: do not write near-duplicate tests for B1, B2, B4, B6.
Rationale: each item's target function turned out to already have thorough
direct unit coverage by the time WS-B started - either freshly relocated by a
WS-A move in the same session (B1's `_apply_name_suggestions`/
`_voiceprint_name_suggestions` and B2's `_build_clip_cmd`/`_preset_video_filter`
moved in A4/A3; B4's `_build_xfade_cmd`/`_segment_start_times` moved in A3+A9),
or pre-existing and simply not surveyed (B6's `_cosine_similarity`/
`serialize_voiceprint`/`deserialize_voiceprint`/`best_voice_match` already had
a dedicated `tests/unit/test_project_voice.py`, whose own module docstring
names it). Each SKIP is recorded inline in the plan file with the specific
test classes/counts that already satisfy it. **Do not re-flag these as
untested** - re-verify against the current test files before assuming a gap.

### A structural pytest fix was required mid-move, not anticipated by the plan
Decision: add empty `tests/unit/__init__.py` + `tests/integration/__init__.py`.
Rationale: pytest's default prepend import mode raises "import file mismatch"
when a same-basename test file exists in both `tests/unit` and
`tests/integration` and both tiers collect in one session (`yuu-dev test-api`)
- which every WS-A move does by construction (same filename, new directory).
Discovered on the very first move (A10) and fixed once for the whole
workstream. `tests/ui` deliberately kept `__init__.py`-free since 36 files rely
on bare `from conftest import ...`, which needs the file's own directory on
`sys.path` (package-qualifying it would break that).

### Two pre-existing cross-file `TestSafeFilename` duplicates surfaced, not fixed
Decision: leave both in place; this was a move-only workstream.
Rationale: `tests/unit/test_export.py::TestSafeFilename` (from A3) and
`tests/unit/test_reel.py::TestSafeFilename` (from A9) both test the same
`web/routes/reel.py::_safe_filename` with different test names/cases - a
pre-existing duplication in the integration tier that predates this refactor,
now just relocated verbatim rather than merged (WS-A's rule: import-path
fixes only, no behavior or dedup changes). Flagged for a future WS-C/dedup
pass, not touched here.

---

## Phase 6 docs and comments - window.X shim-drain slice (2026-07-23)

Docs-and-comments phase over the shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`).
Applied one obsolete-comment fix class: three per-module "Public API" export-block header
comments (`analyze/analyze.js`, `clips/clips.js`, `videos/videos.js`) still described one
consumer type as a "classic (bundle.js) consumer" / "still-classic module". The classic
`bundle.js`/`bundle.manifest` were retired when the ESM migration completed (main.esm.js:3-4,
ARCHITECTURE.md:183-185), so that consumer no longer exists - rewrote each to the accurate
current set (another already-ESM module reading the export off window, an inline handler in
index.html, or a tests/ui page.evaluate). Comment-only; rebundled. This is the obsolete-comment
class Phase 4 corrected inside `main.esm.js` but did not reach in the individual modules.

The following were reviewed and deliberately left as-is:

### `main.esm.js` residual-shim banner + GROUP 1/2 comments - current and accurate
The two-group shim banner (rewritten Phase 3, attributions corrected Phase 4) matches the
live code: GROUP 1 lines each name a live runtime reader, GROUP 2 records per-cluster why each
test-only hook can't be dropped. Nothing stale remains here.

### `core/jobs.js` 9 near-identical "window.* read" comments - kept
The 9 repeated `// window.* read: a direct import here adds a jobs.js <-> videos/clips edge
that ... breaks vitest's vi.mock` comments mark the documented exception (CLAUDE.md:231-234).
Each guards a distinct call site against being "fixed" to an import; the repetition is the
point (a reader editing any one site sees the warning). WHY comment, keep.

### `core/boot.js` + `analyze/split.js` window-bridge WHY comments - kept
`boot.js`'s `window._prereqs`/`_aiPrivacyMode`/`_visionEnabled` comment and `split.js`'s
live get/set accessor-bridge comment both describe mechanisms that still exist; they explain a
non-obvious current coupling (the vitest follow-on bridge), not a retired one. Accurate, keep.

### Project docs (CLAUDE.md frontend section, ARCHITECTURE.md, ROADMAP) - verified current
CLAUDE.md's "shrinking residual window.X = X shim" section and jobs.js "9 window.* reads" count
match the code; ARCHITECTURE.md's shim section explicitly flags the old all-window pattern as
stale-if-cited; ROADMAP's shim-drain entry was fully removed in 9d21aac (plan CLOSED). No doc
edit warranted.

---

## Phase 5 logging - window.X shim-drain slice (2026-07-23)

Logging-coverage phase over the same shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`).
Browser-side "logging" here is `showToast` error surfacing plus `appendLog` to the in-app
log panel - the frontend deliberately carries almost no `console.*` (one documented
`console.warn` in `utils.js`). **No code changes were warranted**; the conversion introduced
no swallowed error. Confirmed and deliberately left as-is:

### The conversion left the SSE/job error paths intact and fully surfaced
`core/jobs.js` `_openSSE`/`streamSSE` remain the exemplar: `_openSSE` handles `!res.ok`
(reads the error body), a stream that ends without a completion signal, a mid-stream
connection loss, and the outer fetch rejection - each routed to `onError`; `streamSSE`'s
`onError` appends the bracketed line to the log, toasts it, plays the error sound, tears the
job UI down, and calls the caller's `onError`. A typed `done{outcome:error}` event (since
the SSE typed-event migration; the old `__DONE__` sentinel forms and `isDoneSentinel`/
`doneError` helpers were retired in stage 4) routes a failure to `onError` via the shared
`decodeEvent`, so no reader reports a failed job as done. `analyze.js`, `videos.js`,
`clips.js`, `settings/projects.js`, `core/utils.js` all surface fetch `!ok`/catch via
`showToast` or an inline error region. Nothing to add.

### Every empty / identifier catch in the arc is a deliberate tolerant fallback
`sessions.js`/`clips.js`/`preview.js` `try { videoEl.currentTime = ... } catch {}` (a
media-element seek that can throw before metadata loads), `clips.js:788` (re-fetch the clip
after analyze-frames; falls back to the cached copy, and the frame job already reported its
own failure), `videos.js:333` `_restoreView` (corrupt/missing saved-view JSON -> ignore),
`videos-timeline.js:67` and `utils.js` `_exportRetranscribeDefault` (populate a modal / a
checkbox default from `/api/config`; a failure keeps the safe built-in default),
`analyze.js:747`/`:766` (preview warm + completion warning, each carrying a WHY comment that
a failure must never surface as an error), `projects.js:27` (switcher stays hidden if the
list can't load). None is an error path a user needs told about; adding a log/toast to any
of them would be noise on a benign, self-healing condition - same basis as the 2026-07-13
`_cardCollapseState` / `copyText` decisions.

### No log spam introduced
The conversion added no per-frame / per-SSE-event / per-render `console.*` or `appendLog`
call. The in-app log panel is still bounded to `_MAX_LOG_LINES` (500) with its documented
reflow-cost WHY, and the full log always remains in `.yuu-clip/yuu-clip.log`.

### BUILT in Phase 9 (owner-approved): top-level `window.onerror` / `unhandledrejection` reporter
The frontend had **no global uncaught-error surface**. This is exactly the Phase-2 bug class:
a bare-identifier `ReferenceError` on a rare path (Escape with nothing open) shipped and failed
silently - nothing logged it and nothing told the user. Built as `core/errorreporter.js`
(`initGlobalErrorReporter()`, wired FIRST from `boot.js` so it catches errors from later boot
steps): every uncaught `error` and `unhandledrejection` is mirrored to `console.error`, appended
to the in-app log panel (`appendLog`, so a non-technical user can open + copy it for a bug
report), and surfaced as a persistent error toast whose "Show log" action calls the existing
`openLog()`. A looping error (same signature within 5 s) is logged every time but toasted at
most once, so a per-render throw can't stack identical toasts. Uses only the existing
`showToast`/`appendLog`/`openLog` surfaces - no new infrastructure, no server round-trip.
Covered by `tests/js/core/errorreporter.test.js` (5 tests). This is the durable closing of the
diagnosability gap that let the Phase-2 bug ship - do not re-flag it as missing.

---

## Phase 4 refactor - window.X shim-drain slice (2026-07-23)

Refactor phase over the shim-drain arc (`25e44dc^..HEAD`, HEAD `9d21aac`) that converted
the frontend off `window.*` globals onto ESM imports and consolidated the residual shim in
`main.esm.js` into two labeled groups. Applied: corrected two stale reader-attributions in
the GROUP 1 shim comments that the Phase-3 comment rewrite missed - `closeNewRecordingPanel`
was labeled "shortcuts.js + analyze.js onclick-string" but Phase 2 converted shortcuts.js to
`import` it (no window read remains), so its only live reader is the analyze.js onclick-string;
`openSettings` was labeled "... onclick-string + bare-global" but every JS caller (clips,
videos, clipexport, settings) now imports it, so the "+ bare-global" clause is dead and the
line survives only via the onclick-strings (added clipexport to the list). Comment-only;
rebundled. Gate: `yuu-dev test-js` 367, `test-unit` 1069, `lint` clean.

The following were reviewed and deliberately left as-is:

### GROUP 1 shim lines all verified alive; GROUP 2 kept whole - not drained
Decision: Keep every current shim entry.
Rationale: Grepped every GROUP 1 name's claimed runtime reader - all confirmed live: jobs.js
reads loadVideos/_clipsListUrl/_updateDemoButton/_syncAnalysisLivePanel/_renderClips/
_renderClipFilterCounts off window (the documented vi.mock exception); format.js reads
window._clipsSortParam; helpmodals.js reads window.closeHamburger; panelnav.js reads
window.showConfirm; sidebar/header/split-editor inline handlers and the `_diarizationNoteHtml`
onclick-strings (evaluated in global scope) keep the rest. `undoLastBulkStatus` is a genuine
clips.js bare-global (clips.js does not import it). No GROUP 1 line is droppable. GROUP 2 is
the deferred vitest follow-on's territory (each cluster's per-name note records why it can't
be reached by a real click yet) - draining it is out of this slice's scope, same basis as the
2026-07-16 "residual shim - kept in full" entry.

### No unused imports, no arc-orphaned dead code, `_diarizationNoteHtml` already shared
Decision: Keep as-is (nothing to fix).
Rationale: A full-tree scan for imports used zero times in their file found none - the 68-read
conversion left no import residue. `_diarizationNoteHtml` (a candidate DRY target, appears in
analyze.js / contexts.js / clipexport.js) is already centralized in `core/utils.js` and
imported by all three consumers - clean, not duplicated. `boot.js` is a long module-scope init
sequence but it is the one CLAUDE.md-exempt side-effect entry point (one concern: first-paint
wiring); its `window._prereqs`/`_aiPrivacyMode`/`_visionEnabled`/`refreshServerState` globals
are the already-documented shared-mutable-state bridge for the vitest follow-on, not drainable
here.

### `const data = await res.json()` idiom kept - not "naming drift"
Decision: Keep `data` for a parsed JSON response body.
Rationale: This appears at ~30 sites across the frontend as the established name for a fetch's
parsed JSON payload; it predates the arc (not introduced by the conversion) and is an idiomatic
local for the immediately-destructured response body. Renaming to a bespoke name per call site
would be churn against a consistent convention for no legibility gain.

---

## Phase 6 docs and comments - pre-public polish (dev-CLI / wizard / whisper-catalog) (2026-07-18)

Docs-and-comments phase over the hand-written new/changed logic since baseline `6848574`
(the `001_PRE-PUBLIC_polish-pass` body). Applied two user-facing glossary fixes (glossary
bans "AI scoring" in favour of "LLM scoring"):
- `videos/videos.js` "scored without a language model" tooltip said "re-score for AI
  scoring and descriptions" while its sibling branch one line up already says "LLM scoring
  failed" - fixed to "LLM scoring" (internal consistency + glossary). Rebundled.
- `partials/modals/about.html` third-party grouping header "AI scoring" -> "Local AI"
  (the row it heads, llama.cpp, does LLM scoring AND vision/image-analysis, so the narrower
  "LLM scoring" would undersell it; "Local AI" is accurate and matches existing wizard
  copy - "Set up local AI"). Re-stitched index.html. No test pinned either string
  (`test_ui_page.py` only asserts the About version); `test-js` 226 + `test-unit` 983 green.

The following were reviewed and deliberately left as-is:

### `whisper_catalog.py`, dev-command modules, `constants.js`/`setup-preload.js`/`whisper-select.js` WHY comments - kept
Every comment in the in-scope dev modules and wizard-data files explains a genuinely
non-obvious constraint, not restatement: `whisper_catalog.py`'s module docstring records
that the size/VRAM strings were the classic hand-copy drift point now single-sourced here;
`constants.js`/`setup-preload.js`/`recommend-model.js`/`setup-renderer.js` document the
generated-from-Python catalog seam (`yuu-dev shared-data`), the packaged-vs-dev binary
provenance, the setup-version re-show rule, and the esbuild-tree-shakes-string-referenced-
functions reason for event delegation; `whisper-select.js` carries the measured VRAM
headroom rationale. All earn their place. The box-drawing `--` section dividers in
`setup-renderer.js` are the codebase-wide comment-only convention (2026-07-10 entry) - a
`.js` comment, never console-bound - not re-flagged.

### `approval.py` route docstrings and `clipcreate.js` picker comments - kept
`approval.py`'s one-line route docstrings and its "pending"/"approved" references are
accurate descriptions of the code's status values (code identifier, not user-facing text -
the UI renders "Unreviewed"). `clipcreate.js`'s inline-preview-not-#player-area rationale
and the clips-vs-scenes kind comment explain real WHYs. No change.

### FLAGGED (needs human decision - a factually-wrong comment entangled with behavior)
`electron/recommend-model.js:36-38` justifies its `gpuVendor !== 'nvidia' => CPU-only`
recommendation with "the bundled llama.cpp build is CUDA, and ... AMD/Intel GPUs run
llama.cpp on CPU here". That rationale is **factually wrong**: the bundled llama-server is
the **Vulkan** build (`constants.js:31-36` - the dir holds `vulkan\`+`cpu\`; Python
`resolve_server_binary` prefers vulkan), and `setup-renderer.js:109-119` tells non-NVIDIA
users "your GPU speeds up LLM scoring" via that Vulkan engine. So the wizard shows a
capable AMD/Intel user "your GPU speeds up LLM scoring" on one screen while the local-model
recommendation (`recommendLocalModel`) treats the same machine as CPU-only ("No CUDA-capable
GPU detected. Runs on CPU..."). The NVIDIA gate was a deliberate commit (`eb997eb`
"treat non-NVIDIA GPUs as CPU-only"), so the *behavior* may be intended - but its stated
reason is false and it contradicts the sibling wizard copy. Fixing the comment alone would
either restate a falsehood or expose that the code under-credits Vulkan GPU accel; fixing
the code is a product/behavior change (VRAM thresholds were tuned for CUDA) beyond this
docs phase. Wizard owner should decide: credit Vulkan GPU accel for non-NVIDIA cards in the
recommendation, or keep the NVIDIA gate but correct the comment's rationale to the real one.

**RESOLVED (same session, owner-approved, commits `8ae92f4` + `44f71c8`):** kept the NVIDIA
gate but made it honest. The gate's real basis is VRAM *measurability*, not acceleration -
only NVIDIA gets the `nvidia-smi` VRAM override in `gpu-detect.js`, so the large model can't
be safely sized for AMD/Intel even though the Vulkan build accelerates them. `8ae92f4` fixed
the code comment; `44f71c8` split `isCpuOnly` into `canSizeGpu` (model sizing / strong-push
gate) + `gpuAccelerates` (copy) so a non-NVIDIA GPU user now reads "Your GPU accelerates local
AI, but its video memory could not be measured, so lightweight is the safer pick" instead of
the false "No CUDA-capable GPU detected. Runs on CPU". Recommendation *behavior* unchanged;
the two tests that encoded the old false assumption were rewritten. This is no longer an open
decision.

---

## Phase 5 logging - pre-public polish (dev-CLI / approval route / setup wizard) (2026-07-18)

Logging-coverage phase over the hand-written new/changed logic since baseline `6848574`
(the `001_PRE-PUBLIC_polish-pass` body). Surveyed every logging/console/error surface in
scope; **no code changes were warranted** - the surfaces are already diagnosable and
cp1252-clean. Verified and deliberately left as-is:

### `web/routes/clips/approval.py` - already logs both routes with context
`auto_approve` logs `Auto-approved %d clips with %s >= %.2f for video %d` and
`reset_approvals` logs `Reset %d clip approvals for video %d` - each carries the count,
the video id, and (for auto-approve) the score field + threshold. That is enough to
reconstruct a mis-approval from `.yuu-clip/yuu-clip.log` without a code reread. Validation
rejects (bad threshold / unknown score_field / missing video) surface as `HTTPException`
to the browser toast, the established pattern; they are expected user-input errors, not
log-worthy failures. No gap.

### New `yuu-dev` dev-command modules (`fixture`, `helpdocs`, `htmlstitch`, `shareddata`, `typecheck`, `tests`, `serve`) - developer console output, not application logging
Same basis as the already-anchored `bundle.py`/`testjs.py` entry (2026-07-16). These are
`yuu-dev` developer-CLI tools; their "logging" surface is Rich `console.print` to the
developer, not the app log file. Each failure path prints a red, ASCII-only, actionable
message and raises `typer.Exit` with a non-zero code (`fixture` --force hint, `typecheck`
propagates mypy's returncode, `tests` the pre-check trio - no server / >1 server /
leftover pytest procs - each exit 3 with the fix, `serve` port-in-use + processing-active
guards). `htmlstitch.stitch` raises `FileNotFoundError` on a missing partial so a typo can
never silently drop a region. Confirmed **zero non-ASCII** in any print/console string
across all in-scope dev modules + `whisper_catalog.py` + `approval.py` (Python scan), so
no cp1252 console-crash risk. Application-style `logging` would be the wrong tool for
one-shot dev ergonomics.

### `electron/setup-renderer.js` - pure display; the diagnosable trace lives in `main.js`
The wizard renderer has no `console.*` calls by design: it is a thin view over the
`setup:*` IPC. Every failure it can show - GGUF download failed, package install failed,
initial status check failed, restore-backup failed - is surfaced to the user in the DOM,
and the operation that actually failed runs in `main.js`, which logs each one via
`logSetup` with the error message and (for installs) the pip stderr tail
(`Wizard install failed`, `GGUF model download failed`, `GGUF model download blocked`).
So a 3am wizard failure is both user-visible AND recorded in the app log. The `…`
ellipses in the renderer's status strings ("Downloading…", "Checking…") are browser/
Chromium DOM text rendered as UTF-8 - the anchored 2026-07-09 browser-DOM ellipsis
decision applies, not the cp1252 console rule. `recommend-model.js` / `whisper-select.js`
are pure data transforms with no error paths. No gap.

### RESOLVED 2026-07-24 - `main.js` `setup:get-status` now logs its failure path too
This entry originally flagged that `setup:get-status` logged a status line via `logSetup`
only on its success path (was line 298, now 332); if it threw before that (e.g. `detectGPU`
raising), the renderer showed "Setup check failed" but nothing was written to the app log.
Fixed by wrapping the handler body in `try/catch` with a `logSetup('Status check failed: ...')`
call on the failure path, matching the sibling `setup:*` handlers in the same file. No longer
open; do not re-flag.

---

## Phase 4 refactor - pre-public polish (fixture/help-docs/wizard-data) (2026-07-18)

Refactor phase over the hand-written new/changed logic since baseline `6848574` (the
`001_PRE-PUBLIC_polish-pass` body): the new `yuu-dev` dev commands (`fixture-project`,
`help-docs`, `shared-data`, `typecheck`, `test-unit`/`test-integration`/`test-all`), the
`whisper_catalog.py` product list, `htmlstitch.py`, the in-app Help viewer
(`markdown.js` + `helpmodals.js`), the merged Clips+Scenes client-side kind filter
(`clips.js`/`videos.js`/`shortcuts.js`/`state.js`/`boot.js`), the centralized
`shared/escapehtml.js` + `shared/whisperlang.js`, and the wizard's catalog-data wiring
(`constants.js`/`recommend-model.js`/`setup-renderer.js`). Applied: deduped
`helpmodals.js`'s standalone `_escText` escaper into the now-canonical shared `escHtml`
(`shared/escapehtml.js`) - the escaper was centralized this same window (format.js now
re-exports it; whisperlang imports it), so the local copy was a leftover third instance.
Gate: `yuu-dev bundle` + `test-js` 226, `test-ui --changed` (help + smoke) 12 - green.
The following were reviewed and deliberately left as-is:

### `markdown.js` `inlineMd` leading `& < >` escape - kept inline, not routed through `escHtml`
Decision: Keep the inline `.replace(/&/g,...).replace(/</g,...).replace(/>/g,...)` at the
head of `inlineMd`.
Rationale: It is the first stage of a chained inline-formatting transform (escape, then
`` `code` ``/`**bold**`/`*italic*`/`[link]()`), not a standalone escaper. The shared
`escHtml` also escapes `"` -> `&quot;`; substituting it would change this function's output
string for any doc text containing a quote (visually identical when rendered, but a real
diff the guides' golden tests could pin). Below rule-of-three now that `_escText` is gone
(canonical `escHtml` + this one pipeline stage), and coupling a markdown parser's escape
step to the attribute-safe escaper buys nothing. Revisit only if a third standalone `& < >`
escaper appears.

### New `yuu-dev` dev-command modules (`fixture.py`, `helpdocs.py`, `htmlstitch.py`, `shareddata.py`, `typecheck.py`) - already well-decomposed
Decision: Keep as-is.
Rationale: Reviewed for the phase's hard rules (function length, one concern, naming, no
duplication). Each is short, single-concern, and factored around the right seam -
`fixture.py`'s `seed_project_db` is deliberately the single seed routine shared with the
integration conftest (the `with_scenes` flag is the documented divergence point, not a
behavior-flag smell); `shareddata.py`/`whisper_catalog.py` follow the established
`model_catalog.py`/`content_presets.py` frozen-dataclass + small-helpers pattern;
`tests.py`'s `_run_tiers_code`/`_run_tiers` already extract the shared tier-runner. No
high-value structural change found - further edits would be churn.

### `setup-renderer.js` `applyDefaults` (~44 lines) and `clips.js` `openClipsActionsMenu` nested ternary - kept whole
Decision: Keep as-is.
Rationale: `applyDefaults` is one concern (fill the wizard form from saved config on first
render) - a flat sequence of DOM assignments that only shares local state; splitting it
would fragment that single first-render pass across helpers for no readability gain (same
basis as the kept `transcribe_track`/`_attach_speakers` calls). `openClipsActionsMenu`'s
three-way create-item ternary (Scenes -> "New scene", Clips -> "New clip", All -> both) is
short and carries a WHY comment explaining the All-view "offer both" choice; a dispatch
table would be more machinery than three literal cases justify.

---

## ESM migration + JS-test rebalance review (2026-07-16)

Full `shqr-code-quality-review` (all 7 phases) over the 64 commits since baseline
`fffa951` - the frontend ESM migration into feature subdirs (`core/videos/clips/analyze/
settings/people/library`), the single committed `bundle.esm.js`, the new vitest
`tests/js/` tier, and the dev-CLI `bundle`/`test-js` commands. Applied changes this pass
(recorded in git, not repeated here): fixed a migration-introduced dead control in
`analyze/split.js` (the suggestion-pin click delegation was dropped in the inline->
delegation conversion; +Playwright regression test); added dev-CLI error-path tests
(`tests/unit/test_dev_cli.py`) and ported the vision cancel-wiring to a real vitest test
(`tests/js/clips/vision.test.js`), retiring the strict-xfail Playwright poke; fixed a
teardown-determinism bug in `tests/unit/test_bundle_drift.py`; hoisted a duplicated
`node_available()` probe into `dev/_base.py`; corrected two stale flat-path doc references
(`CLAUDE.md`, `GLOSSARY.md`) and trimmed two dangling merged-branch comment references.
Gate: `yuu-dev test-js` 158, `test-api` 2714, full `test-ui` 762, `lint` clean - all green.
The following were reviewed and deliberately left as-is:

### `docs/dev/ARCHITECTURE.md` verified accurate - no fixes
The new human on-ramp matches the post-ESM reality: single committed `bundle.esm.js`,
the seven feature buckets (`core/videos/clips/analyze/settings/people/library`), the
retiring residual `window.X` shim described as a shim not the architecture, and the four
test tiers (unit/integration/ui/js). No aspirational or wrong content found.

### Routes feature-map header `#   UI: static/<bucket>/foo.js` paths - verified, not changed
The bulk path update in the 24 `routes/*.py` feature-map headers was spot-checked against
Glob for every referenced module (contexts->library, settings-backup/projects/modelcatalog
->settings, split->analyze, namecorrections/speakers/voices->people, sessions->videos,
etc.). Every bucket is correct. The bare `videos.js`/`clips.js`/`reel.js` that appear
second in a prose list (e.g. `reveal.py`) are unambiguous and left as-is.

### `main.esm.js` residual-shim per-section comments, and Feature-map `·`/arrow glyphs - kept
Already anchored: the shim comments are the deferred vitest follow-on's territory (the
"residual `window.X = X` shim - kept in full" entry below), and the non-ASCII Feature-map
header glyphs are a codebase-wide comment-only convention (2026-07-10 entry below). Neither
reaches the cp1252 console. Not re-flagged.

### New dev-tooling WHY comments (`bundle.py`, `testjs.py`, `build-esm.mjs`, `tests/js/**`) - kept
These explain genuinely non-obvious constraints, not restatement: the drift guard's
byte-identical comparison needing the same output dir, Node-only-for-rebuild, invoking
vitest via `node <entry>` to dodge Windows `.cmd` shim resolution, and each `tests/js`
header's port provenance + why-vitest-not-Playwright. The one `TODO(shim-collapse)` in
`format.test.js` is tagged to the known deferred workstream with its reason, not an
ownerless aging TODO. All earn their place.

### `llm_client.available()` / `_llamacpp_capabilities` genericized their missing-file strings - path deliberately NOT re-added to the file log
Decision: Keep the missing-model strings path-free, in the returned reason **and** in the
log line that carries it (`scoring/llm.py:743` `log.warning("LLM scoring disabled: %s",
reason)`).
Rationale: The reason string renders in the UI (clip descriptions, analyze warnings, and
any screenshot), so it was deliberately changed to say "The set-up local model file is
missing - re-download it under Settings -> LLM scoring." instead of leaking the absolute
`llm_model_path` (the user's home dir). That same string is what the file logger records,
so the log no longer names the path. This is NOT a diagnosability gap and must not be
"fixed" by re-adding the path to the log: the condition itself is logged clearly (LLM scoring
disabled + the missing-file reason), the exact path lives in `config.json`
(`llm_model_path`) one file away on the single-user machine, and re-adding an absolute
home-dir path to `.yuu-clip/yuu-clip.log` would contradict the no-sensitive-paths-in-logs
rule. Verified no other site in `yuu_clip/` logs the model path. Covered by
`tests/unit/test_scoring_llm.py` + `tests/integration/test_llm.py` (which assert the
strings carry no path).

### `dev/bundle.py`, `dev/testjs.py`, `scripts/build-esm.mjs` - developer console output, not application logging
Decision: Keep the Rich `console.print` / esbuild-driver output as-is; do not add a logging
framework.
Rationale: These are `yuu-dev` developer-CLI tools. Their failure surfaces are already
clear and actionable to the developer running the command: missing Node, missing
esbuild/vitest, and a failed esbuild build each print a red, ASCII-only message naming the
fix (`npm install`, install Node), and `build_esm_bundle` embeds esbuild's captured stderr
in its `RuntimeError` so the drift guard can never pass a stale bundle silently. All new
console strings are cp1252-safe (no em-dash/emoji/box-drawing). Application-style logging
(`logging`/`_log`) would be the wrong tool for one-shot dev ergonomics.

### `main.esm.js` residual `window.X = X` shim - kept in full
**Superseded by the "Phase 4 refactor - window.X shim-drain slice (2026-07-23)" entry
above** ("GROUP 1 shim lines all verified alive; GROUP 2 kept whole - not drained"), which
re-verifies this same keep-as-is call against the current GROUP 1/GROUP 2 structure - the
per-section comment structure this entry originally described no longer exists. See that
entry for the current rationale.

### `bundle.py` uses `subprocess.run` while `testjs.py` uses `_base.run_and_tee`
Decision: Keep the two invocation styles.
Rationale: Not duplication - they need different things. `build_esm_bundle` captures
stdout/stderr so it can embed esbuild's failure detail in a `RuntimeError` (the drift
guard must never pass a stale bundle silently); `test-js` streams vitest output live and
tees it to a log via the shared `run_and_tee`. Collapsing them would lose one or the other
behavior.

---

## Post-Claude-removal review - characters / jobs-progress / transcriber seam (2026-07-15)

Scoped `shqr-code-quality-review` over `4d95f3a..HEAD` (the un-reviewed work
since the 2026-07-13 review closed: transcription backend seam, characters
feature, jobs/progress rework, dev-CLI notices/lock-deps, and the remote Claude
backend removal). Keep-as-is calls surfaced:

### `speaker_attach._attach_speakers` (~48 lines) and `whisper_runner.transcribe_track` (~76 lines) - not decomposed

Both exceed the ~30-line guideline but each is a single cohesive concern.
`_attach_speakers`'s label-collection, match/mint loop, and per-segment id
assignment share the matched/minted/without-voiceprint counters that exist only
to feed one summary log line - splitting them would pass those counters across a
seam for no readability gain. `transcribe_track`'s streaming-persist body lives
inside one Rich `Progress` context (persist segments as the backend yields them);
extracting part of it would fragment that context. **Kept whole.**

### `jobs.js` `parseProgress`/`JOB_STAGES` mirroring `pipeline/progress.py` - not deduplicated

The JS progress parser deliberately mirrors the Python `parse_progress` + stage
model across the process boundary (subprocess stdout -> browser). It cannot share
code (different runtimes) and the duplication is already coupling-guarded by
`tests/unit/test_progress_stage_coupling.py`, which greps `jobs.js` for each
Python stage id. **Kept as an intentional, test-guarded mirror**, same rationale
as the Wizard/Settings parallel stacks. (Minor: that guard matches the stage id
wrapped in single quotes; a future double-quoted reference in `jobs.js` would
false-fail. Left as-is - the convention holds today and altering a passing guard
without a reason is churn.)

### `notices.py` `_is_license_file` - tightened via extension blocklist, not a stricter name regex

The Phase 2 hunt flagged the license-name regex as able to over-match a
`license.py`-style source module. Fixed by rejecting source/binary suffixes
(`.py/.pyc/.pyi/.pyd/.so/.dll/.dylib`) rather than anchoring the name pattern
harder. Deliberate: for a licensing-notice artifact an **under-match silently
drops a real license file** (worse than a cosmetic over-match), and no genuine
license text ever carries those extensions, so a suffix blocklist is the
lower-risk guard. Covered by `TestIsLicenseFile`.

### `shared/tokens.css` `--on-warning` token - kept despite losing its last consumer

The Remote LLM badge that used `--on-warning` was deleted with the Claude
backend. The token is now unconsumed, but every theme block must define the full
token set (the theme-invariant test asserts this), so removing it from one block
would require removing it from all and could reopen a contrast pairing later.
**Kept; only its stale "Remote LLM badge" comment was removed.** (The token later moved
from `app.css` into the shared `shared/tokens.css` file - `:root`/dark/light lines
34/90/124 - when the theme tokens were centralized; still zero consumers.)

### analyze-frames job made non-cancellable (SUPERSEDED same day)

Originally resolved a wrong-cancel-copy + stuck-spinner bug by making the frame job
non-cancellable. **Superseded** within the session: the user confirmed a long vision
run on a large model over many frames is a real risk, so image analysis was reworked
to a killable subprocess (pipeline/frame_analysis.py) that POSTs to the warm
llama-server - a genuine mid-inference cancel - and the spinner leak was closed with a
caller-facing `streamSSE` onError hook plus an onCancel cleanup. This entry is kept
only so a future review knows the non-cancellable state was deliberate-then-replaced,
not an oversight.

---

## Theme G glyph sweep - close-out of the 2026-07-13 review (2026-07-14)

P2 tier of the stage-by-stage code-quality review. The review flagged lone non-ASCII
glyphs (`->` arrows, `...` ellipses, `<=`, gear) scattered across Python strings as
outliers of the project's ASCII-console convention. Decision (user-approved): a
**targeted sweep** - ASCII-fix only the glyphs in strings that can reach the cp1252
console, and leave the rest. What was swept and, more importantly, what was deliberately
kept:

### Swept (runtime strings that can reach the console)
`console.print` / `_log.*` / `print()` strings and CLI-reachable labels: the extract /
labeler / windower / whisper_runner / diarization_client / videos log lines, the
`discord-10mb` "<=10 MB" preset label, **and the LLM/diarization readiness-reason
strings** (arrows + gear in `scoring/llm.py`, `scoring/llm_client.py`,
`transcribe/diarization_client.py`). The readiness reasons were swept after confirming
they reach `console.print` via `pipeline/ingest.py:95`, `pipeline/vision_describe.py:60`,
`cli/models.py:230`, and `whisper_runner.py:610` - **not** browser-toast-only as an
earlier framing assumed. ASCII renders correctly in the browser too, so the fix is safe
on both surfaces. Live crash risk was already nil (the file logger is UTF-8 and
`console.py` wraps stdout with `errors="replace"`), so this was convention-alignment,
not a bug fix.

### Kept as-is (do not re-flag)
- **Comments and docstrings** - never reach the console (covered by the earlier
  comment-glyph decisions); includes the module/function docstring arrows and the
  `0-1` / `0.0-1.0` en-dashes in scorer docstrings.
- **LLM prompt strings** - the `<=20 words`, `0.0-1.0`, time-window `-`, and `Speaker 1,
  Speaker 2, ...` text in `scoring/llm.py` is data sent to the model, not console output
  (same basis as the kept `contexts.py` "Pokemon" prompt text).
- **`routes/llm.py` HTTPException detail strings** - browser toasts, rendered as UTF-8
  (the recorded 2026-07-10 keep still stands; these are separate literals from the
  `scoring/llm.py` reasons and are not console-bound).
- **SSE `yield "data: ..."` status strings** (`routes/scoring.py`, `videos.py`,
  `speakers.py`, `sessions.py`) - stream to the browser as JSON, rendered as UTF-8; the
  browser-DOM ellipsis decision applies.
- **`reel.py` title-card ellipsis / middle-dot** - drawn into the video via ffmpeg
  drawtext (the recorded Phase 6 keep).

Not swept this session (out of the P2 scope handed to this pass, deferred not declined):
the Stage 3 `_window_rms_db` vectorization (perf), and Theme F config-JSON tolerance
(`_sanitize_title_card_fields` type-tolerance, `contexts.py` accessor guards). (`dev/procs.py`
`parse_cim_json`'s silent `[]` on bad JSON, also originally on this list, has since been
fixed - it now catches `JSONDecodeError` and logs a warning instead of swallowing silently;
pruned here, do not re-flag.)

---

## Phase 4 refactor - YuuClip retheme + collapsible cards (2026-07-13)

Refactor phase of the code-quality review over the cyan/gold retheme (`169c8b8`) plus the
collapsible-card + declutter follow-ups (`f4377a7`, `43c8857`). Applied: extracted a single
`collapsibleCard(key, title, body, opts)` helper in `utils.js` (all 11 opt-in cards now stamp
the collapse markup contract in one place - net-negative line count); removed the dead
`.transcript-details` / `.transcript-summary` CSS the retheme orphaned when the transcript moved
from `<details>/<summary>` to a collapsible card (`#video-transcript-details` id is distinct and
stays). The following were reviewed and deliberately left as-is:

### Space-key collapse toggle load-order dependency - SUPERSEDED by the Phase 7 a11y fix
This entry originally kept a load-order dependency (the collapse header was a
`div[role="button"]` whose `preventDefault` had to run before `shortcuts.js`'s global Space
handler). The Phase 7 UX/UI follow-up (below, "Collapsible headers reworked to a native button")
replaced that structure with a real `<button class="card-toggle">`, which `shortcuts.js` already
bails on (`tagName === 'BUTTON'`). The dependency and its WHY comment no longer exist - Space is
handled natively. Recorded here so a future reader doesn't reintroduce the div-based pattern.

### Repeated `color-mix(... var(--accent) N%, transparent)` focus-ring/scrim expressions kept inline
Decision: Keep as-is (no new token).
Rationale: The retheme correctly tokenized all border-radii into `--radius`/`--radius-sm` and did
not introduce color literals. The recurring `color-mix` focus-ring/scrim expressions predate this
change set, vary by token and percentage, and each is a single contextual use - not newly
introduced duplication and below the bar for a shared token. The one new zebra
`color-mix(var(--text) 5%, ...)` is single-use.

---

## Phase 5 logging - YuuClip retheme + collapsible cards (2026-07-13)

Logging-coverage phase of the same review. Applied: wrapped the collapse-state
`localStorage.setItem` write in `utils.js` `_toggleCollapsibleCard` in try/catch with a
`console.warn` - the write was unwrapped while the matching read (`_cardCollapseState`) was
defensively wrapped, so a write failure (private mode / quota) threw uncaught out of the toggle
listener *before* the `cardtoggle` dispatch, leaving the full-video transcript card visually
expanded but never loading its body. Now the toggle + lazy-load survive a persistence failure and
it is diagnosable (once per failed toggle - not a hot path). The following were reviewed and left
silent by design:

### `copyText` surfaces clipboard failures via toast, no `execCommand` fallback
Decision: Keep as-is.
Rationale: In an insecure/unsupported context `navigator.clipboard` is undefined, but the property
access sits inside the `try`, so the resulting error is caught and shown as an error toast - no
crash, no silent swallow. The single-user app only runs on localhost / Electron where the async
clipboard API is always available (an existing WHY comment documents this). An `execCommand`
fallback would be machinery for a context this app never hits.

### `_cardCollapseState` silently returns `{}` on corrupt / unavailable stored JSON
Decision: Keep silent (no log).
Rationale: The tolerant-normalize pattern - a corrupt `yuuclip-card-collapsed` value should reset
to defaults, not error. It is read once per card render, so a log there would fire on every render
(spam) for a benign, self-healing condition.

---

## Phase 7 UX/UI - YuuClip retheme + collapsible cards (2026-07-13)

UX/UI phase of the code-quality review over the cyan/gold retheme (`169c8b8`) plus the
working-tree collapsible-card refactor (P3-P5). No code changes applied this phase - the
retheme's execution is strong and the contrast contract is fully covered by
`tests/ui/test_ui_theme.py` (every token pairing checked across the 3 themes x 2 accents).
Two items were escalated to the owner and BOTH were then resolved (see the Phase 7 follow-up
below): the reserved-gold scope (M2) was not drift - `COMPLETED.md` documents gold as
intentionally covering both funnel actions (Analyze + Export), so the stale app.css token
comment was aligned to match; and the collapsible-header nested-interactive a11y pattern (M1)
was fixed by reworking the toggle to a native button. The following were reviewed and
deliberately left as-is:

### Collapsible headers reworked to a native button; the smaller toggle target is accepted
Decision (APPLIED, with a deliberate tradeoff): the collapsible-card header no longer makes the
whole row a `div[role="button"]`. Only the title + chevron are wrapped in a real
`<button class="card-toggle">`; header action controls (Copy, kebab, Suggest names, Fix names,
Generate/Regenerate) are rendered as SIBLINGS of that button via `collapsibleCard`'s `opts.actions`.
Rationale: a `<button>` nested inside a `role="button"` is the axe `nested-interactive` / WCAG
4.1.2 violation. Making the toggle its own button removes it, and a native button also fixes the
Space-key load-order dependency for free (`shortcuts.js` bails on `tagName === 'BUTTON'`), so the
custom keydown handler and its `preventDefault` are gone. The tradeoff: the clickable toggle area
shrank from the full header row to the title+chevron. This is accepted - the title is still a
generous target, and valid ARIA + native keyboard is worth more than the extra row width for a
single-user desktop tool. `test_toggle_has_no_nested_interactive_controls`
(`tests/ui/test_ui_clips2.py`) guards against a future edit re-nesting a control inside the toggle.

### Wordmark gradient's dark end is a brand logotype, exempt from the AA text floor
Decision: Keep the `linear-gradient(100deg, var(--accent2), var(--accent))` text-clip on the
`header h1` "YuuClip" wordmark, even though the gradient's darkest stop (dark-theme `--accent`
`#0a7a9b`) computes ~3.5:1 on `--surface`.
Rationale: This is the product name / logotype, which WCAG 1.4.3 explicitly exempts from the
contrast minimum. It is also large display type, and the rule has a solid-colour fallback -
`color: var(--accent-text)` is set before the clip, so if `background-clip: text` is
unsupported the wordmark renders in `--accent-text` (a token that IS contrast-tested as text
on surface in every theme). A future pass computing the gradient's dark stop should not treat
3.5:1 as a defect here. Only re-open if the gradient is ever reused on non-logotype body text.

### Quiet muted-uppercase section/card titles are an intentional hierarchy choice
Decision: Keep `.detail-card-title` / `.sidebar-section` at `--muted` uppercase 11px.
Rationale: The small muted-caps labels are a deliberate "quiet chrome, loud content" hierarchy
signature, not an oversight - they read as section markers while the clip content and the one
gold action carry the visual weight (Von Restorff). `--muted` on `--surface`/`--bg` is
AA-contrast-tested in every theme, so legibility is guaranteed. Not a characterless-template
tell: the display face (Oxanium) on these labels is a chosen type decision.

---

## Phase 6 docs and comments - YuuClip retheme + collapsible cards (2026-07-13)

Docs-and-comments phase of the code-quality review over the just-shipped cyan/gold
retheme (`169c8b8`) plus the working-tree collapsible-card refactor (P3-P5). Applied:
fixed one CLAUDE.md drift - the color-token rule cited the score-gradient stops as
living in `utils.js`; they are in `format.js` (`_scoreBorderColor`, line ~19), which
`test_ui_theme.py` and `test_ui_globals.py` already reference correctly. The retheme
left no stale indigo/dark-dashboard or old-`<details>`-transcript comments (the dead
`.transcript-details`/`.transcript-summary` CSS and its separator comment were already
removed in P4). The following were reviewed and deliberately left as-is:

### The two glossaries are intentionally different files, not a drift
Decision: Keep both; do not try to reconcile them into one.
Rationale: `docs/dev/llm/GLOSSARY.md` is the authoritative dev superset (with `Code:` names
and dev-only sections); `yuu_clip/web/static/glossary.md` is a hand-written creator-facing
subset served by the in-app Terminology modal. The dev file's header states this split
explicitly. A `diff` of the two is expected to be large - that is by design, not
terminology drift. The static subset was verified rebrand-consistent ("YuuClip"
throughout, no stale "yuu-clip" display name) and free of banned code-name terms
(no "ingest"/"clip candidate"/"probe"/"profile"/"subtitle"/"demo reel"/"pending").

### `format.js` score-gradient hex stops and `_lerpColor` rgb() output kept as literals
Decision: Keep the hardcoded hex/rgb (already sanctioned by the CLAUDE.md color rule).
Rationale: `_scoreBorderColor`'s stop list and `_lerpColor`'s `rgb()` interpolation are a
continuous data encoding (score -> color ramp), not theme chrome, so they cannot be
expressed as discrete `var(--token)`s. This is the exact exception the color-token rule
carves out; the only fix here was pointing that rule at the right file.

### `fonts/OFL.txt` is the correct, complete OFL 1.1 for the bundled Oxanium woff2
Decision: Keep as the single license artifact; no separate NOTICE pointer needed.
Rationale: `OFL.txt` carries the full SIL Open Font License v1.1 with the correct
"Copyright 2019 The Oxanium Project Authors" header, co-located with `oxanium.woff2` in
`web/static/fonts/`. OFL condition 2 (license + copyright must accompany each copy of the
font) is satisfied by that co-location - the license file beside the font is the standard
satisfaction, so no header comment or NOTICE indirection is warranted. The app.css
`@font-face` comment already records the OFL provenance and swap procedure. OBLIGATION to
carry forward: any distribution that ships the woff2 MUST ship `OFL.txt` alongside it -
`pyproject.toml`'s `[tool.setuptools.package-data]` now globs `web/static/fonts/*`
explicitly (fixed 2026-07-13, same window), so this is satisfied in packaged builds too.

---

## Sidebar declutter - width and disclosure calls (2026-07-12)

UX pass that moved rare sidebar controls behind "More filters" `<details>` and into
per-section "..." menus. Two deliberate calls to record:

### `--sidebar-width` raised to 300px to keep the primary filter row on one line
Decision: Keep 300px (was 240px).
Rationale: The primary clip status row (All / Unreviewed / Approved / Rejected, each
with a count badge) wraps to two lines below ~295px. 300px is the measured one-line
threshold plus a small cushion. This was raised deliberately in response to a direct
user request ("keep the filter on one line"); a future pass should not "reclaim" the
width back toward 240px without re-checking that the status row still fits. Chip
padding/font were left at their Stage-0 sizes rather than shrunk, to preserve tap
targets - the width bump was the chosen lever.

### Section action menus reuse `showKebab()`, not a new dropdown
Decision: Reuse the existing `showKebab()`/`.hamburger-menu` scheme.
Rationale: The Clips and Recordings header "..." menus intentionally use the same
`ui.js showKebab()` helper as the existing clip-row and description kebabs, so there is
one dropdown/close/click-away/Escape scheme, not two. The `right:auto` fix in
`showKebab` (the fixed menu had inherited `.hamburger-menu`'s `right:0` and stretched to
the viewport edge) benefits all callers - do not special-case the sidebar menus.

---

## Phase 7 UX/UI (dedup, word-highlight captions, colour picker, context-scoped terms) (2026-07-10)

UX/UI phase of the code-quality review over the changes since baseline `16a30fa`.
Applied: added an accessible name (`aria-label="Colour picker"`) to the colour-picker
popover (`role="dialog"` had no name); fixed a lone curly apostrophe in `hotwords.js`
(the same file uses straight apostrophes elsewhere); added an in-flight disabled
"Checking..." state to the "Check duplicates" button (`clips.js scanDuplicates`) so the
scan has visible feedback. The following were reviewed and deliberately left as-is:

### Export dialog word-highlight controls are always editable (not hidden when captions != burn-in)
Decision: Keep as-is.
Rationale: In the export dialog, Word highlight + Words-on-screen live inside the "Caption
style" `<details>`, whose header already states "Applies to burned-in captions only" -
the same rule that governs the Font/Size/Position controls beside them, which are also
always editable and only take effect on burn-in. The reel modal instead *hides* its
word-highlight row until burn-in is chosen; that is a different but internally-consistent
pattern for a smaller control set. Forcing the export dialog to disable only word-highlight
(while leaving Font/Size/Position editable) would break the section's own internal
consistency for no real gain, since the section note already scopes all of them. Revisit
only if the whole Caption-style section is reworked to gate on the caption mode.

### "Settings -> LLM scoring" and other browser-DOM arrow glyphs kept as U+2192
Decision: Keep the arrow glyph.
Rationale: The right-arrow (U+2192) appears ~30 times across the served `.js`/`.html`, an
established browser-DOM typographic convention (same basis as the 2026-07-09 ellipsis
decision and the Phase 6 `llm.py` arrow decision). Browser markup renders as UTF-8, so there
is no cp1252 console risk. Only the lone curly *apostrophe* outlier was ASCII-fixed; the
arrows were left to match convention.

### Merge (dedup) confirmation is sufficient; no undo
Decision: Keep as-is.
Rationale: The merge action deletes clip B and is irreversible, but it is already gated by a
`showConfirm(..., danger=true)` whose body plainly states "The merged clip will span both time
ranges. This cannot be undone.", the confirm defaults focus to Cancel, and the destructive
button is red (`btn danger`). That is proportional confirmation for a single-user tool; a full
undo stack for merges is a feature, not a review fix.

---

## Phase 6 docs and comments (2026-07-10)

Docs-and-comments phase of the code-quality review over the changes since baseline
`16a30fa`. Applied: ASCII-fied non-ASCII glyphs in Python **comments/docstrings/console
strings** (the `db/models.py` status-flow arrows and other inline `->`/`...`/`-` fixes;
`subtitles.py` and `common.py` docstring arrows; `reel.py` two `print()` and one
`_log.info` strings that carried U+2026/U+2192 - a real cp1252 console-crash risk;
`config.py` en-dash comment). Fixed the stale `pytest.ini` markers paragraph in CLAUDE.md
(it claimed `integration`/`ui`/`environment` markers were registered - P4 removed them, only
`live_remote` remains; tiers are split by directory). Fixed the stale flat test paths in the
Feature-map headers of the five in-scope route files (`config`, `dedup`, `hotwords`, `llm`,
`sensitive`) to the new `tests/{unit,integration,ui}/` locations. Added a **Duplicate Clips**
glossary entry (the new clip-dedup concept was undefined) and a **Word highlight** captions
bullet to `docs/user/FEATURES.md` (the feature shipped this window but was undocumented for
users). The following were reviewed and deliberately left as-is:

### Feature-map header `·` separators and `→` arrows, and `# ── … ──` section dividers
Decision: Keep the non-ASCII glyphs.
Rationale: These are an established, codebase-wide typographic convention - the `·`/`→`
Feature-map header comments appear in 21 route files, and the box-drawing `──` section
dividers in 8+ modules. They live only in comments (never reach the cp1252 console), so
there is no crash risk. Sweeping only the files touched this window would desync them from
the ~15 untouched files for no correctness gain - the same reasoning as the kept browser-DOM
`…` (see the 2026-07-09 ellipsis decision). Only the *stale test paths inside* the in-scope
headers were corrected; the glyphs were left intact.

### `web/routes/llm.py` "Settings → LLM scoring" error-detail strings
Decision: Keep the `→` arrows.
Rationale: These `HTTPException(detail=...)` strings pre-date baseline `16a30fa` (7 present at
baseline) and render in browser toasts as UTF-8, not on the console - browser-rendered non-ASCII
is explicitly allowed (2026-07-09 ellipsis decision). They are not console/log-bound (no handler
logs the detail), so no cp1252 risk. Out of this window's changed-behavior scope.

### `reel.py` title-card text (`… ` truncation marker, `·` separator) and `contexts.py` "Pokemon"
Decision: Keep as-is.
Rationale: The `reel.py:78` ellipsis and `reel.py:124` middle-dot are *rendered into the video
title card* (ffmpeg drawtext data), not console output - changing them changes on-screen output,
not a comment. `contexts.py`'s "Pokemon" (with the accented e) is proper-noun content inside an
LLM prompt string, correct as spelled; it is data, not a comment.

### Markdown docs (`CLAUDE.md`, `FEATURES.md`, `GLOSSARY.md`) arrows/en-dashes
Decision: Keep, and match the convention when adding.
Rationale: These are rendered-as-UTF-8 docs, not console output; they use `→`, `–`, `…`
consistently throughout. New copy added this window (the Word highlight bullet) matches the
file's existing arrow style rather than fighting it. The cp1252 rule targets console/log
strings, not rendered markup.

---

## Phase 5 logging (align / dedup / term_scope / captions) (2026-07-10)

Logging-coverage phase of the code-quality review over the changes since baseline
`16a30fa`. Added: two silent-fallback logs in `transcribe/align.py` `realign_words`
(a word with no model-alignable characters -> `debug`; a span/token count mismatch
-> `warning`), so a caption edit silently losing word-highlighting is diagnosable
from `.yuu-clip/yuu-clip.log` (root logger runs at DEBUG-to-file). Cleanup: replaced
9 mojibake em-dashes (a UTF-8 em-dash, bytes E2 80 94, re-decoded as cp1252)
in `export/render.py` with spaced hyphens - three are `console.print` strings that
stream over SSE and render as garbage. The following were reviewed and left as-is:

### `scoring/term_scope.py` `terms_for_video` silently drops orphaned-slug terms
Decision: Keep silent (no log).
Rationale: A term scoped to a deleted world context is filtered out with no log. But
`terms_for_video` is called once per clip inside the full-project rescan loop
(`sensitive.py` `_rescan_all_clips`, and the per-video rescans), so any log there is
per-iteration spam. Orphaned terms only arise after a context is deleted (creation is
guarded by `validate_context_slug`); if that tolerance ever needs to be observable,
the place to surface it is context-deletion time or a one-shot integrity check, not
this hot filter. `video_context_ids`'s malformed-JSON `except` is likewise a
tolerant-by-design normalize, not an error path.

### `align.py` non-English / empty-text gates are silent by design
Decision: Keep silent.
Rationale: The `_is_english` gate and the empty-`words` guard are expected normal
paths (a non-English segment, or text the caller already rejected as empty), not
failures - logging them would be noise on every edit. The genuine failure paths
(missing source, ffmpeg-extract failure, alignment exception, and now the two added
above) all log with the segment id or a bounded `text[:40]` preview.

---

## Phase 4 refactor (context_slug + dedup + dev CLI review) (2026-07-10)

Refactor phase of the code-quality review over the changes since baseline
`16a30fa` (dev CLI, term_scope/dedup, align/subtitles, colorpicker, context_slug
plumbing). Applied: shared `normalize_context_slug` / `validate_context_slug` in
`web/routes/common.py` (was duplicated in `hotwords.py` + `sensitive.py`); merge
buttons in `clips.js` moved from inline `onclick` to `#detail` event delegation;
removed the three never-applied pytest markers (`integration`/`ui`/`environment`).
The following were reviewed and deliberately left as-is:

### `clips.js` `_duplicatePartners` recomputes overlap as `end_ms - start_ms`
Decision: Keep as-is (client recompute).
Rationale: The server's `dedup._overlap_ratio` divides by `clip.duration_ms`, but
`ClipCandidate.duration_ms` (`db/models.py`) is a *computed property* returning
`end_ms - start_ms`, not a stored column - so the client's `end_ms - start_ms` and
the server's `duration_ms` are the same expression and cannot diverge. There is no
correctness gap to close; adding `duration_ms` to the serializer just to have the
client echo a server field would be churn. Revisit only if `duration_ms` ever
becomes an independently-stored column.

### `dev/` CLI, `transcribe/align.py`, `subtitles.py`, `colorpicker.js`, `config.py` rules table
Decision: Keep as-is (already well-decomposed).
Rationale: All reviewed for the phase's hard rules (function length, one concern,
naming, no hardcoded colours, DB-session hygiene). Each is already cohesive with
short single-concern functions and shared helpers in the right place (`dev/_base.py`,
`dev/_summary.py`, `common.py`); `config.py`'s validator rules-table and
`colorpicker.js`'s decomposition are clear. No high-value structural change found -
further edits would be cosmetic churn.

---

## "Current transcript" selection keyed on created_at, not id (2026-07-09)

Phase B (whole-codebase refactor) of the code-quality review unified the ~7 sites
that pick a track's latest transcript. Two divergent sort keys existed for the same
concept: `key=t.id` (in `pipeline/ingest.py`) and `key=t.created_at` (in
`subtitles.py`, `segments/windower.py`, `web/routes/videos.py`). These were collapsed
into one helper, `latest_track_transcript(track)` in `db/models.py`, keyed on
`created_at`.

**Keep the `created_at` key; do not flip it back to `id` or re-debate without new
evidence.** The two keys cannot disagree in the current schema: force-retranscribe
deletes all prior track-level transcript rows before inserting the new one
(`ingest.py` `_transcribe_and_check_overlap`), so each track holds a single
track-level transcript and both keys are monotonic at insert with no ties.
`created_at` was chosen because it directly expresses "most recently created" and was
already the majority (5 of 7 sites). This only becomes worth revisiting if multiple
concurrent track-level transcripts per track ever become possible.

---

## U+2026 ellipsis in browser DOM text is fine (not a cp1252 violation) (2026-07-09)

Phase B (whole-codebase UX/UI review) confirmed the web UI uses the real ellipsis
glyph `…` (U+2026) consistently across ~80 sites in the `.js`/`.html` served to the
browser. A future pass may be tempted to "sweep" these to ASCII `...` under the
project's ASCII-copy rule.

**Kept as-is - do not sweep.** The cp1252 hard-rule exists because the legacy Windows
*console* encodes stdout as cp1252 and crashes on non-cp1252 glyphs. It targets
console/log output, not browser markup, which is served and rendered as UTF-8 where
`…` displays correctly. Sweeping ~80 consistent UI strings would be churn that fights
an established typographic convention for no correctness gain. (The two stray literal
`...` in `modelcatalog.js` are the only local outliers and are inert.) This applies
only to browser DOM text - any `…` reaching a `print()`/`console.print`/log string
still must be ASCII.

---

## Logging review of the llama-server pool - deliberate silences (2026-07-09)

Phase 5 (logging coverage) of the code-quality review over the bundled-Vulkan
llama.cpp changes. The pool (`scoring/llamacpp_server.py`) gained context on the
spawn/health/stop/Vulkan-fallback lifecycle. Two paths were left intentionally
silent and should not be re-flagged:

- **`_post` (per chat request) and `_pump_logs` (per stdout line)** are not logged
  per-call. `_post` runs once per clip during a re-score of hundreds of clips, and
  `_pump_logs` runs once per line of llama.cpp's own (verbose-off) output; logging
  either per-iteration would be spam. A failed `_post` propagates to the scorer,
  which logs it once with `exc_info` and the clip id (`scoring/llm.py`
  `LLMScorer.score`).
- **Startup failures are raised, not logged in the pool.** `_raise_startup_error`
  embeds the last 15 lines of the child's stdout/stderr in the `LlamaServerError`
  message; the caller that owns the operation logs it (the scorer with `exc_info`,
  or the route surfaces it to the user). Adding a `_log.error` inside the pool as
  well would double-log the same failure. The one exception now logged in-place is
  the Vulkan->CPU fallback, because there the exception is *swallowed* (we recover)
  so its detail would otherwise be lost.

---

## UX review of LLM model selection - "LLM scoring" term kept (2026-07-08)

The UX/UI review of the Settings model manager and the setup wizard restructured
both to lead with the model picker and hide the privacy guarantee / engine choice /
manual paths under an "Advanced AI options" disclosure (the two surfaces now mirror
each other). One finding was deliberately **not** acted on:

### "LLM scoring" / "LLM" acronym in the section title and labels

Reads as developer jargon to a non-developer; a plainer "AI scoring" would be
lower-friction on first read.

**Kept as-is.** "LLM scoring" is the authoritative `docs/dev/llm/GLOSSARY.md` term,
explicitly recorded as "not AI scoring" - the split is intentional and consistent
across UI, CLI help, and docs. Renaming it here would either desync this surface
from the glossary or require a glossary change plus a sweep of every other use,
which is out of scope for a UX pass and would re-open a settled naming decision.
Revisit only as a deliberate glossary change, not as a one-off relabel of this
screen.

---

## Packaging-overhaul review - two keep-as-is calls (2026-07-07)

From the refactor phase of the code-quality review over the
packaging-strategy-overhaul changes (`docs/project/COMPLETED.md` section
"Packaging-strategy overhaul").

### `routes/llm.py` capability-tier builder functions

Five small functions build the tier objects returned by
`/api/capabilities/tiers` (one per capability: `_similarity_tier`,
`_descriptions_tier`, `_speaker_labels_tier`, `_audio_events_tier`,
`_vertical_framing_tier`; `llm.py:192-305`). They have the same shape - check
availability, report installed/missing, pick a status string - which looks like
a candidate for one generic `_build_tier(...)` helper.

**Kept separate.** The shared shape is coincidental, not shared knowledge: each
tier's availability check is a different backend call, the status strings and
"what this unlocks" copy are capability-specific, and the two are added to
independently (a change to how descriptions reports readiness has no reason to touch
how speaker labels does). Collapsing them into one parameterized helper would
trade five short, readable functions for one longer function with a branch per
capability - worse for a newcomer trying to find "how does the audio-event tier
decide it's ready." The response shape each function returns is also public
API surface (consumed by `settings.js`'s Capabilities section) - keeping one
function per capability keeps a change to one capability's response from
risking an accidental shape change to the others.

### `audio_event.py` / `laugh.py` `_load_failed` load-guard duplication

Both scorers cache a "the model failed to load, don't retry every clip"
boolean the same way: a module-level flag checked before attempting a load,
set on `except`, logged once.

**Kept duplicated.** Below the rule-of-three (only two instances), and the two
call sites are already coupled to tests that assert on each module's own
`_load_failed` state independently - extracting a shared helper would require
either a shared mutable singleton (the two scorers would then be able to
accidentally clear each other's failure state) or a small class per scorer
instance, either of which is more machinery than two five-line guards justify.
Revisit if a third scorer needs the same pattern.

---

## SPA decomposition Stage 05 - `index.html` to server-side partials: NO-GO (2026-07-05)

**SUPERSEDED 2026-07-17.** The stage-05 no-go call was reversed: `index.html` is now the
htmlstitch build from `index.src.html` + partials (`yuu_clip/dev/htmlstitch.py`,
`tests/unit/test_index_html_drift.py`), so the "no-build SPA" rationale this entry
recorded no longer holds on any point. Kept only as a pointer so a future review does not
mistake the htmlstitch partials build for reintroducing something already rejected - it
isn't; the rejection was reversed by design.
