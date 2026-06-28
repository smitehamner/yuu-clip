from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Config.load() — project overrides global
# ---------------------------------------------------------------------------

class TestConfigLoad:
    def test_project_config_overrides_global(self, tmp_path):
        """Values in project config.json take precedence over global defaults."""
        import json
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"whisper_model": "tiny", "ollama_enabled": False}),
            encoding="utf-8",
        )
        config = Config.load(project_dir)
        assert config.whisper_model == "tiny"
        assert config.ollama_enabled is False

    def test_missing_config_returns_defaults(self, tmp_path):
        """When no config files exist, defaults are used."""
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        config = Config.load(project_dir)
        assert config.whisper_model == "base"  # default
        assert config.ollama_enabled is True    # default

    def test_unknown_keys_in_project_config_ignored(self, tmp_path):
        """Unknown keys in project config.json must not raise."""
        import json
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"whisper_model": "small", "unknown_future_key": 42}),
            encoding="utf-8",
        )
        config = Config.load(project_dir)
        assert config.whisper_model == "small"


# ---------------------------------------------------------------------------
# UI config endpoint — GET/PATCH /api/config
# ---------------------------------------------------------------------------

class TestUiConfig:
    def test_get_config_returns_defaults(self, client):
        r = client.get("/api/config")
        assert r.status_code == 200
        d = r.json()
        assert d["ui_timeline_interval_seconds"] == 900
        assert d["ui_timeline_interval_unit"] == "minutes"

    def test_patch_config_updates_interval(self, client):
        r = client.patch("/api/config", json={"ui_timeline_interval_seconds": 300, "ui_timeline_interval_unit": "seconds"})
        assert r.status_code == 200
        d = r.json()
        assert d["ui_timeline_interval_seconds"] == 300
        assert d["ui_timeline_interval_unit"] == "seconds"

    def test_patch_config_partial_update(self, client):
        client.patch("/api/config", json={"ui_timeline_interval_seconds": 600})
        r = client.get("/api/config")
        assert r.json()["ui_timeline_interval_seconds"] == 600

    def test_patch_config_interval_below_10_returns_400(self, client):
        r = client.patch("/api/config", json={"ui_timeline_interval_seconds": 5})
        assert r.status_code == 400

    def test_patch_config_invalid_unit_returns_400(self, client):
        r = client.patch("/api/config", json={"ui_timeline_interval_unit": "hours"})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Config — new llm_backend / llm_model_path defaults
# ---------------------------------------------------------------------------

class TestConfigNewLlmFields:
    def test_llm_backend_default_is_llamacpp(self):
        from yuu_clip.config import Config
        assert Config().llm_backend == "llamacpp"

    def test_llm_model_path_default_is_empty_string(self):
        from yuu_clip.config import Config
        assert Config().llm_model_path == ""

    def test_llm_backend_roundtrips_through_config_load(self, tmp_path):
        import json
        from yuu_clip.config import Config
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"llm_backend": "ollama", "llm_model_path": "/models/foo.gguf"}),
            encoding="utf-8",
        )
        cfg = Config.load(project_dir)
        assert cfg.llm_backend == "ollama"
        assert cfg.llm_model_path == "/models/foo.gguf"


# ---------------------------------------------------------------------------
# /api/config — patch llm_backend and llm_model_path
# ---------------------------------------------------------------------------

class TestConfigApiLlmFields:
    def test_get_config_includes_new_llm_fields(self, client):
        d = client.get("/api/config").json()
        assert "llm_backend" in d
        assert "llm_model_path" in d

    def test_patch_llm_backend_to_ollama(self, client):
        r = client.patch("/api/config", json={"llm_backend": "ollama"})
        assert r.status_code == 200
        assert r.json()["llm_backend"] == "ollama"

    def test_patch_llm_model_path(self, client):
        r = client.patch("/api/config", json={"llm_model_path": "/models/llama3.gguf"})
        assert r.status_code == 200
        assert r.json()["llm_model_path"] == "/models/llama3.gguf"


# ---------------------------------------------------------------------------
# validate_whisper_model
# ---------------------------------------------------------------------------

class TestValidateWhisperModel:
    """validate_whisper_model rejects arbitrary model strings."""

    def _validate(self, model):
        from yuu_clip.config import validate_whisper_model
        return validate_whisper_model(model)

    def test_valid_model_returns_unchanged(self):
        assert self._validate("medium") == "medium"

    def test_large_v3_accepted(self):
        assert self._validate("large-v3") == "large-v3"

    def test_arbitrary_string_raises(self):
        with pytest.raises(ValueError, match="Unknown Whisper model"):
            self._validate("gpt-4o-audio")

    def test_huggingface_repo_id_rejected(self):
        with pytest.raises(ValueError):
            self._validate("user/my-custom-model")

    def test_empty_string_rejected(self):
        with pytest.raises(ValueError):
            self._validate("")


# ---------------------------------------------------------------------------
# validate_whisper_language
# ---------------------------------------------------------------------------

class TestValidateWhisperLanguage:
    """validate_whisper_language accepts ISO codes and None/auto, rejects others."""

    def _validate(self, lang):
        from yuu_clip.config import validate_whisper_language
        return validate_whisper_language(lang)

    def test_none_returns_none(self):
        assert self._validate(None) is None

    def test_auto_returns_none(self):
        assert self._validate("auto") is None

    def test_empty_string_returns_none(self):
        assert self._validate("") is None

    def test_valid_code_returned_lowercase(self):
        assert self._validate("EN") == "en"

    def test_valid_code_fr(self):
        assert self._validate("fr") == "fr"

    def test_invalid_code_raises(self):
        with pytest.raises(ValueError, match="Unrecognised language code"):
            self._validate("xx")

    def test_arbitrary_string_rejected(self):
        with pytest.raises(ValueError):
            self._validate("klingon")
