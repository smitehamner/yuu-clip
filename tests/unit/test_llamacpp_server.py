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
    has_cpu_fallback,
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

    monkeypatch.setattr(srv, "resolve_server_binary",
                        lambda _config, prefer_cpu=False: "fake-llama-server")
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


class TestBundleLayout:
    """The packaged bundle dir holds vulkan\\ + cpu\\; resolve prefers vulkan and can
    fall back to cpu, with a flat layout supported for dev."""

    def _bundle(self, tmp_path, subdirs):
        for sub in subdirs:
            d = tmp_path / sub
            d.mkdir(parents=True, exist_ok=True)
            (d / srv._server_exe_name()).write_bytes(b"bin")
        return tmp_path

    def test_prefers_vulkan_subdir(self, monkeypatch, tmp_path):
        base = self._bundle(tmp_path, ["vulkan", "cpu"])
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(base))
        assert resolve_server_binary(_cfg()) == str(base / "vulkan" / srv._server_exe_name())

    def test_prefer_cpu_picks_cpu_subdir(self, monkeypatch, tmp_path):
        base = self._bundle(tmp_path, ["vulkan", "cpu"])
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(base))
        assert resolve_server_binary(_cfg(), prefer_cpu=True) == str(base / "cpu" / srv._server_exe_name())

    def test_falls_back_to_cpu_when_no_vulkan(self, monkeypatch, tmp_path):
        base = self._bundle(tmp_path, ["cpu"])
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(base))
        assert resolve_server_binary(_cfg()) == str(base / "cpu" / srv._server_exe_name())

    def test_flat_layout_supported(self, monkeypatch, tmp_path):
        (tmp_path / srv._server_exe_name()).write_bytes(b"bin")
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        assert resolve_server_binary(_cfg()) == str(tmp_path / srv._server_exe_name())

    def test_has_cpu_fallback_true_when_cpu_present(self, monkeypatch, tmp_path):
        self._bundle(tmp_path, ["vulkan", "cpu"])
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        assert has_cpu_fallback(_cfg()) is True

    def test_has_cpu_fallback_false_when_only_vulkan(self, monkeypatch, tmp_path):
        self._bundle(tmp_path, ["vulkan"])
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        assert has_cpu_fallback(_cfg()) is False

    def test_has_cpu_fallback_false_without_env(self, monkeypatch):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        assert has_cpu_fallback(_cfg()) is False


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


class TestGpuOffloadAvailable:
    """gpu_offload_available - the header GPU-warning chip's mismatch probe.

    Deliberately does NOT fall back to a bare PATH lookup (unlike
    resolve_server_binary) - only a packaged build's bundled dir
    (YUU_CLIP_LLAMA_SERVER_DIR) or an explicitly configured path count, so a
    passive /api/status poll never triggers a surprise subprocess spawn on a
    dev/CI machine that merely happens to have an unrelated llama-server on PATH.
    """

    def _run(self, monkeypatch, stdout):
        class _Result:
            def __init__(self):
                self.stdout = stdout

        monkeypatch.setattr(srv.subprocess, "run", lambda *a, **k: _Result())

    def test_device_found_via_env_dir_returns_true(self, monkeypatch, tmp_path):
        (tmp_path / srv._server_exe_name()).write_bytes(b"bin")
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        self._run(monkeypatch, "  Vulkan0: NVIDIA GeForce RTX 4050 Laptop GPU (5920 MiB free)\n")
        assert srv.gpu_offload_available(_cfg()) is True

    def test_no_devices_via_env_dir_returns_false(self, monkeypatch, tmp_path):
        (tmp_path / srv._server_exe_name()).write_bytes(b"bin")
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))
        self._run(monkeypatch, "Available devices:\n")
        assert srv.gpu_offload_available(_cfg()) is False

    def test_device_found_via_configured_path_returns_true(self, monkeypatch, tmp_path):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        exe = tmp_path / "llama-server.exe"
        exe.write_bytes(b"bin")
        self._run(monkeypatch, "  Vulkan0: NVIDIA GeForce RTX 4050 Laptop GPU (5920 MiB free)\n")
        assert srv.gpu_offload_available(_cfg(llamacpp_server_binary=str(exe))) is True

    def test_env_dir_set_but_binary_missing_returns_none(self, monkeypatch, tmp_path):
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))  # empty dir - no exe
        assert srv.gpu_offload_available(_cfg()) is None

    def test_configured_path_missing_returns_none(self, monkeypatch, tmp_path):
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)
        missing = tmp_path / "nope.exe"
        assert srv.gpu_offload_available(_cfg(llamacpp_server_binary=str(missing))) is None

    def test_no_env_dir_and_no_configured_path_returns_none_without_touching_path(self, monkeypatch):
        """Must not fall back to shutil.which - a bare PATH lookup would make a
        dev/CI machine's unrelated llama-server install spawn a real subprocess
        from a passive /api/status poll."""
        monkeypatch.delenv(srv._ENV_BINARY_DIR, raising=False)

        def _boom(*_a, **_k):
            raise AssertionError("must not spawn a subprocess when no binary is known")

        monkeypatch.setattr(srv.subprocess, "run", _boom)
        assert srv.gpu_offload_available(_cfg()) is None

    def test_probe_subprocess_failure_returns_none(self, monkeypatch, tmp_path):
        (tmp_path / srv._server_exe_name()).write_bytes(b"bin")
        monkeypatch.setenv(srv._ENV_BINARY_DIR, str(tmp_path))

        def _boom(*_a, **_k):
            raise OSError("cannot run")

        monkeypatch.setattr(srv.subprocess, "run", _boom)
        assert srv.gpu_offload_available(_cfg()) is None


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


