from __future__ import annotations

# ---------------------------------------------------------------------------
# Captions VTT endpoint
# ---------------------------------------------------------------------------

class TestCaptionsVTT:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_captions_vtt_404_without_srt(self, client):
        clip = self._first_clip(client)
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 404

    def test_captions_vtt_returns_vtt_format(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        srt_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.srt"
        srt_file.write_text(
            "1\n00:00:01,000 --> 00:00:03,500\nHello world\n\n",
            encoding="utf-8",
        )
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 200
        assert "text/vtt" in r.headers["content-type"]
        assert r.text.startswith("WEBVTT")
        assert "00:00:01.000 --> 00:00:03.500" in r.text


# ---------------------------------------------------------------------------
# SRT to VTT conversion
# ---------------------------------------------------------------------------

class TestSrtToVtt:
    """_srt_to_vtt converts SRT comma separators to VTT dot separators."""

    def _convert(self, srt):
        from yuu_clip.web.routes.clips import _srt_to_vtt
        return _srt_to_vtt(srt)

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
# subtitles.py — _label_display
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
# subtitles.py — _ms_to_srt_time
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
# subtitles.py — lines_to_srt
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
# subtitles.py — collect_clip_subtitles (with mock DB objects)
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
# subtitles.py — merged_srt_lines
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
# Bug-hunt: clip description contains raw HTML characters (XSS regression)
# ---------------------------------------------------------------------------

class TestClipDescriptionRawText:
    """The API must return raw (unescaped) description text.
    The JS layer is responsible for escaping it before inserting into innerHTML.
    These tests document that contract so a regression (e.g. API double-escaping
    or JS forgetting to call escHtml) can be caught.
    """

    def _seed_clip_with_description(self, project_dir, description: str) -> int:
        """Insert a clip with the given description and return its id."""
        from yuu_clip.db.models import ClipCandidate, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            vid_id = session.query(ClipCandidate).first().video_id
            clip = ClipCandidate(
                video_id=vid_id,
                start_ms=900_000,
                end_ms=960_000,
                score_overall=0.5,
                description=description,
                status="pending",
            )
            session.add(clip)
            session.commit()
            return clip.id
        finally:
            session.close()

    def test_description_with_html_chars_returned_unescaped(self, client, project_dir):
        """API must return raw HTML characters in description, not entity-encoded.
        The JavaScript renderDetail() must call escHtml(clip.description) before
        writing to innerHTML — this test locks in the API contract so a regression
        on either side is visible.
        """
        raw = '<script>alert("xss")</script>'
        clip_id = self._seed_clip_with_description(project_dir, raw)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        # API returns raw text — the JS must escape it
        assert r.json()["description"] == raw

    def test_description_with_quotes_returned_unescaped(self, client, project_dir):
        """Quotes in LLM-generated descriptions must survive the API round-trip."""
        raw = 'He said "hello" & she said \'bye\''
        clip_id = self._seed_clip_with_description(project_dir, raw)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert r.json()["description"] == raw


# ---------------------------------------------------------------------------
# subtitles.py — export_srt_sidecars
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
# subtitles.py — collect_clip_subtitles: clip_transcripts override
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
# analyze/labeler.py — label_tracks single-track auto-label
# ---------------------------------------------------------------------------

class TestLabelTracksSingleTrack:
    def _make_video_info(self, n_streams, title_tags=None):
        from pathlib import Path

        from yuu_clip.analyze.probe import AudioStreamInfo, VideoInfo
        streams = [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None,
                title_tag=(title_tags[i] if title_tags else None),
            )
            for i in range(n_streams)
        ]
        return VideoInfo(
            path=Path("fake.mkv"), duration_ms=60_000,
            fps=30.0, width=1920, height=1080, audio_streams=streams,
        )

    def test_single_track_auto_labeled_combined(self):
        from yuu_clip.analyze.labeler import label_tracks
        vi = self._make_video_info(1)
        result = label_tracks(vi, non_interactive=True)
        assert len(result) == 1
        assert result[0]["label"] == "combined"
        assert result[0]["do_transcribe"] is True
        assert result[0]["do_score"] is True

    def test_multi_track_non_interactive_no_profile_uses_track0(self):
        from yuu_clip.analyze.labeler import label_tracks
        vi = self._make_video_info(3)
        result = label_tracks(vi, non_interactive=True)
        assert len(result) == 3
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"
        assert result[2]["label"] == "unlabeled"
        assert result[1]["do_transcribe"] is False
        assert result[2]["do_score"] is False


# ---------------------------------------------------------------------------
# analyze/labeler.py — _label_non_interactive
# ---------------------------------------------------------------------------

class TestLabelNonInteractive:
    def _make_streams(self, n, title_tags=None):
        from yuu_clip.analyze.probe import AudioStreamInfo
        return [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None,
                title_tag=(title_tags[i] if title_tags else None),
            )
            for i in range(n)
        ]

    def test_single_stream_returns_primary_only(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(1)
        result = _label_non_interactive(streams, None)
        assert len(result) == 1
        assert result[0]["label"] == "combined"

    def test_two_streams_second_is_unlabeled(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, None)
        assert result[0]["label"] == "combined"
        assert result[1]["label"] == "unlabeled"
        assert result[1]["do_transcribe"] is False

    def test_stream_index_preserved(self):
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, None)
        assert result[0]["stream_index"] == 0
        assert result[1]["stream_index"] == 1

    def test_default_profile_name_skipped(self):
        """__default__ profile name should not attempt a profile lookup."""
        from yuu_clip.analyze.labeler import _label_non_interactive
        streams = self._make_streams(2)
        result = _label_non_interactive(streams, "__default__")
        assert result[0]["label"] == "combined"


