"""
Export filename stem: template validation and rendering (yuu_clip/export_naming.py).

export_base_stem duck-types on a ClipCandidate-shaped object (cand.video.filename,
cand.id, cand.start_hms, cand.end_ms, cand.score_overall), so plain fakes stand in
for the real SQLAlchemy models here — no DB needed for these pure-function tests.
"""
from __future__ import annotations

from datetime import date

import pytest

from yuu_clip.export_naming import (
    DEFAULT_EXPORT_NAME_TEMPLATE,
    export_base_stem,
    validate_export_name_template,
)


class _FakeVideo:
    def __init__(self, filename: str) -> None:
        self.filename = filename


class _FakeClip:
    def __init__(self, *, id: int, start_ms: int, end_ms: int, score_overall=None,
                 video_filename: str = "MySession.mkv") -> None:
        self.id = id
        self.start_ms = start_ms
        self.end_ms = end_ms
        self.score_overall = score_overall
        self.video = _FakeVideo(video_filename)

    @property
    def start_hms(self) -> str:
        s = self.start_ms // 1000
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


class TestValidateExportNameTemplate:
    def test_default_template_is_valid(self):
        assert validate_export_name_template(DEFAULT_EXPORT_NAME_TEMPLATE) == DEFAULT_EXPORT_NAME_TEMPLATE

    def test_all_known_placeholders_accepted(self):
        template = "{video}_{clip_id}_{start}_{end}_{score}_{date}"
        assert validate_export_name_template(template) == template

    def test_unknown_placeholder_raises(self):
        with pytest.raises(ValueError, match="bogus"):
            validate_export_name_template("{video}_{bogus}")

    def test_literal_text_with_no_placeholders_is_valid(self):
        assert validate_export_name_template("clip") == "clip"


class TestExportBaseStem:
    def test_default_template_matches_legacy_naming(self):
        # Byte-for-byte match with the pre-Stage-8 hardcoded
        # f"{stem}_clip{id}_{start_hms.replace(':', '-')}" format.
        clip = _FakeClip(id=42, start_ms=15 * 60_000, end_ms=16 * 60_000)
        assert export_base_stem(clip, DEFAULT_EXPORT_NAME_TEMPLATE) == "MySession_clip42_15-00"

    def test_video_placeholder(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000)
        assert export_base_stem(clip, "{video}") == "MySession"

    def test_clip_id_placeholder(self):
        clip = _FakeClip(id=7, start_ms=0, end_ms=1_000)
        assert export_base_stem(clip, "{clip_id}") == "7"

    def test_start_placeholder(self):
        clip = _FakeClip(id=1, start_ms=65_000, end_ms=70_000)
        assert export_base_stem(clip, "{start}") == "1-05"

    def test_end_placeholder(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=65_000)
        assert export_base_stem(clip, "{end}") == "1-05"

    def test_score_placeholder_formats_one_decimal(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000, score_overall=0.873)
        assert export_base_stem(clip, "{score}") == "0.9"

    def test_score_placeholder_no_score(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000, score_overall=None)
        assert export_base_stem(clip, "{score}") == "no-score"

    def test_date_placeholder_is_todays_iso_date(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000)
        assert export_base_stem(clip, "{date}") == date.today().isoformat()

    def test_sanitizes_filesystem_unsafe_characters(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000)
        stem = export_base_stem(clip, 'weird<>:"/\\|?*name-{clip_id}')
        assert stem == "weirdname-1"

    def test_collapses_and_strips_whitespace(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000)
        stem = export_base_stem(clip, "  a   b  {clip_id}  ")
        assert stem == "a b 1"

    def test_falls_back_to_default_when_sanitized_stem_is_empty(self):
        clip = _FakeClip(id=3, start_ms=15 * 60_000, end_ms=16 * 60_000)
        stem = export_base_stem(clip, '<>:"/\\|?*')
        assert stem == export_base_stem(clip, DEFAULT_EXPORT_NAME_TEMPLATE)

    def test_video_filename_override(self):
        clip = _FakeClip(id=1, start_ms=0, end_ms=1_000, video_filename="Original.mkv")
        assert export_base_stem(clip, "{video}", video_filename="Other.mp4") == "Other"
