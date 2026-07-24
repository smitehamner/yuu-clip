"""Unit tests for pure helpers in web/routes/common.py (no DB, no TestClient)."""
import pytest

from yuu_clip.web.routes.common import parse_optional_color


class TestParseOptionalColor:
    def test_valid_six_digit_hex_returned(self):
        assert parse_optional_color("#4fc3f7") == "#4fc3f7"

    def test_uppercase_hex_accepted(self):
        assert parse_optional_color("#ABCDEF") == "#ABCDEF"

    def test_none_clears_to_none(self):
        assert parse_optional_color(None) is None

    def test_empty_string_clears_to_none(self):
        assert parse_optional_color("") is None

    def test_whitespace_only_clears_to_none(self):
        assert parse_optional_color("   ") is None

    def test_surrounding_whitespace_stripped(self):
        assert parse_optional_color("  #112233  ") == "#112233"

    def test_short_rgb_form_rejected(self):
        with pytest.raises(ValueError):
            parse_optional_color("#fff")

    def test_alpha_rrggbbaa_form_rejected(self):
        with pytest.raises(ValueError):
            parse_optional_color("#4fc3f7ff")

    def test_named_color_rejected(self):
        with pytest.raises(ValueError):
            parse_optional_color("red")

    def test_missing_hash_rejected(self):
        with pytest.raises(ValueError):
            parse_optional_color("4fc3f7")

    def test_non_hex_digits_rejected(self):
        with pytest.raises(ValueError):
            parse_optional_color("#gggggg")
