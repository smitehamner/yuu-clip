# yuu-clip — Completed Features

Archive of shipped items. For pending work see [ROADMAP.md](ROADMAP.md).
Phases 1–3 have been moved to [COMPLETED-archive.md](COMPLETED-archive.md).

---

## UX review clip-detail pass — M4-1, M3-4, L4-1/2/3, L5-1, CC-9 (done, 2026-07-02)

Prompt 8 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`): clip detail
cleanup — tags, cards, and the caption-model controls.

- **M4-1 — one Tags card**: the raw system-tags row is gone. Generated
  pipeline tags render inside the Tags card as read-only muted pills with
  display names and explanatory tooltips (`llm_error` → "Score error",
  `after_silence_12s` → "After 12 s silence", `after_hard_split` → "After
  split", `long_silence_before` → "Long pause before", `energy_no_*` → "No
  audio data", `llm_no_transcript` → "No speech to score"; unknown tokens fall
  back to underscore-stripped text). Bookkeeping markers (`llm_scored`,
  `energy_scored`, `scenes_scored`, `laugh_*`) are hidden — the Scoring card
  and "Last scored with" already convey them. User tags stay editable above.
- **CC-9 (clip half) — cards everywhere**: Related Clips and Transcript
  converted from bare `.section-title` sections to `.detail-card`s.
- **M3-4 / L5-1 — caption-model controls unified**: Retranscribe, Batch
  Export, and Export Clip all use label "Caption model" with default
  `large-v3` (Export Clip's previously unlabeled select moved to its own
  labeled row). One canonical option-copy set ("tiny — fastest, lowest
  quality" … "large-v3 — best quality (~3 GB VRAM)") across all five model
  selects including Settings and the Analyze panel.
- **L4-1 — Additional Actions regrouped**: "Regenerate" split into Scoring
  (Re-score, Override/Remove Override), Transcript (Retranscribe), and
  Discover (Find Similar).
- **L4-2 — merge-row descriptions truncate at 60 chars**; `_truncate` promoted
  from `speakers.js` to `truncate()` in `utils.js`.
- **L4-3 — Scoring/Actions row wraps** (`flex-wrap: wrap`, cards `flex:1 1
  240px`) instead of cramping on narrow windows.

Covered by `TestGeneratedTags`, `TestClipDetailCards`,
`TestClipActionsModalGroups`, and `test_detail_cards_row_wraps` in
`tests/test_ui_clips.py`, plus the model-select contract tests in
`tests/test_ui_terminology.py`.

## UX review video-detail restructure — M3-1, M3-2, M3-3, L3-1, L3-2, CC-9 (done, 2026-07-02)

Prompt 7 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`): every major
section of the video detail is a `.detail-card` that owns its own action.

- **M3-1 — Summary and Timeline cards own their actions**: Session Summary and
  Session Timeline cards always render; when empty, a ghost Generate button
  sits in the card header next to the section title (with a one-line muted
  empty note in the body), so the control and its effect share one container.
  The standalone action row keeps only Export Approved + Additional Actions.
- **M3-2 / CC-9 (video half) — cards everywhere**: World Contexts moved out of
  the title card into its own card; Full transcript and Session Timeline
  converted from bare `.section-title` sections to cards. Clip detail's
  Related Clips / Transcript conversion lands with Prompt 8.
- **M3-3 — title kebab always renders**, so a never-summarized recording can
  be titled manually (Edit works on an empty title).
- **L3-1 — meta line** (duration · clips · clipped) moved under the title,
  inside the title card.
- **L3-2 — Generate Timeline modal unit order** now matches Settings
  (seconds, minutes); minutes remains the default.
- Timeline generation failure now restores the empty-state note (or leaves the
  section blank when a stored timeline exists) instead of a bare blank section,
  and the button label falls back to "Generate Timeline" when nothing was
  generated.

Covered by `TestVideoDetailCardLayout` + `TestTimelineModalUnitOrder` in
`tests/test_ui_video.py`.

## UX review sidebar pass — H2-1, M2-1, M2-3, M2-4, L2-1/2/3 (done, 2026-07-02)

Prompt 6 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`):

- **H2-1 — filter chips wrap** (`flex-wrap: wrap`) instead of overflowing into
  an invisible hidden-scrollbar region; every filter is now visible at any
  sidebar width.
- **M2-1 — "– no summary / – unscored / – no timeline" badges removed** from
  recording rows; the detail view's action buttons remain the signifier.
- **M2-3 — stronger active-row treatment**, decided once for both lists:
  brighter accent-tinted background (`#262640`); recordings keep the accent
  left border, clip rows get a right-edge accent bar (`box-shadow`) so the
  score-color left border is untouched.
- **M2-4 — panels mirror**: Recordings chip row gains the "Filter" prefix
  label, the recordings sort options get emoji prefixes (🕒 Recent, 🔤 Title,
  ⌚ Length, 🎞 Clips — matching the clips-panel convention), and the
  recordings sort persists in localStorage (`videos-sort`) with restore in
  `boot.js`.
- **L2-1 — both empty-state links accent-colored** ("Analyze another
  recording" was muted).
- **L2-2 — clip search scope discoverable**: placeholder now reads "Search
  descriptions, transcript, tags…" with a matching tooltip and aria-label.
- **L2-3 — resize handles keep the 4px line but get an 8px hit area** via an
  invisible `::after` grab zone.
- **Bonus bug fix**: `_syncFilterChips()` (clips.js) matched every
  `.clip-chip` including the recordings chips, so selecting a recording
  stripped the active state off the recordings "All" chip; now scoped to
  `[data-filter]`.

Covered by four additions to `TestVideoSidebarControls` in
`tests/test_ui_page.py` (sort persistence across reload, chip-sync scoping
regression, chip-overflow geometry check).

---

## UX review M1-1 + L1-4 — header job pill overflow & version tag (done, 2026-07-02)

Prompt 5 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`):

- **M1-1 — job pill can no longer displace the header buttons**: done step
  pills collapse to a compact "✓" (full label as tooltip), the active step's
  live label ellipsizes instead of growing, and a `min-width:0` chain on
  `.job-status`/`.job-steps` lets the pill shrink so `+ Analyze` / `Highlight
  Reels` / gear / hamburger always stay in the viewport. The in-detail live
  analysis panel keeps full step labels — it wraps, so it never overflowed.
- **L1-4 — footer version tag reads `v0.1.10-dev …`** instead of a bare
  number (prefix applied only when the version starts with a digit).

Covered by `TestJobPillHeaderOverflow` + two `TestUpdateJobUI` additions in
`tests/test_ui_utils.py` (800px-viewport geometry check during a simulated
7-step analyze) and `test_footer_version_tag_has_v_prefix` in
`tests/test_ui_page.py`.

---

## UX review CC-6/CC-8/CC-10 — terminology & display conventions (done, 2026-07-02)

Prompt 4 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`):

