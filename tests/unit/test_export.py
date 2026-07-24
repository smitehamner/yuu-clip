from __future__ import annotations

import asyncio
import os
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

# ---------------------------------------------------------------------------
# export_clip FFmpeg command shape - the -t duration flag must land after every
# -i input so FFmpeg treats it as an output limit. An earlier bug placed -t
# between the two inputs of the softsub branch, where it bound to the subtitle
# input and left the video uncut - exporting the entire multi-hour source.
# ---------------------------------------------------------------------------

class TestExportClipCmd:
    def _cmd(self, **overrides):
        from yuu_clip.analyze.extract import _build_clip_cmd
        args = dict(
            ffmpeg="ffmpeg",
            video_path=Path("in.mkv"),
            start_s=10.0,
            duration_s=30.0,
            output_path=Path("out.mkv"),
            reencode=False,
            subtitle_path=None,
            subtitle_track_path=None,
            audio_stream_index=None,
        )
        args.update(overrides)
        return _build_clip_cmd(**args)

    def _assert_t_after_all_inputs(self, cmd):
        last_input = max(i for i, a in enumerate(cmd) if a == "-i")
        t_positions = [i for i, a in enumerate(cmd) if a == "-t"]
        assert t_positions, "export command must limit duration with -t"
        assert all(i > last_input for i in t_positions), \
            "-t must come after every -i or FFmpeg ignores it as an output limit"

    def test_stream_copy_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd())

    def test_reencode_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd(reencode=True))

    def test_burn_in_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd(subtitle_path=Path("subs.srt")))

    def test_softsub_limits_output(self):
        self._assert_t_after_all_inputs(self._cmd(subtitle_track_path=Path("subs.srt")))

    def test_softsub_duration_is_clip_length(self):
        cmd = self._cmd(subtitle_track_path=Path("subs.srt"), duration_s=42.0)
        assert cmd[cmd.index("-t") + 1] == "42.0"


class TestSubtitlesFilter:
    """The burn-in filter builder - force_style is added only for non-default
    fields, PrimaryColour is never set (per-speaker <font color> tags must win),
    and Windows drive-colon escaping is preserved."""

    def _filter(self, style=None, path="subs.srt"):
        from yuu_clip.analyze.extract import _subtitles_filter
        return _subtitles_filter(Path(path), style)

    def _style(self, **kw):
        from yuu_clip.analyze.extract import CaptionStyle
        return CaptionStyle(**kw)

    def test_no_style_emits_no_force_style(self):
        assert self._filter() == "subtitles='subs.srt'"

    def test_default_style_emits_no_force_style(self):
        assert self._filter(self._style()) == "subtitles='subs.srt'"
        assert self._style().is_default()

    def test_font_name_fragment(self):
        assert self._filter(self._style(font_name="Arial")) == \
            "subtitles='subs.srt':force_style='FontName=Arial'"

    def test_font_size_fragment(self):
        assert self._filter(self._style(font_size=32)) == \
            "subtitles='subs.srt':force_style='FontSize=32'"

    def test_top_position_emits_alignment_8(self):
        assert self._filter(self._style(position="top")) == \
            "subtitles='subs.srt':force_style='Alignment=8'"

    def test_bottom_position_is_default_no_fragment(self):
        assert self._filter(self._style(position="bottom")) == "subtitles='subs.srt'"

    def test_all_fields_joined_with_commas(self):
        result = self._filter(self._style(font_name="Segoe UI", font_size=40, position="top"))
        assert result == "subtitles='subs.srt':force_style='FontName=Segoe UI,FontSize=40,Alignment=8'"

    def test_never_sets_primary_colour(self):
        result = self._filter(self._style(font_name="Arial", font_size=40, position="top"))
        assert "PrimaryColour" not in result

    def test_windows_drive_colon_escaped_and_quoted(self):
        # The drive colon is escaped AND the path quoted - the bundled ffmpeg splits
        # an unquoted C\:/... at the colon and burned captions fail (see _subtitles_filter).
        result = self._filter(self._style(font_name="Arial"), path="C:/videos/subs.srt")
        assert result == "subtitles='C\\:/videos/subs.srt':force_style='FontName=Arial'"


class TestCaptionStyleInExportCmd:
    """Both burn-in export paths (plain _build_clip_cmd and preset
    _preset_video_filter) route through _subtitles_filter, so a CaptionStyle
    reaches the built ffmpeg -vf argument."""

    def test_plain_burn_in_applies_style(self):
        from yuu_clip.analyze.extract import CaptionStyle, _build_clip_cmd
        cmd = _build_clip_cmd(
            ffmpeg="ffmpeg", video_path=Path("in.mkv"), start_s=1.0, duration_s=5.0,
            output_path=Path("out.mkv"), reencode=False, subtitle_path=Path("subs.srt"),
            subtitle_track_path=None, audio_stream_index=None,
            caption_style=CaptionStyle(font_size=48, position="top"),
        )
        vf = cmd[cmd.index("-vf") + 1]
        assert vf == "subtitles='subs.srt':force_style='FontSize=48,Alignment=8'"

    def test_preset_burn_in_applies_style_after_scale(self):
        from types import SimpleNamespace

        from yuu_clip.analyze.extract import CaptionStyle, _preset_video_filter
        preset = SimpleNamespace(height=1080, vertical=False)
        vf = _preset_video_filter(preset, Path("subs.srt"), CaptionStyle(font_name="Arial"))
        assert vf == "scale=-2:'min(ih,1080)',subtitles='subs.srt':force_style='FontName=Arial'"


