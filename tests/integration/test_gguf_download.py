"""POST /api/llm/gguf/download + the download-gguf CLI (first-run-friction
Stage 2) - the server-owned one-click local .gguf download.

The route tests stub subprocess_sse (as test_model_prefetch.py does) so no real
subprocess runs. The CLI tests stub urllib.request.urlopen so no real multi-GB
network download runs - they assert the .part temp file + atomic rename, the
clean-restart-over-stale-.part decision, the size-mismatch rejection, and the
llm_model_path config write.
"""
from __future__ import annotations

import sys
from collections import namedtuple

import pytest
import typer
from fastapi.testclient import TestClient

from yuu_clip.cli import models as models_cli
from yuu_clip.web.routes import llm as llm_route

# ── route: allowlist + disk precheck + command build ─────────────────────────

class TestGgufDownloadGuard:
    def test_unknown_model_id_is_rejected(self, client: TestClient):
        resp = client.post("/api/llm/gguf/download", params={"model_id": "not-a-model"})
        assert resp.status_code == 400
        assert "Unknown model id" in resp.json()["detail"]

    def test_claude_model_id_is_rejected(self, client: TestClient):
        resp = client.post("/api/llm/gguf/download", params={"model_id": "claude-haiku-4-5"})
        assert resp.status_code == 400

    def test_unknown_model_id_never_spawns_a_subprocess(self, client: TestClient, monkeypatch):
        async def fail_if_called(*a, **k):
            raise AssertionError("must not spawn a subprocess for an unknown id")

        monkeypatch.setattr(llm_route, "subprocess_sse", fail_if_called)
        resp = client.post("/api/llm/gguf/download", params={"model_id": "bogus"})
        assert resp.status_code == 400