- **CC-6 — scores always percentages**: the recording sidebar range now reads
  "Scores: 12% – 87%" (was raw 0.12 – 0.87), and the Score Override slider end
  labels are 0% / 100% (was 0.00 / 1.00).
- **CC-8 — "Recording(s)" everywhere in user-facing text**: sidebar heading,
  sort/search labels and placeholder, filter labels, resize-handle labels,
  detail type badge ("🎬 Recording"), both start-button tooltip variants
  (L5-3), empty/error list states, remove-recording dialog, timeline-interval
  hint, estimate "% of recording duration", and stray "video/Videos" in
  contexts and Find Similar scopes. Code identifiers stay `video`.
  GLOSSARY.md updated: Recording/Session UI-label notes and the panel entry
  renamed to "Recordings Panel".
- **CC-10 — `plural(n, word[, pluralForm])` helper** in `utils.js` replaces
  every "(s)" string and all ad-hoc `${n} clip${n !== 1 ? 's' : ''}` ternaries
  across analyze, clips, contexts, reel, speakers, split, transcript, and
  videos modules.

Covered by `tests/test_ui_terminology.py` (18 tests: static-file contract for
the "(s)" pattern, Videos→Recordings labels, percentage slider labels, plus
live `plural()` behavior).

---

## UX review CC-5 + L8-1 — toast standards (done, 2026-07-02)

