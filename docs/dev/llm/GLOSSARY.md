# YuuClip - Glossary / Ubiquitous Language

> **LLM/agent-targeted doc.** This is the exhaustive dev superset (every term plus
> its `Code:` names and dev-only notes), maintained mainly by agents and kept in
> `docs/dev/llm/` for that reason. **Humans wanting the terminology should read the
> in-app "Glossary"** (`yuu_clip/web/static/glossary.md`, served at
> `/api/glossary`) - a hand-written, creator-facing subset. This file stays the
> authoritative source the in-app copy is derived from.

This file defines the authoritative term for every concept in YuuClip. Use these terms consistently in code, UI labels, docs, and conversation. When a term here conflicts with what is currently in the code or UI, the code/UI should eventually be updated - not this file.

> **Keep the user-facing copy in sync.** The in-app "Glossary" modal is served from `yuu_clip/web/static/glossary.md` - a hand-written, creator-facing subset of this file (no `Code:`, no dev-only sections). When you add or rename a user-facing term here, update that file too.

Two design principles drove the choices below:
- **Creator-first naming** - terminology should make sense to a content creator, not require a developer background.
- **One term per concept** - when the codebase uses multiple names for the same thing, only one of them is correct.

---

## Quick reference

Most lookups only need this table: the authoritative user-facing term, the code name, and what it is. Full entries (with "do not call it", UI labels, and notes) follow below - read the full entry before renaming anything or introducing a new concept.

