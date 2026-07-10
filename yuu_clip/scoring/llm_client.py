"""
Abstract LLM client interface and concrete implementations.

is_remote = True means the backend sends data to an external service and
incurs API costs.  is_remote = False means inference runs locally.

Use make_client(config) to get the right implementation for the current config.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import TYPE_CHECKING

from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from yuu_clip.config import Config

_log = get_logger(__name__)


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
    is_remote: bool = False

    @abstractmethod
    def chat(self, messages: list[dict], temperature: float = 0.1) -> str: ...

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
    is_remote = False

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

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        from yuu_clip.scoring.llamacpp_server import get_server_pool
        return get_server_pool().chat_completion(
            self._config, model_path=self._config.llm_model_path, mmproj_path="",
            messages=messages, temperature=temperature,
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
        content: list[dict] = [{"type": "text", "text": _user_text(messages)}]
        content += [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{data}"}}
            for data in _b64_images(images)
        ]
        payload_messages = _system_messages(messages) + [{"role": "user", "content": content}]
        from yuu_clip.scoring.llamacpp_server import get_server_pool
        return get_server_pool().chat_completion(
            self._config, model_path=vision_model, mmproj_path=mmproj,
            messages=payload_messages, temperature=temperature,
        )


class ClaudeClient(LLMClient):
    """Sends requests to the Anthropic API - remote, billed per token."""
    is_remote = True

    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        if not self._config.claude_api_key:
            return False, "No Claude API key set - open Settings (⚙) and enter your Anthropic API key under LLM scoring"
        try:
            import anthropic
        except ImportError:
            return False, "anthropic package not installed (pip install anthropic)"
        # Presence of a key doesn't mean it's valid; a bad/expired key otherwise
        # passes the pre-flight and then fails silently on every clip. models.list()
        # is a free GET that verifies auth + reachability.
        try:
            anthropic.Anthropic(
                api_key=self._config.claude_api_key,
                timeout=self._config.claude_timeout_s,
            ).models.list()
        except anthropic.AuthenticationError:
            return False, "Claude API key was rejected - check the key in Settings (⚙)"
        except AttributeError:
            return True, ""  # anthropic SDK too old for the Models API - trust the key
        except Exception as exc:
            return False, f"Couldn't reach the Claude API - check your connection: {exc}"
        return True, ""

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        import anthropic
        client = anthropic.Anthropic(
            api_key=self._config.claude_api_key,
            timeout=self._config.claude_timeout_s,
        )
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        chat_messages = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
        system = "\n\n".join(system_parts)
        response = client.messages.create(
            model=self._config.claude_model,
            max_tokens=1024,
            temperature=temperature,
            **({"system": system} if system else {}),
            messages=chat_messages,
        )
        return response.content[0].text

    def chat_vision(
        self, messages: list[dict], images: list[Path], temperature: float = 0.1,
    ) -> str:
        import anthropic
        client = anthropic.Anthropic(
            api_key=self._config.claude_api_key,
            timeout=self._config.claude_timeout_s,
        )
        content: list[dict] = [
            {"type": "image", "source": {
                "type": "base64", "media_type": "image/jpeg", "data": data,
            }}
            for data in _b64_images(images)
        ]
        content.append({"type": "text", "text": _user_text(messages)})
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        response = client.messages.create(
            model=self._config.claude_model,
            max_tokens=1024,
            temperature=temperature,
            **({"system": system} if system else {}),
            messages=[{"role": "user", "content": content}],
        )
        return response.content[0].text


class NullLLMClient(LLMClient):
    """Returned when LLM scoring is disabled."""
    is_remote = False

    def available(self) -> tuple[bool, str]:
        return False, "LLM scoring is disabled in Settings"

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        raise RuntimeError("LLM scoring is disabled")


def _user_text(messages: list[dict]) -> str:
    """Join the user-turn text of *messages* for backends that take images plus a
    single text block. Falls back to a plain instruction so the call is never empty."""
    text = "\n".join(m["content"] for m in messages if m.get("role") == "user")
    return text or "Describe the frames."


def _system_messages(messages: list[dict]) -> list[dict]:
    parts = [m["content"] for m in messages if m.get("role") == "system" and m.get("content")]
    return [{"role": "system", "content": "\n\n".join(parts)}] if parts else []


# Backend name → client class. Keyed lookup lets make_client read a class's is_remote
# attribute BEFORE constructing it, so a remote backend blocked by the AI privacy mode is
# never instantiated (the trust guarantee: no ClaudeClient under local_only). Unknown
# backends fall back to the local llamacpp server.
_BACKEND_CLIENTS: dict[str, type[LLMClient]] = {
    "llamacpp": LlamaCppServerClient,
    "claude": ClaudeClient,
}


def _client_class_for(config: Config) -> type[LLMClient]:
    return _BACKEND_CLIENTS.get(config.llm_backend, LlamaCppServerClient)


def backend_is_remote(config: Config) -> bool:
    """Whether the configured backend sends data off-device - read from the client
    class's is_remote attribute without constructing it."""
    return _client_class_for(config).is_remote


def make_client(config: Config) -> LLMClient:
    """The single point where an LLM client is constructed. Enforces the AI privacy mode:
    returns NullLLMClient (never a real, let alone remote, client) when generative AI is
    off or the backend is remote and remote is not allowed."""
    from yuu_clip.config import remote_ai_allowed, resolve_ai_permissions

    permissions = resolve_ai_permissions(config)
    if not config.llm_enabled or not permissions.allow_llm:
        return NullLLMClient()
    client_class = _client_class_for(config)
    if client_class.is_remote:
        if not remote_ai_allowed(config):
            _log.info(
                "Remote LLM backend %r is disabled in this build (remote AI gate off) - using NullLLMClient",
                config.llm_backend,
            )
            return NullLLMClient()
        if not permissions.allow_remote:
            _log.info(
                "Remote LLM backend %r blocked by AI privacy mode - using NullLLMClient",
                config.llm_backend,
            )
            return NullLLMClient()
    return client_class(config)
