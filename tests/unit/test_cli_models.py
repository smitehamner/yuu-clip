"""yuu_clip/cli/models.py - pure download helpers (no network, no DB).

The download-gguf command has substantial pure logic (allowlist gate, vision-vs-text
target selection, size verification) that the CLI --help smoke test does not exercise.
These guard the contract the web /api/llm/gguf/download route depends on.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from yuu_clip.cli.models import (
    _download_targets,
    _resolve_gguf_entry,
    _verify_complete,
)


def _entry(**overrides):
    base = dict(
        id="fake",
        recommended=True,
        backends=frozenset({"llamacpp"}),
        gguf_filename="fake-Q4_K_M.gguf",
        gguf_url="https://example/fake",
        kinds=frozenset({"text"}),
        mmproj_filename=None,
        display_name="Fake",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class TestResolveGgufEntry:
    def test_unknown_id_is_rejected(self, monkeypatch):
        from yuu_clip import model_catalog
        monkeypatch.setattr(model_catalog, "model_by_id", lambda _id: None)
        entry, reason = _resolve_gguf_entry("nope")
        assert entry is None
        assert "Unknown model id" in reason

    def test_non_recommended_entry_is_rejected(self, monkeypatch):
        from yuu_clip import model_catalog
        monkeypatch.setattr(model_catalog, "model_by_id", lambda _id: _entry(recommended=False))
        entry, reason = _resolve_gguf_entry("llama-licensed")
        assert entry is None
        assert "Unknown model id" in reason

    def test_recommended_entry_without_gguf_is_rejected(self, monkeypatch):
        from yuu_clip import model_catalog
        monkeypatch.setattr(model_catalog, "model_by_id", lambda _id: _entry(gguf_filename=""))
        entry, reason = _resolve_gguf_entry("claude-remote")
        assert entry is None
        assert "no downloadable" in reason

    def test_recommended_non_llamacpp_backend_is_rejected(self, monkeypatch):
        from yuu_clip import model_catalog
        monkeypatch.setattr(model_catalog, "model_by_id", lambda _id: _entry(backends=frozenset({"claude"})))
        entry, reason = _resolve_gguf_entry("claude-remote")
        assert entry is None
        assert "no downloadable" in reason

    def test_recommended_llamacpp_entry_resolves(self, monkeypatch):
        from yuu_clip import model_catalog
        wanted = _entry()
        monkeypatch.setattr(model_catalog, "model_by_id", lambda _id: wanted)
        entry, reason = _resolve_gguf_entry("fake")
        assert entry is wanted
        assert reason == ""


class TestDownloadTargets:
    def test_text_entry_fetches_only_weights_into_text_path(self):
        targets = _download_targets(_entry())
        assert targets == [("fake-Q4_K_M.gguf", "llm_model_path")]

    def test_vision_entry_fetches_weights_and_projector_into_vision_paths(self):
        entry = _entry(
            kinds=frozenset({"vision"}),
            gguf_filename="vis.gguf",
            mmproj_filename="mmproj.gguf",
        )
        assert _download_targets(entry) == [
            ("vis.gguf", "llm_vision_model_path"),
            ("mmproj.gguf", "llm_mmproj_path"),
        ]

    def test_vision_entry_without_separate_projector_fetches_weights_only(self):
        entry = _entry(kinds=frozenset({"vision"}), gguf_filename="vis.gguf", mmproj_filename=None)
        assert _download_targets(entry) == [("vis.gguf", "llm_vision_model_path")]


class TestVerifyComplete:
    def test_size_match_passes(self, tmp_path):
        part = tmp_path / "model.gguf.part"
        part.write_bytes(b"abcd")
        _verify_complete(part, 4)  # no raise
        assert part.exists()

    def test_size_mismatch_raises_and_removes_partial(self, tmp_path):
        part = tmp_path / "model.gguf.part"
        part.write_bytes(b"abcd")
        with pytest.raises(ValueError, match="incomplete download"):
            _verify_complete(part, 999)
        assert not part.exists()

    def test_unknown_total_with_nonempty_file_is_not_size_verified(self, tmp_path):
        part = tmp_path / "model.gguf.part"
        part.write_bytes(b"abcd")
        _verify_complete(part, 0)  # can't check size against a total we never got, but not empty either
        assert part.exists()

    def test_unknown_total_with_empty_file_raises_and_removes_partial(self, tmp_path):
        # No Content-Length to check size against, but a zero-byte download is
        # never a valid model regardless.
        part = tmp_path / "model.gguf.part"
        part.write_bytes(b"")
        with pytest.raises(ValueError, match="empty file"):
            _verify_complete(part, 0)
        assert not part.exists()
