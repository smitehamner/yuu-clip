# Packaging tiers — what ships, what's fetched, what's a choice

This is the durable policy that governs how yuu-clip components reach the user's
machine. It exists to kill the "installed program that keeps asking to install more
things" UX. Every optional component lands in exactly one tier.

## The three tiers

- **Tier A — In the box.** A bundled Python package, present on first launch, no user
  action. All default-feature packages live here. Offline-installable from the
  wheelhouse (`scripts/fetch-wheelhouse.ps1`).
- **Tier B — Auto-fetched model, framed.** A model a feature needs, downloaded on
  first use with a progress UI and a plain-English "downloading X so Y works" message.
  Degrades gracefully offline — the feature waits or skips; the app never breaks. No
  "click to install" button.
- **Tier C — Genuine choice.** The only two things a user legitimately decides:
  **GPU acceleration** (hardware-dependent opt-in) and **remote vs. local AI**
  (privacy/cost — the Claude backend + `anthropic`). These stay explicit by design.

**Rule for the future:** a new feature is Tier A or B by default. Tier C requires a
real user tradeoff (hardware, or privacy/cost). "It's optional so make it a button" is
banned.

## Two senses of "default"

1. **Available out of the box** — package bundled (A), model auto-fetched (B).
2. **Actively runs in every analyze** — the feature is on, adding processing time.

For light features these coincide. For heavy ones (vision especially) a feature can be
available-by-default but conservatively-on / one-toggle-away, so a first analyze isn't
surprisingly slow.

## Licence gate (load-bearing)

Any model the app defaults to must carry a licence that permits monetizing its output
(Apache-2.0 / MIT / BSD-3-Clause; Anthropic Commercial Terms for the hosted backend).
Llama / Gemma / bespoke-restrictive licences are out of defaults. See
`yuu_clip/model_catalog.py` and `tests/test_model_catalog.py`.

## Licence verdicts — models promoted to default by the packaging overhaul

Verified against the Hugging Face model cards on 2026-07-06. All **PASS** the
monetization gate; no feature had to be re-routed.

| Feature | Model | Model ID | Licence (verified) | Verdict |
|---|---|---|---|---|
| Speaker labels | ECAPA-TDNN (SpeechBrain) | `speechbrain/spkrec-ecapa-voxceleb` | Apache-2.0 | ✅ PASS |
| Laugh / audio-event | AST (AudioSet) | `MIT/ast-finetuned-audioset-10-10-0.4593` | **BSD-3-Clause** | ✅ PASS |
| Similarity embeddings | BGE small en v1.5 | `BAAI/bge-small-en-v1.5` | MIT | ✅ PASS |
| Vision (default pick) | moondream2 | `vikhyatk/moondream2` | Apache-2.0 | ✅ PASS |
| Vision (alt) | SmolVLM2 2.2B | `HuggingFaceTB/SmolVLM2-2.2B-Instruct` | Apache-2.0 | ✅ PASS |
| Vision (alt) | Qwen2.5-VL **7B** | `Qwen/Qwen2.5-VL-7B-Instruct` | Apache-2.0 (7B only) | ✅ PASS |

Notes:

- **AST is BSD-3-Clause, not MIT.** The `MIT/` prefix in the model ID is the Hugging
  Face **org namespace** (MIT the university), not the licence. BSD-3-Clause is in the
  monetization-OK set, so this is fine — but do not "correct" the ID to drop `MIT/`.
  The pyproject `audio-model` extra already documents this.
- **AudioSet dataset terms** (the AST training data) are separate from the checkpoint
  licence. We ship and run the trained classifier (BSD-3-Clause), not the dataset, and
  we don't redistribute AudioSet audio — so the checkpoint licence governs our use.
- **Qwen2.5-VL licence varies by size:** the **7B** is Apache-2.0; the 3B and 72B are
  not. Only the 7B is catalog-recommended.
- Supporting packages: `fastembed` is Apache-2.0, `onnxruntime` is MIT — both fine.

## Default vision model

**moondream2** is the recommended default: smallest (1.8 GB), runs on both the
llamacpp and Ollama backends, and is purpose-built for describing on-screen content.
SmolVLM2 (2.2 GB, llamacpp-only, CPU-friendly) and Qwen2.5-VL-7B (6 GB, higher quality)
remain catalog alternatives.

## Target classification (end state)

| Component | Package(s) → Tier A | Model → Tier B | Runs by default? |
|---|---|---|---|
| Speaker labels | speechbrain, scikit-learn | ECAPA | Yes |
| LLM scoring | llama-cpp-python (CPU wheel) | GGUF catalog default | Yes (core) |
| Laugh / audio-event | transformers, soundfile | AST | Yes |
| Better similarity | fastembed | bge-small | Yes (replaces tfidf) |
| Vertical auto-framing | mediapipe | face-detector asset | Available; runs on vertical export |
| Vision analysis | (uses LLM backend) | moondream2 | Available; conservatively-on |
| GPU acceleration | — | CUDA wheels | Tier C — opt-in |
| Remote Claude | anthropic | — | Tier C — privacy choice |

## Installer-size impact (Wave 1)

Bundling the Tier-A default-feature packages into the base dependencies grows the
offline wheelhouse by **~272 MB** (uncompressed wheels), from 53 wheels / ~135 MB to
~105 wheels / ~407 MB. The biggest contributors: `torch` CPU build (~117 MB),
`opencv-contrib-python` (~51 MB, pulled by mediapipe — note base already ships
`opencv-python` for scenedetect, so the two OpenCV builds coexist), `scipy` (~35 MB),
`transformers` (~11 MB), `mediapipe` (~10 MB). The prebuilt llama-cpp-python CPU wheel
adds another ~6.5 MB. Larger installer is an accepted tradeoff per the plan's locked
decisions. Every added wheel resolves to a cp312 win_amd64 binary (verified with
`--only-binary=:all:`, zero sdist fallbacks).

The full wave plan lives outside the repo at
`000_project_planning/finalized_plans/yuu-clip_plans/plans/packaging-strategy-overhaul/INDEX.md`.