class TestWriteExportSubs:
    """Word-highlight switches the burned-in caption temp file from .srt to .ass
    (via lines_to_ass); the embedded soft-subtitle track stays .srt regardless."""

    def _cand(self):
        return SimpleNamespace(video=SimpleNamespace(width=1920, height=1080))

    def _fakes(self):
        return {
            "lines_to_srt": lambda lines: "SRT-BODY",
            "merged_srt_lines": lambda cand: [object()],
            "lines_to_ass": lambda lines, chunk, play_res: f"ASS chunk={chunk} res={play_res}",
        }

    def test_bake_word_highlight_writes_ass(self):
        from yuu_clip.export.render import _write_export_subs
        burn, soft = _write_export_subs(
            self._cand(), bake_captions=True, embed_subs=False, word_highlight=True, chunk_size=5,
            **self._fakes(),
        )
        assert soft is None
        assert burn.suffix == ".ass"
        content = burn.read_text(encoding="utf-8")
        assert "ASS chunk=5 res=(1920, 1080)" in content
        burn.unlink()

    def test_bake_without_word_highlight_writes_srt(self):
        from yuu_clip.export.render import _write_export_subs
        burn, soft = _write_export_subs(
            self._cand(), bake_captions=True, embed_subs=False, word_highlight=False,
            **self._fakes(),
        )
        assert soft is None
        assert burn.suffix == ".srt"
        assert burn.read_text(encoding="utf-8") == "SRT-BODY"
        burn.unlink()

    def test_embed_subs_ignores_word_highlight_and_writes_srt(self):
        from yuu_clip.export.render import _write_export_subs
        burn, soft = _write_export_subs(
            self._cand(), bake_captions=False, embed_subs=True, word_highlight=True, chunk_size=5,
            **self._fakes(),
        )
        assert burn is None
        assert soft.suffix == ".srt"
        soft.unlink()

    def test_no_transcript_data_returns_none(self):
        from yuu_clip.export.render import _write_export_subs
        fakes = self._fakes()
        fakes["merged_srt_lines"] = lambda cand: []
        burn, soft = _write_export_subs(
            self._cand(), bake_captions=True, embed_subs=False, word_highlight=True, **fakes,
        )
        assert burn is None and soft is None


class TestRenderExport:
    """render_export is the public export orchestrator the CLI shrank onto - the
    sequence now has a seam reachable without CliRunner+ffmpeg. These patch the
    ffmpeg-touching internals and assert the wiring (retranscribe gate, source
    guard, sidecar gate)."""

    def _fakes(self, monkeypatch, tmp_path):
        import yuu_clip.export.render as render
        calls = {"retranscribe": 0, "finalize": 0, "sidecars": 0, "committed": 0}
        out = tmp_path / "out.mkv"

        monkeypatch.setattr(render, "run_retranscribe",
                            lambda *a, **k: calls.__setitem__("retranscribe", calls["retranscribe"] + 1))
        monkeypatch.setattr(render, "_build_export_path", lambda *a, **k: ("base_stem", out))
        monkeypatch.setattr(render, "_resolve_caption_style",
                            lambda *a, **k: SimpleNamespace(word_highlight=False, word_chunk_size=4))
        monkeypatch.setattr(render, "_write_export_subs", lambda *a, **k: (None, None))
        monkeypatch.setattr(render, "_resolve_audio_stream_index", lambda *a, **k: None)
        monkeypatch.setattr(render, "_finalize_export",
                            lambda *a, **k: calls.__setitem__("finalize", calls["finalize"] + 1))
        monkeypatch.setattr(render, "_emit_caption_sidecars",
                            lambda *a, **k: calls.__setitem__("sidecars", calls["sidecars"] + 1))
        return calls

    def _cand(self, video_path):
        return SimpleNamespace(
            id=7, video=SimpleNamespace(path=str(video_path)),
            start_hms="00:00:05", duration_hms="00:00:10",
        )

    def _config(self):
        from yuu_clip.config import Config
        return Config()

    def _session(self, calls):
        return SimpleNamespace(commit=lambda: calls.__setitem__("committed", calls["committed"] + 1))

    def test_runs_finalize_and_sidecars_without_retranscribe(self, monkeypatch, tmp_path):
        from yuu_clip.export.render import ExportOptions, render_export
        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")
        calls = self._fakes(monkeypatch, tmp_path)
        render_export(self._cand(video), self._session(calls), self._config(),
                      ExportOptions(), exports_dir=tmp_path)
        assert calls["retranscribe"] == 0
        assert calls["finalize"] == 1
        assert calls["sidecars"] == 1

    def test_retranscribe_option_runs_it_and_commits(self, monkeypatch, tmp_path):
        from yuu_clip.export.render import ExportOptions, render_export
        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")
        calls = self._fakes(monkeypatch, tmp_path)
        render_export(self._cand(video), self._session(calls), self._config(),
                      ExportOptions(retranscribe=True), exports_dir=tmp_path)
        assert calls["retranscribe"] == 1
        assert calls["committed"] == 1

    def test_captions_off_skips_sidecars(self, monkeypatch, tmp_path):
        from yuu_clip.export.render import ExportOptions, render_export
        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")
        calls = self._fakes(monkeypatch, tmp_path)
        render_export(self._cand(video), self._session(calls), self._config(),
                      ExportOptions(captions=False), exports_dir=tmp_path)
        assert calls["finalize"] == 1
        assert calls["sidecars"] == 0

    def test_missing_source_video_exits_before_cut(self, monkeypatch, tmp_path):
        import typer

        from yuu_clip.export.render import ExportOptions, render_export
        calls = self._fakes(monkeypatch, tmp_path)
        with pytest.raises(typer.Exit):
            render_export(self._cand(tmp_path / "gone.mkv"), self._session(calls),
                          self._config(), ExportOptions(), exports_dir=tmp_path)
        assert calls["finalize"] == 0


