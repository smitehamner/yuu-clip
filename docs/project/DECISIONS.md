# Product & distribution decisions

Deliberate scope calls about the product and how it ships - things we chose *not*
to do, and why, so the reasoning survives and the roadmap stays lean. This is the
home for "we decided against X" records that would otherwise clutter ROADMAP.md as
perpetual open items. Most recent first.

(For code-quality "keep-as-is" calls from review passes, see
`docs/dev/llm/REVIEW_DECISIONS.md` instead.)

---

## Local-only tool - remove the remote (Claude) AI backend entirely (2026-07-15)

**Decision:** YuuClip is a local-only surface. Remove the remote/hosted LLM backend
(Anthropic's Claude API) completely rather than keeping it hidden behind the WS4
distribution gate. All inference (speech-to-text and LLM scoring/vision) runs on the
user's machine; nothing they record ever leaves it.

**What was removed:**

- `ClaudeClient` and the `claude` value from the `llm_backend` seam - `make_client`
  now resolves to the local `llamacpp` backend or the `NullLLMClient` fallback only.
- The distribution gate: `Config.remote_ai_enabled`, the `YUU_REMOTE_AI` env var, and
  `config.remote_ai_allowed()`.
- The `remote_ok` AI-privacy mode and the `allow_remote` permission. `ai_privacy_mode`
  is now `none` | `local_only`; `AiPermissions` carries only `allow_llm`.
- The `claude_api_key` / `claude_model` / `claude_timeout_s` config fields, the Claude
  catalog entries + `BACKEND_CLAUDE` + `api_model_id`, and every Claude/remote control
  in Settings and the Electron setup wizard.
- The `anthropic` dependency (and its `distro` / `jiter` transitive deps), the
  `live_remote` pytest marker, and the billed `test_remote_live` smoke test.

**Why:** the remote path was unverified end-to-end and had been inert behind the gate
since WS4. A local-only positioning is simpler to reason about, is a genuine privacy
selling point for a tool aimed at non-developers, and drops a paid/cloud dependency
surface (keys, billing, network failure modes, an SDK) that no shipped build used.

**Kept deliberately:** the `LLMClient` ABC + `make_client` factory seam stays (one real
backend today, `llamacpp`), so adding a future *local* backend is a registration, not a
rewrite. Do not re-introduce a remote backend without an explicit product decision that
supersedes this one.

---

## Positioning - lead with the talk-heavy strength (2026-07-14)

Standing copy guidance. YuuClip is at heart a talk-heavy analyzer (transcript-driven
clip generation + scoring); its sweet spot is talk-heavy content:
RP, voice chat, streaming (a streamer talking to chat), podcasts, and narrative /
commentary. The silent, visual gameplay path exists as a first-pass complement (Visual
scoring axis, model-free on-screen-activity detection, opt-in visual clip generation,
textless-clip UX, opt-in vision-LLM descriptions - shipped 2026-07-13), but is not a
match for a dedicated gameplay-clip tool.

**Directive:** user-facing marketing and onboarding copy must lead honestly with the
talk-heavy strength and must not claim general "gaming highlights". Applied to the
copy surfaces on 2026-07-14 (app empty-state, README tagline, Electron package
description, installer intro dialog).

---

## Code signing - stay unsigned for now (2026-07-14)

**Decision:** do not code-sign the Windows installer. Rely on the documented install
instructions (the SmartScreen "More info -> Run anyway" note) to get users past the
"unknown publisher" warning.

**Why:** there is no free path that also removes the SmartScreen warning, and the paid
paths aren't justified at the current (near-solo) distribution scale:

- *Self-signed* - free, but no trust chain; users still get the full block. Useless here.
- *SignPath.io Foundation* - free but requires a **public** OSS repo; yuu-clip is private.
- *Azure Trusted Signing* (~$10/mo) or *Certum OSS* (~$30/yr) - cheap OV certs, but an OV
  cert only earns SmartScreen trust after building download reputation over weeks/months,
  and eligibility needs identity/legal-entity verification.
- *EV cert* (~$300/yr, hardware token) - the only option with **immediate** SmartScreen
  trust; never free.

**Revisit if:** unsigned-install friction becomes a real adoption blocker.

**Implementation note for when we do sign:** electron-builder supports both cert types via
`CSC_LINK` / `CSC_KEY_PASSWORD`; remove the `CSC_IDENTITY_AUTO_DISCOVERY=false` override in
`build-release.ps1` at that point.
