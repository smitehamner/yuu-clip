# yuu-clip - What It Does and Why You'd Want It

## The problem it solves

You play for three hours. Something hilarious happens at the 47-minute mark, something dramatic goes down around 1:20, and there's a great action moment somewhere in the second half - but you don't remember exactly when, and scrubbing through three hours of footage to find them is a pain.

yuu-clip watches your recordings for you. It listens to what was said, figures out where the interesting moments are, rates them, and gives you a browser interface to flip through the highlights, watch them, approve or skip them, and export the ones you want - without touching any code or command line beyond a single click to start it.

---

## How it works (in plain English)

1. **You point it at a recording.** OBS output, shadowplay, whatever - as long as it's a video file.
2. **It listens.** It runs your audio through a local speech-to-text model (Whisper, runs on your PC, nothing is uploaded anywhere) to get a full transcript of everything said during the session.
3. **It scores.** It chops the session into clip windows and rates each one for how funny, dramatic, or action-packed it was - using an LLM that reads the transcript and scores what happened. By default this is a local model file that runs on your PC (GPU-accelerated); you can also point it at the Claude API (cloud) in the setup wizard or Settings.
4. **You review.** Open the web UI in your browser, flip through the clips, watch the ones that look good, approve or skip, then export.
5. **You've got clips.** Ready-to-share video files, no re-encoding required unless you want frame-perfect cuts.

By default everything runs locally - no cloud, no subscription, no footage leaving your machine. The one exception is if you deliberately choose the Claude API backend for scoring, which sends clip transcripts (text only, never video) to Anthropic. The two local backends keep everything on your machine.

---

## What you actually see in the browser

### The sidebar

On the left you get two panels stacked on top of each other.

The **top panel** is your list of analyzed recordings. Each one shows how long it is, how many clips were found, how many you've approved so far, and a processing status. Click one to load it.

The **bottom panel** shows all the clips from the session you've selected, sorted either by score (best first) or by when they happen in the session (timeline order). Each entry shows the score, how long the clip is, whether you've approved or skipped it, and a short preview of what was said.

### The clip detail view

Click a clip and the main panel shows you everything about it:

- A **one-liner description** - a single sentence summary of what happens ("Jameson accidentally confesses to the robbery while trying to order a sandwich")
- A **longer description** - a short paragraph with more context: who's involved, why it matters, what the vibe was
- **Score bars** for Funny, Dramatic, and Action - so you can see at a glance what kind of moment it is and how strong it is
- The **full transcript** of what was said during that window
- **Tags** that describe how the clip was scored (whether it had a spike in audio energy, a scene cut, etc.)

### The video player

Before you export, the player streams a live preview from your source file - seekable, no waiting. Once you export a clip, it switches to the exported file and shows captions. Auto-plays on clip selection.

---

## Reviewing clips quickly

The fastest way to go through a session is keyboard shortcuts:

| Key | What it does |
|-----|-------------|
| `J` / `→` / `↓` | Next clip |
| `K` / `←` / `↑` | Previous clip |
| `A` | Approve this clip |
| `R` | Reject (skip) this clip |
| `Space` | Play / pause the video |
| `E` | Export this clip |
| `Ctrl+Z` | Undo the last approve/reject (within 5 seconds) |
| `?` | Open the Keyboard Controls panel |

You can go through dozens of clips in a few minutes just using arrow keys and A/R. A typical 1-hour session produces 20–40 clips; a full review pass takes under 5 minutes.

---

## What the scores mean

Each clip gets rated 0–1 on three dimensions:

**Funny** - jokes, banter, chaos, absurd moments, people cracking up or saying something wildly out of place

**Dramatic** - confrontations, reveals, emotional conversations, turning points in a story

**Action** - high tension, combat, things escalating fast, everyone talking over each other at once

The **Overall** score is a weighted average of all three. Higher is better, but the individual bars tell you more - a 0.9 Funny / 0.1 Dramatic clip is a very different moment than 0.9 Dramatic.

The scoring reads transcripts, not video - so a moment where something visually spectacular happens in silence won't score as high as it deserves. Use the scores as a filter to find candidates quickly, not as a final verdict.

---

## World contexts - making the scores actually make sense

Out of the box, the LLM has no idea who's in your recording, what you're playing, or what's been going on across sessions. Without context, it's scoring a transcript of strangers talking - it might miss that "Jameson getting arrested" is a big deal because Jameson has been the running rival of your squad for six sessions.

**World contexts** let you give the LLM that background. You create a named context (e.g. "Squad night" or "Public server") and fill in:

- What the game/setting is ("Valorant ranked, five-stack" or "FiveM RP server, semi-serious crime and civilian life")
- Who you are ("Yuu - duelist, usually calling strats" or "Marcus Webb, mid-level fixer, deflects with humor")
- Who else shows up regularly ("Alex on support; recurring rival team 'Nightfall'")
- Any other notes the AI should know

Once you've set one up you can assign it to any session at analysis time or afterward. The AI then uses all of that when scoring, so it knows what's a throwaway line and what's actually a significant moment.

You can have multiple contexts for different games, servers, or crews.

---

## How long does it take?

It depends mainly on your recording length and whether you have an Nvidia GPU. A typical 1-hour session takes 9–18 minutes on an RTX GPU, or 2.5–3 hours on CPU only. Almost all of that time is transcription; everything else adds 2–5 minutes regardless of length.

Whisper model choice matters too - `base` is fast but rougher, `large-v3` is the most accurate but requires a GPU with ~10 GB VRAM. `medium` is the practical sweet spot for most sessions.

Detailed timing estimates and model comparisons are in [FEATURES.md](FEATURES.md).

---

## Exporting clips

Hit **Export** on any clip (or press `E`). By default it does a quick export - no re-encoding, identical quality to the source, finishes in 1–5 seconds. An SRT caption file is written alongside it automatically.

Options for baking captions into the video, precise frame-accurate cuts, and container format are in the export modal or in [FEATURES.md](FEATURES.md).

Exports go to `.yuu-clip/exports/` inside your project directory.

---

## Building a highlight reel

Once you've approved a set of clips, **Highlight Reels** in the header opens a window (with Build and View tabs) where you compile them into a single video with title cards and transitions between clips. The title cards use the clip one-liners as text, so the output is already labeled. Good for a quick "here's what happened this session" share.

---

## Things it won't do (and what to do instead)

**It doesn't watch your game live.** It works on recordings after the fact - start your OBS capture as normal, finish your session, then run it through yuu-clip.

**It doesn't edit video.** It finds and exports clips; it doesn't add effects, color grade, or do anything fancy with the video itself. Take the exports into your editor of choice if you want that.

**It doesn't upload anything (by default).** With either local backend, everything stays on your machine. LLM scoring does need a model set up first - the setup wizard downloads the recommended local model with one click, so it's a one-time setup, but it's a setup. (If you instead choose the Claude API backend, clip transcripts are sent to Anthropic for scoring - that's the one case where text leaves your machine.)

**The scores are a starting point, not a verdict.** A 0.3-scoring clip might be the funniest moment of the session but happen to be mostly non-verbal. Always sort by score to find the obvious candidates fast, then flip through the lower-scoring ones in timeline order before you close out.

---

## Next steps

- **Walk through your first session:** [tutorials/end-to-end-walkthrough.md](tutorials/end-to-end-walkthrough.md)
- **Full feature reference (all options, CLI, config):** [FEATURES.md](FEATURES.md)
