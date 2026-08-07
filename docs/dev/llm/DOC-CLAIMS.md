# Doc claims registry

One row per volatile, cross-cutting fact - the kind that has drifted out of sync
between the code and the many surfaces that state it. **When you change one of these
facts, update the code AND every surface listed in its row in the same change**, then
run `yuu-dev test-api` (the `tests/unit/test_doc_claims.py` guards run in the unit
tier). This registry is the human-readable map; the tests cover the subset that has
actually gone stale before.

Source of truth for each fact is in the **Code truth** column. User-facing text must use
the glossary term (`docs/dev/llm/GLOSSARY.md`), even where the code name differs.

| # | Fact | Code truth | Surfaces that state it |
|---|------|-----------|------------------------|
| 1 | Scoring has **four** axes: Funny, Dramatic, Action, Visual | `scoring/` scorers + `Config.score_*_weight` (funny/dramatic/action = 1.0, visual = 0.5) | `docs/user/OVERVIEW.md` (What the scores mean), `docs/user/FEATURES.md` (What the scores mean + Visual moments), Getting Started modal (`web/static/partials/modals/getting-started.html`, `index.html`), in-app glossary (`web/static/glossary.md`), clip list + detail bars (`web/static/clips/clips.js`), Settings scoring-weight sliders (`web/static/partials/regions/settings-panel.html`, `index.html`), walkthrough Ch.3 score-icon row. NOTE: the LLM prompt (`scoring/llm.py`) correctly says "three dimensions" - the LLM rates only Funny/Dramatic/Action; Visual is model-free (`scoring/visual.py`) |
| 2 | Overall = weighted blend of all four (Visual half-weight) | `Config.score_*_weight`; overall denominator | `docs/user/OVERVIEW.md`, `docs/user/FEATURES.md`, Getting Started modal (`web/static/partials/modals/getting-started.html`, `index.html`), in-app glossary (`web/static/glossary.md`) |
| 3 | Baseline signal scoring works with **no model**; the LLM only adds descriptions + a semantic read; the Visual axis + silent-but-visual candidates cover no-dialogue moments | `make_client` -> `NullLLMClient` fallback; `scoring/visual.py`; `segments/visual_windower.py` | `README.md`, `docs/user/OVERVIEW.md`, `docs/user/FEATURES.md`, wizard LLM-scoring section (`electron/setup.html`), walkthrough "What you'll need" |
| 4 | The phrase "the scoring reads transcripts, not video" is **false** | Visual axis reads the picture | must NOT appear in `docs/user/**` (guarded) |
| 5 | Whisper per-model **download size** vs **peak VRAM** (float16/CUDA): tiny ~75 MB / ~0.2 GB; base ~140 MB / ~0.4 GB; small ~465 MB / ~1 GB; medium ~1.5 GB / ~2.8 GB; large-v3 ~2.9 GB / ~4.2 GB | Measured peak (float16/CUDA, beam 5, word timestamps); download = CT2 model.bin size | `DEV-README.md` (Whisper table), `docs/user/PERFORMANCE.md` (recommended specs), `docs/user/OVERVIEW.md` (How long does it take), `docs/dev/CLI-AND-INTERNALS.md` (`--model`), Settings model `<option>`s (`web/static/partials/regions/settings-panel.html`, `index.html`) + analyze-panel model `<option>`s (`web/static/partials/regions/main-panel.html`, `index.html`), wizard Basics model `<option>`s (`setup.html`) |
| 6 | Default Whisper model = **base** (int8 on CPU, float16 on CUDA) | `Config.whisper_model` | `DEV-README.md` (Default row, guarded), `docs/dev/CLI-AND-INTERNALS.md` (`--model` default), analyze-panel selected default (`web/static/partials/regions/main-panel.html`, `index.html`) + Settings selected default (`web/static/partials/regions/settings-panel.html`, `index.html`), `videos.js` fallback |
| 7 | Recommended LLM (text) model: **Qwen2.5 7B Instruct**, Apache-2.0, **~4.7 GB** | `model_catalog.py` (`text_models()[0]`); wizard `DEFAULT_LLAMACPP_MODEL` (`electron/constants.js`) mirrors it | `README.md`, wizard (`setup.html` radio + download button + Advanced note), Settings model catalog (`modelcatalog.js`), About/notices |
| 8 | Glossary-banned code terms ("ingest", "probe", "profile") do not appear in user-facing prose; use "analyze/analysis", "inspect", "track layout" | `docs/dev/llm/GLOSSARY.md` | `docs/user/**` (guarded) |
| 9 | Keyboard shortcuts: J/K nav, A approve, R reject, **U mark unreviewed**, Space play, E export, Ctrl+Z undo, ? panel | `web/static/core/shortcuts.js` | `docs/user/OVERVIEW.md` (keyboard table), Getting Started modal (`web/static/partials/modals/getting-started.html`, `index.html`) + Keyboard Controls panel (`web/static/partials/modals/controls.html`, `index.html`) |
| 10 | Analysis-time estimates (RTX vs CPU; transcription dominates) | `pipeline/` timing | `docs/user/PERFORMANCE.md`, `docs/user/OVERVIEW.md` (How long does it take) |
| 11 | Clip vs Scene durations: a **clip** is a punchy **15-90 s** bit; a **scene** is a longer **1-5 min** contextual arc | `Config.min_clip_ms` (15 s clip floor); `Config.scene_min_ms`/`scene_max_ms` (60_000/300_000 = 1-5 min) | sidebar kind-chip tooltips (`web/static/partials/regions/sidebar.html`, `index.html`), scene-badge tooltip (`web/static/clips/clips.js`), Generate-scenes settings note (`web/static/partials/regions/settings-panel.html`, `index.html`), Getting Started modal Key-concepts row (`web/static/partials/modals/getting-started.html`, `index.html`), in-app glossary (`web/static/glossary.md`), dev glossary (`docs/dev/llm/GLOSSARY.md`), `web/static/help/FEATURES.md`, LLM scene prompt (`scoring/llm.py`) |

Guarded rows (a `tests/unit/test_doc_claims.py` test binds them to code): 1 (modal names all
four axes), 4 (stale phrase absent), 6 (DEV-README default matches config), 7 (recommended
size matches catalog in README + wizard), 8 (banned terms absent). Rows 2/3/5/9/10/11 are
sweep-by-hand: update every listed surface when the fact changes.
