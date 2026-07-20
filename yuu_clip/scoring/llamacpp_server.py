"""Managed pool of upstream llama.cpp `llama-server` subprocesses.

The `llamacpp` LLM backend drives one of these HTTP servers per model instead of
loading the model in-process (the old llama-cpp-python wheel was CPU-only). A server
is spawned lazily, health-checked, reused across calls, and reaped on shutdown.

Keyed by (model_path, mmproj_path): a text call and a vision call use different
models, so they get different servers. Only one server is kept alive at a time - a
7B model plus a vision model both resident would overflow a small GPU (see the spike
finding), so requesting a new key stops the others first.

No real inference runs in CI - the subprocess/HTTP seams are mocked in tests.
"""
from __future__ import annotations

import atexit
import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from yuu_clip.config import Config

_log = get_logger(__name__)

# Packaged builds point this at the bundled binary dir (mirrors YUU_CLIP_FFMPEG_DIR).
_ENV_BINARY_DIR = "YUU_CLIP_LLAMA_SERVER_DIR"
_DEFAULT_CTX = 8192
# Default completion cap; callers emitting longer JSON (scene-boundary lists) pass a
# larger value. Matches llm_client._DEFAULT_MAX_TOKENS.
_DEFAULT_MAX_TOKENS = 1024
_HEALTH_TIMEOUT_S = 240.0
_HEALTH_POLL_S = 0.5
_REQUEST_TIMEOUT_S = 600.0
_LOG_TAIL = 200

# `Vulkan0: NVIDIA GeForce RTX 4050 Laptop GPU (5920 MiB, 5152 MiB free)`. The name is
# captured greedily up to the LAST "(" so an internal "(TM)" doesn't truncate it before
# the integrated-GPU marker (e.g. "AMD Radeon(TM) Graphics") can be recognised.
_DEVICE_LINE = re.compile(r"^\s*(\S+):\s*(.+)\s*\(")
# Substrings that mark an integrated GPU we should skip in favour of a discrete one.
_INTEGRATED_MARKERS = ("radeon(tm) graphics", "uhd graphics", "iris", "integrated")


class LlamaServerError(RuntimeError):
    """The bundled llama-server binary is missing, or a server failed to start."""


def _server_exe_name() -> str:
    return "llama-server.exe" if os.name == "nt" else "llama-server"


def resolve_server_binary(config: Config, prefer_cpu: bool = False) -> str:
    """Locate the llama-server executable. A packaged build sets YUU_CLIP_LLAMA_SERVER_DIR
    (holding vulkan\\ + cpu\\ subdirs) and that dir must contain the binary - a broken
    bundle should fail loudly, not fall through to PATH. Otherwise use the configured
    path, then PATH. prefer_cpu picks the CPU build (the Vulkan-failed fallback)."""
    env_dir = os.environ.get(_ENV_BINARY_DIR)
    if env_dir:
        return _binary_in_bundle(Path(env_dir), prefer_cpu)
    if config.llamacpp_server_binary:
        if not Path(config.llamacpp_server_binary).is_file():
            raise LlamaServerError(
                f"Configured llama-server path does not exist: {config.llamacpp_server_binary}"
            )
        return config.llamacpp_server_binary
    found = shutil.which("llama-server")
    if found:
        return found
    raise LlamaServerError(
        "llama-server was not found. It ships with yuu-clip; set its path under "
        "Settings if you installed it elsewhere."
    )


def _binary_in_bundle(base: Path, prefer_cpu: bool) -> str:
    exe = _server_exe_name()
    subdirs = ("cpu", "vulkan") if prefer_cpu else ("vulkan", "cpu")
    for sub in subdirs:
        candidate = base / sub / exe
        if candidate.is_file():
            return str(candidate)
    flat = base / exe  # dev/simple layout: the exe sits directly in the dir
    if flat.is_file():
        return str(flat)
    raise LlamaServerError(
        f"{_ENV_BINARY_DIR} is set to {base} but no {exe} was found (looked in "
        "vulkan/, cpu/, and the dir itself). This indicates a broken packaged install "
        "- reinstalling yuu-clip should fix it."
    )