Prompt 3 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`):

- **`showToast(message, type, opts)`** — third parameter is now an options
  object: `durationMs`, and `action: {label, onClick}` for an inline action
  button. The hand-rolled analysis-complete toast (`_showAnalysisToast` with
  its Review jump) now delegates to the standard helper.
- **`warning` type** — amber left border (`--warning`) for guard/guidance
  messages; `error` is reserved for actual failures.
- **Error toasts persist until dismissed** — no auto-timeout; other types keep
  auto-dismiss (warning 6 s, success/info 4 s).
- **Stack capped at 4** — oldest toast is evicted when a fifth arrives.
- **Call-site audit** — `_blockedByAnalyze` guard, form validation ("Layout
  name is required", "Caption cannot be empty", …) and nothing-selected guards
  are now `warning`; "Downloading N files" is `info`; failures stay `error`.
- **L8-1** — building a highlight reel now echoes "— N unexported clip(s)
  skipped" in the Build status line and the completion toast, plus a log line.

Covered by `tests/test_ui_toasts.py` (8 tests).

---

## UX review CC-2/CC-3/CC-4 — keyboard, focus & Escape (done, 2026-07-02)

Prompt 2 of the 2026-07 UX review plan (`UX_REVIEW_PLAN.md`):

- **Escape peels the topmost layer only** — the global handler's
  close-everything list is now an ordered cascade (`_closeTopmostLayer` in
  `settings.js`): kebab menu → hamburger → topmost visible modal → settings
  panel → Split Editor → New Recording panel, one layer per press. The Split
  Editor joined the cascade with a new dirty guard (`requestCloseSplitEditor`,
  confirm when split points are placed) that its Back/Cancel buttons also use.
- **Modals trap Tab** — one document-level handler in `ui.js` wraps focus
  inside the topmost visible modal (`topmostVisibleModal()`), covering all
  `.modal-bg` modals with no per-modal wiring.
- **Menu keyboard pattern** — hamburger and kebab menus focus their first item
  on open, traverse with ArrowUp/Down (wrapping), and return focus to their
  trigger on Escape and on item activation; menu-opened modals record the
  trigger as their return-focus target.
- Controls modal copy: "Esc — Close the topmost window", `?` or `/` alias row.

Covered by `tests/test_ui_keyboard.py` (19 tests).

---

## Fix: video streams outlive their viewer — server degraded to 140% idle CPU (done, 2026-07-02)

`/api/videos/{id}/source` served recordings via starlette `FileResponse`, which
does not listen for client disconnects — when a `<video>` element vanished
(closed tab, killed browser), the response kept pumping the multi-GB file into
a dead socket through the threadpool. Zombie streams accumulated until the
server burned 140% CPU while idle and every request (even `/api/status`) took
~90–400ms instead of ~3ms; UI test wall time roughly doubled. Now served via
`media_file_response` (StreamingResponse — starlette cancels it on disconnect;
also gives range support consistency and a share-delete handle so Remove Video
works mid-preview). With the healthy server the parallel UI suite dropped from
169s to 83s.

---

## UI test suite parallelized — 7.6 min → 2.8 min (done, 2026-07-02)

`test-ui.ps1` now runs 4 pytest-xdist workers by default (`-Sequential` opts out).
The previous attempt crashed because every worker hung at Playwright session
teardown (upstream playwright-python bug on Windows: Chromium exits but the
driver's `Browser.close` response is lost) and the old `os._exit` watchdog made
hung workers look like crashed nodes, falsely failing their last test. Fixed by
overriding the session `browser` fixture in `tests/conftest.py`: if `close()`
doesn't return within 5s, the node driver is killed and the resulting
"Connection closed" error swallowed, so teardown completes normally. Bonus:
sequential runs get their real pytest summary line back (the immediate
`os._exit` used to eat it).

---

## Usage-feedback cleanup — batch 1 (done, 2026-07-01)

Quick-win bugs and branding from the in-app feedback pass:

- **App icon + header logo** — replaced the placeholder teal-box icon with a
  proper image (`gamercat.png`); wired as the browser favicon, a logo beside the
  "yuu-clip" name in the header, and the Electron window / installer icon
  (`electron/assets/icon.png` + multi-resolution `icon.ico`).
- **Speaker rename now updates the open transcript** — renaming or recoloring a
  speaker (or accepting/dismissing a name suggestion) reloads the recording's
  expanded full-transcript in place instead of showing the stale "Speaker N"
  label until a manual refresh.
- **Full-transcript no longer goes blank on reopen** — a detail re-render (e.g.
  after re-scoring) wiped the transcript panel while its fetch-once cache still
  pointed at the recording, leaving it silently blank; it now reloads and shows
  the "Loading…" state reliably.
- **World contexts self-heal** — if the boot-time context load hadn't populated
  (or failed transiently), opening a recording refetches contexts so the context
  section never renders from an empty list until a page refresh.
- **Log panel aligned to the detail area** — the progress log no longer spans
  under the sidebar (see batch 2 for the final placement).

---

## Usage-feedback cleanup — batch 2: analysis lifecycle (done, 2026-07-02)

Correctness fixes around cancelling/running analyses, plus the settings/log layout:

- **Cancel fully clears the analyzing state** — cancelling no longer leaves a
  stuck, unclickable "Analyzing…" sidebar placeholder (the client marker is
  cleared) and the killed run's DB row is flipped out of `extracting` → `failed`
  immediately (same cleanup the server runs on startup), instead of spinning
  until the next restart.
- **No more wrong-video detail on rapid clicks** — `selectVideo` ignores a slower
  earlier clips fetch that resolves after a newer selection.
- **Interfering jobs are blocked while analyzing** — re-score / re-describe /
  re-diarize / re-transcribe / timeline / summary / find-similar all refuse to
  start during an analysis: the backend returns 409 (`_reject_if_analyzing`) and
  the UI bails with a clear toast *before* tearing down the live analyze stream.
- **Settings takes over the detail area, not the whole window** — the settings
  panel is now a fixed overlay anchored past the (resizable) sidebar, so the
  sidebar stays visible; opening the Analyze panel closes settings cleanly (no
  "analysis opens underneath settings").
- **Log panel moved inside the main column** — it now sits below the detail area
  with the sidebar extending full height beside it (batch 1's `margin-left`
  approach left a body-background bar under the sidebar).

---

## Usage-feedback cleanup — batch 3: progress & estimation (done, 2026-07-02)

- **No more runaway per-step ETA** — the "77 min left" that vanished when a step
  finished came from extrapolating off a slow cold first item
  (`elapsed/current × remaining`). The ETA now anchors its rate at the first
  observed count and measures throughput after it, so a cold first item can't
  project an absurd figure (and no ETA shows until a second count arrives).
- **Estimate coefficients recalibrated from real run data** — mined
  `analyze_run_json` across 0.5h–7.9h recordings: audio extraction was
  `duration×tracks×0.05` (~30× the real ~0.0017 — the "way off" report), now
  `×0.002`; Whisper `base` 50→20× and `large-v3` 6→5× (real ~4–20×); diarization
  12→18×; LLM scoring 4→12s per clip (was a 2–4× under-estimate). Added the
  previously-missing **Summarize** step.
- **Finished-run stage labels match the live bubbles** — the "Last analysis"
  card normalizes stored names ("Extract audio"→"Extract", "Generate
  clips"→"Generate Clips") and new runs record the aligned names directly.
- **In-detail analysis panel gained a Cancel button and the progress-bar fill**
  the header bar has, so you can cancel without scrolling to the header and see
  the same live per-step progress. *Deferred: sub-progress for diarization
  (pyannote emits none per-segment) and splitting energy/scene timing out of the
  Score stage.*

---

## Usage-feedback cleanup — batch 4: clip-generation quality (done, 2026-07-02)

- **No more long, mostly-silent single-line clips** — the windower now drops
  candidates whose transcript text is sparser than `min_clip_speech_cps`
  characters per second (default 0.2; set 0 to disable). This targets the real
  cause of "30-min clips that are one line and silence": a Whisper
  runaway-timestamp segment (one hallucinated line like "Thanks for watching"
  stamped across many minutes reads as ~0.03 cps, while real speech is ~10+ cps).
  A segment-duration ratio wouldn't catch it — the bogus segment claims to span
  the whole window — but measuring by text density does. On by default, since
  these clips are pure noise in the review list.

---

## Usage-feedback cleanup — batch 5a: user tags (done, 2026-07-02)

- **User tags on clips** — a Tags card in the clip detail lets you add free-form
  tags (Enter or comma to commit, × to remove) with autocomplete suggested from
  tags you've already used (`<datalist>` fed by `GET /api/tags`). Stored in a new
  `ClipCandidate.user_tags_json` column; `PUT /api/clips/{id}/tags` normalizes
  (trim, case-insensitive de-dupe keeping first casing, 40-char / 25-tag caps).
  Kept distinct from the existing system tags (llm_error, silence_Ns). Tag-aware
  search lands in batch 5b.

---

## Usage-feedback cleanup — batch 5b: sort / filter / search (done, 2026-07-02)

- **Sort clips by length** — added a "Length" option (longest first; `list_clips`
  `sort=length`) alongside the score/timeline sorts.
- **Clip search now matches tags** — the clip search box searches user tags in
  addition to the description, long description, and transcript.
- **Multi-select clip filter** — the single-select status tabs became a chip row:
  status chips (Unreviewed/Approved/Rejected) combine, plus Exported /
  Not-exported (mutually exclusive) and a Score-error chip. "All" clears; no chip
  = everything. (`AppState.clipFilters` set + `toggleClipFilter`.)
- **Video sidebar search / sort / filter** — the video list gained a search box
  (title/filename), a sort dropdown (Recent/Title/Length/Clips), and filter chips
  (Has clips / Unscored / Errors). Client-side over the fetched list
  (`_applyVideoFilters` / `_renderVideoList`). *Deferred (minor): scoping clip
  search to specific fields (multi-select field types).*

---

## Download Export includes SRT sidecars (done, 2026-07-02)

- **"Download Export" now also saves the clip's caption sidecars** — new
  `GET /api/clips/{id}/export-files` lists the exported video plus any SRT
  sidecars on disk (merged `{stem}.srt` + per-label `{stem}.<label>.srt`); the
  frontend downloads each (staggered so the browser doesn't collapse the
  sequential downloads). Falls back to the single video file if the endpoint
  fails.

---

## Usage-feedback cleanup — batch 6: highlight reels (done, 2026-07-02)

- **Export unexported clips from the reel builder** — reels are compiled from
  exported clip files and silently skip any clip without one. The build tab now
  shows an "⬇ Export N clip(s)" button whenever the selected clips include
  unexported ones; it runs the existing `GET /api/clips/bulk-export` and refreshes
  each clip's export state in place (preserving the user's order + inclusion,
  which a full reload would discard).
- **Reel captions** — an opt-in "Generate captions" checkbox on the build tab
  writes a stitched `<reel>.srt` sidecar: each clip's transcript is offset onto
  the reel timeline (title-card + clip durations, xfade-overlap aware — see
  `_segment_start_times`, matching the ffmpeg xfade offsets). Every build also
  writes a `<reel>.reel.json` composition sidecar recording clip order + timing.
- **Regenerate captions on existing reels** — the View tab shows a captions
  badge and a "Generate / Regenerate captions" button per reel;
  `POST /api/demo/{filename}/captions` re-stitches from the clips' current
  transcripts (409 with a rebuild hint for reels built before this feature, which
  lack the composition sidecar). The reel player loads captions via a `<track>`
  fed by `GET /api/demo/{filename}/captions.vtt`.
- `_srt_to_vtt` moved from `routes/clips.py` to `routes/_shared.py` (now shared by
  the clip and reel VTT endpoints).

---

## Usage-feedback cleanup — batch 7: speaker power features (done, 2026-07-02)

- **Name a speaker from a transcript line** — each diarized transcript line now
  carries a small speaker "dot". Clicking it opens a menu with an inline rename
  field for that line's current speaker (reuses `PUT /api/speakers/{id}`), so a
  voice can be named without leaving the transcript.
- **Reattribute a line to a different speaker** — the same menu lists every speaker
  in the recording plus "Unassigned"; picking one calls the new
  `PUT /api/transcript-segments/{seg_id}/speaker` (validates the speaker belongs to
  the recording, rebuilds the excerpt of every overlapping clip, and flags them for
  re-score — mirrors the caption-edit path).
- **Auto-vs-manual indicator** — `TranscriptSegment.speaker_edited` (new column +
  guarded migration) is set when a line is hand-reassigned; those lines render with
  a distinct marker (`.tline-spk.edited`) so auto-diarized lines are visually
  distinguished from ones the user corrected. Transcript line dicts now expose
  `speaker_id` + `speaker_edited` (added to `SubLine` and `_lines_to_view`).
- Deferred (out of scope, noted): project-level cross-recording voice library
  (`ROADMAP.md` — new `ProjectVoice` table, merge/split UX).

---

## Phase 4 — Packaging + distribution (done)

- **Electron wrapper** — app runs in its own Chromium window; Python backend launched as a child process
- **First-run setup wizard** (`setup.html`) — detects GPU, Ollama, FFmpeg; gives specific install guidance; skips on subsequent launches
- **NSIS installer** — built via `electron-builder`; creates desktop + Start Menu shortcuts; produced by `scripts/build-release.ps1`
- **Venv setup** — creates `.venv` and installs bundled wheel on first run; non-blocking so wizard stays responsive; detects version upgrades and reruns install
- **Loading screen** — shown between wizard and main window
- **Backend health check** — 60 s startup timeout; detects early crash; crash-safe shutdown on close
- **Rolling logs** — `venv-setup.log` for startup; rotating `yuu-clip.log` for server output
- **Version in footer** — dev: version + server start time; production: version + build date
- **Clean uninstall** — NSIS `deleteAppDataOnUninstall` removes `Roaming\yuu-clip`; custom macro in `installer.nsh` wipes `Local\yuu-clip` (venv) and `Local\yuu-clip-updater` on uninstall.
- **Bundled llama.cpp inference backend** — `llama-cpp-python` bundled in the wheel; `scoring/llm.py` supports both `llamacpp` (`.gguf` model file) and `ollama` backends; `llm_backend` / `llm_model_path` config fields; wizard LLM picker with `.gguf` file browser and Ollama model pull with progress bar. Ollama is now optional.
- **Disabled UI linking to wizard** — `/api/prereqs` endpoint checks FFmpeg and LLM config at boot; if FFmpeg is missing, a banner appears in the recording panel with a "Re-run Setup Wizard" link and the analyze button stays disabled; "Re-run Setup Wizard" hamburger button now shown whenever running inside Electron
- **Whisper model licence in wizard** — MIT licence note added to the wizard's Whisper checklist row
- **Live install progress** — venv setup window streams pip output (via `--progress-bar raw`) as a running status line during the long "Install yuu-clip" step, plus a "this can take a few minutes" note, so users see activity instead of a silent spinner
- **Working clipboard** — Edit menu (cut/copy/paste/select-all) added so keyboard shortcuts work in the main app; setup wizard allows selecting command text and adds "Copy" buttons for the `winget` / `ollama pull` commands
- **Glossary ships in releases** — the in-app Terminology Glossary previously read `docs/dev/GLOSSARY.md`, which isn't in the wheel, so it 404'd in built installs. Now a hand-written creator-facing `web/static/glossary.md` (no code names / dev sections) is bundled and served from `/api/glossary`; the dev glossary stays authoritative with a sync note
- Shipped versions: 0.1.1 → 0.1.8

---

## Notification sounds

- **Per-event completion sounds** — play a sound when Analysis, Re-score, Highlight reel, or Export finishes, plus a distinct error cue for any failed job. All events off by default; opt in per event from a new **Notification sounds** section in Settings.
- **Built-in Windows sounds** — served from `%SystemRoot%\Media` via `/api/sounds`; only sounds present on the machine are offered.
- **Custom audio upload** — raw-body `POST /api/sounds/upload` (no `python-multipart` dependency) stores the file under `.yuu-clip/sounds/`, path-traversal guarded, 25 MB cap; appears in every event dropdown and survives reloads.
- **Playback controls** — global volume slider, per-event Preview, and a floating **Stop sound** button so a long clip / full song can always be silenced. State persists in `localStorage`, applied immediately.
- New route `web/routes/sounds.py`; client module `static/sounds.js` (`SoundFx.play(event)`); triggers wired into analyze / rescore / reel / export / SSE-error paths. Covered by `tests/test_sounds.py`.

---

## Pipeline progress + analysis run history (Stage 1)

- **Stage estimate tooltips** — each progress pill shows its pre-run time estimate on hover, mapped from `/api/estimate` step names to `INGEST_STEPS` via an `estMatch` list; estimate steps saved on `AppState.lastEstimateSteps` in `renderEstimate`.
- **Immediate sidebar** — a recording appears in the sidebar the instant analysis starts: a client-side "Analyzing…" placeholder (`_analyzingPlaceholderLi`) shown until the DB row exists, then the real row with a live stage + spinner. Sidebar refreshes on stage transitions via a debounced `loadVideos()` in `updateJobUI`.
- **Run metadata capture** — `cli/_run_meta.py` (`StageRecorder` + `build_run_json`) times each pipeline stage and records effective settings and the CPU/GPU device each ML stage used; stored as JSON on new `Video.analyze_run_json` / `analyze_started_at` columns (guarded auto-migration, no DB wipe). Capture is best-effort — a metadata failure never aborts the analyze run.
- **Run metadata card** — `renderVideoDetail` shows a collapsible "Last analysis" card (`_renderRunMetaCard`): total time, GPU/CPU badge + per-stage device, settings, and per-stage timing bars. Exposed via `analyze_run` in `_video_dict`.
- Covered by `tests/test_run_meta.py` (StageRecorder, `build_run_json`, settings, serializer round-trip). Full API suite 878 passed; UI suite green.
- Deferred to Stage 2: analysis surviving a page refresh (subprocess-lifecycle decoupling + server progress buffer) and the live in-detail progress panel driven by that server state.

## Analysis survives a page refresh (Stage 2)

- **Decoupled subprocess lifecycle** — the analyze subprocess is now owned by a reattachable `AnalyzeJob` (`web/analyze_job.py`) instead of `subprocess_sse`. It is launched once (by `/api/analyze/start` queuing the command, `/api/analyze/events` launching it), its stdout is pumped into an in-memory broadcast buffer, and it is terminated **only** on explicit cancel or server shutdown — never when an SSE client disconnects. Closing the browser tab no longer kills the run. (`subprocess_sse` is unchanged and still owns the short score/export/retranscribe/install jobs, which stay tied to their stream.)
- **Replay-then-live reconnect** — `/api/analyze/events` reattaches: a reconnecting client atomically snapshots the buffer and subscribes, replays everything emitted so far, then continues live to the `__DONE__` sentinel. A finished job is replayed too, so a refresh landing right after completion still shows the final state. Multiple concurrent subscribers each receive every line exactly once.
- **Page-load reattach** — `/api/status` now reports `analyze_filename` / `analyze_video_id` for the running job; `boot.js` calls `reattachAnalysis()` when it sees one, rebuilding the sidebar row, header progress bar, and the in-detail progress panel purely by replaying the job's output through the normal `streamSSE` path.
- **In-detail live panel** — `renderVideoDetail` shows an `analysis-live` card while a recording is being analyzed (`_isVideoBeingAnalyzed`), mirroring the header stage pills and showing elapsed time from the server's `analyze_started_at` (so it stays accurate across a refresh). Kept in sync from `updateJobUI` / `_tickJobTimer` via `_syncAnalysisLivePanel`.
- **Interrupted-run reconciliation** — on server start, `_fail_interrupted_analyses` flips any `Video` stuck at `status='extracting'` (a subprocess killed mid extract/transcribe) to `failed`, so the UI stops showing an eternal spinner and the user can re-run. New `failed` → "Analysis interrupted" status label.
- Covered by `tests/test_reattach.py` (AnalyzeJob broadcast/replay/concurrent-subscribers/cancel, `/api/status` identity, startup fail-reconciliation) plus updated `test_analyze.py` reattach/replay cases. Full API suite 886 passed; UI suite 133 green.

---

## Re-analyze from the recording detail view

- **Two re-analysis actions** added to `renderVideoDetail`'s `vid-actions` (`static/videos.js`):
  - **Re-analyze (full)** — `reanalyzeVideo` → confirm dialog → `_doReanalyzeVideo` posts to `/api/analyze/start` with `{video_id, force: true, model, context_names}`, reusing the recording's last-run model (from `analyze_run.settings.model`) and world contexts, then streams via the normal `_streamAnalyzeEvents` path. `IngestRequest.force` now threads through `_build_analyze_cmd` as the CLI `--force`, so `_resolve_existing_video` re-processes a `status='done'` video instead of skipping it. Destructive (replaces clips/scores/approvals) — hence the confirm, which also notes exported files stay on disk.
  - **Re-detect Speakers** — `rediarizeVideo` streams `GET /api/videos/{id}/rediarize`, a non-destructive re-run of only the diarization stage. Backend: new `rediarize` CLI command (`cli/analyze.py`) → `_rediarize_video` (`cli/_pipeline.py`) reuses each transcribed track's latest track-level transcript and re-runs `_run_speaker_diarization` (→ `diarize_track` → `_assign_speakers` + `_attach_speakers`). Clips, scores, and transcript text are untouched; named speakers re-attach to matching voices by voiceprint (cosine ≥ `_VOICEPRINT_MATCH_THRESHOLD`). This is the primary way to validate Phase 2 voiceprint re-attach and tune the threshold. The command forces `diarization_backend='pyannote'` since re-detecting speakers is its whole purpose.
- Covered by `tests/test_analyze.py` (`--force` cmd threading, rediarize endpoint 404 + CLI-command build) and `tests/test_diarization.py::TestRediarizeVideo` (latest-transcript selection, skips non-transcribed tracks, no-transcript no-op). Full API suite 892 passed; UI suite 133 green.

### Configurable voiceprint match threshold

- The re-attach threshold (previously the hardcoded `_VOICEPRINT_MATCH_THRESHOLD = 0.75` in `whisper_runner.py`) is now `Config.speaker_match_threshold` (default 0.75), threaded through `diarize_track → _attach_speakers → _best_voiceprint_match`. The constant remains as the default value / fallback.
- Exposed in **Settings → Speaker labels → Speaker match strictness** (number input 0–1, shown only with pyannote on) — labeled without "voiceprint" per the glossary's dev-only term rule. Wired via `GET/PATCH /api/config` with a new `_range_validator(0.0, 1.0)`.
- Covered by `tests/test_config.py` (default, round-trip, out-of-range 400, bounds accepted) and `tests/test_diarization.py` (`_best_voiceprint_match` honours a custom threshold; `diarize_track` forwards `config.speaker_match_threshold`). Full API suite 897 passed; UI suite 133 green.

### Retranscribe voiceprint re-attach + speaker name inference

- **Clip-scoped retranscribe now re-attaches names.** `_maybe_diarize_segment` (`cli/export.py`) previously ran diarization but only called `_assign_speakers`, so a per-clip re-diarize lost speaker names. It now calls `diarize_with_embeddings` and threads the voiceprints through `_attach_speakers` (with `config.speaker_match_threshold`) exactly like the full-recording pass — a named voice re-attaches its name during retranscribe. `_run_retranscribe` passes `cand.video_id` through.
- **Name inference (LLM-assisted).** `infer_speaker_names` (`scoring/llm.py`) reads the recording's speaker-labeled transcript ("Speaker N: …") and returns `{display_index: name}` inferred from direct address ("Hey Yuu…"). `GET /api/videos/{id}/infer-speaker-names` (`routes/speakers.py`) builds that transcript (`_labeled_transcript`, track-level segments only, consecutive same-speaker lines merged), gates on `check_llm_available` (404/400 before streaming), then **streams the LLM pass as SSE** (`_active_job` + `asyncio.to_thread`, mirroring `regenerate-summary`) since the whole-transcript call can be slow. It writes each suggestion via `_apply_name_suggestions` as an **unconfirmed inferred name** (`source='inferred'`, `confirmed=False`); the `__DONE__` sentinel is an object carrying `suggested` (the applied count). Guards: a name suggested for two speakers is dropped for both, a name colliding with an already-confirmed speaker is skipped, and confirmed manual names are never overwritten.
- **Never silent.** `Speaker.display_name` now returns the "Speaker N" fallback unless the name is `confirmed`, so an unconfirmed suggestion never reaches captions, excerpts, or exports. The Speakers card (`static/speakers.js`) gains a **"Suggest names"** button (streams via `_openSSE`, log panel + progress like the summary regenerate) and renders each suggestion inline with **Accept** (PUT the name → confirms) / **Dismiss** (PUT empty → clears).
- Covered by `tests/test_speakers.py` (`_apply_name_suggestions` dedupe/collision/no-overwrite/re-apply, `_labeled_transcript` grouping, infer SSE route 404/400/done-count/apply/accept, `display_name` unconfirmed gating) and `tests/test_diarization.py` (retranscribe forwards embeddings + threshold + video_id to `_attach_speakers`). Full API suite 921 passed; UI suite 134 green.

### Per-step analysis progress percentage

- **Incremental clip scoring** (`cli/_pipeline.py`, `scoring/engine.py`) — each clip's score now
  commits to the DB as soon as it's computed instead of one transaction for the whole video, so
  the web server can see scores land in real time. The Extract/Transcribe/Score pipeline log lines
  gained `i/N` counts.
- **Live percentage/ETA** (`static/utils.js`) — the header step pills and the in-detail live panel
  parse those `i/N` counts into a completion percentage, an ETA, and a progress-fill pill within
  each step *(closes the Goal-Gradient Effect UX debt item)*.
- **Live clip list refresh** (`static/videos.js`) — the open clip list refreshes itself off the SSE
  stream as scores commit, instead of staying empty until the whole analysis finishes.
- Shipped in 521dc14.

### Per-speaker subtitle colours

- **`Speaker.display_color`** (`db/models.py`) returns the user-picked `color` if set, else a default cycled from a new module-level `SPEAKER_COLOR_PALETTE` (8 colours) keyed on `display_index` — every speaker gets a distinct, stable colour immediately, with no migration needed for rows minted before this feature.
- **`PUT /api/speakers/{id}`** now accepts an optional `color` field ("#RRGGBB", validated; empty clears back to the palette default) alongside `name`. Uses Pydantic's `model_fields_set` so a color-only PUT no longer clobbers `name` (and vice versa) — previously every PUT unconditionally overwrote `name`.
- **Subtitle burn-in.** `SubLine` (`subtitles.py`) gained a `color` field; `_segment_speaker_color` resolves it from the segment's attached `Speaker` (no raw-label fallback — colour is a Speaker attribute, not a diarization cluster property). `lines_to_srt` wraps a coloured line in `<font color="#RRGGBB">` (libass/most SRT players support this), so `--bake-captions` renders each speaker in their colour. Fixed `_labeled_lines` along the way — it was dropping `seg_id`/`color` when falling back to the track-label speaker.
- **On-screen transcript.** `_lines_to_view` now includes `color`; `transcript.js` applies it as an inline `style="color:…"` on the `.tline-speaker` name.
- **Speakers card.** `speakers.js` renders a native `<input type="color">` per speaker (pre-filled from `display_color`), PUTing `{color}` on change.
- Covered by `tests/test_speakers.py` (`display_color` explicit/fallback/wraparound, color PUT persistence/clear/invalid-400/independence from name), `tests/test_captions.py` (`_segment_speaker_color`, colored `lines_to_srt`, `_labeled_lines` color preservation, `collect_clip_subtitles` color propagation), and `tests/test_ui_speakers.py` (color input prefill + change → PUT). Full API suite 941 passed; UI suite 135 green.

### Multi-select bulk clip actions

- **Checkbox per clip row** (`static/clips.js` `_renderClipItems`) — each row gets a `.clip-select-checkbox`; its `onchange` toggles membership in a new `AppState.selectedClipIds` Set, and `onclick` calls `stopPropagation()` so checking a box never activates the clip (li's own click handler still opens the detail pane). A "N selected" toolbar (`#clip-bulk-toolbar`, new markup in `index.html`) appears above the list with Approve / Reject / Export / Delete / Clear buttons.
- **Filter-safe selection.** `_visibleSelectedClips()` intersects `AppState.selectedClipIds` with `_applyFilters()`'s current output, so a clip checked under one filter tab that scrolls out of view under another is never silently included in a bulk action or counted in the toolbar — but switching back restores it (selection isn't destroyed by a filter change, only excluded from the *actionable* set while hidden). `_pruneClipSelection()` (called from `_renderClips()`) only drops IDs for clips that no longer exist at all (e.g. after a delete).
- **Backend** (`web/routes/clips.py`): `POST /api/clips/bulk-status` (best-effort, skips/reports unknown IDs), `POST /api/clips/bulk-delete` (best-effort per clip — a locked export file is skipped and reported in `locked` rather than aborting the whole batch), `GET /api/clips/bulk-export` (SSE, explicit `clip_ids` list rather than a video-wide filter). The batch-export SSE loop was extracted out of the existing video-scoped `/api/videos/{id}/batch-export` into a shared `_clip_export_stream_response` so both routes drive the same per-clip subprocess loop. Bulk routes are registered before the generic `/api/clips/{clip_id}` route — otherwise FastAPI matches `bulk-export` as a `clip_id` path param and 422s.
- **Stale-transcript warning on export.** Each selected clip's existing `transcript_stale` field (`_clip_dict`) is checked client-side before firing a bulk export; if any selected clip has captions edited since its last score, a confirm dialog warns how many and lets the user re-score first or export anyway — it never exports a stale clip silently.
- Covered by `tests/test_videos.py` (`TestBulkClipStatus`, `TestBulkDeleteClips`, `TestBulkExportClips` — payload/missing-ID/validation/skip-already-exported) and `tests/test_ui_clips.py` (`TestBulkSelectCheckboxes`, `TestBulkToolbar`, `TestBulkSelectionRespectsFilter`, `TestBulkApproveReject`, `TestBulkDelete`, `TestBulkExportStaleWarning`). Full API suite 958 passed; UI suite green.

