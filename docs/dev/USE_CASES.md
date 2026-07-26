# YuuClip - End-to-End Use Cases

Authoritative catalog of end-to-end use cases: what a user actually does with the app,
start to finish. Each entry has a stable ID so tests and the manual release checklist
can reference it. Derived from the retired `manual-regression.md` feature checklist,
the retired `packaged-app-verification.md` (its step tables now live inline in
[testing/installed-app-checklist.md](testing/installed-app-checklist.md)), `FEATURES.md`,
and the end-to-end walkthrough.

**IDs are section-scoped:** `UC-<section><nn>` (e.g. `UC-B05`), so new cases append
within a section without renumbering the rest. IDs are stable once assigned - never
reuse or renumber a retired ID.

**Status of the surrounding plan (`e2e-use-cases/INDEX.md`):** Stage 1 (this catalog)
and Stage 2 (the installed-app checklist) are authored; Stage 3 (the `tests/system/`
full-stack tier), Stage 4 (the opt-in golden real-models path,
`tests/system/test_golden_path.py`, `yuu-dev test-golden`), Stage 5 (the Electron boot
smoke test, `electron/test/smoke.test.js`, `YUU_SMOKE=1 npm test`), and Stage 6 (the
drift-guard meta-test) are all built.
The installed-app manual checklist derived from this catalog lives at
[testing/installed-app-checklist.md](testing/installed-app-checklist.md). Every
`automated`/`golden` use case's `Coverage` line now ends with an `Automated by
<pytest node id>` reference to a real test node; `tests/unit/test_use_case_catalog.py`
fails the build if any of those node ids stops existing (run the system tier itself with
`yuu-dev test-system`).

## How to read an entry

- **Automation** - the intended test posture:
  - `automated` - fully drivable headless; an api/ui/js test already covers it or a
    `tests/system/` test will (Stage 3).
  - `golden` - proven only by the one opt-in real-models golden path (Stage 4).
  - `manual-only` - a packaged-Electron surface no headless suite can reach (install,
    wizard, native media protocol, process lifecycle). These are the ones a human MUST
    walk before release.
- **Pre-release priority** - how important it is to hand-walk this before flipping the
  repo public, given how much automated coverage already exists:
  - **P0 - must walk** - packaged-only, or the core loop; a break here blocks release.
  - **P1 - should walk** - a common flow with real user-data consequences.
  - **P2 - nice to walk** - long-tail or well-covered by automated tests already.

A one-glance "what to walk before public" list is in the final section.

---

## Section A - Setup and first run (packaged app)

### UC-A01 - Install the packaged app
- **Actor goal:** get YuuClip onto a clean Windows machine.
- **Preconditions:** a built installer from `scripts/windows-release/build-release.ps1`; a clean machine or VM with no dev checkout, no Python.
- **Steps:**
  1. Run the installer `.exe`.
  2. Complete the install and note the location.
  3. Launch the app for the first time.
- **Expected:** installs per-user under `%LOCALAPPDATA%\Programs\yuu-clip` with no admin/UAC prompt; NO desktop shortcut created silently (opt-in checkbox or absent; Start-menu shortcut is fine); window opens with no unhandled-error dialog.
- **Automation:** manual-only.
- **Coverage:** installed-app-checklist.md, UC-A01 install detail (steps A1-A4).
- **Pre-release priority:** P0 - first thing every new user hits; zero automated coverage.

### UC-A02 - Complete the first-run setup wizard
- **Actor goal:** get a working configuration (project folder, LLM choice, content type) before the main app opens.
- **Preconditions:** first launch after UC-A01 (the `initial` branch of `decideSetupMode`).
- **Steps:**
  1. First-run environment bring-up unpacks the prebuilt Python venv (progress UI shown).
  2. Wizard appears; walk Required (FFmpeg "Included") -> Basics (project folder, Whisper model, transcription language) -> LLM scoring -> Content type -> Optional (GPU).
  3. On the LLM step choose "Set up local AI (Recommended)" or "Lightweight mode (no download)".
  4. Pick a content type.
  5. Click Launch.
- **Expected:** bring-up completes in about a minute (unpack, not a 20-min pip install); wizard renders in the app palette (shared `tokens.css`) and Oxanium header, not a stock white form; Whisper dropdown labels match Settings exactly (shared catalog); GPU line correctly states LLM scoring runs on any-vendor GPU via Vulkan while Whisper CUDA is NVIDIA-only, matching the actual machine; finishing writes `config.json` (text model only, never `llm_vision_model_path`); if local AI was chosen the model downloads in-app afterward without blocking Launch.
- **Automation:** manual-only (pre-server Electron surface; pytest cannot drive it). Token pairings are checked headless by `tests/unit/test_wizard_theme.py`; copy by `tests/ui/test_ui_wizard.py`.
- **Coverage:** installed-app-checklist.md, UC-A02 bring-up + wizard detail (steps B1-B4, C1-C8); test_wizard_theme; test_ui_wizard.
- **Pre-release priority:** P0 - the re-skinned wizard was never eyeballed live; packaged-only.

### UC-A03 - Create, open, and switch projects
- **Actor goal:** start a fresh project, or point the app at an existing project folder, without a restart.
- **Preconditions:** app past first run.
- **Steps:**
  1. On first run, accept or choose the project folder; observe the empty-state UI (both sidebar panels empty).
  2. Use the project switcher (project name, top-left) -> "Open another project..." and pick a different folder.
  3. Open a brand-new empty folder as a project.
  4. (First-run alternative) In the wizard, choose "Restore from a backup instead".
- **Expected:** a new folder starts a fresh empty project; switching reloads without a restart; switch is blocked while a job is running; empty state reads correctly (no clips, clear call to Analyze).
- **Automation:** automated (project switch/open drivable via routes; empty-state via UI).
- **Coverage:** ui project-switch tests. Automated by tests/ui/test_ui_projects.py::TestProjectSwitcher::test_open_another_project_shows_modal.
- **Pre-release priority:** P1 - common, but the switch path is exercised by automated tests; the empty-state first-run is the part worth eyeballing.

---

## Section B - Core loop: analyze, review, export

### UC-B01 - Analyze a recording
- **Actor goal:** get a recording into the system and let the pipeline find clips.
- **Preconditions:** a project is open; a video file on disk; a Whisper model available; optionally an LLM model for descriptions.
- **Steps:**
  1. Click `+ New Recording`; the New Recording panel takes over the main view (sidebar stays live).
  2. Browse to / paste a file path; wait for inspection (duration, track list, per-step time estimate).
  3. Pick a Whisper model and a track layout; optionally assign world contexts, choose a captions source (skip STT with an SRT), or expand Advanced (scene mode, energy mode, speaker labels).
  4. Click Start Analysis.
  5. Watch the header step pills advance: Extract -> Transcribe -> (Detect speakers) -> Generate Clips -> Energy -> Scene cuts -> Score.
  6. Try `+ New Recording` again mid-run.
- **Expected:** estimate updates when model/layout change; on start the panel closes and pills advance in step with real progress; the recording appears in the sidebar immediately with a live stage spinner and survives a page refresh; a second analyze is blocked with a clear "another job is running" message; on completion the pills clear and clips are listed.
- **Automation:** automated (drive the real `cli/_pipeline` analyze path against the fixture with Whisper + LLM stubbed) / golden (real models on a spoken clip).
- **Coverage:** integration pipeline tests; ui analyze/progress tests; golden real-models path in tests/system/test_golden_path.py::test_golden_path_real_models (opt-in, `yuu-dev test-golden`). Automated by tests/system/test_uc_analyze_review_export_play.py::test_analyze_produces_scored_clips.
- **Pre-release priority:** P0 - the spine of the product; walk it once on real footage with real models.

### UC-B02 - Orient to the results
- **Actor goal:** understand what the analysis found and get to the strongest moments fast.
- **Preconditions:** an analyzed recording.
- **Steps:**
  1. Click the recording in the sidebar; the clip list loads below and the detail header opens.
  2. Read a clip card: five score icons (Overall, Funny, Dramatic, Action, Visual), colored left border, duration, status dot, transcript excerpt; SCENE badge on scene rows.
  3. Change the clip sort (Overall / Funny / Dramatic / Action / Laughs / Length / Timeline).
  4. Use the All / Clips / Scenes kind chips and the status filter chips (All / Unreviewed / Approved / Rejected).
  5. Switch to another recording and back.
- **Expected:** clips default to Overall descending; sort reorders and the left-border color tracks the selection; kind chips and per-kind counts filter correctly; sort/kind preference is remembered; status filter resets to All on recording switch.
- **Automation:** automated.
- **Coverage:** ui clip-list/sort/filter tests; js filter/sort logic tests. Automated by tests/ui/test_ui_clips.py::TestClipSort::test_toggling_direction_reverses_clip_order.
- **Pre-release priority:** P2 - heavily covered by automated tests already.

### UC-B03 - Review clips with the keyboard
- **Actor goal:** triage every clip quickly, keyboard-only.
- **Preconditions:** an analyzed recording with unreviewed clips.
- **Steps:**
  1. Select the first clip.
  2. `A` approve, `R` reject, arrow / `J` / `K` to move.
  3. `Ctrl+Z` within 5 s of a reject to undo; wait 6 s then `Ctrl+Z`.
  4. `?` to open the controls list.
- **Expected:** `A`/`R` flip the status dot green/red; navigation updates the detail panel; undo within 5 s reverts with a toast, after 6 s does nothing; controls modal lists the shortcuts.
- **Automation:** automated.
- **Coverage:** ui keyboard/review tests; js undo-window logic. Automated by tests/ui/test_ui_clips2.py::TestGlobalKeyboardGuard::test_shortcut_acts_on_focused_clip_row_not_active_clip.
- **Pre-release priority:** P2 - well covered by automated tests.

### UC-B04 - Inspect a clip in detail
- **Actor goal:** decide on a clip by reading its description, tags, and transcript.
- **Preconditions:** a scored clip.
- **Steps:**
  1. Select a clip; read the one-liner, long description, score bars, tags, transcript excerpt.
  2. Note tags (`llm_scored`, `audio_spike`, `scene_cut`, `long_silence_after`, and `llm_error` on unscored-by-LLM clips).
  3. Read the "No dialogue in this clip" note on a silent visual clip.
- **Expected:** unscored clips show "Not yet scored", never a misleading 0%; the Laughs bar appears only when laughter was measured; silent clips show an explicit no-dialogue note plus a template one-liner, never a blank transcript card.
- **Automation:** automated.
- **Coverage:** ui clip-detail tests; js score-bar/tag rendering tests. Automated by tests/integration/test_videos.py::TestClips::test_get_clip_detail.
- **Pre-release priority:** P2.

### UC-B05 - Export a clip and play it
- **Actor goal:** produce the final video file for one clip and confirm it.
- **Preconditions:** an approved (or any) clip; the source file still at its analyzed path.
- **Steps:**
  1. Press `E` (or Export on the detail panel).
  2. Watch the SSE progress stream in the header.
  3. When it finishes, the player appears in the detail panel; press Space to play.
- **Expected:** Quick export (no re-encode) finishes in about 1-5 s; a real MKV lands in `.yuu-clip/exports/` with an SRT sidecar alongside; the player plays it (in the packaged app via the `yuu-media://` protocol) and shows captions.
- **Automation:** automated (export writes a real file + sidecar; assert existence and duration) / golden.
- **Coverage:** integration export tests; ui export tests; native-protocol playback is packaged-only (installed-app-checklist.md, UC-B05 media-protocol detail, steps E1-E4); golden real-models path in tests/system/test_golden_path.py::test_golden_path_real_models (opt-in). Automated by tests/system/test_uc_analyze_review_export_play.py::test_approve_then_export_writes_file_and_sidecar.
- **Pre-release priority:** P0 - core loop; and packaged playback via `yuu-media://` has no headless coverage (seek/Range, path-traversal refusal).

