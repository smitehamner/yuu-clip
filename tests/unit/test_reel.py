"""Highlight reel pure logic (yuu_clip/reel.py + web/routes/reel.py helpers):
filename sanitisation, segment timing, caption burn-in/concat, clip-file
selection, and caption stitching.

Client-bound route tests live in tests/integration/test_reel.py."""
from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# _safe_filename
# ---------------------------------------------------------------------------

class TestSafeFilename:
    def _fn(self, name, default="highlights.mkv"):
        from yuu_clip.web.routes.reel import _safe_filename
        return _safe_filename(name, default)

    def test_plain_name_returned_unchanged(self):
        assert self._fn("myhighlights.mkv") == "myhighlights.mkv"

    def test_path_traversal_stripped(self):
        result = self._fn("../../etc/evil")
        assert "/" not in result
        assert "\\" not in result
        assert result == "evil"

    def test_empty_string_returns_default(self):
        assert self._fn("", default="highlights.mkv") == "highlights.mkv"

    def test_directory_component_stripped_leaving_last_part(self):
        # Path("some/dir/foo").name == "foo" - parent components are stripped
        assert self._fn("some/dir/foo") == "foo"

    def test_windows_path_with_backslashes_stripped(self):
        # pathlib.Path normalises \ to / on Windows; Path("C:\\evil.mkv").name == "evil.mkv"
        from pathlib import Path
        result = self._fn("C:\\evil.mkv")
        assert result == Path("C:\\evil.mkv").name

    def test_windows_path_with_forward_slashes_stripped(self):
        # Path("C:/Windows/System32/cmd.exe").name == "cmd.exe" on all platforms
        result = self._fn("C:/Windows/System32/cmd.exe")
        assert "/" not in result
        assert "\\" not in result

    def test_custom_default_used_when_empty(self):
        assert self._fn("", default="fallback.mkv") == "fallback.mkv"

    def test_name_with_spaces_preserved(self):
        assert self._fn("my reel.mkv") == "my reel.mkv"


# ---------------------------------------------------------------------------
# Reel caption stitching (yuu_clip/reel.py)
# ---------------------------------------------------------------------------

class TestSegmentStartTimes:
    def _starts(self, durations, trans_dur):
        from yuu_clip.reel import _segment_start_times
        return _segment_start_times(durations, trans_dur)

    def test_concat_offsets_are_cumulative(self):
        assert self._starts([3.0, 5.0, 3.0, 4.0], 0.0) == [0.0, 3.0, 8.0, 11.0]

    def test_xfade_overlap_pulls_each_segment_earlier(self):
        assert self._starts([3.0, 5.0], 0.5) == [0.0, 2.5]

    def test_single_segment(self):
        assert self._starts([3.0], 0.5) == [0.0]

    def test_never_negative(self):
        assert self._starts([0.2, 0.2], 0.5) == [0.0, 0.0]

    @staticmethod
    def _path(name):
        from pathlib import Path
        return Path(name)

    def test_short_early_segment_does_not_drift_caption_timeline(self):
        # A segment shorter than trans_dur clamps its own start to 0, but that lost
        # negative carry must NOT push later starts. The caption offsets have to stay
        # equal to the xfade offsets _build_xfade_cmd feeds ffmpeg, or captions drift.
        durations = [0.1, 2.0, 1.0]
        trans_dur = 0.5
        starts = self._starts(durations, trans_dur)
        assert starts == [0.0, 0.0, 1.1]

    def test_matches_build_xfade_cmd_offsets(self):
        # The two are the single source of truth for where each segment lands; they
        # must never diverge. Parse the offset= values out of the real xfade command
        # and compare against _segment_start_times for the clip (non-first) segments.
        import re

        from yuu_clip.reel import _build_xfade_cmd
        durations = [0.1, 2.0, 1.0, 3.0]
        trans_dur = 0.5
        segments = [self._path(f"seg{i}.mkv") for i in range(len(durations))]
        transitions = ["fade"] * (len(durations) - 1)
        cmd = _build_xfade_cmd(segments, durations, self._path("out.mkv"), transitions, trans_dur)
        filter_complex = cmd[cmd.index("-filter_complex") + 1]
        xfade_offsets = [float(m) for m in re.findall(r"offset=([\d.]+)", filter_complex)]
        starts = self._starts(durations, trans_dur)
        # starts[0] is 0; starts[i+1] is the offset of xfade cut i.
        assert starts[1:] == xfade_offsets


