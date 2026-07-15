"""Drift guard: the committed THIRD-PARTY-NOTICES.md must still cover every runtime
dependency pinned in requirements.lock and every bundled component. Regenerate with
`yuu-dev notices` when this fails (mirrors the FFmpeg notices guard)."""
from __future__ import annotations

import re
from importlib import metadata
from pathlib import Path

from yuu_clip.dev.notices import (
    _BUNDLED_COMPONENTS,
    NOTICES_PATH,
    _is_license_file,
    normalize_name,
    parse_lock,
)

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


class TestParseLock:
    def test_parses_pins_and_skips_comments_and_blanks(self):
        lock = "# a comment\n\nrequests==2.31.0\n   \nurllib3==2.0.0\n"
        assert parse_lock(lock) == [("requests", "2.31.0"), ("urllib3", "2.0.0")]

    def test_strips_environment_markers_from_version(self):
        assert parse_lock("foo==1.2.3 ; python_version < '3.9'\n") == [("foo", "1.2.3")]

    def test_ignores_non_pin_lines(self):
        assert parse_lock("-r base.txt\nfoo>=1.0\n") == []

    def test_sorts_by_normalized_name(self):
        lock = "Zebra==1.0\nunder_score==2.0\nAlpha==3.0\n"
        assert [name for name, _ in parse_lock(lock)] == ["Alpha", "under_score", "Zebra"]


class TestIsLicenseFile:
    def test_license_in_dist_info_matches(self):
        assert _is_license_file(metadata.PackagePath("foo-1.0.dist-info", "LICENSE"))

    def test_notice_in_egg_info_matches(self):
        assert _is_license_file(metadata.PackagePath("foo-1.0.egg-info", "NOTICE"))

    def test_top_level_license_matches(self):
        assert _is_license_file(metadata.PackagePath("onnxruntime", "LICENSE"))

    def test_lowercase_license_name_matches(self):
        assert _is_license_file(metadata.PackagePath("foo-1.0.dist-info", "license.txt"))

    def test_non_license_name_rejected(self):
        assert not _is_license_file(metadata.PackagePath("foo-1.0.dist-info", "METADATA"))

    def test_deep_non_metadata_path_rejected(self):
        assert not _is_license_file(metadata.PackagePath("pkg", "sub", "LICENSE"))

    def test_license_named_source_file_rejected(self):
        assert not _is_license_file(metadata.PackagePath("pkg", "license.py"))
        assert not _is_license_file(metadata.PackagePath("pkg", "licence.so"))