def has_cpu_fallback(config: Config) -> bool:
    """Whether a bundled CPU-build llama-server exists to fall back to when the Vulkan
    build can't start (e.g. a machine with no Vulkan runtime / GPU driver)."""
    env_dir = os.environ.get(_ENV_BINARY_DIR)
    if not env_dir:
        return False
    return (Path(env_dir) / "cpu" / _server_exe_name()).is_file()


def _is_integrated(device_name: str) -> bool:
    lowered = device_name.lower()
    return any(marker in lowered for marker in _INTEGRATED_MARKERS)


def list_gpu_devices(binary: str) -> list[tuple[str, str]] | None:
    """Run *binary* --list-devices and parse its (device id, name) pairs.

    None means the probe itself couldn't run (missing binary, broken process) -
    distinct from an empty list, which means the probe ran fine and found zero
    devices (no Vulkan runtime, or a GPU with no working driver)."""
    try:
        result = subprocess.run(
            [binary, "--list-devices"], capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        _log.warning("llama-server --list-devices failed (%s) - letting it pick a device", exc)
        return None
    devices: list[tuple[str, str]] = []
    for line in result.stdout.splitlines():
        match = _DEVICE_LINE.match(line)
        if match and match.group(1) not in ("Available", "load_backend"):
            devices.append((match.group(1), match.group(2)))
    return devices


def pick_gpu_device(binary: str) -> str | None:
    """Return the id (e.g. "Vulkan0") of the GPU to offload to, preferring a discrete
    card over an integrated one. Device ordering is not guaranteed, so we match by
    name rather than trusting index 0. None when no GPU device is listed."""
    devices = list_gpu_devices(binary)
    if not devices:
        return None
    discrete = [dev for dev in devices if not _is_integrated(dev[1])]
    chosen = (discrete or devices)[0]
    _log.info("llama-server GPU device: %s (%s)", chosen[0], chosen[1])
    return chosen[0]


def gpu_offload_available(config: Config) -> bool | None:
    """Whether llama-server can find a GPU device to offload to on this machine.

    None means unknown. Used to warn when GPU offload is requested but the Vulkan
    runtime finds no usable device - a broken/missing GPU driver, not a deliberate
    CPU choice. Deliberately does NOT fall back to a bare `shutil.which` PATH
    lookup like resolve_server_binary does for an actual server spawn - only a
    packaged build's bundled binary dir or an explicitly configured path counts,
    so a dev/CI machine that merely happens to have an unrelated llama-server on
    PATH never triggers a surprise subprocess spawn from a passive /api/status poll.
    """
    env_dir = os.environ.get(_ENV_BINARY_DIR)
    if env_dir:
        try:
            binary = _binary_in_bundle(Path(env_dir), prefer_cpu=False)
        except LlamaServerError:
            return None
    elif config.llamacpp_server_binary:
        if not Path(config.llamacpp_server_binary).is_file():
            return None
        binary = config.llamacpp_server_binary
    else:
        return None
    devices = list_gpu_devices(binary)
    if devices is None:
        return None
    return len(devices) > 0


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) != 0


def post_chat_completion(base_url: str, payload: dict, timeout: float = _REQUEST_TIMEOUT_S) -> dict:
    """POST an OpenAI-style chat-completions *payload* to a running llama-server at
    *base_url*. Module-level (pool-independent) so the frame-analysis subprocess can
    call a warm, web-server-managed server directly by URL - killing that subprocess
    drops this connection and llama-server aborts generation mid-inference."""
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/v1/chat/completions",
        data=body, headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as resp:
        return json.load(resp)


def completion_text(data: dict) -> str:
    """Pull the assistant message text out of a chat-completions response body."""
    return data["choices"][0]["message"]["content"]


@dataclass
class ServerHandle:
    proc: subprocess.Popen
    port: int
    model_path: str
    mmproj_path: str
    last_used: float
    log_tail: deque[str] = field(default_factory=lambda: deque(maxlen=_LOG_TAIL))

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def is_alive(self) -> bool:
        return self.proc.poll() is None


