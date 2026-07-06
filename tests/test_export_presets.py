from __future__ import annotations

import shutil
import subprocess

import pytest

import yuu_clip.config as _config_module
from yuu_clip.export.presets import (
    BUILTIN_PRESET_NAMES,
    BUILTIN_PRESETS,
    MIN_VIDEO_KBPS,
    ClipTooLongForPresetError,
    ExportPreset,
    compute_target_video_kbps,
    resolve_preset,
    resolve_video_kbps,
    validate_preset_dict,
)


@pytest.fixture(autouse=True)
def _isolated_global_config(monkeypatch, tmp_path_factory):
    """Custom Export presets are stored in *global* config (a user preference,
    not project data — see export_presets.py). Every test in this file that
    exercises the /api/export-presets routes writes through Config.save_global(),
    which defaults to the real per-machine config directory — redirect it to a
    throwaway temp dir so these tests never touch (or pollute) the developer's
    actual global config.json."""
    isolated_dir = tmp_path_factory.mktemp("global_cfg")
    monkeypatch.setattr(_config_module, "_global_config_dir", lambda: isolated_dir)


# ---------------------------------------------------------------------------
# Bitrate math (compute_target_video_kbps / resolve_video_kbps)
# ---------------------------------------------------------------------------

class TestBitrateMath:
    def test_typical_short_clip_fits(self):
        # 10 MB over 60s at 128 kbps audio.
        video_kbps = compute_target_video_kbps(target_size_mb=10.0, duration_s=60.0, audio_kbps=128)
        assert video_kbps == pytest.approx((10.0 * 8192 / 60.0) - 128)
        assert video_kbps > MIN_VIDEO_KBPS

    def test_audio_is_subtracted_from_total(self):
        no_audio = compute_target_video_kbps(target_size_mb=10.0, duration_s=60.0, audio_kbps=0)
        with_audio = compute_target_video_kbps(target_size_mb=10.0, duration_s=60.0, audio_kbps=128)
        assert no_audio - with_audio == pytest.approx(128)

    def test_resolve_video_kbps_matches_the_raw_formula(self):
        preset = ExportPreset(name="discord-10mb", label="Discord", container="mp4", target_size_mb=10.0, audio_kbps=128)
        assert resolve_video_kbps(preset, duration_s=60.0) == pytest.approx(
            compute_target_video_kbps(10.0, 60.0, 128)
        )

    def test_long_clip_raises_plain_english_error(self):
        preset = ExportPreset(name="discord-10mb", label="Discord", container="mp4", target_size_mb=10.0, audio_kbps=128)
        with pytest.raises(ClipTooLongForPresetError, match="too long to fit under 10 MB"):
            resolve_video_kbps(preset, duration_s=600.0)  # 10 min — way under MIN_VIDEO_KBPS

    def test_error_message_uses_the_presets_own_target_size(self):
        preset = ExportPreset(name="tiny", label="Tiny", container="mp4", target_size_mb=2.0, audio_kbps=128)
        with pytest.raises(ClipTooLongForPresetError, match="too long to fit under 2 MB"):
            resolve_video_kbps(preset, duration_s=120.0)

    def test_floor_is_exclusive_boundary(self):
        # duration chosen so video_kbps lands just at MIN_VIDEO_KBPS - Fails when < floor.
        # total_kbps = target*8192/duration; solve duration so video_kbps == MIN_VIDEO_KBPS - 1
        target_mb, audio_kbps = 10.0, 128
        video_kbps_wanted = MIN_VIDEO_KBPS - 1
        duration_s = target_mb * 8192 / (video_kbps_wanted + audio_kbps)
        with pytest.raises(ClipTooLongForPresetError):
            resolve_video_kbps(
                ExportPreset(name="x", label="X", container="mp4", target_size_mb=target_mb, audio_kbps=audio_kbps),
                duration_s=duration_s,
            )


# ---------------------------------------------------------------------------
# Preset validation
# ---------------------------------------------------------------------------