### UC-B06 - Bulk review and export
- **Actor goal:** act on many clips at once.
- **Preconditions:** several clips.
- **Steps:**
  1. Check several clip-row checkboxes; the bulk toolbar appears.
  2. Bulk Approve / Reject / Export / Delete on the checked-and-visible set.
  3. Undo a bulk status change with the toast or `Ctrl+Z`.
- **Expected:** bulk actions apply only to checked clips visible under the active filter; bulk delete confirms first; bulk export warns if any selected clip's captions were edited since scoring; bulk undo reverts each clip to its own previous status.
- **Automation:** automated.
- **Coverage:** ui bulk-action tests. Automated by tests/integration/test_videos.py::TestBulkClipStatus::test_bulk_update_only_touches_given_ids.
- **Pre-release priority:** P1 - bulk delete/export touch real files; worth one manual pass.

---

## Section C - Editing a clip

### UC-C01 - Edit a clip description
- **Actor goal:** correct the generated one-liner or paragraph.
- **Preconditions:** a scored clip.
- **Steps:** click the one-liner (or long description) text; edit; click away.
- **Expected:** saves immediately and persists across navigation and reload; a later LLM regeneration keeps the user edit and the original separate.
- **Automation:** automated.
- **Coverage:** ui/integration description-edit tests. Automated by tests/integration/test_export.py::TestExportStaleness::test_title_card_export_stale_after_description_edit.
- **Pre-release priority:** P2.

