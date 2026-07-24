from __future__ import annotations

# ---------------------------------------------------------------------------
# SRT to VTT conversion
# ---------------------------------------------------------------------------

class TestSrtToVtt:
    """srt_to_vtt converts SRT comma separators to VTT dot separators."""

    def _convert(self, srt):
        from yuu_clip.web.routes.common import srt_to_vtt
        return srt_to_vtt(srt)

    def test_prepends_webvtt_header(self):
        result = self._convert("")
        assert result.startswith("WEBVTT")

    def test_comma_replaced_by_dot_in_timestamp(self):
        srt = "1\n00:00:01,000 --> 00:00:03,500\nHello\n\n"
        result = self._convert(srt)
        assert "00:00:01.000 --> 00:00:03.500" in result
        assert "," not in result.split("WEBVTT")[1].split("Hello")[0]

    def test_text_content_preserved(self):
        srt = "1\n00:00:01,000 --> 00:00:02,000\nSome text\n\n"
        result = self._convert(srt)
        assert "Some text" in result

    def test_multiple_entries(self):
        srt = (
            "1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n"
            "2\n00:00:03,500 --> 00:00:05,000\nSecond\n\n"
        )
        result = self._convert(srt)
        assert "00:00:01.000 --> 00:00:02.000" in result
        assert "00:00:03.500 --> 00:00:05.000" in result
        assert "First" in result
        assert "Second" in result

    def test_empty_srt_produces_webvtt_only(self):
        result = self._convert("")
        assert result == "WEBVTT\n\n"


# ---------------------------------------------------------------------------
# subtitles.py - _label_display
# ---------------------------------------------------------------------------

class TestLabelDisplay:
    def _ld(self, label):
        from yuu_clip.subtitles import _label_display
        return _label_display(label)

    def test_known_player_voice(self):
        assert self._ld("player_voice") == "Player"

    def test_known_ingame_voicechat(self):
        assert self._ld("ingame_voicechat") == "Voice Chat"

    def test_known_combined(self):
        assert self._ld("combined") == "Combined"

    def test_known_unlabeled(self):
        assert self._ld("unlabeled") == "Unknown"

    def test_unknown_label_titlifies(self):
        assert self._ld("my_custom_track") == "My Custom Track"


# ---------------------------------------------------------------------------
# subtitles.py - _ms_to_srt_time
# ---------------------------------------------------------------------------

class TestMsToSrtTime:
    def _fmt(self, ms):
        from yuu_clip.subtitles import _ms_to_srt_time
        return _ms_to_srt_time(ms)

    def test_zero(self):
        assert self._fmt(0) == "00:00:00,000"

    def test_negative_clamped_to_zero(self):
        assert self._fmt(-500) == "00:00:00,000"

    def test_one_second(self):
        assert self._fmt(1000) == "00:00:01,000"

    def test_one_minute(self):
        assert self._fmt(60_000) == "00:01:00,000"

    def test_one_hour(self):
        assert self._fmt(3_600_000) == "01:00:00,000"

    def test_fractional_ms(self):
        assert self._fmt(1_234) == "00:00:01,234"

    def test_complex_value(self):
        # 1h 2m 3s 456ms
        ms = 3_600_000 + 2 * 60_000 + 3_000 + 456
        assert self._fmt(ms) == "01:02:03,456"


# ---------------------------------------------------------------------------
# subtitles.py - lines_to_srt
# ---------------------------------------------------------------------------

