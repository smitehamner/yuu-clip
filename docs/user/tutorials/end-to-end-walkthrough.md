# End-to-End Workflow Walkthrough

This document walks through a complete session: analyzing a recording, reviewing the clips it finds, exporting the best ones, and compiling a highlight reel. It's written for someone seeing yuu-clip for the first time.

If you're recording a tutorial video from this document, each top-level section maps to a natural chapter break.

---

## What you'll need

- A video recording of a gaming or roleplay session (see [Recommended test videos](#recommended-test-videos) below)
- yuu-clip running: `.\scripts\serve.ps1`
- An LLM backend set up for scoring. By default this is a local model file (the setup wizard downloads the recommended one with one click); you can also use the Claude API. The app shows which model it's using. If no backend is set up, analysis still runs but clips get no descriptions or scores.
- A browser open at `http://127.0.0.1:8080`

---

## Recommended test videos

Different video types stress different parts of the pipeline. If you're building a test library, collect one of each.

| Type | Why it's useful | Where to get it |
|------|----------------|-----------------|
| **Short talk-heavy session (30–60 min)** | Rich dialogue, named people, dramatic beats - e.g. an RP session, a podcast, or a chatty co-op run. Tests the full pipeline well. | Your own OBS recordings |
| **Co-op gaming with voice chat (any length)** | Multiple speakers, crosstalk, game audio bleeding into the mic. Tests multi-track separation and Whisper accuracy under real conditions. | Your own recordings with friends |
| **Solo let's play / commentary** | Single clean audio track, good baseline. Establishes a score floor: clips from a solo commentary should cluster around the funny or action categories. | Your own recordings |
| **Tabletop RPG session (D&D, etc.)** | Heavy dialogue, distinct character voices, long dramatic scenes. Good for testing context features and the dramatic score. Publicly available recordings (Critical Role, etc.) work fine for personal dev testing. | YouTube downloads via `yt-dlp` for personal use |
| **Short test clip (5–10 min)** | Any video with some voice audio. Use for fast iteration during development - you don't want to wait 20 minutes for ingest every time you change something. | Extract the first 10 minutes of anything with `ffmpeg -t 600 -i source.mkv -c copy test.mkv` |

---

## Chapter 1 - First look at the UI

Open `http://127.0.0.1:8080`. You'll see:

- A **left sidebar** split into two panels: video list (top) and clip list (bottom). Both are empty until you ingest something.
- A **main panel** on the right, showing the detail view for whatever clip is selected.
- A **header bar** with `+ Analyze`, `Highlight Reels`, and a `≡` hamburger menu.
- A **footer bar** at the bottom showing the app version.

Nothing works yet - there's no data. Let's fix that.

---

## Chapter 2 - Analyze your first recording

**Goal:** Get a recording into the system and let the pipeline run.

1. Click `+ Analyze` in the header. The **New Recording** panel takes over the main view.

2. Click the file picker button and select your recording. After a few seconds you'll see an inspection summary: file duration, the audio tracks found, and a time estimate for transcription. The estimate is deliberately conservative - your actual runtime will often be shorter.

3. **Pick a Whisper model.** For your first test, `base` or `small` is fine - they're fast, and you just want to see the pipeline run. For real sessions where you care about clip quality, use `medium` or `large-v3` (see [FEATURES.md](../FEATURES.md) for model comparisons).

4. **Pick a track layout.** If you haven't created one yet, the default layout will be selected. A track layout tells the app which audio tracks to transcribe - for most recordings there's only one relevant track (your microphone), but OBS sometimes captures game audio separately, and you want to skip that.

5. Click **Start Analysis**. The panel closes and the header shows a row of step chips: `Extract → Transcribe → Generate Clips → Energy → Scenes → Score`. These advance as each stage finishes.

6. Wait. Whisper is doing the heavy lifting here. The time estimate from step 2 is your rough guide. The app keeps working in the background - you can leave the tab open and do something else.

7. When processing finishes, the step chips disappear and your video appears in the top sidebar panel.

> **If the estimate feels wrong:** The initial estimate counts all audio tracks in the file. If your track layout only transcribes one track, the actual time will be proportionally shorter. This is a known issue tracked in the roadmap.

---

## Chapter 3 - Orient yourself to the results

Click your video in the sidebar. A few things happen:

- The **clip list** loads in the bottom sidebar panel. Each entry shows a score icon row (⭐ overall, 😂 funny, 🎭 dramatic, ⚔️ action), a colored left border, a clip duration, a status dot, and a transcript excerpt.

- The **main panel** shows a video detail header with the video name, duration, and clip count.

- Clips are sorted by Overall score descending by default - the app's best guesses at your strongest moments are at the top.

Take a moment to scroll the clip list. The scores tell you what kind of moment each clip is:
- A clip heavy in 😂 with a low 🎭 is a pure comedy moment.
- A clip heavy in 🎭 with low everything else is probably a character beat or reveal.
- High ⚔️ usually means everyone was talking fast and loud at once.

The best clips are usually not at the bottom of the list.

---

## Chapter 4 - Review clips

**Goal:** Go through the clips and mark the ones worth keeping.

The fastest way to review is keyboard-only:

1. Click the first clip in the list to select it.
2. The main panel shows the clip detail: a one-liner description, a longer paragraph, score bars, tags, and the transcript excerpt.
3. Read the description and transcript. Does this sound like a moment worth watching?
   - If yes: press `A` to approve. The status dot turns green.
   - If no: press `R` to reject. The status dot turns red.
   - If unsure: press `→` to move on without deciding. You can come back via the `Unreviewed` filter chip.
4. Press `→` to advance to the next clip.

Repeat. A typical 1-hour session produces 20–40 clips. At 5–10 seconds per clip on average, a full review pass takes under 5 minutes.

**Useful filter trick:** Click the `Unreviewed` chip to see only unreviewed clips. Click `Approved` to review your picks. The filter chips are above the clip list, each showing a live count.

**Changed your mind?** If you reject a clip and immediately realize you were wrong, press `Ctrl+Z` within 5 seconds to undo the status change. A toast appears confirming the undo.

---

## Chapter 5 - Dig into a specific clip

When a clip's description catches your eye, look closer before approving:

1. **Read the long description.** The one-liner is the summary; the paragraph gives context - who was involved, what the vibe was, why this moment might matter.

2. **Check the tags.** Tags like `audio_spike`, `scene_cut`, and `llm_scored` tell you what signals drove the score. A clip with `audio_spike` and a high action score got everyone talking at once. A clip tagged `llm_error` means your AI model didn't score it - the overall score is based on audio energy only.

3. **Export and watch it.** Press `E` to export the clip. A progress stream appears in the header. When it finishes, a video player appears right in the detail panel - watch the actual clip to confirm the description matches reality.

> **Important:** The LLM reads transcripts, not video. A moment where something visually spectacular happens in silence can score lower than it deserves. Always treat scores as a filter to find candidates quickly, not as a final verdict.

---

## Chapter 6 - Improve a clip's description (optional)

If the generated description isn't quite right, you can fix it:

1. Click the one-liner text in the detail panel. It becomes an editable field.
2. Type your correction and click away. It saves immediately.

The same works for the longer description. Your edits are preserved even if you regenerate the LLM output later - the system keeps original and user versions separate.

---

## Chapter 7 - Export your approved clips

You've already exported one clip in Chapter 5. The same process works for all approved clips - select a clip, press `E`, wait for the stream.

Exported clips land in the `.yuu-clip/exports/` folder inside your project directory.

**What's in the export?**
- A video file (MKV by default) - the exact frames from your source recording, no re-encoding, so no quality loss
- An SRT subtitle file alongside it - most players pick it up automatically

---

## Chapter 8 - Build a highlight reel (optional)

Once you have a few approved clips, compile them into a single reel:

1. Click `Highlight Reels` in the header. A window opens with **Build** and **View** tabs, on the Build tab.
2. Configure:
   - **Session scope:** "all approved clips" pulls from every analyzed recording, or you can limit to the current session
   - **Transition style:** fade, dissolve, wipe, slide, or hard cut
   - **Transition duration** and **title card duration**
3. Click **Build Reel**. A progress stream appears in the header.
4. The finished reel is saved to the `.yuu-clip/reels/` folder inside your project directory.

The reel uses the clip one-liners as title card text, so it comes out pre-labeled. Good for a "here's what happened this session" share.

---

## Chapter 9 - Add context (optional but recommended)

Out of the box the LLM doesn't know who's in your recording, what you're playing, or what's been going on across sessions - without context it's scoring a transcript of strangers talking. This helps most for talk-heavy content (RP, podcasts, squad play). You can fix it:

1. Open `≡` → World Contexts.
2. Click New Context and give it a name (e.g. "Squad night" or "NCRP - Marcus Webb").
3. Fill in the context body: who you are, what the game or setting is, who else shows up regularly, what's been going on lately. More detail = better scoring.
4. Close the modal and go back to your video detail. Assign the context there.
5. Re-score one of the clips to see whether the descriptions improve.

See [OVERVIEW.md](../OVERVIEW.md#world-contexts--making-the-scores-actually-make-sense) for more on what to include.

---

## What to do if something looks wrong

| Symptom | First check |
|---------|-------------|
| Clips have no description and tags show `llm_error` | Your AI model isn't set up or is unreachable. Check Settings → LLM scoring (that a model file is selected, or your Claude API key is valid), then re-score. |
| Transcript is garbled or missing words | The Whisper model is too small for your audio. Retranscribe the clip with `medium` or `large-v3`. |
| Export fails immediately | The source video file has moved or been renamed since ingest. The path in the DB no longer resolves. |
| Score seems backwards (calm moment scores high) | Check the tags - `audio_spike` means a burst of audio energy. A loud laugh can spike energy even if the dialogue content is mild. |
| Analysis estimate was wildly off | See the note in Chapter 2 - the estimate counts all tracks, not just the ones the track layout transcribes. |
