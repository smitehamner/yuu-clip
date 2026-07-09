"""Unit tests for the llama-server process pool (yuu_clip/scoring/llamacpp_server.py).

The subprocess and HTTP seams are faked - no real binary or inference runs here.
Real-binary behaviour is a release-time manual smoke check, not a CI test.
"""
from __future__ import annotations

import pytest

from yuu_clip.config import Config
from yuu_clip.scoring import llamacpp_server as srv
from yuu_clip.scoring.llamacpp_server import (
    LlamaServerError,
    LlamaServerPool,
    _build_args,
    _free_port,
    _port_is_free,
    pick_gpu_device,
    resolve_server_binary,
)


def _cfg(**overrides) -> Config:
    cfg = Config()
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


class FakeProc:
    """Minimal stand-in for subprocess.Popen. Alive until terminate()/kill()."""

    def __init__(self, args):
        self.args = args
        self.pid = 4321
        self._returncode = None
        self.stdout = []  # the log-pump thread iterates this and stops immediately

    def poll(self):
        return self._returncode

    def terminate(self):
        self._returncode = 0

    def kill(self):
        self._returncode = -9

    def wait(self, timeout=None):
        if self._returncode is None:
            self._returncode = 0
        return self._returncode


@pytest.fixture
def fake_spawn(monkeypatch):
    """Patch the spawn/health seams so a pool can spawn without a real binary. Returns
    the list of Popen arg-lists seen, so tests can assert the CLI flags."""
    spawned: list[list[str]] = []

    def _popen(args, **_kwargs):
        spawned.append(args)
        return FakeProc(args)

    monkeypatch.setattr(srv, "resolve_server_binary", lambda _config: "fake-llama-server")
    monkeypatch.setattr(srv, "pick_gpu_device", lambda _binary: "Vulkan0")
    monkeypatch.setattr(srv.subprocess, "Popen", _popen)
    monkeypatch.setattr(LlamaServerPool, "_wait_healthy", lambda self, handle: None)
    monkeypatch.setattr(
        LlamaServerPool, "_post",
        lambda self, handle, payload: {"choices": [{"message": {"content": "reply"}}]},
    )
    return spawned


class TestResolveBinary:
    def test_env_dir_with_binary_present(self, monkeypatch, tmp_path):
        exe = tmp_path / srv._server_exe_name()
        exe.write_bytes(b"bin")
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        assert resolve_server_binary(_cfg()) == str(exe)

    def test_env_dir_missing_binary_raises(self, monkeypatch, tmp_path):
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        with pytest.raises(LlamaServerError, match="broken packaged install"):
            resolve_server_binary(_cfg())

    def test_configured_path_used_when_present(self, monkeypatch, tmp_path):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        exe = tmp_path / "llama-server.exe"
        exe.write_bytes(b"bin")
        assert resolve_server_binary(_cfg(llamacpp_server_binary=str(exe))) == str(exe)

    def test_configured_path_missing_raises(self, monkeypatch, tmp_path):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        with pytest.raises(LlamaServerError, match="does not exist"):
            resolve_server_binary(_cfg(llamacpp_server_binary=str(tmp_path / "nope.exe")))

    def test_falls_back_to_path(self, monkeypatch):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        monkeypatch.setattr(srv.shutil, "which", lambda _name: "/usr/bin/llama-server")
        assert resolve_server_binary(_cfg()) == "/usr/bin/llama-server"

    def test_not_found_anywhere_raises(self, monkeypatch):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        monkeypatch.setattr(srv.shutil, "which", lambda _name: None)
        with pytest.raises(LlamaServerError, match="was not found"):
            resolve_server_binary(_cfg())


class TestPickGpuDevice:
    def _run(self, monkeypatch, stdout):
        class _Result:
            def __init__(self):
                self.stdout = stdout

        monkeypatch.setattr(srv.subprocess, "run", lambda *a, **k: _Result())

    def test_prefers_discrete_over_integrated(self, monkeypatch):
        self._run(monkeypatch,
                  "Available devices:\n"
                  "  Vulkan0: NVIDIA GeForce RTX 4050 Laptop GPU (5920 MiB, 5152 MiB free)\n"
                  "  Vulkan1: AMD Radeon(TM) Graphics (32634 MiB, 31003 MiB free)\n")
        assert pick_gpu_device("bin") == "Vulkan0"

    def test_integrated_first_still_picks_discrete(self, monkeypatch):
        self._run(monkeypatch,
                  "  Vulkan0: AMD Radeon(TM) Graphics (32634 MiB free)\n"
                  "  Vulkan1: NVIDIA GeForce RTX 4050 Laptop GPU (5920 MiB free)\n")
        assert pick_gpu_device("bin") == "Vulkan1"

    def test_only_integrated_returns_it(self, monkeypatch):
        self._run(monkeypatch, "  Vulkan0: AMD Radeon(TM) Graphics (32634 MiB free)\n")
        assert pick_gpu_device("bin") == "Vulkan0"

    def test_no_devices_returns_none(self, monkeypatch):
        self._run(monkeypatch, "Available devices:\n")
        assert pick_gpu_device("bin") is None

    def test_subprocess_failure_returns_none(self, monkeypatch):
        def _boom(*_a, **_k):
            raise OSError("cannot run")

        monkeypatch.setattr(srv.subprocess, "run", _boom)
        assert pick_gpu_device("bin") is None