class TestBurnReelCaptions:
    """reel.burn_reel_captions - the final burn-in pass reuses the clip-export
    subtitles filter (so the global Caption style applies), stream-copies audio,
    and replaces the reel file in place."""

    def _run(self, tmp_path, monkeypatch, style=None):
        from pathlib import Path

        from yuu_clip import reel as reel_mod
        captured = {}

        def fake_run_ffmpeg(cmd):
            captured["cmd"] = cmd
            # Simulate ffmpeg writing the temp output so .replace() succeeds.
            out = Path(cmd[-1])
            out.write_bytes(b"burned")

        monkeypatch.setattr(reel_mod, "run_ffmpeg", fake_run_ffmpeg)
        reel = tmp_path / "reel.mkv"
        reel.write_bytes(b"original")
        srt = tmp_path / "reel.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nhi\n", encoding="utf-8")
        reel_mod.burn_reel_captions(reel, srt, style)
        return captured["cmd"], reel

    def test_vf_uses_subtitles_filter(self, tmp_path, monkeypatch):
        cmd, _ = self._run(tmp_path, monkeypatch)
        vf = cmd[cmd.index("-vf") + 1]
        assert vf.startswith("subtitles=")
        assert (tmp_path / "reel.srt").name in vf

    def test_style_becomes_force_style(self, tmp_path, monkeypatch):
        from yuu_clip.analyze.extract import CaptionStyle
        cmd, _ = self._run(tmp_path, monkeypatch, CaptionStyle(font_size=40, position="top"))
        vf = cmd[cmd.index("-vf") + 1]
        assert "force_style='FontSize=40,Alignment=8'" in vf

    def test_audio_is_stream_copied(self, tmp_path, monkeypatch):
        cmd, _ = self._run(tmp_path, monkeypatch)
        assert cmd[cmd.index("-c:a") + 1] == "copy"

    def test_replaces_reel_in_place(self, tmp_path, monkeypatch):
        _, reel = self._run(tmp_path, monkeypatch)
        assert reel.read_bytes() == b"burned"
        assert not reel.with_name("reel.burn_tmp.mkv").exists()

    def test_failed_encode_leaves_no_burn_tmp(self, tmp_path, monkeypatch):
        from pathlib import Path

        from yuu_clip import reel as reel_mod

        def failing_run_ffmpeg(cmd):
            # Simulate ffmpeg writing a partial temp then dying.
            Path(cmd[-1]).write_bytes(b"partial")
            raise RuntimeError("ffmpeg exploded")

        monkeypatch.setattr(reel_mod, "run_ffmpeg", failing_run_ffmpeg)
        reel = tmp_path / "reel.mkv"
        reel.write_bytes(b"original")
        srt = tmp_path / "reel.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nhi\n", encoding="utf-8")
        with pytest.raises(RuntimeError, match="ffmpeg exploded"):
            reel_mod.burn_reel_captions(reel, srt)
        assert not reel.with_name("reel.burn_tmp.mkv").exists()
        assert reel.read_bytes() == b"original"