class TestValidatePresetDict:
    def _valid(self, **overrides):
        data = {
            "name": "my-preset", "label": "My Preset", "container": "mp4",
            "height": 1080, "crf": 20, "target_size_mb": None, "audio_kbps": 128,
        }
        data.update(overrides)
        return data

    def test_valid_crf_preset(self):
        preset = validate_preset_dict(self._valid(), existing_names=set())
        assert preset.name == "my-preset"
        assert preset.crf == 20

    def test_valid_target_size_preset(self):
        preset = validate_preset_dict(self._valid(crf=None, target_size_mb=25.0), existing_names=set())
        assert preset.target_size_mb == 25.0

    def test_empty_name_rejected(self):
        with pytest.raises(ValueError, match="lowercase"):
            validate_preset_dict(self._valid(name=""), existing_names=set())

    def test_uppercase_name_is_auto_lowercased(self):
        preset = validate_preset_dict(self._valid(name="MyPreset"), existing_names=set())
        assert preset.name == "mypreset"

    def test_name_with_invalid_characters_rejected(self):
        with pytest.raises(ValueError, match="lowercase"):
            validate_preset_dict(self._valid(name="my preset!"), existing_names=set())

    def test_name_colliding_with_builtin_rejected(self):
        with pytest.raises(ValueError, match="built-in"):
            validate_preset_dict(self._valid(name="youtube-1080p"), existing_names=set())

    def test_name_colliding_with_existing_custom_rejected(self):
        with pytest.raises(ValueError, match="already exists"):
            validate_preset_dict(self._valid(name="my-preset"), existing_names={"my-preset"})

    def test_empty_label_rejected(self):
        with pytest.raises(ValueError, match="label"):
            validate_preset_dict(self._valid(label=""), existing_names=set())

    def test_bad_container_rejected(self):
        with pytest.raises(ValueError, match="Container"):
            validate_preset_dict(self._valid(container="avi"), existing_names=set())

    def test_bad_height_rejected(self):
        with pytest.raises(ValueError, match="Resolution"):
            validate_preset_dict(self._valid(height=900), existing_names=set())

    def test_neither_crf_nor_target_size_rejected(self):
        with pytest.raises(ValueError, match="exactly one"):
            validate_preset_dict(self._valid(crf=None, target_size_mb=None), existing_names=set())

    def test_both_crf_and_target_size_rejected(self):
        with pytest.raises(ValueError, match="exactly one"):
            validate_preset_dict(self._valid(crf=20, target_size_mb=10.0), existing_names=set())

    def test_crf_out_of_range_rejected(self):
        with pytest.raises(ValueError, match="CRF"):
            validate_preset_dict(self._valid(crf=99), existing_names=set())

    def test_negative_target_size_rejected(self):
        with pytest.raises(ValueError, match="positive"):
            validate_preset_dict(self._valid(crf=None, target_size_mb=-5.0), existing_names=set())

    def test_audio_kbps_out_of_range_rejected(self):
        with pytest.raises(ValueError, match="Audio bitrate"):
            validate_preset_dict(self._valid(audio_kbps=1000), existing_names=set())

    def test_vertical_defaults_false_when_absent(self):
        preset = validate_preset_dict(self._valid(), existing_names=set())
        assert preset.vertical is False

    def test_vertical_round_trips_true(self):
        preset = validate_preset_dict(self._valid(vertical=True), existing_names=set())
        assert preset.vertical is True
        assert preset.to_dict()["vertical"] is True


class TestBuiltinPresets:
    def test_builtins_always_present(self):
        names = {p.name for p in BUILTIN_PRESETS}
        assert names == {"youtube-1080p", "discord-10mb", "tiktok-9x16"}

    def test_builtin_names_frozenset_matches(self):
        assert BUILTIN_PRESET_NAMES == {"youtube-1080p", "discord-10mb", "tiktok-9x16"}

    def test_tiktok_preset_is_vertical(self):
        preset = next(p for p in BUILTIN_PRESETS if p.name == "tiktok-9x16")
        assert preset.vertical is True
        assert preset.container == "mp4"

    def test_non_vertical_builtins_default_vertical_false(self):
        for name in ("youtube-1080p", "discord-10mb"):
            assert next(p for p in BUILTIN_PRESETS if p.name == name).vertical is False

    def test_youtube_preset_never_upscales_source(self):
        preset = next(p for p in BUILTIN_PRESETS if p.name == "youtube-1080p")
        assert preset.height == 1080
        assert preset.target_size_mb is None

    def test_discord_preset_is_size_capped(self):
        preset = next(p for p in BUILTIN_PRESETS if p.name == "discord-10mb")
        assert preset.target_size_mb == 10.0
        assert preset.crf is None


class TestResolvePreset:
    def test_default_resolves_to_none(self):
        assert resolve_preset("default", []) is None
        assert resolve_preset(None, []) is None
        assert resolve_preset("", []) is None

    def test_builtin_resolves(self):
        preset = resolve_preset("discord-10mb", [])
        assert preset is not None
        assert preset.name == "discord-10mb"

    def test_custom_resolves_from_config_list(self):
        custom = [{"name": "my-preset", "label": "Mine", "container": "mkv",
                   "height": None, "crf": 23, "target_size_mb": None, "audio_kbps": 128}]
        preset = resolve_preset("my-preset", custom)
        assert preset is not None
        assert preset.container == "mkv"

    def test_unknown_returns_none(self):
        assert resolve_preset("does-not-exist", []) is None


# ---------------------------------------------------------------------------
# /api/export-presets CRUD routes
# ---------------------------------------------------------------------------

