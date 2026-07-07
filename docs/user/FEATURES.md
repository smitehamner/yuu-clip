# yuu-clip — Implemented Features

## Web UI

### Layout

- **Sidebar left pane** — recordings list with per-recording clip count, approved count, exported count, score range bar, and clipped time. Has its own search box (title/filename), sort dropdown (Recent / Title / Filename / Length / Clips — persisted), and filter chips (Has clips / Unscored / Errors)
- **Sidebar right pane** — clip list for the selected recording; sortable by Overall / Funny / Dramatic / Action / Laughs score, Length, or Timeline (chronological). Sorting by Laughs puts clips with no laugh measurement last.
- **Main panel** — detail view for the selected video or clip, plus video player
- **Header** — global action buttons and live job status (step pills + cancel button)
- **Project switcher** — the current project name (top-left) is a dropdown: pick a recent project or "Open another project…" to point at any folder. yuu-clip switches without a restart and reloads; a brand-new folder starts a fresh, empty project. Blocked while analysis or another job is running.
- **Log panel** — collapsible; streams live job output; download button for the full log file

### Video management

- **Select a recording** — click in the sidebar to load its detail view
- **Remove a recording** — Additional Actions → Remove Recording deletes the database record; the source file is untouched
- **Video detail view** shows: title, duration, clip/approval counts, total clipped time, and assigned world contexts

### Contexts on a video

- **Add / remove context chips** directly on the video detail view
- A warning appears if clips were last scored with different contexts than currently assigned
- **Re-score with context** button triggers LLM re-scoring using current contexts

### Video-level LLM features

- **Generate Summary** — sends the full transcript to the configured LLM; returns a title and a paragraph summary of the session
- **Generate Timeline** — streams an LLM-generated timeline in 15-minute chunks, describing key events in each window

### Manual clip creation

- **"+ New clip"** above the clip list, or **"Create clip"** on a recording's Full transcript
  card — both open a picker panel over the detail view
- Click a transcript line to set the clip's start, then a later line (or the same line again,
  for a 1-line clip) to set the end; clicking an earlier line resets the start. `h:mm:ss` /
  `m:ss` time inputs stay in sync and also cover recordings with no transcript yet
- **Play selection** previews the picked range on the recording's own preview player
- Confirming creates the clip, selects it, and immediately runs the same LLM scoring as any
  other clip — there's no separate "manual, unscored" state

### Clip review

Each clip detail view shows:

- **Score bars** (0–1 scale): Overall, Funny, Dramatic, Action, and Laughs — shown once the clip has been scored; a clip that hasn't been scored yet (e.g. a failed analysis run) shows "Not yet scored" instead of a misleading 0%. The Laughs bar only appears when laughter was actually measured for the clip (see the Laughs score section)
- **One-liner description** and **long description** (paragraph)
- **What's on screen** (image analysis) — on by default (Settings → LLM scoring → Image analysis), but stays inactive until you download a vision-capable model (moondream2 is the recommended default). Once ready, each clip gets an **Analyze frames** button that samples a few frames from the clip and asks the vision model to describe what's on screen (the game/scene, on-screen events, HUD or text). The summary shows in a "What's on screen" card and is added to the scorer's prompt as visual context — it never sets the score by itself. You choose how many frames to sample (1–10). You can also tick **Include frame analysis** when re-scoring a whole recording. It's never run automatically during analysis, since it adds time per clip
- **Tags**: auto-generated labels such as `llm_scored`, `energy_scored`, `long_silence_after`
- **Transcript excerpt** in a monospace box
- **Timed transcript** — a per-line view (grouped by speaker when diarized) where each line has a ▶ to jump the player to that moment. Click any line to **edit its caption text** in place — fix a mis-heard character name or piece of jargon, press Save (Enter), and the change is written back to the caption segment. Editing a caption rebuilds the excerpt of every clip that overlaps it; clips that were already scored show a **"Captions edited since last scoring"** notice with a Re-score shortcut so their scores and descriptions can be refreshed against the corrected text. The same editable view appears under **Full transcript** on the recording detail.
- **Fix names** — a button on the recording's transcript card scans the whole transcript for likely mis-heard names (Whisper writing "You" when someone said "Yuu"), using the names you've given your speakers plus any characters listed in the recording's world contexts. Matches are grouped by pattern ("You → Yuu · 91 instances") with the surrounding line shown for each; review and uncheck any that aren't really a name, then Apply. Nothing changes until you press Apply, and each fix flows through the same path as a manual caption edit (so overlapping clips are marked for re-scoring). A speaker's own lines are skipped when matching their own name, and lines with no known speaker are marked "speaker unknown".
- **Status buttons**: Approve / Reject / Reset (unreviewed)
- **Clip search** — text input above the filter chips; searches description, long description, transcript excerpt, and your tags (case-insensitive). Composes with the chip and score filters.
- **Filter chips** — multi-select chips that combine: status (Unreviewed / Approved / Rejected), Exported / Not exported (mutually exclusive), and Score error. "All" clears every chip.
- **Minimum score filter** — dropdown (Any / 0.3+ / 0.5+ / 0.7+ / 0.9+) that hides clips below the selected overall score threshold. Composes with the search and chip filters.

Actions available per clip: **Approve** / **Reject** and **Export** sit directly on the clip
detail panel; everything else is grouped behind an **Additional Actions** button (Review /
Regenerate / Files sections in the modal it opens):

