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

### Stale scores
A warning that a recording's contexts changed since it was last scored, summarized, or had its timeline built — so those results may be out of date. Rescore to refresh them.

---

## Export & Highlight Reels

### Export
Saving a clip out to its own standalone video file.

### Quick export
Fast export that copies the video without re-encoding. The clip may start or end up to about a second off the exact mark, which is fine for most uses.

### Precise export
Slower export that re-encodes the video to cut at the exact frame. Required when baking captions into the video.

### Highlight reel
A single video assembled from several approved clips, with optional transitions and title cards.

### Title card
A short text card shown between clips in a highlight reel, naming what's coming next.
