# Review open items - punch list from the 2026-07-26 full-app quality review

> **LLM/agent-targeted doc.** Audience: Claude Code and code-review agents, not
> human contributors. It lives in `docs/dev/llm/` for the same reason as
> `REVIEW_DECISIONS.md` and `REVIEW_MAP.md`.

Every "found but not fixed" or "needs human decision" item surfaced during the
2026-07-26 full-app `/code-review` pass (11 sections, see `REVIEW_MAP.md` for the
partition). Unlike `REVIEW_DECISIONS.md` (settled "keep as-is" calls with
reasoning - closed, not meant to be re-opened), this file is an **open** punch
list: items nobody has decided on yet, or real gaps deferred for a later phase/
section. When an item is resolved (fixed, or a deliberate keep-as-is decision is
made), move its entry to `REVIEW_DECISIONS.md` and delete it from here.

Each phase agent in this review appends newly-deferred items here directly, in
the section matching where the item was found. Format: one entry per item,
noting the file/location, what was found, why it wasn't fixed, and severity.

---

## Section 1 - Analyze pipeline + media inspection (committed 9ca4f32)

- **`yuu_clip/analyze/thermal.py::ThermalTrigger.poll`** - pause-streak re-arm
  edge case: if auto-pause is toggled ON mid-run while the GPU is already hot
  for >3 consecutive samples, auto-pause may never re-fire (edge check is
  `== _STREAK_THRESHOLD`, not `>=`). Fix direction is ambiguous (could
  over-correct into re-pausing an already-resumed job) - needs a human call on
  the desired behavior before any change. Narrow/low-severity.
- **`yuu_clip/pipeline/ingest.py::_parse_srt`** - mis-scales the timestamp
  fraction group if it's not exactly 3 digits (treats it as literal
  milliseconds regardless of digit count). Only affects malformed/non-standard
  SRT input; well-formed SRT (always 3-digit) parses correctly. Low severity.
- **Transcribe progress pill undercount** - a `do_transcribe` track with no
  `extracted_path` is counted in `transcribe_total` but never in
  `transcribe_done`, so the progress pill can read e.g. "1/2" and never reach
  "2/2". Cosmetic display bug only, no functional impact.
- **`yuu_clip/analyze/labeler.py::_apply_profile`** - could raise `IndexError`
  on a hand-corrupted track-layout JSON whose `num_tracks` matches but whose
  `stream_position` is out of range. Trust boundary is a local, app-generated
  file - low risk, not fixed.
- **`tests/integration/test_analyze.py::TestThermalPollLoopIntegration`**
  (`test_hot_reading_warns_then_auto_pauses` / `test_cool_reading_never_warns_or_pauses`)
  - real wall-clock timing tests (1.0s sleep, 0.01s poll interval, needs 3
  consecutive polls in that window). Generous headroom (100 possible polls vs.
  streak of 3), not confirmed flaky, but not clock-injectable either. Unclear
  whether this is an already-accepted pattern elsewhere in the suite or should
  move to an injectable clock - needs a human call.
- **`tests/unit/test_export.py::TestVerifyExportDuration`** (tests
  `yuu_clip/analyze/extract.py`, not `export/render.py` despite the file name)
  - uses fixed tolerance literals mirrored from `extract.py`'s
  `_DURATION_TOLERANCE_FLOOR_S`/`_DURATION_TOLERANCE_FRACTION`; comfortably
  inside/outside the boundary (not flaky) but no test pins the exact boundary
  value itself. Coverage gap, not an integrity defect - not yet closed by any
  later section's test-coverage phase.

## Section 2 - Transcription & diarization (committed 08d174a)

- **`yuu_clip/transcribe/speaker_attach.py::diarize_track`** - the skip-log
  guard `if config.diarization_backend != "null":` is dead code:
  `NullDiarizationClient.available()` always returns `(True, "")`, so `ok` is
  never `False` when the backend is `"null"`. Found during Section 2's Phase 5
  (logging), flagged as a bug-hunt/refactor item, not yet fixed by any later
  pass.

## Section 4 - Scoring LLM backend (committed 530072a)