| Action | What it does |
|--------|-------------|
| Retranscribe | Re-runs Whisper on this clip's time window; shows model selector |
| Re-score | Sends clip to the configured LLM backend with current context |
| Override / Remove Override Score | Manually set the overall score, or discard the override and go back to the generated score |
| Find Similar | Searches other recordings for clips with a similar description |
| Mark Unreviewed | Clears an Approve/Reject status (only shown once a clip has one) |
| Merge previous / next | Combines this clip with an adjacent one (only shown when a neighbor exists) |
| Download Export / Delete Export | Save the exported file, or delete it while keeping the clip record |
| Delete Clip | Removes the clip record and any exported file |

The same **Additional Actions** pattern is used on the video detail view for less-common actions
like **Re-analyze (full)** and **Re-detect Speakers** (see "Re-analyzing a recording" below).

**Bulk actions** — each clip row has a checkbox; checking any shows a toolbar above the list with Approve / Reject / Export / Delete buttons that act on every checked clip currently visible under the active search/status/score filter. Bulk delete asks for confirmation first. Bulk export warns if any selected clip's captions were edited since it was last scored, letting you re-score first or export anyway. Bulk Approve/Reject shows an **Undo** toast, same as single-clip status changes — since clips can have had different statuses before the bulk action, each clip reverts to its own previous status. `Ctrl`/`Cmd`+`Z` also undoes the most recent status change, single or bulk.

### Video player

Embedded HTML5 player shown in the clip detail panel. Before export, the player streams a preview directly from the source file via FFmpeg (seekable; LRU-cached temp files). After export it plays the exported file and shows WebVTT subtitles if an SRT sidecar exists. Auto-plays on clip selection.

### Preview quality (720p proxy)

Long recordings are multi-hour files the browser can't scrub smoothly, so the preview player plays a cached **720p** copy of the recording instead. It's built automatically during analysis (NVIDIA GPU when available, otherwise CPU) and, if a recording doesn't have one yet, the first time you open its Split Editor — with a progress badge while it builds. A **"Preview quality (720p)"** badge shows whenever you're watching the smaller copy (vs "Original quality"); the clip preview badge shows a "720p" marker too. Exported clips always use the full-quality original.

### New Recording panel

Open with the `+ Analyze` button in the header. Replaces the old modal with a full panel that keeps the sidebar live.

1. Click **Browse…** to pick a video file (native OS file picker), or paste a path; the file is inspected immediately — shows stream table and time estimate
2. Optionally split the recording into segments before analysis (place markers on the waveform)
3. Select a track layout (optional)
4. After inspection, a **Captions** select lets you skip Whisper: it lists any detected SRT sidecar or embedded caption stream, plus a "Choose SRT file…" option that opens the native picker for an external SRT
5. Check world contexts to assign (optional)
6. Expand **Advanced Options** to change Whisper model, scene mode, or energy mode — all three are pre-filled from the Settings analysis defaults and act as per-run overrides
7. **Start** button launches the analysis subprocess; progress appears in the header step pills

Time estimate panel breaks down expected wall-clock cost per step and warns if any step exceeds 30 minutes. Clicking another video while the panel is open prompts to discard if a path has been entered.

### Job progress indicator

Step pills in the header: Extract → Transcribe → Generate Clips → Energy → Scenes → Score. Each pill is gray (pending) → blue (active) → green (done). A cancel button is visible during analysis; it terminates the subprocess and marks the job cancelled.

### Track layout manager

Accessible via the Manage Layouts button in the New Recording panel.

- Lists built-in and custom track layouts with track count
- **Layout editor**: name, number of tracks (1–8), and per-track settings (label, transcribe flag, relevance weight)
- Saved track layouts are available in the New Recording panel dropdown

### Recording segments (split editor)

A recording can be split into independent segments before or after analysis.

- **Before analysis**: toggle in New Recording panel after probe; place markers on the waveform; analysis runs sequentially on each segment
- **After analysis**: "Split Recording" button opens the full-panel split editor with three choices:
  - **Split only** — keeps every existing clip, redistributing each one (and its transcript lines) to whichever segment contains its start time; a clip that straddles a split point keeps its full length and is owned by the segment it starts in
  - **Re-analyze** — deletes all clips and runs analysis fresh on each segment
  - **Re-analyze but keep exported clips** — deletes only clips that were never exported, then re-analyzes
- Markers are dragged to move and removed with the × button that appears on hover; in the full editor, clicking a marker jumps the preview there
- A legend under the timeline names the overlays (split points, suggested splits, scene cuts, existing clips, segments)
- Re-analyze choices confirm their consequence first ("deletes N clips…") and reuse the original run's analysis settings (model, track layout, scene/energy mode, speaker labels, world contexts) — falling back to Settings defaults
- Waveform is generated on demand from per-second RMS energy data
- Segments appear in the sidebar as normal video entries; the parent is hidden once split
- Each segment has its own clips and full transcript (after Split only) or its own freshly analyzed clips, contexts, title, summary, and timeline (after Re-analyze)
- **Undo Split** (Additional Actions, on any segment) merges every sibling segment's clips back onto the parent recording — restoring their original absolute timing — deletes the segments, and makes the parent visible again

### Sessions (multi-recording grouping)

When one sitting of gameplay spans several recordings (OBS splitting a long session into multiple files), group them into a single **Session** with a unified view.

