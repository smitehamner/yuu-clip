# Test-video matrix (dev)

Recordings that stress different parts of the analyze pipeline, plus the CLI tricks for
fast dev iteration. Split out of the user walkthrough
(`docs/user/tutorials/end-to-end-walkthrough.md`) so that doc stays desktop-app framed
and free of `yuu-dev` / `ffmpeg` / `yt-dlp` asides.

## Default release-gate recording

Tier 1 step 3 of [installed-app-checklist.md](installed-app-checklist.md) needs one
recording. Unless a build gives a reason to pick something else, use:

`https://www.youtube.com/watch?v=_cMxraX_5RE&list=PL6B3937A5D230E335&index=4`

Fetch it with `yt-dlp` for personal dev testing only - never commit it, never
redistribute it (same rule as the publicly-available recordings in the table below).
**Download once and keep it locally**; re-fetching per run makes the gate depend on a
third party being up.

**Known characteristics - do not write checks that contradict these:**

- Several distinct voices, so diarization and speaker clustering get a real workout.
- The characters **never introduce themselves by name**, so speaker-name inference
  produces nothing. "Suggest names" returning no suggestions against this source is
  correct behavior, not a failure. An automated assertion about inferred names needs a
  different recording.

If analysis runs long, trim rather than sitting through it:
`ffmpeg -t 600 -i source.mkv -c copy test.mkv`.

## Recommended test videos

Different video types stress different parts of the pipeline. If you're building a test
library, collect one of each.

| Type | Why it's useful | Where to get it |
|------|----------------|-----------------|
| **Short talk-heavy session (30-60 min)** | Rich dialogue, named people, dramatic beats - e.g. an RP session, a podcast, or a chatty co-op run. Tests the full pipeline well. | Your own OBS recordings |
| **Co-op gaming with voice chat (any length)** | Multiple speakers, crosstalk, game audio bleeding into the mic. Tests multi-track separation and Whisper accuracy under real conditions. | Your own recordings with friends |
| **Solo let's play / commentary** | Single clean audio track, good baseline. Establishes a score floor: clips from a solo commentary should cluster around the funny or action categories. | Your own recordings |
| **Tabletop RPG session (D&D, etc.)** | Heavy dialogue, distinct character voices, long dramatic scenes. Good for testing context features and the dramatic score. Publicly available recordings (Critical Role, etc.) work fine for personal dev testing. | YouTube downloads via `yt-dlp` for personal use |
| **Silent / action-only gameplay (any length)** | No dialogue, high on-screen motion and scene cuts. Exercises the Visual axis and the silent-but-visual clip candidates - clips should still surface with no transcript. | Your own recordings |
| **Short test clip (5-10 min)** | Any video with some voice audio. Use for fast iteration during development - you don't want to wait 20 minutes for analysis every time you change something. | Extract the first 10 minutes of anything with `ffmpeg -t 600 -i source.mkv -c copy test.mkv` |

## Dev iteration tricks

- **Fast loop:** cut a short clip (`ffmpeg -t 600 -i source.mkv -c copy test.mkv`) and run
  the smallest Whisper model (`tiny`/`base`) so an analysis finishes in seconds, not
  minutes.
- **Start the server:** `yuu-dev serve` (prints the real URL; binds 8080 or the next free
  port). Watch the log with `yuu-dev logs --follow`.
- **Public recordings** (Critical Role and the like) are fine for personal dev testing via
  `yt-dlp`; do not commit or redistribute them.