class TestResolveCaptionStyleWordHighlight:
    def _config(self):
        from yuu_clip.config import Config
        return Config()

    def test_falls_back_to_config_defaults(self):
        from yuu_clip.export.render import _resolve_caption_style
        style = _resolve_caption_style(self._config(), None, None, None, None, None)
        assert style.word_highlight is False
        assert style.word_chunk_size == 4
        assert style.is_default()

    def test_override_enables_word_highlight(self):
        from yuu_clip.export.render import _resolve_caption_style
        style = _resolve_caption_style(self._config(), None, None, None, True, 6)
        assert style.word_highlight is True
        assert style.word_chunk_size == 6
        assert not style.is_default()

    def test_bad_chunk_size_exits(self):
        import typer

        from yuu_clip.export.render import _resolve_caption_style
        with pytest.raises(typer.Exit):
            _resolve_caption_style(self._config(), None, None, None, True, 99)


class TestVerticalCropFilter:
    """A vertical (9:16 Shorts) preset crops the source to a 9:16 column at the
    clip's crop_x position, scales+pads to 1080x1920, and puts any burned-in
    captions last so they are sized for the final vertical frame."""

    def _vertical_preset(self):
        from types import SimpleNamespace
        return SimpleNamespace(vertical=True, height=1920)

    def _crop(self, fraction: str) -> str:
        # min()'s comma is escaped so libavfilter doesn't read it as a filter separator.
        return f"crop=min(iw\\,ih*9/16):ih:(iw-min(iw\\,ih*9/16))*{fraction}:0"

    def _expect(self, fraction: str) -> str:
        return (
            f"{self._crop(fraction)},"
            "scale=1080:1920:force_original_aspect_ratio=decrease,"
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
        )

    def test_center_when_crop_x_none(self):
        from yuu_clip.analyze.extract import _preset_video_filter
        assert _preset_video_filter(self._vertical_preset(), None, crop_x=None) == self._expect("0.5000")

    def test_left_edge(self):
        from yuu_clip.analyze.extract import _preset_video_filter
        assert _preset_video_filter(self._vertical_preset(), None, crop_x=0.0) == self._expect("0.0000")

    def test_right_edge(self):
        from yuu_clip.analyze.extract import _preset_video_filter
        assert _preset_video_filter(self._vertical_preset(), None, crop_x=1.0) == self._expect("1.0000")

    def test_crop_x_is_clamped_to_unit_interval(self):
        from yuu_clip.analyze.extract import _preset_video_filter
        assert _preset_video_filter(self._vertical_preset(), None, crop_x=1.5) == self._expect("1.0000")
        assert _preset_video_filter(self._vertical_preset(), None, crop_x=-0.3) == self._expect("0.0000")

    def test_captions_appended_after_crop_and_scale(self):
        from yuu_clip.analyze.extract import CaptionStyle, _preset_video_filter
        vf = _preset_video_filter(
            self._vertical_preset(), Path("subs.srt"), CaptionStyle(font_size=48), crop_x=0.5,
        )
        assert vf == self._expect("0.5000") + ",subtitles='subs.srt':force_style='FontSize=48'"