- **`yuu_clip/scoring/llm.py::find_related_clips`** - raises (KeyError/
  TypeError) on a single malformed list item, discarding ALL valid results,
  whereas sibling parsers (`request_scene_boundaries`, `scan_hotwords_semantic`)
  skip bad items and keep the rest. Defensible under `find_related_clips`'s
  documented "raises on failure" contract; low severity; changing it is a
  behavior change needing a human call, not a routine fix. Pinned by
  `test_one_malformed_item_raises_instead_of_being_skipped` (documents current
  behavior, doesn't fix it).
- **`yuu_clip/scoring/llm.py::describe_clip` / `summarize_transcript` /
  `summarize_session`** - call `.get()` on parsed JSON with no
  `isinstance(dict)` guard, so a valid-JSON-but-wrong-shape reply (e.g. a
  top-level list) raises `AttributeError` instead of a clean `ValueError`.
  Gracefully handled upstream; only degrades the error message, not
  correctness. Pinned by regression tests, not fixed.
- **`yuu_clip/scoring/llm_client.py::LlamaCppServerClient.available()`** - on
  a binary-resolution failure, returns `str(exc)` verbatim as the UI-facing
  reason, which embeds the full configured/bundle path - unlike the sibling
  "missing model file" branch 3 lines above, which deliberately omits the path
  with an explicit "never surface the absolute path" comment. The log FILE
  itself is safe (redacted by `_SanitizingFormatter`), but this same string
  also flows unredacted into UI rendering owned by a route (`web/routes/llm.py`
  or wherever it's displayed - **Section 9's scope**, check there). Needs a
  human call: sacrifice some diagnosability (generic reason) vs. path privacy.

## Section 5 - Clip generation + export/reel (committed 8c47dd5)

- **`yuu_clip/export/render.py::run_retranscribe`** offset bug - RESOLVED &
  FIXED by Section 8's Phase 2. It WAS a real reachable bug (migrate-clips split
  copied the parent's full-audio path onto the segment track while its clip
  times were 0-based). Fixed on the split side in `videos.py`, not in
  `render.py`. See the moved entry in `REVIEW_DECISIONS.md`.
- **`yuu_clip/export/render.py::_write_subtitle_tmp`** and
  **`yuu_clip/reel.py::compile_demo`** - leak a temp/partial file if an
  exception fires mid-write (`NamedTemporaryFile(delete=False)` never closed;
  partial `output` reel file on encode failure). Low value - narrow error
  windows, matches existing patterns elsewhere in the codebase; not fixed.

## Section 6 - Data model/config/catalogs + CLI + dev CLI (committed 774356b)

- **`yuu_clip/db/models.py`** - no explicit index on several frequently-joined
  FKs (`Video.session_id`, `Video.parent_video_id`, `ClipCandidate.video_id`,
  `TranscriptSegment.transcript_id`/`speaker_id`, `Speaker.video_id`).
  Performance-only; adding them requires an Alembic migration + drift-guard
  update. Not fixed.
- **`yuu_clip/cli/models.py::_verify_complete`** - skips size verification
  when the server sends no `Content-Length` (`total == 0`), so a truncated
  no-length download could be promoted by `part.replace(dest)`. HF always
  sends Content-Length for `.gguf` files and failures re-download cleanly, so
  severity is low. Not fixed.
- **`yuu_clip/sessions.py::suggest_session_groups`** - a group's running end
  uses the last-added recording's end rather than the max end so far; only
  misbehaves if two recordings overlap in wall-clock time, which doesn't
  happen in this app's single-user sequential-OBS domain. Not a real bug in
  practice; fixing it would be speculative.

## Section 7 - Web plumbing + cross-cutting utilities (committed af5552e)

- **`yuu_clip/track_labels.py`** - uses a non-atomic `write_text` for
  `profiles.json`, the same deliberate-simplicity pattern as `config.py`/
  `contexts.py` (Section 6's `_overlay_layer`/`save_contexts`, also
  non-atomic). Per-video track layouts may be more precious data than global
  config, so whether this file (and the other global-config writers) deserves
  the same atomic-write + `.corrupt.bak` hardening that
  `project_archive.py`'s restore side now has (Section 7's Phase 2 fix) is an
  explicit **human decision item**, not yet resolved. Also relevant:
  `yuu_clip/project_archive.py::build_backup` itself writes non-atomically to
  the destination path (an interrupted save can leave a partial zip) - lower
  priority now that the restore side rejects corrupt archives cleanly.
- **App-version-lookup duplication** - the `_pkg_version("yuu-clip")` ->
  `"unknown"` try/except block is duplicated verbatim across 4 sites:
  `project_archive.py::_app_version` + `web/app.py` (both Section 7, in
  scope), and `web/routes/updates.py` + `dev/notices.py` (out of scope at the
  time). A 2-of-4 conversion was judged not worth doing half-migrated -
  deferred to whichever section can see all 4 call sites and do a wholesale
  `app_version()` extraction. **Check `web/routes/updates.py` in Section 9.**
- **Path-traversal-guard duplication** - the "resolve within a base dir,
  reject traversal" check is duplicated across `media.py::resolve_within`,
  `project_archive.py::_reject_unsafe_member` (both Section 7), plus
  out-of-scope `routes/reveal.py`, `routes/backup.py`, `routes/projects.py`.
  Each raises a domain-specific error, so a shared `is_within()` predicate is
  probably the right shape, but the majority of call sites are in routes files
  reviewed later. **Check `routes/reveal.py`, `routes/backup.py`,
  `routes/projects.py` in Section 9** and decide whether a shared helper is
  warranted across all of them.

## Section 8 - Web UI: content & analysis (Phase 2 committed)