# ---------------------------------------------------------------------------
# analyze/labeler.py — _guess_label_index
# ---------------------------------------------------------------------------

class TestGuessLabelIndex:
    def _make_stream(self, title):
        from yuu_clip.analyze.probe import AudioStreamInfo
        return AudioStreamInfo(
            stream_index=0, codec_name="aac", sample_rate=48000,
            channels=2, channel_layout="stereo", duration_ms=None, title_tag=title,
        )

    def _guess(self, title):
        from yuu_clip.analyze.labeler import _guess_label_index
        return _guess_label_index(self._make_stream(title))

    def test_mic_in_title_returns_player_voice(self):
        assert self._guess("Mic (Clean)") == 1

    def test_voice_in_title_returns_player_voice(self):
        assert self._guess("My Voice") == 1

    def test_desktop_in_title_returns_combined(self):
        assert self._guess("Desktop Audio") == 4

    def test_game_in_title_returns_combined(self):
        assert self._guess("Game Capture") == 4

    def test_unknown_title_returns_unlabeled(self):
        assert self._guess("Track 1") == 5

    def test_none_title_returns_unlabeled(self):
        assert self._guess(None) == 5


# ---------------------------------------------------------------------------
# analyze/overlap.py — detect_transcript_overlap (unit, no DB)
# ---------------------------------------------------------------------------

class TestDetectTranscriptOverlapUnit:
    _next_id = 100

    def _make_track(self, label, do_score, words):
        """Build a minimal track-like object whose transcript returns *words*."""
        import types
        TestDetectTranscriptOverlapUnit._next_id += 1
        return types.SimpleNamespace(
            id=TestDetectTranscriptOverlapUnit._next_id,
            label=label,
            do_score=do_score,
            relevance_weight=1.0,
            do_transcribe=False,
            _words=words,
        )

    def _run(self, tracks, threshold=0.75):
        from yuu_clip.analyze.overlap import detect_transcript_overlap

        track_text_map = {t.id: t._words for t in tracks}

        class FakeTx:
            def __init__(self, text):
                self._text = text
            def full_text(self):
                return self._text

        class FakeOrderBy:
            def __init__(self, text):
                self._text = text
            def order_by(self, *a):
                return self
            def first(self):
                return FakeTx(self._text)

        class FakeQuery:
            def filter_by(self, **kw):
                tid = kw.get("audio_track_id")
                return FakeOrderBy(track_text_map.get(tid, ""))

        class FakeSession:
            def query(self, model):
                return FakeQuery()

        return detect_transcript_overlap(tracks, FakeSession(), threshold=threshold)

    def test_no_combined_returns_false(self):
        tracks = [self._make_track("player_voice", True, "hello world foo bar")]
        result = self._run(tracks)
        assert result is False

    def test_no_specialized_returns_false(self):
        long_text = " ".join(["word"] * 25)
        tracks = [self._make_track("combined", True, long_text)]
        result = self._run(tracks)
        assert result is False

    def test_combined_too_short_returns_false(self):
        tracks = [
            self._make_track("combined", True, "short text"),
            self._make_track("player_voice", True, "short text"),
        ]
        result = self._run(tracks)
        assert result is False

    def test_high_overlap_disables_specialized_scoring(self):
        # _word_set uses [a-z']+ so words must be purely alphabetic
        import string
        # 26 unique single-letter words a-z as combined; specialized uses a-x (24)
        alpha = list(string.ascii_lowercase)        # 26 unique words
        combined_words = " ".join(alpha)            # a b c ... z
        specialized_words = " ".join(alpha[:24])    # a b c ... x  (24/24 = 100% overlap)
        combined = self._make_track("combined", True, combined_words)
        combined.id = 10
        specialized = self._make_track("player_voice", True, specialized_words)
        specialized.id = 11
        tracks = [combined, specialized]
        result = self._run(tracks, threshold=0.75)
        assert result is True
        assert specialized.do_score is False
        assert combined.do_transcribe is True
        assert combined.do_score is True

    def test_low_overlap_leaves_specialized_unchanged(self):
        import string
        alpha = list(string.ascii_lowercase)        # 26 unique words
        # combined has a-z; specialized has entirely different words
        combined_words = " ".join(alpha)
        # build 20 words not in alpha by repeating suffixes
        specialized_words = " ".join([f"zz{c}" for c in alpha[:20]])
        combined = self._make_track("combined", True, combined_words)
        combined.id = 10
        specialized = self._make_track("player_voice", True, specialized_words)
        specialized.id = 11
        tracks = [combined, specialized]
        result = self._run(tracks, threshold=0.75)
        assert result is False
        assert specialized.do_score is True


# ---------------------------------------------------------------------------
# _word_set (overlap detection helper)
# ---------------------------------------------------------------------------

class TestWordSet:
    def _ws(self, text):
        from yuu_clip.analyze.overlap import _word_set
        return _word_set(text)

    def test_empty_string_returns_empty_set(self):
        assert self._ws("") == set()

    def test_lowercases_words(self):
        assert "hello" in self._ws("Hello World")
        assert "world" in self._ws("Hello World")

    def test_strips_punctuation(self):
        result = self._ws("hello, world!")
        assert "hello" in result
        assert "world" in result
        assert "," not in result
        assert "!" not in result

    def test_apostrophes_preserved(self):
        result = self._ws("can't won't")
        assert "can't" in result

    def test_numbers_excluded(self):
        result = self._ws("123 hello")
        assert "hello" in result
        assert "123" not in result