### UC-C02 - Trim a clip, then export
- **Actor goal:** shorten a clip to the good part and export it.
- **Preconditions:** an analyzed clip.
- **Steps:**
  1. Open Edit & export (the full-panel editor).
  2. Drag the trim in/out from the transcript; nudge boundaries; watch the live caption preview.
  3. Export from the same panel.
- **Expected:** trim offsets change the output duration; `trim_edited_at` is set; the stale-export badge logic flips; the exported file matches the trimmed range.
- **Automation:** automated (assert output duration + `trim_edited_at`).
- **Coverage:** integration trim/export-metadata tests. Automated by tests/system/test_uc_trim_export.py::test_trim_changes_duration_and_flips_stale.
- **Pre-release priority:** P1 - common editing flow with a real output change.

### UC-C03 - Edit captions, then re-export
- **Actor goal:** fix a mis-heard word in the transcript and get corrected captions.
- **Preconditions:** a clip with a timed transcript.
- **Steps:**
  1. In the timed transcript, click a line; edit its caption text; Save (Enter).
  2. Observe the "Captions edited since last scoring" notice with its Re-score shortcut.
  3. Re-export the clip.
- **Expected:** editing rebuilds the excerpt of every overlapping clip and marks them for re-scoring; re-export refreshes the SRT sidecar with the corrected text.
- **Automation:** automated.
- **Coverage:** integration caption-edit tests. Automated by tests/system/test_uc_captions_edit_reexport.py::test_caption_edit_rebuilds_excerpt_and_refreshes_sidecar.
- **Pre-release priority:** P1.