class TestComputeExportWindow:
    """cand.start_ms/end_ms/video.duration_ms are segment-relative for a split
    recording, but video.path (the file export_clip actually opens) is always the
    untrimmed parent - segment_start_s must be added back in after clamping."""

    def _cand(self, start_ms, end_ms, *, start_offset=0.0, end_offset=0.0,
              duration_ms=None, segment_start_s=None):
        return SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms,
            start_offset=start_offset, end_offset=end_offset,
            video=SimpleNamespace(duration_ms=duration_ms, segment_start_s=segment_start_s),
        )

    def test_non_segment_video_unaffected(self):
        from yuu_clip.export.window import export_window_ms
        cand = self._cand(10_000, 20_000, duration_ms=600_000, segment_start_s=None)
        assert export_window_ms(cand) == (10_000, 20_000)

    def test_split_segment_adds_segment_offset(self):
        from yuu_clip.export.window import export_window_ms
        # Segment starts at 300s into the parent; clip is 10-20s into the segment.
        cand = self._cand(10_000, 20_000, duration_ms=120_000, segment_start_s=300.0)
        assert export_window_ms(cand) == (310_000, 320_000)

    def test_split_segment_clamp_uses_segment_relative_duration(self):
        from yuu_clip.export.window import export_window_ms
        # end_ms would exceed the 120s segment before the offset is added; clamp
        # against the segment-relative duration, then shift into parent coordinates.
        cand = self._cand(100_000, 150_000, duration_ms=120_000, segment_start_s=300.0)
        start_ms, end_ms = export_window_ms(cand)
        assert start_ms == 400_000
        assert end_ms == 420_000  # clamped to 120_000 (segment end) + 300_000 offset


class TestEmptyTrimWindow:
    """Offsets that cross over each other leave nothing to cut. ffmpeg answers a
    zero-length request with a keyframe-sized fragment and exit 0, so an unguarded
    empty window is recorded as a *successful* export of a ~0.4s file."""

    def _cand(self, start_offset, end_offset):
        return SimpleNamespace(
            start_ms=60_000, end_ms=80_000,
            start_offset=start_offset, end_offset=end_offset,
            video=SimpleNamespace(duration_ms=600_000, segment_start_s=None),
        )

    def test_offsets_that_cancel_out_are_empty(self):
        from yuu_clip.export.window import window_is_empty
        assert window_is_empty(self._cand(10.0, -10.0)) is True

    def test_offsets_that_cross_over_are_empty(self):
        from yuu_clip.export.window import window_is_empty
        assert window_is_empty(self._cand(0.0, -30.0)) is True

    def test_ordinary_trim_is_not_empty(self):
        from yuu_clip.export.window import window_is_empty
        assert window_is_empty(self._cand(1.0, -1.0)) is False

    def test_untrimmed_clip_is_not_empty(self):
        from yuu_clip.export.window import window_is_empty
        assert window_is_empty(self._cand(0.0, 0.0)) is False


class TestVerifyExportDuration:
    def test_raises_when_output_is_full_source(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: 10800.0)
        with pytest.raises(RuntimeError, match="trim was not applied"):
            extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=30.0)

    def test_passes_within_tolerance(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: 31.5)
        extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=30.0)

    def test_unprobeable_output_is_lenient(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: None)
        extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=30.0)

    def test_zero_length_request_is_rejected_not_waved_through(self, monkeypatch):
        # The real failure: ffmpeg returns a ~0.4s keyframe fragment for `-t 0`, which
        # sits well under the 5s tolerance floor and would otherwise pass as success.
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: 0.4)
        with pytest.raises(RuntimeError, match="empty"):
            extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=0.0)

    def test_negative_length_request_is_rejected(self, monkeypatch):
        from yuu_clip.analyze import extract
        monkeypatch.setattr(extract, "_probe_duration_s", lambda ffprobe, path: 3.0)
        with pytest.raises(RuntimeError, match="empty"):
            extract._verify_export_duration("ffprobe", Path("out.mkv"), expected_s=-10.0)


class TestShareDeleteMediaServing:
    """Exports must be deletable while still being streamed (the WinError 32 fix)."""

    def test_open_shared_allows_deletion_while_open(self, tmp_path):
        from yuu_clip.web.media import _open_shared
        target = tmp_path / "clip.mkv"
        target.write_bytes(b"payload" * 1000)
        handle = _open_shared(target)
        try:
            os.unlink(target)  # must not raise even with the read handle open
            assert not target.exists()
        finally:
            handle.close()

    def test_resolve_within_rejects_traversal(self, tmp_path):
        from yuu_clip.web.media import resolve_within
        with pytest.raises(HTTPException):
            resolve_within(tmp_path, "../escape.txt")


