from __future__ import annotations

import pytest

from yuu_clip.export.presets import (
    BUILTIN_PRESET_NAMES,
    BUILTIN_PRESETS,
    MIN_VIDEO_KBPS,
    SIZE_CAP_HEADROOM,
    ClipTooLongForPresetError,
    ExportPreset,
    compute_target_video_kbps,
    resolve_preset,
    resolve_video_kbps,
    validate_preset_dict,
)

# ---------------------------------------------------------------------------
# Bitrate math (compute_target_video_kbps / resolve_video_kbps)
# ---------------------------------------------------------------------------

class TestBitrateMath:
    def test_typical_short_clip_fits(self):
        # 10 MB over 60s at 128 kbps audio, with the size-cap headroom applied.
        video_kbps = compute_target_video_kbps(target_size_mb=10.0, duration_s=60.0, audio_kbps=128)
        assert video_kbps == pytest.approx((10.0 * SIZE_CAP_HEADROOM * 8192 / 60.0) - 128)
        assert video_kbps > MIN_VIDEO_KBPS

    def test_reserves_headroom_below_the_hard_cap(self):
        # The total bitrate (video + audio) must fill strictly less than the raw
        # byte budget, so the produced file stays under the hard cap after overhead.
        duration_s = 60.0
        video_kbps = compute_target_video_kbps(target_size_mb=10.0, duration_s=duration_s, audio_kbps=128)
        total_kbps = video_kbps + 128
        raw_budget_kbps = 10.0 * 8192 / duration_s
        assert total_kbps == pytest.approx(raw_budget_kbps * SIZE_CAP_HEADROOM)
        assert total_kbps < raw_budget_kbps

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
            resolve_video_kbps(preset, duration_s=600.0)  # 10 min - way under MIN_VIDEO_KBPS

    def test_error_message_uses_the_presets_own_target_size(self):
        preset = ExportPreset(name="tiny", label="Tiny", container="mp4", target_size_mb=2.0, audio_kbps=128)
        with pytest.raises(ClipTooLongForPresetError, match="too long to fit under 2 MB"):
            resolve_video_kbps(preset, duration_s=120.0)

    def test_zero_duration_is_rejected_before_dividing_by_it(self):
        preset = ExportPreset(name="discord-10mb", label="Discord", container="mp4", target_size_mb=10.0, audio_kbps=128)
        with pytest.raises(ValueError, match="leave no clip"):
            resolve_video_kbps(preset, duration_s=0.0)

    def test_negative_duration_does_not_report_the_clip_as_too_long(self):
        # A crossed-over trim yields a negative bitrate, which trips the size floor and
        # would otherwise blame clip length - the opposite of the real problem.
        preset = ExportPreset(name="discord-10mb", label="Discord", container="mp4", target_size_mb=10.0, audio_kbps=128)
        with pytest.raises(ValueError, match="leave no clip") as exc_info:
            resolve_video_kbps(preset, duration_s=-10.0)
        assert "too long" not in str(exc_info.value)

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

    def test_unknown_keys_in_stored_preset_are_ignored(self):
        # A hand-edited or future-version config must not 500 every export.
        custom = [{"name": "my-preset", "label": "Mine", "container": "mkv",
                   "crf": 23, "audio_kbps": 128, "added_in_v99": True}]
        preset = resolve_preset("my-preset", custom)
        assert preset is not None
        assert preset.container == "mkv"
