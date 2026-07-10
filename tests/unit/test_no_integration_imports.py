"""Meta-test: keep the unit tier free of integration/server imports.

A unit test that imports the FastAPI app (or a TestClient) has quietly become an
integration test - it pulls in the whole router stack and stops being
state-independent. This catches that drift at collection time, cheaply, so the
tests/unit vs tests/integration boundary does not rot.
"""
from __future__ import annotations

from pathlib import Path

FORBIDDEN = ("fastapi.testclient", "yuu_clip.web.app")

_SELF = Path(__file__).resolve()
_UNIT_DIR = _SELF.parent


def test_unit_tests_do_not_import_the_web_app() -> None:
    offenders = []
    for path in sorted(_UNIT_DIR.glob("test_*.py")):
        if path.resolve() == _SELF:  # this file names the forbidden strings on purpose
            continue
        text = path.read_text(encoding="utf-8")
        for needle in FORBIDDEN:
            if needle in text:
                offenders.append(f"{path.name} imports {needle}")
    assert not offenders, (
        "unit tests must not import the web app / TestClient "
        "(move them to tests/integration): " + "; ".join(offenders)
    )