class TestUnlinkWithRetry:
    """Deleting a just-closed export retries through the brief handle-release window."""

    def test_succeeds_after_transient_lock(self, tmp_path, monkeypatch):
        from yuu_clip.web import file_deletion
        target = tmp_path / "clip.mkv"
        target.write_bytes(b"x")
        real_unlink = Path.unlink
        attempts = {"n": 0}

        def flaky_unlink(self, *args, **kwargs):
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise PermissionError("WinError 32")
            return real_unlink(self, *args, **kwargs)

        monkeypatch.setattr(Path, "unlink", flaky_unlink)
        monkeypatch.setattr(file_deletion.time, "sleep", lambda _s: None)
        file_deletion.unlink_with_retry(target, attempts=5, delay_s=0)
        assert attempts["n"] == 3
        assert not target.exists()

    def test_raises_after_exhausting_attempts(self, tmp_path, monkeypatch):
        from yuu_clip.web import file_deletion
        target = tmp_path / "clip.mkv"
        target.write_bytes(b"x")

        def always_locked(self, *args, **kwargs):
            raise PermissionError("WinError 32")

        monkeypatch.setattr(Path, "unlink", always_locked)
        monkeypatch.setattr(file_deletion.time, "sleep", lambda _s: None)
        with pytest.raises(OSError):
            file_deletion.unlink_with_retry(target, attempts=3, delay_s=0)

    def test_missing_file_is_noop(self, tmp_path):
        from yuu_clip.web import file_deletion
        file_deletion.unlink_with_retry(tmp_path / "gone.mkv")

    def test_delete_files_reports_locked_paths(self, tmp_path, monkeypatch):
        from yuu_clip.web import file_deletion
        ok = tmp_path / "ok.mkv"
        ok.write_bytes(b"x")
        stuck = tmp_path / "stuck.mkv"
        stuck.write_bytes(b"x")

        real_unlink = Path.unlink

        def selective(self, *args, **kwargs):
            if self.name == "stuck.mkv":
                raise PermissionError("WinError 32")
            return real_unlink(self, *args, **kwargs)

        monkeypatch.setattr(Path, "unlink", selective)
        monkeypatch.setattr(file_deletion, "unlink_with_retry",
                            lambda p: file_deletion.Path.unlink(p))  # single attempt, no retry/sleep
        locked = file_deletion.delete_files([ok, stuck])
        assert [p.name for p in locked] == ["stuck.mkv"]
        assert not ok.exists()


class TestLockedFilesError:
    """The 409 names the holding process when the Restart Manager can identify it."""

    def test_names_holding_process(self, tmp_path, monkeypatch):
        from yuu_clip.web import file_deletion
        monkeypatch.setattr(file_deletion, "locking_processes", lambda path: ["Acme Backup"])
        exc = file_deletion.locked_files_error([tmp_path / "clip.mkv"])
        assert exc.status_code == 409
        assert "open in: Acme Backup" in exc.detail

    def test_falls_back_when_holder_unknown(self, tmp_path, monkeypatch):
        from yuu_clip.web import file_deletion
        monkeypatch.setattr(file_deletion, "locking_processes", lambda path: [])
        exc = file_deletion.locked_files_error([tmp_path / "clip.mkv"])
        assert exc.status_code == 409
        assert "another program" in exc.detail

    def test_locking_processes_empty_off_windows(self, monkeypatch):
        from yuu_clip.web import file_deletion
        monkeypatch.setattr(file_deletion.sys, "platform", "linux")
        assert file_deletion.locking_processes(Path("/tmp/x.mkv")) == []


class TestReelEsc:
    def _esc(self, s):
        from yuu_clip.reel import _esc
        return _esc(s)

    def test_plain_path_unchanged(self):
        assert self._esc("/usr/share/fonts/arial.ttf") == "/usr/share/fonts/arial.ttf"

    def test_backslash_doubled(self):
        result = self._esc("C:\\fonts\\arial.ttf")
        assert "\\\\" in result

    def test_colon_escaped(self):
        result = self._esc("C:/fonts/arial.ttf")
        assert "\\:" in result

    def test_percent_doubled(self):
        result = self._esc("path%20with%20spaces")
        assert "%%" in result

    def test_single_quote_escaped(self):
        result = self._esc("path/with'quote")
        assert "'\\''" in result

    def test_empty_string_unchanged(self):
        assert self._esc("") == ""


class TestBuildXfadeCmd:
    def _build(self, segments, durations, transition="fade", trans_dur=0.5):
        from pathlib import Path

        from yuu_clip.reel import _build_xfade_cmd
        paths = [Path(f"/fake/seg{i}.mkv") for i in range(segments)]
        durs = durations if isinstance(durations, list) else [durations] * segments
        transitions = [transition] * max(0, segments - 1)
        output = Path("/fake/output.mkv")
        return _build_xfade_cmd(paths, durs, output, transitions, trans_dur)

    def test_single_segment_uses_passthrough_filter(self):
        cmd = self._build(1, [10.0])
        fc = " ".join(cmd)
        assert "copy[vout]" in fc
        assert "acopy[aout]" in fc

    def test_two_segments_produces_one_xfade(self):
        cmd = self._build(2, [10.0, 10.0])
        fc_idx = cmd.index("-filter_complex") + 1
        fc = cmd[fc_idx]
        assert "xfade" in fc
        assert "acrossfade" in fc

    def test_output_path_present_in_command(self):
        cmd = self._build(2, [5.0, 5.0])
        cmd_str = " ".join(cmd)
        assert "output.mkv" in cmd_str

    def test_all_input_paths_present(self):
        cmd = self._build(3, [5.0, 5.0, 5.0])
        cmd_str = " ".join(cmd)
        for i in range(3):
            assert f"seg{i}.mkv" in cmd_str

    def test_three_segments_produces_two_xfades(self):
        cmd = self._build(3, [10.0, 10.0, 10.0])
        fc_idx = cmd.index("-filter_complex") + 1
        fc = cmd[fc_idx]
        assert fc.count("xfade") == 2

    def test_vout_and_aout_mapped(self):
        cmd = self._build(2, [5.0, 5.0])
        assert "[vout]" in cmd
        assert "[aout]" in cmd

    def test_inputs_are_timebase_normalized(self):
        # Every input is normalized to one timebase / fps / audio format before
        # xfade, so clips with mixed source timebases don't fail the encode with
        # "timebases do not match" (which produced a 0-byte reel).
        cmd = self._build(2, [5.0, 5.0])
        fc = cmd[cmd.index("-filter_complex") + 1]
        assert fc.count("setsar=1") == 2      # one video normalization per input
        assert fc.count("asettb=AVTB") == 2   # one audio normalization per input
        assert "fps=" in fc


