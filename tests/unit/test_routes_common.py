"""Unit tests for pure helpers in web/routes/common.py (no DB, no TestClient)."""
import pytest
from fastapi import HTTPException

from yuu_clip.db.models import ClipCandidate, Video
from yuu_clip.web.routes.common import (
    parse_int_list,
    parse_optional_color,
    require_clip,
    require_clip_with_source,
)


class _FakeDb:
    """Stands in for a SQLAlchemy session's .get() - no real DB involved."""

    def __init__(self, rows):
        self._rows = rows

    def get(self, model, obj_id):
        return self._rows.get((model, obj_id))


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


class TestParseIntList:
    def test_single_int(self):
        assert parse_int_list("5") == [5]

    def test_comma_separated_ints(self):
        assert parse_int_list("1,2,3") == [1, 2, 3]

    def test_surrounding_and_inner_whitespace_ignored(self):
        assert parse_int_list(" 1 , 2 ,3 ") == [1, 2, 3]

    def test_blank_fields_skipped(self):
        assert parse_int_list("1,,2,") == [1, 2]

    def test_none_returns_empty_by_default(self):
        assert parse_int_list(None) == []

    def test_empty_string_returns_empty_by_default(self):
        assert parse_int_list("") == []

    def test_whitespace_only_returns_empty_by_default(self):
        assert parse_int_list("   ") == []

    def test_blank_input_returns_provided_default(self):
        assert parse_int_list("", default=[7]) == [7]

    def test_all_blank_fields_return_provided_default(self):
        # ",,," parses to no ids, so the default fallback applies too.
        assert parse_int_list(",,,", default=[7]) == [7]

    def test_default_not_applied_when_ids_present(self):
        assert parse_int_list("1,2", default=[7]) == [1, 2]

    def test_non_integer_raises_value_error_naming_the_field(self):
        with pytest.raises(ValueError) as exc:
            parse_int_list("1,x,3")
        assert str(exc.value) == "x"

    def test_default_is_copied_not_aliased(self):
        default = [7]
        result = parse_int_list(None, default=default)
        result.append(9)
        assert default == [7]


class TestRequireClip:
    def test_returns_the_clip_when_found(self):
        clip = ClipCandidate(id=1, video_id=10)
        db = _FakeDb({(ClipCandidate, 1): clip})
        assert require_clip(db, 1) is clip

    def test_404s_when_the_clip_is_missing(self):
        db = _FakeDb({})
        with pytest.raises(HTTPException) as exc:
            require_clip(db, 999)
        assert exc.value.status_code == 404
        assert exc.value.detail == "Clip not found"


class TestRequireClipWithSource:
    def test_returns_clip_and_video_when_the_source_file_exists(self, tmp_path):
        video_path = tmp_path / "recording.mp4"
        video_path.write_bytes(b"fake")
        clip = ClipCandidate(id=1, video_id=10)
        video = Video(id=10, path=str(video_path), filename="recording.mp4")
        db = _FakeDb({(ClipCandidate, 1): clip, (Video, 10): video})

        result_clip, result_video = require_clip_with_source(db, 1)

        assert result_clip is clip
        assert result_video is video

    def test_404s_when_the_clip_is_missing(self):
        db = _FakeDb({})
        with pytest.raises(HTTPException) as exc:
            require_clip_with_source(db, 999)
        assert exc.value.status_code == 404
        assert exc.value.detail == "Clip not found"

    def test_404s_when_the_recording_row_is_missing(self):
        clip = ClipCandidate(id=1, video_id=10)
        db = _FakeDb({(ClipCandidate, 1): clip})

        with pytest.raises(HTTPException) as exc:
            require_clip_with_source(db, 1)

        assert exc.value.status_code == 404
        assert exc.value.detail == "Video not found"

    def test_404s_when_the_source_file_is_missing_on_disk(self, tmp_path):
        clip = ClipCandidate(id=1, video_id=10)
        video = Video(id=10, path=str(tmp_path / "missing.mp4"), filename="missing.mp4")
        db = _FakeDb({(ClipCandidate, 1): clip, (Video, 10): video})

        with pytest.raises(HTTPException) as exc:
            require_clip_with_source(db, 1)

        assert exc.value.status_code == 404
        assert exc.value.detail == "Source video file not found on disk"