### UC-C04 - Split a recording, then export from a segment
- **Actor goal:** break a long recording into independent segments.
- **Preconditions:** an analyzed recording.
- **Steps:**
  1. Open Split Recording (full-panel split editor); place/drag split markers on the waveform.
  2. Choose Split only, Re-analyze, or Re-analyze but keep exported clips (the destructive choices confirm their consequence first).
  3. Open a resulting segment in the sidebar and export a clip from it.
  4. Later, Undo Split (Additional Actions on a segment).
- **Expected:** Split only redistributes clips and transcript lines to the segment containing each clip's start, preserving straddling clips; segment-relative timing survives export (the exported file cuts the correct absolute range); the parent is hidden once split; Undo Split merges siblings back with original absolute timing and restores the parent.
- **Automation:** automated (assert segment-relative timing survives export).
- **Coverage:** integration split tests. Automated by tests/system/test_uc_split_export.py::test_split_migrates_clips_and_segment_export_keeps_timing.
- **Pre-release priority:** P1 - destructive, timing-sensitive, real user data.

### UC-C05 - Merge duplicate or adjacent clips, then export
- **Actor goal:** collapse two captures of the same moment into one.
- **Preconditions:** overlapping or adjacent clips (e.g. after re-analyzing).
- **Steps:**
  1. Check duplicates; overlapping clips get a "possible duplicate" badge and filter chip.
  2. From a clip's detail, Merge its named partner into the current clip (or Merge previous / next).
  3. Export the merged clip.
- **Expected:** merge clears the duplicate flag, resets export metadata, and the merged range exports as one file.
- **Automation:** automated (assert merge resets export metadata and merged file exports).
- **Coverage:** integration merge tests. Automated by tests/system/test_uc_merge_export.py::test_merge_resets_export_metadata_and_exports_one_file.
- **Pre-release priority:** P1.

### UC-C06 - Create a clip (or scene) by hand
- **Actor goal:** capture a moment the pipeline missed.
- **Preconditions:** a recording (with or without a transcript).
- **Steps:**
  1. `+ New clip` above the clip list, or Create clip on the Full transcript card.
  2. Click a transcript line to set start, a later line to set end (or use the `h:mm:ss` time inputs on a transcript-less recording); Play selection to preview.
  3. Pick a longer range to create a Scene instead of a Clip.
  4. Confirm.
- **Expected:** the clip/scene is created, selected, and immediately LLM-scored like any other - no separate "manual, unscored" state; a Scene carries the SCENE badge and scene-aware scoring.
- **Automation:** automated.
- **Coverage:** integration manual-clip tests. Automated by tests/integration/test_clip_create.py::TestCreateManualClipHappyPath::test_creates_pending_clip_with_manual_tag.
- **Pre-release priority:** P2.

---

## Section D - Transcription and speakers

### UC-D01 - Retranscribe, captions refresh
- **Actor goal:** fix a garbled transcript by re-running speech-to-text at a larger model.
- **Preconditions:** an analyzed clip or recording.
- **Steps:**
  1. Retranscribe (clip: Additional Actions; recording: Re-transcribe Recording); pick a model in the selector.
  2. Watch the SSE stream; the transcript updates.
- **Expected:** the excerpt and any SRT sidecar refresh; recording-level retranscribe keeps existing clips but flags them for re-score; speaker labels are reused.
- **Automation:** automated (stubbed retranscribe: excerpt + sidecar refresh).
- **Coverage:** integration retranscribe tests. Automated by tests/system/test_uc_retranscribe_refresh.py::test_recording_retranscribe_refreshes_excerpt_and_sidecar.
- **Pre-release priority:** P2.

### UC-D02 - Diarize, name speakers, export with captions
- **Actor goal:** label who is speaking and carry names into exported captions, across recordings.
- **Preconditions:** speaker labels enabled; a recording analyzed with diarization on.
- **Steps:**
  1. Open the Speakers card; play each voice sample; type real names; pick colors.
  2. Try Suggest names (LLM + voice similarity) and accept/dismiss a suggestion.
  3. Fix names on the transcript card (Whisper "You" -> "Yuu"); review grouped matches; Apply.
  4. Reattribute a single transcript line via its speaker dot, or rename its speaker inline by clicking the speaker name label in the transcript.
  5. Promote a named speaker to a Person; open People to rename/merge/split; confirm a "Same person?" suggestion on a new recording.
  6. Export a clip with captions.
