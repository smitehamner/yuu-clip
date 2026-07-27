# Security Policy

YuuClip is a local-first desktop tool. It runs entirely on the user's own machine and
does all AI inference on-device - there is no cloud/remote AI backend and no path that
sends your transcripts or media to a third-party API. The web UI binds to `127.0.0.1`
only, and there is no authentication or multi-tenancy (it is a single-user tool by
design). The remote attack surface is therefore small - but security reports are still
welcome.

## Trust model

YuuClip assumes a **single user on a trusted machine**, reached over **loopback only**.
What that means concretely:

**What it defends against**

- **Other web pages you have open.** The API is unauthenticated, so a page in your
  browser could otherwise fire requests at `127.0.0.1`. A request-provenance guard
  rejects browser requests that are cross-site (`Sec-Fetch-Site`/`Origin`) or that carry
  a non-loopback `Host` (DNS rebinding), with a plain 403. Non-browser callers - the
  desktop shell, the `yuu-dev` CLI - are unaffected.
- **Path traversal / zip slip.** File-serving routes resolve every user-supplied name
  against a fixed base directory, and project restore refuses any archive member whose
  path would land outside the target folder.
- **Command injection via filenames.** Every subprocess (ffmpeg, ffprobe, yt-dlp,
  Whisper) is launched with an argument list, never a shell string.
- **URL import abuse.** Import-from-URL only accepts `https` YouTube/Twitch links,
  validated before yt-dlp runs.

**What it does NOT defend against (out of scope by design)**

- **Multi-user or hostile-local-process threats.** Any program already running as you can
  reach the loopback socket; the loopback API is not a barrier against local malware.
- **No transport encryption on loopback**, and **no password**. If you deliberately run
  `yuu-dev serve --host 0.0.0.0` (or any non-loopback address) you expose an
  unauthenticated API to your whole network - the app prints a loud warning when you do
  this. Do not do it on an untrusted network.
- **Malicious media files.** Opening a recording hands it to ffmpeg/Whisper to parse, the
  same trust decision any media player makes; a crafted file that exploits a decoder is
  not something YuuClip sandboxes.
- **Model-download integrity.** Recommended model weights are downloaded over HTTPS from
  their published Hugging Face repositories; integrity rests on TLS and trusting those
  repositories - there is no independent hash/signature pin. Only models from the built-in
  catalog are offered; the download URL is never taken from user input.

## A note on logs and backups (personal data)

Diagnostic **logs** (`.yuu-clip/yuu-clip.log` and the in-app "Download Log") are
automatically scrubbed before they are written: the account-name segment of home paths
is replaced with `<user>`, and known credential shapes (Hugging Face tokens, API keys,
bearer/query secrets) are masked. A log is therefore relatively safe to attach to a
support request, though it still names recordings and operational detail - skim it first.

Project **backup archives are not scrubbed**. They contain the project database - full
transcripts, speaker names - and the real, absolute source-media paths (which include
your username). Treat a backup as sensitive: review it before sharing, and prefer sending
a redacted log over a backup when reporting a problem.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's private vulnerability reporting: open the repository's
**Security** tab and click **Report a vulnerability**. That creates a private advisory
only the maintainer can see.

Please include:

- What the issue is and its impact
- Steps to reproduce (a proof of concept if you have one)
- The version or commit you tested, and your OS

## What to expect

This is maintained by one person on a best-effort basis. You will get an acknowledgement
as soon as is practical. There is no bug bounty. Once a fix is available, the advisory
will be published with credit to the reporter unless you prefer to stay anonymous.

## Supported versions

Only the latest release and the `main` branch are supported. Fixes land there rather
than being backported.