- **Group** (Recordings sidebar) enters a selection mode — tick 2+ top-level recordings and name the session
- **Suggest sessions** auto-detects recordings recorded back-to-back (a gap under 30 minutes between one ending and the next starting, read from the OBS filename timestamp or the file's modified time) and proposes groups; each can be accepted or dismissed, and dismissals are remembered so the same suggestion won't nag
- Grouped recordings appear under a **collapsible session header** in the sidebar; the session's own detail view shows a **Session Summary** rolled up from the member recordings' summaries and a **Unified Timeline** — one continuous time axis across every recording, stitching each recording's existing timeline entries and clip markers, with the real-world break between files labelled (e.g. "— 12 min break —"). Clicking a timeline entry or clip jumps to that recording (and clip)
- A session can be **renamed**, have recordings **added**, or be **ungrouped (dissolved)** — dissolving only detaches the recordings; it never deletes them. Split segments are never grouped directly; they belong to a session through their parent recording

### Highlight reel builder

Accessible from the header. Choose a source (all approved clips, a specific recording, or a whole **Session** — the "Clips from" picker lists sessions under their own group), transition type and duration (including "random"), title card duration, and output filename. A session's reel spans every member recording's approved clips; the session detail view has a **Build Highlight Reel from Session** button that opens the builder pre-scoped. Ordered clip list lets you check/uncheck clips and reorder them — drag a row by its grip, or use the ▲▼ buttons. Your order and selections are kept while the window is open, even if you flip to the View tab and back. Saved reels go to `.yuu-clip/reels/` with a timestamp in the filename.

A reel is built from your **exported** clips, so any selected clip that hasn't been exported is skipped — the builder shows an **Export N clips** button to export the missing ones first. **Preview** plays the selected clips in sequence with Previous/Next controls. The **Captions** dropdown offers three choices: **None**; **Caption file** — writes an SRT alongside the reel (each clip's transcript stitched onto the reel timeline); or **Burn into video** — bakes the captions into the reel picture using the Caption style (font/size/position) from Settings → Export, keeping per-speaker colours. Burn-in re-encodes the reel and can't be undone; a caption file can be regenerated any time. In the **View** tab you can generate or regenerate the caption file for an existing reel, play it with captions, and **Delete** reels you no longer need (removes the file and its captions from disk; your clips are untouched).

### World contexts manager

Accessible from the header. Create and edit named context bundles:

| Field | Purpose |
|-------|---------|
| Context ID | Short ID used in CLI (`--context una-server`) |
| Display name | Human-readable label shown in the UI |
| Setting | World description injected into LLM prompts |
| Your player(s) | Who you play — character, handle, or role |
| Other players & NPCs | Frequent teammates, guests, opponents, or NPCs |
| Notes | Any other context for the LLM |
| LLM scoring weights | Optional per-context overrides for funny / dramatic / action weights |

Contexts are assigned per-video and injected into every LLM call for that video. When a video is rescored, any weight overrides from assigned contexts are averaged together and applied instead of the global Settings weights.

### Getting Started guide

Opens from the hamburger menu (🚀 Getting Started). Covers the four-step workflow, what each score means, key concept definitions (Track layout, World context), and quick tips.

### About / help panel

Dependency versions table and licensing notes. Open from the hamburger menu → About.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `A` | Approve the current clip (or the clip row your keyboard focus is on) |
| `R` | Reject the current clip (or the focused clip row) |
| `Space` | Play / pause video |
| `E` | Export the current clip (or the focused clip row) |
| `←` / `↑` / `K` | Previous clip |
| `→` / `↓` / `J` | Next clip |
| `Ctrl`/`Cmd`+`Z` | Undo the most recent status change (single or bulk) |
| `?` or `/` | Open the keyboard controls list |
| `Esc` | Close the topmost window |

---

## CLI commands

### `yuuclip probe <video>`
Inspects a video without analyzing it. Prints duration, resolution, FPS, and a table of all audio streams with codec, sample rate, channel count, and stream title. Useful for checking track layout before choosing a track layout.

### `yuuclip analyze <path> [options]`
Full end-to-end pipeline from raw video to scored clips.

**Options**

| Flag | Default | Notes |
|------|---------|-------|
| `--model` | `base` | Speech-to-text model: tiny (~40 MB VRAM), base (~75 MB), small (~240 MB), medium (~1.5 GB), large-v3 (~10 GB) |
| `--device` | `auto` | cuda or cpu; auto detects GPU — falls back to CPU if VRAM is insufficient for the chosen model |
| `--track-layout NAME` | — | Saved track layout to apply |
| `--language CODE` | — | Force speech-to-text language (e.g. `en`) |
| `--energy-mode` | `fast` | `none` / `fast` (4 kHz) / `full` (16 kHz) |
| `--context SLUG` | — | World context ID to attach; repeatable |
| `--no-transcribe` | — | Skip transcription step |
| `--no-segment` | — | Skip clip generation |
| `--no-score` | — | Skip scoring step |
| `--force` | — | Reprocess even if already analyzed |
| `--no-interact` | — | Never prompt (always set by web UI) |

**Pipeline stages (in order)**
1. **Inspect** — FFprobe extracts video metadata
2. **Label tracks** — Assign each audio stream a role: combined, player_voice, ingame_voicechat, game_sounds, or unlabeled
3. **Extract audio** — FFmpeg → 16-bit mono WAV at 16 kHz per track
4. **Overlap detection** — RMS correlation; suppress specialized tracks that duplicate the combined track
5. **Transcribe** — Whisper on each eligible track; suppress near-duplicate transcripts
6. **Generate clips** — Sliding-window segmentation aligned to transcript word boundaries (30–120 s windows, 15 s stride)
7. **Score** — Audio energy, scene detection, LLM scoring (see Scoring section)

**End-to-end timing — default settings (energy: fast, scene: fast, 2 audio tracks)**

Numbers below assume one transcribed track (combined). The web UI shows a live estimate for your specific file before you start.

| Video length | RTX GPU + `base` | RTX GPU + `medium` | RTX GPU + `large-v3` | CPU-only + `large-v3` |
|---|---|---|---|---|
| 30 min | ~5 min | ~6 min | ~9 min | ~1h 20min |
| 1 hour | ~9 min | ~11 min | ~18 min | ~2h 40min |
| 2.5 hours | ~23 min | ~28 min | ~45 min | ~6h 35min |