- **Expected:** names appear in clip transcripts and exported captions and survive re-analysis; borderline voice matches show a "Might be {name}" prompt and stay unnamed until confirmed (never silently mislabel); Fix names changes nothing until Apply and flows through the caption-edit path (overlapping clips marked for re-score); a Person's rename/recolor flows to every recording.
- **Automation:** automated / golden.
- **Coverage:** caption-propagation and name-persistence via integration speaker/people tests + ui speaker-card tests; the real diarization model is golden-only. Automated by tests/system/test_uc_speakers_export.py::test_speaker_name_flows_into_captions_and_survives_rename.
- **Pre-release priority:** P1 - lots of surface, real data consequences, and the borderline-match guard is worth eyeballing.

---

## Section E - Aggregate views

### UC-E01 - Generate a video summary
- **Actor goal:** get a title + paragraph summary of a whole session.
- **Preconditions:** an analyzed recording with a transcript; an LLM configured.
- **Steps:** Generate Summary; wait for the SSE stream; click the summary text to edit inline; edit and click away.
- **Expected:** a title + paragraph appear; the inline edit saves and survives reload.
- **Automation:** automated (stubbed LLM).
- **Coverage:** integration summary tests. Automated by tests/system/test_uc_summary.py::test_analyze_persists_summary_and_summarize_route_regenerates.
- **Pre-release priority:** P2.

### UC-E02 - Session timeline and multi-recording sessions
- **Actor goal:** see a session's key events on a time axis, including across multiple files.
- **Preconditions:** an analyzed recording (and, for grouping, 2+ recordings from one sitting).
- **Steps:**
  1. Generate Timeline; a visual bar with clip markers appears; click a marker to select its clip.
  2. Group 2+ recordings into a Session (or accept a Suggest sessions proposal).
  3. Open the session detail: Session Summary and Unified Timeline across recordings with the real-world break labeled.
- **Expected:** timeline markers map to the right clips; a session rolls up member summaries and stitches per-recording timelines into one axis; ungrouping detaches without deleting.
- **Automation:** automated (generate + persist + edit; grouping logic).
- **Coverage:** integration timeline/session tests. Automated by tests/system/test_uc_timeline.py::test_timeline_generates_and_persists_entries.
- **Pre-release priority:** P2.

### UC-E03 - Build a highlight reel (and reel staleness)
- **Actor goal:** compile approved clips into one shareable reel.
- **Preconditions:** a few approved clips (a reel is built from EXPORTED clips).
- **Steps:**
  1. Open Highlight Reels; choose source (all approved / a recording / a Session), transition, durations, captions option (None / Caption file / Burn into video), and order (drag/reorder the clip list).
  2. If any selected clip is not exported, use Export N clips first.
  3. Build Reel; watch the SSE stream.
  4. Re-export one member clip, then re-open the reel.
- **Expected:** the reel file lands in `.yuu-clip/reels/` with title cards from clip one-liners; unexported selections are skipped or offered for export first; re-exporting a member flips the reel's stale flag; burn-in re-encodes and is irreversible while a caption file can be regenerated.
- **Automation:** automated (compile from exported clips; staleness flag flips) / packaged playback is manual.
- **Coverage:** integration reel + staleness tests. Automated by tests/system/test_uc_reel.py::test_reel_compiles_and_staleness_flips_on_member_reexport.
- **Pre-release priority:** P1 - a headline output; worth one real end-to-end run.

---

## Section F - Context, configuration, and vision

### UC-F01 - World contexts: create, assign, re-score (and characters)
- **Actor goal:** tell the LLM who is in the recording and what the setting is, so scores improve.
- **Preconditions:** an analyzed recording; an LLM configured.
- **Steps:**
  1. Open World Contexts; New Context with a name, setting, player/NPC fields, and optional per-context scoring weights.
  2. Add optional structured Characters (name, lore, 0-100% boost).
  3. Assign the context on the video detail (context chips).
  4. Re-score with context; choose LLM only or Full re-score.
  5. Link a Person to a Character (see UC-D02).
- **Expected:** a staleness warning shows when clips were last scored with different contexts; re-score injects the context and averages assigned-context weight overrides; a linked character's lore and boost feed scoring only for clips where that person speaks; "Last scored with" reflects the contexts used.
- **Automation:** automated (assign + re-score reads the context back; stubbed LLM).
- **Coverage:** integration context/character tests. Automated by tests/system/test_uc_context_rescore.py::test_assign_context_then_rescore_injects_context.
- **Pre-release priority:** P1 - the main quality lever; the re-score-mode and staleness behavior is easy to get subtly wrong.

### UC-F02 - Track layouts: create, edit, delete
- **Actor goal:** control which audio tracks get transcribed.
- **Preconditions:** the New Recording panel (Manage Layouts).
- **Steps:** open Manage Layouts; create a layout (name, 1-8 tracks, per-track role/transcribe/weight); edit a name; delete one (confirmation modal).
- **Expected:** a new layout is selectable in the analyze dropdown; edits save; delete confirms then removes.
- **Automation:** automated.
- **Coverage:** integration/ui track-layout tests. Automated by tests/ui/test_ui_analyze.py::TestProfileManager::test_empty_layout_name_shows_inline_error.
- **Pre-release priority:** P2.

