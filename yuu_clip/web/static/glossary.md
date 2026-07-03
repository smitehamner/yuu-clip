## Recordings & Sessions

### Recording
A video file of a gaming session — the main thing you feed into yuu-clip. Each recording is listed in the Sessions panel on the left.

### Session
The gameplay period a recording captures — for example, "last night's session." One recording is one session.

### Duration
How long a recording or clip runs, shown as `1h 23m 45s` or `23m 45s`.

---

## Audio Tracks

### Track
One audio stream inside a recording — for example your microphone, the game audio, or a combined mix. A recording can have several tracks.

### Track role
What a track represents. You assign a role to each track so yuu-clip knows what it's listening to:

- **Player Voice** — your own microphone
- **Voice Chat** — other players talking in-game
- **Game Sounds** — game audio, music, and ambience
- **Combined** — a full mix of everything
- **Unlabeled** — role not set yet

### Track layout
A saved template that remembers which track is which. Reuse it across recordings that have the same track arrangement so you don't reassign roles every time.

---

## Analysis

### Analyze
Running a recording through the full pipeline to find and score clips. Only one analysis runs at a time.

### Pipeline stages
The steps an analysis goes through, shown as pills that turn from gray to blue to green:

- **Inspect** — read the recording's details (length, resolution, tracks)
- **Assign Tracks** — set each track's role
- **Transcribe** — turn speech into text
- **Generate Clips** — find candidate highlight moments
- **Score** — rate each clip

### Inspect
A quick read of a recording's details without running a full analysis. It also runs as the first step of every analysis.

### Rescore
Re-rate the clips of an already-analyzed recording without re-transcribing or regenerating them. Useful after you change world contexts or the scoring model.

### Job
An analysis or rescore that's currently running. You can watch its progress and live log, and cancel it. Only one job runs at a time.

### Pause After Current Video
Hold a multi-video analysis before it starts the next video, without losing the progress already made — the video currently in progress always finishes first. Doesn't survive a server restart, and has no effect when analyzing a single video.

### GPU Temperature Warning
A heads-up when your GPU is running hot during analysis (NVIDIA graphics cards only). If it stays hot, analysis automatically pauses before the next video — configurable in Settings → Hardware.

---

## Transcription

### Transcript
The text of everything said in a recording, produced automatically from the audio.

### Speech-to-text model
The local model that turns audio into text. yuu-clip uses Whisper, which downloads automatically the first time you analyze. Larger models are more accurate but slower and need more memory.

### Captions
On-screen text showing what was said, taken from the transcript. You can export captions as a separate file alongside the clip, or bake them directly into the video.

### Speaker
A distinct voice yuu-clip detects in a recording. Each one starts off as "Speaker 1", "Speaker 2", and so on. Open a recording's **Speakers** card to give them real names — the names then show up in clip transcripts and captions. Names stick even if you re-analyze the recording.

---

## Clips

### Clip
A proposed highlight moment — a section of a recording with a start, an end, scores, and a description.

### Clip status
Whether you've reviewed a clip and what you decided:

- **Unreviewed** — you haven't looked at it yet
- **Approved** — you want to keep it
- **Rejected** — you've dismissed it

### Trim
Small start/end adjustments that fine-tune where a clip begins and ends, without re-analyzing. Applied when you export.

### Manual clip
A clip you pick by hand from a recording's transcript, instead of one found automatically. Use **"+ New clip"** above the clip list, or **"Create clip"** on a recording's Full transcript, then click transcript lines (or type times) to set the start and end. It goes through the same scoring and review as any other clip.

### Preview quality (720p)
For fast scrubbing, yuu-clip plays a smaller **720p** copy of a recording in the preview player instead of the huge original — long recordings can't be scrubbed smoothly otherwise. A **"Preview quality (720p)"** badge shows when you're watching this copy; a **"Original quality"** badge shows when you're on the full-size file (where seeking a long recording can be slow — click the badge to build a fast 720p copy). Copies are made automatically during analysis. Your **exported** clips always use the full-quality original — the 720p copy is only for previewing.

---

## Scoring

### Score
A 0–1 rating of a clip. Higher is better. The overall score is a weighted blend of the three dimensions below.

### Scoring dimensions
The three things each clip is rated on:

- **Funny** — comedic moments
- **Dramatic** — tense or emotional moments
- **Action** — fast, loud, high-activity moments

### LLM scoring
Extra scoring and description writing done by a local language model that reads the clip's transcript. Optional — it improves clip quality but analysis still works without it.

### Hot-word
A phrase you define that nudges a clip's score when it's spoken in the clip — for example, boosting Funny whenever a running gag's catchphrase comes up. Set up hot-words in Settings: pick a match mode (**Exact**, **Ignore case**, or **Meaning (LLM)**), a boost amount, and which score it affects. Exact/Ignore-case matches apply automatically; **Meaning (LLM)** entries need you to press **Scan** on a recording. Saying a phrase twice in one clip only counts once.

### Sensitive Terms
Names, personal info, or language you want flagged in clips — kept completely separate from scoring, so it never changes a clip's score. Two categories: **Privacy Terms** (names or personal info you don't want in shared clips) and **Censor Words** (language to flag before posting to restricted platforms). Set up in Settings, with a match mode per term (**Exact**, **Ignore case**, or **Close spelling** for catching misspellings). A flagged clip shows a warning badge and appears under the **Flagged** filter tab.

---

## Descriptions & Summaries

### Clip description
A short, plain-English summary of what happens in a clip, written automatically. Anything you edit yourself is kept and always shown instead.

### Session summary
A title and short overview of an entire recording, generated on request from the recording's detail view.

### Session timeline
Short descriptions of what happened in each 15-minute chunk of a recording — handy for navigating long sessions. This is not a video-editing timeline.

---

## World Contexts

### World context
A named bundle of background information — the setting, your characters, other characters, and notes — that helps the scorer understand what's going on. You can attach more than one to a recording (for example, crossover sessions).

### Template
A world context that ships with yuu-clip as starter content, marked with a "Template" badge. Edit it to fit your game, use it as a base for a new copy, or reset it back to the original shipped content at any time. Templates can't be deleted.

### Stale scores
A warning that a recording's contexts changed since it was last scored, summarized, or had its timeline built — so those results may be out of date. Rescore to refresh them.

---

## Export & Highlight Reels

### Export
Saving a clip out to its own standalone video file. The export window's summary line tells you whether you'll get a quick or precise export.

### Quick export
Fast export that copies the video without re-encoding. The clip may start or end up to about a second off the exact mark, which is fine for most uses.

### Precise export
Slower export that re-encodes the video to cut at the exact frame. Required when burning captions into the video or prepending a title card.

### Highlight reel
A single video assembled from several approved clips, with optional transitions and title cards.

### Title card
A short text card shown between clips in a highlight reel, naming what's coming next.

### Stale export
A "Stale — re-export to update" badge means the file you already exported no longer matches the clip — its captions, trim, or description changed since you exported it. Re-export (or rebuild the highlight reel) to bring the file up to date. Plain exports without burned-in captions aren't marked stale just because captions were edited, since the video itself didn't change.
