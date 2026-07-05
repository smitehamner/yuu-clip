# yuu-clip — Glossary / Ubiquitous Language

This file defines the authoritative term for every concept in yuu-clip. Use these terms consistently in code, UI labels, docs, and conversation. When a term here conflicts with what is currently in the code or UI, the code/UI should eventually be updated — not this file.

> **Keep the user-facing copy in sync.** The in-app "Terminology Glossary" modal is served from `yuu_clip/web/static/glossary.md` — a hand-written, creator-facing subset of this file (no `Code:`, no dev-only sections). When you add or rename a user-facing term here, update that file too.

Two design principles drove the choices below:
- **Creator-first naming** — terminology should make sense to a content creator, not require a developer background.
- **One term per concept** — when the codebase uses multiple names for the same thing, only one of them is correct.

---

## Quick reference

Most lookups only need this table: the authoritative user-facing term, the code name, and what it is. Full entries (with "do not call it", UI labels, and notes) follow below — read the full entry before renaming anything or introducing a new concept.

| User-facing term | Code | What it is |
|---|---|---|
| Project | `project_dir` | A folder yuu-clip stores one body of work in (its `.yuu-clip/` holds the DB, exports, reels). The Project switcher moves the server between them without a restart |
| Recording | `video`, `video_path` | A video file input — not "session" (that's the gameplay period) |
| Session | — | The gameplay period captured in a recording |
| Import from URL | `import-url` (CLI/API path), `url_import.py` | Download a public Twitch VOD or YouTube video to use as a Recording, instead of picking a local file |
| Imported from | `source_url`, `source_title`, `source_uploader`, `source_upload_date`, `source_category` | Recording detail line showing the origin link/channel/date for a URL-imported Recording |
| Duration | `duration_ms`, `duration_hms` | Display as `1h 23m 45s`, never raw ms |
| Track | `AudioTrack`, `stream_index` | One audio stream in a recording — not "stream" in UI |
| Track role | `label` | Semantic function: Player Voice / Voice Chat / Game Sounds / Combined / Unlabeled |
| Track layout | `profile` | Saved template mapping track positions to roles |
| Analyze | `ingest`, `run_ingest()` | End-to-end pipeline run — never "ingest" in UI |
| Pipeline stage | `step` | Inspect → Assign Tracks → Extract → Transcribe → Detect Speakers → Generate Clips → Score |
| Inspect | `probe()` | Read recording metadata — never "probe" in UI |
| Extract | `extract_audio()` | Track → WAV conversion (internal stage) |
| Rescore | `score`, `/api/score` | Re-run scoring only |
| Job | `ingest_proc` | The one active analysis/rescore operation |
| Pause / Resume analysis | `analyze.pause` flag file | Hold a multi-video batch before the next video, without losing progress |
| GPU temperature warning | `GpuThermalMonitor`, `ThermalTrigger` | Heads-up (and optional auto-pause) when the GPU runs hot during analysis |
| Transcript | `Transcript`, `full_text` | Speech-to-text output, one per eligible track |
| Speech-to-text model | `whisper_model` | Whisper — never bare "model" |
| Transcription language | `whisper_language` | What Whisper hears (`""` = auto) — not UI localization |
| Caption segment | `TranscriptSegment` | One timed phrase — never bare "segment" |
| Speaker | `Speaker` | A diarized voice — show name or "Speaker N", never `SPEAKER_00` |
| Speaker name | `Speaker.name` | Creator-assigned name for a speaker |
| Suggested speaker name | `source='inferred'`, `confirmed=False` | LLM-proposed name awaiting Accept/Dismiss |
| Speaker labels | `diarization_backend` | The feature: transcripts show who is speaking — not "diarization" in UI |
| Speaker detection | `rediarizeVideo`, pyannote | The action/install that powers speaker labels |
| Voiceprint | `Speaker.voiceprint` | Internal voice embedding — never user-facing |
| Clip | `ClipCandidate` | A proposed highlight moment — never "clip candidate" in UI |
| Clip status | `status` | `pending` → **Unreviewed**, `approved` → Approved, `rejected` → Rejected |
| Clip window | `start_ms`, `end_ms` | The analyzed time range |
| Trim | `start_offset_s`, `end_offset_s` | Creator offsets applied at export |
| Clip generation | `generate_candidates()` | Transcript → candidate windows — not "segmentation" in UI |
| Manual clip | `"manual"` tag, `clipcreate.js` | A clip picked by hand from the transcript, instead of clip generation |
| Score | `score_overall`, `score_funny`, … | 0–1 rating per dimension |
| Scoring dimension | `funny`, `dramatic`, `action` | The three axes |
| Hot-word | `hot_words`, `hotword_*` | A phrase that nudges a clip's score when it appears in the transcript |
| Sensitive Terms | `sensitive_terms`, `SensitiveTerm` | Privacy Terms + Censor Words together — the feature name (Settings section) |
| Privacy Term | `category='privacy'` | A name or personal detail to flag, never scored |
| Censor Word | `category='censor'` | Language to flag before posting to a restricted platform, never scored |
| Flagged | `sensitive_matches` non-empty | Clip filter tab / badge — a clip containing a Sensitive Terms match |
| LLM scoring | `LLMScorer` | Transcript-based scoring — not "AI scoring" |
| Audio energy scoring | `EnergyScorer` | Loudness/activity-based scoring |
| Scene scoring | `SceneScorer` | Scene-cut-frequency scoring |
| Clip description | `description`, `description_long` | AI one-liner + paragraph; `*_user` overrides win |
| Session summary | `Video.summary` | AI title + overview of a recording |
| Session timeline | `Video.timeline` | AI 15-min chunk descriptions — always "session timeline" |
| World context | `rp_context`, `Context` | Setting/characters/lore bundle for the scorer — not "RP context" in UI |
| Template | `builtin` (contexts only) | Shipped world context: editable, resettable, duplicable, not deletable — not "Built-in" in UI (Track Layouts keep "Built-in": locked, not editable) |
| Context ID | `context_slug` | URL-safe identifier — not "slug" in UI |
| Last scored with | `*_context_json` | Contexts active at last scoring — not "provenance" in UI |
| Export | `export_clip()` | Save one clip to a file |
| Export preset | `ExportPreset`, `export_presets` | Named container/resolution/bitrate recipe for export ("YouTube 1080p", "Discord (≤10 MB)", or a custom one) |
| Format | `ClipExport` (one row per clip+preset) | One of a clip's exported files — a clip can have several, one per Export preset used |
| Vertical framing | `crop_x`, `ExportPreset.vertical` | Which 9:16 slice of the frame fills a Shorts export — 0=left, 0.5=center, 1=right; not "crop position" in UI |
| Quick export | `stream_copy=True` | Keyframe-aligned, no re-encode — not "stream copy" in UI |
| Precise export | `reencode=True` | Frame-accurate re-encode; needed for baked-in captions or a title card |
| Captions | `subtitles`, SRT/VTT | Sidecar or baked-in — not "subtitles" in UI |
| Highlight reel | `demo_reel`, `build_reel()` | Compiled video from approved clips — not "demo reel" in UI |
| Title card | `title_card` | Text overlay between reel clips |
| Stale export | `export_stale` | An exported file no longer reflects the clip's current captions/window/description — needs re-export |
| Project folder | `project_dir` | The hidden `.yuu-clip/` directory |
| Preview proxy | `proxy`, `proxy_path` | Cached 720p copy of a recording used for fast in-app playback; badge reads "Preview quality (720p)" |
| Theme | `data-theme`, `applyTheme()` | App color scheme (Dark / Light / High contrast) — not "skin" or "dark mode" |

---

## Source Material

### Recording

A video file containing a gaming session — the primary input to yuu-clip.

- **Code:** `video`, `video_path`
- **Also called in codebase:** "video", "source file"
- **Do not call it:** "session" (that's the gameplay period, not the file); "video" in user-facing text
- **UI label:** "Recordings" (sidebar panel heading); "🎬 Recording" detail type badge; "recording" in sort/search labels and messages

---

### Session

The gameplay period from one sitting — e.g., "last night's FiveM session." A
session may span **several recordings** when OBS splits a long sitting into
multiple files. yuu-clip can **group** those recordings into one first-class
Session with a shared name, a rolled-up **Session Summary**, and a **Unified
Timeline** (a continuous time axis across all member recordings, with the
real-world breaks between files labelled). Grouping can be suggested
automatically (recordings recorded back-to-back, gap under 30 min) or done by
hand; a group can be renamed, extended, or ungrouped (dissolved) without ever
deleting recordings.

- **Code:** `RecordingSession` (ORM model; named to avoid colliding with
  SQLAlchemy's `orm.Session`), `videos.session_id`, `yuu_clip/sessions.py`
  (auto-suggest), `yuu_clip/web/routes/sessions.py`, `POST/GET/PATCH/DELETE
  /api/sessions`
- **Also called:** gaming session, gameplay session
- **Members:** only top-level recordings carry a `session_id`; a split segment
  belongs to a session via its parent, never directly (see [Recording
  Segment](#recording-segment) / Split)
- **Do not confuse with:** SQLAlchemy `Session` object (dev-only; never
  user-facing) — see [Disambiguation](#disambiguation); or **Recording
  Segments**, which split one file rather than grouping many
- **UI label:** "🎞 Session" detail badge; collapsible session header in the
  Recordings sidebar; "Session Summary", "Unified Timeline", "Group",
  "Suggest sessions". A lone recording's own "Session Summary"/"Session
  Timeline" cards still describe that single recording's gameplay period.

---

### Duration

How long a recording or clip runs.

- **Code:** `duration_ms` (internal milliseconds), `duration_hms` (display string)
- **Display format:** `1h 23m 45s` or `23m 45s` — never raw milliseconds in the UI

---

### Import from URL

Paste a public Twitch VOD or YouTube link instead of a local file path; yuu-clip
downloads it (via yt-dlp) and the result becomes a normal **Recording**, ready to
analyze like any other.

- **Code:** `POST /api/import-url/inspect`, `POST /api/import-url/start`,
  `GET /api/import-url/events`, `yuuclip import-url` (CLI), `yuu_clip/url_import.py`
- **UI label:** "Import from URL" affordance in the New Recording panel; "Check
  link" (fetch metadata) → "Download" (start the download)
- **Notes:** "Download" is the in-progress verb; once it finishes, the file is a
  normal Recording — the New Recording panel opens prefilled with its path so the
  creator still confirms track layout and World Contexts before analyzing (analysis
  is never auto-started). Public YouTube and Twitch links only in v1 — no
  cookies/browser-profile auth for sub-only or otherwise gated content (a plain
  "requires a login" error instead). Quality is capped at 1080p. A live/ongoing
  stream, a playlist/channel link, or a link already imported (matched by
  **Imported from**'s source link) is rejected or flagged before any download starts.

---

### Imported from

The recording-detail line showing where a URL-imported **Recording** came from —
shown only when the recording has a source link.

- **Code:** `Video.source_url`, `Video.source_title`, `Video.source_uploader`,
  `Video.source_upload_date`, `Video.source_category`
- **UI label:** "Imported from" line (channel/uploader name, upload date, and a
  link back to the original video) in the recording detail view
- **Notes:** Set once, at download time, from the metadata sidecar `url_import.py`
  writes next to the downloaded file; picked up when the Video row is first
  created during analysis. Never shown for a recording added from a local file.

---

## Audio Tracks

### Track

One audio stream within a recording — e.g., the microphone, game audio, or a combined mix.

- **Code:** `AudioTrack`, `stream_index`
- **Also called in codebase:** "audio stream", "stream"
- **Do not call it:** "stream" in user-facing text (too technical)

---

### Track Role

The semantic function assigned to a track — what that audio represents.

- **Code:** `label` (enum)
- **Do not call it:** "label" in user-facing text
- **Possible values:**
  - **Player Voice** — the creator's own microphone (`player_voice`)
  - **Voice Chat** — other players in in-game comms (`ingame_voicechat`)
  - **Game Sounds** — game audio, music, ambient (`game_sounds`)
  - **Combined** — full mix of all sources (`combined`)
  - **Unlabeled** — role not yet determined (`unlabeled`)

---

### Track Layout

A saved template that maps track positions to roles, reusable across recordings with the same track arrangement.

- **Code:** `profile`
- **Also called in codebase:** "labeling profile", "audio profile"
- **Do not call it:** "profile" in user-facing text (confusable with "user profile")
- **UI label:** "Track Layout"

---

## Processing Pipeline

### Analyze

The end-to-end process of running a recording through all pipeline stages to produce scored clips.

- **Code:** `ingest`, `run_ingest()`
- **Also called in codebase:** "ingest"
- **Do not call it:** "ingest" in user-facing text
- **UI label:** "Analyze" / "+ Analyze" button
- **Notes:** Only one analysis can run at a time. Covers all pipeline stages.

---

### Pipeline Stage

One step in the ingest process. Displayed as step pills in the UI (gray → blue → green).

**Stages in order:**

| # | Name | What happens |
|---|------|-------------|
| 1 | **Inspect** | Read recording metadata (duration, resolution, tracks) |
| 2 | **Assign Tracks** | Set the role of each audio track |
| 3 | **Extract** | Convert tracks to WAV for analysis (internal) |
| 4 | **Transcribe** | Run speech-to-text on eligible tracks |
| 5 | **Detect Speakers** | Diarize each transcript into speakers *(only when speaker labels are enabled)* |
| 6 | **Generate Clips** | Create candidate clip windows from the transcript |
| 7 | **Score** | Evaluate all clip candidates |

- **Code:** `step` (in SSE progress messages)
- **UI label:** step pill text — matches stage names above (Extract / Transcribe / Speakers / Generate Clips / Energy / Scenes / Score)
- **Notes:** **Detect Speakers** is its own stage (a distinct "Speakers" step pill), split out of Transcribe so the slow diarization pass doesn't look like a hung transcription. It is skipped entirely when the diarization backend is `null`.

---

### Inspect

Read a recording's metadata without running the full pipeline.

- **Code:** `probe()`
- **Also called in codebase:** "probe"
- **Do not call it:** "probe" in user-facing text
- **Notes:** Runs automatically as Stage 1 of analysis; also available standalone via `yuuclip probe` (CLI name unchanged for now).

---

### Extract

Convert a raw audio track to a standardized WAV file for transcription and energy analysis.

- **Code:** `extract_audio()`, `extracted_path`
- **Also called in codebase:** "audio extraction"
- **Do not call it:** "extract" in user-facing text — confusable with "Export"
- **Notes:** Internal stage; creators never interact with it directly.

---

### Rescore

Re-run the scoring stage on an already-ingested recording.

- **Code:** `score` (CLI), `/api/score` (API)
- **UI label:** "Rescore"
- **Notes:** Does not re-transcribe or regenerate clips. Useful after changing world contexts or the AI model.

---

### Job

An active analysis or rescore operation currently running.

- **Code:** `ingest_proc`, `ctx.ingest_proc`
- **UI label:** job status in header; active step pills; live log panel
- **Notes:** Only one job at a time. Can be cancelled.

---

### Pause / Resume Analysis

Holding a running multi-video (or multi-segment) analyze batch before it starts
its next video, without losing the progress already made.

- **Code:** `analyze.pause` flag file (`yuu_clip/analyze/pause.py`), `POST /api/analyze/pause`,
  `POST /api/analyze/resume`, `AnalyzeJob.pause_requested`
- **UI label:** "Pause after current video" button in the job header (swaps to "Resume" when paused)
- **Notes:** The video currently in progress always finishes — pausing only holds the loop
  before the next one starts. In-memory / flag-file only; does not survive a server restart.
  On a single-video run this simply never fires.

---

### GPU Temperature Warning

Non-blocking heads-up that the GPU is running hot during analysis, and the auto-pause
that follows if it stays hot.

- **Code:** `GpuThermalMonitor`, `ThermalTrigger` (`yuu_clip/analyze/thermal.py`);
  config `thermal_warn_c` / `thermal_pause_c` / `thermal_autopause_enabled`
- **UI label:** "GPU NN°C" readout in the job header (only shown when an NVIDIA GPU is
  detected); warning toast at the warn threshold; "Auto-paused: GPU reached NN°C" toast
  with a "Resume now" action at the pause threshold
- **Notes:** Requires 3 consecutive over-threshold readings (~30s) before firing, to avoid
  reacting to a single noisy sample. Auto-pause reuses the Pause/Resume Analysis flag —
  the video in progress always finishes. Silently disabled on non-NVIDIA hardware.

---

## Transcription

### Transcript

The full text of everything said during a recording, as produced by speech-to-text.

- **Code:** `Transcript`, `full_text`
- **UI label:** shown in clip detail view
- **Notes:** One transcript per eligible track (not one per recording).

---

### Speech-to-Text Model

The local AI model that converts audio to text. yuu-clip uses Whisper.

- **Code:** `whisper_model`
- **UI label:** "Caption model" on the export/retranscribe surfaces
  (Retranscribe Clip, Batch Export, Export Clip — decided 2026-07-02, M3-4);
  "Whisper model" in the Analyze panel; "Model" in Settings under the
  "Whisper (Speech-to-text)" section heading
- **Also called:** "Whisper model", "transcription model"
- **Do not call it:** just "model" — ambiguous with the AI scoring model
- **Notes:** all five model selects share one canonical option-copy set
  (guarded by `tests/test_ui_terminology.py`)

---

### Transcription Language

The spoken language Whisper transcribes. Auto-detect by default; a creator can force
a specific language when detection gets it wrong (e.g. mixed-language audio).

- **Code:** `whisper_language` (config, `""` = auto), `language` (per-run CLI flag / `Transcript.language`)
- **UI label:** "Transcription language" (Settings and setup wizard)
- **Do not confuse with:** UI localization — this controls what Whisper hears, not what
  the interface displays (that's a Phase 6 roadmap item)

---

### Caption Segment

A short timed unit of transcribed text — one phrase with start time, end time, and text.

- **Code:** `TranscriptSegment`, `segment` (in transcription context)
- **Also called in codebase:** "Whisper segment", "segment"
- **Do not call it:** just "segment" — overloaded; see [Disambiguation](#disambiguation)
- **Notes:** Internal; drives subtitle/caption timing during export.

---

### Speaker

A distinct voice detected in a recording by speaker diarization.

- **Code:** `Speaker` (durable per-recording row); raw cluster id on `TranscriptSegment.speaker_label` (e.g. `SPEAKER_00`), resolved to a `Speaker` via `TranscriptSegment.speaker_id`
- **Also called in codebase:** "diarization speaker", "speaker cluster"
- **Do not call it:** `SPEAKER_00` / "Speaker 00" in user-facing text — show the **Speaker name** if set, else **"Speaker 1", "Speaker 2"…** (1-indexed `display_index`)
- **Do not confuse with:** **Character** (a world-context lore entity) — a speaker is a voice in one recording; a character is context the scorer reads
- **UI label:** "Speakers" card in the recording detail view
- **Notes:** Durable per-recording — survives re-diarization so an assigned name is not lost or mis-remapped. Cross-recording identity ("this voice everywhere") is deferred.

---

### Speaker Name

The name a creator assigns to a detected **Speaker** (e.g. "Yuu").

- **Code:** `Speaker.name`
- **UI label:** name input in the Speakers card; rendered in place of "Speaker N" in clip transcripts and captions
- **Notes:** Free text in v1. Renaming auto-updates live views (clip transcript, in-app labels); scored clips and exported files are marked stale to rescore / re-export.

#### Suggested (inferred) speaker name

An LLM-proposed **Speaker Name** the creator has **not accepted yet** — surfaced by the Speakers card's **"Suggest names"** action, inferred from direct address in the transcript.

- **Code:** `Speaker.name` with `Speaker.source='inferred'` and `Speaker.confirmed=False`; `infer_speaker_names` (`scoring/llm.py`), `POST /api/videos/{id}/infer-speaker-names`
- **UI label:** "Suggested: …" with **Accept** / **Dismiss** in the Speakers card
- **Do not call it:** a "Speaker name" without qualification in UI text until accepted — it is a *suggestion*
- **Notes:** Never silent. `Speaker.display_name` returns the "Speaker N" fallback while unconfirmed, so a suggestion never reaches captions/excerpts/exports until the creator accepts it (which sets `confirmed=True`).

---

### Speaker Labels

The user-facing **feature**: transcripts and captions show who is speaking.

- **Code:** `diarization_backend` config (`'null'` = off, `'pyannote'` or `'speechbrain'` = enabled), `speaker_labels` flag in analyze options/status
- **Backends:** **Pyannote** (needs a HuggingFace account + token) and **SpeechBrain** (no account or token — ECAPA embeddings, Apache-2.0, model auto-downloads). Voiceprints are backend-specific (`speakers.voiceprint_backend`): named speakers can't auto-match across backends, so re-confirm names after switching.
- **Also called in codebase:** "diarization" (the technique), `diar-*` element ids
- **Do not call it:** "diarization" in user-facing text — say "Speaker labels"
- **UI label:** "Speaker labels" (Settings section, analyze modal checkbox, setup wizard checkbox — usually with the gloss "(identifies who is speaking)")
- **Do not confuse with:** **Speaker detection** — the *action/prerequisite* that powers this feature

---

### Speaker Detection

The **action** of running (or installing the prerequisites for) speaker diarization on a recording.

- **Code:** `rediarizeVideo` (JS), pyannote install flow in the setup wizard
- **Also called in codebase:** "rediarize", "pyannote"
- **UI label:** "Re-detect Speakers" (recording actions), "speaker detection installed" / "install speaker detection" (setup wizard, Settings readiness)
- **Do not confuse with:** **Speaker labels** — the resulting feature. The split is deliberate: the checkbox that *enables the feature* says "Speaker labels"; the operations that *run or install it* say "speaker detection".

---

### Voiceprint

The internal voice embedding that lets a **Speaker** be re-identified across diarization runs.

- **Code:** `Speaker.voiceprint`
- **Notes:** Dev-only — never shown or named in the UI. Its effect is described to creators in plain language ("names stick even if you re-analyze").

---

### Voice match (borderline confirmation)

When a re-diarized voice lands just below the re-attach threshold (within a fixed 0.10 band), instead of silently minting a fresh "Speaker N" the app records the near miss and asks the creator: **"Might be {name} (NN% voice match)"** with **Same voice** / **Different voice** buttons on the Speakers card. "Same voice" merges the new Speaker into the suggested one (averaging voiceprints); "Different voice" dismisses the suggestion.

- **Code:** `Speaker.suggested_match_id`, `Speaker.suggested_match_score`; routes `POST /api/speakers/{id}/confirm-match` and `/reject-match`
- **User-facing terms:** "voice match", "Same voice", "Different voice" — not "cosine", "threshold", or "voiceprint"
- **Notes:** On same-audio re-diarize this rarely fires (a voice's own print re-attaches at ~1.00); it earns its keep for degraded or cross-session audio. See `docs/dev/plans/roadmap-close-2026-07/01-voiceprint-validation.md`.

---

### Name Corrections

The reviewable feature that scans a transcript for likely mis-transcriptions of **known** names (Whisper hearing "You" for "Yuu") and fixes the ones the creator approves. Launched from the recording's transcript card ("Fix names").

- **Code:** `name_corrections` — `find_name_corrections` / `LexiconName` / `NameCorrection` in `scoring/textmatch.py`; routes `POST /api/videos/{id}/name-corrections/scan` and `/apply`; `namecorrections.js`
- **Lexicon:** confirmed **Speaker Names** (owned by that voice) + capitalized character names extracted from the recording's attached **World Contexts**
- **Precision rules:** fuzzy (rapidfuzz `ratio`) with a higher bar for ordinary tokens and a lower bar + mandatory capitalization for short/common words; a speaker's own name is excluded from their own lines; nothing is auto-applied
- **UI label:** "Fix names"; grouped as "**You → Yuu** · N instances", each with per-instance and per-group checkboxes
- **User-facing terms:** "fix names", "name correction" — not "fuzzy match", "lexicon", or "rapidfuzz"
- **Notes:** Applying routes through the same caption-edit path as a manual edit, so overlapping clips are re-excerpted and marked stale. See `docs/dev/plans/roadmap-close-2026-07/09-transcript-name-correction.md`.

---

## Clips

### Clip

A proposed highlight moment — a time window from a recording with a start time, end time, scores, and description.

- **Code:** `ClipCandidate`
- **Also called in codebase:** "clip candidate", "candidate"
- **Do not call it:** "clip candidate" in user-facing text — just "clip"
- **UI label:** "Clips" (sidebar panel, everywhere)

---

### Clip Status

Whether the creator has reviewed a clip and what they decided.

- **Code:** `status` (enum: `pending`, `approved`, `rejected`)
- **Values and their user-facing names:**
  - `pending` → **Unreviewed**
  - `approved` → **Approved**
  - `rejected` → **Rejected**
- **Notes:** Always use "Unreviewed" in the UI; "pending" is a code-only term.

---

### Clip Window

The precise time range a clip covers within its recording.

- **Code:** `start_ms`, `end_ms`
- **Display format:** timestamps like "12:34 – 13:02"
- **Notes:** The window is what was analyzed; the exported clip may differ if Trim is applied.

---

### Trim

Creator-adjustable offsets that shift a clip's start or end from its analyzed window, allowing fine-tuning without re-ingesting.

- **Code:** `start_offset_s`, `end_offset_s`
- **Also called:** "trim offsets", "start/end offset"
- **UI label:** "Trim" inputs in clip detail view
- **Notes:** Positive start offset = clip starts later; negative = starts earlier. Applied at export time.

---

### Clip Generation

The pipeline stage that produces clip candidates from the transcript by finding time windows with meaningful speech.

- **Code:** `segment_candidates()`, `generate_candidates()`
- **Also called in codebase:** "segmentation", "candidate generation", "windowing"
- **Do not call it:** "segmentation" in user-facing text — too technical

---

### Manual Clip

A clip the creator picks by hand from a recording's transcript or timeline, instead of one produced by clip generation.

- **Code:** `"manual"` system tag (via `ClipCandidate.tags`), `clipcreate.js`
- **UI label:** "New clip" (button above the clip list; button in the recording's transcript view), "Create clip" (confirm action in the picker panel)
- **Notes:** Goes through the same scoring/review pipeline as a generated clip — LLM scoring runs right after creation, then approve/reject as normal. There is no separate "unscored, manual-only" clip state.

---

## Scoring

### Score

A 0–1 rating of a clip along a scoring dimension, or the weighted average of all three.

- **Code:** `score_overall`, `score_funny`, `score_dramatic`, `score_action`
- **UI label:** score bars and numeric badges
- **Notes:** Higher is better. `score_overall` is a weighted average of the three dimensions.

---

### Scoring Dimension

One axis of evaluation: Funny, Dramatic, or Action.

- **Code:** dimension names `funny`, `dramatic`, `action`
- **UI label:** labeled score bars ("Funny", "Dramatic", "Action")
- **Notes:** Each dimension is scored independently by multiple scorers and combined.

---

### Laughs

A 0–1 measure of laughter density in a clip, shown as its own score independent of the Funny dimension.

- **Code:** `score_laugh` (nullable column); produced by `LaughScorer`
- **UI label:** "Laughs" (score bar, sidebar percentage, sort option)
- **Notes:** The laugh detector's raw, unweighted result. It still contributes to
  "Funny" through the weighted scoring engine as before; `score_laugh` is an
  additional stored copy so laugh density can be sorted and displayed on its own.
  `NULL` means laughter was never computed for the clip (pre-existing clips, or the
  laugh scorer disabled) — the UI hides the value rather than showing a misleading 0%.

---

### Hot-word

A creator-defined phrase that nudges a clip's score when it appears in the clip's transcript excerpt — e.g. boosting "Funny" whenever a running gag's catchphrase is spoken.

- **Code:** `hot_words` (DB table), `hotword_matches_json`, `hotword_boost_json`, `hotword_*` routes
- **UI label:** "Hot-words" (Settings section); match-mode labels "Exact", "Ignore case", "Meaning (LLM)"
- **Notes:** Per-entry: phrase, match mode, score boost, and which score it boosts (overall or a
  sub-score). Exact/Ignore-case matching runs automatically at scoring time; Meaning (LLM) mode
  requires a per-recording Scan. A phrase counts once per clip regardless of how many times it's
  repeated; boosts are clamped and idempotently re-appliable so re-scanning never compounds them.

---

### Sensitive Terms

The feature (and Settings section) that lets a creator flag clips containing chosen
names, personal details, or language — kept entirely separate from scoring: it never
changes a clip's score, only warns.

- **Code:** `sensitive_terms` (DB table), `SensitiveTerm`, `sensitive_matches_json`,
  `sensitive_*` routes
- **UI label:** "Sensitive Content" (Settings section heading)
- **Notes:** Made of two categories — **Privacy Terms** and **Censor Words** (below).
  Matching reuses the Hot-word matcher (`scoring/textmatch.py`) plus an additional
  **Close spelling** (fuzzy) mode for catching misspellings of a name. A term counts
  once per clip regardless of repeat count, same as Hot-words. Never affects
  `score_*` — see [Hot-word](#hot-word) for the feature that does.

#### Privacy Term

A name or personal detail (e.g. a real name, address, or phone number) a creator
wants flagged so it isn't accidentally left in a shared clip.

- **Code:** `SensitiveTerm.category = "privacy"`
- **UI label:** "Privacy Terms" — "names or personal info you don't want in shared clips"

#### Censor Word

Language a creator wants flagged before posting a clip to a platform with content
restrictions (e.g. profanity, slurs).

- **Code:** `SensitiveTerm.category = "censor"`
- **UI label:** "Censor Words" — "language to flag before posting to restricted platforms"

#### Flagged

The clip-list filter tab (and sidebar badge) for a clip containing at least one
enabled Sensitive Terms match.

- **Code:** clip's `sensitive_matches` list is non-empty
- **UI label:** "Flagged" filter tab (alongside All / Unreviewed / Approved / Rejected);
  &#9888; badge on the clip's sidebar card
- **Notes:** v1 flags clips only — a Highlight Reel built from flagged clips is not
  itself marked; see the reel/export note in USER_PATHS (roadmap plan 02) for the
  deferred follow-up.

---

### LLM Scoring

Scoring and description generation performed by a local language model that reads the clip's transcript.

- **Code:** `LLMScorer`, `llm_score()`
- **Also called:** "AI scoring"
- **Do not call it:** "AI scoring" — LLM is the accurate term; use it to build the habit of distinguishing LLMs from "AI" broadly
- **Notes:** Requires Ollama running locally. Gracefully skipped if unavailable.

---

### Recommended models

The curated list of text and vision models yuu-clip suggests for the LLM backend, shown in Settings → LLM scoring and the setup wizard. Every recommended model carries a licence that permits monetizing the clips it helps produce (Apache-2.0 / MIT for local models; the Anthropic API's commercial terms for Claude). Llama- and Gemma-licensed models are excluded from the list because their terms impose use restrictions — they still work if configured by hand.

- **Code:** `yuu_clip/model_catalog.py` (`ModelEntry`, `recommended_models()`, `text_models()`, `vision_models()`, `catalog_for_backend()`); route `GET /api/llm/catalog`
- **Also called in codebase:** "model catalog"
- **Notes:** A static, hand-maintained list (pattern: `export_presets.py`), not a live registry. Licences are re-verified against the model cards when the list changes.

---

### Model readiness

The at-a-glance indicator in Settings → LLM scoring showing whether the active model can score **text** and analyze **images** right now, with a plain-English reason. Backs the rule that a control needing a capability the model lacks explains why and links to the fix rather than silently disabling itself.

- **Code:** route `GET /api/llm/capabilities` → `{backend, model, text, vision, detail}`; `gateOnCapability()` in `settings.js`
- **Notes:** A cheap static check (file exists / model set / API key set) — no test inference call. Vision on the local `llamacpp` backend needs a **vision projector** file (`llm_mmproj_path`, an mmproj `.gguf`) in addition to the model file.

---

### Image analysis

User-facing: **"Analyze frames"** / **"What's on screen"**. Optional, off by default: sample a few frames evenly across a clip, send them to a vision model, and store a short factual "what's on screen" summary (the game/scene, on-screen events, HUD/popups). The summary enriches the clip's descriptions and is added to the text scorer's prompt as a *Visual context* block — it never scores the clip directly. Triggered manually per clip ("Analyze frames" button) or via an "Include frame analysis" checkbox in the batch Re-score flow; never automatic during Analyze.

- **Code:** `analyze/frames.py` (`sample_clip_frames`, `resolve_frame_window`, `sample_and_describe`); `scoring/llm.py` (`describe_frames`, `check_vision_available`, `_visual_block`); `LLMClient.chat_vision` + `VisionNotSupportedError` in `scoring/llm_client.py`; route `POST /api/clips/{id}/analyze-frames` and `?include_frames=1` on rescore-clips; config `vision_enabled` (master switch), `vision_frames_per_clip` (1–10). DB: `clip_candidates.vision_summary` / `vision_analyzed_at`.
- **Notes:** The instruction is a plain-text user prompt (not JSON) — small local vision models reliably follow "describe this" but return coordinates/empty for a JSON-schema system prompt. Ollama frames scale `num_ctx` and degrade to fewer frames on a context overflow (moondream is hard-capped at ~2048 tokens ≈ 2 frames). Frames come from the fresh 720p proxy when present (parent-keyed timeline, segment offset added).

---

### Audio Energy Scoring

Scoring based on how loud and active the audio was during a clip window.

- **Code:** `EnergyScorer`, `AudioEnergy`
- **Also called in codebase:** "energy scoring", "RMS scoring"
- **Notes:** Clips with energy above the session's baseline score higher on Action.

---

### Scene Scoring

Scoring based on how many visual scene cuts occur within a clip window.

- **Code:** `SceneScorer`, `SceneBoundary`
- **Notes:** More cuts per minute → higher Action score. Boundaries are detected once per recording.

---

### Clip Description

A plain-English summary of what happens in a clip, generated by AI.

- **Code:** `description` (one-liner ≤ 20 words), `description_long` (paragraph)
- **Also called:** "one-liner", "clip summary"
- **UI label:** shown prominently in clip detail view
- **Notes:** AI-generated. Creator edits are stored separately (`description_user`, `description_long_user`) and take precedence everywhere.

---

### Session Summary

A title and paragraph overview of an entire recording session, generated by AI.

- **Code:** `Video.summary`, `summarize_video()`
- **UI label:** "Summarize" button; summary text in recording detail
- **Notes:** Creator edits override AI-generated version.

---

### Session Timeline

AI-generated descriptions of what happened in each 15-minute chunk of a session.

- **Code:** `Video.timeline`, `generate_timeline()`
- **UI label:** "Timeline" button; expandable timeline panel
- **Notes:** Useful for navigating long sessions. Not the same as a video-editing timeline — see [Disambiguation](#disambiguation).

---

## World Contexts

### World Context

A named bundle of information about the RP setting, characters, and lore — used to help the AI scorer understand what's happening.

- **Code:** `rp_context`, `Context`
- **Also called:** "RP context", "game context", "context"
- **Do not call it:** just "context" in code (too generic)
- **UI label:** "Contexts" section, context chips
- **Contains:** setting description, your characters, other characters, notes
- **Notes:** Multiple contexts can be assigned to one recording (e.g., crossover sessions).

---

### Context ID

A short, URL-safe identifier for a world context.

- **Code:** `context_slug`
- **Also called in codebase:** "slug", "context_slug"
- **Do not call it:** "slug" in user-facing text
- **Notes:** Internal identifier; the context's display name is shown in the UI instead.

---

### Last Scored With

A record of which world contexts were active when clips were last scored, summarized, or had timelines generated.

- **Code:** `clips_scored_context_json`, `summary_context_json`, `timeline_context_json`
- **Also called in codebase:** "provenance", "scoring provenance"
- **Do not call it:** "provenance" in user-facing text
- **UI label:** "Stale" warning indicator (shown when current contexts differ from last-scored-with contexts)
- **Notes:** Used to detect when scores may be outdated because the context assignment changed since last scoring.

---

## Export & Reels

### Export

The action of extracting a clip from its recording into a standalone video file.

- **Code:** `export_clip()`
- **UI label:** "Export" button, `E` keyboard shortcut

---

### Quick Export

Export mode that copies audio and video without re-encoding, cutting at the nearest keyframe.

- **Code:** `stream_copy=True`
- **Also called in codebase:** "stream copy", "keyframe-aligned"
- **Do not call it:** "stream copy" in user-facing text
- **Notes:** Fast (seconds). The clip may start/end up to ~1 second off the exact requested time — acceptable for most uses.

---

### Export Preset

A named recipe of container/resolution/bitrate settings a creator picks instead
of exporting at original quality — e.g. to fit a platform's upload limits.

- **Code:** `ExportPreset` (`yuu_clip/export_presets.py`), `export_presets` (custom
  presets, stored in global config — they're a user preference, not project data)
- **Built-ins:** "YouTube 1080p" (`youtube-1080p`), "Discord (≤10 MB)"
  (`discord-10mb`), and "TikTok / Shorts (9:16)" (`tiktok-9x16`) — always
  available, not editable
- **UI label:** "Export preset" dropdown in the export options; "Original quality"
  for the presetless default; custom-preset editor in Settings → Export
- **Do not call it:** "profile" — collides with **Track Layout**
- **Notes:** A preset export always re-encodes (no Quick Export path). A vertical
  preset (`vertical=true`) additionally crops to 9:16 — see **Vertical framing**.

---

### Vertical framing

The horizontal position of the 9:16 crop used by a vertical (TikTok / Shorts)
Export preset — a property of the clip, reused across vertical exports. Stored as
a 0–1 fraction: 0 = left edge flush, 0.5 = center, 1 = right edge flush.

- **Code:** `ClipCandidate.crop_x` (nullable REAL; NULL = center),
  `ExportPreset.vertical` (bool)
- **UI label:** "Vertical framing" — Left / Center / Right + slider, shown in the
  export options only when a vertical preset is selected. "Auto-frame on faces"
  (optional MediaPipe face detection — `POST /api/clips/{id}/suggest-framing`)
  suggests the position; the creator still confirms it.
- **Do not call it:** "crop position" or "pan" in UI copy
- **Notes:** A source already narrower than 9:16 is letterboxed, never cropped past
  its own width — a vertical export never fails on aspect ratio. Auto-framing is a
  static position per clip (median face center across sampled frames), not
  per-frame panning; MediaPipe (Apache-2.0) is installed on demand from Settings.

---

### Format

One of a clip's exported files — the per-preset counterpart to a plain **Export**.
A clip can have several formats at once (e.g. an original-quality export plus a
Discord-sized one); re-exporting the same Export preset replaces that format's
file, a different preset adds another.

- **Code:** `ClipExport` (`clip_exports` table — one row per clip + preset_name)
- **UI label:** one row per format in the clip detail's Export section (preset
  label, container, size, date) with per-row Download / Show in folder / Copy
  path / Regenerate / Delete; "Exported ×2" on the sidebar pill when a clip has
  more than one format
- **Notes:** The original one-row-per-clip export columns
  (`exported_at`/`exported_container`/`exported_burn_subs`/…) stay in place
  alongside this table for now (they still drive the sidebar pill and aggregate
  "exported" counts) — retiring them is a separate follow-up.

---

### Precise Export

Export mode that re-encodes video to cut at exactly the requested frame.

- **Code:** `stream_copy=False`, `reencode=True`
- **Also called in codebase:** "re-encode", "frame-accurate"
- **Do not call it:** "re-encode" in user-facing text
- **Notes:** Slower (~10–30s per minute of clip). Required for baked-in captions.

---

### Captions

Text overlaid on exported clips showing what was said, derived from the transcript.

- **Code:** `subtitles`, SRT/VTT file formats
- **Also called in codebase:** "subtitles"
- **Do not call it:** "subtitles" in user-facing text — "captions" is more familiar to creators
- **Variants:**
  - **Sidecar captions** — separate `.srt` file alongside the video
  - **Baked-in captions** — captions composited into the video itself (requires Precise Export)

---

### Caption Style

The font, size, and position applied to **burned-in** captions. Set as a global
default in Settings → Export, overridable per clip export in the Export dialog, and
also applied when a highlight reel burns captions in ("Burn into video" in the reel
builder / `reel --bake-captions`).

- **Code:** config `caption_font_name`, `caption_font_size`, `caption_position`;
  `CaptionStyle` dataclass and `_subtitles_filter()` (`yuu_clip/analyze/extract.py`);
  applied via libass `force_style` on the `subtitles=` burn-in filter
- **UI label:** "Caption style" (Settings → Export subsection and the Export dialog
  group) — fields "Caption font", "Caption size", "Caption position"
- **Notes:** Applies to **burned-in captions only** — embedded caption tracks and
  sidecar `.srt` files are styled by the player, not here. Empty font / zero size /
  "bottom" position all mean the renderer default and add no `force_style`, so
  existing exports are unchanged until a field is set. Per-speaker colours are
  never overridden (they arrive as inline `<font color>` tags in the SRT and keep
  winning) — colour is deliberately not a caption-style option.

---

### Clip export editor

A full-panel editor opened before final export that ties **Trim**, **Vertical
framing**, and **Caption Style** together over a live preview of the clip: drag
the trim boundaries from the transcript (with ~30 s of neighboring context you can
extend into), position the 9:16 crop box by dragging it over the frame, and see a
live caption overlay — then export from the same panel. It adds no new encode path;
Export runs the same single-clip export as the plain Export dialog after writing
the chosen `start_offset`/`end_offset`/`crop_x`.

- **Code:** `yuu_clip/web/static/exporteditor.js` (`openExportEditor`);
  `GET /api/clips/{id}/context-transcript` supplies the neighboring transcript
- **UI label:** "Edit & export" (button in the clip detail's Export section)
- **Do not call it:** "trim editor" or "crop editor" — it is all three at once
- **Notes:** The caption overlay is a **preview approximation** (a JS overlay, not
  libass-exact) and is labelled as such in the panel. The plain Export dialog stays
  for quick exports. The panel embeds its own inline preview `<video>` (it never
  relies on the main player, which the panel covers).

---

### Highlight Reel

A compiled video assembled from multiple approved clips, with optional transitions and title cards.

- **Code:** `demo_reel`, `build_reel()`
- **Also called in codebase:** "demo reel", "compilation"
- **Do not call it:** "demo reel" in user-facing text — "highlight reel" is more creator-natural
- **UI label:** "Highlight Reel" (header button) / "View Highlight Reels" (hamburger) / "Highlight Reels" (viewer modal title)

---

### Title Card

A brief text overlay that appears between clips in a highlight reel, identifying
what the next clip contains — also usable on a single clip export.

- **Code:** `title_card`, `title_dur`; config `title_card_bg_color`,
  `title_card_font_color`, `title_card_scale`, `title_card_template`,
  `title_card_duration_s`; shared line-building helper `title_card_lines()`
  (`yuu_clip/reel.py`)
- **UI label:** "Title cards" option in reel builder; "Add title card" option in
  the clip export options; "Title card" subsection in Settings → Export
  (background color, text color, text size, text, duration)
- **Notes:** Background color, text color, text size, and the **text template**
  are creator-configurable (Settings → Export). The template is free text with
  `{description}`, `{start}`, and `{duration}` placeholders; each newline becomes
  a line on the card, and a placeholder that renders empty (e.g. `{description}`
  on a clip with no description) drops its line so the card is never blank.
  Background-image upload is deliberately deferred. Uses the clip's **Clip
  Description** (the edited version, if the creator changed it) — never the raw
  AI text once overridden.

---

### Stale Export

A previously exported artifact (clip file or highlight reel) no longer reflects the clip's
current captions, clip window (trim), or description — the source changed after the last
export/build, so the file on disk is out of date. Distinct from the "Last Scored With"
staleness warning above, which is about scores/descriptions vs. world contexts, not files.

- **Code:** `export_stale`, `export_stale_reasons`, `ClipCandidate.trim_edited_at`,
  `ClipCandidate.description_edited_at`
- **UI label:** "Stale — re-export to update" badge on the export status pill; "Stale —
  rebuild to update" on a highlight reel row
- **Notes:** Cheap text artifacts (transcript excerpt, SRT sidecar) auto-refresh instead of
  going stale. Only expensive encoded artifacts (the exported video file, a highlight reel)
  show a stale badge — they are never silently rebuilt. A plain-cut export is not marked
  stale by a caption edit alone, since the raw video is unaffected; it is stale when
  captions are baked/embedded, when the trim window changed, or (for a title-card export)
  when the description changed.

---

## UI & Review Concepts

### Recordings Panel

The top section of the left sidebar listing all ingested recordings.

- **UI label:** "Recordings" (top half of left sidebar)
- **Do not call it:** "Sessions panel" (pre-2026-07 name), "Videos panel"

---

### Clips Panel

The bottom section of the left sidebar listing clips for the selected recording.

- **UI label:** bottom half of left sidebar

---

### Clip Detail View

The main panel showing all information about the selected clip — description, scores, transcript, and controls.

- **UI label:** right/center panel when a clip is selected

---

### Toast

A short temporary notification that appears and fades, confirming an action or reporting an error.

- **Code:** `showToast()`

---

### Log Panel

The collapsible section that shows live output from the running job.

- **UI label:** bottom panel during active jobs

---

### Theme

The app-wide color scheme, chosen in Settings → UI. Three themes are
maintained: **Dark** (default), **Light**, and **High contrast**.

- **Code:** `data-theme` attribute on `<html>`; theme blocks in `app.css`
  (`:root` = Dark, `html[data-theme="light"]`, `html[data-theme="high-contrast"]`);
  `applyTheme()` in `settings.js`; localStorage key `yuuclip-theme`
- **Do not call it:** "skin", "color scheme", "dark mode" (a theme named Dark
  exists; the feature is "theme")
- **Notes:** Every color in the UI must resolve from a theme token (CSS custom
  property) — never a hardcoded hex/rgba literal. Enforced by
  `tests/test_ui_theme.py`. Each theme must keep WCAG AA contrast; the same
  test file checks the token pairs per theme.

---

## Configuration

### Project Folder

The hidden directory `.yuu-clip/` created inside the folder containing the recording. Holds the database, extracted audio, and exported clips.

- **Code:** `project_dir`, `project_root`
- **Notes:** Transparent to the creator unless they go looking. All per-recording state lives here.

---

### Preview proxy

A cached, downscaled **720p H.264** copy of a recording that in-app playback (the
Split Editor scrubber and the clip source preview) plays instead of the raw
source. Long recordings are multi-hour `.mkv` files the browser cannot seek
(it linear-scans), so scrubbing the original is unusably slow; the proxy is a
browser-seekable MP4.

- **Code:** `proxy`, `proxy_path`, `proxy_generated_at`; `analyze/proxy.py`
- **Also called in codebase:** "720p proxy"
- **Do not call it:** "proxy" alone in user-facing text — the on-screen badge reads
  **"Preview quality (720p)"**; the fallback badge reads **"Original quality"**
- **Notes:** Built opportunistically during analysis and on demand (with progress)
  the first time a recording without one is scrubbed. Generated with NVIDIA NVENC
  when available, else CPU libx264. One proxy per source file — shared by a split
  recording and all its segments. Full quality is always used for **export**; the
  proxy is a playback convenience only.

---

## Disambiguation

These terms are used with multiple meanings in the codebase or everyday speech. Always use the qualified form when context is ambiguous.

| Term | Meaning A | Meaning B | Rule |
|------|-----------|-----------|------|
| **Session** | A gameplay period ("last night's session") | SQLAlchemy DB session object | Use "recording" for the file; "session" only for the gameplay period; "DB session" for SQLAlchemy — never expose the latter to creators |
| **Segment** | Caption segment (a timed Whisper output unit) | Clip window (a generated highlight candidate) | Use **"caption segment"** for Whisper output; **"clip"** or **"clip window"** for generated candidates; never bare "segment" |
| **Score** | A numeric rating (noun) | To evaluate a clip (verb) | Both valid; rely on context |
| **Timeline** | Video-editing timeline (common meaning) | Session timeline (AI 15-min chunk descriptions) | Always say **"session timeline"** for the AI feature; avoid bare "timeline" in UI labels |
| **Context** | World context (RP game info) | Python/FastAPI execution context | Use **"world context"** in user-facing text; reserve bare "context" for code |
| **Speaker** | A diarized voice in a recording | — | A **Speaker** is a voice; a **Character** is a world-context lore entity. Don't use them interchangeably; never expose the raw `SPEAKER_00` label |
| **Export** | Save a single clip to a file | Build a highlight reel | Use **"export clip"** for the single-clip action; **"build reel"** for compilations |
| **Profile** | Track layout (saved audio assignments) | User/app profile (does not exist here) | Always say **"track layout"**; retire bare "profile" from the UI |
| **Model** | Speech-to-text model (Whisper) | AI scoring model (Ollama) | Qualify as **"speech-to-text model"** / **"AI model"**; never bare "model" in user-facing text |

---

## Internal / Dev-Only Terms

These appear in code but should not appear in the UI or creator-facing documentation. Use the user-facing equivalent instead.

| Internal term | User-facing equivalent |
|--------------|----------------------|
| `ClipCandidate`, "clip candidate" | Clip |
| `RecordingSession`, `session_id` | Session |
| `Ollama` | *(not mentioned in UI; just "LLM model")* |
| `stream` (audio) | Track |
| `stream_index` | *(internal)* |
| `WAV`, "extracted audio" | *(internal)* |
| `NullPool`, `ORM`, `SQLAlchemy` | *(internal)* |
| `FastAPI`, `Uvicorn`, `SSE` | *(internal)* |
| `stream copy` | Quick Export |
| `re-encode`, `reencode` | Precise Export |
| `burn subtitles`, `burn-in` | Bake in captions |
| `demo reel` | Highlight reel |
| `label` (track role) | Track role |
| `profile` (track layout) | Track layout |
| `rp_context` | World context |
| `ingest`, `ingest_proc` | Analyze / analysis *(internal)* |
| `probe()` | Inspect |
| `pending` (clip status) | Unreviewed |
| `context_slug`, "slug" | Context ID *(show display name in UI instead)* |
| `provenance`, "scoring provenance" | Last scored with |
| `speaker_label`, `SPEAKER_00` | Speaker *(show the Speaker name, or "Speaker N")* |
| `voiceprint` (embedding) | *(internal — never user-facing)* |
| `RMS`, `rms_db`, `baseline_db` | *(internal)* |
| `score_funny`, `score_dramatic`, `score_action` | Funny / Dramatic / Action score |
| `description_user`, `description_long_user` | *(internal storage detail — just "description")* |
| `do_transcribe`, `do_score` | *(internal flags)* |
| `hard_split_ms`, `silence_threshold_ms` | *(internal config)* |
