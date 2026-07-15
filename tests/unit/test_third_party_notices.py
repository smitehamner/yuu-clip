"""Drift guard: the committed THIRD-PARTY-NOTICES.md must still cover every runtime
dependency pinned in requirements.lock and every bundled component. Regenerate with
`yuu-dev notices` when this fails (mirrors the FFmpeg notices guard)."""
from __future__ import annotations

import re
from pathlib import Path

from yuu_clip.dev.notices import _BUNDLED_COMPONENTS, NOTICES_PATH, normalize_name, parse_lock

_REPO_ROOT = Path(__file__).resolve().parents[2]
_LOCK_PATH = _REPO_ROOT / "requirements.lock"


def _notices_text() -> str:
    return NOTICES_PATH.read_text(encoding="utf-8")


def _heading_names() -> set[str]:
    return {normalize_name(m) for m in re.findall(r"^## (\S+)", _notices_text(), re.MULTILINE)}


def test_notices_file_exists_and_is_substantial():
    assert NOTICES_PATH.exists(), "third-party-notices/THIRD-PARTY-NOTICES.md missing - run `yuu-dev notices`"
    assert len(_notices_text()) > 5000


def test_every_pinned_package_has_a_section():
    headings = _heading_names()
    pinned = {normalize_name(name) for name, _ in parse_lock(_LOCK_PATH.read_text(encoding="utf-8"))}
    missing = sorted(pinned - headings)
    assert not missing, f"requirements.lock packages absent from notices (run `yuu-dev notices`): {missing}"


def test_every_bundled_component_has_a_section():
    text = _notices_text()
    for name, _purpose, _license, _path in _BUNDLED_COMPONENTS:
        assert f"## {name}" in text, f"bundled component {name!r} missing from notices"