class TestCompileConcat:
    """reel._compile_concat writes the ffmpeg concat-demuxer list. Filenames can
    legitimately contain an apostrophe (e.g. "Tom's stream_clip.mkv"), which the
    demuxer treats as a quote delimiter unless escaped as '\\''."""

    def test_apostrophe_in_path_is_escaped(self, tmp_path, monkeypatch):
        from pathlib import Path

        from yuu_clip import reel as reel_mod
        captured = {}

        def fake_run_ffmpeg(cmd):
            list_path = Path(cmd[cmd.index("-i") + 1])
            captured["list"] = list_path.read_text(encoding="utf-8")
            Path(cmd[-1]).write_bytes(b"concat")

        monkeypatch.setattr(reel_mod, "run_ffmpeg", fake_run_ffmpeg)
        seg = tmp_path / "Tom's stream_clip.mkv"
        seg.write_bytes(b"seg")
        reel_mod._compile_concat([seg], tmp_path / "out.mkv")
        line = captured["list"].strip()
        assert line.startswith("file '") and line.endswith("'")
        assert line.endswith(r"Tom'\''s stream_clip.mkv'")


class TestSelectClipExportFile:
    """reel._select_clip_export_file - which exported file a reel build uses when a
    clip has several per-preset formats. Must deterministically prefer the default
    (presetless) export and never silently change format between runs."""

    def _clip_and_video(self):
        import types
        clip = types.SimpleNamespace(id=1, start_hms="0:15", video_id=1)
        video = types.SimpleNamespace(filename="session.mkv")
        return clip, video

    def _select(self, export_dir):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
        from yuu_clip.reel import _select_clip_export_file
        clip, video = self._clip_and_video()
        return _select_clip_export_file(clip, video, export_dir, DEFAULT_EXPORT_NAME_TEMPLATE)

    def test_returns_none_when_no_export_files(self, tmp_path):
        assert self._select(tmp_path) is None

    def test_returns_default_export_when_only_default_exists(self, tmp_path):
        (tmp_path / "session_clip1_0-15.mp4").write_bytes(b"x")
        assert self._select(tmp_path) == tmp_path / "session_clip1_0-15.mp4"

    def test_prefers_default_over_a_preset_format(self, tmp_path):
        (tmp_path / "session_clip1_0-15.mkv").write_bytes(b"x")
        (tmp_path / "session_clip1_0-15_youtube-1080p.mp4").write_bytes(b"x")
        assert self._select(tmp_path) == tmp_path / "session_clip1_0-15.mkv"

    def test_falls_back_to_most_recent_preset_when_no_default(self, tmp_path):
        import os
        older = tmp_path / "session_clip1_0-15_discord-10mb.mp4"
        newer = tmp_path / "session_clip1_0-15_youtube-1080p.mp4"
        older.write_bytes(b"x")
        newer.write_bytes(b"x")
        os.utime(older, (1_000_000, 1_000_000))
        os.utime(newer, (2_000_000, 2_000_000))
        assert self._select(tmp_path) == newer

    def test_ignores_non_video_sidecars_with_base_prefix(self, tmp_path):
        (tmp_path / "session_clip1_0-15_youtube-1080p.srt").write_text("1\n", encoding="utf-8")
        assert self._select(tmp_path) is None


def _seed_transcribed_project(tmp_path):
    """A project DB with one approved clip carrying one transcript segment.

    Returns (open session, clip_id). Caller closes the session.
    """
    from yuu_clip.db.models import (
        AudioTrack,
        ClipCandidate,
        Transcript,
        TranscriptSegment,
        Video,
        make_session,
    )
    data = tmp_path / ".yuu-clip"
    data.mkdir(exist_ok=True)
    (data / "reels").mkdir(exist_ok=True)
    session = make_session(data / "project.db")
    video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="done", duration_ms=600_000)
    session.add(video)
    session.flush()
    track = AudioTrack(video_id=video.id, stream_index=1, label="combined",
                       do_transcribe=True, do_score=True, relevance_weight=1.0)
    session.add(track)
    session.flush()
    tx = Transcript(audio_track_id=track.id, model_name="tiny", language="en")
    session.add(tx)
    session.flush()
    session.add(TranscriptSegment(transcript_id=tx.id, start_ms=1000, end_ms=2000, text="hello world"))
    clip = ClipCandidate(video_id=video.id, start_ms=0, end_ms=5000,
                         score_overall=0.6, status="approved", description="c1")
    session.add(clip)
    session.commit()
    return session, clip.id