| User-facing term | Code | What it is |
|---|---|---|
| YuuClip | package `yuu_clip`, dist `yuu-clip`, CLI `yuuclip`, config dir `.yuu-clip/`, appId `com.smitehamner.yuuclip` | The product's display name. Written **YuuClip** (one word) in all user-facing titles, prose, window/menu chrome, and docs. The lowercase hyphen/underscore forms are code/mechanical identifiers only and must **not** be rebranded (paths, package/dist names, CLI token, localStorage `yuuclip-*` keys, install artifacts, URLs). |
| Project | `project_dir` | A folder YuuClip stores one body of work in (its `.yuu-clip/` holds the DB, exports, reels). The Project switcher moves the server between them without a restart |
| Backup | `build_backup`, `/api/backup` | A single portable `.zip` of a project's own state (clips DB, settings, world contexts) - not the large derived media or the source videos. Made from Settings > Backup & Restore |
| Restore | `restore_into`, `/api/restore/*` | Rebuild a project from a Backup file. Re-points source-video folders that no longer resolve on this machine so restored clips still play |
| Recording | `video`, `video_path` | A video file input - not "session" (that's the gameplay period) |
| Session | - | The gameplay period captured in a recording |
| Import from URL | `import-url` (CLI/API path), `url_import.py` | Download a public Twitch VOD or YouTube video to use as a Recording, instead of picking a local file |
| Imported from | `source_url`, `source_title`, `source_uploader`, `source_upload_date`, `source_category` | Recording detail line showing the origin link/channel/date for a URL-imported Recording |
| Duration | `duration_ms`, `duration_hms` | Display as `1h 23m 45s`, never raw ms |
| Track | `AudioTrack`, `stream_index` | One audio stream in a recording - not "stream" in UI |
| Track role | `label` | Semantic function: Player Voice / Voice Chat / Game Sounds / Combined / Unlabeled |
| Track layout | `profile` | Saved template mapping track positions to roles |
| Analyze | `ingest`, `run_ingest()` | End-to-end pipeline run - never "ingest" in UI |
| Pipeline stage | `step` | Inspect → Assign Tracks → Extract → Transcribe → Detect Speakers → Generate Clips → Score |
| Inspect | `probe()` | Read recording metadata - never "probe" in UI |
| Extract | `extract_audio()` | Track → WAV conversion (internal stage) |
| Rescore | `score`, `/api/score` | Re-run scoring only |
| Job | `ingest_proc` | The one active analysis/rescore operation |
| Pause / Resume analysis | `analyze.pause` flag file | Hold a running analysis at its next pause point, without losing progress |
| GPU temperature warning | `GpuThermalMonitor`, `ThermalTrigger` | Heads-up (and optional auto-pause) when the GPU runs hot during analysis |
| Transcript | `Transcript`, `full_text` | Speech-to-text output, one per eligible track |
| Speech-to-text model | `whisper_model` | Whisper - never bare "model" |
| Transcription language | `whisper_language` | What Whisper hears (`""` = auto) - not UI localization |
| Caption segment | `TranscriptSegment` | One timed phrase - never bare "segment" |
| Speaker | `Speaker` | A diarized voice - show name or "Speaker N", never `SPEAKER_00` |
| Person / People | `ProjectVoice`, `Speaker.global_voice_id` | One voice named once across all recordings - not "ProjectVoice"/"global voice" in UI |
| Speaker name | `Speaker.name` | Creator-assigned name for a speaker |
| Suggested speaker name | `source='inferred'`, `confirmed=False` | LLM-proposed name awaiting Accept/Dismiss |
| Speaker labels | `diarization_backend` | The feature: transcripts show who is speaking - not "diarization" in UI |
| Speaker detection | `rediarizeVideo`, speechbrain | The action that powers speaker labels |
| Minimum speaking time | `speaker_min_cluster_seconds` | Settings knob: a voice speaking fewer than N seconds is folded into the nearest speaker as noise/crosstalk (0 = off) |
| Voiceprint | `Speaker.voiceprint` | Internal voice embedding - never user-facing |
| Clip | `ClipCandidate` | A proposed highlight moment - never "clip candidate" in UI |
| Clip status | `status` | `pending` → **Unreviewed**, `approved` → Approved, `rejected` → Rejected |
| Clip window | `start_ms`, `end_ms` | The analyzed time range |
| Trim | `start_offset_s`, `end_offset_s` | Creator offsets applied at export |
| Clip generation | `generate_candidates()` | Transcript → candidate windows - not "segmentation" in UI |
| Manual clip | `"manual"` tag, `clipcreate.js` | A clip picked by hand from the transcript, instead of clip generation |
| Score | `score_overall`, `score_funny`, … | 0–1 rating per dimension |
| Scoring dimension | `funny`, `dramatic`, `action`, `visual` | The four axes. Funny/Dramatic/Action are transcript-driven (LLM-rated); Visual is model-free (frame-diff + scene cuts), weighted 0.5 in Overall |
| Hot-word | `hot_words`, `hotword_*` | A phrase that nudges a clip's score when it appears in the transcript |
| Sensitive Terms | `sensitive_terms`, `SensitiveTerm` | Privacy Terms + Censor Words together - the feature name (Settings section) |
| Privacy Term | `category='privacy'` | A name or personal detail to flag, never scored |
| Censor Word | `category='censor'` | Language to flag before posting to a restricted platform, never scored |
| Flagged | `sensitive_matches` non-empty | Clip filter tab / badge - a clip containing a Sensitive Terms match |
| AI privacy mode | `ai_privacy_mode` | The trust control: No generative AI / Local models only / Allow remote models |
| LLM scoring | `LLMScorer` | Transcript-based scoring - not "AI scoring" |
| Audio energy scoring | `EnergyScorer` | Loudness/activity-based scoring |
| Scene scoring | `SceneScorer` | Scene-cut-frequency scoring |
| Lexicon scoring | `LexiconScorer` | Curated keyword-density funny/dramatic/action nudge - no model |
| Speech-rate scoring | `SpeechRateScorer` | Words-per-second bursts nudge funny/action - no model |
| Speaker-overlap scoring | `SpeakerChurnScorer` | Rapid speaker turn-taking + cross-talk nudge funny/action - needs diarization |
| Prosody scoring | `ProsodyScorer` | Loudness + pitch delivery dynamics nudge dramatic/action - no model |
| Audio-event scoring | `AudioEventScorer` | Gunshot/explosion/cheer detection via the AudioSet model → action/funny - heavy opt-in, off by default |
| Similarity engine | `similarity_backend` | Powers Find related clips + "Meaning" hot-words: Fast (keyword) / Smart (embeddings) / LLM |
| Clip description | `description`, `description_long` | AI one-liner + paragraph; `*_user` overrides win |
| Basic description | `desc_basic` tag | Non-LLM template one-liner so a clip is never blank without a model |
| Session summary | `Video.summary` | AI title + overview of a recording |
| Session timeline | `Video.timeline` | AI 15-min chunk descriptions - always "session timeline" |
| World context | `rp_context`, `Context` | Setting/characters/lore bundle for the scorer - not "RP context" in UI |
| Template | `builtin` (contexts only) | Shipped world context: editable, resettable, duplicable, not deletable - not "Built-in" in UI (Track Layouts keep "Built-in": locked, not editable) |
| Context ID | `context_slug` | URL-safe identifier - not "slug" in UI |
| Last scored with | `*_context_json` | Contexts active at last scoring - not "provenance" in UI |
| Export | `export_clip()` | Save one clip to a file |
| Export preset | `ExportPreset`, `export_presets` | Named container/resolution/bitrate recipe for export ("YouTube 1080p", "Discord (≤10 MB)", or a custom one) |
| Format | `ClipExport` (one row per clip+preset) | One of a clip's exported files - a clip can have several, one per Export preset used |
| Vertical framing | `crop_x`, `ExportPreset.vertical` | Which 9:16 slice of the frame fills a Shorts export - 0=left, 0.5=center, 1=right; not "crop position" in UI |
| Quick export | `stream_copy=True` | Keyframe-aligned, no re-encode - not "stream copy" in UI |
| Precise export | `reencode=True` | Frame-accurate re-encode; needed for baked-in captions or a title card |
| Captions | `subtitles`, SRT/VTT | Sidecar or baked-in - not "subtitles" in UI |
| Highlight reel | `demo_reel`, `build_reel()` | Compiled video from approved clips - not "demo reel" in UI |
| Title card | `title_card` | Text overlay between reel clips |
| Stale export | `export_stale` | An exported file no longer reflects the clip's current captions/window/description - needs re-export |
| Project folder | `project_dir` | The hidden `.yuu-clip/` directory |
| Preview proxy | `proxy`, `proxy_path` | Cached 720p copy of a recording used for fast in-app playback; badge reads "Preview quality (720p)" |
| Theme | `data-theme`, `applyTheme()` | App color scheme (Dark / Light / High contrast) - not "skin" or "dark mode" |

---

## Source Material

### Recording

A video file containing a gaming session - the primary input to YuuClip.

- **Code:** `video`, `video_path`
- **Also called in codebase:** "video", "source file"
- **Do not call it:** "session" (that's the gameplay period, not the file); "video" in user-facing text
- **UI label:** "Recordings" (sidebar panel heading); "🎬 Recording" detail type badge; "recording" in sort/search labels and messages

---

### Session

The gameplay period from one sitting - e.g., "last night's FiveM session." A
session may span **several recordings** when OBS splits a long sitting into
multiple files. YuuClip can **group** those recordings into one first-class
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
  user-facing) - see [Disambiguation](#disambiguation); or **Recording
  Segments**, which split one file rather than grouping many
- **UI label:** "🎞 Session" detail badge; collapsible session header in the
  Recordings sidebar; "Session Summary", "Unified Timeline", "Group",
  "Suggest sessions". A lone recording's own "Session Summary"/"Session
  Timeline" cards still describe that single recording's gameplay period.

---

### Duration

How long a recording or clip runs.

- **Code:** `duration_ms` (internal milliseconds), `duration_hms` (display string)
- **Display format:** `1h 23m 45s` or `23m 45s` - never raw milliseconds in the UI

---

### Import from URL

Paste a public Twitch VOD or YouTube link instead of a local file path; YuuClip
downloads it (via yt-dlp) and the result becomes a normal **Recording**, ready to
analyze like any other.

- **Code:** `POST /api/import-url/inspect`, `POST /api/import-url/start`,
  `GET /api/import-url/events`, `yuuclip import-url` (CLI), `yuu_clip/url_import.py`
- **UI label:** "Import from URL" affordance in the New Recording panel; "Check
  link" (fetch metadata) → "Download" (start the download)
- **Notes:** "Download" is the in-progress verb; once it finishes, the file is a
  normal Recording - the New Recording panel opens prefilled with its path so the
  creator still confirms track layout and World Contexts before analyzing (analysis
  is never auto-started). Public YouTube and Twitch links only in v1 - no
  cookies/browser-profile auth for sub-only or otherwise gated content (a plain
  "requires a login" error instead). Quality is capped at 1080p. A live/ongoing
  stream, a playlist/channel link, or a link already imported (matched by
  **Imported from**'s source link) is rejected or flagged before any download starts.

---

### Imported from

The recording-detail line showing where a URL-imported **Recording** came from -
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

One audio stream within a recording - e.g., the microphone, game audio, or a combined mix.

- **Code:** `AudioTrack`, `stream_index`
- **Also called in codebase:** "audio stream", "stream"
- **Do not call it:** "stream" in user-facing text (too technical)

---

### Track Role

The semantic function assigned to a track - what that audio represents.

- **Code:** `label` (enum)
- **Do not call it:** "label" in user-facing text
- **Possible values:**
  - **Player Voice** - the creator's own microphone (`player_voice`)
  - **Voice Chat** - other players in in-game comms (`ingame_voicechat`)
  - **Game Sounds** - game audio, music, ambient (`game_sounds`)
  - **Combined** - full mix of all sources (`combined`)
  - **Unlabeled** - role not yet determined (`unlabeled`)

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
- **UI label:** step pill text - matches stage names above (Extract / Transcribe / Speakers / Generate Clips / Energy / Scenes / Score)
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
- **Do not call it:** "extract" in user-facing text - confusable with "Export"
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

Holding a running analysis at its next pause point, without losing the progress
already made.

- **Code:** `analyze.pause` flag file (`yuu_clip/analyze/pause.py`,
  `wait_while_paused`), `POST /api/analyze/pause`, `POST /api/analyze/resume`,
  `AnalyzeJob.pause_requested`
- **UI label:** "Pause at next safe point" button in the job header (swaps to "Resume" when paused)
- **Notes:** Four pause points, coarse to fine: between videos in a multi-video (or
  multi-segment) batch; between pipeline stages; inside a long transcription (every
  `SEGMENTS_PER_COMMIT` segments); and between individual clips during scoring. The last
  two are the sustained-GPU stages, and the reason a single-video run is protected rather
  than running straight to the end. Every pause point sits immediately after a commit -
  SQLite is single-writer here, so blocking with a write transaction open would lock the
  web server out of its own database for the whole hold. Flag-file only; does not survive
  a server restart. Only the analyze job honours it - the standalone Rescore and
  Retranscribe jobs deliberately do not, having no Pause control to clear the flag.

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
  reacting to a single noisy sample. Auto-pause reuses the Pause/Resume Analysis flag, so
  it takes effect at that feature's next pause point - within seconds during transcription
  or scoring, the two stages that actually generate the heat. Silently disabled on
  non-NVIDIA hardware.

---

## Transcription

### Transcript

The full text of everything said during a recording, as produced by speech-to-text.

- **Code:** `Transcript`, `full_text`
- **UI label:** shown in clip detail view
- **Notes:** One transcript per eligible track (not one per recording).

---

### Speech-to-Text Model

The local AI model that converts audio to text. YuuClip uses Whisper.

- **Code:** `whisper_model`
- **UI label:** "Caption model" on the export/retranscribe surfaces
  (Retranscribe Clip, Batch Export, Export Clip - decided 2026-07-02, M3-4);
  "Whisper model" in the Analyze panel; "Model" in Settings under the
  "Whisper (Speech-to-text)" section heading
- **Also called:** "Whisper model", "transcription model"
- **Do not call it:** just "model" - ambiguous with the AI scoring model
- **Notes:** all five model selects share one canonical option-copy set
  (guarded by `tests/test_ui_terminology.py`)

---

### Transcription Language

The spoken language Whisper transcribes. Auto-detect by default; a creator can force
a specific language when detection gets it wrong (e.g. mixed-language audio).

- **Code:** `whisper_language` (config, `""` = auto), `language` (per-run CLI flag / `Transcript.language`)
- **UI label:** "Transcription language" (Settings and setup wizard)
- **Do not confuse with:** UI localization - this controls what Whisper hears, not what
  the interface displays (that's a Phase 6 roadmap item)

---

### Caption Segment

A short timed unit of transcribed text - one phrase with start time, end time, and text.

- **Code:** `TranscriptSegment`, `segment` (in transcription context)
- **Also called in codebase:** "Whisper segment", "segment"
- **Do not call it:** just "segment" - overloaded; see [Disambiguation](#disambiguation)
- **Notes:** Internal; drives subtitle/caption timing during export.

---

### Speaker

A distinct voice detected in a recording by speaker diarization.

- **Code:** `Speaker` (durable per-recording row); raw cluster id on `TranscriptSegment.speaker_label` (e.g. `SPEAKER_00`), resolved to a `Speaker` via `TranscriptSegment.speaker_id`
- **Also called in codebase:** "diarization speaker", "speaker cluster"
- **Do not call it:** `SPEAKER_00` / "Speaker 00" in user-facing text - show the **Speaker name** if set, else **"Speaker 1", "Speaker 2"…** (1-indexed `display_index`)
- **Do not confuse with:** **Character** (a world-context lore entity) - a speaker is a voice in one recording; a character is context the scorer reads
- **UI label:** "Speakers" card in the recording detail view
- **Notes:** Durable per-recording - survives re-diarization so an assigned name is not lost or mis-remapped. Cross-recording identity ("this voice everywhere") is deferred.

---

### Speaker Name

The name a creator assigns to a detected **Speaker** (e.g. "Yuu").

- **Code:** `Speaker.name`
- **UI label:** name input in the Speakers card; rendered in place of "Speaker N" in clip transcripts and captions
- **Notes:** Free text in v1. Renaming auto-updates live views (clip transcript, in-app labels); scored clips and exported files are marked stale to rescore / re-export.

#### Suggested (inferred) speaker name

An LLM-proposed **Speaker Name** the creator has **not accepted yet** - surfaced by the Speakers card's **"Suggest names"** action, inferred from direct address in the transcript.

- **Code:** `Speaker.name` with `Speaker.source='inferred'` and `Speaker.confirmed=False`; `infer_speaker_names` (`scoring/llm.py`), `POST /api/videos/{id}/infer-speaker-names`
- **UI label:** "Suggested: …" with **Accept** / **Dismiss** in the Speakers card
- **Do not call it:** a "Speaker name" without qualification in UI text until accepted - it is a *suggestion*
- **Notes:** Never silent. `Speaker.display_name` returns the "Speaker N" fallback while unconfirmed, so a suggestion never reaches captions/excerpts/exports until the creator accepts it (which sets `confirmed=True`).

---

### Speaker Labels

The user-facing **feature**: transcripts and captions show who is speaking.

- **Code:** `diarization_backend` config (`'null'` = off, `'speechbrain'` = enabled), `speaker_labels` flag in analyze options/status
- **Backend:** **SpeechBrain** (no account or token - ECAPA embeddings, Apache-2.0, model auto-downloads). Voiceprints are tagged by backend (`speakers.voiceprint_backend`) so they never cross-match if another backend is ever added. (Pyannote was a second backend, removed 2026-07-14 - see ROADMAP "Larger / speculative features".)
- **Also called in codebase:** "diarization" (the technique), `diar-*` element ids
- **Do not call it:** "diarization" in user-facing text - say "Speaker labels"
- **UI label:** "Speaker labels" (Settings section, analyze modal checkbox, setup wizard checkbox - usually with the gloss "(identifies who is speaking)")
- **Do not confuse with:** **Speaker detection** - the *action/prerequisite* that powers this feature

---

### Speaker Detection

The **action** of running (or installing the prerequisites for) speaker diarization on a recording.

- **Code:** `rediarizeVideo` (JS)
- **Also called in codebase:** "rediarize"
- **UI label:** "Re-detect Speakers" (recording actions), "speaker detection installed" / "install speaker detection" (setup wizard, Settings readiness)
- **Do not confuse with:** **Speaker labels** - the resulting feature. The split is deliberate: the checkbox that *enables the feature* says "Speaker labels"; the operations that *run or install it* say "speaker detection".

---

### Voiceprint

The internal voice embedding that lets a **Speaker** be re-identified across diarization runs.

- **Code:** `Speaker.voiceprint`
- **Notes:** Dev-only - never shown or named in the UI. Its effect is described to creators in plain language ("names stick even if you re-analyze").

---

### Voice match (borderline confirmation)

When a re-diarized voice lands just below the re-attach threshold (within a fixed 0.10 band), instead of silently minting a fresh "Speaker N" the app records the near miss and asks the creator: **"Might be {name} (NN% voice match)"** with **Same voice** / **Different voice** buttons on the Speakers card. "Same voice" merges the new Speaker into the suggested one (averaging voiceprints); "Different voice" dismisses the suggestion.

- **Code:** `Speaker.suggested_match_id`, `Speaker.suggested_match_score`; routes `POST /api/speakers/{id}/confirm-match` and `/reject-match`
- **User-facing terms:** "voice match", "Same voice", "Different voice" - not "cosine", "threshold", or "voiceprint"
- **Notes:** On same-audio re-diarize this rarely fires (a voice's own print re-attaches at ~1.00); it earns its keep for degraded or cross-session audio.

---

### Person / People

A **project-wide identity**: one voice named once and applied across *every* recording it appears in, so a real person named in ten sessions is named once. A per-recording **Speaker** links to a Person; a Speaker's effective **display name** resolves through the linked Person (naming the Person is what "applies everywhere" means). The **People** view (hamburger menu) lists people, their member recordings, and pending cross-recording suggestions, with promote / rename / recolor / merge / split and a "Find people across recordings" backfill.

- **Code:** `ProjectVoice` (the identity), `Speaker.global_voice_id` (the link), `VoiceExemplar` (the multi-exemplar voiceprints), `Speaker.suggested_voice_id` / `suggested_voice_score` (an unconfirmed cross-recording match); routes in `web/routes/voices.py` (`/api/voices*`, `/api/speakers/{id}/confirm-voice` · `/reject-voice`); matching core `transcribe/project_voice.py`; UI `voices.js`.
- **Also called in codebase:** `global_voice`, "project voice".
- **User-facing terms:** "Person", "People", "Promote to Person", "Same person" - not "ProjectVoice", "global voice", "cluster", or "cosine".
- **Three thresholds (keep distinct):** within-recording clustering *distance* (`speaker_cluster_threshold`, "Voice grouping"); same-recording re-attach *similarity* (`speaker_match_threshold`, "Speaker match strictness"); and the new, strictest cross-recording *similarity* (`project_voice_match_threshold`, "Same person across recordings"). A voice matches a Person on its *nearest* exemplar, same diarization backend only.
- **Notes:** Matching during analyze only ever *suggests* (`suggested_voice_id`); nothing sets `global_voice_id` automatically - a wrong cross-recording merge would propagate a name project-wide, so the user confirms in People. A Person may optionally link to a **Character** via `ProjectVoice.character_id` (see below) - a pure overlay that never affects the Person's own name or voiceprint.

---

### Character

A structured lore entity within a **World context** - a name, `lore` text, and a `score_boost` - that a **Person** may optionally link to. When a linked Person speaks in a clip, the Character's lore and boost are fed into the LLM scoring prompt for that clip. Structured Characters coexist with a context's free-text `your_characters` / `other_characters` prose; only the structured records drive per-character scoring boosts.

- **Code:** `Character` (`db/models.py`), keyed to a JSON context by `context_slug` (a plain string, not a FK - contexts live in `contexts.json`, same precedent as `HotWord.context_slug`); `ProjectVoice.character_id` (nullable overlay link); routes in `web/routes/characters.py` (`/api/contexts/{slug}/characters`, `/api/characters*`) and `POST /api/voices/{id}/character`; prompt seam `contexts.format_character_block`; UI in `contexts.js` (editor section) + `voices.js` (per-Person picker).
- **User-facing term:** "Character". Same word in code and UI.
- **Do not confuse with:** **Speaker** (a voice in one recording) or the free-text player names in a context - a Character is a structured record that drives scoring boosts.
- **Score boost:** a 0.0-1.0 value fed to the LLM as an explicit numeric hint (stated on a 0.00-1.00 scale in the prompt); it is *not* a deterministic post-score multiply (that was deliberately deferred). 0.0 = lore only, no boost.
- **Notes:** Optional and additive - a clip with no linked Character produces a prompt byte-identical to a project with no characters. Deleting a Character (or its whole context) nulls any linking `ProjectVoice.character_id` in code; it never blocks the delete and never touches the Person's name or voiceprint.

---

### Name Corrections

The reviewable feature that scans a transcript for likely mis-transcriptions of **known** names (Whisper hearing "You" for "Yuu") and fixes the ones the creator approves. Launched from the recording's transcript card ("Fix names").

- **Code:** `name_corrections` - `find_name_corrections` / `LexiconName` / `NameCorrection` in `scoring/textmatch.py`; routes `POST /api/videos/{id}/name-corrections/scan` and `/apply`; `namecorrections.js`
- **Lexicon:** confirmed **Speaker Names** (owned by that voice) + capitalized character names extracted from the recording's attached **World Contexts**
- **Precision rules:** fuzzy (rapidfuzz `ratio`) with a higher bar for ordinary tokens and a lower bar + mandatory capitalization for short/common words; a speaker's own name is excluded from their own lines; nothing is auto-applied
- **UI label:** "Fix names"; grouped as "**You → Yuu** · N instances", each with per-instance and per-group checkboxes
- **User-facing terms:** "fix names", "name correction" - not "fuzzy match", "lexicon", or "rapidfuzz"
- **Notes:** Applying routes through the same caption-edit path as a manual edit, so overlapping clips are re-excerpted and marked stale.

---

## Clips

### Clip

A proposed highlight moment - a time window from a recording with a start time, end time, scores, and description.

- **Code:** `ClipCandidate`
- **Also called in codebase:** "clip candidate", "candidate"
- **Do not call it:** "clip candidate" in user-facing text - just "clip"
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
- **Do not call it:** "segmentation" in user-facing text - too technical

---

### Manual Clip

A clip the creator picks by hand from a recording's transcript or timeline, instead of one produced by clip generation.

- **Code:** `"manual"` system tag (via `ClipCandidate.tags`), `clipcreate.js`
- **UI label:** "New clip" (button above the clip list; button in the recording's transcript view), "Create clip" (confirm action in the picker panel)
- **Notes:** Goes through the same scoring/review pipeline as a generated clip - LLM scoring runs right after creation, then approve/reject as normal. There is no separate "unscored, manual-only" clip state.

---

### Duplicate Clips

Two or more clips in one recording whose time windows heavily overlap - usually the same moment captured twice (for example after re-analyzing). Surfaced on demand so the creator can merge or delete the redundant one; it never changes scores.

- **Code:** `scoring/dedup.py` (`find_duplicate_candidates`, `_overlap_ratio`); route `POST /api/videos/{video_id}/scan-duplicates` (`web/routes/dedup.py`); the `possible_duplicate` system tag; UI `clips.js` (`_duplicatePartners`)
- **UI label:** "Check duplicates" button; "possible duplicate" badge + matching filter chip; "Merge" action on the clip detail
- **Notes:** A scan-time grouping, not a stored status - overlap is measured as shared duration over clip duration. Merging clears the flag.

---

### Scene

A longer contextual candidate - a 1-5 minute moment with a story arc, which may include pauses. Reviewed and exported through the same machinery as a Clip; only generation and scoring differ. Distinct from a Clip (a punchy 15-90s bit).

- **Code:** a `ClipCandidate` row with `kind='scene'` (Clips are `kind='clip'`, the default)
- **Also called in codebase:** not to be confused with `SceneBoundary` / `SceneScorer` (see Scene Scoring below), which are an unrelated **visual scene-cut timecode**, not this candidate type.
- **Do not call it:** a "SceneBoundary" - that is a different concept.
- **UI label:** "Scenes" (the All / Clips / Scenes filter chips above the clip list; scene rows carry a **SCENE** badge)
- **Notes:** Shares the `clip_candidates` table with Clips via the `kind` discriminator. The review UI shows both kinds in one merged list by default (the **All** chip); the **Clips** / **Scenes** chips filter it client-side, and the choice persists in `localStorage` (`clips-kind-filter`).

---

## Scoring

### Score

A 0–1 rating of a clip along a scoring dimension, or the weighted average of all four.

- **Code:** `score_overall`, `score_funny`, `score_dramatic`, `score_action`, `score_visual`
- **UI label:** score bars and numeric badges
- **Notes:** Higher is better. `score_overall` is a weighted average of the four dimensions.

---

### Scoring Dimension

One axis of evaluation: Funny, Dramatic, Action, or Visual.

- **Code:** dimension names `funny`, `dramatic`, `action`, `visual`
- **UI label:** labeled score bars ("Funny", "Dramatic", "Action", "Visual")
- **Notes:** Each dimension is scored independently by multiple scorers and combined. Funny/Dramatic/Action are narrative axes (transcript/audio driven); Visual is the pixel-derived axis (see [Visual](#visual)).

---

### Visual

The pixel-derived scoring dimension - how much is happening on screen, independent of dialogue. Surfaces silent, action-packed highlights (a clutch play, a crash) that the talk-driven axes would miss.

- **Code:** dimension name `visual`, column `score_visual`, config `score_visual_weight`
- **UI label:** "Visual" (score bar, sidebar percentage, sort option, and the Visual weight slider under Settings → Scoring weights)
- **Notes:** Fed today by scene-cut density ([Scene Scoring](#scene-scoring), moved here from Action); later stages add an on-screen-activity signal. Its default weight (0.5) sits below the 1.0 narrative axes so visual moments surface without dominating a talk-heavy ranking. `0.0` until a clip is (re-)scored.

---

### Visual clips (mode)

The setting that controls whether silent, action-heavy moments become clips at all. The normal clip finder only proposes clips where there is speech, so a no-dialogue highlight (a clutch play, a crash) never surfaces; turning this on adds a second, model-free source that proposes clips from on-screen motion and scene-cut density.

- **Code:** `visual_candidate_mode` (Config: `off` | `relax` | `gaps` | `parallel`); `yuu_clip/segments/visual_windower.py` (`generate_visual_candidates`), `yuu_clip/segments/merge.py` (`merge_candidates` - the dedup + per-recording cap guard). Visual-source clips are `ClipCandidate` rows with `kind="clip"` carrying the `visual` + `no_speech` tags and an empty `transcript_excerpt`.
- **UI label:** "Visual clips" (Settings → Analysis defaults). Options: Off / Silent gaps (recommended) / Relaxed / Full.
- **Notes:** `gaps` proposes visual clips only in the silent stretches between speech clips; `parallel` ("Full") scans the whole recording; `relax` instead keeps a low-speech speech-clip window when it overlaps high motion, rather than adding a separate source. A merge step drops a visual clip that overlaps a speech clip by more than `visual_dedup_overlap` (speech wins) and caps visual-only clips at `visual_candidate_cap` per recording - the "don't drown the talk-heavy core" guard. Distinct from the [Visual](#visual) scoring dimension (how a clip scores) and from [Scenes](#scene) (`kind="scene"`, a different candidate type).

---

### No dialogue

A clip with no transcript at all - typically a [Visual clip](#visual-clips-mode), a silent highlight surfaced by on-screen motion or scene cuts rather than speech. Its Transcript card shows an explicit "No dialogue in this clip" state (never left blank) plus the Visual score, so the clip stays legible without needing an LLM. A non-LLM one-liner ("Silent visual moment - high on-screen activity") fills the description until a vision-LLM description or a creator edit supersedes it.

- **Code:** tag `no_speech` on `ClipCandidate.tags`; template text from `yuu_clip/scoring/describe_basic.py` (`build_basic_description`, gated on the `visual` tag); filter chip token `no_speech` (`clips.js`)
- **UI label:** "No dialogue" (transcript-card state, generated-tag pill, and the "No dialogue" filter chip under Clips → More filters)
- **Notes:** A clip with both a transcript AND a high Visual score is NOT treated as textless - the transcript always wins and the Transcript card renders normally, with the Visual score still shown separately in the Scoring card.

---

### Content type

A one-choice tuning preset for the kind of content you make - RP / narrative, Competitive gaming, Casual / let's play, Speedrun, Podcast / conversation, or the Generic default. Applying one copies recommended scoring weights and offers to add starter hot-words, and steers the LLM's scoring, summary, and timeline prompts toward that style.

- **Code:** `content_preset` (Config field - the applied preset's id); `yuu_clip/content_presets.py`; `POST /api/content-presets/apply`
- **UI label:** "Content type" (Settings → Scoring weights)
- **Notes:** Weights are *copied* on apply (you tune them afterwards); the prompt flavor paragraph is read *live* from the active preset at scoring time, so flavor text can improve in updates without a re-apply. Selecting Generic is a true no-op relative to the defaults. Built-in only - no user-defined content presets in v1.

---

### Laughs

A 0–1 measure of laughter density in a clip, shown as its own score independent of the Funny dimension.

- **Code:** `score_laugh` (nullable column); produced by `LaughScorer`
- **UI label:** "Laughs" (score bar, sidebar percentage, sort option)
- **Notes:** The laugh detector's raw, unweighted result. It still contributes to
  "Funny" through the weighted scoring engine as before; `score_laugh` is an
  additional stored copy so laugh density can be sorted and displayed on its own.
  `NULL` means laughter was never computed for the clip (pre-existing clips, or the
  laugh scorer disabled) - the UI hides the value rather than showing a misleading 0%.

---

### Hot-word

A creator-defined phrase that nudges a clip's score when it appears in the clip's transcript excerpt - e.g. boosting "Funny" whenever a running gag's catchphrase is spoken.

- **Code:** `hot_words` (DB table), `hotword_matches_json`, `hotword_boost_json`, `hotword_*` routes
- **UI label:** "Hot-words" (Settings section); match-mode labels "Exact", "Ignore case", "Meaning"
- **Notes:** Per-entry: phrase, match mode, score boost, and which score it boosts (overall or a
  sub-score). Exact/Ignore-case matching runs automatically at scoring time; **Meaning** mode
  (DB `match_mode='semantic'`) matches by concept via the [Similarity engine](#similarity-engine)
  and requires a per-recording Scan - it no longer needs an LLM. A phrase counts once per clip
  regardless of how many times it's repeated; boosts are clamped and idempotently re-appliable so
  re-scanning never compounds them. Each entry is either **global** or scoped to a world context -
  see [Global vs context-scoped term](#global-vs-context-scoped-term).

---

### Similarity engine

The engine behind **Find related clips** and the **Meaning** hot-word mode - it ranks
clips by how alike their descriptions are and checks whether a clip expresses a phrase's
concept. Tiered so it works with no language model installed.

- **Code:** `similarity_backend` (config), `scoring/similarity.py` (`make_backend`,
  `TfidfBackend` / `EmbeddingsBackend` / `LlmBackend`)
- **UI label:** "Similarity engine" (Settings → LLM scoring), with tiers **Fast
  (keyword)** / **Smart (embeddings)** / **LLM**
- **Notes:** Default **Fast** is a zero-dependency TF-IDF keyword cosine (always
  available). **Smart** uses a small local embeddings model via `fastembed` (opt-in
  package, ONNX, no PyTorch) for paraphrase matching. **LLM** reuses the language-model
  path. An unavailable tier (e.g. Smart without `fastembed`) transparently falls back to
  Fast so the features never hard-fail - see [Hot-word](#hot-word).

---

### Sensitive Terms

The feature (and Settings section) that lets a creator flag clips containing chosen
names, personal details, or language - kept entirely separate from scoring: it never
changes a clip's score, only warns.

- **Code:** `sensitive_terms` (DB table), `SensitiveTerm`, `sensitive_matches_json`,
  `sensitive_*` routes
- **UI label:** "Sensitive Content" (Settings section heading)
- **Notes:** Made of two categories - **Privacy Terms** and **Censor Words** (below).
  Matching reuses the Hot-word matcher (`scoring/textmatch.py`) plus an additional
  **Close spelling** (fuzzy) mode for catching misspellings of a name. A term counts
  once per clip regardless of repeat count, same as Hot-words. Never affects
  `score_*` - see [Hot-word](#hot-word) for the feature that does.

#### Privacy Term

A name or personal detail (e.g. a real name, address, or phone number) a creator
wants flagged so it isn't accidentally left in a shared clip.

- **Code:** `SensitiveTerm.category = "privacy"`
- **UI label:** "Privacy Terms" - "names or personal info you don't want in shared clips"

#### Censor Word

Language a creator wants flagged before posting a clip to a platform with content
restrictions (e.g. profanity, slurs).

- **Code:** `SensitiveTerm.category = "censor"`
- **UI label:** "Censor Words" - "language to flag before posting to restricted platforms"

#### Flagged

The clip-list filter tab (and sidebar badge) for a clip containing at least one
enabled Sensitive Terms match.

- **Code:** clip's `sensitive_matches` list is non-empty
- **UI label:** "Flagged" filter tab (alongside All / Unreviewed / Approved / Rejected);
  &#9888; badge on the clip's sidebar card
- **Notes:** v1 flags clips only - a Highlight Reel built from flagged clips is not
  itself marked; the reel/export follow-up is deferred.

---

### AI privacy mode

The single setting that decides whether YuuClip runs a generative model on a recording's transcript. It is a **guarantee, not a hint** - enforced at every point a language model could run (`resolve_ai_permissions`). YuuClip is local-only: all inference runs on the user's machine, so there is no remote/off-device option. Two levels:

- **No generative AI** (`none`) - no language model runs at all. Clip finding, related-clip search, "Meaning" hot-words, and lightweight scoring (lexicon, energy, laughs) still work, because embeddings and keyword matching are *discriminative, not generative*. All "install a model" nudges are suppressed - a user who opted out is never nagged.
- **Local models only** (`local_only`, the default) - on-device language models are allowed. Nothing you record leaves the machine.

- **Code:** config `ai_privacy_mode`; `resolve_ai_permissions(config) -> AiPermissions(allow_llm)` in `config.py`. Enforced in `make_client` (returns `NullLLMClient` when generative AI is off), `check_llm_available`, `check_vision_available` / `describe_frames`, `LLMScorer.is_available`, and (transitively) the similarity `llm` backend. UI: the AI privacy radios at the top of Settings → LLM scoring and the first-run setup wizard.
- **Do not call it:** "privacy toggle" (it's one 2-level control, not an on/off) - use the exact labels above; they are the trust surface.
- **Notes:** Fails safe - an unknown/garbage value resolves to Local models only (generative AI on). `llm_enabled` (Enable LLM scoring) is a separate feature toggle; either one independently forces the LLM off. A remote/hosted backend (Claude) and its `remote_ok` mode were removed - YuuClip is deliberately local-only (see `docs/project/DECISIONS.md`).

---

### LLM Scoring

Scoring and description generation performed by a local language model that reads the clip's transcript.

- **Code:** `LLMScorer`, `llm_score()`
- **Also called:** "AI scoring"
- **Do not call it:** "AI scoring" - LLM is the accurate term; use it to build the habit of distinguishing LLMs from "AI" broadly
- **Notes:** Uses the bundled local llama.cpp engine (the only backend - all inference is on-device). Gracefully skipped if no model is configured.

---

### Recommended models

The curated list of text and vision models YuuClip suggests for the LLM backend, shown in Settings → LLM scoring and the setup wizard. Every recommended model carries a licence that permits monetizing the clips it helps produce (Apache-2.0 / MIT / BSD-3-Clause). Llama- and Gemma-licensed models are excluded from the list because their terms impose use restrictions - they still work if configured by hand.

- **Code:** `yuu_clip/model_catalog.py` (`ModelEntry`, `recommended_models()`, `text_models()`, `vision_models()`, `catalog_for_backend()`); route `GET /api/llm/catalog`
- **Also called in codebase:** "model catalog"
- **Notes:** A static, hand-maintained list (pattern: `export/presets.py`), not a live registry. Licences are re-verified against the model cards when the list changes.

---

### Model readiness

The at-a-glance indicator in Settings → LLM scoring showing whether the active model can score **text** and analyze **images** right now, with a plain-English reason. Backs the rule that a control needing a capability the model lacks explains why and links to the fix rather than silently disabling itself.

- **Code:** route `GET /api/llm/capabilities` → `{backend, model, text, vision, detail}`; `gateOnCapability()` in `settings.js`
- **Notes:** A cheap static check (model file exists / set) - no test inference call. Vision on the local `llamacpp` backend needs a **vision model** file (`llm_vision_model_path`) and a **vision projector** file (`llm_mmproj_path`, an mmproj `.gguf`) - both independent of the **text model** (`llm_model_path`) used for scoring. No implicit fallback between the two; a single VL model doing both needs both paths pointed at the same file.

---

### Text model / Vision model

The two independent local-model buckets on the `llamacpp` backend (Settings → LLM scoring, restructured into matching UI groups). **Text model** scores clips and writes descriptions/summaries. **Vision model** (paired with the vision projector) powers [[Image analysis]]. Downloading or selecting one never writes into the other's config field - this replaced a single shared field that a vision-model download used to silently clobber.

- **Code:** `llm_model_path` (text) vs `llm_vision_model_path` + `llm_mmproj_path` (vision), `yuu_clip/config.py`.
- **Notes:** No migration for configs written before this split - a config with a vision model in `llm_model_path` stays broken until the user re-selects it under the new Vision model group.

---

### Image analysis

User-facing: **"Analyze frames"** / **"What's on screen"**. Optional, off by default: sample a few frames evenly across a clip, send them to a vision model, and store a short factual "what's on screen" summary (the game/scene, on-screen events, HUD/popups). The summary enriches the clip's descriptions and is added to the text scorer's prompt as a *Visual context* block - it never scores the clip directly. Triggered manually per clip ("Analyze frames" button) or via an "Include frame analysis" checkbox in the batch Re-score flow; never automatic during Analyze.

- **Code:** `analyze/frames.py` (`sample_clip_frames`, `resolve_frame_window`, `sample_and_describe`); `scoring/llm.py` (`describe_frames`, `check_vision_available`, `_visual_block`); `LLMClient.chat_vision` + `VisionNotSupportedError` in `scoring/llm_client.py`; route `POST /api/clips/{id}/analyze-frames` and `?include_frames=1` on rescore-clips; config `vision_enabled` (master switch), `vision_frames_per_clip` (1–10), `llm_vision_model_path` + `llm_mmproj_path` (see [[Text model / Vision model]]). DB: `clip_candidates.vision_summary` / `vision_analyzed_at`.
- **Notes:** The instruction is a plain-text user prompt (not JSON) - small local vision models reliably follow "describe this" but return coordinates/empty for a JSON-schema system prompt. Frames come from the fresh 720p proxy when present (parent-keyed timeline, segment offset added).

---

### Audio Energy Scoring

Scoring based on how loud and active the audio was during a clip window.

- **Code:** `EnergyScorer`, `AudioEnergy`
- **Also called in codebase:** "energy scoring", "RMS scoring"
- **Notes:** Clips with energy above the session's baseline score higher on Action.

---

### Scene Scoring

Scoring based on how many visual scene cuts occur within a clip window.

- **Code:** `SceneScorer` (code name for `SceneCutScorer`), `SceneBoundary`
- **Notes:** More cuts per minute → higher [Visual](#visual) score. As of the video-heavy analysis work, scene cuts feed the Visual axis, **not** Action (Action is now a purely narrative axis). Boundaries are detected once per recording.

---

### Lexicon Scoring

Scoring based on the density of curated marker phrases in a clip's transcript - a zero-dependency signal that works with no language model installed.

- **Code:** `LexiconScorer` (`scoring/lexicon.py`), config `scorer_lexicon_enabled` / `scorer_lexicon_weight`
- **UI label:** "Lexicon" (Settings → Scoring weights → Signal weights)
- **Notes:** Genre-neutral, editable word lists per dimension (laughter/absurdity → Funny, confrontation/emotion → Dramatic, urgency/combat/profanity intensity → Action). Marker density is normalised per minute to a 0–1 score; a dimension with no markers contributes nothing (returns no opinion), so it never drags a dimension's average down. Feeds the standard dimensions, so [Content type](#content-type) presets tune it through the dimension weights.

---

### Clip Description

A plain-English summary of what happens in a clip, generated by AI.

- **Code:** `description` (one-liner ≤ 20 words), `description_long` (paragraph)
- **Also called:** "one-liner", "clip summary"
- **UI label:** shown prominently in clip detail view
- **Notes:** AI-generated. Creator edits are stored separately (`description_user`, `description_long_user`) and take precedence everywhere. When no language model is available, the one-liner falls back to a **Basic description** (below).

---

### Basic description

The non-LLM template one-liner filled in when a clip is scored without a language
model, so a clip is never left blank. Built from data already on the clip - the
speaker names in its transcript, its top keywords, and its leading score dimension
(e.g. `"Yuu & Alex - heist, getaway · high action"`).

- **Code:** `desc_basic` tag on the clip; `scoring/describe_basic.py`
- **UI label:** a "Basic description" chip under the one-liner, inviting the user to
  install a local model for richer AI descriptions
- **Notes:** Always superseded by an LLM [Clip Description](#clip-description) or a
  creator edit - the tag is dropped the moment a real description replaces it. The
  long description is left empty (a paragraph is what an LLM adds).

---

### Lightweight mode

The framing for running YuuClip with **no language model installed** - the default,
fully-working state, not a degraded one. Transcription, audio-energy/scene/laugh/lexicon
scoring, [Basic descriptions](#basic-description), and keyword [Similarity
engine](#similarity-engine) all run with zero extra downloads. Installing a local model
is an *upgrade* (richer AI descriptions, summaries, the [Session
Timeline](#session-timeline)), never a prerequisite.

- **Code:** surfaced by `GET /api/capabilities/tiers` (`lightweight` flag = LLM text
  tier not active); `web/routes/llm.py`
- **UI label:** "lightweight mode" - the Getting Started (first-run) note and the
  **Settings → Capabilities** overview, one row per upgrade tier (Similarity,
  Descriptions & summaries, Audio-event detection) with its active tier + install guidance
- **Notes:** Copy framing only, not a config value. Distinct from a future no-ML
  "Signal-only" mode and from the planned AI privacy mode (which *chooses* what may run);
  lightweight mode is simply "nothing installed yet, everything works."

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
- **Notes:** Useful for navigating long sessions. Not the same as a video-editing timeline - see [Disambiguation](#disambiguation).

---

## World Contexts

### World Context

A named bundle of information about the setting, the people involved, and any notes - used to help the AI scorer understand what's happening (works for any content: RP, competitive, podcast, etc.).

- **Code:** `rp_context`, `Context` (code name predates the rename; kept for compatibility)
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
  Also the code name for a [Hot-word](#hot-word) / [Sensitive Terms](#sensitive-terms)
  entry's scope - see [Global vs context-scoped term](#global-vs-context-scoped-term).

---

### Global vs context-scoped term

A [Hot-word](#hot-word) or [Sensitive Terms](#sensitive-terms) entry is either **global**
(applies to every recording, as it always did) or **context-scoped** (applies only to a
recording tagged with that [World context](#world-context)). A Fantasy-RP session can bias
toward "Thornwood" while a shooter session biases toward "ace", without the two lists
polluting each other.

- **Code:** `context_slug` column on `hot_words` / `sensitive_terms` (NULL = global);
  the merge filter is `scoring/term_scope.py::terms_for_video`
- **UI label:** the per-row scope selector reads **"Global (all recordings)"** or the
  context's display name; the Settings list groups entries under those headings
- **Notes:** A term counts for a recording when its `context_slug` is NULL, or is in the
  recording's `context_names_json`. A term whose context was deleted becomes **orphaned** -
  shown under a "Removed context" heading and inert in scoring, never auto-deleted.

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
- **Notes:** Fast (seconds). The clip may start/end up to ~1 second off the exact requested time - acceptable for most uses.

---

### Export Preset

A named recipe of container/resolution/bitrate settings a creator picks instead
of exporting at original quality - e.g. to fit a platform's upload limits.

- **Code:** `ExportPreset` (`yuu_clip/export/presets.py`), `export_presets` (custom
  presets, stored in global config - they're a user preference, not project data)
- **Built-ins:** "YouTube 1080p" (`youtube-1080p`), "Discord (≤10 MB)"
  (`discord-10mb`), and "TikTok / Shorts (9:16)" (`tiktok-9x16`) - always
  available, not editable
- **UI label:** "Export preset" dropdown in the export options; "Original quality"
  for the presetless default; custom-preset editor in Settings → Export
- **Do not call it:** "profile" - collides with **Track Layout**
- **Notes:** A preset export always re-encodes (no Quick Export path). A vertical
  preset (`vertical=true`) additionally crops to 9:16 - see **Vertical framing**.

---

### Vertical framing

The horizontal position of the 9:16 crop used by a vertical (TikTok / Shorts)
Export preset - a property of the clip, reused across vertical exports. Stored as
a 0–1 fraction: 0 = left edge flush, 0.5 = center, 1 = right edge flush.

- **Code:** `ClipCandidate.crop_x` (nullable REAL; NULL = center),
  `ExportPreset.vertical` (bool)
- **UI label:** "Vertical framing" - Left / Center / Right + slider, shown in the
  export options only when a vertical preset is selected. "Auto-frame on faces"
  (optional MediaPipe face detection - `POST /api/clips/{id}/suggest-framing`)
  suggests the position; the creator still confirms it.
- **Do not call it:** "crop position" or "pan" in UI copy
- **Notes:** A source already narrower than 9:16 is letterboxed, never cropped past
  its own width - a vertical export never fails on aspect ratio. Auto-framing is a
  static position per clip (median face center across sampled frames), not
  per-frame panning; MediaPipe (Apache-2.0) is installed on demand from Settings.

---

### Format

One of a clip's exported files - the per-preset counterpart to a plain **Export**.
A clip can have several formats at once (e.g. an original-quality export plus a
Discord-sized one); re-exporting the same Export preset replaces that format's
file, a different preset adds another.

- **Code:** `ClipExport` (`clip_exports` table - one row per clip + preset_name)
- **UI label:** one row per format in the clip detail's Export section (preset
  label, container, size, date) with per-row Download / Show in folder / Copy
  path / Regenerate / Delete; "Exported ×2" on the sidebar pill when a clip has
  more than one format
- **Notes:** The original one-row-per-clip export columns
  (`exported_at`/`exported_container`/`exported_burn_subs`/…) stay in place
  alongside this table for now (they still drive the sidebar pill and aggregate
  "exported" counts) - retiring them is a separate follow-up.

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
- **Do not call it:** "subtitles" in user-facing text - "captions" is more familiar to creators
- **Variants:**
  - **Sidecar captions** - separate `.srt` file alongside the video
  - **Baked-in captions** - captions composited into the video itself (requires Precise Export)

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
  group) - fields "Caption font", "Caption size", "Caption position"
- **Notes:** Applies to **burned-in captions only** - embedded caption tracks and
  sidecar `.srt` files are styled by the player, not here. Empty font / zero size /
  "bottom" position all mean the renderer default and add no `force_style`, so
  existing exports are unchanged until a field is set. Per-speaker colours are
  never overridden (they arrive as inline `<font color>` tags in the SRT and keep
  winning) - colour is deliberately not a caption-style option.

#### Word highlight

An optional **Caption Style** extension (off by default): instead of a static
whole-sentence caption, a few words show on screen at a time with the
currently-spoken word tinted in a per-speaker highlight colour (the "TikTok/CapCut"
look). Opt-in per clip export and as a Settings default, independent of the
highlight reel's own toggle.

- **Code:** config `caption_word_highlight` (bool) + `caption_word_chunk_size`
  (int, words on screen); `CaptionStyle.word_highlight` / `word_chunk_size`;
  rendered as one ASS `Dialogue` event per word by `lines_to_ass()`
  (`yuu_clip/subtitles.py`), replacing the SRT burn-in path when on. Per-word
  timings come from Whisper word timestamps (`TranscriptSegment.words_json`) and,
  for edited captions, forced alignment (`yuu_clip/transcribe/align.py`).
- **UI label:** "Word highlight" checkbox + "Words on screen" count.
- **Notes:** Burned-in captions only (an embedded soft-subtitle track can't carry
  the per-word overrides). English-only for **edited** captions (forced alignment
  uses an English acoustic model); a line with no per-word data falls back to a
  static caption. Highlight colour is derived from each speaker's colour, not a
  separate picker.

---

### Clip export editor

A full-panel editor opened before final export that ties **Trim**, **Vertical
framing**, and **Caption Style** together over a live preview of the clip: drag
the trim boundaries from the transcript (with ~30 s of neighboring context you can
extend into), position the 9:16 crop box by dragging it over the frame, and see a
live caption overlay - then export from the same panel. It adds no new encode path;
Export runs the same single-clip export as the plain Export dialog after writing
the chosen `start_offset`/`end_offset`/`crop_x`.

- **Code:** `yuu_clip/web/static/library/exporteditor.js` (`openExportEditor`);
  `GET /api/clips/{id}/context-transcript` supplies the neighboring transcript
- **UI label:** "Edit & export" (button in the clip detail's Export section)
- **Do not call it:** "trim editor" or "crop editor" - it is all three at once
- **Notes:** The caption overlay is a **preview approximation** (a JS overlay, not
  libass-exact) and is labelled as such in the panel. The plain Export dialog stays
  for quick exports. The panel embeds its own inline preview `<video>` (it never
  relies on the main player, which the panel covers).

---

### Highlight Reel

A compiled video assembled from multiple approved clips, with optional transitions and title cards.

- **Code:** `demo_reel`, `build_reel()`
- **Also called in codebase:** "demo reel", "compilation"
- **Do not call it:** "demo reel" in user-facing text - "highlight reel" is more creator-natural
- **UI label:** "Highlight Reel" (header button) / "View Highlight Reels" (hamburger) / "Highlight Reels" (viewer modal title)

---

### Title Card

A brief text overlay that appears between clips in a highlight reel, identifying
what the next clip contains - also usable on a single clip export.

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
  Description** (the edited version, if the creator changed it) - never the raw
  AI text once overridden.

---

### Stale Export

A previously exported artifact (clip file or highlight reel) no longer reflects the clip's
current captions, clip window (trim), or description - the source changed after the last
export/build, so the file on disk is out of date. Distinct from the "Last Scored With"
staleness warning above, which is about scores/descriptions vs. world contexts, not files.

- **Code:** `export_stale`, `export_stale_reasons`, `ClipCandidate.trim_edited_at`,
  `ClipCandidate.description_edited_at`
- **UI label:** "Stale - re-export to update" badge on the export status pill; "Stale -
  rebuild to update" on a highlight reel row
- **Notes:** Cheap text artifacts (transcript excerpt, SRT sidecar) auto-refresh instead of
  going stale. Only expensive encoded artifacts (the exported video file, a highlight reel)
  show a stale badge - they are never silently rebuilt. A plain-cut export is not marked
  stale by a caption edit alone, since the raw video is unaffected; it is stale when
  captions are baked/embedded, when the trim window changed, or (for a title-card export)
  when the description changed.

---

### Stale Captions File

A recording's whole-file SRT sidecar (written on demand by "Save Captions to SRT",
next to the source recording) no longer reflects the app's current transcript - a
caption edit, speaker rename/reassignment, or name-correction landed after the file
was last written. Distinct from Stale Export above: that is a per-clip *encoded*
artifact tracked by a DB timestamp; this is a whole-recording *plain-text* file with
no export record at all, so staleness is decided by comparing the transcript's last-edit
timestamp against the sidecar file's own on-disk mtime, not a stored "last written" field.

- **Code:** `Video.transcript_edited_at`, `transcript_srt_stale` (`routes/videos.py::_transcript_srt_stale`)
- **UI label:** "Transcript edited since the saved captions file was written" note next
  to "Save Captions to SRT" in the recording's Full Transcript card
- **Notes:** Bumped by the same four routes as the per-clip `ClipCandidate.transcript_edited_at`
  (caption edit, speaker rename, transcript-segment speaker reassignment, name-corrections
  apply). Comparing against the file's mtime (rather than a stored export timestamp) also
  catches a pre-existing sidecar SRT that predates any in-app edit, not just one this app
  wrote itself.

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

The main panel showing all information about the selected clip - description, scores, transcript, and controls.

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
  property) - never a hardcoded hex/rgba literal. Enforced by
  `tests/test_ui_theme.py`. Each theme must keep WCAG AA contrast; the same
  test file checks the token pairs per theme.

---

### Accent colour

The highlight colour (buttons, links, selected items), chosen in Settings → UI
independently of the base **Theme**. Eight variants ship: **Default** (cyan),
**Red**, **Orange**, **Yellow**, **Green**, **Blue**, **Purple**, and **Pink**.

- **Code:** `data-accent` attribute on `<html>`; per-theme accent blocks in
  `shared/tokens.css` (`html[data-accent="blue"]` plus theme-scoped overrides
  overriding the accent-family tokens `--accent`, `--accent-text`, `--accent2`,
  `--on-accent`, plus a small `--bg` tint toward `--accent` via `color-mix()`);
  `applyAccent()` in `settings.js`; localStorage key `yuuclip-accent`; parallel
  `ACCENTS` list in `tests/ui/test_ui_theme.py`
- **Do not call it:** "theme" (it is orthogonal to the theme - a second, separate
  choice)
- **Notes:** Because one accent value cannot clear WCAG AA on both dark and light
  surfaces, each accent variant is tuned per base theme. Every (theme, accent)
  combination is contrast-checked in `tests/ui/test_ui_theme.py`.

---

### Colour picker

The shared control for choosing a colour (speaker caption colour; title-card
background/text colours). A swatch trigger opens a popover with hex entry, a
recently-used strip, starter swatches, and a user-curated named palette.

- **Code:** `colorpicker.js` (`ColorPicker.attach`); progressive-enhances a
  hex-valued `<input>` into a hidden value-store; localStorage keys
  `yuuclip-color-recent`, `yuuclip-color-palette`. Tests:
  `tests/test_ui_colorpicker.py`
- **Notes:** Replaced the native `<input type="color">` at all three sites. The
  picker chrome uses theme tokens; only the picked/data colours (swatch fills)
  are inline literals, which `tests/test_ui_theme.py` allowlists.

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
- **Do not call it:** "proxy" alone in user-facing text - the on-screen badge reads
  **"Preview quality (720p)"**; the fallback badge reads **"Original quality"**
- **Notes:** Built opportunistically during analysis and on demand (with progress)
  the first time a recording without one is scrubbed. Generated with NVIDIA NVENC
  when available, else CPU libx264. One proxy per source file - shared by a split
  recording and all its segments. Full quality is always used for **export**; the
  proxy is a playback convenience only.

---

## Disambiguation

These terms are used with multiple meanings in the codebase or everyday speech. Always use the qualified form when context is ambiguous.

| Term | Meaning A | Meaning B | Rule |
|------|-----------|-----------|------|
| **Session** | A gameplay period ("last night's session") | SQLAlchemy DB session object | Use "recording" for the file; "session" only for the gameplay period; "DB session" for SQLAlchemy - never expose the latter to creators |
| **Segment** | Caption segment (a timed Whisper output unit) | Clip window (a generated highlight candidate) | Use **"caption segment"** for Whisper output; **"clip"** or **"clip window"** for generated candidates; never bare "segment" |
| **Score** | A numeric rating (noun) | To evaluate a clip (verb) | Both valid; rely on context |
| **Timeline** | Video-editing timeline (common meaning) | Session timeline (AI 15-min chunk descriptions) | Always say **"session timeline"** for the AI feature; avoid bare "timeline" in UI labels |
| **Context** | World context (RP game info) | Python/FastAPI execution context | Use **"world context"** in user-facing text; reserve bare "context" for code |
| **Speaker** | A diarized voice in a recording | - | A **Speaker** is a voice; a **Character** is a world-context lore entity. Don't use them interchangeably; never expose the raw `SPEAKER_00` label |
| **Export** | Save a single clip to a file | Build a highlight reel | Use **"export clip"** for the single-clip action; **"build reel"** for compilations |
| **Profile** | Track layout (saved audio assignments) | User/app profile (does not exist here) | Always say **"track layout"**; retire bare "profile" from the UI |
| **Model** | Speech-to-text model (Whisper) | AI scoring model (LLM) | Qualify as **"speech-to-text model"** / **"AI model"**; never bare "model" in user-facing text |

---

## Internal / Dev-Only Terms

These appear in code but should not appear in the UI or creator-facing documentation. Use the user-facing equivalent instead.

| Internal term | User-facing equivalent |
|--------------|----------------------|
| `ClipCandidate`, "clip candidate" | Clip |
| `RecordingSession`, `session_id` | Session |
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
| `voiceprint` (embedding) | *(internal - never user-facing)* |
| `RMS`, `rms_db`, `baseline_db` | *(internal)* |
| `score_funny`, `score_dramatic`, `score_action` | Funny / Dramatic / Action score |
| `description_user`, `description_long_user` | *(internal storage detail - just "description")* |
| `do_transcribe`, `do_score` | *(internal flags)* |
| `hard_split_ms`, `silence_threshold_ms` | *(internal config)* |
