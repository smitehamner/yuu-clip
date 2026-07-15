"""
Abstract LLM client interface and concrete implementations.

All inference runs locally - yuu-clip never sends transcript data to any external
service. Use make_client(config) to get the right implementation for the current config.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config

# Default completion cap. Callers that emit longer JSON (scene-boundary lists) pass a
# larger value; see scoring/llm._SCENE_BOUNDARY_MAX_TOKENS.
_DEFAULT_MAX_TOKENS = 1024


class VisionNotSupportedError(RuntimeError):
    """Raised when the active backend/model/config can't do image analysis.

    The /api/llm/capabilities endpoint is the cheap pre-check the UI gates on;
    this is the hard backstop that fires if a vision call is attempted anyway
    (e.g. llamacpp with no vision model / mmproj configured).
    """


def _b64_images(images: list[Path]) -> list[str]:
    import base64
    return [base64.b64encode(Path(p).read_bytes()).decode("ascii") for p in images]


class LLMClient(ABC):
    @abstractmethod
    def chat(
        self, messages: list[dict], temperature: float = 0.1,
        max_tokens: int = _DEFAULT_MAX_TOKENS,
    ) -> str: ...

    @abstractmethod
    def available(self) -> tuple[bool, str]: ...

    def chat_vision(
        self, messages: list[dict], images: list[Path], temperature: float = 0.1,
    ) -> str:
        """Send a chat request with *images* attached to the user turn. The default
        refuses; backends that support vision override this."""
        raise VisionNotSupportedError(
            "The active LLM backend does not support image analysis."
        )


class LlamaCppServerClient(LLMClient):
    """Drives a bundled upstream llama.cpp `llama-server` over HTTP. Replaces the old
    in-process llama-cpp-python wheel (which was CPU-only): the server offloads to the
    GPU via its Vulkan backend. Text and image calls use independent models routed to
    separate server processes by the pool (yuu_clip/scoring/llamacpp_server.py)."""

    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        path = self._config.llm_model_path
        if not path:
            return False, "No model file path set - open Settings (gear icon) and set 'Model file path' under LLM scoring"
        if not Path(path).exists():
            return False, f"Model file not found: {path}"
        from yuu_clip.scoring.llamacpp_server import LlamaServerError, resolve_server_binary
        try:
            resolve_server_binary(self._config)
        except LlamaServerError as exc:
            return False, str(exc)
        return True, ""

    def chat(
        self, messages: list[dict], temperature: float = 0.1,
        max_tokens: int = _DEFAULT_MAX_TOKENS,
    ) -> str:
        from yuu_clip.scoring.llamacpp_server import get_server_pool
        return get_server_pool().chat_completion(
            self._config, model_path=self._config.llm_model_path, mmproj_path="",
            messages=messages, temperature=temperature, max_tokens=max_tokens,
        )

    def chat_vision(
        self, messages: list[dict], images: list[Path], temperature: float = 0.1,
    ) -> str:
        vision_model = self._config.llm_vision_model_path
        if not vision_model or not Path(vision_model).exists():
            raise VisionNotSupportedError(
                "llama.cpp image analysis needs a vision model - "
                "set 'Vision model' under Settings -> LLM scoring"
            )
        mmproj = self._config.llm_mmproj_path
        if not mmproj or not Path(mmproj).exists():
            raise VisionNotSupportedError(
                "llama.cpp image analysis needs a vision projector (mmproj .gguf) - "
                "set 'Vision projector' under Settings -> LLM scoring"
            )
        payload_messages = vision_payload_messages(messages, images)
        from yuu_clip.scoring.llamacpp_server import get_server_pool
        return get_server_pool().chat_completion(
            self._config, model_path=vision_model, mmproj_path=mmproj,
            messages=payload_messages, temperature=temperature,
        )


class NullLLMClient(LLMClient):
    """Returned when LLM scoring is disabled."""

    def available(self) -> tuple[bool, str]:
        return False, "LLM scoring is disabled in Settings"

    def chat(
        self, messages: list[dict], temperature: float = 0.1,
        max_tokens: int = _DEFAULT_MAX_TOKENS,
    ) -> str:
        raise RuntimeError("LLM scoring is disabled")

    def chat_vision(
        self, messages: list[dict], images: list[Path], temperature: float = 0.1,
    ) -> str:
        # Report "disabled" (not the base "backend does not support image analysis"),
        # so a vision call while LLM scoring is off surfaces the actual reason.
        raise VisionNotSupportedError("LLM scoring is disabled")


def vision_payload_messages(messages: list[dict], images: list[Path]) -> list[dict]:
    """Build the OpenAI-style chat messages llama-server expects, with *images*
    attached to the user turn as base64 data URLs. Shared by
    LlamaCppServerClient.chat_vision and the frame-analysis subprocess (which POSTs
    to a warm server directly, bypassing the pool)."""
    content: list[dict] = [{"type": "text", "text": _user_text(messages)}]
    content += [
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{data}"}}
        for data in _b64_images(images)
    ]
    return _system_messages(messages) + [{"role": "user", "content": content}]


def _user_text(messages: list[dict]) -> str:
    """Join the user-turn text of *messages* for backends that take images plus a
    single text block. Falls back to a plain instruction so the call is never empty."""
    text = "\n".join(m["content"] for m in messages if m.get("role") == "user")
    return text or "Describe the frames."


def _system_messages(messages: list[dict]) -> list[dict]:
    parts = [m["content"] for m in messages if m.get("role") == "system" and m.get("content")]
    return [{"role": "system", "content": "\n\n".join(parts)}] if parts else []


# Backend name → client class. Unknown backends fall back to the local llamacpp server.
_BACKEND_CLIENTS: dict[str, type[LLMClient]] = {
    "llamacpp": LlamaCppServerClient,
}


def _client_class_for(config: Config) -> type[LLMClient]:
    return _BACKEND_CLIENTS.get(config.llm_backend, LlamaCppServerClient)


def make_client(config: Config) -> LLMClient:
    """The single point where an LLM client is constructed. Enforces the AI privacy mode:
    returns NullLLMClient when generative AI is turned off (llm_enabled False or the AI
    privacy mode is 'none')."""
    from yuu_clip.config import resolve_ai_permissions

    permissions = resolve_ai_permissions(config)
    if not config.llm_enabled or not permissions.allow_llm:
        return NullLLMClient()
    return _client_class_for(config)(config)
