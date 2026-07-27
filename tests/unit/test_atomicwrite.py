"""yuu_clip/atomicwrite.py - atomic_write_text and read_json_object_or_backup_corrupt,
extracted so config.py/contexts.py/track_labels.py's frequently-rewritten JSON files
get the same never-leave-a-half-written-file guarantee as project_archive.py's
restore path."""
from __future__ import annotations

import logging

import pytest


class TestAtomicWriteText:
    def test_writes_content(self, tmp_path):
        from yuu_clip.atomicwrite import atomic_write_text
        p = tmp_path / "sub" / "file.json"
        atomic_write_text(p, "hello")
        assert p.read_text(encoding="utf-8") == "hello"

    def test_creates_parent_directory(self, tmp_path):
        from yuu_clip.atomicwrite import atomic_write_text
        p = tmp_path / "nested" / "dir" / "file.json"
        atomic_write_text(p, "x")
        assert p.exists()

    def test_overwrites_existing_file(self, tmp_path):
        from yuu_clip.atomicwrite import atomic_write_text
        p = tmp_path / "file.json"
        p.write_text("old", encoding="utf-8")
        atomic_write_text(p, "new")
        assert p.read_text(encoding="utf-8") == "new"

    def test_no_leftover_temp_file(self, tmp_path):
        from yuu_clip.atomicwrite import atomic_write_text
        p = tmp_path / "file.json"
        atomic_write_text(p, "content")
        assert list(tmp_path.iterdir()) == [p]

    def test_write_failure_leaves_original_untouched(self, tmp_path, monkeypatch):
        import os

        from yuu_clip.atomicwrite import atomic_write_text
        p = tmp_path / "file.json"
        p.write_text("original", encoding="utf-8")

        def raising_replace(*a, **k):
            raise OSError("simulated failure")

        monkeypatch.setattr(os, "replace", raising_replace)
        with pytest.raises(OSError):
            atomic_write_text(p, "new content")
        assert p.read_text(encoding="utf-8") == "original"
        assert list(tmp_path.iterdir()) == [p]  # no leaked temp file


class TestReadJsonObjectOrBackupCorrupt:
    def _log(self):
        return logging.getLogger("test_atomicwrite")

    def test_missing_file_returns_empty(self, tmp_path):
        from yuu_clip.atomicwrite import read_json_object_or_backup_corrupt
        result = read_json_object_or_backup_corrupt(tmp_path / "missing.json", self._log(), "test")
        assert result == {}

    def test_valid_object_returned_unchanged(self, tmp_path):
        from yuu_clip.atomicwrite import read_json_object_or_backup_corrupt
        p = tmp_path / "f.json"
        p.write_text('{"a": 1}', encoding="utf-8")
        result = read_json_object_or_backup_corrupt(p, self._log(), "test")
        assert result == {"a": 1}
        assert p.exists()  # untouched, no backup made

    def test_invalid_json_backed_up_and_returns_empty(self, tmp_path):
        from yuu_clip.atomicwrite import read_json_object_or_backup_corrupt
        p = tmp_path / "f.json"
        p.write_text("not json{", encoding="utf-8")
        result = read_json_object_or_backup_corrupt(p, self._log(), "test")
        assert result == {}
        assert not p.exists()
        backup = tmp_path / "f.json.corrupt.bak"
        assert backup.read_text(encoding="utf-8") == "not json{"

    def test_non_object_json_backed_up_and_returns_empty(self, tmp_path):
        from yuu_clip.atomicwrite import read_json_object_or_backup_corrupt
        p = tmp_path / "f.json"
        p.write_text("[1, 2, 3]", encoding="utf-8")
        result = read_json_object_or_backup_corrupt(p, self._log(), "test")
        assert result == {}
        assert (tmp_path / "f.json.corrupt.bak").exists()

    def test_existing_backup_is_overwritten(self, tmp_path):
        from yuu_clip.atomicwrite import read_json_object_or_backup_corrupt
        p = tmp_path / "f.json"
        p.write_text("bad-1", encoding="utf-8")
        (tmp_path / "f.json.corrupt.bak").write_text("old-backup", encoding="utf-8")
        read_json_object_or_backup_corrupt(p, self._log(), "test")
        assert (tmp_path / "f.json.corrupt.bak").read_text(encoding="utf-8") == "bad-1"