Transcription dominates for large-v3; audio extraction dominates for fast models. Approximate breakdown for a 1-hour session on GPU + `large-v3`: extract 6 min, transcribe 10 min, energy 14 s, scene 18 s, LLM scoring 1.5 min.

> **CPU note:** On CPU, `large-v3` is roughly 150× slower than an RTX GPU for transcription. Smaller models (`base`, `small`) are significantly faster on CPU but the in-app estimate uses a single conservative ratio for all models — expect the real time to be faster than shown for small/base on CPU. `medium` or larger on CPU is not practical for sessions over 30 minutes.

### `yuuclip score [<video_id>|--all] [options]`
Re-runs scoring on an already-analyzed recording. Useful after changing world contexts or the AI model. Options: `--no-energy`, `--no-scenes`, `--no-llm`.

### `yuuclip status`
Table of all analyzed recordings: filename, duration, track count, clip count, analysis status (pending → probed → labeled → extracting → transcribed → done).

### `yuuclip clips [VIDEO_NAME] [--status FILTER] [--limit N]`
Browse clips in the terminal. Filter by partial video name or status (unreviewed, approved, rejected). Shows ID, start time, duration, status, tags, and transcript excerpt.

### `yuuclip export <clip_id> [options]`
Extract a single clip to MKV.

| Flag | Notes |
|------|-------|
| `--precise` | Frame-accurate cut via libx264 (slower; default is quick export) |
| `--captions` / `--no-captions` | Write SRT caption sidecar files (default: on) |
| `--bake-captions` | Burn captions into video frames (hardsub; forces re-encode) |
| `--embed-subs` | Add captions as a subtitle track (softsub; stream copy, fast) |
| `--caption-font NAME` | Burned-in caption font (must be installed; default from config) |
| `--caption-size N` | Burned-in caption size, 12–96 (0 = renderer default) |
| `--caption-position bottom\|top` | Burned-in caption position (default from config) |
| `--container mkv\|mp4` | Override output container |
| `--output PATH` | Output path; default: `.yuu-clip/exports/` |

Output filename format: `{stem}_clip{id}_{start_hms}.mkv`

### `yuuclip retranscribe <clip_id> [options]`
Re-runs Whisper on just the clip's time window, then re-scores. Default model: large-v3. Options: `--model`, `--language`, `--no-rescore`.

### `yuuclip reel [options]`
Compiles a highlight reel from approved clips with title cards and transitions.

| Flag | Default | Notes |
|------|---------|-------|
| `--video ID` | all | Repeatable; restrict to these video IDs |
| `--top N` | all | Top N clips per video by score |
| `--min-score F` | 0.0 | Minimum overall score |
| `--status` | approved | Clip status filter |
| `--transition TYPE` | fade | fade, dissolve, wipeleft, wiperight, slideleft, slideright, none |
| `--trans-dur S` | 0.5 | Overlap in seconds |
| `--title-dur S` | 3.0 | Title card display time |
| `--output PATH` | auto | Default: `.yuu-clip/reels/reel_<timestamp>.mkv` |
| `--captions` | off | Also write a stitched `<reel>.srt` caption sidecar |
| `--bake-captions` | off | Burn captions into the reel video (also writes the sidecar); uses the configured Caption style |

### `yuuclip serve [options]`
Starts the web server and opens the browser. Options: `--host`, `--port` (default 8080), `--open`/`--no-open`, `--reload`. Preferred entry point for day-to-day use.

### `yuuclip restore --archive <backup.zip> --project <folder>`
Unpacks a backup `.zip` into a project folder. Add `--overwrite` to replace a project that already exists there (a `project.db.pre-restore` safety copy is kept). This is the command the setup wizard runs for its "Restore from a backup" choice; for day-to-day restores use Settings > Backup & Restore in the web UI, which also handles re-pointing moved source videos.

---

## Scoring

### Audio energy scorer

Computes per-second RMS loudness (dB) for each extracted audio track. Two resolution modes:

- **fast** — 4 kHz downsampled; low CPU cost
- **full** — full 16 kHz; more accurate but slower

Track relevance weights (set in the labeling profile) reduce the contribution of game_sounds tracks relative to player_voice. Energy peaks contribute primarily to `score_action`.

### Scene cut scorer

Three modes:

- **transcript-only** — uses gaps > 5 s in the transcript as scene boundaries; effectively free
- **fast** — keyframe cut detection (low FPS threshold) + transcript gaps; adds ~10–45 s regardless of hardware
- **full** — scans every frame with PySceneDetect; costs roughly 60% of the video's duration

| Video length | fast | full |
|---|---|---|
| 30 min | ~10 s | ~18 min |
| 1 hour | ~18 s | ~36 min |
| 2.5 hours | ~45 s | ~1.5 hours |

`full` mode is only worth using if you want precise visual cut boundaries — `fast` is sufficient for most sessions where cuts align naturally with transcript silences.

Scene cuts are stored as database records and influence candidate boundaries.

### Lightweight signal scorers (no model)

These run with zero extra downloads and are what makes clip scoring work in lightweight mode. Each nudges the funny / dramatic / action scores; their weights are set in Settings → Scoring weights.

- **Laughter** — detects laughter in the audio; nudges funny.
- **Lexicon** — curated keyword-density matching; nudges funny / dramatic / action.
- **Speech-rate** — words-per-second bursts; nudges funny / action.
- **Prosody** — loudness and pitch delivery dynamics; nudges dramatic / action.
- **Speaker-overlap** — rapid speaker turn-taking and cross-talk; nudges funny / action. Requires speaker detection.
- **Audio-event** *(heavy, on by default)* — gunshot / explosion / cheer detection via an AudioSet model; nudges action / funny.