class TestFfmpegPath:
    """_ffmpeg_path converts backslash paths to forward slashes for FFmpeg."""

    def _fp(self, path_str):
        from pathlib import Path

        from yuu_clip.analyze.extract import _ffmpeg_path
        return _ffmpeg_path(Path(path_str))

    def test_posix_path_unchanged(self):
        result = self._fp("/usr/share/video.mkv")
        assert "\\" not in result
        assert result.endswith("video.mkv")

    def test_windows_path_uses_forward_slashes(self):
        # On Windows, Path("C:\\Users\\foo\\bar.mkv").as_posix() → "C:/Users/foo/bar.mkv"
        from pathlib import PureWindowsPath

        from yuu_clip.analyze.extract import _ffmpeg_path
        p = PureWindowsPath("C:\\Users\\foo\\bar.mkv")
        result = _ffmpeg_path(p)
        assert "\\" not in result
        assert "bar.mkv" in result

    def test_returns_string(self):
        result = self._fp("/some/path.mkv")
        assert isinstance(result, str)


class TestExportClipCommand:
    """Validate the ffmpeg command built by export_clip without running FFmpeg."""

    def _run_export(self, tmp_path, reencode=False, subtitle_path=None,
                    audio_stream_index=None):
        from unittest.mock import MagicMock, patch

        from yuu_clip.analyze.extract import export_clip

        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")
        output = tmp_path / "out.mkv"

        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            r = MagicMock()
            r.returncode = 0
            return r

        with patch("yuu_clip.analyze.extract.subprocess.run", side_effect=fake_run), \
             patch("yuu_clip.analyze.extract._verify_export_duration"), \
             patch("yuu_clip.analyze.extract.find_ffmpeg", return_value=("ffmpeg", None)):
            export_clip(
                video, start_ms=5_000, end_ms=15_000, output_path=output,
                reencode=reencode, subtitle_path=subtitle_path,
                audio_stream_index=audio_stream_index,
            )

        return captured["cmd"]

    def test_stream_copy_mode_uses_copy_codec(self, tmp_path):
        cmd = self._run_export(tmp_path)
        assert "-c" in cmd
        copy_idx = cmd.index("-c")
        assert cmd[copy_idx + 1] == "copy"

    def test_stream_copy_seek_before_input(self, tmp_path):
        cmd = self._run_export(tmp_path)
        ss_idx = cmd.index("-ss")
        i_idx  = cmd.index("-i")
        assert ss_idx < i_idx

    def test_reencode_seek_after_input(self, tmp_path):
        cmd = self._run_export(tmp_path, reencode=True)
        i_idx  = cmd.index("-i")
        ss_idx = next(i for i, v in enumerate(cmd) if v == "-ss" and i > i_idx)
        assert ss_idx > i_idx

    def test_reencode_uses_libx264(self, tmp_path):
        cmd = self._run_export(tmp_path, reencode=True)
        assert "libx264" in cmd

    def test_subtitle_forces_reencode(self, tmp_path):
        subtitle = tmp_path / "subs.srt"
        subtitle.write_text("1\n00:00:00,000 --> 00:00:01,000\nHi\n\n", encoding="utf-8")
        cmd = self._run_export(tmp_path, subtitle_path=subtitle)
        assert "libx264" in cmd
        assert any("subtitles=" in str(arg) for arg in cmd)

    def test_audio_stream_index_adds_map_flags(self, tmp_path):
        cmd = self._run_export(tmp_path, audio_stream_index=2)
        maps = [cmd[i + 1] for i, v in enumerate(cmd) if v == "-map"]
        assert "0:v:0" in maps
        assert "0:2" in maps

    def test_no_audio_stream_index_omits_map_flags(self, tmp_path):
        cmd = self._run_export(tmp_path)
        assert "-map" not in cmd

    def test_failure_raises_runtime_error(self, tmp_path):
        from unittest.mock import MagicMock, patch

        from yuu_clip.analyze.extract import export_clip

        video = tmp_path / "video.mkv"
        video.write_bytes(b"fake")

        def failing_run(cmd, **kwargs):
            r = MagicMock()
            r.returncode = 1
            r.stderr = "codec not found"
            return r

        with patch("yuu_clip.analyze.extract.subprocess.run", side_effect=failing_run), \
             patch("yuu_clip.analyze.extract.find_ffmpeg", return_value=("ffmpeg", None)):
            with pytest.raises(RuntimeError, match="FFmpeg clip export failed"):
                export_clip(video, 0, 5_000, tmp_path / "out.mkv")


