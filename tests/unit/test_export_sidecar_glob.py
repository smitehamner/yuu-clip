"""Unit tests - sidecar lookup for stems containing glob metacharacters.

Recording filenames commonly carry brackets ("[2026-07-01] session.mkv"); the
stem keeps them (the sanitizer strips only \\/:*?"<>|), and an unescaped glob
treats [...] as a character class - silently missing every per-label SRT
sidecar, which orphans caption files on delete/merge.
"""
from __future__ import annotations

import types

from yuu_clip.export.paths import all_sidecar_paths, srt_sidecar_paths


def _clip_and_video():
    clip = types.SimpleNamespace(id=5, start_hms="0:01")
    video = types.SimpleNamespace(filename="[2026-07-01] session.mkv")
    return clip, video


def _seed_sidecars(export_dir):
    stem = "[2026-07-01] session_clip5_0-01"
    per_label = export_dir / f"{stem}.player_voice.srt"
    merged = export_dir / f"{stem}.srt"
    per_label.write_text("1\n", encoding="utf-8")
    merged.write_text("1\n", encoding="utf-8")
    return per_label, merged


class TestBracketedStemSidecars:
    def test_srt_sidecar_paths_finds_bracketed_stem(self, tmp_path):
        clip, video = _clip_and_video()
        per_label, merged = _seed_sidecars(tmp_path)

        found = srt_sidecar_paths(clip, video, tmp_path)

        assert sorted(found) == sorted([per_label, merged])

    def test_all_sidecar_paths_includes_bracketed_srt_files(self, tmp_path):
        clip, video = _clip_and_video()
        per_label, merged = _seed_sidecars(tmp_path)

        found = all_sidecar_paths(clip, video, tmp_path)

        assert per_label in found
        assert merged in found
