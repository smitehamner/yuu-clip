"""yuu_clip/export/paths.py - on-disk path resolution + the shared 400 checks for
the ?preset= / caption-style export query params.

export_paths/srt_path/clip_export_row_files duck-type on ClipCandidate/Video-shaped
objects (clip.id, clip.start_hms, video.filename, clip.exports), so plain
SimpleNamespace fakes stand in for the real SQLAlchemy models - no DB needed.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from yuu_clip.export.naming import EXPORT_VIDEO_EXTENSIONS
from yuu_clip.export.paths import (
    clip_export_row_files,
    export_paths,
    srt_path,
    validate_caption_style_query,
    validate_export_preset_query,
)


def _clip(clip_id=1, start_hms="0:15", exports=()):
    return SimpleNamespace(id=clip_id, start_hms=start_hms, exports=list(exports))


def _video(filename="session.mkv"):
    return SimpleNamespace(filename=filename)


class TestExportPaths:
    def test_returns_one_candidate_per_supported_extension(self, tmp_path):
        paths = export_paths(_clip(), _video(), tmp_path)
        assert len(paths) == len(EXPORT_VIDEO_EXTENSIONS)
        assert {p.suffix for p in paths} == set(EXPORT_VIDEO_EXTENSIONS)

    def test_candidate_paths_share_the_clip_stem(self, tmp_path):
        paths = export_paths(_clip(clip_id=7, start_hms="1:05"), _video(), tmp_path)
        assert all(p.stem == "session_clip7_1-05" for p in paths)

    def test_candidate_paths_live_in_export_dir(self, tmp_path):
        paths = export_paths(_clip(), _video(), tmp_path)
        assert all(p.parent == tmp_path for p in paths)


class TestSrtPath:
    def test_missing_srt_returns_none(self, tmp_path):
        assert srt_path(_clip(), _video(), tmp_path) is None

    def test_existing_srt_returns_its_path(self, tmp_path):
        stem = "session_clip1_0-15"
        srt_file = tmp_path / f"{stem}.srt"
        srt_file.write_text("1\n", encoding="utf-8")
        assert srt_path(_clip(), _video(), tmp_path) == srt_file


class TestClipExportRowFiles:
    def test_no_rows_returns_empty(self):
        assert clip_export_row_files(_clip(exports=[])) == []

    def test_existing_row_files_returned(self, tmp_path):
        existing = tmp_path / "clip.mkv"
        existing.write_bytes(b"fake")
        clip = _clip(exports=[SimpleNamespace(path=str(existing))])
        assert clip_export_row_files(clip) == [existing]

    def test_row_pointing_at_a_deleted_file_is_dropped(self, tmp_path):
        clip = _clip(exports=[SimpleNamespace(path=str(tmp_path / "gone.mkv"))])
        assert clip_export_row_files(clip) == []

    def test_partial_failure_keeps_only_existing_rows(self, tmp_path):
        existing = tmp_path / "kept.mkv"
        existing.write_bytes(b"fake")
        clip = _clip(exports=[
            SimpleNamespace(path=str(existing)),
            SimpleNamespace(path=str(tmp_path / "missing.mp4")),
        ])
        assert clip_export_row_files(clip) == [existing]


class TestValidateExportPresetQuery:
    def _ctx(self, custom_presets=()):
        return SimpleNamespace(config=SimpleNamespace(export_presets=list(custom_presets)))

    def test_no_preset_is_always_fine(self):
        validate_export_preset_query(self._ctx(), None, embed_subs=True)
        validate_export_preset_query(self._ctx(), "", embed_subs=False)

    def test_builtin_preset_with_no_embed_subs_is_fine(self):
        validate_export_preset_query(self._ctx(), "youtube-1080p", embed_subs=False)

    def test_preset_combined_with_embed_subs_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_export_preset_query(self._ctx(), "youtube-1080p", embed_subs=True)
        assert exc.value.status_code == 400
        assert "embed_subs" in exc.value.detail

    def test_unknown_preset_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_export_preset_query(self._ctx(), "does-not-exist", embed_subs=False)
        assert exc.value.status_code == 400
        assert "does-not-exist" in exc.value.detail

    def test_known_custom_preset_is_fine(self):
        custom = [{"name": "my-preset", "label": "Mine", "container": "mp4"}]
        validate_export_preset_query(self._ctx(custom), "my-preset", embed_subs=False)

    def test_embed_subs_checked_before_unknown_preset(self):
        # Both conditions could fire; embed_subs is the more specific complaint.
        with pytest.raises(HTTPException) as exc:
            validate_export_preset_query(self._ctx(), "does-not-exist", embed_subs=True)
        assert "embed_subs" in exc.value.detail


class TestValidateCaptionStyleQuery:
    def test_all_none_is_fine(self):
        validate_caption_style_query(None, None, None, None)

    def test_valid_values_are_fine(self):
        validate_caption_style_query("Arial", 32, "top", 4)

    def test_bad_font_name_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_caption_style_query("bad,name", None, None)
        assert exc.value.status_code == 400

    def test_bad_font_size_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_caption_style_query(None, 9999, None)
        assert exc.value.status_code == 400

    def test_bad_word_chunk_size_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_caption_style_query(None, None, None, word_chunk_size=9999)
        assert exc.value.status_code == 400

    def test_invalid_caption_position_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_caption_style_query(None, None, "middle")
        assert exc.value.status_code == 400
        assert "caption_position" in exc.value.detail

    def test_valid_bottom_position_is_fine(self):
        validate_caption_style_query(None, None, "bottom")
