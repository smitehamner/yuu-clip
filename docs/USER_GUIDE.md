# rp-clipper — What It Does and Why You'd Want It

## The problem it solves

You play for three hours. Something hilarious happens at the 47-minute mark, something dramatic goes down around 1:20, and there's a great action moment somewhere in the second half — but you don't remember exactly when, and scrubbing through three hours of footage to find them is a pain.

rp-clipper watches your recordings for you. It listens to what was said, figures out where the interesting moments are, rates them, and gives you a simple browser-based interface to flip through the highlights, watch them, approve or skip them, and export the ones you want — without touching any code or command line beyond a single click to start it.

---

## How it works (in plain English)

1. **You point it at a recording.** OBS output, shadowplay, whatever — as long as it's a video file.
2. **It listens.** It runs your audio through a local speech-to-text model (Whisper, runs on your PC, nothing is uploaded anywhere) to get a full transcript of everything said during the session.
3. **It scores.** It chops the session into clip windows and rates each one for how funny, dramatic, or action-packed it was — using a local LLM (Ollama, also runs on your PC) that reads the transcript and scores what happened.
4. **You review.** Open the web UI in your browser, flip through the clips, watch the ones that look good, approve or skip, then export.
5. **You've got clips.** Ready-to-share video files, no re-encoding required unless you want frame-perfect cuts.

Everything runs locally. No cloud, no subscription, no footage leaving your machine.

---

## What you actually see in the browser

### The sidebar

On the left you get two panels stacked on top of each other.

The **top panel** is your list of analyzed recordings. Each one shows how long it is, how many clips were found, how many you've approved so far, and a processing status. Click one to load it.

The **bottom panel** shows all the clips from the session you've selected, sorted either by score (best first) or by when they happen in the session (timeline order). Each entry shows the score, how long the clip is, whether you've approved or skipped it, and a short preview of what was said.

### The clip detail view

Click a clip and the main panel shows you everything about it:

- A **one-liner description** — a single sentence summary of what happens ("Jameson accidentally confesses to the robbery while trying to order a sandwich")
- A **longer description** — a short paragraph with more context: who's involved, why it matters, what the vibe was
- **Score bars** for Funny, Dramatic, and Action — so you can see at a glance what kind of moment it is and how strong it is
- The **full transcript** of what was said during that window
- **Tags** that describe how the clip was scored (whether it had a spike in audio energy, a scene cut, etc.)

### The video player

Once you export a clip, a player appears right there in the panel. It plays the actual exported video with captions — useful for double-checking before you share it. Before you export, there's just an Export button in its place.

---

## Reviewing clips quickly

The fastest way to go through a session is keyboard shortcuts:

| Key | What it does |
|-----|-------------|
| `→` or `↓` | Next clip |
| `←` or `↑` | Previous clip |
| `A` | Approve this clip |
| `R` | Reject (skip) this clip |
| `Space` | Play / pause the video |
| `E` | Export this clip |
| `?` | Open the help panel |

You can go through dozens of clips in a few minutes just using arrow keys and A/R.

---

## What the scores mean

Each clip gets rated 0–1 on three dimensions:

**Funny** — jokes, banter, chaos, absurd moments, people cracking up or saying something wildly out of place

**Dramatic** — confrontations, reveals, emotional conversations, turning points in a story

**Action** — high tension, combat, things escalating fast, everyone talking over each other at once

The **Overall** score is a weighted average of all three. Higher is better, but the individual bars tell you more — a clip with a 0.9 Funny score and a 0.1 Dramatic score is a very different clip than one that's 0.9 Dramatic.

The scoring isn't perfect. It reads transcripts, not video — so a moment where something visually spectacular happens in silence won't score as high as it deserves. Use the scores as a filter to find the candidates quickly, not as a final verdict.

---

## World contexts — making the scores actually make sense

If you play on a roleplay server, the LLM has no idea who your character is, what server you're on, or what the ongoing story is. Without context, it's scoring a transcript of strangers talking — it might miss that "Jameson getting arrested" is significant because Jameson has been evading the police for six sessions.

**World contexts** let you give the LLM that background. You create a named context (e.g. "Public Server") and fill in:

- What the server/setting is ("FiveM RP server, semi-serious crime and civilian life")
- Who your character is ("Marcus Webb, mid-level fixer, known for deflecting with humor")
- Who else shows up regularly ("Detective Reyes — runs the anti-corruption unit, has history with Marcus")
- Any other notes the AI should know