class TestRunExportSubprocessCleanup:
    """A batch-export SSE client disconnecting mid-encode must not leave the
    per-clip python+ffmpeg tree running."""

    class _FakeProc:
        def __init__(self, returncode):
            self.returncode = returncode
            self.pid = 4242

    def test_returns_code_and_output_on_success(self, tmp_path: Path):
        from unittest.mock import AsyncMock, patch

        from yuu_clip.web.routes.clips import export

        proc = self._FakeProc(returncode=0)

        async def fake_exec(*_a, **_k):
            return proc

        async def fake_communicate():
            return (b"encoded ok", None)

        proc.communicate = fake_communicate
        with patch.object(export.asyncio, "create_subprocess_exec", fake_exec), \
             patch.object(export, "terminate_process_tree_async", new_callable=AsyncMock) as term:
            returncode, out = asyncio.run(export._run_export_subprocess(["x"], tmp_path))

        assert (returncode, out) == (0, b"encoded ok")
        term.assert_not_called()  # process exited cleanly - nothing to kill

    def test_kills_tree_when_cancelled_mid_encode(self, tmp_path: Path):
        from unittest.mock import AsyncMock, patch

        from yuu_clip.web.routes.clips import export

        proc = self._FakeProc(returncode=None)  # still running when cancelled

        async def fake_exec(*_a, **_k):
            return proc

        async def fake_communicate():
            raise asyncio.CancelledError()

        proc.communicate = fake_communicate
        with patch.object(export.asyncio, "create_subprocess_exec", fake_exec), \
             patch.object(export, "terminate_process_tree_async", new_callable=AsyncMock) as term:
            with pytest.raises(asyncio.CancelledError):
                asyncio.run(export._run_export_subprocess(["x"], tmp_path))

        term.assert_called_once_with(proc)


class TestSafeFilename:
    """_safe_filename strips directory traversal components."""

    def _safe(self, name, default="highlights.mkv"):
        from yuu_clip.web.routes.reel import _safe_filename
        return _safe_filename(name, default)

    def test_plain_name_unchanged(self):
        assert self._safe("myreel.mkv") == "myreel.mkv"

    def test_strips_parent_components(self):
        assert self._safe("../../etc/evil") == "evil"

    def test_strips_windows_path(self):
        # Path("C:/Windows/System32/cmd.exe").name == "cmd.exe" on all platforms
        result = self._safe("C:/Windows/System32/cmd.exe")
        assert "/" not in result
        assert "\\" not in result

    def test_empty_name_returns_default(self):
        assert self._safe("", "highlights.mkv") == "highlights.mkv"

    def test_custom_default_used_when_empty(self):
        assert self._safe("", "fallback.mkv") == "fallback.mkv"

    def test_name_with_spaces_preserved(self):
        result = self._safe("my reel.mkv")
        assert result == "my reel.mkv"


# ---------------------------------------------------------------------------
# _resolve_clip_files
# ---------------------------------------------------------------------------

class TestResolveClipFiles:
    """_resolve_clip_files locates exported clip files and probes their durations."""

    def _make_clip(self, clip_id, video_id, start_ms, start_hms):
        import unittest.mock as mock
        clip = mock.MagicMock()
        clip.id = clip_id
        clip.video_id = video_id
        clip.start_ms = start_ms
        clip.start_hms = start_hms
        return clip

    def _make_video(self, video_id, filename):
        import unittest.mock as mock
        video = mock.MagicMock()
        video.id = video_id
        video.filename = filename
        return video

    def test_raises_when_no_export_file_found(self, tmp_path):
        import pytest

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(1, 10, 0, "0:00:00")
        video = self._make_video(10, "session.mkv")
        with pytest.raises(FileNotFoundError, match="clip 1"):
            _resolve_clip_files([clip], {10: video}, tmp_path)

    def test_finds_mkv_export(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(1, 10, 0, "0-00-00")
        video = self._make_video(10, "session.mkv")
        export_file = tmp_path / "session_clip1_0-00-00.mkv"
        export_file.write_bytes(b"fake")
        with mock.patch("yuu_clip.reel._probe_fps", return_value=30.0), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=60.0):
            files, durations, fps = _resolve_clip_files([clip], {10: video}, tmp_path)
        assert files == [export_file]
        assert durations == [60.0]
        assert fps == 30.0

    def test_finds_mp4_export(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(2, 10, 0, "0-00-00")
        video = self._make_video(10, "session.mkv")
        export_file = tmp_path / "session_clip2_0-00-00.mp4"
        export_file.write_bytes(b"fake")
        with mock.patch("yuu_clip.reel._probe_fps", return_value=60.0), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=30.0):
            files, durations, fps = _resolve_clip_files([clip], {10: video}, tmp_path)
        assert files[0].suffix == ".mp4"
        assert fps == 60.0

    def test_fps_probed_only_from_first_file(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip_a = self._make_clip(1, 10, 0, "0-00-00")
        clip_b = self._make_clip(2, 10, 60_000, "0-01-00")
        video = self._make_video(10, "session.mkv")
        (tmp_path / "session_clip1_0-00-00.mkv").write_bytes(b"fake")
        (tmp_path / "session_clip2_0-01-00.mkv").write_bytes(b"fake")
        probe_fps_calls = []
        def counting_fps(path):
            probe_fps_calls.append(path)
            return 30.0
        with mock.patch("yuu_clip.reel._probe_fps", side_effect=counting_fps), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=10.0):
            _resolve_clip_files([clip_a, clip_b], {10: video}, tmp_path)
        assert len(probe_fps_calls) == 1

    def test_fps_falls_back_to_30_when_probe_fails(self, tmp_path):
        import unittest.mock as mock

        from yuu_clip.reel import _resolve_clip_files
        clip = self._make_clip(1, 10, 0, "0-00-00")
        video = self._make_video(10, "session.mkv")
        (tmp_path / "session_clip1_0-00-00.mkv").write_bytes(b"fake")
        with mock.patch("yuu_clip.reel._probe_fps", side_effect=Exception("probe failed")), \
             mock.patch("yuu_clip.reel._probe_duration", return_value=10.0):
            _, _, fps = _resolve_clip_files([clip], {10: video}, tmp_path)
        assert fps == 30.0