class LlamaServerPool:
    """Spawns and reuses llama-server subprocesses, one per (model, mmproj) key."""

    def __init__(self) -> None:
        self._servers: dict[tuple[str, str], ServerHandle] = {}
        self._lock = threading.Lock()          # guards the _servers dict
        # Serializes a whole chat call (ensure-server + POST). Without it a
        # concurrent request for a different (model, mmproj) key could run
        # _stop_others and terminate the server another thread is mid-POST to -
        # e.g. an in-app frame-analysis (vision) call landing during an SSE text
        # re-score. Held across the POST, but NOT taken by shutdown_all, so a
        # shutdown can still reap a live server promptly during a long request.
        self._call_lock = threading.Lock()

    def chat_completion(
        self, config: Config, *, model_path: str, mmproj_path: str,
        messages: list[dict], temperature: float,
        max_tokens: int = _DEFAULT_MAX_TOKENS,
    ) -> str:
        with self._call_lock:
            handle = self._ensure_server(config, model_path, mmproj_path)
            payload = {"messages": messages, "temperature": temperature, "max_tokens": max_tokens}
            data = self._post(handle, payload)
        return completion_text(data)

    def ensure_server_url(self, config: Config, *, model_path: str, mmproj_path: str) -> str:
        """Ensure the (model, mmproj) server is running and return its base URL, so an
        out-of-process caller (the killable frame-analysis subprocess) can POST to the
        warm, web-server-managed server directly instead of spawning its own and
        cold-loading the model. Serialized like a chat call so it can't race a model
        swap."""
        with self._call_lock:
            return self._ensure_server(config, model_path, mmproj_path or "").base_url

    def shutdown_all(self) -> None:
        with self._lock:
            for handle in list(self._servers.values()):
                self._stop(handle)
            self._servers.clear()

    def _ensure_server(self, config: Config, model_path: str, mmproj_path: str) -> ServerHandle:
        key = (model_path, mmproj_path or "")
        with self._lock:
            handle = self._servers.get(key)
            if handle and handle.is_alive():
                handle.last_used = time.time()
                return handle
            if handle:  # process died - drop the stale handle before respawning
                self._servers.pop(key, None)
            self._stop_others(key)
        # The spawn (Popen) + up-to-_HEALTH_TIMEOUT_S health wait happen WITHOUT self._lock
        # held, so a concurrent shutdown_all can reap the starting server instead of
        # blocking for the whole cold load. _call_lock already serializes callers, so only
        # one spawn is ever in flight; each attempt registers its handle in _servers before
        # waiting (below) so shutdown can find and terminate it.
        return self._spawn(config, key, model_path, mmproj_path or "")

    def _stop_others(self, keep_key: tuple[str, str]) -> None:
        for key, handle in list(self._servers.items()):
            if key != keep_key:
                self._stop(handle)
                self._servers.pop(key, None)

    def _spawn(
        self, config: Config, key: tuple[str, str], model_path: str, mmproj_path: str,
    ) -> ServerHandle:
        try:
            return self._launch(config, key, model_path, mmproj_path, prefer_cpu=False)
        except LlamaServerError as exc:
            if config.llm_use_gpu and has_cpu_fallback(config):
                _log.warning(
                    "The GPU (Vulkan) llama-server did not start - falling back to the "
                    "bundled CPU build (slower). Updating your GPU driver restores "
                    "acceleration. Vulkan startup error: %s", exc,
                )
                return self._launch(config, key, model_path, mmproj_path, prefer_cpu=True)
            raise

    def _launch(
        self, config: Config, key: tuple[str, str], model_path: str, mmproj_path: str,
        prefer_cpu: bool,
    ) -> ServerHandle:
        binary = resolve_server_binary(config, prefer_cpu=prefer_cpu)
        gpu_layers = 0 if (prefer_cpu or not config.llm_use_gpu) else config.llamacpp_server_gpu_layers
        device = pick_gpu_device(binary) if gpu_layers != 0 else None
        port = self._choose_port(config)
        args = _build_args(binary, model_path, mmproj_path, port, gpu_layers, device)
        _log.info(
            "Starting llama-server: port=%d model=%s build=%s gpu_layers=%s device=%s mmproj=%s",
            port, Path(model_path).name, Path(binary).parent.name or "path",
            _gpu_layers_desc(gpu_layers), device or "(default)",
            Path(mmproj_path).name if mmproj_path else "(none)",
        )
        proc = subprocess.Popen(
            args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
        handle = ServerHandle(proc, port, model_path, mmproj_path, time.time())
        threading.Thread(target=self._pump_logs, args=(handle,), daemon=True).start()
        # Register before the (unlocked) health wait so a concurrent shutdown_all can reap
        # this starting server. On failure, deregister so a dead handle never lingers.
        with self._lock:
            self._servers[key] = handle
        try:
            self._wait_healthy(handle)
        except LlamaServerError:
            with self._lock:
                if self._servers.get(key) is handle:
                    self._servers.pop(key, None)
            raise
        return handle

    def _choose_port(self, config: Config) -> int:
        configured = config.llamacpp_server_port
        with self._lock:
            used = {handle.port for handle in self._servers.values()}
        if configured and configured not in used and _port_is_free(configured):
            return configured
        return _free_port()

    def _pump_logs(self, handle: ServerHandle) -> None:
        if handle.proc.stdout is None:
            return
        for raw in handle.proc.stdout:
            handle.log_tail.append(raw.rstrip("\n"))

    def _wait_healthy(self, handle: ServerHandle) -> None:
        started = time.time()
        deadline = started + _HEALTH_TIMEOUT_S
        url = f"{handle.base_url}/health"
        while time.time() < deadline:
            if not handle.is_alive():
                self._raise_startup_error(handle, "exited during startup")
            try:
                with urllib.request.urlopen(url, timeout=3) as resp:
                    if json.load(resp).get("status") == "ok":
                        _log.info(
                            "llama-server on port %d ready (model loaded in %.1fs)",
                            handle.port, time.time() - started,
                        )
                        return
            except (urllib.error.URLError, ConnectionError, OSError, json.JSONDecodeError):
                time.sleep(_HEALTH_POLL_S)
        self._stop(handle)
        self._raise_startup_error(handle, "did not become healthy in time")

    def _raise_startup_error(self, handle: ServerHandle, reason: str) -> None:
        tail = "\n".join(list(handle.log_tail)[-15:])
        raise LlamaServerError(
            f"The local AI engine (llama-server) {reason}. Last output:\n{tail}"
        )

    def _post(self, handle: ServerHandle, payload: dict) -> dict:
        return post_chat_completion(handle.base_url, payload)

    def _stop(self, handle: ServerHandle) -> None:
        if not handle.is_alive():
            return
        _log.info("Stopping llama-server (pid %s, port %d)", handle.proc.pid, handle.port)
        handle.proc.terminate()
        try:
            handle.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _log.warning(
                "llama-server (pid %s, port %d) did not stop within 10s - killing it",
                handle.proc.pid, handle.port,
            )
            handle.proc.kill()
            handle.proc.wait()


def _gpu_layers_desc(gpu_layers: int) -> str:
    if gpu_layers < 0:
        return "auto-fit"
    if gpu_layers == 0:
        return "CPU-only"
    return str(gpu_layers)


def _build_args(
    binary: str, model_path: str, mmproj_path: str, port: int,
    gpu_layers: int, device: str | None,
) -> list[str]:
    args = [
        binary, "--model", model_path, "--host", "127.0.0.1", "--port", str(port),
        "--ctx-size", str(_DEFAULT_CTX), "--no-webui",
    ]
    # gpu_layers == -1 means auto-fit: omit the flag so llama-server sizes the offload
    # to free VRAM (forcing all layers can OOM a small card - see the spike).
    if gpu_layers >= 0:
        args += ["--n-gpu-layers", str(gpu_layers)]
    if device is not None:
        args += ["--device", device]
    if mmproj_path:
        args += ["--mmproj", mmproj_path]
    return args


_pool: LlamaServerPool | None = None
_pool_lock = threading.Lock()


def get_server_pool() -> LlamaServerPool:
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = LlamaServerPool()
        return _pool


def shutdown_server_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.shutdown_all()
            _pool = None


# Backstop so a process that spawned a server reaps it on exit. The web server also
# reaps via its lifespan; the analyze CLI subprocess has no such hook, and on Windows
# a llama-server child is not killed when its parent exits - without this, every
# analyze run that used local LLM scoring would orphan a llama-server holding RAM/VRAM.
# No-op when this process never created a pool.
atexit.register(shutdown_server_pool)