class TestExportPresetRoutes:
    def test_list_includes_builtins_and_empty_custom_by_default(self, client):
        data = client.get("/api/export-presets").json()
        assert {p["name"] for p in data["builtins"]} == {"youtube-1080p", "discord-10mb", "tiktok-9x16"}
        assert data["custom"] == []

    def test_create_round_trip(self, client):
        body = {"label": "My Twitch Clip", "container": "mp4", "height": 720, "crf": 22, "audio_kbps": 128}
        created = client.post("/api/export-presets", json=body).json()
        assert created["name"] == "my-twitch-clip"
        assert created["label"] == "My Twitch Clip"

        listed = client.get("/api/export-presets").json()
        assert any(p["name"] == "my-twitch-clip" for p in listed["custom"])

    def test_create_dedupes_generated_name(self, client):
        body = {"label": "Dup", "container": "mp4", "crf": 20}
        first = client.post("/api/export-presets", json=body).json()
        second = client.post("/api/export-presets", json=body).json()
        assert first["name"] == "dup"
        assert second["name"] == "dup-2"

    def test_create_rejects_invalid_preset(self, client):
        res = client.post("/api/export-presets", json={"label": "Bad", "container": "avi", "crf": 20})
        assert res.status_code == 400

    def test_update_preserves_name_and_changes_fields(self, client):
        created = client.post("/api/export-presets", json={"label": "Edit Me", "container": "mp4", "crf": 20}).json()
        name = created["name"]

        updated = client.put(f"/api/export-presets/{name}", json={
            "label": "Edited Label", "container": "mkv", "crf": 25,
        }).json()
        assert updated["name"] == name
        assert updated["label"] == "Edited Label"
        assert updated["container"] == "mkv"

    def test_update_unknown_name_404s(self, client):
        res = client.put("/api/export-presets/does-not-exist", json={"label": "X", "container": "mp4", "crf": 20})
        assert res.status_code == 404

    def test_delete_custom_preset(self, client):
        created = client.post("/api/export-presets", json={"label": "Delete Me", "container": "mp4", "crf": 20}).json()
        res = client.delete(f"/api/export-presets/{created['name']}")
        assert res.status_code == 200
        assert created["name"] not in {p["name"] for p in client.get("/api/export-presets").json()["custom"]}

    def test_cannot_delete_builtin(self, client):
        res = client.delete("/api/export-presets/youtube-1080p")
        assert res.status_code == 400

    def test_delete_unknown_custom_404s(self, client):
        assert client.delete("/api/export-presets/does-not-exist").status_code == 404


# ---------------------------------------------------------------------------
# Real ffmpeg encode integration — skipped if ffmpeg isn't on PATH. Slow: each
# case runs an actual (tiny, synthetic) two-pass or CRF encode.
# ---------------------------------------------------------------------------

requires_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")


@pytest.fixture()
def tiny_source_video(tmp_path):
    """A 3-second, 1440p synthetic test video generated by ffmpeg's lavfi source
    (no real recording needed) — big enough to exercise the scale-down guard."""
    path = tmp_path / "source.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=2560x1440:rate=10:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
            str(path),
        ],
        capture_output=True, check=True,
    )
    return path


@requires_ffmpeg
class TestPresetEncodeIntegration:
    def _probe_height(self, path):
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=height", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, check=True,
        )
        return int(out.stdout.strip())

    def test_youtube_preset_scales_down_to_1080(self, tiny_source_video, tmp_path):
        from yuu_clip.analyze.extract import export_clip_with_preset
        from yuu_clip.export.presets import BUILTIN_PRESETS

        preset = next(p for p in BUILTIN_PRESETS if p.name == "youtube-1080p")
        output = tmp_path / "out.mp4"
        export_clip_with_preset(tiny_source_video, 0, 2000, output, preset)

        assert output.exists()
        assert self._probe_height(output) <= 1080

    def test_discord_preset_stays_near_target_size(self, tiny_source_video, tmp_path):
        from yuu_clip.analyze.extract import export_clip_with_preset
        from yuu_clip.export.presets import BUILTIN_PRESETS

        preset = next(p for p in BUILTIN_PRESETS if p.name == "discord-10mb")
        output = tmp_path / "out.mp4"
        export_clip_with_preset(tiny_source_video, 0, 2000, output, preset)

        size_mb = output.stat().st_size / (1024 * 1024)
        # Two-pass bitrate targeting is approximate for very short clips (container
        # overhead dominates); generous tolerance keeps this a smoke test, not a
        # precise-bitrate assertion.
        assert size_mb <= preset.target_size_mb * 1.5

    def test_never_upscales_a_smaller_source(self, tmp_path):
        from yuu_clip.analyze.extract import export_clip_with_preset
        from yuu_clip.export.presets import ExportPreset

        small_source = tmp_path / "small.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=10:duration=2",
                "-c:v", "libx264", "-preset", "ultrafast",
                str(small_source),
            ],
            capture_output=True, check=True,
        )
        preset = ExportPreset(name="youtube-1080p", label="YouTube 1080p", container="mp4",
                               height=1080, crf=18, audio_kbps=192)
        output = tmp_path / "out.mp4"
        export_clip_with_preset(small_source, 0, 1500, output, preset)

        assert self._probe_height(output) == 360  # unchanged, never upscaled to 1080