### "Not yet scored" per-clip indicator

- **New `ClipCandidate.scored_at`** (`db/models.py`) — set by `ScoringEngine.score_clip` the moment a
  clip is actually scored. Distinguishes "never scored" from the `score_*` fields' `0.0` default,
  which a mid-batch scoring failure (per-clip commits land in `score_video`'s loop; see the
  `cli/_pipeline.py` comment fix in the same pass) could otherwise leave indistinguishable from a
  genuine zero score. Auto-migration backfills existing clips from their parent video's
  `clips_scored_at` (a video-level "every clip was scored as of this timestamp" signal already
  existed); clips whose video was never fully scored are intentionally left `NULL`.
- **Sidebar and detail view** (`static/clips.js`) — a clip with `scored_at == null` shows "Not yet
  scored" instead of four `0%` score rows/pills, and its sidebar left-border color falls back to the
  same muted treatment as a rejected clip instead of the lowest-score gradient color.
- Covered by `tests/test_scoring.py` (`scored_at` set on success, left `null` on the no-scorer /
  no-weight early-return paths), `tests/test_db_migrations.py` (backfill from a scored vs. unscored
  video, idempotent re-run), and `tests/test_ui_clips.py::TestNotYetScoredIndicator` (sidebar +
  detail rendering). Full API suite 963 passed; UI suite 173 green.