### UC-F03 - Scoring configuration: content presets, weights, hot-words, sensitive terms
- **Actor goal:** tune scoring to a content style and flag words.
- **Preconditions:** a project with clips.
- **Steps:**
  1. Settings -> Scoring weights -> Content type; pick a preset (RP / Competitive / Casual / Speedrun / Podcast / Generic); Apply (the confirm dialog spells out the change).
  2. Settings -> Hot-words; add an Exact/Ignore-case phrase (auto-applied) and a Meaning phrase (Scan for Hot-words); Rescan current recording.
  3. Settings -> Sensitive Content; add a Privacy Term and a Censor Word (Exact / Ignore case / Close spelling); watch the instant rescan and the Flagged chip.
- **Expected:** a preset sets weights + starter hot-words + the LLM steer; hot-words show as pills and apply a bounded once-per-clip boost; sensitive terms only warn (never change scores) and rescan instantly with no LLM call; each hot-word/term is Global or context-scoped.
- **Automation:** automated (weights, hot-word matching, sensitive rescan are pure logic).
- **Coverage:** integration scoring-config tests; js hot-word/sensitive match tests. Automated by tests/integration/test_config.py::TestUiConfig::test_patch_config_accepts_known_content_preset.
- **Pre-release priority:** P2 - strong automated coverage; presets worth a quick eyeball.

### UC-F04 - Vertical / Shorts export with auto-framing
- **Actor goal:** produce a 9:16 vertical clip for Shorts/TikTok.
- **Preconditions:** a clip from a widescreen recording.
- **Steps:**
  1. Open Edit & export; choose the "TikTok / Shorts (9:16)" preset.
  2. Use the vertical-framing buttons + slider to pick the slice; or Auto-frame on faces (if the face-detection package is installed) and confirm the suggested crop.
  3. Export.
- **Expected:** output is 1080x1920; the framing choice is saved on the clip; sources already narrower than 9:16 are letterboxed, not cropped; auto-frame suggests a crop you confirm before exporting.
- **Automation:** automated (9:16 export + framing path runs on the fixture).
- **Coverage:** integration vertical-export tests. Automated by tests/system/test_uc_vertical_export.py::test_vertical_preset_exports_1080x1920.
- **Pre-release priority:** P1 - a distinct render path; worth confirming the real output geometry.

### UC-F05 - Vision "What's on screen" (image analysis)
- **Actor goal:** get a description of what is on screen, especially for silent/visual clips.
- **Preconditions:** image analysis enabled and a vision model downloaded (moondream2 default).
- **Steps:**
  1. On a clip, Analyze frames; choose how many frames (1-10).
  2. Watch the job header (sampling -> describing); switch clips and come back.
  3. (Optional) enable Auto-describe silent clips (Advanced AI options); tick Include frame analysis on a recording re-score.
- **Expected:** the summary lands in a "What's on screen" card on the correct clip even if you navigated away, and feeds the scorer prompt as context without setting the score by itself; it never runs automatically during analysis; auto-describe only replaces the template one-liner on top silent clips and never redoes a clip that already has a description.
- **Automation:** automated / golden.
- **Coverage:** the wiring (cancel/return-to-right-clip, stubbed vision model) via the js vision cancel-wiring test + integration vision tests; a real vision model is golden-only. Automated by tests/integration/test_vision.py::TestVisualBlock::test_scorer_feeds_vision_summary_into_prompt.
- **Pre-release priority:** P2 - opt-in, and the tricky wiring is already unit-covered.

---

## Section G - Housekeeping and desktop lifecycle

### UC-G01 - Back up and restore a project
- **Actor goal:** protect and move a project's state.
- **Preconditions:** a project with clips.
- **Steps:**
  1. Settings -> Backup & Restore -> Back up project; download the `.zip`.
  2. Restore from backup into a folder (restoring over an existing project confirms and keeps a safety copy).
  3. Simulate moved source videos; use the relink UI to point missing folders at new locations.
  4. (First run) choose "Restore from a backup instead" in the wizard.
- **Expected:** the backup zip carries the DB, settings, contexts, and custom sounds but not the source videos/exports/proxies/reels (stays small); restore rebuilds the project; missing-folder relink lets clips play again; folders left blank stay marked missing rather than guessed.
- **Automation:** automated (backup/restore roundtrip; relink logic).
- **Coverage:** integration backup/restore tests. Automated by tests/integration/test_backup.py::test_backup_contains_project_state.
- **Pre-release priority:** P1 - data-safety feature; a broken restore is a trust-losing bug.