Without a language model installed, these signals plus audio energy and scene cuts still rank clips; the LLM scorer below only adds written descriptions and a semantic score on top.

### LLM scorer

Sends each candidate's transcript excerpt to the configured LLM backend — a local `.gguf`
model (llama.cpp, the default), Ollama, or the Claude API, chosen in the setup wizard or Settings.
When speaker labels
are enabled (see Settings → Speaker labels), the excerpt is formatted with `SPEAKER_XX:` prefixes
so the LLM understands who said what without any extra configuration. Returns a JSON object with:

| Field | Description |
|-------|-------------|
| `description` | One-liner (< 20 words) |
| `description_long` | 3–5 sentence paragraph: what happened, who was involved, why it matters |
| `score_funny` | 0–1; jokes, absurd moments, chaotic banter |
| `score_dramatic` | 0–1; confrontations, revelations, emotional beats |
| `score_action` | 0–1; combat, chaos, high-stakes tension |

World context text is injected into the system prompt so the LLM understands who's involved and the setting. If the LLM backend is unreachable the analysis continues with zero scores and a warning in the log.

LLM scoring speed depends entirely on your LLM backend and model. Rough estimates at ~4 s/clip:

| Video length | Estimated clips | Time |
|---|---|---|
| 30 min | ~10 clips | ~40 s |
| 1 hour | ~20 clips | ~1.5 min |
| 2.5 hours | ~50 clips | ~3.5 min |

A larger or slower Ollama model multiplies these times proportionally. Running Ollama on the same GPU as Whisper is fine — they run sequentially, not simultaneously.

For the local **llama.cpp** backend, **Use GPU when available** (Settings → LLM scoring, on by default) offloads the model to your graphics card. On an NVIDIA machine the setup wizard installs a GPU build automatically, so scoring runs on the GPU with no extra steps; if the model is too large for your GPU's memory it falls back to the CPU and logs a note. Turn the setting off to force CPU.

#### Recommended models and readiness

Settings → LLM scoring lists a curated set of **recommended models** for each backend. Every recommended model is licensed so that clips you make with it can be monetized — Apache-2.0 or MIT for local models (Ollama / llama.cpp), and the Anthropic API's commercial terms for Claude. Models under Meta's Llama licence or Google's Gemma terms are deliberately **left out** of the recommendations because their use restrictions would need a case-by-case legal reading; they still work if you configure them by hand.

For Ollama, each recommended model has a one-click **Pull** button and a **Use this model** button. For a local `.gguf` file, you get a link to the model's download page. A **Model readiness** line shows whether the model you've set up can score **text** and analyze **images** right now, and explains what's missing if not (for example, a Claude API key, or — for the local llama.cpp backend — a separate *vision projector* `.gguf` file, which is what enables image analysis).

On Ollama you can also set an optional **Vision model** separate from your main model — so a strong text-only model (e.g. `qwen2.5:7b`) can handle scoring while a vision model (e.g. `qwen2.5-vl`) handles image analysis. Leave it blank to reuse the main model for both.

### Laughs score

A separate 0–1 measure of laughter density, produced by the laughter detector (transcript,
audio, or model mode — see Settings). It still contributes to the Funny score as before; the
Laughs score is an additional value you can sort and read on its own. It shows up as its own
score bar and sidebar percentage, and as a **Laughs** option in the clip sort dropdown.

Clips where laughter was never measured — anything scored before this feature existed, or clips
scored with the laughter detector turned off — have no Laughs value and simply omit it, rather
than showing a misleading 0%.

### Overall score

Weighted average of the three dimension scores. Default weight: equal. Configurable in project config.

### Content-type presets

At the top of Settings → Scoring weights, **Content type** tunes scoring for the kind of content
you make in one step. Pick one — **RP / narrative**, **Competitive gaming**, **Casual / let's
play**, **Speedrun**, **Podcast / conversation**, or the **Generic** default — and press **Apply**.
It sets the Funny / Dramatic / Action / Laughs weights to sensible values, optionally adds a few
starter hot-words for that style, and points the language model at what makes a good highlight for
it (scoring, descriptions, summaries, and timeline). You can fine-tune every weight afterwards, and
the confirm dialog spells out exactly what will change before it does. Generic is the plain default,
so applying it changes nothing. The desktop setup wizard also asks for your content type up front
(defaulting to Generic), so a new project starts with sensible weights for your style.

### Hot-words

Settings → Hot-words lets you define phrases that nudge a clip's score whenever they're spoken —
handy for running gags or catchphrases. Each entry has a phrase, a match mode, a boost amount, and
which score it affects (Overall or a sub-score):

- **Exact** / **Ignore case** — matched automatically whenever clips are scored or re-scored, at
  no extra cost. A recording's clips can also be updated without a full re-score via the
  **Rescan current recording** action offered after saving a hot-word change.
- **Meaning** — matched by concept rather than literal wording (e.g. "big win" matches a clip
  where someone describes winning without saying those exact words). Uses the **Similarity engine**
  (Settings → LLM scoring) — keyword matching by default, with optional local-embeddings or LLM
  tiers — so it works with no language model installed. Runs only when you press **Scan for
  Hot-words** in a recording's Additional Actions menu — shown only when at least one enabled
  "Meaning" entry exists.

A phrase counts once per clip no matter how many times it's repeated. Matched phrases show as
pills on the clip's sidebar card (or a `🔥 N` count once there are more than three), with the
full list plus the boost actually applied in the clip detail view.

### Sensitive Content

