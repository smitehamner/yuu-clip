"""yuu_clip/pathsafety.py - the shared path-containment predicate."""

from __future__ import annotations

from yuu_clip.pathsafety import is_within


class TestIsWithin:
    def test_child_is_within(self, tmp_path):
        assert is_within(tmp_path / "a" / "b.txt", tmp_path) is True

    def test_base_itself_is_within(self, tmp_path):
        assert is_within(tmp_path, tmp_path) is True

    def test_sibling_is_not_within(self, tmp_path):
        base = tmp_path / "base"
        base.mkdir()
        assert is_within(tmp_path / "other" / "x.txt", base) is False

    def test_parent_is_not_within_child(self, tmp_path):
        child = tmp_path / "child"
        assert is_within(tmp_path, child) is False

    def test_traversal_escape_is_not_within(self, tmp_path):
        base = tmp_path / "base"
        # A resolved escape (what a "../" member becomes after .resolve()).
        escaped = (base / ".." / "escape.txt").resolve()
        assert is_within(escaped, base.resolve()) is False