class TestGgufDownloadCommand:
    def _capture_cmd(self, client: TestClient, monkeypatch, tmp_path, model_id: str):
        from starlette.responses import PlainTextResponse

        import yuu_clip.config as config_mod

        captured = {}

        async def fake_sse(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            return PlainTextResponse("ok")

        monkeypatch.setattr(llm_route, "subprocess_sse", fake_sse)
        monkeypatch.setattr(config_mod, "models_dir", lambda: tmp_path)
        resp = client.post("/api/llm/gguf/download", params={"model_id": model_id})
        assert resp.status_code == 200, resp.text
        return captured["cmd"]

    def test_valid_text_model_builds_the_cli_command(self, client, monkeypatch, tmp_path):
        cmd = self._capture_cmd(client, monkeypatch, tmp_path, "qwen2.5-7b-instruct")
        assert cmd[0] == sys.executable
        assert cmd[1:4] == ["-m", "yuu_clip.cli", "download-gguf"]
        assert "--model-id" in cmd
        assert cmd[cmd.index("--model-id") + 1] == "qwen2.5-7b-instruct"

    def test_vision_model_id_is_accepted(self, client, monkeypatch, tmp_path):
        # The allowlist covers recommended vision entries - a vision model
        # downloads its weights + mmproj projector in one click.
        cmd = self._capture_cmd(client, monkeypatch, tmp_path, "qwen2.5-vl-7b-instruct")
        assert cmd[cmd.index("--model-id") + 1] == "qwen2.5-vl-7b-instruct"

    def test_disk_shortfall_returns_actionable_507(self, client, monkeypatch, tmp_path):
        import yuu_clip.config as config_mod

        async def fail_if_called(*a, **k):
            raise AssertionError("must not spawn a subprocess when disk is short")

        monkeypatch.setattr(llm_route, "subprocess_sse", fail_if_called)
        monkeypatch.setattr(config_mod, "models_dir", lambda: tmp_path)
        Usage = namedtuple("Usage", "total used free")
        monkeypatch.setattr(llm_route.shutil, "disk_usage", lambda _p: Usage(0, 0, 1_000_000))
        resp = client.post("/api/llm/gguf/download", params={"model_id": "qwen2.5-7b-instruct"})
        assert resp.status_code == 507
        detail = resp.json()["detail"]
        assert "Not enough disk space" in detail
        assert "Free up space" in detail


# ── CLI: entry resolution ────────────────────────────────────────────────────

class TestResolveGgufEntry:
    def test_accepts_a_recommended_text_model(self):
        entry, reason = models_cli._resolve_gguf_entry("qwen2.5-7b-instruct")
        assert reason == ""
        assert entry is not None and entry.gguf_filename

    def test_rejects_unknown_id(self):
        entry, reason = models_cli._resolve_gguf_entry("nope")
        assert entry is None
        assert "Unknown model id" in reason

    def test_accepts_a_recommended_vision_model(self):
        entry, reason = models_cli._resolve_gguf_entry("qwen2.5-vl-7b-instruct")
        assert reason == ""
        assert entry is not None
        assert entry.gguf_filename and entry.mmproj_filename

    def test_gguf_url_targets_the_resolve_path(self):
        entry, _ = models_cli._resolve_gguf_entry("qwen2.5-7b-instruct")
        url = models_cli._gguf_url(entry)
        assert url.endswith("/resolve/main/" + entry.gguf_filename)


# ── CLI: download mechanics (mocked network) ─────────────────────────────────

class _FakeResponse:
    def __init__(self, data: bytes, content_length: int | None = None):
        self._data = data
        self._pos = 0
        length = len(data) if content_length is None else content_length
        self.headers = {"Content-Length": str(length)}

    def read(self, size: int) -> bytes:
        chunk = self._data[self._pos:self._pos + size]
        self._pos += len(chunk)
        return chunk

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _patch_urlopen(monkeypatch, response: _FakeResponse):
    monkeypatch.setattr(
        models_cli.urllib.request, "urlopen", lambda request: response
    )


class TestDownloadGguf:
    def test_writes_dest_and_leaves_no_part(self, tmp_path, monkeypatch):
        payload = b"WEIGHTS-1234567890"
        _patch_urlopen(monkeypatch, _FakeResponse(payload))
        dest = tmp_path / "model.gguf"

        models_cli._download_gguf("http://x/model.gguf", dest, "Test Model")

        assert dest.read_bytes() == payload
        assert not dest.with_name(dest.name + ".part").exists()

    def test_stale_part_is_restarted_not_resumed(self, tmp_path, monkeypatch):
        payload = b"FRESH-CONTENT"
        _patch_urlopen(monkeypatch, _FakeResponse(payload))
        dest = tmp_path / "model.gguf"
        stale = dest.with_name(dest.name + ".part")
        stale.write_bytes(b"OLD-PARTIAL-JUNK-THAT-MUST-NOT-SURVIVE")

        models_cli._download_gguf("http://x/model.gguf", dest, "Test Model")

        assert dest.read_bytes() == payload
        assert not stale.exists()

    def test_incomplete_download_rejects_and_promotes_nothing(self, tmp_path, monkeypatch):
        payload = b"ONLY-HALF"
        # Content-Length claims more bytes than the body actually delivers.
        _patch_urlopen(monkeypatch, _FakeResponse(payload, content_length=len(payload) + 100))
        dest = tmp_path / "model.gguf"

        with pytest.raises(ValueError, match="incomplete download"):
            models_cli._download_gguf("http://x/model.gguf", dest, "Test Model")

        assert not dest.exists()
        assert not dest.with_name(dest.name + ".part").exists()


class TestSetLlmModelPath:
    def test_writes_llm_model_path_to_project_config(self, tmp_path):
        from yuu_clip.config import Config

        model_path = tmp_path / "models" / "model.gguf"
        models_cli._set_llm_model_path(tmp_path, model_path)

        assert Config.load(tmp_path).llm_model_path == str(model_path)


class TestDownloadGgufCommand:
    def test_downloads_and_sets_the_model_path(self, tmp_path, monkeypatch):
        import yuu_clip.config as config_mod
        from yuu_clip.config import Config

        models_dir = tmp_path / "models"
        monkeypatch.setattr(config_mod, "models_dir", lambda: models_dir)
        payload = b"COMPLETE-WEIGHTS"
        _patch_urlopen(monkeypatch, _FakeResponse(payload))

        models_cli.download_gguf_cmd(model_id="qwen2.5-7b-instruct", project=tmp_path)

        entry, _ = models_cli._resolve_gguf_entry("qwen2.5-7b-instruct")
        dest = models_dir / entry.gguf_filename
        assert dest.read_bytes() == payload
        cfg = Config.load(tmp_path)
        assert cfg.llm_model_path == str(dest)
        assert cfg.llm_vision_model_path == ""  # a text entry must not touch the vision path

    def test_already_downloaded_sets_path_without_refetching(self, tmp_path, monkeypatch):
        import yuu_clip.config as config_mod
        from yuu_clip.config import Config

        models_dir = tmp_path / "models"
        models_dir.mkdir()
        monkeypatch.setattr(config_mod, "models_dir", lambda: models_dir)
        entry, _ = models_cli._resolve_gguf_entry("qwen2.5-7b-instruct")
        dest = models_dir / entry.gguf_filename
        dest.write_bytes(b"ALREADY-HERE")

        def fail_if_called(request):
            raise AssertionError("must not download when the file already exists")

        monkeypatch.setattr(models_cli.urllib.request, "urlopen", fail_if_called)
        models_cli.download_gguf_cmd(model_id="qwen2.5-7b-instruct", project=tmp_path)

        assert Config.load(tmp_path).llm_model_path == str(dest)

    def test_unknown_id_exits_nonzero(self, tmp_path):
        with pytest.raises(typer.Exit) as exc:
            models_cli.download_gguf_cmd(model_id="nope", project=tmp_path)
        assert exc.value.exit_code == 1


# ── CLI: vision download fetches weights + mmproj, sets both paths ────────────

def _counting_urlopen(monkeypatch):
    """Patch urlopen to serve a fresh fake body per call and record the URLs, so
    a test can assert exactly which files were fetched and how many times."""
    urls: list[str] = []

    def fake_urlopen(request):
        urls.append(request.full_url)
        return _FakeResponse(b"MODEL-BYTES")

    monkeypatch.setattr(models_cli.urllib.request, "urlopen", fake_urlopen)
    return urls


class TestVisionDownload:
    def test_downloads_both_files_and_sets_both_paths(self, tmp_path, monkeypatch):
        import yuu_clip.config as config_mod
        from yuu_clip.config import Config

        models_dir = tmp_path / "models"
        monkeypatch.setattr(config_mod, "models_dir", lambda: models_dir)
        urls = _counting_urlopen(monkeypatch)

        models_cli.download_gguf_cmd(model_id="qwen2.5-vl-7b-instruct", project=tmp_path)

        entry, _ = models_cli._resolve_gguf_entry("qwen2.5-vl-7b-instruct")
        gguf_dest = models_dir / entry.gguf_filename
        mmproj_dest = models_dir / entry.mmproj_filename
        assert gguf_dest.exists() and mmproj_dest.exists()
        assert gguf_dest != mmproj_dest
        assert len(urls) == 2  # weights + projector, both distinct
        cfg = Config.load(tmp_path)
        assert cfg.llm_vision_model_path == str(gguf_dest)
        assert cfg.llm_mmproj_path == str(mmproj_dest)
        assert cfg.llm_model_path == ""  # the text model path must be untouched

    def test_shared_file_is_fetched_once_and_points_both_paths(self, tmp_path, monkeypatch):
        # Degenerate case the plan calls out: a vision entry whose projector lives
        # in the same file as the weights (mmproj_filename == gguf_filename) must
        # download once, not twice, and aim both paths at the one file.
        import yuu_clip.config as config_mod
        from yuu_clip.config import Config
        from yuu_clip.model_catalog import BACKEND_LLAMACPP, ModelEntry

        models_dir = tmp_path / "models"
        monkeypatch.setattr(config_mod, "models_dir", lambda: models_dir)
        urls = _counting_urlopen(monkeypatch)

        entry = ModelEntry(
            id="synthetic-vision", display_name="Synth Vision",
            kinds=frozenset({"vision"}), licence="Apache-2.0", why="test",
            backends=frozenset({BACKEND_LLAMACPP}),
            gguf_url="https://huggingface.co/x/y",
            gguf_filename="combined.gguf", mmproj_filename="combined.gguf",
        )
        models_cli._download_entry(entry, tmp_path)

        assert len(urls) == 1  # not fetched twice
        dest = models_dir / "combined.gguf"
        cfg = Config.load(tmp_path)
        assert cfg.llm_vision_model_path == str(dest)
        assert cfg.llm_mmproj_path == str(dest)
        assert cfg.llm_model_path == ""

    def test_existing_projector_is_not_refetched(self, tmp_path, monkeypatch):
        import yuu_clip.config as config_mod

        models_dir = tmp_path / "models"
        models_dir.mkdir()
        monkeypatch.setattr(config_mod, "models_dir", lambda: models_dir)
        entry, _ = models_cli._resolve_gguf_entry("qwen2.5-vl-7b-instruct")
        # Pre-place the projector; only the weights should be fetched.
        (models_dir / entry.mmproj_filename).write_bytes(b"ALREADY-HERE")
        urls = _counting_urlopen(monkeypatch)

        models_cli.download_gguf_cmd(model_id="qwen2.5-vl-7b-instruct", project=tmp_path)

        assert urls == [models_cli._file_url(entry, entry.gguf_filename)]
