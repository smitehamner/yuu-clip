"""Config: client-bound /api/config route tests.

Pure Config.load()/save round-trips, validators, and profile CRUD moved to
tests/unit/test_config.py."""
from __future__ import annotations

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
    def test_huggingface_token_redacted_in_get(self, client):
        client.patch("/api/config", json={"huggingface_token": "hf_secret_value"})
        assert client.get("/api/config").json()["huggingface_token"] == "__redacted__"

    def test_unset_huggingface_token_not_marked(self, client):
        assert client.get("/api/config").json()["huggingface_token"] in (None, "")

    def test_patch_echoing_redacted_marker_keeps_stored_token(self, client):
        client.patch("/api/config", json={"huggingface_token": "hf_secret_value"})
        # A client that GET the redacted config and PATCHes it back must not wipe
        # the real token with the marker.
        client.patch("/api/config", json={"huggingface_token": "__redacted__"})
        assert client.app.state.ctx.config.huggingface_token == "hf_secret_value"

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
# whisper_language - API
# ---------------------------------------------------------------------------

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
# Title card config - API
# ---------------------------------------------------------------------------

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