Settings → Sensitive Content lets you flag clips containing names, personal info, or language you
want to catch before sharing — kept completely separate from scoring: it only warns, never changes
a clip's score. Two categories:

- **Privacy Terms** — names or personal info you don't want in shared clips.
- **Censor Words** — language to flag before posting to restricted platforms.

Each term has a match mode: **Exact**, **Ignore case**, or **Close spelling** (catches
misspellings/mishearings, e.g. "Jonh" for "John" — requires a term of at least 4 characters).
Saving or deleting a term instantly rescans every clip in the project (text-only, no LLM call).
A flagged clip shows a warning badge on its sidebar card and a "Flagged terms" section (with the
matched text and category) in the detail view; the **Flagged** filter chip in the clip list shows
only flagged clips.

---

## Export

### Single clip

- **Quick export (default)**: keyframe-aligned stream copy; typically completes in 1–5 seconds regardless of clip length
- **Precise export** (`--precise`): frame-accurate using libx264 + AAC; expect ~10–30 s per minute of clip on CPU, or ~3–8 s per minute on a GPU-accelerated ffmpeg build
- **Captions — None** (default): SRT sidecar written alongside the export for later use
- **Captions — Softsub** (`--embed-subs`): SRT added as a subtitle track in the container; stream copy, fast; use MKV for broadest player support
- **Captions — Hardsub** (`--bake-captions`): subtitles burned into video frames; forces re-encode
- **Caption style** (hardsub only): font (`--caption-font`), size (`--caption-size`, 12–96), and
  position (`--caption-position`, bottom/top) for burned-in captions. Set a default in
  Settings → Export and override it per export in the Export dialog's collapsible "Caption style"
  group. Empty/default values use the renderer default. Per-speaker colours are always kept.
  Embedded tracks and SRT sidecars are unstyled — players control their rendering.
- **Vertical / Shorts export** (`--preset tiktok-9x16`): the built-in "TikTok / Shorts (9:16)" Export preset crops the widescreen recording to a 9:16 column and scales it to 1080×1920. **Vertical framing** — Left / Center / Right buttons plus a fine slider in the Export dialog — chooses which slice of the frame to keep; the choice is saved on the clip and reused for later vertical exports. Sources already narrower than 9:16 are letterboxed rather than cropped. Any custom preset can be made vertical with the "Vertical 9:16" checkbox in Settings → Export.
  - **Auto-frame on faces** (optional): with the MediaPipe package installed (Settings → Export → Vertical framing), the "Auto-frame on faces" button suggests a crop position by finding the median face location across the clip — you still confirm before exporting. Without the package the button points you to the install; manual framing always works.
- **Edit & export**: the "Edit & export" button on a clip opens a full-panel editor that ties trimming, vertical framing, and caption preview together over a live preview. Drag the trim in/out from the transcript — which shows ~30 seconds of surrounding lines you can extend into — nudge the boundaries ±0.5 s, drag the 9:16 crop box directly over the frame when a vertical preset is chosen, and see a live caption overlay before exporting from the same panel. The caption overlay is a preview approximation. The plain **Export** dialog stays for quick exports.
- **Output**: `.yuu-clip/exports/`
- **File name**: configurable template in Settings → Export (default `{video}_clip{clip_id}_{start}`); placeholders: `{video}`, `{clip_id}`, `{start}`, `{end}`, `{score}`, `{date}`
- **Add title card**: prepends a title card (see Highlight reel below for the customizable style) with text built from your template — the clip's description and/or timecode by default

### Highlight reel