Once you've set one up you can assign it to any session at analysis time or afterward. The AI then uses all of that when scoring, so it knows what's a throwaway line and what's actually a significant story beat.

You can have multiple contexts for different servers or campaigns and mix them on a single session if you were doing crossover stuff.

---

## How long does it actually take?

It depends on your recording length, which Whisper model you pick, and whether you have an Nvidia GPU. Here's a realistic range for a typical gaming session:

| Session length | Nvidia GPU (any RTX) | CPU only |
|---|---|---|
| 30 minutes | 5–9 min | 1–1.5 hours |
| 1 hour | 9–18 min | 2.5–3 hours |
| 2.5 hours | 23–45 min | 6+ hours |

The wide range within the GPU column is the Whisper model choice — `base` is fast but less accurate with names and crosstalk, `large-v3` takes longer but handles heavy accents, overlapping speakers, and RP-specific terminology much better. `medium` is a good middle ground for most sessions.

**CPU-only is usable for short clips but painful for full sessions.** If you don't have a compatible Nvidia GPU, `base` or `small` is the only practical choice — they're faster than the estimates above suggest (the app's estimate is conservative for small models on CPU).

### What's actually taking the time?

Almost all of it is transcription (Whisper listening to your audio). Everything else — audio energy analysis, finding scene cuts, LLM scoring — adds maybe 2–5 minutes on top regardless of session length. The scoring step is fast because it's just reading text, not processing video.

---

## Choosing a Whisper model

The model selector appears in the analysis options. In order from fastest to slowest (and least to most accurate):

**`tiny`** — Very fast, noticeably rough. Fine for a quick first pass if you just want timestamps.

**`base`** — Default. Good enough for clear audio with one speaker. Struggles with crosstalk and unusual names.

**`small`** — Meaningfully better than base for overlapping voices, only a bit slower.

**`medium`** — Solid all-around. Handles most RP sessions well, including character voices and server slang.

**`large-v3`** — Best accuracy. Worth using if you care about the transcript being right — especially for dramatic/dialogue-heavy sessions where the descriptions and scores depend on getting the words correct. Requires a GPU with ~10 GB VRAM (e.g. RTX 3080/3090/4070+). Your best strategy with this is to select a faster model for the full video, but then retranscribe your chosen clips with large-v3.

---

## Exporting clips

Hit the Export button on any clip (or press `E`). By default it does a **quick export** — it pulls the clip out of the original file without re-encoding it, which means it finishes in 1–5 seconds and the video quality is identical to the source.

You can optionally:
- **Include captions** — a separate SRT file is written alongside the clip, which most video players and editors pick up automatically
- **Bake captions in** — bakes the text into the video itself, useful if you're sharing somewhere that doesn't support sidecar files (requires re-encoding, takes longer)
- **Precise export** — forces a frame-accurate cut instead of snapping to the nearest keyframe; only matters if the beginning/end of your clip feels like it starts or ends a fraction of a second off

Exports go to a folder called `exports` inside your project directory.

---

## Building a highlight reel

Once you've approved a set of clips, the **Build Reel** button in the header compiles them into a single video with title cards and transitions between clips. You pick:

- Which sessions to pull from (or just "all approved clips")
- Transition style (fade, dissolve, wipe, slide, or hard cut)
- How long the transitions and title cards last

The reel uses the clip descriptions as title card text, so the output is already labeled without any extra editing. Good for a quick "here's what happened this session" video to share with your community.

---

## Things it won't do (and what to do instead)

**It doesn't watch your game live.** It works on recordings after the fact — start your OBS capture as normal, finish your session, then run it through rp-clipper.

**It doesn't edit video.** It finds and exports clips; it doesn't add effects, color grade, or do anything fancy with the video itself. Take the exports into your editor of choice if you want that.

**It doesn't upload anything.** Everything stays on your machine. The flip side is that you need Ollama installed and running locally for the LLM scoring to work — it's a one-time setup, but it's a setup.

**The scores are a starting point, not a verdict.** A 0.3-scoring clip might be the funniest moment of the session but happen to be mostly non-verbal. Always sort by score to find the obvious candidates fast, then flip through the lower-scoring ones in timeline order before you close out.