### Fixed: split-segment clip preview/export used the wrong window of the parent file

- `ClipCandidate.start_ms`/`end_ms` are segment-relative for a split recording (0 = the segment's
  own start), but the segment's `Video.path` always points at the untrimmed parent file — so any
  code that seeks into `video.path` using the raw `start_ms` grabs the wrong (too-early) window
  once `segment_start_s > 0`. `_compute_export_window` (`cli/export.py`) and `clip_preview`
  (`web/routes/clips.py`) both had this bug; both now add `video.segment_start_s` back in after
  clamping against the segment-relative duration. (The full-transcript ▶ seek already handled this
  correctly via `seek_offset_s`.)
- Covered by `tests/test_export.py::TestComputeExportWindow` (non-segment unaffected, segment
  offset added, clamp uses segment-relative duration before the shift) and
  `tests/test_videos.py::TestClipPreviewSplitSegmentOffset` (route-level: asserts the ffmpeg `-ss`
  argument for a clip on the second of two split segments). Full API suite 967 passed.

---

## Setup wizard revamp + transcription language (2026-07-01)

- **Wizard restructured into Required / LLM scoring (choose one) / Optional / Basics** — dependencies
  are grouped and ordered by necessity instead of a flat checklist. Ollama status now lives inside the
  Ollama backend panel, so picking "Local model file" or "Claude API" no longer shows a misleading
  "Ollama not running" warning. Static form skeleton + dynamic status slots, so re-checking never
  wipes typed input.
