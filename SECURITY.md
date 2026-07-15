# Security Policy

YuuClip is a local-first desktop tool. It runs entirely on the user's own machine, the
web UI binds to `127.0.0.1` only, there is no authentication or multi-tenancy, and the
remote (cloud) AI backend is opt-in and disabled by default. The remote attack surface
is therefore small - but security reports are still welcome.

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