class TestBuildArgs:
    def test_autofit_omits_gpu_layers_flag(self):
        # The critical spike lesson: -1 means auto-fit, so no --n-gpu-layers is passed
        # (forcing all layers OOMs a small card). The device is still selected.
        args = _build_args("bin", "m.gguf", "", 8080, gpu_layers=-1, device="Vulkan0")
        assert "--n-gpu-layers" not in args
        assert args[args.index("--device") + 1] == "Vulkan0"

    def test_cpu_passes_zero_layers_and_no_device(self):
        args = _build_args("bin", "m.gguf", "", 8080, gpu_layers=0, device=None)
        assert args[args.index("--n-gpu-layers") + 1] == "0"
        assert "--device" not in args

    def test_forced_layer_count_is_passed(self):
        args = _build_args("bin", "m.gguf", "", 8080, gpu_layers=20, device="Vulkan0")
        assert args[args.index("--n-gpu-layers") + 1] == "20"

    def test_mmproj_appended_when_given(self):
        args = _build_args("bin", "v.gguf", "mm.gguf", 8080, gpu_layers=-1, device=None)
        assert args[args.index("--mmproj") + 1] == "mm.gguf"

    def test_no_mmproj_flag_for_text(self):
        args = _build_args("bin", "m.gguf", "", 8080, gpu_layers=-1, device=None)
        assert "--mmproj" not in args


class TestPortHelpers:
    def test_free_port_is_actually_free(self):
        port = _free_port()
        assert isinstance(port, int) and port > 0
        assert _port_is_free(port) is True


class TestPool:
    def test_reuses_server_for_same_key(self, fake_spawn):
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        assert len(fake_spawn) == 1  # spawned once, reused the second time
        pool.shutdown_all()

    def test_returns_completion_content(self, fake_spawn):
        pool = LlamaServerPool()
        reply = pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                                     messages=[], temperature=0.1)
        assert reply == "reply"
        pool.shutdown_all()

    def test_new_key_stops_previous_server(self, fake_spawn):
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(), model_path="text.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        first = pool._servers[("text.gguf", "")].proc
        pool.chat_completion(_cfg(), model_path="vision.gguf", mmproj_path="mm.gguf",
                             messages=[], temperature=0.1)
        assert first.poll() is not None  # the text server was terminated
        assert ("text.gguf", "") not in pool._servers
        assert len(fake_spawn) == 2
        pool.shutdown_all()

    def test_shutdown_terminates_all(self, fake_spawn):
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        proc = pool._servers[("m.gguf", "")].proc
        pool.shutdown_all()
        assert proc.poll() is not None
        assert pool._servers == {}

    def test_dead_server_is_respawned(self, fake_spawn):
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        pool._servers[("m.gguf", "")].proc.terminate()  # simulate a crash
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        assert len(fake_spawn) == 2
        pool.shutdown_all()

    def test_gpu_disabled_forces_cpu_and_skips_device(self, monkeypatch, fake_spawn):
        called = []
        monkeypatch.setattr(srv, "pick_gpu_device", lambda b: called.append(b) or "Vulkan0")
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(llm_use_gpu=False), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        args = fake_spawn[0]
        assert args[args.index("--n-gpu-layers") + 1] == "0"
        assert "--device" not in args
        assert called == []  # no GPU device probe when GPU is off
        pool.shutdown_all()

    def test_gpu_autofit_selects_device_without_layer_flag(self, fake_spawn):
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(llm_use_gpu=True, llamacpp_server_gpu_layers=-1),
                             model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        args = fake_spawn[0]
        assert "--n-gpu-layers" not in args
        assert args[args.index("--device") + 1] == "Vulkan0"
        pool.shutdown_all()

    def test_spawn_failure_surfaces_plain_error(self, monkeypatch, fake_spawn):
        monkeypatch.setattr(
            LlamaServerPool, "_wait_healthy",
            lambda self, handle: (_ for _ in ()).throw(
                LlamaServerError("The local AI engine (llama-server) exited during startup.")
            ),
        )
        pool = LlamaServerPool()
        with pytest.raises(LlamaServerError, match="local AI engine"):
            pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                                 messages=[], temperature=0.1)


class TestPoolSingleton:
    def test_get_pool_is_a_singleton_until_shutdown(self):
        srv.shutdown_server_pool()
        first = srv.get_server_pool()
        assert srv.get_server_pool() is first
        srv.shutdown_server_pool()
        assert srv.get_server_pool() is not first
        srv.shutdown_server_pool()