class TestLinesToSrt:
    def _srt(self, lines):
        from yuu_clip.subtitles import lines_to_srt
        return lines_to_srt(lines)

    def test_empty_input_returns_empty_string(self):
        assert self._srt([]) == ""

    def test_single_line_no_speaker(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 1000, "Hello")])
        assert "1\n" in result
        assert "00:00:00,000 --> 00:00:01,000" in result
        assert "Hello" in result
        assert "[" not in result

    def test_single_line_with_speaker(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 1000, "Hi", "Player")])
        assert "[Player] Hi" in result

    def test_multiple_lines_sorted_by_start(self):
        from yuu_clip.subtitles import SubLine
        lines = [SubLine(2000, 3000, "Second"), SubLine(0, 1000, "First")]
        result = self._srt(lines)
        first_pos = result.index("First")
        second_pos = result.index("Second")
        assert first_pos < second_pos

    def test_sequential_numbering(self):
        from yuu_clip.subtitles import SubLine
        lines = [SubLine(0, 500, "A"), SubLine(600, 1000, "B")]
        result = self._srt(lines)
        assert "1\n" in result
        assert "2\n" in result

    def test_text_is_stripped(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 500, "  trimmed  ")])
        assert "trimmed" in result
        assert "  trimmed  " not in result

    def test_blocks_separated_by_double_newline(self):
        from yuu_clip.subtitles import SubLine
        lines = [SubLine(0, 500, "A"), SubLine(600, 1000, "B")]
        result = self._srt(lines)
        assert "\n\n" in result


# ---------------------------------------------------------------------------
# subtitles.py - collect_clip_subtitles (with mock DB objects)
# ---------------------------------------------------------------------------

