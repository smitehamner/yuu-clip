# Manual Regression Checklist (retired)

This dev-server feature checklist has been superseded. Its content was merged into the
use-case catalog and its release-sign-off view:

- **Use-case catalog** (the single source of truth): [../USE_CASES.md](../USE_CASES.md)
- **Installed-app release checklist** (the manual walk, per use case, against the
  packaged build): [installed-app-checklist.md](installed-app-checklist.md)
- **Packaged-only surface verification** (install, environment bring-up, wizard, native
  `yuu-media://` protocol, model downloads, lifecycle): [packaged-app-verification.md](packaged-app-verification.md)

Every step that lived here now maps to a `UC-` entry in the catalog. Run the installed-app
checklist for a release; use browser-dev mode (`yuu-dev serve`) plus the automated
`yuu-dev test-ui` suite during development.