- Filters clips by video, status, minimum score, and top-N per video
- Generates ffmpeg title cards with clip descriptions between each clip — background
  color, text color, text size, duration, and the **text template** are configurable
  in Settings → Export (also applies to a single clip export's title card, see above).
  The template is free text with `{description}`, `{start}`, and `{duration}`
  placeholders; each line becomes a line on the card, and a placeholder that renders
  empty drops its line so the card is never blank.
- Supports fade, dissolve, wipe, and slide transitions with configurable overlap duration
- Output: MKV, requires ffmpeg ≥ 4.4

---

## Configuration

### Project directory

All state is stored in `.yuu-clip/` next to your video files (or in the directory passed to `--project`):

```
.yuu-clip/
  project.db         # SQLite database
  yuu-clip.log       # rolling log
  exports/           # exported clips
  reels/             # compiled highlight reels (timestamp-named MKVs)
  audio/             # extracted WAV files (temporary; reused across runs)
  proxies/           # cached 720p preview copies (safe to delete; rebuilt on demand)
  sounds/            # custom notification sounds you've added
```

### Backing up and restoring a project

**Settings > Backup & Restore** saves a project to a single portable `.zip` file, and rebuilds one from that file.

- **Back up project** downloads a small `.zip` containing the project's own state: the database (your clips, review decisions, descriptions), your settings, world contexts, and any custom notification sounds. It deliberately does **not** include your original video files or the large working files yuu-clip can rebuild on its own (extracted audio, exported clips, preview proxies, compiled reels), so the backup stays small. Keep it somewhere safe, or copy it to another computer.
- **Restore from backup** rebuilds a project from a backup file. You pick the `.zip` and a folder to restore into (restoring over an existing project asks first and keeps a safety copy of its database). If your original videos have moved - a new drive, a new computer - Restore lists the folders it couldn't find and lets you point each one to its new location, so your clips still play. Folders you leave blank stay marked as missing rather than being guessed.
- **First-run restore** - the setup wizard offers "Restore from a backup instead" so a fresh install or a new machine can start from a backup rather than an empty project.

### Track layouts

Saved per-project. Each track layout stores: number of tracks, and per-track label, transcribe flag, and relevance weight. Created and edited in the web UI track layout manager or by hand in the database.

### Scoring weights

Global defaults set in Settings (`score_funny_weight`, `score_dramatic_weight`, `score_action_weight`). Overall score = weighted average normalized to [0, 1].

Per-context overrides can be set in the World Context editor. When a video is rescored, the weights from all assigned contexts that have overrides are averaged and used instead of the global defaults. Contexts without overrides are ignored in the average.

---

## Settings

### Theme

Settings → UI → **Theme** switches the app's color scheme. Three themes ship:

| Theme | Look |
|-------|------|
| Dark (default) | The original dark purple look |
| Light | White surfaces, darkened accent colors |
| High contrast | Pure black background, brighter text and colors throughout |

The change applies immediately (no Save needed) and is remembered across
restarts. All three themes meet WCAG AA contrast for text.

### Speaker labels

When enabled, yuu-clip runs speaker diarization after transcription and labels each transcript segment with who was speaking. This improves LLM scoring quality: transcript excerpts are formatted as `SPEAKER_00: ...` / `SPEAKER_01: ...` blocks instead of a flat text join.

**Backends**

| Backend | Default | Requirement |
|---------|---------|-------------|
| SpeechBrain | ✓ | Bundled - no install step, no account or token |
| Pyannote | — | HuggingFace account + `pip install pyannote.audio` (one-click install button in Settings) |
| Off | — | Disable diarization entirely |

**SpeechBrain** is on by default and needs no setup - it ships with yuu-clip. The speaker model (~80 MB) downloads automatically the first time you analyze a recording.

To enable **Pyannote** instead (slightly higher accuracy, but requires an account):
1. Create a free account at [HuggingFace](https://huggingface.co) and, while signed in, accept the gated model terms for [speaker-diarization-community-1](https://huggingface.co/pyannote/speaker-diarization-community-1)
2. Generate a token at HuggingFace → Settings → Access Tokens with **Read** access (a classic Read token, or a fine-grained token with "Read access to contents of all public gated repos you can access")
3. Open Settings → Speaker labels in the app; paste the token and click **Install pyannote.audio**
4. Change the backend to **Pyannote** and save

The Settings value is the default. You can override it per analysis: the **New Recording → Advanced options** panel has a **Speaker labels** checkbox (pre-set from your default) so you can turn diarization on or off for a single run. When enabled, the time estimate includes a **Speaker labels** step. The checkbox is disabled until the configured backend is fully set up (SpeechBrain installed, or Pyannote installed with a saved token).

Named voices are matched back to their names by a voiceprint that is specific to the backend that produced it, so if you switch backends the app can't auto-match your existing names — re-confirm them from the Speakers card after switching.

Diarization adds extra processing time after transcription (roughly 2–4× real-time on CPU, faster with CUDA). Speaker labels are re-used on retranscription; re-running diarization requires a full re-analysis.

Diarization runs as its own **Detecting speakers** step (a "Speakers" pill in the job header), separate from Transcribe — so a long diarization pass reads as its own stage rather than a stuck transcription.

**Naming speakers**

Once a recording has been analyzed with speaker labels on, open it and use the **Speakers** card in the recording detail. Each detected voice starts as "Speaker 1", "Speaker 2", and so on, with a short sample of what they said and a ▶ button to hear a few seconds of that voice; type a real name (e.g. "Yuu") to label them. Names appear in that recording's clip transcripts and in exported captions, and they stick even if you re-analyze the recording. Names are per-recording — naming a voice in one recording doesn't carry over to others yet. Caption files and highlight reels you already exported keep their old labels until you export them again.

Each speaker also gets a colour, auto-assigned from a fixed palette so voices are visually distinct right away — click the colour swatch next to a speaker's name to pick a different one. Colours show up in the timed transcript views and in burned-in captions (`--bake-captions`); caption files and reels you already exported keep their old colours until you export them again.

The **Suggest names** button (top of the Speakers card) uses the LLM to guess names from how people address each other in the transcript ("Hey Yuu, watch out"). Each guess appears as a **Suggested: …** prompt next to the voice with **Accept** and **Dismiss** buttons — nothing is applied to your captions until you accept it, so a wrong guess never silently mislabels a speaker. The same name is never suggested for two different voices, and an existing name you already typed is never overwritten.

**Borderline voice matches**

When you re-analyze or re-detect speakers, yuu-clip tries to re-attach each voice to the one you already named so your names survive. If a voice comes back *close but not certain* — similar enough to be suspicious, not similar enough to auto-match — it doesn't guess. Instead the new voice shows a **"Might be {name} (NN% voice match)"** prompt on the Speakers card with **Same voice** and **Different voice** buttons. **Same voice** merges the two (the name and colour carry over and both voice samples are blended so the match improves next time); **Different voice** keeps them separate. Until you choose, the new voice stays an unnamed "Speaker N", so a borderline guess never reaches your captions on its own.

**Fixing speakers from the transcript**

You don't have to go to the Speakers card to fix a mislabelled line. In any timed transcript, each line shows a small coloured **speaker dot**. Click it to open a menu where you can:

- **Reattribute that one line** to a different speaker (or mark it Unassigned) — useful when diarization split or merged a voice on a single line.
- **Name that line's speaker** inline, without scrolling back to the Speakers card.

Lines you reassign by hand get a small ✎ marker on their dot, so you can tell which lines were auto-detected and which you corrected. Reassigning a line rebuilds the affected clips' excerpts (re-score to refresh their scores). Speaker identities are still per-recording — a project-wide voice library that carries names across recordings is planned but not shipped.

**Timed transcript views**

Both a clip and a whole recording have a timed transcript you can click through. In the clip detail, the **Transcript** section shows each line with a timestamp and a ▶ that jumps the player to that moment; when the recording is diarized, lines are grouped by speaker name. The recording detail has a **Full transcript** section (collapsed by default) with the same per-line playback across the whole session. Both work with or without speaker labels — without diarization, each caption line simply plays from its own timestamp.

### Transcription language

By default the speech-to-text model auto-detects the spoken language per recording, which works well for most audio. If detection gets it wrong (accents, mixed-language voice chat, quiet mics), set **Transcription language** in Settings → Whisper to force a specific language. It takes effect on the next analysis or retranscribe. The same setting is offered in the setup wizard under **Basics**.

This controls what Whisper *hears* — the app interface itself stays in English (interface translation is a future roadmap item).

### Setup wizard

The first-run setup wizard groups everything by how necessary it is: **Required** (FFmpeg — bundled with yuu-clip and shown as "Included", so there's nothing to install), **LLM scoring — choose one** (a local `.gguf` model file with a one-click guided download — the default — or Ollama, or the Claude API), **Content type**, **Optional** (GPU acceleration), and **Basics** (project folder, speech-to-text model, transcription language). Speaker labels, laugh/audio-event scoring, similarity embeddings, and vision are bundled and need no wizard step. After installing something outside the app, click **Check again** to re-detect it without closing the wizard — or **Restart app** for driver-level installs like CUDA. The wizard re-appears once after an update only when it gained new options; you can always reopen it from the hamburger menu (**Re-run Setup Wizard**).

### Optional dependency install

Bundled features (speaker labels' SpeechBrain backend, laugh/audio-event scoring, similarity embeddings, vertical auto-framing, vision) ship in the box and need no install step. Settings still has **Install** buttons for the handful of things that are a genuine choice: Pyannote (an alternative speaker-labels backend), Claude API, and GPU acceleration (`cuda-libs`). Each runs `pip install <package>` (or the CUDA library fetch) in a subprocess and streams progress live; if an install fails, the full log is shown inline.

### Notification sounds

A **Notification sounds** section in Settings plays a short sound when a long-running action finishes, so you can step away during a slow analysis and be called back when it's done. Every event is **off by default** — opt in per event.

Events: **Analysis complete**, **Re-score complete**, **Highlight reel ready**, **Export complete**, and **Any job failed** (a distinct error cue).

Each event has its own **On** toggle and a sound dropdown, plus a **Preview ▶** button to hear it. Sound choices:

- **Built-in Windows sounds** (Notify, Ding, Tada, Chimes, Error, and more) — taken from your Windows system sounds; only ones present on your machine are listed.
- **Your own audio file** — use **Use your own sound** to add a `wav`, `mp3`, `ogg`, `m4a`, etc. (up to 25 MB). It's copied into the project so the choice sticks across reloads, and it appears in every dropdown.

A global **Volume** slider applies to all cues. Whenever a sound is playing, a floating **⏹ Stop sound** button appears in the corner so you can silence a long clip or full song at any time. Settings apply immediately.

### Pipeline progress feedback

While a recording is being analyzed, the app surfaces progress in several places:

- **Stage tooltips** — each stage pill in the job progress bar shows its pre-run time estimate on hover (e.g. "Estimated: 4m 30s"), taken from the estimate computed in the New Recording panel.
- **Immediate sidebar entry** — a new recording appears in the sidebar as soon as you start analyzing it (as an "Analyzing…" row before its record exists), then shows its live stage (Extracting, Transcribing, …) with a spinner until it's done.
- **In-detail progress panel** — opening the recording that's currently analyzing shows an "Analysis in progress" card with the live stage steps and elapsed time.
- **Survives a page refresh** — analysis runs in the background, independent of the browser. You can refresh the page, close and reopen the tab, or open the app in another window: it reconnects to the running analysis and the progress picks up where it left off. Only pressing **Cancel** (or shutting down the server) stops a run.
- **Interrupted runs are marked** — if the app is shut down or crashes while a recording is mid-analysis, that recording is shown as "Analysis interrupted" the next time the server starts (instead of spinning forever), so you can simply analyze it again.

### Analysis run history

After a recording finishes analyzing, its detail panel shows a collapsible **Last analysis** card recording that run for future reference:

- **Total time** and how long ago it ran.
- **Device** — a **GPU** or **CPU** badge, plus which device transcription and speaker diarization actually used (e.g. `cuda (float16)`).
- **Settings used** — Whisper model, track layout, captions source, speaker labels on/off, energy/scene modes, LLM scoring on/off, and world contexts.
- **Stage timing** — a per-stage breakdown (Inspect, Extract audio, Transcribe, Speakers, Generate clips, Summarize, Score) as labeled bars.

This answers "how long did this one take, what settings did I use, and did it run on my GPU?" without re-running anything.

### Re-analyzing a recording

The recording detail panel has two ways to re-run analysis on a recording that's
already been analyzed:

- **Re-detect Speakers** — re-runs *only* speaker detection on the existing
  transcript. Clips, scores, approvals, and descriptions are untouched. Names you
  assigned to speakers re-attach to the matching voices automatically. Use this
  after naming speakers to confirm they re-attach correctly.
- **Re-analyze (full)** — re-runs the whole pipeline from scratch (re-transcribe,
  re-detect speakers, regenerate clips, re-score). This **replaces** all existing
  clips, including your approvals and any edited descriptions, so it asks for
  confirmation first. Files you already exported stay on disk.

**Speaker match strictness** (Settings → Speaker labels) controls how strict
Re-detect Speakers is when re-attaching a named speaker to a voice: higher is
stricter (fewer wrong matches, but more voices re-listed as new "Speaker N" to
re-confirm). The default 0.75 is safe; lower it if named speakers keep coming
back unnamed after re-detection.
