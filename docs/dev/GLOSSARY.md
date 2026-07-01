# yuu-clip — Glossary / Ubiquitous Language

This file defines the authoritative term for every concept in yuu-clip. Use these terms consistently in code, UI labels, docs, and conversation. When a term here conflicts with what is currently in the code or UI, the code/UI should eventually be updated — not this file.

> **Keep the user-facing copy in sync.** The in-app "Terminology Glossary" modal is served from `yuu_clip/web/static/glossary.md` — a hand-written, creator-facing subset of this file (no `Code:`, no dev-only sections). When you add or rename a user-facing term here, update that file too.

Two design principles drove the choices below:
- **Creator-first naming** — terminology should make sense to a content creator, not require a developer background.
- **One term per concept** — when the codebase uses multiple names for the same thing, only one of them is correct.

---

## Source Material

### Recording

A video file containing a gaming session — the primary input to yuu-clip.

- **Code:** `video`, `video_path`
- **Also called in codebase:** "video", "source file"
- **Do not call it:** "session" (that's the gameplay period, not the file)
- **UI label:** listed in the Sessions panel

---

### Session

The gameplay period captured in a recording — e.g., "last night's FiveM session."

- **Also called:** gaming session, gameplay session
- **Do not confuse with:** SQLAlchemy `Session` object (dev-only; never user-facing) — see [Disambiguation](#disambiguation)
- **UI label:** "Sessions" (sidebar panel heading)

---

### Duration

How long a recording or clip runs.

- **Code:** `duration_ms` (internal milliseconds), `duration_hms` (display string)
- **Display format:** `1h 23m 45s` or `23m 45s` — never raw milliseconds in the UI

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
- **Also called:** "Whisper model", "transcription model"
- **Do not call it:** just "model" — ambiguous with the AI scoring model

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

### Voiceprint

The internal voice embedding that lets a **Speaker** be re-identified across diarization runs.

- **Code:** `Speaker.voiceprint`
- **Notes:** Dev-only — never shown or named in the UI. Its effect is described to creators in plain language ("names stick even if you re-analyze").

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

### LLM Scoring

Scoring and description generation performed by a local language model that reads the clip's transcript.

- **Code:** `LLMScorer`, `llm_score()`
- **Also called:** "AI scoring"
- **Do not call it:** "AI scoring" — LLM is the accurate term; use it to build the habit of distinguishing LLMs from "AI" broadly
- **Notes:** Requires Ollama running locally. Gracefully skipped if unavailable.

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

### Highlight Reel

A compiled video assembled from multiple approved clips, with optional transitions and title cards.

- **Code:** `demo_reel`, `build_reel()`
- **Also called in codebase:** "demo reel", "compilation"
- **Do not call it:** "demo reel" in user-facing text — "highlight reel" is more creator-natural
- **UI label:** "Highlight Reel" (header button) / "View Highlight Reels" (hamburger) / "Highlight Reels" (viewer modal title)

---

### Title Card

A brief text overlay that appears between clips in a highlight reel, identifying what the next clip contains.

- **Code:** `title_card`, `title_dur`
- **UI label:** "Title cards" option in reel builder

---

## UI & Review Concepts

### Sessions Panel

The top section of the left sidebar listing all ingested recordings.

- **UI label:** top half of left sidebar

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

## Configuration

### Project Folder

The hidden directory `.yuu-clip/` created inside the folder containing the recording. Holds the database, extracted audio, and exported clips.

- **Code:** `project_dir`, `project_root`
- **Notes:** Transparent to the creator unless they go looking. All per-recording state lives here.

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
