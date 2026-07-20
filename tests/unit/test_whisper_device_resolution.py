"""Unit tests - _resolve_device_and_compute (transcribe/transcriber.py).

Covers device 'auto' resolution and the compute_type 'auto' vs explicit-choice
split (B11): 'auto' picks float16 on cuda / int8 on cpu (mirroring the Compute
type dropdown's hint text), but an explicit choice like 'int8' on a GPU is now
honored as-is rather than silently upgraded to float16.
"""
from __future__ import annotations

import sys
import types

import pytest

from yuu_clip.config import Config
from yuu_clip.transcribe.transcriber import _resolve_device_and_compute


def _fake_ctranslate2(cuda_device_count: int):
    return types.SimpleNamespace(get_cuda_device_count=lambda: cuda_device_count)


@pytest.mark.parametrize(
    "device, compute_type, expected",
    [
        ("cpu",  "auto",    ("cpu", "int8")),
        ("cuda", "auto",    ("cuda", "float16")),
        ("cuda", "int8",    ("cuda", "int8")),       # explicit int8 on GPU: honored, not upgraded
        ("cpu",  "float16", ("cpu", "float16")),     # explicit choice honored on CPU too
        ("cuda", "float32", ("cuda", "float32")),
    ],
)
def test_explicit_device_resolves_compute_type(device, compute_type, expected):
    config = Config(whisper_device=device, whisper_compute_type=compute_type)
    assert _resolve_device_and_compute(config) == expected


def test_auto_device_resolves_to_cuda_when_available(monkeypatch):
    monkeypatch.setitem(sys.modules, "ctranslate2", _fake_ctranslate2(1))
    config = Config(whisper_device="auto", whisper_compute_type="auto")
    assert _resolve_device_and_compute(config) == ("cuda", "float16")


def test_auto_device_resolves_to_cpu_when_no_cuda(monkeypatch):
    monkeypatch.setitem(sys.modules, "ctranslate2", _fake_ctranslate2(0))
    config = Config(whisper_device="auto", whisper_compute_type="auto")
    assert _resolve_device_and_compute(config) == ("cpu", "int8")


def test_auto_device_falls_back_to_cpu_when_ctranslate2_missing(monkeypatch):
    # sys.modules[name] = None forces `import ctranslate2` to raise ImportError,
    # exercising the except branch without needing the real package absent.
    monkeypatch.setitem(sys.modules, "ctranslate2", None)
    config = Config(whisper_device="auto", whisper_compute_type="auto")
    assert _resolve_device_and_compute(config) == ("cpu", "int8")


def test_config_default_compute_type_is_auto():
    assert Config().whisper_compute_type == "auto"
