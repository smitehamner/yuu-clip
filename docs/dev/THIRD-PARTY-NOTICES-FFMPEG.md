# Third-Party Notices — Bundled FFmpeg

yuu-clip's Windows installer bundles a prebuilt FFmpeg binary (`ffmpeg.exe` /
`ffprobe.exe`) so end users never need to install FFmpeg themselves. This binary is
licensed under the **GNU General Public License, version 3** (GPLv3) — it statically
links `libx264` (GPL), and the build itself was compiled with `--enable-gpl
--enable-version3`.

This document records the compliance facts for that binary. See
`docs/dev/plans/ffmpeg-gpl-bundling.md` for the implementation plan and locked
decisions behind this arrangement.

## What's bundled

| | |
|---|---|
| Build | `ffmpeg-8.1.2-essentials_build.zip` |
| Publisher | [GyanD/codexffmpeg](https://github.com/GyanD/codexffmpeg) — Gyan Doshi's Windows FFmpeg builds, mirrored to GitHub Releases (a durable, version-tagged host — unlike BtbN/FFmpeg-Builds' mutable "latest" tag) |
| Download | https://github.com/GyanD/codexffmpeg/releases/download/8.1.2/ffmpeg-8.1.2-essentials_build.zip |
| SHA256 | `db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec` |
| FFmpeg version | 8.1.2 (upstream commit [`38b88335f9`](https://github.com/FFmpeg/FFmpeg/commit/38b88335f9)) |
| Bundled files | `ffmpeg.exe`, `ffprobe.exe` only (`ffplay.exe`, `doc/`, `presets/` from the archive are not shipped — unused by yuu-clip) |
| License | **GPL v3** (per the build's own `README.txt`: `--enable-gpl --enable-version3`) |
| `libx264` included | **Yes** — confirmed via the build's `configure` flags (`--enable-libx264`) and by running an actual `libx264` encode, which reports `264 - core 165 r3223 0480cb0` |
| Nonfree components | **None** — `--enable-nonfree` is not set; the build's external-library list does not include `libfdk_aac`, DeckLink, or any other nonfree-only component. Enforced by `tests/test_ffmpeg_licensing.py`. |

Pinned in `scripts/fetch-ffmpeg-runtime.ps1`, which downloads and SHA256-verifies this
exact asset at build time, extracting only `ffmpeg.exe`/`ffprobe.exe` into
`build/ffmpeg-runtime/` for `extraResources` packaging.

## Source accompaniment (GPLv3 §6)

Per the locked decision in the bundling plan, yuu-clip ships the **exact matching
source** alongside every installer release (not a written offer) — satisfying
GPLv3 §6's source-accompaniment requirement directly:

| Component | Archive | SHA256 | Source |
|---|---|---|---|
| FFmpeg 8.1.2 | `ffmpeg-8.1.2.tar.xz` | `464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c` | Official release tarball, https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz |
| libx264 (commit `0480cb0`) | `x264-0480cb0.tar.gz` | `8f3073feb4b98eba64f0439621cde77192d44799fd04018edb1cce80d7322bb9` | VideoLAN GitLab archive of the exact linked commit, https://code.videolan.org/videolan/x264/-/archive/0480cb0/x264-0480cb0.tar.gz |

`scripts/fetch-ffmpeg-runtime.ps1` fetches the FFmpeg source tarball at build time
and copies both archives into `build/ffmpeg-source/`; `scripts/build-release.ps1`
copies them into `build/installer/`, the same directory the `.exe` installer lands
in, so both archives ship side-by-side with every release build.

**The libx264 source archive is vendored in-repo** at
`docs/dev/third-party-source/x264-0480cb0.tar.gz` (tracked via Git LFS — see
`.gitattributes`) rather than downloaded at build time. VideoLAN's GitLab
(`code.videolan.org`) is the only distribution point for x264 source (it has no
numbered releases, only git commits) and sits behind an Anubis anti-bot
proof-of-work challenge that blocks scripted HTTP clients — a build script cannot
solve a JS challenge, so automated re-fetching isn't reliable. The fetch script
verifies the vendored file's hash against the pin above before copying it, so a
stale/unedited vendored file is caught the same way a bad download would be.

**Hosting caveat:** the yuu-clip GitHub repo is currently **private**, so it cannot
yet serve as a durable *public* mirror of these source archives for third parties who
only receive the installer directly (not via GitHub). Once the repo goes public,
revisit attaching these archives to GitHub Releases as the long-term canonical host
(see `docs/dev/HOW-TO-RELEASE.md`'s existing "future" release flow).

## Re-pinning

Bumping the bundled FFmpeg version is a **three-file change**: the binary pin in
`scripts/fetch-ffmpeg-runtime.ps1`, the recorded version/hashes in this document, and
the re-archived source (both the FFmpeg source re-fetch and, if the linked x264
commit changed, a new vendored `docs/dev/third-party-source/x264-<commit>.tar.gz`).
`tests/test_ffmpeg_licensing.py` fails the suite if the fetch script's pinned version
and this document's recorded version disagree, or if a nonfree-only component name
appears anywhere in this document (guarding against ever describing a nonfree pin as
compliant). See the "Bundled FFmpeg" section of `docs/dev/HOW-TO-RELEASE.md` for the
full re-pin procedure.

## What this does *not* change

- **`av`/PyAV** (used by `faster-whisper` for audio decoding) stays pinned to the
  `basswood-io` **LGPL-only** build — unrelated to this `ffmpeg.exe`/`ffprobe.exe`
  binary, decoding-only, no GPL codec need there.
- FFmpeg encode codec choices (`libx264`/`aac`) are unchanged — this plan only
  changes where the `ffmpeg`/`ffprobe` binaries are resolved from, not what
  arguments/filters/codecs yuu-clip passes to them.
- yuu-clip's own code remains under its own licence: it invokes the bundled FFmpeg
  binary as a **separate subprocess** (`find_ffmpeg()` + `subprocess.run`), which is
  mere aggregation, not linking — yuu-clip's Python/JS source is not a derivative
  work of FFmpeg or libx264 and carries no GPL obligation itself.

## GPL license text

The full GPLv3 text is bundled as an installed file at
`electron/resources/LICENSE-FFMPEG-GPL.txt` (copied verbatim from the bundled
build's own `LICENSE` file, `extraResources`'d to the installed app directory as
`LICENSE-FFMPEG-GPL.txt`).