### UC-G02 - Confirmations, log download, status, notification sounds
- **Actor goal:** the safety and feedback rails behave.
- **Preconditions:** a running app.
- **Steps:**
  1. Attempt to delete a video / a clip; cancel an analysis mid-run - each shows an in-app modal (not the browser `confirm()`).
  2. Hamburger -> Download Log; confirm a non-empty file downloads and redacts the account name from paths.
  3. `GET /api/status` idle and during a job.
  4. Settings -> Notification sounds; opt in to an event, Preview, and confirm the cue fires on completion (Stop sound button appears).
- **Expected:** all destructive actions use the app modal; log downloads non-empty and username-redacted; status returns `any_running`/`active_jobs` correctly; sound cues are off by default and only fire for opted-in events.
- **Automation:** automated / manual-only.
- **Coverage:** confirmations/status/log via ui confirmation/log tests + integration status tests; sound playback is manual-only. Automated by tests/integration/test_analyze.py::TestStatus::test_status_idle.
- **Pre-release priority:** P2 - mostly automated; the packaged Reveal-in-folder is covered under UC-G03.

### UC-G03 - Desktop shell lifecycle (packaged)
- **Actor goal:** the packaged app starts, stops, and updates cleanly.
- **Preconditions:** the packaged Electron build.
- **Steps:**
  1. Use the packaged-only hamburger entry Re-run Setup Wizard; confirm it reopens preserving config.
  2. Reveal-in-folder on an export; OS explorer opens at the file.
  3. Quit while a job is running; then quit cleanly and relaunch.
  4. Install a newer build (schema advanced vs same schema).
- **Expected:** quit confirms/cancels cleanly and leaves NO orphan `python.exe` / `llama-server.exe` (check Task Manager); relaunch after a clean quit opens straight to the main UI (no wizard); a schema-advancing update opens the wizard in `update` mode preserving project/config; a same-schema bump goes straight to the app.
- **Automation:** manual-only; the Electron smoke test (Stage 5, `electron/test/smoke.test.js`, opt-in `YUU_SMOKE=1`) asserts boot + `/api/status` + the UI document + clean shutdown / no orphan python. It cannot cover the update-mode wizard, Reveal-in-folder, or native playback - those stay a human walk.
- **Coverage:** installed-app-checklist.md, UC-G03 lifecycle + update detail (steps H1-H6, I1-I2); electron smoke test electron/test/smoke.test.js (opt-in boot + no-orphan-python backstop).
- **Pre-release priority:** P0 - orphaned processes are the packaging failure mode no pytest suite can catch.

### UC-G04 - Check for available updates
- **Actor goal:** know when a newer YuuClip release exists, without any auto-download/install.
- **Preconditions:** a running app; GitHub reachable (or not, to see the failure path).
- **Steps:**
  1. Launch the app with a version older than the latest GitHub release; wait for the background check.
  2. Settings -> Updates; read the status line; click "Check for updates now".
  3. Dismiss the header banner; confirm it stays dismissed for that version but reappears for a newer one.
  4. Turn off "Check for updates automatically"; relaunch and confirm no background check runs (the manual button still works).
  5. Simulate no internet; confirm the status reads a plain failure message, not a crash.
- **Expected:** a newer release shows a status line and a dismissible header banner linking to the GitHub release page; nothing is ever downloaded or installed automatically; the toggle gates only the background launch check, never the manual button; a failed check degrades to a plain message.
- **Automation:** automated / manual-only. The check/compare logic and route are automated; the real end-to-end GitHub lookup can only be verified once the repo is public (unauthenticated `releases/latest` 404s on a private repo).
- **Coverage:** tests/unit/test_update_check.py, tests/integration/test_updates.py, tests/js/core/updatecheck.test.js. Live-repo verification is a manual HOW-TO-RELEASE.md checklist item post-flip. Automated by tests/integration/test_updates.py::TestUpdatesCheck::test_reports_update_available.
- **Pre-release priority:** P2 - convenience, not core loop; never blocks or auto-changes anything.

### UC-G05 - Library upgrades cleanly on an app update (schema migration + backup)
- **Actor goal:** open a project made by an older version after updating, with all data intact.
- **Preconditions:** a project DB created by a prior release whose schema differs from the new one.
- **Steps:**
  1. Update the app to a build whose schema has advanced, then open an existing project.
  2. Confirm the app opens straight to the library with every recording, clip, and edit present.
  3. Look in `<project>/.yuu-clip/` for a `project.db.pre-migration-<timestamp>.bak` file.
  4. (Failure path) simulate a broken upgrade; confirm the app refuses to serve with an
     actionable message and leaves the backup intact rather than showing a half-migrated library.
- **Expected:** the DB auto-migrates to the latest schema on startup, after a timestamped
  backup, with no user action; data is preserved; a failed migration keeps the backup and
  surfaces a clear "your library could not be upgraded, previous data backed up to ..."
  message instead of serving corrupt data. Migrations are forward-only (recover by restoring
  the backup, never a downgrade).
