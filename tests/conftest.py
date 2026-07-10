"""
Root fixtures shared by every yuu-clip test tier.

Only truly-global fixtures live here. Seeded-DB / TestClient fixtures are in
``tests/integration/conftest.py``; the Playwright / live-server fixtures are in
``tests/ui/conftest.py``.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import yuu_clip.config as config_mod

# ---------------------------------------------------------------------------
# Global config isolation - Config.load() always reads the real OS-level
# global config dir (platformdirs), so without this every test run picks up
# whatever settings are saved on the machine actually running the suite.
# Autouse so every test gets an isolated, empty global config dir by default;
# tests that need specific global values still monkeypatch _global_config_dir
# themselves (that continues to work - it just overrides this default).
# Kept root-level and autouse so unit + integration + ui all inherit it.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def isolate_global_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        config_mod, "_global_config_dir", lambda: tmp_path / "_isolated_global_config"
    )