def _handle(proc, port=51234):
    from yuu_clip.scoring.llamacpp_server import ServerHandle
    return ServerHandle(proc, port, "m.gguf", "", 0.0)


class _FakeHealthResp:
    """Context-manager response whose body json.load() can parse."""

    def __init__(self, body: bytes):
        self._body = body

    def read(self, *_a):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *_a):
        return False


class TestWaitHealthy:
    """The health-check gate is a no-op in every other test (fake_spawn patches it);
    these pin its real branching, since it decides whether a launched server is
    usable, hangs, or surfaces the subprocess's own error output."""

    def test_returns_when_health_reports_ok(self, monkeypatch):
        monkeypatch.setattr(
            srv.urllib.request, "urlopen",
            lambda _url, timeout=3: _FakeHealthResp(b'{"status": "ok"}'),
        )
        pool = LlamaServerPool()
        pool._wait_healthy(_handle(FakeProc([])))  # alive proc, healthy -> no raise

    def test_process_exit_during_startup_raises_with_log_tail(self):
        proc = FakeProc([])
        proc.terminate()  # dead before the first health poll
        handle = _handle(proc)
        handle.log_tail.append("error: failed to load model 'm.gguf'")
        with pytest.raises(LlamaServerError) as excinfo:
            LlamaServerPool()._wait_healthy(handle)
        message = str(excinfo.value)
        assert "exited during startup" in message
        assert "failed to load model 'm.gguf'" in message  # the tail is surfaced

    def test_timeout_stops_the_server_and_raises(self, monkeypatch):
        # First read establishes the deadline; every read after jumps past it so the
        # poll loop exits on its next check. A plain callable (not an exhausting
        # iterator) is used because logging also calls the patched time.time().
        ticks = {"n": 0}

        def _fake_time():
            ticks["n"] += 1
            return 1000.0 if ticks["n"] == 1 else 1_000_000.0

        monkeypatch.setattr(srv.time, "time", _fake_time)
        monkeypatch.setattr(srv.time, "sleep", lambda _s: None)

        def _refuse(_url, timeout=3):
            raise srv.urllib.error.URLError("connection refused")

        monkeypatch.setattr(srv.urllib.request, "urlopen", _refuse)
        proc = FakeProc([])  # stays alive - it just never becomes healthy
        with pytest.raises(LlamaServerError, match="did not become healthy"):
            LlamaServerPool()._wait_healthy(_handle(proc))
        assert proc.poll() is not None  # the stalled server was terminated


