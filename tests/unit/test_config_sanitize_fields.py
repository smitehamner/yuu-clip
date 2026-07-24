"""config.py's hand-edited-config recovery path: _sanitize_title_card_fields/
_sanitize_caption_style_fields/_sanitize_vision_fields, called directly with a
dict (dict-in/dict-out, mutated in place). Complements
tests/unit/test_config.py::TestTitleCardConfigLoadSanitization (moved in A1),
which exercises the same recovery indirectly through Config.load()."""
from __future__ import annotations

# ---------------------------------------------------------------------------
# _sanitize_title_card_fields
# ---------------------------------------------------------------------------

class TestSanitizeTitleCardFields:
    def _sanitize(self, merged):
        from yuu_clip.config import _sanitize_title_card_fields
        _sanitize_title_card_fields(merged)
        return merged

    def test_bad_bg_color_falls_back_to_default(self):
        from yuu_clip.config import _TITLE_CARD_DEFAULTS
        merged = self._sanitize({"title_card_bg_color": "not-a-color"})
        assert merged["title_card_bg_color"] == _TITLE_CARD_DEFAULTS["title_card_bg_color"]

    def test_bad_font_color_falls_back_to_default(self):
        from yuu_clip.config import _TITLE_CARD_DEFAULTS
        merged = self._sanitize({"title_card_font_color": "red"})
        assert merged["title_card_font_color"] == _TITLE_CARD_DEFAULTS["title_card_font_color"]

    def test_valid_hex_colors_untouched(self):
        merged = self._sanitize({"title_card_bg_color": "#112233", "title_card_font_color": "#eeddcc"})
        assert merged["title_card_bg_color"] == "#112233"
        assert merged["title_card_font_color"] == "#eeddcc"

    def test_unknown_placeholder_template_falls_back_to_default(self):
        from yuu_clip.config import _TITLE_CARD_DEFAULTS
        merged = self._sanitize({"title_card_template": "{bogus}"})
        assert merged["title_card_template"] == _TITLE_CARD_DEFAULTS["title_card_template"]

    def test_valid_template_untouched(self):
        merged = self._sanitize({"title_card_template": "{start} - {duration}"})
        assert merged["title_card_template"] == "{start} - {duration}"

    def test_scale_out_of_range_falls_back_to_default(self):
        from yuu_clip.config import _TITLE_CARD_DEFAULTS
        merged = self._sanitize({"title_card_scale": 5.0})
        assert merged["title_card_scale"] == _TITLE_CARD_DEFAULTS["title_card_scale"]

    def test_scale_wrong_type_falls_back_to_default(self):
        # A non-numeric scale would make the range comparison raise TypeError.
        from yuu_clip.config import _TITLE_CARD_DEFAULTS
        merged = self._sanitize({"title_card_scale": "big"})
        assert merged["title_card_scale"] == _TITLE_CARD_DEFAULTS["title_card_scale"]

    def test_duration_out_of_range_falls_back_to_default(self):
        from yuu_clip.config import _TITLE_CARD_DEFAULTS
        merged = self._sanitize({"title_card_duration_s": 30.0})
        assert merged["title_card_duration_s"] == _TITLE_CARD_DEFAULTS["title_card_duration_s"]

    def test_absent_fields_are_not_added(self):
        # Only keys already present get sanitized/defaulted - the function must
        # not inject fields the caller didn't ask about.
        merged = self._sanitize({})
        assert merged == {}


# ---------------------------------------------------------------------------
# _sanitize_caption_style_fields
# ---------------------------------------------------------------------------

class TestSanitizeCaptionStyleFields:
    def _sanitize(self, merged):
        from yuu_clip.config import _sanitize_caption_style_fields
        _sanitize_caption_style_fields(merged)
        return merged

    def test_bad_font_name_falls_back_to_default(self):
        from yuu_clip.config import _CAPTION_STYLE_DEFAULTS
        merged = self._sanitize({"caption_font_name": "bad,name"})
        assert merged["caption_font_name"] == _CAPTION_STYLE_DEFAULTS["caption_font_name"]

    def test_valid_font_name_untouched(self):
        merged = self._sanitize({"caption_font_name": "Segoe UI"})
        assert merged["caption_font_name"] == "Segoe UI"

    def test_bad_font_size_falls_back_to_default(self):
        from yuu_clip.config import _CAPTION_STYLE_DEFAULTS
        merged = self._sanitize({"caption_font_size": 999})
        assert merged["caption_font_size"] == _CAPTION_STYLE_DEFAULTS["caption_font_size"]

    def test_font_size_wrong_type_falls_back_to_default(self):
        from yuu_clip.config import _CAPTION_STYLE_DEFAULTS
        merged = self._sanitize({"caption_font_size": "big"})
        assert merged["caption_font_size"] == _CAPTION_STYLE_DEFAULTS["caption_font_size"]

    def test_bad_position_falls_back_to_default(self):
        from yuu_clip.config import _CAPTION_STYLE_DEFAULTS
        merged = self._sanitize({"caption_position": "sideways"})
        assert merged["caption_position"] == _CAPTION_STYLE_DEFAULTS["caption_position"]

    def test_valid_position_untouched(self):
        merged = self._sanitize({"caption_position": "top"})
        assert merged["caption_position"] == "top"

    def test_bad_chunk_size_falls_back_to_default(self):
        from yuu_clip.config import _CAPTION_STYLE_DEFAULTS
        merged = self._sanitize({"caption_word_chunk_size": 99})
        assert merged["caption_word_chunk_size"] == _CAPTION_STYLE_DEFAULTS["caption_word_chunk_size"]

    def test_chunk_size_wrong_type_falls_back_to_default(self):
        from yuu_clip.config import _CAPTION_STYLE_DEFAULTS
        merged = self._sanitize({"caption_word_chunk_size": "six"})
        assert merged["caption_word_chunk_size"] == _CAPTION_STYLE_DEFAULTS["caption_word_chunk_size"]

    def test_absent_fields_are_not_added(self):
        merged = self._sanitize({})
        assert merged == {}


# ---------------------------------------------------------------------------
# _sanitize_vision_fields
# ---------------------------------------------------------------------------

class TestSanitizeVisionFields:
    def _sanitize(self, merged):
        from yuu_clip.config import _sanitize_vision_fields
        _sanitize_vision_fields(merged)
        return merged

    def test_out_of_range_frame_count_falls_back_to_default(self):
        merged = self._sanitize({"vision_frames_per_clip": 999})
        assert merged["vision_frames_per_clip"] == 2

    def test_zero_frame_count_falls_back_to_default(self):
        merged = self._sanitize({"vision_frames_per_clip": 0})
        assert merged["vision_frames_per_clip"] == 2

    def test_wrong_type_falls_back_to_default(self):
        merged = self._sanitize({"vision_frames_per_clip": "many"})
        assert merged["vision_frames_per_clip"] == 2

    def test_bool_falls_back_to_default(self):
        # True == 1 would slip through a bare range check.
        merged = self._sanitize({"vision_frames_per_clip": True})
        assert merged["vision_frames_per_clip"] == 2

    def test_valid_frame_count_untouched(self):
        merged = self._sanitize({"vision_frames_per_clip": 5})
        assert merged["vision_frames_per_clip"] == 5

    def test_absent_field_is_not_added(self):
        merged = self._sanitize({})
        assert merged == {}