- **Automation:** automated / manual-only. The migrate + backup + adopt-existing-DB mechanics
  are automated; the real cross-release upgrade (a genuine prior-release DB -> new build) is a
  per-release manual gate (create a DB with the previous version, boot the new one, confirm
  clean upgrade with data intact) because it needs a shipped prior release to exist.
- **Coverage:** tests/unit/test_migration_drift.py, tests/unit/test_startup_migrate.py, tests/integration/test_migration_startup.py. Automated by tests/unit/test_startup_migrate.py::test_pending_migration_backs_up_then_upgrades and tests/integration/test_migration_startup.py::test_create_app_migrates_seeded_project_to_head. Cross-release upgrade path: HOW-TO-RELEASE.md manual checklist.
- **Pre-release priority:** P0 - losing or corrupting a user's library across an update is the worst possible failure for a distributed app.

### UC-G06 - Loopback-only by default; warned before exposing to the network
- **Actor goal:** trust that the local web UI is not silently reachable by other machines or by other web pages the user has open.
- **Preconditions:** a running app (default loopback bind), and a shell to try `yuu-dev serve --host 0.0.0.0`.
- **Steps:**
  1. Run the app normally; confirm it serves on `127.0.0.1` and works.
  2. Start it with `yuu-dev serve --host 0.0.0.0`; read the startup output.
  3. (Provenance) Confirm a request carrying a cross-site `Sec-Fetch-Site`, or a non-loopback `Host`, is refused (this is what stops another open web page from driving the API).
- **Expected:** the default bind is loopback and enforces a strict Host allowlist so a DNS-rebinding page cannot reach it; browser requests that are cross-site or carry a non-loopback Host are rejected with a plain 403; binding to a non-loopback address prints a loud "NO password - anyone on your network can open, edit, and export your projects" warning and relaxes the Host allowlist (the cross-site guard still applies). The desktop shell, the `yuu-dev` CLI, and other non-browser callers are unaffected.
- **Automation:** automated. The provenance/rebinding guard and the bind-host policy are unit + integration tested; the `--host 0.0.0.0` warning text is exercised through the bind-host policy helper.
- **Coverage:** tests/unit/test_security.py, tests/integration/test_security_middleware.py. Automated by tests/integration/test_security_middleware.py::TestCrossSiteRejected::test_side_effectful_get_blocked_cross_site and tests/unit/test_security.py::TestBindHostPolicy::test_non_loopback_bind_disables_allowlist_and_warns.
- **Pre-release priority:** P1 - the loopback boundary is the whole trust model for an unauthenticated single-user app; it must hold and the exposure escape-hatch must be loud.

---

## What to walk before flipping the repo public

The automated api/ui/js suites already exercise most in-app behavior. The manual walk
should concentrate on (1) the packaged-Electron surfaces those suites cannot reach and
(2) the core loop on a real recording with real models. Priorities:

### P0 - must walk (packaged build, on a clean machine or VM)
| UC | Why it must be a human walk |
|----|------------------------------|
| UC-A01 Install | Per-user install / no silent desktop shortcut / clean launch - zero automated coverage. |
| UC-A02 Setup wizard | Re-skinned wizard never eyeballed live; palette, GPU messaging, config write - pre-server, un-testable headless. |
| UC-B01 Analyze (real models) | The spine; run it once end to end with real Whisper + real LLM (the golden path). |
| UC-B05 Export + play | Core output, and packaged playback via `yuu-media://` (seek/Range, path-traversal refusal) has no headless coverage. |
| UC-G03 Desktop lifecycle | Orphaned `python.exe` / `llama-server.exe` on quit is the packaging failure pytest can't see; plus update-mode wizard. |

### P1 - should walk (real user-data flows, one pass each)
UC-A03 first-run empty state, UC-B06 bulk delete/export, UC-C02 trim -> export,
UC-C03 caption edit -> re-export, UC-C04 split -> export (timing), UC-C05 merge -> export,
UC-D02 speakers -> captions (borderline-match guard), UC-E03 highlight reel end to end,
UC-F01 contexts + re-score modes, UC-F04 vertical/Shorts geometry, UC-G01 backup/restore.

### P2 - nice to walk (well covered by automated tests; spot-check only)
UC-B02 orient, UC-B03 keyboard review, UC-B04 clip detail, UC-C01 description edit,
UC-C06 manual clip, UC-D01 retranscribe, UC-E01 summary, UC-E02 timeline/sessions,
UC-F02 track layouts, UC-F03 scoring config, UC-F05 vision, UC-G02 confirmations/log/sounds.

If time is short, the five P0 rows are the release-blocking set - each is packaged-only
or the irreplaceable core loop, and none is covered by the headless suites. This P0 set
is the user-facing framing of the flip-time remainder tracked in the planning repo's
`REMAINING-WORK.md` section 2 (packaged-app checklist + one friend/VM install).
