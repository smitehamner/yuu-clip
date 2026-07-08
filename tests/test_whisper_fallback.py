"""Unit tests - Whisper model loading falls back to CPU when CUDA libraries are missing.

A machine can report a CUDA device (GPU + driver) yet lack the cuBLAS/cuDNN runtime
libraries CTranslate2 links against, failing with 'cublas64_12.dll is not found'.
_get_model must retry on CPU instead of aborting the analysis.
"""
from __future__ import annotations

import importlib.util
import types

import pytest

from yuu_clip import config as config_mod
from yuu_clip.transcribe import whisper_runner


class _FakeModel:
    def __init__(self, device: str):
        self.device = device


@pytest.fixture(autouse=True)
def clear_model_cache():
    whisper_runner._model_cache.clear()
    whisper_runner._cuda_dll_dirs_registered = False
    yield
    whisper_runner._model_cache.clear()
    whisper_runner._cuda_dll_dirs_registered = False


def _config() -> config_mod.Config:
    return config_mod.Config(whisper_model="base")


def test_cuda_load_failure_falls_back_to_cpu(monkeypatch):
    monkeypatch.setattr(
        whisper_runner, "_resolve_device_and_compute", lambda _cfg: ("cuda", "float16")
    )

    def fake_load(_cfg, device, _compute):
        if device == "cuda":
            raise RuntimeError("Library cublas64_12.dll is not found or cannot be loaded")
        return _FakeModel(device)

    monkeypatch.setattr(whisper_runner, "_load_whisper_model", fake_load)

    model = whisper_runner._get_model(_config())

    assert model.device == "cpu"
    assert ("base", "cpu", "int8", None) in whisper_runner._model_cache


def test_cpu_load_failure_raises_actionable_error(monkeypatch):
    monkeypatch.setattr(
        whisper_runner, "_resolve_device_and_compute", lambda _cfg: ("cpu", "int8")
    )

    def fake_load(_cfg, _device, _compute):
        raise RuntimeError("Couldn't connect to huggingface.co")

    monkeypatch.setattr(whisper_runner, "_load_whisper_model", fake_load)

    with pytest.raises(whisper_runner.TranscriptionModelError) as excinfo:
        whisper_runner._get_model(_config())

    message = str(excinfo.value)
    assert "check your connection" in message
    assert "Couldn't connect to huggingface.co" in message  # original detail preserved


def test_successful_cuda_load_is_not_retried(monkeypatch):
    monkeypatch.setattr(
        whisper_runner, "_resolve_device_and_compute", lambda _cfg: ("cuda", "float16")
    )
    calls: list[str] = []

    def fake_load(_cfg, device, _compute):
        calls.append(device)
        return _FakeModel(device)

    monkeypatch.setattr(whisper_runner, "_load_whisper_model", fake_load)

    model = whisper_runner._get_model(_config())

    assert model.device == "cuda"
    assert calls == ["cuda"]


def test_register_cuda_dll_dirs_adds_wheel_bin_dirs(tmp_path, monkeypatch):
    if not hasattr(whisper_runner.os, "add_dll_directory"):
        pytest.skip("add_dll_directory is Windows-only")

    cublas_bin = tmp_path / "cublas" / "bin"
    cudnn_bin = tmp_path / "cudnn" / "bin"
    cublas_bin.mkdir(parents=True)
    cudnn_bin.mkdir(parents=True)

    def fake_find_spec(name):
        location = {"nvidia.cublas": cublas_bin.parent, "nvidia.cudnn": cudnn_bin.parent}[name]
        spec = types.SimpleNamespace()
        spec.submodule_search_locations = [str(location)]
        return spec

    added: list[str] = []
    monkeypatch.setattr(importlib.util, "find_spec", fake_find_spec)
    monkeypatch.setattr(whisper_runner.os, "add_dll_directory", lambda p: added.append(p))

    whisper_runner._register_cuda_dll_dirs()
    whisper_runner._register_cuda_dll_dirs()  # idempotent - second call is a no-op

    assert added == [str(cublas_bin), str(cudnn_bin)]


def test_register_cuda_dll_dirs_skips_missing_wheels(monkeypatch):
    if not hasattr(whisper_runner.os, "add_dll_directory"):
        pytest.skip("add_dll_directory is Windows-only")

    monkeypatch.setattr(importlib.util, "find_spec", lambda _name: None)
    added: list[str] = []
    monkeypatch.setattr(whisper_runner.os, "add_dll_directory", lambda p: added.append(p))

    whisper_runner._register_cuda_dll_dirs()

    assert added == []
