# YuuClip

**Find the best moments in long recordings and turn them into shareable clips.**

YuuClip is built for long, talk-heavy recordings - roleplay, voice chat, streaming,
podcasts, and commentary. Point it at a recording and it transcribes what was said,
listens for laughter and excitement, watches for on-screen action, and scores every
moment so the highlights float to the top. You review the suggested clips in a simple
web page - keep the good ones, skip the rest - and export them or stitch them into a
highlight reel. Silent, action-only gameplay is supported too, but talk-driven content
is where YuuClip shines.

**Everything runs on your own computer.** It works out of the box with no AI language
model at all; adding a local model is optional and unlocks richer scoring and written
clip descriptions. No cloud accounts, no uploads, no subscriptions.

---

## What it does

- Reads your recording and finds each separate audio track (mic, party chat, game
  sound) from OBS
- Transcribes every track locally with Whisper - optionally noting who is speaking
- Scores each moment using laughter, excitement, keywords, scene changes, and on-screen
  action - no AI model required
- Optionally adds AI scoring and a written description of each clip if you install a
  local model
- Gives you a web page to review clips, approve or reject them, tidy up captions, and
  export
- Exports finished clips with optional captions, and can compile your favourites into a
  highlight reel with transitions

For the full feature list, see [docs/user/FEATURES.md](docs/user/FEATURES.md).

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

YuuClip is a small, independently made app, and its installer isn't signed with a paid
certificate yet. Because of that, Windows SmartScreen shows a blue **"Windows protected
your PC"** box saying the publisher is unknown. This is **not** a virus warning - it
just means Windows doesn't recognise the publisher. To continue:

1. Click **More info**.
2. Click **Run anyway**.

If your antivirus quarantines the installer or a file during setup, allow or restore it
and run again. The app unpacks Python, FFmpeg, and its other components from inside the
installer during first launch, and some antivirus tools flag unfamiliar installers by
reputation alone. Everything stays on your computer - nothing is uploaded.

If first-run setup ever fails, the setup log is saved at
`%APPDATA%\yuu-clip\yuu-clip_install.log` - include it when reporting a problem.

---

## Running from source, the CLI, and tuning

Prefer to run from source, use the command line, or dig into GPU and Whisper model
settings? See **[DEV-README.md](DEV-README.md)**.

To modify the code and contribute, see **[CONTRIBUTING.md](CONTRIBUTING.md)**. Please
report security issues per [SECURITY.md](SECURITY.md) rather than in a public issue.

---

## License

YuuClip is licensed under the [Apache License 2.0](LICENSE) - you are free to use,
modify, and distribute it, including commercially, under that licence's terms.

The Windows installer bundles a prebuilt FFmpeg binary that is separately licensed under
the GPLv3; see [docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md](docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md)
for the full third-party compliance record.
