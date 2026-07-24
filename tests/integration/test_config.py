from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# Config.load() - project overrides global
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
            json.dumps({"whisper_model": "tiny", "llm_enabled": False}),
            encoding="utf-8",
        )
        config = Config.load(project_dir)
        assert config.whisper_model == "tiny"
        assert config.llm_enabled is False

    def test_missing_config_returns_defaults(self, tmp_path, monkeypatch):
        """When no config files exist, defaults are used."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        config = Config.load(project_dir)
        assert config.whisper_model == "base"  # default
        assert config.llm_enabled is True    # default

    def test_corrupt_project_config_falls_back_to_defaults(self, tmp_path, monkeypatch):
        """A truncated/hand-broken config.json must not crash startup."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text('{"whisper_model": "tiny",', encoding="utf-8")
        config = Config.load(project_dir)
        assert config.whisper_model == "base"  # corrupt file ignored, default used

    def test_non_object_config_is_ignored(self, tmp_path, monkeypatch):
        """A valid-JSON but non-object top level (e.g. a list) is ignored, not crashed on."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text('["not", "an", "object"]', encoding="utf-8")
        config = Config.load(project_dir)
        assert config.whisper_model == "base"

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

    def test_pending_local_model_defaults_empty(self, tmp_path, monkeypatch):
        """The wizard handoff flag is empty by default."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        assert Config.load(project_dir).pending_local_model == ""

    def test_pending_local_model_survives_save_load_round_trip(self, tmp_path, monkeypatch):
        """A wizard-set pending model id persists through save_project -> load."""
        import dataclasses

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        dataclasses.replace(
            Config.load(project_dir), pending_local_model="qwen2.5-7b-instruct"
        ).save_project(project_dir, keys=["pending_local_model"])
        assert Config.load(project_dir).pending_local_model == "qwen2.5-7b-instruct"


# ---------------------------------------------------------------------------
# Keys-explicit save overlay (CONFIG-SAVE-KEYS-REDESIGN 2026-07-23)
# ---------------------------------------------------------------------------

_CUSTOM_PRESET = {
    "name": "my-preset", "label": "My Preset", "container": "mp4",
    "height": 1080, "crf": 20, "target_size_mb": None,
    "audio_kbps": 128, "vertical": False,
}


def _seed_global(global_dir, values: dict) -> None:
    import json
    global_dir.mkdir(parents=True, exist_ok=True)
    (global_dir / "config.json").write_text(json.dumps(values), encoding="utf-8")


def _read_project_layer(project_dir) -> dict:
    import json
    return json.loads(
        (project_dir / ".yuu-clip" / "config.json").read_text(encoding="utf-8")
    )


