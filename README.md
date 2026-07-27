# YuuClip

**Find the best moments in long recordings and turn them into shareable clips.**

YuuClip is built for long, talk-heavy recordings - roleplay, voice chat, streaming,
podcasts, and commentary. Point it at a recording and it transcribes what was said,
listens for laughter and excitement, watches for on-screen action, and scores every
moment so the highlights float to the top. You review the suggested clips in a simple
web page - keep the good ones, skip the rest - and export them or stitch them into a
highlight reel. Silent, action-only gameplay is supported too, but talk-driven content
is where YuuClip shines.

**Everything runs on your own computer.** No cloud accounts, no uploads, no
subscriptions. First-run setup includes a one-click download of a local language
model (~4.7 GB, one-time) - the normal first step, handled for you by the desktop
wizard - that writes each
clip's description and sharpens the scoring. The core scoring (laughter, excitement,
keywords, scene changes, on-screen action) runs even before that download finishes, so
nothing looks empty while it works.

---

## What it does

- Reads your recording and finds each separate audio track (mic, party chat, game
  sound) from OBS
- Transcribes every track locally with Whisper - optionally noting who is speaking
- Scores each moment using laughter, excitement, keywords, scene changes, and on-screen
  action - this baseline works even before the language model finishes downloading
- Adds a semantic read of the transcript and a written description for each clip using
  the local language model set up on first run
- Gives you a web page to review clips, approve or reject them, tidy up captions, and
  export
- Exports finished clips with optional captions, and can compile your favourites into a
  highlight reel with transitions

New here? Start with the plain-English intro in
[docs/user/OVERVIEW.md](docs/user/OVERVIEW.md). For the full feature list, see
[docs/user/FEATURES.md](docs/user/FEATURES.md).

---

## Install the desktop app (recommended)

The Windows desktop app is the easiest way to use YuuClip. It bundles everything it
needs - you don't have to install Python, FFmpeg, or anything else by hand - and a
first-run wizard walks you through setup, including a one-click download of a
recommended scoring model.

**[Download the latest release](https://github.com/smitehamner/yuu-clip/releases/latest)**

(On GitHub, releases live under the **Releases** heading on the right-hand side of the
project page. The link above goes straight there.)

### A note on the Windows security warning

Because YuuClip is independently made and not yet signed with a paid certificate, the
first time you run the installer Windows shows a blue **"Windows protected your PC"**
box. This is not a virus warning - it only means Windows doesn't recognise the publisher
yet. Click **More info**, then **Run anyway**, and setup continues normally.

If first-run setup ever fails, the setup log is saved at
`%APPDATA%\yuu-clip\yuu-clip_install.log` - include it when reporting a problem.

---

## Running from source, the CLI, and tuning

Prefer to run from source, use the command line, or dig into GPU and Whisper model
settings? See **[DEV-README.md](DEV-README.md)**.

To modify the code and contribute, see **[CONTRIBUTING.md](.github/CONTRIBUTING.md)**. Please
report security issues per [SECURITY.md](.github/SECURITY.md) rather than in a public issue.

---

## License

YuuClip is licensed under the [Apache License 2.0](LICENSE) - you are free to use,
modify, and distribute it, including commercially, under that licence's terms.

The Windows installer bundles a prebuilt FFmpeg binary that is separately licensed under
the GPLv3; see [docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md](docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md)
for the full third-party compliance record.
