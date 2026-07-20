"""/api/pick-folder - the server-side native directory picker (B26).

Mirrors /api/pick-file's pattern but for a folder (tkinter.filedialog.askdirectory
instead of askopenfilename), used as the non-Electron fallback for folder-picker
buttons. tkinter isn't guaranteed to be importable/usable in a headless CI
environment, so every test injects a fake tkinter/tkinter.filedialog module via
sys.modules rather than exercising a real dialog.
"""
from __future__ import annotations

import sys
import types
from typing import Iterator
from unittest.mock import MagicMock

import pytest


@pytest.fixture()
def fake_tkinter() -> Iterator[MagicMock]:
    """Installs a fake tkinter + tkinter.filedialog into sys.modules for the
    duration of a test, and returns the fake filedialog module so a test can
    set askdirectory's return value / assert how it was called."""
    fake_tk = types.ModuleType("tkinter")
    fake_root = MagicMock()
    fake_tk.Tk = MagicMock(return_value=fake_root)  # type: ignore[attr-defined]
    fake_filedialog = types.ModuleType("tkinter.filedialog")
    fake_filedialog.askdirectory = MagicMock(return_value="")  # type: ignore[attr-defined]
    fake_tk.filedialog = fake_filedialog  # type: ignore[attr-defined]

    originals = {name: sys.modules.get(name) for name in ("tkinter", "tkinter.filedialog")}
    sys.modules["tkinter"] = fake_tk
    sys.modules["tkinter.filedialog"] = fake_filedialog
    try:
        yield fake_filedialog
    finally:
        for name, original in originals.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original


class TestPickFolder:
    def test_returns_chosen_path(self, client, fake_tkinter: MagicMock):
        fake_tkinter.askdirectory.return_value = r"D:\Videos\my-project"
        r = client.get("/api/pick-folder")
        assert r.status_code == 200
        assert r.json() == {"path": r"D:\Videos\my-project"}

    def test_cancel_returns_none(self, client, fake_tkinter: MagicMock):
        fake_tkinter.askdirectory.return_value = ""
        r = client.get("/api/pick-folder")
        assert r.status_code == 200
        assert r.json() == {"path": None}

    def test_unknown_kind_is_rejected(self, client, fake_tkinter: MagicMock):
        r = client.get("/api/pick-folder", params={"kind": "bogus"})
        assert r.status_code == 400
        assert "kind must be one of" in r.json()["detail"]
        fake_tkinter.askdirectory.assert_not_called()

    def test_destroys_the_root_window_even_on_error(self, client, fake_tkinter: MagicMock):
        fake_tkinter.askdirectory.side_effect = RuntimeError("dialog failed")
        with pytest.raises(RuntimeError, match="dialog failed"):
            client.get("/api/pick-folder")
        root = sys.modules["tkinter"].Tk.return_value
        root.destroy.assert_called_once()