class TestBuildReelCaptionSrt:
    def test_stitches_and_offsets_lines_by_segment_start(self, tmp_path):
        import json

        from yuu_clip.reel import build_reel_caption_srt, reel_caption_path, reel_composition_path
        session, clip_id = _seed_transcribed_project(tmp_path)
        reel = tmp_path / ".yuu-clip" / "reels" / "reel_x.mkv"
        reel.write_bytes(b"fake")
        reel_composition_path(reel).write_text(json.dumps({
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0,
            "clips": [{"id": clip_id, "duration_s": 5.0}],
        }), encoding="utf-8")

        out = build_reel_caption_srt(session, reel)
        session.close()

        assert out == reel_caption_path(reel)
        srt = out.read_text(encoding="utf-8")
        # concat (transition none): clip segment starts at title_dur=3.0s; the
        # clip-relative line at 1.0-2.0s lands at 4.0-5.0s on the reel timeline.
        assert "00:00:04,000 --> 00:00:05,000" in srt
        assert "hello world" in srt

    def test_missing_composition_returns_none(self, tmp_path):
        from yuu_clip.reel import build_reel_caption_srt
        session, _ = _seed_transcribed_project(tmp_path)
        reel = tmp_path / ".yuu-clip" / "reels" / "noconfig.mkv"
        reel.write_bytes(b"x")
        assert build_reel_caption_srt(session, reel) is None
        session.close()


class TestBuildReelCaptionAss:
    """The word-highlight reel path reuses subtitles.lines_to_ass, so it produces
    the same per-word ASS as single-clip export, with word timings offset onto the
    reel timeline."""

    def _reel_with_words(self, tmp_path):
        import json

        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.reel import reel_composition_path
        session, clip_id = _seed_transcribed_project(tmp_path)
        seg = session.query(TranscriptSegment).first()
        seg.words = [
            {"text": "hello", "start_ms": 1000, "end_ms": 1400},
            {"text": "world", "start_ms": 1400, "end_ms": 2000},
        ]
        session.commit()
        reel = tmp_path / ".yuu-clip" / "reels" / "reel_x.mkv"
        reel.write_bytes(b"fake")
        reel_composition_path(reel).write_text(json.dumps({
            "version": 1, "transition": "none", "trans_dur": 0.5, "title_dur": 3.0,
            "clips": [{"id": clip_id, "duration_s": 5.0}],
        }), encoding="utf-8")
        return session, reel

    def test_word_highlight_reel_produces_ass_with_offset_words(self, tmp_path):
        from yuu_clip.reel import build_reel_caption_ass, reel_ass_caption_path
        session, reel = self._reel_with_words(tmp_path)

        out = build_reel_caption_ass(session, reel, chunk_size=4)
        session.close()

        assert out == reel_ass_caption_path(reel)
        ass = out.read_text(encoding="utf-8")
        assert "[Events]" in ass
        dialogues = [line for line in ass.splitlines() if line.startswith("Dialogue:")]
        assert len(dialogues) == 2  # one event per word
        # Segment starts at title_dur=3.0s, so the word at 1.0s lands at 4.0s and its
        # event runs until the next word begins (4.4s) on the reel timeline.
        assert "0:00:04.00,0:00:04.40" in ass

    def test_missing_composition_returns_none(self, tmp_path):
        from yuu_clip.reel import build_reel_caption_ass
        session, _ = _seed_transcribed_project(tmp_path)
        reel = tmp_path / ".yuu-clip" / "reels" / "noconfig.mkv"
        reel.write_bytes(b"x")
        assert build_reel_caption_ass(session, reel, chunk_size=4) is None
        session.close()