class TestChoosePort:
    def test_configured_free_port_is_used(self):
        port = _free_port()
        chosen = LlamaServerPool()._choose_port(_cfg(llamacpp_server_port=port))
        assert chosen == port

    def test_configured_occupied_port_is_skipped(self):
        import socket

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as occupied:
            occupied.bind(("127.0.0.1", 0))
            occupied.listen(1)
            taken = occupied.getsockname()[1]
            chosen = LlamaServerPool()._choose_port(_cfg(llamacpp_server_port=taken))
        assert chosen != taken
        assert _port_is_free(chosen)

    def test_zero_config_auto_picks_a_free_port(self):
        chosen = LlamaServerPool()._choose_port(_cfg(llamacpp_server_port=0))
        assert chosen > 0 and _port_is_free(chosen)


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

    def test_default_max_tokens_in_payload(self, monkeypatch, fake_spawn):
        captured = {}
        monkeypatch.setattr(
            LlamaServerPool, "_post",
            lambda self, handle, payload: captured.update(payload)
            or {"choices": [{"message": {"content": "x"}}]},
        )
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        assert captured["max_tokens"] == srv._DEFAULT_MAX_TOKENS
        pool.shutdown_all()

    def test_explicit_max_tokens_in_payload(self, monkeypatch, fake_spawn):
        # Scene-boundary lists pass a larger budget so a long JSON array is not truncated.
        captured = {}
        monkeypatch.setattr(
            LlamaServerPool, "_post",
            lambda self, handle, payload: captured.update(payload)
            or {"choices": [{"message": {"content": "x"}}]},
        )
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1, max_tokens=2048)
        assert captured["max_tokens"] == 2048
        pool.shutdown_all()

    def test_shutdown_not_blocked_during_health_wait(self, monkeypatch):
        # A cold model load can spend up to _HEALTH_TIMEOUT_S in _wait_healthy; shutdown_all
        # must be able to reap without waiting on that (the fix releases self._lock around
        # the health wait, holding it only to register/deregister the handle).
        import threading

        in_wait = threading.Event()
        release = threading.Event()

        def _blocking_wait(self, handle):
            in_wait.set()
            release.wait(3)

        monkeypatch.setattr(srv, "resolve_server_binary",
                            lambda _config, prefer_cpu=False: "fake-llama-server")
        monkeypatch.setattr(srv, "pick_gpu_device", lambda _binary: "Vulkan0")
        monkeypatch.setattr(srv.subprocess, "Popen", lambda args, **_k: FakeProc(args))
        monkeypatch.setattr(LlamaServerPool, "_wait_healthy", _blocking_wait)
        monkeypatch.setattr(
            LlamaServerPool, "_post",
            lambda self, handle, payload: {"choices": [{"message": {"content": "reply"}}]},
        )

        pool = LlamaServerPool()
        spawn_thread = threading.Thread(target=lambda: pool.chat_completion(
            _cfg(), model_path="m.gguf", mmproj_path="", messages=[], temperature=0.1))
        spawn_thread.start()
        try:
            assert in_wait.wait(2)  # spawn is now mid cold-load health wait
            proc = pool._servers[("m.gguf", "")].proc  # registered before the wait

            done = threading.Event()
            threading.Thread(target=lambda: pool.shutdown_all() or done.set()).start()
            assert done.wait(2)  # shutdown returned promptly, not blocked on the health wait
            assert proc.poll() is not None  # the starting server was reaped
        finally:
            release.set()
            spawn_thread.join(3)

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

    def test_inflight_request_not_killed_by_concurrent_new_key(self, monkeypatch, fake_spawn):
        # A vision call landing during an SSE text re-score must not terminate the
        # text server mid-POST. chat_completion serializes ensure+post under
        # _call_lock, so the concurrent new-key request waits until the in-flight
        # POST returns instead of running _stop_others on the live server.
        import threading
        import time

        pool = LlamaServerPool()
        in_post = threading.Event()
        release = threading.Event()
        alive_at_return = {}

        def _blocking_post(self, handle, payload):
            if handle.model_path == "text.gguf":
                in_post.set()
                release.wait(2)
                alive_at_return["text"] = handle.proc.poll() is None
            return {"choices": [{"message": {"content": "reply"}}]}

        monkeypatch.setattr(LlamaServerPool, "_post", _blocking_post)

        text_thread = threading.Thread(target=lambda: pool.chat_completion(
            _cfg(), model_path="text.gguf", mmproj_path="", messages=[], temperature=0.1))
        text_thread.start()
        try:
            assert in_post.wait(2)  # text call is now mid-POST
            text_proc = pool._servers[("text.gguf", "")].proc

            vision_thread = threading.Thread(target=lambda: pool.chat_completion(
                _cfg(), model_path="vision.gguf", mmproj_path="mm.gguf",
                messages=[], temperature=0.1))
            vision_thread.start()

            # Give a would-be racing _stop_others ample time to fire; with the fix it
            # can't, because the vision call is blocked on _call_lock.
            for _ in range(50):
                if text_proc.poll() is not None:
                    break
                time.sleep(0.01)
            assert text_proc.poll() is None  # text server survived the concurrent call
        finally:
            release.set()
            text_thread.join(2)
        vision_thread.join(2)
        assert alive_at_return["text"] is True
        pool.shutdown_all()

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

    def test_vulkan_failure_falls_back_to_cpu_binary(self, monkeypatch, fake_spawn):
        # Vulkan build won't start (no runtime); the pool retries with the CPU build
        # and forces CPU layers. resolve is asked for cpu on the second attempt.
        def _resolve(config, prefer_cpu=False):
            if not prefer_cpu:
                raise LlamaServerError("Vulkan build failed to start")
            return "cpu-llama-server"

        monkeypatch.setattr(srv, "resolve_server_binary", _resolve)
        monkeypatch.setattr(srv, "has_cpu_fallback", lambda _config: True)
        pool = LlamaServerPool()
        pool.chat_completion(_cfg(llm_use_gpu=True), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        args = fake_spawn[0]
        assert args[0] == "cpu-llama-server"
        assert args[args.index("--n-gpu-layers") + 1] == "0"
        assert "--device" not in args
        pool.shutdown_all()

    def test_no_fallback_reraises_when_cpu_absent(self, monkeypatch, fake_spawn):
        monkeypatch.setattr(
            srv, "resolve_server_binary",
            lambda config, prefer_cpu=False: (_ for _ in ()).throw(LlamaServerError("boom")),
        )
        monkeypatch.setattr(srv, "has_cpu_fallback", lambda _config: False)
        pool = LlamaServerPool()
        with pytest.raises(LlamaServerError, match="boom"):
            pool.chat_completion(_cfg(llm_use_gpu=True), model_path="m.gguf", mmproj_path="",
                                 messages=[], temperature=0.1)

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

    def test_atexit_reaper_terminates_module_pool_server(self, fake_spawn):
        """Invoking the reaper the atexit hook calls must terminate a live server
        spawned through the module-global pool (the analyze subprocess relies on
        this - Windows does not kill the child when its parent process exits)."""
        srv.shutdown_server_pool()
        pool = srv.get_server_pool()
        pool.chat_completion(_cfg(), model_path="m.gguf", mmproj_path="",
                             messages=[], temperature=0.1)
        proc = pool._servers[("m.gguf", "")].proc
        assert proc.poll() is None  # alive before exit
        srv.shutdown_server_pool()  # what the atexit hook calls
        assert proc.poll() is not None  # reaped

    def test_shutdown_is_registered_as_atexit_handler(self, monkeypatch):
        """Reloading the module must register the reaper with atexit so any process
        (notably the analyze subprocess) cleans up its server on normal exit."""
        import importlib

        registered: list = []
        monkeypatch.setattr("atexit.register", lambda fn, *a, **k: registered.append(fn) or fn)
        reloaded = importlib.reload(srv)
        try:
            assert reloaded.shutdown_server_pool in registered
        finally:
            importlib.reload(srv)  # restore the real module state for other tests


class TestModuleChatHelpers:
    """The pool-independent POST helpers the frame-analysis subprocess calls to talk to
    the web server's warm server directly."""

    def test_post_chat_completion_posts_to_the_completions_url(self, monkeypatch):
        import json as _json
        captured: dict = {}

        class _Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return b'{"choices": [{"message": {"content": "hi"}}]}'

        def fake_urlopen(request, timeout=None):
            captured["url"] = request.full_url
            captured["body"] = request.data
            return _Resp()

        monkeypatch.setattr(srv.urllib.request, "urlopen", fake_urlopen)
        data = srv.post_chat_completion(
            "http://127.0.0.1:1234", {"messages": [], "temperature": 0.2}
        )
        assert data == {"choices": [{"message": {"content": "hi"}}]}
        assert captured["url"] == "http://127.0.0.1:1234/v1/chat/completions"
        assert _json.loads(captured["body"])["temperature"] == 0.2

    def test_completion_text_extracts_message_content(self):
        assert srv.completion_text({"choices": [{"message": {"content": "x"}}]}) == "x"

    def test_ensure_server_url_spawns_once_and_returns_base_url(self, fake_spawn):
        pool = LlamaServerPool()
        url = pool.ensure_server_url(_cfg(), model_path="m.gguf", mmproj_path="")
        assert url.startswith("http://127.0.0.1:")
        assert len(fake_spawn) == 1
        # A second ensure for the same key reuses the warm server, no cold reload.
        assert pool.ensure_server_url(_cfg(), model_path="m.gguf", mmproj_path="") == url
        assert len(fake_spawn) == 1