- **`yuu_clip/web/static/clips/clipbulk.js::_doBulkExportClips`** (~line
  192-210) - its `streamSSE` `onDone` callback ignores the `outcome`
  parameter entirely and always shows the "Exported N clip(s)" toast, matching
  the false-success-toast pattern CLAUDE.md documents as fixed at ~9 other
  call sites. Currently a dead path (this job is started with
  `cancellable=false`, so `startJobUI` hides the Cancel button and the UI
  offers no way to reach `outcome==='cancelled'`), so not fixed per "no
  handling for things that can't happen" - but flag as a latent risk if this
  job ever becomes cancellable without updating the callback. No JS test
  currently drives this `onDone` callback at all.
- **`tests/ui/test_ui_clipcreate.py:317`** - `page.wait_for_timeout(200)`, a
  fixed-duration sleep used for a negative assertion (proving the
  approve-shortcut is suppressed while the picker is open). Genuine
  sleep-based-timing fragility, but it's Playwright/UI-tier - reserved for the
  section's regression pass / a UI-tier test-integrity pass, not fixed here.
- **`yuu_clip/web/static/videos/sessions.js::_promptText` /
  `_showSuggestionModal`** (Phase 7, UX/UI) - these two dynamically-built
  session modals sit outside the boot-time modal-a11y stamping + single
  document-level focus trap: Tab can reach background controls while open,
  and focus isn't returned to the opener on close. Usable (has
  `role="dialog"`/`aria-modal`, labelled input, autofocus, Enter/Escape).
  Deferred as Low: mouse-first single-user desktop tool, and a clean fix
  wants a shared runtime-modal-trap helper rather than a per-modal patch.
  Revisit trigger: a keyboard-only/AT user needs to create/rename a session,
  or a shared runtime-modal helper lands for another reason.
- **`yuu_clip/web/static/analyze/split.js::_doSplitAndReanalyze`** (Phase 7,
  UX/UI) - the per-segment clip-clear failure toast names a raw internal
  segment id (`Failed to clear clips on segment ${segId}`) the user can't map
  to a visible label. Rare edge path (a DB write failing mid-split). Deferred
  as Low: sibling `_segmentChainAbortMessage` already threads the 1-based
  index through correctly - copy that pattern if this is ever revisited.
- ~~`TestVideoInfoProperties` / `TestVideoCaptionsSrt` /
  `TestVideoSourceFile`+`TestVideoSource` test-tier & duplication items~~ -
  RESOLVED by Section 8's Phase 4 (refactor). The integration-tier
  `TestVideoInfoProperties` duplicate was deleted (its unique zero-duration case
  folded into the canonical `tests/unit/test_probe.py` version);
  `TestVideoCaptionsSrt` moved to `tests/unit/test_subtitles.py` (its natural
  pure-logic home); `TestVideoSourceFile` was folded into `TestVideoSource`
  (its unique unknown-video-404 test preserved, the duplicate missing-file-404
  and redundant serve test dropped). See the moved entry in `REVIEW_DECISIONS.md`.

### Section 8 Phase 2 (bug hunt) - newly deferred

- **`yuu_clip/web/routes/scoring.py::_rescore_video_clips`** (~lines 433-441) -
  stamps `clips_scored_at` / `clips_scored_context_json` (the "Last scored with"
  provenance) unconditionally after the per-clip loop, even when every clip in
  the batch hit `llm_error`. A fully-failed batch therefore records "scored with
  <context> at <now>", so staleness / related-clips checks think scoring
  succeeded. Not fixed: "did enough of the batch succeed to stamp provenance?"
  is a product decision, not a clear-cut bug. Low severity (the `llm_error` tags
  and the failed-clip re-score button both stay visible, so the user can still
  see and retry the failures). Found by Section 8 Phase 2.
- **`yuu_clip/web/static/analyze/analyze.js::_streamAnalyzeEvents`** (~line
  633-643) - its `streamSSE` `onDone` ignores the typed `outcome` and always
  shows the success toast + `SoundFx.play('analysis')`, unlike its ~8 sibling
  job starters which all branch on `outcome`. Traced as NOT currently reachable:
  a frontend analyze-cancel aborts the fetch via `_supersedeActiveStream()`, so
  `onDone` never fires with `outcome==='cancelled'` (the documented "dropped on
  the floor" behavior for analyze). Left as-is per "no handling for things that
  can't happen", but it is the lone outcome-blind onDone left in this scope - a
  latent false-success risk if the analyze cancel path ever changes to keep the
  stream open. No behavior change made.
- **`yuu_clip/web/static/analyze/split.js`** (~line 378) - one hardcoded hex
  fallback `'#6c8ebf'` for a canvas `fillStyle` (canvas cannot consume a CSS
  `var()`), reached only if `--accent` resolves empty (never in practice). Same
  class of allowed exception as `format.js`'s score-gradient stops; not caught by
  `test_static_theme_colors.py` (which scans `tokens.css`). Left as-is - a
  defensive fallback, changing it risks nothing meaningful.