class TestRefreshCaptionSidecars:
    """retranscribe --refresh-captions regenerates an existing SRT sidecar in place,
    but does nothing for a clip that was never exported (no sidecar to refresh)."""

    def _make_clip(self, speaker_label):
        import datetime
        import types
        seg = types.SimpleNamespace(
            start_ms=1_000, end_ms=2_000, text="updated text", speaker_label=speaker_label
        )
        tx = types.SimpleNamespace(
            audio_track_id=1, created_at=datetime.datetime(2024, 6, 1), segments=[seg]
        )
        track = types.SimpleNamespace(
            id=1, label="combined", do_transcribe=True, transcripts=[tx]
        )
        return types.SimpleNamespace(
            id=7, start_ms=0, end_ms=10_000, start_offset=0.0, end_offset=0.0,
            start_hms="00:00:00", clip_transcripts=[tx],
            video=types.SimpleNamespace(filename="session.mkv", audio_tracks=[track]),
        )

    def _exports_dir(self, proj_dir):
        exports = proj_dir / ".yuu-clip" / "exports"
        exports.mkdir(parents=True, exist_ok=True)
        return exports

    def test_refreshes_existing_sidecar(self, tmp_path):
        from yuu_clip.export.render import refresh_caption_sidecars
        exports = self._exports_dir(tmp_path)
        srt = exports / "session_clip7_00-00-00.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nstale\n\n", encoding="utf-8")

        refresh_caption_sidecars(self._make_clip("SPEAKER_00"), tmp_path)

        content = srt.read_text(encoding="utf-8")
        assert "updated text" in content
        assert "[Speaker 00]" in content
        assert "stale" not in content

    def test_noop_when_no_sidecar_exists(self, tmp_path):
        from yuu_clip.export.render import refresh_caption_sidecars
        exports = self._exports_dir(tmp_path)

        refresh_caption_sidecars(self._make_clip("SPEAKER_00"), tmp_path)

        assert list(exports.glob("*.srt")) == []


class TestExportBaseStemPreset:
    """{preset} filename placeholder and the automatic "_{preset}" collision-safety
    suffix for non-default presets (export_naming.export_base_stem)."""

    def _cand(self, clip_id=1, start_hms="0:15", score=0.8, video_filename="session.mkv"):
        return SimpleNamespace(
            id=clip_id, start_hms=start_hms, end_ms=90_000, score_overall=score,
            video=SimpleNamespace(filename=video_filename),
        )

    def test_default_preset_is_unchanged_from_pre_plan07_naming(self):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE, export_base_stem
        cand = self._cand()
        assert (
            export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE)
            == export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE, preset="default")
        )

    def test_non_default_preset_appends_suffix(self):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE, export_base_stem
        cand = self._cand()
        base = export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE)
        with_preset = export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE, preset="youtube-1080p")
        assert with_preset == f"{base}_youtube-1080p"

    def test_preset_placeholder_renders_directly(self):
        from yuu_clip.export.naming import export_base_stem
        cand = self._cand()
        stem = export_base_stem(cand, "{video}_{preset}", preset="discord-10mb")
        assert stem == "session_discord-10mb"
        # Template already used {preset} - no double suffix appended.
        assert not stem.endswith("discord-10mb_discord-10mb")

    def test_two_presets_never_collide(self):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE, export_base_stem
        cand = self._cand()
        a = export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE, preset="youtube-1080p")
        b = export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE, preset="discord-10mb")
        default = export_base_stem(cand, DEFAULT_EXPORT_NAME_TEMPLATE)
        assert len({a, b, default}) == 3
