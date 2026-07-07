from __future__ import annotations

from yuu_clip.hf_cache import repo_cached


class _FakeRepo:
    def __init__(self, repo_id, repo_type="model", revisions=frozenset({"rev"})):
        self.repo_id = repo_id
        self.repo_type = repo_type
        self.revisions = revisions


class _FakeCacheInfo:
    def __init__(self, repos):
        self.repos = repos


class TestRepoCached:
    def test_true_when_repo_present_with_a_revision(self, monkeypatch):
        import huggingface_hub

        monkeypatch.setattr(
            huggingface_hub, "scan_cache_dir",
            lambda cache_dir=None: _FakeCacheInfo([_FakeRepo("org/model")]),
        )
        assert repo_cached("org/model") is True

    def test_false_when_repo_absent(self, monkeypatch):
        import huggingface_hub

        monkeypatch.setattr(
            huggingface_hub, "scan_cache_dir",
            lambda cache_dir=None: _FakeCacheInfo([_FakeRepo("org/other-model")]),
        )
        assert repo_cached("org/model") is False

    def test_false_when_revisions_empty(self, monkeypatch):
        """A repo entry with no complete revision (e.g. an interrupted download)
        must not be reported as cached."""
        import huggingface_hub

        monkeypatch.setattr(
            huggingface_hub, "scan_cache_dir",
            lambda cache_dir=None: _FakeCacheInfo([_FakeRepo("org/model", revisions=frozenset())]),
        )
        assert repo_cached("org/model") is False

    def test_false_when_repo_type_is_not_model(self, monkeypatch):
        import huggingface_hub

        monkeypatch.setattr(
            huggingface_hub, "scan_cache_dir",
            lambda cache_dir=None: _FakeCacheInfo([_FakeRepo("org/model", repo_type="dataset")]),
        )
        assert repo_cached("org/model") is False

    def test_false_when_cache_dir_missing(self, monkeypatch):
        import huggingface_hub
        from huggingface_hub.errors import CacheNotFound

        def _raise(cache_dir=None):
            raise CacheNotFound("no cache", cache_dir="C:/nope")

        monkeypatch.setattr(huggingface_hub, "scan_cache_dir", _raise)
        assert repo_cached("org/model", cache_dir="C:/nope") is False

    def test_false_on_unexpected_scan_error(self, monkeypatch):
        """Never let a huggingface_hub internals change turn a cheap status
        check into a hard failure — degrade to "not cached" instead."""
        import huggingface_hub

        def _raise(cache_dir=None):
            raise RuntimeError("boom")

        monkeypatch.setattr(huggingface_hub, "scan_cache_dir", _raise)
        assert repo_cached("org/model") is False

    def test_passes_cache_dir_through(self, monkeypatch):
        import huggingface_hub

        seen = {}

        def _scan(cache_dir=None):
            seen["cache_dir"] = cache_dir
            return _FakeCacheInfo([])

        monkeypatch.setattr(huggingface_hub, "scan_cache_dir", _scan)
        repo_cached("org/model", cache_dir="/some/custom/dir")
        assert seen["cache_dir"] == "/some/custom/dir"