class TestSaveOverlay:
    def test_project_save_does_not_freeze_global_keys(self, tmp_path, monkeypatch):
        """The headline vanishing-export-preset write-path regression: a project
        save of an unrelated key must not bake the global export_presets into the
        project layer, so a later global preset is not masked on load."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        global_dir = tmp_path / "global_cfg"
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: global_dir)
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        _seed_global(global_dir, {"export_presets": []})

        cfg = Config.load(project_dir)
        cfg.analyze_warn_hours = 5.0
        cfg.save_project(project_dir, keys=["analyze_warn_hours"])

        on_disk = _read_project_layer(project_dir)
        assert "export_presets" not in on_disk
        assert on_disk["analyze_warn_hours"] == 5.0

        # A custom preset is now stored globally by design.
        Config(export_presets=[_CUSTOM_PRESET]).save_global(keys=["export_presets"])

        assert Config.load(project_dir).export_presets == [_CUSTOM_PRESET]

    def test_first_project_save_writes_only_given_keys(self, tmp_path, monkeypatch):
        """A first save with no existing file overlays onto {} and creates the dir."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()

        Config(analyze_warn_hours=7.0).save_project(project_dir, keys=["analyze_warn_hours"])

        on_disk = _read_project_layer(project_dir)
        assert on_disk == {"analyze_warn_hours": 7.0}

    def test_corrupt_project_layer_is_backed_up_then_overlaid(self, tmp_path, monkeypatch):
        """A corrupt existing layer is renamed to .corrupt.bak and rewritten with
        only the given keys (decision 1)."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir(parents=True)
        (cfg_dir / "config.json").write_text('{"analyze_warn_hours": 5.0,', encoding="utf-8")

        Config(analyze_warn_hours=9.0).save_project(project_dir, keys=["analyze_warn_hours"])

        backup = cfg_dir / "config.json.corrupt.bak"
        assert backup.read_text(encoding="utf-8") == '{"analyze_warn_hours": 5.0,'
        assert _read_project_layer(project_dir) == {"analyze_warn_hours": 9.0}

    def test_global_save_preserves_untouched_on_disk_keys(self, tmp_path, monkeypatch):
        """save_global overlays only its keys - a hand-set global key survives an
        export_presets-only save."""
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        global_dir = tmp_path / "global_cfg"
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: global_dir)
        _seed_global(global_dir, {"whisper_model": "small", "export_presets": []})

        Config(export_presets=[_CUSTOM_PRESET]).save_global(keys=["export_presets"])

        import json
        on_disk = json.loads((global_dir / "config.json").read_text(encoding="utf-8"))
        assert on_disk["whisper_model"] == "small"
        assert on_disk["export_presets"] == [_CUSTOM_PRESET]


class TestStripGlobalOnlyKeys:
    def test_strip_global_only_keys_unfreezes_export_presets(self, tmp_path, monkeypatch):
        """The one-time cleanup drops a frozen export_presets from a project file,
        keeps genuine project overrides, and unmasks the global preset on load."""
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config, strip_global_only_keys_from_project
        global_dir = tmp_path / "global_cfg"
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: global_dir)
        project_dir = tmp_path / "proj"
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir(parents=True)
        (cfg_dir / "config.json").write_text(
            json.dumps({"export_presets": [], "analyze_warn_hours": 5.0}), encoding="utf-8",
        )
        _seed_global(global_dir, {"export_presets": [_CUSTOM_PRESET]})

        assert strip_global_only_keys_from_project(project_dir) is True
        on_disk = _read_project_layer(project_dir)
        assert "export_presets" not in on_disk
        assert on_disk["analyze_warn_hours"] == 5.0
        assert Config.load(project_dir).export_presets == [_CUSTOM_PRESET]

    def test_strip_is_idempotent(self, tmp_path, monkeypatch):
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import strip_global_only_keys_from_project
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir(parents=True)
        (cfg_dir / "config.json").write_text(
            json.dumps({"export_presets": [], "analyze_warn_hours": 5.0}), encoding="utf-8",
        )
        assert strip_global_only_keys_from_project(project_dir) is True
        assert strip_global_only_keys_from_project(project_dir) is False

    def test_strip_tolerates_missing_and_corrupt_file(self, tmp_path, monkeypatch):
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import strip_global_only_keys_from_project
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        assert strip_global_only_keys_from_project(project_dir) is False  # missing

        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir(parents=True)
        (cfg_dir / "config.json").write_text("{not json", encoding="utf-8")
        assert strip_global_only_keys_from_project(project_dir) is False  # corrupt


# ---------------------------------------------------------------------------
# UI config endpoint - GET/PATCH /api/config
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

    def test_get_config_includes_content_preset_default(self, client):
        assert client.get("/api/config").json()["content_preset"] == "generic"

    def test_config_defaults_returns_factory_values(self, client):
        d = client.get("/api/config/defaults").json()
        assert d["whisper_model"] == "base"
        assert d["llm_backend"] == "llamacpp"
        assert d["ai_privacy_mode"] == "local_only"
        assert d["ui_timeline_interval_seconds"] == 900

    def test_config_defaults_ignores_saved_config(self, client):
        # Changing the live config must not change what defaults reports.
        client.patch("/api/config", json={"whisper_model": "large-v3"})
        assert client.get("/api/config").json()["whisper_model"] == "large-v3"
        assert client.get("/api/config/defaults").json()["whisper_model"] == "base"

    def test_config_defaults_covers_every_config_field(self, client):
        # Same key set as GET /api/config, so the frontend can revert any field.
        assert set(client.get("/api/config/defaults").json()) == set(client.get("/api/config").json())

    # AI privacy mode - local-only tool, so only "none" | "local_only"
    def test_ai_privacy_mode_defaults_to_local_only(self, client):
        assert client.get("/api/config").json()["ai_privacy_mode"] == "local_only"

    def test_patch_ai_privacy_mode_persists(self, client):
        r = client.patch("/api/config", json={"ai_privacy_mode": "none"})
        assert r.status_code == 200 and r.json()["ai_privacy_mode"] == "none"
        assert client.get("/api/config").json()["ai_privacy_mode"] == "none"

    def test_patch_ai_privacy_mode_rejects_removed_remote_ok(self, client):
        # The remote (Claude) backend and its "remote_ok" mode were removed - the
        # value must no longer validate.
        assert client.patch("/api/config", json={"ai_privacy_mode": "remote_ok"}).status_code == 400

    def test_llm_use_gpu_defaults_true(self, client):
        assert client.get("/api/config").json()["llm_use_gpu"] is True

    def test_patch_llm_use_gpu_persists(self, client):
        r = client.patch("/api/config", json={"llm_use_gpu": False})
        assert r.status_code == 200 and r.json()["llm_use_gpu"] is False
        assert client.get("/api/config").json()["llm_use_gpu"] is False

    # Regression: similarity_backend (plan 01) was dropped by ConfigPatch before Stage 07.
    def test_patch_similarity_backend_persists(self, client):
        r = client.patch("/api/config", json={"similarity_backend": "embeddings"})
        assert r.status_code == 200 and r.json()["similarity_backend"] == "embeddings"
        assert client.get("/api/config").json()["similarity_backend"] == "embeddings"

    def test_patch_config_accepts_known_content_preset(self, client):
        r = client.patch("/api/config", json={"content_preset": "speedrun"})
        assert r.status_code == 200
        assert r.json()["content_preset"] == "speedrun"

    def test_patch_config_rejects_unknown_content_preset(self, client):
        assert client.patch("/api/config", json={"content_preset": "bogus"}).status_code == 400

    def test_load_sanitizes_unknown_content_preset(self, tmp_path, monkeypatch):
        import json as _json

        from yuu_clip.config import Config
        monkeypatch.setattr("yuu_clip.config._global_config_dir", lambda: tmp_path / "g")
        proj = tmp_path / ".yuu-clip"
        proj.mkdir()
        (proj / "config.json").write_text(_json.dumps({"content_preset": "nonsense"}), encoding="utf-8")
        assert Config.load(tmp_path).content_preset == "generic"

    def test_load_coerces_retired_pyannote_backend(self, tmp_path, monkeypatch):
        # Pyannote was removed; a stale config naming it must heal to the default
        # backend on load rather than silently disabling speaker labels.
        import json as _json

        from yuu_clip.config import Config
        monkeypatch.setattr("yuu_clip.config._global_config_dir", lambda: tmp_path / "g")
        proj = tmp_path / ".yuu-clip"
        proj.mkdir()
        (proj / "config.json").write_text(
            _json.dumps({"diarization_backend": "pyannote"}), encoding="utf-8"
        )
        assert Config.load(tmp_path).diarization_backend == "speechbrain"

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

    def test_get_config_includes_speaker_cluster_threshold_default(self, client):
        assert client.get("/api/config").json()["speaker_cluster_threshold"] == 0.85

    def test_patch_config_updates_speaker_cluster_threshold(self, client):
        r = client.patch("/api/config", json={"speaker_cluster_threshold": 0.7})
        assert r.status_code == 200
        assert r.json()["speaker_cluster_threshold"] == 0.7

    def test_patch_config_cluster_threshold_out_of_range_returns_400(self, client):
        assert client.patch("/api/config", json={"speaker_cluster_threshold": 1.5}).status_code == 400
        assert client.patch("/api/config", json={"speaker_cluster_threshold": -0.1}).status_code == 400

    def test_get_config_includes_speaker_min_cluster_seconds_default(self, client):
        assert client.get("/api/config").json()["speaker_min_cluster_seconds"] == 10.0

    def test_patch_config_updates_speaker_min_cluster_seconds(self, client):
        r = client.patch("/api/config", json={"speaker_min_cluster_seconds": 5})
        assert r.status_code == 200
        assert r.json()["speaker_min_cluster_seconds"] == 5

    def test_patch_config_min_cluster_seconds_zero_disables_prune(self, client):
        assert client.patch("/api/config", json={"speaker_min_cluster_seconds": 0}).status_code == 200

    def test_patch_config_min_cluster_seconds_out_of_range_returns_400(self, client):
        assert client.patch("/api/config", json={"speaker_min_cluster_seconds": 500}).status_code == 400
        assert client.patch("/api/config", json={"speaker_min_cluster_seconds": -1}).status_code == 400

    def test_patch_config_accepts_speechbrain_backend(self, client):
        r = client.patch("/api/config", json={"diarization_backend": "speechbrain"})
        assert r.status_code == 200
        assert r.json()["diarization_backend"] == "speechbrain"

    def test_patch_config_rejects_unknown_diarization_backend(self, client):
        assert client.patch("/api/config", json={"diarization_backend": "bogus"}).status_code == 400

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


class TestConfigReload:
    def test_reload_re_reads_disk_into_memory(self, client, project_dir):
        """POST /api/config/reload picks up an on-disk change (the rerun wizard
        writing config.json while the server is live) without a restart."""
        from pathlib import Path

        ctx = client.app.state.ctx
        assert ctx.config.whisper_model != "small"
        cfg_path = Path(project_dir) / ".yuu-clip" / "config.json"
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        cfg_path.write_text('{"whisper_model": "small"}', encoding="utf-8")

        r = client.post("/api/config/reload")
        assert r.status_code == 200
        assert r.json()["whisper_model"] == "small"
        assert ctx.config.whisper_model == "small"


# ---------------------------------------------------------------------------
# Caption style - GET defaults + PATCH validation (burned-in captions)
# ---------------------------------------------------------------------------

class TestCaptionStyleConfig:
    def test_defaults(self, client):
        cfg = client.get("/api/config").json()
        assert cfg["caption_font_name"] == ""
        assert cfg["caption_font_size"] == 0
        assert cfg["caption_position"] == "bottom"

    def test_patch_accepts_valid_values(self, client):
        r = client.patch("/api/config", json={
            "caption_font_name": "Segoe UI", "caption_font_size": 36, "caption_position": "top",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["caption_font_name"] == "Segoe UI"
        assert body["caption_font_size"] == 36
        assert body["caption_position"] == "top"

    def test_patch_accepts_size_zero_as_default(self, client):
        assert client.patch("/api/config", json={"caption_font_size": 0}).status_code == 200

    def test_patch_accepts_empty_font_name(self, client):
        assert client.patch("/api/config", json={"caption_font_name": ""}).status_code == 200

    def test_patch_rejects_size_out_of_range(self, client):
        assert client.patch("/api/config", json={"caption_font_size": 8}).status_code == 400
        assert client.patch("/api/config", json={"caption_font_size": 200}).status_code == 400

    def test_patch_rejects_bad_position(self, client):
        assert client.patch("/api/config", json={"caption_position": "middle"}).status_code == 400

    def test_patch_rejects_quote_comma_backslash_in_font_name(self, client):
        for bad in ["Ari'al", "Ari,al", "Ari\\al"]:
            assert client.patch("/api/config", json={"caption_font_name": bad}).status_code == 400

    def test_load_sanitizes_bad_values(self, tmp_path, monkeypatch):
        import json as _json

        from yuu_clip.config import Config
        monkeypatch.setattr("yuu_clip.config._global_config_dir", lambda: tmp_path / "global")
        proj = tmp_path / "proj"
        (proj / ".yuu-clip").mkdir(parents=True)
        (proj / ".yuu-clip" / "config.json").write_text(_json.dumps({
            "caption_font_name": "bad,name", "caption_font_size": 999, "caption_position": "sideways",
        }), encoding="utf-8")
        cfg = Config.load(proj)
        assert cfg.caption_font_name == ""
        assert cfg.caption_font_size == 0
        assert cfg.caption_position == "bottom"

    def test_word_highlight_defaults(self, client):
        cfg = client.get("/api/config").json()
        assert cfg["caption_word_highlight"] is False
        assert cfg["caption_word_chunk_size"] == 4

    def test_patch_accepts_word_highlight(self, client):
        r = client.patch("/api/config", json={
            "caption_word_highlight": True, "caption_word_chunk_size": 6,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["caption_word_highlight"] is True
        assert body["caption_word_chunk_size"] == 6

    def test_patch_rejects_chunk_size_out_of_range(self, client):
        assert client.patch("/api/config", json={"caption_word_chunk_size": 0}).status_code == 400
        assert client.patch("/api/config", json={"caption_word_chunk_size": 13}).status_code == 400

    def test_load_sanitizes_bad_chunk_size(self, tmp_path, monkeypatch):
        import json as _json

        from yuu_clip.config import Config
        monkeypatch.setattr("yuu_clip.config._global_config_dir", lambda: tmp_path / "global")
        proj = tmp_path / "proj"
        (proj / ".yuu-clip").mkdir(parents=True)
        (proj / ".yuu-clip" / "config.json").write_text(
            _json.dumps({"caption_word_chunk_size": 99}), encoding="utf-8"
        )
        cfg = Config.load(proj)
        assert cfg.caption_word_chunk_size == 4


class TestVisionConfig:
    def test_defaults_conservatively_on(self, client):
        # Wave 6: available + on by default, but a low frame count (nothing runs
        # unless a vision-capable model is also configured - see check_vision_available).
        cfg = client.get("/api/config").json()
        assert cfg["vision_enabled"] is True
        assert cfg["vision_frames_per_clip"] == 2

    def test_patch_accepts_valid(self, client):
        assert client.patch("/api/config", json={
            "vision_enabled": True, "vision_frames_per_clip": 8,
        }).status_code == 200
        cfg = client.get("/api/config").json()
        assert cfg["vision_enabled"] is True and cfg["vision_frames_per_clip"] == 8

    def test_patch_rejects_frames_out_of_range(self, client):
        assert client.patch("/api/config", json={"vision_frames_per_clip": 0}).status_code == 400
        assert client.patch("/api/config", json={"vision_frames_per_clip": 11}).status_code == 400

    def test_load_sanitizes_bad_frame_count(self, tmp_path, monkeypatch):
        import json as _json

        from yuu_clip.config import Config
        monkeypatch.setattr("yuu_clip.config._global_config_dir", lambda: tmp_path / "global")
        proj = tmp_path / "proj"
        (proj / ".yuu-clip").mkdir(parents=True)
        (proj / ".yuu-clip" / "config.json").write_text(
            _json.dumps({"vision_frames_per_clip": 999}), encoding="utf-8",
        )
        assert Config.load(proj).vision_frames_per_clip == 2


# ---------------------------------------------------------------------------
# Config - packaging-strategy overhaul Wave 2 default flips
# ---------------------------------------------------------------------------

class TestPackagingWave2Defaults:
    """These packages/models are now bundled (Tier A) or auto-fetched (Tier B),
    so the features they power run out of the box instead of requiring an
    explicit opt-in. See docs/dev/PACKAGING-TIERS.md."""

    def test_diarization_backend_defaults_to_speechbrain(self):
        from yuu_clip.config import Config
        assert Config().diarization_backend == "speechbrain"

    def test_similarity_backend_defaults_to_embeddings(self):
        from yuu_clip.config import Config
        assert Config().similarity_backend == "embeddings"

    def test_audio_event_scoring_defaults_on(self):
        from yuu_clip.config import Config
        assert Config().scorer_audio_event_enabled is True

    def test_laugh_mode_not_flipped_by_wave_2(self):
        # Explicitly out of scope: laugh_mode stays transcript-only (a laugh_mode
        # flip needs its own decision). Vision was Wave 6's call - see
        # TestPackagingWave6VisionDefaults below for its (now-flipped) defaults.
        from yuu_clip.config import Config
        assert Config().scorer_laugh_mode == "transcript"


class TestPackagingWave6VisionDefaults:
    """Vision is available + conservatively-on by default (Wave 6): the master
    switch is on and the frame count is low, but nothing runs unless a
    vision-capable model is configured - see check_vision_available /
    TestCheckVisionAvailable in test_vision.py for the capability gate."""

    def test_vision_enabled_defaults_true(self):
        from yuu_clip.config import Config
        assert Config().vision_enabled is True

    def test_vision_frames_per_clip_defaults_low(self):
        from yuu_clip.config import Config
        assert Config().vision_frames_per_clip == 2


class TestValidateVisionFramesPerClip:
    """Direct unit coverage of the shared validator behind both the /api/config
    reject path and the hand-edited-config sanitizer."""

    def test_accepts_both_range_boundaries(self):
        from yuu_clip.config import validate_vision_frames_per_clip
        assert validate_vision_frames_per_clip(1) == 1
        assert validate_vision_frames_per_clip(10) == 10

    def test_rejects_just_outside_each_boundary(self):
        import pytest

        from yuu_clip.config import validate_vision_frames_per_clip
        with pytest.raises(ValueError):
            validate_vision_frames_per_clip(0)
        with pytest.raises(ValueError):
            validate_vision_frames_per_clip(11)

    def test_rejects_a_bool_even_though_true_equals_one(self):
        # True == 1 would slip through a bare range check; the explicit bool
        # guard keeps a JSON `true` from being read as a frame count.
        import pytest

        from yuu_clip.config import validate_vision_frames_per_clip
        with pytest.raises(ValueError):
            validate_vision_frames_per_clip(True)

    def test_rejects_a_non_integer(self):
        import pytest

        from yuu_clip.config import validate_vision_frames_per_clip
        with pytest.raises(ValueError):
            validate_vision_frames_per_clip(3.0)


# ---------------------------------------------------------------------------
# Config - new llm_backend / llm_model_path defaults
# ---------------------------------------------------------------------------

class TestConfigNewLlmFields:
    def test_llm_backend_default_is_llamacpp(self):
        from yuu_clip.config import Config
        assert Config().llm_backend == "llamacpp"

    def test_llm_model_path_default_is_empty_string(self):
        from yuu_clip.config import Config
        assert Config().llm_model_path == ""

    def test_llm_vision_model_path_default_is_empty_string(self):
        from yuu_clip.config import Config
        assert Config().llm_vision_model_path == ""

    def test_llm_vision_model_path_roundtrips_through_save_and_load(self, tmp_path, monkeypatch):
        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg = Config(llm_vision_model_path="/models/moondream.gguf")
        cfg.save_project(project_dir, keys=["llm_vision_model_path"])
        loaded = Config.load(project_dir)
        assert loaded.llm_vision_model_path == "/models/moondream.gguf"

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
            json.dumps({"llm_backend": "llamacpp", "llm_model_path": "/models/foo.gguf"}),
            encoding="utf-8",
        )
        cfg = Config.load(project_dir)
        assert cfg.llm_backend == "llamacpp"
        assert cfg.llm_model_path == "/models/foo.gguf"


# ---------------------------------------------------------------------------
# /api/config - patch llm_backend and llm_model_path
# ---------------------------------------------------------------------------

class TestConfigApiLlmFields:
    def test_get_config_includes_new_llm_fields(self, client):
        d = client.get("/api/config").json()
        assert "llm_backend" in d
        assert "llm_model_path" in d

    def test_patch_llm_backend_accepts_llamacpp(self, client):
        r = client.patch("/api/config", json={"llm_backend": "llamacpp"})
        assert r.status_code == 200
        assert r.json()["llm_backend"] == "llamacpp"

    def test_patch_llm_backend_rejects_removed_claude(self, client):
        assert client.patch("/api/config", json={"llm_backend": "claude"}).status_code == 400

    def test_patch_llm_model_path(self, client):
        r = client.patch("/api/config", json={"llm_model_path": "/models/qwen2.5.gguf"})
        assert r.status_code == 200
        assert r.json()["llm_model_path"] == "/models/qwen2.5.gguf"

    def test_patch_llm_vision_model_path(self, client):
        r = client.patch("/api/config", json={"llm_vision_model_path": "/models/moondream.gguf"})
        assert r.status_code == 200
        assert r.json()["llm_vision_model_path"] == "/models/moondream.gguf"
        # Independent of the text model path - patching one must not touch the other.
        assert r.json()["llm_model_path"] == ""


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
# whisper_language - config field, API, and pipeline resolution
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


class TestConfigPatchExportRetranscribeModel:
    def test_default_is_large_v3(self, client):
        assert client.get("/api/config").json()["export_retranscribe_model"] == "large-v3"

    def test_valid_export_retranscribe_model_accepted(self, client):
        r = client.patch("/api/config", json={"export_retranscribe_model": "small"})
        assert r.status_code == 200
        assert r.json()["export_retranscribe_model"] == "small"

    def test_invalid_export_retranscribe_model_returns_400(self, client):
        r = client.patch("/api/config", json={"export_retranscribe_model": "gpt-4o"})
        assert r.status_code == 400

    def test_independent_of_whisper_model(self, client):
        client.patch("/api/config", json={"whisper_model": "tiny"})
        client.patch("/api/config", json={"export_retranscribe_model": "large-v3"})
        d = client.get("/api/config").json()
        assert d["whisper_model"] == "tiny"
        assert d["export_retranscribe_model"] == "large-v3"


class TestConfigScenePatch:
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
# Thermal config - GPU warn/pause temperatures (roadmap plan 01, Stage 3)
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
        """A failed cross-field check must leave the live config untouched -
        not partially apply fields processed before the validation ran."""
        before = client.get("/api/config").json()
        r = client.patch("/api/config", json={"thermal_warn_c": 100, "thermal_pause_c": 95})
        assert r.status_code == 400
        after = client.get("/api/config").json()
        assert after["thermal_warn_c"] == before["thermal_warn_c"]
        assert after["thermal_pause_c"] == before["thermal_pause_c"]

    def test_raising_pause_then_warn_together_is_valid(self, client):
        # Only valid if applied together - proves the check uses the *new*
        # combined values, not the stale cfg.thermal_pause_c mid-loop.
        r = client.patch("/api/config", json={"thermal_warn_c": 100, "thermal_pause_c": 105})
        assert r.status_code == 200

    def test_thermal_warn_c_out_of_range_rejected(self, client):
        r = client.patch("/api/config", json={"thermal_warn_c": 20})
        assert r.status_code == 400

    def test_thermal_pause_c_out_of_range_rejected(self, client):
        r = client.patch("/api/config", json={"thermal_pause_c": 200})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Title card config - colors, scale, text template, duration (roadmap plan 09)
# ---------------------------------------------------------------------------

class TestTitleCardConfigDefaults:
    def test_defaults(self):
        from yuu_clip.config import Config
        cfg = Config()
        assert cfg.title_card_bg_color == "#000000"
        assert cfg.title_card_font_color == "#ffffff"
        assert cfg.title_card_scale == 1.0
        assert cfg.title_card_template == "{description}\n{start} · {duration}"
        assert cfg.title_card_duration_s == 3.0


class TestValidateTitleCardTemplate:
    def _validate(self, value):
        from yuu_clip.config import validate_title_card_template
        return validate_title_card_template(value)

    def test_valid_template_returned_unchanged(self):
        assert self._validate("{description}\n{start}") == "{description}\n{start}"

    def test_static_text_only_allowed(self):
        assert self._validate("Highlight of the night") == "Highlight of the night"

    def test_empty_allowed(self):
        assert self._validate("") == ""

    def test_unknown_placeholder_rejected(self):
        with pytest.raises(ValueError):
            self._validate("{description} {score}")

    def test_too_long_rejected(self):
        with pytest.raises(ValueError):
            self._validate("x" * 301)


class TestValidateHexColor:
    def _validate(self, value):
        from yuu_clip.config import validate_hex_color
        return validate_hex_color(value, "title_card_bg_color")

    def test_valid_hex_returned_unchanged(self):
        assert self._validate("#1a2b3c") == "#1a2b3c"

    def test_missing_hash_rejected(self):
        with pytest.raises(ValueError):
            self._validate("1a2b3c")

    def test_short_hex_rejected(self):
        with pytest.raises(ValueError):
            self._validate("#fff")

    def test_alpha_hex_rejected(self):
        with pytest.raises(ValueError):
            self._validate("#ffffffaa")

    def test_named_color_rejected(self):
        with pytest.raises(ValueError):
            self._validate("red")


class TestTitleCardConfigLoadSanitization:
    """Config.load() must never crash on a hand-edited config.json - bad
    title-card values fall back to defaults with a WARN log instead."""

    def _load_with(self, tmp_path, monkeypatch, project_values):
        import json

        import yuu_clip.config as cfg_mod
        from yuu_clip.config import Config
        monkeypatch.setattr(cfg_mod, "_global_config_dir", lambda: tmp_path / "global_cfg")
        project_dir = tmp_path / "proj"
        project_dir.mkdir()
        cfg_dir = project_dir / ".yuu-clip"
        cfg_dir.mkdir()
        (cfg_dir / "config.json").write_text(json.dumps(project_values), encoding="utf-8")
        return Config.load(project_dir)

    def test_bad_bg_color_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_bg_color": "not-a-color"})
        assert cfg.title_card_bg_color == "#000000"

    def test_bad_font_color_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_font_color": "red"})
        assert cfg.title_card_font_color == "#ffffff"

    def test_alpha_hex_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_bg_color": "#000000ff"})
        assert cfg.title_card_bg_color == "#000000"

    def test_bad_template_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_template": "{bogus}"})
        assert cfg.title_card_template == "{description}\n{start} · {duration}"

    def test_scale_out_of_range_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_scale": 5.0})
        assert cfg.title_card_scale == 1.0

    def test_duration_out_of_range_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_duration_s": 30.0})
        assert cfg.title_card_duration_s == 3.0

    def test_wrong_typed_scale_falls_back_to_default(self, tmp_path, monkeypatch):
        # A non-numeric scale would make the range comparison raise TypeError.
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_scale": "big"})
        assert cfg.title_card_scale == 1.0

    def test_null_duration_falls_back_to_default(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_duration_s": None})
        assert cfg.title_card_duration_s == 3.0

    def test_numeric_bg_color_falls_back_to_default(self, tmp_path, monkeypatch):
        # validate_hex_color(123, ...) raises TypeError inside the regex match.
        cfg = self._load_with(tmp_path, monkeypatch, {"title_card_bg_color": 123})
        assert cfg.title_card_bg_color == "#000000"

    def test_valid_title_card_values_roundtrip(self, tmp_path, monkeypatch):
        cfg = self._load_with(tmp_path, monkeypatch, {
            "title_card_bg_color": "#112233",
            "title_card_font_color": "#eeddcc",
            "title_card_scale": 1.5,
            "title_card_template": "{start} · {duration}",
            "title_card_duration_s": 5.0,
        })
        assert cfg.title_card_bg_color == "#112233"
        assert cfg.title_card_font_color == "#eeddcc"
        assert cfg.title_card_scale == 1.5
        assert cfg.title_card_template == "{start} · {duration}"
        assert cfg.title_card_duration_s == 5.0


class TestTitleCardConfigApi:
    def test_get_config_includes_title_card_defaults(self, client):
        d = client.get("/api/config").json()
        assert d["title_card_bg_color"] == "#000000"
        assert d["title_card_font_color"] == "#ffffff"
        assert d["title_card_scale"] == 1.0
        assert d["title_card_template"] == "{description}\n{start} · {duration}"
        assert d["title_card_duration_s"] == 3.0

    def test_patch_valid_title_card_fields(self, client):
        r = client.patch("/api/config", json={
            "title_card_bg_color": "#123456",
            "title_card_font_color": "#abcdef",
            "title_card_scale": 1.25,
            "title_card_template": "Clip: {description}",
            "title_card_duration_s": 4.5,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title_card_bg_color"] == "#123456"
        assert d["title_card_font_color"] == "#abcdef"
        assert d["title_card_scale"] == 1.25
        assert d["title_card_template"] == "Clip: {description}"
        assert d["title_card_duration_s"] == 4.5

    def test_patch_invalid_hex_bg_color_rejected(self, client):
        r = client.patch("/api/config", json={"title_card_bg_color": "black"})
        assert r.status_code == 400

    def test_patch_short_hex_rejected(self, client):
        r = client.patch("/api/config", json={"title_card_font_color": "#fff"})
        assert r.status_code == 400

    def test_patch_alpha_hex_rejected(self, client):
        r = client.patch("/api/config", json={"title_card_bg_color": "#000000ff"})
        assert r.status_code == 400

    def test_patch_invalid_template_rejected(self, client):
        r = client.patch("/api/config", json={"title_card_template": "{description} {bogus}"})
        assert r.status_code == 400

    def test_patch_scale_out_of_range_rejected(self, client):
        assert client.patch("/api/config", json={"title_card_scale": 0.4}).status_code == 400
        assert client.patch("/api/config", json={"title_card_scale": 2.1}).status_code == 400

    def test_patch_scale_bounds_accepted(self, client):
        assert client.patch("/api/config", json={"title_card_scale": 0.5}).status_code == 200
        assert client.patch("/api/config", json={"title_card_scale": 2.0}).status_code == 200

    def test_patch_duration_out_of_range_rejected(self, client):
        assert client.patch("/api/config", json={"title_card_duration_s": 0.5}).status_code == 400
        assert client.patch("/api/config", json={"title_card_duration_s": 10.5}).status_code == 400
