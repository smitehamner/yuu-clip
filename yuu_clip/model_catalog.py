"""
Curated catalog of recommended text and vision models for LLM scoring and
(from plan 11) image-based clip analysis.

Why a hand-maintained list instead of a live registry fetch: the point of the
catalog is not "every model that exists" but "models we've vetted as a safe,
good default for this tool". The load-bearing constraint is licensing - a user
of yuu-clip may monetize the clips it helps produce, so any model we *recommend*
must carry a licence that permits monetizing model output without a user-side
legal reading. Apache-2.0 and MIT qualify; the Anthropic API's commercial terms
qualify for the hosted Claude backend. Llama's community licence and Google's
Gemma terms impose acceptable-use restrictions that aren't worth pushing onto a
non-lawyer solo user, so those models are recorded here as *rejected* (they keep
working if a user configures them by hand - we simply don't recommend them).

Licences below were verified against the Hugging Face model cards at
implementation time (2026-07-04). Model licences change and vary by parameter
size (e.g. Qwen2.5 7B is Apache-2.0 but the 3B and 72B are not), so re-verify
before adding an entry.

Pattern mirrors export_presets.py: a frozen dataclass plus a static tuple of
built-ins and small, unit-testable lookup helpers. Consumed by the Settings /
wizard model pickers and the /api/llm/capabilities + /api/llm/catalog routes.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Backends a catalog entry can run on. Mirrors Config.llm_backend values.
BACKEND_OLLAMA = "ollama"
BACKEND_LLAMACPP = "llamacpp"
BACKEND_CLAUDE = "claude"

# A recommended model must carry one of these - every one permits monetizing the
# model's output. "Anthropic Commercial Terms" covers the hosted Claude backend.
MONETIZATION_OK_LICENCES: frozenset[str] = frozenset(
    {"Apache-2.0", "MIT", "BSD-3-Clause", "Anthropic Commercial Terms"}
)


def licence_permits_monetization(licence: str) -> bool:
    return licence in MONETIZATION_OK_LICENCES


@dataclass(frozen=True)
class ModelEntry:
    id: str                              # stable catalog id, kebab-case
    display_name: str                    # user-facing
    kinds: frozenset[str]                # subset of {"text", "vision"}
    licence: str                         # SPDX-ish identifier (see MONETIZATION_OK_LICENCES)
    why: str                             # one-line "why this one"
    backends: frozenset[str]             # subset of the BACKEND_* values
    size_gb: Optional[float] = None      # approximate on-disk size (local weights)
    ollama_tag: Optional[str] = None     # `ollama pull` tag (ollama backend)
    gguf_url: Optional[str] = None       # HF repo *page* for the .gguf (llamacpp backend) - not a direct download
    gguf_filename: Optional[str] = None  # exact quant filename at gguf_url/resolve/main/<this>, for one-click download
    mmproj_url: Optional[str] = None     # HF repo page holding the vision projector (llamacpp vision) - usually the same repo as gguf_url
    mmproj_filename: Optional[str] = None  # exact projector filename at mmproj_url/resolve/main/<this>, for one-click vision download
    api_model_id: Optional[str] = None   # provider model id (claude backend)
    recommended: bool = True
    rejected_reason: Optional[str] = None  # set when recommended is False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "kinds": sorted(self.kinds),
            "licence": self.licence,
            "why": self.why,
            "backends": sorted(self.backends),
            "size_gb": self.size_gb,
            "ollama_tag": self.ollama_tag,
            "gguf_url": self.gguf_url,
            "gguf_filename": self.gguf_filename,
            "mmproj_url": self.mmproj_url,
            "mmproj_filename": self.mmproj_filename,
            "api_model_id": self.api_model_id,
            "recommended": self.recommended,
            "rejected_reason": self.rejected_reason,
        }


_TEXT = frozenset({"text"})
_VISION = frozenset({"vision"})
_TEXT_VISION = frozenset({"text", "vision"})


# Curated built-ins. Local text/vision models first, then the hosted Claude
# models (multimodal - they satisfy both text and vision), then the recorded
# rejections so a future session doesn't re-litigate them.
CATALOG: tuple[ModelEntry, ...] = (
    # ── Local text models ──────────────────────────────────────────────────
    ModelEntry(
        id="qwen2.5-7b-instruct",
        display_name="Qwen2.5 7B Instruct",
        kinds=_TEXT,
        licence="Apache-2.0",
        why="Strong all-round 7B - the best local default for clip scoring.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        size_gb=4.7,
        ollama_tag="qwen2.5:7b",
        gguf_url="https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF",
        gguf_filename="Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    ),
    ModelEntry(
        id="mistral-7b-instruct-v0.3",
        display_name="Mistral 7B Instruct v0.3",
        kinds=_TEXT,
        licence="Apache-2.0",
        why="Fast and reliable at returning clean JSON scores.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        size_gb=4.4,
        ollama_tag="mistral:7b",
        gguf_url="https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF",
        gguf_filename="Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    ),
    ModelEntry(
        id="phi-4",
        display_name="Phi-4 (14B)",
        kinds=_TEXT,
        licence="MIT",
        why="Higher-quality scoring when you have the VRAM for a 14B model.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        size_gb=9.1,
        ollama_tag="phi4",
        gguf_url="https://huggingface.co/bartowski/phi-4-GGUF",
        gguf_filename="phi-4-Q4_K_M.gguf",
    ),
    # ── Local vision models (consumed by plan 11's image analysis) ──────────
    # moondream2 listed first: it's the steered default (packaging-strategy-overhaul
    # Wave 6) - smallest download, runs on both backends, recommended-model pickers
    # render the catalog in this order so it's the first vision option a user sees.
    ModelEntry(
        id="moondream2",
        display_name="moondream2",
        kinds=_VISION,
        licence="Apache-2.0",
        why="Recommended default - tiny and fast, runs on low VRAM for quick frame checks.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        size_gb=1.8,
        ollama_tag="moondream",
        gguf_url="https://huggingface.co/ggml-org/moondream2-20250414-GGUF",
        gguf_filename="moondream2-text-model-f16_ct-vicuna.gguf",
        mmproj_url="https://huggingface.co/ggml-org/moondream2-20250414-GGUF",
        mmproj_filename="moondream2-mmproj-f16-20250414.gguf",
    ),
    ModelEntry(
        id="smolvlm2-2.2b-instruct",
        display_name="SmolVLM2 2.2B Instruct",
        kinds=_VISION,
        licence="Apache-2.0",
        why="Very small, CPU-friendly vision model for machines without a GPU.",
        backends=frozenset({BACKEND_LLAMACPP}),
        size_gb=2.2,
        gguf_url="https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF",
        gguf_filename="SmolVLM2-2.2B-Instruct-Q4_K_M.gguf",
        mmproj_url="https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF",
        mmproj_filename="mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf",
    ),
    ModelEntry(
        id="qwen2.5-vl-7b-instruct",
        display_name="Qwen2.5-VL 7B Instruct",
        kinds=_VISION,
        licence="Apache-2.0",
        why="Higher-quality descriptions when you have the VRAM for a 7B model.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        size_gb=6.0,
        ollama_tag="qwen2.5vl:7b",
        gguf_url="https://huggingface.co/unsloth/Qwen2.5-VL-7B-Instruct-GGUF",
        gguf_filename="Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
        mmproj_url="https://huggingface.co/unsloth/Qwen2.5-VL-7B-Instruct-GGUF",
        mmproj_filename="mmproj-F16.gguf",
    ),
    # ── Hosted Claude models (multimodal → text + vision) ───────────────────
    ModelEntry(
        id="claude-haiku-4-5",
        display_name="Claude Haiku 4.5",
        kinds=_TEXT_VISION,
        licence="Anthropic Commercial Terms",
        why="Fast and cheap - a good default for the Claude backend.",
        backends=frozenset({BACKEND_CLAUDE}),
        api_model_id="claude-haiku-4-5-20251001",
    ),
    ModelEntry(
        id="claude-sonnet-5",
        display_name="Claude Sonnet 5",
        kinds=_TEXT_VISION,
        licence="Anthropic Commercial Terms",
        why="Smarter than Haiku at a higher per-token cost.",
        backends=frozenset({BACKEND_CLAUDE}),
        api_model_id="claude-sonnet-5",
    ),
    ModelEntry(
        id="claude-opus-4-8",
        display_name="Claude Opus 4.8",
        kinds=_TEXT_VISION,
        licence="Anthropic Commercial Terms",
        why="Most capable Claude model - highest cost, best judgement.",
        backends=frozenset({BACKEND_CLAUDE}),
        api_model_id="claude-opus-4-8",
    ),
    # ── Recorded rejections (licence - do not re-litigate) ──────────────────
    ModelEntry(
        id="llama-3.1-8b-instruct",
        display_name="Llama 3.1 8B Instruct",
        kinds=_TEXT,
        licence="Llama 3.1 Community License",
        why="Capable 8B, but see rejected_reason.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        recommended=False,
        rejected_reason=(
            "Llama's community licence carries acceptable-use restrictions and "
            "is not clearly monetization-safe without a user-side legal reading."
        ),
    ),
    ModelEntry(
        id="gemma-3-12b-it",
        display_name="Gemma 3 12B",
        kinds=_TEXT_VISION,
        licence="Gemma Terms of Use",
        why="Strong multimodal model, but see rejected_reason.",
        backends=frozenset({BACKEND_OLLAMA, BACKEND_LLAMACPP}),
        recommended=False,
        rejected_reason=(
            "Google's Gemma Terms of Use impose acceptable-use restrictions; "
            "excluded from recommendations to keep licensing simple for the user."
        ),
    ),
)

_BY_ID: dict[str, ModelEntry] = {entry.id: entry for entry in CATALOG}


def model_by_id(model_id: str) -> Optional[ModelEntry]:
    return _BY_ID.get(model_id)


def recommended_models() -> list[ModelEntry]:
    return [entry for entry in CATALOG if entry.recommended]


def text_models() -> list[ModelEntry]:
    return [entry for entry in recommended_models() if "text" in entry.kinds]


def vision_models() -> list[ModelEntry]:
    return [entry for entry in recommended_models() if "vision" in entry.kinds]


def catalog_for_backend(backend: str) -> list[ModelEntry]:
    """Recommended models runnable on *backend*, ordered as in CATALOG."""
    return [entry for entry in recommended_models() if backend in entry.backends]


def ollama_vision_tag_bases() -> frozenset[str]:
    """Tag bases (the part before ':') of recommended Ollama vision models - the
    single source of truth for "is this Ollama model vision-capable". Consumed by
    the /api/llm/capabilities check and plan 11's vision-availability gate."""
    return frozenset(
        entry.ollama_tag.split(":", 1)[0].strip().lower()
        for entry in vision_models()
        if entry.ollama_tag
    )