- **Local model file path is fully guided** — the llamacpp panel now installs `llama-cpp-python`
  from the wizard (it's an optional extra, previously only installable from Settings after launch)
  and links a recommended `.gguf` download (Llama 3.2 3B Instruct Q4_K_M, ~2 GB) with plain-English
  steps. Previously choosing this backend gave a bare path input and LLM scoring silently no-oped.
- **Speaker labels setup in the wizard (optional section)** — enable checkbox, HuggingFace token
  input (with format feedback + show/hide), create-token / accept-model-terms links, and a one-click
  `pyannote.audio` install with streamed pip progress, mirroring the Settings flow. Written to
  project config as `diarization_backend` + `huggingface_token` on completion.
- **"Check again" + "Restart app"** — a re-check bar replaces "quit and relaunch" instructions. The
  main process re-reads `Path` from the registry (HKLM + HKCU) before each status check, so a
  just-installed FFmpeg is detected without restarting; "Restart app" (`app.relaunch()`, with PATH
  refreshed first) covers driver/service installs like CUDA.
- **Conditional re-show after updates** — `SETUP_SCHEMA_VERSION` in `main.js` is stored on wizard
  completion; if a new app version bumps it (i.e. setup gained new options), the wizard shows once
  with a "This update added new setup options" subtitle. "Skip for now" (or closing the window)
  launches with existing config and acknowledges the version. Routine updates stay silent.
- **Rerun-mode Close no longer silently saves** — Close now discards (new `setup:close` IPC);
  only "Apply & Close" writes config. Ollama pull and package installs are retryable after an
  error (button re-enabled; progress listeners registered once).
- **Transcription language (end-to-end)** — new `whisper_language` config field (`""` = auto),
  resolved by `resolve_transcription_language` in `whisper_runner` (explicit per-run `--language`
  still wins) and applied to both full transcription and clip retranscribe. Exposed in Settings
  (Whisper section) and the wizard Basics section; option lists are rendered from the ISO codes via
  `Intl.DisplayNames`, Settings fetches codes from the new `GET /api/config/whisper-languages`
  endpoint (single-sourced from `ALLOWED_WHISPER_LANGUAGES`). UI localization (translating the
  interface itself) is a separate Phase 6 roadmap item.
- Covered by `tests/test_config.py` (`TestWhisperLanguageConfig`, `TestWhisperLanguageApi`,
  `TestResolveTranscriptionLanguage`), `tests/test_ui_settings.py` (Settings language select,
  read-only against the live server), and `tests/test_ui_wizard.py` (wizard renderer over
  file:// with a mocked `setupAPI`: section order, FFmpeg gating, backend panels + warnings,
  install/pull error retry, speaker-labels fields, per-mode footers, collected config shape).
  Full API suite 978 passed; UI suite 193 green.

---

## 2026-07-01 — Bug-hunt pass: accidental-input hardening

- **Analyze start double-submit guard** — `POST /api/analyze/start` now returns 409 while a job is
  running. Previously a second start (page-refresh race, second tab) let `/api/analyze/events`
  overwrite `ctx.analyze_job`, orphaning the still-running subprocess (cancel/shutdown could no
  longer reach it) with two writers on the SQLite DB.
- **Delete-while-analyzing guard** — `DELETE /api/videos/{id}` returns 409 when the running analyze
  job targets that recording (matched by video_id, or filename for fresh analyses), instead of
  deleting the rows out from under the ingest subprocess.
- **Global keyboard guard fixed (settings.js)** — (a) events a list item already handled
  (`defaultPrevented`) no longer ALSO fire global shortcuts (Space both activated a clip/video row
  and toggled video play/pause); (b) Escape now closes modals when focus is on a button/select
  inside them — where every modal places focus on open — previously the guard bailed on those
  targets and Escape did nothing; (c) with a confirm modal open, Escape cancels only it instead of
  running the full close cascade (which re-opened the "Discard edit?" confirm from a dirty editor).
- **Cancel-analysis failure no longer silent** — `_doCancelJob` previously swallowed a failed
  cancel request yet logged "[Analysis cancelled]" and tore down the job UI while the subprocess
  kept running. It now cancels server-side first and keeps the stream/UI attached with an error
  toast if the request fails.
- Locked in by `tests/test_analyze.py::TestIngestStartWhileRunning`,
  `tests/test_videos.py::TestDeleteVideoDuringAnalysis`, and
  `tests/test_ui_clips.py::TestGlobalKeyboardGuard`. API suite 985 passed; UI suite 196 green.

---

## 2026-07-01 — Full code-quality pass (test integrity → coverage → refactor → logging → docs → UX)

- **UI suite red baseline fixed at the root** — the API-perf commit (fd1f470) had skipped a
  re-navigation that was masking the Getting Started modal; the `page` fixture now seeds the
  seen-flag via `page.add_init_script` (runs before boot.js on every load), removing the whole
  "must re-goto before clicking" class of fragility. Reel-sort test made deterministic via
  `os.utime` instead of a 50 ms sleep.
- **+19 coverage tests** — sound upload/delete path-traversal and oversize guards, delete
  idempotency; previously untested `GET /api/videos/{id}/source` and `/api/prereqs` routes;
  compute-waveform 404 guards; the single-video "Remove video?" confirm flow (route-intercepted).
- **Electron wizard cleanups** — `setup:get-status` no longer runs the ffmpeg probe twice per
  check; default model names single-sourced (`DEFAULT_OLLAMA_MODEL`/`DEFAULT_CLAUDE_MODEL`);
  pip status-dedupe callback extracted (`pipStatusReporter`).
- **Startup-catch bug fixed** — `app.isQuitting()` (not an Electron API, threw inside the catch and
  was rescued only by the `uncaughtException` handler) now reads the module-level `isQuitting` flag.
- **Logging** — both new 409 guards log WARNING with job/recording context (uvicorn access logs
  never reach yuu-clip.log); Electron setup log now records Ollama pull start/failure, unexpected
  backend exit codes, and startup errors before the dialog.
- **Docs** — CLAUDE.md project layout and pitfall sections corrected (cli/ package, analyze_job
  cancellation flow, escHtml location); glossary gained "Speaker Labels" (the feature) and
  "Speaker Detection" (the action) entries documenting the deliberate term split.
- **UX hardening (accidental-input lens)** — A/R/E shortcuts act on the keyboard-focused clip row
  (activating it first) instead of silently hitting a different active clip; arrow-key navigation
  moves focus with the active row; sidebar active-highlight sync centralized in `selectClip`
  (fixes stale highlight on arrow/related-clip/post-retranscribe selection); diff modal
  Discard/Escape now dirty-checks like the field editor; `beforeunload` warns when a dirty editor
  modal is open. +5 UI tests.
- **Lint clean** — `scripts\lint.ps1` went from 22 errors (pre-existing import-order/unused-import
  drift plus two semicolon statements) to green; 20 auto-fixed, 2 hand-fixed.
- API suite 1000 passed (re-run after lint fixes). UI suite 205 green as of the Phase 7
  checkpoint; final post-lint UI run deferred (analysis job was in progress on the live server).