class TestCollectClipSubtitles:
    def _make_clip(self, tracks, start_offset=0.0, end_offset=0.0):
        class FakeClip:
            start_ms = 5_000
            end_ms   = 10_000

            class FakeVideo:
                pass

        clip = FakeClip()
        clip.start_offset = start_offset
        clip.end_offset = end_offset
        clip.video = FakeClip.FakeVideo()
        clip.video.audio_tracks = tracks
        return clip

    def _make_track(self, label, do_transcribe, segments, transcripts=None, track_id=1):
        import datetime
        import types
        track = types.SimpleNamespace(
            id=track_id,
            label=label,
            do_transcribe=do_transcribe,
            transcripts=transcripts if transcripts is not None else [],
        )
        if segments is not None:
            tx = types.SimpleNamespace(
                created_at=datetime.datetime(2024, 1, 1),
                segments=segments,
            )
            track.transcripts = [tx]
        return track

    def _make_seg(self, start_ms, end_ms, text):
        import types
        return types.SimpleNamespace(start_ms=start_ms, end_ms=end_ms, text=text)

    def test_empty_when_no_tracks(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        clip = self._make_clip([])
        assert collect_clip_subtitles(clip) == {}

    def test_skips_game_sounds_track(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg = self._make_seg(5_000, 8_000, "noise")
        track = self._make_track("game_sounds", True, [seg])
        clip = self._make_clip([track])
        assert collect_clip_subtitles(clip) == {}

    def test_skips_do_transcribe_false(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg = self._make_seg(5_000, 8_000, "speech")
        track = self._make_track("player_voice", False, [seg])
        clip = self._make_clip([track])
        assert collect_clip_subtitles(clip) == {}

    def test_skips_segments_outside_clip_window(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg_before = self._make_seg(0, 4_000, "before")
        seg_after  = self._make_seg(11_000, 13_000, "after")
        track = self._make_track("player_voice", True, [seg_before, seg_after])
        clip = self._make_clip([track])
        assert collect_clip_subtitles(clip) == {}

    def test_clips_segment_to_window_and_makes_relative(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        # segment spans 4s–8s; clip window is 5s–10s → clipped to 5s–8s → relative 0–3s
        seg = self._make_seg(4_000, 8_000, "overlap")
        track = self._make_track("player_voice", True, [seg])
        clip = self._make_clip([track])
        result = collect_clip_subtitles(clip)
        assert "player_voice" in result
        line = result["player_voice"][0]
        assert line.start_ms == 0
        assert line.end_ms == 3_000

    def test_fully_inside_segment_correct_relative_times(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        seg = self._make_seg(6_000, 9_000, "hello")
        track = self._make_track("player_voice", True, [seg])
        clip = self._make_clip([track])
        result = collect_clip_subtitles(clip)
        line = result["player_voice"][0]
        assert line.start_ms == 1_000
        assert line.end_ms == 4_000

    def test_uses_most_recent_transcript(self):
        import datetime
        import types

        from yuu_clip.subtitles import collect_clip_subtitles

        seg_old = self._make_seg(6_000, 7_000, "old")
        seg_new = self._make_seg(6_000, 7_000, "new")
        tx_old = types.SimpleNamespace(
            created_at=datetime.datetime(2024, 1, 1), segments=[seg_old]
        )
        tx_new = types.SimpleNamespace(
            created_at=datetime.datetime(2024, 6, 1), segments=[seg_new]
        )
        track = self._make_track("player_voice", True, None, transcripts=[tx_old, tx_new])
        clip = self._make_clip([track])
        result = collect_clip_subtitles(clip)
        assert result["player_voice"][0].text == "new"

    def test_start_offset_shifts_clip_window(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        # clip: 5s–10s with start_offset=+2s → effective window 7s–10s
        # segment 6s–9s should be clipped to 7s–9s → relative 0–2s
        seg = self._make_seg(6_000, 9_000, "speech")
        track = self._make_track("player_voice", True, [seg])
        clip = self._make_clip([track], start_offset=2.0)
        result = collect_clip_subtitles(clip)
        assert "player_voice" in result
        line = result["player_voice"][0]
        assert line.start_ms == 0
        assert line.end_ms == 2_000

    def test_negative_start_offset_expands_clip_window(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        # clip: 5s–10s with start_offset=-1s → effective window 4s–10s
        # segment 4s–6s → relative 0–2s
        seg = self._make_seg(4_000, 6_000, "speech")
        track = self._make_track("player_voice", True, [seg])
        clip = self._make_clip([track], start_offset=-1.0)
        result = collect_clip_subtitles(clip)
        assert "player_voice" in result
        line = result["player_voice"][0]
        assert line.start_ms == 0
        assert line.end_ms == 2_000


# ---------------------------------------------------------------------------
# subtitles.py - merged_srt_lines
# ---------------------------------------------------------------------------

class TestMergedSrtLines:
    def _make_clip(self, track_data):
        """track_data: list of (label, do_transcribe, segments)"""
        import datetime
        import types

        class FakeClip:
            start_ms = 0
            end_ms = 10_000
            start_offset = 0.0
            end_offset = 0.0

        clip = FakeClip()

        tracks = []
        for track_id, (label, do_transcribe, segs) in enumerate(track_data, start=1):
            seg_objs = [
                types.SimpleNamespace(start_ms=s, end_ms=e, text=t)
                for s, e, t in segs
            ]
            tx = types.SimpleNamespace(
                created_at=datetime.datetime(2024, 1, 1), segments=seg_objs
            )
            tracks.append(types.SimpleNamespace(
                id=track_id, label=label, do_transcribe=do_transcribe, transcripts=[tx]
            ))

        clip.video = types.SimpleNamespace(audio_tracks=tracks)
        return clip

    def test_empty_clip_returns_empty(self):
        from yuu_clip.subtitles import merged_srt_lines
        clip = self._make_clip([])
        assert merged_srt_lines(clip) == []

    def test_single_track_has_speaker_prefix(self):
        from yuu_clip.subtitles import merged_srt_lines
        clip = self._make_clip([("player_voice", True, [(1000, 2000, "hi")])])
        lines = merged_srt_lines(clip)
        assert len(lines) == 1
        assert lines[0].speaker == "Player"

    def test_multi_track_sorted_by_start(self):
        from yuu_clip.subtitles import merged_srt_lines
        clip = self._make_clip([
            ("player_voice", True, [(3000, 4000, "later")]),
            ("ingame_voicechat", True, [(1000, 2000, "earlier")]),
        ])
        lines = merged_srt_lines(clip)
        assert lines[0].text == "earlier"
        assert lines[1].text == "later"


# ---------------------------------------------------------------------------
# subtitles.py - export_srt_sidecars
# ---------------------------------------------------------------------------

class TestExportSrtSidecars:
    def _make_clip(self, track_data, start_ms=5_000, end_ms=10_000):
        """Build a minimal clip-like object with tracks and transcript segments."""
        import datetime
        import types

        clip = types.SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms,
            start_offset=0.0, end_offset=0.0,
            clip_transcripts=[],
        )

        tracks = []
        for track_id, (label, do_transcribe, segs) in enumerate(track_data, start=1):
            seg_objs = [
                types.SimpleNamespace(start_ms=s, end_ms=e, text=t)
                for s, e, t in segs
            ]
            tx = types.SimpleNamespace(
                audio_track_id=track_id,
                created_at=datetime.datetime(2024, 1, 1),
                segments=seg_objs,
            )
            tracks.append(types.SimpleNamespace(
                id=track_id, label=label, do_transcribe=do_transcribe, transcripts=[tx]
            ))

        clip.video = types.SimpleNamespace(audio_tracks=tracks)
        return clip

    def test_no_transcript_returns_empty(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([])
        written = export_srt_sidecars(clip, tmp_path, "test_clip")
        assert written == []
        assert list(tmp_path.glob("*.srt")) == []

    def test_single_track_writes_plain_srt(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([("player_voice", True, [(5_000, 8_000, "hello")])])
        written = export_srt_sidecars(clip, tmp_path, "test_clip")
        assert len(written) == 1
        assert written[0].name == "test_clip.srt"
        content = written[0].read_text(encoding="utf-8")
        assert "hello" in content
        assert "[Player]" not in content  # no speaker prefix for single-track

    def test_single_track_no_label_suffix(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([("player_voice", True, [(5_000, 8_000, "hi")])])
        export_srt_sidecars(clip, tmp_path, "test_clip")
        assert (tmp_path / "test_clip.srt").exists()
        assert not (tmp_path / "test_clip.player_voice.srt").exists()

    def test_multi_track_writes_per_label_and_merged(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([
            ("player_voice",     True, [(5_000, 7_000, "player says")]),
            ("ingame_voicechat", True, [(7_000, 9_000, "team says")]),
        ])
        written = export_srt_sidecars(clip, tmp_path, "test_clip")
        names = {p.name for p in written}
        assert "test_clip.player_voice.srt" in names
        assert "test_clip.ingame_voicechat.srt" in names
        assert "test_clip.srt" in names

    def test_multi_track_per_label_has_speaker_prefix(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([
            ("player_voice",     True, [(5_000, 7_000, "player says")]),
            ("ingame_voicechat", True, [(7_000, 9_000, "team says")]),
        ])
        export_srt_sidecars(clip, tmp_path, "test_clip")
        pv = (tmp_path / "test_clip.player_voice.srt").read_text(encoding="utf-8")
        assert "[Player]" in pv

    def test_multi_track_merged_has_both_speakers(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([
            ("player_voice",     True, [(5_000, 7_000, "player says")]),
            ("ingame_voicechat", True, [(7_000, 9_000, "team says")]),
        ])
        export_srt_sidecars(clip, tmp_path, "test_clip")
        merged = (tmp_path / "test_clip.srt").read_text(encoding="utf-8")
        assert "[Player]" in merged
        assert "[Voice Chat]" in merged

    def test_game_sounds_track_excluded(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([
            ("player_voice", True,  [(5_000, 8_000, "speech")]),
            ("game_sounds",  True,  [(5_000, 8_000, "noise")]),
        ])
        written = export_srt_sidecars(clip, tmp_path, "test_clip")
        # game_sounds excluded → only one transcribed track → single .srt
        assert len(written) == 1
        assert written[0].name == "test_clip.srt"

    def test_do_transcribe_false_excluded(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._make_clip([
            ("player_voice",     True,  [(5_000, 8_000, "speech")]),
            ("ingame_voicechat", False, [(5_000, 8_000, "not transcribed")]),
        ])
        written = export_srt_sidecars(clip, tmp_path, "test_clip")
        # Only one transcribable track → single .srt
        assert len(written) == 1
        assert written[0].name == "test_clip.srt"

    def test_creates_output_dir_if_missing(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        out = tmp_path / "nested" / "subdir"
        clip = self._make_clip([("player_voice", True, [(5_000, 8_000, "hi")])])
        export_srt_sidecars(clip, out, "test_clip")
        assert (out / "test_clip.srt").exists()


# ---------------------------------------------------------------------------
# subtitles.py - refresh_export_sidecars: only rewrites captions the user
# already has on disk, keyed to the current export filename template.
# ---------------------------------------------------------------------------

class TestRefreshExportSidecars:
    def _make_clip(self, start_ms=5_000, end_ms=10_000):
        import datetime
        import types

        seg = types.SimpleNamespace(start_ms=5_000, end_ms=8_000, text="hello")
        tx = types.SimpleNamespace(
            audio_track_id=1, created_at=datetime.datetime(2024, 1, 1), segments=[seg],
        )
        track = types.SimpleNamespace(id=1, label="player_voice", do_transcribe=True, transcripts=[tx])
        return types.SimpleNamespace(
            id=1, start_hms="0:05", start_ms=start_ms, end_ms=end_ms,
            start_offset=0.0, end_offset=0.0, clip_transcripts=[],
            video=types.SimpleNamespace(filename="session.mkv", audio_tracks=[track]),
        )

    def test_no_op_when_clip_was_never_exported(self, tmp_path):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
        from yuu_clip.subtitles import refresh_export_sidecars

        written = refresh_export_sidecars(self._make_clip(), tmp_path, DEFAULT_EXPORT_NAME_TEMPLATE)
        assert written == []
        assert list(tmp_path.glob("*.srt")) == []

    def test_regenerates_when_a_matching_sidecar_already_exists(self, tmp_path):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
        from yuu_clip.subtitles import refresh_export_sidecars

        (tmp_path / "session_clip1_0-05.srt").write_text("stale\n", encoding="utf-8")
        written = refresh_export_sidecars(self._make_clip(), tmp_path, DEFAULT_EXPORT_NAME_TEMPLATE)
        assert [p.name for p in written] == ["session_clip1_0-05.srt"]
        assert "hello" in (tmp_path / "session_clip1_0-05.srt").read_text(encoding="utf-8")

    def test_no_op_when_only_a_different_stem_sidecar_exists(self, tmp_path):
        from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE
        from yuu_clip.subtitles import refresh_export_sidecars

        (tmp_path / "old_template_name.srt").write_text("1\n", encoding="utf-8")
        written = refresh_export_sidecars(self._make_clip(), tmp_path, DEFAULT_EXPORT_NAME_TEMPLATE)
        assert written == []
        assert (tmp_path / "old_template_name.srt").read_text(encoding="utf-8") == "1\n"


# ---------------------------------------------------------------------------
# subtitles.py - collect_clip_subtitles: clip_transcripts override
# ---------------------------------------------------------------------------

class TestCollectClipSubtitlesClipTranscripts:
    """clip_transcripts (clip-level re-transcription) should override track-level transcripts."""

    def test_clip_transcript_overrides_track_transcript(self):
        import datetime
        import types

        from yuu_clip.subtitles import collect_clip_subtitles

        seg_track = types.SimpleNamespace(start_ms=5_000, end_ms=8_000, text="track-level")
        seg_clip  = types.SimpleNamespace(start_ms=5_000, end_ms=8_000, text="clip-level")

        tx_track = types.SimpleNamespace(
            audio_track_id=1,
            created_at=datetime.datetime(2024, 1, 1),
            segments=[seg_track],
        )
        tx_clip = types.SimpleNamespace(
            audio_track_id=1,
            created_at=datetime.datetime(2024, 6, 1),
            segments=[seg_clip],
        )

        track = types.SimpleNamespace(
            id=1, label="player_voice", do_transcribe=True, transcripts=[tx_track]
        )

        clip = types.SimpleNamespace(
            start_ms=5_000, end_ms=10_000,
            start_offset=0.0, end_offset=0.0,
            clip_transcripts=[tx_clip],
            video=types.SimpleNamespace(audio_tracks=[track]),
        )

        result = collect_clip_subtitles(clip)
        assert "player_voice" in result
        assert result["player_voice"][0].text == "clip-level"


# ---------------------------------------------------------------------------
# subtitles.py - clip_context_transcript_lines (export editor boundary context)
# ---------------------------------------------------------------------------

class TestClipContextTranscriptLines:
    def _seg(self, start_ms, end_ms, text):
        import types
        return types.SimpleNamespace(start_ms=start_ms, end_ms=end_ms, text=text)

    def _video(self, segments):
        import datetime
        import types
        tx = types.SimpleNamespace(created_at=datetime.datetime(2024, 1, 1), segments=segments)
        track = types.SimpleNamespace(id=1, label="player_voice", do_transcribe=True, transcripts=[tx])
        return types.SimpleNamespace(audio_tracks=[track])

    def _clip(self, start_ms=10_000, end_ms=20_000, start_offset=0.0, end_offset=0.0):
        import types
        return types.SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms,
            start_offset=start_offset, end_offset=end_offset,
        )

    def test_pads_context_and_flags_in_clip(self):
        from yuu_clip.subtitles import clip_context_transcript_lines
        video = self._video([
            self._seg(2_000, 4_000, "far before"),    # ends before window → excluded
            self._seg(6_000, 8_000, "before ctx"),     # in pad, not in clip
            self._seg(12_000, 15_000, "inside"),        # in clip
            self._seg(22_000, 24_000, "after ctx"),     # in pad, not in clip
            self._seg(26_000, 28_000, "far after"),     # starts after window → excluded
        ])
        lines = clip_context_transcript_lines(self._clip(), video, pad_ms=5_000)
        assert [ln["text"] for ln in lines] == ["before ctx", "inside", "after ctx"]
        assert [ln["in_clip"] for ln in lines] == [False, True, False]

    def test_offsets_shift_the_in_clip_window(self):
        from yuu_clip.subtitles import clip_context_transcript_lines
        # end_offset=+3s extends the clip to 23s → the 22s line is now in_clip.
        video = self._video([self._seg(21_000, 22_500, "extended tail")])
        lines = clip_context_transcript_lines(
            self._clip(end_offset=3.0), video, pad_ms=5_000
        )
        assert len(lines) == 1
        assert lines[0]["in_clip"] is True


# ---------------------------------------------------------------------------
# subtitles.py - per-speaker (diarization) subtitle display
# ---------------------------------------------------------------------------

class TestDiarizationSubtitles:
    """Diarization speaker_label on a segment becomes the [Speaker] subtitle prefix,
    taking precedence over the track-label prefix. The track label remains the
    fallback for segments without a diarization label (and for non-diarized clips)."""

    def _seg(self, start_ms, end_ms, text, speaker_label=None):
        import types
        return types.SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms, text=text, speaker_label=speaker_label
        )

    def _clip(self, track_data, start_ms=0, end_ms=10_000):
        """track_data: list of (label, do_transcribe, [seg, ...])."""
        import datetime
        import types
        tracks = []
        for track_id, (label, do_transcribe, segs) in enumerate(track_data, start=1):
            tx = types.SimpleNamespace(
                audio_track_id=track_id,
                created_at=datetime.datetime(2024, 1, 1),
                segments=segs,
            )
            tracks.append(types.SimpleNamespace(
                id=track_id, label=label, do_transcribe=do_transcribe, transcripts=[tx]
            ))
        return types.SimpleNamespace(
            start_ms=start_ms, end_ms=end_ms, start_offset=0.0, end_offset=0.0,
            clip_transcripts=[], video=types.SimpleNamespace(audio_tracks=tracks),
        )

    def test_collect_sets_speaker_from_label(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        clip = self._clip([("combined", True, [
            self._seg(1_000, 2_000, "hi", "SPEAKER_00"),
            self._seg(2_000, 3_000, "yo", "SPEAKER_01"),
        ])])
        lines = collect_clip_subtitles(clip)["combined"]
        assert lines[0].speaker == "Speaker 00"
        assert lines[1].speaker == "Speaker 01"

    def test_collect_no_label_leaves_speaker_blank(self):
        from yuu_clip.subtitles import collect_clip_subtitles
        clip = self._clip([("combined", True, [self._seg(1_000, 2_000, "hi")])])
        assert collect_clip_subtitles(clip)["combined"][0].speaker == ""

    def test_single_track_diarized_srt_has_speaker_prefix(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._clip([("combined", True, [
            self._seg(1_000, 2_000, "first", "SPEAKER_00"),
            self._seg(2_000, 3_000, "second", "SPEAKER_01"),
        ])])
        written = export_srt_sidecars(clip, tmp_path, "clip")
        assert len(written) == 1  # still one file for a single track
        srt = written[0].read_text(encoding="utf-8")
        assert "[Speaker 00] first" in srt
        assert "[Speaker 01] second" in srt

    def test_collect_sets_color_from_attached_speaker(self):
        import types

        from yuu_clip.subtitles import collect_clip_subtitles
        speaker = types.SimpleNamespace(display_name="Yuu", display_color="#abcdef")
        seg = types.SimpleNamespace(
            start_ms=1_000, end_ms=2_000, text="hi",
            speaker_label="SPEAKER_00", speaker_id=1, speaker=speaker,
        )
        clip = self._clip([("combined", True, [seg])])
        line = collect_clip_subtitles(clip)["combined"][0]
        assert line.speaker == "Yuu"
        assert line.color == "#abcdef"

    def test_diarization_speaker_wins_over_track_label(self, tmp_path):
        from yuu_clip.subtitles import export_srt_sidecars
        clip = self._clip([
            ("player_voice", True, [self._seg(1_000, 2_000, "mine", "SPEAKER_00")]),
            ("ingame_voicechat", True, [self._seg(3_000, 4_000, "theirs")]),
        ])
        export_srt_sidecars(clip, tmp_path, "clip")
        merged = (tmp_path / "clip.srt").read_text(encoding="utf-8")
        assert "[Speaker 00] mine" in merged     # diarization label, not [Player]
        assert "[Voice Chat] theirs" in merged   # track-label fallback when unlabeled


# ---------------------------------------------------------------------------
# subtitles.py - _segment_speaker (durable Speaker name vs raw-label fallback)
# ---------------------------------------------------------------------------

class TestSegmentSpeaker:
    def _seg(self, speaker_id=None, speaker=None, speaker_label=None):
        import types
        return types.SimpleNamespace(
            speaker_id=speaker_id, speaker=speaker, speaker_label=speaker_label
        )

    def test_prefers_attached_speaker_display_name(self):
        import types

        from yuu_clip.subtitles import _segment_speaker
        speaker = types.SimpleNamespace(display_name="Yuu")
        seg = self._seg(speaker_id=1, speaker=speaker, speaker_label="SPEAKER_00")
        assert _segment_speaker(seg) == "Yuu"

    def test_falls_back_to_prettified_raw_label(self):
        # Segment diarized before a durable Speaker was attached (speaker_id None).
        from yuu_clip.subtitles import _segment_speaker
        seg = self._seg(speaker_label="SPEAKER_02")
        assert _segment_speaker(seg) == "Speaker 02"

    def test_blank_when_no_label(self):
        from yuu_clip.subtitles import _segment_speaker
        assert _segment_speaker(self._seg()) == ""

    def test_falls_back_when_speaker_id_set_but_relation_missing(self):
        # speaker_id present but the relation didn't load → raw-label fallback,
        # never a crash on speaker.display_name.
        from yuu_clip.subtitles import _segment_speaker
        seg = self._seg(speaker_id=5, speaker=None, speaker_label="SPEAKER_01")
        assert _segment_speaker(seg) == "Speaker 01"


# ---------------------------------------------------------------------------
# subtitles.py - _segment_speaker_color (per-speaker subtitle colour)
# ---------------------------------------------------------------------------

class TestSegmentSpeakerColor:
    def _seg(self, speaker_id=None, speaker=None, speaker_label=None):
        import types
        return types.SimpleNamespace(
            speaker_id=speaker_id, speaker=speaker, speaker_label=speaker_label
        )

    def test_returns_attached_speaker_display_color(self):
        import types

        from yuu_clip.subtitles import _segment_speaker_color
        speaker = types.SimpleNamespace(display_color="#abcdef")
        seg = self._seg(speaker_id=1, speaker=speaker)
        assert _segment_speaker_color(seg) == "#abcdef"

    def test_blank_when_no_speaker_attached(self):
        # Unlike _segment_speaker, there is no raw-label fallback for colour.
        from yuu_clip.subtitles import _segment_speaker_color
        seg = self._seg(speaker_label="SPEAKER_02")
        assert _segment_speaker_color(seg) == ""

    def test_blank_when_speaker_id_set_but_relation_missing(self):
        from yuu_clip.subtitles import _segment_speaker_color
        seg = self._seg(speaker_id=5, speaker=None)
        assert _segment_speaker_color(seg) == ""


# ---------------------------------------------------------------------------
# subtitles.py - lines_to_srt: per-speaker colour rendering
# ---------------------------------------------------------------------------

class TestLinesToSrtColor:
    def _srt(self, lines):
        from yuu_clip.subtitles import lines_to_srt
        return lines_to_srt(lines)

    def test_colored_line_wrapped_in_font_tag(self):
        from yuu_clip.subtitles import SubLine
        line = SubLine(0, 1000, "Hi", "Player", None, "#4fc3f7")
        result = self._srt([line])
        assert '<font color="#4fc3f7">[Player] Hi</font>' in result

    def test_line_without_color_has_no_font_tag(self):
        from yuu_clip.subtitles import SubLine
        result = self._srt([SubLine(0, 1000, "Hi", "Player")])
        assert "<font" not in result
        assert "[Player] Hi" in result

    def test_colored_line_without_speaker_wraps_bare_text(self):
        from yuu_clip.subtitles import SubLine
        line = SubLine(0, 1000, "Hi", "", None, "#4fc3f7")
        result = self._srt([line])
        assert '<font color="#4fc3f7">Hi</font>' in result


# ---------------------------------------------------------------------------
# subtitles.py - _labeled_lines preserves colour when falling back to track label
# ---------------------------------------------------------------------------

class TestLabeledLinesPreservesColor:
    def test_diarized_line_keeps_its_color(self):
        from yuu_clip.subtitles import SubLine, _labeled_lines
        line = SubLine(0, 1000, "hi", "Yuu", 7, "#abcdef")
        result = _labeled_lines([line], "player_voice")
        assert result[0].color == "#abcdef"
        assert result[0].seg_id == 7

    def test_track_fallback_line_has_no_color(self):
        from yuu_clip.subtitles import SubLine, _labeled_lines
        line = SubLine(0, 1000, "hi")  # no diarized speaker → track-label fallback
        result = _labeled_lines([line], "player_voice")
        assert result[0].speaker == "Player"
        assert result[0].color == ""
