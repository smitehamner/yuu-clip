"""The YUU_CONFIG_DIR override on the global-config location.

Bound at import time so the autouse ``isolate_global_config`` fixture (which
rebinds ``config._global_config_dir`` on the module) can't shadow the real
implementation under test here.
"""
from __future__ import annotations

from pathlib import Path

from yuu_clip.config import _global_config_dir as real_global_config_dir


def test_env_override_wins(monkeypatch, tmp_path):
    target = tmp_path / "isolated-cfg"
    monkeypatch.setenv("YUU_CONFIG_DIR", str(target))
    assert real_global_config_dir() == target


def test_falls_back_to_platformdirs_when_unset(monkeypatch):
    monkeypatch.delenv("YUU_CONFIG_DIR", raising=False)
    result = real_global_config_dir()
    assert isinstance(result, Path)
    assert result.name == "yuu-clip"
