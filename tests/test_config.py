from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# Config.load() — project overrides global
# ---------------------------------------------------------------------------

class TestConfigLoad:
    def test_project_config_overrides_global(self, tmp_path, monkeypatch):
        """Values in project config.json take precedence over global defaults."""
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
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

    def test_missing_config_returns_defaults(self, tmp_path, monkeypatch):
        """When no config files exist, defaults are used."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        config = Config.load(project_dir)
        assert config.whisper_model == "base"  # default
        assert config.ollama_enabled is True    # default

    def test_global_config_is_loaded(self, tmp_path, monkeypatch):
        """Values in global config.json are merged in when no project config overrides them."""
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        global_dir = tmp_path / "global_cfg"
        global_dir.mkdir()
        (global_dir / "config.json").write_text(
            json.dumps({"whisper_model": "large-v3"}), encoding="utf-8"
        )
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: global_dir)
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        config = Config.load(project_dir)
        assert config.whisper_model == "large-v3"

    def test_project_config_overrides_global_value(self, tmp_path, monkeypatch):
        """Project config takes precedence over global config for the same key."""
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        global_dir = tmp_path / "global_cfg"
        global_dir.mkdir()
        (global_dir / "config.json").write_text(
            json.dumps({"whisper_model": "large-v3"}), encoding="utf-8"
        )
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: global_dir)
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"whisper_model": "tiny"}), encoding="utf-8"
        )
        config = Config.load(project_dir)
        assert config.whisper_model == "tiny"

    def test_unknown_keys_in_project_config_ignored(self, tmp_path, monkeypatch):
        """Unknown keys in project config.json must not raise."""
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
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

    def test_get_config_includes_speaker_match_threshold_default(self, client):
        assert client.get("/api/config").json()["speaker_match_threshold"] == 0.75

    def test_patch_config_updates_speaker_match_threshold(self, client):
        r = client.patch("/api/config", json={"speaker_match_threshold": 0.6})
        assert r.status_code == 200
        assert r.json()["speaker_match_threshold"] == 0.6

    def test_patch_config_speaker_threshold_out_of_range_returns_400(self, client):
        assert client.patch("/api/config", json={"speaker_match_threshold": 1.5}).status_code == 400
        assert client.patch("/api/config", json={"speaker_match_threshold": -0.1}).status_code == 400

    def test_patch_config_speaker_threshold_bounds_accepted(self, client):
        assert client.patch("/api/config", json={"speaker_match_threshold": 0.0}).status_code == 200
        assert client.patch("/api/config", json={"speaker_match_threshold": 1.0}).status_code == 200

    def test_get_config_includes_export_name_template_default(self, client):
        assert client.get("/api/config").json()["export_name_template"] == "{video}_clip{clip_id}_{start}"

    def test_patch_config_updates_export_name_template(self, client):
        r = client.patch("/api/config", json={"export_name_template": "{date}_{video}_{clip_id}"})
        assert r.status_code == 200
        assert r.json()["export_name_template"] == "{date}_{video}_{clip_id}"

    def test_patch_config_unknown_placeholder_returns_400(self, client):
        r = client.patch("/api/config", json={"export_name_template": "{video}_{bogus}"})
        assert r.status_code == 400
        assert "bogus" in r.json()["detail"]


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

    def test_llm_backend_roundtrips_through_config_load(self, tmp_path, monkeypatch):
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
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


# ---------------------------------------------------------------------------
# whisper_language — config field, API, and pipeline resolution
# ---------------------------------------------------------------------------

class TestWhisperLanguageConfig:
    def test_default_is_empty_string_meaning_auto(self):
        from yuu_clip.config import Config
        assert Config().whisper_language == ""

    def test_roundtrips_through_config_load(self, tmp_path, monkeypatch):
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(
            json.dumps({"whisper_language": "de"}), encoding="utf-8"
        )
        assert Config.load(project_dir).whisper_language == "de"


class TestWhisperLanguageApi:
    def test_get_config_includes_whisper_language(self, client):
        d = client.get("/api/config").json()
        assert d["whisper_language"] == ""

    def test_patch_valid_code_stored_lowercase(self, client):
        r = client.patch("/api/config", json={"whisper_language": "EN"})
        assert r.status_code == 200
        assert r.json()["whisper_language"] == "en"

    def test_patch_auto_stored_as_empty_string(self, client):
        client.patch("/api/config", json={"whisper_language": "fr"})
        r = client.patch("/api/config", json={"whisper_language": "auto"})
        assert r.status_code == 200
        assert r.json()["whisper_language"] == ""

    def test_patch_invalid_code_returns_400(self, client):
        assert client.patch("/api/config", json={"whisper_language": "klingon"}).status_code == 400

    def test_whisper_languages_endpoint_lists_codes(self, client):
        r = client.get("/api/config/whisper-languages")
        assert r.status_code == 200
        langs = r.json()["languages"]
        assert "en" in langs
        assert "fr" in langs
        assert langs == sorted(langs)


class TestResolveTranscriptionLanguage:
    def _resolve(self, explicit, config_lang):
        from yuu_clip.config import Config
        from yuu_clip.transcribe.whisper_runner import resolve_transcription_language
        return resolve_transcription_language(explicit, Config(whisper_language=config_lang))

    def test_explicit_language_wins_over_config(self):
        assert self._resolve("fr", "de") == "fr"

    def test_config_language_used_when_no_explicit(self):
        assert self._resolve(None, "de") == "de"

    def test_auto_everywhere_resolves_to_none(self):
        assert self._resolve(None, "") is None

    def test_invalid_config_value_raises(self):
        import pytest
        with pytest.raises(ValueError, match="Unrecognised language code"):
            self._resolve(None, "klingon")


# ---------------------------------------------------------------------------
# Track-layout profile CRUD
# ---------------------------------------------------------------------------

class TestProfiles:
    """save_profile / delete_profile / load_profiles round-trip through disk."""

    def _patch(self, monkeypatch, tmp_path):
        import yuu_clip.config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "cfg")

    def test_empty_profiles_returns_empty_dict(self, monkeypatch, tmp_path):
        self._patch(monkeypatch, tmp_path)
        from yuu_clip.config import load_profiles
        assert load_profiles() == {}

    def test_save_and_load_profile(self, monkeypatch, tmp_path):
        self._patch(monkeypatch, tmp_path)
        from yuu_clip.config import load_profiles, save_profile
        assignments = [{"stream_position": 0, "label": "player_voice", "transcribe": True}]
        save_profile("2track", assignments)
        profiles = load_profiles()
        assert "2track" in profiles
        assert profiles["2track"]["num_tracks"] == 1
        assert profiles["2track"]["assignments"] == assignments

    def test_save_overwrites_existing_profile(self, monkeypatch, tmp_path):
        self._patch(monkeypatch, tmp_path)
        from yuu_clip.config import load_profiles, save_profile
        save_profile("p", [{"stream_position": 0, "label": "combined", "transcribe": True}])
        save_profile("p", [{"stream_position": 0, "label": "player_voice", "transcribe": True}])
        assert load_profiles()["p"]["assignments"][0]["label"] == "player_voice"

    def test_delete_profile(self, monkeypatch, tmp_path):
        self._patch(monkeypatch, tmp_path)
        from yuu_clip.config import delete_profile, load_profiles, save_profile
        save_profile("to_delete", [])
        delete_profile("to_delete")
        assert "to_delete" not in load_profiles()

    def test_delete_nonexistent_profile_is_silent(self, monkeypatch, tmp_path):
        self._patch(monkeypatch, tmp_path)
        from yuu_clip.config import delete_profile
        delete_profile("nonexistent")  # must not raise

    def test_multiple_profiles_coexist(self, monkeypatch, tmp_path):
        self._patch(monkeypatch, tmp_path)
        from yuu_clip.config import load_profiles, save_profile
        save_profile("alpha", [])
        save_profile("beta", [])
        profiles = load_profiles()
        assert "alpha" in profiles
        assert "beta" in profiles


class TestConfigPatchWhisperModel:
    def test_valid_whisper_model_accepted(self, client):
        r = client.patch("/api/config", json={"whisper_model": "small"})
        assert r.status_code == 200
        assert r.json()["whisper_model"] == "small"

    def test_invalid_whisper_model_returns_400(self, client):
        r = client.patch("/api/config", json={"whisper_model": "gpt-4o"})
        assert r.status_code == 400

    def test_empty_whisper_model_returns_400(self, client):
        r = client.patch("/api/config", json={"whisper_model": ""})
        assert r.status_code == 400

    def test_scene_detection_mode_valid(self, client):
        r = client.patch("/api/config", json={"scene_detection_mode": "fast"})
        assert r.status_code == 200
        assert r.json()["scene_detection_mode"] == "fast"

    def test_scene_detection_mode_invalid(self, client):
        r = client.patch("/api/config", json={"scene_detection_mode": "magic"})
        assert r.status_code == 400

    def test_energy_mode_in_get_config(self, client):
        r = client.get("/api/config")
        assert r.status_code == 200
        assert r.json()["energy_mode"] == "fast"

    def test_energy_mode_valid(self, client):
        r = client.patch("/api/config", json={"energy_mode": "full"})
        assert r.status_code == 200
        assert r.json()["energy_mode"] == "full"

    def test_energy_mode_invalid(self, client):
        r = client.patch("/api/config", json={"energy_mode": "turbo"})
        assert r.status_code == 400

    def test_silence_threshold_below_min_returns_400(self, client):
        r = client.patch("/api/config", json={"silence_threshold_ms": 50})
        assert r.status_code == 400

    def test_scorer_weight_negative_clamped_to_zero(self, client):
        import pytest
        r = client.patch("/api/config", json={"scorer_llm_weight": -2.0})
        assert r.status_code == 200
        assert r.json()["scorer_llm_weight"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Thermal config — GPU warn/pause temperatures (roadmap plan 01, Stage 3)
# ---------------------------------------------------------------------------

class TestThermalConfig:
    def test_defaults_in_get_config(self, client):
        d = client.get("/api/config").json()
        assert d["thermal_warn_c"] == 85
        assert d["thermal_pause_c"] == 90
        assert d["thermal_autopause_enabled"] is True

    def test_valid_thresholds_accepted(self, client):
        r = client.patch("/api/config", json={"thermal_warn_c": 80, "thermal_pause_c": 88})
        assert r.status_code == 200
        assert r.json()["thermal_warn_c"] == 80
        assert r.json()["thermal_pause_c"] == 88

    def test_autopause_toggle_accepted(self, client):
        r = client.patch("/api/config", json={"thermal_autopause_enabled": False})
        assert r.status_code == 200
        assert r.json()["thermal_autopause_enabled"] is False

    def test_warn_equal_to_pause_rejected(self, client):
        r = client.patch("/api/config", json={"thermal_warn_c": 90, "thermal_pause_c": 90})
        assert r.status_code == 400

    def test_warn_above_pause_rejected(self, client):
        r = client.patch("/api/config", json={"thermal_warn_c": 95, "thermal_pause_c": 90})
        assert r.status_code == 400

    def test_rejected_patch_does_not_mutate_existing_config(self, client):
        """A failed cross-field check must leave the live config untouched —
        not partially apply fields processed before the validation ran."""
        before = client.get("/api/config").json()
        r = client.patch("/api/config", json={"thermal_warn_c": 100, "thermal_pause_c": 95})
        assert r.status_code == 400
        after = client.get("/api/config").json()
        assert after["thermal_warn_c"] == before["thermal_warn_c"]
        assert after["thermal_pause_c"] == before["thermal_pause_c"]

    def test_raising_pause_then_warn_together_is_valid(self, client):
        # Only valid if applied together — proves the check uses the *new*
        # combined values, not the stale cfg.thermal_pause_c mid-loop.
        r = client.patch("/api/config", json={"thermal_warn_c": 100, "thermal_pause_c": 105})
        assert r.status_code == 200

    def test_thermal_warn_c_out_of_range_rejected(self, client):
        r = client.patch("/api/config", json={"thermal_warn_c": 20})
        assert r.status_code == 400

    def test_thermal_pause_c_out_of_range_rejected(self, client):
        r = client.patch("/api/config", json={"thermal_pause_c": 200})
        assert r.status_code == 400
