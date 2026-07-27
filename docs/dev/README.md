# docs/dev - developer documentation index

Read order for someone new to the codebase:

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - the human on-ramp: pipeline flow,
   two-process model, data model, backend seams, and the top landmines.
2. **[CLI-AND-INTERNALS.md](CLI-AND-INTERNALS.md)** - the `yuuclip` CLI, scoring
   engine internals, and the on-disk project layout / config keys.
3. **[USE_CASES.md](USE_CASES.md)** - the authoritative end-to-end use-case catalog
   (`UC-` IDs), each tagged with its automation status and test coverage.

Also here:

- **[LAYOUT.md](LAYOUT.md)** - the file-by-file map of the repo.
- **[HOW-TO-RELEASE.md](HOW-TO-RELEASE.md)** / **[PACKAGING-TIERS.md](PACKAGING-TIERS.md)** -
  release process and what ships in each install tier.
- **`llm/`** - agent-maintained reference docs (GLOSSARY, DOC-CLAIMS fact registry,
  review maps). Exhaustive by design; humans usually want the files above instead.
- **`testing/`** - manual release sign-off checklists (installed-app, packaged-app,
  regression, test-video matrix).
- **`third-party-source/`** + [THIRD-PARTY-NOTICES-FFMPEG.md](THIRD-PARTY-NOTICES-FFMPEG.md) -
  GPL source-accompaniment for the bundled FFmpeg.

Contributor setup and the `yuu-dev` commands live in
[CONTRIBUTING.md](../../.github/CONTRIBUTING.md).
