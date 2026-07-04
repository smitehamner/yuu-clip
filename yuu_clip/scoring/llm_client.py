"""
Abstract LLM client interface and concrete implementations.

is_remote = True means the backend sends data to an external service and
incurs API costs.  is_remote = False means inference runs locally.

Use make_client(config) to get the right implementation for the current config.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.config import Config


class LLMClient(ABC):
    is_remote: bool = False

    @abstractmethod
    def chat(self, messages: list[dict], temperature: float = 0.1) -> str: ...

    @abstractmethod
    def available(self) -> tuple[bool, str]: ...


class LlamaCppClient(LLMClient):
    is_remote = False

    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        path = self._config.llm_model_path
        if not path:
            return False, "No model file path set — open Settings (⚙) and set 'Model file path' under LLM scoring"
        from pathlib import Path
        if not Path(path).exists():
            return False, f"Model file not found: {path}"
        try:
            import llama_cpp  # noqa: F401
        except ImportError:
            return False, "llama-cpp-python is not installed (pip install llama-cpp-python)"
        return True, ""

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        from llama_cpp import Llama
        llm = Llama(model_path=self._config.llm_model_path)
        response = llm.create_chat_completion(messages=messages, temperature=temperature)
        return response["choices"][0]["message"]["content"]


class OllamaClient(LLMClient):
    is_remote = False

    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        try:
            import ollama
            ollama.Client(host=self._config.ollama_host).list()
            return True, ""
        except Exception as exc:
            return False, f"Ollama not reachable at {self._config.ollama_host}: {exc}"

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        import ollama
        client = ollama.Client(host=self._config.ollama_host, timeout=self._config.ollama_timeout_s)
        response = client.chat(
            model=self._config.ollama_model,
            messages=messages,
            options={"temperature": temperature},
        )
        return response.message.content


class ClaudeClient(LLMClient):
    """Sends requests to the Anthropic API — remote, billed per token."""
    is_remote = True

    def __init__(self, config: Config) -> None:
        self._config = config

    def available(self) -> tuple[bool, str]:
        if not self._config.claude_api_key:
            return False, "No Claude API key set — open Settings (⚙) and enter your Anthropic API key under LLM scoring"
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
            return False, "Claude API key was rejected — check the key in Settings (⚙)"
        except AttributeError:
            return True, ""  # anthropic SDK too old for the Models API — trust the key
        except Exception as exc:
            return False, f"Couldn't reach the Claude API — check your connection: {exc}"
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


class NullLLMClient(LLMClient):
    """Returned when LLM scoring is disabled."""
    is_remote = False

    def available(self) -> tuple[bool, str]:
        return False, "LLM scoring is disabled in Settings"

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        raise RuntimeError("LLM scoring is disabled")


def make_client(config: Config) -> LLMClient:
    if not config.ollama_enabled:
        return NullLLMClient()
    if config.llm_backend == "llamacpp":
        return LlamaCppClient(config)
    if config.llm_backend == "claude":
        return ClaudeClient(config)
    return OllamaClient(config)
